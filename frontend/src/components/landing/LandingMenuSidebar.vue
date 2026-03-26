<!-- frontend/src/components/landing/LandingMenuSidebar.vue -->

<template>
    <!-- Teleport to body — renders as sibling of #app, unaffected by #app's pusher transform -->
    <Teleport to="body">

        <!-- Backdrop: invisible click-catcher -->
        <Transition name="lsb-fade">
            <div v-if="menuOpen" class="lsb-backdrop" @click="menuOpen = false" />
        </Transition>

        <!-- Panel -->
        <Transition name="lsb-slide">
            <div v-if="menuOpen" class="lsb-panel">

                <!-- Header -->
                <div class="lsb-header">
                    <RouterLink to="/" class="lsb-logo-link" @click="menuOpen = false">
                        <LogoComponent class="lsb-logo" />
                    </RouterLink>
                    <button class="lsb-close" @click="menuOpen = false" :aria-label="$t('common.close')">
                        <XMarkIcon class="w-5 h-5" />
                    </button>
                </div>

                <!-- Nav links -->
                <nav class="lsb-nav">
                    <a href="#features" class="lsb-link" @click="handleNavClick">
                        <SparklesIcon class="lsb-link-icon" />
                        <span>{{ $t('nav.features') }}</span>
                    </a>
                    <a href="#how-it-works" class="lsb-link" @click="handleNavClick">
                        <Squares2X2Icon class="lsb-link-icon" />
                        <span>{{ $t('nav.howItWorks') }}</span>
                    </a>
                </nav>

                <div class="lsb-divider" />

                <!-- Language -->
                <div class="lsb-section">
                    <p class="lsb-label">{{ $t('nav.language') }}</p>
                    <div class="lsb-lang-grid">
                        <button v-for="loc in availableLocales" :key="loc.code" class="lsb-lang-btn"
                            :class="{ active: loc.code === currentLocale.code }" @click="changeLanguage(loc.code)">
                            <img :src="'/images/country-flags/' + loc.flag + '.svg'" class="lsb-flag" :alt="loc.name" />
                            <span>{{ loc.name }}</span>
                        </button>
                    </div>
                </div>

                <div class="lsb-divider" />

                <!-- Theme -->
                <div class="lsb-section">
                    <p class="lsb-label">{{ $t('settings.personal.theme') }}</p>
                    <div class="lsb-theme-grid">
                        <button class="lsb-theme-btn" :class="{ active: themeStore.preference === 'light' }"
                            @click="themeStore.setTheme('light')">
                            <SunIcon class="w-4 h-4" />
                            {{ $t('settings.personal.themeLight') }}
                        </button>
                        <button class="lsb-theme-btn" :class="{ active: themeStore.preference === 'dark' }"
                            @click="themeStore.setTheme('dark')">
                            <MoonIcon class="w-4 h-4" />
                            {{ $t('settings.personal.themeDark') }}
                        </button>
                        <!-- <button class="lsb-theme-btn" :class="{ active: themeStore.preference === 'system' }"
                            @click="themeStore.setTheme('system')">
                            {{ $t('settings.personal.themeSystem') }}
                        </button> -->
                    </div>
                </div>

                <!-- Auth footer -->
                <div class="lsb-footer">
                    <button v-if="!authStore.isAuthenticated" class="lsb-auth-btn"
                        @click="authStore.login(); menuOpen = false">
                        <GoogleIcon :size="16" />
                        {{ $t('auth.signInWithGoogle') }}
                    </button>
                    <button v-else class="lsb-auth-btn lsb-auth-btn--dashboard"
                        @click="router.push('/app/dashboard'); menuOpen = false">
                        {{ $t('nav.dashboard') }}
                    </button>
                </div>

            </div>
        </Transition>

    </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
    XMarkIcon,
    SunIcon,
    MoonIcon,
    SparklesIcon,
    Squares2X2Icon
} from '@heroicons/vue/24/outline'
import LogoComponent from '@/components/Logo.vue'
import GoogleIcon from '@/components/icons/GoogleIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { availableLocales, changeLocale } from '@/utils/i18n'
import { useLandingMenu } from '@/composables/useLandingMenu'

