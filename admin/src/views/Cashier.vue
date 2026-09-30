<template>
  <div v-loading="loading">
    <el-alert
      v-if="booking"
      :title="`来自预约：${booking.customerName} ${booking.date} ${booking.startTime}（${booking.serviceNames?.join('、')}），开单结算后预约自动完成`"
      type="success"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />

    <el-row :gutter="16">
      <el-col :span="15">
        <div class="page-card">
          <div class="section-title customer-head">
            <span>1. 选择顾客</span>
            <el-radio-group v-model="guestType" class="guest-switch" @change="onGuestTypeChange">
              <el-radio-button value="member">会员</el-radio-button>
              <el-radio-button value="walkin">散客</el-radio-button>
            </el-radio-group>
          </div>

          <el-select
            v-if="guestType === 'member'"
            v-model="customerId"
            filterable
            clearable
            placeholder="搜索会员姓名 / 手机号"
            style="width: 100%"
            @change="onPickCustomer"
          >
            <el-option
              v-for="c in customers"
              :key="c.id"
              :label="`${c.name}（${c.phone || '无手机号'}）`"
              :value="c.id"
            >
              <span>{{ c.name }}</span>
              <span style="float: right; color: #86909c; font-size: 12px">
                <template v-if="c.status === 'refunded'">已退卡 · </template>
                余额 ¥{{ fmt(c.balance) }} · {{ c.phone }}
              </span>
            </el-option>
          </el-select>

          <div v-if="guestType === 'walkin'" style="margin-top: 2px">
            <el-input v-model="walkName" placeholder="散客姓名（选填，默认记为散客）" style="width: 240px; margin-right: 12px" />
            <el-input v-model="walkPhone" placeholder="手机号（选填）" style="width: 240px" />
          </div>
          <div v-else-if="currentCustomer" class="customer-meta">
            <el-tag type="success" effect="plain">会员余额 ¥{{ fmt(currentCustomer.balance) }}</el-tag>
            <el-tag
              v-for="p in currentCustomer.packages"
              :key="p.serviceId"
              type="warning"
              effect="plain"
              style="margin-left: 6px"
            >
              {{ p.serviceName }} ×{{ p.remainTimes }}
            </el-tag>
            <span v-if="!currentCustomer.packages?.length" class="muted-tip">该会员暂未持有次卡</span>
          </div>
          <div v-else-if="guestType === 'member'" class="muted-tip" style="margin-top: 10px">
            请选择会员后，可使用余额支付或次卡核销
          </div>
        </div>

        <div class="page-card" style="margin-top: 16px">
          <div class="section-title">
            2. 服务明细
            <el-button size="small" type="primary" plain :icon="Plus" style="float: right" @click="addItem">
              添加项目
            </el-button>
          </div>
          <el-table :data="items" border size="default">
            <el-table-column label="服务项目（可选价目表或直接输入名称）" width="300">
              <template #default="{ row }">
                <el-select
                  v-model="row.serviceKey"
                  filterable
                  allow-create
                  default-first-option
                  clearable
                  placeholder="选项目，或直接输入扣款名称"
                  style="width: 100%"
                  @change="(v: string) => onPickService(row, v)"
                >
                  <el-option
                    v-for="s in activeServices"
                    :key="s.id"
                    :label="`${s.name}（¥${fmt(s.price)}）`"
                    :value="s.id"
                  >
                    <span>{{ s.name }}（¥{{ fmt(s.price) }}）</span>
                    <el-tag
                      v-if="remainOf(s.id) > 0"
                      type="warning"
                      size="small"
                      effect="plain"
                      style="float: right; margin-top: 4px"
                    >
                      次卡剩 {{ remainOf(s.id) }} 次
                    </el-tag>
                  </el-option>
                </el-select>
                <!-- 次卡核销模式下逐行提示能否核销；其他模式下标识自定义扣款 -->
                <el-tag
                  v-if="payMethod === 'package' && row.serviceKey"
                  :type="rowPkgState(row).type"
                  size="small"
                  effect="plain"
                  style="margin-top: 4px"
                >
                  {{ rowPkgState(row).text }}
                </el-tag>
                <el-tag
                  v-else-if="row.serviceKey && !serviceMap.get(row.serviceKey)"
                  size="small"
                  type="warning"
                  effect="plain"
                  style="margin-top: 4px"
                >
                  自定义扣款
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="理发师" width="150">
              <template #default="{ row }">
                <el-select v-model="row.stylistId" placeholder="选择理发师" style="width: 100%">
                  <el-option v-for="s in stylists" :key="s.id" :label="s.name" :value="s.id" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.price" :min="0" :precision="2" :step="10" :controls="false" style="width: 100%" placeholder="必填" />
              </template>
            </el-table-column>
            <el-table-column label="提成" width="100">
              <template #default="{ row }">
                <el-input-number v-model="row.commission" :min="0" :precision="2" :step="5" :controls="false" style="width: 100%" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center" fixed="right">
              <template #default="{ $index }">
                <el-button link type="danger" @click="items.splice($index, 1)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!items.length" description="请添加服务项目" :image-size="70" />
        </div>
      </el-col>

      <el-col :span="9">
        <div class="page-card settle-card">
          <div class="section-title">3. 结算</div>

          <div class="pay-grid">
            <div
              v-for="p in payOptions"
              :key="p.key"
              class="pay-item"
              :class="{
                active: payMethod === p.key,
                disabled:
                  (p.key === 'package' && (!customerId || hasManual || !hasAnyPackage)) ||
                  (p.key === 'balance' && !customerId) ||
                  (p.key === 'mixed' && (!customerId || !balancePayEnabled || (Number(currentCustomer?.balance) || 0) <= 0))
              }"
              @click="selectPay(p.key)"
            >
              {{ p.label }}
            </div>
          </div>
          <div v-if="payMethod === 'package' && hasManual" class="pay-hint danger">
            本单包含自定义扣款，不能使用次卡核销，请选择其他结算方式
          </div>
          <div v-if="payMethod === 'balance' && currentCustomer" class="pay-hint">
            当前余额 ¥{{ fmt(currentCustomer.balance) }}，本单应付 ¥{{ fmt(total) }}，
            <span :class="balanceAfter < 0 ? 'danger' : 'ok'">
              结算后余额 ¥{{ fmt(balanceAfter) }}
            </span>
          </div>
          <template v-if="payMethod === 'package'">
            <div class="pay-hint ok">本单将核销：{{ pkgSummary || '—' }}，无需收款</div>
            <div v-for="(msg, i) in pkgProblems" :key="i" class="pay-hint danger">⚠ {{ msg }}</div>
          </template>
          <template v-if="payMethod === 'mixed' && currentCustomer">
            <div class="pay-hint">
              本单合计 ¥{{ fmt(total) }}，会员余额 ¥{{ fmt(currentCustomer.balance) }}，
              余额不足部分可用其他方式补足
            </div>
            <div class="mixed-pay">
              <div class="mixed-pay-row">
                <span class="mixed-pay-label">余额支付</span>
                <el-input-number
                  v-model="mixedBalance"
                  :min="0.01"
                  :max="mixedMax"
                  :precision="2"
                  :step="10"
                  :controls="false"
                  style="width: 140px"
                />
                <span class="muted-tip">扣后余额 ¥{{ fmt(mixedBalanceAfter) }}</span>
              </div>
              <div class="mixed-pay-row">
                <span class="mixed-pay-label">剩余 <b class="price-text">¥{{ fmt(mixedExtra) }}</b> 使用</span>
                <el-select v-model="mixedExtraMethod" placeholder="选择补足方式" style="width: 150px">
                  <el-option
                    v-for="p in extraPayMethods"
                    :key="p.key"
                    :label="p.label"
                    :value="p.key"
                  />
                </el-select>
                <span class="muted-tip">收款补足</span>
              </div>
              <div v-if="mixedExtra <= 0" class="pay-hint danger" style="margin-top: 6px">
                余额足以支付本单，请直接选择「会员余额」
              </div>
            </div>
          </template>

          <el-input
            v-model="remark"
            type="textarea"
            :rows="2"
            placeholder="订单备注（选填）"
            style="margin-top: 16px"
          />

          <div class="total-box">
            <div class="total-row">
              <span>项目数量</span>
              <span>{{ validItems.length }} 项</span>
            </div>
            <div class="total-row big">
              <span>{{ payMethod === 'package' ? '次卡核销' : '应收金额' }}</span>
              <span class="price-text">¥{{ fmt(total) }}</span>
            </div>
          </div>

          <el-button
            type="primary"
            size="large"
            class="submit-btn"
            :loading="saving"
            @click="submit"
          >
            确认结算并出单
          </el-button>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '@/api'
