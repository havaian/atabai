<!-- frontend/src/components/layout/Navbar.vue -->

<template>
    <nav class="navbar">
        <div class="navbar-inner">
            <div class="navbar-row">

                <!-- Logo -->
                <RouterLink to="/" class="navbar-logo-link">
                    <LogoComponent />
                </RouterLink>

                <!-- Right side: language + theme + auth + hamburger -->
                <div class="navbar-actions">

                    <!-- Language switcher -->
                    <div class="navbar-lang" ref="langWrapRef">
                        <button class="navbar-lang-btn" @click="langOpen = !langOpen" :aria-label="$t('nav.language')"
                            :aria-expanded="langOpen">
                            <img :src="'/images/country-flags/' + currentLocale.flag + '.svg'" class="navbar-lang-flag"
                                :alt="currentLocale.name" />
                            <span class="navbar-lang-code">{{ currentLocale.code.toUpperCase() }}</span>
                            <ChevronDownIcon class="w-3 h-3 navbar-lang-chevron"
                                :class="{ 'navbar-lang-chevron--open': langOpen }" />
                        </button>
                        <Transition name="lang-dropdown">
                            <div v-if="langOpen" class="navbar-lang-menu" role="menu">
                                <button v-for="loc in availableLocales" :key="loc.code" class="navbar-lang-item"
                                    :class="{ 'navbar-lang-item--active': loc.code === currentLocale.code }"
                                    @click="selectLanguage(loc.code)" role="menuitem">
                                    <img :src="'/images/country-flags/' + loc.flag + '.svg'" class="navbar-lang-flag"
                                        :alt="loc.name" />
                                    <span>{{ loc.name }}</span>
                                </button>
                            </div>
                        </Transition>
                    </div>

                    <!-- Theme toggle -->
                    <button class="navbar-theme-btn" @click="themeStore.toggle()"
                        :aria-label="themeStore.isDark ? $t('nav.themeToLight') : $t('nav.themeToDark')">
                        <SunIcon v-if="themeStore.isDark" class="w-4 h-4" />
                        <MoonIcon v-else class="w-4 h-4" />
                    </button>

                    <!-- Auth button -->
                    <RouterLink v-if="!authStore.isAuthenticated" to="/login"
                        class="navbar-auth-btn navbar-auth-btn--signin">
                        {{ $t('nav.signIn') }}
                    </RouterLink>
                    <RouterLink v-else to="/app/dashboard" class="navbar-auth-btn navbar-auth-btn--dashboard">
                        {{ $t('nav.dashboard') }}
                    </RouterLink>

                    <!-- Hamburger — all screen sizes -->
                    <button class="navbar-burger" @click="menuOpen = !menuOpen" :aria-label="$t('nav.openMenu')">
                        <Bars3Icon class="w-5 h-5" />
                    </button>

                </div>

            </div>
        </div>
    </nav>

    <!-- Off-canvas sidebar (teleports to body, outside #app transform) -->
    <LandingMenuSidebar />
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Bars3Icon, SunIcon, MoonIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import LogoComponent from '@/components/Logo.vue'
import LandingMenuSidebar from '@/components/landing/LandingMenuSidebar.vue'
import { useLandingMenu } from '@/composables/useLandingMenu'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { availableLocales, changeLocale } from '@/utils/i18n'

const { menuOpen } = useLandingMenu()
const route = useRoute()
const { locale } = useI18n()
const authStore = useAuthStore()
const themeStore = useThemeStore()

const langOpen = ref(false)
const langWrapRef = ref(null)

const currentLocale = computed(() =>
    availableLocales.find(l => l.code === locale.value) || availableLocales[0]
)

async function selectLanguage(code) {
    await changeLocale(code)
    langOpen.value = false
}

// Close language dropdown on outside click
function onDocClick(e) {
    if (!langOpen.value) return
    if (langWrapRef.value && !langWrapRef.value.contains(e.target)) {
        langOpen.value = false
    }
}

// Toggle #app class + body scroll lock when menu opens/closes
watch(menuOpen, (v) => {
    const app = document.getElementById('app')
    if (!app) return
    if (v) {
        app.classList.add('landing-menu-open')
        document.body.style.overflow = 'hidden'
    } else {
        app.classList.remove('landing-menu-open')
        document.body.style.overflow = ''
    }
})

// Close on route navigation
watch(route, () => {
    menuOpen.value = false
    langOpen.value = false
})

// Close menus on ESC
function onKeyDown(e) {
    if (e.key === 'Escape') {
        if (langOpen.value) langOpen.value = false
        else if (menuOpen.value) menuOpen.value = false
    }
}

onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('click', onDocClick)
    const app = document.getElementById('app')
    if (app) app.classList.remove('landing-menu-open')
    document.body.style.overflow = ''
})
</script>

