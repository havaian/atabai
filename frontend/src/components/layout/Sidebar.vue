<template>
    <!-- Desktop sidebar -->
    <div v-if="isLargeScreen" class="sidebar-shell" :class="{ collapsed: !isSidebarOpen }" ref="shellRef">

        <!-- Brand header -->
        <div class="sidebar-brand" :class="{ 'sidebar-brand-collapsed': !isSidebarOpen }">
            <router-link v-if="isSidebarOpen" to="/" class="brand-link">
                <LogoComponent class="brand-logo-full" />
            </router-link>
            <button class="collapse-btn" @click="$emit('toggle')" :title="isSidebarOpen ? 'Collapse' : 'Expand'">
                <ChevronLeftIcon v-if="isSidebarOpen" class="w-4 h-4" />
                <ChevronRightIcon v-else class="w-4 h-4" />
            </button>
        </div>

        <!-- New file CTA -->
        <div class="sidebar-new">
            <button class="new-file-btn" @click="navigateTo('/app/dashboard')" :class="{ 'icon-only': !isSidebarOpen }">
                <PlusIcon class="w-4 h-4 flex-shrink-0" />
                <Transition name="fade-slide">
                    <span v-if="isSidebarOpen">{{ $t('dashboard.newProject') }}</span>
                </Transition>
            </button>
        </div>

        <!-- Navigation -->
        <nav class="sidebar-nav">
            <button class="nav-item" :class="{ active: $route.path === '/app/dashboard', 'icon-only': !isSidebarOpen }"
                @click="navigateTo('/app/dashboard')">
                <Squares2X2Icon class="nav-icon" />
                <Transition name="fade-slide">
                    <span v-if="isSidebarOpen" class="nav-label">{{ $t('nav.dashboard') }}</span>
                </Transition>
            </button>
            <button class="nav-item" :class="{ active: $route.path === '/app/history', 'icon-only': !isSidebarOpen }"
                @click="navigateTo('/app/history')">
                <ArchiveBoxIcon class="nav-icon" />
                <Transition name="fade-slide">
                    <span v-if="isSidebarOpen" class="nav-label">{{ $t('nav.history') }}</span>
                </Transition>
            </button>
        </nav>

        <!-- Divider -->
        <div v-if="isSidebarOpen" class="sidebar-divider">
            <span>{{ $t('dashboard.recentFiles') }}</span>
        </div>

        <!-- Recent files -->
        <div class="recent-files" v-show="isSidebarOpen">
            <div v-if="filesStore.isLoading && recentFiles.length === 0" class="recent-loading">
                <div class="loading-spinner"></div>
            </div>
            <div v-else-if="recentFiles.length === 0" class="recent-empty">
                <DocumentTextIcon class="w-5 h-5 opacity-30" />
                <span>{{ $t('dashboard.noFilesYetSidebar') }}</span>
            </div>
            <button v-else v-for="file in recentFiles.slice(0, 8)" :key="file.id" class="recent-item"
                @click="openFile(file)">
                <div class="recent-dot" :class="statusDotClass(file.status)"></div>
                <div class="recent-info">
                    <span class="recent-name">{{ truncate(file.originalName, 22) }}</span>
                    <span class="recent-meta">{{ formatDate(file.createdAt) }}</span>
                </div>
            </button>
        </div>

        <!-- Spacer -->
        <div class="flex-1"></div>

        <!-- Theme toggle -->
        <div class="theme-section" :class="{ 'theme-section-collapsed': !isSidebarOpen }">
            <div v-if="isSidebarOpen" class="theme-pill">
                <button class="theme-pill-btn" :class="{ active: currentTheme === 'light' }" @click="setTheme('light')"
                    :title="$t('settings.personal.themeLight')">
                    <SunIcon class="w-4 h-4" />
                </button>
                <button class="theme-pill-btn" :class="{ active: currentTheme === 'dark' }" @click="setTheme('dark')"
                    :title="$t('settings.personal.themeDark')">
                    <MoonIcon class="w-4 h-4" />
                </button>
            </div>
            <button v-else class="theme-icon-btn" @click="toggleTheme"
                :title="currentTheme === 'light' ? $t('settings.personal.themeLight') : $t('settings.personal.themeDark')">
                <SunIcon v-if="currentTheme === 'light'" class="w-4 h-4" />
                <MoonIcon v-else class="w-4 h-4" />
            </button>
        </div>

        <!-- Language picker -->
        <div class="lang-section" :class="{ 'lang-section-collapsed': !isSidebarOpen }" ref="langRef">
            <!-- Expanded: full-width dropdown trigger -->
            <button v-if="isSidebarOpen" class="lang-trigger" @click="toggleLangMenu">
                <span class="lang-flag">{{ currentLang.flag }}</span>
                <span class="lang-name">{{ currentLang.name }}</span>
                <ChevronDownIcon class="lang-chevron w-3.5 h-3.5" :class="{ 'rotated': isLangMenuOpen }" />
            </button>
            <!-- Collapsed: just the flag -->
            <button v-else class="lang-icon-btn" @click="toggleLangMenu" :title="currentLang.name">
                <span class="lang-flag-lg">{{ currentLang.flag }}</span>
            </button>
            <!-- Dropdown -->
            <Transition name="menu-pop">
                <div v-if="isLangMenuOpen" class="lang-menu">
                    <button v-for="lang in languages" :key="lang.code" class="lang-option"
                        :class="{ active: selectedLanguage === lang.code }" @click="selectLanguage(lang.code)">
                        <span>{{ lang.flag }}</span>
                        <span>{{ lang.name }}</span>
                    </button>
                </div>
            </Transition>
        </div>

        <!-- User profile -->
        <div class="sidebar-profile" :class="{ 'icon-only': !isSidebarOpen }" ref="profileRef">
            <div class="profile-avatar" @click="toggleProfileMenu">
                <img v-if="authStore.user?.picture" :src="authStore.user.picture" alt="avatar" class="avatar-img" />
                <span v-else class="avatar-initials">{{ initials }}</span>
            </div>
            <Transition name="fade-slide">
                <div v-if="isSidebarOpen" class="profile-info" @click="toggleProfileMenu">
                    <span class="profile-name">{{ authStore.user?.name?.split(' ')[0] }}</span>
                    <span class="profile-plan">{{ authStore.subscriptionType }}</span>
                </div>
            </Transition>
            <Transition name="menu-pop">
                <div v-if="isProfileMenuOpen" class="profile-menu">
                    <button class="menu-item" @click="navigateTo('/app/settings')">
                        <Cog6ToothIcon class="w-4 h-4" />
                        {{ $t('dashboard.settings') }}
                    </button>
                    <div class="menu-divider"></div>
                    <button class="menu-item menu-item-danger" @click="handleSignOut">
                        <ArrowRightOnRectangleIcon class="w-4 h-4" />
                        {{ $t('auth.signOut') }}
                    </button>
                </div>
            </Transition>
        </div>
    </div>

    <!-- Mobile drawer -->
    <Transition name="drawer">
        <div v-if="!isLargeScreen && isMobileMenuOpen" class="mobile-overlay" @click="$emit('close')">
            <div class="mobile-drawer" @click.stop>
                <div class="mobile-header">
                    <LogoComponent class="mobile-logo" />
                    <button class="mobile-close" @click="$emit('close')">
                        <XMarkIcon class="w-5 h-5" />
                    </button>
                </div>
                <button class="new-file-btn mt-4 mx-4" @click="() => { navigateTo('/app/dashboard'); $emit('close') }">
                    <PlusIcon class="w-4 h-4" />
                    <span>{{ $t('dashboard.newProject') }}</span>
                </button>
                <nav class="sidebar-nav mt-2">
                    <button class="nav-item" @click="() => { navigateTo('/app/dashboard'); $emit('close') }">
                        <Squares2X2Icon class="nav-icon" />
                        <span class="nav-label">{{ $t('nav.dashboard') }}</span>
                    </button>
                    <button class="nav-item" @click="() => { navigateTo('/app/history'); $emit('close') }">
                        <ArchiveBoxIcon class="nav-icon" />
                        <span class="nav-label">{{ $t('nav.history') }}</span>
                    </button>
                </nav>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFilesStore } from '@/stores/files'
