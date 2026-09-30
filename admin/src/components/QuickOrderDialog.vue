<template>
  <el-dialog
    :model-value="modelValue"
    title="快速开单（会员）"
    width="660px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="onOpen"
    @closed="onClosed"
  >
    <div v-if="customer" class="member-bar">
      <el-tag type="success" effect="plain">{{ customer.name }}</el-tag>
      <span class="muted">{{ customer.phone || '无手机号' }}</span>
      <el-tag effect="plain" type="info">余额 ¥{{ fmt(customer.balance) }}</el-tag>
      <el-tag
        v-for="p in customer.packages"
        :key="p.serviceId"
        type="warning"
        effect="plain"
      >
        {{ p.serviceName }} ×{{ p.remainTimes }}
      </el-tag>
    </div>

    <!-- 消费明细：可选价目表项目，也可直接输入项目名手工扣款，支持多行 -->
    <div class="items-head">
      <span class="items-title">消费明细</span>
      <el-button size="small" type="primary" plain :icon="Plus" @click="addRow">添加一行</el-button>
    </div>
    <el-table :data="rows" border size="small">
      <el-table-column label="服务项目（可直接输入自定义项目）" width="300">
        <template #default="{ row }">
          <el-select
            v-model="row.serviceKey"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="选价目表，或直接输入项目/扣款名称"
            style="width: 100%"
            @change="(v: string) => onPickService(row, v)"
          >
            <el-option
              v-for="s in services"
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
          <!-- 次卡核销模式下逐行提示能否核销；非核销模式下标识自定义扣款 -->
          <div v-if="form.payMethod === 'package' && row.serviceKey" style="margin-top: 4px">
            <el-tag :type="rowPkgState(row).type" size="small" effect="plain">
              {{ rowPkgState(row).text }}
            </el-tag>
          </div>
          <div v-else-if="row.serviceKey && !catalogService(row.serviceKey)" style="margin-top: 4px">
            <el-tag type="warning" size="small" effect="plain">自定义扣款</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="理发师" width="130">
        <template #default="{ row }">
          <el-select v-model="row.stylistId" placeholder="选择" style="width: 100%">
            <el-option
              v-for="s in stylists"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="110">
        <template #default="{ row }">
          <el-input-number v-model="row.price" :min="0" :precision="2" :step="10" :controls="false" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="提成" width="90">
        <template #default="{ row }">
          <el-input-number v-model="row.commission" :min="0" :precision="2" :step="5" :controls="false" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="60" align="center" fixed="right">
        <template #default="{ $index }">
          <el-button link type="danger" @click="rows.splice($index, 1)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="manual-tip">
      提示：直接在项目框输入名称（如「美团团购-洗剪吹」「外卖产品」）即为自定义扣款，金额手工填写；
      价目表项目会自动带出金额与提成，均可修改。
    </div>

    <el-form :model="form" label-width="84px" class="quick-form" style="margin-top: 14px">
      <el-form-item label="结算方式" required>
        <el-radio-group v-model="form.payMethod">
          <el-radio
            v-for="p in payMethods"
            :key="p.key"
            :value="p.key"
            :disabled="
              (p.key === 'package' && (hasManual || !hasAnyPackage)) ||
              (p.key === 'mixed' && (!balancePayEnabled || (Number(customer?.balance) || 0) <= 0))
            "
          >
            {{ p.label }}
          </el-radio>
        </el-radio-group>
        <div v-if="hasManual" class="hint-inline">（含自定义扣款时不能使用次卡核销）</div>
        <div v-else-if="form.payMethod === 'package'" class="hint-inline ok-text">
          本单将核销：{{ pkgSummary || '—' }}
        </div>
      </el-form-item>
      <div v-if="form.payMethod === 'balance'" class="hint">
        当前余额 ¥{{ fmt(customer?.balance) }}，本单合计 ¥{{ fmt(total) }}，结算后
        <span :class="balanceAfter < 0 ? 'danger' : 'ok'">¥{{ fmt(balanceAfter) }}</span>
      </div>
      <template v-if="form.payMethod === 'mixed'">
        <div class="mixed-box">
          <div class="mixed-line">
            本单合计 <b>¥{{ fmt(total) }}</b>，会员当前余额 <b>¥{{ fmt(customer?.balance) }}</b>，
            余额不足部分可用其他方式补足
          </div>
          <div class="mixed-line">
            <span class="mixed-label">余额支付</span>
            <el-input-number
              v-model="mixedBalance"
              :min="0.01"
              :max="mixedMax"
              :precision="2"
              :step="10"
              :controls="false"
              style="width: 140px"
            />
            <span class="muted">扣后余额 ¥{{ fmt(mixedBalanceAfter) }}</span>
          </div>
          <div class="mixed-line">
            <span class="mixed-label">剩余 <b class="price-text">¥{{ fmt(mixedExtra) }}</b> 使用</span>
            <el-select v-model="mixedExtraMethod" placeholder="选择补足方式" style="width: 150px">
              <el-option
                v-for="p in extraPayMethods"
                :key="p.key"
                :label="p.label"
                :value="p.key"
              />
            </el-select>
            <span class="muted">收款补足</span>
          </div>
          <div v-if="mixedExtra <= 0" class="mixed-warn">余额足以支付本单，请直接选择「会员余额」结算</div>
        </div>
      </template>
      <template v-if="form.payMethod === 'package'">
        <div class="hint ok-text">次卡核销无需收款，系统自动扣减对应项目剩余次数。</div>
        <div v-for="(msg, i) in pkgProblems" :key="i" class="hint danger-text">⚠ {{ msg }}</div>
      </template>
      <el-form-item label="合计金额">
        <span class="total-price">¥{{ fmt(total) }}</span>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填，如团购券号" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认开单</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { api } from '@/api'
