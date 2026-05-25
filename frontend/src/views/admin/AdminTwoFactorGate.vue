<template>
    <div class="adm-2fa-gate">
        <div class="adm-2fa-card">
            <!-- Loading state -->
            <div v-if="loading" class="adm-2fa-state">
                <div class="adm-muted">{{ $t('admin.twoFactor.loadingStatus') }}</div>
            </div>

            <!-- Setup flow (not enrolled yet) -->
            <template v-else-if="phase === 'setup'">
                <h2 class="adm-2fa-title">{{ $t('admin.twoFactor.setupTitle') }}</h2>
                <p class="adm-2fa-text">
                    {{ $t('admin.twoFactor.setupText') }}
                </p>
                <div v-if="qrDataUrl" class="adm-2fa-qr">
                    <img :src="qrDataUrl" :alt="$t('admin.twoFactor.qrAlt')" />
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.twoFactor.codeLabel') }}</div>
                    <input
                        v-model="codeInput"
                        @keyup.enter="confirmSetup"
                        class="adm-input adm-2fa-code-input"
                        placeholder="123456"
                        maxlength="6"
                        autocomplete="one-time-code"
                        inputmode="numeric"
                    />
                </div>
                <div v-if="error" class="adm-2fa-error">{{ error }}</div>
                <button
                    class="adm-btn adm-btn--primary adm-2fa-submit"
                    @click="confirmSetup"
                    :disabled="busy || codeInput.length !== 6"
                >
                    {{ busy ? $t('admin.twoFactor.checking') : $t('admin.twoFactor.confirmActivate') }}
                </button>
            </template>

            <!-- Show backup codes (one-time, after confirm) -->
            <template v-else-if="phase === 'backup-codes'">
                <h2 class="adm-2fa-title">{{ $t('admin.twoFactor.activatedTitle') }}</h2>
                <p class="adm-2fa-text">
                    {{ $t('admin.twoFactor.activatedText') }}
                </p>
                <div class="adm-backup-codes">
                    <div v-for="c in backupCodes" :key="c" class="adm-backup-code">{{ c }}</div>
                </div>
                <div class="adm-2fa-actions">
                    <button class="adm-btn adm-btn--ghost" @click="copyBackupCodes">{{ $t('admin.common.copy') }}</button>
                    <button class="adm-btn adm-btn--primary" @click="finishSetup">
                        {{ $t('admin.twoFactor.iSavedCodes') }}
                    </button>
                </div>
            </template>

            <!-- Verify flow (enrolled, no valid session) -->
            <template v-else-if="phase === 'verify'">
                <h2 class="adm-2fa-title">{{ $t('admin.twoFactor.verifyTitle') }}</h2>
                <p class="adm-2fa-text">
                    {{ $t('admin.twoFactor.verifyText') }}<span v-if="useBackupCode">{{ $t('admin.twoFactor.verifyTextOrBackup') }}</span>.
                </p>
                <div class="adm-field">
                    <input
                        v-model="codeInput"
                        @keyup.enter="doVerify"
                        class="adm-input adm-2fa-code-input"
                        :placeholder="useBackupCode ? 'XXXXX-XXXXX' : '123456'"
                        :maxlength="useBackupCode ? 11 : 6"
                        autocomplete="one-time-code"
                        :inputmode="useBackupCode ? 'text' : 'numeric'"
                    />
                </div>
                <div v-if="error" class="adm-2fa-error">{{ error }}</div>
                <button
                    class="adm-btn adm-btn--primary adm-2fa-submit"
                    @click="doVerify"
                    :disabled="busy || codeInput.length < (useBackupCode ? 10 : 6)"
                >
                    {{ busy ? $t('admin.twoFactor.checking') : $t('admin.twoFactor.verifyAction') }}
                </button>
                <button class="adm-btn adm-btn--ghost adm-2fa-toggle" @click="toggleBackup">
                    {{ useBackupCode ? $t('admin.twoFactor.useAuthApp') : $t('admin.twoFactor.useBackupCode') }}
                </button>
            </template>

            <!-- Setup-not-configured (server missing TOTP_ENCRYPTION_KEY) -->
            <template v-else-if="phase === 'not-configured'">
                <h2 class="adm-2fa-title">{{ $t('admin.twoFactor.notConfiguredTitle') }}</h2>
                <p class="adm-2fa-text">
                    {{ $t('admin.twoFactor.notConfiguredText1') }} <code>TOTP_ENCRYPTION_KEY</code> {{ $t('admin.twoFactor.notConfiguredText2') }}
                </p>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const emit = defineEmits(['verified'])
