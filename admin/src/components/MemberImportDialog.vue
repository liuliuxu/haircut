<template>
  <el-dialog
    :model-value="modelValue"
    title="批量导入会员"
    width="720px"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @closed="reset"
  >
    <!-- 步骤 1：上传 -->
    <template v-if="!preview && !result">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 14px">
        <template #title>
          请按模板列填写：姓名（必填）、手机号、性别（男/女）、生日（YYYY-MM-DD）、初始余额。
          同一手机号视为同一位会员。
        </template>
      </el-alert>
      <div class="tpl-line">
        <el-button link type="primary" :icon="Download" @click="getTemplate">下载会员导入模板</el-button>
      </div>
      <el-upload
        drag
        :show-file-list="false"
        :auto-upload="false"
        accept=".xlsx,.xls"
        :on-change="onFileChange"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">把 Excel 拖到此处，或<em>点击选择文件</em></div>
        <template #tip>
          <div class="el-upload__tip">仅支持 .xlsx / .xls，单次建议不超过 1000 行</div>
        </template>
      </el-upload>
    </template>

    <!-- 步骤 2：预览确认 -->
    <template v-else-if="preview && !result">
      <div class="preview-summary">
        <el-tag type="success" effect="plain">可导入 {{ preview.rows.length }} 行</el-tag>
        <el-tag type="warning" effect="plain">其中重复手机号 {{ dupCount }} 行</el-tag>
        <el-tag type="danger" effect="plain">错误行 {{ preview.errors.length }} 行（将跳过）</el-tag>
      </div>

      <el-form label-width="120px" style="margin: 12px 0">
        <el-form-item label="重复手机号处理">
          <el-radio-group v-model="dupMode">
            <el-radio value="skip">跳过，不改动已有会员</el-radio>
            <el-radio value="update">更新资料（初始余额累加到账户余额）</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <el-table :data="preview.rows" border size="small" max-height="260">
        <el-table-column prop="row" label="Excel行" width="80" />
        <el-table-column prop="name" label="姓名" width="90" />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="性别" width="60">
          <template #default="{ row }">{{ row.gender === 'male' ? '男' : row.gender === 'female' ? '女' : '—' }}</template>
        </el-table-column>
        <el-table-column prop="birthday" label="生日" width="110">
          <template #default="{ row }">{{ row.birthday || '—' }}</template>
        </el-table-column>
        <el-table-column label="初始余额" width="100" align="right">
          <template #default="{ row }">¥{{ fmt(row.balance) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="row.duplicate" type="warning" size="small" effect="plain">
              重复：{{ row.existingName }}（余额 ¥{{ fmt(row.existingBalance) }}）
            </el-tag>
            <el-tag v-else type="success" size="small" effect="plain">新增</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-table
        v-if="preview.errors.length"
        :data="preview.errors"
        border
        size="small"
        max-height="140"
        style="margin-top: 12px"
      >
        <el-table-column prop="row" label="错误行" width="90" />
        <el-table-column prop="message" label="原因" width="500" show-overflow-tooltip />
      </el-table>
    </template>

    <!-- 步骤 3：导入结果 -->
    <template v-else>
      <el-result icon="success" title="导入完成" :sub-title="resultSubtitle">
        <template #extra>
          <div v-if="result?.errors.length" class="result-errors">
            <div style="font-weight: 600; margin-bottom: 6px">以下行未导入：</div>
            <el-table :data="result.errors" border size="small" max-height="180">
              <el-table-column prop="row" label="行号" width="90" />
              <el-table-column prop="message" label="原因" width="500" show-overflow-tooltip />
            </el-table>
          </div>
        </template>
      </el-result>
    </template>

    <template #footer>
      <template v-if="!result">
        <el-button @click="emit('update:modelValue', false)">{{ preview ? '取消' : '关闭' }}</el-button>
        <el-button v-if="preview" @click="preview = null">重新选择文件</el-button>
        <el-button
          v-if="preview"
          type="primary"
          :loading="committing"
          :disabled="!preview.rows.length"
          @click="commit"
        >
          确认导入（{{ preview.rows.length }} 行）
        </el-button>
      </template>
      <el-button v-else type="primary" @click="finish">完成</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, UploadFilled } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import { api, downloadCustomerTemplate } from '@/api'
import type { ImportCustomerRow, ImportPreview, ImportResult } from '@/types'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

const preview = ref<ImportPreview | null>(null)
const result = ref<ImportResult | null>(null)
const dupMode = ref<'skip' | 'update'>('skip')
const committing = ref(false)

const dupCount = computed(() => preview.value?.rows.filter((r) => r.duplicate).length || 0)

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

const resultSubtitle = computed(() => {
  if (!result.value) return ''
  const parts = [`新增 ${result.value.inserted} 位`]
  if (result.value.updated) parts.push(`更新 ${result.value.updated} 位`)
  if (result.value.skipped) parts.push(`跳过 ${result.value.skipped} 位`)
  if (result.value.errors.length) parts.push(`${result.value.errors.length} 行失败`)
  return parts.join('，')
})

const getTemplate = async () => {
  try {
    await downloadCustomerTemplate()
  } catch (e: any) {
    ElMessage.error(e?.message || '模板下载失败')
  }
}

const onFileChange = async (file: UploadFile) => {
  if (!file.raw) return
  try {
    preview.value = await api.importCustomersPreview(file.raw)
    result.value = null
    if (!preview.value.rows.length && preview.value.errors.length) {
      ElMessage.warning('文件中没有可导入的有效行，请检查格式')
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '文件解析失败')
    preview.value = null
  }
}

const commit = async () => {
  if (!preview.value) return
  committing.value = true
  try {
    const rows: ImportCustomerRow[] = preview.value.rows
    result.value = await api.importCustomers(dupMode.value, rows)
    emit('success')
  } catch (e: any) {
    ElMessage.error(e?.message || '导入失败')
  } finally {
    committing.value = false
  }
}

const finish = () => {
  emit('update:modelValue', false)
}

const reset = () => {
  preview.value = null
  result.value = null
  dupMode.value = 'skip'
}
</script>

<style scoped>
.tpl-line {
  margin-bottom: 10px;
  text-align: right;
}

.preview-summary {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.result-errors {
  width: 460px;
  text-align: left;
}
</style>
