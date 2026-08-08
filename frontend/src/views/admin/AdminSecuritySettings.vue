<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.security.title') }}</h1>
                <div class="adm-page-subtitle">{{ $t('admin.security.subtitle') }}</div>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <template v-else>
            <!-- 2FA status -->
            <div class="adm-card">
                <h3 class="adm-card-title">{{ $t('admin.security.statusSection') }}</h3>
                <div class="adm-grid-2">
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.security.fieldState') }}</div>
                            <span class="adm-badge" :class="status?.totpEnabled ? 'adm-badge--active' : 'adm-badge--inactive'">
                                {{ status?.totpEnabled ? $t('admin.security.stateEnabled') : $t('admin.security.stateDisabled') }}
                            </span>
                        </div>
                        <div v-if="status?.totpEnabledAt" class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.security.fieldEnabledAt') }}</div>
                            <span class="adm-text-sm">{{ formatDate(status.totpEnabledAt) }}</span>
                        </div>
                    </div>
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.security.fieldEncryption') }}</div>
                            <span class="adm-text-sm">
                                {{ status?.encryptionConfigured ? $t('admin.security.encryptionYes') : $t('admin.security.encryptionNo') }}
                            </span>
                        </div>
                        <div v-if="adminStore.adminSessionExpiresAt" class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.security.fieldSessionExpires') }}</div>
                            <span class="adm-text-sm">{{ formatDate(adminStore.adminSessionExpiresAt) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Admin 2FA session - reset/end the current verified session.
                 Moved here from the admin sidebar (it was a nav button); this
                 is its natural home alongside the other 2FA controls. After
                 reset the admin must re-enter their code to continue. -->
            <div v-if="adminStore.hasValidAdminSession" class="adm-card">
                <h3 class="adm-card-title">{{ $t('admin.security.sessionSection') }}</h3>
                <p class="adm-text-sm adm-muted" style="margin-bottom: 14px;">
                    {{ $t('admin.security.sessionDescription') }}
                </p>
                <button
                    class="adm-btn adm-btn--ghost"
                    @click="doResetSession"
                    :disabled="busy"
                >
                    {{ $t('admin.nav.logout2FA') }}
                </button>
                <div v-if="resetSessionError" class="adm-2fa-error">{{ resetSessionError }}</div>
            </div>

            <!-- Backup codes regeneration -->
            <div v-if="status?.totpEnabled" class="adm-card">
                <h3 class="adm-card-title">{{ $t('admin.security.backupSection') }}</h3>
                <p class="adm-text-sm adm-muted" style="margin-bottom: 14px;">
                    {{ $t('admin.security.backupDescription') }}
                </p>

                <div v-if="newBackupCodes.length > 0" class="adm-card adm-card--success">
                    <p class="adm-text-sm" style="margin-bottom: 10px;">
                        <strong>{{ $t('admin.security.newCodesTitle') }}</strong>{{ $t('admin.security.newCodesDescription') }}
                    </p>
                    <div class="adm-backup-codes">
                        <div v-for="c in newBackupCodes" :key="c" class="adm-backup-code">{{ c }}</div>
                    </div>
                    <div class="adm-row" style="margin-top: 12px; gap: 8px;">
                        <button class="adm-btn adm-btn--sm adm-btn--ghost" @click="copyBackupCodes">
                            {{ $t('admin.security.copyAll') }}
                        </button>
                        <button class="adm-btn adm-btn--sm adm-btn--primary" @click="newBackupCodes = []">
                            {{ $t('admin.security.saved') }}
                        </button>
                    </div>
                </div>

                <div v-else>
                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.security.currentTotpLabel') }}</div>
                        <input
                            v-model="regenerateCode"
                            class="adm-input"
                            placeholder="123456"
                            maxlength="6"
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            style="max-width: 200px;"
                        />
                    </div>
                    <button
                        class="adm-btn adm-btn--ghost"
                        @click="doRegenerate"
                        :disabled="busy || regenerateCode.length !== 6"
                    >
                        {{ busy ? $t('admin.security.regenerating') : $t('admin.security.regenerate') }}
                    </button>
                    <div v-if="regenerateError" class="adm-2fa-error">{{ regenerateError }}</div>
                </div>
            </div>

            <!-- Disable 2FA -->
            <div v-if="status?.totpEnabled" class="adm-card">
                <h3 class="adm-card-title">{{ $t('admin.security.disableSection') }}</h3>
                <p class="adm-text-sm adm-muted" style="margin-bottom: 14px;">
                    {{ $t('admin.security.disableDescription') }}
                </p>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.security.currentTotpLabel') }}</div>
                    <input
                        v-model="disableCode"
                        class="adm-input"
                        placeholder="123456"
                        maxlength="6"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        style="max-width: 200px;"
                    />
                </div>
                <button
                    class="adm-btn adm-btn--danger"
                    @click="doDisable"
                    :disabled="busy || disableCode.length !== 6"
                >
                    {{ busy ? $t('admin.security.disabling') : $t('admin.security.disable') }}
                </button>
                <div v-if="disableError" class="adm-2fa-error">{{ disableError }}</div>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()
const { t, locale } = useI18n()

const loading = ref(true)
const busy = ref(false)
const status = ref(null)

const regenerateCode = ref('')
const regenerateError = ref(null)
const newBackupCodes = ref([])

const disableCode = ref('')
const disableError = ref(null)

const resetSessionError = ref(null)

async function loadStatus() {
    loading.value = true
    try {
        status.value = await adminStore.fetch2FAStatus()
    } catch (err) {
        // ignore - admin layout will surface bigger issues
    } finally {
        loading.value = false
    }
}

// Reset the verified admin 2FA session (moved here from the admin sidebar).
// After this the layout's hasValidAdminSession flips false and the
// AdminTwoFactorGate re-renders, prompting for the code again.
async function doResetSession() {
    if (!confirm(t('admin.layout.resetSessionPrompt'))) return
    busy.value = true
    resetSessionError.value = null
    try {
        await adminStore.adminLogout2FA()
    } catch (err) {
        resetSessionError.value = err?.response?.data?.message || err?.message || t('admin.common.error')
    } finally {
        busy.value = false
    }
}

async function doRegenerate() {
    if (regenerateCode.value.length !== 6) return
    busy.value = true
    regenerateError.value = null
    try {
        const data = await adminStore.regenerateBackupCodes(regenerateCode.value)
        newBackupCodes.value = data.backupCodes || []
        regenerateCode.value = ''
    } catch (err) {
        regenerateError.value = err.response?.data?.message || t('admin.security.regenerateError')
    } finally {
        busy.value = false
    }
}

async function doDisable() {
    if (disableCode.value.length !== 6) return
    if (!confirm(t('admin.security.disableConfirm'))) return
    busy.value = true
    disableError.value = null
    try {
        await adminStore.disable2FA(disableCode.value)
        disableCode.value = ''
        await loadStatus()
        // adminLayout will show the setup gate on next render because session is cleared
    } catch (err) {
        disableError.value = err.response?.data?.message || t('admin.security.disableError')
    } finally {
        busy.value = false
    }
}

async function copyBackupCodes() {
    try {
        await navigator.clipboard.writeText(newBackupCodes.value.join('\n'))
    } catch { /* ignore */ }
}

function formatDate(d) {
    if (!d) return '-'
    const localeMap = { ru: 'ru-RU', en: 'en-GB', uz: 'uz-UZ' }
    return new Date(d).toLocaleString(localeMap[locale.value] || 'ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

onMounted(loadStatus)
</script>

<style scoped>
.adm-card {
    margin-top: 1em;
}

/* Success-tinted variant of .adm-card - used for the "new backup codes
   generated" notice. The base .adm-card lives in admin.css; this only
   tints the background + border via the same green token pair used by
   .adm-badge--*-success so the tone is consistent across the admin UI. */
.adm-card--success {
    background: var(--adm-badge-success-bg);
    border-color: var(--adm-badge-success-bg);
    margin-bottom: 14px;
}

.adm-backup-codes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    background: var(--adm-input-bg);
    border: 1px solid var(--adm-border);
    border-radius: 8px;
    padding: 14px;
}

.adm-backup-code {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 14px;
    color: var(--adm-text);
    text-align: center;
    padding: 4px;
    user-select: all;
}

.adm-2fa-error {
    color: var(--adm-danger-text);
    font-size: 12px;
    padding: 6px 10px;
    background: var(--adm-btn-danger-bg);
    border: 1px solid var(--adm-btn-danger-bg-hover);
    border-radius: 6px;
    margin-top: 10px;
    display: inline-block;
}
</style>
