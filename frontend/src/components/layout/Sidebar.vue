<template>
    <!-- Desktop sidebar -->
    <div v-if="isLargeScreen" class="sidebar-shell" :class="{ collapsed: !isSidebarOpen }">

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
                <SquaresFourIcon class="nav-icon" />
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
                <span>{{ $t('dashboard.noFilesYet') }}</span>
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

        <!-- User profile -->
        <div class="sidebar-profile" :class="{ 'icon-only': !isSidebarOpen }">
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

            <!-- Profile menu -->
            <Transition name="menu-pop">
                <div v-if="isProfileMenuOpen" class="profile-menu">
                    <!-- Language -->
                    <div class="menu-section-label">{{ $t('nav.language') }}</div>
                    <button v-for="lang in languages" :key="lang.code" class="menu-item"
                        :class="{ active: selectedLanguage === lang.code }" @click="selectLanguage(lang.code)">
                        <span>{{ lang.flag }}</span>
                        <span>{{ lang.name }}</span>
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

    <!-- Mobile drawer (unchanged from previous) -->
    <Transition name="drawer">
        <div v-if="!isLargeScreen && isMobileMenuOpen" class="mobile-overlay" @click="$emit('close')">
            <div class="mobile-drawer" @click.stop>
                <div class="mobile-header">
                    <LogoComponent class="h-7 w-7" />

                    <button class="mobile-close" @click="$emit('close')">
                        <XMarkIcon class="w-5 h-5" />
                    </button>
                </div>
                <button class="new-file-btn mt-4 mx-4" @click="() => { navigateTo('/app/upload'); $emit('close') }">
                    <PlusIcon class="w-4 h-4" />
                    <span>{{ $t('dashboard.newProject') }}</span>
                </button>
                <nav class="sidebar-nav mt-2">
                    <button class="nav-item" @click="() => { navigateTo('/app/dashboard'); $emit('close') }">
                        <SquaresFourIcon class="nav-icon" />
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
import { changeLocale } from '@/utils/i18n'
import LogoComponent from '@/components/Logo.vue'
import {
    PlusIcon, ArchiveBoxIcon, DocumentTextIcon,
    ArrowRightOnRectangleIcon, XMarkIcon,
    ChevronLeftIcon, ChevronRightIcon,
    Squares2X2Icon as SquaresFourIcon
} from '@heroicons/vue/24/outline'

const props = defineProps({
    isSidebarOpen: Boolean,
    isMobileMenuOpen: Boolean,
})
defineEmits(['toggle', 'close'])

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()
const filesStore = useFilesStore()

const isLargeScreen = ref(window.innerWidth >= 1024)
const isProfileMenuOpen = ref(false)
const selectedLanguage = ref('ru')

const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'uz', name: "O'zbek", flag: '🇺🇿' },
]

const recentFiles = computed(() => filesStore.recentFiles || [])
const initials = computed(() => {
    const name = authStore.user?.name || ''
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'
})

function navigateTo(path) { router.push(path) }

function openFile(file) {
    if (file.status === 'completed') {
        router.push(`/app/files/${file.id}`)
    } else if (file.jobId) {
        router.push(`/app/processing/${file.jobId}`)
    }
}

function truncate(str, len) {
    if (!str) return ''
    return str.length > len ? str.slice(0, len) + '…' : str
}

function formatDate(d) {
    const date = new Date(d)
    const now = new Date()
    const diffM = Math.floor((now - date) / 60000)
    if (diffM < 1) return 'just now'
    if (diffM < 60) return `${diffM}m ago`
    if (diffM < 1440) return `${Math.floor(diffM / 60)}h ago`
    return date.toLocaleDateString()
}

function statusDotClass(status) {
    return {
        'completed': 'dot-green',
        'processing': 'dot-blue',
        'failed': 'dot-red',
        'pending': 'dot-yellow',
    }[status] || 'dot-gray'
}

function toggleProfileMenu() { isProfileMenuOpen.value = !isProfileMenuOpen.value }

function selectLanguage(code) {
    changeLocale(code)
    selectedLanguage.value = code
    isProfileMenuOpen.value = false
}

