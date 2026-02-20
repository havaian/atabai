import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'atabai-theme'

export const useThemeStore = defineStore('theme', () => {
    // State: 'light' | 'dark' | 'system'
    const preference = ref('system')

    // Resolved theme after evaluating 'system' against OS preference
    const resolvedTheme = computed(() => {
        if (preference.value === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        }
        return preference.value
    })

    const isDark = computed(() => resolvedTheme.value === 'dark')

    // Apply .dark / .light class to <html>
    function _apply() {
        const html = document.documentElement
        html.classList.remove('dark', 'light')
        html.classList.add(resolvedTheme.value)
    }

    // Persist to localStorage
    function _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, preference.value)
        } catch (e) {
            console.warn('Could not save theme to localStorage:', e)
        }
    }

    // Watch OS theme changes for 'system' mode
    let _mediaQuery = null
    let _systemHandler = null

    function _watchSystem() {
        if (_mediaQuery && _systemHandler) {
            _mediaQuery.removeEventListener('change', _systemHandler)
        }
        _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        _systemHandler = () => {
            if (preference.value === 'system') {
                _apply()
            }
        }
        _mediaQuery.addEventListener('change', _systemHandler)
    }

    /**
     * Initialize theme on app mount.
     * Reads localStorage, applies to DOM, starts OS watcher.
     */
    function init() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved && ['light', 'dark', 'system'].includes(saved)) {
                preference.value = saved
            }
        } catch (e) {
            console.warn('Could not read theme from localStorage:', e)
        }
        _apply()
        _watchSystem()
    }

    /**
     * Set theme preference ('light' | 'dark' | 'system')
     * Used by PersonalSettings dropdown.
     */
    function setTheme(theme) {
        if (!['light', 'dark', 'system'].includes(theme)) return
        preference.value = theme
        _persist()
        _apply()
    }

    /**
     * Quick toggle between light and dark.
     * Used by Navbar toggle button. Ignores 'system' — picks opposite of current resolved theme.
     */
    function toggle() {
        setTheme(isDark.value ? 'light' : 'dark')
    }

    return {
        preference,
        resolvedTheme,
        isDark,
        init,
        setTheme,
        toggle
    }
})