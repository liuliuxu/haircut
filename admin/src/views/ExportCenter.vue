<template>
  <div>
    <el-tabs v-model="activeTab" class="export-tabs" @tab-change="loadCount">
      <!-- 会员档案 -->
      <el-tab-pane label="会员档案" name="customers">
        <div class="page-card">
          <el-form label-width="90px" style="max-width: 720px">
            <el-form-item label="姓名 / 手机">
              <el-input v-model="customersQuery.keyword" placeholder="支持模糊查询，留空导出全部" clearable />
            </el-form-item>
            <el-form-item label="性别">
              <el-radio-group v-model="customersQuery.gender">
                <el-radio value="">全部</el-radio>
                <el-radio value="female">女</el-radio>
                <el-radio value="male">男</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>
          <div class="export-footer">
            <el-tag type="info" effect="plain">符合条件 {{ counts.customers }} 位会员</el-tag>
            <el-button type="primary" :icon="Download" :loading="downloading === 'customers'" @click="doExport('customers')">
              导出 Excel
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 订单流水 -->
      <el-tab-pane label="订单流水" name="orders">
        <div class="page-card">
          <el-form label-width="90px" style="max-width: 720px">
            <el-form-item label="时间范围">
              <el-date-picker
                v-model="ordersRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :shortcuts="shortcuts"
              />
            </el-form-item>
            <el-form-item label="单据类型">
              <el-radio-group v-model="ordersQuery.type">
                <el-radio value="">全部</el-radio>
                <el-radio value="consume">消费单</el-radio>
                <el-radio value="recharge">充值单</el-radio>
                <el-radio value="refund">退款单</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="顾客类型">
              <el-radio-group v-model="ordersQuery.member">
                <el-radio value="">全部</el-radio>
                <el-radio value="yes">会员</el-radio>
                <el-radio value="no">散客</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="支付方式">
              <el-select v-model="ordersQuery.payMethod" placeholder="全部" clearable style="width: 200px">
                <el-option v-for="p in setting?.payMethods || []" :key="p.key" :label="p.label" :value="p.key" />
              </el-select>
            </el-form-item>
            <el-form-item label="单号 / 会员">
              <el-input v-model="ordersQuery.keyword" placeholder="单号、会员名或手机号" clearable />
            </el-form-item>
          </el-form>
          <div class="export-footer">
            <el-tag type="info" effect="plain">符合条件 {{ counts.orders }} 笔单据</el-tag>
            <el-button type="primary" :icon="Download" :loading="downloading === 'orders'" @click="doExport('orders')">
              导出 Excel
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 预约记录 -->
      <el-tab-pane label="预约记录" name="bookings">
        <div class="page-card">
          <el-form label-width="90px" style="max-width: 720px">
            <el-form-item label="日期范围">
              <el-date-picker
                v-model="bookingsRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                :shortcuts="shortcuts"
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="bookingsQuery.status" placeholder="全部状态" clearable style="width: 200px">
                <el-option label="待确认" value="pending" />
                <el-option label="已确认" value="confirmed" />
                <el-option label="已完成" value="done" />
                <el-option label="已取消" value="cancelled" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="export-footer">
            <el-tag type="info" effect="plain">符合条件 {{ counts.bookings }} 条预约</el-tag>
            <el-button type="primary" :icon="Download" :loading="downloading === 'bookings'" @click="doExport('bookings')">
              导出 Excel
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 服务价目表 -->
      <el-tab-pane label="服务价目表" name="services">
        <div class="page-card">
          <el-form label-width="90px" style="max-width: 720px">
            <el-form-item label="说明">
              <span style="color: #86909c; font-size: 13px">导出当前全部服务项目与提成规则，可用于打印价目表或备份。</span>
            </el-form-item>
          </el-form>
          <div class="export-footer">
            <el-tag type="info" effect="plain">共 {{ counts.services }} 个项目</el-tag>
            <el-button type="primary" :icon="Download" :loading="downloading === 'services'" @click="doExport('services')">
              导出 Excel
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 员工工资表 -->
      <el-tab-pane label="员工工资表" name="salary">
        <div class="page-card">
          <el-form label-width="90px" style="max-width: 720px">
            <el-form-item label="工资月份">
              <el-date-picker
                v-model="salaryMonth"
                type="month"
                value-format="YYYY-MM"
                placeholder="选择月份"
                :clearable="false"
                @change="loadCount('salary')"
              />
            </el-form-item>
            <el-form-item label="说明">
              <span style="color: #86909c; font-size: 13px">
                按员工薪资方式（固定月薪 / 纯提成 / 底薪+提成）汇总当月业绩、提成与应发工资。
              </span>
            </el-form-item>
          </el-form>
          <div class="export-footer">
            <el-tag type="info" effect="plain">{{ salaryMonth }} 共 {{ counts.salary }} 名员工</el-tag>
            <el-button type="primary" :icon="Download" :loading="downloading === 'salary'" @click="doExport('salary')">
              导出工资表
            </el-button>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { onMounted, reactive, ref } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { api, downloadExport } from '@/api'
