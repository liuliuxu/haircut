<template>
  <el-drawer
    v-model="appStore.drawerVisible"
    title="系统设置"
    direction="rtl"
    size="300px"
    :append-to-body="true"
  >
    <div class="setting-block">
      <div class="setting-label">主题色</div>
      <div class="color-list">
        <div
          v-for="c in presetColors"
          :key="c"
          class="color-dot"
          :class="{ active: appStore.theme.primaryColor.toLowerCase() === c.toLowerCase() }"
          :style="{ background: c }"
          @click="appStore.patch({ primaryColor: c })"
        >
          <el-icon v-if="appStore.theme.primaryColor.toLowerCase() === c.toLowerCase()"><Check /></el-icon>
        </div>
      </div>
      <div class="custom-color">
        <span>自定义</span>
        <el-color-picker
          :model-value="appStore.theme.primaryColor"
          @change="(v: string | null) => v && appStore.patch({ primaryColor: v })"
        />
      </div>
    </div>

    <el-divider />

    <div class="setting-block">
      <div class="setting-label">字体大小</div>
      <el-radio-group
        :model-value="appStore.theme.fontSize"
        @change="(v: any) => appStore.patch({ fontSize: v })"
      >
        <el-radio-button value="small">小</el-radio-button>
        <el-radio-button value="default">默认</el-radio-button>
        <el-radio-button value="large">大</el-radio-button>
      </el-radio-group>
    </div>

    <el-divider />

    <div class="setting-block">
      <div class="setting-label">侧边菜单栏</div>
      <div class="switch-row">
        <span>折叠菜单（仅显示图标）</span>
        <el-switch
          :model-value="appStore.theme.sidebarCollapsed"
          @change="(v: boolean) => appStore.patch({ sidebarCollapsed: v })"
        />
      </div>
    </div>

    <el-divider />

    <el-button style="width: 100%" @click="appStore.reset()">恢复默认设置</el-button>

    <div class="tip">设置保存在本机浏览器中，仅影响当前电脑的显示效果。</div>
  </el-drawer>
</template>

<script setup lang="ts">
import { Check } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

const presetColors = [
  '#2b4a3e',
  '#1f5fbf',
  '#6d28d9',
  '#be185d',
  '#b45309',
  '#0f766e',
  '#374151',
  '#b91c1c'
]
</script>

<style scoped>
.setting-label {
  font-size: 13px;
  font-weight: 600;
  color: #4e5969;
  margin-bottom: 14px;
}

.color-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.color-dot {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
}

.color-dot.active {
  outline: 2px solid #1d2129;
  outline-offset: 2px;
}

.custom-color {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #86909c;
  font-size: 13px;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #4e5969;
  font-size: 13px;
}

.tip {
  margin-top: 16px;
  font-size: 12px;
  color: #a0a4aa;
  line-height: 1.7;
}
</style>
