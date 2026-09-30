<template>
  <div v-loading="loading" class="dashboard">
    <!-- 今日概览 -->
    <div class="today-strip page-card">
      <div class="strip-title">
        今日概览
        <span class="strip-date">{{ todayText }}</span>
      </div>
      <div class="strip-items">
        <div class="strip-item">
          <span class="si-label">流水</span>
          <span class="si-value price">¥{{ fmt(today?.revenue) }}</span>
        </div>
        <el-divider direction="vertical" />
        <div class="strip-item">
          <span class="si-label">订单</span>
          <span class="si-value">{{ today?.orderCount ?? 0 }}</span>
        </div>
        <el-divider direction="vertical" />
        <div class="strip-item">
          <span class="si-label">有效预约</span>
          <span class="si-value">{{ today?.bookingCount ?? 0 }}</span>
        </div>
        <el-divider direction="vertical" />
        <div class="strip-item">
          <span class="si-label">客单价</span>
          <span class="si-value">¥{{ fmt(today?.avgTicket) }}</span>
        </div>
        <div class="strip-spacer" />
        <div class="strip-item">
          <span class="si-label">会员总数</span>
          <span class="si-value">{{ customerCount }} 人</span>
        </div>
      </div>
    </div>

    <!-- 统计区间 -->
    <div class="range-bar page-card">
      <span class="range-label">统计区间</span>
      <el-radio-group v-model="quickKey" size="small" class="quick-group">
        <el-radio-button value="today" @click="applyQuick('today')">今日</el-radio-button>
        <el-radio-button value="d7" @click="applyQuick('d7')">近7天</el-radio-button>
        <el-radio-button value="month" @click="applyQuick('month')">本月</el-radio-button>
        <el-radio-button value="lastMonth" @click="applyQuick('lastMonth')">上月</el-radio-button>
        <el-radio-button value="d30" @click="applyQuick('d30')">近30天</el-radio-button>
      </el-radio-group>
      <el-date-picker
        v-model="range"
        class="range-picker"
        size="small"
        type="daterange"
        format="MM/DD"
        value-format="YYYY-MM-DD"
        range-separator="-"
        start-placeholder="开始"
        end-placeholder="结束"
        :clearable="false"
        :editable="false"
        @change="onPickerChange"
      />
      <span class="range-year">{{ rangeYear }}</span>
      <span class="range-tip">环比上周期 {{ prevRangeText }}</span>
    </div>

    <!-- 区间核心指标（含环比） -->
    <div class="kpi-grid">
      <div v-for="k in kpis" :key="k.label" class="kpi-card">
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value" :class="{ price: k.money }">{{ k.prefix }}{{ fmt(k.cur) }}</div>
        <div class="kpi-foot">
          <span class="cmp-badge" :class="cmp(k.cur, k.prev).cls">{{ cmp(k.cur, k.prev).text }}</span>
          <span class="cmp-prev">上期 {{ k.prefix }}{{ fmt(k.prev) }}</span>
        </div>
      </div>
    </div>

    <!-- 趋势 + 占比 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="14">
        <div class="page-card chart-card">
          <div class="chart-title">
            营业趋势
            <div class="seg">
              <el-radio-group v-model="trendMode" size="small" @change="onModeChange">
                <el-radio-button value="3">近3月</el-radio-button>
                <el-radio-button value="6">近6月</el-radio-button>
                <el-radio-button value="12">近12月</el-radio-button>
                <el-radio-button value="year">按年</el-radio-button>
              </el-radio-group>
              <el-select
                v-if="trendMode === 'year'"
                v-model="selectedYear"
                size="small"
                class="year-select"
                @change="loadTrend"
              >
                <el-option v-for="y in yearOptions" :key="y" :value="y" :label="`${y} 年`" />
              </el-select>
            </div>
          </div>
          <div class="vchart">
            <div
              v-for="(m, i) in trend"
              :key="m.month"
              class="vcol"
              @mousemove="showTrendTip($event, m, i)"
              @mouseleave="hideTip"
            >
              <div class="vbar-track">
                <div
                  class="vbar"
                  :style="{ height: barH(m.revenue, trendMax) }"
                  :class="{ current: m.month === currentMonth }"
                ></div>
              </div>
              <div class="vlabel">{{ m.label }}</div>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :md="10">
        <div class="page-card chart-card">
          <div class="chart-title">
            服务项目占比
            <div class="seg">
              <el-radio-group v-model="shareDim" size="small">
                <el-radio-button value="service">按项目</el-radio-button>
                <el-radio-button value="category">按分类</el-radio-button>
              </el-radio-group>
              <el-radio-group v-model="shareMetric" size="small">
                <el-radio-button value="revenue">按营收</el-radio-button>
                <el-radio-button value="count">按单量</el-radio-button>
              </el-radio-group>
            </div>
          </div>
          <div v-if="shareTotal > 0" class="donut-wrap">
            <svg viewBox="0 0 160 160" class="donut">
              <circle cx="80" cy="80" r="54" fill="none" stroke="#f1efe9" stroke-width="20" />
              <circle
                v-for="(s, i) in donutSegments"
                :key="s.name"
                class="donut-seg"
                :class="{ active: activeSeg === i }"
                cx="80"
                cy="80"
                r="54"
                fill="none"
                :stroke="s.color"
                :stroke-width="activeSeg === i ? 25 : 20"
                :stroke-dasharray="s.dash"
                :stroke-dashoffset="s.offset"
                transform="rotate(-90 80 80)"
                @mousemove="showShareTip($event, s, i)"
                @mouseleave="clearShareHover"
              />
              <text x="80" y="72" text-anchor="middle" class="donut-total">{{ centerDisplay.value }}</text>
              <text x="80" y="92" text-anchor="middle" class="donut-sub">{{ centerDisplay.sub }}</text>
            </svg>
            <div class="legend">
              <div
                v-for="(s, i) in donutSegments"
                :key="s.name"
                class="legend-row"
                :class="{ active: activeSeg === i }"
                @mousemove="showShareTip($event, s, i)"
                @mouseleave="clearShareHover"
              >
                <span class="legend-dot" :style="{ background: s.color }"></span>
                <span class="legend-name">{{ s.name }}</span>
                <span class="legend-pct">{{ s.pct }}%</span>
                <span class="legend-val">{{ shareMetric === 'revenue' ? `¥${fmt(s.value)}` : `${s.value} 单` }}</span>
              </div>
            </div>
          </div>
          <el-empty v-else description="该区间暂无消费数据" :image-size="80" />
        </div>
      </el-col>
    </el-row>

    <!-- 会员增减 + TOP + 业绩 -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="10">
        <div class="page-card chart-card">
          <div class="chart-title">
            会员增减
            <span class="title-side">{{ trendMode === 'year' ? `${selectedYear} 年累计` : `近${trendMode}月累计` }}</span>
          </div>
          <div class="member-summary">
            <span><i class="dot dot-add"></i>新增 <b>{{ memberTotals.added }}</b> 人</span>
            <span><i class="dot dot-off"></i>退卡 <b>{{ memberTotals.refunded }}</b> 人</span>
            <span>净增 <b :class="memberTotals.net >= 0 ? 'up-text' : 'down-text'">{{ memberTotals.net >= 0 ? '+' : '' }}{{ memberTotals.net }}</b> 人</span>
          </div>
          <div class="mchart">
            <div
              v-for="m in trend"
              :key="m.month"
              class="mcol"
              @mousemove="showMemberTip($event, m)"
              @mouseleave="hideTip"
            >
              <div class="mbars">
                <div class="mbar add" :style="{ height: barH(m.added, memberMax, 6) }"></div>
                <div class="mbar off" :style="{ height: barH(m.refunded, memberMax, 6) }"></div>
              </div>
              <div class="vlabel">{{ m.label }}</div>
            </div>
          </div>
          <div class="mchart-legend">
            <span><i class="dot dot-add"></i>新增会员</span>
            <span><i class="dot dot-off"></i>退卡会员</span>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :md="7">
        <div class="page-card chart-card">
          <div class="chart-title">
            项目销量 TOP
            <span class="title-side">{{ range[0] }} ~ {{ range[1] }}</span>
          </div>
          <div
            v-for="s in period?.serviceSales || []"
            :key="s.serviceId"
            class="bar-row"
            @mousemove="showTopTip($event, s)"
            @mouseleave="hideTip"
          >
            <div class="bar-name">{{ s.name }}</div>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barWidth(s.count, topMax) }"></div>
            </div>
            <div class="bar-meta">{{ s.count }} 单</div>
          </div>
          <el-empty v-if="!period?.serviceSales?.length" description="暂无数据" :image-size="70" />
        </div>
      </el-col>
      <el-col :xs="24" :md="7">
        <div class="page-card chart-card">
          <div class="chart-title">
            员工业绩与提成
            <span class="title-side">{{ range[0] }} ~ {{ range[1] }}</span>
          </div>
          <el-table :data="period?.staffPerformance || []" size="default">
            <el-table-column prop="name" label="理发师" width="90" show-overflow-tooltip />
            <el-table-column prop="orderCount" label="单数" width="60" />
            <el-table-column label="业绩" width="100">
              <template #default="{ row }">¥{{ fmt(row.revenue) }}</template>
            </el-table-column>
            <el-table-column label="提成" width="100">
              <template #default="{ row }">
                <span class="price-text">¥{{ fmt(row.commission) }}</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!period?.staffPerformance?.length" description="暂无数据" :image-size="70" />
        </div>
      </el-col>
    </el-row>

    <!-- 图表悬浮详情卡片（跟随鼠标） -->
    <div v-if="tip" class="h-tip" :class="tip.dir" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
      <div class="h-tip-title">{{ tip.title }}</div>
      <div v-for="(r, i) in tip.rows" :key="i" class="h-tip-row">
        <span>{{ r.label }}</span>
        <b :class="r.cls">{{ r.value }}</b>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '@/api'
