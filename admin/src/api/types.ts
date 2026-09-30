import type {
  Booking,
  BookingStatus,
  CreateBookingPayload,
  CreateOrderPayload,
  Customer,
  CustomerLog,
  ArchiveMeta,
  ArchiveSummary,
  ImportCustomerRow,
  ImportPreview,
  ImportResult,
  Order,
  PageResult,
  PageQuery,
  PayMethod,
  RechargePayload,
  RefundPayload,
  ReportData,
  SalaryReport,
  ServiceItem,
  ShopSetting,
  TrendMonth
} from '@/types'

export interface CustomerQuery extends PageQuery {
  keyword?: string
}

export interface ServiceQuery extends PageQuery {
  category?: string
  active?: 'true' | 'false' | ''
  keyword?: string
}

export interface BookingQuery extends PageQuery {
  from: string
  to: string
  status?: BookingStatus | ''
  keyword?: string
}

export interface OrderQuery extends PageQuery {
  from?: string
  to?: string
  keyword?: string
  type?: 'consume' | 'recharge' | 'refund' | ''
  payMethod?: PayMethod | ''
  /** 会员 / 散客筛选 */
  member?: 'yes' | 'no' | ''
  /** 精确查询某个会员的流水（会员支付记录弹窗） */
  customerId?: string
}

/** 后台统一数据接口（本地 Node + SQLite 实现） */
export interface AdminApi {
  login(username: string, password: string): Promise<{ token: string; name: string }>

  getSetting(): Promise<ShopSetting>
  saveSetting(patch: Partial<ShopSetting>): Promise<ShopSetting>

  listCustomers(query?: CustomerQuery): Promise<PageResult<Customer>>
  saveCustomer(customer: Partial<Customer>): Promise<Customer>
  deleteCustomer(id: string): Promise<void>
  /** 会员变动记录（编辑/充值/消费/次卡变更/退卡），按时间倒序 */
  customerHistory(customerId: string): Promise<CustomerLog[]>
  /** Excel 上传预览（不落库） */
  importCustomersPreview(file: File): Promise<ImportPreview>
  /** 确认批量导入，mode: skip=重复手机号跳过 / update=更新资料并累加余额 */
  importCustomers(mode: 'skip' | 'update', rows: ImportCustomerRow[]): Promise<ImportResult>

  listServices(query?: ServiceQuery): Promise<PageResult<ServiceItem>>
  saveService(service: Partial<ServiceItem>): Promise<ServiceItem>
  deleteService(id: string): Promise<void>

  listBookings(query: BookingQuery): Promise<PageResult<Booking>>
  createBooking(payload: CreateBookingPayload): Promise<Booking>
  updateBooking(id: string, payload: CreateBookingPayload): Promise<Booking>
  setBookingStatus(id: string, status: BookingStatus): Promise<void>

  listOrders(query: OrderQuery): Promise<PageResult<Order>>
  createOrder(payload: CreateOrderPayload): Promise<Order>
  recharge(payload: RechargePayload): Promise<{ order: Order; balance: number }>
  /** 会员退卡：退款并销卡（余额清零、次卡作废、档案标记已退卡） */
  refundCustomer(customerId: string, payload: RefundPayload): Promise<{ order: Order; balance: number }>

  report(from: string, to: string): Promise<ReportData>
  /** 经营趋势：近 N 月（months）或指定年份 1~12 月（year）；years 为有数据的年份 */
  reportTrend(opts: { months?: number; year?: number }): Promise<{ list: TrendMonth[]; years: number[] }>
  salaryReport(month: string): Promise<SalaryReport>

  /** 数据封存 */
  listArchives(): Promise<ArchiveMeta[]>
  createArchive(payload: {
    periodType: ArchiveMeta['periodType']
    year: number
    half?: 1 | 2
    quarter?: 1 | 2 | 3 | 4
    note?: string
  }): Promise<ArchiveMeta>
  archiveSummary(id: string): Promise<ArchiveSummary>
  archiveOrders(
    id: string,
    query: { page: number; pageSize: number; keyword?: string }
  ): Promise<{ total: number; page: number; pageSize: number; list: Order[] }>
  deleteArchive(id: string): Promise<void>
}
