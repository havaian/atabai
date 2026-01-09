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

            <!-- IFRS Balance Sheet Display -->
            <div v-if="ifrsBalanceSheet"
                class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
                <!-- Header Section -->
                <div class="bg-gray-50 border-b border-gray-200 px-6 py-8 text-center">
                    <h1 class="text-2xl font-bold text-gray-900 mb-2">
                        {{ $t('results.balanceSheet.title') }}
                    </h1>
                    <h2 class="text-lg font-semibold text-gray-800 mb-1">
                        {{ ifrsBalanceSheet.companyName }}
                    </h2>
                    <p class="text-sm text-gray-600 mb-1">
                        {{ $t('results.balanceSheet.asAt', { date: ifrsBalanceSheet.reportDate }) }}
                    </p>
                    <p class="text-sm text-gray-600">
                        {{ $t('results.balanceSheet.inn', { inn: ifrsBalanceSheet.inn }) }}
                    </p>
                </div>

                <!-- Table Section -->
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <!-- Column Headers -->
                        <thead class="bg-[#366092]">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                    {{ $t('results.balanceSheet.columns.ifrsCode') }}
                                </th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                    {{ $t('results.balanceSheet.columns.lineItem') }}
                                </th>
                                <th
                                    class="px-6 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                                    {{ $t('results.balanceSheet.columns.nsbuCode') }}
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                                    {{ $t('results.balanceSheet.columns.beginningBalance') }}
                                </th>
                                <th
                                    class="px-6 py-3 text-right text-xs font-medium text-white uppercase tracking-wider">
                                    {{ $t('results.balanceSheet.columns.endingBalance') }}
                                </th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <!-- Iterate through sections -->
                            <template v-for="(section, sectionIndex) in ifrsBalanceSheet.sections" :key="sectionIndex">
                                <!-- Section Header -->
                                <tr class="bg-[#D9E1F2]">
                                    <td colspan="5"
                                        class="px-6 py-3 text-left text-sm font-bold text-gray-900 uppercase">
                                        {{ $t(`results.balanceSheet.sections.${getSectionKey(section.name)}`) }}
                                    </td>
                                </tr>

                                <!-- Section Items -->
                                <tr v-for="(item, itemIndex) in section.items" :key="`${sectionIndex}-${itemIndex}`">
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                                        {{ item.code }}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900 border-r border-gray-200">
                                        {{ item.label }}
                                    </td>
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center border-r border-gray-200">
                                        {{ item.code }}
                                    </td>
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right border-r border-gray-200">
                                        {{ formatNumber(item.start) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                        {{ formatNumber(item.end) }}
                                    </td>
                                </tr>

                                <!-- Section Total -->
                                <tr class="bg-gray-50">
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 border-r border-gray-200">
                                    </td>
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 border-r border-gray-200">
                                        {{ $t('results.balanceSheet.total', {
                                            section:
                                                $t(`results.balanceSheet.sections.${getSectionKey(section.name)}`)
                                        }) }}
                                    </td>
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 border-r border-gray-200">
                                    </td>
                                    <td
                                        class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right border-r border-gray-200">
                                        {{ formatNumber(section.totalStart) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                        {{ formatNumber(section.totalEnd) }}
                                    </td>
                                </tr>
                            </template>

                            <!-- Grand Totals -->
                            <tr class="bg-gray-100 border-t-2 border-gray-300">
                                <td colspan="3" class="px-6 py-4 text-sm font-bold text-gray-900 uppercase">
                                    {{ $t('results.balanceSheet.totalAssets') }}
                                </td>
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right border-r border-gray-200">
                                    {{ formatNumber(ifrsBalanceSheet.totalAssetsStart) }}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                    {{ formatNumber(ifrsBalanceSheet.totalAssetsEnd) }}
                                </td>
                            </tr>

                            <tr class="bg-gray-100">
                                <td colspan="3" class="px-6 py-4 text-sm font-bold text-gray-900 uppercase">
                                    {{ $t('results.balanceSheet.totalEquityLiabilities') }}
                                </td>
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right border-r border-gray-200">
                                    {{ formatNumber(ifrsBalanceSheet.totalEquityLiabStart) }}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                    {{ formatNumber(ifrsBalanceSheet.totalEquityLiabEnd) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- IFRS Compliance Notes -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'

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
const ifrsBalanceSheet = ref(null)

// Get file ID from route
const fileId = computed(() => route.params.fileId)

// Watch for route parameter changes and refetch data
watch(fileId, (newFileId, oldFileId) => {
    if (newFileId && newFileId !== oldFileId) {
        fetchFileData()
    }
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

function formatNumber(value) {
    if (value === null || value === undefined) return '0.00'
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getSeverityColor(severity) {
    const colors = {
        'error': 'bg-red-500',
        'warning': 'bg-yellow-500',
        'info': 'bg-blue-500'
    }
    return colors[severity] || 'bg-gray-500'
}

function getSectionKey(sectionName) {
    const sectionMap = {
        'NON-CURRENT ASSETS': 'nonCurrentAssets',
        'CURRENT ASSETS': 'currentAssets',
        'EQUITY': 'equity',
        'NON-CURRENT LIABILITIES': 'nonCurrentLiabilities',
        'CURRENT LIABILITIES': 'currentLiabilities'
    }
    return sectionMap[sectionName] || sectionName
}

function getComplianceNotes(templateType) {
    const notes = {
        balanceSheet: [
            t('results.compliance.balanceSheet.1'),
            t('results.compliance.balanceSheet.2'),
            t('results.compliance.balanceSheet.3'),
            t('results.compliance.balanceSheet.4')
        ],
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
    return notes[templateType] || notes.balanceSheet
}

async function fetchFileData() {
    try {
        isLoading.value = true
        error.value = null

        const response = await filesStore.getFileDetails(fileId.value)

        if (response.success) {
            fileData.value = response.file

            // Note: We don't show raw Excel preview anymore
            // Users can download the file to inspect it
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
        await filesStore.downloadFile(fileId.value, true)
    } catch (err) {
        console.error('Error downloading file:', err)
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

/* Table cell borders */
table td {
    border-bottom: 1px solid #e5e7eb;
}

table tr:last-child td {
    border-bottom: none;
}
</style>