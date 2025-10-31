import { watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

/**
 * Composable for managing page titles and meta descriptions based on current route
 * Automatically updates document.title and meta description when route or locale changes
 */
export function usePageTitle() {
    const route = useRoute()
    const { t, locale } = useI18n()

    // Computed property that reactively gets the page title
    const pageTitle = computed(() => {
        try {
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
        } catch (error) {
            console.error('Error getting page title:', error)
            return 'ATABAI'
        }
    })

    // Computed property for meta description
    const pageDescription = computed(() => {
        try {
            const currentPath = route.path
            const description = t(`pageDescriptions.${currentPath}`)

            // If translation exists and is not the key itself, use it
            if (description && description !== `pageDescriptions.${currentPath}`) {
                return description
            }

            // Fallback to a generic description based on current locale
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
            document.title = newTitle
        } catch (error) {
            console.error('Error setting page title:', error)
        }
    }, { immediate: true })

    // Watch the computed description and update meta description
    watch(pageDescription, (newDescription) => {
        try {
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
        usePageTitle()
    } catch (error) {
        console.error('Error setting up global page titles:', error)
    }
}

/**
 * Alternative function for setting custom page titles and descriptions
 * Useful for dynamic pages where the title depends on data
 */
export function setCustomPageTitle(customTitle, customDescription = null) {
    try {
        const { locale } = useI18n()

        const title = typeof customTitle === 'function'
            ? customTitle(locale.value)
            : customTitle

        document.title = `${title} | ATABAI`

        if (customDescription) {
            const description = typeof customDescription === 'function'
                ? customDescription(locale.value)
                : customDescription

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
    } catch (error) {
        console.error('Error setting custom page title:', error)
    }
}