import type { ShopSetting } from '@/types'

type ExportType = 'customers' | 'orders' | 'bookings' | 'services' | 'salary'

const activeTab = ref<ExportType>('customers')
const downloading = ref<ExportType | ''>('')
const setting = ref<ShopSetting | null>(null)

const customersQuery = reactive({ keyword: '', gender: '' })
const ordersQuery = reactive({ type: '', payMethod: '', member: '', keyword: '' })
const salaryMonth = ref(dayjs().format('YYYY-MM'))
const ordersRange = ref<[string, string]>([
  dayjs().startOf('month').format('YYYY-MM-DD'),
  dayjs().format('YYYY-MM-DD')
])
const bookingsQuery = reactive<{ status: '' | 'pending' | 'confirmed' | 'done' | 'cancelled' }>({ status: '' })
const bookingsRange = ref<[string, string]>([
  dayjs().format('YYYY-MM-DD'),
  dayjs().add(30, 'day').format('YYYY-MM-DD')
])

const counts = reactive({ customers: 0, orders: 0, bookings: 0, services: 0, salary: 0 })

const shortcuts = [
  { text: '本月', value: () => [dayjs().startOf('month').toDate(), dayjs().toDate()] },
  { text: '最近 90 天', value: () => [dayjs().subtract(90, 'day').toDate(), dayjs().toDate()] },
  { text: '今年', value: () => [dayjs().startOf('year').toDate(), dayjs().toDate()] }
]

const buildParams = (type: ExportType) => {
  if (type === 'customers') {
    return { keyword: customersQuery.keyword, gender: customersQuery.gender }
  }
  if (type === 'orders') {
    return {
      from: ordersRange.value?.[0] || '',
      to: ordersRange.value?.[1] || '',
      type: ordersQuery.type,
      payMethod: ordersQuery.payMethod,
      member: ordersQuery.member,
      keyword: ordersQuery.keyword
    }
  }
  if (type === 'bookings') {
    return {
      from: bookingsRange.value?.[0] || '',
      to: bookingsRange.value?.[1] || '',
      status: bookingsQuery.status
    }
  }
  if (type === 'salary') {
    return { month: salaryMonth.value }
  }
  return {}
}

const loadCount = async (type?: string | number) => {
  const tab = (type as ExportType) || activeTab.value
  try {
    if (tab === 'customers') {
      counts.customers = (await api.listCustomers({ ...buildParams('customers'), page: 1, pageSize: 1 })).total
    } else if (tab === 'orders') {
      counts.orders = (await api.listOrders({ ...buildParams('orders'), page: 1, pageSize: 1 } as any)).total
    } else if (tab === 'bookings') {
      counts.bookings = (
        await api.listBookings({ ...buildParams('bookings'), page: 1, pageSize: 1 } as any)
      ).total
    } else if (tab === 'services') {
      counts.services = (await api.listServices({ page: 1, pageSize: 1 })).total
    } else if (tab === 'salary') {
      counts.salary = (await api.salaryReport(salaryMonth.value)).list.length
    }
  } catch (e) {
    // 切 tab 过快时忽略
  }
}

const doExport = async (type: ExportType) => {
  downloading.value = type
  try {
    await downloadExport(type, buildParams(type))
    ElMessage.success('导出成功，文件已开始下载')
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败')
  } finally {
    downloading.value = ''
  }
}

onMounted(async () => {
  setting.value = await api.getSetting()
  loadCount('customers')
  loadCount('orders')
  loadCount('bookings')
  loadCount('services')
  loadCount('salary')
})
</script>

<style scoped>
.export-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed #e5e6eb;
  padding-top: 16px;
  max-width: 720px;
}
</style>
