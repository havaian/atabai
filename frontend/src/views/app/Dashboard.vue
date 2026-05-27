<template>
    <div class="dash">

        <!-- Header -->
        <div class="dash-header">
            <div>
                <h1 class="dash-title">
                    {{ firstName ? $t('dashboard.welcome', { name: firstName }) : $t('dashboard.welcomeBack') }}
                </h1>
                <p class="dash-subtitle">{{ $t('dashboard.subtitle') }}</p>
            </div>
        </div>

        <!-- Stats row -->
        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-icon stat-icon-purple">
                    <DocumentTextIcon class="w-5 h-5" />
                </div>
                <div>
                    <div class="stat-value">{{ authStore.filesProcessedThisMonth }}</div>
                    <div class="stat-label">{{ $t('dashboard.filesThisMonth') }}</div>
                </div>
                <div class="stat-limit">/ {{ monthlyLimitDisplay }}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon-green">
                    <CheckCircleIcon class="w-5 h-5" />
                </div>
                <div>
                    <div class="stat-value">{{ completedFiles }}</div>
                    <div class="stat-label">{{ $t('dashboard.totalCompleted') }}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon stat-icon-violet">
                    <SparklesIcon class="w-5 h-5" />
                </div>
                <div>
                    <div class="stat-value plan-badge">{{ authStore.subscriptionType?.toUpperCase() }}</div>
                    <div class="stat-label">{{ $t('dashboard.subscription') }}</div>
                </div>
            </div>
        </div>

        <!-- Templates section -->
        <!--
          REMOVED (Task 5 — migration to ledger-spine architecture):
          The "Choose a template" section that surfaced the 5 NSBU report
          types (Balance / CF1 / CF2 / P&L1 / P&L2 / Equity) belonged to
          the old file-in/file-out paradigm. It is preserved on the admin
          side (/admin/files) so admins can still process legacy uploads
          retroactively. Users now drive work through the period-scoped
          workflow surfaced below.
        -->

        <!-- Workflow section — current period + action cards.
             Only shown when the caller has an active org AND that org has
             at least one reporting period. Onboarding handles the empty
             case at the router level (needsOnboarding redirect). -->
        <div class="section" v-if="orgsStore.currentOrg">
            <div class="section-header">
                <h2 class="section-title">{{ $t('dashboard.workflow.title') }}</h2>
                <button class="section-link" @click="router.push('/app/ledger/periods')">
                    {{ $t('dashboard.workflow.allPeriods') }}
                    <ArrowRightIcon class="w-3.5 h-3.5" />
                </button>
            </div>

            <!-- Current period summary card. Soft fallback when no period is
                 set yet — Periods view is the recovery path. -->
            <div class="period-card">
                <div class="period-card-main">
                    <div class="period-card-label">{{ $t('dashboard.workflow.currentPeriod') }}</div>
                    <div v-if="activePeriod" class="period-card-name">
                        {{ activePeriod.label || formatPeriod(activePeriod) }}
                    </div>
                    <div v-else class="period-card-empty">{{ $t('dashboard.workflow.noPeriod') }}</div>
                </div>
                <button v-if="activePeriod" class="period-card-action" @click="router.push('/app/ledger/periods')">
                    {{ $t('dashboard.workflow.switchPeriod') }}
                </button>
                <button v-else class="period-card-action period-card-action--primary"
                    @click="router.push('/app/ledger/periods')">
                    {{ $t('dashboard.workflow.setupPeriod') }}
                </button>
            </div>

            <!-- Workflow action grid. Reuses .template-grid + .template-card
                 chrome so the visual rhythm matches Dashboard's earlier
                 design — we are swapping intent (templates → actions),
                 not chrome. Each card routes into a period-scoped page
                 except Matrix/Adjustments which span all periods. -->
            <div class="template-grid">
                <div class="template-card" @click="goPeriod('osv-import')">
                    <div class="template-card-top">
                        <div class="template-icon"><FilePlus2 :size="18" /></div>
                        <span class="template-badge">OSV</span>
                    </div>
                    <div class="template-card-body">
                        <h3 class="template-name">{{ $t('dashboard.workflow.osvTitle') }}</h3>
                        <p class="template-desc">{{ $t('dashboard.workflow.osvDesc') }}</p>
                    </div>
                    <div class="template-card-footer">
                        <span class="template-cat">{{ $t('dashboard.workflow.catImport') }}</span>
                        <ArrowRightIcon class="template-arrow w-4 h-4" />
                    </div>
                </div>

                <div class="template-card" @click="goPeriod('bank-statements')">
                    <div class="template-card-top">
                        <div class="template-icon"><Landmark :size="18" /></div>
                        <span class="template-badge">BANK</span>
                    </div>
                    <div class="template-card-body">
                        <h3 class="template-name">{{ $t('dashboard.workflow.bankTitle') }}</h3>
                        <p class="template-desc">{{ $t('dashboard.workflow.bankDesc') }}</p>
                    </div>
                    <div class="template-card-footer">
                        <span class="template-cat">{{ $t('dashboard.workflow.catImport') }}</span>
                        <ArrowRightIcon class="template-arrow w-4 h-4" />
                    </div>
                </div>

                <div class="template-card" @click="router.push('/app/ledger/matrix')">
                    <div class="template-card-top">
                        <div class="template-icon"><Grid3x3 :size="18" /></div>
                        <span class="template-badge">IFRS</span>
                    </div>
                    <div class="template-card-body">
                        <h3 class="template-name">{{ $t('dashboard.workflow.matrixTitle') }}</h3>
                        <p class="template-desc">{{ $t('dashboard.workflow.matrixDesc') }}</p>
                    </div>
                    <div class="template-card-footer">
                        <span class="template-cat">{{ $t('dashboard.workflow.catReview') }}</span>
                        <ArrowRightIcon class="template-arrow w-4 h-4" />
                    </div>
                </div>

                <div class="template-card" @click="router.push('/app/ledger/adjustments')">
                    <div class="template-card-top">
                        <div class="template-icon"><Sliders :size="18" /></div>
                        <span class="template-badge">IAS/IFRS</span>
                    </div>
                    <div class="template-card-body">
                        <h3 class="template-name">{{ $t('dashboard.workflow.adjustTitle') }}</h3>
                        <p class="template-desc">{{ $t('dashboard.workflow.adjustDesc') }}</p>
                    </div>
                    <div class="template-card-footer">
                        <span class="template-cat">{{ $t('dashboard.workflow.catOverlay') }}</span>
                        <ArrowRightIcon class="template-arrow w-4 h-4" />
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent files section -->
        <div class="section" v-if="recentFiles.length > 0">
            <div class="section-header">
                <h2 class="section-title">{{ $t('dashboard.recentFiles') }}</h2>
                <button class="section-link" @click="router.push('/app/history')">
                    {{ $t('dashboard.viewAll') }}
                    <ArrowRightIcon class="w-3.5 h-3.5" />
                </button>
            </div>

            <div class="files-table">
                <div class="files-table-row files-table-head">
                    <span>{{ $t('history.table.fileName') }}</span>
                    <span>{{ $t('history.table.template') }}</span>
                    <span>{{ $t('history.table.status') }}</span>
                    <span>{{ $t('history.table.processed') }}</span>
                    <span></span>
                </div>
                <div v-for="file in recentFiles.slice(0, 6)" :key="file.id" class="files-table-row files-table-data"
                    @click="openFile(file)">
                    <div class="file-name-cell">
                        <DocumentIcon class="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span class="file-name-text">{{ file.originalName }}</span>
                    </div>
                    <span class="file-template">{{ formatTemplate(file.templateType) }}</span>
                    <span class="status-pill" :class="statusClass(file.status)">
                        {{ $t(`processing.status.${(file.status).toString()}`) }}
                    </span>
                    <span class="file-date">{{ formatDate(file.createdAt) }}</span>
                    <ArrowRightIcon class="w-4 h-4 text-gray-300 hover:text-violet-500 transition-colors" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFilesStore } from '@/stores/files'