import { onClickOutside } from '@vueuse/core'
import { changeLocale } from '@/utils/i18n'
import LogoComponent from '@/components/Logo.vue'
import {
    PlusIcon, ArchiveBoxIcon, DocumentTextIcon,
    ArrowRightOnRectangleIcon, XMarkIcon,
    ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
    Squares2X2Icon, SunIcon, MoonIcon, Cog6ToothIcon,
} from '@heroicons/vue/24/outline'

const props = defineProps({
    isSidebarOpen: Boolean,
    isMobileMenuOpen: Boolean,
})
defineEmits(['toggle', 'close'])

const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const filesStore = useFilesStore()

const isProfileMenuOpen = ref(false)
const isLangMenuOpen = ref(false)
const selectedLanguage = ref(locale.value || 'ru')
const shellRef = ref(null)
const profileRef = ref(null)
const langRef = ref(null)
const isLargeScreen = ref(window.innerWidth >= 1024)

// ── Theme ──────────────────────────────────────────────────────────────────
const THEME_KEY = 'atabai-theme'
const currentTheme = ref(localStorage.getItem(THEME_KEY) || 'light')

function applyTheme(theme) {
    currentTheme.value = theme
    localStorage.setItem(THEME_KEY, theme)
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    // Set vars directly as inline styles — bulletproof, overrides any scoped CSS
    const root = document.documentElement
    const vars = theme === 'dark' ? {
        '--ws-bg': '#0F0D18',
        '--ws-surface': '#171523',
        '--ws-surface-2': '#1D1A2A',
        '--ws-border': 'rgba(149, 0, 255, 0.12)',
        '--ws-border-2': 'rgba(149, 0, 255, 0.06)',
        '--ws-text': '#F0ECF6',
        '--ws-text-2': 'rgba(240, 236, 246, 0.55)',
        '--ws-text-3': 'rgba(240, 236, 246, 0.3)',
        '--ws-purple': '#7C3AED',
        '--ws-purple-lt': 'rgba(124, 58, 237, 0.15)',
        '--sb-bg': '#0C0A14',
        '--sb-border': 'rgba(149, 0, 255, 0.1)',
        '--sb-item-hover': 'rgba(149, 0, 255, 0.1)',
        '--sb-item-active-bg': 'rgba(124, 58, 237, 0.18)',
        '--sb-text': 'rgba(240, 236, 246, 0.45)',
        '--sb-text-hover': 'rgba(240, 236, 246, 0.85)',
        '--sb-text-active': '#C084FC',
        '--sb-divider': 'rgba(240, 236, 246, 0.2)',
        '--sb-icon-muted': 'rgba(240, 236, 246, 0.3)',
        '--sb-icon-hover': '#F0ECF6',
        '--sb-menu-bg': '#1A1528',
        '--sb-menu-border': 'rgba(149, 0, 255, 0.15)',
        '--sb-menu-text': 'rgba(240, 236, 246, 0.65)',
        '--sb-profile-border': 'rgba(149, 0, 255, 0.08)',
        '--sb-recent-name': 'rgba(240, 236, 246, 0.65)',
        '--sb-recent-meta': 'rgba(240, 236, 246, 0.25)',
        '--sb-recent-empty': 'rgba(240, 236, 246, 0.25)',
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
    } : {
        '--ws-bg': '#F4F2F9',
        '--ws-surface': '#FFFFFF',
        '--ws-surface-2': '#EDE9F7',
        '--ws-border': 'rgba(124, 58, 237, 0.14)',
        '--ws-border-2': 'rgba(124, 58, 237, 0.07)',
        '--ws-text': '#111018',
        '--ws-text-2': 'rgba(17, 16, 24, 0.62)',
        '--ws-text-3': 'rgba(17, 16, 24, 0.38)',
        '--ws-purple': '#7C3AED',
        '--ws-purple-lt': 'rgba(124, 58, 237, 0.1)',
        '--sb-bg': '#FAF9FF',
        '--sb-border': 'rgba(124, 58, 237, 0.1)',
        '--sb-item-hover': 'rgba(124, 58, 237, 0.07)',
        '--sb-item-active-bg': 'rgba(124, 58, 237, 0.1)',
        '--sb-text': 'rgba(17, 16, 24, 0.5)',
        '--sb-text-hover': 'rgba(17, 16, 24, 0.85)',
        '--sb-text-active': '#7C3AED',
        '--sb-divider': 'rgba(17, 16, 24, 0.1)',
        '--sb-icon-muted': 'rgba(17, 16, 24, 0.3)',
        '--sb-icon-hover': '#111018',
        '--sb-menu-bg': '#FFFFFF',
        '--sb-menu-border': 'rgba(124, 58, 237, 0.15)',
        '--sb-menu-text': 'rgba(17, 16, 24, 0.65)',
        '--sb-profile-border': 'rgba(17, 16, 24, 0.08)',
        '--sb-recent-name': 'rgba(17, 16, 24, 0.6)',
        '--sb-recent-meta': 'rgba(17, 16, 24, 0.3)',
        '--sb-recent-empty': 'rgba(17, 16, 24, 0.25)',
        '--sb-mobile-bg': '#FAF9FF',
        '--auth-bg': '#F4F2F9',
        '--auth-card-bg': '#FFFFFF',
        '--auth-card-border': '#E5E7EB',
        '--auth-card-shadow': '0 4px 24px rgba(0,0,0,0.06)',
        '--auth-title': '#111827',
        '--auth-sub': '#9CA3AF',
        '--misc-bg': '#F4F2F9',
        '--misc-text': '#111018',
        '--misc-text-2': 'rgba(17, 16, 24, 0.55)',
        '--misc-text-3': 'rgba(17, 16, 24, 0.35)',
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
    }
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}
function setTheme(theme) { applyTheme(theme) }
function toggleTheme() { applyTheme(currentTheme.value === 'light' ? 'dark' : 'light') }

