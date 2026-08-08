<!-- frontend/src/components/layout/AppLayout.vue
     Shared layout shell used by both UserLayout and AdminLayout. Owns the
     layout chrome (flex container, mobile top bar, desktop sidebar with
     collapse + localStorage persistence, mobile drawer with swipe-to-close,
     theme toggle, language picker). Surface-area-specific content (CTAs,
     middle body, footer buttons, profile area) is provided via named slots
     so the two layouts stay structurally + visually identical. -->
<template>
    <div class="app-layout">
        <!-- Mobile top bar - visible only on <768px -->
        <header class="app-mobile-header">
            <button class="app-mobile-menu-btn" @click="openDrawer" :aria-label="$t('nav.openMenu')">
                <Menu :size="20" />
            </button>
            <router-link :to="homeLink" class="app-mobile-brand">
                <LogoComponent class="app-mobile-logo" size="small" />
                <span v-if="brandTag" class="app-brand-tag">{{ brandTag }}</span>
            </router-link>
            <div class="app-mobile-spacer"></div>
        </header>

        <!-- Desktop sidebar -->
        <aside class="app-sidebar" :class="{ 'app-sidebar--collapsed': !sidebarOpen }">
            <div class="app-sidebar-header" :class="{ 'app-sidebar-header--collapsed': !sidebarOpen }">
                <router-link v-if="sidebarOpen" :to="homeLink" class="app-brand">
                    <LogoComponent class="app-brand-logo" size="small" />
                    <span v-if="brandTag" class="app-brand-tag">{{ brandTag }}</span>
                </router-link>
                <button class="app-sidebar-toggle" @click="toggleSidebar"
                    :title="sidebarOpen ? 'Collapse' : 'Expand'">
                    <component :is="sidebarOpen ? PanelLeftClose : PanelLeftOpen" :size="18" />
                </button>
            </div>

            <!-- CTA slot - e.g. "New file" button -->
            <div v-if="$slots['header-cta']" class="app-sidebar-cta">
                <slot name="header-cta" :collapsed="!sidebarOpen" :is-mobile="false" />
            </div>

            <!-- Nav -->
            <nav class="app-nav">
                <router-link v-for="item in navItems" :key="item.name" :to="navTarget(item)"
                    class="app-nav-item" :class="{ 'app-nav-item--icon-only': !sidebarOpen }"
                    :active-class="item.exact ? '' : 'app-nav-item--active'"
                    :exact-active-class="item.exact ? 'app-nav-item--active' : ''">
                    <component :is="item.icon" :size="18" class="app-nav-icon" />
                    <span class="app-nav-label" v-show="sidebarOpen">{{ item.label }}</span>
                </router-link>
            </nav>

            <!-- Body slot - recent files, etc. (scrollable / takes remaining
                 vertical space). When the sidebar is collapsed it's hidden so
                 the bottom cluster pinches up against the nav. -->
            <div v-if="$slots.body && sidebarOpen" class="app-sidebar-body">
                <slot name="body" :collapsed="!sidebarOpen" :is-mobile="false" :close-drawer="closeDrawer" />
            </div>
            <div v-else class="app-sidebar-spacer"></div>

            <!-- Bottom cluster - everything below the scrolling body is pinned
                 to the sidebar's bottom edge as one flex-shrink:0 group, so
                 it never floats up into the body or gets pushed off-screen.
                 Order: extras (e.g. admin mode toggle) → theme → lang →
                 footer → profile. -->
            <div class="app-sidebar-bottom">
                <!-- Extras slot - bottom-pinned controls like the admin
                     Legacy/New mode toggle. Sits directly above the theme row. -->
                <div v-if="$slots['bottom-extras']" class="app-sidebar-extras">
                    <slot name="bottom-extras" :collapsed="!sidebarOpen" :is-mobile="false" :close-drawer="closeDrawer" />
                </div>

                <!-- Theme toggle -->
                <div class="app-theme-section" :class="{ 'app-theme-section--collapsed': !sidebarOpen }">
                    <div v-if="sidebarOpen" class="app-theme-pill">
                        <button class="app-theme-pill-btn" :class="{ active: !isDark }"
                            @click="themeStore.setTheme('light')" :title="$t('settings.personal.themeLight')">
                            <Sun :size="14" />
                        </button>
                        <button class="app-theme-pill-btn" :class="{ active: isDark }"
                            @click="themeStore.setTheme('dark')" :title="$t('settings.personal.themeDark')">
                            <Moon :size="14" />
                        </button>
                    </div>
                    <button v-else class="app-theme-icon-btn" @click="themeStore.toggle()"
                        :title="isDark ? $t('settings.personal.themeLight') : $t('settings.personal.themeDark')">
                        <component :is="isDark ? Sun : Moon" :size="16" />
                    </button>
                </div>

                <!-- Language picker -->
                <div class="app-lang-section" :class="{ 'app-lang-section--collapsed': !sidebarOpen }"
                    ref="langRef">
                    <button v-if="sidebarOpen" class="app-lang-trigger" @click="toggleLangMenu">
                        <img class="app-lang-flag" :src="currentLangFlagSrc" :alt="currentLang.name">
                        <span class="app-lang-name">{{ currentLang.name }}</span>
                        <ChevronDown :size="14" class="app-lang-chevron" :class="{ rotated: isLangMenuOpen }" />
                    </button>
                    <button v-else class="app-lang-icon-btn" @click="toggleLangMenu" :title="currentLang.name">
                        <img class="app-lang-flag" :src="currentLangFlagSrc" :alt="currentLang.name">
                    </button>
                    <Transition name="app-menu-pop">
                        <div v-if="isLangMenuOpen" class="app-lang-menu">
                            <button v-for="lang in languages" :key="lang.code" class="app-lang-option"
                                :class="{ active: selectedLanguage === lang.code }" @click="selectLanguage(lang.code)">
                                <img class="app-lang-flag" :src="langFlagSrc(lang.flag)" :alt="lang.name">
                                <span>{{ lang.name }}</span>
                            </button>
                        </div>
                    </Transition>
                </div>

                <!-- Footer buttons slot - reserved for surface-specific extras. -->
                <div v-if="$slots.footer" class="app-sidebar-footer">
                    <slot name="footer" :collapsed="!sidebarOpen" :is-mobile="false" />
                </div>

                <!-- Profile slot - avatar + menu (user-side) / admin info. -->
                <div v-if="$slots.profile" class="app-sidebar-profile">
                    <slot name="profile" :collapsed="!sidebarOpen" :is-mobile="false" />
                </div>
            </div>
        </aside>

        <!-- Mobile drawer -->
        <Transition name="app-drawer">
            <div v-if="mobileDrawerOpen" class="app-mobile-overlay" @click="closeDrawer">
                <aside class="app-mobile-drawer" @click.stop @touchstart="onDrawerTouchStart"
                    @touchmove="onDrawerTouchMove" @touchend="onDrawerTouchEnd" :style="drawerTransform">
                    <div class="app-sidebar-header">
                        <router-link :to="homeLink" class="app-brand" @click="closeDrawer">
                            <LogoComponent class="app-brand-logo" size="small" />
                            <span v-if="brandTag" class="app-brand-tag">{{ brandTag }}</span>
                        </router-link>
                        <button class="app-sidebar-toggle" @click="closeDrawer" :aria-label="$t('nav.closeMenu')">
                            <X :size="18" />
                        </button>
                    </div>

                    <div v-if="$slots['header-cta']" class="app-sidebar-cta">
                        <slot name="header-cta" :collapsed="false" :is-mobile="true" />
                    </div>

                    <nav class="app-nav">
                        <router-link v-for="item in navItems" :key="item.name" :to="navTarget(item)"
                            class="app-nav-item"
                            :active-class="item.exact ? '' : 'app-nav-item--active'"
                            :exact-active-class="item.exact ? 'app-nav-item--active' : ''"
                            @click="closeDrawer">
                            <component :is="item.icon" :size="18" class="app-nav-icon" />
                            <span class="app-nav-label">{{ item.label }}</span>
                        </router-link>
                    </nav>

                    <div v-if="$slots.body" class="app-sidebar-body">
                        <slot name="body" :collapsed="false" :is-mobile="true" :close-drawer="closeDrawer" />
                    </div>
                    <div v-else class="app-sidebar-spacer"></div>

                    <div v-if="$slots['bottom-extras']" class="app-sidebar-extras">
                        <slot name="bottom-extras" :collapsed="false" :is-mobile="true" :close-drawer="closeDrawer" />
                    </div>

                    <div class="app-theme-section">
                        <div class="app-theme-pill">
                            <button class="app-theme-pill-btn" :class="{ active: !isDark }"
                                @click="themeStore.setTheme('light')" :title="$t('settings.personal.themeLight')">
                                <Sun :size="14" />
                            </button>
                            <button class="app-theme-pill-btn" :class="{ active: isDark }"
                                @click="themeStore.setTheme('dark')" :title="$t('settings.personal.themeDark')">
                                <Moon :size="14" />
                            </button>
                        </div>
                    </div>

                    <div class="app-lang-section" ref="langMobileRef">
                        <button class="app-lang-trigger" @click="toggleLangMenu">
                            <img class="app-lang-flag" :src="currentLangFlagSrc" :alt="currentLang.name">
                            <span class="app-lang-name">{{ currentLang.name }}</span>
                            <ChevronDown :size="14" class="app-lang-chevron" :class="{ rotated: isLangMenuOpen }" />
                        </button>
                        <Transition name="app-menu-pop">
                            <div v-if="isLangMenuOpen" class="app-lang-menu">
                                <button v-for="lang in languages" :key="lang.code" class="app-lang-option"
                                    :class="{ active: selectedLanguage === lang.code }"
                                    @click="selectLanguage(lang.code)">
                                    <img class="app-lang-flag" :src="langFlagSrc(lang.flag)" :alt="lang.name">
                                    <span>{{ lang.name }}</span>
                                </button>
                            </div>
                        </Transition>
                    </div>

                    <div v-if="$slots.footer" class="app-sidebar-footer">
                        <slot name="footer" :collapsed="false" :is-mobile="true" :close-drawer="closeDrawer" />
                    </div>

                    <div v-if="$slots.profile" class="app-sidebar-profile">
                        <slot name="profile" :collapsed="false" :is-mobile="true" :close-drawer="closeDrawer" />
                    </div>
                </aside>
            </div>
        </Transition>

        <!-- Main content -->
        <main class="app-main">
            <!-- Top-right corner control - surface-switch button (user→admin
                 "Admin panel" entry, admin→user "Back to app" exit) lives here
                 instead of in the sidebar so both sit in the same fixed spot.
                 Floats over the content's top-right; pages with their own top
                 padding sit comfortably beneath it. -->
            <div v-if="$slots.corner" class="app-corner">
                <slot name="corner" />
            </div>
            <div class="app-content">
                <slot />
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import LogoComponent from '@/components/Logo.vue'
import {
    Menu, X, Sun, Moon, ChevronDown, PanelLeftClose, PanelLeftOpen,
} from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'
import { changeLocale } from '@/utils/i18n'