import type { Booking, Customer, PayMethod, ServiceItem, ShopSetting } from '@/types'

interface CashierItem {
  /** 价目表 id 或手工输入的项目名（手工时 serviceMap 中查不到） */
  serviceKey: string
  stylistId: string
  /** 实收金额，价目表项目带出牌价后仍可修改；手工项目必填 */
  price: number | undefined
  /** 提成，价目表项目按规则带出，可修改；手工项目默认 0 */
  commission: number | undefined
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const customers = ref<Customer[]>([])
const activeServices = ref<ServiceItem[]>([])
const setting = ref<ShopSetting | null>(null)
const booking = ref<Booking | null>(null)

/** member=会员结算（余额/次卡可用）；walkin=散客 */
const guestType = ref<'member' | 'walkin'>('walkin')
const customerId = ref('')
const walkName = ref('')
const walkPhone = ref('')
const items = ref<CashierItem[]>([])
const payMethod = ref<PayMethod>('wechat')
const remark = ref('')

const stylists = computed(() => setting.value?.stylists.filter((s) => s.status === 'work') || [])
/** 仅展示启用中的结算方式（停用渠道历史单据仍可展示，但不能新开单） */
const payOptions = computed(() => (setting.value?.payMethods || []).filter((p) => p.enabled !== false))
/** 会员余额渠道是否启用（停用时混合支付也不可用） */
const balancePayEnabled = computed(() => payOptions.value.some((p) => p.key === 'balance'))
const currentCustomer = computed(() => customers.value.find((c) => c.id === customerId.value) || null)
const serviceMap = computed(() => new Map(activeServices.value.map((s) => [s.id, s])))
/** 是否包含价目表之外的自定义扣款行 */
const hasManual = computed(() => items.value.some((it) => it.serviceKey && !serviceMap.value.has(it.serviceKey)))
const validItems = computed(() =>
  items.value.filter((it) => it.serviceKey && Number(it.price) > 0 && it.stylistId)
)
const total = computed(() => validItems.value.reduce((s, it) => s + (Number(it.price) || 0), 0))
const balanceAfter = computed(() => (currentCustomer.value?.balance || 0) - total.value)

// ---- 混合支付：会员余额承担一部分，剩余金额用一种普通渠道收款补足 ----
const round2 = (n: number) => Math.round(n * 100) / 100
const mixedBalance = ref(0)
const mixedExtraMethod = ref('')
/** 可用于补足的渠道：现金/微信/支付宝/自定义（排除余额、次卡、混合） */
const extraPayMethods = computed(() =>
  payOptions.value.filter((p) => !['balance', 'package', 'mixed'].includes(p.key))
)
const mixedMax = computed(() =>
  Math.min(Number(currentCustomer.value?.balance) || 0, total.value)
)
const mixedExtra = computed(() => round2(total.value - (Number(mixedBalance.value) || 0)))
const mixedBalanceAfter = computed(() =>
  round2((Number(currentCustomer.value?.balance) || 0) - (Number(mixedBalance.value) || 0))
)
watch(
  payMethod,
  (v) => {
    if (v !== 'mixed') return
    // 默认用全部可用余额承担，差额走补足渠道
    const cap = Math.min(Number(currentCustomer.value?.balance) || 0, total.value)
    if (!(mixedBalance.value > 0) || mixedBalance.value > cap) mixedBalance.value = cap
    if (!extraPayMethods.value.some((p) => p.key === mixedExtraMethod.value)) {
      mixedExtraMethod.value =
        extraPayMethods.value.find((p) => p.key === 'wechat')?.key ||
        extraPayMethods.value[0]?.key ||
        ''
    }
  }
)
watch(total, (t) => {
  if (payMethod.value !== 'mixed') return
  const cap = Math.min(Number(currentCustomer.value?.balance) || 0, t)
  if (mixedBalance.value > cap) mixedBalance.value = cap
})
// 设置变更后若当前结算方式被停用/删除，自动切到第一种可用的普通渠道
watch(payOptions, (opts) => {
  if (opts.some((p) => p.key === payMethod.value)) return
  payMethod.value =
    opts.find((p) => p.key === 'wechat')?.key ||
    opts.find((p) => !['balance', 'package', 'mixed'].includes(p.key))?.key ||
    opts[0]?.key ||
    'wechat'
})

// ---- 次卡核销相关：会员持有的次卡、本单按项目汇总的需求次数 ----
const packageList = computed(() => currentCustomer.value?.packages || [])
const hasAnyPackage = computed(() => packageList.value.some((p) => p.remainTimes > 0))
const remainOf = (serviceId: string) =>
  packageList.value.find((p) => p.serviceId === serviceId)?.remainTimes ?? 0
/** 本单价目表行按项目汇总的数量（多行同一项目时合并校验） */
const needMap = computed(() => {
  const m = new Map<string, number>()
  for (const it of items.value) {
    if (it.serviceKey && serviceMap.value.has(it.serviceKey)) {
      m.set(it.serviceKey, (m.get(it.serviceKey) || 0) + 1)
    }
  }
  return m
})
/** 核销模式下每一行的即时状态，用于明细行标签 */
const rowPkgState = (row: CashierItem): { type: 'success' | 'warning' | 'danger'; text: string } => {
  const svc = serviceMap.value.get(row.serviceKey)
  if (!svc) return { type: 'warning', text: '自定义扣款（不可核销）' }
  const pkg = packageList.value.find((p) => p.serviceId === svc.id)
  const need = needMap.value.get(svc.id) || 1
  if (!pkg || pkg.remainTimes <= 0) return { type: 'danger', text: '会员无此项次卡' }
  if (pkg.remainTimes < need) {
    return { type: 'danger', text: `次数不足：需 ${need} 次 / 剩 ${pkg.remainTimes} 次` }
  }
  return { type: 'success', text: `可核销，扣后剩 ${pkg.remainTimes - need} 次` }
}
/** 核销汇总文案，如「精剪造型 ×1（扣后剩 5 次）」 */
const pkgSummary = computed(() =>
  [...needMap.value.entries()]
    .map(([id, n]) => {
      const svc = serviceMap.value.get(id)
      const remain = remainOf(id)
      return svc ? `${svc.name} ×${n}（扣后剩 ${Math.max(remain - n, 0)} 次）` : ''
    })
    .filter(Boolean)
    .join('、')
)
/** 核销模式下不满足条件的原因（去重），为空表示可以正常核销 */
const pkgProblems = computed(() => {
  if (payMethod.value !== 'package') return [] as string[]
  const msgs: string[] = []
  for (const it of validItems.value) {
    const svc = serviceMap.value.get(it.serviceKey)
    if (!svc) {
      msgs.push(`「${it.serviceKey}」是自定义扣款，不能走次卡核销`)
      continue
    }
    const need = needMap.value.get(svc.id) || 1
    const remain = remainOf(svc.id)
    if (remain <= 0) msgs.push(`会员没有「${svc.name}」次卡`)
    else if (remain < need) msgs.push(`「${svc.name}」次数不足：需要 ${need} 次，剩余 ${remain} 次`)
  }
  return [...new Set(msgs)]
})

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

const addItem = () => items.value.push({ serviceKey: '', stylistId: '', price: undefined, commission: undefined })

const onPickService = (row: CashierItem, v: string) => {
  const svc = serviceMap.value.get(v)
  if (svc) {
    row.price = svc.price
    row.commission =
      svc.commissionType === 'none'
        ? 0
        : svc.commissionType === 'fixed'
          ? svc.commissionValue
          : Math.round(svc.price * svc.commissionValue) / 100
  } else if (v) {
    // 手工扣款：金额、提成由人工填写
    row.price = undefined
    row.commission = 0
  }
  if (!row.stylistId && setting.value?.stylists[0]) {
    row.stylistId = setting.value.stylists[0].id
  }
}

const onPickCustomer = () => {
  // 已退卡会员不允许继续开单
  if (currentCustomer.value?.status === 'refunded') {
    ElMessage.warning('该会员已退卡，不能继续开单')
    customerId.value = ''
    return
  }
  // 更换会员后余额分摊默认值重新计算
  mixedBalance.value = 0
  if (payMethod.value === 'balance' && !customerId.value) payMethod.value = 'wechat'
  if (payMethod.value === 'package' && (!customerId.value || hasManual.value || !hasAnyPackage.value)) {
    payMethod.value = 'wechat'
  }
  if (
    payMethod.value === 'mixed' &&
    (!customerId.value || (Number(currentCustomer.value?.balance) || 0) <= 0)
  ) {
    payMethod.value = 'wechat'
  }
}

/** 会员 / 散客切换：切到散客时清空会员与会员专属结算方式 */
const onGuestTypeChange = (t: string | number | boolean | undefined) => {
  if (t === 'walkin') {
    customerId.value = ''
    if (['balance', 'package', 'mixed'].includes(payMethod.value)) payMethod.value = 'wechat'
  }
}

const selectPay = (key: PayMethod) => {
  if (key === 'balance' && !customerId.value) {
    ElMessage.warning('会员余额支付需要先在「会员」模式下选择会员')
    return
  }
  if (key === 'mixed' && !customerId.value) {
    ElMessage.warning('混合支付需要先在「会员」模式下选择会员')
    return
  }
  if (key === 'mixed' && (Number(currentCustomer.value?.balance) || 0) <= 0) {
    ElMessage.warning('该会员余额为 0，无法使用混合支付，请选择其他结算方式')
    return
  }
  if (key === 'package' && !customerId.value) {
    ElMessage.warning('次卡核销需要先在「会员」模式下选择会员')
    return
  }
  if (key === 'package' && !hasAnyPackage.value) {
    ElMessage.warning('该会员暂未持有可用次卡')
    return
  }
  if (key === 'package' && hasManual.value) {
    ElMessage.warning('本单包含自定义扣款，不能使用次卡核销')
    return
  }
  payMethod.value = key
}

const submit = async () => {
  if (guestType.value === 'member' && !customerId.value) {
    ElMessage.warning('会员模式下请选择会员，或切换为散客')
    return
  }
  if (!validItems.value.length) {
    ElMessage.warning('请添加并完善消费明细（项目、金额、理发师）')
    return
  }
  if (items.value.length !== validItems.value.length) {
    ElMessage.warning('有未填完整的明细行（项目名 / 金额需大于 0 / 理发师），请补全或移除')
    return
  }
  if (payMethod.value === 'package' && hasManual.value) {
    ElMessage.warning('含自定义扣款的单据不能使用次卡核销')
    return
  }
  if (payMethod.value === 'package' && pkgProblems.value.length) {
    ElMessage.warning(pkgProblems.value[0])
    return
  }
  if (payMethod.value === 'balance' && balanceAfter.value < 0) {
    ElMessage.warning('会员余额不足，请改用其他支付方式或先充值')
    return
  }
  if (payMethod.value === 'mixed') {
    const bal = round2(Number(mixedBalance.value))
    const memberBalance = Number(currentCustomer.value?.balance) || 0
    if (!(bal > 0) || bal > memberBalance) {
      ElMessage.warning('会员余额承担金额不正确，或超出当前余额')
      return
    }
    if (!mixedExtraMethod.value) {
      ElMessage.warning('请选择剩余金额的补足结算方式')
      return
    }
    if (!(mixedExtra.value > 0)) {
      ElMessage.warning('会员余额足以支付本单，请直接选择「会员余额」结算')
      return
    }
    if (round2(bal + mixedExtra.value) !== round2(total.value)) {
      ElMessage.warning('余额承担金额与补足金额合计需等于本单合计')
      return
    }
  }
  saving.value = true
  try {
    const order = await api.createOrder({
      customerId: customerId.value || undefined,
      customerName: customerId.value ? undefined : walkName.value.trim() || '散客',
      phone: customerId.value ? undefined : walkPhone.value.trim(),
      items: validItems.value.map((it) => {
        const svc = serviceMap.value.get(it.serviceKey)
        return {
          serviceId: svc?.id,
          name: svc ? undefined : it.serviceKey.trim(),
          price: Number(it.price),
          commission: Number(it.commission) || 0,
          stylistId: it.stylistId
        }
      }),
      payMethod: payMethod.value,
      payDetail:
        payMethod.value === 'mixed'
          ? {
              balance: round2(Number(mixedBalance.value)),
              [mixedExtraMethod.value]: mixedExtra.value
            }
          : undefined,
      remark: remark.value,
      bookingId: booking.value?.id
    })
    let resultMsg = `单号：${order.no}`
    if (payMethod.value === 'package') {
      resultMsg += '（次卡核销）'
    } else if (payMethod.value === 'mixed') {
      const extraLabel = payOptions.value.find((p) => p.key === mixedExtraMethod.value)?.label || ''
      resultMsg += `，余额扣 ¥${fmt(order.payDetail?.balance)}，${extraLabel}收 ¥${fmt(mixedExtra.value)}`
    } else {
      resultMsg += `，实收 ¥${fmt(order.total)}`
    }
    await ElMessageBox.alert(
      resultMsg,
      '结算成功',
      { type: 'success', confirmButtonText: booking.value ? '返回预约列表' : '继续开单' }
    )
    if (booking.value) {
      router.push('/bookings')
    } else {
      resetForm()
      // 刷新会员余额/次卡
      const res = await api.listCustomers({ pageSize: 200 })
      customers.value = res.list
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '结算失败')
  } finally {
    saving.value = false
  }
}

const resetForm = () => {
  guestType.value = 'walkin'
  customerId.value = ''
  walkName.value = ''
  walkPhone.value = ''
  items.value = []
  payMethod.value = 'wechat'
  remark.value = ''
  mixedBalance.value = 0
  mixedExtraMethod.value = ''
  addItem()
}

const loadBooking = async (bookingId: string) => {
  // 预约可能在过去/未来 60 天内，宽范围拉取后定位
  const res = await api.listBookings({
    from: dayjs().subtract(60, 'day').format('YYYY-MM-DD'),
    to: dayjs().add(60, 'day').format('YYYY-MM-DD'),
    pageSize: 200
  })
  const bk = res.list.find((b) => b.id === bookingId)
  if (!bk) {
    ElMessage.warning('未找到关联预约，可直接手工开单')
    return
  }
  booking.value = bk
  guestType.value = bk.customerId ? 'member' : 'walkin'
  customerId.value = bk.customerId
  walkName.value = bk.customerName
  walkPhone.value = bk.phone
  items.value = bk.serviceIds.map((id) => {
    const svc = activeServices.value.find((s) => s.id === id)
    return {
      serviceKey: id,
      stylistId: bk.stylistId || stylists.value[0]?.id || '',
      price: svc?.price,
      commission: svc
        ? svc.commissionType === 'none'
          ? 0
          : svc.commissionType === 'fixed'
            ? svc.commissionValue
            : Math.round(svc.price * svc.commissionValue) / 100
        : undefined
    }
  })
}

onMounted(async () => {
  loading.value = true
  try {
    const [settingRes, customerRes, serviceRes] = await Promise.all([
      api.getSetting(),
      api.listCustomers({ pageSize: 200 }),
      api.listServices({ active: 'true', pageSize: 200 })
    ])
    setting.value = settingRes
    customers.value = customerRes.list
    activeServices.value = serviceRes.list
    if (route.query.bookingId) {
      await loadBooking(String(route.query.bookingId))
    } else {
      addItem()
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
}

.customer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.guest-switch {
  font-weight: 400;
}

.muted-tip {
  margin-left: 8px;
  font-size: 12px;
  color: #86909c;
}

.customer-meta {
  margin-top: 12px;
}

.settle-card {
  position: sticky;
  top: 0;
}

.pay-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.pay-item {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 12px 0;
  text-align: center;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.pay-item:hover {
  border-color: var(--brand-light);
}

.pay-item.active {
  border-color: var(--brand);
  background: rgba(43, 74, 62, 0.06);
  color: var(--brand);
  font-weight: 600;
}

.pay-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pay-hint {
  margin-top: 12px;
  font-size: 12px;
  color: #86909c;
  line-height: 1.8;
}

.pay-hint .ok {
  color: #67c23a;
  font-weight: 600;
}

.pay-hint .danger {
  color: #f56c6c;
  font-weight: 600;
}

.pay-hint.ok {
  color: #67c23a;
}

.pay-hint.danger {
  color: #f56c6c;
}

.mixed-pay {
  margin-top: 12px;
  padding: 12px 14px;
  background: #f7f6f3;
  border-radius: 8px;
}

.mixed-pay-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 10px;
}

.mixed-pay-row:last-child {
  margin-bottom: 0;
}

.mixed-pay-label {
  display: inline-block;
  min-width: 150px;
}

.mixed-pay .price-text {
  color: var(--price);
}

.total-box {
  margin-top: 20px;
  border-top: 1px dashed #e5e6eb;
  padding-top: 16px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  color: #4e5969;
  font-size: 13px;
  margin-bottom: 10px;
}

.total-row.big {
  font-size: 20px;
  font-weight: 700;
  color: #1d2129;
}

.submit-btn {
  width: 100%;
  margin-top: 18px;
  height: 46px;
  font-size: 16px;
}
</style>
