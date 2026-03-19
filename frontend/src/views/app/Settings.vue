<template>
    <div class="settings-page">

        <!-- Header -->
        <div class="settings-header">
            <h1 class="settings-title">Settings</h1>
            <p class="settings-sub">Manage your account preferences</p>
        </div>

        <div class="settings-layout">

            <!-- Sidebar tabs -->
            <nav class="settings-nav">
                <button v-for="tab in tabs" :key="tab.key" class="settings-tab"
                    :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
                    <component :is="tab.icon" class="w-4 h-4" />
                    {{ tab.label }}
                    <span v-if="tab.soon" class="tab-soon">Soon</span>
                </button>
            </nav>

            <!-- Content panel -->
            <div class="settings-panel">

                <!-- Personal tab -->
                <div v-if="activeTab === 'personal'" class="panel-section">
                    <div class="panel-section-header">
                        <h2 class="panel-section-title">{{ $t('settings.personal.title') }}</h2>
                        <p class="panel-section-desc">{{ $t('settings.personal.description') }}</p>
                    </div>

                    <!-- Profile info (read-only) -->
                    <div class="settings-row">
                        <div class="settings-row-label">
                            <div class="row-label-title">Account</div>
                            <div class="row-label-desc">Your Google account details</div>
                        </div>
                        <div class="profile-display">
                            <img v-if="authStore.user?.picture" :src="authStore.user.picture" alt="avatar"
                                class="profile-avatar" />
                            <div v-else class="profile-avatar-fallback">
                                {{ initials }}
                            </div>
                            <div>
                                <div class="profile-name">{{ authStore.user?.name }}</div>
                                <div class="profile-email">{{ authStore.user?.email }}</div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-divider"></div>

                    <!-- Theme -->
                    <div class="settings-row">
                        <div class="settings-row-label">
                            <div class="row-label-title">{{ $t('settings.personal.theme') }}</div>
                            <div class="row-label-desc">{{ $t('settings.personal.themeDescription') }}</div>
                        </div>
                        <div class="theme-options">
                            <button v-for="opt in themeOptions" :key="opt.value" class="theme-opt"
                                :class="{ active: themeStore.preference === opt.value }"
                                @click="selectTheme(opt.value)">
                                <component :is="opt.icon" class="w-4 h-4" />
                                {{ opt.label }}
                            </button>
                        </div>
                    </div>

                    <div class="settings-divider"></div>

                    <!-- Subscription -->
                    <div class="settings-row">
                        <div class="settings-row-label">
                            <div class="row-label-title">Plan</div>
                            <div class="row-label-desc">Your current subscription</div>
                        </div>
                        <div class="plan-display">
                            <span class="plan-badge">{{ authStore.subscriptionType?.toUpperCase() }}</span>
                            <span class="plan-usage">
                                {{ authStore.filesProcessedThisMonth }} / {{ authStore.monthlyLimit }} files this month
                            </span>
                        </div>
                    </div>

                    <!-- Save notification -->
                    <Transition name="notif">
                        <div v-if="showSaved" class="save-notif">
                            <CheckCircleIcon class="w-4 h-4" />
                            Settings saved
                        </div>
                    </Transition>
                </div>

                <!-- Billing / Privacy — coming soon stubs -->
                <div v-else class="panel-coming-soon">
                    <div class="coming-soon-icon">
                        <component :is="currentTab?.icon" class="w-6 h-6" />
                    </div>
                    <h3 class="coming-soon-title">{{ $t('settings.comingSoon') }}</h3>
                    <p class="coming-soon-desc">{{ currentTab?.soonDesc }}</p>
                </div>

            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import {
    UserIcon, CreditCardIcon, ShieldCheckIcon,
    SunIcon, MoonIcon, ComputerDesktopIcon, CheckCircleIcon
} from '@heroicons/vue/24/outline'

const { t } = useI18n()
const authStore = useAuthStore()
const themeStore = useThemeStore()

const activeTab = ref('personal')
const showSaved = ref(false)

const tabs = [
    { key: 'personal', label: t('settings.tabs.personal'), icon: UserIcon },
    { key: 'billing', label: t('settings.tabs.billing'), icon: CreditCardIcon, soon: true, soonDesc: t('settings.billingTabDescription') },
    { key: 'privacy', label: t('settings.tabs.privacy'), icon: ShieldCheckIcon, soon: true, soonDesc: t('settings.privacyTabDescription') },
]

const themeOptions = [
    { value: 'light', label: t('settings.personal.themeLight'), icon: SunIcon },
    { value: 'dark', label: t('settings.personal.themeDark'), icon: MoonIcon },
    { value: 'system', label: t('settings.personal.themeSystem'), icon: ComputerDesktopIcon },
]

