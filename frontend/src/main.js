import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import router from './router'
import i18n, { getStoredLocale, setLocale } from './utils/i18n'
import axios from 'axios'

import App from './App.vue'
import './assets/main.css'

// Configure axios defaults
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
axios.defaults.withCredentials = true

// Create Pinia store
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

// Create Vue app
const app = createApp(App)

// Use plugins
app.use(pinia)
app.use(router)
app.use(i18n)

// Initialize language from localStorage
const storedLocale = getStoredLocale()
setLocale(storedLocale)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
    console.error('Global error:', err)
    console.error('Error info:', info)
    // You can add error reporting service here
}

// Mount app
app.mount('#app')