// ── Outside click — profile menu ───────────────────────────────────────────
onClickOutside(profileRef, () => { isProfileMenuOpen.value = false })
onClickOutside(langRef, () => { isLangMenuOpen.value = false })

const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'uz', name: "O'zbek", flag: '🇺🇿' },
]

const currentLang = computed(() => languages.find(l => l.code === selectedLanguage.value) || languages[1])
const recentFiles = computed(() => filesStore.recentFiles || [])
const initials = computed(() => {
    const name = authStore.user?.name || ''
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'
})

function navigateTo(path) { router.push(path) }

function openFile(file) {
    if (file.status === 'completed') router.push(`/app/files/${file.id}`)
    else if (file.jobId) router.push(`/app/processing/${file.jobId}`)
}

function truncate(str, len) {
    if (!str) return ''
    return str.length > len ? str.slice(0, len) + '…' : str
}

function formatDate(d) {
    const date = new Date(d)
    const now = new Date()
    const diffM = Math.floor((now - date) / 60000)
    if (diffM < 1) return t('history.dateJustNow')
    if (diffM < 60) return t('history.dateMinutesAgo', { n: diffM })
    if (diffM < 1440) return t('history.dateHoursAgo', { n: Math.floor(diffM / 60) })
    return date.toLocaleDateString()
}

