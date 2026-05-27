<template>
    <div class="adm-page">
        <!-- Header -->
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.access.title') }}</h1>
                <div class="adm-page-subtitle">{{ $t('admin.access.subtitle') }}</div>
            </div>
            <button v-if="canEdit" class="adm-btn adm-btn--primary" @click="openAddModal">
                {{ $t('admin.access.addEntry') }}
            </button>
        </div>

        <!-- Status banner -->
        <div class="aa-banner" :class="enabled ? 'aa-banner--on' : 'aa-banner--off'">
            <div class="aa-banner__title">
                {{ enabled ? $t('admin.access.statusOn') : $t('admin.access.statusOff') }}
            </div>
            <div class="aa-banner__hint">
                {{ enabled ? $t('admin.access.statusOnHint') : $t('admin.access.statusOffHint') }}
            </div>
        </div>

        <!-- Stats -->
        <div class="adm-stats-grid">
            <div class="adm-stat">
                <div class="adm-stat-label">{{ $t('admin.access.totalEntries') }}</div>
                <div class="adm-stat-value">{{ entriesCount }}</div>
            </div>
        </div>

        <!-- Bulk add -->
        <div v-if="canEdit" class="adm-card aa-bulk">
            <div class="aa-bulk__header">
                <strong>{{ $t('admin.access.bulkAddTitle') }}</strong>
                <span class="aa-bulk__hint">{{ $t('admin.access.bulkAddHint') }}</span>
            </div>
            <textarea v-model="bulkText" class="adm-textarea" :placeholder="$t('admin.access.bulkPlaceholder')"
                rows="4" />
            <input v-model="bulkNote" class="adm-input" :placeholder="$t('admin.access.notePlaceholder')" />
            <div class="aa-bulk__actions">
                <button class="adm-btn adm-btn--ghost" :disabled="bulkSubmitting || !bulkText.trim()"
                    @click="submitBulk">
                    {{ bulkSubmitting ? $t('admin.access.processing') : $t('admin.access.bulkAddSubmit') }}
                </button>
                <span v-if="bulkResult" class="aa-bulk__result">
                    {{ $t('admin.access.bulkResult', {
                        added: bulkResult.added,
                        skipped: bulkResult.skipped
                    }) }}
                </span>
            </div>
        </div>

        <!-- Table card -->
        <div class="adm-card aa-table-card">
            <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
            <div v-else-if="entries.length === 0" class="adm-empty">
                {{ $t('admin.access.empty') }}
            </div>
            <div v-else class="adm-table-wrap">
                <table class="adm-table">
                    <thead>
                        <tr>
                            <th>{{ $t('admin.access.colEmail') }}</th>
                            <th>{{ $t('admin.access.colNote') }}</th>
                            <th>{{ $t('admin.access.colAddedBy') }}</th>
                            <th>{{ $t('admin.access.colAddedAt') }}</th>
                            <th v-if="canEdit" class="aa-th-action"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="e in entries" :key="e._id">
                            <td class="adm-mono">{{ e.email }}</td>
                            <td class="adm-text-sm">{{ e.note || '—' }}</td>
                            <td class="adm-text-sm">
                                {{ (e.addedBy && e.addedBy.email) || $t('admin.access.systemAuthor') }}
                            </td>
                            <td class="adm-text-xs adm-muted">{{ formatDate(e.createdAt) }}</td>
                            <td v-if="canEdit" class="aa-td-action">
                                <button class="aa-btn-remove" @click="removeEntry(e)" title="Remove">×</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Add modal -->
        <div v-if="addModalOpen" class="adm-modal-backdrop" @click.self="closeAddModal">
            <div class="adm-modal">
                <h3 class="adm-modal-title">{{ $t('admin.access.addEntry') }}</h3>
                <div class="adm-field">
                    <div class="adm-field-label">Email *</div>
                    <input v-model="newEmail" type="email" class="adm-input"
                        :placeholder="$t('admin.access.emailPlaceholder')" @keyup.enter="submitAdd" />
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.access.colNote') }}</div>
                    <input v-model="newNote" class="adm-input" :placeholder="$t('admin.access.notePlaceholder')" />
                </div>
                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="closeAddModal">
                        {{ $t('admin.common.cancel') }}
                    </button>
                    <button class="adm-btn adm-btn--primary" :disabled="!newEmail.trim() || addSubmitting"
                        @click="submitAdd">
                        {{ addSubmitting ? '...' : $t('admin.common.save') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const { t } = useI18n()
const adminStore = useAdminStore()

// State
const enabled = ref(false)
const entries = ref([])
const loading = ref(true)

// Single-add modal
const addModalOpen = ref(false)
const newEmail = ref('')
const newNote = ref('')
const addSubmitting = ref(false)

// Bulk-add
const bulkText = ref('')
const bulkNote = ref('')
const bulkSubmitting = ref(false)
const bulkResult = ref(null)

// Defensive — adminInfo may be null during initial render
const canEdit = computed(() => {
    const info = adminStore.adminInfo
    return !!(info && info.role === 'super_admin')
})

const entriesCount = computed(() => entries.value.length)

function formatDate(iso) {
    if (!iso) return ''
    try {
        const d = new Date(iso)
        if (isNaN(d.getTime())) return ''
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
        return ''
    }
}

async function load() {
    loading.value = true
    try {
        const res = await adminStore.listWhitelist()
        enabled.value = !!(res && res.enabled)
        entries.value = (res && res.entries) || []
    } catch (err) {
        console.error('[AdminAccess] load failed', err)
        entries.value = []
    } finally {
        loading.value = false
    }
}

function openAddModal() {
    newEmail.value = ''
    newNote.value = ''
    addModalOpen.value = true
}

function closeAddModal() {
    addModalOpen.value = false
}

async function submitAdd() {
    const email = newEmail.value.trim()
    if (!email) return
    addSubmitting.value = true
    try {
        await adminStore.addWhitelistEntry(email, newNote.value.trim())
        await load()
        closeAddModal()
    } catch (err) {
        const code = err && err.response && err.response.data && err.response.data.error
        if (code === 'DUPLICATE') {
            alert(t('admin.access.duplicateError'))
        } else {
            alert(t('admin.access.addError'))
        }
    } finally {
        addSubmitting.value = false
    }
}

async function submitBulk() {
    const raw = bulkText.value.trim()
    if (!raw) return
    const emails = raw.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    if (emails.length === 0) return

    bulkSubmitting.value = true
    bulkResult.value = null
    try {
        const res = await adminStore.bulkAddWhitelist(emails, bulkNote.value.trim())
        bulkResult.value = {
            added: (res && res.added) || 0,
            skipped: (res && res.skipped) || 0
        }
        bulkText.value = ''
        bulkNote.value = ''
        await load()
    } catch (err) {
        console.error('[AdminAccess] bulk failed', err)
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
.aa-banner {
    border-radius: 10px;
    padding: 14px 16px;
    border: 1px solid var(--adm-border);
    background: var(--adm-surface);
    /* Banner sits directly above the stats grid; without bottom margin they
       touch each other on mobile. Stats grid only has margin-bottom, no top. */
    margin-bottom: 16px;
}

.aa-banner--on {
    border-color: var(--adm-badge-success-bg);
    background: var(--adm-badge-success-bg);
}

.aa-banner--off {
    border-color: var(--adm-badge-warn-bg);
    background: var(--adm-badge-warn-bg);
}

.aa-banner__title {
    font-weight: 600;
    font-size: 14px;
    color: var(--adm-text);
    margin-bottom: 2px;
}

.aa-banner__hint {
    font-size: 13px;
    color: var(--adm-text-muted);
}

.aa-bulk {
    /* The card is a plain block by default; previous `gap: 10px` did nothing
       because there was no flex/grid container. Make it a flex column so the
       textarea, note input, and actions row are evenly spaced. */
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.aa-bulk__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
}

.aa-bulk__hint {
    font-size: 12px;
    color: var(--adm-text-muted);
}

.aa-bulk__actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.aa-bulk__result {
    font-size: 13px;
    color: var(--adm-success-text);
}

.aa-table-card {
    padding: 0;
}

.aa-th-action,
.aa-td-action {
    width: 48px;
    text-align: right;
}

.aa-btn-remove {
    background: transparent;
    border: none;
    color: var(--adm-danger-text);
    /* Slight de-emphasis when at rest so the button doesn't pull the eye
       on every row — full opacity returns on hover. */
    opacity: 0.7;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 6px;
}

.aa-btn-remove:hover {
    background: var(--adm-btn-danger-bg);
    color: var(--adm-danger-text);
    opacity: 1;
}

@media (max-width: 767px) {
    /* On narrow viewports the stacked banner→stats→bulk-card layout looks
       cramped. Bump the banner gap and the bulk card's internal gap so the
       "Add all" button visually detaches from the note input above it. */
    .aa-banner { margin-bottom: 20px; }
    .aa-bulk { gap: 14px; }
}
</style>