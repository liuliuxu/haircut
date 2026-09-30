// 空数据库首次启动时的默认店铺设置（不含任何演示会员/员工/项目/订单，进系统后自行建档）
export const defaultSetting = {
  name: '简悦理发沙龙',
  phone: '',
  address: '',
  openTime: '09:00',
  closeTime: '21:00',
  slotInterval: 30,
  stylists: [],
  payMethods: [
    { key: 'cash', label: '现金' },
    { key: 'wechat', label: '微信' },
    { key: 'alipay', label: '支付宝' },
    { key: 'balance', label: '会员余额' },
    { key: 'package', label: '次卡核销' }
  ]
}

// ---- 以下为演示数据（已不再自动写入，仅保留供开发环境手工引用）----

export const seedSetting = {
  name: '简悦理发沙龙',
  phone: '13800001234',
  address: '东胜区铁西公园南路 12-6 号',
  openTime: '09:00',
  closeTime: '21:00',
  slotInterval: 30,
  stylists: [
    { id: 's1', name: '王磊', title: '首席设计师', phone: '13900001001', status: 'work', salaryType: 'mixed', baseSalary: 3000 },
    { id: 's2', name: '李萌', title: '造型总监', phone: '13900001002', status: 'work', salaryType: 'commission', baseSalary: 0 },
    { id: 's3', name: '陈一', title: '高级技师', phone: '13900001003', status: 'rest', salaryType: 'fixed', baseSalary: 4500 }
  ],
  payMethods: [
    { key: 'cash', label: '现金' },
    { key: 'wechat', label: '微信' },
    { key: 'alipay', label: '支付宝' },
    { key: 'balance', label: '会员余额' },
    { key: 'package', label: '次卡核销' }
  ]
}

export const seedServices = [
  { id: 'v1', name: '精剪造型', category: '剪发', price: 68, duration: 45, commissionType: 'fixed', commissionValue: 15, desc: '洗剪吹全套，打造日常好打理的发型', active: 1 },
  { id: 'v2', name: '男士快剪', category: '剪发', price: 38, duration: 20, commissionType: 'fixed', commissionValue: 8, desc: '干净利落，20 分钟快速修剪', active: 1 },
  { id: 'v3', name: '儿童剪发', category: '剪发', price: 45, duration: 30, commissionType: 'fixed', commissionValue: 10, desc: '儿童专属座椅，耐心引导', active: 1 },
  { id: 'v4', name: '质感烫发', category: '烫染', price: 298, duration: 120, commissionType: 'percent', commissionValue: 15, desc: '进口药水，自然蓬松不伤发', active: 1 },
  { id: 'v5', name: '潮流染发', category: '烫染', price: 368, duration: 120, commissionType: 'percent', commissionValue: 15, desc: '流行色卡任选，含发根补色', active: 1 },
  { id: 'v6', name: '拉直柔顺', category: '烫染', price: 268, duration: 100, commissionType: 'percent', commissionValue: 12, desc: '改善毛躁，直发垂顺', active: 1 },
  { id: 'v7', name: '深层护理', category: '护理', price: 158, duration: 60, commissionType: 'fixed', commissionValue: 25, desc: '发膜修护，改善干枯分叉', active: 1 },
  { id: 'v8', name: '头皮养护', category: '护理', price: 128, duration: 45, commissionType: 'fixed', commissionValue: 20, desc: '清洁头皮，舒缓控油', active: 1 },
  { id: 'v9', name: '洗剪吹套餐', category: '套餐', price: 88, duration: 60, commissionType: 'fixed', commissionValue: 18, desc: '洗护 + 精剪 + 造型一次搞定', active: 1 },
  { id: 'v10', name: '染烫护套餐', category: '套餐', price: 598, duration: 180, commissionType: 'percent', commissionValue: 18, desc: '烫发或染发 + 深层护理，立省百元', active: 1 }
]

