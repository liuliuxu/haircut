import express from 'express'
import * as XLSX from 'xlsx'
import { db, customerFromRow, addCustomerLog, customerLogFromRow } from '../db.js'
import { genId, getPageParams, nextOrderNo, round2, todayDash, wrap } from '../util.js'
import { getSetting, isPayEnabled, SYSTEM_PAY_KEYS } from './setting.js'

export const router = express.Router()

const insertStmt = db.prepare(`INSERT INTO customers
  (id,name,phone,gender,birthday,balance,packages,note,last_visit_date,visit_count,total_spend,created_at,updated_at,status)
  VALUES (@id,@name,@phone,@gender,@birthday,@balance,@packages,@note,@lastVisitDate,@visitCount,@totalSpend,@createdAt,@updatedAt,@status)`)

const updateStmt = db.prepare(`UPDATE customers SET
  name=@name, phone=@phone, gender=@gender, birthday=@birthday, balance=@balance,
  packages=@packages, note=@note, last_visit_date=@lastVisitDate,
  visit_count=@visitCount, total_spend=@totalSpend, updated_at=@updatedAt, status=@status WHERE id=@id`)

const toParams = (c) => ({
  id: c.id,
  name: c.name,
  phone: c.phone || '',
  gender: c.gender || 'female',
  birthday: c.birthday || '',
  balance: Number(c.balance) || 0,
  packages: JSON.stringify(c.packages || []),
  note: JSON.stringify(c.note || { hairType: '', formula: '', allergy: '', preferStylist: '' }),
  lastVisitDate: c.lastVisitDate || '',
  visitCount: Number(c.visitCount) || 0,
  totalSpend: Number(c.totalSpend) || 0,
  createdAt: c.createdAt || '',
  updatedAt: c.updatedAt || c.createdAt || '',
  status: c.status || 'active'
})

/** 毫秒时间戳转 YYYY-MM-DD */
const dayText = (ms) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 次卡变更对比，返回需要写入变动记录的消息列表 */
const diffPackages = (oldPkgs, newPkgs) => {
  const logs = []
  const om = new Map((oldPkgs || []).map((p) => [p.serviceId, p]))
  for (const np of newPkgs || []) {
    const op = om.get(np.serviceId)
    if (!op) {
      logs.push(`次卡新增「${np.serviceName}」总次数 ${np.totalTimes} 次，剩余 ${np.remainTimes} 次`)
    } else {
      om.delete(np.serviceId)
      const parts = []
      if (Number(op.remainTimes) !== Number(np.remainTimes)) {
        parts.push(`剩余次数 ${op.remainTimes} → ${np.remainTimes}`)
      }
      if (Number(op.totalTimes) !== Number(np.totalTimes)) {
        parts.push(`总次数 ${op.totalTimes} → ${np.totalTimes}`)
      }
      if (parts.length) logs.push(`次卡「${np.serviceName}」变更：${parts.join('，')}`)
    }
  }
  for (const op of om.values()) {
    logs.push(`次卡移除「${op.serviceName}」（原剩余 ${op.remainTimes} 次）`)
  }
  return logs
}

/** 各会员最近一次充值日期（YYYY-MM-DD），批量查询避免 N+1 */
const rechargeMap = () => new Map(
  db.prepare(
    `SELECT customer_id AS cid, MAX(created_at) AS t FROM orders WHERE type='recharge' GROUP BY customer_id`
  ).all().map((r) => [r.cid, r.t ? dayText(r.t) : ''])
)

