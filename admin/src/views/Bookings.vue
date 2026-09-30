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
      <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 130px" @change="search">
        <el-option label="待确认" value="pending" />
        <el-option label="已确认" value="confirmed" />
        <el-option label="已完成" value="done" />
        <el-option label="已取消" value="cancelled" />
      </el-select>
      <div class="spacer"></div>
      <el-tag type="info" effect="plain">共 {{ total }} 条预约</el-tag>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增预约</el-button>
    </div>

    <el-table :data="list" border stripe>
      <el-table-column label="日期" width="210">
        <template #default="{ row }">
          <span style="font-weight: 600; color: var(--brand)">{{ friendly(row.date) }}</span>
          <span style="margin-left: 6px; font-size: 12px; color: #86909c">{{ row.startTime }} - {{ row.endTime }}</span>
        </template>
      </el-table-column>
      <el-table-column label="顾客" width="140">
        <template #default="{ row }">
          <span>{{ row.customerName }}</span>
          <el-tag size="small" :type="row.customerId ? 'success' : 'info'" effect="plain" style="margin-left: 4px">
            {{ row.customerId ? '会员' : '散客' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column label="服务项目" width="200" show-overflow-tooltip>
        <template #default="{ row }">
          {{ (row.serviceNames || []).join('、') || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="理发师" width="90">
        <template #default="{ row }">{{ stylistName(row.stylistId) }}</template>
      </el-table-column>
      <el-table-column label="来源" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.source === 'customer' ? 'info' : 'warning'" effect="plain">
            {{ row.source === 'customer' ? '顾客自助' : '门店代约' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="BOOKING_STATUS_TYPE[row.status as BookingStatus]">
            {{ BOOKING_STATUS[row.status as BookingStatus] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="270" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-tooltip
              v-if="row.status === 'pending' || row.status === 'confirmed'"
              content="修改预约的日期、时间、服务项目或理发师"
              placement="top"
              :show-after="200"
            >
              <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            </el-tooltip>
            <el-tooltip
              v-if="row.status === 'pending'"
              content="确认预约有效，顾客已约好，进入待服务排期"
              placement="top"
              :show-after="200"
            >
              <el-button link type="success" @click="changeStatus(row, 'confirmed')">确认</el-button>
            </el-tooltip>
            <el-tooltip
              v-if="row.status === 'pending' || row.status === 'confirmed'"
              content="顾客已到店：带预约信息去收银开单，结算后预约自动完成"
              placement="top"
              :show-after="200"
            >
              <el-button link type="primary" @click="goCashier(row)">到店开单</el-button>
            </el-tooltip>
            <el-tooltip
              v-if="row.status !== 'cancelled' && row.status !== 'done'"
              content="不经过收银开单，直接把预约标记为服务已完成"
              placement="top"
              :show-after="200"
            >
              <el-button link type="warning" @click="changeStatus(row, 'done')">标记完成</el-button>
            </el-tooltip>
            <el-tooltip
              v-if="row.status !== 'cancelled' && row.status !== 'done'"
              content="作废该预约，并释放理发师此时段"
              placement="top"
              :show-after="200"
            >
              <el-button link type="danger" @click="changeStatus(row, 'cancelled')">取消</el-button>
            </el-tooltip>
            <span v-if="row.status === 'done' || row.status === 'cancelled'" style="color: #c0c4cc; font-size: 12px">—</span>
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

    <!-- 新增 / 编辑预约（门店代约） -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑预约' : '新增预约（门店代约）'" width="560px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="顾客类型">
          <el-radio-group v-model="guestType" @change="onGuestTypeChange">
            <el-radio-button value="member">会员</el-radio-button>
            <el-radio-button value="walkin">散客</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="guestType === 'member'" label="选择会员" required>
          <el-select
            v-model="form.customerId"
            filterable
            clearable
            placeholder="搜索会员姓名 / 手机号"
            style="width: 100%"
            :loading="customerLoading"
            @change="onPickCustomer"
          >
            <el-option
              v-for="c in customerOptions"
              :key="c.id"
              :label="`${c.name}（${c.phone || '无手机号'}）余额 ¥${fmt(c.balance)}`"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <template v-else>
          <el-form-item label="顾客姓名" required>
            <el-input v-model="form.customerName" placeholder="散客请填写姓名" />
          </el-form-item>
          <el-form-item label="手机号">
            <el-input v-model="form.phone" placeholder="选填" />
          </el-form-item>
        </template>
        <el-form-item label="服务项目" required>
          <el-select
            v-model="form.serviceIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="可多选"
            style="width: 100%"
          >
            <el-option
              v-for="s in serviceOptions"
              :key="s.id"
              :label="`${s.name}（¥${fmt(s.price)} / ${s.duration}分钟）`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="理发师">
          <el-select v-model="form.stylistId" clearable placeholder="不指定" style="width: 100%">
            <el-option
              v-for="s in workStylists"
              :key="s.id"
              :label="`${s.name} · ${s.title}`"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <div v-if="preview.duration" class="preview-tip">
          预计总时长 <b>{{ preview.duration }}</b> 分钟；按价目表规则预计提成
          <b>¥{{ fmt(preview.commission) }}</b>（结算时以实际开单金额为准）
        </div>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="日期" required>
              <el-date-picker
                v-model="form.date"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="时间" required>
              <el-select v-model="form.startTime" style="width: 100%">
                <el-option v-for="t in timeSlots" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存预约</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { api } from '@/api'
import { BOOKING_STATUS, BOOKING_STATUS_TYPE, PAGE_SIZE_OPTIONS } from '@/config/constants'
import type {
  Booking,
  BookingStatus,
  Customer,
  ServiceItem,
  ShopSetting
} from '@/types'

const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const range = ref<[string, string]>([dayjs().format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')])
const statusFilter = ref<BookingStatus | ''>('')
const list = ref<Booking[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const setting = ref<ShopSetting | null>(null)

const shortcuts = [
  { text: '今天', value: () => [dayjs().toDate(), dayjs().toDate()] },
  { text: '未来 7 天', value: () => [dayjs().toDate(), dayjs().add(7, 'day').toDate()] },
  { text: '最近 30 天', value: () => [dayjs().subtract(23, 'day').toDate(), dayjs().add(7, 'day').toDate()] }
]

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

const stylistName = (id: string) =>
  setting.value?.stylists.find((s) => s.id === id)?.name || '不指定'

const workStylists = computed(() => setting.value?.stylists || [])

const friendly = (date: string) => {
  const d = dayjs(date)
  const diff = d.startOf('day').diff(dayjs().startOf('day'), 'day')
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.day()]
  if (diff === 0) return `今天 ${d.format('MM-DD')}`
  if (diff === 1) return `明天 ${d.format('MM-DD')}`
  if (diff === -1) return `昨天 ${d.format('MM-DD')}`
  return `${week} ${d.format('MM-DD')}`
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
  if (!range.value) return
  loading.value = true
  try {
    const res = await api.listBookings({
      from: range.value[0],
      to: range.value[1],
      status: statusFilter.value,
      page: page.value,
      pageSize: pageSize.value
    })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const changeStatus = async (row: Booking, status: BookingStatus) => {
  const action = BOOKING_STATUS[status]
  await ElMessageBox.confirm(`确定将「${row.customerName} ${row.startTime}」的预约标记为「${action}」吗？`, '提示')
  await api.setBookingStatus(row.id, status)
  ElMessage.success('操作成功')
  load()
}

const goCashier = (row: Booking) => {
  router.push({ path: '/cashier', query: { bookingId: row.id } })
}

// ---- 新增 / 编辑预约 ----
const dialogVisible = ref(false)
const customerLoading = ref(false)
const customerOptions = ref<Customer[]>([])
const serviceOptions = ref<ServiceItem[]>([])
/** 非空 = 编辑模式 */
const editingId = ref('')
/** 顾客类型：会员 / 散客 */
const guestType = ref<'member' | 'walkin'>('walkin')

const emptyForm = () => ({
  customerId: '',
  customerName: '',
  phone: '',
  serviceIds: [] as string[],
  stylistId: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '',
  remark: ''
})
const form = reactive(emptyForm())

const timeSlots = computed(() => {
  const slots: string[] = []
  const s = setting.value
  if (!s) return slots
  let cur = dayjs(`2000-01-01 ${s.openTime}`)
  const end = dayjs(`2000-01-01 ${s.closeTime}`)
  while (cur.isBefore(end)) {
    slots.push(cur.format('HH:mm'))
    cur = cur.add(s.slotInterval || 30, 'minute')
  }
  return slots
})

/** 所选项目的时长与提成预估（提成按价目表规则，与具体理发师无关） */
const preview = computed(() => {
  let duration = 0
  let commission = 0
  for (const id of form.serviceIds) {
    const svc = serviceOptions.value.find((s) => s.id === id)
    if (!svc) continue
    duration += svc.duration
    commission += svc.commissionType === 'none'
      ? 0
      : svc.commissionType === 'fixed'
        ? svc.commissionValue
        : Math.round(svc.price * svc.commissionValue) / 100
  }
  return { duration, commission }
})

const onPickCustomer = (id: string) => {
  const c = customerOptions.value.find((x) => x.id === id)
  if (c) {
    form.customerName = c.name
    form.phone = c.phone
  } else {
    form.customerName = ''
    form.phone = ''
  }
}

/** 切换顾客类型时清空已填信息，避免会员/散客身份混淆 */
const onGuestTypeChange = () => {
  form.customerId = ''
  form.customerName = ''
  form.phone = ''
}

const ensureOptions = async () => {
  customerLoading.value = true
  try {
    const [customers, services] = await Promise.all([
      api.listCustomers({ pageSize: 200 }),
      api.listServices({ pageSize: 200 })
    ])
    customerOptions.value = customers.list
    serviceOptions.value = services.list
  } finally {
    customerLoading.value = false
  }
}

const openCreate = async () => {
  editingId.value = ''
  Object.assign(form, emptyForm())
  guestType.value = 'walkin'
  dialogVisible.value = true
  await ensureOptions()
}

const openEdit = async (row: Booking) => {
  editingId.value = row.id
  guestType.value = row.customerId ? 'member' : 'walkin'
  dialogVisible.value = true
  await ensureOptions()
  Object.assign(form, {
    customerId: row.customerId || '',
    customerName: row.customerName || '',
    phone: row.phone || '',
    serviceIds: [...(row.serviceIds || [])],
    stylistId: row.stylistId || '',
    date: row.date,
    startTime: row.startTime,
    remark: row.remark || ''
  })
}

const submit = async () => {
  if (guestType.value === 'member' && !form.customerId) {
    ElMessage.warning('请选择会员，或切换为散客')
    return
  }
  if (guestType.value === 'walkin' && !form.customerName.trim()) {
    ElMessage.warning('请填写散客姓名')
    return
  }
  if (!form.serviceIds.length) {
    ElMessage.warning('请选择服务项目')
    return
  }
  if (!form.startTime) {
    ElMessage.warning('请选择预约时间')
    return
  }
  saving.value = true
  try {
    const payload = {
      customerId: form.customerId || undefined,
      customerName: form.customerName || customerOptions.value.find((c) => c.id === form.customerId)?.name || '',
      phone: form.phone,
      serviceIds: form.serviceIds,
      stylistId: form.stylistId,
      date: form.date,
      startTime: form.startTime,
      remark: form.remark
    }
    if (editingId.value) {
      await api.updateBooking(editingId.value, payload)
      ElMessage.success('预约已更新')
    } else {
      await api.createBooking(payload)
      ElMessage.success('预约已保存')
    }
    dialogVisible.value = false
    search()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  setting.value = await api.getSetting()
  load()
})
</script>

<style scoped>
.preview-tip {
  margin: -4px 0 14px 90px;
  font-size: 12px;
  color: #86909c;
  line-height: 1.8;
}

.preview-tip b {
  color: var(--brand);
  font-weight: 600;
}
</style>