export const seedCustomers = [
  { id: 'c1', name: '张晓雯', phone: '13812340001', gender: 'female', birthday: '1995-06-12', balance: 356, packages: [{ serviceId: 'v1', serviceName: '精剪造型', totalTimes: 10, remainTimes: 6 }], note: { hairType: '细软发质，发量偏少', formula: '冷棕 6/77 + 6% 双氧，比例 1:1', allergy: '无', preferStylist: 's2' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-03-10' },
  { id: 'c2', name: '李建国', phone: '13812340002', gender: 'male', birthday: '1988-02-28', balance: 0, packages: [], note: { hairType: '油性头皮', formula: '', allergy: '对便宜染发剂过敏', preferStylist: 's1' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-04-02' },
  { id: 'c3', name: '王秀英', phone: '13812340003', gender: 'female', birthday: '1975-11-05', balance: 820, packages: [{ serviceId: 'v5', serviceName: '潮流染发', totalTimes: 3, remainTimes: 1 }], note: { hairType: '粗硬白发多', formula: '栗棕遮白，发根停留 40 分钟', allergy: '无', preferStylist: 's1' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-01-18' },
  { id: 'c4', name: '陈浩然', phone: '13812340004', gender: 'male', birthday: '1996-09-21', balance: 100, packages: [], note: { hairType: '自然卷', formula: '', allergy: '无', preferStylist: 's3' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-06-22' },
  { id: 'c5', name: '刘思琪', phone: '13812340005', gender: 'female', birthday: '2000-01-15', balance: 0, packages: [{ serviceId: 'v9', serviceName: '洗剪吹套餐', totalTimes: 5, remainTimes: 3 }], note: { hairType: '受损发质，常烫染', formula: '蜜茶棕 7/3', allergy: '无', preferStylist: 's2' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-08-09' },
  { id: 'c6', name: '赵强', phone: '13812340006', gender: 'male', birthday: '1990-04-08', balance: 500, packages: [], note: { hairType: '短发，两侧推平', formula: '', allergy: '无', preferStylist: 's1' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-02-14' },
  { id: 'c7', name: '孙丽娟', phone: '13812340007', gender: 'female', birthday: '1983-07-30', balance: 0, packages: [], note: { hairType: '正常发质', formula: '酒红 5/5', allergy: '酒精过敏', preferStylist: 's2' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-05-26' },
  { id: 'c8', name: '周天宇', phone: '13812340008', gender: 'male', birthday: '1998-12-03', balance: 68, packages: [], note: { hairType: '细软塌', formula: '', allergy: '无', preferStylist: 's3' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-09-01' },
  { id: 'c9', name: '吴桂芳', phone: '13812340009', gender: 'female', birthday: '1968-03-19', balance: 1260, packages: [{ serviceId: 'v4', serviceName: '质感烫发', totalTimes: 2, remainTimes: 2 }], note: { hairType: '白发约 60%', formula: '深咖遮白', allergy: '无', preferStylist: 's1' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2024-12-05' },
  { id: 'c10', name: '郑晓峰', phone: '13812340010', gender: 'male', birthday: '1992-08-11', balance: 0, packages: [], note: { hairType: '硬发，发际线高', formula: '', allergy: '无', preferStylist: 's1' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-07-19' },
  { id: 'c11', name: '黄雅婷', phone: '13812340011', gender: 'female', birthday: '1997-10-25', balance: 240, packages: [], note: { hairType: '长发及腰', formula: '黑茶色', allergy: '无', preferStylist: 's2' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-09-20' },
  { id: 'c12', name: '马涛', phone: '13812340012', gender: 'male', birthday: '1985-05-02', balance: 0, packages: [], note: { hairType: '平头', formula: '', allergy: '无', preferStylist: 's3' }, lastVisitDate: '', visitCount: 0, totalSpend: 0, createdAt: '2025-10-01' }
]

// ---- 演示订单 / 预约（基于当天动态生成） ----
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260928)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

const pad = (n) => String(n).padStart(2, '0')
export const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtCompact = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

const commissionOf = (s) =>
  s.commissionType === 'none'
    ? 0
    : s.commissionType === 'fixed'
      ? s.commissionValue
      : Math.round(s.price * s.commissionValue) / 100

export function buildSeedOrders() {
  const now = new Date()
  const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const list = []

  const pushOrder = (day, hour, minute) => {
    const customer = pick(seedCustomers)
    const itemCount = rand() > 0.7 ? 2 : 1
    const picked = new Set()
    const items = []
    for (let i = 0; i < itemCount; i++) {
      const svc = pick(seedServices.filter((s) => !picked.has(s.id)))
      picked.add(svc.id)
      const stylist = pick(seedSetting.stylists)
      items.push({
        serviceId: svc.id, name: svc.name, price: svc.price,
        stylistId: stylist.id, stylistName: stylist.name, commission: commissionOf(svc)
      })
    }
    const total = items.reduce((s, it) => s + it.price, 0)
    const r = rand()
    const payMethod =
      r < 0.35 ? 'wechat' : r < 0.6 ? 'cash' : r < 0.75 ? 'alipay' : r < 0.92 ? 'balance' : 'package'
    const ts = new Date(todayD.getFullYear(), todayD.getMonth(), day, hour, minute, 0, 0).getTime()
    list.push({
      id: '',
      no: '',
      type: 'consume',
      customerId: customer.id, customerName: customer.name, phone: customer.phone,
      items, payMethod,
      total: payMethod === 'package' ? 0 : total,
      gift: 0, remark: '', bookingId: '',
      createdAt: ts
    })
  }

  for (let day = 1; day < todayD.getDate(); day++) {
    const n = 1 + Math.floor(rand() * 2)
    for (let i = 0; i < n; i++) {
      pushOrder(day, 10 + Math.floor(rand() * 9), [0, 30][Math.floor(rand() * 2)])
    }
  }

  // 今天的演示单必须全部落在「当前时间之前」，否则未来时间戳的演示单会把门店新开的订单压到下面
  const todaySchedule = [
    { h: 9, m: 0 }, { h: 10, m: 30 }, { h: 11, m: 0 },
    { h: 13, m: 30 }, { h: 14, m: 0 }, { h: 15, m: 30 }, { h: 16, m: 0 }
  ]
  const paySeq = ['cash', 'wechat', 'balance', 'wechat', 'alipay', 'cash', 'wechat']
  const nowTs = Date.now()
  todaySchedule
    .map((s, i) => ({
      ...s,
      i,
      ts: new Date(todayD.getFullYear(), todayD.getMonth(), todayD.getDate(), s.h, s.m, 0, 0).getTime()
    }))
    .filter((s) => s.ts <= nowTs - 10 * 60 * 1000)
    .forEach(({ i, ts }) => {
      const customer = seedCustomers[i % seedCustomers.length]
      const svc = seedServices[i % seedServices.length]
      const stylist = seedSetting.stylists[i % seedSetting.stylists.length]
      list.push({
        id: '',
        no: '',
        type: 'consume',
        customerId: customer.id, customerName: customer.name, phone: customer.phone,
        items: [{ serviceId: svc.id, name: svc.name, price: svc.price, stylistId: stylist.id, stylistName: stylist.name, commission: commissionOf(svc) }],
        payMethod: paySeq[i],
        total: svc.price,
        gift: 0, remark: '', bookingId: '',
        createdAt: ts
      })
    })

  list.sort((a, b) => a.createdAt - b.createdAt)
  // 单号按日期分段连续编号：LS20260928001、LS20260928002 …
  const daySeq = new Map()
  list.forEach((o, idx) => {
    const compact = fmtCompact(new Date(o.createdAt))
    const n = (daySeq.get(compact) || 0) + 1
    daySeq.set(compact, n)
    o.id = `o_seed_${idx + 1}`
    o.no = `LS${compact}${String(n).padStart(3, '0')}`
  })
  // 回写会员到店统计
  for (const o of list) {
    const c = seedCustomers.find((x) => x.id === o.customerId)
    if (!c) continue
    c.visitCount += 1
    c.totalSpend = Math.round((c.totalSpend + o.total) * 100) / 100
    const d = fmtDate(new Date(o.createdAt))
    if (!c.lastVisitDate || d > c.lastVisitDate) c.lastVisitDate = d
  }
  return list
}

export function buildSeedBookings() {
  const now = new Date()
  const rows = [
    [-1, '10:00', 'c2', ['v2'], 's1', 'done', 'boss'],
    [-1, '14:00', 'c7', ['v5', 'v7'], 's2', 'done', 'customer'],
    [0, '09:30', 'c3', ['v5'], 's1', 'done', 'boss'],
    [0, '10:30', 'c6', ['v2'], 's1', 'done', 'customer'],
    [0, '13:00', 'c10', ['v1'], 's2', 'confirmed', 'customer'],
    [0, '15:30', 'c4', ['v4'], 's2', 'pending', 'customer'],
    [0, '18:00', 'c8', ['v9'], 's1', 'confirmed', 'boss'],
    [1, '10:00', 'c1', ['v1'], 's2', 'confirmed', 'customer'],
    [1, '11:00', 'c11', ['v5'], 's2', 'pending', 'customer'],
    [1, '14:30', 'c9', ['v4', 'v7'], 's1', 'confirmed', 'boss'],
    [1, '19:00', 'c5', ['v9'], 's2', 'pending', 'customer'],
    [2, '10:30', 'c2', ['v1'], 's1', 'confirmed', 'customer'],
    [2, '16:00', 'c7', ['v6'], 's2', 'pending', 'boss'],
    [3, '13:30', 'c6', ['v2'], 's1', 'pending', 'customer']
  ]
  const svcMap = Object.fromEntries(seedServices.map((s) => [s.id, s]))
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return rows.map((b, i) => {
    const c = seedCustomers.find((x) => x.id === b[2])
    const duration = b[3].reduce((sum, id) => sum + svcMap[id].duration, 0)
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + b[0])
    const [h, m] = b[1].split(':').map(Number)
    const end = new Date(2000, 0, 1, h, m + duration)
    return {
      id: `b${i + 1}`,
      customerId: c.id, customerName: c.name, phone: c.phone,
      serviceIds: b[3], serviceNames: b[3].map((id) => svcMap[id].name),
      stylistId: b[4],
      date: fmtDate(d),
      startTime: b[1],
      endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      status: b[5], source: b[6], remark: '',
      createdAt: Date.now() - i * 3600000
    }
  })
}