router.get('/', wrap((req, res) => {
  const { page, pageSize, offset } = getPageParams(req.query)
  const kw = (req.query.keyword || '').trim()
  const where = kw ? 'WHERE name LIKE ? OR phone LIKE ?' : ''
  const params = kw ? [`%${kw}%`, `%${kw}%`] : []
  const total = db.prepare(`SELECT COUNT(*) AS n FROM customers ${where}`).get(...params).n
  const rows = db.prepare(
    `SELECT * FROM customers ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)
  const rmap = rechargeMap()
  res.json({
    list: rows.map((r) => ({ ...customerFromRow(r), lastRechargeAt: rmap.get(r.id) || '' })),
    total
  })
}))

router.post('/', wrap((req, res) => {
  const b = req.body || {}
  if (!b.name) return res.status(400).json({ message: '请填写姓名' })
  const customer = {
    ...b,
    id: genId('c'),
    lastVisitDate: '',
    visitCount: 0,
    totalSpend: 0,
    createdAt: todayDash(),
    updatedAt: todayDash()
  }
  // 新建时带入次卡的，补齐每张次卡的添加时间
  customer.packages = (customer.packages || []).map((p) => ({ ...p, addedAt: p.addedAt || todayDash() }))
  insertStmt.run(toParams(customer))
  addCustomerLog(customer.id, 'create', '会员开卡')
  for (const p of customer.packages) {
    addCustomerLog(customer.id, 'package', `次卡新增「${p.serviceName}」总次数 ${p.totalTimes} 次，剩余 ${p.remainTimes} 次`)
  }
  res.json(customerFromRow(db.prepare('SELECT * FROM customers WHERE id=?').get(customer.id)))
}))

router.put('/:id', wrap((req, res) => {
  const existing = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id)
  if (!existing) return res.status(404).json({ message: '会员不存在' })
  const oldC = customerFromRow(existing)
  // 合并更新：充值/开单等场景只提交部分字段时不能覆盖其它字段
  const merged = { ...oldC, ...req.body, id: req.params.id }
  // 资料/次卡编辑即刷新更新时间；仅本次新增的次卡补添加时间，历史次卡原本无记录则保持未知
  merged.updatedAt = todayDash()
  merged.packages = (merged.packages || []).map((p) => {
    if (p.addedAt) return p
    const old = oldC.packages.find((o) => o.serviceId === p.serviceId)
    return old ? { ...p, addedAt: old.addedAt || '' } : { ...p, addedAt: todayDash() }
  })
  // 已退卡会员：余额保持 0、次卡保持作废、状态不可改回，只允许改资料/备注
  if (existing.status === 'refunded') {
    merged.balance = 0
    merged.packages = oldC.packages
    merged.status = 'refunded'
  }
  updateStmt.run(toParams(merged))

  // ---- 写入变动记录（只记录真正发生变化的内容） ----
  const changedLabels = []
  const fieldLabels = [['name', '姓名'], ['phone', '手机号'], ['gender', '性别'], ['birthday', '生日']]
  for (const [k, label] of fieldLabels) {
    if (String(oldC[k] ?? '') !== String(merged[k] ?? '')) changedLabels.push(label)
  }
  const noteLabels = [['hairType', '发质'], ['formula', '染发配方'], ['allergy', '过敏史'], ['preferStylist', '指定技师']]
  for (const [k, label] of noteLabels) {
    if (String(oldC.note?.[k] ?? '') !== String(merged.note?.[k] ?? '')) changedLabels.push(label)
  }
  if (changedLabels.length) {
    addCustomerLog(req.params.id, 'edit', `编辑档案：${changedLabels.join('、')}`)
  }
  // 余额人工调整（充值/消费走订单接口直接 UPDATE，不会走到这里）
  if (round2(oldC.balance) !== round2(merged.balance)) {
    const delta = round2(merged.balance - oldC.balance)
    addCustomerLog(
      req.params.id,
      'edit',
      `手动调整余额 ¥${oldC.balance} → ¥${merged.balance}`,
      delta
    )
  }
  if (existing.status !== 'refunded') {
    for (const msg of diffPackages(oldC.packages, merged.packages)) {
      addCustomerLog(req.params.id, 'package', msg)
    }
  }

  res.json(customerFromRow(db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id)))
}))

/** 会员变动记录（编辑/充值/消费/次卡变更/退卡），按时间倒序 */
router.get('/:id/history', wrap((req, res) => {
  const row = db.prepare('SELECT id FROM customers WHERE id=?').get(req.params.id)
  if (!row) return res.status(404).json({ message: '会员不存在' })
  const rows = db.prepare(
    'SELECT * FROM customer_logs WHERE customer_id=? ORDER BY created_at DESC, id DESC LIMIT 200'
  ).all(req.params.id)
  res.json(rows.map(customerLogFromRow))
}))

/**
 * 退卡：退还账户余额（金额人工确认，可扣除赠送/手续费）→ 余额清零、
 * 剩余次卡全部作废、档案标记 refunded 保留备查，同时生成一笔退款单
 */
router.post('/:id/refund', wrap((req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id)
  if (!row) return res.status(404).json({ message: '会员不存在' })
  if (row.status === 'refunded') return res.status(400).json({ message: '该会员已退卡，不能重复操作' })

  const customer = customerFromRow(row)
  const b = req.body || {}
  const amount = round2(Number(b.amount) || 0)
  if (!(amount >= 0)) return res.status(400).json({ message: '退款金额不正确' })
  if (amount > customer.balance) {
    return res.status(400).json({ message: `退款金额不能超过账户余额 ¥${customer.balance}` })
  }

  const setting = getSetting()
  let payMethod = ''
  let payLabel = ''
  if (amount > 0) {
    payMethod = String(b.payMethod || '')
    const pay = setting.payMethods.find((p) => p.key === payMethod)
    if (!pay) return res.status(400).json({ message: '请选择退款方式' })
    if (SYSTEM_PAY_KEYS.includes(payMethod)) {
      return res.status(400).json({ message: '退款方式不能是会员余额 / 次卡核销 / 混合支付' })
    }
    if (!isPayEnabled(setting, payMethod)) {
      return res.status(400).json({ message: `「${pay.label}」已停用，请选择其他退款方式` })
    }
    payLabel = pay.label
  }

  const alivePkgs = customer.packages.filter((p) => p.remainTimes > 0)
  const waived = round2(customer.balance - amount)
  const autoRemark =
    `退卡退款：原余额 ¥${customer.balance}，实退 ¥${amount}` +
    (payLabel ? `（${payLabel}）` : '（无退款金额）') +
    (waived > 0 ? `，剩余 ¥${waived} 已冲销` : '') +
    (alivePkgs.length ? `；次卡作废：${alivePkgs.map((p) => `${p.serviceName}×${p.remainTimes}`).join('、')}` : '')
  const userRemark = String(b.remark || '').trim()

  const order = {
    id: genId('o'),
    no: nextOrderNo('RF'),
    type: 'refund',
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    items: [],
    payMethod,
    payDetail: {},
    total: amount,
    gift: 0,
    remark: userRemark ? `${autoRemark}；备注：${userRemark}` : autoRemark,
    bookingId: '',
    createdAt: Date.now()
  }

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO orders
      (id,no,type,customer_id,customer_name,phone,items,pay_method,total,gift,remark,booking_id,created_at,pay_detail)
      VALUES (@id,@no,@type,@customerId,@customerName,@phone,@items,@payMethod,@total,@gift,@remark,@bookingId,@createdAt,@payDetail)`).run({
      ...order,
      items: '[]',
      payDetail: '{}'
    })
    const nextPackages = customer.packages.map((p) =>
      p.remainTimes > 0 ? { ...p, remainTimes: 0 } : p
    )
    db.prepare(`UPDATE customers SET balance=0, packages=?, status='refunded', updated_at=? WHERE id=?`).run(
      JSON.stringify(nextPackages),
      todayDash(),
      customer.id
    )
    addCustomerLog(customer.id, 'refund', autoRemark + (userRemark ? `；备注：${userRemark}` : ''), -amount)
  })
  tx()

  res.json({ order, balance: 0 })
}))

