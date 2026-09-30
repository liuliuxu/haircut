import { Router } from 'express'
import { db, orderFromRow, customerFromRow, addCustomerLog } from '../db.js'
import { getSetting, isPayEnabled, SYSTEM_PAY_KEYS } from './setting.js'
import { genId, getPageParams, nextOrderNo, round2, todayDash, wrap } from '../util.js'

export const router = Router()

/** 拼公共筛选条件（列表 + 导出共用） */
export function buildOrderFilters(query) {
  const where = []
  const params = []
  if (query.from) {
    where.push('created_at >= ?')
    params.push(new Date(`${query.from}T00:00:00`).getTime())
  }
  if (query.to) {
    where.push('created_at <= ?')
    params.push(new Date(`${query.to}T23:59:59`).getTime())
  }
  if (query.type) {
    where.push('type = ?')
    params.push(query.type)
  }
  if (query.payMethod) {
    where.push('pay_method = ?')
    params.push(query.payMethod)
  }
  if (query.member === 'yes') where.push("customer_id <> ''")
  if (query.member === 'no') where.push("customer_id = ''")
  if (query.customerId) {
    where.push('customer_id = ?')
    params.push(query.customerId)
  }
  const kw = (query.keyword || '').trim()
  if (kw) {
    where.push('(no LIKE ? OR customer_name LIKE ? OR phone LIKE ?)')
    params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`)
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params }
}

// ---- 订单流水列表 ----
router.get('/', wrap((req, res) => {
  const { page, pageSize, offset } = getPageParams(req.query)
  const { whereSql, params } = buildOrderFilters(req.query)
  const total = db.prepare(`SELECT COUNT(*) AS n FROM orders ${whereSql}`).get(...params).n
  // 实收合计：固定消费单口径（充值不计营业额），其余筛选条件保持一致
  let sumTotal = 0
  if (req.query.type !== 'recharge') {
    const sumFilter = buildOrderFilters({ ...req.query, type: 'consume' })
    sumTotal = db.prepare(
      `SELECT COALESCE(SUM(total),0) AS s FROM orders ${sumFilter.whereSql}`
    ).get(...sumFilter.params).s
  }
  const rows = db.prepare(
    `SELECT * FROM orders ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)
  res.json({ list: rows.map(orderFromRow), total, sumTotal: round2(sumTotal) })
}))

