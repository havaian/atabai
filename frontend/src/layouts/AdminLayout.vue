<template>
    <div class="adm-layout">
        <!-- Mobile top bar — only on <768px -->
        <div class="adm-mobile-header">
            <button class="adm-mobile-menu-btn" @click="openDrawer" :aria-label="$t('nav.openMenu')">
                <Menu :size="20" />
            </button>
            <div class="adm-mobile-brand">
                <span class="adm-mobile-brand-text">{{ $t('admin.layout.brand') }}</span>
                <span class="adm-mobile-brand-tag">{{ $t('admin.layout.brandTag') }}</span>
            </div>
            <div class="adm-mobile-spacer"></div>
        </div>

        <!-- Desktop sidebar -->
        <aside class="adm-sidebar" :class="{ 'adm-sidebar--collapsed': !sidebarOpen }">
            <div class="adm-sidebar-header">
                <router-link to="/admin" class="adm-brand">
                    <span class="adm-brand-text">{{ $t('admin.layout.brand') }}</span>
                    <span class="adm-brand-tag">{{ $t('admin.layout.brandTag') }}</span>
                </router-link>
                <button class="adm-sidebar-toggle" @click="sidebarOpen = !sidebarOpen" :title="sidebarOpen ? $t('admin.common.back') : $t('admin.common.open')">
                    <component :is="sidebarOpen ? PanelLeftClose : PanelLeftOpen" :size="18" />
                </button>
            </div>

            <nav class="adm-nav">
                <router-link
                    v-for="item in navItems"
                    :key="item.path"
                    :to="item.path"
                    class="adm-nav-item"
                    :active-class="item.exact ? '' : 'adm-nav-item--active'"
                    :exact-active-class="item.exact ? 'adm-nav-item--active' : ''"
                >
                    <component :is="item.icon" :size="18" class="adm-nav-icon" />
                    <span class="adm-nav-label" v-show="sidebarOpen">{{ item.label }}</span>
                </router-link>
            </nav>

            <div class="adm-sidebar-footer">
                <div class="adm-user" v-show="sidebarOpen">
                    <div class="adm-user-name">{{ adminStore.adminInfo?.name }}</div>
                    <div class="adm-user-role">{{ roleLabel }}</div>
                </div>
                <!-- Theme toggle — pill style, mirrors user-side Sidebar.vue.
                     When sidebar is expanded: two side-by-side buttons (sun/moon).
                     When collapsed: single icon button that toggles. -->
                <div class="adm-theme-section" :class="{ 'adm-theme-section-collapsed': !sidebarOpen }">
                    <div v-if="sidebarOpen" class="adm-theme-pill">
                        <button class="adm-theme-pill-btn" :class="{ active: !isDark }"
                            @click="themeStore.setTheme('light')"
                            :title="$t('admin.layout.themeLight')">
                            <Sun :size="14" />
                        </button>
                        <button class="adm-theme-pill-btn" :class="{ active: isDark }"
                            @click="themeStore.setTheme('dark')"
                            :title="$t('admin.layout.themeDark')">
                            <Moon :size="14" />
                        </button>
                    </div>
                    <button v-else class="adm-theme-icon-btn" @click="toggleTheme"
                        :title="isDark ? $t('admin.layout.themeToLight') : $t('admin.layout.themeToDark')">
                        <component :is="isDark ? Sun : Moon" :size="16" />
                    </button>
                </div>
                <button
                    v-if="adminStore.hasValidAdminSession"
                    class="adm-back-link"
                    @click="logout2FA"
                    :title="$t('admin.nav.logout2FA')"
                >
                    <LockKeyhole :size="16" />
                    <span v-show="sidebarOpen">{{ $t('admin.nav.logout2FA') }}</span>
                </button>
                <router-link to="/app/dashboard" class="adm-back-link" :title="$t('admin.nav.backToApp')">
                    <ArrowLeft :size="16" />
                    <span v-show="sidebarOpen">{{ $t('admin.nav.backToApp') }}</span>
                </router-link>
            </div>
        </aside>

        <!-- Mobile drawer -->
        <Transition name="adm-drawer">
            <div v-if="mobileDrawerOpen" class="adm-mobile-overlay" @click="closeDrawer">
                <aside
                    class="adm-mobile-drawer"
                    @click.stop
                    @touchstart="onDrawerTouchStart"
                    @touchmove="onDrawerTouchMove"
                    @touchend="onDrawerTouchEnd"
                    :style="drawerTransform"
                >
                    <div class="adm-mobile-drawer-header">
                        <div class="adm-brand">
                            <span class="adm-brand-text">{{ $t('admin.layout.brand') }}</span>
                            <span class="adm-brand-tag">{{ $t('admin.layout.brandTag') }}</span>
                        </div>
                        <button class="adm-sidebar-toggle" @click="closeDrawer" :aria-label="$t('nav.closeMenu')">
                            <X :size="18" />
                        </button>
                    </div>

                    <nav class="adm-nav">
                        <router-link
                            v-for="item in navItems"
                            :key="item.path"
                            :to="item.path"
                            class="adm-nav-item"
                            :active-class="item.exact ? '' : 'adm-nav-item--active'"
                            :exact-active-class="item.exact ? 'adm-nav-item--active' : ''"
                            @click="closeDrawer"
                        >
                            <component :is="item.icon" :size="18" class="adm-nav-icon" />
                            <span class="adm-nav-label">{{ item.label }}</span>
                        </router-link>
                    </nav>

                    <div class="adm-sidebar-footer">
                        <div class="adm-user">
                            <div class="adm-user-name">{{ adminStore.adminInfo?.name }}</div>
                            <div class="adm-user-role">{{ roleLabel }}</div>
                        </div>
                        <!-- Theme toggle: always expanded view in mobile drawer -->
                        <div class="adm-theme-section">
                            <div class="adm-theme-pill">
                                <button class="adm-theme-pill-btn" :class="{ active: !isDark }"
                                    @click="themeStore.setTheme('light')"
                                    :title="$t('admin.layout.themeLight')">
                                    <Sun :size="14" />
                                </button>
                                <button class="adm-theme-pill-btn" :class="{ active: isDark }"
                                    @click="themeStore.setTheme('dark')"
                                    :title="$t('admin.layout.themeDark')">
                                    <Moon :size="14" />
                                </button>
                            </div>
                        </div>
                        <button
                            v-if="adminStore.hasValidAdminSession"
                            class="adm-back-link"
                            @click="logout2FA"
                        >
                            <LockKeyhole :size="16" />
                            <span>{{ $t('admin.nav.logout2FA') }}</span>
                        </button>
                        <router-link to="/app/dashboard" class="adm-back-link" @click="closeDrawer">
                            <ArrowLeft :size="16" />
                            <span>{{ $t('admin.nav.backToApp') }}</span>
                        </router-link>
                    </div>
                </aside>
            </div>
        </Transition>

        <!-- Main content -->
        <main class="adm-main">
            <div class="adm-content">
                <div v-if="!adminStore.accessChecked" class="adm-loading">
                    {{ $t('admin.layout.accessCheck') }}
                </div>
                <div v-else-if="!adminStore.isAdmin" class="adm-forbidden">
                    <h2>{{ $t('admin.layout.forbiddenTitle') }}</h2>
                    <p>{{ $t('admin.layout.forbiddenText') }}</p>
                    <router-link to="/app/dashboard" class="adm-btn">{{ $t('admin.layout.backToAppBtn') }}</router-link>
                </div>
                <AdminTwoFactorGate
                    v-else-if="!adminStore.hasValidAdminSession"
                    @verified="on2FAVerified"
                />
                <router-view v-else />
            </div>
        </main>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import AdminTwoFactorGate from '@/views/admin/AdminTwoFactorGate.vue'
