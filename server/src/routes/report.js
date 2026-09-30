import { Router } from 'express'
import { db, orderFromRow } from '../db.js'
import { getSetting } from './setting.js'
import { round2, todayDash, wrap } from '../util.js'

export const router = Router()

// 经营报表：营业额只统计消费单；充值单独统计
router.get('/', wrap((req, res) => {
  const from = req.query.from ? new Date(`${req.query.from}T00:00:00`).getTime() : 0
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59`).getTime() : Date.now()

  const rows = db.prepare(
    `SELECT * FROM orders WHERE created_at>=? AND created_at<=? AND type='consume'`
  ).all(from, to).map(orderFromRow)

  const rechargeRows = db.prepare(
    `SELECT * FROM orders WHERE created_at>=? AND created_at<=? AND type='recharge'`
  ).all(from, to).map(orderFromRow)

  const bookingCount = db.prepare(
    `SELECT COUNT(*) AS n FROM bookings WHERE date>=? AND date<=? AND status!='cancelled'`
  ).all(
    req.query.from || '0000-00-00',
    req.query.to || '9999-12-31'
  )[0].n

  const revenue = round2(rows.reduce((s, o) => s + o.total, 0))
  const orderCount = rows.length
  const svcMap = new Map()
  const catMap = new Map()
  const staffMap = new Map()
  // 订单明细不存分类，按 serviceId 回查价目表；手工项目归入「其他」
  const catOfService = new Map(
    db.prepare('SELECT id, category FROM services').all().map((r) => [r.id, r.category || '其他'])
  )
  for (const o of rows) {
    for (const it of o.items) {
      const s = svcMap.get(it.serviceId) || { serviceId: it.serviceId, name: it.name, count: 0, revenue: 0 }
      s.count += 1
      s.revenue += it.price
      svcMap.set(it.serviceId, s)
      const catName = (it.serviceId && catOfService.get(it.serviceId)) || '其他'
      const c = catMap.get(catName) || { name: catName, count: 0, revenue: 0 }
      c.count += 1
      c.revenue += it.price
      catMap.set(catName, c)
      if (it.stylistId) {
        const st = staffMap.get(it.stylistId) || { stylistId: it.stylistId, name: it.stylistName, orderCount: 0, revenue: 0, commission: 0 }
        st.orderCount += 1
        st.revenue += it.price
        st.commission += it.commission
        staffMap.set(it.stylistId, st)
      }
    }
  }

  const serviceShare = [...svcMap.values()]
    .map((s) => ({ ...s, revenue: round2(s.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)

  res.json({
    revenue,
    orderCount,
    avgTicket: orderCount ? round2(revenue / orderCount) : 0,
    bookingCount,
    rechargeTotal: round2(rechargeRows.reduce((s, o) => s + o.total, 0)),
    rechargeGift: round2(rechargeRows.reduce((s, o) => s + (o.gift || 0), 0)),
    rechargeCount: rechargeRows.length,
    // 销量 TOP 榜（按单数，前 8）
    serviceSales: serviceShare.slice().sort((a, b) => b.count - a.count).slice(0, 8),
    // 占比图用：区间内全部服务项目（按营收降序）与分类汇总
    serviceShare,
    categoryShare: [...catMap.values()]
      .map((s) => ({ ...s, revenue: round2(s.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    staffPerformance: [...staffMap.values()]
      .map((s) => ({ ...s, revenue: round2(s.revenue), commission: round2(s.commission) }))
      .sort((a, b) => b.commission - a.commission)
  })
}))

/**
 * 经营趋势（月度），用于经营总览趋势图与会员增减图
 * - 默认近 N 月（含当月）：?months=3|6|12
 * - 指定年份返回该年 1~12 月（未来月份数据为 0）：?year=2026
 * - 营收/单数/充值：按订单 created_at（毫秒）归月
 * - 新增会员：按 customers.created_at（YYYY-MM-DD 文本）归月
 * - 减少会员：当月产生退卡退款单（type='refund'）的去重会员数
 * - years：系统中出现过数据的年份（订单或会员），供前端年份下拉
 */
router.get('/trend', wrap((req, res) => {
  const now = new Date()
  const yearQ = Number(req.query.year)
  const yearMode = Number.isInteger(yearQ) && yearQ >= 2000 && yearQ <= 2100
  const months = Math.min(12, Math.max(2, Number(req.query.months) || 6))
  const buckets = []
  if (yearMode) {
    for (let mo = 0; mo < 12; mo++) {
      const first = new Date(yearQ, mo, 1)
      const next = new Date(yearQ, mo + 1, 1)
      buckets.push({
        key: `${yearQ}-${String(mo + 1).padStart(2, '0')}`,
        label: `${mo + 1}月`,
        start: first.getTime(),
        end: next.getTime() - 1,
        revenue: 0,
        orderCount: 0,
        rechargeTotal: 0,
        added: 0,
        refunded: 0
      })
    }
  } else {
    for (let i = months - 1; i >= 0; i--) {
      const first = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`
      const next = new Date(first.getFullYear(), first.getMonth() + 1, 1)
      buckets.push({
        key,
        label: `${first.getMonth() + 1}月`,
        start: first.getTime(),
        end: next.getTime() - 1,
        revenue: 0,
        orderCount: 0,
        rechargeTotal: 0,
        added: 0,
        refunded: 0
      })
    }
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  const startMs = buckets[0].start

  const consumeRows = db.prepare(
    `SELECT created_at,total FROM orders WHERE created_at>=? AND type='consume'`
  ).all(startMs)
  for (const r of consumeRows) {
    const d = new Date(r.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = byKey.get(key)
    if (b) {
      b.revenue += r.total
      b.orderCount += 1
    }
  }
  const rechargeRows = db.prepare(
    `SELECT created_at,total FROM orders WHERE created_at>=? AND type='recharge'`
  ).all(startMs)
  for (const r of rechargeRows) {
    const d = new Date(r.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = byKey.get(key)
    if (b) b.rechargeTotal += r.total
  }
  // 退卡去重：同一会员同月只算一次减少
  const refundRows = db.prepare(
    `SELECT created_at,customer_id FROM orders WHERE created_at>=? AND type='refund' AND customer_id IS NOT NULL AND customer_id!=''`
  ).all(startMs)
  const refundSeen = new Set()
  for (const r of refundRows) {
    const d = new Date(r.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const seenKey = `${key}:${r.customer_id}`
    if (byKey.has(key) && !refundSeen.has(seenKey)) {
      refundSeen.add(seenKey)
      byKey.get(key).refunded += 1
    }
  }
  const firstKey = buckets[0].key
  const newRows = db.prepare(
    `SELECT substr(created_at,1,7) AS ym, COUNT(*) AS n FROM customers WHERE created_at>=? GROUP BY ym`
  ).all(`${firstKey}-01`)
  for (const r of newRows) {
    const b = byKey.get(r.ym)
    if (b) b.added = r.n
  }

  const list = buckets.map((b) => ({
    month: b.key,
    label: b.label,
    revenue: round2(b.revenue),
    orderCount: b.orderCount,
    rechargeTotal: round2(b.rechargeTotal),
    added: b.added,
    refunded: b.refunded,
    netAdded: b.added - b.refunded
  }))

  // 有数据的年份（订单或会员），并保证包含当前年
  const yearSet = new Set(
    db.prepare(
      `SELECT CAST(strftime('%Y', created_at/1000, 'unixepoch') AS INTEGER) AS y FROM orders WHERE created_at>0`
    ).all().map((r) => r.y)
  )
  for (const r of db.prepare(`SELECT CAST(substr(created_at,1,4) AS INTEGER) AS y FROM customers`).all()) {
    if (r.y) yearSet.add(r.y)
  }
  yearSet.add(now.getFullYear())
  const years = [...yearSet].filter((y) => y >= 2000).sort((a, b) => a - b)

  res.json({ list, years })
}))

/**
 * 月度工资统计
 * 薪资方式：fixed 固定月薪 / commission 纯提成 / mixed 底薪+提成
 * 提成只取消费单明细，按理发师归属；充值单不计提成
 */
router.get('/salary', wrap((req, res) => {
  const month = String(req.query.month || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: '月份格式不正确' })
  }
  const from = new Date(`${month}-01T00:00:00`).getTime()
  const [y, mo] = month.split('-').map(Number)
  const to = new Date(y, mo, 1, 0, 0, 0).getTime() - 1

  const rows = db.prepare(
    `SELECT * FROM orders WHERE created_at>=? AND created_at<=? AND type='consume'`
  ).all(from, to).map(orderFromRow)

  const perf = new Map()
  for (const o of rows) {
    for (const it of o.items) {
      if (!it.stylistId) continue
      const p = perf.get(it.stylistId) || { orderCount: 0, revenue: 0, commission: 0, orderNos: new Set(), details: [] }
      p.revenue += it.price
      p.commission += it.commission
      p.orderNos.add(o.id)
      // 订单项目级明细：一单多项目时逐行列出
      p.details.push({
        date: todayDash(new Date(o.createdAt)),
        orderId: o.id,
        orderNo: o.no,
        customerName: o.customerName || '散客',
        serviceName: it.name,
        price: round2(it.price || 0),
        commission: round2(it.commission || 0)
      })
      perf.set(it.stylistId, p)
    }
  }

  const setting = getSetting()
  const list = setting.stylists.map((s) => {
    const p = perf.get(s.id)
    const orderCount = p ? p.orderNos.size : 0
    const revenue = p ? round2(p.revenue) : 0
    const commission = p ? round2(p.commission) : 0
    const salaryType = s.salaryType || 'commission'
    const baseSalary = salaryType === 'commission' ? 0 : round2(s.baseSalary || 0)
    const commissionPay = salaryType === 'fixed' ? 0 : commission
    // 明细按日期、单号排序，保证弹窗中顺序稳定
    const details = (p?.details || [])
      .slice()
      .sort((a, b) => (a.date === b.date ? a.orderNo.localeCompare(b.orderNo) : a.date.localeCompare(b.date)))
    return {
      stylistId: s.id,
      name: s.name,
      title: s.title || '',
      status: s.status || 'work',
      salaryType,
      baseSalary,
      orderCount,
      revenue,
      commission,
      fixedPay: baseSalary,
      commissionPay,
      payTotal: round2(baseSalary + commissionPay),
      details
    }
  }).sort((a, b) => b.payTotal - a.payTotal)

  const summary = {
    fixedTotal: round2(list.reduce((s, x) => s + x.fixedPay, 0)),
    commissionTotal: round2(list.reduce((s, x) => s + x.commissionPay, 0)),
    payTotal: round2(list.reduce((s, x) => s + x.payTotal, 0)),
    revenue: round2(list.reduce((s, x) => s + x.revenue, 0))
  }

  res.json({ month, list, summary })
}))