function statusDotClass(status) {
    return { completed: 'dot-green', processing: 'dot-blue', failed: 'dot-red', pending: 'dot-yellow' }[status] || 'dot-gray'
}

function toggleProfileMenu() { isProfileMenuOpen.value = !isProfileMenuOpen.value }
function toggleLangMenu() { isLangMenuOpen.value = !isLangMenuOpen.value }

function selectLanguage(code) {
    changeLocale(code)
    selectedLanguage.value = code
    isLangMenuOpen.value = false
    isProfileMenuOpen.value = false
}

async function handleSignOut() {
    try { await authStore.logout(); router.push('/') } catch (e) { console.error(e) }
}

function onResize() { isLargeScreen.value = window.innerWidth >= 1024 }

onMounted(async () => {
    window.addEventListener('resize', onResize)
    if (filesStore.recentFiles.length === 0) {
        await filesStore.fetchRecentFiles().catch(() => { })
    }
})
onUnmounted(() => window.removeEventListener('resize', onResize))
</script>

<style scoped>
.sidebar-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 232px;
    background: var(--sb-bg);
    border-right: 1px solid var(--sb-border);
    transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s, border-color 0.2s;
    position: relative;
}

.sidebar-shell.collapsed {
    width: 60px;
}

.sidebar-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 14px 16px;
    flex-shrink: 0;
}

