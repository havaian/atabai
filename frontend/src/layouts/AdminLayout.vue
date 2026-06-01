<!-- frontend/src/layouts/AdminLayout.vue
     Thin wrapper around AppLayout — provides admin-side specific content
     (admin user dropdown with back-to-app exit in the profile slot, access
     guards on main content) via slots. All shared chrome (sidebar shell,
     mobile drawer, theme/lang pickers) is owned by AppLayout. -->
<template>
    <AppLayout :home-link="'/admin'" :brand-tag="$t('admin.layout.brandTag')" :nav-items="navItems"
        :storage-key="'atabai-admin-sidebar-open'">
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
    LayoutDashboard, Users, ShieldCheck, Languages,
    UserCheck, ArrowLeft,
} from 'lucide-vue-next'

const router = useRouter()
const adminStore = useAdminStore()
const { t } = useI18n()

// Single admin nav. The former Legacy ⇄ New mode split was removed — there is
// just one admin side now.
const navItems = computed(() => [
    { name: 'AdminDashboard', label: t('admin.nav.dashboard'), icon: LayoutDashboard, exact: true },
    { name: 'AdminUsers', label: t('admin.nav.users'), icon: Users },
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
    await adminStore.checkAdminAccess()
})
</script>

<style scoped>
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