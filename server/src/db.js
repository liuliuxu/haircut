import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.js'
import { defaultSetting } from './seed.js'

mkdirSync(dirname(config.dbPath), { recursive: true })

export const db = new Database(config.dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS setting (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  gender TEXT DEFAULT 'female',
  birthday TEXT DEFAULT '',
  balance REAL DEFAULT 0,
  packages TEXT DEFAULT '[]',
  note TEXT DEFAULT '{}',
  last_visit_date TEXT DEFAULT '',
  visit_count INTEGER DEFAULT 0,
  total_spend REAL DEFAULT 0,
  created_at TEXT DEFAULT '',
  updated_at TEXT DEFAULT '',
  status TEXT DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT '剪发',
  price REAL DEFAULT 0,
  duration INTEGER DEFAULT 30,
  commission_type TEXT DEFAULT 'fixed',
  commission_value REAL DEFAULT 0,
  description TEXT DEFAULT '',
  active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT DEFAULT '',
  customer_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  service_ids TEXT DEFAULT '[]',
  service_names TEXT DEFAULT '[]',
  stylist_id TEXT DEFAULT '',
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  source TEXT DEFAULT 'boss',
  remark TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  no TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'consume',
  customer_id TEXT DEFAULT '',
  customer_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  items TEXT DEFAULT '[]',
  pay_method TEXT DEFAULT 'cash',
  total REAL DEFAULT 0,
  gift REAL DEFAULT 0,
  remark TEXT DEFAULT '',
  booking_id TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  pay_detail TEXT DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  val INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS customer_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  amount REAL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_logs_cid ON customer_logs(customer_id, created_at);
`)

// ---- 轻量迁移：老版本数据库补齐新增列 ----
const orderColumns = db.prepare('PRAGMA table_info(orders)').all()
if (!orderColumns.some((c) => c.name === 'pay_detail')) {
  db.exec("ALTER TABLE orders ADD COLUMN pay_detail TEXT DEFAULT '{}'")
}
const customerColumns = db.prepare('PRAGMA table_info(customers)').all()
if (!customerColumns.some((c) => c.name === 'status')) {
  db.exec("ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'active'")
}
if (!customerColumns.some((c) => c.name === 'updated_at')) {
  db.exec("ALTER TABLE customers ADD COLUMN updated_at TEXT DEFAULT ''")
}

// ---- 行映射 ----
export const customerFromRow = (r) => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  gender: r.gender,
  birthday: r.birthday,
  balance: r.balance,
  packages: JSON.parse(r.packages || '[]'),
  note: JSON.parse(r.note || '{}'),
  lastVisitDate: r.last_visit_date,
  visitCount: r.visit_count,
  totalSpend: r.total_spend,
  createdAt: r.created_at,
  /** 档案/账户最近变动日期（编辑、充值、消费、退卡） */
  updatedAt: r.updated_at || '',
  /** active=正常 / refunded=已退卡（余额清零、次卡作废，档案保留备查） */
  status: r.status || 'active'
})

export const serviceFromRow = (r) => ({
  id: r.id,
  name: r.name,
  category: r.category,
  price: r.price,
  duration: r.duration,
  commissionType: r.commission_type,
  commissionValue: r.commission_value,
  desc: r.description,
  active: !!r.active
})

export const bookingFromRow = (r) => ({
  id: r.id,
  customerId: r.customer_id,
  customerName: r.customer_name,
  phone: r.phone,
  serviceIds: JSON.parse(r.service_ids || '[]'),
  serviceNames: JSON.parse(r.service_names || '[]'),
  stylistId: r.stylist_id,
  date: r.date,
  startTime: r.start_time,
  endTime: r.end_time,
  status: r.status,
  source: r.source,
  remark: r.remark,
  createdAt: r.created_at
})

export const orderFromRow = (r) => ({
  id: r.id,
  no: r.no,
  type: r.type,
  customerId: r.customer_id,
  customerName: r.customer_name,
  phone: r.phone,
  items: JSON.parse(r.items || '[]'),
  payMethod: r.pay_method,
  /** 混合支付各渠道分摊金额，如 { balance: 30, wechat: 70 }；普通订单为 {} */
  payDetail: JSON.parse(r.pay_detail || '{}'),
  total: r.total,
  gift: r.gift,
  remark: r.remark,
  bookingId: r.booking_id,
  createdAt: r.created_at
})

// ---- 会员变动日志 ----
const logInsertStmt = db.prepare(
  `INSERT OR IGNORE INTO customer_logs (id,customer_id,type,message,amount,created_at)
   VALUES (@id,@customerId,@type,@message,@amount,@createdAt)`
)

const logSeq = { n: 0 }
/**
 * 写入一条会员变动日志
 * @param type create=开卡 / edit=档案编辑 / recharge=充值 / consume=消费 / package=次卡变更 / refund=退卡
 */
export const addCustomerLog = (customerId, type, message, amount = 0, createdAt = Date.now()) => {
  if (!customerId) return
  logSeq.n += 1
  logInsertStmt.run({
    id: `log_${createdAt}_${logSeq.n}_${Math.random().toString(36).slice(2, 7)}`,
    customerId,
    type,
    message: String(message || ''),
    amount: Number(amount) || 0,
    createdAt
  })
}

export const customerLogFromRow = (r) => ({
  id: r.id,
  customerId: r.customer_id,
  type: r.type,
  message: r.message,
  amount: r.amount,
  createdAt: r.created_at
})

/**
 * 历史数据回填（幂等，可重复执行）：
 * 从已有订单生成充值/消费/次卡核销/退卡日志，从次卡 addedAt 生成次卡添加日志；
 * 已存在的回填记录（固定 id）自动跳过。以后新发生的变动由各业务接口实时写入。
 */
;(function backfillCustomerLogs() {
  const PAY_CN = { cash: '现金', wechat: '微信', alipay: '支付宝', balance: '会员余额', package: '次卡核销', mixed: '混合支付' }
  const existsStmt = db.prepare('SELECT 1 FROM customer_logs WHERE id=?')
  const tx = db.transaction(() => {
    const orders = db.prepare(`SELECT * FROM orders WHERE customer_id IS NOT NULL AND customer_id!='' ORDER BY created_at`).all()
    for (const r of orders) {
      const o = orderFromRow(r)
      const logId = `log_bf_${o.id}`
      if (existsStmt.get(logId)) continue
      let type = 'consume'
      let message = ''
      if (o.type === 'recharge') {
        type = 'recharge'
        message = `充值 ¥${o.total}（${PAY_CN[o.payMethod] || o.payMethod || '未知'}）`
          + (o.gift ? `，赠送 ¥${o.gift}` : '')
      } else if (o.type === 'refund') {
        type = 'refund'
        message = o.remark || `退卡退款 ¥${o.total}`
      } else if (o.payMethod === 'package') {
        type = 'package'
        const used = {}
        for (const it of o.items) used[it.name] = (used[it.name] || 0) + 1
        message = `次卡核销：${Object.entries(used).map(([k, v]) => `${k}×${v}`).join('、')}`
      } else {
        type = 'consume'
        message = `消费 ¥${o.total}（${PAY_CN[o.payMethod] || o.payMethod || '未知'}）：`
          + o.items.map((it) => it.name).join('、')
      }
      logInsertStmt.run({
        id: logId, customerId: o.customerId, type, message,
        amount: o.type === 'refund' ? -o.total : o.total, createdAt: o.createdAt
      })
    }
    // 会员开卡 + 次卡添加时间（有 addedAt 记录的）
    for (const cr of db.prepare('SELECT id, packages, created_at FROM customers').all()) {
      // 开卡事件：取 created_at（YYYY-MM-DD）当天 0 点
      const createMs = cr.created_at
        ? new Date(`${cr.created_at}T00:00:00`).getTime()
        : NaN
      if (!Number.isNaN(createMs)) {
        const logId = `log_bfc_${cr.id}`
        if (!existsStmt.get(logId)) {
          logInsertStmt.run({
            id: logId, customerId: cr.id, type: 'create',
            message: '会员开卡', amount: 0, createdAt: createMs
          })
        }
      }
      let pkgs = []
      try { pkgs = JSON.parse(cr.packages || '[]') } catch { pkgs = [] }
      for (const p of pkgs) {
        if (!p.addedAt) continue
        const ms = new Date(`${p.addedAt}T00:00:00`).getTime()
        if (Number.isNaN(ms)) continue
        const logId = `log_bfp_${cr.id}_${p.serviceId || p.serviceName}`
        if (existsStmt.get(logId)) continue
        logInsertStmt.run({
          id: logId,
          customerId: cr.id, type: 'package',
          message: `次卡新增「${p.serviceName}」总次数 ${p.totalTimes} 次，剩余 ${p.remainTimes} 次`,
          amount: 0, createdAt: ms
        })
      }
    }
  })
  tx()
})()

// ---- 空白系统初始化（仅在 setting 尚未初始化时执行一次：只写默认店铺/结算设置，不生成任何演示业务数据）----
export function seedIfEmpty() {
  const exists = db.prepare('SELECT COUNT(*) AS n FROM setting WHERE id = 1').get().n
  if (exists > 0) return
  db.prepare('INSERT INTO setting (id, data) VALUES (1, ?)').run(JSON.stringify(defaultSetting))
  console.log('[db] 空白系统初始化完成：请在「店铺设置」中填写店铺信息、添加员工与服务项目')
}

