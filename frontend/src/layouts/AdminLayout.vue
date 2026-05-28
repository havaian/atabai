<!-- frontend/src/layouts/AdminLayout.vue
     Thin wrapper around AppLayout — provides admin-side specific content
     (user info block in body, 2FA logout + back-to-app buttons in footer,
     access guards on main content) via slots. All shared chrome (sidebar
     shell, mobile drawer, theme/lang pickers) is owned by AppLayout. -->
<template>
    <AppLayout :home-link="'/admin'" :brand-tag="$t('admin.layout.brandTag')"
        :nav-items="navItems" :storage-key="'atabai-admin-sidebar-open'">
        <!-- Bottom extras: Legacy ⇄ New mode switch, pinned to the bottom of
             the sidebar (just above the profile block). Pure UI preference
             persisted in localStorage (default Legacy). Swaps the sidebar
             nav between the existing admin tools and the new ledger-spine
             section. Both modes sit behind the same admin guard — view
             preference, not an authorization boundary. -->
        <template #bottom-extras="{ collapsed, isMobile, closeDrawer }">
            <div class="admin-mode" :class="{ 'admin-mode--collapsed': collapsed && !isMobile }">
                <button
                    class="admin-mode-btn"
                    :class="{ 'admin-mode-btn--active': mode === 'legacy' }"
                    :title="$t('admin.mode.legacy')"
                    @click="setMode('legacy', closeDrawer)"
                >
                    <Boxes :size="15" />
                    <span v-if="!collapsed || isMobile">{{ $t('admin.mode.legacy') }}</span>
                </button>
                <button
                    class="admin-mode-btn"
                    :class="{ 'admin-mode-btn--active': mode === 'ledger' }"
                    :title="$t('admin.mode.ledger')"
                    @click="setMode('ledger', closeDrawer)"
                >
                    <Layers :size="15" />
                    <span v-if="!collapsed || isMobile">{{ $t('admin.mode.ledger') }}</span>
                </button>
            </div>
        </template>

        <!-- Profile: admin user info, pinned to the bottom of the sidebar
             exactly like the user-side profile block. -->
        <template #profile="{ collapsed }">
            <div class="admin-user-info" :class="{ 'admin-user-info--collapsed': collapsed }">
                <div class="admin-user-avatar">{{ adminInitials }}</div>
                <div v-if="!collapsed" class="admin-user-meta">
                    <div class="admin-user-name">{{ adminStore.adminInfo?.name }}</div>
                    <div class="admin-user-role">{{ roleLabel }}</div>
                </div>
            </div>
        </template>

        <!-- Top-right corner: back-to-app exit (mirrors the user-side
             "Admin panel" entry which sits in the same spot). -->
        <template #corner>
            <button class="admin-corner-btn" @click="goToApp()" :title="$t('admin.nav.backToApp')">
                <ArrowLeft :size="15" class="admin-corner-icon" />
                <span class="admin-corner-label">{{ $t('admin.nav.backToApp') }}</span>
            </button>
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

function goToApp(closeDrawer) {
    router.push('/app/dashboard')
    if (closeDrawer) closeDrawer()
}

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
}

.admin-user-meta {
    min-width: 0;
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

/* ─── Top-right corner: back-to-app exit ─────────────────────────────────────
   Visually identical to the user-side .user-corner-btn so the entry/exit
   pair reads as one consistent control sitting in the same spot. */
.admin-corner-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    border-radius: 8px;
    background: var(--adm-surface);
    border: 1px solid var(--adm-border);
    color: var(--ws-purple);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    font-family: inherit;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.admin-corner-btn:hover {
    background: var(--ws-purple);
    border-color: var(--ws-purple);
    color: #fff;
}

.admin-corner-icon {
    flex-shrink: 0;
}

.admin-corner-label {
    white-space: nowrap;
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
