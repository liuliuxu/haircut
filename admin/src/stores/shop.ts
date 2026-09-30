import { defineStore } from 'pinia'
import { api } from '@/api'
import type { ShopSetting } from '@/types'

// 店铺信息全局共享：侧边栏 Logo、登录页、浏览器标题都从这里取名
export const useShopStore = defineStore('shop', {
  state: () => ({
    setting: null as ShopSetting | null,
    loaded: false,
    loading: false
  }),
  getters: {
    shopName: (state) => state.setting?.name || '理发系统'
  },
  actions: {
    async fetch(force = false) {
      if (this.loading) return
      if (this.loaded && !force) return this.setting!
      this.loading = true
      try {
        this.setting = await api.getSetting()
        this.loaded = true
        this.applyTitle()
        return this.setting
      } finally {
        this.loading = false
      }
    },
    update(setting: ShopSetting) {
      this.setting = setting
      this.loaded = true
      this.applyTitle()
    },
    applyTitle() {
      document.title = `${this.setting?.name || '理发系统'} · 经营管理后台`
    }
  }
})
