// @ts-nocheck
/* eslint-disable */
/**
 * Auto-converted from src/router/index.js.
 * Behavior preserved 1:1; types tightened later.
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationsStore } from '@/stores/organizations'
import i18n from '@/utils/i18n'

// Import layouts
import UserLayout from '@/layouts/UserLayout.vue'

// ─── Public / landing ─────────────────────────────────────────────────────────
import LandingPage from '@/views/landing/LandingPage.vue'

// ─── Auth ─────────────────────────────────────────────────────────────────────
import OAuthCallback from '@/views/auth/OAuthCallback.vue'
import AuthSuccess from '@/views/auth/AuthSuccess.vue'
import LoginPage from '@/views/auth/LoginPage.vue'

// ─── Misc ─────────────────────────────────────────────────────────────────────
import ComingSoon from '@/views/misc/ComingSoon.vue'
import Help from '@/views/misc/Help.vue'

// ─── App (authenticated workspace) ───────────────────────────────────────────
import Dashboard from '@/views/app/Dashboard.vue'
import Settings from '@/views/app/Settings.vue'
import OnboardingView from '@/views/app/OnboardingView.vue'
import OrganizationsListView from '@/views/app/OrganizationsListView.vue'
import OrganizationMembersView from '@/views/app/OrganizationMembersView.vue'
import OrgProfileView from '@/views/app/OrgProfileView.vue'
import BankUploadView from '@/views/app/BankUploadView.vue'
import BankBatchesView from '@/views/app/BankBatchesView.vue'
import BankPreviewView from '@/views/app/BankPreviewView.vue'
import InvoiceUploadView from '@/views/app/InvoiceUploadView.vue'
import InvoiceBatchesView from '@/views/app/InvoiceBatchesView.vue'
import InvoicePreviewView from '@/views/app/InvoicePreviewView.vue'
import PeriodsView from '@/views/app/PeriodsView.vue'
import ChartOfAccountsView from '@/views/app/ChartOfAccountsView.vue'
import OpeningBalancesView from '@/views/app/OpeningBalancesView.vue'

// ─── Admin ────────────────────────────────────────────────────────────────────
import AdminLayout from '@/layouts/AdminLayout.vue'
import AdminDashboard from '@/views/admin/AdminDashboard.vue'
import AdminUsers from '@/views/admin/AdminUsers.vue'
import AdminUserDetail from '@/views/admin/AdminUserDetail.vue'
import AdminSecuritySettings from '@/views/admin/AdminSecuritySettings.vue'
import AdminLocales from '@/views/admin/AdminLocales.vue'
import AdminAccess from '@/views/admin/AdminAccess.vue'

// ─── i18n URL routing ─────────────────────────────────────────────────────────
// All non-prefixed paths are auto-redirected to a prefixed equivalent by the
// guard below. The list of valid locales must stay in sync with utils/i18n.js
// — kept duplicated rather than importing because the router needs it during
// route definition (before i18n is fully initialized).
const SUPPORTED_LOCALES = ['ru', 'en', 'uz']
const DEFAULT_LOCALE = 'ru'
// localStorage key used by utils/i18n.js to persist the user's last choice.
// Reused here so a cold-start visit to "/" lands on the user's preferred
// locale rather than always falling back to DEFAULT_LOCALE.
const LOCALE_STORAGE_KEY = 'locale'

/**
 * Read the most-recently-chosen locale from localStorage, falling back to
 * DEFAULT_LOCALE. Used only when bootstrapping a request with no locale
 * prefix in the URL.
 *
 * Wrapped in try/catch because localStorage can throw in private-mode
 * Safari and some embedded contexts.
 */
function getBootstrapLocale() {
    try {
        const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
        if (stored && SUPPORTED_LOCALES.includes(stored)) return stored
    } catch (_) {
        // localStorage unavailable — fall through to default
    }
    return DEFAULT_LOCALE
}

/**
 * Test whether the first path segment is a valid locale code. Used to
 * decide whether the incoming URL already has the prefix we expect, or
 * needs the guard to add one.
 */
function pathHasLocale(path) {
    const seg = path.split('/')[1]
    return SUPPORTED_LOCALES.includes(seg)
}

