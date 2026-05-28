<!-- frontend/src/layouts/AdminLayout.vue
     Thin wrapper around AppLayout — provides admin-side specific content
     (user info block in body, 2FA logout + back-to-app buttons in footer,
     access guards on main content) via slots. All shared chrome (sidebar
     shell, mobile drawer, theme/lang pickers) is owned by AppLayout. -->
<template>
    <AppLayout :home-link="'/admin'" :brand-tag="$t('admin.layout.brandTag')"
        :nav-items="navItems" :storage-key="'atabai-admin-sidebar-open'">
        <!-- Body: admin mode toggle + user info block -->
        <template #body="{ collapsed, isMobile, closeDrawer }">
            <!-- Legacy ⇄ New mode switch. Pure UI preference persisted in
                 localStorage (default Legacy, since that's what's fully
                 functional today). Swaps the sidebar nav between the
                 existing admin tools and the new ledger-spine section.
                 Both modes sit behind the same admin guard — this is a
                 view preference, not an authorization boundary. -->
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

            <div class="admin-user-info">
                <div class="admin-user-name">{{ adminStore.adminInfo?.name }}</div>
                <div class="admin-user-role">{{ roleLabel }}</div>
            </div>
        </template>

        <!-- Footer: 2FA logout (if session active) + back-to-app -->
        <template #footer="{ collapsed, isMobile, closeDrawer }">
            <button v-if="adminStore.hasValidAdminSession" class="admin-back-link"
                :class="{ 'admin-back-link--icon-only': collapsed && !isMobile }"
                @click="logout2FA(closeDrawer)" :title="$t('admin.nav.logout2FA')">
                <LockKeyhole :size="16" class="admin-back-icon" />
                <span v-if="!collapsed || isMobile">{{ $t('admin.nav.logout2FA') }}</span>
            </button>
            <button class="admin-back-link"
                :class="{ 'admin-back-link--icon-only': collapsed && !isMobile }"
                @click="goToApp(closeDrawer)" :title="$t('admin.nav.backToApp')">
                <ArrowLeft :size="16" class="admin-back-icon" />
                <span v-if="!collapsed || isMobile">{{ $t('admin.nav.backToApp') }}</span>
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
    UserCheck, ArrowLeft, LockKeyhole,
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

async function logout2FA(closeDrawer) {
    if (!confirm(t('admin.layout.resetSessionPrompt'))) return
    await adminStore.adminLogout2FA()
    if (closeDrawer) closeDrawer()
}

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
/* ─── Admin mode toggle (body slot, top) ─────────────────────────────────── */
.admin-mode {
    display: flex;
    gap: 4px;
    padding: 4px;
    margin-bottom: 8px;
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

/* ─── User info block (body slot) ─────────────────────────────────────────
   Pushed to the bottom of the body section with margin-top:auto so it sits
   just above the theme/lang controls (mirrors the original AdminLayout
   structure where user info was the top item of the bottom footer cluster). */
.admin-user-info {
    padding: 4px 8px;
    margin-top: auto;
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

/* ─── Back-to-app / 2FA logout (footer slot) ─────────────────────────────── */
.admin-back-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--sb-text);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    text-align: left;
    text-decoration: none;
    font-family: inherit;
    width: 100%;
}

.admin-back-link:hover {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
}

.admin-back-link--icon-only {
    justify-content: center;
    padding: 10px;
}

.admin-back-icon {
    flex-shrink: 0;
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
