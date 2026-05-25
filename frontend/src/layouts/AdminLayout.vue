<!-- frontend/src/layouts/AdminLayout.vue
     Thin wrapper around AppLayout — provides admin-side specific content
     (user info block in body, 2FA logout + back-to-app buttons in footer,
     access guards on main content) via slots. All shared chrome (sidebar
     shell, mobile drawer, theme/lang pickers) is owned by AppLayout. -->
<template>
    <AppLayout :home-link="'/admin'" :brand-tag="$t('admin.layout.brandTag')"
        :nav-items="navItems" :storage-key="'atabai-admin-sidebar-open'">
        <!-- Body: admin user info block -->
        <template #body>
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
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAdminStore } from '@/stores/admin'
import AdminTwoFactorGate from '@/views/admin/AdminTwoFactorGate.vue'
import {
    LayoutDashboard, Users, FileText, Network, ShieldCheck, Languages,
    UserCheck, ArrowLeft, LockKeyhole,
} from 'lucide-vue-next'

const router = useRouter()
const adminStore = useAdminStore()
const { t } = useI18n()

// Named routes — works regardless of locale prefix in URL.
const navItems = computed(() => [
    { name: 'AdminDashboard', label: t('admin.nav.dashboard'), icon: LayoutDashboard, exact: true },
    { name: 'AdminUsers', label: t('admin.nav.users'), icon: Users },
    { name: 'AdminFiles', label: t('admin.nav.files'), icon: FileText },
    { name: 'AdminMappings', label: t('admin.nav.mappings'), icon: Network },
    { name: 'AdminLocales', label: t('admin.nav.locales'), icon: Languages },
    { name: 'AdminAccess', label: t('admin.nav.access'), icon: UserCheck },
    { name: 'AdminSecuritySettings', label: t('admin.nav.security'), icon: ShieldCheck },
])

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
    await adminStore.checkAdminAccess()
})
</script>

<style scoped>
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
