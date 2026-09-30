<template>
  <div class="page-card" v-loading="loading">
    <div class="toolbar">
      <div class="page-title" style="margin: 0">工资统计</div>
      <el-date-picker
        v-model="month"
        type="month"
        value-format="YYYY-MM"
        placeholder="选择月份"
        :clearable="false"
        @change="load"
      />
      <div class="spacer"></div>
      <el-button type="primary" :loading="exporting" @click="doExport">导出本月工资表</el-button>
    </div>

    <div class="summary-row">
      <div class="sum-card">
        <div class="sum-label">当月业绩</div>
        <div class="sum-value">¥{{ fmt(data?.summary.revenue) }}</div>
      </div>
      <div class="sum-card">
        <div class="sum-label">底薪合计（固定/底薪+提成）</div>
        <div class="sum-value">¥{{ fmt(data?.summary.fixedTotal) }}</div>
      </div>
      <div class="sum-card">
        <div class="sum-label">提成合计（纯提成/底薪+提成）</div>
        <div class="sum-value">¥{{ fmt(data?.summary.commissionTotal) }}</div>
      </div>
      <div class="sum-card highlight">
        <div class="sum-label">应发工资合计</div>
        <div class="sum-value">¥{{ fmt(data?.summary.payTotal) }}</div>
      </div>
    </div>

    <el-table
      :data="data?.list || []"
      border
      stripe
      class="salary-table"
      @row-click="openDetail"
    >
      <el-table-column prop="name" label="员工" width="100">
        <template #default="{ row }">
          <span class="link-name">{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="职位" width="120" show-overflow-tooltip />
      <el-table-column label="在岗状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'work' ? 'success' : 'info'" size="small">
            {{ row.status === 'work' ? '在岗' : '休息' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="薪资方式" width="110">
        <template #default="{ row }">
          <el-tag :type="tagType(row.salaryType)" effect="plain" size="small">
            {{ SALARY_TYPE_LABEL[row.salaryType as SalaryType] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="月底薪" width="100" align="right">
        <template #default="{ row }">{{ row.salaryType === 'commission' ? '—' : `¥${fmt(row.baseSalary)}` }}</template>
      </el-table-column>
      <el-table-column prop="orderCount" label="接单量" width="90" align="right" />
      <el-table-column label="当月业绩" width="110" align="right">
        <template #default="{ row }">¥{{ fmt(row.revenue) }}</template>
      </el-table-column>
      <el-table-column label="当月提成（明细）" width="140" align="right">
        <template #default="{ row }">¥{{ fmt(row.commission) }}</template>
      </el-table-column>
      <el-table-column label="固定工资" width="110" align="right">
        <template #default="{ row }">
          <span v-if="row.fixedPay">¥{{ fmt(row.fixedPay) }}</span>
          <span v-else style="color: #c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column label="提成工资" width="110" align="right">
        <template #default="{ row }">
          <span v-if="row.commissionPay">¥{{ fmt(row.commissionPay) }}</span>
          <span v-else style="color: #c0c4cc">—</span>
        </template>
      </el-table-column>
      <el-table-column label="应发工资" width="120" align="right" fixed="right">
        <template #default="{ row }">
          <span class="price-text" style="font-weight: 700">¥{{ fmt(row.payTotal) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="openDetail(row)">薪资明细</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="data && data.list.length === 0" description="该月暂无员工数据" />

    <!-- 个人薪资明细抽屉 -->
    <el-drawer
      v-model="detailVisible"
      size="760px"
      :title="`${current?.name || ''} · ${monthLabel} 薪资明细`"
      destroy-on-close
    >
      <template v-if="current">
        <div class="d-meta">
          <el-tag :type="tagType(current.salaryType)" effect="plain" size="small">
            {{ SALARY_TYPE_LABEL[current.salaryType as SalaryType] }}
          </el-tag>
          <el-tag :type="current.status === 'work' ? 'success' : 'info'" effect="plain" size="small">
            {{ current.status === 'work' ? '在岗' : '休息' }}
          </el-tag>
          <span v-if="current.title" class="d-title">{{ current.title }}</span>
        </div>

        <div class="d-cards">
          <div class="d-card">
            <div class="d-card-label">接单量</div>
            <div class="d-card-value">{{ current.orderCount }} 单</div>
          </div>
          <div class="d-card">
            <div class="d-card-label">当月业绩</div>
            <div class="d-card-value">¥{{ fmt(current.revenue) }}</div>
          </div>
          <div class="d-card">
            <div class="d-card-label">当月提成</div>
            <div class="d-card-value price-text">¥{{ fmt(current.commission) }}</div>
          </div>
          <div class="d-card">
            <div class="d-card-label">月底薪</div>
            <div class="d-card-value">{{ current.salaryType === 'commission' ? '—' : `¥${fmt(current.baseSalary)}` }}</div>
          </div>
          <div class="d-card dark">
            <div class="d-card-label">应发工资</div>
            <div class="d-card-value">¥{{ fmt(current.payTotal) }}</div>
          </div>
        </div>

        <el-alert
          v-if="current.salaryType === 'fixed'"
          type="info"
          :closable="false"
          show-icon
          title="该员工为固定月薪：下方提成明细仅作业绩参考，不计入应发工资。"
          style="margin-bottom: 12px"
        />

        <div class="d-table-title">
          提成明细
          <span class="d-table-count">共 {{ current.details.length }} 个项目</span>
          <el-button
            size="small"
            plain
            class="d-export-btn"
            :loading="exportingDetail"
            @click="exportDetail"
          >导出本月明细</el-button>
        </div>
        <el-table :data="current.details" border stripe size="small" max-height="420" show-summary
          :summary-method="detailSummary">
          <el-table-column prop="date" label="日期" width="100" />
          <el-table-column prop="orderNo" label="单号" width="150">
            <template #default="{ row }">
              <span class="mono">{{ row.orderNo }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="customerName" label="顾客" width="110" show-overflow-tooltip />
          <el-table-column prop="serviceName" label="服务项目" width="170" show-overflow-tooltip />
          <el-table-column label="项目金额" width="95" align="right">
            <template #default="{ row }">¥{{ fmt(row.price) }}</template>
          </el-table-column>
          <el-table-column label="提成" width="90" align="right">
            <template #default="{ row }">
              <span class="price-text">¥{{ fmt(row.commission) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty
          v-if="current.details.length === 0"
          description="该月暂无接单提成记录"
          :image-size="90"
        />

        <div class="d-foot">
          <div class="d-foot-line">
            <span>固定工资</span>
            <b>{{ current.fixedPay ? `¥${fmt(current.fixedPay)}` : '—' }}</b>
          </div>
          <div class="d-foot-line">
            <span>提成工资</span>
            <b class="price-text">¥{{ fmt(current.commissionPay) }}</b>
          </div>
          <div class="d-foot-total">
            <span>应发工资合计</span>
            <b>¥{{ fmt(current.payTotal) }}</b>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { api, downloadExport } from '@/api'
import { SALARY_TYPE_LABEL } from '@/config/constants'
import type { SalaryDetailItem, SalaryReport, SalaryRow, SalaryType } from '@/types'

const loading = ref(false)
const exporting = ref(false)
const month = ref(dayjs().format('YYYY-MM'))
const data = ref<SalaryReport | null>(null)

const detailVisible = ref(false)
const current = ref<SalaryRow | null>(null)

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

const monthLabel = computed(() => {
  if (!month.value) return ''
  const [y, m] = month.value.split('-')
  return `${y}年${Number(m)}月`
})

const tagType = (t: SalaryType) => (t === 'fixed' ? 'info' : t === 'mixed' ? 'warning' : 'success')

const load = async () => {
  if (!month.value) return
  loading.value = true
  try {
    data.value = await api.salaryReport(month.value)
  } finally {
    loading.value = false
  }
}

const openDetail = (row: SalaryRow) => {
  current.value = row
  detailVisible.value = true
}

/** 明细表合计行：项目金额合计=当月业绩，提成合计=当月提成 */
const detailSummary = ({ columns, data: rows }: { columns: unknown[]; data: SalaryDetailItem[] }) => {
  return columns.map((_, i) => {
    if (i === 0) return '合计'
    if (i === 4) return `¥${fmt(rows.reduce((s, r) => s + r.price, 0))}`
    if (i === 5) return `¥${fmt(rows.reduce((s, r) => s + r.commission, 0))}`
    return ''
  })
}

const doExport = async () => {
  exporting.value = true
  try {
    await downloadExport('salary', { month: month.value })
    ElMessage.success('工资表已导出')
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

/** 导出当前员工当月的逐单提成明细 */
const exportingDetail = ref(false)
const exportDetail = async () => {
  if (!current.value) return
  exportingDetail.value = true
  try {
    await downloadExport('salary-detail', { month: month.value, stylistId: current.value.stylistId })
    ElMessage.success('本月明细已导出')
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败')
  } finally {
    exportingDetail.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin: 16px 0 20px;
}

.sum-card {
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 16px 18px;
  background: #faf9f6;
}

.sum-card.highlight {
  background: var(--brand);
  border-color: var(--brand);
}

.sum-card.highlight .sum-label,
.sum-card.highlight .sum-value {
  color: #fff;
}

.sum-label {
  font-size: 13px;
  color: #86909c;
  margin-bottom: 8px;
}

.sum-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--price);
}

.salary-table {
  cursor: pointer;
}

.link-name {
  color: var(--brand);
  font-weight: 600;
}

/* 明细抽屉 */
.d-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.d-title {
  font-size: 13px;
  color: #86909c;
}

.d-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.d-card {
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 12px 10px;
  text-align: center;
  background: #faf9f6;
}

.d-card.dark {
  background: var(--brand);
  border-color: var(--brand);
}

.d-card.dark .d-card-label,
.d-card.dark .d-card-value {
  color: #fff;
}

.d-card-label {
  font-size: 12px;
  color: #86909c;
  margin-bottom: 6px;
}

.d-card-value {
  font-size: 17px;
  font-weight: 700;
  color: #1d2129;
}

.d-table-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.d-export-btn {
  margin-left: auto;
}

.d-table-count {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #86909c;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #4e5969;
}

.d-foot {
  margin-top: 18px;
  border-top: 1px dashed #e5e0d5;
  padding-top: 14px;
}

.d-foot-line {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #4e5969;
  margin-bottom: 8px;
}

.d-foot-total {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
  margin-top: 10px;
}

.d-foot-total b {
  color: var(--brand);
  font-size: 20px;
}
</style>