async function handleSignOut() {
    try {
        await authStore.logout()
        router.push('/')
    } catch (e) { console.error(e) }
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
/* ─── Shell ──────────────────────────────────────────────────────────────── */
.sidebar-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 232px;
    background: #0C0A14;
    border-right: 1px solid rgba(149, 0, 255, 0.1);
    transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
    position: relative;
}

.sidebar-shell.collapsed {
    width: 60px;
}

/* ─── Brand ──────────────────────────────────────────────────────────────── */
.sidebar-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 14px 16px;
    flex-shrink: 0;
}

/* Collapsed: center just the arrow button */
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

/* LogoComponent fills the available space — shows icon + wordmark naturally */
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
    color: rgba(240, 236, 246, 0.3);
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
}

.collapse-btn:hover {
    color: #F0ECF6;
    background: rgba(149, 0, 255, 0.12);
}

/* ─── New file ───────────────────────────────────────────────────────────── */
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
    background: #7C3AED;
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

/* ─── Nav ────────────────────────────────────────────────────────────────── */
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
    color: rgba(240, 236, 246, 0.45);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    overflow: hidden;
    text-align: left;
}

.nav-item:hover {
    background: rgba(149, 0, 255, 0.1);
    color: rgba(240, 236, 246, 0.85);
}

.nav-item.active {
    background: rgba(124, 58, 237, 0.18);
    color: #C084FC;
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

/* ─── Divider ────────────────────────────────────────────────────────────── */
.sidebar-divider {
    margin: 16px 14px 8px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(240, 236, 246, 0.2);
    flex-shrink: 0;
}

/* ─── Recent files ───────────────────────────────────────────────────────── */
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
    background: rgba(149, 0, 255, 0.2);
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
    background: rgba(149, 0, 255, 0.08);
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
    background: rgba(240, 236, 246, 0.2);
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
    color: rgba(240, 236, 246, 0.65);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.recent-meta {
    font-size: 10px;
    color: rgba(240, 236, 246, 0.25);
}

.recent-loading {
    display: flex;
    justify-content: center;
    padding: 16px;
}

.loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(149, 0, 255, 0.2);
    border-top-color: #7C3AED;
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
    color: rgba(240, 236, 246, 0.25);
    font-size: 11px;
    text-align: center;
}

/* ─── Profile ────────────────────────────────────────────────────────────── */
.sidebar-profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-top: 1px solid rgba(149, 0, 255, 0.08);
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
    transition: background 0.15s;
}

.sidebar-profile:hover {
    background: rgba(149, 0, 255, 0.06);
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
    background: #7C3AED;
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
    color: rgba(240, 236, 246, 0.85);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.profile-plan {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #A78BFA;
    font-weight: 600;
}

/* ─── Profile menu ───────────────────────────────────────────────────────── */
.profile-menu {
    position: fixed;
    bottom: 12px;
    left: 72px;
    /* just outside collapsed sidebar */
    min-width: 200px;
    background: #1A1528;
    border: 1px solid rgba(149, 0, 255, 0.15);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 200;
}

/* When expanded sidebar, anchor to bottom of profile row instead */
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
    color: rgba(240, 236, 246, 0.25);
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
    color: rgba(240, 236, 246, 0.65);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.12s;
    text-align: left;
}

.menu-item:hover {
    background: rgba(149, 0, 255, 0.1);
    color: #F0ECF6;
}

.menu-item.active {
    color: #A78BFA;
}

.menu-divider {
    height: 1px;
    background: rgba(149, 0, 255, 0.1);
    margin: 6px 0;
}

.menu-item-danger:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
}

/* ─── Mobile ─────────────────────────────────────────────────────────────── */
.mobile-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 50;
}

.mobile-drawer {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 260px;
    background: #0C0A14;
    display: flex;
    flex-direction: column;
    padding-bottom: 24px;
}

.mobile-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 20px 16px 16px;
    border-bottom: 1px solid rgba(149, 0, 255, 0.08);
}

.mobile-close {
    margin-left: auto;
    background: transparent;
    border: none;
    color: rgba(240, 236, 246, 0.4);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
}

/* ─── Transitions ────────────────────────────────────────────────────────── */
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