import {
    LayoutDashboard,
    Users,
    FileText,
    Network,
    ShieldCheck,
    Languages,
    UserCheck,
    ArrowLeft,
    PanelLeftClose,
    PanelLeftOpen,
    LockKeyhole,
    Menu,
    X,
    Sun,
    Moon
} from 'lucide-vue-next'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()
const { t } = useI18n()

// Theme — admin reuses the user-side theme store (single source of truth).
// Toggling on either side updates both because data-theme is on <html>.
const themeStore = useThemeStore()
const isDark = computed(() => themeStore.resolvedTheme === 'dark')
function toggleTheme() { themeStore.toggle() }

// Desktop sidebar collapse state
const sidebarOpen = ref(true)

// Mobile drawer state (separate from sidebarOpen — see UserLayout.vue for rationale)
const mobileDrawerOpen = ref(false)

const navItems = computed(() => [
    { path: '/admin', label: t('admin.nav.dashboard'), icon: LayoutDashboard, exact: true },
    { path: '/admin/users', label: t('admin.nav.users'), icon: Users },
    { path: '/admin/files', label: t('admin.nav.files'), icon: FileText },
    { path: '/admin/mappings', label: t('admin.nav.mappings'), icon: Network },
    { path: '/admin/locales', label: t('admin.nav.locales'), icon: Languages },
    { path: '/admin/access', label: t('admin.nav.access'), icon: UserCheck },
    { path: '/admin/security', label: t('admin.nav.security'), icon: ShieldCheck }
])

