<template>
  <div class="page-card" v-loading="loading">
    <div class="toolbar">
      <el-date-picker
        v-model="range"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        :shortcuts="shortcuts"
        @change="search"
      />
      <el-radio-group v-model="typeFilter" @change="search">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="consume">消费单</el-radio-button>
        <el-radio-button value="recharge">充值单</el-radio-button>
        <el-radio-button value="refund">退款单</el-radio-button>
      </el-radio-group>
      <el-radio-group v-model="memberFilter" @change="search">
        <el-radio-button value="">全部顾客</el-radio-button>
        <el-radio-button value="yes">会员</el-radio-button>
        <el-radio-button value="no">散客</el-radio-button>
      </el-radio-group>
      <el-select v-model="payFilter" placeholder="全部支付方式" clearable style="width: 140px" @change="search">
        <el-option v-for="p in setting?.payMethods || []" :key="p.key" :label="p.label" :value="p.key" />
      </el-select>
      <el-input
        v-model="keyword"
        placeholder="单号 / 顾客 / 手机号"
        clearable
        style="width: 200px"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <div class="spacer"></div>
      <el-tag type="info" effect="plain">
        {{ total }} 笔 · 消费实收合计
        <span class="price-text" style="margin-left: 4px">¥{{ totalText }}</span>
      </el-tag>
    </div>

    <el-table :data="list" border stripe>
      <el-table-column prop="no" label="单号" width="150" />
      <el-table-column label="类型" width="90">
        <template #default="{ row }">
          <el-tag :type="orderTagType(row.type)" effect="plain" size="small">
            {{ orderTypeLabel(row.type) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="140">
        <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}</template>
      </el-table-column>
      <el-table-column label="顾客" width="150">
        <template #default="{ row }">
          <span style="font-weight: 600">{{ row.customerName }}</span>
          <el-tag size="small" :type="row.customerId ? 'success' : 'info'" effect="plain" style="margin-left: 4px">
            {{ row.customerId ? '会员' : '散客' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="服务项目（理发师）" width="260" show-overflow-tooltip>
        <template #default="{ row }">
          <template v-if="row.type === 'recharge'">
            <span style="color: #86909c">会员充值
              <template v-if="row.gift">（含赠送 ¥{{ fmt(row.gift) }}）</template>
            </span>
          </template>
          <template v-else-if="row.type === 'refund'">
            <span class="refund-tag">退卡退款</span><span v-if="row.remark" style="color: #86909c">：{{ row.remark }}</span>
          </template>
          <template v-else>
            <span v-for="(it, i) in row.items" :key="i" class="item-line">
              {{ it.name }}
              <span class="item-stylist">（{{ it.stylistName }}）</span>
              <span v-if="it.serviceId === ''" class="manual-tag">手工</span>{{ i < row.items.length - 1 ? '、' : '' }}
            </span>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="支付方式" width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ payLabel(row.payMethod) }}</span>
          <span v-if="row.payMethod === 'mixed' && row.payDetail" class="mixed-detail">
            （{{ mixedText(row.payDetail) }}）
          </span>
        </template>
      </el-table-column>
      <el-table-column label="实收金额" width="100" align="right">
        <template #default="{ row }">
          <span v-if="row.type === 'refund'" class="refund-amount">-¥{{ fmt(row.total) }}</span>
          <span v-else-if="row.payMethod === 'package'" class="pkg-tag">次卡核销</span>
          <span v-else class="price-text">¥{{ fmt(row.total) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-tooltip
              v-if="row.customerId"
              content="为该会员再快速登记一笔消费"
              placement="top"
              :show-after="300"
            >
              <el-button link type="success" @click="openQuick(row)">再开单</el-button>
            </el-tooltip>
            <span v-else style="color: #c0c4cc; font-size: 12px">—</span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="PAGE_SIZE_OPTIONS"
        :total="total"
        background
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="load"
        @size-change="onSizeChange"
      />
    </div>

    <QuickOrderDialog v-model="quickVisible" :customer="quickTarget" @success="load" />
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { ORDER_TYPE_LABEL, PAY_LABEL, PAGE_SIZE_OPTIONS } from '@/config/constants'
import QuickOrderDialog from '@/components/QuickOrderDialog.vue'
import type { Customer, Order, OrderType, ShopSetting } from '@/types'

const loading = ref(false)
const range = ref<[string, string]>([
  dayjs().startOf('month').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD')
])
const typeFilter = ref<OrderType | ''>('')
const memberFilter = ref<'' | 'yes' | 'no'>('')
const payFilter = ref<string>('')
const keyword = ref('')
const list = ref<Order[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const setting = ref<ShopSetting | null>(null)
const customers = ref<Customer[]>([])

const shortcuts = [
  { text: '今天', value: () => [dayjs().toDate(), dayjs().toDate()] },
  { text: '本月', value: () => [dayjs().startOf('month').toDate(), dayjs().toDate()] },
  { text: '最近 90 天', value: () => [dayjs().subtract(90, 'day').toDate(), dayjs().toDate()] }
]

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

const totalText = ref('0')

/** 支付方式名称：以店铺设置（含自定义渠道）为准 */
const payLabel = (key: string) =>
  setting.value?.payMethods.find((p) => p.key === key)?.label || PAY_LABEL[key] || key

/** 单据类型文案与标签色 */
const orderTypeLabel = (t: OrderType) => ORDER_TYPE_LABEL[t] || t
const orderTagType = (t: OrderType): 'success' | 'warning' | 'danger' =>
  t === 'recharge' ? 'warning' : t === 'refund' ? 'danger' : 'success'

/** 混合支付分摊明细文案，如「余额 ¥30 + 微信 ¥70」 */
const mixedText = (detail: Record<string, number>) =>
  Object.entries(detail)
    .map(([k, v]) => `${k === 'balance' ? '余额' : payLabel(k)} ¥${fmt(v)}`)
    .join(' + ')

const search = () => {
  page.value = 1
  load()
}

const onSizeChange = () => {
  page.value = 1
  load()
}

const load = async () => {
  if (!range.value) return
  loading.value = true
  try {
    const paged = await api.listOrders({
      from: range.value[0],
      to: range.value[1],
      type: typeFilter.value,
      member: memberFilter.value,
      payMethod: payFilter.value,
      keyword: keyword.value.trim(),
      page: page.value,
      pageSize: pageSize.value
    })
    list.value = paged.list
    total.value = paged.total
    totalText.value = fmt(paged.sumTotal)
  } finally {
    loading.value = false
  }
}

// ---- 会员快速再开单 ----
const quickVisible = ref(false)
const quickTarget = ref<Customer | null>(null)

const openQuick = (row: Order) => {
  const c = customers.value.find((x) => x.id === row.customerId)
  if (!c) return
  if (c.status === 'refunded') {
    ElMessage.warning('该会员已退卡，不能继续开单')
    return
  }
  quickTarget.value = c
  quickVisible.value = true
}

onMounted(async () => {
  const [settingRes, customerRes] = await Promise.all([
    api.getSetting(),
    api.listCustomers({ pageSize: 200 })
  ])
  setting.value = settingRes
  customers.value = customerRes.list
  load()
})
</script>

<style scoped>
.item-line {
  line-height: 1.8;
}

.item-stylist {
  color: #86909c;
  font-size: 12px;
}

.manual-tag {
  margin-left: 6px;
  font-size: 11px;
  color: #c99a5b;
  border: 1px solid #e0bd8a;
  border-radius: 4px;
  padding: 0 4px;
}

.pkg-tag {
  color: #c99a5b;
  font-weight: 600;
  font-size: 12px;
}

.refund-tag {
  color: #f56c6c;
  font-weight: 600;
  font-size: 12px;
}

.refund-amount {
  color: #f56c6c;
  font-weight: 600;
}

.mixed-detail {
  margin-top: 2px;
  font-size: 12px;
  color: #86909c;
  line-height: 1.5;
}
</style>
