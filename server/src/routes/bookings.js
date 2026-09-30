import { Router } from 'express'
import { db, bookingFromRow } from '../db.js'
import { genId, getPageParams, overlaps, pad, wrap } from '../util.js'

export const router = Router()

router.get('/', wrap((req, res) => {
  const { page, pageSize, offset } = getPageParams(req.query)
  const where = []
  const params = []
  if (req.query.from) {
    where.push('date >= ?')
    params.push(req.query.from)
  }
  if (req.query.to) {
    where.push('date <= ?')
    params.push(req.query.to)
  }
  if (req.query.status) {
    where.push('status = ?')
    params.push(req.query.status)
  }
  const kw = (req.query.keyword || '').trim()
  if (kw) {
    where.push('(customer_name LIKE ? OR phone LIKE ?)')
    params.push(`%${kw}%`, `%${kw}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = db.prepare(`SELECT COUNT(*) AS n FROM bookings ${whereSql}`).get(...params).n
  const rows = db.prepare(
    `SELECT * FROM bookings ${whereSql} ORDER BY date DESC, start_time ASC, created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)
  res.json({ list: rows.map(bookingFromRow), total })
}))

/**
 * 校验并组装预约数据。excludeId 用于编辑时跳过自身的冲突判断。
 * 返回 { error: {status, message} } 或 { booking }
 */
function prepareBooking(b, excludeId = '') {
  if (!b.customerName || !b.customerName.trim()) {
    return { error: { status: 400, message: '请填写顾客姓名' } }
  }
  if (!Array.isArray(b.serviceIds) || !b.serviceIds.length) {
    return { error: { status: 400, message: '请选择至少一个服务项目' } }
  }
  if (!b.date || !b.startTime) {
    return { error: { status: 400, message: '请选择预约日期和时间' } }
  }

  const svcs = db.prepare(
    `SELECT * FROM services WHERE id IN (${b.serviceIds.map(() => '?').join(',')})`
  ).all(...b.serviceIds)
  if (svcs.length !== b.serviceIds.length) {
    return { error: { status: 400, message: '部分服务项目不存在或已删除' } }
  }
  const duration = svcs.reduce((s, x) => s + x.duration, 0)
  const [h, m] = b.startTime.split(':').map(Number)
  const end = new Date(2000, 0, 1, h, m + duration)
  const endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`

  // 同一理发师时间冲突校验（编辑时排除自身）
  if (b.stylistId) {
    const conflictRows = db.prepare(
      `SELECT * FROM bookings WHERE stylist_id=? AND date=? AND status IN ('pending','confirmed') AND id<>?`
    ).all(b.stylistId, b.date, excludeId)
    const startMin = h * 60 + m
    const endMin = startMin + duration
    for (const r of conflictRows) {
      const [bh, bm] = r.start_time.split(':').map(Number)
      const [eh, em] = r.end_time.split(':').map(Number)
      if (overlaps(startMin, endMin, bh * 60 + bm, eh * 60 + em)) {
        return {
          error: {
            status: 409,
            message: `时间冲突：${r.customer_name} ${r.start_time}-${r.end_time} 已预约该理发师`
          }
        }
      }
    }
  }

  return {
    fields: {
      customerId: b.customerId || '',
      customerName: b.customerName.trim(),
      phone: b.phone || '',
      serviceIds: b.serviceIds,
      serviceNames: svcs.map((s) => s.name),
      stylistId: b.stylistId || '',
      date: b.date,
      startTime: b.startTime,
      endTime,
      remark: b.remark || ''
    },
    duration
  }
}

router.post('/', wrap((req, res) => {
  const result = prepareBooking(req.body || {})
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })
  const booking = { id: genId('b'), status: 'pending', source: 'boss', createdAt: Date.now(), ...result.fields }
  db.prepare(`INSERT INTO bookings
    (id,customer_id,customer_name,phone,service_ids,service_names,stylist_id,date,start_time,end_time,status,source,remark,created_at)
    VALUES (@id,@customerId,@customerName,@phone,@serviceIds,@serviceNames,@stylistId,@date,@startTime,@endTime,@status,@source,@remark,@createdAt)`).run({
    ...booking,
    serviceIds: JSON.stringify(booking.serviceIds),
    serviceNames: JSON.stringify(booking.serviceNames)
  })
  res.json(booking)
}))

// 编辑预约：仅待确认 / 已确认可改
router.put('/:id', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM bookings WHERE id=?').get(req.params.id)
  if (!row) return res.status(404).json({ message: '预约不存在' })
  const current = bookingFromRow(row)
  if (current.status === 'done') {
    return res.status(400).json({ message: '已完成的预约不能修改，如需调整请直接在订单中处理' })
  }
  if (current.status === 'cancelled') {
    return res.status(400).json({ message: '已取消的预约不能修改，请重新新增预约' })
  }
  const result = prepareBooking(req.body || {}, req.params.id)
  if (result.error) return res.status(result.error.status).json({ message: result.error.message })

  const booking = { ...current, ...result.fields }
  db.prepare(`UPDATE bookings SET
    customer_id=@customerId, customer_name=@customerName, phone=@phone,
    service_ids=@serviceIds, service_names=@serviceNames, stylist_id=@stylistId,
    date=@date, start_time=@startTime, end_time=@endTime, remark=@remark
    WHERE id=@id`).run({
    ...booking,
    serviceIds: JSON.stringify(booking.serviceIds),
    serviceNames: JSON.stringify(booking.serviceNames)
  })
  res.json(booking)
}))

router.patch('/:id', wrap((req, res) => {
  const { status } = req.body || {}
  if (!['pending', 'confirmed', 'done', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: '非法状态' })
  }
  const info = db.prepare('UPDATE bookings SET status=? WHERE id=?').run(status, req.params.id)
  if (!info.changes) return res.status(404).json({ message: '预约不存在' })
  res.json({ ok: true })
}))
