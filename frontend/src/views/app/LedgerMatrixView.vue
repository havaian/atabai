<!-- frontend/src/views/app/LedgerMatrixView.vue
     The transformation matrix from architecture doc §7.2:
       NSBU balance → reclassification → adjustments → IFRS balance
     Rendered as a grouped table with one row per (account, subconto)
     and four money columns — one per layer. Backend READ endpoint
     (account-balances grouped by key, projecting layers as columns)
     is a follow-up; for now this view fetches each layer separately
     and joins client-side. -->
<template>
    <div class="matrix-view">
        <header class="matrix-header">
            <div>
                <h1>{{ $t('matrix.title') }}</h1>
                <p>{{ $t('matrix.subtitle') }}</p>
            </div>
            <div class="matrix-period-picker">
                <label>
                    <span>{{ $t('matrix.period') }}</span>
                    <select v-model="selectedPeriodId" @change="refresh">
                        <option v-for="p in ledger.periods" :key="p.id" :value="p.id">{{ p.label }}</option>
                    </select>
                </label>
            </div>
        </header>

        <section v-if="isLoading" class="matrix-empty"><div class="spinner" /></section>

        <section v-else-if="rows.length === 0" class="matrix-empty">
            <p>{{ $t('matrix.empty') }}</p>
        </section>

        <section v-else class="matrix-table-wrap">
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th rowspan="2" class="matrix-th-sticky">{{ $t('matrix.cols.account') }}</th>
                        <th colspan="2" class="matrix-th-group">{{ $t('matrix.layer.nsbu') }}</th>
                        <th colspan="2" class="matrix-th-group">{{ $t('matrix.layer.reclass') }}</th>
                        <th colspan="2" class="matrix-th-group">{{ $t('matrix.layer.adjustment') }}</th>
                        <th colspan="2" class="matrix-th-group matrix-th-group--ifrs">{{ $t('matrix.layer.ifrs') }}</th>
                    </tr>
                    <tr>
                        <th class="matrix-th-num">Dt</th>
                        <th class="matrix-th-num">Cr</th>
                        <th class="matrix-th-num">Dt</th>
                        <th class="matrix-th-num">Cr</th>
                        <th class="matrix-th-num">Dt</th>
                        <th class="matrix-th-num">Cr</th>
                        <th class="matrix-th-num">Dt</th>
                        <th class="matrix-th-num">Cr</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in rows" :key="row.key">
                        <td class="matrix-td-sticky matrix-account">
                            <span class="matrix-account-code">{{ row.accountCode }}</span>
                            <span v-if="row.subcontoLabel" class="matrix-account-subconto">{{ row.subcontoLabel }}</span>
                        </td>
                        <td class="matrix-num">{{ format(row.nsbu_base?.closingDebit) }}</td>
                        <td class="matrix-num">{{ format(row.nsbu_base?.closingCredit) }}</td>
                        <td class="matrix-num matrix-num--reclass">{{ format(row.reclassification?.closingDebit) }}</td>
                        <td class="matrix-num matrix-num--reclass">{{ format(row.reclassification?.closingCredit) }}</td>
                        <td class="matrix-num matrix-num--adj">{{ format(row.adjustment?.closingDebit) }}</td>
                        <td class="matrix-num matrix-num--adj">{{ format(row.adjustment?.closingCredit) }}</td>
                        <td class="matrix-num matrix-num--ifrs">{{ format(row.ifrs?.closingDebit) }}</td>
                        <td class="matrix-num matrix-num--ifrs">{{ format(row.ifrs?.closingCredit) }}</td>
                    </tr>
                </tbody>
            </table>
        </section>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, ref, watch } from 'vue'
import { useLedgerStore } from '@/stores/ledger'

const ledger = useLedgerStore()
const selectedPeriodId = ref(null)
const isLoading = ref(false)

/**
 * Pivot now comes pre-joined from the server (/matrix endpoint). Each row:
 *   { accountCode, subconto1/2/3Value, counterpartyId, layers: { nsbu_base, reclassification, adjustment, ifrs } }
 * where each layer is the AccountBalance-shaped subdoc (opening/period/closing × Dt/Cr).
 */