import type { ReportData, TrendMonth } from '@/types'

const loading = ref(false)
const today = ref<ReportData | null>(null)
const period = ref<ReportData | null>(null)
const prevPeriod = ref<ReportData | null>(null)
const customerCount = ref(0)
const trend = ref<TrendMonth[]>([])
/** 趋势查看方式：近 N 月 或 按年 */
const trendMode = ref<'3' | '6' | '12' | 'year'>('6')
const selectedYear = ref(dayjs().year())
const dataYears = ref<number[]>([])
/** 年份下拉：有数据的年份 + 当前年，倒序（最近的在前） */
const yearOptions = computed(() => {
  const set = new Set([...dataYears.value, dayjs().year()])
  return [...set].sort((a, b) => b - a)
})

/** 默认区间：本月 1 号至本月最后一天（整月，未到月底也按全月） */
const fullMonthRange = (): [string, string] => [
  dayjs().startOf('month').format('YYYY-MM-DD'),
  dayjs().endOf('month').format('YYYY-MM-DD')
]
type QuickKey = 'today' | 'd7' | 'month' | 'lastMonth' | 'd30'
const range = ref<[string, string]>(fullMonthRange())
/** 当前选中的快捷区间；自定义日期时为 '' */
const quickKey = ref<QuickKey | ''>('month')
const prevRangeText = ref('')

