<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <div class="bg-white shadow-sm border-b border-gray-200">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex items-center justify-between py-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">
                            {{ $t('history.title') }}
                        </h1>
                        <p class="text-sm text-gray-500 mt-1">
                            {{ $t('history.subtitle') }}
                        </p>
                    </div>
                    <button @click="navigateToUpload"
                        class="flex items-center px-4 py-2 bg-atabai-violet text-white rounded-lg hover:bg-atabai-violet/90 transition-colors">
                        <PlusIcon class="h-4 w-4 mr-2" />
                        {{ $t('dashboard.newProject') }}
                    </button>
                </div>
            </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Filters and Search -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <!-- Search -->
                    <div>
                        <Input v-model="filters.search" type="search" :label="$t('history.filters.search')"
                            :placeholder="$t('history.filters.searchPlaceholder')" :leading-icon="MagnifyingGlassIcon"
                            @input="debouncedSearch" />
                    </div>

                    <!-- Status Filter -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            {{ $t('history.filters.status') }}
                        </label>
                        <Select v-model="filters.status" :options="statusOptions"
                            :placeholder="$t('history.filters.allStatuses')" @change="handleStatusChange" />
                    </div>

                    <!-- Template Filter -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            {{ $t('history.filters.template') }}
                        </label>
                        <Select v-model="filters.templateType" :options="templateOptions"
                            :placeholder="$t('history.filters.allTemplates')" @change="handleTemplateChange" />
                    </div>

                    <!-- Date Range Filter -->
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            {{ $t('history.filters.dateRange') }}
                        </label>
                        <Select v-model="filters.dateRange" :options="dateRangeOptions"
                            :placeholder="$t('history.filters.allDates')" @change="handleDateRangeChange" />
                    </div>
                </div>

                <!-- Clear Filters -->
                <div class="mt-4 flex items-center justify-between">
                    <button v-if="hasActiveFilters" @click="clearFilters"
                        class="text-sm text-atabai-violet hover:text-atabai-violet/80 transition-colors">
                        {{ $t('history.filters.clearAll') }}
                    </button>
                    <div class="text-sm text-gray-500">
                        {{ $t('history.showingResults', {
                            count: filteredFiles.length,
                            total: filesStore.recentFiles.length
                        }) }}
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div v-if="filesStore.isLoading" class="flex items-center justify-center py-12">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-atabai-violet mx-auto"></div>
                    <p class="mt-4 text-gray-600">{{ $t('common.loading') }}</p>
                </div>
            </div>

            <!-- Error State -->
            <div v-else-if="filesStore.error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <ExclamationTriangleIcon class="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 class="text-lg font-medium text-red-800 mb-2">{{ $t('history.error.title') }}</h3>
                <p class="text-red-600 mb-4">{{ filesStore.error }}</p>
                <button @click="refreshFiles"
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                    {{ $t('common.retry') }}
                </button>
            </div>

            <!-- Empty State -->
            <div v-else-if="filteredFiles.length === 0 && !hasActiveFilters"
                class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <DocumentIcon class="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('history.empty.title') }}</h3>
                <p class="text-gray-500 mb-6">{{ $t('history.empty.description') }}</p>
                <button @click="navigateToUpload"
                    class="inline-flex items-center px-4 py-2 bg-atabai-violet text-white rounded-lg hover:bg-atabai-violet/90 transition-colors">
                    <PlusIcon class="h-4 w-4 mr-2" />
                    {{ $t('history.empty.uploadFirst') }}
                </button>
            </div>

            <!-- No Results State -->
            <div v-else-if="filteredFiles.length === 0 && hasActiveFilters"
                class="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <FunnelIcon class="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('history.noResults.title') }}</h3>
                <p class="text-gray-500 mb-6">{{ $t('history.noResults.description') }}</p>
                <button @click="clearFilters"
                    class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                    {{ $t('history.filters.clearAll') }}
                </button>
            </div>

            <!-- Files List -->
            <div v-else class="space-y-4">
                <!-- Files Grid/List -->
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <!-- Table Header -->
                    <div class="px-6 py-3 bg-gray-50 border-b border-gray-200">
                        <div class="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <div class="col-span-4">{{ $t('history.table.fileName') }}</div>
                            <div class="col-span-2">{{ $t('history.table.template') }}</div>
                            <div class="col-span-2">{{ $t('history.table.status') }}</div>
                            <div class="col-span-2">{{ $t('history.table.processed') }}</div>
                            <div class="col-span-2">{{ $t('history.table.actions') }}</div>
                        </div>
                    </div>

                    <!-- Table Body -->
                    <div class="divide-y divide-gray-200">
                        <div v-for="file in paginatedFiles" :key="file.id"
                            class="px-6 py-4 hover:bg-gray-50 transition-colors">
                            <div class="grid grid-cols-12 gap-4 items-center">
                                <!-- File Name -->
                                <div class="col-span-4">
                                    <div class="flex items-center">
                                        <DocumentIcon class="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                                        <div class="min-w-0">
                                            <p class="text-sm font-medium text-gray-900 truncate">
                                                {{ file.originalName }}
                                            </p>
                                            <p class="text-xs text-gray-500">
                                                {{ formatFileSize(file.fileSize) }}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <!-- Template -->
                                <div class="col-span-2">
                                    <span
                                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                        :class="templateClasses(file.templateType)">
                                        {{ $t(`templates.${file.templateType}`) }}
                                    </span>
                                </div>

                                <!-- Status -->
                                <div class="col-span-2">
                                    <span
                                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                        :class="statusClasses(file.status)">
                                        {{ $t(`processing.status.${file.status}`) }}
                                    </span>
                                </div>

                                <!-- Date -->
                                <div class="col-span-2">
                                    <div class="text-sm text-gray-900">
                                        {{ formatDate(file.createdAt) }}
                                    </div>
                                    <div v-if="file.completedAt" class="text-xs text-gray-500">
                                        {{ $t('history.table.completed') }}: {{ formatTime(file.completedAt) }}
                                    </div>
                                </div>

                                <!-- Actions -->
                                <div class="col-span-2">
                                    <div class="flex items-center space-x-2">
                                        <!-- View Button -->
                                        <button v-if="file.status === 'completed'" @click="viewFile(file)"
                                            class="p-1.5 text-atabai-violet hover:bg-atabai-violet/10 rounded-lg transition-colors"
                                            :title="$t('history.actions.view')">
                                            <EyeIcon class="h-4 w-4" />
                                        </button>

                                        <!-- Processing Button -->
                                        <button v-else-if="file.status === 'processing' || file.status === 'pending'"
                                            @click="viewProcessing(file)"
                                            class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            :title="$t('history.actions.viewProcessing')">
                                            <ClockIcon class="h-4 w-4" />
                                        </button>

                                        <!-- Download Button -->
                                        <button v-if="file.status === 'completed'" @click="downloadFile(file)"
                                            :disabled="file.downloading"
                                            class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                            :title="$t('history.actions.download')">
                                            <ArrowDownTrayIcon v-if="!file.downloading" class="h-4 w-4" />
                                            <div v-else
                                                class="h-4 w-4 animate-spin border-2 border-green-600 border-t-transparent rounded-full">
                                            </div>
                                        </button>

                                        <!-- Retry Button -->
                                        <button v-if="file.status === 'failed'" @click="retryFile(file)"
                                            :disabled="file.retrying"
                                            class="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors disabled:opacity-50"
                                            :title="$t('history.actions.retry')">
                                            <ArrowPathIcon v-if="!file.retrying" class="h-4 w-4" />
                                            <div v-else
                                                class="h-4 w-4 animate-spin border-2 border-yellow-600 border-t-transparent rounded-full">
                                            </div>
                                        </button>

                                        <!-- Delete Button -->
                                        <button @click="deleteFile(file)" :disabled="file.deleting"
                                            class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                            :title="$t('history.actions.delete')">
                                            <TrashIcon v-if="!file.deleting" class="h-4 w-4" />
                                            <div v-else
                                                class="h-4 w-4 animate-spin border-2 border-red-600 border-t-transparent rounded-full">
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-3">
                    <div class="flex items-center justify-between">
                        <div class="text-sm text-gray-500">
                            {{ $t('history.pagination.showing', {
                                start: ((currentPage - 1) * itemsPerPage) + 1,
                                end: Math.min(currentPage * itemsPerPage, filteredFiles.length),
                                total: filteredFiles.length
                            }) }}
                        </div>
                        <div class="flex items-center space-x-2">
                            <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1"
                                class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                {{ $t('history.pagination.previous') }}
                            </button>

                            <div class="flex items-center space-x-1">
                                <button v-for="page in visiblePages" :key="page" @click="currentPage = page" :class="[
                                    'px-3 py-1 text-sm rounded-lg transition-colors',
                                    currentPage === page
                                        ? 'bg-atabai-violet text-white'
                                        : 'border border-gray-300 hover:bg-gray-50'
                                ]">
                                    {{ page }}
                                </button>
                            </div>

                            <button @click="currentPage = Math.min(totalPages, currentPage + 1)"
                                :disabled="currentPage === totalPages"
                                class="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                {{ $t('history.pagination.next') }}
                            </button>
                        </div>
                    </div>
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
import { debounce } from 'lodash-es'