const matrixRows = ref([])

onMounted(async () => {
    await ledger.fetchPeriods().catch(() => {})
    selectedPeriodId.value = ledger.activePeriod?.id || ledger.periods[0]?.id || null
    if (selectedPeriodId.value) await refresh()
})

watch(() => ledger.periods, () => {
    if (!selectedPeriodId.value && ledger.periods.length > 0) {
        selectedPeriodId.value = ledger.activePeriod?.id || ledger.periods[0].id
    }
})

async function refresh() {
    if (!selectedPeriodId.value) return
    isLoading.value = true
    try {
        matrixRows.value = await ledger.fetchMatrix(selectedPeriodId.value).catch(() => [])
    } finally {
        isLoading.value = false
    }
}

const rows = computed(() => {
    return matrixRows.value.map((m) => ({
        key: [m.accountCode, m.subconto1Value || '', m.subconto2Value || '', m.subconto3Value || ''].join('|'),
        accountCode: m.accountCode,
        subcontoLabel: subcontoLabel(m),
        nsbu_base: m.layers?.nsbu_base,
        reclassification: m.layers?.reclassification,
        adjustment: m.layers?.adjustment,
        ifrs: m.layers?.ifrs,
    }))
})

function subcontoLabel(b) {
    return [b.subconto1Value, b.subconto2Value, b.subconto3Value].filter(Boolean).join(' / ')
}

function format(decStr) {
    if (!decStr || decStr === '0') return ''
    return decStr
}
</script>

<style scoped>
.matrix-view { max-width: 1400px; margin: 0 auto; padding: 24px; }
.matrix-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 20px;
}
.matrix-header h1 { font-size: 1.3rem; font-weight: 600; margin-bottom: 4px; }
.matrix-header p { font-size: 0.88rem; color: var(--ws-text-3); }
.matrix-period-picker label { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: var(--ws-text-3); }
.matrix-period-picker select {
    padding: 8px 10px; border: 1px solid var(--ws-border); border-radius: 6px; font-size: 0.9rem; min-width: 200px;
}
.matrix-empty {
    padding: 60px 24px; text-align: center; background: var(--ws-surface-2); border-radius: 12px; color: var(--ws-text-3);
}
.matrix-table-wrap {
    background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 12px; overflow: auto; max-height: 70vh;
}
.matrix-table { border-collapse: separate; border-spacing: 0; font-size: 0.82rem; width: 100%; }
.matrix-table th {
    padding: 8px 10px; background: var(--ws-surface-2); border-bottom: 1px solid var(--ws-border);
    color: var(--ws-text-3); font-weight: 600; position: sticky; top: 0; z-index: 1;
}
.matrix-th-group { text-align: center; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em; }
.matrix-th-group--ifrs { background: rgba(124, 58, 237, 0.1); color: var(--ws-purple); }
.matrix-th-num { text-align: right; }
.matrix-table td { padding: 6px 10px; border-bottom: 1px solid var(--ws-border); }
.matrix-num { text-align: right; font-variant-numeric: tabular-nums; }
.matrix-num--reclass { background: rgba(66, 153, 225, 0.03); }
.matrix-num--adj { background: rgba(237, 137, 54, 0.04); }
.matrix-num--ifrs { background: rgba(124, 58, 237, 0.05); font-weight: 600; }
.matrix-account { display: flex; flex-direction: column; min-width: 200px; }
.matrix-account-code { font-family: monospace; font-weight: 600; }
.matrix-account-subconto { font-size: 0.72rem; color: var(--ws-text-3); }
.matrix-td-sticky, .matrix-th-sticky {
    position: sticky; left: 0; background: var(--ws-surface); z-index: 2;
    border-right: 1px solid var(--ws-border);
}
.matrix-th-sticky { background: var(--ws-surface-2); }
.spinner {
    width: 24px; height: 24px; border: 2.5px solid var(--ws-border); border-top-color: var(--ws-purple);
    border-radius: 50%; animation: spin 0.85s linear infinite; margin: 0 auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