.sidebar-brand-collapsed {
    justify-content: center;
    padding: 20px 0 16px;
}

.brand-link {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex: 1;
    min-width: 0;
}

.brand-logo-full {
    height: 32px;
    width: auto;
}

.collapse-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--sb-icon-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
}

.collapse-btn:hover {
    color: var(--sb-icon-hover);
    background: var(--sb-item-hover);
}

.sidebar-new {
    padding: 0 12px 12px;
    flex-shrink: 0;
}

.new-file-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 14px;
    background: var(--ws-purple);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
    white-space: nowrap;
    overflow: hidden;
}

.new-file-btn:hover {
    background: #6D28D9;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.35);
}

.new-file-btn.icon-only {
    padding: 9px;
    justify-content: center;
}

.sidebar-nav {
    padding: 0 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-shrink: 0;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sb-text);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
    overflow: hidden;
    text-align: left;
}

.nav-item:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

.nav-item.active {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
}

.nav-item.icon-only {
    justify-content: center;
    padding: 8px;
}

.nav-icon {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
}

.nav-label {
    white-space: nowrap;
}

.sidebar-divider {
    margin: 16px 14px 8px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--sb-divider);
    flex-shrink: 0;
}

.recent-files {
    padding: 0 12px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
}

.recent-files::-webkit-scrollbar {
    width: 4px;
}

.recent-files::-webkit-scrollbar-track {
    background: transparent;
}

.recent-files::-webkit-scrollbar-thumb {
    background: var(--sb-item-hover);
    border-radius: 2px;
}

.recent-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 8px;
    border-radius: 7px;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
    width: 100%;
}

.recent-item:hover {
    background: var(--sb-item-hover);
}

.recent-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.dot-green {
    background: #22c55e;
}

.dot-blue {
    background: #60a5fa;
}

.dot-red {
    background: #f87171;
}

.dot-yellow {
    background: #fbbf24;
}

.dot-gray {
    background: var(--sb-divider);
}

.recent-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
    min-width: 0;
}

.recent-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--sb-recent-name);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.recent-meta {
    font-size: 10px;
    color: var(--sb-recent-meta);
}

.recent-loading {
    display: flex;
    justify-content: center;
    padding: 16px;
}

.loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--sb-item-hover);
    border-top-color: var(--ws-purple);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.recent-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px 8px;
    color: var(--sb-recent-empty);
    font-size: 11px;
    text-align: center;
}

/* ─── Language picker ───────────────────────────────────────────────────────── */
.lang-section {
    padding: 4px 12px;
    flex-shrink: 0;
    position: relative;
}

.lang-section-collapsed {
    padding: 4px 0;
    display: flex;
    justify-content: center;
}

