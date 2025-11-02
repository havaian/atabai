import { watch, computed, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

/**
 * Composable for managing page titles and meta descriptions based on current route
 * Automatically updates document.title and meta description when route or locale changes
 */
export function usePageTitle() {
    const route = useRoute()
    const isI18nReady = ref(false)
    
    // Initialize i18n with proper error handling
    let i18nInstance = null
    try {
        i18nInstance = useI18n()
        isI18nReady.value = true
    } catch (error) {
        console.warn('i18n not ready yet, will retry...', error)
        // Will be retried in onMounted
    }

    // Helper function to safely get translation
    const safeTranslate = (key, fallback = '') => {
        try {
            if (!isI18nReady.value || !i18nInstance) {
                console.log('PageTitle: i18n not ready, returning fallback for key:', key)
                return fallback
            }
            
            // Handle nested object paths like "pageTitles.//"
            if (key.includes('.')) {
                const parts = key.split('.')
                const baseKey = parts[0]
                const subPath = parts.slice(1).join('.')
                
                // For pageTitles and pageDescriptions, we need to access the object property
                if (baseKey === 'pageTitles' || baseKey === 'pageDescriptions') {
                    try {
                        const messages = i18nInstance.messages?.value?.[i18nInstance.locale.value]
                        if (messages && messages[baseKey] && messages[baseKey][subPath]) {
                            console.log(`PageTitle: Found direct mapping for ${key}:`, messages[baseKey][subPath])
                            return messages[baseKey][subPath]
                        }
                    } catch (e) {
                        console.warn(`PageTitle: Error accessing nested key ${key}:`, e)
                    }
                }
            }
            
            // Use te() to check if translation exists before translating
            if (i18nInstance.te && i18nInstance.te(key)) {
                const result = i18nInstance.t(key)
                console.log(`PageTitle: Found translation for ${key}:`, result)
                return result
            }
            
            console.log(`PageTitle: No translation found for ${key}, using fallback:`, fallback)
            return fallback
        } catch (error) {
            console.warn(`Translation error for key "${key}":`, error)
            return fallback
        }
    }

    // Computed property that reactively gets the page title
    const pageTitle = computed(() => {
        // Explicitly depend on route.path and i18n state for reactivity
        const currentPath = route.path
        const i18nReady = isI18nReady.value
        const currentLocale = i18nReady && i18nInstance ? i18nInstance.locale.value : 'en'
        
        try {
            console.log('PageTitle: Computing title for path:', currentPath, 'i18n ready:', i18nReady, 'locale:', currentLocale)
            
            // First try the direct pageTitles mapping from locale files
            const directTitleKey = `pageTitles.${currentPath}`
            console.log('PageTitle: Trying direct title key:', directTitleKey)
            
            if (i18nReady && i18nInstance) {
                const directTitle = safeTranslate(directTitleKey, '')
                console.log('PageTitle: Direct title result:', directTitle)
                
                if (directTitle) {
                    const fullTitle = `${directTitle} | ATABAI`
                    console.log('PageTitle: Using direct title:', fullTitle)
                    return fullTitle
                }
            }

            // If direct mapping doesn't work, try nav mapping
            const routeTitleMap = {
                '/': 'nav.home',
                '/dashboard': 'nav.dashboard',
                '/templates': 'nav.templates',
                '/profile': 'nav.profile',
                '/history': 'nav.history',
                '/processing': 'Processing',
                '/results': 'Results',
                '/coming-soon': 'nav.comingSoon'
            }

            const navTitleKey = routeTitleMap[currentPath]
            console.log('PageTitle: Trying nav title key:', navTitleKey)

            if (navTitleKey && i18nReady) {
                const navTitle = safeTranslate(navTitleKey, '')
                console.log('PageTitle: Nav title result:', navTitle)
                
                if (navTitle) {
                    const fullTitle = `${navTitle} | ATABAI`
                    console.log('PageTitle: Using nav title:', fullTitle)
                    return fullTitle
                }
            }

            // Try route meta title
            if (route.meta?.title) {
                console.log('PageTitle: Using route meta title:', route.meta.title)
                return route.meta.title
            }

            // Fallback to generic title based on current locale
            const fallbacks = {
                'ru': 'ATABAI - Автоматизация Excel для МСФО',
                'uz': 'ATABAI - Excel avtomatlashtirish IFRS uchun',
                'en': 'ATABAI - Excel Automation for IFRS'
            }

            const fallbackTitle = fallbacks[currentLocale] || fallbacks['en']
            console.log('PageTitle: Using fallback title:', fallbackTitle)
            return fallbackTitle
        } catch (error) {
            console.error('Error getting page title:', error)
            return 'ATABAI'
        }
    })

    // Computed property for meta description
    const pageDescription = computed(() => {
        // Explicitly depend on route.path and i18n state for reactivity
        const currentPath = route.path
        const i18nReady = isI18nReady.value
        const currentLocale = i18nReady && i18nInstance ? i18nInstance.locale.value : 'en'
        
        try {
            console.log('PageDescription: Computing description for path:', currentPath, 'i18n ready:', i18nReady, 'locale:', currentLocale)
            
            // Try route meta description first
            if (route.meta?.description) {
                console.log('PageDescription: Using route meta description:', route.meta.description)
                return route.meta.description
            }

            // Try direct pageDescriptions mapping from locale files
            const directDescKey = `pageDescriptions.${currentPath}`
            console.log('PageDescription: Trying direct description key:', directDescKey)
            
            if (i18nReady && i18nInstance) {
                const directDesc = safeTranslate(directDescKey, '')
                console.log('PageDescription: Direct description result:', directDesc)
                
                if (directDesc) {
                    console.log('PageDescription: Using direct description:', directDesc)
                    return directDesc
                }
            }

            // Fallback descriptions
            const routeDescriptionMap = {
                '/': 'Платформа для автоматизации финансовых расчетов в Excel в соответствии с требованиями МСФО',
                '/dashboard': 'Рабочий стол для управления вашими Excel файлами и шаблонами МСФО',
                '/templates': 'Шаблоны для автоматизации расчетов в соответствии с международными стандартами',
                '/profile': 'Управление профилем и настройками аккаунта',
                '/coming-soon': 'ATABAI скоро будет доступен. Платформа автоматизации Excel расчетов по МСФО находится в разработке.'
            }

            if (routeDescriptionMap[currentPath]) {
                console.log('PageDescription: Using fallback mapping:', routeDescriptionMap[currentPath])
                return routeDescriptionMap[currentPath]
            }

            // Fallback to generic description based on current locale
            const fallbacks = {
                'ru': 'Платформа для автоматизации финансовых расчетов в Excel в соответствии с требованиями МСФО и законодательством Республики Узбекистан',
                'uz': 'IFRS talablariga va O\'zbekiston Respublikasi qonunchiligiga muvofiq Excel moliyaviy hisob-kitoblarini avtomatlashtirish platformasi',
                'en': 'Platform for automating financial calculations in Excel in accordance with IFRS requirements and legislation of the Republic of Uzbekistan'
            }

            const fallbackDesc = fallbacks[currentLocale] || fallbacks['en']
            console.log('PageDescription: Using locale fallback:', fallbackDesc)
            return fallbackDesc
        } catch (error) {
            console.error('Error getting page description:', error)
            return 'ATABAI - Excel Automation Platform'
        }
    })

    // Function to update document title safely
    const updateDocumentTitle = (newTitle) => {
        try {
            if (newTitle && typeof newTitle === 'string') {
                document.title = newTitle
                console.log('Updated page title:', newTitle)
            }
        } catch (error) {
            console.error('Error setting page title:', error)
        }
    }

    // Function to update meta description safely
    const updateMetaDescription = (newDescription) => {
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
            console.log('Updated meta description:', newDescription)
        } catch (error) {
            console.error('Error setting page description:', error)
        }
    }

    // Initialize i18n when component mounts
    onMounted(() => {
        if (!isI18nReady.value) {
            try {
                i18nInstance = useI18n()
                isI18nReady.value = true
                console.log('i18n initialized successfully in usePageTitle')
            } catch (error) {
                console.warn('Failed to initialize i18n in usePageTitle:', error)
            }
        }
    })

    // Watch for route changes explicitly
    watch(() => route.path, (newPath, oldPath) => {
        console.log('PageTitle: Route changed from', oldPath, 'to', newPath)
        // Force update titles when route changes
        updateDocumentTitle(pageTitle.value)
        updateMetaDescription(pageDescription.value)
    }, { immediate: true })

    // Watch for locale changes
    watch(() => isI18nReady.value && i18nInstance ? i18nInstance.locale.value : null, (newLocale, oldLocale) => {
        console.log('PageTitle: Locale changed from', oldLocale, 'to', newLocale)
        if (newLocale) {
            updateDocumentTitle(pageTitle.value)
            updateMetaDescription(pageDescription.value)
        }
    })

    // Watch the computed title and update document.title
    watch(pageTitle, (newTitle, oldTitle) => {
        console.log('PageTitle: Title computed changed from', oldTitle, 'to', newTitle)
        updateDocumentTitle(newTitle)
    }, { immediate: true })

    // Watch the computed description and update meta description
    watch(pageDescription, (newDesc, oldDesc) => {
        console.log('PageTitle: Description computed changed from', oldDesc, 'to', newDesc)
        updateMetaDescription(newDesc)
    }, { immediate: true })

    // Also watch for i18n readiness and update titles when it becomes available
    watch(isI18nReady, (ready) => {
        console.log('PageTitle: i18n readiness changed to', ready)
        if (ready) {
            updateDocumentTitle(pageTitle.value)
            updateMetaDescription(pageDescription.value)
        }
    })

    return {
        pageTitle,
        pageDescription,
        isI18nReady
    }
}

/**
 * Global setup function to automatically handle page titles and descriptions for all routes
 * This should be called once in the main app setup
 */
export function setupGlobalPageTitles() {
    try {
        console.log('Setting up global page titles...')
        const result = usePageTitle()
        console.log('Global page titles setup completed')
        return result
    } catch (error) {
        console.error('Error setting up global page titles:', error)
        // Return a fallback object to prevent further errors
        return {
            pageTitle: computed(() => 'ATABAI'),
            pageDescription: computed(() => 'ATABAI - Excel Automation Platform'),
            isI18nReady: ref(false)
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