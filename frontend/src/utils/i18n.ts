// @ts-nocheck
/* eslint-disable */
/**
 * Auto-converted from src/utils/i18n.js.
 * Behavior preserved 1:1; types tightened later.
 */

import { createI18n } from 'vue-i18n'
import axios from 'axios'

// Available locales configuration
export const availableLocales = [
    { code: 'en', name: 'English', flag: 'gb' },
    { code: 'ru', name: 'Русский', flag: 'ru' },
    { code: 'uz', name: "O'zbek", flag: 'uz' },
]

// Default locale
const DEFAULT_LOCALE = 'ru'

// API base - uses the same base URL convention as the rest of the app.
// We use a bare axios call here (no apiClient) because i18n must load before
// auth state exists and we don't want translations to fail if auth fails.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// Get stored locale from localStorage
export function getStoredLocale() {
    try {
        return localStorage.getItem('locale') || DEFAULT_LOCALE
    } catch (error) {
        console.warn('Could not access localStorage for locale:', error)
        return DEFAULT_LOCALE
    }
}

// Set locale and store in localStorage
export function setLocale(locale) {
    const validLocale = availableLocales.find(l => l.code === locale)?.code || DEFAULT_LOCALE

    try {
        localStorage.setItem('locale', validLocale)
    } catch (error) {
        console.warn('Could not save locale to localStorage:', error)
    }

    if (i18n.global.locale) {
        i18n.global.locale.value = validLocale
    }
    return validLocale
}

/**
 * Stage 1: Load locale messages from bundled JSON files (synchronous-fast).
 * This is the bootstrap source - guarantees UI has translations before any
 * network request. After init, fetchAndMergeFromAPI() overlays fresh values
 * from the database on top.
 */