const adminStore = useAdminStore()
const { t } = useI18n()

const loading = ref(true)
const busy = ref(false)
const error = ref(null)

const phase = ref('verify') // 'setup' | 'backup-codes' | 'verify' | 'not-configured'
const qrDataUrl = ref(null)
const backupCodes = ref([])
const codeInput = ref('')
const useBackupCode = ref(false)

async function init() {
    loading.value = true
    try {
        const status = await adminStore.fetch2FAStatus()
        if (!status.encryptionConfigured) {
            phase.value = 'not-configured'
            return
        }
        if (status.totpEnabled) {
            phase.value = 'verify'
        } else {
            await beginSetup()
        }
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.twoFactor.statusError')
    } finally {
        loading.value = false
    }
}

async function beginSetup() {
    try {
        const data = await adminStore.setup2FA()
        qrDataUrl.value = data.qrDataUrl
        phase.value = 'setup'
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.twoFactor.setupError')
    }
}

async function confirmSetup() {
    if (codeInput.value.length !== 6) return
    busy.value = true
    error.value = null
    try {
        const data = await adminStore.confirm2FA(codeInput.value)
        backupCodes.value = data.backupCodes || []
        phase.value = 'backup-codes'
        codeInput.value = ''
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.twoFactor.invalidCode')
    } finally {
        busy.value = false
    }
}

async function doVerify() {
    const min = useBackupCode.value ? 10 : 6
    if (codeInput.value.length < min) return
    busy.value = true
    error.value = null
    try {
        await adminStore.verify2FA(codeInput.value)
        codeInput.value = ''
        emit('verified')
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.twoFactor.invalidCode')
    } finally {
        busy.value = false
    }
}

function finishSetup() {
    // After backup-codes phase, we already have a session via confirm2FA.
    emit('verified')
}

function toggleBackup() {
    useBackupCode.value = !useBackupCode.value
    codeInput.value = ''
    error.value = null
}

async function copyBackupCodes() {
    try {
        await navigator.clipboard.writeText(backupCodes.value.join('\n'))
    } catch {
        // ignore
    }
}

onMounted(init)
</script>

<style scoped>
.adm-2fa-gate {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 100px);
    padding: 20px;
}

.adm-2fa-card {
    background: rgba(20, 14, 32, 0.8);
    border: 1px solid rgba(149, 0, 255, 0.18);
    border-radius: 14px;
    padding: 36px;
    max-width: 480px;
    width: 100%;
}

.adm-2fa-state {
    padding: 40px 0;
    text-align: center;
}

.adm-2fa-title {
    font-size: 22px;
    font-weight: 600;
    color: rgba(240, 236, 246, 0.95);
    margin: 0 0 12px 0;
}

.adm-2fa-text {
    font-size: 13px;
    color: rgba(240, 236, 246, 0.7);
    line-height: 1.5;
    margin-bottom: 20px;
}

.adm-2fa-text strong {
    color: rgba(240, 236, 246, 0.95);
}

.adm-2fa-text code {
    background: rgba(15, 10, 26, 0.6);
    padding: 1px 6px;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 12px;
}

.adm-2fa-qr {
    display: flex;
    justify-content: center;
    margin: 20px 0;
}

.adm-2fa-qr img {
    background: white;
    border-radius: 8px;
    padding: 8px;
    width: 200px;
    height: 200px;
}

.adm-2fa-code-input {
    text-align: center;
    font-size: 22px;
    letter-spacing: 0.3em;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    padding: 12px;
}

.adm-2fa-submit {
    width: 100%;
    justify-content: center;
    margin-top: 12px;
    padding: 12px;
    font-size: 14px;
}

.adm-2fa-toggle {
    width: 100%;
    justify-content: center;
    margin-top: 8px;
    font-size: 12px;
}

.adm-2fa-error {
    color: #fca5a5;
    font-size: 13px;
    padding: 8px 12px;
    background: rgba(220, 38, 38, 0.08);
    border: 1px solid rgba(220, 38, 38, 0.2);
    border-radius: 6px;
    margin-top: 10px;
}

.adm-backup-codes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    background: rgba(15, 10, 26, 0.6);
    border: 1px solid rgba(149, 0, 255, 0.1);
    border-radius: 8px;
    padding: 14px;
    margin: 16px 0;
}

.adm-backup-code {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 14px;
    color: rgba(240, 236, 246, 0.95);
    text-align: center;
    padding: 4px;
    user-select: all;
}

.adm-2fa-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
}

.adm-2fa-actions .adm-btn {
    flex: 1;
    justify-content: center;
}
</style>
