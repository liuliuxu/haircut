/**
 * 跨平台交付包打包脚本（Mac / Windows 通用，双击「打包交付包.command / .bat」调用）
 *
 * 产物：桌面/简悦理发店管理系统_YYYYMMDD.zip
 * 对方解压后双击「启动系统.bat」(Windows) 或「启动系统.command」(Mac) 即可运行。
 *
 * 用 Node 自己写 zip（zlib deflateRaw + CRC32），保证：
 *  - 中文文件名带 UTF-8 标记位，Windows 资源管理器解压不乱码；
 *  - .command 带 0755 unix 权限，Mac 解压后可直接双击执行。
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, relative, sep } from 'node:path'
import { tmpdir, homedir, platform } from 'node:os'
import { deflateRawSync } from 'node:zlib'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const STAMP = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const PKG_NAME = `简悦理发店管理系统_${STAMP}`
const stage = mkdtempSync(join(tmpdir(), 'jianyue-pkg-'))
const pkgDir = join(stage, PKG_NAME)

const log = (s) => console.log(s)

// ---------- 1. 组装交付目录 ----------
mkdirSync(join(pkgDir, 'server'), { recursive: true })
mkdirSync(join(pkgDir, 'admin'), { recursive: true })
mkdirSync(join(pkgDir, 'data'), { recursive: true }) // 空库：首次启动自建空白数据库

const copyTree = (src, dst) => {
  if (!existsSync(src)) throw new Error(`缺少必要文件/目录：${relative(ROOT, src)}`)
  cpSync(src, dst, {
    recursive: true,
    filter: (s) => !s.endsWith('.DS_Store')
  })
}
const copyFile = (srcRel, dstRel = srcRel) => {
  const src = join(ROOT, srcRel)
  if (!existsSync(src)) throw new Error(`缺少必要文件：${srcRel}`)
  cpSync(src, join(pkgDir, dstRel))
}

// 后端：源码 + 依赖清单（不带 node_modules，由对方首次启动时按本机系统安装）
copyTree(join(ROOT, 'server/src'), join(pkgDir, 'server/src'))
copyFile('server/package.json', 'server/package.json')
copyFile('server/package-lock.json', 'server/package-lock.json')
// 前端：已构建产物（对方无需前端工具链、无需构建）
copyTree(join(ROOT, 'admin/dist'), join(pkgDir, 'admin/dist'))
// 启动脚本（Mac + Windows）、配置、说明
copyFile('启动系统.bat')
copyFile('启动系统.command')
copyFile('config.json')
copyFile('package.json')
copyFile('系统使用说明.md')

// ---------- 2. 极简 ZIP 写入器 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const dosDateTime = (d = new Date()) => {
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31)
  const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31)
  return { time, date }
}

/**
 * @param {string} baseDir 要打包的根目录
 * @param {string} zipPrefix zip 内的顶层目录名
 * @returns {Buffer}
 */
const buildZip = (baseDir, zipPrefix) => {
  const { time: dosTime, date: dosDate } = dosDateTime()
  const enc = (s) => Buffer.from(s, 'utf8')
  const isAscii = (b) => b.every((x) => x < 0x80)

  const locals = []
  const centrals = []
  let offset = 0
  let written = 0

  const pushEntry = (arcName, fileBuf, isDir = false, unixMode = 0o644) => {
    const nameBuf = enc(arcName)
    const flags = isAscii(nameBuf) ? 0 : 0x0800 // bit 11：文件名使用 UTF-8
    const crc = isDir ? 0 : crc32(fileBuf)
    const rawSize = isDir ? 0 : fileBuf.length
    const compBuf = isDir ? Buffer.alloc(0) : deflateRawSync(fileBuf, { level: 9 })
    const method = isDir ? 0 : 8

    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)          // 需要版本 2.0
    lh.writeUInt16LE(flags, 6)
    lh.writeUInt16LE(method, 8)
    lh.writeUInt16LE(dosTime, 10)
    lh.writeUInt16LE(dosDate, 12)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(compBuf.length, 18)
    lh.writeUInt32LE(rawSize, 22)
    lh.writeUInt16LE(nameBuf.length, 26)
    lh.writeUInt16LE(0, 28)          // extra len
    locals.push(lh, nameBuf, compBuf)

    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE((3 << 8) | 20, 4) // 宿主系统 3 = Unix
    ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(flags, 8)
    ch.writeUInt16LE(method, 10)
    ch.writeUInt16LE(dosTime, 12)
    ch.writeUInt16LE(dosDate, 14)
    ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(compBuf.length, 20)
    ch.writeUInt32LE(rawSize, 24)
    ch.writeUInt16LE(nameBuf.length, 28)
    ch.writeUInt16LE(0, 30)          // extra
    ch.writeUInt16LE(0, 32)          // comment
    ch.writeUInt16LE(0, 34)          // disk
    ch.writeUInt16LE(0, 36)          // internal attr
    ch.writeUInt32LE((unixMode << 16) | (isDir ? 0x10 : 0), 38) // external attr
    ch.writeUInt32LE(offset, 42)
    centrals.push(ch, nameBuf)

    offset += lh.length + nameBuf.length + compBuf.length
    written++
  }

  const walk = (absDir) => {
    const entries = readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    for (const ent of entries) {
      const abs = join(absDir, ent.name)
      const relPath = relative(baseDir, abs).split(sep).join('/')
      const arc = `${zipPrefix}/${relPath}${ent.isDirectory() ? '/' : ''}`
      if (ent.isDirectory()) {
        pushEntry(arc, Buffer.alloc(0), true, 0o755)
        walk(abs)
      } else if (ent.isFile()) {
        const mode = ent.name.endsWith('.command') ? 0o755 : 0o644
        pushEntry(arc, readFileSync(abs), false, mode)
      }
    }
  }

  // 顶层目录条目
  pushEntry(`${zipPrefix}/`, Buffer.alloc(0), true, 0o755)
  walk(baseDir)

  const cdBuf = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(written, 8)
  eocd.writeUInt16LE(written, 10)
  eocd.writeUInt32LE(cdBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, cdBuf, eocd])
}

// ---------- 3. 输出到桌面 ----------
const desktop = join(homedir(), 'Desktop')
if (!existsSync(desktop)) mkdirSync(desktop, { recursive: true })
const zipPath = join(desktop, `${PKG_NAME}.zip`)
rmSync(zipPath, { force: true })

const zipBuf = buildZip(pkgDir, PKG_NAME)
writeFileSync(zipPath, zipBuf)

rmSync(stage, { recursive: true, force: true })

const kb = zipBuf.length >= 1024 * 1024
  ? `${(zipBuf.length / 1024 / 1024).toFixed(2)} MB`
  : `${Math.round(zipBuf.length / 1024)} KB`

log('')
log('✅ 打包完成')
log(`   文件：${zipPath}`)
log(`   大小：${kb}`)
log('')
log('   发给对方 → 解压 → 双击「启动系统.bat」(Windows) 或「启动系统.command」(Mac)')
log('')

// 在文件管理器中定位产物（失败不影响结果）
try {
  if (platform() === 'darwin') {
    spawn('open', ['-R', zipPath], { stdio: 'ignore', detached: true }).unref()
  } else if (platform() === 'win32') {
    spawn('explorer.exe', ['/select,', zipPath], { stdio: 'ignore', detached: true }).unref()
  }
} catch { /* 忽略 */ }
