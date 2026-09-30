<template>
  <div class="page-card" v-loading="loading">
    <div class="toolbar">
      <el-radio-group v-model="categoryFilter" @change="search">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button v-for="c in SERVICE_CATEGORIES" :key="c" :value="c">{{ c }}</el-radio-button>
      </el-radio-group>
      <el-switch v-model="showActiveOnly" active-text="仅看上架" @change="search" />
      <div class="spacer"></div>
      <el-tag type="info" effect="plain">共 {{ total }} 个项目</el-tag>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增项目</el-button>
    </div>

    <el-table :data="list" border stripe>
      <el-table-column prop="name" label="项目名称" width="180" show-overflow-tooltip />
      <el-table-column prop="category" label="分类" width="90" />
      <el-table-column label="价格" width="110">
        <template #default="{ row }">
          <span class="price-text">¥{{ fmt(row.price) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="时长" width="90">
        <template #default="{ row }">{{ row.duration }} 分钟</template>
      </el-table-column>
      <el-table-column label="提成规则" width="150">
        <template #default="{ row }">
          <span v-if="row.commissionType === 'none'" class="no-commission">无提成</span>
          <template v-else>{{ row.commissionType === 'fixed' ? `固定 ¥${fmt(row.commissionValue)}/单` : `${row.commissionValue}%` }}</template>
        </template>
      </el-table-column>
      <el-table-column prop="desc" label="说明" width="240" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.active ? 'success' : 'info'">{{ row.active ? '已上架' : '已下架' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link :type="row.active ? 'warning' : 'success'" @click="toggleActive(row)">
              {{ row.active ? '下架' : '上架' }}
            </el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑项目' : '新增项目'" width="520px">
      <el-form :model="form" label-width="92px">
        <el-form-item label="项目名称">
          <el-input v-model="form.name" placeholder="如：精剪造型" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" style="width: 100%">
            <el-option v-for="c in SERVICE_CATEGORIES" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="价格（元）">
              <el-input-number v-model="form.price" :min="0" :precision="2" :step="10" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="时长（分）">
              <el-input-number v-model="form.duration" :min="5" :step="15" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="提成方式">
          <el-radio-group v-model="form.commissionType">
            <el-radio value="fixed">固定金额 / 单</el-radio>
            <el-radio value="percent">按比例 %</el-radio>
            <el-radio value="none">无提成</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.commissionType !== 'none'" :label="form.commissionType === 'fixed' ? '提成金额' : '提成比例'">
          <el-input-number
            v-model="form.commissionValue"
            :min="0"
            :precision="form.commissionType === 'percent' ? 1 : 2"
            :step="form.commissionType === 'percent' ? 1 : 5"
          />
          <span style="margin-left: 8px; color: #86909c">
            {{ form.commissionType === 'fixed' ? '元 / 单' : '%' }}
          </span>
        </el-form-item>
        <el-form-item v-else label="提成说明">
          <span style="color: #86909c; font-size: 13px">该项目开单时不计理发师提成</span>
        </el-form-item>
        <el-form-item label="项目说明">
          <el-input v-model="form.desc" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="立即上架">
          <el-switch v-model="form.active" />
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
import { PAGE_SIZE_OPTIONS, SERVICE_CATEGORIES } from '@/config/constants'
import type { ServiceItem } from '@/types'

const loading = ref(false)
const saving = ref(false)
const list = ref<ServiceItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const categoryFilter = ref('')
const showActiveOnly = ref(false)

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

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
    const res = await api.listServices({
      category: categoryFilter.value,
      active: showActiveOnly.value ? 'true' : '',
      page: page.value,
      pageSize: pageSize.value
    })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const dialogVisible = ref(false)
const form = reactive<Partial<ServiceItem>>({})

const openCreate = () => {
  Object.assign(form, {
    id: undefined,
    name: '',
    category: '剪发',
    price: 68,
    duration: 45,
    commissionType: 'fixed',
    commissionValue: 15,
    desc: '',
    active: true
  })
  dialogVisible.value = true
}

const openEdit = (row: ServiceItem) => {
  Object.assign(form, JSON.parse(JSON.stringify(row)))
  dialogVisible.value = true
}

const submit = async () => {
  if (!form.name) {
    ElMessage.warning('请填写项目名称')
    return
  }
  const payload = JSON.parse(JSON.stringify(form))
  if (payload.commissionType === 'none') payload.commissionValue = 0
  saving.value = true
  try {
    await api.saveService(payload)
    ElMessage.success('已保存')
    dialogVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const toggleActive = async (row: ServiceItem) => {
  try {
    await api.saveService({ id: row.id, active: !row.active })
    ElMessage.success(row.active ? '已下架' : '已上架')
    load()
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

const remove = async (row: ServiceItem) => {
  await ElMessageBox.confirm(`确定删除项目「${row.name}」吗？`, '提示', { type: 'warning' })
  await api.deleteService(row.id)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>

<style scoped>
.no-commission {
  color: #909399;
}
</style>
