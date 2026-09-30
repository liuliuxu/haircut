import { Router } from 'express'
import Database from 'better-sqlite3'
import { mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { db, orderFromRow } from '../db.js'
import { config, root } from '../config.js'
import { round2, wrap } from '../util.js'

export const router = Router()

/** 封存文件统一放在 data/archives/，随 data 目录一起备份 */
const ARCHIVE_DIR = resolve(root, 'data/archives')
mkdirSync(ARCHIVE_DIR, { recursive: true })

const ID_RE = /^[a-zA-Z0-9_-]+$/
const pad = (n) => String(n).padStart(2, '0')
const lastDay = (y, m) => new Date(y, m, 0).getDate() // m 为 1-12
const QUARTER_CN = ['一', '二', '三', '四']

const buildPeriod = (periodType, year, half, quarter) => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('请选择正确的年份')
  let sm = 1
  let em = 12
  let label = `${year}年整年`
  if (periodType === 'half') {
    if (![1, 2].includes(half)) throw new Error('请选择上半年或下半年')
    sm = half === 1 ? 1 : 7
    em = half === 1 ? 6 : 12
    label = `${year}年${half === 1 ? '上' : '下'}半年`
  } else if (periodType === 'quarter') {
    if (![1, 2, 3, 4].includes(quarter)) throw new Error('请选择季度')
    sm = (quarter - 1) * 3 + 1
    em = quarter * 3
    label = `${year}年第${QUARTER_CN[quarter - 1]}季度`
  } else if (periodType !== 'year') {
    throw new Error('封存类型只能是 year / half / quarter')
  }
  const startDate = `${year}-${pad(sm)}-01`
  const endDate = `${year}-${pad(em)}-${pad(lastDay(year, em))}`
  return {
    label,
    periodType,
    startDate,
    endDate,
    startMs: new Date(`${startDate}T00:00:00`).getTime(),
    endMs: new Date(`${endDate}T23:59:59.999`).getTime()
  }
}

/**
 * 计算封存周期：
 * - 创建时：body 显式传 year + half/quarter；
 * - 读取已存封存时：用 meta.startDate（周期首日）作为锚点还原周期。
 */
export const resolvePeriod = (periodType, opts = {}) => {
  if (typeof opts === 'string') {
    const y = Number(opts.slice(0, 4))
    const m = Number(opts.slice(5, 7))
    if (periodType === 'half') return buildPeriod(periodType, y, m <= 6 ? 1 : 2)
    if (periodType === 'quarter') return buildPeriod(periodType, y, undefined, Math.ceil(m / 3))
    return buildPeriod(periodType, y)
  }
  return buildPeriod(periodType, Number(opts.year), Number(opts.half), Number(opts.quarter))
}

const metaPath = (id) => join(ARCHIVE_DIR, `${id}.json`)
const dbPathOf = (id) => join(ARCHIVE_DIR, `${id}.db`)

const readMeta = (id) => JSON.parse(readFileSync(metaPath(id), 'utf-8'))

const listMetas = () =>
  readdirSync(ARCHIVE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const meta = JSON.parse(readFileSync(join(ARCHIVE_DIR, f), 'utf-8'))
        const fp = dbPathOf(meta.id)
        if (!existsSync(fp)) return null
        meta.dbSize = statSync(fp).size
        return meta
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt - a.createdAt)

/** 以只读方式打开封存库（封存库已切回 DELETE 日志模式，不会产生 wal/shm 边车文件） */
const openArchive = (id) => {
  if (!ID_RE.test(id)) throw new Error('封存编号不合法')
  if (!existsSync(metaPath(id)) || !existsSync(dbPathOf(id))) throw Object.assign(new Error('封存记录不存在'), { status: 404 })
  return new Database(dbPathOf(id), { readonly: true })
}

/** 创建数据封存：在线热备份生成该时点的完整快照，冻结保存 */
router.post('/', wrap(async (req, res) => {
  const body = req.body || {}
  let period
  try {
    period = resolvePeriod(body.periodType, { year: body.year, half: body.half, quarter: body.quarter })
  } catch (e) {
    return res.status(400).json({ message: e.message })
  }
  // 同一周期只允许封存一次，避免误操作产生重复文件
  const dup = listMetas().find((m) => m.startDate === period.startDate && m.endDate === period.endDate)
  if (dup) return res.status(400).json({ message: `「${period.label}」已经封存过了（${new Date(dup.createdAt).toLocaleString('zh-CN')}）` })

  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const id = `arc_${stamp}_${Math.random().toString(36).slice(2, 6)}`
  const dest = dbPathOf(id)

  // better-sqlite3 在线热备份：服务无需停止，得到的是事务一致的完整副本
  await db.backup(dest)
  // 将封存副本切回普通日志模式，保证以后任意位置只读打开都不产生额外文件
  const destDb = new Database(dest)
  destDb.pragma('journal_mode = DELETE')
  destDb.close()

  const meta = {
    id,
    label: period.label,
    periodType: period.periodType,
    startDate: period.startDate,
    endDate: period.endDate,
    createdAt: Date.now(),
    sourceDb: config.dbPath,
    note: req.body?.note ? String(req.body.note).slice(0, 200) : ''
  }
  writeFileSync(metaPath(id), JSON.stringify(meta, null, 2), 'utf-8')
  res.json({ ...meta, dbSize: statSync(dest).size })
}))

