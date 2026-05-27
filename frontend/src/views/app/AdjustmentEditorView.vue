<!-- frontend/src/views/app/AdjustmentEditorView.vue
     Multi-line balanced-entry form for adjustments. Each row is one Dt or
     Cr leg; the editor enforces sum(debits) == sum(credits) at the UI
     before submission (backend enforces it too).

     Two modes:
       /app/ledger/periods/:periodId/adjustments/new
         — blank form, calls createDraft.
       /app/ledger/adjustments/:entryId
         — view existing, with commit / reverse actions when applicable. -->
<template>
    <div class="adj-editor">
        <header class="adj-editor-header">
            <button class="back-btn" @click="back">
                <ArrowLeft :size="16" /> {{ $t('common.back') }}
            </button>
            <h1>{{ isExisting ? $t('adjustments.editor.titleView') : $t('adjustments.editor.titleNew') }}</h1>
        </header>

        <section class="adj-editor-card">
            <!-- Meta -->
            <div class="adj-editor-meta">
                <label>
                    <span>{{ $t('adjustments.editor.date') }}</span>
                    <input v-model="form.date" type="date" :disabled="!isEditable" />
                </label>
                <label>
                    <span>{{ $t('adjustments.editor.standard') }}</span>
                    <select v-model="form.standard" :disabled="!isEditable">
                        <option v-for="std in standards" :key="std" :value="std">{{ std }}</option>
                    </select>
                </label>
                <label class="adj-editor-meta--wide">
                    <span>{{ $t('adjustments.editor.reason') }}</span>
                    <textarea v-model="form.reason" rows="2" :disabled="!isEditable" />
                </label>
                <label>
                    <span>{{ $t('adjustments.editor.taxEffect') }}</span>
                    <input v-model="form.taxEffectAmount" type="text" inputmode="decimal" :disabled="!isEditable" placeholder="0" />
                </label>
                <label class="adj-editor-meta--wide">
                    <span>{{ $t('adjustments.editor.disclosure') }}</span>
                    <textarea v-model="form.disclosureText" rows="3" :disabled="!isEditable" />
                </label>
            </div>

            <!-- Lines -->
            <div class="adj-editor-lines">
                <table class="adj-editor-table">
                    <thead>
                        <tr>
                            <th>{{ $t('adjustments.editor.cols.account') }}</th>
                            <th>{{ $t('adjustments.editor.cols.direction') }}</th>
                            <th class="adj-editor-num">{{ $t('adjustments.editor.cols.amount') }}</th>
                            <th>{{ $t('adjustments.editor.cols.description') }}</th>
                            <th v-if="isEditable" />
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(line, i) in form.lines" :key="i">
                            <td><input v-model.trim="line.accountCode" :disabled="!isEditable" placeholder="6010" /></td>
                            <td>
                                <select v-model="line.direction" :disabled="!isEditable">
                                    <option value="debit">Dt</option>
                                    <option value="credit">Cr</option>
                                </select>
                            </td>
                            <td class="adj-editor-num">
                                <input v-model="line.amount" :disabled="!isEditable" type="text" inputmode="decimal" placeholder="0" />
                            </td>
                            <td><input v-model="line.description" :disabled="!isEditable" /></td>
                            <td v-if="isEditable">
                                <button v-if="form.lines.length > 2" class="adj-editor-remove" @click="removeLine(i)">
                                    <X :size="14" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <button v-if="isEditable" class="adj-editor-add" @click="addLine">
                    <Plus :size="14" /> {{ $t('adjustments.editor.addLine') }}
                </button>
                <div class="adj-editor-totals">
                    <div>
                        <span class="adj-editor-totals-label">{{ $t('adjustments.editor.totalDebit') }}</span>
                        <span class="adj-editor-totals-value">{{ totalDebit }}</span>
                    </div>
                    <div>
                        <span class="adj-editor-totals-label">{{ $t('adjustments.editor.totalCredit') }}</span>
                        <span class="adj-editor-totals-value">{{ totalCredit }}</span>
                    </div>
                    <div :class="['adj-editor-balance', balanced ? 'is-balanced' : 'is-unbalanced']">
                        {{ balanced
                            ? $t('adjustments.editor.balanced')
                            : $t('adjustments.editor.unbalanced', { diff: balanceDiff }) }}
                    </div>
                </div>
            </div>

            <div v-if="errorMessage" class="adj-error">{{ errorMessage }}</div>

            <footer class="adj-editor-footer">
                <button class="btn-ghost" @click="back">{{ $t('common.cancel') }}</button>
                <span class="adj-editor-spacer" />
                <!-- Reverse (committed only) -->
                <button v-if="isExisting && current?.status === 'committed' && !current?.reversesEntryId"
                    class="btn-secondary" @click="reverseEntry" :disabled="adjustments.isSubmitting">
                    {{ $t('adjustments.editor.reverse') }}
                </button>
                <!-- Commit (draft only) -->
                <button v-if="isExisting && current?.status === 'draft'"
                    class="btn-primary" @click="commitEntry" :disabled="adjustments.isSubmitting">
                    {{ $t('adjustments.editor.commit') }}
                </button>
                <!-- Save (new) -->
                <button v-if="!isExisting" class="btn-primary" :disabled="!canSubmit || adjustments.isSubmitting"
                    @click="saveDraft">
                    {{ adjustments.isSubmitting ? $t('common.loading') : $t('adjustments.editor.saveDraft') }}
                </button>
            </footer>
        </section>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus, X } from 'lucide-vue-next'
