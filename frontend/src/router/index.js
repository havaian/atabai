import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import i18n from '@/utils/i18n'

// Import layouts
import UserLayout from '@/layouts/UserLayout.vue'

// ─── Public / landing ─────────────────────────────────────────────────────────
import LandingPage from '@/views/landing/LandingPage.vue'

// ─── Auth ─────────────────────────────────────────────────────────────────────
import OAuthCallback from '@/views/auth/OAuthCallback.vue'
import AuthSuccess from '@/views/auth/AuthSuccess.vue'

// ─── Misc ─────────────────────────────────────────────────────────────────────
import ComingSoon from '@/views/misc/ComingSoon.vue'
import Help from '@/views/misc/Help.vue'

// ─── App (authenticated workspace) ───────────────────────────────────────────
import Dashboard from '@/views/app/Dashboard.vue'
import Settings from '@/views/app/Settings.vue'
import UploadPage from '@/views/app/UploadPage.vue'
import ProcessingPage from '@/views/app/ProcessingPage.vue'
import FileDetailsPage from '@/views/app/FileDetailsPage.vue'
import FileHistoryPage from '@/views/app/FileHistoryPage.vue'

const routes = [
    // ── Landing ──────────────────────────────────────────────────────────────
    {
        path: '/',
        name: 'Landing',
        component: LandingPage,
        meta: {
            titleKey: 'pageTitles./',
            descriptionKey: 'pageDescriptions./'
        }
    },

    // ── Misc public ───────────────────────────────────────────────────────────
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

    // ── Auth ──────────────────────────────────────────────────────────────────
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

    // ── App (authenticated, uses UserLayout) ──────────────────────────────────
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
                path: 'history',
                name: 'FileHistory',
                component: FileHistoryPage,
                meta: {
                    titleKey: 'pageTitles./history',
                    descriptionKey: 'pageDescriptions./history'
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
            }
        ]
    },

    // ── Legacy redirects ──────────────────────────────────────────────────────
    {
        path: '/dashboard',
        redirect: '/app/dashboard'
    },
    {
        path: '/upload',
        redirect: '/app/upload'
    },

    // ── 404 ───────────────────────────────────────────────────────────────────
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

router.beforeEach(async (to, from, next) => {
    try {
        await i18n.global.$waitForI18n?.()
    } catch (error) {
        console.warn('i18n not ready, continuing anyway:', error)
    }

    const authStore = useAuthStore()

    if (to.path === '/' && authStore.isAuthenticated) {
        return next('/app/dashboard')
    }

    if (to.meta?.requiresAuth && !authStore.isAuthenticated) {
        sessionStorage.setItem('redirectAfterLogin', to.fullPath)
        return next('/')
    }

    if (to.meta?.requiresGuest && authStore.isAuthenticated) {
        return next('/app/dashboard')
    }

    next()
})

router.afterEach((to) => {
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
            updateMetaDescription(i18n.global.t(descriptionKey))
        } catch (error) {
            // ignore
        }
    }
})

export default router