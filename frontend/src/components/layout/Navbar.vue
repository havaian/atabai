<template>
    <nav class="navbar">
        <div class="navbar-inner">
            <div class="navbar-row">
                <!-- Left: Logo + links -->
                <div class="navbar-left">
                    <router-link to="/" class="navbar-logo-link">
                        <LogoComponent size="large" :clickable="true" />
                    </router-link>
                    <div class="navbar-links">
                        <a href="#how-it-works" class="navbar-link">{{ $t('nav.howItWorks') }}</a>
                        <a href="#features" class="navbar-link">{{ $t('nav.features') }}</a>
                    </div>
                </div>

                <!-- Right: theme + lang + auth -->
                <div class="navbar-right">

                    <!-- Theme toggle -->
                    <button class="navbar-icon-btn" @click="themeStore.toggle()"
                        :title="themeStore.isDark ? $t('settings.personal.themeLight') : $t('settings.personal.themeDark')">
                        <SunIcon v-if="themeStore.isDark" class="w-5 h-5" />
                        <MoonIcon v-else class="w-5 h-5" />
                    </button>

                    <!-- Language selector -->
                    <div class="lang-wrap" ref="langRef">
                        <button class="lang-trigger" @click="langOpen = !langOpen">
                            <img :src="'/images/country-flags/' + currentLocale.flag + '.svg'" class="flag-img"
                                :alt="currentLocale.name" />
                            <ChevronDownIcon class="w-3.5 h-3.5 lang-chevron" :class="{ rotated: langOpen }" />
                        </button>
                        <Transition name="menu-pop">
                            <div v-if="langOpen" class="lang-dropdown">
                                <button v-for="loc in availableLocales" :key="loc.code" class="lang-option"
                                    :class="{ active: loc.code === currentLocale.code }"
                                    @click="changeLanguage(loc.code)">
                                    <img :src="'/images/country-flags/' + loc.flag + '.svg'" class="flag-img"
                                        :alt="loc.name" />
                                    <span>{{ loc.name }}</span>
                                </button>
                            </div>
                        </Transition>
                    </div>

                    <!-- Auth -->
                    <div v-if="!authStore.isAuthenticated">
                        <button @click="authStore.login" class="btn-auth hover-glow inline-flex items-center">
                            <GoogleIcon size="16" className="mr-2" />
                            {{ $t('auth.signInWithGoogle') }}
                        </button>
                    </div>
                    <div v-else>
                        <button @click="router.push('/app/dashboard')"
                            class="btn-auth hover-glow inline-flex items-center">
                            {{ $t('nav.dashboard') }}
                        </button>
                    </div>
                </div>

                <!-- Mobile burger -->
                <button class="mobile-burger" @click="mobileOpen = !mobileOpen">
                    <Bars3Icon v-if="!mobileOpen" class="w-6 h-6" />
                    <XMarkIcon v-else class="w-6 h-6" />
                </button>
            </div>
        </div>

        <!-- Mobile menu -->
        <Transition name="mobile-drop">
            <div v-if="mobileOpen" class="mobile-menu">
                <a href="#features" @click="mobileOpen = false" class="mobile-link">{{ $t('nav.features') }}</a>
                <a href="#how-it-works" @click="mobileOpen = false" class="mobile-link">{{ $t('nav.howItWorks') }}</a>

                <div class="mobile-divider"></div>

                <!-- Language -->
                <div class="mobile-section-label">{{ $t('nav.language') }}</div>
                <div class="mobile-lang-grid">
                    <button v-for="loc in availableLocales" :key="loc.code" class="mobile-lang-btn"
                        :class="{ active: loc.code === currentLocale.code }" @click="changeLanguage(loc.code)">
                        <img :src="'/images/country-flags/' + loc.flag + '.svg'" class="flag-img" :alt="loc.name" />
                        <span>{{ loc.name }}</span>
                    </button>
                </div>

                <div class="mobile-divider"></div>

                <!-- Theme -->
                <div class="mobile-section-label">{{ $t('settings.personal.theme') }}</div>
                <div class="mobile-theme-grid">
                    <button class="mobile-theme-btn" :class="{ active: themeStore.preference === 'light' }"
                        @click="themeStore.setTheme('light')">
                        <SunIcon class="w-4 h-4" />
                        {{ $t('settings.personal.themeLight') }}
                    </button>
                    <button class="mobile-theme-btn" :class="{ active: themeStore.preference === 'dark' }"
                        @click="themeStore.setTheme('dark')">
                        <MoonIcon class="w-4 h-4" />
                        {{ $t('settings.personal.themeDark') }}
                    </button>
                    <!-- <button class="mobile-theme-btn" :class="{ active: themeStore.preference === 'system' }"
                        @click="themeStore.setTheme('system')">
                        {{ $t('settings.personal.themeSystem') }}
                    </button> -->
                </div>

                <div class="mobile-divider"></div>

                <!-- Auth -->
                <div class="px-4 pb-4">
                    <button v-if="!authStore.isAuthenticated" @click="authStore.login; mobileOpen = false"
                        class="btn-auth hover-glow inline-flex items-center justify-center w-full">
                        <GoogleIcon size="16" className="mr-2" />
                        {{ $t('auth.signInWithGoogle') }}
                    </button>
                    <button v-else @click="router.push('/app/dashboard'); mobileOpen = false"
                        class="btn-auth hover-glow inline-flex items-center justify-center w-full">
                        {{ $t('nav.dashboard') }}
                    </button>
                </div>
            </div>
        </Transition>
    </nav>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import LogoComponent from '@/components/Logo.vue'
