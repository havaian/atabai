<!-- frontend/src/views/app/BankBatchesView.vue
     Lists every bank-statement upload batch in a period. Each upload only
     ever had its identity (uploadId) in the preview URL; this view makes a
     batch reachable again after the operator closes that tab.

       - A draft batch (still has rows to fix) links to the editable preview.
       - A committed batch links to the same preview in read-only mode, so the
         operator can see what posted (date / description / account / amount).
     -->
<template>
    <div class="batches-view">
        <header class="batches-header">
            <button class="batches-back" @click="back">
                <ArrowLeft :size="16" /> {{ $t('common.back') }}
            </button>
            <div class="batches-titles">
                <h1>{{ $t('bankBatches.title') }}</h1>
                <p>{{ periodLabel }}</p>
            </div>
            <button class="btn-primary" :disabled="periodLocked" @click="goUpload">
                <CloudUpload :size="16" /> {{ $t('bankBatches.upload') }}
            </button>
        </header>

        <div v-if="bank.isLoading && bank.batches.length === 0" class="batches-empty">
            <div class="spinner" />
        </div>

        <ul v-else-if="bank.batches.length > 0" class="batches-list">
            <li v-for="b in bank.batches" :key="b.uploadId" class="batch-card" @click="open(b)">
                <div class="batch-card-icon" :class="`batch-card-icon--${b.status}`">
                    <FileCheck v-if="b.status === 'committed'" :size="18" />
                    <FileClock v-else :size="18" />
                </div>
                <div class="batch-card-info">
                    <div class="batch-card-top">
                        <span class="batch-card-date">{{ formatDateTime(b.uploadedAt) }}</span>
                        <span class="batch-pill" :class="`batch-pill--${b.status}`">
                            {{ $t(`bankBatches.status.${b.status}`) }}
                        </span>
                    </div>
                    <div class="batch-card-meta">
                        <span>{{ $t('bankBatches.rows', { n: b.totalRows }) }}</span>
                        <template v-if="b.status === 'draft'">
                            <span class="batch-dot batch-dot--green" v-if="b.draftColorCounts.green">
                                {{ b.draftColorCounts.green }} {{ $t('bankPreview.colors.green') }}
                            </span>
                            <span class="batch-dot batch-dot--yellow" v-if="b.draftColorCounts.yellow">
                                {{ b.draftColorCounts.yellow }} {{ $t('bankPreview.colors.yellow') }}
                            </span>
                            <span class="batch-dot batch-dot--red" v-if="b.draftColorCounts.red">
                                {{ b.draftColorCounts.red }} {{ $t('bankPreview.colors.red') }}
                            </span>
                        </template>
                    </div>
                </div>
                <ChevronRight :size="18" class="batch-card-chevron" />
            </li>
        </ul>

        <div v-else class="batches-empty">
            <p>{{ $t('bankBatches.empty') }}</p>
        </div>

        <div v-if="bank.error" class="batches-error">{{ bank.error }}</div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ChevronRight, CloudUpload, FileCheck, FileClock } from 'lucide-vue-next'
import { useBankStore } from '@/stores/bank'
import { useLedgerStore } from '@/stores/ledger'

const route = useRoute()
const router = useRouter()
const bank = useBankStore()
const ledger = useLedgerStore()

const periodId = computed(() => route.params.periodId)
const period = computed(() => ledger.periods.find((x) => x.id === periodId.value) || null)
const periodLabel = computed(() => period.value?.label || periodId.value)
const periodLocked = computed(() => period.value?.status === 'locked')

onMounted(async () => {
    await ledger.fetchPeriods().catch(() => {})
    await bank.fetchBatches({ periodId: periodId.value }).catch(() => {})
})

function open(b) {
    // Committed batches open read-only; the preview view reads ?status.
    const base = `/app/ledger/periods/${periodId.value}/bank-statements/${b.uploadId}`
    router.push(b.status === 'committed' ? `${base}?status=committed` : base)
}
function goUpload() { router.push(`/app/ledger/periods/${periodId.value}/bank-statements`) }
function back() { router.push('/app/ledger/periods') }

function formatDateTime(d) {
    if (!d) return '—'
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return '—'
    return dt.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}
</script>

<style scoped>
.batches-view { max-width: 900px; margin: 0 auto; padding: 24px; }
.batches-header {
    display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-bottom: 24px;
}
.batches-back {
    background: transparent; border: none; color: var(--ws-text-3); cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem;
}
.batches-back:hover { color: var(--ws-text); }
.batches-titles { flex: 1; }
.batches-titles h1 { font-size: 1.3rem; font-weight: 600; color: var(--ws-text); margin-bottom: 4px; }
.batches-titles p { font-size: 0.88rem; color: var(--ws-text-3); }

.batches-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.batch-card {
    display: flex; align-items: center; gap: 14px; padding: 14px 16px;
    background: var(--ws-surface); border: 1px solid var(--ws-border); border-radius: 12px;
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
}
.batch-card:hover { border-color: rgba(124, 58, 237, 0.4); background: var(--ws-surface-2); }
.batch-card-icon {
    width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
}
.batch-card-icon--draft { background: rgba(237, 137, 54, 0.14); color: #c05621; }
.batch-card-icon--committed { background: rgba(72, 187, 120, 0.14); color: #2f855a; }
.batch-card-info { flex: 1; min-width: 0; }
.batch-card-top { display: flex; align-items: center; gap: 10px; }
.batch-card-date { font-weight: 500; color: var(--ws-text); }
.batch-pill {
    padding: 1px 9px; border-radius: 999px; font-size: 0.72rem; font-weight: 600;
}
.batch-pill--draft { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.batch-pill--committed { background: rgba(72, 187, 120, 0.15); color: #2f855a; }
.batch-card-meta {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    font-size: 0.82rem; color: var(--ws-text-3); margin-top: 3px;
}
.batch-dot {
    display: inline-flex; align-items: center; gap: 4px; font-weight: 600;
}
.batch-dot--green { color: #2f855a; }
.batch-dot--yellow { color: #c05621; }
.batch-dot--red { color: #c53030; }
.batch-dot::before {
    content: ''; width: 7px; height: 7px; border-radius: 50%; display: inline-block;
}
.batch-dot--green::before { background: #48bb78; }
.batch-dot--yellow::before { background: #ed8936; }
.batch-dot--red::before { background: #f56565; }
.batch-card-chevron { color: var(--ws-text-3); flex-shrink: 0; }

.batches-empty {
    padding: 60px 24px; text-align: center; color: var(--ws-text-3);
    background: var(--ws-surface-2); border-radius: 12px;
}
.batches-error {
    margin-top: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.spinner {
    width: 24px; height: 24px; border: 2.5px solid var(--ws-border); border-top-color: var(--ws-purple);
    border-radius: 50%; margin: 0 auto; animation: spin 0.85s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.btn-primary {
    background: var(--ws-purple); color: #fff; padding: 9px 16px; border-radius: 8px;
    border: none; font-weight: 500; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem;
    transform: none !important; box-shadow: none !important;
}
.btn-primary:hover:not(:disabled) { background: #6D28D9; color: #fff !important; transform: none !important; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