import type { Customer, ServiceItem, ShopSetting } from '@/types'

interface QuickRow {
  /** 价目表 id；手输名称时为空串 */
  serviceKey: string
  stylistId: string
  price: number
  commission: number
}

const props = defineProps<{
  modelValue: boolean
  customer: Customer | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const saving = ref(false)
const services = ref<ServiceItem[]>([])
const setting = ref<ShopSetting | null>(null)

const rows = ref<QuickRow[]>([])
const form = reactive({
  payMethod: 'wechat',
  remark: ''
})

const stylists = computed(() => setting.value?.stylists.filter((s) => s.status === 'work') || [])
/** 仅展示启用中的结算方式 */
const payMethods = computed(() => (setting.value?.payMethods || []).filter((p) => p.enabled !== false))
/** 会员余额渠道是否启用（停用时混合支付不可选） */
const balancePayEnabled = computed(() => payMethods.value.some((p) => p.key === 'balance'))

const catalogService = (key: string) => services.value.find((s) => s.id === key) || null
const hasManual = computed(() =>
  rows.value.some((r) => r.serviceKey && !catalogService(r.serviceKey))
)
const customer = computed(() => props.customer)
const total = computed(() => rows.value.reduce((s, r) => s + (Number(r.price) || 0), 0))
const balanceAfter = computed(() => (customer.value?.balance || 0) - total.value)

// ---- 混合支付：会员余额承担一部分，剩余金额用一种普通渠道收款补足 ----
const round2 = (n: number) => Math.round(n * 100) / 100
const mixedBalance = ref(0)
const mixedExtraMethod = ref('')
/** 可用于补足的渠道：现金/微信/支付宝/自定义（排除余额、次卡、混合） */
const extraPayMethods = computed(() =>
  payMethods.value.filter((p) => !['balance', 'package', 'mixed'].includes(p.key))
)
/** 余额承担金额上限：不超过会员余额、也不超过本单合计 */
const mixedMax = computed(() => Math.min(Number(customer.value?.balance) || 0, total.value))
const mixedExtra = computed(() => round2(total.value - (Number(mixedBalance.value) || 0)))
const mixedBalanceAfter = computed(() =>
  round2((Number(customer.value?.balance) || 0) - (Number(mixedBalance.value) || 0))
)
watch(
  () => form.payMethod,
  (v) => {
    if (v !== 'mixed') return
    // 默认用全部可用余额承担，差额走补足渠道
    const cap = Math.min(Number(customer.value?.balance) || 0, total.value)
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
  if (form.payMethod !== 'mixed') return
  const cap = Math.min(Number(customer.value?.balance) || 0, t)
  if (mixedBalance.value > cap) mixedBalance.value = cap
})

// ---- 次卡核销相关：会员持有的次卡、本单按项目汇总的需求次数 ----
const packageList = computed(() => customer.value?.packages || [])
const hasAnyPackage = computed(() => packageList.value.some((p) => p.remainTimes > 0))
const remainOf = (serviceId: string) =>
  packageList.value.find((p) => p.serviceId === serviceId)?.remainTimes ?? 0
/** 本单价目表行按项目汇总的数量（多行同一项目时合并校验） */
const needMap = computed(() => {
  const m = new Map<string, number>()
  for (const r of rows.value) {
    if (r.serviceKey && catalogService(r.serviceKey)) {
      m.set(r.serviceKey, (m.get(r.serviceKey) || 0) + 1)
    }
  }
  return m
})
/** 核销模式下每一行的即时状态，用于明细行标签 */
const rowPkgState = (row: QuickRow): { type: 'success' | 'warning' | 'danger'; text: string } => {
  const svc = catalogService(row.serviceKey)
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
      const svc = catalogService(id)
      const remain = remainOf(id)
      return svc ? `${svc.name} ×${n}（扣后剩 ${Math.max(remain - n, 0)} 次）` : ''
    })
    .filter(Boolean)
    .join('、')
)
/** 核销模式下不满足条件的原因（去重），为空表示可以正常核销 */
const pkgProblems = computed(() => {
  if (form.payMethod !== 'package') return [] as string[]
  const msgs: string[] = []
  for (const r of rows.value) {
    const svc = catalogService(r.serviceKey)
    if (!svc) {
      msgs.push(`「${r.serviceKey}」是自定义扣款，不能走次卡核销`)
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

const addRow = () => rows.value.push({ serviceKey: '', stylistId: '', price: 0, commission: 0 })

const onPickService = (row: QuickRow, v: string) => {
  const svc = services.value.find((s) => s.id === v)
  if (svc) {
    row.price = svc.price
    row.commission =
      svc.commissionType === 'none'
        ? 0
        : svc.commissionType === 'fixed'
          ? svc.commissionValue
          : Math.round(svc.price * svc.commissionValue) / 100
  } else if (v) {
    // 自定义项目：金额与提成由人工填写，提成默认 0
    row.commission = 0
  }
}

const onOpen = async () => {
  rows.value = []
  addRow()
  Object.assign(form, { payMethod: 'wechat', remark: '' })
  mixedBalance.value = 0
  mixedExtraMethod.value = ''
  const [settingRes, serviceRes] = await Promise.all([
    api.getSetting(),
    api.listServices({ active: 'true', pageSize: 200 })
  ])
  setting.value = settingRes
  services.value = serviceRes.list
  const enabledPays = settingRes.payMethods.filter((p) => p.enabled !== false)
  if (!enabledPays.some((p) => p.key === form.payMethod)) {
    form.payMethod =
      enabledPays.find((p) => p.key === 'wechat')?.key ||
      enabledPays.find((p) => !['balance', 'package', 'mixed'].includes(p.key))?.key ||
      'cash'
  }
}

const onClosed = () => {
  rows.value = []
}

const submit = async () => {
  if (!customer.value) {
    ElMessage.warning('会员信息缺失')
    return
  }
  if (!rows.value.length) {
    ElMessage.warning('请至少添加一行消费明细')
    return
  }
  for (const [i, r] of rows.value.entries()) {
    if (!r.serviceKey || !String(r.serviceKey).trim()) {
      ElMessage.warning(`第 ${i + 1} 行请选择或输入服务项目`)
      return
    }
    if (!(Number(r.price) > 0)) {
      ElMessage.warning(`第 ${i + 1} 行「${r.serviceKey}」金额必填且需大于 0`)
      return
    }
    if (!r.stylistId) {
      ElMessage.warning(`第 ${i + 1} 行请选择理发师（用于计算提成）`)
      return
    }
  }
  if (form.payMethod === 'balance' && balanceAfter.value < 0) {
    ElMessage.warning('会员余额不足，请改用其他结算方式或先充值')
    return
  }
  if (form.payMethod === 'mixed') {
    const bal = round2(Number(mixedBalance.value))
    const memberBalance = Number(customer.value.balance) || 0
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
  if (form.payMethod === 'package') {
    if (!hasAnyPackage.value) {
      ElMessage.warning('该会员没有可用次卡，请改用其他结算方式')
      return
    }
    if (pkgProblems.value.length) {
      ElMessage.warning(pkgProblems.value[0])
      return
    }
  }

  const items = rows.value.map((r) => {
    const svc = catalogService(r.serviceKey)
    return {
      serviceId: svc?.id,
      name: svc ? undefined : String(r.serviceKey).trim(),
      price: Number(r.price),
      commission: Number(r.commission) || 0,
      stylistId: r.stylistId
    }
  })

  saving.value = true
  try {
    const order = await api.createOrder({
      customerId: customer.value.id,
      items,
      payMethod: form.payMethod,
      payDetail:
        form.payMethod === 'mixed'
          ? {
              balance: round2(Number(mixedBalance.value)),
              [mixedExtraMethod.value]: mixedExtra.value
            }
          : undefined,
      remark: form.remark
    })
    let successMsg = `开单成功：${order.no}`
    if (form.payMethod === 'package') {
      successMsg += '（次卡核销）'
    } else if (form.payMethod === 'mixed') {
      const extraLabel = payMethods.value.find((p) => p.key === mixedExtraMethod.value)?.label || ''
      successMsg += `，余额扣 ¥${fmt(order.payDetail?.balance)}，${extraLabel}收 ¥${fmt(mixedExtra.value)}`
    } else {
      successMsg += `，实收 ¥${fmt(order.total)}`
    }
    ElMessage.success(successMsg)
    emit('update:modelValue', false)
    emit('success')
  } catch (e: any) {
    ElMessage.error(e?.message || '开单失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.member-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  background: #f7f6f3;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 14px;
}

.muted {
  color: #86909c;
  font-size: 13px;
}

.items-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.items-title {
  font-weight: 600;
}

.manual-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #86909c;
  line-height: 1.6;
}

.hint {
  margin: -6px 0 14px 84px;
  font-size: 12px;
  color: #86909c;
}

.hint-inline {
  display: inline-block;
  margin-left: 10px;
  font-size: 12px;
  color: #e6a23c;
}

.hint-inline.ok-text {
  color: #67c23a;
}

.ok-text {
  color: #67c23a;
}

.danger-text {
  color: #f56c6c;
}

.hint .ok {
  color: #67c23a;
  font-weight: 600;
}

.hint .danger {
  color: #f56c6c;
  font-weight: 600;
}

.mixed-box {
  margin: -6px 0 14px 84px;
  padding: 12px 14px;
  background: #f7f6f3;
  border-radius: 8px;
  font-size: 13px;
  color: #4e5969;
}

.mixed-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.mixed-line:last-child {
  margin-bottom: 0;
}

.mixed-label {
  display: inline-block;
  width: 150px;
  color: #4e5969;
}

.mixed-box .price-text {
  color: var(--price);
}

.mixed-warn {
  margin-top: 2px;
  font-size: 12px;
  color: #f56c6c;
}

.total-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--price);
}
</style>