import { useAdjustmentsStore } from '@/stores/adjustments'

const route = useRoute()
const router = useRouter()
const adjustments = useAdjustmentsStore()

const standards = ['IAS 16', 'IFRS 16', 'IFRS 9', 'IFRS 15', 'IAS 12']

const isExisting = computed(() => !!route.params.entryId)
const periodId = computed(() => route.params.periodId)
const entryId = computed(() => route.params.entryId)

const current = computed(() => adjustments.current)
const isEditable = computed(() => !isExisting.value)

const errorMessage = ref('')

const form = reactive({
    date: new Date().toISOString().slice(0, 10),
    standard: 'IAS 16',
    reason: '',
    taxEffectAmount: '0',
    disclosureText: '',
    lines: [
        { accountCode: '', direction: 'debit', amount: '0', description: '' },
        { accountCode: '', direction: 'credit', amount: '0', description: '' },
    ],
})

onMounted(async () => {
    if (isExisting.value) {
        await adjustments.fetchOne(entryId.value)
        const c = adjustments.current
        if (c) {
            form.date = new Date(c.date).toISOString().slice(0, 10)
            form.standard = c.adjustmentMeta?.standard || 'IAS 16'
            form.reason = c.adjustmentMeta?.reason || ''
            form.taxEffectAmount = c.adjustmentMeta?.taxEffectAmount || '0'
            form.disclosureText = c.adjustmentMeta?.disclosureText || ''
            form.lines = (adjustments.currentLines || []).map((l) => ({
                accountCode: l.accountCode,
                direction: l.direction,
                amount: l.amount,
                description: l.description || '',
            }))
        }
    }
})

function addLine() {
    form.lines.push({ accountCode: '', direction: 'debit', amount: '0', description: '' })
}
function removeLine(i) {
    form.lines.splice(i, 1)
}

const totalDebit = computed(() => sumByDir('debit'))
const totalCredit = computed(() => sumByDir('credit'))
const balanced = computed(() => totalDebit.value === totalCredit.value && totalDebit.value !== '0')
const balanceDiff = computed(() => {
    const d = parseFloat(totalDebit.value || '0')
    const c = parseFloat(totalCredit.value || '0')
    return (d - c).toString()
})
const canSubmit = computed(() => balanced.value && form.reason.trim().length > 0)

function sumByDir(direction) {
    let sum = 0
    for (const l of form.lines) {
        if (l.direction === direction) {
            const v = parseFloat(l.amount || '0')
            if (Number.isFinite(v)) sum += v
        }
    }
    return sum.toString()
}

async function saveDraft() {
    if (!canSubmit.value) return
    errorMessage.value = ''
    try {
        const payload = {
            date: form.date,
            adjustmentMeta: {
                standard: form.standard,
                reason: form.reason,
                taxEffectAmount: form.taxEffectAmount || '0',
                disclosureText: form.disclosureText || '',
            },
            lines: form.lines.map((l) => ({
                accountCode: l.accountCode,
                direction: l.direction,
                amount: l.amount,
                description: l.description || undefined,
            })),
        }
        const created = await adjustments.createDraft({ periodId: periodId.value, payload })
        router.push(`/app/ledger/adjustments/${created.id}`)
    } catch (err) {
        errorMessage.value = err?.response?.data?.message || err?.message || 'Save failed'
    }
}

