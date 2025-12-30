<template>
    <div class="max-w-4xl mx-auto p-6 lg:p-8">
        <!-- Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ $t('processing.title') }}</h1>
            <p class="text-gray-600">{{ statusDescription }}</p>
        </div>

        <!-- Processing Status Card -->
        <div class="bg-white border border-gray-200 rounded-xl p-8 mb-8">
            <!-- Status Icon and Title -->
            <div class="text-center mb-8">
                <div class="relative inline-flex items-center justify-center w-20 h-20 mx-auto mb-4">
                    <!-- Processing Spinner -->
                    <div v-if="jobStatus === 'processing'"
                        class="animate-spin rounded-full h-16 w-16 border-4 border-atabai-violet border-t-transparent">
                    </div>

                    <!-- Completed Check -->
                    <CheckCircleIcon v-else-if="jobStatus === 'completed'" class="h-16 w-16 text-green-600" />

                    <!-- Processing File -->
                    <ArrowPathIcon v-else-if="jobStatus === 'processing'" class="h-16 w-16 text-atabai-violet" />

                    <!-- Pending Processing -->
                    <ExclamationCircleIcon v-else-if="jobStatus === 'pending'" class="h-16 w-16 text-gray-600" />

                    <!-- Failed X -->
                    <XCircleIcon v-else-if="jobStatus === 'failed'" class="h-16 w-16 text-red-600" />

                    <!-- Pending Clock -->
                    <ClockIcon v-else class="h-16 w-16 text-gray-400" />
                </div>

                <h2 class="text-2xl font-semibold mb-2 text-gray-600">
                    {{ statusTitle }}
                </h2>

                <p class="text-gray-600">{{ fileName }}</p>
            </div>

            <!-- Progress Bar -->
            <div v-if="jobStatus !== 'failed'" class="mb-8">
                <div class="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{{ $t('processing.progress') }}</span>
                    <span>{{ progress }}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-gradient-to-r from-atabai-violet to-accent h-2 rounded-full transition-all duration-500 ease-out"
                        :style="{ width: `${progress}%` }"></div>
                </div>
            </div>

            <!-- Processing Steps -->
            <div class="space-y-4 mb-8">
                <div v-for="(step, index) in processingSteps" :key="step.key" class="flex items-center" :class="{
                    'text-green-600': step.completed,
                    'text-atabai-violet': step.active,
                    'text-gray-400': !step.completed && !step.active
                }">
                    <div class="flex items-center justify-center w-8 h-8 rounded-full mr-4" :class="{
                        'bg-green-100': step.completed,
                        'bg-atabai-violet bg-opacity-10': step.active,
                        'bg-gray-100': !step.completed && !step.active
                    }">
                        <CheckIcon v-if="step.completed" class="h-4 w-4" />
                        <div v-else-if="step.active" class="w-2 h-2 rounded-full bg-atabai-violet animate-pulse"></div>
                        <span v-else class="text-sm font-medium">{{ index + 1 }}</span>
                    </div>
                    <span class="font-medium text-gray-600">{{ $t(`processing.steps.${step.key}`) }}</span>
                </div>
            </div>

            <!-- Error Message -->
            <div v-if="jobStatus === 'failed' && errorMessage"
                class="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 class="text-red-800 font-medium mb-2">{{ $t('processing.error') }}</h3>
                <p class="text-red-700 text-sm">{{ errorMessage }}</p>
            </div>

            <!-- Results Summary (for completed jobs) -->
            <div v-if="jobStatus === 'completed' && jobResult"
                class="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
                <h3 class="text-green-800 font-semibold mb-4">{{ $t('processing.results.title') }}</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">{{ jobResult.transformations || 0 }}</div>
                        <div class="text-gray-600">{{ $t('processing.results.transformations') }}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">{{ jobResult.changes || 0 }}</div>
                        <div class="text-gray-600">{{ $t('processing.results.changes') }}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-green-600">{{ jobResult.processedRows || 0 }}</div>
                        <div class="text-gray-600">{{ $t('processing.results.rows') }}</div>
                    </div>
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-3 justify-center">
                <!-- Download Button (completed) -->
                <button v-if="jobStatus === 'completed'" @click="downloadResults" :disabled="isDownloading"
                    class="bg-atabai-violet text-white px-6 py-3 rounded-lg hover:bg-atabai-violet/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <span v-if="!isDownloading">{{ $t('processing.actions.download') }}</span>
                    <span v-else class="flex items-center">
                        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {{ $t('processing.actions.downloading') }}
                    </span>
                </button>

                <!-- Retry Button (failed) -->
                <button v-if="jobStatus === 'failed'" @click="retryProcessing" :disabled="isRetrying"
                    class="bg-atabai-violet text-white px-6 py-3 rounded-lg hover:bg-atabai-violet/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <span v-if="!isRetrying">{{ $t('processing.actions.retry') }}</span>
                    <span v-else>{{ $t('processing.actions.retrying') }}</span>
                </button>

                <!-- Back to Dashboard -->
                <button @click="goToDashboard"
                    class="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors">
                    {{ $t('processing.actions.backToDashboard') }}
                </button>

                <!-- Upload New File -->
                <button @click="uploadNewFile"
                    class="border border-atabai-violet text-atabai-violet px-6 py-3 rounded-lg hover:bg-atabai-violet hover:text-white transition-colors">
                    {{ $t('processing.actions.uploadNew') }}
                </button>
            </div>
        </div>

        <!-- Processing Time Info -->
        <div v-if="processingDuration" class="text-center text-sm text-gray-500">
            {{ $t('processing.duration', { duration: processingDuration }) }}
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'
import {
    ExclamationCircleIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    XCircleIcon,
    ClockIcon,
    CheckIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const filesStore = useFilesStore()

// State
const jobData = ref(null)
const isDownloading = ref(false)
const isRetrying = ref(false)
const statusInterval = ref(null)

// Get job ID from route
const jobId = computed(() => route.params.jobId)

// Job status computed properties
const jobStatus = computed(() => jobData.value?.status || 'pending')
const progress = computed(() => jobData.value?.progress || 0)
const fileName = computed(() => jobData.value?.fileName || 'Unknown file')
const errorMessage = computed(() => jobData.value?.error)
const jobResult = computed(() => jobData.value?.result)

const processingDuration = computed(() => {
    if (!jobData.value?.duration) return null
    const seconds = Math.round(jobData.value.duration / 1000)
    if (seconds < 60) {
        return t('processing.timeFormat.seconds', { count: seconds })
    }
    const minutes = Math.round(seconds / 60)
    return t('processing.timeFormat.minutes', { count: minutes })
})

const statusTitle = computed(() => {
    const statusMap = {
        pending: t('processing.status.pending'),
        processing: t('processing.status.processing'),
        completed: t('processing.status.completed'),
        failed: t('processing.status.failed')
    }
    return statusMap[jobStatus.value] || jobStatus.value
})

const statusDescription = computed(() => {
    const descMap = {
        pending: t('processing.statusDescription.pending'),
        processing: t('processing.statusDescription.processing'),
        completed: t('processing.statusDescription.completed'),
        failed: t('processing.statusDescription.failed')
    }
    return descMap[jobStatus.value] || ''
})

const processingSteps = computed(() => {
    const steps = [
        { key: 'upload', completed: progress.value >= 10, active: progress.value < 10 && progress.value > 0 },
        { key: 'validation', completed: progress.value >= 30, active: progress.value >= 10 && progress.value < 30 },
        { key: 'transformation', completed: progress.value >= 70, active: progress.value >= 30 && progress.value < 70 },
        { key: 'completion', completed: progress.value >= 100, active: progress.value >= 70 && progress.value < 100 }
    ]
    return steps
})

// Methods
async function loadJobStatus() {
    try {
        if (!jobId.value) return

        const data = await filesStore.getProcessingStatus(jobId.value)
        if (data) {
            jobData.value = data

            // Update the file status in the store when it reaches final status
            if (['completed', 'failed'].includes(data.status) && data.fileId) {
                filesStore.updateFileStatus(data.fileId, data.status, {
                    result: data.result,
                    duration: data.duration
                })
            }

            // Stop polling if job is complete or failed
            if (['completed', 'failed'].includes(data.status)) {
                clearStatusPolling()
            }
        }
    } catch (error) {
        console.error('Failed to load job status:', error)
    }
}

function startStatusPolling() {
    // Poll every 2 seconds
    statusInterval.value = setInterval(loadJobStatus, 2000)
}

function clearStatusPolling() {
    if (statusInterval.value) {
        clearInterval(statusInterval.value)
        statusInterval.value = null
    }
}

async function downloadResults() {
    try {
        isDownloading.value = true

        if (jobData.value?.fileId) {
            await filesStore.downloadFile(jobData.value.fileId, 'processed')
        }
    } catch (error) {
        console.error('Download failed:', error)
        // Show error message to user
    } finally {
        isDownloading.value = false
    }
}

async function retryProcessing() {
    try {
        isRetrying.value = true

        const result = await filesStore.retryProcessing(jobId.value)
        if (result) {
            jobData.value = result
            startStatusPolling() // Resume polling
        }
    } catch (error) {
        console.error('Retry failed:', error)
        // Show error message to user
    } finally {
        isRetrying.value = false
    }
}

function goToDashboard() {
    router.push('/app/dashboard')
}

function uploadNewFile() {
    router.push('/app/upload')
}

// Lifecycle
onMounted(() => {
    if (!jobId.value) {
        router.push('/app/dashboard')
        return
    }

    loadJobStatus()

    // Start polling if job is not complete
    if (!['completed', 'failed'].includes(jobStatus.value)) {
        startStatusPolling()
    }
})

onUnmounted(() => {
    clearStatusPolling()
})
</script>