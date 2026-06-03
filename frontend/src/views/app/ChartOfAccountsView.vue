<!-- frontend/src/views/app/ChartOfAccountsView.vue
     Browser for the per-org 507-row NSBU chart. Searchable by code/name +
     filterable by vid (А/П/КА/КП/Т). The backend READ endpoint is a
     follow-up to ChartSeedService; until it ships this view shows an
     empty state with a helpful note. -->
<template>
    <div class="chart-view">
        <header class="chart-view-header">
            <div>
                <h1>{{ $t('chart.title') }}</h1>
                <p>{{ $t('chart.subtitle') }}</p>
            </div>
        </header>

        <section class="chart-filters">
            <input v-model="search" type="search" class="chart-search"
                :placeholder="$t('chart.searchPlaceholder')" />
            <select v-model="vidFilter" class="chart-select">
                <option value="">{{ $t('chart.allVids') }}</option>
                <option value="А">А — {{ $t('chart.vid.active') }}</option>
                <option value="П">П — {{ $t('chart.vid.passive') }}</option>
                <option value="КА">КА — {{ $t('chart.vid.contraActive') }}</option>
                <option value="КП">КП — {{ $t('chart.vid.contraPassive') }}</option>
                <option value="Т">Т — {{ $t('chart.vid.technical') }}</option>
            </select>
        </section>

        <section v-if="ledger.isLoadingChart" class="chart-empty"><div class="spinner" /></section>

        <section v-else-if="ledger.chart.length === 0" class="chart-empty">
            <p>{{ $t('chart.empty') }}</p>
            <span class="chart-empty-note">{{ $t('chart.emptyNote') }}</span>
        </section>

        <section v-else class="chart-table-wrap">
            <table class="chart-table">
                <thead>
                    <tr>
                        <th>{{ $t('chart.cols.code') }}</th>
                        <th>{{ $t('chart.cols.name') }}</th>
                        <th>{{ $t('chart.cols.vid') }}</th>
                        <th>{{ $t('chart.cols.subconto') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="a in filtered" :key="a.code">
                        <td class="chart-code">{{ a.code }}</td>
                        <td>{{ a.name }}</td>
                        <td>
                            <span :class="`chart-vid chart-vid--${vidClass(a.vid)}`">{{ a.vid }}</span>
                        </td>
                        <td class="chart-subconto">{{ subcontoSummary(a) }}</td>
                    </tr>
                </tbody>
            </table>
        </section>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, ref } from 'vue'
import { useLedgerStore } from '@/stores/ledger'

const ledger = useLedgerStore()
const search = ref('')
const vidFilter = ref('')

onMounted(async () => {
    await ledger.fetchChart().catch(() => {})
})

const filtered = computed(() => {
    const q = search.value.toLowerCase().trim()
    return ledger.chart.filter((a) => {
        if (vidFilter.value && a.vid !== vidFilter.value) return false
        if (!q) return true
        return (
            a.code.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.quickPick?.toLowerCase().includes(q)
        )
    })
})

function vidClass(vid) {
    return { 'А': 'active', 'П': 'passive', 'КА': 'contra-active', 'КП': 'contra-passive', 'Т': 'tech' }[vid] || 'tech'
}

function subcontoSummary(a) {
    return [a.subconto1Name, a.subconto2Name, a.subconto3Name].filter(Boolean).join(' / ') || '—'
}
</script>

<style scoped>
.chart-view { max-width: 1200px; margin: 0 auto; padding: 24px; }
.chart-view-header { margin-bottom: 20px; }
.chart-view-header h1 { font-size: 1.3rem; font-weight: 600; margin-bottom: 4px; }
.chart-view-header p { font-size: 0.88rem; color: var(--ws-text-3); }
.chart-filters { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.chart-search,
.chart-select {
    padding: 9px 12px; border: 1px solid var(--ws-border); border-radius: 8px;
    font-size: 0.9rem; background: var(--ws-surface); color: var(--ws-text);
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.chart-search::placeholder { color: var(--ws-text-3); }
.chart-search { flex: 1; min-width: 220px; }
.chart-select {
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    padding-right: 32px; cursor: pointer;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
    background-repeat: no-repeat;
    background-position: right 11px center;
}
.chart-select option { background: var(--ws-surface); color: var(--ws-text); }
.chart-search:hover:not(:focus), .chart-select:hover { border-color: rgba(124, 58, 237, 0.25); }
.chart-search:focus, .chart-select:focus { border-color: var(--ws-purple); box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15); }
.chart-empty {
    padding: 60px 24px; text-align: center; background: var(--ws-surface-2); border-radius: 12px;
    display: flex; flex-direction: column; gap: 8px; align-items: center; color: var(--ws-text-3);
}
.chart-empty-note { font-size: 0.82rem; max-width: 480px; }
.chart-table-wrap {
    background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 12px; overflow-x: auto;
}
.chart-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.86rem; }
.chart-table th {
    text-align: left; padding: 10px 12px; font-weight: 600; color: var(--ws-text-3);
    background: var(--ws-surface-2); border-bottom: 1px solid var(--ws-border);
}
.chart-table td { padding: 8px 12px; border-bottom: 1px solid var(--ws-border); color: var(--ws-text); }
.chart-code { font-family: monospace; font-weight: 500; }
.chart-subconto { color: var(--ws-text-3); font-size: 0.82rem; }
.chart-vid {
    padding: 2px 8px; border-radius: 4px; font-size: 0.74rem; font-weight: 600;
}
.chart-vid--active { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.chart-vid--passive { background: rgba(66, 153, 225, 0.15); color: #2c5282; }
.chart-vid--contra-active { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.chart-vid--contra-passive { background: rgba(159, 122, 234, 0.15); color: #553c9a; }
.chart-vid--tech { background: var(--ws-surface-2); color: var(--ws-text-3); }
.spinner {
    width: 24px; height: 24px; border: 2.5px solid var(--ws-border); border-top-color: var(--ws-purple);
    border-radius: 50%; animation: spin 0.85s linear infinite; margin: 0 auto;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
