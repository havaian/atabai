import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n, { getStoredLocale, setLocale, waitForI18n } from './utils/i18n'
import axiosPlugin from './plugins/axios'

import App from './App.vue'
import './assets/main.css'

// Async initialization function
async function initializeApp() {
    try {
        console.log('Starting app initialization...')

        // Wait for i18n to be ready before creating app
        await waitForI18n()
        console.log('i18n is ready')

        // Create Pinia store
        const pinia = createPinia()

        // Create Vue app
        const app = createApp(App)

        // Use plugins in correct order
        app.use(pinia)
        app.use(router)
        app.use(i18n)
        app.use(axiosPlugin)

        // Initialize language from localStorage
        const storedLocale = getStoredLocale()
        setLocale(storedLocale)
        console.log(`Locale set to: ${storedLocale}`)

        // Global error handler
        app.config.errorHandler = (err, instance, info) => {
            console.error('Global error:', err)
            console.error('Error info:', info)
            // You can add error reporting service here
        }

        // Mount app
        app.mount('#app')
        console.log('App mounted successfully')

    } catch (error) {
        console.error('Failed to initialize app:', error)

        // Fallback: mount app anyway with basic setup
        const pinia = createPinia()
        const app = createApp(App)

        app.use(pinia)
        app.use(router)
        app.use(i18n)
        app.use(axiosPlugin)

        app.mount('#app')
        console.log('App mounted with fallback setup')
    }
}

// Initialize the app
initializeApp()