<style scoped>
.navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--sb-bg);
    border-bottom: 1px solid var(--sb-border);
    transition: background 0.2s, border-color 0.2s;
}

.navbar-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
}

.navbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
}

.navbar-logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
}

.navbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

/* ── Language switcher ───────────────────────────────────── */
.navbar-lang {
    position: relative;
}

.navbar-lang-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--sb-border);
    border-radius: 9px;
    background: transparent;
    color: var(--sb-text-hover);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    line-height: 1;
}

.navbar-lang-btn:hover {
    background: var(--sb-item-hover);
    border-color: var(--sb-border);
    color: var(--sb-text-active);
}

.navbar-lang-flag {
    width: 16px;
    height: 12px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
}

.navbar-lang-code {
    letter-spacing: 0.03em;
}

.navbar-lang-chevron {
    color: var(--sb-icon-muted);
    transition: transform 0.18s;
}

.navbar-lang-chevron--open {
    transform: rotate(180deg);
}

.navbar-lang-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 160px;
    padding: 6px;
    background: var(--sb-menu-bg);
    border: 1px solid var(--sb-menu-border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 60;
}

.navbar-lang-item {
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
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
}

.navbar-lang-item:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

.navbar-lang-item--active {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
}

/* ── Theme toggle ────────────────────────────────────────── */
.navbar-theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--sb-border);
    border-radius: 9px;
    background: transparent;
    color: var(--sb-icon-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.navbar-theme-btn:hover {
    background: var(--sb-item-hover);
    color: var(--sb-icon-hover);
}

/* ── Auth button ─────────────────────────────────────────── */
.navbar-auth-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
    line-height: 1;
}

.navbar-auth-btn--signin {
    background: #9500FF;
    color: #fff;
    border: 1px solid transparent;
}

.navbar-auth-btn--signin:hover {
    background: #7B00D4;
}

.navbar-auth-btn--dashboard {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
    border: 1px solid var(--sb-border);
}

.navbar-auth-btn--dashboard:hover {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
}

/* ── Burger ──────────────────────────────────────────────── */
.navbar-burger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sb-icon-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.navbar-burger:hover {
    background: var(--sb-item-hover);
    color: var(--sb-icon-hover);
}

/* ── Dropdown transition ─────────────────────────────────── */
.lang-dropdown-enter-active,
.lang-dropdown-leave-active {
    transition: opacity 0.15s, transform 0.15s;
    transform-origin: top right;
}

.lang-dropdown-enter-from,
.lang-dropdown-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}

/* ── Mobile: hide language + theme, keep only auth + burger ─── */
@media (max-width: 768px) {

    .navbar-lang,
    .navbar-theme-btn {
        display: none;
    }
}
</style>

<!-- ─────────────────────────────────────────────────────────────
     Global styles for st-effect-11 "Scale & rotate pusher"
     #app is the pusher. LandingMenuSidebar teleports outside it.
     ───────────────────────────────────────────────────────────── -->
<style>
/* Body background behind the receded #app — pure CSS, reacts to theme instantly,
   no JS timing flash. data-theme is set on <html> before Vue even mounts. */
[data-theme="dark"] body,
html.dark body {
    background: #08060f;
}

[data-theme="light"] body {
    background: #ddd5ef;
}

/* Smooth transition always present so reverse animation works */
#app {
    transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1),
        border-radius 0.45s,
        box-shadow 0.45s;
    transform-origin: left center;
}

/* Pusher state — desktop only */
@media (min-width: 769px) {
    #app.landing-menu-open {
        transform: translateX(-220px) scale(0.88) rotate(-1.5deg);
        border-radius: 16px;
        overflow: hidden;
        /* Visible left edge so the separation is clear */
        box-shadow: -1px 0 0 0 rgba(149, 0, 255, 0.35),
            0 0 60px rgba(0, 0, 0, 0.6);
    }
}

/* Mobile — no push effect, sidebar just overlays */
@media (max-width: 768px) {
    #app.landing-menu-open {
        transform: none;
        border-radius: 0;
        overflow: visible;
    }
}
</style>