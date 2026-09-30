// 简悦理发 · 本地数据库实体结构（与 server/src/db.js 对应）

export type BookingStatus = 'pending' | 'confirmed' | 'done' | 'cancelled'

/** 支付方式 key：内置五种 + 店铺自定义渠道（如美团团购），统一用字符串 */
export type PayMethod = string

export type CommissionType = 'fixed' | 'percent' | 'none'

export type OrderType = 'consume' | 'recharge' | 'refund'

/** 会员状态：active=正常 / refunded=已退卡 */
export type CustomerStatus = 'active' | 'refunded'

/** 员工薪资方式：固定月薪 / 纯提成 / 底薪+提成 */
export type SalaryType = 'fixed' | 'commission' | 'mixed'

export interface Staff {
  id: string
  name: string
  title: string
  phone: string
  status: 'work' | 'rest'
  salaryType: SalaryType
  /** 月底薪（fixed / mixed 生效） */
  baseSalary: number
  /** 入职日期 YYYY-MM-DD（旧数据可能为空） */
  hireDate?: string
  /** 生日 YYYY-MM-DD */
  birthday?: string
  /** 备注 */
  remark?: string
}

export interface PayMethodOption {
  key: string
  label: string
  /** 是否启用（停用后开单/充值/退款不可选，历史单据照常展示）；旧数据缺省视为启用 */
  enabled?: boolean
}

export interface ServiceItem {
  id: string
  name: string
  category: string
  price: number
  duration: number
  commissionType: CommissionType
  commissionValue: number
  desc: string
  active: boolean
}

export interface Booking {
  id: string
  customerId: string
  customerName: string
  phone: string
  serviceIds: string[]
  serviceNames?: string[]
  stylistId: string
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  source: 'customer' | 'boss'
  remark: string
  createdAt: number
}

export interface OrderItem {
  /** 价目表项目 id；手工项目为空字符串 */
  serviceId: string
  name: string
  price: number
  stylistId: string
  stylistName: string
  commission: number
}

export interface Order {
  id: string
  no: string
  type: OrderType
  customerId: string
  customerName: string
  phone?: string
  items: OrderItem[]
  payMethod: PayMethod
  /** 混合支付各渠道分摊金额，如 { balance: 30, wechat: 70 }；普通订单为 {} 或缺省 */
  payDetail?: Record<string, number>
  total: number
  gift?: number
  remark?: string
  bookingId?: string
  createdAt: number
}

export interface PackageInfo {
  serviceId: string
  serviceName: string
  totalTimes: number
  remainTimes: number
  /** 次卡添加日期 YYYY-MM-DD（历史数据可能为空） */
  addedAt?: string
}

export interface CustomerNote {
  hairType: string
  formula: string
  allergy: string
  preferStylist: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  gender: 'male' | 'female'
  birthday: string
  balance: number
  packages: PackageInfo[]
  note: CustomerNote
  lastVisitDate: string
  visitCount: number
  totalSpend: number
  createdAt: string
  /** 档案/账户最近变动日期 */
  updatedAt: string
  /** 最近一次充值日期（列表接口附带，空字符串表示从未充值） */
  lastRechargeAt?: string
  status: CustomerStatus
}

/** 会员变动记录（时间轴消息） */
export interface CustomerLog {
  id: string
  customerId: string
  /** create=开卡 edit=档案编辑 recharge=充值 consume=消费 package=次卡变更 refund=退卡 */
  type: 'create' | 'edit' | 'recharge' | 'consume' | 'package' | 'refund'
  message: string
  amount: number
  /** 毫秒时间戳 */
  createdAt: number
}

/** 数据封存（周期快照，只读） */
export interface ArchiveMeta {
  id: string
  /** 封存周期名称，如 2026年第三季度 */
  label: string
  periodType: 'year' | 'half' | 'quarter'
  startDate: string
  endDate: string
  /** 封存操作时间（毫秒） */
  createdAt: number
  dbSize: number
  note?: string
}

export interface ArchiveSummary {
  label: string
  startDate: string
  endDate: string
  orderCount: number
  consumeCount: number
  revenue: number
  rechargeCount: number
  rechargeTotal: number
  rechargeGift: number
  refundCount: number
  refundTotal: number
}

