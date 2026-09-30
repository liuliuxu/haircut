import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      component: () => import('@/layout/MainLayout.vue'),
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '经营总览' } },
        { path: 'cashier', name: 'cashier', component: () => import('@/views/Cashier.vue'), meta: { title: '收银开单' } },
        { path: 'bookings', name: 'bookings', component: () => import('@/views/Bookings.vue'), meta: { title: '预约管理' } },
        { path: 'orders', name: 'orders', component: () => import('@/views/Orders.vue'), meta: { title: '订单流水' } },
        { path: 'members', name: 'members', component: () => import('@/views/Members.vue'), meta: { title: '会员管理' } },
        { path: 'services', name: 'services', component: () => import('@/views/Services.vue'), meta: { title: '服务项目' } },
        { path: 'staff', name: 'staff', component: () => import('@/views/Staff.vue'), meta: { title: '员工管理' } },
        { path: 'salary', name: 'salary', component: () => import('@/views/Salary.vue'), meta: { title: '工资统计' } },
        { path: 'export', name: 'export', component: () => import('@/views/ExportCenter.vue'), meta: { title: '数据导出' } },
        { path: 'settings', name: 'settings', component: () => import('@/views/Settings.vue'), meta: { title: '店铺设置' } }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

router.beforeEach((to) => {
  const token = localStorage.getItem('barber_admin_token')
  if (!to.meta.public && !token) {
    return { path: '/login' }
  }
  if (to.path === '/login' && token) {
    return { path: '/dashboard' }
  }
  return true
})

export default router