router.delete('/:id', wrap((req, res) => {
  db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id)
  res.json({ ok: true })
}))

// ---------------- Excel 批量导入 ----------------

const TEMPLATE_HEADERS = ['姓名', '手机号', '性别', '生日', '初始余额']

/** Excel 序列号日期（数字单元格）转 YYYY-MM-DD */
const serialToDate = (n) => {
  const utcDays = Math.floor(n - 25569)
  const d = new Date(utcDays * 86400 * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const normGender = (v) => {
  const s = String(v ?? '').trim()
  if (/男|male|先生/i.test(s)) return 'male'
  if (/女|female|女士/i.test(s)) return 'female'
  return ''
}

const normBirthday = (v) => {
  if (v === null || v === undefined || v === '') return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) return serialToDate(v)
  const s = String(v).trim().replace(/[./年月]/g, '-').replace(/日/g, '')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : s
}

const normPhone = (v) => String(v ?? '').replace(/[^0-9]/g, '')

/** 解析并校验上传的 Excel，不写库；返回标准化行 + 错误行 */
function parseWorkbook(buf) {
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { rows: [], errors: [{ row: 0, message: '工作簿中没有可用的工作表' }] }
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
  const header = (matrix[0] || []).map((h) => String(h).trim())
  const col = (name) => header.findIndex((h) => h === name)
  const idx = { name: col('姓名'), phone: col('手机号'), gender: col('性别'), birthday: col('生日'), balance: col('初始余额') }
  if (idx.name < 0) {
    return { rows: [], errors: [{ row: 1, message: '缺少「姓名」列，请使用系统提供的导入模板' }] }
  }

  const rows = []
  const errors = []
  const seenPhones = new Set()
  const existing = new Map(
    db.prepare("SELECT id, name, phone, balance FROM customers WHERE phone<>''").all()
      .map((r) => [r.phone, r])
  )

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i]
    if (!line || line.every((c) => String(c ?? '').trim() === '')) continue
    const excelRow = i + 1
    const name = String(line[idx.name] ?? '').trim()
    if (!name) {
      errors.push({ row: excelRow, message: '姓名为空' })
      continue
    }
    const phone = idx.phone >= 0 ? normPhone(line[idx.phone]) : ''
    if (phone && !/^1\d{10}$/.test(phone)) {
      errors.push({ row: excelRow, message: `手机号「${phone}」格式不正确（应为 11 位手机号）` })
      continue
    }
    if (phone) {
      if (seenPhones.has(phone)) {
        errors.push({ row: excelRow, message: `手机号 ${phone} 在表格内重复` })
        continue
      }
      seenPhones.add(phone)
    }
    const balanceRaw = idx.balance >= 0 ? Number(String(line[idx.balance]).replace(/[^\d.-]/g, '')) : 0
    if (Number.isNaN(balanceRaw) || balanceRaw < 0) {
      errors.push({ row: excelRow, message: `初始余额「${line[idx.balance]}」无效` })
      continue
    }
    rows.push({
      row: excelRow,
      name,
      phone,
      gender: idx.gender >= 0 ? normGender(line[idx.gender]) : '',
      birthday: idx.birthday >= 0 ? normBirthday(line[idx.birthday]) : '',
      balance: balanceRaw,
      duplicate: phone ? existing.has(phone) : false,
      existingName: phone ? existing.get(phone)?.name || '' : '',
      existingBalance: phone ? existing.get(phone)?.balance || 0 : 0
    })
  }
  return { rows, errors }
}