async function commitEntry() {
    if (!entryId.value) return
    try {
        await adjustments.commit(entryId.value)
        await adjustments.fetchOne(entryId.value)
    } catch (err) {
        errorMessage.value = err?.response?.data?.message || err?.message || 'Commit failed'
    }
}

async function reverseEntry() {
    if (!entryId.value) return
    const reason = window.prompt('Reason for reversal:')
    if (!reason) return
    try {
        const reversal = await adjustments.reverse({ entryId: entryId.value, reason })
        router.push(`/app/ledger/adjustments/${reversal.id}`)
    } catch (err) {
        errorMessage.value = err?.response?.data?.message || err?.message || 'Reverse failed'
    }
}

function back() {
    router.push('/app/ledger/adjustments')
}
</script>

<style scoped>
.adj-editor { max-width: 1100px; margin: 0 auto; padding: 24px; }
.adj-editor-header { margin-bottom: 20px; }
.back-btn {
    background: transparent; border: none; color: var(--text-light); cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; margin-bottom: 12px;
}
.adj-editor-header h1 { font-size: 1.3rem; font-weight: 600; }
.adj-editor-card {
    background: var(--card-bg, #fff); border: 1px solid var(--border);
    border-radius: 12px; padding: 24px;
}
.adj-editor-meta {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 18px; margin-bottom: 24px;
}
.adj-editor-meta--wide { grid-column: 1 / -1; }
.adj-editor-meta label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
.adj-editor-meta input,
.adj-editor-meta select,
.adj-editor-meta textarea {
    padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;
    background: var(--card-bg, #fff); color: var(--text); font-family: inherit;
}
.adj-editor-meta input:disabled,
.adj-editor-meta select:disabled,
.adj-editor-meta textarea:disabled { background: var(--accent); cursor: not-allowed; }

.adj-editor-lines { margin-bottom: 20px; }
.adj-editor-table {
    width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.86rem;
    border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
}
.adj-editor-table th {
    text-align: left; padding: 8px 10px; background: var(--accent); color: var(--text-light); font-weight: 600;
}
.adj-editor-table td { padding: 6px 8px; border-top: 1px solid var(--border); }
.adj-editor-table input, .adj-editor-table select {
    width: 100%; padding: 6px 8px; border: 1px solid transparent; border-radius: 4px;
    font-size: 0.86rem; background: transparent;
}
.adj-editor-table input:focus, .adj-editor-table select:focus { outline: none; border-color: var(--primary); background: white; }
.adj-editor-num { text-align: right; font-variant-numeric: tabular-nums; }
.adj-editor-remove {
    background: transparent; border: none; cursor: pointer; color: var(--text-light); padding: 4px;
}
.adj-editor-remove:hover { color: #c53030; }
.adj-editor-add {
    margin-top: 10px; display: inline-flex; align-items: center; gap: 4px;
    background: transparent; border: 1px dashed var(--border); padding: 6px 12px;
    border-radius: 6px; color: var(--text-light); cursor: pointer; font-size: 0.82rem;
}
.adj-editor-add:hover { border-color: var(--primary); color: var(--primary); }

.adj-editor-totals {
    display: flex; gap: 24px; align-items: center; margin-top: 14px;
    padding: 10px 14px; background: var(--accent); border-radius: 8px;
}
.adj-editor-totals-label {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--text-light); display: block;
}
.adj-editor-totals-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.adj-editor-balance {
    margin-left: auto; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 0.84rem;
}
.adj-editor-balance.is-balanced { background: rgba(72, 187, 120, 0.18); color: #2f855a; }
.adj-editor-balance.is-unbalanced { background: rgba(245, 101, 101, 0.15); color: #c53030; }

.adj-editor-footer {
    display: flex; align-items: center; gap: 10px; margin-top: 20px;
}
.adj-editor-spacer { flex: 1; }
.btn-primary {
    background: var(--primary); color: white; padding: 10px 18px; border-radius: 8px;
    border: none; font-weight: 500; cursor: pointer;
}
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost {
    background: transparent; color: var(--text); border: 1px solid var(--border);
    padding: 10px 18px; border-radius: 8px; cursor: pointer;
}
.btn-ghost:hover { background: var(--accent); }
.btn-secondary {
    background: white; color: var(--primary); border: 1px solid var(--primary);
    padding: 10px 18px; border-radius: 8px; cursor: pointer;
}
.btn-secondary:hover { background: rgba(101, 57, 154, 0.04); }
.adj-error {
    margin-top: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
</style>