const roleLabel = computed(() => {
    const role = adminStore.adminInfo?.role
    if (role === 'super_admin') return t('admin.roles.superAdmin')
    if (role === 'admin') return t('admin.roles.admin')
    return ''
})

async function logout2FA() {
    if (!confirm(t('admin.layout.resetSessionPrompt'))) return
    await adminStore.adminLogout2FA()
}

function on2FAVerified() {
    // After successful verify, hasValidAdminSession becomes true and router-view renders.
}

const openDrawer = () => { mobileDrawerOpen.value = true }
const closeDrawer = () => { mobileDrawerOpen.value = false }

// Auto-close drawer on route change (so navigation feels natural)
watch(() => route.fullPath, () => { mobileDrawerOpen.value = false })

// Lock body scroll while drawer is open
watch(mobileDrawerOpen, (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
})

// ── Swipe-to-close drawer (mirror UserLayout/Sidebar pattern) ──
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

// Close drawer if window resizes to desktop
const handleResize = () => {
    if (window.innerWidth >= 768) mobileDrawerOpen.value = false
}

onMounted(async () => {
    const saved = localStorage.getItem('atabai-admin-sidebar-open')
    if (saved !== null) sidebarOpen.value = JSON.parse(saved)
    window.addEventListener('resize', handleResize)
    await adminStore.checkAdminAccess()
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    document.body.style.overflow = ''
})

// Persist desktop sidebar state
watch(sidebarOpen, (v) => {
    localStorage.setItem('atabai-admin-sidebar-open', JSON.stringify(v))
})
</script>

<style scoped>
.adm-layout {
    display: flex;
    height: 100vh;
    /* Dynamic viewport height — handles iOS Safari address bar gracefully */
    height: 100dvh;
    background: var(--ws-bg, #0f0a1a);
    color: var(--ws-text, #f0ecf6);
    overflow: hidden;
}

/* ─── Mobile top bar ─────────────────────────────────────────────────────── */
.adm-mobile-header {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--ws-bg-elevated, rgba(20, 14, 32, 0.95));
    border-bottom: 1px solid var(--adm-border);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 40;
}

.adm-mobile-menu-btn {
    background: transparent;
    border: none;
    color: var(--adm-text);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
}

.adm-mobile-menu-btn:hover {
    background: var(--adm-nav-bg-hover);
}

.adm-mobile-brand {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
}

.adm-mobile-brand-text {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.05em;
    color: var(--ws-text, #f0ecf6);
}

.adm-mobile-brand-tag {
    font-size: 9px;
    color: #9333ea;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.1em;
}

.adm-mobile-spacer {
    width: 32px;
}

/* ─── Mobile drawer ──────────────────────────────────────────────────────── */
.adm-mobile-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 50;
}

.adm-mobile-drawer {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 260px;
    background: var(--ws-bg-elevated, rgba(20, 14, 32, 0.98));
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--adm-border);
}

.adm-mobile-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
    border-bottom: 1px solid var(--adm-border-soft);
}

.adm-drawer-enter-active,
.adm-drawer-leave-active {
    transition: opacity 0.18s ease;
}

.adm-drawer-enter-from,
.adm-drawer-leave-to {
    opacity: 0;
}