import { useOrganizationsStore } from '@/stores/organizations'
import { useLedgerStore } from '@/stores/ledger'
import {
    DocumentTextIcon, DocumentIcon,
    CheckCircleIcon, ArrowRightIcon, SparklesIcon
} from '@heroicons/vue/24/outline'
import {
    FilePlus2, Landmark, Grid3x3, Sliders,
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const authStore = useAuthStore()
const filesStore = useFilesStore()
const orgsStore = useOrganizationsStore()
const ledgerStore = useLedgerStore()

// Refresh strategy:
//   - filesStore.fetchRecentFiles is now org-scoped (Task 6) and the store
//     itself watches orgsStore.currentOrgId, so it will refetch when the
//     active org changes. We trigger an explicit refresh on mount + on
//     route re-entry to pick up new uploads from a different tab.
//   - ledgerStore.fetchPeriods is also org-scoped and idempotent.
//   - templatesStore is gone — the template chooser was removed with the
//     migration to the ledger-spine architecture.
function refreshData() {
    authStore.checkAuth()
    filesStore.fetchRecentFiles(true)
    if (orgsStore.currentOrgId) {
        ledgerStore.fetchPeriods().catch(() => { /* tolerated by store */ })
    }
}

onMounted(refreshData)

watch(() => route.path, (newPath) => {
    if (newPath === '/app/dashboard') {
        filesStore.invalidateCache()
        refreshData()
    }
})

// Re-fetch ledger context when the active org changes mid-session
// (org switcher in the sidebar). Files are handled by the files store itself.
watch(() => orgsStore.currentOrgId, (orgId) => {
    if (orgId) {
        ledgerStore.fetchPeriods().catch(() => { })
    }
})

const recentFiles = computed(() => filesStore.recentFiles || [])
const firstName = computed(() => authStore.user?.name?.split(' ')[0] || '')
const completedFiles = computed(() => authStore.filesCompletedThisMonth)
const monthlyLimitDisplay = computed(() => {
    const lim = authStore.monthlyLimit
    return lim === Infinity || lim > 9999 ? '∞' : lim
})
const activePeriod = computed(() => ledgerStore.activePeriod)

function goPeriod(leaf) {
    // Period-scoped routes need a periodId. Fall back to the periods list
    // (where the user can pick one) when nothing is active yet.
    if (!activePeriod.value) {
        router.push('/app/ledger/periods')
        return
    }
    router.push(`/app/ledger/periods/${activePeriod.value.id}/${leaf}`)
}

function formatPeriod(p) {
    // Soft fallback if the period has no precomputed label — synthesise one
    // from kind + start/end. The backend usually provides `label` directly.
    if (!p) return ''
    const kind = p.kind ? p.kind.charAt(0).toUpperCase() + p.kind.slice(1) : ''
    const start = p.startDate ? new Date(p.startDate).toLocaleDateString() : ''
    const end = p.endDate ? new Date(p.endDate).toLocaleDateString() : ''
    return `${kind} · ${start} → ${end}`.replace(/^ · /, '')
}

function openFile(file) {
    if (file.status === 'completed') router.push(`/app/files/${file.id}`)
    else if (file.jobId) router.push(`/app/processing/${file.jobId}`)
}

function formatTemplate(type) {
    const map = {
        balanceSheet: 'Balance Sheet',
        cashFlow: 'Cash Flow',
        profitLoss: 'P&L (Budget)',
        profitLossForm2: 'P&L (Form 2)',
        equity: 'Equity',
    }
    return map[type] || type
}

function formatDate(d) {
    const date = new Date(d)
    const now = new Date()
    const diffM = Math.floor((now - date) / 60000)
    if (diffM < 1) return t('history.dateJustNow')
    if (diffM < 60) return t('history.dateMinutesAgo', { n: diffM })
    if (diffM < 1440) return t('history.dateHoursAgo', { n: Math.floor(diffM / 60) })
    if (diffM < 2880) return t('history.dateYesterday')
    return date.toLocaleDateString()
}

function statusClass(status) {
    return {
        completed: 'status-green',
        processing: 'status-blue',
        failed: 'status-red',
        pending: 'status-yellow',
        uploaded: 'status-gray',
    }[status] || 'status-gray'
}
</script>

<style scoped>
.dash {
    max-width: 900px;
    margin: 0 auto;
    padding: 36px 4rem 64px;
    display: flex;
    flex-direction: column;
    gap: 40px;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.dash-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.dash-title {
    font-size: 26px;
    font-weight: 700;
    color: var(--ws-text);
    letter-spacing: -0.02em;
    line-height: 1.2;
    margin: 0 0 6px;
}

.dash-subtitle {
    font-size: 14px;
    color: var(--ws-text-3);
    margin: 0;
}

/* ─── Stats ──────────────────────────────────────────────────────────────── */
.stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 14px;
    position: relative;
    overflow: hidden;
}

.stat-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.02) 0%, transparent 60%);
    pointer-events: none;
}

.stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.stat-icon-purple {
    background: rgba(124, 58, 237, 0.1);
    color: #7C3AED;
}

.stat-icon-green {
    background: rgba(34, 197, 94, 0.1);
    color: #16A34A;
}

.stat-icon-violet {
    background: rgba(167, 139, 250, 0.15);
    color: #8B5CF6;
}

.stat-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--ws-text);
    letter-spacing: -0.02em;
    line-height: 1;
    margin-bottom: 3px;
}

.plan-badge {
    font-size: 14px;
    font-weight: 700;
    color: #7C3AED;
    letter-spacing: 0.06em;
}

.stat-label {
    font-size: 12px;
    color: var(--ws-text-3);
    font-weight: 500;
}

.stat-limit {
    font-size: 13px;
    color: var(--ws-text-3);
    font-weight: 500;
    margin-left: auto;
}

/* ─── Section ────────────────────────────────────────────────────────────── */
.section {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.section-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--ws-text);
    margin: 0;
    letter-spacing: -0.01em;
}

.section-link {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #7C3AED;
    font-weight: 500;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: opacity 0.15s;
}

.section-link:hover {
    opacity: 0.7;
}

/* ─── Period card (workflow section header) ─────────────────────────────────
   The "current period" summary that sits between the section header and
   the action grid. Uses the same chrome vocabulary as .stat-card so the
   visual rhythm matches the stats row above. */
