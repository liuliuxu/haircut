import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// config.json 写在项目最外层（server 的上两级）
const rootDir = resolve(__dirname, '../../')

let raw = {}
try {
  raw = JSON.parse(readFileSync(resolve(rootDir, 'config.json'), 'utf-8'))
} catch (e) {
  console.warn('[config] 未找到 config.json，使用默认配置')
}

export const root = rootDir
export const config = {
  // 部署时可用环境变量 PORT 覆盖（如 PORT=9091 npm start）；本地默认读 config.json
  serverPort: Number(process.env.PORT) || raw.server?.port || 5181,
  webPort: raw.web?.port || 5180,
  admin: {
    username: raw.admin?.username || 'admin',
    password: raw.admin?.password || 'admin123',
    name: raw.admin?.name || '超级管理员'
  },
  dbPath: resolve(rootDir, raw.database || './data/barber.db')
}
