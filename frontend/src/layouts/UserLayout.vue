<!-- frontend/src/layouts/UserLayout.vue
     Thin wrapper around AppLayout — provides user-side specific content
     (New Project CTA, recent files list, admin entry, profile menu) via
     slots. All shared chrome (sidebar shell, mobile drawer, theme/lang
     pickers) is owned by AppLayout. -->
<template>
    <AppLayout :home-link="'/app/dashboard'" :nav-items="navItems"
        :storage-key="'atabai-sidebar-open'">
        <!-- Top of sidebar: org switcher + new project CTA -->
        <template #header-cta="{ collapsed, isMobile, closeDrawer }">
            <div class="user-header-stack">
                <OrgSwitcher :collapsed="collapsed && !isMobile" />
                <button class="user-new-file-btn"
                    :class="{ 'user-new-file-btn--icon-only': collapsed && !isMobile }"
                    @click="goToDashboard(closeDrawer)">
                    <Plus :size="16" class="user-new-file-icon" />
                    <span v-if="!collapsed || isMobile">{{ $t('dashboard.newProject') }}</span>
                </button>
            </div>
        </template>

        <!-- Body: divider + recent files -->
        <template #body="{ isMobile }">
            <div class="user-divider">
                <span>{{ $t('dashboard.recentFiles') }}</span>
            </div>
            <div class="user-recent-files">
                <div v-if="filesStore.isLoading && recentFiles.length === 0" class="user-recent-loading">
                    <div class="user-loading-spinner"></div>
                </div>
                <div v-else-if="recentFiles.length === 0" class="user-recent-empty">
                    <FileText :size="18" class="user-recent-empty-icon" />
                    <span>{{ $t('dashboard.noFilesYetSidebar') }}</span>
                </div>
                <button v-else v-for="file in recentFiles.slice(0, 8)" :key="file.id" class="user-recent-item"
                    @click="openFile(file)">
                    <div class="user-recent-file">
                        <img v-if="file.status === 'completed'" src="/images/icons/excel.svg"
                            class="user-recent-excel-icon" />
                        <div v-else class="user-recent-dot" :class="statusDotClass(file.status)"></div>
                    </div>
                    <div class="user-recent-info">
                        <span class="user-recent-name">{{ truncate(file.originalName, 22) }}</span>
                        <span class="user-recent-meta">{{ formatDate(file.createdAt) }}</span>
                    </div>
                </button>
            </div>
        </template>

        <!-- Footer: admin entry (only if user has admin role) -->
        <template v-if="authStore.isAdmin" #footer="{ collapsed, isMobile, closeDrawer }">
            <button class="user-admin-link" :class="{ 'user-admin-link--icon-only': collapsed && !isMobile }"
                @click="goTo('/admin', closeDrawer)">
                <ShieldCheck :size="16" class="user-admin-icon" />
                <span v-if="!collapsed || isMobile" class="user-admin-label">{{ $t('admin.nav.adminPanel') }}</span>
                <ChevronRight v-if="!collapsed || isMobile" :size="14" class="user-admin-chevron" />
            </button>
        </template>

        <!-- Profile: dropdown menu on desktop, flat row on mobile -->
        <template #profile="{ collapsed, isMobile }">
            <div v-if="!isMobile" class="user-profile" :class="{ 'user-profile--icon-only': collapsed }"
                ref="profileRef">
                <div class="user-profile-avatar" @click="toggleProfileMenu">
                    <img v-if="authStore.user?.picture" :src="authStore.user.picture" alt="avatar"
                        class="user-avatar-img" />
                    <span v-else class="user-avatar-initials">{{ initials }}</span>
                </div>
                <div v-if="!collapsed" class="user-profile-info" @click="toggleProfileMenu">
                    <span class="user-profile-name">{{ authStore.user?.name?.split(' ')[0] }}</span>
                    <span class="user-profile-plan">{{ authStore.subscriptionType }}</span>
                </div>
                <Transition name="app-menu-pop">
                    <div v-if="isProfileMenuOpen" class="user-profile-menu"
                        :class="{ 'user-profile-menu--collapsed': collapsed }">
                        <button class="user-menu-item" @click="goTo('/app/settings')">
                            <Settings :size="14" />
                            {{ $t('dashboard.settings') }}
                        </button>
                        <div class="user-menu-divider"></div>
                        <button class="user-menu-item user-menu-item--danger" @click="handleSignOut">
                            <LogOut :size="14" />
                            {{ $t('auth.signOut') }}
                        </button>
                    </div>
                </Transition>
            </div>

            <!-- Mobile: flat avatar + name + signout button -->
            <div v-else class="user-mobile-profile">
                <div class="user-mobile-profile-info">
                    <div class="user-profile-avatar">
                        <img v-if="authStore.user?.picture" :src="authStore.user.picture" alt="avatar"
                            class="user-avatar-img" />
                        <span v-else class="user-avatar-initials">{{ initials }}</span>
                    </div>
                    <div class="user-mobile-profile-text">
                        <span class="user-profile-name">{{ authStore.user?.name }}</span>
                        <span class="user-profile-plan">{{ authStore.subscriptionType }}</span>
                    </div>
                </div>
                <button class="user-mobile-signout-btn" @click="handleSignOut">
                    <LogOut :size="16" />
                </button>
            </div>
        </template>

        <!-- Main content -->
        <router-view />
    </AppLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import AppLayout from '@/components/layout/AppLayout.vue'
