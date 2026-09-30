<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">{{ shopName }}</div>
      <div class="title">经营管理后台</div>
      <el-form :model="form" @submit.prevent>
        <el-form-item>
          <el-input
            v-model="form.username"
            size="large"
            placeholder="管理员账号"
            :prefix-icon="User"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            size="large"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="loading"
          @click="submit"
        >
          登 录
        </el-button>
      </el-form>
      <div class="hint">
        默认账号：admin / admin123<br />
        可在项目根目录 config.json 中修改账号密码
      </div>
      <div class="source">数据保存在本机 SQLite 数据库</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useShopStore } from '@/stores/shop'

const router = useRouter()
const auth = useAuthStore()
const shopStore = useShopStore()
const loading = ref(false)
const form = reactive({ username: 'admin', password: 'admin123' })

const shopName = computed(() => shopStore.shopName)

const submit = async () => {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (e: any) {
    ElMessage.error(e?.message || '登录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  shopStore.fetch().catch(() => {})
})
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e352c 0%, var(--brand) 55%, var(--brand-light) 100%);
}

.login-card {
  width: 380px;
  background: #fff;
  border-radius: 16px;
  padding: 40px 36px 28px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}

.brand {
  text-align: center;
  font-size: 13px;
  letter-spacing: 3px;
  color: #c99a5b;
}

.title {
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  margin: 12px 0 28px;
}

.login-btn {
  width: 100%;
  background: var(--brand);
  border-color: var(--brand);
}

.login-btn:hover {
  background: var(--brand-light);
  border-color: var(--brand-light);
}

.hint {
  margin-top: 14px;
  font-size: 12px;
  color: #86909c;
  text-align: center;
  line-height: 1.8;
}

.source {
  margin-top: 8px;
  text-align: center;
  font-size: 12px;
  color: #c99a5b;
}
</style>