const props = defineProps({
    /** Where the brand (logo) links to. */
    homeLink: { type: String, required: true },
    /** Optional small tag rendered next to the brand (e.g. "ADMIN"). */
    brandTag: { type: String, default: '' },
    /** Nav items: [{ name?, to?, label, icon, exact? }]. Either `name` (route
     *  name) or `to` (raw to-value) must be set. */
    navItems: { type: Array, default: () => [] },
    /** localStorage key used to persist the desktop sidebar's open/collapsed state. */
    storageKey: { type: String, required: true },
})

const route = useRoute()
const { t, locale } = useI18n()
const themeStore = useThemeStore()

const isDark = computed(() => themeStore.resolvedTheme === 'dark')

// ── Sidebar state ──────────────────────────────────────────────────────────
const MOBILE_BREAKPOINT = 768
const sidebarOpen = ref(true)
const mobileDrawerOpen = ref(false)
const isLargeScreen = ref(typeof window !== 'undefined' ? window.innerWidth >= MOBILE_BREAKPOINT : true)

const toggleSidebar = () => { sidebarOpen.value = !sidebarOpen.value }
const openDrawer = () => { mobileDrawerOpen.value = true }
const closeDrawer = () => { mobileDrawerOpen.value = false }

// ── Language picker (mirrors prior implementation) ─────────────────────────
const languages = [
    { code: 'en', name: 'English', flag: 'gb' },
    { code: 'ru', name: 'Русский', flag: 'ru' },
    { code: 'uz', name: "O'zbek", flag: 'uz' },
]
const selectedLanguage = ref(locale.value || 'ru')
const isLangMenuOpen = ref(false)
const langRef = ref(null)
const langMobileRef = ref(null)

