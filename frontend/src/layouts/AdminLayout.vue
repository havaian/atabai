<!-- frontend/src/layouts/AdminLayout.vue
     Thin wrapper around AppLayout — provides admin-side specific content
     (mode switch + admin user dropdown with back-to-app exit in the profile
     slot, access guards on main content) via slots. All shared chrome (sidebar
     shell, mobile drawer, theme/lang pickers) is owned by AppLayout. -->
<template>
    <AppLayout :home-link="'/admin'" :brand-tag="$t('admin.layout.brandTag')" :nav-items="navItems"
        :storage-key="'atabai-admin-sidebar-open'">
        <!-- Bottom extras: Legacy ⇄ New mode switch, pinned to the bottom of
             the sidebar (just above the profile block). Pure UI preference
             persisted in localStorage (default Legacy). Swaps the sidebar
             nav between the existing admin tools and the new ledger-spine
             section. Both modes sit behind the same admin guard — view
             preference, not an authorization boundary. -->
        <template #bottom-extras="{ collapsed, isMobile, closeDrawer }">
            <div class="admin-mode" :class="{ 'admin-mode--collapsed': collapsed && !isMobile }">
                <button class="admin-mode-btn" :class="{ 'admin-mode-btn--active': mode === 'legacy' }"
                    :title="$t('admin.mode.legacy')" @click="setMode('legacy', closeDrawer)">
                    <Boxes :size="15" />
                    <span v-if="!collapsed || isMobile">{{ $t('admin.mode.legacy') }}</span>
                </button>
                <button class="admin-mode-btn" :class="{ 'admin-mode-btn--active': mode === 'ledger' }"
                    :title="$t('admin.mode.ledger')" @click="setMode('ledger', closeDrawer)">
                    <Layers :size="15" />
                    <span v-if="!collapsed || isMobile">{{ $t('admin.mode.ledger') }}</span>
                </button>
            </div>
        </template>

        <!-- Profile: dropdown menu on desktop, flat row on mobile —
             mirrors the user-side profile block. -->
        <template #profile="{ collapsed, isMobile, closeDrawer }">
            <div v-if="!isMobile" class="admin-user-info" :class="{ 'admin-user-info--collapsed': collapsed }"
                ref="profileRef">
                <div class="admin-user-avatar" @click="toggleProfileMenu">{{ adminInitials }}</div>
                <div v-if="!collapsed" class="admin-user-meta" @click="toggleProfileMenu">
                    <div class="admin-user-name">{{ adminStore.adminInfo?.name }}</div>
                    <div class="admin-user-role">{{ roleLabel }}</div>
                </div>
                <Transition name="app-menu-pop">
                    <div v-if="isProfileMenuOpen" class="admin-profile-menu"
                        :class="{ 'admin-profile-menu--collapsed': collapsed }">
                        <button class="admin-menu-item" @click="goToApp()">
                            <ArrowLeft :size="14" />
                            {{ $t('admin.nav.backToApp') }}
                        </button>
                    </div>
                </Transition>
            </div>

            <!-- Mobile: flat avatar + name/role + back-to-app button -->
            <div v-else class="admin-mobile-profile">
                <div class="admin-mobile-profile-info">
                    <div class="admin-user-avatar">{{ adminInitials }}</div>
                    <div class="admin-mobile-profile-text">
                        <div class="admin-user-name">{{ adminStore.adminInfo?.name }}</div>
                        <div class="admin-user-role">{{ roleLabel }}</div>
                    </div>
                </div>
                <button class="admin-mobile-exit-btn" @click="goToApp(closeDrawer)" :title="$t('admin.nav.backToApp')">
                    <ArrowLeft :size="16" />
                </button>
            </div>
        </template>

        <!-- Main content: access guards then router-view -->
        <div v-if="!adminStore.accessChecked" class="admin-loading">
            {{ $t('admin.layout.accessCheck') }}
        </div>
        <div v-else-if="!adminStore.isAdmin" class="admin-forbidden">
            <h2>{{ $t('admin.layout.forbiddenTitle') }}</h2>
            <p>{{ $t('admin.layout.forbiddenText') }}</p>
            <router-link to="/app/dashboard" class="admin-btn">{{ $t('admin.layout.backToAppBtn') }}</router-link>
        </div>
        <AdminTwoFactorGate v-else-if="!adminStore.hasValidAdminSession" @verified="on2FAVerified" />
        <router-view v-else />
    </AppLayout>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onClickOutside } from '@vueuse/core'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAdminStore } from '@/stores/admin'
import AdminTwoFactorGate from '@/views/admin/AdminTwoFactorGate.vue'
import {
    LayoutDashboard, Users, FileText, Network, ShieldCheck, Languages,
    UserCheck, ArrowLeft,
    // Mode toggle + new-mode nav icons.
    Boxes, Layers,
} from 'lucide-vue-next'

const router = useRouter()
const adminStore = useAdminStore()
const { t } = useI18n()

// ─── Admin mode (Legacy ⇄ New) ────────────────────────────────────────────
// Pure client-side view preference. Default 'legacy' because the legacy
// tools are fully functional; the ledger-spine ('ledger') mode is the new
// section. Persisted so the choice survives reloads. Not security-relevant
// — both modes are behind the admin guard either way.
const ADMIN_MODE_KEY = 'atabai-admin-mode'
const mode = ref(readMode())

function readMode() {
    try {
        const v = localStorage.getItem(ADMIN_MODE_KEY)
        return v === 'ledger' ? 'ledger' : 'legacy'
    } catch (_) {
        return 'legacy'
    }
}