export interface ShopSetting {
  name: string
  phone: string
  address: string
  openTime: string
  closeTime: string
  slotInterval: number
  stylists: Staff[]
  payMethods: PayMethodOption[]
}

export interface PageResult<T> {
  list: T[]
  total: number
  /** 订单列表附带：当前筛选条件下的实收合计 */
  sumTotal?: number
}

export interface PageQuery {
  page?: number
  pageSize?: number
}

export interface CreateBookingPayload {
  customerId?: string
  customerName: string
  phone?: string
  serviceIds: string[]
  stylistId: string
  date: string
  startTime: string
  remark?: string
}

export interface CreateOrderItem {
  /** 不传 = 手工项目（须给 name + price） */
  serviceId?: string
  name?: string
  /** 手工项目金额必填；价目表项目不传则用牌价，传了按实收金额算 */
  price?: number
  /** 提成，不传按项目规则计算；手工项目不传记 0 */
  commission?: number
  stylistId: string
}

export interface CreateOrderPayload {
  customerId?: string
  customerName?: string
  phone?: string
  items: CreateOrderItem[]
  payMethod: PayMethod
  /** 混合支付（payMethod='mixed'）时必填：各渠道分摊金额，如 { balance: 30, wechat: 70 } */
  payDetail?: Record<string, number>
  remark?: string
  bookingId?: string
}

export interface RechargePayload {
  customerId: string
  amount: number
  gift: number
  payMethod: PayMethod
}

/** 退卡：实退金额（可为 0，表示仅销卡不退款）+ 退款方式 + 备注 */
export interface RefundPayload {
  amount: number
  /** amount > 0 时必填：现金/微信/支付宝等普通渠道 */
  payMethod?: string
  remark?: string
}

export interface ReportData {
  revenue: number
  orderCount: number
  avgTicket: number
  bookingCount: number
  rechargeTotal: number
  rechargeGift: number
  rechargeCount: number
  serviceSales: { serviceId: string; name: string; count: number; revenue: number }[]
  /** 区间内全部服务项目占比（按营收降序，占比图用） */
  serviceShare: { serviceId: string; name: string; count: number; revenue: number }[]
  /** 区间内服务分类汇总（占比图用） */
  categoryShare: { name: string; count: number; revenue: number }[]
  staffPerformance: {
    stylistId: string
    name: string
    orderCount: number
    revenue: number
    commission: number
  }[]
}

/** 近 N 月经营趋势单个月份 */
export interface TrendMonth {
  month: string
  label: string
  revenue: number
  orderCount: number
  rechargeTotal: number
  added: number
  refunded: number
  netAdded: number
}

export interface SalaryRow {
  stylistId: string
  name: string
  title: string
  status: 'work' | 'rest'
  salaryType: SalaryType
  baseSalary: number
  orderCount: number
  revenue: number
  commission: number
  /** 固定工资部分（纯提成为 0） */
  fixedPay: number
  /** 提成工资部分（固定月薪为 0） */
  commissionPay: number
  /** 应发工资 */
  payTotal: number
  /** 当月订单项目级提成明细 */
  details: SalaryDetailItem[]
}

/** 个人薪资明细中的一行（一个订单中的一个服务项目） */
export interface SalaryDetailItem {
  date: string
  orderId: string
  orderNo: string
  customerName: string
  serviceName: string
  price: number
  commission: number
}

export interface SalaryReport {
  month: string
  list: SalaryRow[]
  summary: {
    fixedTotal: number
    commissionTotal: number
    payTotal: number
    revenue: number
  }
}

/** Excel 导入预览中的一行会员 */
export interface ImportCustomerRow {
  /** Excel 行号（从 1 开始，含表头） */
  row: number
  name: string
  phone: string
  gender: 'male' | 'female' | ''
  birthday: string
  balance: number
  /** 系统中是否已存在同手机号会员 */
  duplicate: boolean
  existingName?: string
  existingBalance?: number
}

export interface ImportRowError {
  row: number
  message: string
}

export interface ImportPreview {
  rows: ImportCustomerRow[]
  errors: ImportRowError[]
}

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: ImportRowError[]
}
