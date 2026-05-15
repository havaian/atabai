<template>
    <div class="adm-page">
        <header class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.access.title') }}</h1>
                <p class="adm-page-subtitle">{{ $t('admin.access.subtitle') }}</p>
            </div>
            <button v-if="canEdit" class="adm-btn-primary" @click="openAddModal">
                {{ $t('admin.access.addEntry') }}
            </button>
        </header>

        <!-- Status banner -->
        <div class="adm-banner" :class="{ 'adm-banner-on': enabled, 'adm-banner-off': !enabled }">
            <strong>{{ enabled ? $t('admin.access.statusOn') : $t('admin.access.statusOff') }}</strong>
            <span class="adm-banner-hint">
                {{ enabled ? $t('admin.access.statusOnHint') : $t('admin.access.statusOffHint') }}
            </span>
        </div>

        <!-- Stats -->
        <div class="adm-stats-grid">
            <div class="adm-stat-card">
                <div class="adm-stat-label">{{ $t('admin.access.totalEntries') }}</div>
                <div class="adm-stat-value">{{ entries.length }}</div>
            </div>
        </div>

        <!-- Bulk add -->
        <div v-if="canEdit" class="adm-card">
            <div class="adm-card-header">
                <strong>{{ $t('admin.access.bulkAddTitle') }}</strong>
                <span class="adm-card-hint">{{ $t('admin.access.bulkAddHint') }}</span>
            </div>
            <textarea
                v-model="bulkText"
                class="adm-textarea"
                :placeholder="$t('admin.access.bulkPlaceholder')"
                rows="4"
            />
            <input
                v-model="bulkNote"
                class="adm-input"
                :placeholder="$t('admin.access.notePlaceholder')"
            />
            <button class="adm-btn" :disabled="!bulkText.trim() || bulkSubmitting" @click="submitBulk">
                {{ bulkSubmitting ? $t('admin.access.processing') : $t('admin.access.bulkAddSubmit') }}
            </button>
            <div v-if="bulkResult" class="adm-bulk-result">
                {{ $t('admin.access.bulkResult', { added: bulkResult.added, skipped: bulkResult.skipped }) }}
            </div>
        </div>

        <!-- Table -->
        <div class="adm-card adm-card-no-pad">
            <div v-if="loading" class="adm-loading">{{ $t('admin.common.loading') }}</div>
            <div v-else-if="entries.length === 0" class="adm-empty">
                {{ $t('admin.access.empty') }}
            </div>
            <table v-else class="adm-table">
                <thead>
                    <tr>
                        <th>{{ $t('admin.access.colEmail') }}</th>
                        <th>{{ $t('admin.access.colNote') }}</th>
                        <th>{{ $t('admin.access.colAddedBy') }}</th>
                        <th>{{ $t('admin.access.colAddedAt') }}</th>
                        <th v-if="canEdit" class="adm-th-action"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="e in entries" :key="e._id">
                        <td class="adm-td-email">{{ e.email }}</td>
                        <td class="adm-td-note">{{ e.note || '—' }}</td>
                        <td class="adm-td-author">
                            {{ e.addedBy?.email || $t('admin.access.systemAuthor') }}
                        </td>
                        <td class="adm-td-date">{{ formatDate(e.createdAt) }}</td>
                        <td v-if="canEdit" class="adm-td-action">
                            <button class="adm-btn-icon-danger" @click="removeEntry(e)">×</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Add modal -->
        <div v-if="addModalOpen" class="adm-modal-backdrop" @click="closeAddModal">
            <div class="adm-modal" @click.stop>
                <h3>{{ $t('admin.access.addEntry') }}</h3>
                <input
                    v-model="newEmail"
                    type="email"
                    class="adm-input"
                    :placeholder="$t('admin.access.emailPlaceholder')"
                    @keyup.enter="submitAdd"
                />
                <input
                    v-model="newNote"
                    class="adm-input"
                    :placeholder="$t('admin.access.notePlaceholder')"
                />
                <div class="adm-modal-actions">
                    <button class="adm-btn-ghost" @click="closeAddModal">{{ $t('admin.common.cancel') }}</button>
                    <button class="adm-btn-primary" :disabled="!newEmail.trim() || addSubmitting" @click="submitAdd">
                        {{ addSubmitting ? '...' : $t('admin.common.save') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const { t } = useI18n()
const adminStore = useAdminStore()

const enabled = ref(false)
const entries = ref([])
const loading = ref(true)

const addModalOpen = ref(false)
const newEmail = ref('')
const newNote = ref('')
const addSubmitting = ref(false)

const bulkText = ref('')
const bulkNote = ref('')
const bulkSubmitting = ref(false)
const bulkResult = ref(null)

const canEdit = computed(() => adminStore.adminInfo?.role === 'super_admin')

const localeTag = 'en-GB'

function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString(localeTag, { day: '2-digit', month: 'short', year: 'numeric' })
}

async function load() {
    loading.value = true
    try {
        const res = await adminStore.listWhitelist()
        enabled.value = !!res.enabled
        entries.value = res.entries || []
    } catch (err) {
        console.error(err)
        alert(t('admin.access.loadError'))
    } finally {
        loading.value = false
    }
}

function openAddModal() {
    newEmail.value = ''
    newNote.value = ''
    addModalOpen.value = true
}
function closeAddModal() { addModalOpen.value = false }

async function submitAdd() {
    if (!newEmail.value.trim()) return
    addSubmitting.value = true
    try {
        await adminStore.addWhitelistEntry(newEmail.value.trim(), newNote.value.trim())
        await load()
        closeAddModal()
    } catch (err) {
        const code = err.response?.data?.error
        if (code === 'DUPLICATE') alert(t('admin.access.duplicateError'))
        else alert(t('admin.access.addError'))
    } finally {
        addSubmitting.value = false
    }
}

async function submitBulk() {
    const raw = bulkText.value.trim()
    if (!raw) return
    // Accept comma- or newline-separated emails
    const emails = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    if (emails.length === 0) return
    bulkSubmitting.value = true
    bulkResult.value = null
    try {
        const res = await adminStore.bulkAddWhitelist(emails, bulkNote.value.trim())
        bulkResult.value = { added: res.added || 0, skipped: res.skipped || 0 }
        bulkText.value = ''
        bulkNote.value = ''
        await load()
    } catch (err) {
        console.error(err)
        alert(t('admin.access.bulkError'))
    } finally {
        bulkSubmitting.value = false
    }
}

async function removeEntry(entry) {
    if (!confirm(t('admin.access.removeConfirm', { email: entry.email }))) return
    try {
        await adminStore.removeWhitelistEntry(entry._id)
        await load()
    } catch (err) {
        alert(t('admin.access.removeError'))
    }
}

onMounted(load)
</script>

<style scoped>
.adm-page {
    padding: 24px 32px 48px;
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.adm-page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
}

.adm-page-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    color: var(--ws-text, #f0ecf6);
}

.adm-page-subtitle {
    font-size: 13px;
    color: var(--adm-text-muted);
    margin: 4px 0 0 0;
}

.adm-banner {
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
}

.adm-banner-on {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #4ade80;
}

.adm-banner-off {
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fbbf24;
}

.adm-banner-hint {
    color: var(--adm-text-muted);
    font-size: 13px;
    font-weight: normal;
}

.adm-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    align-items: stretch;
}