// ---- 收银开单：生成消费单 ----
router.post('/', wrap((req, res) => {
  const b = req.body || {}
  const rawItems = Array.isArray(b.items) ? b.items : []
  if (!rawItems.length) return res.status(400).json({ message: '请至少添加一个服务项目' })

  const setting = getSetting()
  const payMap = Object.fromEntries(setting.payMethods.map((p) => [p.key, p]))
  if (!payMap[b.payMethod]) return res.status(400).json({ message: '请选择有效的支付方式' })
  if (!isPayEnabled(setting, b.payMethod)) {
    return res.status(400).json({ message: `「${payMap[b.payMethod].label}」已停用，请选择其他结算方式` })
  }

  const stylistMap = Object.fromEntries(setting.stylists.map((s) => [s.id, s]))

  // 价目表项目（有 serviceId 时）以后台价格/提成为准；手工项目必须自带名称和金额
  const ids = [...new Set(rawItems.map((it) => it.serviceId).filter(Boolean))]
  const svcRows = ids.length
    ? db.prepare(`SELECT * FROM services WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : []
  const svcMap = Object.fromEntries(svcRows.map((r) => [r.id, r]))

  const items = []
  for (const it of rawItems) {
    const stylist = stylistMap[it.stylistId]
    if (!stylist) return res.status(400).json({ message: '存在未指定理发师的明细，请补全' })

    if (it.serviceId) {
      const svc = svcMap[it.serviceId]
      if (!svc) return res.status(400).json({ message: '存在已下架或被删除的项目，请重新选择' })
      const price = it.price === undefined || it.price === null || it.price === ''
        ? svc.price
        : round2(Number(it.price))
      if (!(price >= 0)) return res.status(400).json({ message: `项目「${svc.name}」金额不正确` })
      let commission = svc.commission_type === 'none'
        ? 0
        : svc.commission_type === 'fixed'
          ? svc.commission_value
          : round2(price * svc.commission_value / 100)
      // 允许快速开单时显式覆盖提成（特殊分成）
      if (typeof it.commission === 'number' && it.commission >= 0) commission = round2(it.commission)
      items.push({
        serviceId: svc.id,
        name: svc.name,
        price,
        stylistId: stylist.id,
        stylistName: stylist.name,
        commission
      })
    } else {
      const name = String(it.name || '').trim()
      if (!name) return res.status(400).json({ message: '存在未填写名称的手工项目' })
      const price = round2(Number(it.price))
      if (!(price > 0)) return res.status(400).json({ message: `项目「${name}」金额必填且需大于 0` })
      const commission = typeof it.commission === 'number' && it.commission >= 0 ? round2(it.commission) : 0
      items.push({
        serviceId: '',
        name,
        price,
        stylistId: stylist.id,
        stylistName: stylist.name,
        commission
      })
    }
  }

  // 次卡核销只能核销价目表项目
  if (b.payMethod === 'package' && items.some((it) => !it.serviceId)) {
    return res.status(400).json({ message: '次卡核销仅支持价目表内项目，手工项目请改用其他支付方式' })
  }

  const total = round2(items.reduce((s, it) => s + it.price, 0))

  let customerRow = null
  if (b.customerId) {
    customerRow = db.prepare('SELECT * FROM customers WHERE id=?').get(b.customerId)
    if (!customerRow) return res.status(400).json({ message: '会员不存在，请刷新后重试' })
    if (customerRow.status === 'refunded') {
      return res.status(400).json({ message: '该会员已退卡，不能继续开单' })
    }
  }
  const customer = customerRow ? customerFromRow(customerRow) : null

  if (b.payMethod === 'balance') {
    if (!customer) return res.status(400).json({ message: '会员余额支付必须先选择会员' })
    if (customer.balance < total) {
      return res.status(400).json({ message: `余额不足：当前余额 ¥${customer.balance}，本单 ¥${total}` })
    }
  }

  if (b.payMethod === 'package') {
    if (!customer) return res.status(400).json({ message: '次卡核销必须先选择会员' })
    const need = {}
    for (const it of items) need[it.serviceId] = (need[it.serviceId] || 0) + 1
    for (const [serviceId, times] of Object.entries(need)) {
      const pkg = (customer.packages || []).find((p) => p.serviceId === serviceId)
      if (!pkg || pkg.remainTimes < times) {
        const svc = svcMap[serviceId]
        return res.status(400).json({
          message: `次卡「${svc.name}」次数不足：需要 ${times} 次，剩余 ${pkg?.remainTimes ?? 0} 次`
        })
      }
    }
  }

  // 混合支付：会员余额承担一部分，剩余用一种普通渠道（现金/微信/支付宝/自定义）补足
  let payDetail = {}
  if (b.payMethod === 'mixed') {
    if (!customer) return res.status(400).json({ message: '混合支付必须先选择会员' })
    if (!isPayEnabled(setting, 'balance')) {
      return res.status(400).json({ message: '会员余额结算已停用，无法使用混合支付' })
    }
    const raw = b.payDetail
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return res.status(400).json({ message: '混合支付缺少各支付方式的分摊金额' })
    }
    const parts = Object.entries(raw)
      .map(([k, v]) => [k, round2(Number(v))])
      .filter(([, v]) => v > 0)
    const balancePart = parts.find(([k]) => k === 'balance')?.[1] || 0
    const others = parts.filter(([k]) => k !== 'balance')

    if (!(balancePart > 0)) {
      return res.status(400).json({ message: '混合支付的会员余额部分必须大于 0；余额足够时请直接选择「会员余额」' })
    }
    if (balancePart > customer.balance) {
      return res.status(400).json({ message: `会员余额不足：当前余额 ¥${customer.balance}，拟扣 ¥${balancePart}` })
    }
    if (others.length !== 1) {
      return res.status(400).json({ message: '混合支付需选择一种其他结算方式补足剩余金额' })
    }
    const [otherKey, otherAmount] = others[0]
    if (SYSTEM_PAY_KEYS.includes(otherKey)) {
      return res.status(400).json({ message: '补足金额的结算方式不能是会员余额 / 次卡核销 / 混合支付' })
    }
    if (!payMap[otherKey]) {
      return res.status(400).json({ message: '补足金额的结算方式无效，请重新选择' })
    }
    if (!isPayEnabled(setting, otherKey)) {
      return res.status(400).json({ message: `补足金额的「${payMap[otherKey].label}」已停用，请重新选择` })
    }
    if (round2(balancePart + otherAmount) !== total) {
      return res.status(400).json({ message: `混合支付分摊金额合计需等于本单合计 ¥${total}` })
    }
    payDetail = { balance: balancePart, [otherKey]: otherAmount }
  }

  if (b.bookingId) {
    const bk = db.prepare('SELECT * FROM bookings WHERE id=?').get(b.bookingId)
    if (!bk) return res.status(400).json({ message: '关联预约不存在' })
    if (bk.status === 'done') return res.status(400).json({ message: '该预约已完成开单' })
  }

  const order = {
    id: genId('o'),
    no: nextOrderNo('LS'),
    type: 'consume',
    customerId: customer?.id || '',
    customerName: customer?.name || b.customerName || '散客',
    phone: customer?.phone || b.phone || '',
    items,
    payMethod: b.payMethod,
    payDetail,
    total: b.payMethod === 'package' ? 0 : total,
    gift: 0,
    remark: b.remark || '',
    bookingId: b.bookingId || '',
    createdAt: Date.now()
  }

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO orders
      (id,no,type,customer_id,customer_name,phone,items,pay_method,total,gift,remark,booking_id,created_at,pay_detail)
      VALUES (@id,@no,@type,@customerId,@customerName,@phone,@items,@payMethod,@total,@gift,@remark,@bookingId,@createdAt,@payDetail)`).run({
      ...order,
      items: JSON.stringify(items),
      payDetail: JSON.stringify(payDetail)
    })

    if (customer) {
      const next = { ...customer }
      if (b.payMethod === 'balance') next.balance = round2(next.balance - total)
      if (b.payMethod === 'mixed') next.balance = round2(next.balance - payDetail.balance)
      if (b.payMethod === 'package') {
        const used = {}
        for (const it of items) used[it.serviceId] = (used[it.serviceId] || 0) + 1
        next.packages = next.packages.map((p) =>
          used[p.serviceId]
            ? { ...p, remainTimes: p.remainTimes - used[p.serviceId] }
            : p
        )
      }
      next.visitCount += 1
      next.totalSpend = round2(next.totalSpend + order.total)
      next.lastVisitDate = todayDash()
      db.prepare(`UPDATE customers SET balance=@balance, packages=@packages,
        visit_count=@visitCount, total_spend=@totalSpend, last_visit_date=@lastVisitDate, updated_at=@updatedAt WHERE id=@id`).run({
        id: next.id,
        balance: next.balance,
        packages: JSON.stringify(next.packages),
        visitCount: next.visitCount,
        totalSpend: next.totalSpend,
        lastVisitDate: next.lastVisitDate,
        updatedAt: todayDash()
      })
      // 会员变动记录
      const itemText = items.map((it) => it.name).join('、')
      if (b.payMethod === 'package') {
        const usedCount = {}
        for (const it of items) usedCount[it.serviceId] = (usedCount[it.serviceId] || 0) + 1
        for (const p of next.packages) {
          const n = usedCount[p.serviceId]
          if (n) {
            addCustomerLog(
              customer.id, 'package',
              `次卡核销「${p.serviceName}」×${n}，剩余 ${p.remainTimes} 次`,
              0, order.createdAt
            )
          }
        }
      } else if (b.payMethod === 'mixed') {
        const [otherKey, otherAmount] = Object.entries(payDetail).find(([k]) => k !== 'balance')
        addCustomerLog(
          customer.id, 'consume',
          `消费 ¥${total}（混合支付：会员余额 ¥${payDetail.balance} + ${payMap[otherKey].label} ¥${otherAmount}）：${itemText}`,
          order.total, order.createdAt
        )
      } else {
        addCustomerLog(
          customer.id, 'consume',
          `消费 ¥${total}（${payMap[b.payMethod].label}）：${itemText}`,
          order.total, order.createdAt
        )
      }
    }

    if (b.bookingId) {
      db.prepare(`UPDATE bookings SET status='done' WHERE id=?`).run(b.bookingId)
    }
  })
  tx()

  res.json(order)
}))