const currentLang = computed(() => languages.find(l => l.code === selectedLanguage.value) || languages[1])
const currentLangFlagSrc = computed(() => `/images/country-flags/${currentLang.value.flag}.svg`)

function langFlagSrc(flag) { return `/images/country-flags/${flag}.svg` }
function toggleLangMenu() { isLangMenuOpen.value = !isLangMenuOpen.value }
function selectLanguage(code) {
    changeLocale(code)
    selectedLanguage.value = code
    isLangMenuOpen.value = false
}

// Close on outside-click. Two refs because desktop and mobile picker can
// coexist briefly (drawer overlay sits on top of desktop sidebar).
onClickOutside(langRef, () => { isLangMenuOpen.value = false })
onClickOutside(langMobileRef, () => { isLangMenuOpen.value = false })

// ── Nav target helper ──────────────────────────────────────────────────────
function navTarget(item) {
    if (item.to) return item.to
    if (item.name) return { name: item.name }
    return '/'
}

// ── Mobile drawer swipe-to-close ───────────────────────────────────────────
const SWIPE_CLOSE_THRESHOLD = 70
const touchStartX = ref(0)
const touchDeltaX = ref(0)
const isSwiping = ref(false)
const drawerTransform = computed(() => {
    if (!isSwiping.value || touchDeltaX.value >= 0) return ''
    return `transform: translateX(${touchDeltaX.value}px); transition: none;`
})
function onDrawerTouchStart(e) {
    if (!e.touches[0]) return
    touchStartX.value = e.touches[0].clientX
    touchDeltaX.value = 0
    isSwiping.value = true
}
function onDrawerTouchMove(e) {
    if (!isSwiping.value || !e.touches[0]) return
    touchDeltaX.value = e.touches[0].clientX - touchStartX.value
}
function onDrawerTouchEnd() {
    if (!isSwiping.value) return
    isSwiping.value = false
    if (touchDeltaX.value < -SWIPE_CLOSE_THRESHOLD) closeDrawer()
    touchDeltaX.value = 0
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
const handleResize = () => {
    const wasLarge = isLargeScreen.value
    isLargeScreen.value = window.innerWidth >= MOBILE_BREAKPOINT
    if (!wasLarge && isLargeScreen.value) mobileDrawerOpen.value = false
}

onMounted(() => {
    try {
        const saved = localStorage.getItem(props.storageKey)
        if (saved !== null) sidebarOpen.value = JSON.parse(saved)
    } catch (e) { /* ignore */ }
    window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    document.body.style.overflow = ''
})

// Persist desktop sidebar state
watch(sidebarOpen, (v) => {
    try { localStorage.setItem(props.storageKey, JSON.stringify(v)) } catch (e) { /* ignore */ }
})

// Auto-close drawer on route change
watch(() => route.fullPath, () => { mobileDrawerOpen.value = false })

// Lock body scroll while drawer is open
watch(mobileDrawerOpen, (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
})

// Expose icons for templates that need them via $attrs (we reference them
// directly via :is bindings, no need to expose).
defineExpose({})
</script>

<style scoped>
/* ─── Shell ───────────────────────────────────────────────────────────────── */
.app-layout {
    display: flex;
    height: 100vh;
    /* Dynamic viewport height - handles iOS Safari address bar gracefully */
    height: 100dvh;
    background: var(--ws-bg);
    color: var(--ws-text);
    overflow: hidden;
}

/* ─── Mobile top bar ─────────────────────────────────────────────────────── */
.app-mobile-header {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--sb-bg);
    border-bottom: 1px solid var(--sb-border);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 40;
}