.adm-stat-card {
    background: var(--ws-bg-elevated, rgba(20, 14, 32, 0.5));
    border: 1px solid var(--adm-border);
    border-radius: 12px;
    padding: 16px;
    min-height: 88px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.adm-stat-label {
    font-size: 11px;
    color: var(--adm-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
}

.adm-stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--ws-text, #f0ecf6);
}

.adm-card {
    background: var(--ws-bg-elevated, rgba(20, 14, 32, 0.5));
    border: 1px solid var(--adm-border);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.adm-card-no-pad {
    padding: 0;
}

.adm-card-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
}

.adm-card-hint {
    font-size: 12px;
    color: var(--adm-text-muted);
}

.adm-textarea,
.adm-input {
    background: var(--adm-input-bg);
    border: 1px solid var(--adm-border);
    color: var(--ws-text, #f0ecf6);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
    width: 100%;
    resize: vertical;
}

.adm-textarea:focus,
.adm-input:focus {
    outline: none;
    border-color: #9333ea;
}

.adm-btn,
.adm-btn-primary,
.adm-btn-ghost {
    padding: 9px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    align-self: flex-start;
}

.adm-btn {
    background: var(--adm-nav-bg-hover);
    color: var(--adm-nav-text-active);
    border-color: rgba(149, 0, 255, 0.3);
}

.adm-btn:hover:not(:disabled) {
    background: var(--adm-nav-bg-active);
}

.adm-btn-primary {
    background: #9333ea;
    color: white;
}

.adm-btn-primary:hover:not(:disabled) {
    background: #a855f7;
}

.adm-btn-ghost {
    background: transparent;
    color: var(--adm-text-muted);
    border-color: rgba(149, 0, 255, 0.2);
}

.adm-btn:disabled,
.adm-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.adm-bulk-result {
    font-size: 13px;
    color: #4ade80;
}

.adm-table {
    width: 100%;
    border-collapse: collapse;
}

.adm-table th {
    text-align: left;
    padding: 12px 16px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--adm-text-muted);
    background: var(--adm-table-header-bg);
    border-bottom: 1px solid var(--adm-border-soft);
}

.adm-table td {
    padding: 12px 16px;
    font-size: 13.5px;
    color: var(--adm-text);
    border-bottom: 1px solid var(--adm-border-soft);
}

.adm-td-email {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.adm-td-note,
.adm-td-author {
    color: var(--adm-text-muted);
    font-size: 12.5px;
}

.adm-td-date {
    color: var(--adm-text-muted);
    font-size: 12px;
    white-space: nowrap;
}

.adm-td-action {
    text-align: right;
    width: 40px;
}

.adm-btn-icon-danger {
    background: transparent;
    border: none;
    color: rgba(248, 113, 113, 0.7);
    font-size: 18px;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 6px;
    line-height: 1;
}

.adm-btn-icon-danger:hover {
    background: rgba(248, 113, 113, 0.1);
    color: #ef4444;
}

.adm-loading,
.adm-empty {
    padding: 48px;
    text-align: center;
    color: var(--adm-text-muted);
}

/* Modal */
.adm-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.adm-modal {
    background: var(--ws-bg-elevated, #1a0f2e);
    border: 1px solid var(--adm-border);
    border-radius: 14px;
    padding: 24px;
    max-width: 480px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.adm-modal h3 {
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 4px 0;
}

.adm-modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.adm-th-action {
    width: 40px;
}
</style>