/* ─── Desktop sidebar ────────────────────────────────────────────────────── */
.adm-sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--ws-bg-elevated, rgba(20, 14, 32, 0.95));
    border-right: 1px solid var(--adm-border);
    transition: width 0.18s ease;
}

.adm-sidebar--collapsed {
    width: 60px;
}

.adm-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 14px;
    border-bottom: 1px solid var(--adm-border-soft);
    min-height: 56px;
}

.adm-brand {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    line-height: 1.1;
    overflow: hidden;
    white-space: nowrap;
}

.adm-brand-text {
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.05em;
    color: var(--ws-text, #f0ecf6);
}

.adm-brand-tag {
    font-size: 10px;
    color: #9333ea;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.1em;
}

.adm-sidebar--collapsed .adm-brand-text,
.adm-sidebar--collapsed .adm-brand-tag {
    display: none;
}

.adm-sidebar-toggle {
    background: transparent;
    border: none;
    color: var(--adm-text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
}

.adm-sidebar-toggle:hover {
    background: var(--adm-nav-bg-hover);
    color: var(--adm-text);
}

/* ─── Nav ─────────────────────────────────────────────────────────────────── */
.adm-nav {
    flex: 1;
    padding: 12px 8px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.adm-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    text-decoration: none;
    color: var(--adm-nav-text);
    font-size: 14px;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
}

.adm-nav-item:hover {
    background: var(--adm-nav-bg-hover);
    color: var(--ws-text, #f0ecf6);
}

.adm-nav-item--active {
    background: var(--adm-nav-bg-active);
    color: var(--adm-nav-text-active);
}

.adm-nav-icon {
    flex-shrink: 0;
}

/* ─── Sidebar footer ──────────────────────────────────────────────────────── */
.adm-sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--adm-border-soft);
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.adm-user {
    padding: 4px 8px;
}

.adm-user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--adm-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.adm-user-role {
    font-size: 11px;
    color: #9333ea;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.adm-back-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    text-decoration: none;
    color: var(--adm-text-muted);
    font-size: 13px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
}

.adm-back-link:hover {
    background: var(--adm-nav-bg-hover);
    color: var(--ws-text, #f0ecf6);
}

/* ─── Theme toggle (pill style — mirrors user-side Sidebar.vue) ─────────── */
.adm-theme-section {
    padding: 6px 4px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.adm-theme-section-collapsed {
    justify-content: center;
    padding: 6px 0;
}

.adm-theme-pill {
    width: 100%;
    display: grid;
    grid-template-columns: 50% 50%;
    align-items: center;
    background: var(--toggle-bg);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
}

.adm-theme-pill-btn {
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

.adm-theme-pill-btn.active {
    background: var(--toggle-active-bg);
    color: var(--toggle-icon-active);
}

.adm-theme-pill-btn:not(.active):hover {
    color: var(--ws-text, #f0ecf6);
    background: var(--adm-nav-bg-hover);
}

.adm-theme-icon-btn {
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

.adm-theme-icon-btn:hover {
    background: var(--adm-nav-bg-hover);
    color: var(--ws-text, #f0ecf6);
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
.adm-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

.adm-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
}

.adm-content::-webkit-scrollbar {
    width: 6px;
}

.adm-content::-webkit-scrollbar-thumb {
    background: rgba(149, 0, 255, 0.25);
    border-radius: 3px;
}

/* ─── States ──────────────────────────────────────────────────────────────── */
.adm-loading,
.adm-forbidden {
    padding: 40px;
    text-align: center;
    color: var(--adm-text-muted);
}

.adm-forbidden h2 {
    font-size: 20px;
    margin-bottom: 8px;
    color: var(--ws-text, #f0ecf6);
}

.adm-btn {
    display: inline-block;
    margin-top: 16px;
    padding: 8px 16px;
    background: #9333ea;
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
}

.adm-btn:hover {
    background: #a855f7;
}

/* ─── Mobile breakpoint switching ─────────────────────────────────────────── */
@media (max-width: 767px) {
    .adm-mobile-header {
        display: flex;
    }
    .adm-mobile-overlay {
        display: block;
    }
    .adm-sidebar {
        display: none; /* desktop sidebar hidden on mobile */
    }
    .adm-content {
        padding-top: 56px; /* compensate for fixed mobile header */
    }
}
</style>
