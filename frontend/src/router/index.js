import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Import views
import LandingPage from '@/views/LandingPage.vue'
// import Dashboard from '@/views/Dashboard.vue'
// import ProcessingPage from '@/views/ProcessingPage.vue'
// import ResultsPage from '@/views/ResultsPage.vue'
// import ProfilePage from '@/views/ProfilePage.vue'
// import HistoryPage from '@/views/HistoryPage.vue'
// import TemplatesPage from '@/views/TemplatesPage.vue'

const routes = [
    {
        path: '/',
        name: 'Landing',
        component: LandingPage,
        meta: {
            title: 'ATABAI - Автоматизация Excel для МСФО',
            description: 'Платформа для автоматизации финансовых расчетов в Excel в соответствии с требованиями МСФО'
        }
    },
    // {
    //     path: '/dashboard',
    //     name: 'Dashboard',
    //     component: Dashboard,
    //     meta: {
    //         requiresAuth: true,
    //         title: 'Рабочий стол - ATABAI'
    //     }
    // },
    // {
    //     path: '/templates',
    //     name: 'Templates',
    //     component: TemplatesPage,
    //     meta: {
    //         requiresAuth: true,
    //         title: 'Шаблоны МСФО - ATABAI'
    //     }
    // },
    // {
    //     path: '/processing/:jobId?',
    //     name: 'Processing',
    //     component: ProcessingPage,
    //     meta: {
    //         requiresAuth: true,
    //         title: 'Обработка файла - ATABAI'
    //     }
    // },
    // {
    //     path: '/results/:jobId',
    //     name: 'Results',
    //     component: ResultsPage,
    //     meta: {
    //         requiresAuth: true,
    //         title: 'Результаты обработки - ATABAI'
    //     }
    // },
    // {
    //     path: '/profile',
    //     name: 'Profile',
    //     component: ProfilePage,
    //     meta: {
    //         requiresAuth: true,
    //         title: 'Профиль - ATABAI'
    //     }
    // },
    // {
    //     path: '/history',
    //     name: 'History',
    //     component: HistoryPage,
    //     meta: {
    //         requiresAuth: true,
    //         title: 'История файлов - ATABAI'
    //     }
    // },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/'
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
            return savedPosition
        } else if (to.hash) {
            return { el: to.hash, behavior: 'smooth' }
        } else {
            return { top: 0, behavior: 'smooth' }
        }
    }
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()

    // Set page title
    if (to.meta.title) {
        document.title = to.meta.title
    }

    // Set meta description
    if (to.meta.description) {
        const metaDescription = document.querySelector('meta[name="description"]')
        if (metaDescription) {
            metaDescription.content = to.meta.description
        }
    }

    // Check authentication
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next({ name: 'Landing', query: { redirect: to.fullPath } })
    } else {
        next()
    }
})

export default router