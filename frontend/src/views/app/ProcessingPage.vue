<template>
    <div class="proc-page">

        <!-- File context pill -->
        <div class="proc-file-pill">
            <DocumentIcon class="w-4 h-4" />
            <span>{{ fileName }}</span>
            <span class="proc-file-sep">·</span>
            <span class="proc-template-tag">{{ templateLabel }}</span>
        </div>

        <!-- Main card -->
        <div class="proc-card" :class="cardClass">

            <!-- State: processing / pending -->
            <template v-if="jobStatus === 'processing' || jobStatus === 'pending' || jobStatus === 'uploaded'">
                <div class="proc-anim-ring">
                    <div class="proc-ring-outer"></div>
                    <div class="proc-ring-inner"></div>
                    <div class="proc-ring-icon">
                        <BoltIcon class="w-6 h-6" />
                    </div>
                </div>

                <h1 class="proc-title">Transforming to IFRS</h1>
                <p class="proc-sub">Mapping NSBU accounts and generating the structured report…</p>

                <!-- Progress bar -->
                <div class="proc-progress-wrap">
                    <div class="proc-progress-track">
                        <div class="proc-progress-fill" :style="{ width: `${progress}%` }"></div>
                    </div>
                    <span class="proc-progress-pct">{{ progress }}%</span>
                </div>

                <!-- Step indicators -->
                <div class="proc-steps">
                    <div v-for="step in steps" :key="step.key" class="proc-step" :class="stepClass(step)">
                        <div class="proc-step-dot">
                            <CheckIcon v-if="step.completed" class="w-3 h-3" />
                            <div v-else-if="step.active" class="proc-step-pulse"></div>
                        </div>
                        <span class="proc-step-label">{{ $t(`processing.steps.${step.key}`) }}</span>
                    </div>
                </div>
            </template>

            <!-- State: completed -->
            <template v-else-if="jobStatus === 'completed'">
                <div class="proc-done-icon">
                    <CheckCircleIcon class="w-8 h-8" />
                </div>

                <h1 class="proc-title proc-title-done">Transformation complete</h1>
                <p class="proc-sub">Your IFRS report is ready to download.</p>

                <!-- Result stats -->
                <div v-if="jobResult" class="proc-result-stats">
                    <div class="proc-result-stat">
                        <div class="proc-result-val">{{ jobResult.transformations || 0 }}</div>
                        <div class="proc-result-label">Rows transformed</div>
                    </div>
                    <div class="proc-result-divider"></div>
                    <div class="proc-result-stat">
                        <div class="proc-result-val">{{ jobResult.changes || 0 }}</div>
                        <div class="proc-result-label">Line items mapped</div>
                    </div>
                    <div v-if="processingDuration" class="proc-result-divider"></div>
                    <div v-if="processingDuration" class="proc-result-stat">
                        <div class="proc-result-val">{{ processingDuration }}</div>
                        <div class="proc-result-label">Processing time</div>
                    </div>
                </div>

                <div class="proc-done-actions">
                    <button class="proc-btn-primary" @click="downloadResults" :disabled="isDownloading">
                        <div v-if="isDownloading" class="btn-spinner"></div>
                        <ArrowDownTrayIcon v-else class="w-4 h-4" />
                        {{ isDownloading ? 'Downloading…' : 'Download IFRS file' }}
                    </button>
                    <button class="proc-btn-secondary" @click="viewDetails">
                        <EyeIcon class="w-4 h-4" />
                        View details
                    </button>
                </div>
            </template>

            <!-- State: failed -->
            <template v-else-if="jobStatus === 'failed'">
                <div class="proc-fail-icon">
                    <XCircleIcon class="w-8 h-8" />
                </div>

                <h1 class="proc-title proc-title-fail">Processing failed</h1>
                <p class="proc-sub">Something went wrong while transforming your file.</p>

                <div v-if="errorMessage" class="proc-error-msg">
                    <ExclamationCircleIcon class="w-4 h-4 flex-shrink-0" />
                    {{ errorMessage }}
                </div>

                <div class="proc-done-actions">
                    <button class="proc-btn-primary" @click="retryProcessing" :disabled="isRetrying">
                        <div v-if="isRetrying" class="btn-spinner"></div>
                        <ArrowPathIcon v-else class="w-4 h-4" />
                        {{ isRetrying ? 'Retrying…' : 'Retry' }}
                    </button>
                    <button class="proc-btn-secondary" @click="router.push('/app/upload')">
                        Upload different file
                    </button>
                </div>
            </template>
        </div>

        <!-- Bottom nav -->
        <div class="proc-bottom-nav">
            <button class="proc-nav-link" @click="router.push('/app/dashboard')">
                <Squares2X2Icon class="w-4 h-4" />
                Dashboard
            </button>
            <button class="proc-nav-link" @click="router.push('/app/history')">
                <ArchiveBoxIcon class="w-4 h-4" />
                All files
            </button>
        </div>

    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'
