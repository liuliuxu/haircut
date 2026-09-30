import { Router } from 'express'
import { db } from '../db.js'
import { wrap } from '../util.js'

export const router = Router()

/** 系统内置、带特殊扣款逻辑、不可删除的支付方式 */
export const SYSTEM_PAY_KEYS = ['balance', 'package', 'mixed']

const DEFAULT_PAY_METHODS = [
  { key: 'cash', label: '现金', enabled: true },
  { key: 'wechat', label: '微信', enabled: true },
  { key: 'alipay', label: '支付宝', enabled: true },
  { key: 'balance', label: '会员余额', enabled: true },
  { key: 'package', label: '次卡核销', enabled: true },
  { key: 'mixed', label: '混合支付', enabled: true }
]

/** 结算方式是否启用；历史数据无 enabled 字段时视为启用 */
export function isPayEnabled(settingOrMethods, key) {
  const methods = Array.isArray(settingOrMethods) ? settingOrMethods : settingOrMethods?.payMethods
  const m = (methods || []).find((p) => p.key === key)
  return !!m && m.enabled !== false
}

/** 归一化设置：兼容旧版本数据（员工薪资字段、支付方式缺失等），不写库 */
export function normalizeSetting(s) {
  const next = { ...s }
  next.stylists = Array.isArray(next.stylists) ? next.stylists : []
  next.stylists = next.stylists.map((x) => ({
    status: 'work',
    title: '',
    phone: '',
    salaryType: 'commission',
    baseSalary: 0,
    ...x,
    baseSalary: Number(x.baseSalary) || 0
  }))
  if (!Array.isArray(next.payMethods) || !next.payMethods.length) {
    next.payMethods = DEFAULT_PAY_METHODS.map((x) => ({ ...x }))
  } else {
    // 系统内置渠道被误删时自动补回；补 enabled 字段（旧数据默认启用）
    next.payMethods = next.payMethods.map((p) => ({ ...p, enabled: p.enabled !== false }))
    const have = new Set(next.payMethods.map((p) => p.key))
    for (const d of DEFAULT_PAY_METHODS) {
      if (SYSTEM_PAY_KEYS.includes(d.key) && !have.has(d.key)) next.payMethods.push({ ...d })
    }
  }
  return next
}

export function getSetting() {
  const row = db.prepare('SELECT data FROM setting WHERE id=1').get()
  return normalizeSetting(JSON.parse(row.data))
}

/** 生成自定义支付方式的唯一 key */
export function genPayKey(label) {
  const base = String(label || '').trim().replace(/[^\w一-龥]/g, '').slice(0, 12) || 'channel'
  const setting = getSetting()
  const keys = new Set(setting.payMethods.map((p) => p.key))
  let key = base
  let i = 2
  while (keys.has(key)) key = `${base}${i++}`
  return key
}

router.get('/', wrap((req, res) => {
  res.json(getSetting())
}))

router.put('/', wrap((req, res) => {
  const current = getSetting()
  const next = { ...current, ...req.body }
  // 员工 / 支付方式只允许通过整体结构更新；落库前再归一化一次
  const normalized = normalizeSetting(next)
  db.prepare('UPDATE setting SET data=? WHERE id=1').run(JSON.stringify(normalized))
  res.json(normalized)
}))