import OrgSwitcher from '@/components/layout/OrgSwitcher.vue'
import { useAuthStore } from '@/stores/auth'
import { useFilesStore } from '@/stores/files'
import { useOrganizationsStore } from '@/stores/organizations'
import {
    LayoutDashboard, Archive, Plus, FileText, ChevronRight,
    ShieldCheck, Settings, LogOut,
    // Ledger-spine nav icons (Task 5 — surfacing new architecture).
    // OSV and Bank entry-points live on Dashboard, not in the sidebar,
    // because they're period-scoped actions rather than top-level views.
    CalendarDays, BookOpen, Grid3x3, Sliders,
} from 'lucide-vue-next'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const filesStore = useFilesStore()
const orgsStore = useOrganizationsStore()

const isProfileMenuOpen = ref(false)
const profileRef = ref(null)

// Named routes — works regardless of locale prefix in URL.
//
// Two-tier nav (Task 5):
//   - Top tier: Dashboard, History, Settings — visible always.
//   - Ledger-spine tier: surfaces the new architecture (periods, chart,
//     ledger matrix, adjustments). Visibility is driven by the SERVER's
//     view of the session — orgsStore.isOrgAdmin and orgsStore.capabilities
//     are populated from GET /api/organizations/session, which validates
//     the X-Active-Org-Id claim against the membership table and returns
//     the authoritative cap set. Local "currentOrgId" alone is not enough
//     — that's a client-side breadcrumb, not an authorization check.
//
// Capability map:
//   - Periods / Chart / Matrix → read-only views of the ledger.
//     `nsbu.base.read` is the floor; admins implicitly have it too.
//   - Adjustments → the IFRS overlay layer. `ifrs.overlay.read` is the
//     floor; admins have it.
//
// We keep one flat array so AppLayout's nav slot renders a single list.
// Order matters: Dashboard → daily work → archives.
const navItems = computed(() => {
    const hasOrg = orgsStore.hasOrgs && !!orgsStore.currentOrgId
    if (!hasOrg) {
        // No org yet: show only top-tier nav. Onboarding redirect handles
        // the empty state at the router level.
        return [
            { name: 'Dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
            { name: 'FileHistory', label: t('nav.history'), icon: Archive },
            { name: 'Settings', label: t('dashboard.settings'), icon: Settings },
        ]
    }
    // Server-blessed capabilities for the active org. Admins receive the
    // full cap set from the backend already, so the .includes() checks
    // below succeed for them without a special branch here.
    const caps = orgsStore.capabilities || []
    const canReadLedger = caps.includes('nsbu.base.read')
    const canReadOverlay = caps.includes('ifrs.overlay.read')
    return [
        { name: 'Dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        ...(canReadLedger
            ? [
                { name: 'Periods', label: t('nav.periods'), icon: CalendarDays },
                { name: 'ChartOfAccounts', label: t('nav.chart'), icon: BookOpen },
                { name: 'LedgerMatrix', label: t('nav.matrix'), icon: Grid3x3 },
            ]
            : []),
        ...(canReadOverlay
            ? [{ name: 'AdjustmentsList', label: t('nav.adjustments'), icon: Sliders }]
            : []),
        { name: 'FileHistory', label: t('nav.history'), icon: Archive },
        { name: 'Settings', label: t('dashboard.settings'), icon: Settings },
    ]
})

const recentFiles = computed(() => filesStore.recentFiles || [])

const initials = computed(() => {
    const name = authStore.user?.name || ''
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'
})

function goToDashboard(closeDrawer) {
    router.push('/app/dashboard')
    if (closeDrawer) closeDrawer()
}

function goTo(path, closeDrawer) {
    router.push(path)
    isProfileMenuOpen.value = false
    if (closeDrawer) closeDrawer()
}

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
    return {
        completed: 'user-dot-green',
        processing: 'user-dot-blue',
        failed: 'user-dot-red',
        pending: 'user-dot-yellow',
    }[status] || 'user-dot-gray'
}

