import { createI18n } from 'vue-i18n'

// Available locales configuration
export const availableLocales = [
    {
        code: 'ru',
        name: 'Русский',
        flag: '🇷🇺'
    },
    {
        code: 'uz',
        name: 'O\'zbekcha',
        flag: '🇺🇿'
    },
    {
        code: 'en',
        name: 'English',
        flag: '🇺🇸'
    }
]

// Default locale
const DEFAULT_LOCALE = 'ru'

// Get stored locale from localStorage
export function getStoredLocale() {
    return localStorage.getItem('locale') || DEFAULT_LOCALE
}

// Set locale and store in localStorage
export function setLocale(locale) {
    const validLocale = availableLocales.find(l => l.code === locale)?.code || DEFAULT_LOCALE
    localStorage.setItem('locale', validLocale)
    if (i18n.global.locale) {
        i18n.global.locale.value = validLocale
    }
    return validLocale
}

// Async function to load locale messages
async function loadLocaleMessages(locale) {
    try {
        const messages = await import(`../locales/${locale}.json`)
        return messages.default
    } catch (error) {
        console.warn(`Failed to load locale ${locale}, falling back to ${DEFAULT_LOCALE}`)
        if (locale !== DEFAULT_LOCALE) {
            return await loadLocaleMessages(DEFAULT_LOCALE)
        }
        return {}
    }
}

// Create i18n instance
const i18n = createI18n({
    legacy: false,
    locale: getStoredLocale(),
    fallbackLocale: DEFAULT_LOCALE,
    messages: {}, // Will be loaded dynamically
    globalInjection: true
})

// Load initial locale messages
async function initializeI18n() {
    const locale = getStoredLocale()
    const messages = await loadLocaleMessages(locale)
    i18n.global.setLocaleMessage(locale, messages)
    return i18n
}

// Function to change locale dynamically
export async function changeLocale(newLocale) {
    const validLocale = availableLocales.find(l => l.code === newLocale)?.code
    if (!validLocale) {
        console.warn(`Invalid locale: ${newLocale}`)
        return
    }

    // Load messages if not already loaded
    if (!i18n.global.availableLocales.includes(validLocale)) {
        const messages = await loadLocaleMessages(validLocale)
        i18n.global.setLocaleMessage(validLocale, messages)
    }

    // Set locale
    setLocale(validLocale)
}

// Initialize and export
initializeI18n()

export default i18n