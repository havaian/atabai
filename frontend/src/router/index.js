import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Import views
import LandingPage from '@/views/LandingPage.vue'
import ComingSoon from '@/views/ComingSoon.vue'
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
        component: LandingPage
    },
    {
        path: '/coming-soon',
        name: 'ComingSoon',
        component: ComingSoon
    },
    // {
    //     path: '/dashboard',
    //     name: 'Dashboard',
    //     component: Dashboard,
    //     meta: {
    //         requiresAuth: true
    //     }
    // },
    // {
    //     path: '/templates',
    //     name: 'Templates',
    //     component: TemplatesPage,
    //     meta: {
    //         requiresAuth: true
    //     }
    // },
    // {
    //     path: '/processing/:jobId?',
    //     name: 'Processing',
    //     component: ProcessingPage,
    //     meta: {
    //         requiresAuth: true
    //     }
    // },
    // {
    //     path: '/results/:jobId',
    //     name: 'Results',
    //     component: ResultsPage,
    //     meta: {
    //         requiresAuth: true
    //     }
    // },
    // {
    //     path: '/profile',
    //     name: 'Profile',
    //     component: ProfilePage,
    //     meta: {
    //         requiresAuth: true
    //     }
    // },
    // {
    //     path: '/history',
    //     name: 'History',
    //     component: HistoryPage,
    //     meta: {
    //         requiresAuth: true
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

    // Meta descriptions are now handled automatically by the global composable
    // No need to manually set them here

    // Check authentication
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next({ name: 'Landing', query: { redirect: to.fullPath } })
    } else {
        next()
    }
})

export default router