.app-mobile-menu-btn {
    background: transparent;
    border: none;
    color: var(--sb-icon-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    transition: background 0.15s, color 0.15s;
}

.app-mobile-menu-btn:hover {
    background: var(--sb-item-hover);
    color: var(--sb-icon-hover);
}

.app-mobile-brand {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    line-height: 1.1;
    text-decoration: none;
    color: inherit;
    min-width: 0;
    overflow: hidden;
}

.app-mobile-logo {
    height: 22px;
    width: auto;
    flex-shrink: 0;
}

.app-mobile-spacer {
    width: 32px;
}

/* ─── Desktop sidebar ────────────────────────────────────────────────────── */
.app-sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--sb-bg);
    border-right: 1px solid var(--sb-border);
    transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s, border-color 0.2s;
}

.app-sidebar--collapsed {
    width: 60px;
}

.app-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
    border-bottom: 1px solid var(--sb-border);
    min-height: 56px;
    flex-shrink: 0;
}

.app-sidebar-header--collapsed {
    justify-content: center;
    padding: 14px 0;
}

.app-brand {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: inherit;
    line-height: 1.1;
    overflow: hidden;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
}

.app-brand-logo {
    height: 24px;
    width: auto;
    flex-shrink: 0;
}

.app-brand-tag {
    font-size: 10px;
    color: var(--ws-purple);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.1em;
}

