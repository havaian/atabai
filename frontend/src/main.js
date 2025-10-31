import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n, { getStoredLocale, setLocale } from './utils/i18n'
import axiosPlugin from './plugins/axios'
import { setupGlobalPageTitles } from './composables/usePageTitle'

import App from './App.vue'
import './assets/main.css'

// Create Pinia store
const pinia = createPinia()

// Create Vue app
const app = createApp(App)

// Use plugins
app.use(pinia)
app.use(router)
app.use(i18n)
app.use(axiosPlugin)

// Initialize language from localStorage
const storedLocale = getStoredLocale()
setLocale(storedLocale)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
    console.error('Global error:', err)
    console.error('Error info:', info)
    // You can add error reporting service here
}

// Mount app and setup global features
app.mount('#app')

// Setup global page titles after app is mounted
// This will automatically handle page titles for all routes
router.isReady().then(() => {
    setupGlobalPageTitles()
})