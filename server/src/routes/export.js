import { Router } from 'express'
import * as XLSX from 'xlsx'
import { db, customerFromRow, serviceFromRow, bookingFromRow, orderFromRow } from '../db.js'
import { wrap, todayDash } from '../util.js'
import { BOOKING_STATUS_CN, PAY_LABEL_CN } from '../constants.js'
import { getSetting } from './setting.js'
import { buildOrderFilters } from './orders.js'

export const router = Router()

function sendSheet(res, name, rows) {
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Object.keys(rows[0] || { A: '' }).map((k) => ({
    wch: Math.max(12, Math.min(40, k.length * 2 + 6))
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const file = `${name}_${todayDash()}.xlsx`
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file)}`)
  res.send(buf)
}

/** 支付方式名称：优先店铺设置里的自定义名称，兜底内置中文名 / 原始 key */
function payLabelOf(key, setting) {
  return setting.payMethods.find((p) => p.key === key)?.label || PAY_LABEL_CN[key] || key
}

/** 订单支付方式文案：混合支付展开各渠道分摊金额，如「混合支付（会员余额¥30+微信¥70）」 */
function payTextOf(o, setting) {
  if (o.payMethod === 'mixed' && o.payDetail && Object.keys(o.payDetail).length) {
    const parts = Object.entries(o.payDetail)
      .map(([k, v]) => `${payLabelOf(k, setting)}¥${Math.round(v * 100) / 100}`)
    return `混合支付（${parts.join('+')}）`
  }
  return payLabelOf(o.payMethod, setting)
}

// 会员档案导出
router.get('/customers', wrap((req, res) => {
  const kw = (req.query.keyword || '').trim()
  const where = []
  const params = []
  if (kw) {
    where.push('name LIKE ? OR phone LIKE ?')
    params.push(`%${kw}%`, `%${kw}%`)
  }
  if (req.query.gender) {
    where.push('gender = ?')
    params.push(req.query.gender)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM customers ${whereSql} ORDER BY created_at DESC`).all(...params)
  const rmap = new Map(
    db.prepare(
      `SELECT customer_id AS cid, MAX(created_at) AS t FROM orders WHERE type='recharge' GROUP BY customer_id`
    ).all().map((r) => {
      const d = new Date(r.t)
      const txt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return [r.cid, txt]
    })
  )
  const list = rows.map(customerFromRow).map((c) => ({
    姓名: c.name,
    手机号: c.phone,
    性别: c.gender === 'male' ? '男' : '女',
    生日: c.birthday,
    账户余额: c.balance,
    剩余次卡: (c.packages || []).map((p) => `${p.serviceName}×${p.remainTimes}`).join('、'),
    次卡添加时间: (c.packages || []).map((p) => `${p.serviceName}:${p.addedAt || '未知'}`).join('；'),
    到店次数: c.visitCount,
    累计消费: c.totalSpend,
    最近到店: c.lastVisitDate,
    最近充值: rmap.get(c.id) || '',
    开卡时间: c.createdAt,
    最近更新: c.updatedAt || '',
    发质: c.note?.hairType || '',
    染发配方: c.note?.formula || '',
    过敏史: c.note?.allergy || ''
  }))
  sendSheet(res, '会员档案', list)
}))

// 订单流水导出（含消费单 / 充值单；会员与散客、理发师、提成分开成列）
router.get('/orders', wrap((req, res) => {
  const setting = getSetting()
  const { whereSql, params } = buildOrderFilters(req.query)
  const rows = db.prepare(`SELECT * FROM orders ${whereSql} ORDER BY created_at DESC`).all(...params)
  const list = rows.map(orderFromRow).map((o) => {
    const isRecharge = o.type === 'recharge'
    const isRefund = o.type === 'refund'
    const typeCn = isRecharge ? '充值单' : isRefund ? '退款单' : '消费单'
    const stylists = [...new Set(o.items.map((it) => it.stylistName).filter(Boolean))]
    const hasItems = o.items.length > 0
    return {
      单号: o.no,
      单据类型: typeCn,
      顾客类型: o.customerId ? '会员' : '散客',
      时间: new Date(o.createdAt).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'),
      顾客姓名: o.customerName,
      手机号: o.phone,
      服务项目: o.items.map((it) => it.name).join('、'),
      理发师: stylists.join('、'),
      项目金额: hasItems ? o.items.reduce((s, it) => s + it.price, 0) : '',
      提成合计: hasItems ? o.items.reduce((s, it) => s + (it.commission || 0), 0) : '',
      支付方式: isRefund && !o.payMethod ? '仅销卡（无退款）' : payTextOf(o, setting),
      实收金额: isRefund ? -Math.round(o.total * 100) / 100 : o.total,
      赠送金额: isRecharge ? (o.gift || 0) : '',
      备注: o.remark || ''
    }
  })
  sendSheet(res, '订单流水', list)
}))

