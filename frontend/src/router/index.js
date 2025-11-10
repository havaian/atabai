import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import i18n from '@/utils/i18n' // Import the i18n instance

// Import views
import LandingPage from '@/views/LandingPage.vue'
import ComingSoon from '@/views/ComingSoon.vue'
import OAuthCallback from '@/views/OAuthCallback.vue'
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
            titleKey: 'pageTitles./',
            descriptionKey: 'pageDescriptions./'
        }
    },
    {
        path: '/coming-soon',
        name: 'ComingSoon',
        component: ComingSoon,
        meta: {
            showNavbar: false,
            showFooter: false,
            titleKey: 'pageTitles./coming-soon',
            descriptionKey: 'pageDescriptions./coming-soon'
        }
    },
    {
        path: '/auth/callback',
        name: 'OAuthCallback',
        component: OAuthCallback,
        meta: {
            showNavbar: false,
            showFooter: false,
            titleKey: 'pageTitles./auth/callback',
            descriptionKey: 'pageDescriptions./auth/callback'
        }
    },
    // {
    //     path: '/dashboard',
    //     name: 'Dashboard',
    //     component: Dashboard,
    //     meta: {
    //         requiresAuth: true,
    //         titleKey: 'pageTitles./dashboard',
    //         descriptionKey: 'pageDescriptions./dashboard'
    //     }
    // },
    // {
    //     path: '/templates',
    //     name: 'Templates',
    //     component: TemplatesPage,
    //     meta: {
    //         requiresAuth: true,
    //         titleKey: 'pageTitles./templates',
    //         descriptionKey: 'pageDescriptions./templates'
    //     }
    // },
    // {
    //     path: '/processing/:jobId?',
    //     name: 'Processing',
    //     component: ProcessingPage,
    //     meta: {
    //         requiresAuth: true,
    //         titleKey: 'pageTitles./processing',
    //         descriptionKey: 'pageDescriptions./processing'
    //     }
    // },
    // {
    //     path: '/results/:jobId',
    //     name: 'Results',
    //     component: ResultsPage,
    //     meta: {
    //         requiresAuth: true,
    //         titleKey: 'pageTitles./results',
    //         descriptionKey: 'pageDescriptions./results'
    //     }
    // },
    // {
    //     path: '/profile',
    //     name: 'Profile',
    //     component: ProfilePage,
    //     meta: {
    //         requiresAuth: true,
    //         titleKey: 'pageTitles./profile',
    //         descriptionKey: 'pageDescriptions./profile'
    //     }
    // },
    // {
    //     path: '/history',
    //     name: 'History',
    //     component: HistoryPage,
    //     meta: {
    //         requiresAuth: true,
    //         titleKey: 'pageTitles./history',
    //         descriptionKey: 'pageDescriptions./history'
    //     }
    // },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/',
        meta: {
            showNavbar: false,
            showFooter: false
        }
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

// Helper function to update meta description
function updateMetaDescription(description) {
    if (!description) return

    let metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
        metaDescription.content = description
    } else {
        metaDescription = document.createElement('meta')
        metaDescription.name = 'description'
        metaDescription.content = description
        document.head.appendChild(metaDescription)
    }
}

// Navigation guards
router.beforeEach(async (to, from, next) => {
    // Wait for i18n to be ready
    try {
        await i18n.global.$waitForI18n?.() || Promise.resolve()
    } catch (error) {
        console.warn('Router: i18n not ready, using fallback titles')
    }

    // Update page title and description
    updatePageTitleAndDescription(to)

    // Check authentication
    const authStore = useAuthStore()
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next({ name: 'Landing', query: { redirect: to.fullPath } })
    } else {
        next()
    }
})

// Function to update page title and description
function updatePageTitleAndDescription(route) {
    // Set page title
    if (route.meta.titleKey) {
        try {
            const title = i18n.global.t(route.meta.titleKey)
            if (title && title !== route.meta.titleKey) {
                document.title = `${title} | ATABAI`
            } else {
                // Fallback if translation not found
                document.title = 'ATABAI - Excel Automation for IFRS'
            }
        } catch (error) {
            console.warn('Router: Error setting title:', error)
            document.title = 'ATABAI'
        }
    } else {
        // Default title
        document.title = 'ATABAI'
    }

    // Set meta description
    if (route.meta.descriptionKey) {
        try {
            const description = i18n.global.t(route.meta.descriptionKey)
            if (description && description !== route.meta.descriptionKey) {
                updateMetaDescription(description)
            }
        } catch (error) {
            console.warn('Router: Error setting description:', error)
        }
    }
}

// Watch for locale changes and update current page title
let localeWatcher = null
router.afterEach((to) => {
    // Set up locale watcher only once
    if (!localeWatcher) {
        localeWatcher = i18n.global.locale

        // Use Vue's watch if available, otherwise use a simple approach
        if (typeof window !== 'undefined' && window.Vue?.watch) {
            window.Vue.watch(() => i18n.global.locale.value, (newLocale, oldLocale) => {
                updatePageTitleAndDescription(router.currentRoute.value)
            })
        } else {
            // Fallback: check for locale changes periodically
            let lastLocale = i18n.global.locale.value
            setInterval(() => {
                const currentLocale = i18n.global.locale.value
                if (currentLocale !== lastLocale) {
                    updatePageTitleAndDescription(router.currentRoute.value)
                    lastLocale = currentLocale
                }
            }, 100) // Check every 100ms
        }
    }
})

// Make router globally accessible for i18n utility
if (typeof window !== 'undefined') {
    window.__VUE_ROUTER__ = router
}

export default router