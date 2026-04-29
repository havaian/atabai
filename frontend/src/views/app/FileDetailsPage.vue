<template>
    <div class="results-page">

        <!-- Back -->
        <button class="back-btn" @click="router.push('/app/dashboard')">
            <ArrowLeftIcon class="w-4 h-4" />
            {{ $t('common.backToDashboard') }}
        </button>

        <!-- Loading -->
        <div v-if="isLoading" class="results-loading">
            <div class="results-spinner"></div>
            <span>{{ $t('common.loading') }}</span>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="results-error">
            <ExclamationCircleIcon class="w-5 h-5" />
            {{ error }}
        </div>

        <template v-else-if="file">

            <!-- Status banner -->
            <div class="status-banner" :class="bannerClass">
                <div class="banner-icon">
                    <CheckCircleIcon v-if="file.status === 'completed'" class="w-5 h-5" />
                    <ExclamationCircleIcon v-else-if="file.status === 'failed'" class="w-5 h-5" />
                    <div v-else class="mini-spinner"></div>
                </div>
                <div class="banner-text">
                    <div class="banner-title">{{ bannerTitle }}</div>
                    <div class="banner-sub">{{ file.originalName }}</div>
                </div>

                <!-- Download CTA -->
                <button v-if="file.status === 'completed'" class="download-btn"
                    @click="filesStore.downloadFile(file.id)">
                    <ArrowDownTrayIcon class="w-4 h-4" />
                    {{ $t('processing.actions.download') }}
                </button>
            </div>

            <!-- Stats row -->
            <div v-if="file.status === 'completed'" class="result-stats">
                <div class="result-stat">
                    <div class="result-stat-val">{{ file.transformations || 0 }}</div>
                    <div class="result-stat-label">{{ $t('processing.rowsTransformed') }}</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-val">{{ file.changes || 0 }}</div>
                    <div class="result-stat-label">{{ $t('processing.lineItemsMapped') }}</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-val">{{ templateLabel }}</div>
                    <div class="result-stat-label">{{ $t('results.templateUsed') }}</div>
                </div>
                <div class="result-stat">
                    <div class="result-stat-val">{{ formatDate(file.completedAt || file.createdAt) }}</div>
                    <div class="result-stat-label">{{ $t('results.processed') }}</div>
                </div>
            </div>

            <!-- IFRS notes / warnings -->
            <div v-if="file.warnings?.length" class="warnings-section">
                <div class="warnings-header">
                    <ExclamationTriangleIcon class="w-4 h-4" />
                    {{ $t('results.notes') }}
                </div>
                <ul class="warnings-list">
                    <li v-for="(w, i) in file.warnings" :key="i">{{ w }}</li>
                </ul>
            </div>

            <!-- Transformation diff view (collapsed by default; Univer lazy-loads on expand) -->
            <div v-if="showTransformation" class="transformation-section">
                <button class="transformation-toggle" @click="toggleTransformation">
                    <ChevronDownIcon class="w-4 h-4 transformation-chevron" :class="{ open: isTransformationOpen }" />
                    <span class="transformation-toggle-label">
                        {{ $t('transformation.sectionTitle') }}
                    </span>
                    <span v-if="!isTransformationOpen" class="transformation-toggle-hint">
                        {{ $t('transformation.sectionHint') }}
                    </span>
                </button>
                <div v-if="isTransformationOpen" class="transformation-body">
                    <TransformationView :file-id="file.id" />
                </div>
            </div>

            <!-- File info -->
            <div class="file-info-section">
                <div class="file-info-header">{{ $t('results.fileDetails') }}</div>
                <div class="file-info-grid">
                    <div class="file-info-row">
                        <span class="info-label">{{ $t('results.originalFile') }}</span>
                        <span class="info-value">{{ file.originalName }}</span>
                    </div>
                    <div class="file-info-row">
                        <span class="info-label">{{ $t('results.template') }}</span>
                        <span class="info-value">{{ templateLabel }}</span>
                    </div>
                    <div class="file-info-row">
                        <span class="info-label">{{ $t('results.status') }}</span>
                        <span class="status-pill" :class="statusClass(file.status)">
                            {{ $t(`processing.status.${file.status}`, file.status) }}
                        </span>
                    </div>
                    <div class="file-info-row">
                        <span class="info-label">{{ $t('results.uploaded') }}</span>
                        <span class="info-value">{{ formatFullDate(file.createdAt) }}</span>
                    </div>
                    <div v-if="file.completedAt" class="file-info-row">
                        <span class="info-label">{{ $t('results.completed') }}</span>
                        <span class="info-value">{{ formatFullDate(file.completedAt) }}</span>
                    </div>
                    <div v-if="file.fileSize" class="file-info-row">
                        <span class="info-label">{{ $t('results.fileSize') }}</span>
                        <span class="info-value">{{ formatSize(file.fileSize) }}</span>
                    </div>
                </div>
            </div>

            <!-- Actions row -->
            <div class="actions-row">
                <button v-if="file.status === 'completed'" class="action-btn action-btn-primary"
                    @click="filesStore.downloadFile(file.id)">
                    <ArrowDownTrayIcon class="w-4 h-4" />
                    {{ $t('processing.actions.download') }}
                </button>
                <button class="action-btn action-btn-secondary"
                    @click="router.push(`/app/upload?template=${file.templateType}`)">
                    <PlusIcon class="w-4 h-4" />
                    {{ $t('results.processAnother') }}
                </button>
                <button class="action-btn action-btn-ghost" @click="deleteFile">
                    <TrashIcon class="w-4 h-4" />
                    {{ $t('common.delete') }}
                </button>
            </div>

        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'