// ---- 会员充值：只记录金额与收款方式，不选项目，生成充值单 ----
router.post('/recharge', wrap((req, res) => {
  const b = req.body || {}
  const amount = Number(b.amount) || 0
  const gift = Number(b.gift) || 0
  if (amount <= 0) return res.status(400).json({ message: '请输入正确的充值金额' })

  const setting = getSetting()
  const pay = setting.payMethods.find((p) => p.key === b.payMethod)
  if (!pay) return res.status(400).json({ message: '请选择收款方式' })
  if (SYSTEM_PAY_KEYS.includes(b.payMethod)) {
    return res.status(400).json({ message: '会员余额 / 次卡核销 / 混合支付不能作为充值收款方式' })
  }
  if (!isPayEnabled(setting, b.payMethod)) {
    return res.status(400).json({ message: `「${pay.label}」已停用，请选择其他收款方式` })
  }

  const row = db.prepare('SELECT * FROM customers WHERE id=?').get(b.customerId)
  if (!row) return res.status(404).json({ message: '会员不存在' })
  if (row.status === 'refunded') {
    return res.status(400).json({ message: '该会员已退卡，不能继续充值' })
  }
  const customer = customerFromRow(row)

  const order = {
    id: genId('o'),
    no: nextOrderNo('RC'),
    type: 'recharge',
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    items: [],
    payMethod: b.payMethod,
    total: round2(amount),
    gift: round2(gift),
    remark: b.remark || '',
    bookingId: '',
    createdAt: Date.now()
  }

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO orders
      (id,no,type,customer_id,customer_name,phone,items,pay_method,total,gift,remark,booking_id,created_at)
      VALUES (@id,@no,@type,@customerId,@customerName,@phone,@items,@payMethod,@total,@gift,@remark,@bookingId,@createdAt)`).run({
      ...order,
      items: '[]'
    })
    const newBalance = round2(customer.balance + amount + gift)
    db.prepare('UPDATE customers SET balance=?, updated_at=? WHERE id=?').run(
      newBalance,
      todayDash(),
      customer.id
    )
    addCustomerLog(
      customer.id,
      'recharge',
      `充值 ¥${order.total}（${pay.label}）`
        + (gift ? `，赠送 ¥${gift}` : '')
        + `，余额 ¥${customer.balance} → ¥${newBalance}`,
      order.total,
      order.createdAt
    )
  })
  tx()

  res.json({ order, balance: round2(customer.balance + amount + gift) })
}))
