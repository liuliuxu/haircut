import { Router } from 'express'
import { db, serviceFromRow } from '../db.js'
import { genId, getPageParams, wrap } from '../util.js'

export const router = Router()

router.get('/', wrap((req, res) => {
  const { page, pageSize, offset } = getPageParams(req.query)
  const where = []
  const params = []
  const kw = (req.query.keyword || '').trim()
  if (kw) {
    where.push('(name LIKE ? OR description LIKE ?)')
    params.push(`%${kw}%`, `%${kw}%`)
  }
  if (req.query.category) {
    where.push('category = ?')
    params.push(req.query.category)
  }
  if (req.query.active === 'true') where.push('active = 1')
  if (req.query.active === 'false') where.push('active = 0')
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = db.prepare(`SELECT COUNT(*) AS n FROM services ${whereSql}`).get(...params).n
  const rows = db.prepare(
    `SELECT * FROM services ${whereSql} ORDER BY category, id LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset)
  res.json({ list: rows.map(serviceFromRow), total })
}))

router.post('/', wrap((req, res) => {
  const b = req.body || {}
  if (!b.name) return res.status(400).json({ message: '请填写项目名称' })
  const commissionType = ['fixed', 'percent', 'none'].includes(b.commissionType) ? b.commissionType : 'fixed'
  const s = {
    id: genId('v'),
    name: b.name,
    category: b.category || '剪发',
    price: Number(b.price) || 0,
    duration: Number(b.duration) || 30,
    commissionType,
    // 无提成时金额恒为 0
    commissionValue: commissionType === 'none' ? 0 : Number(b.commissionValue) || 0,
    desc: b.desc || '',
    active: b.active !== false
  }
  db.prepare(`INSERT INTO services
    (id,name,category,price,duration,commission_type,commission_value,description,active)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    s.id, s.name, s.category, s.price, s.duration,
    s.commissionType, s.commissionValue, s.desc, s.active ? 1 : 0
  )
  res.json(s)
}))

router.put('/:id', wrap((req, res) => {
  const existing = db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id)
  if (!existing) return res.status(404).json({ message: '项目不存在' })
  const merged = { ...serviceFromRow(existing), ...req.body, id: req.params.id }
  if (!['fixed', 'percent', 'none'].includes(merged.commissionType)) merged.commissionType = 'fixed'
  if (merged.commissionType === 'none') merged.commissionValue = 0
  db.prepare(`UPDATE services SET
    name=@name, category=@category, price=@price, duration=@duration,
    commission_type=@commissionType, commission_value=@commissionValue,
    description=@desc, active=@active WHERE id=@id`).run({
    ...merged,
    active: merged.active ? 1 : 0
  })
  res.json(serviceFromRow(db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id)))
}))

router.delete('/:id', wrap((req, res) => {
  db.prepare('DELETE FROM services WHERE id=?').run(req.params.id)
  res.json({ ok: true })
}))
