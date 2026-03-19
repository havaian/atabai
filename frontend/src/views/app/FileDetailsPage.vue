<template>
    <div class="results-page">

        <!-- Back -->
        <button class="back-btn" @click="router.push('/app/dashboard')">
            <ArrowLeftIcon class="w-4 h-4" />
            Back to dashboard
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
                <a v-if="file.status === 'completed'" :href="downloadUrl" class="download-btn" download>
                    <ArrowDownTrayIcon class="w-4 h-4" />
                    Download IFRS file
                </a>
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
                    Notes
                </div>
                <ul class="warnings-list">
                    <li v-for="(w, i) in file.warnings" :key="i">{{ w }}</li>
                </ul>
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
                        <span class="status-pill" :class="statusClass(file.status)">{{ file.status }}</span>
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
                <a v-if="file.status === 'completed'" :href="downloadUrl" class="action-btn action-btn-primary"
                    download>
                    <ArrowDownTrayIcon class="w-4 h-4" />
                    Download IFRS Excel
                </a>
                <button class="action-btn action-btn-secondary"
                    @click="router.push(`/app/upload?template=${file.templateType}`)">
                    <PlusIcon class="w-4 h-4" />
                    Process another file
                </button>
                <button class="action-btn action-btn-ghost" @click="deleteFile">
                    <TrashIcon class="w-4 h-4" />
                    Delete
                </button>
            </div>

        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFilesStore } from '@/stores/files'
import {
    ArrowLeftIcon, ArrowDownTrayIcon, PlusIcon, TrashIcon,
    CheckCircleIcon, ExclamationCircleIcon, ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const filesStore = useFilesStore()

const file = ref(null)
const isLoading = ref(true)
const error = ref('')

const fileId = computed(() => route.params.fileId)

const templateLabels = {
    balanceSheet: 'Balance Sheet (IAS 1)',
    cashFlow: 'Cash Flow (IAS 7)',
    profitLoss: 'P&L — Budget Format',
    profitLossForm2: 'P&L — Form 2',
    equity: 'Changes in Equity (IAS 1)',
}

const templateLabel = computed(() => templateLabels[file.value?.templateType] || file.value?.templateType || '—')

const downloadUrl = computed(() => {
    if (!file.value?.id) return '#'
    return `/api/files/${file.value.id}/download`
})

const bannerClass = computed(() => ({
    'banner-success': file.value?.status === 'completed',
    'banner-error': file.value?.status === 'failed',
    'banner-processing': ['processing', 'pending', 'uploaded'].includes(file.value?.status),
}))

const bannerTitle = computed(() => {
    const map = {
        completed: $t('processing.status.completed'),
        failed: $t('processing.status.failed'),
        processing: t('processing.status.processing'),
        pending: t('processing.status.pending'),
        uploaded: t('processing.status.uploaded'),
    }
    return map[file.value?.status] || 'Unknown status'
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
    if (diffM < 60) return `${diffM}m ago`
    if (diffM < 1440) return `${Math.floor(diffM / 60)}h ago`
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
        await filesStore.deleteFile(fileId.value)
        router.push('/app/dashboard')
    } catch (e) {
        error.value = 'Failed to delete file.'
    }
}

onMounted(async () => {
    try {
        const data = await filesStore.getFileDetails(fileId.value)
        file.value = data
    } catch (e) {
        error.value = 'Could not load file details.'
    } finally {
        isLoading.value = false
    }
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

/* ─── Back ───────────────────────────────────────────────────────────────── */
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

/* ─── Loading / Error ────────────────────────────────────────────────────── */
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
    border: 2px solid #E5E7EB;
    border-top-color: #7C3AED;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
}

.mini-spinner {
    width: 18px;
    height: 18px;
    border-color: rgba(255, 255, 255, 0.4);
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
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid #FCA5A5;
    border-radius: 12px;
    color: #fca5a5;
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
    background: rgba(34, 197, 94, 0.08);
    border-color: #bbf7d0;
}

.banner-error {
    background: #fef2f2;
    border-color: #fca5a5;
}

.banner-processing {
    background: #eff6ff;
    border-color: #bfdbfe;
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
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
}

.banner-error .banner-icon {
    background: rgba(248, 113, 113, 0.12);
    color: #dc2626;
}

.banner-processing .banner-icon {
    background: rgba(96, 165, 250, 0.12);
    color: #2563eb;
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
    background: #7C3AED;
    color: #fff;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
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
    background: rgba(251, 191, 36, 0.08);
    border: 1px solid #FDE68A;
    border-radius: 12px;
}

.warnings-header {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 600;
    color: #fcd34d;
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
    color: #78350F;
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
    background: #7C3AED;
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
    background: #E5E7EB;
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

/* ─── Responsive ─────────────────────────────────────────────────────────── */
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