import {
    DocumentIcon, BoltIcon, CheckIcon, CheckCircleIcon,
    XCircleIcon, ArrowPathIcon, ArrowDownTrayIcon,
    ExclamationCircleIcon, EyeIcon,
    Squares2X2Icon, ArchiveBoxIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const filesStore = useFilesStore()

const jobData = ref(null)
const isDownloading = ref(false)
const isRetrying = ref(false)
const statusInterval = ref(null)

const jobId = computed(() => route.params.jobId)
const jobStatus = computed(() => jobData.value?.status || 'pending')
const progress = computed(() => jobData.value?.progress || 0)
const fileName = computed(() => jobData.value?.fileName || 'Processing file…')
const errorMessage = computed(() => jobData.value?.error)
const jobResult = computed(() => jobData.value?.result)

const templateLabels = {
    balanceSheet: 'Balance Sheet',
    cashFlow: 'Cash Flow',
    profitLoss: 'P&L (Budget)',
    profitLossForm2: 'P&L (Form 2)',
    equity: 'Changes in Equity',
}
const templateLabel = computed(() => templateLabels[jobData.value?.templateType] || jobData.value?.templateType || '')

const processingDuration = computed(() => {
    if (!jobData.value?.duration) return null
    const s = Math.round(jobData.value.duration / 1000)
    return s < 60 ? `${s}s` : `${Math.round(s / 60)}m`
})

const steps = computed(() => [
    { key: 'upload', completed: progress.value >= 10, active: progress.value < 10 && progress.value > 0 },
    { key: 'validation', completed: progress.value >= 30, active: progress.value >= 10 && progress.value < 30 },
    { key: 'transformation', completed: progress.value >= 70, active: progress.value >= 30 && progress.value < 70 },
    { key: 'completion', completed: progress.value >= 100, active: progress.value >= 70 && progress.value < 100 },
])

const cardClass = computed(() => ({
    'card-done': jobStatus.value === 'completed',
    'card-fail': jobStatus.value === 'failed',
}))

function stepClass(step) {
    return {
        'step-done': step.completed,
        'step-active': step.active,
        'step-idle': !step.completed && !step.active,
    }
}

async function loadJobStatus() {
    if (!jobId.value) return
    try {
        const data = await filesStore.getProcessingStatus(jobId.value)
        if (data) {
            jobData.value = data
            if (['completed', 'failed'].includes(data.status) && data.fileId) {
                filesStore.updateFileStatus(data.fileId, data.status, { result: data.result })
                clearStatusPolling()
            }
        }
    } catch (e) {
        console.error('Failed to load job status:', e)
    }
}

function startStatusPolling() {
    statusInterval.value = setInterval(loadJobStatus, 2000)
}

function clearStatusPolling() {
    if (statusInterval.value) {
        clearInterval(statusInterval.value)
        statusInterval.value = null
    }
}

async function downloadResults() {
    if (!jobData.value?.fileId) return
    try {
        isDownloading.value = true
        await filesStore.downloadFile(jobData.value.fileId, 'processed')
    } catch (e) {
        console.error('Download failed:', e)
    } finally {
        isDownloading.value = false
    }
}

function viewDetails() {
    if (jobData.value?.fileId) {
        router.push(`/app/files/${jobData.value.fileId}`)
    }
}

async function retryProcessing() {
    try {
        isRetrying.value = true
        const result = await filesStore.retryProcessing(jobId.value)
        if (result) {
            jobData.value = result
            startStatusPolling()
        }
    } catch (e) {
        console.error('Retry failed:', e)
    } finally {
        isRetrying.value = false
    }
}

onMounted(() => {
    if (!jobId.value) { router.push('/app/dashboard'); return }
    loadJobStatus()
    startStatusPolling()
})

onUnmounted(() => clearStatusPolling())
</script>

<style scoped>
/* ─── Page ───────────────────────────────────────────────────────────────── */
.proc-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 40px 24px 48px;
    gap: 24px;
}

/* ─── File pill ──────────────────────────────────────────────────────────── */
.proc-file-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 100px;
    font-size: 13px;
    color: #374151;
    font-weight: 500;
    max-width: 480px;
    overflow: hidden;
}

.proc-file-pill span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.proc-file-sep {
    color: #D1D5DB;
}

.proc-template-tag {
    font-size: 11.5px;
    font-weight: 600;
    color: #7C3AED;
    background: rgba(124, 58, 237, 0.08);
    padding: 2px 8px;
    border-radius: 6px;
    flex-shrink: 0;
}

/* ─── Card ───────────────────────────────────────────────────────────────── */
.proc-card {
    width: 100%;
    max-width: 480px;
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 20px;
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    text-align: center;
}

