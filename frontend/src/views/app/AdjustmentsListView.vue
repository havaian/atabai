<!-- frontend/src/views/app/AdjustmentsListView.vue
     IFRS overlay entries. List + filter by status / standard. Each entry
     carries IFRS standard tag, reason, tax effect, disclosure text. -->
<template>
    <div class="adj-list">
        <header class="adj-list-header">
            <div>
                <h1>{{ $t('adjustments.title') }}</h1>
                <p>{{ $t('adjustments.subtitle') }}</p>
            </div>
            <button class="btn-primary" @click="goToNew">
                <Plus :size="16" /> {{ $t('adjustments.create') }}
            </button>
        </header>

        <section class="adj-list-filters">
            <label>
                <span>{{ $t('adjustments.filters.status') }}</span>
                <select v-model="filters.status" @change="refresh">
                    <option value="">{{ $t('common.all') }}</option>
                    <option value="draft">{{ $t('adjustments.status.draft') }}</option>
                    <option value="committed">{{ $t('adjustments.status.committed') }}</option>
                    <option value="reversed">{{ $t('adjustments.status.reversed') }}</option>
                </select>
            </label>
            <label>
                <span>{{ $t('adjustments.filters.standard') }}</span>
                <select v-model="filters.standard" @change="refresh">
                    <option value="">{{ $t('common.all') }}</option>
                    <option v-for="std in standards" :key="std" :value="std">{{ std }}</option>
                </select>
            </label>
        </section>

        <section class="adj-list-table-wrap">
            <table class="adj-list-table">
                <thead>
                    <tr>
                        <th>{{ $t('adjustments.cols.date') }}</th>
                        <th>{{ $t('adjustments.cols.standard') }}</th>
                        <th>{{ $t('adjustments.cols.reason') }}</th>
                        <th class="adj-num">{{ $t('adjustments.cols.amount') }}</th>
                        <th>{{ $t('adjustments.cols.status') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="entry in adjustments.items" :key="entry.id" class="adj-row" @click="open(entry.id)">
                        <td>{{ formatDate(entry.date) }}</td>
                        <td>{{ entry.adjustmentMeta?.standard || '—' }}</td>
                        <td class="adj-reason">{{ entry.adjustmentMeta?.reason || entry.description }}</td>
                        <td class="adj-num">{{ entry.totalAmount }}</td>
                        <td>
                            <span :class="`adj-pill adj-pill--${entry.status}`">
                                {{ $t(`adjustments.status.${entry.status}`) }}
                            </span>
                        </td>
                    </tr>
                    <tr v-if="adjustments.items.length === 0 && !adjustments.isLoading">
                        <td colspan="5" class="adj-empty">{{ $t('adjustments.empty') }}</td>
                    </tr>
                </tbody>
            </table>
        </section>

        <div v-if="adjustments.error" class="adj-error">{{ adjustments.error }}</div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { useAdjustmentsStore } from '@/stores/adjustments'
import { useLedgerStore } from '@/stores/ledger'

const router = useRouter()
const adjustments = useAdjustmentsStore()
const ledger = useLedgerStore()

const standards = ['IAS 16', 'IFRS 16', 'IFRS 9', 'IFRS 15', 'IAS 12']

const filters = reactive({ status: '', standard: '' })

async function refresh() {
    await adjustments.fetchList({
        status: filters.status || undefined,
        standard: filters.standard || undefined,
    })
}

onMounted(async () => {
    await refresh()
})

function goToNew() {
    const period = ledger.activePeriod
    if (!period) {
        // No period — bounce to periods page.
        router.push('/app/ledger/periods')
        return
    }
    router.push(`/app/ledger/periods/${period.id}/adjustments/new`)
}

function open(entryId) {
    router.push(`/app/ledger/adjustments/${entryId}`)
}

function formatDate(d) { return d ? new Date(d).toISOString().slice(0, 10) : '' }
</script>

<style scoped>
.adj-list { max-width: 1100px; margin: 0 auto; padding: 24px; }
.adj-list-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
    margin-bottom: 24px;
}
.adj-list-header h1 { font-size: 1.3rem; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.adj-list-header p { font-size: 0.88rem; color: var(--text-light); }
.adj-list-filters {
    display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
}
.adj-list-filters label {
    display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: var(--text-light);
}
.adj-list-filters select {
    padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px;
    font-size: 0.9rem; background: var(--card-bg, #fff); min-width: 160px;
}
.adj-list-table-wrap {
    background: var(--card-bg, #fff); border: 1px solid var(--border);
    border-radius: 12px; overflow-x: auto;
}
.adj-list-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.88rem; }
.adj-list-table th {
    text-align: left; padding: 10px 12px; font-weight: 600; color: var(--text-light);
    background: var(--accent); border-bottom: 1px solid var(--border);
}
.adj-list-table td {
    padding: 12px; border-bottom: 1px solid var(--border); color: var(--text);
}
.adj-row { cursor: pointer; }
.adj-row:hover { background: var(--accent); }
.adj-num { text-align: right; font-variant-numeric: tabular-nums; }
.adj-reason {
    max-width: 380px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.adj-pill {
    padding: 2px 8px; border-radius: 999px; font-size: 0.74rem; font-weight: 600;
}
.adj-pill--draft { background: rgba(102, 126, 234, 0.15); color: #4c51bf; }
.adj-pill--committed { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.adj-pill--reversed { background: rgba(160, 174, 192, 0.2); color: #4a5568; }
.adj-empty { text-align: center; padding: 40px; color: var(--text-light); }
.adj-error {
    margin-top: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.btn-primary {
    background: var(--primary); color: white; padding: 9px 16px; border-radius: 8px;
    border: none; font-weight: 500; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem;
}
.btn-primary:hover { background: var(--primary-dark); }
</style>
