<template>
  <div class="page-card" v-loading="loading">
    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索姓名 / 手机号"
        clearable
        style="width: 240px"
        :prefix-icon="Search"
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <div class="spacer"></div>
      <el-tag type="info" effect="plain">共 {{ total }} 位会员</el-tag>
      <el-button :icon="Upload" @click="importVisible = true">表格导入</el-button>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增会员</el-button>
    </div>

    <el-table :data="list" border stripe :row-class-name="memberRowClass">
      <el-table-column label="姓名" width="130">
        <template #default="{ row }">
          <span style="font-weight: 600">{{ row.name }}</span>
          <el-tag v-if="row.status === 'refunded'" type="info" size="small" effect="plain" style="margin-left: 6px">
            已退卡
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column label="性别" width="70">
        <template #default="{ row }">{{ row.gender === 'male' ? '男' : '女' }}</template>
      </el-table-column>
      <el-table-column prop="birthday" label="生日" width="110" />
      <el-table-column label="账户余额" width="110">
        <template #default="{ row }">
          <span class="price-text">¥{{ fmt(row.balance) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="剩余次卡" width="220">
        <template #default="{ row }">
          <el-tooltip
            v-for="p in row.packages"
            :key="p.serviceId"
            :content="`添加于 ${p.addedAt || '未知日期'}`"
            placement="top"
            :show-after="200"
          >
            <el-tag
              size="small"
              type="warning"
              effect="plain"
              style="margin: 2px"
            >
              {{ p.serviceName }} ×{{ p.remainTimes }}
            </el-tag>
          </el-tooltip>
          <span v-if="!row.packages?.length" style="color: #c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="visitCount" label="到店" width="70" />
      <el-table-column label="累计消费" width="100">
        <template #default="{ row }">¥{{ fmt(row.totalSpend) }}</template>
      </el-table-column>
      <el-table-column prop="lastVisitDate" label="最近到店" width="105">
        <template #default="{ row }">{{ row.lastVisitDate || '暂无' }}</template>
      </el-table-column>
      <el-table-column label="最近充值" width="105">
        <template #default="{ row }">{{ row.lastRechargeAt || '暂无' }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="开卡时间" width="105">
        <template #default="{ row }">{{ row.createdAt || '—' }}</template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="最近更新" width="105">
        <template #default="{ row }">{{ row.updatedAt || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="300" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-tooltip content="查看该会员的开卡/充值/消费/次卡等变动记录与订单流水" placement="top" :show-after="300">
              <el-button link type="primary" @click="openRecords(row)">记录</el-button>
            </el-tooltip>
            <el-tooltip content="为该会员快速登记一笔消费（团购/加项均可）" placement="top" :show-after="300">
              <el-button link type="success" :disabled="row.status === 'refunded'" @click="openQuick(row)">开单</el-button>
            </el-tooltip>
            <el-tooltip content="会员充值，只加余额并生成充值单" placement="top" :show-after="300">
              <el-button link type="primary" :disabled="row.status === 'refunded'" @click="openRecharge(row)">充值</el-button>
            </el-tooltip>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="warning" :disabled="row.status === 'refunded'" @click="openRefund(row)">退卡</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
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

    <!-- 新增 / 编辑会员 -->
    <el-dialog v-model="editVisible" :title="form.id ? '编辑会员' : '新增会员'" width="640px">
      <el-form :model="form" label-width="92px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="姓名">
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号">
              <el-input v-model="form.phone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别">
              <el-radio-group v-model="form.gender">
                <el-radio value="female">女</el-radio>
                <el-radio value="male">男</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生日">
              <el-date-picker
                v-model="form.birthday"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="账户余额">
              <el-input-number v-model="form.balance" :min="0" :precision="2" :step="50" :disabled="form.status === 'refunded'" />
              <span v-if="form.status === 'refunded'" style="margin-left: 8px; color: #909399; font-size: 12px">已退卡，余额锁定为 0</span>
              <span v-else style="margin-left: 8px; color: #f56c6c; font-size: 12px">可直接调整余额</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">次卡</el-divider>
        <el-table :data="form.packages" size="small" border>
          <el-table-column label="服务项目" width="200">
            <template #default="{ row }">
              <el-select v-model="row.serviceId" placeholder="选择项目" @change="(v: string) => onPickService(row, v)">
                <el-option
                  v-for="s in services"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="总次数" width="110">
            <template #default="{ row }">
              <el-input-number v-model="row.totalTimes" :min="0" size="small" controls-position="right" style="width: 100px" :disabled="form.status === 'refunded'" />
            </template>
          </el-table-column>
          <el-table-column label="剩余次数" width="110">
            <template #default="{ row }">
              <el-input-number v-model="row.remainTimes" :min="0" size="small" controls-position="right" style="width: 100px" :disabled="form.status === 'refunded'" />
            </template>
          </el-table-column>
          <el-table-column label="添加时间" width="120">
            <template #default="{ row }">
              <span :class="{ 'muted-text': !row.addedAt }">{{ row.addedAt || '未知' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70">
            <template #default="{ $index }">
              <el-button link type="danger" :disabled="form.status === 'refunded'" @click="form.packages.splice($index, 1)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button v-if="form.status !== 'refunded'" style="margin-top: 10px" :icon="Plus" @click="addPackage">添加次卡</el-button>
        <div v-else style="margin-top: 10px; color: #909399; font-size: 12px">已退卡会员的次卡已作废，不可编辑</div>

        <el-divider content-position="left">档案备注</el-divider>
        <el-form-item label="发质">
          <el-input v-model="form.note.hairType" />
        </el-form-item>
        <el-form-item label="染发配方">
          <el-input v-model="form.note.formula" />
        </el-form-item>
        <el-form-item label="过敏史">
          <el-input v-model="form.note.allergy" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 快捷充值（纯充值，不选服务项目；生成充值单） -->
    <el-dialog v-model="rechargeVisible" title="会员余额充值" width="420px">
      <el-form label-width="80px">
        <el-form-item label="会员">
          <span>{{ rechargeTarget?.name }}（当前余额 ¥{{ fmt(rechargeTarget?.balance) }}）</span>
        </el-form-item>
        <el-form-item label="充值金额">
          <el-input-number v-model="rechargeAmount" :min="0" :precision="2" :step="100" />
        </el-form-item>
        <el-form-item label="赠送金额">
          <el-input-number v-model="rechargeGift" :min="0" :precision="2" :step="10" />
        </el-form-item>
        <el-form-item label="收款方式">
          <el-radio-group v-model="rechargePay">
            <el-radio v-for="p in rechargePayMethods" :key="p.key" :value="p.key">{{ p.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <div class="recharge-tip">充值 ¥{{ fmt(rechargeAmount) }} + 赠送 ¥{{ fmt(rechargeGift) }}，余额将变为 ¥{{ fmt(newBalance) }}</div>
      <template #footer>
        <el-button @click="rechargeVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitRecharge">确认充值</el-button>
      </template>
    </el-dialog>

    <!-- 会员记录：变动记录（时间轴）+ 消费记录（订单流水表格） -->
    <el-dialog
      v-model="recordsVisible"
      :title="`会员记录 · ${recordsTarget?.name || ''}`"
      width="820px"
    >
      <div v-if="recordsTarget" class="records-head">
        <el-tag type="info" effect="plain">手机 {{ recordsTarget.phone || '无' }}</el-tag>
        <el-tag
          :type="recordsTarget.status === 'refunded' ? 'danger' : 'success'"
          effect="plain"
        >
          {{ recordsTarget.status === 'refunded' ? '已退卡' : `账户余额 ¥${fmt(recordsTarget.balance)}` }}
        </el-tag>
        <el-tag type="warning" effect="plain">累计消费 ¥{{ fmt(recordsTarget.totalSpend) }}</el-tag>
      </div>
      <div v-if="recordsTarget" class="records-meta">
        <span class="meta-item">开卡时间<b>{{ recordsTarget.createdAt || '—' }}</b></span>
        <span class="meta-item">最近充值<b>{{ recordsTarget.lastRechargeAt || '暂无' }}</b></span>
        <span class="meta-item">最近更新<b>{{ recordsTarget.updatedAt || '—' }}</b></span>
      </div>

      <el-tabs v-model="recordsTab" class="records-tabs">
        <el-tab-pane name="timeline">
          <template #label>
            <span>变动记录<el-badge v-if="historyLogs.length" :value="historyLogs.length" :max="999" class="tab-badge" /></span>
          </template>
          <div class="history-box" v-loading="historyLoading">
            <el-empty
              v-if="!historyLoading && !historyLogs.length"
              description="暂无变动记录"
              :image-size="64"
            />
            <el-timeline v-else>
              <el-timeline-item
                v-for="log in historyLogs"
                :key="log.id"
                :type="logDot(log.type)"
                :timestamp="dayjs(log.createdAt).format('YYYY-MM-DD HH:mm')"
                placement="top"
              >
                <el-tag size="small" :type="logTag(log.type)" effect="plain" style="margin-right: 6px">
                  {{ logTypeLabel(log.type) }}
                </el-tag>
                <span class="log-msg">{{ log.message }}</span>
              </el-timeline-item>
            </el-timeline>
          </div>
        </el-tab-pane>

        <el-tab-pane name="orders" label="消费记录">
      <el-table :data="recordsList" border size="small" v-loading="recordsLoading" style="margin-top: 4px">
        <el-table-column label="时间" width="140">
          <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}</template>
        </el-table-column>
        <el-table-column label="单号" width="135">
          <template #default="{ row }"><span class="mono">{{ row.no }}</span></template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="orderTagType(row.type)" size="small" effect="plain">
              {{ orderTypeLabel(row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="内容 / 项目" width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.type === 'consume'">{{ itemsText(row) }}</span>
            <span v-else-if="row.type === 'recharge'" class="muted-text">
              会员充值<template v-if="row.gift">（含赠送 ¥{{ fmt(row.gift) }}）</template>
            </span>
            <span v-else class="muted-text">{{ row.remark || '退卡退款' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="支付方式" width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="row.type === 'consume' && row.payMethod === 'package'">
              次卡核销
            </template>
            <template v-else-if="row.type === 'consume' && row.payMethod === 'mixed'">
              混合支付<template v-if="row.payDetail">（{{ mixedText(row.payDetail) }}）</template>
            </template>
            <template v-else>{{ payLabel(row.payMethod) || '—' }}</template>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.type === 'consume' && row.payMethod === 'package'" class="muted-text">核销</span>
            <span v-else-if="row.type === 'refund'" class="refund-text">-¥{{ fmt(row.total) }}</span>
            <span v-else class="price-text">¥{{ fmt(row.total) }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination-bar" v-if="recordsTotal > recordsPageSize">
        <el-pagination
          v-model:current-page="recordsPage"
          :page-size="recordsPageSize"
          :total="recordsTotal"
          background
          layout="total, prev, pager, next"
          @current-change="loadRecords"
        />
      </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="recordsVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 退卡：退款 + 次卡作废 + 销卡 -->
    <el-dialog v-model="refundVisible" title="会员退卡" width="480px">
      <el-alert
        title="退卡后：余额清零、剩余次卡全部作废、档案标记为「已退卡」并保留流水，操作不可撤销"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 14px"
      />
      <el-form label-width="92px" v-if="refundTarget">
        <el-form-item label="会员">
          <span style="font-weight: 600">{{ refundTarget.name }}</span>
          <span class="muted-text" style="margin-left: 8px">{{ refundTarget.phone || '无手机号' }}</span>
        </el-form-item>
        <el-form-item label="账户余额">
          <span class="price-text" style="font-size: 16px; font-weight: 700">¥{{ fmt(refundTarget.balance) }}</span>
        </el-form-item>
        <el-form-item v-if="refundAlivePackages.length" label="剩余次卡">
          <div>
            <el-tag
              v-for="p in refundAlivePackages"
              :key="p.serviceId"
              type="warning"
              effect="plain"
              style="margin: 2px"
            >
              {{ p.serviceName }} ×{{ p.remainTimes }}
            </el-tag>
            <div class="muted-text" style="margin-top: 4px">以上次卡退卡后立即作废，不折现</div>
          </div>
        </el-form-item>
        <el-form-item label="实退金额">
          <el-input-number
            v-model="refundAmount"
            :min="0"
            :max="Number(refundTarget.balance) || 0"
            :precision="2"
            :step="50"
          />
          <span class="muted-text" style="margin-left: 8px">
            默认退全额，扣除赠送/手续费可手动改小
          </span>
        </el-form-item>
        <el-form-item v-if="refundAmount > 0" label="退款方式">
          <el-radio-group v-model="refundPay">
            <el-radio v-for="p in rechargePayMethods" :key="p.key" :value="p.key">{{ p.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-else label=" ">
          <span class="muted-text">实退金额为 0，仅作销卡处理，无需选择退款方式</span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="refundRemark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
        <div v-if="refundWaived > 0" class="waived-tip">
          不退金额 ¥{{ fmt(refundWaived) }} 将随销卡冲销（通常为赠送金额或手续费）
        </div>
      </el-form>
      <template #footer>
        <el-button @click="refundVisible = false">取消</el-button>
        <el-button type="danger" :loading="saving" @click="submitRefund">确认退款并销卡</el-button>
      </template>
    </el-dialog>

    <!-- 公共：会员快速开单 -->
    <QuickOrderDialog v-model="quickVisible" :customer="quickTarget" @success="load" />

    <!-- Excel 批量导入会员 -->
    <MemberImportDialog v-model="importVisible" @success="load" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Upload } from '@element-plus/icons-vue'
import { api } from '@/api'
import { ORDER_TYPE_LABEL, PAGE_SIZE_OPTIONS, SYSTEM_PAY_KEYS } from '@/config/constants'
import QuickOrderDialog from '@/components/QuickOrderDialog.vue'
import MemberImportDialog from '@/components/MemberImportDialog.vue'
import type { Customer, CustomerLog, Order, OrderType, PackageInfo, ServiceItem, ShopSetting } from '@/types'

const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const list = ref<Customer[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const services = ref<ServiceItem[]>([])
const setting = ref<ShopSetting | null>(null)

/** 充值/退款收款方式：除系统渠道外、且当前启用中的渠道（含自定义团购渠道） */
const rechargePayMethods = computed(
  () =>
    setting.value?.payMethods.filter((p) => !SYSTEM_PAY_KEYS.includes(p.key) && p.enabled !== false) || []
)

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

const memberRowClass = ({ row }: { row: Customer }) =>
  row.status === 'refunded' ? 'refunded-row' : ''

/** 支付方式名称（含自定义渠道） */
const payLabel = (key?: string) =>
  setting.value?.payMethods.find((p) => p.key === key)?.label || key || ''

const orderTypeLabel = (t: OrderType) => ORDER_TYPE_LABEL[t] || t
const orderTagType = (t: OrderType): 'success' | 'warning' | 'danger' =>
  t === 'recharge' ? 'warning' : t === 'refund' ? 'danger' : 'success'

/** 混合支付分摊明细文案 */
const mixedText = (detail: Record<string, number>) =>
  Object.entries(detail)
    .map(([k, v]) => `${k === 'balance' ? '余额' : payLabel(k)} ¥${fmt(v)}`)
    .join(' + ')

/** 订单服务项目单行文案：项目（理发师）、项目（理发师） */
const itemsText = (order: Order) =>
  order.items.map((it) => `${it.name}（${it.stylistName}）`).join('、')

// ---- 会员记录（变动记录时间轴 + 消费记录表格） ----
const recordsVisible = ref(false)
const recordsTab = ref<'timeline' | 'orders'>('timeline')
const recordsTarget = ref<Customer | null>(null)
const recordsList = ref<Order[]>([])
const recordsTotal = ref(0)
const recordsPage = ref(1)
const recordsPageSize = 8
const recordsLoading = ref(false)

const loadRecords = async () => {
  if (!recordsTarget.value) return
  recordsLoading.value = true
  try {
    const res = await api.listOrders({
      customerId: recordsTarget.value.id,
      page: recordsPage.value,
      pageSize: recordsPageSize
    })
    recordsList.value = res.list
    recordsTotal.value = res.total
  } finally {
    recordsLoading.value = false
  }
}

const openRecords = (row: Customer) => {
  recordsTarget.value = row
  recordsPage.value = 1
  recordsTab.value = 'timeline'
  recordsVisible.value = true
  loadRecords()
  historyLogs.value = []
  loadHistory(row.id)
}

// ---- 退卡 ----
const refundVisible = ref(false)
const refundTarget = ref<Customer | null>(null)
const refundAmount = ref(0)
const refundPay = ref('')
const refundRemark = ref('')

/** 仍有剩余次数、退卡后将作废的次卡 */
const refundAlivePackages = computed(() =>
  refundTarget.value?.packages.filter((p) => p.remainTimes > 0) || []
)
/** 未退、随销卡冲销的金额（如赠送部分） */
const refundWaived = computed(() =>
  Math.round(((Number(refundTarget.value?.balance) || 0) - refundAmount.value) * 100) / 100
)

const openRefund = (row: Customer) => {
  refundTarget.value = row
  refundAmount.value = Math.round((Number(row.balance) || 0) * 100) / 100
  refundRemark.value = ''
  refundPay.value =
    rechargePayMethods.value.find((p) => p.key === 'cash')?.key ||
    rechargePayMethods.value.find((p) => p.key === 'wechat')?.key ||
    rechargePayMethods.value[0]?.key ||
    ''
  refundVisible.value = true
}

const submitRefund = async () => {
  if (!refundTarget.value) return
  const balance = Number(refundTarget.value.balance) || 0
  if (refundAmount.value < 0 || refundAmount.value > balance) {
    ElMessage.warning(`实退金额需在 0 ~ ¥${fmt(balance)} 之间`)
    return
  }
  if (refundAmount.value > 0 && !refundPay.value) {
    ElMessage.warning('请选择退款方式')
    return
  }
  const payName = rechargePayMethods.value.find((p) => p.key === refundPay.value)?.label || ''
  try {
    await ElMessageBox.confirm(
      `确认为「${refundTarget.value.name}」退卡？将退还 ¥${fmt(refundAmount.value)}` +
        (refundAmount.value > 0 ? `（${payName}）` : '') +
        `，余额清零${refundAlivePackages.value.length ? '、剩余次卡全部作废' : ''}，此操作不可撤销。`,
      '退卡二次确认',
      { type: 'warning', confirmButtonText: '确认退卡', cancelButtonText: '再想想' }
    )
  } catch {
    return // 用户取消
  }
  saving.value = true
  try {
    await api.refundCustomer(refundTarget.value.id, {
      amount: refundAmount.value,
      payMethod: refundAmount.value > 0 ? refundPay.value : undefined,
      remark: refundRemark.value.trim()
    })
    ElMessage.success('退卡完成：余额已退还并销卡，已生成退款单')
    refundVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e?.message || '退卡失败')
  } finally {
    saving.value = false
  }
}

const search = () => {
  page.value = 1
  load()
}

const onSizeChange = () => {
  page.value = 1
  load()
}

const load = async () => {
  loading.value = true
  try {
    const res = await api.listCustomers({ keyword: keyword.value, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

// ---- 编辑 ----
const editVisible = ref(false)
const emptyNote = () => ({ hairType: '', formula: '', allergy: '', preferStylist: '' })
const form = reactive<Customer>({
  id: '',
  name: '',
  phone: '',
  gender: 'female',
  birthday: '',
  balance: 0,
  packages: [],
  note: emptyNote(),
  lastVisitDate: '',
  visitCount: 0,
  totalSpend: 0,
  createdAt: '',
  updatedAt: '',
  lastRechargeAt: '',
  status: 'active'
})

// ---- 会员变动记录 ----
const historyLogs = ref<CustomerLog[]>([])
const historyLoading = ref(false)

const LOG_TYPE_LABEL: Record<CustomerLog['type'], string> = {
  create: '开卡',
  edit: '档案',
  recharge: '充值',
  consume: '消费',
  package: '次卡',
  refund: '退卡'
}
const logTypeLabel = (t: CustomerLog['type']) => LOG_TYPE_LABEL[t] || t
/** 时间轴圆点颜色 */
const logDot = (t: CustomerLog['type']): 'primary' | 'success' | 'warning' | 'danger' | 'info' =>
  t === 'create' ? 'primary'
    : t === 'recharge' ? 'success'
      : t === 'consume' ? 'primary'
        : t === 'package' ? 'warning'
          : t === 'refund' ? 'danger'
            : 'info'
/** 标签颜色 */
const logTag = (t: CustomerLog['type']): 'success' | 'primary' | 'warning' | 'danger' | 'info' =>
  t === 'edit' ? 'info' : logDot(t)

const loadHistory = async (customerId: string) => {
  historyLoading.value = true
  try {
    historyLogs.value = await api.customerHistory(customerId)
  } catch (e: any) {
    historyLogs.value = []
    ElMessage.error(e?.message || '变动记录加载失败')
  } finally {
    historyLoading.value = false
  }
}

const openCreate = () => {
  Object.assign(form, {
    id: '',
    name: '',
    phone: '',
    gender: 'female',
    birthday: '',
    balance: 0,
    packages: [],
    note: emptyNote(),
    updatedAt: '',
    lastRechargeAt: '',
    status: 'active'
  })
  editVisible.value = true
}

const openEdit = (row: Customer) => {
  Object.assign(form, { packages: [], note: emptyNote() }, JSON.parse(JSON.stringify(row)))
  editVisible.value = true
}

const addPackage = () => {
  // 新增次卡默认添加时间为今天（保存时后端也会兜底补齐）
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  form.packages.push({ serviceId: '', serviceName: '', totalTimes: 10, remainTimes: 10, addedAt: today })
}

const onPickService = (row: PackageInfo, serviceId: string) => {
  const svc = services.value.find((s) => s.id === serviceId)
  if (svc) row.serviceName = svc.name
}

const submitEdit = async () => {
  if (!form.name) {
    ElMessage.warning('请填写姓名')
    return
  }
  const payload = JSON.parse(JSON.stringify(form))
  payload.packages = (payload.packages || []).filter((p: PackageInfo) => p.serviceId)
  saving.value = true
  try {
    await api.saveCustomer(payload)
    ElMessage.success('已保存')
    editVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const remove = async (row: Customer) => {
  await ElMessageBox.confirm(`确定删除会员「${row.name}」吗？此操作不可恢复。`, '危险操作', {
    type: 'warning'
  })
  await api.deleteCustomer(row.id)
  ElMessage.success('已删除')
  load()
}

// ---- 充值 ----
const rechargeVisible = ref(false)
const rechargeTarget = ref<Customer | null>(null)
const rechargeAmount = ref(500)
const rechargeGift = ref(0)
const rechargePay = ref<string>('wechat')

const newBalance = computed(() =>
  Number(rechargeTarget.value?.balance || 0) + rechargeAmount.value + rechargeGift.value
)

const openRecharge = (row: Customer) => {
  rechargeTarget.value = row
  rechargeAmount.value = 500
  rechargeGift.value = 0
  rechargePay.value = rechargePayMethods.value.find((p) => p.key === 'wechat')?.key
    || rechargePayMethods.value[0]?.key || ''
  rechargeVisible.value = true
}

const submitRecharge = async () => {
  if (!rechargeTarget.value || rechargeAmount.value <= 0) {
    ElMessage.warning('请输入充值金额')
    return
  }
  saving.value = true
  try {
    const res = await api.recharge({
      customerId: rechargeTarget.value.id,
      amount: rechargeAmount.value,
      gift: rechargeGift.value,
      payMethod: rechargePay.value
    })
    ElMessage.success(`充值成功，已生成充值单，余额 ¥${fmt(res.balance)}`)
    rechargeVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e?.message || '充值失败')
  } finally {
    saving.value = false
  }
}

// ---- 快速开单（公共组件） ----
const quickVisible = ref(false)
const quickTarget = ref<Customer | null>(null)

// ---- Excel 批量导入 ----
const importVisible = ref(false)

const openQuick = (row: Customer) => {
  quickTarget.value = row
  quickVisible.value = true
}

onMounted(async () => {
  const [svcRes, settingRes] = await Promise.all([
    api.listServices({ pageSize: 200 }),
    api.getSetting()
  ])
  services.value = svcRes.list
  setting.value = settingRes
  load()
})
</script>

<style scoped>
.records-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  margin-top: 10px;
  padding: 8px 12px;
  background: #f7f6f3;
  border-radius: 8px;
  font-size: 13px;
  color: #86909c;
}

.records-meta b {
  margin-left: 6px;
  color: #1d2129;
  font-weight: 600;
}

.records-tabs {
  margin-top: 6px;
}

.tab-badge {
  margin-left: 6px;
  margin-top: -2px;
}

.history-box {
  max-height: 420px;
  overflow-y: auto;
  padding: 4px 8px 4px 4px;
}

.log-msg {
  font-size: 13px;
  color: #4e5969;
  line-height: 1.6;
  word-break: break-all;
}

.recharge-tip {
  color: #86909c;
  font-size: 13px;
  padding: 10px 12px;
  background: #f7f6f3;
  border-radius: 8px;
}

.records-head {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.record-item {
  line-height: 1.7;
}

.muted-text {
  color: #86909c;
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  color: #4e5969;
}

.refund-text {
  color: #f56c6c;
  font-weight: 600;
}

.waived-tip {
  margin: 4px 0 0 92px;
  font-size: 12px;
  color: #e6a23c;
}

:deep(.el-table .refunded-row) {
  color: #a8abb2;
}

:deep(.el-table .refunded-row .price-text) {
  color: #a8abb2;
}
</style>
