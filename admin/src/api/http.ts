import type { AdminApi } from './types'

const TOKEN_KEY = 'barber_admin_token'

const buildQuery = (params: Record<string, unknown>) => {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') usp.append(k, String(v))
  }
  const s = usp.toString()
  return s ? `?${s}` : ''
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': localStorage.getItem(TOKEN_KEY) || ''
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('barber_admin_name')
    if (!location.hash.includes('/login')) location.hash = '#/login'
    throw new Error('登录已失效，请重新登录')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.message || `请求失败（${res.status}）`)
  return data as T
}

export const httpApi: AdminApi = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),

  getSetting: () => request('GET', '/setting'),
  saveSetting: (patch) => request('PUT', '/setting', patch),

  listCustomers: (query) => request('GET', `/customers${buildQuery((query || {}) as Record<string, unknown>)}`),
  saveCustomer: (customer) =>
    customer.id ? request('PUT', `/customers/${customer.id}`, customer) : request('POST', '/customers', customer),
  deleteCustomer: (id) => request('DELETE', `/customers/${id}`),
  customerHistory: (customerId) => request('GET', `/customers/${customerId}/history`),
  importCustomersPreview: async (file) => {
    const res = await fetch('/api/customers/import-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-admin-token': localStorage.getItem(TOKEN_KEY) || ''
      },
      body: file
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || '解析失败')
    return data
  },
  importCustomers: (mode, rows) => request('POST', '/customers/import', { mode, rows }),

  listServices: (query) => request('GET', `/services${buildQuery((query || {}) as Record<string, unknown>)}`),
  saveService: (service) =>
    service.id ? request('PUT', `/services/${service.id}`, service) : request('POST', '/services', service),
  deleteService: (id) => request('DELETE', `/services/${id}`),

  listBookings: (query) => request('GET', `/bookings${buildQuery(query as unknown as Record<string, unknown>)}`),
  createBooking: (payload) => request('POST', '/bookings', payload),
  updateBooking: (id, payload) => request('PUT', `/bookings/${id}`, payload),
  setBookingStatus: (id, status) => request('PATCH', `/bookings/${id}`, { status }),

  listOrders: (query) => request('GET', `/orders${buildQuery(query as unknown as Record<string, unknown>)}`),
  createOrder: (payload) => request('POST', '/orders', payload),
  recharge: (payload) => request('POST', '/orders/recharge', payload),
  refundCustomer: (customerId, payload) => request('POST', `/customers/${customerId}/refund`, payload),

  report: (from, to) => request('GET', `/report${buildQuery({ from, to })}`),
  reportTrend: (opts) => request('GET', `/report/trend${buildQuery(opts as Record<string, unknown>)}`),
  salaryReport: (month) => request('GET', `/report/salary${buildQuery({ month })}`),

  listArchives: () => request('GET', '/archives'),
  createArchive: (payload) => request('POST', '/archives', payload),
  archiveSummary: (id) => request('GET', `/archives/${id}/summary`),
  archiveOrders: (id, query) =>
    request('GET', `/archives/${id}/orders${buildQuery(query as unknown as Record<string, unknown>)}`),
  deleteArchive: (id) => request('DELETE', `/archives/${id}`)
}

/** 以带鉴权的方式下载导出文件 */
export async function downloadExport(
  type: 'customers' | 'orders' | 'bookings' | 'services' | 'salary' | 'salary-detail',
  params: Record<string, unknown>
) {
  const res = await fetch(`/api/export/${type}${buildQuery(params)}`, {
    headers: { 'x-admin-token': localStorage.getItem(TOKEN_KEY) || '' }
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.message || '导出失败')
  }
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename\*=UTF-8''(.+)$/)
  const filename = match ? decodeURIComponent(match[1]) : `${type}.xlsx`
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 下载会员导入模板（接口需要登录态） */
export async function downloadCustomerTemplate() {
  const res = await fetch('/api/customers/import-template', {
    headers: { 'x-admin-token': localStorage.getItem(TOKEN_KEY) || '' }
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.message || '模板下载失败')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '会员导入模板.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

/** 下载数据封存的数据库副本（建议另存到 U盘/移动硬盘） */
export async function downloadArchive(id: string, fallbackName: string) {
  const res = await fetch(`/api/archives/${id}/download`, {
    headers: { 'x-admin-token': localStorage.getItem(TOKEN_KEY) || '' }
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.message || '封存文件下载失败')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fallbackName}.db`
  a.click()
  URL.revokeObjectURL(url)
}
