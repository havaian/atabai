<!-- frontend/src/views/app/InvoicePreviewView.vue
     Invoice posting preview (methodology §7, build phase 3). Draft invoice
     postings grouped by color:
       GREEN  - every line has an account; will post as-is.
       YELLOW - auto-created counterparty needs verification.
       RED    - at least one invoice line has no account yet; the operator
                picks the per-line accounts before posting.
     RED invoices are skipped on commit until every line account is set. -->
<template>
    <div class="inv-preview">
        <header class="inv-preview-header">
            <button class="inv-preview-back" @click="back">
                <ArrowLeft :size="16" /> {{ $t('common.back') }}
            </button>
            <div class="inv-preview-titles">
                <h1>{{ isReadOnly ? $t('invoicePreview.committedTitle') : $t('invoicePreview.title') }}</h1>
                <p>{{ isReadOnly ? $t('invoicePreview.committedSubtitle') : $t('invoicePreview.subtitle') }}</p>
            </div>
            <div v-if="!isReadOnly" class="inv-preview-counts">
                <span class="inv-preview-count inv-preview-count--green">
                    {{ countByColor.green }} {{ $t('invoicePreview.colors.green') }}
                </span>
                <span class="inv-preview-count inv-preview-count--yellow">
                    {{ countByColor.yellow }} {{ $t('invoicePreview.colors.yellow') }}
                </span>
                <span class="inv-preview-count inv-preview-count--red">
                    {{ countByColor.red }} {{ $t('invoicePreview.colors.red') }}
                </span>
            </div>
            <span v-else class="inv-preview-count inv-preview-count--committed">
                {{ $t('invoiceBatches.status.committed') }}
            </span>
        </header>

        <section class="inv-preview-table-wrap">
            <table class="inv-preview-table">
                <thead>
                    <tr>
                        <th>{{ $t('invoicePreview.cols.row') }}</th>
                        <th>{{ $t('invoicePreview.cols.date') }}</th>
                        <th>{{ $t('invoicePreview.cols.invoice') }}</th>
                        <th>{{ $t('invoicePreview.cols.direction') }}</th>
                        <th>{{ $t('invoicePreview.cols.lines') }}</th>
                        <th class="inv-preview-num">{{ $t('invoicePreview.cols.amount') }}</th>
                        <th>{{ $t('invoicePreview.cols.status') }}</th>
                        <th v-if="!isReadOnly">{{ $t('invoicePreview.cols.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="draft in invoices.drafts" :key="draft.id" :class="`inv-preview-row inv-preview-row--${rowColor(draft)}`">
                        <td class="inv-preview-row-id">{{ shortRef(draft.sourceRef) }}</td>
                        <td>{{ formatDate(draft.date) }}</td>
                        <td class="inv-preview-desc">
                            <div class="inv-preview-descrow">
                                <span class="inv-preview-desctext">{{ draft.description }}</span>
                                <span
                                    v-if="draft.subtype && draft.subtype !== 'standard'"
                                    :class="`inv-preview-subtype inv-preview-subtype--${draft.subtype}`"
                                >
                                    {{ $t(`invoicePreview.subtype.${draft.subtype}`) }}
                                </span>
                                <span
                                    v-if="draft.subtype === 'corrected' && draft.periodLabel"
                                    class="inv-preview-targetperiod"
                                    :title="$t('invoicePreview.repostsInto', { period: draft.periodLabel })"
                                >
                                    → {{ draft.periodLabel }}
                                </span>
                                <span
                                    v-if="draft.periodLocked && !isReadOnly"
                                    class="inv-preview-lockchip"
                                    :title="$t('invoicePreview.lockedHint', { period: draft.periodLabel || '' })"
                                >
                                    <Lock :size="11" /> {{ $t('invoicePreview.locked') }}
                                </span>
                            </div>
                        </td>
                        <td>
                            <span v-if="draft.direction" :class="`inv-preview-dir inv-preview-dir--${draft.direction}`">
                                {{ $t(`invoicePreview.direction.${draft.direction}`) }}
                            </span>
                        </td>
                        <td class="inv-preview-lines">{{ lineSummary(draft) }}</td>
                        <td class="inv-preview-num">{{ formatAmount(draft.totalAmount) }}</td>
                        <td>
                            <span v-if="isReadOnly" class="inv-preview-pill inv-preview-pill--committed">
                                {{ $t('invoiceBatches.status.committed') }}
                            </span>
                            <span v-else-if="draft.periodLocked" class="inv-preview-pill inv-preview-pill--locked">
                                {{ $t('invoicePreview.locked') }}
                            </span>
                            <span v-else :class="`inv-preview-pill inv-preview-pill--${rowColor(draft)}`">
                                {{ $t(`invoicePreview.colors.${rowColor(draft)}`) }}
                            </span>
                        </td>
                        <td v-if="!isReadOnly">
                            <button
                                class="inv-preview-fix"
                                v-if="rowColor(draft) !== 'green' && !draft.periodLocked"
                                @click="openEditor(draft)"
                            >
                                <Pencil :size="13" />
                                {{ $t('invoicePreview.actions.fix') }}
                            </button>
                            <span v-else-if="draft.periodLocked" class="inv-preview-locknote">
                                {{ $t('invoicePreview.reopenToEdit') }}
                            </span>
                        </td>
                    </tr>
                    <tr v-if="invoices.drafts.length === 0 && !invoices.isLoading">
                        <td :colspan="isReadOnly ? 7 : 8" class="inv-preview-empty">{{ $t('invoicePreview.empty') }}</td>
                    </tr>
                </tbody>
            </table>
        </section>

        <div v-if="invoices.error" class="inv-preview-error">{{ invoices.error }}</div>

        <footer v-if="!isReadOnly" class="inv-preview-footer">
            <span class="inv-preview-help">{{ $t('invoicePreview.commitHelp', { red: countByColor.red }) }}</span>
            <span class="inv-preview-spacer" />
            <UiButton
                variant="primary"
                :loading="invoices.isCommitting"
                :disabled="invoices.drafts.length === 0"
                @click="commit"
            >
                {{ invoices.isCommitting ? $t('invoicePreview.committing') : $t('invoicePreview.commitButton') }}
            </UiButton>
        </footer>

        <!-- Per-line account editor -->
        <UiModal v-model="editorOpen" :title="$t('invoicePreview.editor.title')" max-width="560px" @close="closeEditor">
            <p class="modal-context">
                <strong>{{ editing && editing.description }}</strong>
            </p>
            <p class="modal-hint">{{ $t('invoicePreview.editor.hint') }}</p>

            <div class="modal-lines">
                <div v-for="(line, i) in editLines" :key="line.lineId" class="modal-line">
                    <div class="modal-line-info">
                        <span class="modal-line-label">{{ line.label || $t('invoicePreview.editor.lineFallback', { n: i + 1 }) }}</span>
                        <span class="modal-line-amount">{{ formatAmount(line.amount) }}</span>
                    </div>
                    <input
                        v-model="line.accountCode"
                        class="modal-line-account"
                        :placeholder="$t('invoicePreview.editor.accountPlaceholder')"
                        @keyup.enter="saveEdit"
                    />
                </div>
            </div>

            <button v-if="editLines.length > 1" class="modal-applyall" type="button" @click="applyFirstToAll">
                {{ $t('invoicePreview.editor.applyAll') }}
            </button>

            <div v-if="modalError" class="modal-error">{{ modalError }}</div>

            <template #footer>
                <UiButton variant="ghost" @click="closeEditor">{{ $t('common.cancel') }}</UiButton>
                <UiButton variant="primary" :loading="isSavingEdit" :disabled="!anyLineFilled" @click="saveEdit">
                    {{ $t('common.save') }}
                </UiButton>
            </template>
        </UiModal>

        <!-- Commit result -->
        <UiModal v-model="resultOpen" :title="$t('invoicePreview.result.title')" max-width="420px">
            <template v-if="commitResult">
                <div class="result-stat result-stat--committed">
                    <CheckCircle2 :size="18" />
                    <span>{{ $t('invoicePreview.result.committed', { n: commitResult.committed }) }}</span>
                </div>
                <div v-if="commitResult.reversed > 0" class="result-stat result-stat--reversed">
                    <RefreshCcw :size="18" />
                    <span>{{ $t('invoicePreview.result.reversed', { n: commitResult.reversed }) }}</span>
                </div>
                <div v-if="commitResult.skipped > 0" class="result-stat result-stat--skipped">
                    <AlertTriangle :size="18" />
                    <span>{{ $t('invoicePreview.result.skipped', { n: commitResult.skipped }) }}</span>
                </div>
                <p v-if="commitResult.skipped > 0" class="result-note">
                    {{ $t('invoicePreview.result.skippedNote') }}
                </p>
                <p v-else class="result-note">{{ $t('invoicePreview.result.allDone') }}</p>
            </template>
            <template #footer>
                <UiButton v-if="commitResult && commitResult.skipped > 0" variant="secondary" @click="reviewRemaining">
                    {{ $t('invoicePreview.result.reviewRemaining') }}
                </UiButton>
                <UiButton variant="primary" @click="goToBatches">
                    {{ $t('invoicePreview.result.done') }}
                </UiButton>
            </template>
        </UiModal>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, CheckCircle2, Lock, Pencil, RefreshCcw } from 'lucide-vue-next'
import { useInvoicesStore } from '@/stores/invoices'
import UiButton from '@/components/ui/UiButton.vue'
import UiModal from '@/components/ui/UiModal.vue'

const route = useRoute()
const router = useRouter()
const invoices = useInvoicesStore()

const periodId = computed(() => route.params.periodId)
const uploadId = computed(() => route.params.uploadId)
const isReadOnly = computed(() => route.query.status === 'committed')

const editing = ref(null)
const editLines = ref([])
const isSavingEdit = ref(false)
const modalError = ref('')

const editorOpen = computed({
    get: () => !!editing.value,
    set: (v) => { if (!v) closeEditor() },
})
const anyLineFilled = computed(() => editLines.value.some((l) => (l.accountCode || '').trim()))

onMounted(async () => {
    await invoices.fetchDrafts({
        periodId: periodId.value,
        uploadId: uploadId.value,
        status: isReadOnly.value ? 'committed' : undefined,
    })
})

function rowColor(draft) {
    return draft?.color || 'green'
}

const countByColor = computed(() => {
    const out = { green: 0, yellow: 0, red: 0 }
    for (const d of invoices.drafts) out[rowColor(d)]++
    return out
})

function lineSummary(draft) {
    const lines = draft.operatorLines || []
    const set = lines.filter((l) => l.accountCode).length
    return `${set}/${lines.length}`
}

function openEditor(draft) {
    editing.value = draft
    editLines.value = (draft.operatorLines || []).map((l) => ({
        lineId: l.lineId,
        label: l.label,
        amount: l.amount,
        accountCode: l.accountCode || '',
    }))
    modalError.value = ''
}
function closeEditor() {
    editing.value = null
    editLines.value = []
    modalError.value = ''
}
function applyFirstToAll() {
    const first = (editLines.value[0]?.accountCode || '').trim()
    if (!first) return
    editLines.value = editLines.value.map((l) => ({ ...l, accountCode: first }))
}
async function saveEdit() {
    if (!editing.value) return
    modalError.value = ''
    const lineAccounts = editLines.value
        .filter((l) => (l.accountCode || '').trim())
        .map((l) => ({ lineId: l.lineId, accountCode: l.accountCode.trim() }))
    if (lineAccounts.length === 0) {
        modalError.value = ''
        return
    }
    isSavingEdit.value = true
    try {
        await invoices.updateDraft({
            periodId: periodId.value,
            uploadId: uploadId.value,
            entryId: editing.value.id,
            lineAccounts,
        })
        await invoices.fetchDrafts({ periodId: periodId.value, uploadId: uploadId.value })
        closeEditor()
    } catch (err) {
        modalError.value = err?.response?.data?.message || err?.message || 'Save failed'
    } finally {
        isSavingEdit.value = false
    }
}

const commitResult = ref(null)
const resultOpen = computed({
    get: () => !!commitResult.value,
    set: (v) => { if (!v) commitResult.value = null },
})

async function commit() {
    try {
        const result = await invoices.commit({ periodId: periodId.value, uploadId: uploadId.value })
        commitResult.value = {
            committed: result?.committed ?? 0,
            skipped: result?.skipped ?? 0,
            reversed: result?.reversed ?? 0,
            rolledUpKeys: result?.rolledUpKeys ?? 0,
        }
    } catch (_) {
        // invoices.error already populated; renders inline.
    }
}

function goToBatches() {
    router.push(`/app/ledger/periods/${periodId.value}/invoice-batches`)
}
async function reviewRemaining() {
    commitResult.value = null
    await invoices.fetchDrafts({ periodId: periodId.value, uploadId: uploadId.value })
}

function back() { router.push(`/app/ledger/periods/${periodId.value}/invoice-batches`) }
function formatDate(d) { return d ? new Date(d).toISOString().slice(0, 10) : '' }
function formatAmount(a) {
    if (!a) return '0'
    return a.toString()
}
function shortRef(ref) {
    if (!ref) return ''
    const parts = ref.split(':')
    return parts[parts.length - 1] || ref
}
</script>

<style scoped>
.inv-preview { max-width: 1200px; margin: 0 auto; padding: 24px; }
.inv-preview-header {
    display: flex; align-items: center; gap: 24px;
    margin-bottom: 20px; flex-wrap: wrap;
}
.inv-preview-back {
    background: transparent; border: none; color: var(--ws-text-3); cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem;
}
.inv-preview-titles { flex: 1; }
.inv-preview-titles h1 { font-size: 1.3rem; font-weight: 600; color: var(--ws-text); margin-bottom: 4px; }
.inv-preview-titles p { font-size: 0.88rem; color: var(--ws-text-3); }
.inv-preview-counts { display: flex; gap: 8px; }
.inv-preview-count {
    padding: 6px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
}
.inv-preview-count--green { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.inv-preview-count--yellow { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.inv-preview-count--red { background: rgba(245, 101, 101, 0.15); color: #c53030; }
.inv-preview-count--committed { background: rgba(72, 187, 120, 0.15); color: #2f855a; }

.inv-preview-table-wrap {
    background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 12px; overflow-x: auto;
}
.inv-preview-table {
    width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.86rem;
}
.inv-preview-table th {
    text-align: left; padding: 10px 12px; font-weight: 600; color: var(--ws-text-3);
    border-bottom: 1px solid var(--ws-border); background: var(--ws-surface-2);
}
.inv-preview-table th.inv-preview-num,
.inv-preview-table td.inv-preview-num { text-align: right; font-variant-numeric: tabular-nums; }
.inv-preview-table td {
    padding: 10px 12px; border-bottom: 1px solid var(--ws-border); color: var(--ws-text);
}
.inv-preview-row--red { background: rgba(245, 101, 101, 0.04); }
.inv-preview-row--yellow { background: rgba(237, 137, 54, 0.04); }
.inv-preview-row-id { font-family: monospace; font-size: 0.78rem; color: var(--ws-text-3); }
.inv-preview-desc { max-width: 380px; }
.inv-preview-descrow { display: flex; align-items: center; gap: 6px; min-width: 0; }
.inv-preview-desctext {
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.inv-preview-subtype {
    flex: none; padding: 1px 7px; border-radius: 999px;
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.02em; text-transform: uppercase;
}
.inv-preview-subtype--additional { background: rgba(66, 153, 225, 0.16); color: #2b6cb0; }
.inv-preview-subtype--corrected { background: rgba(124, 58, 237, 0.16); color: var(--ws-purple); }
.inv-preview-targetperiod {
    flex: none; font-size: 0.72rem; color: var(--ws-text-3); font-variant-numeric: tabular-nums;
    white-space: nowrap;
}
.inv-preview-lockchip {
    flex: none; display: inline-flex; align-items: center; gap: 3px;
    padding: 1px 7px; border-radius: 999px; white-space: nowrap;
    font-size: 0.68rem; font-weight: 700;
    background: rgba(113, 128, 150, 0.16); color: #4a5568;
}
.inv-preview-locknote { font-size: 0.74rem; color: var(--ws-text-3); white-space: nowrap; }
.inv-preview-lines { font-variant-numeric: tabular-nums; color: var(--ws-text-2); }
.inv-preview-dir {
    padding: 1px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; white-space: nowrap;
}
.inv-preview-dir--incoming { background: rgba(66, 153, 225, 0.15); color: #2b6cb0; }
.inv-preview-dir--outgoing { background: rgba(124, 58, 237, 0.15); color: var(--ws-purple); }
.inv-preview-pill {
    padding: 2px 8px; border-radius: 999px; font-size: 0.74rem; font-weight: 600;
}
.inv-preview-pill--green { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.inv-preview-pill--yellow { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.inv-preview-pill--red { background: rgba(245, 101, 101, 0.15); color: #c53030; }
.inv-preview-pill--committed { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.inv-preview-pill--locked { background: rgba(113, 128, 150, 0.16); color: #4a5568; }
.inv-preview-fix {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
    background: transparent; border: 1px solid var(--ws-border); border-radius: 6px;
    color: var(--ws-text); font-size: 0.78rem; cursor: pointer;
}
.inv-preview-fix:hover { background: var(--ws-surface-2); }
.inv-preview-empty { text-align: center; padding: 40px 16px; color: var(--ws-text-3); }
.inv-preview-error {
    margin-top: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.inv-preview-footer {
    display: flex; align-items: center; gap: 16px; margin-top: 20px;
    background: var(--ws-surface-2); padding: 12px 16px; border-radius: 10px;
}
.inv-preview-help { font-size: 0.84rem; color: var(--ws-text-3); }
.inv-preview-spacer { flex: 1; }

/* Per-line editor */
.modal-context { font-size: 0.9rem; color: var(--ws-text); }
.modal-hint { font-size: 0.82rem; color: var(--ws-text-3); margin: 4px 0 14px; }
.modal-lines { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; }
.modal-line {
    display: flex; align-items: center; gap: 12px; padding: 8px 10px;
    background: var(--ws-surface-2); border-radius: 8px;
}
.modal-line-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.modal-line-label {
    font-size: 0.84rem; color: var(--ws-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.modal-line-amount { font-size: 0.76rem; color: var(--ws-text-3); font-variant-numeric: tabular-nums; }
.modal-line-account {
    width: 110px; flex-shrink: 0; box-sizing: border-box; padding: 7px 10px;
    background: var(--ws-surface); border: 1px solid var(--ws-border); border-radius: 6px;
    color: var(--ws-text); font-size: 0.84rem; font-family: inherit;
}
.modal-line-account:focus { outline: none; border-color: var(--ws-purple); }
.modal-applyall {
    margin-top: 10px; background: transparent; border: none; color: var(--ws-purple);
    font-size: 0.8rem; cursor: pointer; padding: 0;
}
.modal-applyall:hover { text-decoration: underline; }
.modal-error {
    margin-top: 12px; padding: 8px 10px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 6px; font-size: 0.82rem;
}

.result-stat {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 13px; border-radius: 8px; font-size: 0.92rem; font-weight: 500;
    margin-bottom: 10px;
}
.result-stat--committed { background: rgba(72, 187, 120, 0.12); color: #2f855a; }
.result-stat--reversed { background: rgba(124, 58, 237, 0.12); color: var(--ws-purple); }
.result-stat--skipped { background: rgba(237, 137, 54, 0.12); color: #b7791f; }
.result-note { font-size: 0.84rem; color: var(--ws-text-3); margin: 4px 0 0; line-height: 1.5; }
</style>
