import { watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

/**
 * Composable for managing page titles and meta descriptions based on current route
 * Automatically updates document.title and meta description when route or locale changes
 */
export function usePageTitle() {
    const route = useRoute()
    const { t, locale, te } = useI18n()

    // Helper function to safely get translation
    const safeTranslate = (key, fallback = '') => {
        try {
            // Use te() to check if translation exists before translating
            if (te(key)) {
                return t(key)
            }
            return fallback
        } catch (error) {
            console.warn(`Translation error for key "${key}":`, error)
            return fallback
        }
    }

    // Computed property that reactively gets the page title
    const pageTitle = computed(() => {
        try {
            // Map route paths to translation keys or use route name/meta
            const routeTitleMap = {
                '/': 'nav.home',
                '/dashboard': 'nav.dashboard',
                '/templates': 'nav.templates',
                '/profile': 'nav.profile',
                '/history': 'nav.history',
                '/processing': 'Processing',
                '/results': 'Results'
            }

            const currentPath = route.path
            const titleKey = routeTitleMap[currentPath]

            let title = ''
            if (titleKey) {
                title = safeTranslate(titleKey, titleKey)
            }

            // If we have a valid title, use it
            if (title && title !== titleKey) {
                return `${title} | ATABAI`
            }

            // Try route meta title
            if (route.meta?.title) {
                return route.meta.title
            }

            // Fallback to generic title based on current locale
            const fallbacks = {
                'ru': 'ATABAI - Автоматизация Excel для МСФО',
                'uz': 'ATABAI - Excel avtomatlashtirish IFRS uchun',
                'en': 'ATABAI - Excel Automation for IFRS'
            }

            return fallbacks[locale.value] || fallbacks['en']
        } catch (error) {
            console.error('Error getting page title:', error)
            return 'ATABAI'
        }
    })

    // Computed property for meta description
    const pageDescription = computed(() => {
        try {
            // Try route meta description first
            if (route.meta?.description) {
                return route.meta.description
            }

            // Map route paths to description keys
            const routeDescriptionMap = {
                '/': 'Платформа для автоматизации финансовых расчетов в Excel в соответствии с требованиями МСФО',
                '/dashboard': 'Рабочий стол для управления вашими Excel файлами и шаблонами МСФО',
                '/templates': 'Шаблоны для автоматизации расчетов в соответствии с международными стандартами',
                '/profile': 'Управление профилем и настройками аккаунта'
            }

            const currentPath = route.path
            if (routeDescriptionMap[currentPath]) {
                return routeDescriptionMap[currentPath]
            }

            // Fallback to generic description based on current locale
            const fallbacks = {
                'ru': 'Платформа для автоматизации финансовых расчетов в Excel в соответствии с требованиями МСФО и законодательством Республики Узбекистан',
                'uz': 'IFRS talablariga va O\'zbekiston Respublikasi qonunchiligiga muvofiq Excel moliyaviy hisob-kitoblarini avtomatlashtirish platformasi',
                'en': 'Platform for automating financial calculations in Excel in accordance with IFRS requirements and legislation of the Republic of Uzbekistan'
            }

            return fallbacks[locale.value] || fallbacks['en']
        } catch (error) {
            console.error('Error getting page description:', error)
            return 'ATABAI - Excel Automation Platform'
        }
    })

    // Watch the computed title and update document.title
    watch(pageTitle, (newTitle) => {
        try {
            if (newTitle && typeof newTitle === 'string') {
                document.title = newTitle
            }
        } catch (error) {
            console.error('Error setting page title:', error)
        }
    }, { immediate: true })

    // Watch the computed description and update meta description
    watch(pageDescription, (newDescription) => {
        try {
            if (!newDescription || typeof newDescription !== 'string') return

            let metaDescription = document.querySelector('meta[name="description"]')
            if (metaDescription) {
                metaDescription.content = newDescription
            } else {
                // Create meta description if it doesn't exist
                metaDescription = document.createElement('meta')
                metaDescription.name = 'description'
                metaDescription.content = newDescription
                document.head.appendChild(metaDescription)
            }
        } catch (error) {
            console.error('Error setting page description:', error)
        }
    }, { immediate: true })

    return {
        pageTitle,
        pageDescription
    }
}

/**
 * Global setup function to automatically handle page titles and descriptions for all routes
 * This should be called once in the main app setup
 */
export function setupGlobalPageTitles() {
    try {
        return usePageTitle()
    } catch (error) {
        console.error('Error setting up global page titles:', error)
        // Return a fallback object to prevent further errors
        return {
            pageTitle: computed(() => 'ATABAI'),
            pageDescription: computed(() => 'ATABAI - Excel Automation Platform')
        }
    }
}

/**
 * Alternative function for setting custom page titles and descriptions
 * Useful for dynamic pages where the title depends on data
 */
export function setCustomPageTitle(customTitle, customDescription = null) {
    try {
        if (!customTitle) return

        const title = typeof customTitle === 'function'
            ? customTitle()
            : customTitle

        if (title && typeof title === 'string') {
            document.title = title.includes('ATABAI') ? title : `${title} | ATABAI`
        }

        if (customDescription) {
            const description = typeof customDescription === 'function'
                ? customDescription()
                : customDescription

            if (description && typeof description === 'string') {
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
        }
    } catch (error) {
        console.error('Error setting custom page title:', error)
    }
}