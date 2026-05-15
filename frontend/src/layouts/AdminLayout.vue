<template>
    <div class="adm-layout">
        <!-- Sidebar -->
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import AdminTwoFactorGate from '@/views/admin/AdminTwoFactorGate.vue'
import {
    LayoutDashboard,
    Users,
    FileText,
    Network,
    ShieldCheck,
    ArrowLeft,
    PanelLeftClose,
    PanelLeftOpen,
    LockKeyhole
} from 'lucide-vue-next'

const router = useRouter()
const adminStore = useAdminStore()
const { t } = useI18n()

const sidebarOpen = ref(true)

const navItems = computed(() => [
    { path: '/admin', label: t('admin.nav.dashboard'), icon: LayoutDashboard, exact: true },
    { path: '/admin/users', label: t('admin.nav.users'), icon: Users },
    { path: '/admin/files', label: t('admin.nav.files'), icon: FileText },
    { path: '/admin/mappings', label: t('admin.nav.mappings'), icon: Network },
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
    // No additional action needed.
}

onMounted(async () => {
    const saved = localStorage.getItem('atabai-admin-sidebar-open')
    if (saved !== null) sidebarOpen.value = JSON.parse(saved)

    await adminStore.checkAdminAccess()
})

// Persist sidebar state
watch(sidebarOpen, (v) => {
    localStorage.setItem('atabai-admin-sidebar-open', JSON.stringify(v))
})
</script>

<style scoped>
.adm-layout {
    display: flex;
    height: 100vh;
    background: var(--ws-bg, #0f0a1a);
    color: var(--ws-text, #f0ecf6);
    overflow: hidden;
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */
.adm-sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--ws-bg-elevated, rgba(20, 14, 32, 0.95));
    border-right: 1px solid rgba(149, 0, 255, 0.15);
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
    border-bottom: 1px solid rgba(149, 0, 255, 0.1);
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
    color: rgba(240, 236, 246, 0.95);
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
    color: rgba(240, 236, 246, 0.5);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    display: flex;
    align-items: center;
}

.adm-sidebar-toggle:hover {
    background: rgba(149, 0, 255, 0.1);
    color: rgba(240, 236, 246, 0.9);
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
    color: rgba(240, 236, 246, 0.65);
    font-size: 14px;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
}

.adm-nav-item:hover {
    background: rgba(149, 0, 255, 0.08);
    color: rgba(240, 236, 246, 0.95);
}

.adm-nav-item--active {
    background: rgba(149, 0, 255, 0.15);
    color: #c084fc;
}

.adm-nav-icon {
    flex-shrink: 0;
}

/* ─── Sidebar footer ──────────────────────────────────────────────────────── */
.adm-sidebar-footer {
    padding: 12px;
    border-top: 1px solid rgba(149, 0, 255, 0.1);
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
    color: rgba(240, 236, 246, 0.9);
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
    color: rgba(240, 236, 246, 0.6);
    font-size: 13px;
}

.adm-back-link:hover {
    background: rgba(149, 0, 255, 0.08);
    color: rgba(240, 236, 246, 0.95);
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
    color: rgba(240, 236, 246, 0.7);
}

.adm-forbidden h2 {
    font-size: 20px;
    margin-bottom: 8px;
    color: rgba(240, 236, 246, 0.95);
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
</style>