// Icons
import {
    PlusIcon,
    MagnifyingGlassIcon,
    DocumentIcon,
    ExclamationTriangleIcon,
    FunnelIcon,
    EyeIcon,
    ArrowDownTrayIcon,
    ClockIcon,
    ArrowPathIcon,
    TrashIcon
} from '@heroicons/vue/24/outline'

// Composables
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const filesStore = useFilesStore()

// State
const currentPage = ref(1)
const itemsPerPage = ref(20)

// Filters - initialize from URL params if available
const filters = ref({
    search: route.query.search || '',
    status: route.query.status || '',
    templateType: route.query.template || '',
    dateRange: route.query.dateRange || ''
})

// Computed
const hasActiveFilters = computed(() => {
    return filters.value.search ||
        filters.value.status ||
        filters.value.templateType ||
        filters.value.dateRange
})

// Use files directly from store to avoid unnecessary copying
const allFiles = computed(() => {
    // Add reactive properties for UI state
    return filesStore.recentFiles.map(file => ({
        ...file,
        downloading: file.downloading || false,
        retrying: file.retrying || false,
        deleting: file.deleting || false
    }))
})

// Options for Select components
const statusOptions = computed(() => [
    { value: '', label: t('history.filters.allStatuses') },
    { value: 'completed', label: t('processing.status.completed') },
    { value: 'processing', label: t('processing.status.processing') },
    { value: 'failed', label: t('processing.status.failed') },
    { value: 'pending', label: t('processing.status.pending') }
])