import {
    ArrowLeftIcon, ArrowDownTrayIcon, PlusIcon, TrashIcon,
    CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon,
    ChevronDownIcon
} from '@heroicons/vue/24/outline'
import { defineAsyncComponent } from 'vue'

// Lazy-load TransformationView + its Univer deps on first expand
const TransformationView = defineAsyncComponent(() =>
    import('@/components/TransformationView.vue')
)

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const filesStore = useFilesStore()

const file = ref(null)
const isLoading = ref(true)
const error = ref('')

const isTransformationOpen = ref(false)

const showTransformation = computed(() => {
    if (file.value?.status !== 'completed') return false
    // Templates that have transformation diff view support
    const supportedTemplates = ['balanceSheet', 'profitLossForm2', 'cashFlow', 'profitLoss', 'equity']
    return supportedTemplates.includes(file.value?.templateType)
})

function toggleTransformation() {
    isTransformationOpen.value = !isTransformationOpen.value
}

const fileId = computed(() => route.params.fileId || route.params.id)

const templateLabel = computed(() => {
    const keys = {
        balanceSheet: 'templates.balanceSheet',
        cashFlow: 'templates.cashFlow',
        profitLoss: 'templates.profitLoss',
        profitLossForm2: 'templates.profitLossForm2',
        equity: 'templates.equity',
    }
    const k = file.value?.templateType
    return k && keys[k] ? t(keys[k]) : (k || '—')
})

const bannerClass = computed(() => ({
    'banner-success': file.value?.status === 'completed',
    'banner-error': file.value?.status === 'failed',
    'banner-processing': ['processing', 'pending', 'uploaded'].includes(file.value?.status),
}))

const bannerTitle = computed(() => {
    const map = {
        completed: t('processing.status.completed'),
        failed: t('processing.status.failed'),
        processing: t('processing.status.processing'),
        pending: t('processing.status.pending'),
        uploaded: t('processing.status.uploaded'),
    }
    return map[file.value?.status] || ''
})

function statusClass(status) {
    return {
        completed: 'status-green',
        processing: 'status-blue',
        failed: 'status-red',
        pending: 'status-yellow',
        uploaded: 'status-gray',
    }[status] || 'status-gray'
}

function formatDate(d) {
    if (!d) return '—'
    const date = new Date(d)
    const now = new Date()
    const diffM = Math.floor((now - date) / 60000)
    if (diffM < 1) return t('history.dateJustNow')
    if (diffM < 60) return t('history.dateMinutesAgo', { n: diffM })
    if (diffM < 1440) return t('history.dateHoursAgo', { n: Math.floor(diffM / 60) })
    return date.toLocaleDateString()
}

function formatFullDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleString()
}

function formatSize(bytes) {
    if (!bytes) return '—'
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function deleteFile() {
    if (!confirm(t('results.confirmDelete'))) return
    try {
        await filesStore.deleteFile(fileId)
        router.push('/app/dashboard')
    } catch (e) {
        error.value = t('results.deleteFailed')
    }
}

async function loadFile() {
    isLoading.value = true
    error.value = ''
    file.value = null
    try {
        const data = await filesStore.getFileDetails(fileId.value)
        file.value = data?.file || data
    } catch (e) {
        error.value = t('results.loadFailed')
    } finally {
        isLoading.value = false
    }
}

onMounted(loadFile)

watch(fileId, (newId, oldId) => {
    if (newId && newId !== oldId) loadFile()
})
</script>

<style scoped>
.results-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px 64px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--ws-text-3);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    align-self: flex-start;
    transition: color 0.15s;
}

.back-btn:hover {
    color: var(--ws-text-2);
}

.results-loading {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 40px;
    color: var(--ws-text-3);
    font-size: 14px;
}

.results-spinner,
.mini-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--ws-border);
    border-top-color: var(--ws-purple);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
}

.mini-spinner {
    width: 18px;
    height: 18px;
    border-color: rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.results-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    background: var(--pill-red-bg);
    border: 1px solid var(--pill-red-bg);
    border-radius: 12px;
    color: var(--pill-red-text);
    font-size: 14px;
}

/* ─── Status banner ──────────────────────────────────────────────────────── */
.status-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 24px;
    border-radius: 16px;
    border: 1px solid;
}

.banner-success {
    background: var(--pill-green-bg);
    border-color: var(--pill-green-bg);
}

