<template>
  <div v-loading="loading">
    <div class="page-card">
      <div class="page-title">店铺基础信息</div>
      <el-form :model="form" label-width="110px" style="max-width: 720px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="店铺名称">
              <el-input v-model="form.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话">
              <el-input v-model="form.phone" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="店铺地址">
              <el-input v-model="form.address" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="营业开始">
              <el-time-picker
                v-model="form.openTime"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="营业结束">
              <el-time-picker
                v-model="form.closeTime"
                format="HH:mm"
                value-format="HH:mm"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="预约间隔（分）">
              <el-input-number v-model="form.slotInterval" :min="15" :step="15" :max="120" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <div class="page-card">
      <div class="pay-head">
        <div>
          <div class="page-title" style="margin: 0">结算方式</div>
          <div class="pay-desc">
            管理开单和充值的收款渠道，可新增美团团购、抖音团购等自定义渠道；
            带系统扣款逻辑的渠道不可删除；停用后开单、充值、退款时将不能选择该方式，历史单据不受影响。
          </div>
        </div>
        <el-button type="primary" plain :icon="Plus" @click="addPayMethod">新增渠道</el-button>
      </div>
      <div class="pay-list">
        <div v-for="p in form.payMethods" :key="p.key" class="pay-row" :class="{ 'pay-off': !isEnabled(p) }">
          <el-input
            v-model="p.label"
            :disabled="isSystemKey(p.key)"
            :placeholder="isSystemKey(p.key) ? '' : '渠道名称，如：美团团购'"
            style="width: 240px"
          />
          <el-tag v-if="isSystemKey(p.key)" type="warning" effect="plain" size="small">系统内置</el-tag>
          <el-tag v-else-if="isBuiltinKey(p.key)" type="info" effect="plain" size="small">内置</el-tag>
          <el-tag v-else effect="plain" size="small">自定义</el-tag>
          <el-tag v-if="!isEnabled(p)" type="danger" effect="plain" size="small">已停用</el-tag>
          <el-switch
            :model-value="isEnabled(p)"
            active-text="启用"
            inactive-text="停用"
            inline-prompt
            @change="(v: boolean) => (p.enabled = v)"
          />
          <el-button
            v-if="!isBuiltinKey(p.key) && !isSystemKey(p.key)"
            link
            type="danger"
            @click="removePayMethod(p.key)"
          >
            删除
          </el-button>
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="pay-head">
        <div>
          <div class="page-title" style="margin: 0">数据封存</div>
          <div class="pay-desc">
            先选年份，再选整年 / 上半年 / 下半年 / 某个季度，把该周期的营业数据冻结成一份只读快照（封存时全库数据的完整副本），
            以后随时可查看、可下载到 U盘或移动硬盘保管。封存不会删除、不影响当前正在使用的数据。
          </div>
        </div>
      </div>

      <div class="archive-create">
        <span class="archive-field-label">封存年份</span>
        <el-date-picker
          v-model="archiveForm.year"
          type="year"
          value-format="YYYY"
          :clearable="false"
          style="width: 110px"
        />
        <span class="archive-field-label">封存周期</span>
        <el-radio-group v-model="archiveForm.periodType">
          <el-radio-button label="year">整年</el-radio-button>
          <el-radio-button label="half">半年</el-radio-button>
          <el-radio-button label="quarter">季度</el-radio-button>
        </el-radio-group>
        <el-select
          v-if="archiveForm.periodType === 'half'"
          v-model="archiveForm.half"
          style="width: 100px"
        >
          <el-option :value="1" label="上半年（1-6月）" />
          <el-option :value="2" label="下半年（7-12月）" />
        </el-select>
        <el-select
          v-else-if="archiveForm.periodType === 'quarter'"
          v-model="archiveForm.quarter"
          style="width: 130px"
        >
          <el-option :value="1" label="第一季度" />
          <el-option :value="2" label="第二季度" />
          <el-option :value="3" label="第三季度" />
          <el-option :value="4" label="第四季度" />
        </el-select>
        <span class="archive-preview">
          将封存：<b>{{ periodPreview.label }}</b>（{{ periodPreview.startDate }} ~ {{ periodPreview.endDate }}）
        </span>
        <el-button type="primary" :loading="creating" @click="createArchive">立即封存</el-button>
      </div>

      <el-table :data="archives" size="small" border style="margin-top: 14px">
        <el-table-column prop="label" label="封存周期" width="170" />
        <el-table-column label="时间范围" width="220">
          <template #default="{ row }">{{ row.startDate }} ~ {{ row.endDate }}</template>
        </el-table-column>
        <el-table-column label="封存时间" width="170">
          <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}</template>
        </el-table-column>
        <el-table-column label="文件大小" width="100">
          <template #default="{ row }">{{ fmtSize(row.dbSize) }}</template>
        </el-table-column>
        <el-table-column prop="note" label="备注" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.note || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link type="primary" @click="openViewer(row)">查看</el-button>
              <el-button link type="success" @click="download(row)">下载副本</el-button>
              <el-button link type="danger" @click="removeArchive(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!archives.length" description="还没有封存记录，季度/年度结束后建议封存一次" :image-size="70" />
    </div>

    <div class="save-bar">
      <el-button @click="load">重置</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
    </div>

    <!-- 封存数据查看弹窗（只读） -->
    <el-dialog v-model="viewerVisible" :title="`封存数据 · ${viewer?.label || ''}`" width="880px">
      <template v-if="viewer">
        <div class="arc-range">封存周期：{{ viewer.startDate }} ~ {{ viewer.endDate }}（封存于 {{ dayjs(viewer.createdAt).format('YYYY-MM-DD HH:mm') }}，只读快照）</div>
        <div class="arc-cards" v-loading="summaryLoading">
          <div class="arc-card">
            <div class="arc-num price-text">¥{{ fmt(summary?.revenue ?? 0) }}</div>
            <div class="arc-label">营业额（{{ summary?.consumeCount ?? 0 }} 笔消费）</div>
          </div>
          <div class="arc-card">
            <div class="arc-num">¥{{ fmt(summary?.rechargeTotal ?? 0) }}</div>
            <div class="arc-label">会员充值（{{ summary?.rechargeCount ?? 0 }} 笔，赠送 ¥{{ fmt(summary?.rechargeGift ?? 0) }}）</div>
          </div>
          <div class="arc-card">
            <div class="arc-num refund-num">-¥{{ fmt(summary?.refundTotal ?? 0) }}</div>
            <div class="arc-label">退卡退款（{{ summary?.refundCount ?? 0 }} 笔）</div>
          </div>
          <div class="arc-card">
            <div class="arc-num">{{ summary?.orderCount ?? 0 }}</div>
            <div class="arc-label">周期内单据总数</div>
          </div>
        </div>

        <div class="arc-toolbar">
          <el-input
            v-model="viewerKeyword"
            placeholder="单号 / 顾客 / 手机号"
            clearable
            size="small"
            style="width: 220px"
            @keyup.enter="reloadViewerOrders(1)"
            @clear="reloadViewerOrders(1)"
          />
          <el-button size="small" type="primary" plain @click="reloadViewerOrders(1)">查询</el-button>
        </div>
        <el-table :data="viewerOrders" size="small" border v-loading="ordersLoading">
          <el-table-column label="时间" width="140">
            <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}</template>
          </el-table-column>
          <el-table-column prop="no" label="单号" width="150" />
          <el-table-column label="类型" width="80">
            <template #default="{ row }">
              <el-tag :type="orderTagType(row.type)" size="small" effect="plain">
                {{ orderTypeLabel(row.type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="customerName" label="顾客" width="110" show-overflow-tooltip>
            <template #default="{ row }">{{ row.customerName || '—' }}</template>
          </el-table-column>
          <el-table-column label="服务项目" width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ orderItemsText(row) }}</template>
          </el-table-column>
          <el-table-column label="支付方式" width="130" show-overflow-tooltip>
            <template #default="{ row }">{{ payText(row) }}</template>
          </el-table-column>
          <el-table-column label="金额" width="100" align="right">
            <template #default="{ row }">
              <span v-if="row.type === 'refund'" class="refund-num">-¥{{ fmt(row.total) }}</span>
              <span v-else-if="row.payMethod === 'package'" style="color: #86909c">次卡核销</span>
              <span v-else class="price-text">¥{{ fmt(row.total) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-bar" v-if="viewerTotal > viewerPageSize">
          <el-pagination
            v-model:current-page="viewerPage"
            :page-size="viewerPageSize"
            :total="viewerTotal"
            background
            layout="total, prev, pager, next"
            @current-change="reloadViewerOrders()"
          />
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { api, downloadArchive } from '@/api'
import { ORDER_TYPE_LABEL, PAY_LABEL, SYSTEM_PAY_KEYS } from '@/config/constants'
import { useShopStore } from '@/stores/shop'
import type { ArchiveMeta, ArchiveSummary, Order, OrderType, ShopSetting } from '@/types'

const shopStore = useShopStore()

const loading = ref(false)
const saving = ref(false)
const form = reactive<ShopSetting>({
  name: '',
  phone: '',
  address: '',
  openTime: '09:00',
  closeTime: '21:00',
  slotInterval: 30,
  stylists: [],
  payMethods: []
})

/** 带余额/次卡扣款逻辑，名称也不允许修改 */
const isSystemKey = (key: string) => SYSTEM_PAY_KEYS.includes(key)
/** 现金/微信/支付宝内置渠道：可改名但不可删除 */
const isBuiltinKey = (key: string) => ['cash', 'wechat', 'alipay'].includes(key)
/** 渠道是否启用（旧数据无 enabled 字段视为启用） */
const isEnabled = (p: { enabled?: boolean }) => p.enabled !== false

const addPayMethod = () => {
  form.payMethods.push({ key: `c_${Date.now().toString(36)}`, label: '', enabled: true })
}

const removePayMethod = (key: string) => {
  const idx = form.payMethods.findIndex((p) => p.key === key)
  if (idx >= 0) form.payMethods.splice(idx, 1)
}

const load = async () => {
  loading.value = true
  try {
    const setting = await api.getSetting()
    Object.assign(form, JSON.parse(JSON.stringify(setting)))
  } finally {
    loading.value = false
  }
}

const save = async () => {
  if (!form.name) {
    ElMessage.warning('请填写店铺名称')
    return
  }
  const labels = form.payMethods.map((p) => (p.label || '').trim())
  if (labels.some((l) => !l)) {
    ElMessage.warning('请补全所有结算方式的名称')
    return
  }
  if (new Set(labels).size !== labels.length) {
    ElMessage.warning('结算方式名称不能重复')
    return
  }
  const enabledRegular = form.payMethods.filter((p) => p.enabled !== false && !isSystemKey(p.key))
  if (!enabledRegular.length) {
    ElMessage.warning('请至少启用一种普通收款渠道（现金 / 微信 / 支付宝 / 自定义），否则无法充值、退款和散客收款')
    return
  }
  form.payMethods.forEach((p) => {
    p.label = (p.label || '').trim()
    p.enabled = p.enabled !== false
  })
  saving.value = true
  try {
    const saved = await api.saveSetting(JSON.parse(JSON.stringify(form)))
    // 同步更新侧边栏 Logo、浏览器标题等处的店铺名称
    shopStore.update(saved)
    ElMessage.success('设置已保存')
  } finally {
    saving.value = false
  }
}

// ---- 数据封存 ----
const archives = ref<ArchiveMeta[]>([])
const creating = ref(false)
const archiveForm = reactive<{
  periodType: ArchiveMeta['periodType']
  year: string
  half: 1 | 2
  quarter: 1 | 2 | 3 | 4
}>({
  periodType: 'year',
  year: dayjs().format('YYYY'),
  half: 1,
  quarter: Math.min(4, Math.floor(dayjs().month() / 3) + 1) as 1 | 2 | 3 | 4
})

const fmt = (n: number) => Number(n || 0).toFixed(2)
const fmtSize = (bytes: number) => {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const QUARTER_CN = ['一', '二', '三', '四']

/** 与后端一致的周期预览 */
const periodPreview = computed(() => {
  const y = Number(archiveForm.year)
  let start = dayjs(`${y}-01-01`)
  let end = dayjs(`${y}-12-31`)
  let label = `${y}年整年`
  if (archiveForm.periodType === 'half') {
    const first = archiveForm.half === 1
    start = first ? dayjs(`${y}-01-01`) : dayjs(`${y}-07-01`)
    end = first ? dayjs(`${y}-06-30`) : dayjs(`${y}-12-31`)
    label = `${y}年${first ? '上' : '下'}半年`
  } else if (archiveForm.periodType === 'quarter') {
    const q = archiveForm.quarter
    start = dayjs(`${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`)
    end = start.add(2, 'month').endOf('month')
    label = `${y}年第${QUARTER_CN[q - 1]}季度`
  }
  return { label, startDate: start.format('YYYY-MM-DD'), endDate: end.format('YYYY-MM-DD') }
})

const loadArchives = async () => {
  archives.value = await api.listArchives()
}

const createArchive = async () => {
  const p = periodPreview.value
  try {
    await ElMessageBox.confirm(
      `将封存「${p.label}」（${p.startDate} ~ ${p.endDate}）的数据快照。封存后该周期数据会被冻结保存、可随时查看，当前系统的数据和使用不受任何影响。是否继续？`,
      '确认封存',
      { confirmButtonText: '立即封存', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  creating.value = true
  try {
    const meta = await api.createArchive({
      periodType: archiveForm.periodType,
      year: Number(archiveForm.year),
      half: archiveForm.periodType === 'half' ? archiveForm.half : undefined,
      quarter: archiveForm.periodType === 'quarter' ? archiveForm.quarter : undefined
    })
    ElMessage.success(`「${meta.label}」封存完成`)
    await loadArchives()
  } catch (e) {
    ElMessage.error((e as Error)?.message || '封存失败')
  } finally {
    creating.value = false
  }
}

const removeArchive = async (row: ArchiveMeta) => {
  try {
    await ElMessageBox.confirm(
      `确定删除封存「${row.label}」吗？仅删除这份封存副本，不影响当前系统中的任何数据。删除后不可恢复，建议先下载副本保管。`,
      '删除封存',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }
  await api.deleteArchive(row.id)
  ElMessage.success('封存已删除')
  await loadArchives()
}

const download = async (row: ArchiveMeta) => {
  try {
    await downloadArchive(row.id, `数据封存_${row.label}`)
  } catch (e) {
    ElMessage.error((e as Error)?.message || '下载失败')
  }
}

// ---- 封存查看（只读） ----
const viewerVisible = ref(false)
const viewer = ref<ArchiveMeta | null>(null)
const summary = ref<ArchiveSummary | null>(null)
const summaryLoading = ref(false)
const viewerOrders = ref<Order[]>([])
const ordersLoading = ref(false)
const viewerKeyword = ref('')
const viewerPage = ref(1)
const viewerPageSize = 20
const viewerTotal = ref(0)

const orderTagType = (t: OrderType): 'success' | 'warning' | 'danger' =>
  t === 'recharge' ? 'warning' : t === 'refund' ? 'danger' : 'success'

const orderTypeLabel = (t: OrderType) => ORDER_TYPE_LABEL[t] || t

const orderItemsText = (o: Order) => {
  if (o.type === 'recharge') return '会员充值'
  if (o.type === 'refund') return o.remark || '退卡退款'
  return o.items.map((it) => `${it.name}（${it.stylistName}）`).join('、')
}

const payText = (o: Order) => {
  if (o.type === 'recharge') return PAY_LABEL[o.payMethod] || o.payMethod
  if (o.payMethod === 'package') return '次卡核销'
  if (o.payMethod === 'mixed' && o.payDetail) {
    const parts = Object.entries(o.payDetail).map(([k, v]) => `${k === 'balance' ? '余额' : (PAY_LABEL[k] || k)} ¥${fmt(v)}`)
    return `混合支付（${parts.join(' + ')}）`
  }
  const custom = form.payMethods.find((p) => p.key === o.payMethod)
  return custom?.label || PAY_LABEL[o.payMethod] || o.payMethod
}

const reloadViewerOrders = async (page?: number) => {
  if (!viewer.value) return
  if (page) viewerPage.value = page
  ordersLoading.value = true
  try {
    const r = await api.archiveOrders(viewer.value.id, {
      page: viewerPage.value,
      pageSize: viewerPageSize,
      keyword: viewerKeyword.value
    })
    viewerOrders.value = r.list
    viewerTotal.value = r.total
  } finally {
    ordersLoading.value = false
  }
}

const openViewer = async (row: ArchiveMeta) => {
  viewer.value = row
  summary.value = null
  viewerOrders.value = []
  viewerTotal.value = 0
  viewerPage.value = 1
  viewerKeyword.value = ''
  viewerVisible.value = true
  summaryLoading.value = true
  try {
    const [s] = await Promise.all([
      api.archiveSummary(row.id),
      reloadViewerOrders(1)
    ])
    summary.value = s
  } finally {
    summaryLoading.value = false
  }
}

onMounted(() => {
  load()
  loadArchives()
})
</script>

<style scoped>
.pay-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.pay-desc {
  font-size: 13px;
  color: #86909c;
  margin-top: 6px;
}

.pay-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pay-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pay-off :deep(.el-input__wrapper) {
  background: #f5f5f5;
}

.save-bar {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.archive-create {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.archive-field-label {
  font-size: 13px;
  color: #4e5969;
  font-weight: 600;
}

.archive-preview {
  font-size: 13px;
  color: #86909c;
}

.archive-preview b {
  color: var(--brand);
  font-weight: 600;
}

.arc-range {
  font-size: 13px;
  color: #86909c;
  margin-bottom: 12px;
}

.arc-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.arc-card {
  background: #f7f6f3;
  border-radius: 10px;
  padding: 12px 14px;
  text-align: center;
}

.arc-num {
  font-size: 20px;
  font-weight: 700;
  color: #1d2129;
}

.refund-num {
  color: #e8754f;
}

.arc-label {
  margin-top: 4px;
  font-size: 12px;
  color: #86909c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arc-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
</style>