import GoogleIcon from '@/components/icons/GoogleIcon.vue'
import {
    ChevronDownIcon, Bars3Icon, XMarkIcon, SunIcon, MoonIcon
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { availableLocales, changeLocale } from '@/utils/i18n'

const router = useRouter()
const { locale } = useI18n()
const authStore = useAuthStore()
const themeStore = useThemeStore()

const mobileOpen = ref(false)
const langOpen = ref(false)
const langRef = ref(null)

onClickOutside(langRef, () => { langOpen.value = false })

const currentLocale = computed(() =>
    availableLocales.find(l => l.code === locale.value) || availableLocales[0]
)

async function changeLanguage(code) {
    await changeLocale(code)
    langOpen.value = false
    mobileOpen.value = false
}
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

/* ── Left ─────────────────────────────────────────────────────── */
.navbar-left {
    display: flex;
    align-items: center;
    gap: 32px;
}

.navbar-logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
}

.navbar-links {
    display: none;
    gap: 4px;
}

@media (min-width: 768px) {
    .navbar-links {
        display: flex;
    }
}

.navbar-link {
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--sb-text);
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
}

.navbar-link:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

/* ── Right ────────────────────────────────────────────────────── */
.navbar-right {
    display: none;
    align-items: center;
    gap: 8px;
}

@media (min-width: 768px) {
    .navbar-right {
        display: flex;
    }
}

.navbar-icon-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sb-icon-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.navbar-icon-btn:hover {
    background: var(--sb-item-hover);
    color: var(--sb-icon-hover);
}

/* ── Language ─────────────────────────────────────────────────── */
.lang-wrap {
    position: relative;
}

.lang-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    border: none;
    border-radius: 8px;
    background: var(--toggle-bg);
    color: var(--sb-text-hover);
    cursor: pointer;
    transition: background 0.15s;
}

.lang-trigger:hover {
    background: var(--sb-item-hover);
}

.flag-img {
    width: 20px;
    height: 14px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
}

.lang-chevron {
    color: var(--sb-icon-muted);
    transition: transform 0.2s;
}

.lang-chevron.rotated {
    transform: rotate(180deg);
}

.lang-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 160px;
    background: var(--sb-menu-bg);
    border: 1px solid var(--sb-menu-border);
    border-radius: 10px;
    padding: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 100;
}

.lang-option {
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
}

.lang-option:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

.lang-option.active {
    color: var(--ws-purple);
    font-weight: 600;
}

/* ── Mobile burger ────────────────────────────────────────────── */
.mobile-burger {
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

.mobile-burger:hover {
    background: var(--sb-item-hover);
    color: var(--sb-icon-hover);
}

@media (min-width: 768px) {
    .mobile-burger {
        display: none;
    }
}

/* ── Mobile menu ──────────────────────────────────────────────── */
.mobile-menu {
    background: var(--sb-bg);
    border-top: 1px solid var(--sb-border);
    padding: 8px 0 0;
}

.mobile-link {
    display: block;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 500;
    color: var(--sb-text-hover);
    text-decoration: none;
    transition: background 0.12s;
}

.mobile-link:hover {
    background: var(--sb-item-hover);
}

.mobile-divider {
    height: 1px;
    background: var(--sb-border);
    margin: 8px 0;
}

.mobile-section-label {
    padding: 4px 16px 8px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sb-text);
}

.mobile-lang-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 0 16px;
}

.mobile-lang-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: var(--toggle-bg);
    color: var(--sb-text-hover);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s;
}

.mobile-lang-btn:hover {
    background: var(--sb-item-hover);
}

.mobile-lang-btn.active {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
    font-weight: 600;
}

.mobile-theme-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 0 16px;
    margin-bottom: 8px;
}

.mobile-theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 6px;
    border: none;
    border-radius: 8px;
    background: var(--toggle-bg);
    color: var(--sb-text-hover);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s;
}

.mobile-theme-btn:hover {
    background: var(--sb-item-hover);
}

.mobile-theme-btn.active {
    background: var(--toggle-active-bg);
    color: var(--toggle-icon-active);
}

/* ── Transitions ──────────────────────────────────────────────── */
.menu-pop-enter-active,
.menu-pop-leave-active {
    transition: opacity 0.15s, transform 0.15s;
}

.menu-pop-enter-from,
.menu-pop-leave-to {
    opacity: 0;
    transform: translateY(6px);
}

.mobile-drop-enter-active,
.mobile-drop-leave-active {
    transition: opacity 0.15s;
}

.mobile-drop-enter-from,
.mobile-drop-leave-to {
    opacity: 0;
}
</style>