.app-sidebar-toggle {
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    color: var(--sb-icon-muted);
    cursor: pointer;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
}

.app-sidebar-toggle:hover {
    background: var(--sb-item-hover);
    color: var(--sb-icon-hover);
}

/* ─── CTA (top-of-sidebar action) ─────────────────────────────────────────── */
.app-sidebar-cta {
    padding: 12px;
    flex-shrink: 0;
}

/* ─── Nav ─────────────────────────────────────────────────────────────────── */
.app-nav {
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
}

.app-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    text-decoration: none;
    color: var(--sb-text);
    font-size: 13px;
    font-weight: 500;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
    overflow: hidden;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
}

.app-nav-item:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

.app-nav-item--active {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
}

.app-nav-item--icon-only {
    justify-content: center;
    padding: 10px;
    gap: 0;
}

.app-nav-icon {
    flex-shrink: 0;
}

.app-nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ─── Body (middle scrollable section) ────────────────────────────────────── */
.app-sidebar-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 12px;
    display: flex;
    flex-direction: column;
}

.app-sidebar-body::-webkit-scrollbar {
    width: 4px;
}

.app-sidebar-body::-webkit-scrollbar-thumb {
    background: var(--sb-item-hover);
    border-radius: 2px;
}

/* Spacer fills the same vertical space when body slot is empty, so the
   footer always sits flush against the bottom edge. */
.app-sidebar-spacer {
    flex: 1;
    min-height: 0;
}

/* ─── Theme toggle ───────────────────────────────────────────────────────── */
.app-theme-section {
    padding: 8px 12px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.app-theme-section--collapsed {
    justify-content: center;
    padding: 8px 0;
}

.app-theme-pill {
    width: 100%;
    align-items: center;
    grid-template-columns: 50% 50%;
    display: inline-grid !important;
    justify-content: space-between;
    background: var(--toggle-bg);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
}

.app-theme-pill-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--toggle-icon);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-family: inherit;
}

.app-theme-pill-btn.active {
    background: var(--toggle-active-bg);
    color: var(--toggle-icon-active);
}

.app-theme-pill-btn:not(.active):hover {
    color: var(--sb-text-hover);
    background: var(--sb-item-hover);
}

.app-theme-icon-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: var(--toggle-bg);
    color: var(--toggle-icon);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-family: inherit;
}

.app-theme-icon-btn:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

/* ─── Language picker ────────────────────────────────────────────────────── */
.app-lang-section {
    padding: 4px 12px;
    flex-shrink: 0;
    position: relative;
}

.app-lang-section--collapsed {
    padding: 4px 0;
    display: flex;
    justify-content: center;
}

.app-lang-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: var(--toggle-bg);
    border: none;
    border-radius: 9px;
    color: var(--sb-text-hover);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
}

