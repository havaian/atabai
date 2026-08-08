// @ts-nocheck
/* eslint-disable */
/**
 * Auto-converted from src/stores/theme.js.
 * Behavior preserved 1:1; types tightened later.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'atabai-theme'

    // Apply theme immediately before Vue even mounts - eliminates flash
    ; (() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            const theme = (saved === 'light' || saved === 'dark') ? saved : 'light'
            const root = document.documentElement
            root.setAttribute('data-theme', theme)
            if (theme === 'dark') root.classList.add('dark')
            else root.classList.remove('dark')
        } catch (e) { }
    })()

export const useThemeStore = defineStore('theme', () => {
    const preference = ref((() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            return (saved === 'light' || saved === 'dark') ? saved : 'light'
        } catch (e) { return 'light' }
    })())

    const resolvedTheme = computed(() => preference.value)
    const isDark = computed(() => resolvedTheme.value === 'dark')

    function _apply(theme) {
        const root = document.documentElement
        root.setAttribute('data-theme', theme)
        if (theme === 'dark') root.classList.add('dark')
        else root.classList.remove('dark')

        const vars = theme === 'dark' ? {
            '--ws-bg': '#0F0D18',
            '--ws-surface': '#171523',
            '--ws-surface-2': '#1D1A2A',
            '--ws-border': 'rgba(149, 0, 255, 0.12)',
            '--ws-border-2': 'rgba(149, 0, 255, 0.06)',
            '--ws-text': '#F0ECF6',
            '--ws-text-2': 'rgba(240, 236, 246, 0.75)',
            '--ws-text-3': 'rgba(240, 236, 246, 0.52)',
            '--ws-purple': '#7C3AED',
            '--ws-purple-lt': 'rgba(124, 58, 237, 0.15)',
            '--sb-bg': '#0C0A14',
            '--sb-border': 'rgba(149, 0, 255, 0.1)',
            '--sb-item-hover': 'rgba(149, 0, 255, 0.1)',
            '--sb-item-active-bg': 'rgba(124, 58, 237, 0.18)',
            '--sb-text': 'rgba(240, 236, 246, 0.65)',
            '--sb-text-hover': 'rgba(240, 236, 246, 0.85)',
            '--sb-text-active': '#C084FC',
            '--sb-divider': 'rgba(240, 236, 246, 0.2)',
            '--sb-icon-muted': 'rgba(240, 236, 246, 0.48)',
            '--sb-icon-hover': '#F0ECF6',
            '--sb-menu-bg': '#1A1528',
            '--sb-menu-border': 'rgba(149, 0, 255, 0.15)',
            '--sb-menu-text': 'rgba(240, 236, 246, 0.80)',
            '--sb-profile-border': 'rgba(149, 0, 255, 0.08)',
            '--sb-recent-name': 'rgba(240, 236, 246, 0.80)',
            '--sb-recent-meta': 'rgba(240, 236, 246, 0.48)',
            '--sb-recent-empty': 'rgba(240, 236, 246, 0.45)',
            '--sb-mobile-bg': '#0C0A14',
            '--auth-bg': '#0F0D18',
            '--auth-card-bg': '#171523',
            '--auth-card-border': 'rgba(149, 0, 255, 0.12)',
            '--auth-card-shadow': '0 4px 24px rgba(0,0,0,0.4)',
            '--auth-title': '#F0ECF6',
            '--auth-sub': 'rgba(240, 236, 246, 0.45)',
            '--misc-bg': '#07060B',
            '--misc-text': '#F0ECF6',
            '--misc-text-2': 'rgba(240, 236, 246, 0.4)',
            '--misc-text-3': 'rgba(240, 236, 246, 0.3)',
            '--misc-card-bg': 'rgba(255, 255, 255, 0.03)',
            '--misc-card-border': 'rgba(255, 255, 255, 0.07)',
            '--pill-green-bg': 'rgba(34, 197, 94, 0.12)',
            '--pill-green-text': '#4ade80',
            '--pill-blue-bg': 'rgba(96, 165, 250, 0.12)',
            '--pill-blue-text': '#93c5fd',
            '--pill-red-bg': 'rgba(248, 113, 113, 0.12)',
            '--pill-red-text': '#fca5a5',
            '--pill-yellow-bg': 'rgba(251, 191, 36, 0.12)',
            '--pill-yellow-text': '#fcd34d',
            '--pill-gray-bg': 'rgba(240, 236, 246, 0.08)',
            '--pill-gray-text': 'rgba(240, 236, 246, 0.3)',
            '--toggle-bg': 'rgba(240, 236, 246, 0.08)',
            '--toggle-active-bg': '#7C3AED',
            '--toggle-icon': 'rgba(240, 236, 246, 0.35)',
            '--toggle-icon-active': '#ffffff',
            '--landing-bg': '#07060B',
            '--landing-surface': '#0F0D15',
            '--landing-surface-2': '#16131F',
            '--landing-text': '#F0ECF6',
            '--landing-text-secondary': 'rgba(240, 236, 246, 0.55)',
            '--landing-text-muted': 'rgba(240, 236, 246, 0.3)',
            '--landing-border': 'rgba(149, 0, 255, 0.08)',
            '--landing-border-accent': 'rgba(149, 0, 255, 0.12)',
            // ── Admin panel tokens ────────────────────────────────────
            // Used in AdminLayout.vue + admin.css. Kept separate from --ws-*
            // so admin colors can be tuned independently if needed.
            '--ws-bg-elevated': 'rgba(20, 14, 32, 0.95)',
            '--adm-border': 'rgba(149, 0, 255, 0.15)',
            '--adm-border-soft': 'rgba(149, 0, 255, 0.08)',
            '--adm-nav-bg-hover': 'rgba(149, 0, 255, 0.08)',
            '--adm-nav-bg-active': 'rgba(149, 0, 255, 0.15)',
            '--adm-nav-text': 'rgba(240, 236, 246, 0.65)',
            '--adm-nav-text-active': '#c084fc',
            '--adm-text': 'rgba(240, 236, 246, 0.85)',
            '--adm-text-muted': 'rgba(240, 236, 246, 0.55)',
            '--adm-input-bg': 'rgba(0, 0, 0, 0.25)',
            '--adm-table-header-bg': 'rgba(0, 0, 0, 0.18)',
        } : {
            '--ws-bg': '#F4F2F9',
            '--ws-surface': '#FFFFFF',
            '--ws-surface-2': '#EDE9F7',
            '--ws-border': 'rgba(124, 58, 237, 0.14)',
            '--ws-border-2': 'rgba(124, 58, 237, 0.07)',
            '--ws-text': '#111018',
            '--ws-text-2': 'rgba(17, 16, 24, 0.72)',
            '--ws-text-3': 'rgba(17, 16, 24, 0.55)',
            '--ws-purple': '#7C3AED',
            '--ws-purple-lt': 'rgba(124, 58, 237, 0.1)',
            '--sb-bg': '#FAF9FF',
            '--sb-border': 'rgba(124, 58, 237, 0.1)',
            '--sb-item-hover': 'rgba(124, 58, 237, 0.07)',
            '--sb-item-active-bg': 'rgba(124, 58, 237, 0.1)',
            '--sb-text': 'rgba(17, 16, 24, 0.65)',
            '--sb-text-hover': 'rgba(17, 16, 24, 0.85)',
            '--sb-text-active': '#7C3AED',
            '--sb-divider': 'rgba(17, 16, 24, 0.1)',
            '--sb-icon-muted': 'rgba(17, 16, 24, 0.48)',
            '--sb-icon-hover': '#111018',
            '--sb-menu-bg': '#FFFFFF',
            '--sb-menu-border': 'rgba(124, 58, 237, 0.15)',
            '--sb-menu-text': 'rgba(17, 16, 24, 0.82)',
            '--sb-profile-border': 'rgba(17, 16, 24, 0.08)',
            '--sb-recent-name': 'rgba(17, 16, 24, 0.75)',
            '--sb-recent-meta': 'rgba(17, 16, 24, 0.50)',
            '--sb-recent-empty': 'rgba(17, 16, 24, 0.45)',
            '--sb-mobile-bg': '#FAF9FF',
            '--auth-bg': '#F4F2F9',
            '--auth-card-bg': '#FFFFFF',
            '--auth-card-border': '#E5E7EB',
            '--auth-card-shadow': '0 4px 24px rgba(0,0,0,0.06)',
            '--auth-title': '#111827',
            '--auth-sub': '#9CA3AF',
            '--misc-bg': '#F4F2F9',
            '--misc-text': '#111018',
            '--misc-text-2': 'rgba(17, 16, 24, 0.68)',
            '--misc-text-3': 'rgba(17, 16, 24, 0.52)',
            '--misc-card-bg': 'rgba(17, 16, 24, 0.03)',
            '--misc-card-border': 'rgba(17, 16, 24, 0.08)',
            '--pill-green-bg': 'rgba(34, 197, 94, 0.1)',
            '--pill-green-text': '#15803d',
            '--pill-blue-bg': 'rgba(96, 165, 250, 0.1)',
            '--pill-blue-text': '#1d4ed8',
            '--pill-red-bg': 'rgba(248, 113, 113, 0.1)',
            '--pill-red-text': '#b91c1c',
            '--pill-yellow-bg': 'rgba(251, 191, 36, 0.1)',
            '--pill-yellow-text': '#854d0e',
            '--pill-gray-bg': 'rgba(17, 16, 24, 0.06)',
            '--pill-gray-text': 'rgba(17, 16, 24, 0.45)',
            '--toggle-bg': 'rgba(17, 16, 24, 0.07)',
            '--toggle-active-bg': '#7C3AED',
            '--toggle-icon': 'rgba(17, 16, 24, 0.45)',
            '--toggle-icon-active': '#ffffff',
            '--landing-bg': '#FAFAFA',
            '--landing-surface': '#FFFFFF',
            '--landing-surface-2': '#F5F3F7',
            '--landing-text': '#111018',
            '--landing-text-secondary': '#5C5670',
            '--landing-text-muted': '#9890A8',
            '--landing-border': 'rgba(0, 0, 0, 0.06)',
            '--landing-border-accent': 'rgba(149, 0, 255, 0.12)',
            // ── Admin panel tokens (light) ────────────────────────────
            '--ws-bg-elevated': '#FFFFFF',
            '--adm-border': 'rgba(124, 58, 237, 0.18)',
            '--adm-border-soft': 'rgba(124, 58, 237, 0.08)',
            '--adm-nav-bg-hover': 'rgba(124, 58, 237, 0.07)',
            '--adm-nav-bg-active': 'rgba(124, 58, 237, 0.12)',
            '--adm-nav-text': 'rgba(17, 16, 24, 0.65)',
            '--adm-nav-text-active': '#7C3AED',
            '--adm-text': 'rgba(17, 16, 24, 0.85)',
            '--adm-text-muted': 'rgba(17, 16, 24, 0.55)',
            '--adm-input-bg': '#FFFFFF',
            '--adm-table-header-bg': 'rgba(17, 16, 24, 0.04)',
        }
        Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
    }

    function init() {
        _apply(resolvedTheme.value)
    }

    function setTheme(theme) {
        if (!['light', 'dark'].includes(theme)) return
        preference.value = theme
        try { localStorage.setItem(STORAGE_KEY, theme) } catch (e) { }
        _apply(resolvedTheme.value)
    }

    function toggle() {
        setTheme(isDark.value ? 'light' : 'dark')
    }

    // Apply CSS vars now that store is initialized
    _apply(resolvedTheme.value)

    return { preference, resolvedTheme, isDark, init, setTheme, toggle }
})