.banner-error {
    background: var(--pill-red-bg);
    border-color: var(--pill-red-bg);
}

.banner-processing {
    background: var(--pill-blue-bg);
    border-color: var(--pill-blue-bg);
}

.banner-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.banner-success .banner-icon {
    background: var(--pill-green-bg);
    color: var(--pill-green-text);
}

.banner-error .banner-icon {
    background: var(--pill-red-bg);
    color: var(--pill-red-text);
}

.banner-processing .banner-icon {
    background: var(--pill-blue-bg);
    color: var(--pill-blue-text);
}

.banner-text {
    flex: 1;
}

.banner-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ws-text);
    margin-bottom: 3px;
}

.banner-sub {
    font-size: 12.5px;
    color: var(--ws-text-3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
}

.download-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    background: var(--ws-purple);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: background 0.15s, box-shadow 0.15s;
}

.download-btn:hover {
    background: #6D28D9;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
}

/* ─── Stats ──────────────────────────────────────────────────────────────── */
.result-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
}

.result-stat {
    padding: 16px 18px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 12px;
}

.result-stat-val {
    font-size: 20px;
    font-weight: 700;
    color: var(--ws-text);
    letter-spacing: -0.02em;
    margin-bottom: 4px;
}

.result-stat-label {
    font-size: 11.5px;
    color: var(--ws-text-3);
    font-weight: 500;
}

/* ─── Warnings ───────────────────────────────────────────────────────────── */
.warnings-section {
    padding: 16px 18px;
    background: var(--pill-yellow-bg);
    border: 1px solid var(--pill-yellow-bg);
    border-radius: 12px;
}

.warnings-header {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: var(--pill-yellow-text);
    margin-bottom: 10px;
}

.warnings-list {
    margin: 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.warnings-list li {
    font-size: 13px;
    color: var(--ws-text-2);
    line-height: 1.5;
}

/* ─── File info ──────────────────────────────────────────────────────────── */
.file-info-section {
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 14px;
    overflow: hidden;
}

.file-info-header {
    padding: 14px 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ws-text-3);
    background: var(--ws-bg);
    border-bottom: 1px solid var(--ws-border-2);
}

.file-info-grid {
    display: flex;
    flex-direction: column;
}

.file-info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 13px 20px;
    border-bottom: 1px solid var(--ws-border-2);
    font-size: 13.5px;
}

.file-info-row:last-child {
    border-bottom: none;
}

.info-label {
    color: var(--ws-text-3);
    font-weight: 500;
    flex-shrink: 0;
}

.info-value {
    color: var(--ws-text);
    font-weight: 500;
    text-align: right;
    word-break: break-all;
}

/* ─── Status pills ───────────────────────────────────────────────────────── */
.status-pill {
    display: inline-flex;
    align-items: center;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
}

.status-green {
    background: var(--pill-green-bg);
    color: var(--pill-green-text);
}

.status-blue {
    background: var(--pill-blue-bg);
    color: var(--pill-blue-text);
}

.status-red {
    background: var(--pill-red-bg);
    color: var(--pill-red-text);
}

.status-yellow {
    background: var(--pill-yellow-bg);
    color: var(--pill-yellow-text);
}

.status-gray {
    background: var(--pill-gray-bg);
    color: var(--pill-gray-text);
}

/* ─── Actions ────────────────────────────────────────────────────────────── */
.actions-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    border: none;
    transition: all 0.15s;
}

.action-btn-primary {
    background: var(--ws-purple);
    color: #fff;
}

.action-btn-primary:hover {
    background: #6D28D9;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
}

.action-btn-secondary {
    background: var(--ws-surface-2);
    color: var(--ws-text-2);
}

.action-btn-secondary:hover {
    background: var(--ws-border);
}

.action-btn-ghost {
    background: transparent;
    color: var(--ws-text-3);
    margin-left: auto;
}

.action-btn-ghost:hover {
    color: #EF4444;
    background: rgba(248, 113, 113, 0.08);
}

/* ─── Transformation section ─────────────────────────────────────────────── */
.transformation-section {
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 14px;
    overflow: hidden;
}

.transformation-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 16px 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--ws-text);
    transition: background 0.12s;
    text-align: left;
}

.transformation-toggle:hover {
    background: var(--ws-bg);
}

.transformation-chevron {
    color: var(--ws-text-3);
    transition: transform 0.2s;
    flex-shrink: 0;
}

.transformation-chevron.open {
    transform: rotate(180deg);
}

.transformation-toggle-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--ws-text);
}

.transformation-toggle-hint {
    font-size: 12.5px;
    color: var(--ws-text-3);
    margin-left: auto;
}

.transformation-body {
    padding: 0 20px 20px;
    border-top: 1px solid var(--ws-border-2);
}

@media (max-width: 640px) {
    .result-stats {
        grid-template-columns: repeat(2, 1fr);
    }

    .status-banner {
        flex-wrap: wrap;
    }

    .download-btn {
        width: 100%;
        justify-content: center;
    }
}
</style>