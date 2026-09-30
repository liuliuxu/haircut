import { Router } from 'express'
import crypto from 'node:crypto'
import { config } from '../config.js'

export const router = Router()

// 固定令牌：由账号密码派生，服务重启后登录态依然有效
export function buildToken(username, password) {
  return 'barber_' + crypto.createHash('sha256').update(`${username}:${password}`).digest('hex').slice(0, 24)
}

export const adminToken = buildToken(config.admin.username, config.admin.password)

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  if (username === config.admin.username && password === config.admin.password) {
    res.json({ token: adminToken, name: config.admin.name })
    return
  }
  res.status(401).json({ message: '用户名或密码错误' })
})
