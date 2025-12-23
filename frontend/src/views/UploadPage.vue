<template>
    <div class="max-w-4xl mx-auto p-6 lg:p-8">
        <!-- Back Button -->
        <button @click="goBack" class="mb-6 flex items-center text-gray-600 hover:text-atabai-violet transition-colors">
            <ArrowLeftIcon class="h-5 w-5 mr-2" />
            {{ $t('upload.backToDashboard') }}
        </button>

        <!-- Template Header -->
        <div class="mb-8">
            <div class="flex items-center mb-4">
                <div
                    class="w-16 h-16 bg-gradient-to-br from-accent/10 to-atabai-violet/10 rounded-xl flex items-center justify-center mr-4">
                    <component :is="currentTemplate?.icon" class="h-8 w-8 text-atabai-violet" />
                </div>
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">{{ currentTemplate?.name }}</h1>
                    <div class="flex items-center mt-2">
                        <span class="text-sm font-medium text-atabai-violet bg-atabai-violet/10 px-3 py-1 rounded">
                            {{ currentTemplate?.standard }}
                        </span>
                        <span class="text-sm text-gray-500 ml-3">{{ currentTemplate?.category }}</span>
                    </div>
                </div>
            </div>
            <p class="text-gray-600 leading-relaxed">{{ currentTemplate?.description }}</p>
        </div>

        <!-- File Upload Section -->
        <div class="bg-white border border-gray-200 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('upload.uploadSection') }}</h2>

            <!-- Upload Instructions -->
            <div class="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 class="text-sm font-medium text-blue-900 mb-2">{{ $t('upload.expectedFormat') }}</h3>
                <ul class="text-sm text-blue-800 space-y-1">
                    <li v-for="instruction in uploadInstructions" :key="instruction">• {{ instruction }}</li>
                </ul>
            </div>

            <!-- File Drop Zone -->
            <div @drop="handleDrop" @dragover.prevent @dragenter.prevent
                class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-atabai-violet transition-colors"
                :class="{ 'border-atabai-violet bg-atabai-violet/5': isDragOver }">
                <div v-if="!selectedFile">
                    <CloudArrowUpIcon class="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('upload.dropZone.title') }}</h3>
                    <p class="text-gray-500 mb-4">{{ $t('upload.dropZone.subtitle') }}</p>
                    <input ref="fileInput" type="file" @change="handleFileSelect" accept=".xlsx,.xls" class="hidden" />
                    <button @click="$refs.fileInput.click()"
                        class="bg-atabai-violet text-white px-6 py-2 rounded-lg hover:bg-atabai-violet/90 transition-colors">
                        {{ $t('upload.dropZone.chooseFile') }}
                    </button>
                    <p class="text-xs text-gray-400 mt-2">{{ $t('upload.dropZone.supportedFormats') }}</p>
                </div>

                <!-- Selected File Preview -->
                <div v-else class="space-y-4">
                    <div class="flex items-center justify-center space-x-3">
                        <DocumentIcon class="h-8 w-8 text-green-600" />
                        <div class="text-left">
                            <p class="font-medium text-gray-900">{{ selectedFile.name }}</p>
                            <p class="text-sm text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
                        </div>
                    </div>

                    <!-- Upload Progress -->
                    <div v-if="isProcessing" class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-atabai-violet h-2 rounded-full transition-all duration-300"
                            :style="{ width: uploadProgress + '%' }"></div>
                    </div>
                    <p v-if="isProcessing" class="text-sm text-gray-600">{{ uploadProgress }}% {{ $t('common.uploading')
                        }}</p>

                    <div class="flex space-x-3 justify-center">
                        <button @click="processFile" :disabled="isProcessing"
                            class="bg-atabai-violet text-white px-6 py-2 rounded-lg hover:bg-atabai-violet/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <span v-if="!isProcessing">{{ $t('upload.selectedFile.processFile') }}</span>
                            <span v-else class="flex items-center">
                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                {{ $t('upload.selectedFile.processing') }}
                            </span>
                        </button>
                        <button @click="clearFile" :disabled="isProcessing"
                            class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors">
                            {{ $t('upload.selectedFile.chooseDifferent') }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Error Display -->
            <div v-if="uploadError" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p class="text-red-800">{{ uploadError }}</p>
            </div>
        </div>

        <!-- Previously Processed Files for this Template -->
        <div v-if="templateId" class="bg-white border border-gray-200 rounded-xl p-6 mb-8">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h2 class="text-xl font-semibold text-gray-900">{{ $t('upload.recentFiles.title', {
                        template:
                        currentTemplate?.name }) }}</h2>
                    <p class="text-sm text-gray-500 mt-1">{{ $t('upload.recentFiles.description') }}</p>
                </div>
                <button @click="viewAllTemplateFiles"
                    class="text-sm text-atabai-violet hover:text-atabai-violet/80 transition-colors">
                    {{ $t('upload.recentFiles.viewAll') }}
                </button>
            </div>

            <!-- Loading State -->
            <div v-if="templateFilesLoading" class="flex items-center justify-center py-8">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-atabai-violet mx-auto"></div>
                    <p class="mt-2 text-sm text-gray-500">{{ $t('upload.recentFiles.loading') }}</p>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else-if="recentTemplateFiles.length === 0" class="text-center py-8">
                <DocumentIcon class="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 class="text-sm font-medium text-gray-900 mb-1">{{ $t('upload.recentFiles.empty') }}</h3>
                <p class="text-xs text-gray-500">{{ $t('upload.recentFiles.emptyAction', {
                    template:
                    currentTemplate?.name }) }}</p>
            </div>

            <!-- Files List -->
            <div v-else class="space-y-3">
                <div v-for="file in recentTemplateFiles" :key="file.id"
                    class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div class="flex items-center space-x-3 flex-1 min-w-0">
                        <DocumentIcon class="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div class="min-w-0">
                            <p class="text-sm font-medium text-gray-900 truncate">{{ file.originalName }}</p>
                            <div class="flex items-center space-x-3">
                                <p class="text-xs text-gray-500">{{ formatDate(file.createdAt) }}</p>
                                <span :class="statusClasses(file.status)"
                                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
                                    {{ $t(`processing.status.${file.status}`) }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center space-x-2">
                        <!-- View Results -->
                        <button v-if="file.status === 'completed'" @click="viewFile(file)"
                            class="p-1.5 text-atabai-violet hover:bg-atabai-violet/10 rounded-lg transition-colors"
                            :title="$t('history.actions.view')">
                            <EyeIcon class="h-4 w-4" />
                        </button>

                        <!-- View Processing -->
                        <button v-else-if="['processing', 'pending'].includes(file.status)"
                            @click="viewProcessing(file)"
                            class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            :title="$t('history.actions.viewProcessing')">
                            <ClockIcon class="h-4 w-4" />
                        </button>

                        <!-- Download -->
                        <button v-if="file.status === 'completed'" @click="downloadFile(file)"
                            :disabled="file.downloading"
                            class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            :title="$t('history.actions.download')">
                            <ArrowDownTrayIcon v-if="!file.downloading" class="h-4 w-4" />
                            <div v-else
                                class="h-4 w-4 animate-spin border-2 border-green-600 border-t-transparent rounded-full">
                            </div>
                        </button>

                        <!-- Retry -->
                        <button v-if="file.status === 'failed'" @click="retryFile(file)" :disabled="file.retrying"
                            class="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                            :title="$t('history.actions.retry')">
                            <ArrowPathIcon v-if="!file.retrying" class="h-4 w-4" />
                            <div v-else
                                class="h-4 w-4 animate-spin border-2 border-yellow-600 border-t-transparent rounded-full">
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sample Data Format -->
        <div class="bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('upload.sampleFormat.title') }}</h2>
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                        <tr class="bg-gray-50">
                            <th v-for="header in sampleHeaders" :key="header"
                                class="border border-gray-300 px-3 py-2 text-left font-medium text-gray-900">
                                {{ header }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, index) in sampleData" :key="index">
                            <td v-for="(cell, cellIndex) in row" :key="cellIndex"
                                class="border border-gray-300 px-3 py-2 text-gray-700">
                                {{ cell }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="text-sm text-gray-500 mt-3">
                {{ $t('upload.sampleFormat.description') }}
            </p>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTemplatesStore } from '@/stores/templates'
import { useFilesStore } from '@/stores/files'
import {
    ArrowLeftIcon,
    CloudArrowUpIcon,
    DocumentIcon,
    EyeIcon,
    ClockIcon,
    ArrowDownTrayIcon,
    ArrowPathIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const templatesStore = useTemplatesStore()
const filesStore = useFilesStore()

// State
const selectedFile = ref(null)
const isProcessing = ref(false)
const isDragOver = ref(false)
const uploadError = ref('')
const templateFilesLoading = ref(false)
const uploadProgress = computed(() => filesStore.uploadProgress)

// Get template from query params
const templateId = computed(() => route.query.template)
const currentTemplate = computed(() => {
    if (!templateId.value) return null
    return templatesStore.availableTemplates.find(t => t.id === templateId.value)
})

// Get recent files for this template from cache
const recentTemplateFiles = computed(() => {
    if (!templateId.value) return []
    return filesStore.getTemplateFilesFromCache(templateId.value).slice(0, 10)
})

// Template-specific configurations
const uploadInstructions = computed(() => {
    const instructionsKey = `upload.instructions.${templateId.value}`
    return t(instructionsKey, { returnObjects: true })
})

const sampleHeaders = computed(() => {
    const headersKey = `upload.sampleHeaders.${templateId.value}`
    return t(headersKey, { returnObjects: true })
})

const sampleData = computed(() => {
    const dataKey = `upload.sampleData.${templateId.value}`
    return t(dataKey, { returnObjects: true })
})

onMounted(async () => {
    // Redirect if no template specified
    if (!templateId.value) {
        router.push('/dashboard')
        return
    }

    console.log('Template ID:', templateId.value)
    console.log('Checking key:', `upload.instructions.${templateId.value}`)
    console.log('Translation result:', t('upload.instructions.balanceSheet'))
    console.log('Another i18n test:', t('processing.status.pending'))

    // Load recent files for this template
    await loadTemplateFiles()
})

// Methods
function goBack() {
    router.push('/dashboard')
}

async function loadTemplateFiles() {
    if (!templateId.value) return

    try {
        templateFilesLoading.value = true
        await filesStore.fetchTemplateFiles(templateId.value, { limit: 10 })
    } catch (error) {
        console.error('Failed to load template files:', error)
    } finally {
        templateFilesLoading.value = false
    }
}

function handleDrop(event) {
    event.preventDefault()
    isDragOver.value = false

    const files = event.dataTransfer.files
    if (files.length > 0) {
        handleFileSelect({ target: { files } })
    }
}

function handleFileSelect(event) {
    const files = event.target.files
    if (!files.length) return

    const file = files[0]

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        uploadError.value = 'Please select a valid Excel file (.xlsx or .xls)'
        return
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
        uploadError.value = 'File size must be less than 50MB'
        return
    }

    selectedFile.value = file
    uploadError.value = ''
}

function clearFile() {
    selectedFile.value = null
    uploadError.value = ''
    // Clear any previous upload progress
    filesStore.uploadProgress = 0
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function processFile() {
    if (!selectedFile.value || !templateId.value) return

    try {
        isProcessing.value = true
        uploadError.value = ''

        // Upload file using the correct method name and signature
        const result = await filesStore.uploadFile(selectedFile.value, templateId.value, (progress) => {
            // Progress is handled automatically by the store
            console.log(`Upload progress: ${progress}%`)
        })

        if (result && result.jobId) {
            // Refresh template files after upload
            await loadTemplateFiles()

            // Redirect to processing status page
            router.push(`/app/processing/${result.jobId}`)
        }

    } catch (error) {
        uploadError.value = error.message || 'Failed to process file. Please try again.'
        console.error('File processing error:', error)
    } finally {
        isProcessing.value = false
    }
}

function viewAllTemplateFiles() {
    router.push(`/app/history?template=${templateId.value}`)
}

function viewFile(file) {
    router.push(`/app/files/${file.id}`)
}

function viewProcessing(file) {
    if (file.jobId) {
        router.push(`/app/processing/${file.jobId}`)
    }
}

async function downloadFile(file) {
    try {
        file.downloading = true
        await filesStore.downloadFile(file.id, 'processed')
    } catch (error) {
        console.error('Download failed:', error)
    } finally {
        file.downloading = false
    }
}

async function retryFile(file) {
    try {
        file.retrying = true
        await filesStore.retryProcessing(file.jobId)
        // Refresh template files after retry
        await loadTemplateFiles()
    } catch (error) {
        console.error('Retry failed:', error)
    } finally {
        file.retrying = false
    }
}

function formatDate(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))

    if (diffInMinutes < 1) {
        return 'Just now'
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes}min ago`
    } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60)
        return `${hours}h ago`
    } else if (diffInMinutes < 2880) {
        return 'Yesterday'
    } else {
        return date.toLocaleDateString()
    }
}

function statusClasses(status) {
    const classes = {
        'completed': 'bg-green-100 text-green-800',
        'processing': 'bg-blue-100 text-blue-800',
        'failed': 'bg-red-100 text-red-800',
        'pending': 'bg-yellow-100 text-yellow-800',
        'uploaded': 'bg-gray-100 text-gray-800'
    }
    return classes[status] || 'bg-gray-100 text-gray-800'
}
</script>