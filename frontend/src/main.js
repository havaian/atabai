import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n, { getStoredLocale, setLocale, waitForI18n } from './utils/i18n'
import axiosPlugin from './plugins/axios'

import App from './App.vue'
import './assets/main.css'

// Import your global components
import globalComponents from './plugins/globalComponents'

// Async initialization function
async function initializeApp() {
    try {
        // Wait for i18n to be ready before creating app
        await waitForI18n()

        // Create Pinia store
        const pinia = createPinia()

        // Create Vue app
        const app = createApp(App)

        // Register global components
        app.use(globalComponents)

        // Use plugins in correct order
        app.use(pinia)
        app.use(router)
        app.use(i18n)
        app.use(axiosPlugin)

        // Initialize language from localStorage
        const storedLocale = getStoredLocale()
        setLocale(storedLocale)

        // Global error handler
        app.config.errorHandler = (err, instance, info) => {// You can add error reporting service here
        }

        // Mount app
        app.mount('#app')
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
    }
}

// Initialize the app
initializeApp()