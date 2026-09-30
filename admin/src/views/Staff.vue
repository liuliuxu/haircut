<template>
  <div class="page-card" v-loading="loading">
    <div class="toolbar">
      <div class="page-title" style="margin: 0">员工管理</div>
      <div class="spacer"></div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增员工</el-button>
    </div>

    <el-table :data="setting?.stylists || []" border stripe>
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column prop="title" label="职位" width="130" show-overflow-tooltip />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column label="入职时间" width="190">
        <template #default="{ row }">
          <div v-if="row.hireDate">
            {{ row.hireDate }}
            <span class="work-age">{{ workAge(row.hireDate) }}</span>
          </div>
          <span v-else style="color: #c0c4cc">未登记</span>
        </template>
      </el-table-column>
      <el-table-column prop="birthday" label="生日" width="110">
        <template #default="{ row }">{{ row.birthday || '—' }}</template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.remark || '—' }}</template>
      </el-table-column>
      <el-table-column label="薪资方式" width="110">
        <template #default="{ row }">
          <el-tag :type="salaryTagType(row.salaryType)" effect="plain">
            {{ SALARY_TYPE_LABEL[row.salaryType as SalaryType] || '纯提成' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="月底薪" width="100" align="right">
        <template #default="{ row }">
          {{ row.salaryType === 'commission' ? '—' : `¥${fmt(row.baseSalary)}` }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'work' ? 'success' : 'info'">
            {{ row.status === 'work' ? '在岗' : '休息' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link :type="row.status === 'work' ? 'warning' : 'success'" @click="toggleRest(row)">
              {{ row.status === 'work' ? '设为休息' : '设为在岗' }}
            </el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑员工' : '新增员工'" width="460px">
      <el-form :model="form" label-width="84px">
        <el-form-item label="姓名">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="职位">
          <el-input v-model="form.title" placeholder="如：造型总监" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="入职时间">
          <el-date-picker
            v-model="form.hireDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择入职日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="生日">
          <el-date-picker
            v-model="form.birthday"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择生日"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="薪资方式">
          <el-radio-group v-model="form.salaryType">
            <el-radio value="fixed">固定月薪</el-radio>
            <el-radio value="commission">纯提成</el-radio>
            <el-radio value="mixed">底薪+提成</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.salaryType !== 'commission'" label="月底薪">
          <el-input-number v-model="form.baseSalary" :min="0" :precision="2" :step="500" style="width: 100%" />
        </el-form-item>
        <div v-if="form.salaryType !== 'commission'" class="salary-tip">
          提成始终来自实际开单明细；
          {{ form.salaryType === 'fixed' ? '固定月薪不叠加提成，「工资统计」中只发底薪。' : '底薪+提成：每月发底薪并叠加当月开单提成。' }}
        </div>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="work">在岗</el-radio>
            <el-radio value="rest">休息</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="特长、证书、紧急联系人等补充信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { api } from '@/api'
import { SALARY_TYPE_LABEL } from '@/config/constants'
import type { SalaryType, Staff, ShopSetting } from '@/types'

const loading = ref(false)
const saving = ref(false)
const setting = ref<ShopSetting | null>(null)
const dialogVisible = ref(false)
const form = reactive<Partial<Staff>>({})

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

/** 工龄：如「2年3个月」「8个月」「不足1个月」；未来日期显示为空 */
const workAge = (hireDate?: string) => {
  if (!hireDate) return ''
  const start = new Date(`${hireDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return ''
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) return ''
  if (months === 0) return '（不足1个月）'
  const y = Math.floor(months / 12)
  const m = months % 12
  return y > 0 ? `（${y}年${m ? `${m}个月` : ''}）` : `（${m}个月）`
}

const salaryTagType = (t?: SalaryType) =>
  t === 'fixed' ? 'info' : t === 'mixed' ? 'warning' : 'success'

const load = async () => {
  loading.value = true
  try {
    setting.value = await api.getSetting()
  } finally {
    loading.value = false
  }
}

const saveStylists = async (stylists: Staff[]) => {
  setting.value = await api.saveSetting({ stylists })
}

const todayText = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const openCreate = () => {
  Object.assign(form, {
    id: undefined,
    name: '',
    title: '',
    phone: '',
    hireDate: todayText(),
    birthday: '',
    remark: '',
    status: 'work',
    salaryType: 'commission',
    baseSalary: 0
  })
  dialogVisible.value = true
}

const openEdit = (row: Staff) => {
  Object.assign(form, {
    ...row,
    // 兼容旧数据缺字段
    salaryType: row.salaryType || 'commission',
    baseSalary: Number(row.baseSalary) || 0,
    hireDate: row.hireDate || '',
    birthday: row.birthday || '',
    remark: row.remark || ''
  })
  dialogVisible.value = true
}

const submit = async () => {
  if (!form.name || !setting.value) {
    ElMessage.warning('请填写姓名')
    return
  }
  // 纯提成模式底薪强制为 0，避免工资统计口径混乱
  const salaryType = form.salaryType || 'commission'
  const baseSalary = salaryType === 'commission' ? 0 : Number(form.baseSalary) || 0
  saving.value = true
  try {
    let stylists = setting.value.stylists
    const payload = { ...form, salaryType, baseSalary } as Staff
    if (form.id) {
      stylists = stylists.map((s) => (s.id === form.id ? { ...s, ...payload } : s))
    } else {
      stylists = [...stylists, { ...payload, id: `s_${Date.now()}` } as Staff]
    }
    await saveStylists(stylists)
    ElMessage.success('已保存')
    dialogVisible.value = false
  } finally {
    saving.value = false
  }
}

const toggleRest = async (row: Staff) => {
  if (!setting.value) return
  const stylists = setting.value.stylists.map((s) =>
    s.id === row.id ? { ...s, status: s.status === 'work' ? 'rest' : 'work' } as Staff : s
  )
  await saveStylists(stylists)
  ElMessage.success('状态已更新')
}

const remove = async (row: Staff) => {
  if (!setting.value) return
  await ElMessageBox.confirm(`确定删除员工「${row.name}」吗？`, '提示', { type: 'warning' })
  await saveStylists(setting.value.stylists.filter((s) => s.id !== row.id))
  ElMessage.success('已删除')
}

onMounted(load)
</script>

<style scoped>
.salary-tip {
  margin: -8px 0 14px 84px;
  font-size: 12px;
  color: #86909c;
  line-height: 1.6;
}

.work-age {
  margin-left: 4px;
  font-size: 12px;
  color: #a8814f;
}
</style>
