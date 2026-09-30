<template>
  <el-container class="layout">
    <el-aside :width="appStore.theme.sidebarCollapsed ? '64px' : '210px'" class="aside">
      <div class="logo" :class="{ collapsed: appStore.theme.sidebarCollapsed }">
        <div class="logo-mark">{{ shopName.slice(0, 1) }}</div>
        <div v-show="!appStore.theme.sidebarCollapsed" class="logo-text">
          <div class="logo-name">{{ shopName }}</div>
          <div class="logo-sub">经营管理后台</div>
        </div>
      </div>
      <el-menu
        :default-active="route.path"
        router
        :collapse="appStore.theme.sidebarCollapsed"
        class="menu"
        background-color="transparent"
        text-color="#cfd6d2"
        active-text-color="#e0bd8a"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>经营总览</span>
        </el-menu-item>
        <el-menu-item index="/cashier">
          <el-icon><Wallet /></el-icon>
          <span>收银开单</span>
        </el-menu-item>
        <el-menu-item index="/bookings">
          <el-icon><Calendar /></el-icon>
          <span>预约管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <span>订单流水</span>
        </el-menu-item>
        <el-menu-item index="/members">
          <el-icon><User /></el-icon>
          <span>会员管理</span>
        </el-menu-item>
        <el-menu-item index="/services">
          <el-icon><Goods /></el-icon>
          <span>服务项目</span>
        </el-menu-item>
        <el-menu-item index="/staff">
          <el-icon><Avatar /></el-icon>
          <span>员工管理</span>
        </el-menu-item>
        <el-menu-item index="/salary">
          <el-icon><Money /></el-icon>
          <span>工资统计</span>
        </el-menu-item>
        <el-menu-item index="/export">
          <el-icon><Download /></el-icon>
          <span>数据导出</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>店铺设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="toggleCollapse">
            <Fold v-if="!appStore.theme.sidebarCollapsed" />
            <Expand v-else />
          </el-icon>
          <div class="page-name">{{ route.meta.title || '' }}</div>
        </div>
        <div class="header-right">
          <el-tag type="success" effect="plain" round>{{ DATA_SOURCE_LABEL }}</el-tag>
          <el-icon class="setting-btn" title="系统设置" @click="appStore.drawerVisible = true">
            <Tools />
          </el-icon>
          <el-dropdown @command="onCommand">
            <span class="user-area">
              <el-icon><UserFilled /></el-icon>
              {{ auth.name || '管理员' }}
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>

    <SettingsDrawer />
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import {
  DataAnalysis,
  Wallet,
  Calendar,
  Tickets,
  User,
  Goods,
  Avatar,
  Money,
  Download,
  Setting,
  UserFilled,
  Tools,
  Fold,
  Expand
} from '@element-plus/icons-vue'
import { DATA_SOURCE_LABEL } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useShopStore } from '@/stores/shop'
import { useAppStore } from '@/stores/app'
import SettingsDrawer from './SettingsDrawer.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const shopStore = useShopStore()
const appStore = useAppStore()

const shopName = computed(() => shopStore.shopName)

const toggleCollapse = () => {
  appStore.patch({ sidebarCollapsed: !appStore.theme.sidebarCollapsed })
}

const onCommand = async (command: string) => {
  if (command === 'logout') {
    await ElMessageBox.confirm('确定退出登录吗？', '提示', { type: 'warning' })
    auth.logout()
    router.push('/login')
  }
}

onMounted(() => {
  shopStore.fetch()
})
</script>

<style scoped>
.layout {
  height: 100vh;
}

.aside {
  background: linear-gradient(180deg, #1e352c 0%, var(--brand) 100%);
  display: flex;
  flex-direction: column;
  transition: width 0.25s ease;
  overflow: hidden;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 20px;
  color: #fff;
  white-space: nowrap;
}

.logo.collapsed {
  justify-content: center;
  padding: 22px 0;
}

.logo-mark {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #c99a5b, #e0bd8a);
  color: #1e352c;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-name {
  font-size: 16px;
  font-weight: 600;
}

.logo-sub {
  font-size: 11px;
  opacity: 0.65;
  margin-top: 2px;
}

.menu {
  border-right: none;
  flex: 1;
  padding: 8px;
}

.menu:not(.el-menu--collapse) {
  width: 194px;
}

.menu :deep(.el-menu-item) {
  border-radius: 8px;
  margin-bottom: 4px;
  height: 46px;
}

.menu :deep(.el-menu-item.is-active) {
  background: rgba(201, 154, 91, 0.16);
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.collapse-btn,
.setting-btn {
  font-size: 19px;
  cursor: pointer;
  color: #4e5969;
}

.collapse-btn:hover,
.setting-btn:hover {
  color: var(--brand);
}

.page-name {
  font-size: 16px;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-area {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #4e5969;
  outline: none;
}

.main {
  background: #f5f4f1;
  padding: 20px;
}
</style>