.period-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 12px;
}

.period-card-main {
    flex: 1;
    min-width: 0;
}

.period-card-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ws-text-3);
    margin-bottom: 4px;
}

.period-card-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--ws-text);
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.period-card-empty {
    font-size: 13.5px;
    color: var(--ws-text-3);
    font-style: italic;
}

.period-card-action {
    padding: 8px 14px;
    background: transparent;
    border: 1px solid var(--ws-border);
    color: var(--ws-text-2);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    font-family: inherit;
    flex-shrink: 0;
}

.period-card-action:hover {
    background: var(--ws-bg);
    border-color: var(--ws-purple);
    color: var(--ws-purple);
}

.period-card-action--primary {
    background: var(--ws-purple);
    color: #fff;
    border-color: var(--ws-purple);
}

.period-card-action--primary:hover {
    background: #6D28D9;
    border-color: #6D28D9;
    color: #fff;
}

/* ─── Template grid ──────────────────────────────────────────────────────── */
.template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
}

.template-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 20px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 14px;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
}

.template-card:hover {
    border-color: #7C3AED;
    box-shadow: 0 4px 24px rgba(124, 58, 237, 0.08);
}

.template-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.template-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(124, 58, 237, 0.08);
    color: #7C3AED;
    display: flex;
    align-items: center;
    justify-content: center;
}

