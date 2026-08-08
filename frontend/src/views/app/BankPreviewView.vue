<!-- frontend/src/views/app/BankPreviewView.vue
     The signature UX of the bank engine - bank ТЗ §7's "Экран
     предпросмотра". Per Filipp (methodology дополнение §1.3) the green/yellow/
     red traffic light is gone: every draft carries a server-derived
     `commitReady` flag plus soft flags, and the operator ticks which rows to
     post. Commit-ready rows are pre-selected; rows still missing a record
     account ('000' placeholder) can't be ticked until fixed via "Fix" and are
     highlighted with an amber accent. Only the ticked rows are posted. -->
<template>
    <div class="bank-preview">
        <header class="bank-preview-header">
            <button class="bank-preview-back" @click="back">
                <ArrowLeft :size="16" /> {{ $t('common.back') }}
            </button>
            <div class="bank-preview-titles">
                <h1>{{ isReadOnly ? $t('bankPreview.committedTitle') : $t('bankPreview.title') }}</h1>
                <p>{{ isReadOnly ? $t('bankPreview.committedSubtitle') : $t('bankPreview.subtitle') }}</p>
            </div>
            <div v-if="!isReadOnly" class="bank-preview-counts">
                <span class="bank-preview-count bank-preview-count--selected">
                    {{ $t('bankPreview.summary.selected', { n: selectedCount, total: readyCount }) }}
                </span>
                <span v-if="needInputCount > 0" class="bank-preview-count bank-preview-count--attention">
                    {{ $t('bankPreview.summary.needInput', { n: needInputCount }) }}
                </span>
            </div>
            <span v-else class="bank-preview-count bank-preview-count--committed">
                {{ $t('bankBatches.status.committed') }}
            </span>
        </header>

        <section class="bank-preview-table-wrap">
            <table class="bank-preview-table">
                <thead>
                    <tr>
                        <th v-if="!isReadOnly" class="bank-preview-check">
                            <input
                                type="checkbox"
                                :checked="allReadySelected"
                                :indeterminate.prop="someReadySelected && !allReadySelected"
                                :disabled="readyCount === 0"
                                @change="toggleAll(($event.target as HTMLInputElement).checked)"
                            />
                        </th>
                        <th>{{ $t('bankPreview.cols.row') }}</th>
                        <th>{{ $t('bankPreview.cols.date') }}</th>
                        <th>{{ $t('bankPreview.cols.description') }}</th>
                        <th>{{ $t('bankPreview.cols.account') }}</th>
                        <th>{{ $t('bankPreview.cols.document') }}</th>
                        <th class="bank-preview-num">{{ $t('bankPreview.cols.amount') }}</th>
                        <th>{{ $t('bankPreview.cols.status') }}</th>
                        <th v-if="!isReadOnly">{{ $t('bankPreview.cols.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="draft in bank.drafts"
                        :key="draft.id"
                        class="bank-preview-row"
                        :class="{ 'bank-preview-row--attention': !isReadOnly && !draft.commitReady }"
                    >
                        <td v-if="!isReadOnly" class="bank-preview-check">
                            <input
                                type="checkbox"
                                :checked="selected.has(draft.id)"
                                :disabled="!draft.commitReady"
                                :title="draft.commitReady ? '' : $t(rowHint(draft))"
                                @change="toggleOne(draft.id, ($event.target as HTMLInputElement).checked)"
                            />
                        </td>
                        <td class="bank-preview-row-id">{{ shortRef(draft.sourceRef) }}</td>
                        <td>{{ formatDate(draft.date) }}</td>
                        <td class="bank-preview-desc">
                            <span v-if="draft.isInternalTransfer" class="bank-preview-badge">
                                {{ $t('bankPreview.internalTransfer') }}
                            </span>
                            {{ draft.description }}
                        </td>
                        <td class="bank-preview-account">{{ draft.recordAccount || '-' }}</td>
                        <td class="bank-preview-doc">
                            <button
                                v-if="!isReadOnly && draft.needsDocument"
                                class="bank-preview-docbtn bank-preview-docbtn--req"
                                @click="openDocModal(draft)"
                            >
                                {{ $t('bankPreview.doc.required') }}
                            </button>
                            <button
                                v-else-if="!isReadOnly && draft.documents && draft.documents.length"
                                class="bank-preview-docbtn"
                                @click="openDocModal(draft)"
                            >
                                {{ $t('bankPreview.doc.count', { n: draft.documents.length }) }}
                            </button>
                            <span
                                v-else-if="draft.documents && draft.documents.length"
                                class="bank-preview-doc-count"
                            >
                                {{ $t('bankPreview.doc.count', { n: draft.documents.length }) }}
                            </span>
                            <span v-else class="bank-preview-doc-na">-</span>
                        </td>
                        <td class="bank-preview-num">{{ formatAmount(draft.totalAmount) }}</td>
                        <td>
                            <span v-if="isReadOnly" class="bank-preview-pill bank-preview-pill--committed">
                                {{ $t('bankBatches.status.committed') }}
                            </span>
                            <span
                                v-else
                                class="bank-preview-pill"
                                :class="draft.commitReady ? 'bank-preview-pill--ready' : 'bank-preview-pill--attention'"
                            >
                                {{ draft.commitReady ? $t('bankPreview.ready') : $t('bankPreview.needsInput') }}
                            </span>
                        </td>
                        <td v-if="!isReadOnly">
                            <button class="bank-preview-fix" v-if="!draft.commitReady" @click="openEditor(draft)">
                                <Pencil :size="13" />
                                {{ $t('bankPreview.actions.fix') }}
                            </button>
                        </td>
                    </tr>
                    <tr v-if="bank.drafts.length === 0 && !bank.isLoading">
                        <td :colspan="isReadOnly ? 7 : 9" class="bank-preview-empty">{{ $t('bankPreview.empty') }}</td>
                    </tr>
                </tbody>
            </table>
        </section>

        <div v-if="bank.error" class="bank-preview-error">{{ bank.error }}</div>

        <footer v-if="!isReadOnly" class="bank-preview-footer">
            <span class="bank-preview-help">
                <template v-if="needInputCount > 0">{{ $t('bankPreview.summary.needInput', { n: needInputCount }) }}</template>
                <template v-else>{{ $t('bankPreview.summary.selected', { n: selectedCount, total: readyCount }) }}</template>
            </span>
            <span class="bank-preview-spacer" />
            <UiButton
                variant="primary"
                :loading="bank.isCommitting"
                :disabled="selectedCount === 0"
                @click="commit"
            >
                {{ bank.isCommitting ? $t('bankPreview.committing') : $t('bankPreview.commitSelected', { n: selectedCount }) }}
            </UiButton>
        </footer>

        <!-- Edit modal -->
        <UiModal v-model="editorOpen" :title="$t('bankPreview.editor.title')" max-width="480px" @close="closeEditor">
            <p class="modal-context">
                <strong>{{ editing && formatDate(editing.date) }}</strong> ·
                {{ editing && formatAmount(editing.totalAmount) }}
            </p>
            <p class="modal-desc">{{ editing && editing.description }}</p>

            <div class="modal-fields">
                <UiField
                    :label="$t('bankPreview.editor.accountCode')"
                    :hint="$t('bankPreview.editor.accountCodeHelp')"
                    v-model="editPatch.accountCode"
                    trim
                    placeholder="6010"
                />
                <UiField
                    :label="$t('bankPreview.editor.description')"
                    v-model="editPatch.description"
                    type="textarea"
                    :rows="2"
                />

                <div v-if="modalError" class="modal-error">{{ modalError }}</div>
            </div>

            <template #footer>
                <UiButton variant="ghost" @click="closeEditor">{{ $t('common.cancel') }}</UiButton>
                <UiButton variant="secondary" :disabled="!editPatch.accountCode" @click="learnRule">
                    {{ $t('bankPreview.editor.learnRule') }}
                </UiButton>
                <UiButton variant="primary" :loading="isSavingEdit" @click="saveEdit">
                    {{ $t('common.save') }}
                </UiButton>
            </template>
        </UiModal>

        <!-- Settlement document picker (§1.2). Recognized-in-purpose numbers
             one-click add; the counterparty's existing documents pick from the
             list; a new number can be created inline. One document settles the
             whole payment; several split it (amounts must sum to the payment). -->
        <UiModal v-model="docModalOpen" :title="$t('bankPreview.doc.title')" max-width="560px" @close="closeDocModal">
            <p class="modal-context">
                <strong>{{ docRow && formatDate(docRow.date) }}</strong> ·
                {{ docRow && formatAmount(docRow.totalAmount) }}
                <template v-if="docRow && docRow.counterpartyName"> · {{ docRow.counterpartyName }}</template>
            </p>
            <p class="doc-kind-note">{{ docRow && $t(`bankPreview.doc.kind.${docRow.documentKind}`) }}</p>

            <div
                v-if="docSuggestion && (docSuggestion.matched.length || docSuggestion.recognizedUnmatched.length)"
                class="doc-suggest"
            >
                <span class="doc-suggest-label">{{ $t('bankPreview.doc.recognized') }}</span>
                <div class="doc-suggest-chips">
                    <button v-for="m in docSuggestion.matched" :key="m.id" class="doc-chip" @click="addDoc(m)">
                        + {{ m.number }}
                    </button>
                    <button
                        v-for="u in docSuggestion.recognizedUnmatched"
                        :key="u.number"
                        class="doc-chip doc-chip--new"
                        @click="doCreate(u.number, '')"
                    >
                        + {{ u.number }}
                    </button>
                </div>
            </div>

            <div class="doc-pick">
                <label class="doc-pick-label">{{ $t('bankPreview.doc.pick') }}</label>
                <select class="doc-select" @change="onPickExisting">
                    <option value="">-</option>
                    <option v-for="d in docList" :key="d.id" :value="d.id">{{ d.number }}</option>
                </select>
            </div>

            <div class="doc-create">
                <input v-model="newDoc.number" :placeholder="$t('bankPreview.doc.newNumber')" class="doc-input" />
                <input
                    v-if="docRow && docRow.documentKind === 'invoice'"
                    v-model="newDoc.amount"
                    :placeholder="$t('bankPreview.doc.amount')"
                    class="doc-input doc-input--amt"
                    inputmode="decimal"
                />
                <UiButton variant="secondary" :disabled="!newDoc.number" @click="createNew">
                    {{ $t('bankPreview.doc.create') }}
                </UiButton>
            </div>

            <div v-if="allocations.length" class="doc-allocs">
                <div v-for="(a, i) in allocations" :key="a.documentId" class="doc-alloc">
                    <span class="doc-alloc-num">{{ a.number }}</span>
                    <input
                        v-if="allocations.length > 1"
                        v-model="a.amount"
                        class="doc-input doc-input--amt"
                        inputmode="decimal"
                    />
                    <span v-else class="doc-alloc-amt">{{ docRow && formatAmount(docRow.totalAmount) }}</span>
                    <button class="doc-alloc-remove" @click="removeAlloc(i)"><X :size="14" /></button>
                </div>
                <p v-if="allocations.length > 1" class="doc-sum" :class="{ 'doc-sum--bad': !allocationsValid }">
                    {{ $t('bankPreview.doc.sum', { sum: allocSum, total: docRow && docRow.totalAmount }) }}
                </p>
            </div>

            <div v-if="docError" class="modal-error">{{ docError }}</div>

            <template #footer>
                <UiButton variant="ghost" @click="closeDocModal">{{ $t('common.cancel') }}</UiButton>
                <UiButton
                    variant="primary"
                    :disabled="!allocations.length || !allocationsValid"
                    :loading="docSaving"
                    @click="applyDocs"
                >
                    {{ $t('bankPreview.doc.apply') }}
                </UiButton>
            </template>
        </UiModal>

        <!-- Commit result - shown after posting. Surfaces how many entries
             posted and how many were skipped (rows that still need a record
             account) rather than bouncing silently to the batch list. -->
        <UiModal v-model="resultOpen" :title="$t('bankPreview.result.title')" max-width="420px">
            <template v-if="commitResult">
                <div class="result-stat result-stat--committed">
                    <CheckCircle2 :size="18" />
                    <span>{{ $t('bankPreview.result.committed', { n: commitResult.committed }) }}</span>
                </div>
                <div v-if="commitResult.skipped > 0" class="result-stat result-stat--skipped">
                    <AlertTriangle :size="18" />
                    <span>{{ $t('bankPreview.result.skipped', { n: commitResult.skipped }) }}</span>
                </div>
                <p v-if="commitResult.skipped > 0" class="result-note">
                    {{ $t('bankPreview.result.skippedNote') }}
                </p>
                <p v-else class="result-note">{{ $t('bankPreview.result.allDone') }}</p>
            </template>
            <template #footer>
                <UiButton v-if="commitResult && commitResult.skipped > 0" variant="secondary" @click="reviewRemaining">
                    {{ $t('bankPreview.result.reviewRemaining') }}
                </UiButton>
                <UiButton variant="primary" @click="goToBatches">
                    {{ $t('bankPreview.result.done') }}
                </UiButton>
            </template>
        </UiModal>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, CheckCircle2, Pencil, X } from 'lucide-vue-next'
import { useBankStore } from '@/stores/bank'
import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiModal from '@/components/ui/UiModal.vue'

const route = useRoute()
const router = useRouter()
const bank = useBankStore()

const periodId = computed(() => route.params.periodId)
const uploadId = computed(() => route.params.uploadId)
// ?status=committed → this batch is already posted; render read-only.
const isReadOnly = computed(() => route.query.status === 'committed')

const editing = ref(null)
const editPatch = ref({ accountCode: '', description: '' })
const isSavingEdit = ref(false)
const modalError = ref('')

// Which drafts the operator has ticked to post (§1.3). Holds entry ids; only
// commit-ready rows can be in here. Defaults to every commit-ready row after
// each load, so the common case (all rows recognized) is one click.
const selected = ref(new Set())

function initSelection() {
    const next = new Set()
    for (const d of bank.drafts) {
        if (d.commitReady) next.add(d.id)
    }
    selected.value = next
}

// UiModal takes a boolean v-model. Bridge it to the existing `editing` source
// of truth so Esc / backdrop close routes through closeEditor().
const editorOpen = computed({
    get: () => !!editing.value,
    set: (v) => { if (!v) closeEditor() },
})

onMounted(async () => {
    await bank.fetchDrafts({
        periodId: periodId.value,
        uploadId: uploadId.value,
        status: isReadOnly.value ? 'committed' : undefined,
    })
    initSelection()
})

// Row-level counters drive the header + footer summary (no traffic light).
const readyCount = computed(() => bank.drafts.filter((d) => d.commitReady).length)
const needInputCount = computed(() => bank.drafts.filter((d) => !d.commitReady).length)
const selectedCount = computed(() => {
    let n = 0
    for (const d of bank.drafts) if (selected.value.has(d.id)) n++
    return n
})
const allReadySelected = computed(() => readyCount.value > 0 && selectedCount.value === readyCount.value)
const someReadySelected = computed(() => selectedCount.value > 0)

// Why a row can't be ticked - reused as the checkbox tooltip.
function rowHint(draft) {
    return draft?.needsAccount ? 'bankPreview.pickAccount' : 'bankPreview.needsInput'
}

function toggleOne(id, checked) {
    const next = new Set(selected.value)
    if (checked) next.add(id)
    else next.delete(id)
    selected.value = next
}
function toggleAll(checked) {
    const next = new Set()
    if (checked) {
        for (const d of bank.drafts) if (d.commitReady) next.add(d.id)
    }
    selected.value = next
}

function openEditor(draft) {
    editing.value = draft
    editPatch.value = { accountCode: '', description: draft.description || '' }
    modalError.value = ''
}
function closeEditor() {
    editing.value = null
    modalError.value = ''
}
async function saveEdit() {
    if (!editing.value) return
    modalError.value = ''
    isSavingEdit.value = true
    try {
        await bank.updateDraft({
            periodId: periodId.value,
            uploadId: uploadId.value,
            entryId: editing.value.id,
            patch: {
                accountCode: editPatch.value.accountCode || undefined,
                description: editPatch.value.description || undefined,
            },
        })
        await bank.fetchDrafts({ periodId: periodId.value, uploadId: uploadId.value })
        initSelection()
        closeEditor()
    } catch (err) {
        modalError.value = err?.response?.data?.message || err?.message || 'Save failed'
    } finally {
        isSavingEdit.value = false
    }
}

async function learnRule() {
    if (!editing.value || !editPatch.value.accountCode) return
    modalError.value = ''
    try {
        // Use the source description as the pattern; operator can refine later via admin UI.
        const pattern = editing.value.description?.slice(0, 200) || ''
        await bank.learnRule({
            periodId: periodId.value,
            uploadId: uploadId.value,
            entryId: editing.value.id,
            rule: {
                pattern,
                recordAccountCode: editPatch.value.accountCode,
                kind: 'keyword',
            },
        })
        modalError.value = ''
    } catch (err) {
        modalError.value = err?.response?.data?.message || err?.message || 'Learn rule failed'
    }
}

// ─── Settlement document picker (§1.2) ───────────────────────────────────────
const docRow = ref(null)          // the draft being documented
const docSuggestion = ref(null)   // { matched, recognizedUnmatched } from suggest
const docList = ref([])           // counterparty's existing documents
const allocations = ref([])       // { documentId, documentType, number, amount }
const newDoc = ref({ number: '', amount: '' })
const docError = ref('')
const docSaving = ref(false)

const docModalOpen = computed({
    get: () => !!docRow.value,
    set: (v) => { if (!v) closeDocModal() },
})

async function openDocModal(draft) {
    docRow.value = draft
    docError.value = ''
    newDoc.value = { number: '', amount: '' }
    docSuggestion.value = null
    docList.value = []
    allocations.value = []
    if (!draft.counterpartyId) return
    try {
        const [sug, list] = await Promise.all([
            bank.suggestCounterpartyDocuments(draft.counterpartyId, draft.documentKind, draft.description),
            bank.fetchCounterpartyDocuments(draft.counterpartyId, draft.documentKind),
        ])
        docSuggestion.value = sug
        docList.value = list
        // Seed from already-attached documents (re-edit), resolving numbers
        // from the freshly-loaded list.
        allocations.value = (draft.documents || []).map((d) => {
            const doc = list.find((x) => x.id === d.documentId)
            return {
                documentId: d.documentId,
                documentType: d.documentType,
                number: doc?.number || d.documentId.slice(-6),
                amount: d.amount,
            }
        })
    } catch (_) {
        // leave the modal usable with manual create even if suggest/list fail
    }
}
function closeDocModal() {
    docRow.value = null
    docError.value = ''
}

function addDoc(doc) {
    if (allocations.value.some((a) => a.documentId === doc.id)) return
    allocations.value.push({
        documentId: doc.id,
        documentType: doc.kind || docRow.value.documentKind,
        number: doc.number,
        amount: '',
    })
}
function onPickExisting(e) {
    const id = e.target.value
    e.target.value = ''
    if (!id) return
    const doc = docList.value.find((d) => d.id === id)
    if (doc) addDoc(doc)
}
async function createNew() {
    await doCreate(newDoc.value.number, newDoc.value.amount)
}
async function doCreate(number, amount) {
    if (!docRow.value?.counterpartyId || !number) return
    docError.value = ''
    try {
        const payload = { kind: docRow.value.documentKind, number }
        if (docRow.value.documentKind === 'invoice' && amount) payload.amount = amount
        const doc = await bank.createCounterpartyDocument(docRow.value.counterpartyId, payload)
        if (!docList.value.some((d) => d.id === doc.id)) docList.value.push(doc)
        addDoc(doc)
        newDoc.value = { number: '', amount: '' }
    } catch (err) {
        docError.value = err?.response?.data?.message || err?.message || 'Create failed'
    }
}
function removeAlloc(i) {
    allocations.value.splice(i, 1)
}

const allocSum = computed(() => {
    let s = 0
    for (const a of allocations.value) s += parseFloat(a.amount || '0') || 0
    // Trim trailing .0 noise for display; backend validates precisely.
    return Number.isInteger(s) ? String(s) : String(s)
})
const allocationsValid = computed(() => {
    if (allocations.value.length === 0) return false
    if (allocations.value.length === 1) return true
    const total = parseFloat(docRow.value?.totalAmount || '0')
    const everyHasAmount = allocations.value.every((a) => a.amount && parseFloat(a.amount) > 0)
    return everyHasAmount && Math.abs(parseFloat(allocSum.value) - total) < 0.005
})

async function applyDocs() {
    if (!docRow.value || !allocationsValid.value) return
    docSaving.value = true
    docError.value = ''
    try {
        // Single doc → send without amount (backend allocates the full payment).
        // Multiple → send per-document amounts (backend re-checks the sum).
        const documents = allocations.value.length === 1
            ? [{ documentType: allocations.value[0].documentType, documentId: allocations.value[0].documentId }]
            : allocations.value.map((a) => ({
                documentType: a.documentType,
                documentId: a.documentId,
                amount: a.amount,
            }))
        await bank.updateDraft({
            periodId: periodId.value,
            uploadId: uploadId.value,
            entryId: docRow.value.id,
            patch: { documents },
        })
        await bank.fetchDrafts({ periodId: periodId.value, uploadId: uploadId.value })
        initSelection()
        closeDocModal()
    } catch (err) {
        docError.value = err?.response?.data?.message || err?.message || 'Save failed'
    } finally {
        docSaving.value = false
    }
}

// Holds the commit outcome ({ committed, skipped, rolledUpKeys }) so the
// operator gets a confirmation with counts - including how many rows were
// skipped - instead of a silent redirect.
const commitResult = ref(null)

// Bridge UiModal's boolean v-model; closing (Esc/backdrop) just dismisses the
// summary and stays on the page - the explicit "Done" button routes away.
const resultOpen = computed({
    get: () => !!commitResult.value,
    set: (v) => { if (!v) commitResult.value = null },
})

async function commit() {
    if (selectedCount.value === 0) return
    try {
        // Post only the ticked rows (§1.3). Backend still guards against any
        // not-ready id, so a stale selection can never post a '000' row.
        const entryIds = bank.drafts.filter((d) => selected.value.has(d.id)).map((d) => d.id)
        const result = await bank.commit({ periodId: periodId.value, uploadId: uploadId.value, entryIds })
        commitResult.value = {
            committed: result?.committed ?? 0,
            skipped: result?.skipped ?? 0,
            rolledUpKeys: result?.rolledUpKeys ?? 0,
        }
    } catch (_) {
        // bank.error already populated; renders inline.
    }
}

function goToBatches() {
    router.push(`/app/ledger/periods/${periodId.value}/bank-batches`)
}

// After posting, reload so any rows the operator still needs to fix reappear
// with fresh readiness, and re-seed the selection.
async function reviewRemaining() {
    commitResult.value = null
    await bank.fetchDrafts({ periodId: periodId.value, uploadId: uploadId.value })
    initSelection()
}

function back() { router.push(`/app/ledger/periods/${periodId.value}/bank-batches`) }
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
.bank-preview { max-width: 1200px; margin: 0 auto; padding: 24px; }
.bank-preview-header {
    display: flex; align-items: center; gap: 24px;
    margin-bottom: 20px; flex-wrap: wrap;
}
.bank-preview-back {
    background: transparent; border: none; color: var(--ws-text-3); cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem;
}
.bank-preview-titles { flex: 1; }
.bank-preview-titles h1 { font-size: 1.3rem; font-weight: 600; color: var(--ws-text); margin-bottom: 4px; }
.bank-preview-titles p { font-size: 0.88rem; color: var(--ws-text-3); }
.bank-preview-counts { display: flex; gap: 8px; }
.bank-preview-count {
    padding: 6px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
}
/* No traffic light (§1.3): a neutral "selected" chip + a single amber
   "needs input" chip. Amber is the one accent used for anything unfinished. */
.bank-preview-count--selected { background: var(--ws-surface-2); color: var(--ws-text-2); }
.bank-preview-count--attention { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.bank-preview-count--committed { background: rgba(72, 187, 120, 0.15); color: #2f855a; }

.bank-preview-table-wrap {
    background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 12px; overflow-x: auto;
}
.bank-preview-table {
    width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.86rem;
}
.bank-preview-table th {
    text-align: left; padding: 10px 12px; font-weight: 600; color: var(--ws-text-3);
    border-bottom: 1px solid var(--ws-border); background: var(--ws-surface-2);
}
.bank-preview-table th.bank-preview-num,
.bank-preview-table td.bank-preview-num { text-align: right; font-variant-numeric: tabular-nums; }
.bank-preview-table td {
    padding: 10px 12px; border-bottom: 1px solid var(--ws-border); color: var(--ws-text);
}
.bank-preview-check { width: 36px; text-align: center; }
.bank-preview-check input { cursor: pointer; width: 15px; height: 15px; accent-color: var(--ws-purple); }
.bank-preview-check input:disabled { cursor: not-allowed; opacity: 0.5; }
/* Amber left-accent marks a row that isn't ready to post. */
.bank-preview-row--attention { background: rgba(237, 137, 54, 0.05); box-shadow: inset 3px 0 0 #ed8936; }
.bank-preview-row-id { font-family: monospace; font-size: 0.78rem; color: var(--ws-text-3); }
.bank-preview-desc {
    max-width: 380px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bank-preview-badge {
    display: inline-block; padding: 1px 7px; margin-right: 6px; border-radius: 999px;
    font-size: 0.68rem; font-weight: 600; white-space: nowrap;
    background: rgba(124, 58, 237, 0.15); color: var(--ws-purple);
}
.bank-preview-pill {
    padding: 2px 8px; border-radius: 999px; font-size: 0.74rem; font-weight: 600;
}
.bank-preview-pill--ready { background: var(--ws-surface-2); color: var(--ws-text-2); }
.bank-preview-pill--attention { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.bank-preview-pill--committed { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.bank-preview-account { font-family: monospace; font-size: 0.82rem; color: var(--ws-text-2); }
.bank-preview-fix {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
    background: transparent; border: 1px solid var(--ws-border); border-radius: 6px;
    color: var(--ws-text); font-size: 0.78rem; cursor: pointer;
}
.bank-preview-fix:hover { background: var(--ws-surface-2); }
.bank-preview-empty { text-align: center; padding: 40px 16px; color: var(--ws-text-3); }
.bank-preview-error {
    margin-top: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.bank-preview-footer {
    display: flex; align-items: center; gap: 16px; margin-top: 20px;
    background: var(--ws-surface-2); padding: 12px 16px; border-radius: 10px;
}
.bank-preview-help { font-size: 0.84rem; color: var(--ws-text-3); }
.bank-preview-spacer { flex: 1; }

/* Edit-modal body bits (scaffolding now provided by UiModal/UiField/UiButton). */
.modal-fields { display: flex; flex-direction: column; gap: 14px; }
.modal-context { font-size: 0.85rem; color: var(--ws-text-3); }
.modal-desc {
    font-size: 0.85rem; color: var(--ws-text); background: var(--ws-surface-2);
    padding: 10px; border-radius: 8px; white-space: pre-wrap; word-break: break-word;
}
.modal-error {
    padding: 8px 10px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 6px; font-size: 0.82rem;
}

/* ─── Document column + picker modal (§1.2) ───────────────────────────────── */
.bank-preview-doc { white-space: nowrap; }
.bank-preview-docbtn {
    display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px;
    background: transparent; border: 1px solid var(--ws-border); border-radius: 6px;
    color: var(--ws-text-2); font-size: 0.76rem; cursor: pointer;
}
.bank-preview-docbtn:hover { background: var(--ws-surface-2); }
.bank-preview-docbtn--req {
    border-color: rgba(237, 137, 54, 0.5); background: rgba(237, 137, 54, 0.1); color: #c05621;
}
.bank-preview-doc-count { font-size: 0.78rem; color: var(--ws-text-2); }
.bank-preview-doc-na { color: var(--ws-text-3); }

.doc-kind-note { font-size: 0.8rem; color: var(--ws-text-3); margin: -4px 0 12px; }
.doc-suggest { margin-bottom: 14px; }
.doc-suggest-label { font-size: 0.78rem; color: var(--ws-text-3); display: block; margin-bottom: 6px; }
.doc-suggest-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.doc-chip {
    padding: 3px 10px; border-radius: 999px; font-size: 0.78rem; cursor: pointer;
    background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3);
    color: var(--ws-purple); font-weight: 600;
}
.doc-chip--new { background: var(--ws-surface-2); border-color: var(--ws-border); color: var(--ws-text-2); }
.doc-pick { margin-bottom: 12px; }
.doc-pick-label { font-size: 0.8rem; color: var(--ws-text-2); display: block; margin-bottom: 4px; }
.doc-select {
    width: 100%; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--ws-border); background: var(--ws-surface); color: var(--ws-text);
    font-size: 0.85rem;
}
.doc-create { display: flex; gap: 8px; margin-bottom: 14px; }
.doc-input {
    flex: 1; padding: 8px 10px; border-radius: 8px;
    border: 1px solid var(--ws-border); background: var(--ws-surface); color: var(--ws-text);
    font-size: 0.85rem;
}
.doc-input--amt { flex: 0 0 130px; text-align: right; font-variant-numeric: tabular-nums; }
.doc-allocs {
    border-top: 1px solid var(--ws-border); padding-top: 12px; display: flex; flex-direction: column; gap: 8px;
}
.doc-alloc { display: flex; align-items: center; gap: 10px; }
.doc-alloc-num { flex: 1; font-family: monospace; font-size: 0.82rem; color: var(--ws-text); }
.doc-alloc-amt { flex: 0 0 130px; text-align: right; font-variant-numeric: tabular-nums; color: var(--ws-text-2); }
.doc-alloc-remove {
    background: transparent; border: none; cursor: pointer; color: var(--ws-text-3);
    display: inline-flex; padding: 2px;
}
.doc-alloc-remove:hover { color: #c53030; }
.doc-sum { font-size: 0.82rem; color: var(--ws-text-3); text-align: right; margin: 2px 0 0; }
.doc-sum--bad { color: #c53030; font-weight: 600; }

/* ─── Commit result modal body ────────────────────────────────────────────── */
.result-stat {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 13px; border-radius: 8px; font-size: 0.92rem; font-weight: 500;
    margin-bottom: 10px;
}
.result-stat--committed { background: rgba(72, 187, 120, 0.12); color: #2f855a; }
.result-stat--skipped { background: rgba(237, 137, 54, 0.12); color: #b7791f; }
.result-note { font-size: 0.84rem; color: var(--ws-text-3); margin: 4px 0 0; line-height: 1.5; }
</style>