// 预约记录导出
router.get('/bookings', wrap((req, res) => {
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
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const setting = getSetting()
  const stylistMap = Object.fromEntries(setting.stylists.map((s) => [s.id, s.name]))
  const rows = db.prepare(`SELECT * FROM bookings ${whereSql} ORDER BY date DESC, start_time`).all(...params)
  const list = rows.map(bookingFromRow).map((b) => ({
    日期: b.date,
    时间: `${b.startTime}-${b.endTime}`,
    顾客: b.customerName,
    手机号: b.phone,
    顾客类型: b.customerId ? '会员' : '散客',
    服务项目: (b.serviceNames || []).join('、'),
    理发师: stylistMap[b.stylistId] || '不指定',
    来源: b.source === 'customer' ? '顾客自助' : '门店代约',
    状态: BOOKING_STATUS_CN[b.status] || b.status,
    备注: b.remark || ''
  }))
  sendSheet(res, '预约记录', list)
}))

// 服务项目导出（辅助备份价目表）
router.get('/services', wrap((req, res) => {
  const rows = db.prepare('SELECT * FROM services ORDER BY category, id').all()
  const list = rows.map(serviceFromRow).map((s) => ({
    项目名称: s.name,
    分类: s.category,
    价格: s.price,
    时长分钟: s.duration,
    提成方式:
      s.commissionType === 'none'
        ? '无提成'
        : s.commissionType === 'fixed'
          ? `固定 ¥${s.commissionValue}/单`
          : `${s.commissionValue}%`,
    状态: s.active ? '已上架' : '已下架',
    说明: s.desc
  }))
  sendSheet(res, '服务价目表', list)
}))

// 月度工资表导出
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
      const p = perf.get(it.stylistId) || { count: new Set(), revenue: 0, commission: 0 }
      p.revenue += it.price
      p.commission += it.commission
      p.count.add(o.id)
      perf.set(it.stylistId, p)
    }
  }

  const setting = getSetting()
  const TYPE_CN = { fixed: '固定月薪', commission: '纯提成', mixed: '底薪+提成' }
  const list = setting.stylists.map((s) => {
    const p = perf.get(s.id)
    const salaryType = s.salaryType || 'commission'
    const baseSalary = salaryType === 'commission' ? 0 : (s.baseSalary || 0)
    const commissionPay = salaryType === 'fixed' ? 0 : Math.round((p?.commission || 0) * 100) / 100
    return {
      员工: s.name,
      职位: s.title || '',
      在岗状态: s.status === 'rest' ? '休息' : '在岗',
      薪资方式: TYPE_CN[salaryType] || salaryType,
      月底薪: baseSalary,
      接单量: p ? p.count.size : 0,
      当月业绩: Math.round((p?.revenue || 0) * 100) / 100,
      当月提成: Math.round((p?.commission || 0) * 100) / 100,
      提成工资: commissionPay,
      应发工资: Math.round((baseSalary + commissionPay) * 100) / 100
    }
  })
  sendSheet(res, `工资表_${month}`, list)
}))

// 月度工资「提成明细」导出：逐单逐项目列出；带 stylistId 时只导出该员工
router.get('/salary-detail', wrap((req, res) => {
  const month = String(req.query.month || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: '月份格式不正确' })
  }
  const stylistId = String(req.query.stylistId || '').trim()
  const from = new Date(`${month}-01T00:00:00`).getTime()
  const [y, mo] = month.split('-').map(Number)
  const to = new Date(y, mo, 1, 0, 0, 0).getTime() - 1
  const orders = db.prepare(
    `SELECT * FROM orders WHERE created_at>=? AND created_at<=? AND type='consume' ORDER BY created_at, no`
  ).all(from, to).map(orderFromRow)

  const setting = getSetting()
  const stylistMap = new Map(setting.stylists.map((s) => [s.id, s]))
  const detailRows = []
  // 同时累计每人小计，全员导出时便于对账
  const subtotal = new Map()
  for (const o of orders) {
    for (const it of o.items) {
      if (!it.stylistId) continue
      if (stylistId && it.stylistId !== stylistId) continue
      const st = stylistMap.get(it.stylistId)
      const price = Math.round((it.price || 0) * 100) / 100
      const commission = Math.round((it.commission || 0) * 100) / 100
      detailRows.push({
        员工: it.stylistName || st?.name || '(已删除)',
        职位: st?.title || '',
        日期: o.createdAt ? new Date(o.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '-') : '',
        单号: o.no,
        顾客: o.customerName || '散客',
        服务项目: it.name,
        项目金额: price,
        提成: commission
      })
      const sum = subtotal.get(it.stylistId) || { name: it.stylistName || st?.name || '', revenue: 0, commission: 0 }
      sum.revenue += price
      sum.commission += commission
      subtotal.set(it.stylistId, sum)
    }
  }

  // 无明细时也输出表头，避免打开空文件困惑
  if (!detailRows.length) {
    detailRows.push({ 员工: '', 职位: '', 日期: '', 单号: '', 顾客: '', 服务项目: '该月暂无提成明细', 项目金额: '', 提成: '' })
  }

  // 个人导出：在明细末尾追加一行实发提成小计
  if (stylistId) {
    const s = subtotal.get(stylistId)
    detailRows.push({
      员工: '合计', 职位: '', 日期: '', 单号: '', 顾客: '', 服务项目: '',
      项目金额: s ? Math.round(s.revenue * 100) / 100 : 0,
      提成: s ? Math.round(s.commission * 100) / 100 : 0
    })
  }

  const targetName = stylistId ? (stylistMap.get(stylistId)?.name || '') : '全员'
  sendSheet(res, `工资明细_${targetName}_${month}`, detailRows)
}))
