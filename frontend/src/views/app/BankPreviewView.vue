<!-- frontend/src/views/app/BankPreviewView.vue
     The signature UX of the bank engine — bank ТЗ §7's "Экран
     предпросмотра". Draft journal entries grouped by preview color:
       GREEN  — fully recognized, will commit as-is.
       YELLOW — auto-created counterparty needs operator verification.
       RED    — unrecognized treasury / missing record account; operator
                must pick an account before commit.
     RED rows are skipped on commit until fixed. Operators can also click
     "Add to rules" after fixing a RED to teach the next pass. -->
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
                <span class="bank-preview-count bank-preview-count--green">
                    {{ countByColor.green }} {{ $t('bankPreview.colors.green') }}
                </span>
                <span class="bank-preview-count bank-preview-count--yellow">
                    {{ countByColor.yellow }} {{ $t('bankPreview.colors.yellow') }}
                </span>
                <span class="bank-preview-count bank-preview-count--red">
                    {{ countByColor.red }} {{ $t('bankPreview.colors.red') }}
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
                        <th>{{ $t('bankPreview.cols.row') }}</th>
                        <th>{{ $t('bankPreview.cols.date') }}</th>
                        <th>{{ $t('bankPreview.cols.description') }}</th>
                        <th>{{ $t('bankPreview.cols.account') }}</th>
                        <th class="bank-preview-num">{{ $t('bankPreview.cols.amount') }}</th>
                        <th>{{ $t('bankPreview.cols.status') }}</th>
                        <th v-if="!isReadOnly">{{ $t('bankPreview.cols.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="draft in bank.drafts" :key="draft.id" :class="`bank-preview-row bank-preview-row--${rowColor(draft)}`">
                        <td class="bank-preview-row-id">{{ shortRef(draft.sourceRef) }}</td>
                        <td>{{ formatDate(draft.date) }}</td>
                        <td class="bank-preview-desc">{{ draft.description }}</td>
                        <td class="bank-preview-account">{{ draft.recordAccount || '—' }}</td>
                        <td class="bank-preview-num">{{ formatAmount(draft.totalAmount) }}</td>
                        <td>
                            <span v-if="isReadOnly" class="bank-preview-pill bank-preview-pill--committed">
                                {{ $t('bankBatches.status.committed') }}
                            </span>
                            <span v-else :class="`bank-preview-pill bank-preview-pill--${rowColor(draft)}`">
                                {{ $t(`bankPreview.colors.${rowColor(draft)}`) }}
                            </span>
                        </td>
                        <td v-if="!isReadOnly">
                            <button class="bank-preview-fix" v-if="rowColor(draft) !== 'green'" @click="openEditor(draft)">
                                <Pencil :size="13" />
                                {{ $t('bankPreview.actions.fix') }}
                            </button>
                        </td>
                    </tr>
                    <tr v-if="bank.drafts.length === 0 && !bank.isLoading">
                        <td :colspan="isReadOnly ? 6 : 7" class="bank-preview-empty">{{ $t('bankPreview.empty') }}</td>
                    </tr>
                </tbody>
            </table>
        </section>

        <div v-if="bank.error" class="bank-preview-error">{{ bank.error }}</div>

        <footer v-if="!isReadOnly" class="bank-preview-footer">
            <span class="bank-preview-help">{{ $t('bankPreview.commitHelp', { red: countByColor.red }) }}</span>
            <span class="bank-preview-spacer" />
            <button
                class="btn-primary"
                :disabled="bank.isCommitting || bank.drafts.length === 0"
                @click="commit"
            >
                {{ bank.isCommitting ? $t('bankPreview.committing') : $t('bankPreview.commitButton') }}
            </button>
        </footer>

        <!-- Edit modal -->
        <Transition name="modal-fade">
            <div v-if="editing" class="modal-backdrop" @click.self="closeEditor">
                <div class="modal-card">
                    <header class="modal-header">
                        <h2>{{ $t('bankPreview.editor.title') }}</h2>
                        <button class="modal-close" @click="closeEditor">
                            <X :size="18" />
                        </button>
                    </header>
                    <div class="modal-body">
                        <p class="modal-context">
                            <strong>{{ formatDate(editing.date) }}</strong> ·
                            {{ formatAmount(editing.totalAmount) }}
                        </p>
                        <p class="modal-desc">{{ editing.description }}</p>

                        <label class="modal-field">
                            <span>{{ $t('bankPreview.editor.accountCode') }}</span>
                            <input v-model.trim="editPatch.accountCode" class="modal-input" placeholder="6010" />
                            <span class="modal-help">{{ $t('bankPreview.editor.accountCodeHelp') }}</span>
                        </label>

                        <label class="modal-field">
                            <span>{{ $t('bankPreview.editor.description') }}</span>
                            <textarea v-model="editPatch.description" rows="2" class="modal-input" />
                        </label>

                        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
                    </div>
                    <footer class="modal-footer">
                        <button class="btn-ghost" @click="closeEditor">{{ $t('common.cancel') }}</button>
                        <button class="btn-secondary" @click="learnRule" :disabled="!editPatch.accountCode">
                            {{ $t('bankPreview.editor.learnRule') }}
                        </button>
                        <button class="btn-primary" @click="saveEdit" :disabled="isSavingEdit">
                            {{ isSavingEdit ? $t('common.loading') : $t('common.save') }}
                        </button>
                    </footer>
                </div>
            </div>
        </Transition>

        <!-- Commit result — shown after "Provести выписку". Surfaces how many
             entries posted and how many were skipped (RED rows that still need
             a record account) rather than bouncing silently to the batch list. -->
        <Transition name="modal-fade">
            <div v-if="commitResult" class="modal-backdrop" @click.self="goToBatches">
                <div class="modal-card modal-card--result">
                    <header class="modal-header">
                        <h2>{{ $t('bankPreview.result.title') }}</h2>
                        <button class="modal-close" @click="goToBatches">
                            <X :size="18" />
                        </button>
                    </header>
                    <div class="modal-body">
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
                    </div>
                    <footer class="modal-footer">
                        <button v-if="commitResult.skipped > 0" class="btn-secondary" @click="reviewRemaining">
                            {{ $t('bankPreview.result.reviewRemaining') }}
                        </button>
                        <button class="btn-primary" @click="goToBatches">
                            {{ $t('bankPreview.result.done') }}
                        </button>
                    </footer>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, ArrowLeft, CheckCircle2, Pencil, X } from 'lucide-vue-next'
import { useBankStore } from '@/stores/bank'

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

onMounted(async () => {
    await bank.fetchDrafts({
        periodId: periodId.value,
        uploadId: uploadId.value,
        status: isReadOnly.value ? 'committed' : undefined,
    })
})

/**
 * Color now comes from the backend (`draft.color`) — the list endpoint
 * derives it server-side by joining lines + counterparty.createdFromBankRow.
 * The fallback to GREEN handles drafts cached pre-deploy (no field set).
 */
function rowColor(draft) {
    return draft?.color || 'green'
}

const countByColor = computed(() => {
    const out = { green: 0, yellow: 0, red: 0 }
    for (const d of bank.drafts) out[rowColor(d)]++
    return out
})

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

// Holds the commit outcome ({ committed, skipped, rolledUpKeys }) so the
// operator gets a confirmation with counts — including how many RED rows were
// skipped — instead of a silent redirect.
const commitResult = ref(null)

async function commit() {
    try {
        const result = await bank.commit({ periodId: periodId.value, uploadId: uploadId.value })
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

// Skipped rows are still drafts (RED, account '000'). Reload the batch so the
// operator can fix and re-commit them without leaving the screen.
async function reviewRemaining() {
    commitResult.value = null
    await bank.fetchDrafts({ periodId: periodId.value, uploadId: uploadId.value })
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
.bank-preview-count--green { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.bank-preview-count--yellow { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.bank-preview-count--red { background: rgba(245, 101, 101, 0.15); color: #c53030; }
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
.bank-preview-row--red { background: rgba(245, 101, 101, 0.04); }
.bank-preview-row--yellow { background: rgba(237, 137, 54, 0.04); }
.bank-preview-row-id { font-family: monospace; font-size: 0.78rem; color: var(--ws-text-3); }
.bank-preview-desc {
    max-width: 380px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bank-preview-pill {
    padding: 2px 8px; border-radius: 999px; font-size: 0.74rem; font-weight: 600;
}
.bank-preview-pill--green { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.bank-preview-pill--yellow { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.bank-preview-pill--red { background: rgba(245, 101, 101, 0.15); color: #c53030; }
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
/* NOTE: global .btn-primary/.btn-ghost/.btn-secondary (App.vue + main.css)
   are landing-page styles that leak in here via @layer/@apply. We pin the
   properties they fight over: hover text color (their text-gray-* would go
   invisible on our dark surfaces) and transform (App.vue's .btn-primary
   carries hover:scale-105, which we don't want on a modal action button). */
.btn-primary {
    background: var(--ws-purple); color: #fff; padding: 10px 18px; border-radius: 8px;
    border: none; font-weight: 500; cursor: pointer;
    transform: none !important; box-shadow: none !important;
}
.btn-primary:hover:not(:disabled) { background: #6D28D9; color: #fff !important; transform: none !important; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost {
    background: transparent; color: var(--ws-text); border: 1px solid var(--ws-border);
    padding: 10px 18px; border-radius: 8px; cursor: pointer;
    transform: none !important;
}
.btn-ghost:hover { background: var(--ws-surface-2); color: var(--ws-text) !important; }
.btn-secondary {
    background: var(--ws-surface); color: var(--ws-purple); border: 1px solid var(--ws-purple);
    padding: 10px 18px; border-radius: 8px; cursor: pointer;
    transform: none !important;
}
.btn-secondary::after { display: none !important; }
.btn-secondary:hover:not(:disabled) { background: rgba(124, 58, 237, 0.04); color: var(--ws-purple) !important; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Modal */
.modal-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: center; justify-content: center; z-index: 90;
}
.modal-card {
    background: var(--ws-surface); border-radius: 14px;
    width: 100%; max-width: 480px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}
.modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--ws-border);
}
.modal-header h2 { font-size: 1.05rem; font-weight: 600; }
.modal-close { background: transparent; border: none; cursor: pointer; color: var(--ws-text-3); }
.modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.modal-context { font-size: 0.85rem; color: var(--ws-text-3); }
.modal-desc {
    font-size: 0.85rem; color: var(--ws-text); background: var(--ws-surface-2);
    padding: 10px; border-radius: 8px; white-space: pre-wrap; word-break: break-word;
}
.modal-field { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; }
.modal-field > span { color: var(--ws-text-2); font-weight: 500; }
.modal-input {
    padding: 9px 11px; border: 1px solid var(--ws-border); border-radius: 8px;
    font-size: 0.9rem;
    background: var(--ws-surface-2); color: var(--ws-text);
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
    font-family: inherit; resize: vertical;
}
.modal-input::placeholder { color: var(--ws-text-3); }
.modal-input:hover:not(:focus) { border-color: rgba(124, 58, 237, 0.25); }
.modal-input:focus { border-color: var(--ws-purple); box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15); }
.modal-help { font-size: 0.76rem; color: var(--ws-text-3); }
.modal-error {
    padding: 8px 10px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 6px; font-size: 0.82rem;
}
.modal-footer {
    display: flex; gap: 8px; justify-content: flex-end;
    padding: 14px 20px; border-top: 1px solid var(--ws-border);
}
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* ─── Commit result modal ─────────────────────────────────────────────────── */
.modal-card--result { max-width: 420px; }
.result-stat {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 13px; border-radius: 8px; font-size: 0.92rem; font-weight: 500;
    margin-bottom: 10px;
}
.result-stat--committed { background: rgba(72, 187, 120, 0.12); color: #2f855a; }
.result-stat--skipped { background: rgba(237, 137, 54, 0.12); color: #b7791f; }
.result-note { font-size: 0.84rem; color: var(--ws-text-3); margin: 4px 0 0; line-height: 1.5; }
</style>