.template-badge {
    font-size: 11px;
    font-weight: 600;
    color: #7C3AED;
    background: rgba(124, 58, 237, 0.08);
    padding: 3px 8px;
    border-radius: 6px;
    letter-spacing: 0.02em;
}

.template-card-body {
    flex: 1;
}

.template-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--ws-text);
    margin: 0 0 6px;
    letter-spacing: -0.01em;
    min-height: 2.8em;
    display: flex;
    align-items: flex-start;
}

.template-desc {
    font-size: 12.5px;
    color: var(--ws-text-3);
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.template-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.template-cat {
    font-size: 11px;
    color: var(--ws-text-3);
    font-weight: 500;
}

.template-arrow {
    color: var(--ws-text-3);
    transition: color 0.15s, transform 0.15s;
}

.template-card:hover .template-arrow {
    color: #7C3AED;
    transform: translateX(3px);
}

/* ─── Files table ────────────────────────────────────────────────────────── */
.files-table {
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 14px;
    overflow: hidden;
}

.files-table-row {
    display: grid;
    grid-template-columns: 1fr 130px 100px 100px 28px;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--ws-border-2);
}

.files-table-row:last-child {
    border-bottom: none;
}

.files-table-head {
    background: var(--ws-bg);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ws-text-3);
}

.files-table-data {
    cursor: pointer;
    transition: background 0.12s;
    font-size: 13.5px;
    color: var(--ws-text-2);
}

.files-table-data:hover {
    background: var(--ws-bg);
}

.file-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.file-name-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    color: var(--ws-text);
}

.file-template {
    color: var(--ws-text-3);
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-date {
    color: var(--ws-text-3);
    font-size: 12.5px;
    white-space: nowrap;
}

.status-pill {
    text-align: center;
    align-items: center;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
}

.status-green {
    background: rgba(34, 197, 94, 0.12);
    color: #4ade80;
}

.status-blue {
    background: rgba(96, 165, 250, 0.12);
    color: #93c5fd;
}

.status-red {
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
}

.status-yellow {
    background: rgba(251, 191, 36, 0.12);
    color: #fcd34d;
}

.status-gray {
    background: var(--ws-surface-2);
    color: var(--ws-text-3);
}

/* ─── Empty ──────────────────────────────────────────────────────────────── */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 24px;
    background: var(--ws-bg);
    border: 1px dashed #E5E7EB;
    border-radius: 16px;
    text-align: center;
}

/* Drop zone */
.empty-state.drop-zone {
    border: 2px dashed rgba(149, 0, 255, 0.2);
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    text-align: center;
}

.empty-state.drop-zone:hover,
.empty-state.drop-zone.dragging {
    border-color: #7C3AED;
    background: rgba(124, 58, 237, 0.03);
}

.empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: rgba(124, 58, 237, 0.08);
    color: #7C3AED;
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--ws-text);
    margin: 0;
}

.empty-desc {
    font-size: 13.5px;
    color: var(--ws-text-3);
    margin: 0;
    max-width: 360px;
}

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 767px) {
    .dash {
        padding: 20px 16px 48px;
        gap: 20px;
    }

    .stats-row {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .template-grid {
        grid-template-columns: 1fr;
    }

    .dash-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
    }

    .dash-title {
        font-size: 22px;
    }

    .files-table-row {
        grid-template-columns: 1fr 80px 24px;
    }

    .file-template,
    .file-date {
        display: none;
    }

    /* Stack the period card on mobile so the action button sits below
       the period name instead of getting squeezed off-screen. */
    .period-card {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
    }

    .period-card-action {
        align-self: flex-start;
    }
}
</style>