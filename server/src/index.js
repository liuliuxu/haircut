import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config, root } from './config.js'
import { seedIfEmpty } from './db.js'
import { adminToken, router as authRouter } from './routes/auth.js'
import { router as settingRouter } from './routes/setting.js'
import { router as customersRouter } from './routes/customers.js'
import { router as servicesRouter } from './routes/services.js'
import { router as bookingsRouter } from './routes/bookings.js'
import { router as ordersRouter } from './routes/orders.js'
import { router as reportRouter } from './routes/report.js'
import { router as exportRouter } from './routes/export.js'
import { router as archiveRouter } from './routes/archive.js'

seedIfEmpty()

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

// 简易鉴权：登录、以及登录页需要展示的店铺名称（GET /setting）免鉴权
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next()
  if (req.method === 'GET' && req.path === '/setting') return next()
  if (req.get('x-admin-token') === adminToken) return next()
  res.status(401).json({ message: '未登录或登录已失效' })
})

app.use('/api/auth', authRouter)
app.use('/api/setting', settingRouter)
app.use('/api/customers', customersRouter)
app.use('/api/services', servicesRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/report', reportRouter)
app.use('/api/export', exportRouter)
app.use('/api/archives', archiveRouter)

// 统一错误处理
app.use('/api', (err, req, res, next) => {
  console.error('[server error]', err)
  res.status(500).json({ message: err?.message || '服务器内部错误' })
})

// 生产模式：直接托管前端构建产物（npm run build 后 npm run serve 即可单进程运行）
const distDir = resolve(root, 'admin/dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(resolve(distDir, 'index.html')))
}

app.listen(config.serverPort, '0.0.0.0', () => {
  console.log(`[barber] 后端服务已启动：http://localhost:${config.serverPort}`)
  console.log(`[barber] 数据库文件：${config.dbPath}`)
})