/** 下载导入模板 */
router.get('/import-template', wrap((req, res) => {
  const examples = [
    { 姓名: '张三', 手机号: '13800138000', 性别: '男', 生日: '1995-06-18', 初始余额: 500 },
    { 姓名: '李四', 手机号: '13900139000', 性别: '女', 生日: '1998-12-01', 初始余额: 0 }
  ]
  const ws = XLSX.utils.json_to_sheet(examples, { header: TEMPLATE_HEADERS })
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(12, h.length * 2 + 6) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '会员导入')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent('会员导入模板.xlsx'))
  res.send(buf)
}))

/** 上传 Excel 预览（不落库） */
router.post('/import-preview', express.raw({ type: '*/*', limit: '5mb' }), wrap((req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ message: '未收到文件，请选择 .xlsx / .xls 文件' })
  }
  let result
  try {
    result = parseWorkbook(req.body)
  } catch (e) {
    return res.status(400).json({ message: `文件解析失败：${e.message}（请使用系统提供的导入模板）` })
  }
  res.json(result)
}))

/** 确认导入：mode=skip（重复跳过，默认）/ update（更新资料，初始余额累加到账户余额） */
router.post('/import', wrap((req, res) => {
  const mode = req.body?.mode === 'update' ? 'update' : 'skip'
  const incoming = Array.isArray(req.body?.rows) ? req.body.rows : []
  if (!incoming.length) return res.status(400).json({ message: '没有可导入的数据' })

  const errors = []
  let inserted = 0
  let updated = 0
  let skipped = 0

  const tx = db.transaction((rows) => {
    for (const r of rows) {
      const name = String(r.name || '').trim()
      const phone = normPhone(r.phone)
      if (!name) {
        errors.push({ row: r.row || 0, message: '姓名为空' })
        continue
      }
      if (phone && !/^1\d{10}$/.test(phone)) {
        errors.push({ row: r.row || 0, message: `手机号「${phone}」格式不正确` })
        continue
      }
      const balance = Number(r.balance) || 0
      const gender = normGender(r.gender)
      const birthday = normBirthday(r.birthday)

      const existing = phone
        ? db.prepare('SELECT * FROM customers WHERE phone=?').get(phone)
        : null
      if (existing) {
        if (mode === 'skip') {
          skipped++
          continue
        }
        const cur = customerFromRow(existing)
        const merged = {
          ...cur,
          name,
          gender: gender || cur.gender,
          birthday: birthday || cur.birthday,
          // 更新资料模式：表格中的初始余额作为储值累加到现有余额
          balance: cur.balance + balance
        }
        updateStmt.run(toParams(merged))
        updated++
      } else {
        const customer = {
          id: genId('c'),
          name,
          phone,
          gender: gender || 'female',
          birthday,
          balance,
          packages: [],
          note: { hairType: '', formula: '', allergy: '', preferStylist: '' },
          lastVisitDate: '',
          visitCount: 0,
          totalSpend: 0,
          createdAt: todayDash()
        }
        insertStmt.run(toParams(customer))
        inserted++
      }
    }
  })
  tx(incoming)

  res.json({ inserted, updated, skipped, errors })
}))