function setMode(next, closeDrawer) {
    if (mode.value === next) {
        // Already in this mode — just navigate to its home so the toggle
        // still feels responsive when re-tapped.
        router.push(next === 'ledger' ? '/admin/ledger' : '/admin')
        if (closeDrawer) closeDrawer()
        return
    }
    mode.value = next
    try {
        localStorage.setItem(ADMIN_MODE_KEY, next)
    } catch (_) {
        // localStorage unavailable — mode still applies for this session.
    }
    // Land on the mode's home page so the user isn't left on a route that
    // belongs to the other mode's nav.
    router.push(next === 'ledger' ? '/admin/ledger' : '/admin')
    if (closeDrawer) closeDrawer()
}

// Legacy nav — the existing admin tools, unchanged.
const legacyNav = computed(() => [
    { name: 'AdminDashboard', label: t('admin.nav.dashboard'), icon: LayoutDashboard, exact: true },
    { name: 'AdminUsers', label: t('admin.nav.users'), icon: Users },
    { name: 'AdminFiles', label: t('admin.nav.files'), icon: FileText },
    { name: 'AdminMappings', label: t('admin.nav.mappings'), icon: Network },
    { name: 'AdminLocales', label: t('admin.nav.locales'), icon: Languages },
    { name: 'AdminAccess', label: t('admin.nav.access'), icon: UserCheck },
    { name: 'AdminSecuritySettings', label: t('admin.nav.security'), icon: ShieldCheck },
])

// New (ledger-spine) nav — currently the overview landing only. Grows as
// concrete new-admin features are built (org oversight, ownership transfer,
// master chart editing, ingestion debugging — see AdminLedgerOverview).
const ledgerNav = computed(() => [
    { name: 'AdminLedgerOverview', label: t('admin.nav.ledgerOverview'), icon: Layers, exact: true },
])

const navItems = computed(() => (mode.value === 'ledger' ? ledgerNav.value : legacyNav.value))

const roleLabel = computed(() => {
    const role = adminStore.adminInfo?.role
    if (role === 'super_admin') return t('admin.roles.superAdmin')
    if (role === 'admin') return t('admin.roles.admin')
    return ''
})

// Initials for the profile avatar — first letters of up to two name parts.
const adminInitials = computed(() => {
    const name = adminStore.adminInfo?.name || ''
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'A'
    return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('')
})

// ─── Profile dropdown (mirrors the user-side profile menu) ─────────────────
const isProfileMenuOpen = ref(false)
const profileRef = ref(null)

function toggleProfileMenu() { isProfileMenuOpen.value = !isProfileMenuOpen.value }

function goToApp(closeDrawer) {
    router.push('/app/dashboard')
    isProfileMenuOpen.value = false
    if (closeDrawer) closeDrawer()
}

onClickOutside(profileRef, () => { isProfileMenuOpen.value = false })

function on2FAVerified() {
    // After successful verify, hasValidAdminSession becomes true and router-view renders.
}

onMounted(async () => {
    // If the admin deep-linked into a ledger-mode route, reflect that in the
    // toggle so the nav matches the page they're on.
    if (router.currentRoute.value.name === 'AdminLedgerOverview' && mode.value !== 'ledger') {
        mode.value = 'ledger'
    }
    await adminStore.checkAdminAccess()
})
</script>

<style scoped>
/* ─── Admin mode toggle (bottom-extras slot) ─────────────────────────────── */
.admin-mode {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--sb-item-hover);
    border-radius: 9px;
}

.admin-mode--collapsed {
    flex-direction: column;
}

.admin-mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 8px;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: var(--sb-text);
    font-size: 12.5px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
}

.admin-mode-btn:hover {
    color: var(--sb-text-hover);
}

/* Active mode pill — uses the sidebar's menu surface so it reads as
   "lifted" against the recessed track, with violet active text. */
.admin-mode-btn--active {
    background: var(--sb-menu-bg);
    color: var(--sb-text-active);
}

/* ─── Admin user info (profile slot — pinned to sidebar bottom) ──────────────
   Mirrors the user-side profile row: avatar + name/role, with the top border
   coming from the shared .app-sidebar-profile wrapper. */
.admin-user-info {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    position: relative;
    cursor: pointer;
    transition: background 0.15s;
}

.admin-user-info:hover {
    background: var(--sb-item-hover);
}

.admin-user-info--collapsed {
    justify-content: center;
    padding: 12px 8px;
}

.admin-user-avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--ws-purple);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}

.admin-user-meta {
    min-width: 0;
    cursor: pointer;
}

.admin-user-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--adm-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.admin-user-role {
    font-size: 11px;
    color: var(--ws-purple);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 2px;
}

/* ─── Profile dropdown menu (mirrors user-side .user-profile-menu) ─────────── */
.admin-profile-menu {
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

.admin-profile-menu--collapsed {
    position: fixed;
    bottom: 12px;
    left: 72px;
    right: unset;
    min-width: 200px;
}

.admin-menu-item {
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

.admin-menu-item:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

/* ─── Profile: mobile (flat row + exit button) ───────────────────────────── */
.admin-mobile-profile {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px;
}

.admin-mobile-profile-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
}

.admin-mobile-profile-text {
    min-width: 0;
}

.admin-mobile-exit-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid var(--adm-border);
    color: var(--ws-purple);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.admin-mobile-exit-btn:hover {
    background: var(--ws-purple);
    color: #fff;
}

/* ─── Main content states ────────────────────────────────────────────────── */
.admin-loading,
.admin-forbidden {
    padding: 40px;
    text-align: center;
    color: var(--adm-text-muted);
}

.admin-forbidden h2 {
    font-size: 20px;
    margin-bottom: 8px;
    color: var(--ws-text);
}

.admin-btn {
    display: inline-block;
    margin-top: 16px;
    padding: 8px 16px;
    background: var(--ws-purple);
    color: white;
    border-radius: 8px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
}

.admin-btn:hover {
    background: #6D28D9;
}
</style>