.app-lang-trigger:hover {
    background: var(--sb-item-hover);
}

.app-lang-flag {
    width: 20px;
    line-height: 1;
    flex-shrink: 0;
    object-fit: cover;
}

.app-lang-name {
    flex: 1;
    text-align: left;
}

.app-lang-chevron {
    color: var(--sb-icon-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
}

.app-lang-chevron.rotated {
    transform: rotate(180deg);
}

.app-lang-icon-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: var(--toggle-bg);
    cursor: pointer;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
}

.app-lang-icon-btn:hover {
    background: var(--sb-item-hover);
}

.app-lang-menu {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 12px;
    right: 12px;
    background: var(--sb-menu-bg);
    border: 1px solid var(--sb-menu-border);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 200;
}

.app-sidebar--collapsed .app-lang-menu {
    position: fixed;
    bottom: 80px;
    left: 72px;
    min-width: 160px;
    right: unset;
}

.app-lang-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--sb-menu-text);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    text-align: left;
    font-family: inherit;
}

.app-lang-option:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

.app-lang-option.active {
    color: var(--ws-purple);
    font-weight: 600;
}

/* ─── Bottom cluster (pinned below the scrolling body) ───────────────────────
   Groups extras + theme + lang + footer + profile into one flex-shrink:0
   block so they always sit flush at the sidebar's bottom edge. The body
   above (flex:1, min-height:0) scrolls; this cluster never moves. Fixes the
   overflow where the profile got pushed off-screen on short viewports. */
.app-sidebar-bottom {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
}

/* Extras (admin Legacy/New toggle, etc.) - sits at the very top of the
   bottom cluster, separated from the body above by a hairline. */
.app-sidebar-extras {
    flex-shrink: 0;
    padding: 8px 12px;
    border-top: 1px solid var(--sb-border);
}

/* ─── Footer slot (reserved for surface-specific extras) ─────────────────── */
.app-sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 12px;
    flex-shrink: 0;
}

/* ─── Profile slot (bottom, with top border) ─────────────────────────────── */
.app-sidebar-profile {
    border-top: 1px solid var(--sb-profile-border);
    flex-shrink: 0;
}

/* ─── Top-right corner control (surface switch) ──────────────────────────── */
.app-corner {
    position: absolute;
    top: 16px;
    right: 20px;
    z-index: 20;
}

@media (max-width: 767px) {
    /* On mobile the sidebar is a drawer and the content starts under the
       mobile header, so the corner control anchors below that header. */
    .app-corner {
        top: 64px;
        right: 12px;
    }
}

/* ─── Mobile drawer ──────────────────────────────────────────────────────── */
.app-mobile-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
}

.app-mobile-drawer {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 260px;
    background: var(--sb-bg);
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--sb-border);
}

.app-drawer-enter-active,
.app-drawer-leave-active {
    transition: opacity 0.2s ease;
}

.app-drawer-enter-from,
.app-drawer-leave-to {
    opacity: 0;
}

.app-menu-pop-enter-active,
.app-menu-pop-leave-active {
    transition: opacity 0.15s, transform 0.15s;
}

.app-menu-pop-enter-from,
.app-menu-pop-leave-to {
    opacity: 0;
    transform: translateY(6px);
}

/* ─── Main content ────────────────────────────────────────────────────────── */
.app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    /* Positioning context for the absolutely-placed .app-corner control. */
    position: relative;
}

.app-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
}

.app-content::-webkit-scrollbar {
    width: 6px;
}

.app-content::-webkit-scrollbar-track {
    background: transparent;
}

.app-content::-webkit-scrollbar-thumb {
    background: rgba(149, 0, 255, 0.25);
    border-radius: 3px;
}

.app-content::-webkit-scrollbar-thumb:hover {
    background: rgba(149, 0, 255, 0.45);
}

/* ─── Mobile breakpoint switching ────────────────────────────────────────── */
@media (max-width: 767px) {
    .app-mobile-header {
        display: flex;
    }

    .app-mobile-overlay {
        display: block;
    }

    .app-sidebar {
        display: none;
    }

    .app-content {
        padding-top: 56px;
    }
}
</style>