const templateOptions = computed(() => [
    { value: '', label: t('history.filters.allTemplates') },
    { value: 'depreciation', label: t('templates.depreciation') },
    { value: 'discounts', label: t('templates.discounts') },
    { value: 'impairment', label: t('templates.impairment') }
])

const dateRangeOptions = computed(() => [
    { value: '', label: t('history.filters.allDates') },
    { value: 'today', label: t('history.filters.today') },
    { value: 'week', label: t('history.filters.thisWeek') },
    { value: 'month', label: t('history.filters.thisMonth') },
    { value: 'quarter', label: t('history.filters.thisQuarter') }
])

const filteredFiles = computed(() => {
    let result = [...allFiles.value]

    // Search filter
    if (filters.value.search) {
        const search = filters.value.search.toLowerCase()
        result = result.filter(file =>
            file.originalName.toLowerCase().includes(search)
        )
    }

    // Status filter
    if (filters.value.status) {
        result = result.filter(file => file.status === filters.value.status)
    }

    // Template filter
    if (filters.value.templateType) {
        result = result.filter(file => file.templateType === filters.value.templateType)
    }

    // Date range filter
    if (filters.value.dateRange) {
        const now = new Date()
        const startDate = new Date()

        switch (filters.value.dateRange) {
            case 'today':
                startDate.setHours(0, 0, 0, 0)
                break
            case 'week':
                startDate.setDate(now.getDate() - 7)
                break
            case 'month':
                startDate.setMonth(now.getMonth() - 1)
                break
            case 'quarter':
                startDate.setMonth(now.getMonth() - 3)
                break
        }

        result = result.filter(file => new Date(file.createdAt) >= startDate)
    }

    return result
})