/** 封存列表 */
router.get('/', wrap((req, res) => {
  res.json(listMetas())
}))

/** 封存周期汇总（营业额/充值/退卡），口径与经营报表一致 */
router.get('/:id/summary', wrap((req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ message: '封存编号不合法' })
  if (!existsSync(metaPath(req.params.id))) return res.status(404).json({ message: '封存记录不存在' })
  const meta = readMeta(req.params.id)
  const arc = openArchive(req.params.id)
  try {
    const p = resolvePeriod(meta.periodType, meta.startDate)
    const consume = arc.prepare(
      `SELECT COUNT(*) n, COALESCE(SUM(total),0) amt FROM orders WHERE created_at>=? AND created_at<=? AND type='consume'`
    ).get(p.startMs, p.endMs)
    const recharge = arc.prepare(
      `SELECT COUNT(*) n, COALESCE(SUM(total),0) amt, COALESCE(SUM(gift),0) gift FROM orders WHERE created_at>=? AND created_at<=? AND type='recharge'`
    ).get(p.startMs, p.endMs)
    const refund = arc.prepare(
      `SELECT COUNT(*) n, COALESCE(SUM(total),0) amt FROM orders WHERE created_at>=? AND created_at<=? AND type='refund'`
    ).get(p.startMs, p.endMs)
    const total = arc.prepare(
      'SELECT COUNT(*) n FROM orders WHERE created_at>=? AND created_at<=?'
    ).get(p.startMs, p.endMs)
    res.json({
      label: meta.label,
      startDate: meta.startDate,
      endDate: meta.endDate,
      orderCount: total.n,
      consumeCount: consume.n,
      revenue: round2(consume.amt),
      rechargeCount: recharge.n,
      rechargeTotal: round2(recharge.amt),
      rechargeGift: round2(recharge.gift),
      refundCount: refund.n,
      refundTotal: round2(refund.amt)
    })
  } finally {
    arc.close()
  }
}))

/** 封存周期内的订单流水（分页，只读） */
router.get('/:id/orders', wrap((req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ message: '封存编号不合法' })
  if (!existsSync(metaPath(req.params.id))) return res.status(404).json({ message: '封存记录不存在' })
  const meta = readMeta(req.params.id)
  const arc = openArchive(req.params.id)
  try {
    const p = resolvePeriod(meta.periodType, meta.startDate)
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20))
    const kw = (req.query.keyword || '').trim()
    const where = ['created_at>=?', 'created_at<=?']
    const args = [p.startMs, p.endMs]
    if (kw) {
      where.push('(no LIKE ? OR customer_name LIKE ? OR phone LIKE ?)')
      const like = `%${kw}%`
      args.push(like, like, like)
    }
    const total = arc.prepare(`SELECT COUNT(*) n FROM orders WHERE ${where.join(' AND ')}`).get(...args).n
    const rows = arc.prepare(
      `SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC, no DESC LIMIT ? OFFSET ?`
    ).all(...args, pageSize, (page - 1) * pageSize)
    res.json({ total, page, pageSize, list: rows.map(orderFromRow) })
  } finally {
    arc.close()
  }
}))

/** 下载封存数据库文件（可另存到 U盘/移动硬盘长期保管） */
router.get('/:id/download', wrap((req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ message: '封存编号不合法' })
  const file = dbPathOf(req.params.id)
  if (!existsSync(file)) return res.status(404).json({ message: '封存文件不存在' })
  const meta = existsSync(metaPath(req.params.id)) ? readMeta(req.params.id) : null
  const name = `数据封存_${meta?.label || req.params.id}.db`
  res.download(file, name)
}))

/** 删除封存（只删副本，不动正在使用的数据库） */
router.delete('/:id', wrap((req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(400).json({ message: '封存编号不合法' })
  for (const f of [dbPathOf(req.params.id), metaPath(req.params.id)]) {
    if (existsSync(f)) unlinkSync(f)
  }
  res.json({ ok: true })
}))