async function loadLocaleMessages(locale) {
    try {
        const messages = await import(`../locales/${locale}.json`)
        const baseMessages = messages.default

        // Merge admin namespace locale (separate file to keep main locale files
        // stable when admin UI strings change).
        try {
            const adminMessages = await import(`../locales/admin-${locale}.json`)
            // Admin file has shape { admin: {...} } - merge at root level
            return { ...baseMessages, ...adminMessages.default }
        } catch (adminErr) {
            // No admin locale for this language - proceed without it
            return baseMessages
        }
    } catch (error) {
        console.warn(`Failed to load locale ${locale}, falling back to ${DEFAULT_LOCALE}`)
        if (locale !== DEFAULT_LOCALE) {
            return await loadLocaleMessages(DEFAULT_LOCALE)
        }
        // Return basic fallback messages if even default locale fails
        return {
            nav: {
                home: 'Home',
                dashboard: 'Dashboard',
                templates: 'Templates',
                profile: 'Profile',
                history: 'History'
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2: DB overlay (hot-reload from /api/locales/bundle)
// ─────────────────────────────────────────────────────────────────────────────

// Last seen bundle versions per app. When server reports a newer version,
// we re-fetch that app's bundle for the current locale.
const lastSeenVersions = {} // { user: 3, admin: 7 } - keyed by app

/**
 * Deep-merge source into target. Mutates target. Strings in source override
 * strings in target. New keys are added. Nested objects merge recursively.
 *
 * This is needed because vue-i18n setLocaleMessage replaces the whole message
 * tree - we want to PRESERVE bundled values for keys the DB doesn't have,
 * while overlaying DB values for keys that DO exist.
 */
function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target
    for (const key of Object.keys(source)) {
        const sv = source[key]
        if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {}
            }
            deepMerge(target[key], sv)
        } else if (sv !== null && sv !== undefined) {
            target[key] = sv
        }
    }
    return target
}

/**
 * Fetch the DB bundle for one app+lang and merge it into the current i18n
 * messages for that locale.
 *
 * Best-effort: if the API isn't reachable (offline, server down, network
 * error), silently fall back to bundled values that are already loaded.
 */
async function fetchAndMergeApp(app, locale) {
    try {
        const url = `${API_BASE}/locales/bundle/${app}/${locale}`
        const { data } = await axios.get(url, { timeout: 8000 })
        if (!data?.success || !data.bundle) return

        // Track the version we just loaded so the poller knows when to refresh
        if (typeof data.version === 'number') {
            lastSeenVersions[app] = data.version
        }

        // Deep-merge the DB bundle on top of current messages, write back
        const current = i18n.global.getLocaleMessage(locale) || {}
        const merged = deepMerge({ ...current }, data.bundle)
        i18n.global.setLocaleMessage(locale, merged)
    } catch (err) {
        // Don't log every 401/network blip - the bundled JSON is already serving.
        // Only log unexpected errors to help diagnose real issues.
        if (err.response && err.response.status >= 500) {
            console.warn(`Locale bundle fetch failed for ${app}/${locale}:`, err.message)
        }
    }
}

/**
 * Fetch both user and admin bundles for a given locale and merge them.
 * Called after the initial bundled load and on each locale change.
 */
async function fetchAndMergeFromAPI(locale) {
    // Run both in parallel - they're independent
    await Promise.all([
        fetchAndMergeApp('user', locale),
        fetchAndMergeApp('admin', locale)
    ])
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3: Polling for version changes - DISABLED
// ─────────────────────────────────────────────────────────────────────────────
// Locale strings do not change on the scale of seconds. The DB overlay is
// loaded once at boot (Stage 2) and re-fetched on locale change. When an
// admin edits a key in the locale editor, refreshLocaleFromAPI() is called
// directly in that session so the editor sees its own change immediately.
// Other users pick up the new strings on next page load - that is fine.
//
// The previous version polled /api/locales/version every 30s for every
// open tab of every user, which is enormous wasted traffic for a feature
// that is fundamentally not real-time.
//
// Function kept as a no-op so the existing call site in initializeI18n()
// continues to work without a separate edit.

function startBundleVersionPoll() {
    // Intentionally empty. See comment above.
}

/**
 * Force an immediate refresh of the current locale from the API.
 * Used by the locale editor: after saving a key, call this to see the change
 * everywhere in the UI without waiting for the poll.
 */
export async function refreshLocaleFromAPI() {
    const currentLocale = i18n.global.locale.value
    await fetchAndMergeFromAPI(currentLocale)
}

// ─────────────────────────────────────────────────────────────────────────────
// Create the i18n instance
// ─────────────────────────────────────────────────────────────────────────────

const i18n = createI18n({
    legacy: false,
    locale: getStoredLocale(),
    fallbackLocale: DEFAULT_LOCALE,
    messages: {}, // Will be loaded dynamically
    globalInjection: true,
    silentTranslationWarn: true,
    silentFallbackWarn: true
})

// Export tObj as a standalone function
export function tObj(key) {
    try {
        const locale = i18n.global.locale.value
        const keys = key.split('.')
        let result = i18n.global.messages.value[locale]

        for (const k of keys) {
            if (result && typeof result === 'object') {
                result = result[k]
            } else {
                return key // Return key if path doesn't exist
            }
        }

        return result !== undefined ? result : key
    } catch (error) {
        console.warn(`tObj failed for key: ${key}`, error)
        return key
    }
}

// Track initialization state
let isInitialized = false
let initializationPromise = null

// Initialize i18n messages
async function initializeI18n() {
    if (isInitialized) {
        return i18n
    }

    if (initializationPromise) {
        return initializationPromise
    }

    initializationPromise = (async () => {
        try {
            const locale = getStoredLocale()
            const messages = await loadLocaleMessages(locale)
            i18n.global.setLocaleMessage(locale, messages)

            // Also load fallback locale if different
            if (locale !== DEFAULT_LOCALE) {
                const fallbackMessages = await loadLocaleMessages(DEFAULT_LOCALE)
                i18n.global.setLocaleMessage(DEFAULT_LOCALE, fallbackMessages)
            }

            isInitialized = true

            // Stage 2 + 3: kick off DB overlay + polling in the background.
            // Don't await - UI is already usable with bundled translations.
            // Errors are swallowed inside these functions.
            fetchAndMergeFromAPI(locale).catch(() => { })
            startBundleVersionPoll()

            return i18n
        } catch (error) {
            console.error('Failed to initialize i18n:', error)
            isInitialized = false
            throw error
        }
    })()

    return initializationPromise
}

// Function to change locale dynamically
export async function changeLocale(newLocale) {
    const validLocale = availableLocales.find(l => l.code === newLocale)?.code
    if (!validLocale) {
        console.warn(`Invalid locale: ${newLocale}`)
        return
    }

    try {
        // Load bundled messages first (fast)
        if (!i18n.global.availableLocales.includes(validLocale)) {
            const messages = await loadLocaleMessages(validLocale)
            i18n.global.setLocaleMessage(validLocale, messages)
        }

        // Set locale (also persists to localStorage so cold-start visits to
        // "/" land here)
        setLocale(validLocale)

        // Now overlay DB values for the new locale (best-effort, async).
        // Reset version tracking so the next poll re-fetches if needed.
        delete lastSeenVersions.user
        delete lastSeenVersions.admin
        fetchAndMergeFromAPI(validLocale).catch(() => { })

        // URL sync - swap the locale segment in the current URL so the
        // change is reflected as a normal navigation. This is what makes
        // the URL the session source of truth: copy/paste a /uz/... URL
        // and it opens in Uzbek for anyone.
        //
        // Lazy-imported to avoid a circular dep with the router (the router
        // also imports from this file). Skip the swap if we're not in a
        // browser (SSR safety) or if the router hasn't been created yet.
        if (typeof window !== 'undefined' && window.__VUE_ROUTER__) {
            try {
                const router = window.__VUE_ROUTER__
                const { stripLocale, SUPPORTED_LOCALES } = await import('@/router')
                const current = router.currentRoute.value
                const urlLocale = current.params?.locale
                // Only push if the URL's locale differs from the target -
                // otherwise we'd push the same path and noop, or worse
                // confuse history when changeLocale is called as a side
                // effect of a route change.
                if (urlLocale !== validLocale && SUPPORTED_LOCALES.includes(validLocale)) {
                    const rest = stripLocale(current.fullPath)
                    const newPath = `/${validLocale}${rest === '/' ? '/' : rest}`
                    // Use replace not push - otherwise a language toggle
                    // pollutes the back button with duplicate URLs.
                    router.replace(newPath).catch(() => { })
                }
            } catch (err) {
                console.warn('changeLocale: URL sync failed:', err)
            }
        }

        // Update page title for current route when locale changes
        if (typeof window !== 'undefined' && window.__VUE_ROUTER__) {
            const router = window.__VUE_ROUTER__
            const currentRoute = router.currentRoute.value

            if (currentRoute?.meta?.titleKey) {
                try {
                    const title = i18n.global.t(currentRoute.meta.titleKey)
                    if (title && title !== currentRoute.meta.titleKey) {
                        document.title = `${title} | ATABAI`
                    }
                } catch (error) {
                    console.warn('i18n: Error updating title after locale change:', error)
                }
            }

            // Update meta description too
            if (currentRoute?.meta?.descriptionKey) {
                try {
                    const description = i18n.global.t(currentRoute.meta.descriptionKey)
                    if (description && description !== currentRoute.meta.descriptionKey) {
                        let metaDescription = document.querySelector('meta[name="description"]')
                        if (metaDescription) {
                            metaDescription.content = description
                        }
                    }
                } catch (error) {
                    console.warn('i18n: Error updating description after locale change:', error)
                }
            }
        }

    } catch (error) {
        console.error(`Failed to change locale to ${newLocale}:`, error)
    }
}

// Export function to check if i18n is ready
export function isI18nReady() {
    return isInitialized
}

// Export function to wait for i18n to be ready
export function waitForI18n() {
    if (isInitialized) {
        return Promise.resolve(i18n)
    }
    return initializationPromise || initializeI18n()
}

// Add a method to the global instance for the router to use
i18n.global.$waitForI18n = waitForI18n

// Initialize immediately
initializeI18n().catch(error => {
    console.error('Initial i18n setup failed:', error)
})

export default i18n