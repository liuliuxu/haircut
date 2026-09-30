import { defineStore } from 'pinia'

export type FontSizeKey = 'small' | 'default' | 'large'

export interface ThemeSettings {
  primaryColor: string
  fontSize: FontSizeKey
  sidebarCollapsed: boolean
}

const THEME_KEY = 'barber_admin_theme'

const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#2b4a3e',
  fontSize: 'default',
  sidebarCollapsed: false
}

function loadTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) }
  } catch (e) {
    // ignore
  }
  return { ...DEFAULT_THEME }
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const mix = (hex: string, target: 'white' | 'black', weight: number) => {
  const c = hexToRgb(hex)
  const t = target === 'white' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }
  const r = Math.round(c.r + (t.r - c.r) * weight)
  const g = Math.round(c.g + (t.g - c.g) * weight)
  const b = Math.round(c.b + (t.b - c.b) * weight)
  return `rgb(${r}, ${g}, ${b})`
}

/** 将主题色写入 Element Plus 与全局 CSS 变量 */
export function applyTheme(theme: ThemeSettings) {
  const root = document.documentElement
  root.style.setProperty('--el-color-primary', theme.primaryColor)
  root.style.setProperty('--el-color-primary-dark-2', mix(theme.primaryColor, 'black', 0.2))
  ;[3, 5, 7, 8, 9].forEach((level) => {
    root.style.setProperty(`--el-color-primary-light-${level}`, mix(theme.primaryColor, 'white', level / 10))
  })
  // 品牌色与主题色保持一致
  root.style.setProperty('--brand', theme.primaryColor)
  root.style.setProperty('--brand-light', mix(theme.primaryColor, 'white', 0.2))

  root.style.setProperty('--app-fs', { small: '13px', default: '14px', large: '15px' }[theme.fontSize])
  root.setAttribute('data-font-size', theme.fontSize)
}

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: loadTheme(),
    drawerVisible: false
  }),
  actions: {
    apply() {
      applyTheme(this.theme)
    },
    patch(patch: Partial<ThemeSettings>) {
      this.theme = { ...this.theme, ...patch }
      localStorage.setItem(THEME_KEY, JSON.stringify(this.theme))
      applyTheme(this.theme)
    },
    reset() {
      this.theme = { ...DEFAULT_THEME }
      localStorage.setItem(THEME_KEY, JSON.stringify(this.theme))
      applyTheme(this.theme)
    }
  }
})
