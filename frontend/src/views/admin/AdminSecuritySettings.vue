<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">Безопасность</h1>
                <div class="adm-page-subtitle">Двухфакторная аутентификация и резервные коды</div>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">Загрузка...</div>
        <template v-else>
            <!-- 2FA status -->
            <div class="adm-card">
                <h3 class="adm-card-title">Статус 2FA</h3>
                <div class="adm-grid-2">
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">Состояние</div>
                            <span class="adm-badge" :class="status?.totpEnabled ? 'adm-badge--active' : 'adm-badge--inactive'">
                                {{ status?.totpEnabled ? 'включено' : 'выключено' }}
                            </span>
                        </div>
                        <div v-if="status?.totpEnabledAt" class="adm-field">
                            <div class="adm-field-label">Активировано</div>
                            <span class="adm-text-sm">{{ formatDate(status.totpEnabledAt) }}</span>
                        </div>
                    </div>
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">Шифрование настроено</div>
                            <span class="adm-text-sm">
                                {{ status?.encryptionConfigured ? 'Да' : 'Нет — установите TOTP_ENCRYPTION_KEY' }}
                            </span>
                        </div>
                        <div v-if="adminStore.adminSessionExpiresAt" class="adm-field">
                            <div class="adm-field-label">Текущая сессия истекает</div>
                            <span class="adm-text-sm">{{ formatDate(adminStore.adminSessionExpiresAt) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Backup codes regeneration -->
            <div v-if="status?.totpEnabled" class="adm-card">
                <h3 class="adm-card-title">Резервные коды</h3>
                <p class="adm-text-sm adm-muted" style="margin-bottom: 14px;">
                    Резервные коды позволяют войти без приложения-аутентификатора (один код = один вход).
                    Регенерация уничтожает все старые коды и создаёт новые 10 штук — старые перестают работать.
                </p>

                <div v-if="newBackupCodes.length > 0" class="adm-card" style="background: rgba(34, 197, 94, 0.06); border-color: rgba(34, 197, 94, 0.25); margin-bottom: 14px;">
                    <p class="adm-text-sm" style="margin-bottom: 10px;">
                        <strong>Новые резервные коды</strong> — сохраните их сейчас, повторно показаны не будут:
                    </p>
                    <div class="adm-backup-codes">
                        <div v-for="c in newBackupCodes" :key="c" class="adm-backup-code">{{ c }}</div>
                    </div>
                    <div class="adm-row" style="margin-top: 12px; gap: 8px;">
                        <button class="adm-btn adm-btn--sm adm-btn--ghost" @click="copyBackupCodes">
                            Скопировать все
                        </button>
                        <button class="adm-btn adm-btn--sm adm-btn--primary" @click="newBackupCodes = []">
                            Я сохранил коды
                        </button>
                    </div>
                </div>

                <div v-else>
                    <div class="adm-field">
                        <div class="adm-field-label">Текущий TOTP-код для подтверждения</div>
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
                        {{ busy ? 'Регенерация...' : 'Сгенерировать новые коды' }}
                    </button>
                    <div v-if="regenerateError" class="adm-2fa-error">{{ regenerateError }}</div>
                </div>
            </div>

            <!-- Disable 2FA -->
            <div v-if="status?.totpEnabled" class="adm-card">
                <h3 class="adm-card-title">Отключить 2FA</h3>
                <p class="adm-text-sm adm-muted" style="margin-bottom: 14px;">
                    После отключения для повторного входа в админ-панель снова потребуется новая настройка 2FA.
                    Все резервные коды также будут аннулированы. Это действие нельзя отменить.
                </p>
                <div class="adm-field">
                    <div class="adm-field-label">Текущий TOTP-код для подтверждения</div>
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
                    {{ busy ? 'Отключение...' : 'Отключить 2FA' }}
                </button>
                <div v-if="disableError" class="adm-2fa-error">{{ disableError }}</div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'

const adminStore = useAdminStore()

const loading = ref(true)
const busy = ref(false)
const status = ref(null)

const regenerateCode = ref('')
const regenerateError = ref(null)
const newBackupCodes = ref([])

const disableCode = ref('')
const disableError = ref(null)

async function loadStatus() {
    loading.value = true
    try {
        status.value = await adminStore.fetch2FAStatus()
    } catch (err) {
        // ignore — admin layout will surface bigger issues
    } finally {
        loading.value = false
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
        regenerateError.value = err.response?.data?.message || 'Не удалось сгенерировать коды'
    } finally {
        busy.value = false
    }
}

async function doDisable() {
    if (disableCode.value.length !== 6) return
    if (!confirm('Точно отключить 2FA? Все резервные коды будут аннулированы.')) return
    busy.value = true
    disableError.value = null
    try {
        await adminStore.disable2FA(disableCode.value)
        disableCode.value = ''
        await loadStatus()
        // adminLayout will show the setup gate on next render because session is cleared
    } catch (err) {
        disableError.value = err.response?.data?.message || 'Не удалось отключить 2FA'
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
    if (!d) return '—'
    return new Date(d).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

onMounted(loadStatus)
</script>

<style scoped>
.adm-backup-codes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    background: rgba(15, 10, 26, 0.6);
    border: 1px solid rgba(149, 0, 255, 0.1);
    border-radius: 8px;
    padding: 14px;
}

.adm-backup-code {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 14px;
    color: rgba(240, 236, 246, 0.95);
    text-align: center;
    padding: 4px;
    user-select: all;
}

.adm-2fa-error {
    color: #fca5a5;
    font-size: 12px;
    padding: 6px 10px;
    background: rgba(220, 38, 38, 0.08);
    border: 1px solid rgba(220, 38, 38, 0.2);
    border-radius: 6px;
    margin-top: 10px;
    display: inline-block;
}
</style>
