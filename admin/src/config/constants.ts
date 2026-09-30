import type { BookingStatus, OrderType, SalaryType } from '@/types'

/** 内置支付方式中文名（兜底用，实际展示以店铺设置 payMethods 为准） */
export const PAY_LABEL: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  balance: '会员余额',
  package: '次卡核销',
  mixed: '混合支付'
}

/** 带特殊扣款逻辑、不允许删除的支付方式 */
export const SYSTEM_PAY_KEYS = ['balance', 'package', 'mixed']

export const BOOKING_STATUS: Record<BookingStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  done: '已完成',
  cancelled: '已取消'
}

export const BOOKING_STATUS_TYPE: Record<BookingStatus, 'warning' | 'success' | 'primary' | 'info'> = {
  pending: 'warning',
  confirmed: 'success',
  done: 'primary',
  cancelled: 'info'
}

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  consume: '消费单',
  recharge: '充值单',
  refund: '退款单'
}

export const SALARY_TYPE_LABEL: Record<SalaryType, string> = {
  fixed: '固定月薪',
  commission: '纯提成',
  mixed: '底薪+提成'
}

export const SERVICE_CATEGORIES = ['剪发', '烫染', '护理', '套餐']

export const PAGE_SIZE_OPTIONS = [10, 20, 50]