const paginatedFiles = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value
    const end = start + itemsPerPage.value
    return filteredFiles.value.slice(start, end)
})

const totalPages = computed(() => {
    return Math.ceil(filteredFiles.value.length / itemsPerPage.value)
})

const visiblePages = computed(() => {
    const pages = []
    const total = totalPages.value
    const current = currentPage.value

    let start = Math.max(1, current - 2)
    let end = Math.min(total, start + 4)

    if (end - start < 4) {
        start = Math.max(1, end - 4)
    }

    for (let i = start; i <= end; i++) {
        pages.push(i)
    }

    return pages
})

// Methods
const debouncedSearch = debounce(() => {
    applyFilters()
}, 300)

function applyFilters() {
    currentPage.value = 1
    updateURL()
}

function updateURL() {
    // Update URL with current filter state
    const query = {}
    if (filters.value.search) query.search = filters.value.search
    if (filters.value.status) query.status = filters.value.status
    if (filters.value.templateType) query.template = filters.value.templateType
    if (filters.value.dateRange) query.dateRange = filters.value.dateRange

    router.replace({ query })
}

function handleStatusChange(value) {
    filters.value.status = value
    applyFilters()
}

function handleTemplateChange(value) {
    filters.value.templateType = value
    applyFilters()
}

function handleDateRangeChange(value) {
    filters.value.dateRange = value
    applyFilters()
}

function clearFilters() {
    filters.value = {
        search: '',
        status: '',
        templateType: '',
        dateRange: ''
    }
    currentPage.value = 1
    updateURL()
}

async function refreshFiles() {
    try {
        await filesStore.fetchRecentFiles(true) // Force refresh
    } catch (error) {
        console.error('Failed to refresh files:', error)
    }
}

function navigateToUpload() {
    router.push('/app/upload')
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
    } catch (err) {
        console.error('Download failed:', err)
    } finally {
        file.downloading = false
    }
}

async function retryFile(file) {
    try {
        file.retrying = true
        await filesStore.retryProcessing(file.jobId)
        // Refresh files after retry
        await refreshFiles()
    } catch (err) {
        console.error('Retry failed:', err)
    } finally {
        file.retrying = false
    }
}

async function deleteFile(file) {
    if (!confirm(t('history.actions.confirmDelete', { name: file.originalName }))) {
        return
    }

    try {
        file.deleting = true
        await filesStore.deleteFile(file.id)
        // No need to manually refresh - store handles removal
    } catch (err) {
        console.error('Delete failed:', err)
    } finally {
        file.deleting = false
    }
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString()
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString()
}

function formatFileSize(bytes) {
    if (!bytes) return '-'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
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

function templateClasses(templateType) {
    const classes = {
        'depreciation': 'bg-purple-100 text-purple-800',
        'discounts': 'bg-blue-100 text-blue-800',
        'impairment': 'bg-orange-100 text-orange-800'
    }
    return classes[templateType] || 'bg-gray-100 text-gray-800'
}

// Watchers
watch(() => currentPage.value, () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
})

watch(() => route.query, (newQuery) => {
    // Update filters when URL changes (e.g., from external navigation)
    filters.value = {
        search: newQuery.search || '',
        status: newQuery.status || '',
        templateType: newQuery.template || '',
        dateRange: newQuery.dateRange || ''
    }
}, { immediate: true })

// Load files on mount if not already cached
onMounted(async () => {
    if (filesStore.recentFiles.length === 0) {
        await refreshFiles()
    }
})
</script>

<style scoped>
/* Custom scrollbar */
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