const todayText = dayjs().format('YYYY年M月D日')
const currentMonth = dayjs().format('YYYY-MM')

/** 区间年份标签（跨年区间显示起止年份），配合 MM/DD 的短日期框 */
const rangeYear = computed(() => {
  if (!range.value?.[0]) return ''
  const y1 = range.value[0].slice(0, 4)
  const y2 = range.value[1].slice(0, 4)
  return y1 === y2 ? `${y1} 年` : `${y1}-${y2}`
})

/** 各快捷区间定义 */
const quickRanges: Record<QuickKey, () => [string, string]> = {
  today: () => {
    const d = dayjs().format('YYYY-MM-DD')
    return [d, d]
  },
  d7: () => [dayjs().subtract(6, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')],
  month: fullMonthRange,
  lastMonth: () => {
    const s = dayjs().subtract(1, 'month').startOf('month')
    return [s.format('YYYY-MM-DD'), s.endOf('month').format('YYYY-MM-DD')]
  },
  d30: () => [dayjs().subtract(29, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
}

const applyQuick = (key: QuickKey) => {
  quickKey.value = key
  range.value = quickRanges[key]()
  loadRange()
}

/** 手动选择日期：退出快捷高亮，按自定义区间统计 */
const onPickerChange = () => {
  quickKey.value = ''
  loadRange()
}

const fmt = (n?: number) => (Number(n) || 0).toFixed(2).replace(/\.00$/, '')

/** 环比徽标 */
const cmp = (cur: number, prev: number) => {
  if (!prev) return { text: cur > 0 ? '新增' : '—', cls: cur > 0 ? 'up' : 'flat' }
  const pct = ((cur - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return { text: '持平 0%', cls: 'flat' }
  return { text: `${pct > 0 ? '▲ +' : '▼ '}${pct.toFixed(1)}%`, cls: pct > 0 ? 'up' : 'down' }
}

/** 核心指标（本期 vs 上一等长周期） */
const kpis = computed(() => {
  const c = period.value
  const p = prevPeriod.value
  const mk = (label: string, key: keyof ReportData, money = false, prefix = money ? '¥' : '') => ({
    label, money, prefix,
    cur: Number(c?.[key] ?? 0),
    prev: Number(p?.[key] ?? 0)
  })
  return [
    mk('区间流水', 'revenue', true),
    mk('区间订单', 'orderCount'),
    mk('区间客单价', 'avgTicket', true),
    mk('会员充值', 'rechargeTotal', true),
    mk('有效预约', 'bookingCount')
  ]
})

/** 柱状高度（百分比），保证 0 值也有可见底线 */
const barH = (v: number, max: number, minPct = 3) => `${Math.max(v > 0 ? minPct : 1.5, (v / Math.max(1, max)) * 100)}%`
const trendMax = computed(() => Math.max(1, ...trend.value.map((m) => m.revenue)))
const memberMax = computed(() => Math.max(1, ...trend.value.flatMap((m) => [m.added, m.refunded])))

const barWidth = (count: number, max: number) => `${Math.max(4, (count / Math.max(1, max)) * 100)}%`
const topMax = computed(() => Math.max(1, ...(period.value?.serviceSales || []).map((s) => s.count)))

const memberTotals = computed(() => {
  const added = trend.value.reduce((s, m) => s + m.added, 0)
  const refunded = trend.value.reduce((s, m) => s + m.refunded, 0)
  return { added, refunded, net: added - refunded }
})

/* ---------- 服务占比环形图 ---------- */
const shareDim = ref<'service' | 'category'>('service')
const shareMetric = ref<'revenue' | 'count'>('revenue')
const PALETTE = ['#2b4a3e', '#c99a5b', '#5f8a78', '#e0bd8a', '#8aa89b', '#a8814f', '#b8c2bc']

const shareRows = computed(() => {
  const rows = shareDim.value === 'service' ? period.value?.serviceShare : period.value?.categoryShare
  return rows || []
})
const shareTotal = computed(() => shareRows.value.reduce((s, r) => s + r[shareMetric.value], 0))
/** 当前悬浮的环形图分段（null 时中心显示区间合计） */
const activeSeg = ref<number | null>(null)
const centerDisplay = computed(() => {
  const seg = activeSeg.value === null ? null : donutSegments.value[activeSeg.value]
  if (!seg) {
    return {
      value: shareMetric.value === 'revenue' ? `¥${fmt(shareTotal.value)}` : `${shareTotal.value} 单`,
      sub: shareMetric.value === 'revenue' ? '区间总营收' : '区间总单量'
    }
  }
  return {
    value: shareMetric.value === 'revenue' ? `¥${fmt(seg.value)}` : `${seg.value} 单`,
    sub: seg.name.length > 6 ? `${seg.name.slice(0, 6)}…` : seg.name
  }
})

interface Seg {
  name: string
  value: number
  revenue: number
  count: number
  color: string
  dash: string
  offset: number
  pct: string
}
const donutSegments = computed<Seg[]>(() => {
  const rows = shareRows.value
  if (!rows.length || shareTotal.value <= 0) return []
  const top = rows.slice(0, 6).map((r) => ({
    name: r.name,
    value: r[shareMetric.value],
    revenue: r.revenue,
    count: r.count
  }))
  const rest = rows.slice(6)
  if (rest.length) {
    top.push({
      name: `其他(${rest.length}项)`,
      value: rest.reduce((s, r) => s + r[shareMetric.value], 0),
      revenue: Math.round(rest.reduce((s, r) => s + r.revenue, 0) * 100) / 100,
      count: rest.reduce((s, r) => s + r.count, 0)
    })
  }
  const C = 2 * Math.PI * 54
  let acc = 0
  return top.map((r, i) => {
    const frac = r.value / shareTotal.value
    const seg: Seg = {
      name: r.name,
      value: r.value,
      revenue: r.revenue,
      count: r.count,
      color: PALETTE[i % PALETTE.length],
      dash: `${frac * C} ${C}`,
      offset: -acc * C,
      pct: (frac * 100).toFixed(1)
    }
    acc += frac
    return seg
  })
})

// 切换占比维度/指标后分段含义变化，清掉悬浮态
watch([shareDim, shareMetric], () => {
  activeSeg.value = null
  tip.value = null
})

/* ---------- 图表悬浮详情卡片 ---------- */
interface TipRow { label: string; value: string; cls?: '' | 'up' | 'down' }
const tip = ref<{ x: number; y: number; dir: 'up' | 'down'; title: string; rows: TipRow[] } | null>(null)

const place = (e: MouseEvent) => ({
  x: Math.min(Math.max(e.clientX, 120), window.innerWidth - 120),
  y: e.clientY,
  dir: (e.clientY < 220 ? 'down' : 'up') as 'up' | 'down'
})

const monthTitle = (m: string) => {
  const [y, mo] = m.split('-')
  return `${y}年${Number(mo)}月`
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/** 营业趋势柱：流水/订单/客单价/充值/会员增减 + 环比上月流水 */
const showTrendTip = (e: MouseEvent, m: TrendMonth, i: number) => {
  const prev = i > 0 ? trend.value[i - 1] : null
  const rows: TipRow[] = [
    { label: '流水', value: `¥${fmt(m.revenue)}` },
    { label: '订单', value: `${m.orderCount} 单` },
    { label: '客单价', value: `¥${fmt(m.orderCount ? m.revenue / m.orderCount : 0)}` },
    { label: '会员充值', value: `¥${fmt(m.rechargeTotal)}` },
    { label: '新增会员', value: `${m.added} 人`, cls: m.added > 0 ? 'up' : '' },
    { label: '退卡会员', value: `${m.refunded} 人`, cls: m.refunded > 0 ? 'down' : '' },
    { label: '净增会员', value: `${signed(m.netAdded)} 人`, cls: m.netAdded > 0 ? 'up' : m.netAdded < 0 ? 'down' : '' }
  ]
  if (prev) {
    let mom: TipRow
    if (prev.revenue <= 0) {
      mom = { label: '流水环比', value: m.revenue > 0 ? '上月无数据' : '—', cls: m.revenue > 0 ? 'up' : '' }
    } else {
      const pct = ((m.revenue - prev.revenue) / prev.revenue) * 100
      mom = {
        label: '流水环比',
        value: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
        cls: Math.abs(pct) < 0.05 ? '' : pct > 0 ? 'up' : 'down'
      }
    }
    rows.splice(1, 0, mom)
  } else {
    rows.splice(1, 0, { label: '流水环比', value: '—' })
  }
  tip.value = { ...place(e), title: monthTitle(m.month), rows }
}

/** 会员增减柱 */
const showMemberTip = (e: MouseEvent, m: TrendMonth) => {
  tip.value = {
    ...place(e),
    title: monthTitle(m.month),
    rows: [
      { label: '新增会员', value: `${m.added} 人`, cls: m.added > 0 ? 'up' : '' },
      { label: '退卡会员', value: `${m.refunded} 人`, cls: m.refunded > 0 ? 'down' : '' },
      { label: '净增', value: `${signed(m.netAdded)} 人`, cls: m.netAdded > 0 ? 'up' : m.netAdded < 0 ? 'down' : '' },
      { label: '当月流水', value: `¥${fmt(m.revenue)}` }
    ]
  }
}

/** 环形图分段（同时显示营收、单量、占比） */
const showShareTip = (e: MouseEvent, seg: Seg, i: number) => {
  activeSeg.value = i
  tip.value = {
    ...place(e),
    title: seg.name,
    rows: [
      { label: '营收', value: `¥${fmt(seg.revenue)}` },
      { label: '单量', value: `${seg.count} 单` },
      { label: '占比', value: `${seg.pct}%` }
    ]
  }
}

const clearShareHover = () => {
  activeSeg.value = null
  tip.value = null
}

/** 销量 TOP 条 */
const showTopTip = (
  e: MouseEvent,
  s: { serviceId: string; name: string; count: number; revenue: number }
) => {
  const all = period.value?.serviceShare || []
  const totalCount = all.reduce((sum, r) => sum + r.count, 0)
  const totalRevenue = all.reduce((sum, r) => sum + r.revenue, 0)
  const pctOf = (v: number, t: number) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : '0%')
  tip.value = {
    ...place(e),
    title: s.name,
    rows: [
      { label: '销量', value: `${s.count} 单` },
      { label: '单量占比', value: pctOf(s.count, totalCount) },
      { label: '营收', value: `¥${fmt(s.revenue)}` },
      { label: '营收占比', value: pctOf(s.revenue, totalRevenue) }
    ]
  }
}

const hideTip = () => {
  tip.value = null
}

const loadRange = async () => {
  if (!range.value || !range.value[0] || !range.value[1]) range.value = fullMonthRange()
  const [f, t] = range.value
  const fd = dayjs(f)
  const td = dayjs(t)
  const days = td.diff(fd, 'day') + 1
  const prevTo = fd.subtract(1, 'day')
  const prevFrom = prevTo.subtract(days - 1, 'day')
  prevRangeText.value = `${prevFrom.format('YYYY-MM-DD')} ~ ${prevTo.format('YYYY-MM-DD')}`
  const [cur, prev] = await Promise.all([
    api.report(f, t),
    api.report(prevFrom.format('YYYY-MM-DD'), prevTo.format('YYYY-MM-DD'))
  ])
  period.value = cur
  prevPeriod.value = prev
}

const loadTrend = async () => {
  const r =
    trendMode.value === 'year'
      ? await api.reportTrend({ year: selectedYear.value })
      : await api.reportTrend({ months: Number(trendMode.value) })
  trend.value = r.list
  dataYears.value = r.years || []
}

/** 切换查看方式；切到按年时若当前选中年份无数据则取最近的可用年份 */
const onModeChange = () => {
  if (trendMode.value === 'year' && dataYears.value.length && !dataYears.value.includes(selectedYear.value)) {
    selectedYear.value = dataYears.value[dataYears.value.length - 1]
  }
  loadTrend()
}

onMounted(async () => {
  loading.value = true
  try {
    const d = dayjs().format('YYYY-MM-DD')
    const [t, , customers] = await Promise.all([
      api.report(d, d),
      Promise.all([loadRange(), loadTrend()]),
      api.listCustomers({ page: 1, pageSize: 1 })
    ])
    today.value = t
    customerCount.value = customers.total
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.today-strip {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  margin-bottom: 14px;
}

.strip-title {
  font-size: 14px;
  font-weight: 600;
  color: #4e5969;
  white-space: nowrap;
}

.strip-date {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  color: #86909c;
}

.strip-items {
  display: flex;
  align-items: center;
  gap: 14px;
}

.strip-spacer {
  flex: 1;
}

.si-label {
  font-size: 13px;
  color: #86909c;
  margin-right: 6px;
}

.si-value {
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
}

.range-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.range-label {
  font-size: 14px;
  font-weight: 600;
  color: #4e5969;
  flex-shrink: 0;
}

.quick-group {
  flex-shrink: 0;
}

.range-picker {
  width: 196px;
  flex-shrink: 0;
}

.range-year {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
}

.range-tip {
  font-size: 12px;
  color: #86909c;
  margin-left: auto;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .range-tip {
    margin-left: 0;
  }
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
  margin-bottom: 14px;
}

.kpi-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

.kpi-label {
  font-size: 13px;
  color: #86909c;
}

.kpi-value {
  margin: 8px 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: #1d2129;
}

.kpi-value.price {
  color: var(--brand);
}

.kpi-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.cmp-badge {
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 600;
  line-height: 18px;
}

.cmp-badge.up {
  color: #1f7a4d;
  background: #e6f4ec;
}

.cmp-badge.down {
  color: #c45656;
  background: #fdecec;
}

.cmp-badge.flat {
  color: #86909c;
  background: #f2f3f5;
}

.cmp-prev {
  color: #b0b6bf;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-row {
  margin-bottom: 2px;
}

.chart-row .el-col {
  margin-bottom: 14px;
}

.chart-card {
  height: 100%;
  box-sizing: border-box;
}

.chart-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
}

.chart-title .seg {
  display: flex;
  gap: 6px;
  align-items: center;
}

.year-select {
  width: 96px;
}

.title-side {
  font-size: 12px;
  font-weight: 400;
  color: #86909c;
}

/* 营业趋势柱状图 */
.vchart {
  display: flex;
  align-items: stretch;
  gap: 10px;
  height: 230px;
}

.vcol {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  cursor: pointer;
}

.vcol:hover .vbar {
  filter: brightness(1.12);
}

.vbar-track {
  flex: 1;
  width: 100%;
  max-width: 42px;
  display: flex;
  align-items: flex-end;
}

.vbar {
  width: 100%;
  border-radius: 6px 6px 0 0;
  background: linear-gradient(180deg, var(--brand-light), var(--brand));
  transition: height 0.4s ease;
  min-height: 4px;
}

.vbar.current {
  background: linear-gradient(180deg, #d8ad6f, var(--accent));
}

.vlabel {
  margin-top: 8px;
  font-size: 12px;
  color: #86909c;
}

/* 环形占比图 */
.donut-wrap {
  display: flex;
  align-items: center;
  gap: 18px;
}

.donut {
  width: 168px;
  height: 168px;
  flex-shrink: 0;
}

.donut-seg {
  cursor: pointer;
  transition: stroke-width 0.12s ease, opacity 0.12s ease;
}

.donut-seg.active {
  opacity: 1;
}

.donut:has(.donut-seg:hover) .donut-seg:not(:hover) {
  opacity: 0.45;
}

.donut-total {
  font-size: 15px;
  font-weight: 700;
  fill: var(--brand);
}

.donut-sub {
  font-size: 9px;
  fill: #86909c;
}

.legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  padding: 3px 6px;
  margin: 0 -6px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.legend-row:hover,
.legend-row.active {
  background: #f5f2ec;
}

.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-name {
  color: #4e5969;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 110px;
}

.legend-pct {
  margin-left: auto;
  font-weight: 700;
  color: #1d2129;
}

.legend-val {
  width: 74px;
  text-align: right;
  color: #a9aeb8;
}

/* 会员增减图 */
.member-summary {
  display: flex;
  gap: 18px;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 14px;
}

.member-summary b {
  font-size: 16px;
}

.up-text {
  color: #1f7a4d;
}

.down-text {
  color: #c45656;
}

.dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  margin-right: 4px;
}

.dot-add {
  background: var(--brand);
}

.dot-off {
  background: #d97a6a;
}

.mchart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 168px;
}

.mcol {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.mcol:hover .mbar {
  filter: brightness(1.12);
}

.mbars {
  height: 140px;
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

.mbar {
  width: 14px;
  border-radius: 4px 4px 0 0;
  min-height: 3px;
}

.mbar.add {
  background: linear-gradient(180deg, var(--brand-light), var(--brand));
}

.mbar.off {
  background: linear-gradient(180deg, #e29a8d, #d97a6a);
}

.mchart-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 10px;
  font-size: 12px;
  color: #86909c;
}

/* TOP 榜 */
.bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  cursor: pointer;
  border-radius: 6px;
}

.bar-row:hover .bar-fill {
  filter: brightness(1.12);
}

.bar-name {
  width: 88px;
  flex-shrink: 0;
  font-size: 13px;
  color: #4e5969;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-track {
  flex: 1;
  height: 12px;
  border-radius: 999px;
  background: #f2f0ec;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--brand), var(--accent));
  min-width: 4px;
}

.bar-meta {
  width: 42px;
  text-align: right;
  font-size: 12px;
  color: #86909c;
}

.price-text {
  color: var(--brand);
  font-weight: 600;
}

@media (max-width: 1200px) {
  .kpi-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 悬浮详情卡片 */
.h-tip {
  position: fixed;
  z-index: 3000;
  pointer-events: none;
  min-width: 150px;
  padding: 9px 12px;
  border-radius: 8px;
  background: rgba(29, 33, 41, 0.94);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
  color: #fff;
  font-size: 12px;
  line-height: 1.5;
  transform: translate(-50%, -100%);
}

.h-tip.down {
  transform: translate(-50%, 14px);
}

.h-tip::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -5px;
  margin-left: -5px;
  border: 5px solid transparent;
  border-top-color: rgba(29, 33, 41, 0.94);
  border-bottom: 0;
}

.h-tip.down::after {
  bottom: auto;
  top: -5px;
  border-top: 0;
  border-bottom: 5px solid rgba(29, 33, 41, 0.94);
}

.h-tip-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  white-space: nowrap;
}

.h-tip-row {
  display: flex;
  justify-content: space-between;
  gap: 18px;
}

.h-tip-row span {
  color: rgba(255, 255, 255, 0.62);
}

.h-tip-row b {
  font-weight: 600;
}

.h-tip-row b.up {
  color: #7fd0a1;
}

.h-tip-row b.down {
  color: #ff9f8f;
}
</style>
