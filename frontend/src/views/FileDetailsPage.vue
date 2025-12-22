<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <div class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between py-6">
                    <div class="flex items-center space-x-4">
                        <button @click="goBack" class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <ArrowLeftIcon class="h-5 w-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 class="text-2xl font-bold text-gray-900">
                                {{ $t('results.title') }}
                            </h1>
                            <p class="text-sm text-gray-500" v-if="fileData">
                                {{ fileData.originalName }}
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center space-x-3">
                        <!-- Status Badge -->
                        <span v-if="fileData" :class="statusClasses(fileData.status)"
                            class="px-3 py-1 rounded-full text-sm font-medium">
                            {{ $t(`processing.status.${fileData.status}`) }}
                        </span>

                        <!-- Download Button -->
                        <button v-if="fileData && fileData.hasProcessedFile" @click="downloadProcessedFile"
                            :disabled="isDownloading"
                            class="flex items-center px-4 py-2 bg-atabai-violet text-white rounded-lg hover:bg-atabai-violet/90 transition-colors disabled:opacity-50">
                            <ArrowDownTrayIcon v-if="!isDownloading" class="h-4 w-4 mr-2" />
                            <div v-else class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {{ isDownloading ? $t('common.downloading') : $t('common.download') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex items-center justify-center py-12">
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-atabai-violet mx-auto"></div>
                <p class="mt-4 text-gray-600">{{ $t('common.loading') }}</p>
            </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <ExclamationTriangleIcon class="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 class="text-lg font-medium text-red-800 mb-2">{{ $t('results.error.title') }}</h3>
                <p class="text-red-600 mb-4">{{ error }}</p>
                <button @click="fetchFileData"
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                    {{ $t('common.retry') }}
                </button>
            </div>
        </div>

        <!-- Main Content -->
        <div v-else-if="fileData" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Processing Summary -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <!-- Overview Card -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center mb-4">
                        <DocumentTextIcon class="h-8 w-8 text-atabai-violet mr-3" />
                        <h2 class="text-lg font-semibold text-gray-900">{{ $t('results.overview.title') }}</h2>
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">{{ $t('results.overview.template') }}</span>
                            <span class="font-medium text-gray-900">
                                {{ $t(`templates.${fileData.templateType}`) }}
                            </span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">{{ $t('results.overview.processed') }}</span>
                            <span class="font-medium text-gray-900">{{ formatDate(fileData.completedAt) }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">{{ $t('results.overview.size') }}</span>
                            <span class="font-medium text-gray-900">{{ formatFileSize(fileData.fileSize) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Transformations Card -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center mb-4">
                        <Cog6ToothIcon class="h-8 w-8 text-green-500 mr-3" />
                        <h2 class="text-lg font-semibold text-gray-900">{{ $t('results.transformations.title') }}</h2>
                    </div>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">{{ $t('results.transformations.total') }}</span>
                            <span class="font-medium text-green-600 text-xl">{{ fileData.transformations || 0 }}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">{{ $t('results.transformations.changes') }}</span>
                            <span class="font-medium text-gray-900">{{ fileData.changes || 0 }}</span>
                        </div>
                    </div>
                </div>

                <!-- Warnings Card -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div class="flex items-center mb-4">
                        <ExclamationTriangleIcon :class="[
                            'h-8 w-8 mr-3',
                            (fileData.warnings && fileData.warnings.length > 0) ? 'text-yellow-500' : 'text-gray-400'
                        ]" />
                        <h2 class="text-lg font-semibold text-gray-900">{{ $t('results.warnings.title') }}</h2>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-gray-600">{{ $t('results.warnings.total') }}</span>
                        <span :class="[
                            'font-medium text-xl',
                            (fileData.warnings && fileData.warnings.length > 0) ? 'text-yellow-600' : 'text-gray-400'
                        ]">
                            {{ (fileData.warnings && fileData.warnings.length) || 0 }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Warnings List -->
            <div v-if="fileData.warnings && fileData.warnings.length > 0"
                class="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                <div class="flex items-center mb-4">
                    <ExclamationTriangleIcon class="h-6 w-6 text-yellow-500 mr-2" />
                    <h3 class="text-lg font-medium text-yellow-800">{{ $t('results.warnings.details') }}</h3>
                </div>
                <div class="space-y-2">
                    <div v-for="(warning, index) in fileData.warnings" :key="index"
                        class="bg-white border border-yellow-200 rounded p-3">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <span :class="[
                                    'inline-block w-2 h-2 rounded-full mt-2',
                                    getSeverityColor(warning.severity)
                                ]"></span>
                            </div>
                            <div class="ml-3 flex-1">
                                <p class="text-sm text-gray-900">{{ warning.message }}</p>
                                <div class="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                                    <span v-if="warning.row">{{ $t('results.warnings.row') }}: {{ warning.row }}</span>
                                    <span v-if="warning.severity" class="capitalize">{{ warning.severity }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Data Comparison -->
            <div v-if="beforeData && afterData" class="space-y-8">
                <!-- Before/After Toggle -->
                <div class="flex items-center justify-center">
                    <div class="bg-white rounded-lg border border-gray-200 p-1 inline-flex">
                        <button @click="activeView = 'before'" :class="[
                            'px-6 py-2 rounded-md text-sm font-medium transition-colors',
                            activeView === 'before'
                                ? 'bg-atabai-violet text-white'
                                : 'text-gray-700 hover:text-gray-900'
                        ]">
                            {{ $t('results.comparison.before') }}
                        </button>
                        <button @click="activeView = 'after'" :class="[
                            'px-6 py-2 rounded-md text-sm font-medium transition-colors',
                            activeView === 'after'
                                ? 'bg-atabai-violet text-white'
                                : 'text-gray-700 hover:text-gray-900'
                        ]">
                            {{ $t('results.comparison.after') }}
                        </button>
                        <button @click="activeView = 'side-by-side'" :class="[
                            'px-6 py-2 rounded-md text-sm font-medium transition-colors',
                            activeView === 'side-by-side'
                                ? 'bg-atabai-violet text-white'
                                : 'text-gray-700 hover:text-gray-900'
                        ]">
                            {{ $t('results.comparison.sideBySide') }}
                        </button>
                    </div>
                </div>

                <!-- Pagination Controls for Side-by-Side View -->
                <div v-if="activeView === 'side-by-side' && maxRows > 0"
                    class="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-6 py-4">
                    <div class="flex items-center space-x-4">
                        <span class="text-sm text-gray-700">{{ $t('results.pagination.rowsPerPage') }}</span>
                        <div class="w-24">
                            <Select v-model="rowsPerPage" :options="rowsPerPageOptions" @change="resetToFirstPage" />
                        </div>
                    </div>

                    <div class="flex items-center space-x-4">
                        <span class="text-sm text-gray-700">
                            {{ $t('results.pagination.showing', {
                                start: startRow,
                                end: endRow,
                                total: maxRows
                            }) }}
                        </span>

                        <div class="flex space-x-2">
                            <button @click="previousPage" :disabled="currentPage === 1"
                                class="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                                {{ $t('results.pagination.previous') }}
                            </button>

                            <span class="px-3 py-1 text-sm text-gray-700">
                                {{ $t('results.pagination.page') }} {{ currentPage }} {{ $t('results.pagination.of') }}
                                {{ totalPages }}
                            </span>

                            <button @click="nextPage" :disabled="currentPage === totalPages"
                                class="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                                {{ $t('results.pagination.next') }}
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Data Tables -->
                <div class="grid gap-8" :class="{
                    'grid-cols-1': activeView !== 'side-by-side',
                    'grid-cols-1 lg:grid-cols-2': activeView === 'side-by-side'
                }">
                    <!-- Before Data -->
                    <div v-if="activeView === 'before' || activeView === 'side-by-side'"
                        class="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div class="px-6 py-4 border-b border-gray-200">
                            <h3 class="text-lg font-medium text-gray-900">{{ $t('results.comparison.beforeData') }}</h3>
                            <p class="text-sm text-gray-500">{{ $t('results.comparison.originalFormat') }}</p>
                        </div>
                        <div ref="beforeTableContainer" class="overflow-x-auto max-h-96 overflow-y-auto"
                            @scroll="onScrollBefore">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th v-for="(header, index) in beforeData.headers"
                                            :key="`before-header-${index}`"
                                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            {{ header }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    <tr v-for="(row, rowIndex) in paginatedBeforeRows"
                                        :key="`before-row-${startRowIndex + rowIndex}`"
                                        :data-row-index="startRowIndex + rowIndex"
                                        @mouseenter="highlightRow(startRowIndex + rowIndex)"
                                        @mouseleave="unhighlightRow"
                                        :class="{ 'bg-blue-50': highlightedRowIndex === startRowIndex + rowIndex }">
                                        <td v-for="(cell, cellIndex) in row"
                                            :key="`before-cell-${startRowIndex + rowIndex}-${cellIndex}`"
                                            class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {{ formatCellValue(cell) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-if="activeView === 'before' && beforeData.totalRows > 10"
                            class="px-6 py-3 bg-gray-50 border-t border-gray-200">
                            <p class="text-sm text-gray-500">
                                {{ $t('results.comparison.showingRows', {
                                    shown: Math.min(10, beforeData.rows.length),
                                    total: beforeData.totalRows
                                }) }}
                            </p>
                        </div>
                    </div>

                    <!-- After Data -->
                    <div v-if="activeView === 'after' || activeView === 'side-by-side'"
                        class="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div class="px-6 py-4 border-b border-gray-200">
                            <h3 class="text-lg font-medium text-gray-900">{{ $t('results.comparison.afterData') }}</h3>
                            <p class="text-sm text-gray-500">{{ $t('results.comparison.ifrsFormat') }}</p>
                        </div>
                        <div ref="afterTableContainer" class="overflow-x-auto max-h-96 overflow-y-auto"
                            @scroll="onScrollAfter">
                            <table class="min-w-full divide-y divide-gray-200">
                                <thead class="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th v-for="(header, index) in afterData.headers" :key="`after-header-${index}`"
                                            :class="[
                                                'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider',
                                                isIFRSColumn(header) ? 'text-atabai-violet bg-purple-50' : 'text-gray-500'
                                            ]">
                                            {{ header }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    <tr v-for="(row, rowIndex) in paginatedAfterRows"
                                        :key="`after-row-${startRowIndex + rowIndex}`"
                                        :data-row-index="startRowIndex + rowIndex"
                                        @mouseenter="highlightRow(startRowIndex + rowIndex)"
                                        @mouseleave="unhighlightRow"
                                        :class="{ 'bg-blue-50': highlightedRowIndex === startRowIndex + rowIndex }">
                                        <td v-for="(cell, cellIndex) in row"
                                            :key="`after-cell-${startRowIndex + rowIndex}-${cellIndex}`" :class="[
                                                'px-6 py-4 whitespace-nowrap text-sm',
                                                isIFRSColumn(afterData.headers[cellIndex])
                                                    ? 'text-atabai-violet bg-purple-50 font-medium'
                                                    : 'text-gray-900'
                                            ]">
                                            {{ formatCellValue(cell) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div v-if="activeView === 'after' && afterData.totalRows > 10"
                            class="px-6 py-3 bg-gray-50 border-t border-gray-200">
                            <p class="text-sm text-gray-500">
                                {{ $t('results.comparison.showingRows', {
                                    shown: Math.min(10, afterData.rows.length),
                                    total: afterData.totalRows
                                }) }}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- IFRS Compliance Notes -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
                <div class="flex items-center mb-4">
                    <DocumentCheckIcon class="h-6 w-6 text-blue-500 mr-2" />
                    <h3 class="text-lg font-medium text-blue-800">{{ $t('results.compliance.title') }}</h3>
                </div>
                <div class="space-y-3 text-sm text-blue-700">
                    <p v-for="note in getComplianceNotes(fileData.templateType)" :key="note" class="flex items-start">
                        <CheckCircleIcon class="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                        {{ note }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'

// UI Components
import Select from '@/components/ui/Select.vue'

// Icons
import {
    ArrowLeftIcon,
    ArrowDownTrayIcon,
    DocumentTextIcon,
    Cog6ToothIcon,
    ExclamationTriangleIcon,
    DocumentCheckIcon,
    CheckCircleIcon
} from '@heroicons/vue/24/outline'

// Composables
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const filesStore = useFilesStore()

// State
const isLoading = ref(true)
const isDownloading = ref(false)
const error = ref(null)
const fileData = ref(null)
const beforeData = ref(null)
const afterData = ref(null)
const activeView = ref('after')

// Pagination state
const currentPage = ref(1)
const rowsPerPage = ref(25)
const highlightedRowIndex = ref(null)

// Scroll synchronization state
const isScrollingSyncBefore = ref(false)
const isScrollingSyncAfter = ref(false)
const beforeTableContainer = ref(null)
const afterTableContainer = ref(null)

// Get file ID from route
const fileId = computed(() => route.params.fileId)

// Pagination computed properties
const maxRows = computed(() => {
    if (!beforeData.value || !afterData.value) return 0
    return Math.max(beforeData.value.rows?.length || 0, afterData.value.rows?.length || 0)
})

const totalPages = computed(() => Math.ceil(maxRows.value / rowsPerPage.value))

const startRowIndex = computed(() => (currentPage.value - 1) * rowsPerPage.value)

const startRow = computed(() => startRowIndex.value + 1)

const endRow = computed(() => Math.min(startRowIndex.value + rowsPerPage.value, maxRows.value))

const rowsPerPageOptions = computed(() => [
    { value: 10, label: '10' },
    { value: 25, label: '25' },
    { value: 50, label: '50' },
    { value: 100, label: '100' }
])

const paginatedBeforeRows = computed(() => {
    if (!beforeData.value?.rows) return []
    const start = startRowIndex.value
    const end = start + rowsPerPage.value
    return beforeData.value.rows.slice(start, end)
})

const paginatedAfterRows = computed(() => {
    if (!afterData.value?.rows) return []
    const start = startRowIndex.value
    const end = start + rowsPerPage.value
    return afterData.value.rows.slice(start, end)
})

// Methods
function goBack() {
    router.back()
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

function formatDate(dateString) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString()
}

function formatFileSize(bytes) {
    if (!bytes) return '-'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

function formatCellValue(value) {
    if (value === null || value === undefined) return ''
    if (typeof value === 'number' && value % 1 !== 0) {
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
    return String(value)
}

function getSeverityColor(severity) {
    const colors = {
        'error': 'bg-red-500',
        'warning': 'bg-yellow-500',
        'info': 'bg-blue-500'
    }
    return colors[severity] || 'bg-gray-500'
}

function isIFRSColumn(header) {
    if (!header) return false
    const headerLower = header.toLowerCase()
    return headerLower.includes('ifrs') ||
        headerLower.includes('ias') ||
        headerLower.includes('compliance') ||
        headerLower.includes('impairment') ||
        headerLower.includes('depreciation rate') ||
        headerLower.includes('transaction price') ||
        headerLower.includes('recoverable amount')
}

function getComplianceNotes(templateType) {
    const notes = {
        depreciation: [
            t('results.compliance.depreciation.1'),
            t('results.compliance.depreciation.2'),
            t('results.compliance.depreciation.3'),
            t('results.compliance.depreciation.4')
        ],
        discounts: [
            t('results.compliance.discounts.1'),
            t('results.compliance.discounts.2'),
            t('results.compliance.discounts.3'),
            t('results.compliance.discounts.4')
        ],
        impairment: [
            t('results.compliance.impairment.1'),
            t('results.compliance.impairment.2'),
            t('results.compliance.impairment.3'),
            t('results.compliance.impairment.4')
        ]
    }
    return notes[templateType] || []
}

// Pagination methods
function nextPage() {
    if (currentPage.value < totalPages.value) {
        currentPage.value++
    }
}

function previousPage() {
    if (currentPage.value > 1) {
        currentPage.value--
    }
}

function resetToFirstPage() {
    currentPage.value = 1
}

// Row highlighting methods
function highlightRow(rowIndex) {
    highlightedRowIndex.value = rowIndex
}

function unhighlightRow() {
    highlightedRowIndex.value = null
}

// Scroll synchronization methods
function onScrollBefore(event) {
    if (isScrollingSyncBefore.value || activeView.value !== 'side-by-side') return

    isScrollingSyncAfter.value = true
    if (afterTableContainer.value) {
        afterTableContainer.value.scrollTop = event.target.scrollTop
        afterTableContainer.value.scrollLeft = event.target.scrollLeft
    }

    nextTick(() => {
        isScrollingSyncAfter.value = false
    })
}

function onScrollAfter(event) {
    if (isScrollingSyncAfter.value || activeView.value !== 'side-by-side') return

    isScrollingSyncBefore.value = true
    if (beforeTableContainer.value) {
        beforeTableContainer.value.scrollTop = event.target.scrollTop
        beforeTableContainer.value.scrollLeft = event.target.scrollLeft
    }

    nextTick(() => {
        isScrollingSyncBefore.value = false
    })
}

async function fetchFileData() {
    try {
        isLoading.value = true
        error.value = null

        const response = await filesStore.getFileDetails(fileId.value)

        if (response.success) {
            fileData.value = response.file
            beforeData.value = response.file.beforeData
            afterData.value = response.file.afterData
        } else {
            error.value = response.message || t('results.error.fetchFailed')
        }
    } catch (err) {
        console.error('Error fetching file details:', err)
        error.value = t('results.error.fetchFailed')
    } finally {
        isLoading.value = false
    }
}

async function downloadProcessedFile() {
    try {
        isDownloading.value = true
        await filesStore.downloadFile(fileId.value, true) // true for processed file
    } catch (err) {
        console.error('Error downloading file:', err)
        // Error handling could be improved with a toast notification
    } finally {
        isDownloading.value = false
    }
}

// Load file data on mount
onMounted(() => {
    fetchFileData()
})
</script>

<style scoped>
/* Custom scrollbar for tables */
.overflow-x-auto::-webkit-scrollbar {
    height: 6px;
}

.overflow-x-auto::-webkit-scrollbar-track {
    background: transparent;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}
</style>