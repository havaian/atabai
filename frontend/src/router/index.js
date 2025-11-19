import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import i18n from '@/utils/i18n'

// Import layouts
import UserLayout from '@/layouts/UserLayout.vue'

// Import views
import LandingPage from '@/views/LandingPage.vue'
import ComingSoon from '@/views/ComingSoon.vue'
import OAuthCallback from '@/views/OAuthCallback.vue'
import AuthSuccess from '@/views/AuthSuccess.vue'
import Dashboard from '@/views/Dashboard.vue'
import Settings from '@/views/Settings.vue'
import Help from '@/views/Help.vue'
import UploadPage from '@/views/UploadPage.vue'
import ProcessingPage from '@/views/ProcessingPage.vue'
import FileDetailsPage from  '@/views/FileDetailsPage.vue'
import FileHistoryPage from '@/views/FileHistoryPage.vue'

const routes = [
    // Public routes (no layout)
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
    {
        path: '/auth/success',
        name: 'AuthSuccess',
        component: AuthSuccess,
        meta: {
            showNavbar: false,
            showFooter: false,
            requiresGuest: true,
            titleKey: 'pageTitles./auth/success',
            descriptionKey: 'pageDescriptions./auth/success'
        }
    },
    {
        path: '/help',
        name: 'Help',
        component: Help,
        meta: {
            showNavbar: false,
            showFooter: false,
            titleKey: 'pageTitles./help',
            descriptionKey: 'pageDescriptions./help'
        }
    },

    // User routes (with UserLayout)
    {
        path: '/app',
        component: UserLayout,
        meta: {
            requiresAuth: true,
            showNavbar: false,
            showFooter: false
        },
        children: [
            {
                path: '',
                redirect: '/app/dashboard'
            },
            {
                path: 'dashboard',
                name: 'Dashboard',
                component: Dashboard,
                meta: {
                    titleKey: 'pageTitles./dashboard',
                    descriptionKey: 'pageDescriptions./dashboard'
                }
            },
            {
                path: 'upload',
                name: 'Upload',
                component: UploadPage,
                meta: {
                    titleKey: 'pageTitles./upload',
                    descriptionKey: 'pageDescriptions./upload'
                }
            },
            {
                path: 'processing/:jobId',
                name: 'Processing',
                component: ProcessingPage,
                meta: {
                    titleKey: 'pageTitles./processing',
                    descriptionKey: 'pageDescriptions./processing'
                }
            },
            {
                path: 'files/:fileId',
                name: 'FileDetails',
                component: FileDetailsPage,
                meta: {
                    titleKey: 'pageTitles./results',
                    descriptionKey: 'pageDescriptions./results'
                }
            },
            {
                path: 'settings',
                name: 'Settings',
                component: Settings,
                meta: {
                    titleKey: 'pageTitles./settings',
                    descriptionKey: 'pageDescriptions./settings'
                }
            },
            {
                path: 'history',
                name: 'FileHistory', 
                component: FileHistoryPage,
                meta: {
                    titleKey: 'pageTitles./history',
                    descriptionKey: 'pageDescriptions./history'
                }
            }
        ]
    },

    // Legacy redirects
    {
        path: '/dashboard',
        redirect: '/app/dashboard'
    },
    {
        path: '/upload',
        redirect: '/app/upload'
    },

    // 404 redirect
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
        await i18n.global.$waitForI18n?.()
    } catch (error) {
        console.warn('i18n not ready, continuing anyway:', error)
    }

    // Initialize auth store if not already done
    const authStore = useAuthStore()

    // Redirect authenticated users from landing page to dashboard
    if (to.path === '/' && authStore.isAuthenticated) {
        return next('/app/dashboard')
    }

    // Check authentication for protected routes
    if (to.meta?.requiresAuth && !authStore.isAuthenticated) {
        // Save the intended destination
        sessionStorage.setItem('redirectAfterLogin', to.fullPath)
        return next('/')
    }

    // Prevent authenticated users from accessing guest-only routes
    if (to.meta?.requiresGuest && authStore.isAuthenticated) {
        return next('/app/dashboard')
    }

    // Continue to the route
    next()
})

router.afterEach((to) => {
    // Update page title and meta description after navigation
    const titleKey = to.meta?.titleKey
    const descriptionKey = to.meta?.descriptionKey

    if (titleKey) {
        try {
            const title = i18n.global.t(titleKey)
            document.title = `${title} - ATABAI`
        } catch (error) {
            document.title = 'ATABAI - IFRS Automation Platform'
        }
    }

    if (descriptionKey) {
        try {
            const description = i18n.global.t(descriptionKey)
            updateMetaDescription(description)
        } catch (error) {
            // Ignore translation errors for meta description
        }
    }
})

export default router