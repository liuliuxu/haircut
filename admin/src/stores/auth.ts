import { defineStore } from 'pinia'
import { api } from '@/api'

const TOKEN_KEY = 'barber_admin_token'
const NAME_KEY = 'barber_admin_name'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    name: localStorage.getItem(NAME_KEY) || ''
  }),
  getters: {
    isAuthed: (state) => !!state.token
  },
  actions: {
    async login(username: string, password: string) {
      const res = await api.login(username, password)
      this.token = res.token
      this.name = res.name
      localStorage.setItem(TOKEN_KEY, res.token)
      localStorage.setItem(NAME_KEY, res.name)
    },
    logout() {
      this.token = ''
      this.name = ''
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(NAME_KEY)
    }
  }
})