function toggleProfileMenu() { isProfileMenuOpen.value = !isProfileMenuOpen.value }

async function handleSignOut() {
    try { await authStore.logout(); router.push('/') } catch (e) { console.error(e) }
}

onClickOutside(profileRef, () => { isProfileMenuOpen.value = false })

onMounted(async () => {
    if (filesStore.recentFiles.length === 0) {
        await filesStore.fetchRecentFiles().catch(() => { })
    }
})
</script>

<style scoped>
/* ─── Top-of-sidebar stack ─── */
.user-header-stack {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

/* ─── New file CTA ───────────────────────────────────────────────────────── */
.user-new-file-btn {
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
    font-family: inherit;
}

.user-new-file-btn:hover {
    background: #6D28D9;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.35);
}

.user-new-file-btn--icon-only {
    padding: 9px;
    justify-content: center;
}

.user-new-file-icon {
    flex-shrink: 0;
}

/* ─── Body: divider + recent files ───────────────────────────────────────── */
.user-divider {
    margin: 4px 0 8px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--sb-divider);
}

.user-recent-files {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.user-recent-item {
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
    font-family: inherit;
}

.user-recent-item:hover {
    background: var(--sb-item-hover);
}

.user-recent-file {
    width: 20px;
    height: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.user-recent-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
}

.user-recent-excel-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
}

.user-dot-green { background: #22c55e; }
.user-dot-blue { background: #60a5fa; }
.user-dot-red { background: #f87171; }
.user-dot-yellow { background: #fbbf24; }
.user-dot-gray { background: var(--sb-divider); }

.user-recent-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
    min-width: 0;
}

.user-recent-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--sb-recent-name);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.user-recent-meta {
    font-size: 10px;
    color: var(--sb-recent-meta);
}

.user-recent-loading {
    display: flex;
    justify-content: center;
    padding: 16px;
}

.user-loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--sb-item-hover);
    border-top-color: var(--ws-purple);
    border-radius: 50%;
    animation: user-spin 0.8s linear infinite;
}

@keyframes user-spin {
    to { transform: rotate(360deg); }
}

.user-recent-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 20px 8px;
    color: var(--sb-recent-empty);
    font-size: 11px;
    text-align: center;
}

.user-recent-empty-icon {
    opacity: 0.3;
}

/* ─── Admin entry (footer slot) ──────────────────────────────────────────── */
.user-admin-link {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--ws-purple);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
    font-family: inherit;
}

.user-admin-link:hover {
    background: rgba(124, 58, 237, 0.1);
}

.user-admin-link--icon-only {
    justify-content: center;
    padding: 10px;
}

.user-admin-icon {
    flex-shrink: 0;
}

.user-admin-label {
    flex: 1;
    white-space: nowrap;
}

.user-admin-chevron {
    color: var(--ws-purple);
    flex-shrink: 0;
}

/* ─── Profile: desktop ───────────────────────────────────────────────────── */
.user-profile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    cursor: pointer;
    position: relative;
    transition: background 0.15s;
}

.user-profile:hover {
    background: var(--sb-item-hover);
}

.user-profile--icon-only {
    justify-content: center;
}

.user-profile-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--ws-purple);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.user-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.user-avatar-initials {
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.04em;
}

.user-profile-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    overflow: hidden;
    min-width: 0;
    flex: 1;
}

.user-profile-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--sb-recent-name);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.user-profile-plan {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ws-purple);
    font-weight: 600;
}

.user-profile-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 12px;
    right: 12px;
    background: var(--sb-menu-bg);
    border: 1px solid var(--sb-menu-border);
    border-radius: 12px;
    padding: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 200;
}

.user-profile-menu--collapsed {
    position: fixed;
    bottom: 12px;
    left: 72px;
    right: unset;
    min-width: 200px;
}

.user-menu-item {
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
    font-family: inherit;
}

.user-menu-item:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

.user-menu-divider {
    height: 1px;
    background: var(--sb-border);
    margin: 6px 0;
}

.user-menu-item--danger:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
}

/* ─── Profile: mobile ────────────────────────────────────────────────────── */
.user-mobile-profile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
}

.user-mobile-profile-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.user-mobile-profile-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
}

.user-mobile-signout-btn {
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
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
}

.user-mobile-signout-btn:hover {
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
}
</style>
