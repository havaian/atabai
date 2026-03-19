import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import i18n, { getStoredLocale, setLocale, waitForI18n } from './utils/i18n'
import axiosPlugin from './plugins/axios'

import App from './App.vue'
import './assets/main.css'
import './assets/theme.css'

// Import your global components
import globalComponents from './plugins/globalComponents'

    // ── Theme init — sync, before Vue mounts, prevents flash ───────────────────
    ; (function () {
        const t = localStorage.getItem('atabai-theme') || 'light'
        document.documentElement.setAttribute('data-theme', t)
        if (t === 'dark') document.documentElement.classList.add('dark')
        else document.documentElement.classList.remove('dark')
    })()

// Async initialization function
async function initializeApp() {
    try {
        await waitForI18n()
        const pinia = createPinia()
        const app = createApp(App)
        app.use(globalComponents)
        app.use(pinia)
        app.use(router)
        app.use(i18n)
        app.use(axiosPlugin)
        const storedLocale = getStoredLocale()
        setLocale(storedLocale)
        app.config.errorHandler = (err, instance, info) => { }
        app.mount('#app')
    } catch (error) {
        console.error('Failed to initialize app:', error)
        const pinia = createPinia()
        const app = createApp(App)
        app.use(pinia)
        app.use(router)
        app.use(i18n)
        app.use(axiosPlugin)
        app.mount('#app')
    }
}

initializeApp()