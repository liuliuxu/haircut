import { db } from './db.js'

export const pad = (n) => String(n).padStart(2, '0')

export const todayCompact = (d = new Date()) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

export const todayDash = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 生成当天递增单号：LS20260928001 / 充值 RC20260928001 */
export function nextOrderNo(prefix) {
  const key = `${prefix}${todayCompact()}`
  db.prepare(`INSERT INTO counters(key,val) VALUES(?,0) ON CONFLICT(key) DO UPDATE SET val=val+1`).run(key)
  const seq = db.prepare('SELECT val FROM counters WHERE key=?').get(key).val + 1
  return `${key}${String(seq).padStart(3, '0')}`
}

export const genId = (prefix) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const round2 = (n) => Math.round(n * 100) / 100

/** 异步路由错误兜底 */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export function getPageParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize) || 10))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

/** 判断 [aStart,aEnd) 与 [bStart,bEnd) 是否重叠 */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}