/**
 * Strip the leading locale segment from a path, if present. Returns a
 * path that always starts with '/' (so '/en/app' → '/app', '/en' → '/').
 * Used when remapping the URL during language switches.
 */
function stripLocale(path) {
    const parts = path.split('/')
    if (parts.length >= 2 && SUPPORTED_LOCALES.includes(parts[1])) {
        const rest = parts.slice(2).join('/')
        return rest ? `/${rest}` : '/'
    }
    return path
}

/**
 * Subroutes shared between the locale-prefixed parent and any flat
 * convenience redirects. Factored out so we don't repeat the entire
 * route tree twice when wiring legacy URLs.
 */
const appChildren = [
    { path: '', redirect: to => `/${to.params.locale || DEFAULT_LOCALE}/app/dashboard` },
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
        path: 'settings',
        name: 'Settings',
        component: Settings,
        meta: {
            titleKey: 'pageTitles./settings',
            descriptionKey: 'pageDescriptions./settings'
        }
    },

    // ─── Organizations (access spine + bootstrap) ──────────────────────────
    {
        path: 'organizations',
        name: 'Organizations',
        component: OrganizationsListView,
        meta: { titleKey: 'pageTitles./organizations' }
    },
    {
        path: 'organizations/onboarding',
        name: 'Onboarding',
        component: OnboardingView,
        meta: { titleKey: 'pageTitles./onboarding', showNavbar: false }
    },
    {
        path: 'organizations/members',
        name: 'OrganizationMembers',
        component: OrganizationMembersView,
        meta: { titleKey: 'pageTitles./members', requiresOrg: true }
    },
    {
        path: 'organizations/profile',
        name: 'OrgProfile',
        component: OrgProfileView,
        meta: { titleKey: 'pageTitles./orgProfile', requiresOrg: true }
    },

    // ─── Ledger (per org / period) ─────────────────────────────────────────
    // All org-scoped — guarded by requiresOrg below.
    {
        path: 'ledger/periods',
        name: 'Periods',
        component: PeriodsView,
        meta: { titleKey: 'pageTitles./periods', requiresOrg: true }
    },
    {
        path: 'ledger/chart',
        name: 'ChartOfAccounts',
        component: ChartOfAccountsView,
        meta: { titleKey: 'pageTitles./chart', requiresOrg: true }
    },
    {
        path: 'ledger/periods/:periodId/bank-statements',
        name: 'BankUpload',
        component: BankUploadView,
        meta: { titleKey: 'pageTitles./bankUpload', requiresOrg: true }
    },
    {
        path: 'ledger/periods/:periodId/bank-batches',
        name: 'BankBatches',
        component: BankBatchesView,
        meta: { titleKey: 'pageTitles./bankBatches', requiresOrg: true }
    },
    {
        path: 'ledger/periods/:periodId/bank-statements/:uploadId',
        name: 'BankPreview',
        component: BankPreviewView,
        meta: { titleKey: 'pageTitles./bankPreview', requiresOrg: true }
    },
    {
        path: 'ledger/periods/:periodId/opening-balances',
        name: 'OpeningBalances',
        component: OpeningBalancesView,
        meta: { titleKey: 'pageTitles./openingBalances', requiresOrg: true }
    },
    {
        path: 'ledger/periods/:periodId/invoices',
        name: 'InvoiceUpload',
        component: InvoiceUploadView,
        meta: { titleKey: 'pageTitles./invoiceUpload', requiresOrg: true }
    },
    {
        path: 'ledger/periods/:periodId/invoice-batches',
        name: 'InvoiceBatches',
        component: InvoiceBatchesView,
        meta: { titleKey: 'pageTitles./invoiceBatches', requiresOrg: true }
    },
    {
        path: 'ledger/periods/:periodId/invoices/:uploadId',
        name: 'InvoicePreview',
        component: InvoicePreviewView,
        meta: { titleKey: 'pageTitles./invoicePreview', requiresOrg: true }
    }
]

const adminChildren = [
    {
        path: '',
        name: 'AdminDashboard',
        component: AdminDashboard,
        meta: { titleKey: null, descriptionKey: null }
    },
    { path: 'users', name: 'AdminUsers', component: AdminUsers },
    { path: 'users/:userId', name: 'AdminUserDetail', component: AdminUserDetail },
    {
        path: 'security',
        name: 'AdminSecuritySettings',
        component: AdminSecuritySettings
    },
    { path: 'locales', name: 'AdminLocales', component: AdminLocales },
    { path: 'access', name: 'AdminAccess', component: AdminAccess }
]