const currentTab = computed(() => tabs.find(t => t.key === activeTab.value))

const initials = computed(() => {
    const name = authStore.user?.name || ''
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'U'
})

function selectTheme(value) {
    themeStore.setTheme(value)
    showSaved.value = true
    setTimeout(() => { showSaved.value = false }, 2500)
}
</script>

<style scoped>
.settings-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 36px 32px 64px;
    display: flex;
    flex-direction: column;
    gap: 28px;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.settings-title {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.02em;
    margin: 0 0 5px;
}

.settings-sub {
    font-size: 13.5px;
    color: #9CA3AF;
    margin: 0;
}

/* ─── Layout ─────────────────────────────────────────────────────────────── */
.settings-layout {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 24px;
    align-items: start;
}

/* ─── Nav ────────────────────────────────────────────────────────────────── */
.settings-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    position: sticky;
    top: 24px;
}

.settings-tab {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 12px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: #6B7280;
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 0.12s;
    position: relative;
}

.settings-tab:hover {
    background: #F3F4F6;
    color: #111827;
}

.settings-tab.active {
    background: rgba(124, 58, 237, 0.08);
    color: #7C3AED;
}

.tab-soon {
    margin-left: auto;
    font-size: 10px;
    font-weight: 600;
    color: #9CA3AF;
    background: #F3F4F6;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.04em;
}

/* ─── Panel ──────────────────────────────────────────────────────────────── */
.settings-panel {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 16px;
    overflow: hidden;
}

.panel-section {
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.panel-section-header {
    padding-bottom: 20px;
    border-bottom: 1px solid #F3F4F6;
}

.panel-section-title {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 5px;
}

.panel-section-desc {
    font-size: 13px;
    color: #9CA3AF;
    margin: 0;
}

/* ─── Row ────────────────────────────────────────────────────────────────── */
.settings-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
}

.settings-row-label {
    flex: 1;
}

.row-label-title {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
    margin-bottom: 3px;
}

.row-label-desc {
    font-size: 12.5px;
    color: #9CA3AF;
}

.settings-divider {
    height: 1px;
    background: #F3F4F6;
}

/* ─── Profile ────────────────────────────────────────────────────────────── */
.profile-display {
    display: flex;
    align-items: center;
    gap: 12px;
}

.profile-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.profile-avatar-fallback {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #7C3AED;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
}

.profile-name {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
}

.profile-email {
    font-size: 12.5px;
    color: #9CA3AF;
    margin-top: 2px;
}

/* ─── Theme ──────────────────────────────────────────────────────────────── */
.theme-options {
    display: flex;
    gap: 6px;
}

.theme-opt {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border: 1px solid #E5E7EB;
    border-radius: 9px;
    background: transparent;
    color: #6B7280;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
}

.theme-opt:hover {
    border-color: #D1D5DB;
    color: #374151;
}

.theme-opt.active {
    border-color: #7C3AED;
    background: rgba(124, 58, 237, 0.06);
    color: #7C3AED;
}

/* ─── Plan ───────────────────────────────────────────────────────────────── */
.plan-display {
    display: flex;
    align-items: center;
    gap: 12px;
}

.plan-badge {
    font-size: 11.5px;
    font-weight: 700;
    color: #7C3AED;
    background: rgba(124, 58, 237, 0.08);
    padding: 4px 10px;
    border-radius: 7px;
    letter-spacing: 0.06em;
}

.plan-usage {
    font-size: 12.5px;
    color: #9CA3AF;
}

/* ─── Save notif ─────────────────────────────────────────────────────────── */
.save-notif {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 9px;
    font-size: 13.5px;
    font-weight: 500;
    color: #15803d;
}

.notif-enter-active,
.notif-leave-active {
    transition: opacity 0.2s, transform 0.2s;
}

.notif-enter-from,
.notif-leave-to {
    opacity: 0;
    transform: translateY(4px);
}

/* ─── Coming soon panel ──────────────────────────────────────────────────── */
.panel-coming-soon {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 32px;
    text-align: center;
}

.coming-soon-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: #F3F4F6;
    color: #9CA3AF;
    display: flex;
    align-items: center;
    justify-content: center;
}

.coming-soon-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
    margin: 0;
}

.coming-soon-desc {
    font-size: 13.5px;
    color: #9CA3AF;
    margin: 0;
    max-width: 320px;
}

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
    .settings-page {
        padding: 24px 16px 48px;
    }

    .settings-layout {
        grid-template-columns: 1fr;
    }

    .settings-nav {
        flex-direction: row;
        overflow-x: auto;
        position: static;
    }

    .settings-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }

    .theme-options {
        flex-wrap: wrap;
    }
}
</style>