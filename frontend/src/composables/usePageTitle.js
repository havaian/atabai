import { watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

/**
 * Composable for managing page titles based on current route
 * Automatically updates document.title when route or locale changes
 */
export function usePageTitle() {
    const route = useRoute()
    const { t, locale } = useI18n()

    // Computed property that reactively gets the page title
    const pageTitle = computed(() => {
        const currentPath = route.path
        const title = t(`pageTitles.${currentPath}`)

        // If translation exists and is not the key itself, use it
        if (title && title !== `pageTitles.${currentPath}`) {
            return `${title} | ATABAI`
        }

        // Fallback to a generic title based on current locale
        const fallbacks = {
            'ru': 'ATABAI - Автоматизация Excel для МСФО',
            'uz': 'ATABAI - Excel avtomatlashtirish IFRS uchun',
            'en': 'ATABAI - Excel Automation for IFRS'
        }

        return fallbacks[locale.value] || fallbacks['en']
    })

    // Watch the computed title and update document.title
    watch(pageTitle, (newTitle) => {
        document.title = newTitle
    }, { immediate: true })

    return {
        pageTitle
    }
}

/**
 * Global setup function to automatically handle page titles for all routes
 * This should be called once in the main app setup
 */
export function setupGlobalPageTitles() {
    usePageTitle()
}

/**
 * Alternative function for setting custom page titles
 * Useful for dynamic pages where the title depends on data
 */
export function setCustomPageTitle(customTitle) {
    const { locale } = useI18n()

    const title = typeof customTitle === 'function'
        ? customTitle(locale.value)
        : customTitle

    document.title = `${title} | ATABAI`
}