const routes = [
    // ─── Locale-prefixed routes ──────────────────────────────────────────────
    // Everything lives under /:locale so the locale is reflected in the URL.
    // The regex `(ru|en|uz)` makes the param picky: '/foobar/...' fails the
    // match and falls through to the catch-all redirect below, which then
    // adds the bootstrap locale.
    {
        path: '/:locale(ru|en|uz)',
        children: [
            // Landing
            {
                path: '',
                name: 'Landing',
                component: LandingPage,
                meta: {
                    titleKey: 'pageTitles./',
                    descriptionKey: 'pageDescriptions./'
                }
            },

            // Misc public
            {
                path: 'coming-soon',
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
                path: 'help',
                name: 'Help',
                component: Help,
                meta: {
                    showNavbar: false,
                    showFooter: false,
                    titleKey: 'pageTitles./help',
                    descriptionKey: 'pageDescriptions./help'
                }
            },

            // Auth
            {
                path: 'auth/callback',
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
                path: 'login',
                name: 'Login',
                component: LoginPage,
                meta: {
                    showNavbar: false,
                    showFooter: false,
                    requiresGuest: true,
                    titleKey: 'pageTitles./login',
                    descriptionKey: 'pageDescriptions./login'
                }
            },
            {
                path: 'auth/success',
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

            // App (authenticated, uses UserLayout)
            {
                path: 'app',
                component: UserLayout,
                meta: {
                    requiresAuth: true,
                    showNavbar: false,
                    showFooter: false
                },
                children: appChildren
            },

            // Admin
            {
                path: 'admin',
                component: AdminLayout,
                meta: {
                    requiresAuth: true,
                    requiresAdmin: true,
                    showNavbar: false,
                    showFooter: false
                },
                children: adminChildren
            },

            // Legacy redirects inside the locale tree — kept so bookmarks of
            // the pre-i18n URLs (/dashboard, /upload) still resolve after
            // the locale guard prepends the prefix.
            {
                path: 'dashboard',
                redirect: to => `/${to.params.locale || DEFAULT_LOCALE}/app/dashboard`
            }
            // NOTE: previously had an inside-locale catch-all here
            // (`:pathMatch(.*)*` redirecting to `/<locale>/`). Removed because
            // it could match before legitimate children under app/admin in
            // some routing situations, causing valid pages to silently
            // redirect to landing. Genuine 404s under a locale still fall
            // through to the outer NoLocale catchall below.
        ]
    },

    // ── Catch-all (no locale prefix matched) ─────────────────────────────────
    // The guard `beforeEach` below detects these requests, looks up the
    // bootstrap locale, and redirects so the URL gets a prefix. This route
    // is just here to make sure router.resolve() succeeds during the
    // initial navigation; the actual redirect logic lives in the guard.
    {
        path: '/:pathMatch(.*)*',
        name: 'NoLocale',
        component: { render: () => null }
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

/**
 * Guard pass 1: enforce a locale prefix on every URL.
 *
 * For any request whose path doesn't start with a valid locale segment,
 * we redirect to the same path with the bootstrap locale prepended. The
 * bootstrap locale comes from localStorage (so returning visitors land
 * on the language they last chose) with DEFAULT_LOCALE as the fallback.
 *
 * This is what makes every existing `router.push('/app/dashboard')` and
 * `<router-link to="/app/foo">` keep working without modification — they
 * land on the catch-all and get rewritten transparently.
 */
router.beforeEach((to, from, next) => {
    if (!pathHasLocale(to.path)) {
        const locale = getBootstrapLocale()
        // Build the prefixed path WITHOUT query/hash, and pass query/hash
        // through as separate fields. Passing a single string to next()
        // works for path-only redirects but is fragile when there's a
        // query string — the parser doesn't always reattach it. Using the
        // structured form guarantees `?template=balanceSheet` survives.
        const prefixed = to.path === '/' ? `/${locale}/` : `/${locale}${to.path}`
        return next({
            path: prefixed,
            query: to.query,
            hash: to.hash,
            replace: true,
        })
    }
    next()
})

/**
 * Guard pass 2: synchronise i18n with the URL's locale segment.
 *
 * Whenever the URL's locale differs from i18n's current locale, switch
 * i18n (and persist the choice to localStorage via setLocale). This is
 * what allows direct visits to /en/app/dashboard to render in English
 * even when localStorage said "ru" — the URL is the source of truth
 * during a session.
 */
router.beforeEach(async (to, from, next) => {
    try {
        await i18n.global.$waitForI18n?.()
    } catch (error) {
        console.warn('i18n not ready, continuing anyway:', error)
    }

    const urlLocale = to.params.locale
    if (urlLocale && SUPPORTED_LOCALES.includes(urlLocale)) {
        const currentLocale = i18n.global.locale.value
        if (currentLocale !== urlLocale) {
            // changeLocale is async (it loads bundle files); we don't await
            // because the i18n bootstrap already loaded the default + stored
            // locale, and switching is fast for already-loaded locales.
            // For not-yet-loaded locales there's a brief flash but the route
            // resolves so the user isn't blocked.
            try {
                const { changeLocale } = await import('@/utils/i18n')
                await changeLocale(urlLocale)
            } catch (err) {
                console.warn('Failed to sync i18n to URL locale:', err)
            }
        }
    }

    next()
})

/**
 * Guard pass 3: auth gating. Kept separate from pass 1 (locale enforcement)
 * because the locale guard MUST run first — if we redirected to /login from
 * a path without a locale prefix, the redirect target would itself be
 * unprefixed and bounce back through pass 1 anyway.
 */
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()
    const locale = to.params.locale || getBootstrapLocale()

    // Bare /<locale>/ → /<locale>/app/dashboard for authenticated users
    if (to.path === `/${locale}` || to.path === `/${locale}/`) {
        if (authStore.isAuthenticated) {
            return next(`/${locale}/app/dashboard`)
        }
    }

    if (to.meta?.requiresAuth && !authStore.isAuthenticated) {
        sessionStorage.setItem('redirectAfterLogin', to.fullPath)
        return next(`/${locale}/login`)
    }

    if (to.meta?.requiresGuest && authStore.isAuthenticated) {
        return next(`/${locale}/app/dashboard`)
    }

    next()
})

/**
 * Guard pass 4: org-aware redirects.
 *
 *   - Just-logged-in users with no orgs and no pending invites are funneled
 *     into the onboarding wizard. Architecture doc §8.3: "IA shifts from
 *     file-centric to org+period-centric" — an empty workspace IS the
 *     onboarding workspace.
 *   - Routes marked `requiresOrg: true` redirect to /app/organizations when
 *     the user has no active org selected.
 *   - Skip both checks on the onboarding/organizations pages themselves
 *     (otherwise we'd loop) and on non-app routes (auth, landing, admin).
 */
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()
    const locale = to.params.locale || getBootstrapLocale()

    // Only relevant inside the authenticated /app/ tree.
    if (!authStore.isAuthenticated) return next()
    if (!to.path.includes('/app/')) return next()

    const orgsStore = useOrganizationsStore()
    // Best-effort init — failures (network, 401 during refresh) shouldn't
    // block routing entirely. The store surfaces the error; the user sees it.
    try {
        await orgsStore.ensureInitialized()
    } catch (_) {
        return next()
    }

    const onOnboarding = to.name === 'Onboarding'
    const onOrgsList = to.name === 'Organizations'

    // Funnel empty workspaces to the wizard. Settings is the only org-less
    // page worth keeping accessible (user can edit their profile / sign out).
    if (orgsStore.needsOnboarding && !onOnboarding && to.name !== 'Settings') {
        return next(`/${locale}/app/organizations/onboarding`)
    }

    // requiresOrg routes need an active org. List + onboarding are exempt by
    // design — they're how the user GETS an active org in the first place.
    if (to.meta?.requiresOrg && !orgsStore.currentOrgId && !onOnboarding && !onOrgsList) {
        return next(`/${locale}/app/organizations`)
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

// Expose helpers used by utils/i18n.js when changing locale at runtime.
// changeLocale() needs to rewrite the current URL to use the new prefix
// without losing the rest of the path; stripLocale + currentLocale make
// that a one-liner there.
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, stripLocale }

export default router
