<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.mappings.title') }}</h1>
                <div class="adm-page-subtitle">{{ $t('admin.mappings.subtitle') }}</div>
            </div>
            <div class="adm-row">
                <button v-if="isSuperAdmin"
                    class="adm-btn adm-btn--ghost"
                    @click="runSeed"
                    :disabled="seeding"
                    :title="$t('admin.mappings.seedTooltip')">
                    {{ seeding ? $t('admin.mappings.runningSeed') : $t('admin.mappings.runSeed') }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <div v-else>
            <div v-for="reportType in REPORT_TYPES" :key="reportType" class="adm-card">
                <div class="adm-card-header">
                    <h3 class="adm-card-title" style="margin: 0;">{{ reportTypeLabel(reportType) }}</h3>
                    <div class="adm-row">
                        <button class="adm-btn adm-btn--sm adm-btn--ghost"
                            @click="openSet(publishedGlobalFor(reportType))"
                            v-if="publishedGlobalFor(reportType)">
                            {{ $t('admin.mappings.openPublished') }}
                        </button>
                        <button v-if="isSuperAdmin && publishedGlobalFor(reportType) && !draftGlobalFor(reportType)"
                            class="adm-btn adm-btn--sm adm-btn--primary"
                            @click="createDraft(reportType)">
                            {{ $t('admin.mappings.createDraft') }}
                        </button>
                        <button v-if="draftGlobalFor(reportType)"
                            class="adm-btn adm-btn--sm adm-btn--primary"
                            @click="openSet(draftGlobalFor(reportType))">
                            {{ $t('admin.mappings.openDraft') }}
                        </button>
                        <button v-if="isSuperAdmin && publishedGlobalFor(reportType)"
                            class="adm-btn adm-btn--sm adm-btn--ghost"
                            :title="$t('admin.mappings.newUserSpecificHint')"
                            @click="openNewUserSpecificModal(reportType)">
                            {{ $t('admin.mappings.newUserSpecific') }}
                        </button>
                    </div>
                </div>

                <div v-if="!grouped[reportType] || grouped[reportType].length === 0" class="adm-empty">
                    {{ $t('admin.mappings.noVersions') }}
                </div>
                <div v-else class="adm-table-wrap">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th>{{ $t('admin.mappings.tableVersion') }}</th>
                                <th>{{ $t('admin.mappings.tableStatus') }}</th>
                                <th>{{ $t('admin.mappings.tableScope') }}</th>
                                <th>{{ $t('admin.mappings.tableRowCount') }}</th>
                                <th>{{ $t('admin.mappings.tablePublished') }}</th>
                                <th>{{ $t('admin.mappings.tableAuthor') }}</th>
                                <th>{{ $t('admin.mappings.tableNotes') }}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="s in grouped[reportType]" :key="s._id">
                                <td class="adm-mono">{{ s.version }}</td>
                                <td>
                                    <span class="adm-badge" :class="`adm-badge--mappingset-${s.status}`">{{ s.status }}</span>
                                </td>
                                <td class="adm-text-sm">
                                    <!-- Scope: global = "Global"; user-specific = label or list of emails.
                                         Emails are truncated to first 2 if more exist. -->
                                    <span v-if="!isUserSpecific(s)" class="adm-muted">
                                        {{ $t('admin.mappings.scopeGlobal') }}
                                    </span>
                                    <span v-else :title="scopeTooltip(s)">
                                        <strong v-if="s.label" style="margin-right: 6px;">{{ s.label }}</strong>
                                        <span class="adm-muted">{{ scopeSummary(s) }}</span>
                                    </span>
                                </td>
                                <td class="adm-text-sm">{{ s.itemCount }}</td>
                                <td class="adm-text-sm adm-muted">{{ formatDate(s.publishedAt) }}</td>
                                <td class="adm-text-sm adm-muted">{{ s.publishedBy?.email || s.createdBy?.email || '—' }}</td>
                                <td class="adm-text-sm adm-muted" style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    {{ s.notes || '—' }}
                                </td>
                                <td>
                                    <button class="adm-btn adm-btn--sm adm-btn--ghost" @click="openSet(s)">{{ $t('admin.common.open') }}</button>
                                    <!-- Fork: only for non-draft sets, opens a modal to set scope -->
                                    <button v-if="isSuperAdmin && s.status !== 'draft'"
                                        class="adm-btn adm-btn--sm adm-btn--ghost"
                                        style="margin-left: 6px;"
                                        :title="$t('admin.mappings.forkHint')"
                                        @click="openForkModal(s)">
                                        {{ $t('admin.mappings.fork') }}
                                    </button>
                                    <button v-if="isSuperAdmin && s.status !== 'published'"
                                        class="adm-btn adm-btn--sm adm-btn--danger"
                                        style="margin-left: 6px;"
                                        @click="deleteSet(s)">
                                        {{ $t('admin.common.delete') }}
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- New user-specific draft modal -->
        <div v-if="newUserSpecificModal.open" class="adm-modal-backdrop" @click.self="closeNewUserSpecificModal">
            <div class="adm-modal">
                <h3 class="adm-modal-title">{{ $t('admin.mappings.newUserSpecificTitle') }}</h3>
                <div class="adm-text-sm adm-muted" style="margin-bottom: 12px;">
                    {{ $t('admin.mappings.newUserSpecificDesc', { reportType: reportTypeLabel(newUserSpecificModal.reportType) }) }}
                </div>
                <div v-if="['cash_flow', 'equity'].includes(newUserSpecificModal.reportType)"
                    class="adm-text-sm"
                    style="color: #fbbf24; margin-bottom: 12px;">
                    {{ $t('admin.mappings.scopeUnsupportedWarning') }}
                </div>

                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappings.scopeLabel') }}</div>
                    <input v-model="newUserSpecificModal.label" type="text" class="adm-input"
                        :placeholder="$t('admin.mappings.scopeLabelPlaceholder')" />
                </div>

                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappings.scopeAssignedUsers') }}</div>
                    <div class="adm-text-sm adm-muted" style="margin-bottom: 6px;">
                        {{ $t('admin.mappings.scopeAssignedUsersHint') }}
                    </div>
                    <UserMultiSelect v-model="newUserSpecificModal.assignedUsers" />
                </div>

                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappings.newUserSpecificSource') }}</div>
                    <div class="adm-row" style="gap: 16px;">
                        <label class="adm-row" style="gap: 6px;">
                            <input type="radio" value="fork" v-model="newUserSpecificModal.source" />
                            <span class="adm-text-sm">{{ $t('admin.mappings.newUserSpecificSourceFork') }}</span>
                        </label>
                        <label class="adm-row" style="gap: 6px;">
                            <input type="radio" value="blank" v-model="newUserSpecificModal.source" />
                            <span class="adm-text-sm">{{ $t('admin.mappings.newUserSpecificSourceBlank') }}</span>
                        </label>
                    </div>
                </div>

                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="closeNewUserSpecificModal"
                        :disabled="newUserSpecificModal.submitting">
                        {{ $t('admin.common.cancel') }}
                    </button>
                    <button class="adm-btn adm-btn--primary"
                        :disabled="newUserSpecificModal.submitting || newUserSpecificModal.assignedUsers.length === 0"
                        @click="confirmNewUserSpecific">
                        {{ newUserSpecificModal.submitting ? $t('admin.common.saving') : $t('admin.common.save') }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Fork existing set modal -->
        <div v-if="forkModal.open" class="adm-modal-backdrop" @click.self="closeForkModal">
            <div class="adm-modal">
                <h3 class="adm-modal-title">
                    {{ $t('admin.mappings.forkModalTitle', { version: forkModal.source?.version }) }}
                </h3>

                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappings.scopeLabel') }}</div>
                    <input v-model="forkModal.label" type="text" class="adm-input"
                        :placeholder="$t('admin.mappings.scopeLabelPlaceholder')" />
                </div>

                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappings.scopeAssignedUsers') }}</div>
                    <div class="adm-text-sm adm-muted" style="margin-bottom: 6px;">
                        {{ $t('admin.mappings.forkScopeHint') }}
                    </div>
                    <UserMultiSelect v-model="forkModal.assignedUsers" />
                </div>

                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="closeForkModal"
                        :disabled="forkModal.submitting">
                        {{ $t('admin.common.cancel') }}
                    </button>
                    <button class="adm-btn adm-btn--primary"
                        :disabled="forkModal.submitting"
                        @click="confirmFork">
                        {{ forkModal.submitting ? $t('admin.common.saving') : $t('admin.common.save') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import UserMultiSelect from '@/components/admin/UserMultiSelect.vue'

const router = useRouter()
const adminStore = useAdminStore()
const { t, locale } = useI18n()

const REPORT_TYPES = ['balance_sheet', 'cash_flow', 'profit_loss_form2', 'equity']

const loading = ref(false)
const seeding = ref(false)
const error = ref(null)
const grouped = ref({})

const isSuperAdmin = computed(() => adminStore.isSuperAdmin)

// Modal state for creating a new user-specific draft (blank or forked from global).
const newUserSpecificModal = reactive({
    open: false,
    reportType: null,
    label: '',
    assignedUsers: [],
    source: 'fork', // 'fork' = clone global published, 'blank' = empty draft
    submitting: false
})

// Modal state for forking an arbitrary existing set with chosen scope.
const forkModal = reactive({
    open: false,
    source: null, // the set being forked
    label: '',
    assignedUsers: [],
    submitting: false
})

function reportTypeLabel(rt) {
    const key = {
        balance_sheet: 'admin.mappings.reportTypeBalanceSheet',
        cash_flow: 'admin.mappings.reportTypeCashFlow',
        profit_loss_form2: 'admin.mappings.reportTypeProfitLossForm2',
        equity: 'admin.mappings.reportTypeEquity'
    }[rt]
    return key ? t(key) : rt
}

function isUserSpecific(s) {
    return Array.isArray(s.assignedUsers) && s.assignedUsers.length > 0
}

// Short scope summary for table cell — shows first 2 emails + "+N more".
function scopeSummary(s) {
    if (!isUserSpecific(s)) return ''
    const emails = (s.assignedUsers || []).map(u => u.email || u).filter(Boolean)
    if (emails.length === 0) return `(${s.assignedUsers.length})`
    if (emails.length <= 2) return emails.join(', ')
    return `${emails.slice(0, 2).join(', ')} +${emails.length - 2}`
}

// Full list of emails for the tooltip on hover.
function scopeTooltip(s) {
    if (!isUserSpecific(s)) return ''
    return (s.assignedUsers || []).map(u => u.email || u).join('\n')
}

// Global = no assignedUsers. Most existing screens still want the singular
// "the published one" / "the draft one" — those are now scoped to global.
function publishedGlobalFor(rt) {
    return (grouped.value[rt] || []).find(s => s.status === 'published' && !isUserSpecific(s))
}

function draftGlobalFor(rt) {
    return (grouped.value[rt] || []).find(s => s.status === 'draft' && !isUserSpecific(s))
}

async function loadSets() {
    loading.value = true
    error.value = null
    try {
        const data = await adminStore.listMappingSets()
        grouped.value = data.grouped || {}
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.mappings.loadError')
    } finally {
        loading.value = false
    }
}

async function runSeed() {
    if (!confirm(t('admin.mappings.seedConfirm'))) return
    seeding.value = true
    try {
        await adminStore.runMappingSeed()
        await loadSets()
    } catch (err) {
        alert(err.response?.data?.message || t('admin.mappings.seedError'))
    } finally {
        seeding.value = false
    }
}

async function createDraft(reportType) {
    try {
        const data = await adminStore.createDraft(reportType)
        router.push(`/admin/mappings/sets/${data.draft._id}`)
    } catch (err) {
        alert(err.response?.data?.message || t('admin.mappings.createDraftError'))
    }
}

async function deleteSet(s) {
    if (!confirm(t('admin.mappings.deleteSetConfirm', { reportType: s.reportType, version: s.version, status: s.status }))) return
    try {
        await adminStore.deleteSet(s._id)
        await loadSets()
    } catch (err) {
        alert(err.response?.data?.message || t('admin.mappings.deleteSetError'))
    }
}

function openSet(s) {
    router.push(`/admin/mappings/sets/${s._id}`)
}

// ─── New user-specific draft modal ──────────────────────────────────────────
function openNewUserSpecificModal(reportType) {
    newUserSpecificModal.open = true
    newUserSpecificModal.reportType = reportType
    newUserSpecificModal.label = ''
    newUserSpecificModal.assignedUsers = []
    newUserSpecificModal.source = 'fork'
    newUserSpecificModal.submitting = false
}

function closeNewUserSpecificModal() {
    newUserSpecificModal.open = false
}

async function confirmNewUserSpecific() {
    if (newUserSpecificModal.assignedUsers.length === 0) return
    newUserSpecificModal.submitting = true
    try {
        let result
        if (newUserSpecificModal.source === 'blank') {
            result = await adminStore.createBlankDraft(newUserSpecificModal.reportType, {
                assignedUsers: newUserSpecificModal.assignedUsers,
                label: newUserSpecificModal.label
            })
        } else {
            // Fork: find the global published set for this reportType and fork it.
            const globalPub = publishedGlobalFor(newUserSpecificModal.reportType)
            if (!globalPub) {
                alert(t('admin.mappings.noGlobalToForkError'))
                newUserSpecificModal.submitting = false
                return
            }
            result = await adminStore.forkSet(globalPub._id, {
                assignedUsers: newUserSpecificModal.assignedUsers,
                label: newUserSpecificModal.label
            })
        }
        closeNewUserSpecificModal()
        router.push(`/admin/mappings/sets/${result.draft._id}`)
    } catch (err) {
        alert(err.response?.data?.message || t('admin.mappings.createDraftError'))
    } finally {
        newUserSpecificModal.submitting = false
    }
}

// ─── Fork existing set modal ─────────────────────────────────────────────────
function openForkModal(s) {
    forkModal.open = true
    forkModal.source = s
    forkModal.label = s.label || ''
    forkModal.assignedUsers = (s.assignedUsers || []).map(u => u._id || u)
    forkModal.submitting = false
}

function closeForkModal() {
    forkModal.open = false
    forkModal.source = null
}

async function confirmFork() {
    forkModal.submitting = true
    try {
        const result = await adminStore.forkSet(forkModal.source._id, {
            assignedUsers: forkModal.assignedUsers,
            label: forkModal.label
        })
        closeForkModal()
        router.push(`/admin/mappings/sets/${result.draft._id}`)
    } catch (err) {
        alert(err.response?.data?.message || t('admin.mappings.createDraftError'))
    } finally {
        forkModal.submitting = false
    }
}

function formatDate(d) {
    if (!d) return '—'
    const localeMap = { ru: 'ru-RU', en: 'en-GB', uz: 'uz-UZ' }
    return new Date(d).toLocaleString(localeMap[locale.value] || 'ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

onMounted(loadSets)
</script>

<style scoped>
.adm-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}
</style>