.lang-trigger {
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
}

.lang-trigger:hover {
    background: var(--sb-item-hover);
}

.lang-flag {
    font-size: 16px;
    line-height: 1;
    flex-shrink: 0;
}

.lang-name {
    flex: 1;
    text-align: left;
}

.lang-chevron {
    color: var(--sb-icon-muted);
    transition: transform 0.2s;
    flex-shrink: 0;
}

.lang-chevron.rotated {
    transform: rotate(180deg);
}

.lang-icon-btn {
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
}

.lang-icon-btn:hover {
    background: var(--sb-item-hover);
}

.lang-flag-lg {
    color: var(--toggle-icon);
    font-size: 18px;
    line-height: 1;
}

.lang-icon-btn:hover .lang-flag-lg {
    color: var(--sb-text-hover);
}

.lang-menu {
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

.sidebar-shell.collapsed .lang-menu {
    position: fixed;
    bottom: 80px;
    left: 72px;
    min-width: 160px;
    right: unset;
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

/* ─── Theme toggle ───────────────────────────────────────────────────────── */
.theme-section {
    padding: 8px 12px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.theme-section-collapsed {
    justify-content: center;
    padding: 8px 0;
}

.theme-pill {
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

.theme-pill-btn {
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
}

.theme-pill-btn.active {
    background: var(--toggle-active-bg);
    color: var(--toggle-icon-active);
}

.theme-pill-btn:not(.active):hover {
    color: var(--sb-text-hover);
    background: var(--sb-item-hover);
}

.theme-icon-btn {
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
}

.theme-icon-btn:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

/* ─── Profile ────────────────────────────────────────────────────────────── */
.sidebar-profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-top: 1px solid var(--sb-profile-border);
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
    transition: background 0.15s;
}

.sidebar-profile:hover {
    background: var(--sb-item-hover);
}

.sidebar-profile.icon-only {
    justify-content: center;
}

.profile-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--ws-purple);
    display: flex;
    align-items: center;
    justify-content: center;
}

.avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.avatar-initials {
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.04em;
}

.profile-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
    min-width: 0;
    flex: 1;
}

.profile-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--sb-recent-name);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.profile-plan {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ws-purple);
    font-weight: 600;
}

.profile-menu {
    position: fixed;
    bottom: 12px;
    left: 72px;
    min-width: 200px;
    background: var(--sb-menu-bg);
    border: 1px solid var(--sb-menu-border);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 200;
}

.sidebar-shell:not(.collapsed) .profile-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 12px;
    right: 12px;
    min-width: unset;
}

.menu-section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--sb-divider);
    padding: 4px 8px 6px;
    font-weight: 600;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
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

.menu-item:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

.menu-item.active {
    color: var(--ws-purple);
}

.menu-divider {
    height: 1px;
    background: var(--sb-border);
    margin: 6px 0;
}

.menu-item-danger:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
}

.mobile-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
}

.mobile-drawer {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 260px;
    background: var(--sb-bg);
    display: flex;
    flex-direction: column;
    padding-bottom: 24px;
    border-right: 1px solid var(--sb-border);
}

.mobile-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 16px 16px;
    border-bottom: 1px solid var(--sb-border);
}

.mobile-logo {
    height: 28px;
    width: auto;
}

.mobile-close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: var(--sb-icon-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    transition: color 0.12s;
}

.mobile-close:hover {
    color: var(--sb-text-hover);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: opacity 0.15s, transform 0.15s;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translateX(-4px);
}

.menu-pop-enter-active,
.menu-pop-leave-active {
    transition: opacity 0.15s, transform 0.15s;
}

.menu-pop-enter-from,
.menu-pop-leave-to {
    opacity: 0;
    transform: translateY(6px);
}

.drawer-enter-active,
.drawer-leave-active {
    transition: opacity 0.2s;
}

.drawer-enter-from,
.drawer-leave-to {
    opacity: 0;
}
</style>