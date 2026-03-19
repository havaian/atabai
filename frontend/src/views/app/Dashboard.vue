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
            <button class="dash-new-btn" @click="router.push('/app/upload')">
                <PlusIcon class="w-4 h-4" />
                {{ $t('dashboard.newProject') }}
            </button>
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
                    <div class="stat-label">{{ $t('dashboard.totalProcessed') }}</div>
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
        <div class="section">
            <div class="section-header">
                <h2 class="section-title">{{ $t('dashboard.chooseTemplate') }}</h2>
            </div>

            <div class="template-grid">
                <div v-for="template in templates" :key="template.id" class="template-card"
                    @click="selectTemplate(template)">
                    <div class="template-card-top">
                        <div class="template-icon">
                            <component :is="template.icon" class="w-5 h-5" />
                        </div>
                        <span class="template-badge">{{ template.standard }}</span>
                    </div>
                    <div class="template-card-body">
                        <h3 class="template-name">{{ $t(`templates.${template.key}`) }}</h3>
                        <p class="template-desc">{{ $t(`templates.${template.key}Description`) }}</p>
                    </div>
                    <div class="template-card-footer">
                        <span class="template-cat">{{ template.category }}</span>
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
                        {{ file.status }}
                    </span>
                    <span class="file-date">{{ formatDate(file.createdAt) }}</span>
                    <ArrowRightIcon class="w-4 h-4 text-gray-300 hover:text-violet-500 transition-colors" />
                </div>
            </div>
        </div>

        <!-- Empty state when no files yet -->
        <div v-else class="empty-state">
            <div class="empty-icon">
                <DocumentPlusIcon class="w-8 h-8" />
            </div>
            <h3 class="empty-title">{{ $t('dashboard.noFilesYet') }}</h3>
            <p class="empty-desc">{{ $t('dashboard.emptyDesc') }}</p>
            <button class="dash-new-btn" @click="router.push('/app/upload')">
                <PlusIcon class="w-4 h-4" />
                {{ $t('dashboard.newProject') }}
            </button>
        </div>

    </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFilesStore } from '@/stores/files'
import { useTemplatesStore } from '@/stores/templates'
import {
    PlusIcon, DocumentTextIcon, DocumentIcon, DocumentPlusIcon,
    CheckCircleIcon, ArrowRightIcon, SparklesIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const filesStore = useFilesStore()
const templatesStore = useTemplatesStore()

onMounted(() => {
    filesStore.fetchRecentFiles()
    templatesStore.fetchTemplates()
})

const templates = computed(() => templatesStore.availableTemplates)
const recentFiles = computed(() => filesStore.recentFiles || [])
const firstName = computed(() => authStore.user?.name?.split(' ')[0] || '')
const completedFiles = computed(() => recentFiles.value.filter(f => f.status === 'completed').length)
const monthlyLimitDisplay = computed(() => {
    const lim = authStore.monthlyLimit
    return lim === Infinity || lim > 9999 ? '∞' : lim
})

function selectTemplate(template) {
    router.push(`/app/upload?template=${template.id}`)
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
    --ws-bg: #0F0D18;
    --ws-surface: #171523;
    --ws-surface-2: #1D1A2A;
    --ws-border: rgba(149, 0, 255, 0.12);
    --ws-border-2: rgba(149, 0, 255, 0.06);
    --ws-text: #F0ECF6;
    --ws-text-2: rgba(240, 236, 246, 0.55);
    --ws-text-3: rgba(240, 236, 246, 0.3);
    --ws-purple: #7C3AED;
    --ws-purple-lt: rgba(124, 58, 237, 0.15);

    max-width: 900px;
    margin: 0 auto;
    padding: 36px 32px 64px;
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

.dash-new-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    background: #7C3AED;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s, box-shadow 0.15s;
}

.dash-new-btn:hover {
    background: #6D28D9;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);
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
    color: rgba(240, 236, 246, 0.15);
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
    color: rgba(240, 236, 246, 0.15);
    font-weight: 500;
}

.template-arrow {
    color: rgba(240, 236, 246, 0.15);
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
    display: inline-flex;
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
@media (max-width: 768px) {
    .dash {
        padding: 24px 16px 48px;
        gap: 28px;
    }

    .stats-row {
        grid-template-columns: 1fr;
    }

    .template-grid {
        grid-template-columns: 1fr;
    }

    .dash-header {
        flex-direction: column;
    }

    .files-table-row {
        grid-template-columns: 1fr 80px 24px;
    }

    .file-template,
    .file-date {
        display: none;
    }
}
</style>