const { menuOpen } = useLandingMenu()
const router = useRouter()
const { locale } = useI18n()
const authStore = useAuthStore()
const themeStore = useThemeStore()

const currentLocale = computed(() =>
    availableLocales.find(l => l.code === locale.value) || availableLocales[0]
)

async function changeLanguage(code) {
    await changeLocale(code)
    menuOpen.value = false
}

function handleNavClick() {
    menuOpen.value = false
}
</script>

<style scoped>
/* ── Backdrop ────────────────────────────────────────────── */
.lsb-backdrop {
    position: fixed;
    inset: 0;
    z-index: 998;
    /* Transparent on desktop — the receded #app signals open state */
    background: transparent;
    cursor: pointer;
}

/* On mobile where #app doesn't move — show a dim overlay */
@media (max-width: 768px) {
    .lsb-backdrop {
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
    }
}

/* ── Panel ───────────────────────────────────────────────── */
.lsb-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 300px;
    z-index: 999;
    background: var(--sb-bg);
    border-left: 1px solid var(--sb-border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
}

/* ── Header ─────────────────────────────────────────────── */
.lsb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px 16px;
    border-bottom: 1px solid var(--sb-border);
    flex-shrink: 0;
}

.lsb-logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
}

.lsb-logo {
    height: 26px;
    width: auto;
}

.lsb-close {
    width: 32px;
    height: 32px;
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

.lsb-close:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

/* ── Nav links ───────────────────────────────────────────── */
.lsb-nav {
    display: flex;
    flex-direction: column;
    padding: 10px 10px;
    flex-shrink: 0;
}

.lsb-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--sb-text-hover);
    text-decoration: none;
    transition: background 0.12s, color 0.12s;
}

.lsb-link:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-active);
}

.lsb-link-icon {
    width: 18px;
    height: 18px;
    color: var(--sb-icon-muted);
    flex-shrink: 0;
}

/* ── Divider ─────────────────────────────────────────────── */
.lsb-divider {
    height: 1px;
    background: var(--sb-border);
    margin: 2px 0;
    flex-shrink: 0;
}

/* ── Sections ────────────────────────────────────────────── */
.lsb-section {
    padding: 14px 14px 12px;
    flex-shrink: 0;
}

.lsb-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sb-text);
    margin: 0 0 10px 2px;
}

/* Language grid */
.lsb-lang-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}

.lsb-lang-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: var(--toggle-bg);
    color: var(--sb-text-hover);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.12s;
}

.lsb-lang-btn:hover {
    background: var(--sb-item-hover);
}

.lsb-lang-btn.active {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
    font-weight: 600;
}

.lsb-flag {
    width: 18px;
    height: 13px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
}

/* Theme grid */
.lsb-theme-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}

.lsb-theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 8px 6px;
    border: none;
    border-radius: 8px;
    background: var(--toggle-bg);
    color: var(--sb-text-hover);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.12s;
}

.lsb-theme-btn:hover {
    background: var(--sb-item-hover);
}

.lsb-theme-btn.active {
    background: var(--toggle-active-bg);
    color: var(--toggle-icon-active);
}

/* ── Footer auth ─────────────────────────────────────────── */
.lsb-footer {
    margin-top: auto;
    padding: 16px 14px 28px;
    flex-shrink: 0;
}

.lsb-auth-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 20px;
    border: none;
    border-radius: 12px;
    background: #9500FF;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}

.lsb-auth-btn:hover {
    background: #7B00D4;
}

.lsb-auth-btn--dashboard {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
    border: 1px solid var(--sb-border);
}

.lsb-auth-btn--dashboard:hover {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
}

/* ── Transitions ─────────────────────────────────────────── */
.lsb-fade-enter-active,
.lsb-fade-leave-active {
    transition: opacity 0.3s;
}

.lsb-fade-enter-from,
.lsb-fade-leave-to {
    opacity: 0;
}

.lsb-slide-enter-active,
.lsb-slide-leave-active {
    transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.lsb-slide-enter-from,
.lsb-slide-leave-to {
    transform: translateX(100%);
}
</style>