.proc-card.card-done {
    border-color: #bbf7d0;
    background: linear-gradient(180deg, #f0fdf4 0%, #fff 40%);
}

.proc-card.card-fail {
    border-color: #fca5a5;
    background: linear-gradient(180deg, #fef2f2 0%, #fff 40%);
}

/* ─── Processing animation ───────────────────────────────────────────────── */
.proc-anim-ring {
    position: relative;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.proc-ring-outer {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid rgba(124, 58, 237, 0.15);
    border-top-color: #7C3AED;
    animation: ring-spin 1.2s linear infinite;
}

.proc-ring-inner {
    position: absolute;
    inset: 10px;
    border-radius: 50%;
    border: 2px solid rgba(124, 58, 237, 0.08);
    border-bottom-color: #A78BFA;
    animation: ring-spin 0.9s linear infinite reverse;
}

.proc-ring-icon {
    position: relative;
    color: #7C3AED;
    animation: icon-pulse 1.5s ease-in-out infinite;
}

@keyframes ring-spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes icon-pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.4;
    }
}

/* ─── Done / fail icons ──────────────────────────────────────────────────── */
.proc-done-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #dcfce7;
    color: #16a34a;
    display: flex;
    align-items: center;
    justify-content: center;
}

.proc-fail-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #fee2e2;
    color: #dc2626;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* ─── Title / sub ────────────────────────────────────────────────────────── */
.proc-title {
    font-size: 20px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.02em;
    margin: 0;
}

.proc-title-done {
    color: #14532d;
}

.proc-title-fail {
    color: #7f1d1d;
}

.proc-sub {
    font-size: 14px;
    color: #9CA3AF;
    margin: -12px 0 0;
    line-height: 1.5;
}

/* ─── Progress ───────────────────────────────────────────────────────────── */
.proc-progress-wrap {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
}

.proc-progress-track {
    flex: 1;
    height: 6px;
    background: #F3F4F6;
    border-radius: 10px;
    overflow: hidden;
}

.proc-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7C3AED, #A78BFA);
    border-radius: 10px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.proc-progress-pct {
    font-size: 13px;
    font-weight: 700;
    color: #7C3AED;
    min-width: 36px;
    text-align: right;
}

/* ─── Steps ──────────────────────────────────────────────────────────────── */
.proc-steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    align-items: flex-start;
}

.proc-step {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    font-weight: 500;
}

.proc-step-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.step-done .proc-step-dot {
    background: #dcfce7;
    color: #16a34a;
}

.step-done {
    color: #374151;
}

.step-active .proc-step-dot {
    background: rgba(124, 58, 237, 0.1);
}

.step-active {
    color: #7C3AED;
}

.step-idle .proc-step-dot {
    background: #F3F4F6;
}

.step-idle {
    color: #D1D5DB;
}

.proc-step-label {}

.proc-step-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #7C3AED;
    animation: pulse-dot 1s ease-in-out infinite;
}

@keyframes pulse-dot {

    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }

    50% {
        opacity: 0.5;
        transform: scale(0.8);
    }
}

/* ─── Result stats ───────────────────────────────────────────────────────── */
.proc-result-stats {
    display: flex;
    align-items: center;
    gap: 0;
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    overflow: hidden;
    width: 100%;
}

.proc-result-stat {
    flex: 1;
    padding: 14px 16px;
    text-align: center;
}

.proc-result-val {
    font-size: 22px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.02em;
    margin-bottom: 3px;
}

.proc-result-label {
    font-size: 11px;
    color: #9CA3AF;
    font-weight: 500;
}

.proc-result-divider {
    width: 1px;
    height: 40px;
    background: #E5E7EB;
    flex-shrink: 0;
}

/* ─── Error msg ──────────────────────────────────────────────────────────── */
.proc-error-msg {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #FEF2F2;
    border: 1px solid #FCA5A5;
    border-radius: 8px;
    font-size: 13px;
    color: #B91C1C;
    width: 100%;
    text-align: left;
}

/* ─── Action buttons ─────────────────────────────────────────────────────── */
.proc-done-actions {
    display: flex;
    gap: 10px;
    width: 100%;
}

.proc-btn-primary {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 11px 20px;
    background: #7C3AED;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;
}

.proc-btn-primary:hover:not(:disabled) {
    background: #6D28D9;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
}

.proc-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.proc-btn-secondary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 11px 16px;
    background: #F3F4F6;
    color: #374151;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
}

.proc-btn-secondary:hover {
    background: #E5E7EB;
}

.btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ring-spin 0.7s linear infinite;
    flex-shrink: 0;
}

/* ─── Bottom nav ─────────────────────────────────────────────────────────── */
.proc-bottom-nav {
    display: flex;
    align-items: center;
    gap: 24px;
}

.proc-nav-link {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #9CA3AF;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
}

.proc-nav-link:hover {
    color: #374151;
}
</style>