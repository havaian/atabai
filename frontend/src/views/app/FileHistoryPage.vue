<template>
    <div class="history-page">

        <!-- Header -->
        <div class="history-header">
            <div>
                <h1 class="history-title">{{ $t('history.title') }}</h1>
                <p class="history-sub">{{ $t('history.subtitle') }}</p>
            </div>
            <button class="new-btn" @click="router.push('/app/upload')">
                <PlusIcon class="w-4 h-4" />
                {{ $t('dashboard.newProject') }}
            </button>
        </div>

        <!-- Filter bar -->
        <div class="filter-bar">
            <!-- Search -->
            <div class="search-wrap">
                <AppInput v-model="filters.search" type="search" :placeholder="$t('history.filters.searchPlaceholder')"
                    :leading-icon="MagnifyingGlassIcon" :clearable="true" @input="onSearch" @clear="applyFilters" />
            </div>

            <!-- Status -->
            <AppSelect v-model="filters.status" :options="statusOptions"
                :placeholder="$t('history.filters.allStatuses')" class="filter-select-comp" @change="applyFilters" />

            <!-- Template -->
            <AppSelect v-model="filters.templateType" :options="templateOptions"
                :placeholder="$t('history.filters.allTemplates')" class="filter-select-comp filter-select-wide"
                @change="applyFilters" />

            <!-- Date range -->
            <AppSelect v-model="filters.dateRange" :options="dateOptions" :placeholder="$t('history.filters.allDates')"
                class="filter-select-comp" @change="applyFilters" />

            <!-- Clear filters -->
            <button v-if="hasActiveFilters" class="clear-btn" @click="clearFilters">
                <XMarkIcon class="w-3.5 h-3.5" />
                {{ $t('history.filters.clearAll') }}
            </button>

            <!-- Count -->
            <span class="filter-count">
                {{ filteredFiles.length }} {{ filteredFiles.length === 1 ? $t('history.file') : $t('history.files') }}
            </span>
        </div>

        <!-- Loading -->
        <div v-if="filesStore.isLoading && allFiles.length === 0" class="state-loading">
            <div class="state-spinner"></div>
            <span>{{ $t('common.loading') }}</span>
        </div>

        <!-- Error -->
        <div v-else-if="filesStore.error" class="state-error">
            <ExclamationTriangleIcon class="w-5 h-5" />
            {{ $t('history.error.fetchFailed') }}
            <button class="error-retry" @click="refreshFiles">{{ $t('common.retry') }}</button>
        </div>

        <!-- Empty — no files at all -->
        <div v-else-if="allFiles.length === 0" class="state-empty">
            <div class="empty-icon">
                <DocumentPlusIcon class="w-7 h-7" />
            </div>
            <h3 class="empty-title">{{ $t('history.empty.title') }}</h3>
            <p class="empty-desc">{{ $t('history.empty.description') }}</p>
            <button class="new-btn" @click="router.push('/app/upload')">
                <PlusIcon class="w-4 h-4" />
                {{ $t('history.empty.uploadFirst') }}
            </button>
        </div>

        <!-- Empty — filters returned nothing -->
        <div v-else-if="filteredFiles.length === 0" class="state-empty">
            <div class="empty-icon">
                <FunnelIcon class="w-7 h-7" />
            </div>
            <h3 class="empty-title">{{ $t('history.noResults.title') }}</h3>
            <p class="empty-desc">{{ $t('history.noResults.description') }}</p>
            <button class="clear-btn-lg" @click="clearFilters">{{ $t('history.filters.clearAll') }}</button>
        </div>

        <!-- Files table -->
        <div v-else class="files-card">
            <table class="files-table">
                <thead>
                    <tr class="table-head">
                        <th class="th th-file">{{ $t('history.table.fileName') }}</th>
                        <th class="th th-template">{{ $t('history.table.template') }}</th>
                        <th class="th th-status">{{ $t('history.table.status') }}</th>
                        <th class="th th-date">{{ $t('history.table.processed') }}</th>
                        <th class="th th-actions">{{ $t('history.table.actions') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="file in paginatedFiles" :key="file.id" class="table-row" @click="openFile(file)">

                        <!-- File name -->
                        <td class="td td-file">
                            <div class="file-cell">
                                <DocumentIcon class="w-4 h-4 file-icon flex-shrink-0" />
                                <span class="file-name">{{ file.originalName }}</span>
                            </div>
                        </td>

                        <!-- Template -->
                        <td class="td td-template">
                            <span class="template-tag">{{ formatTemplate(file.templateType) }}</span>
                        </td>

                        <!-- Status -->
                        <td class="td td-status">
                            <span class="status-pill" :class="statusClass(file.status)">
                                {{ $t(`processing.status.${(file.status).toString()}`) }}
                            </span>
                        </td>

                        <!-- Date -->
                        <td class="td td-date">
                            <span class="date-text" :title="formatFullDate(file.createdAt)">
                                {{ formatDate(file.createdAt) }}
                            </span>
                        </td>

                        <!-- Actions -->
                        <td class="td td-actions" @click.stop>
                            <div class="actions-cell">
                                <!-- Download -->
                                <button v-if="file.status === 'completed'" class="action-icon-btn"
                                    :title="$t('history.actions.download')" :disabled="file.downloading"
                                    @click="downloadFile(file)">
                                    <div v-if="file.downloading" class="mini-spin"></div>
                                    <ArrowDownTrayIcon v-else class="w-4 h-4" />
                                </button>

                                <!-- View / Processing -->
                                <button class="action-icon-btn"
                                    :title="file.status === 'completed' ? $t('history.actions.view') : $t('history.actions.viewProcessing')"
                                    @click="openFile(file)">
                                    <EyeIcon class="w-4 h-4" />
                                </button>

                                <!-- Retry -->
                                <button v-if="file.status === 'failed'" class="action-icon-btn"
                                    :title="$t('history.actions.retry')" :disabled="file.retrying"
                                    @click="retryFile(file)">
                                    <div v-if="file.retrying" class="mini-spin"></div>
                                    <ArrowPathIcon v-else class="w-4 h-4" />
                                </button>

                                <!-- Delete -->
                                <button class="action-icon-btn action-icon-danger" :title="$t('history.actions.delete')"
                                    :disabled="file.deleting" @click="deleteFile(file)">
                                    <div v-if="file.deleting" class="mini-spin"></div>
                                    <TrashIcon v-else class="w-4 h-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="pagination">
                <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">
                    <ChevronLeftIcon class="w-4 h-4" />
                </button>
                <button v-for="p in visiblePages" :key="p" class="page-btn page-num"
                    :class="{ 'page-active': p === currentPage }" @click="currentPage = p">
                    {{ p }}
                </button>
                <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">
                    <ChevronRightIcon class="w-4 h-4" />
                </button>
                <span class="page-info">
                    {{ (currentPage - 1) * itemsPerPage + 1 }}–{{ Math.min(currentPage * itemsPerPage,
                        filteredFiles.length) }} {{ $t('history.pagination.of') }} {{ filteredFiles.length }}
                </span>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'
import AppSelect from '@/components/ui/Select.vue'
import AppInput from '@/components/ui/Input.vue'
import { debounce } from 'lodash-es'
import {
    PlusIcon, MagnifyingGlassIcon, XMarkIcon, DocumentIcon, DocumentPlusIcon,
    FunnelIcon, ExclamationTriangleIcon, ArrowDownTrayIcon, EyeIcon,
    ArrowPathIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const filesStore = useFilesStore()

const currentPage = ref(1)
const itemsPerPage = 20

const filters = ref({
    search: route.query.search || '',
    status: route.query.status || '',
    templateType: route.query.template || '',
    dateRange: route.query.dateRange || '',
})

// Local per-row state (downloading / retrying / deleting)
const fileStates = ref({})

const allFiles = computed(() =>
    filesStore.recentFiles.map(f => ({
        ...f,
        downloading: fileStates.value[f.id]?.downloading || false,
        retrying: fileStates.value[f.id]?.retrying || false,
        deleting: fileStates.value[f.id]?.deleting || false,
    }))
)

const hasActiveFilters = computed(() =>
    filters.value.search || filters.value.status ||
    filters.value.templateType || filters.value.dateRange
)

const filteredFiles = computed(() => {
    let result = [...allFiles.value]

    if (filters.value.search) {
        const q = filters.value.search.toLowerCase()
        result = result.filter(f => f.originalName?.toLowerCase().includes(q))
    }
    if (filters.value.status) result = result.filter(f => f.status === filters.value.status)
    if (filters.value.templateType) result = result.filter(f => f.templateType === filters.value.templateType)

    if (filters.value.dateRange) {
        const now = new Date()
        const start = new Date()
        switch (filters.value.dateRange) {
            case 'today': start.setHours(0, 0, 0, 0); break
            case 'week': start.setDate(now.getDate() - 7); break
            case 'month': start.setMonth(now.getMonth() - 1); break
            case 'quarter': start.setMonth(now.getMonth() - 3); break
        }
        result = result.filter(f => new Date(f.createdAt) >= start)
    }

    return result
})

const totalPages = computed(() => Math.ceil(filteredFiles.value.length / itemsPerPage))

const paginatedFiles = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage
    return filteredFiles.value.slice(start, start + itemsPerPage)
})

const visiblePages = computed(() => {
    const pages = []
    const total = totalPages.value
    const cur = currentPage.value
    let start = Math.max(1, cur - 2)
    let end = Math.min(total, start + 4)
    if (end - start < 4) start = Math.max(1, end - 4)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
})


const statusOptions = computed(() => [
    { value: '', label: t('history.filters.allStatuses') },
    { value: 'completed', label: t('processing.status.completed') },
    { value: 'processing', label: t('processing.status.processing') },
    { value: 'failed', label: t('processing.status.failed') },
    { value: 'pending', label: t('processing.status.pending') },
])

const templateOptions = computed(() => [
    { value: '', label: t('history.filters.allTemplates') },
    { value: 'balanceSheet', label: t('templates.balanceSheet') },
    { value: 'cashFlow', label: t('templates.cashFlow') },
    { value: 'profitLoss', label: t('templates.profitLoss') },
    { value: 'profitLossForm2', label: t('templates.profitLossForm2') },
    { value: 'equity', label: t('templates.equity') },
])

const dateOptions = computed(() => [
    { value: '', label: t('history.filters.allDates') },
    { value: 'today', label: t('history.filters.today') },
    { value: 'week', label: t('history.filters.thisWeek') },
    { value: 'month', label: t('history.filters.thisMonth') },
    { value: 'quarter', label: t('history.filters.thisQuarter') },
])

const onSearch = debounce(() => applyFilters(), 250)

function applyFilters() {
    currentPage.value = 1
    const q = {}
    if (filters.value.search) q.search = filters.value.search
    if (filters.value.status) q.status = filters.value.status
    if (filters.value.templateType) q.template = filters.value.templateType
    if (filters.value.dateRange) q.dateRange = filters.value.dateRange
    router.replace({ query: q })
}

function clearFilters() {
    filters.value = { search: '', status: '', templateType: '', dateRange: '' }
    applyFilters()
}

async function refreshFiles() {
    await filesStore.fetchRecentFiles(true)
}

function openFile(file) {
    if (file.status === 'completed') router.push(`/app/files/${file.id}`)
    else if (file.jobId) router.push(`/app/processing/${file.jobId}`)
}

async function downloadFile(file) {
    if (!fileStates.value[file.id]) fileStates.value[file.id] = {}
    fileStates.value[file.id].downloading = true
    try {
        await filesStore.downloadFile(file.id, 'processed')
    } catch (e) { console.error(e) }
    finally { fileStates.value[file.id].downloading = false }
}

async function retryFile(file) {
    if (!fileStates.value[file.id]) fileStates.value[file.id] = {}
    fileStates.value[file.id].retrying = true
    try {
        const result = await filesStore.retryProcessing(file.jobId)
        if (result) router.push(`/app/processing/${file.jobId}`)
    } catch (e) { console.error(e) }
    finally { fileStates.value[file.id].retrying = false }
}

async function deleteFile(file) {
    if (!confirm(t('history.actions.confirmDelete', { name: file.originalName }))) return
    if (!fileStates.value[file.id]) fileStates.value[file.id] = {}
    fileStates.value[file.id].deleting = true
    try {
        await filesStore.deleteFile(file.id)
    } catch (e) { console.error(e) }
    finally { fileStates.value[file.id].deleting = false }
}

function formatTemplate(type) {
    const keys = {
        balanceSheet: 'templates.balanceSheet',
        cashFlow: 'templates.cashFlow',
        profitLoss: 'templates.profitLoss',
        profitLossForm2: 'templates.profitLossForm2',
        equity: 'templates.equity',
    }
    return keys[type] ? t(keys[type]) : type
}

function formatDate(d) {
    if (!d) return '—'
    const date = new Date(d)
    const now = new Date()
    const diffM = Math.floor((now - date) / 60000)
    if (diffM < 1) return t('history.dateJustNow')
    if (diffM < 60) return t('history.dateMinutesAgo', { n: diffM })
    if (diffM < 1440) return t('history.dateHoursAgo', { n: Math.floor(diffM / 60) })
    if (diffM < 2880) return t('history.dateYesterday')
    return date.toLocaleDateString()
}

function formatFullDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleString()
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

watch(() => currentPage.value, () => window.scrollTo({ top: 0, behavior: 'smooth' }))

onMounted(async () => {
    if (filesStore.recentFiles.length === 0) {
        await filesStore.fetchFiles().catch(() => { })
    }
})
</script>

<style scoped>
.history-page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 36px 32px 64px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.history-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
}

.history-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--ws-text);
    letter-spacing: -0.02em;
    margin: 0 0 5px;
}

.history-sub {
    font-size: 13.5px;
    color: var(--ws-text-3);
    margin: 0;
}

.new-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 18px;
    background: #7C3AED;
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

.new-btn:hover {
    background: #6D28D9;
    box-shadow: 0 4px 16px rgba(124, 58, 237, 0.28);
}

/* ─── Filter bar ─────────────────────────────────────────────────────────── */
.filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.filter-select-comp {
    width: 160px;
}

.search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 200px;
    max-width: 280px;
}

.clear-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--ws-border);
    border-radius: 9px;
    font-size: 13px;
    color: var(--ws-text-3);
    cursor: pointer;
    transition: all 0.12s;
    white-space: nowrap;
}

.clear-btn:hover {
    border-color: rgba(240, 236, 246, 0.15);
    background: var(--ws-bg);
}

.filter-count {
    font-size: 12.5px;
    color: var(--ws-text-3);
    margin-left: auto;
    white-space: nowrap;
}

/* ─── States ─────────────────────────────────────────────────────────────── */
.state-loading,
.state-error {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 48px;
    color: var(--ws-text-3);
    font-size: 14px;
    justify-content: center;
}

.state-spinner,
.mini-spin {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(240, 236, 246, 0.1);
    border-top-color: #7C3AED;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
}

.mini-spin {
    width: 14px;
    height: 14px;
    border-width: 1.5px;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.state-error {
    color: #EF4444;
}

.error-retry {
    background: transparent;
    border: none;
    color: #7C3AED;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
}

.state-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 24px;
    background: var(--ws-bg);
    border: 1px dashed rgba(149, 0, 255, 0.15);
    border-radius: 16px;
    text-align: center;
}

.empty-icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(124, 58, 237, 0.08);
    color: #7C3AED;
    display: flex;
    align-items: center;
    justify-content: center;
}

.empty-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--ws-text);
    margin: 0;
}

.empty-desc {
    font-size: 13.5px;
    color: var(--ws-text-3);
    margin: 0;
}

.clear-btn-lg {
    padding: 9px 18px;
    background: transparent;
    border: 1px solid var(--ws-border);
    border-radius: 9px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--ws-text-2);
    cursor: pointer;
    transition: all 0.12s;
}

.clear-btn-lg:hover {
    background: var(--ws-surface-2);
}

/* ─── Table ──────────────────────────────────────────────────────────────── */
.files-card {
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 16px;
    overflow: hidden;
}

.files-table {
    width: 100%;
    border-collapse: collapse;
}

.table-head {
    background: var(--ws-bg);
}

.th {
    padding: 11px 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ws-text-3);
    text-align: left;
    border-bottom: 1px solid var(--ws-border-2);
}

.table-row {
    cursor: pointer;
    transition: background 0.1s;
    border-bottom: 1px solid var(--ws-border-2);
}

.table-row:last-child {
    border-bottom: none;
}

.table-row:hover {
    background: var(--ws-bg);
}

.td {
    padding: 13px 16px;
    font-size: 13.5px;
    color: var(--ws-text-2);
    vertical-align: middle;
}

/* Column widths */
.th-file,
.td-file {
    width: auto;
}

.th-template,
.td-template {
    width: 140px;
}

.th-status,
.td-status {
    width: 110px;
}

.th-date,
.td-date {
    width: 100px;
}

.th-actions,
.td-actions {
    width: 120px;
}

.file-cell {
    display: flex;
    align-items: center;
    gap: 9px;
}

.file-icon {
    color: rgba(240, 236, 246, 0.15);
}

.file-name {
    font-weight: 500;
    color: var(--ws-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 320px;
}

.template-tag {
    font-size: 11.5px;
    font-weight: 600;
    color: #7C3AED;
    background: rgba(124, 58, 237, 0.07);
    padding: 3px 8px;
    border-radius: 6px;
    white-space: nowrap;
}

.date-text {
    font-size: 12.5px;
    color: var(--ws-text-3);
    white-space: nowrap;
}

/* Status */
.status-pill {
    text-align: center;
    align-items: center;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 600;
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

/* Actions */
.actions-cell {
    display: flex;
    align-items: center;
    gap: 2px;
}

.action-icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: var(--ws-text-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.12s, color 0.12s;
}

.action-icon-btn:hover:not(:disabled) {
    background: var(--ws-surface-2);
    color: var(--ws-text-2);
}

.action-icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.action-icon-danger:hover:not(:disabled) {
    background: rgba(248, 113, 113, 0.08);
    color: #EF4444;
}

/* ─── Pagination ─────────────────────────────────────────────────────────── */
.pagination {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 14px 16px;
    border-top: 1px solid var(--ws-border-2);
}

.page-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid var(--ws-border);
    background: var(--ws-surface);
    color: var(--ws-text-2);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s;
}

.page-btn:hover:not(:disabled) {
    background: var(--ws-surface-2);
}

.page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.page-num {
    min-width: 32px;
}

.page-active {
    background: #7C3AED;
    border-color: #7C3AED;
    color: #fff;
}

.page-active:hover {
    background: #7C3AED;
}

.page-info {
    font-size: 12.5px;
    color: var(--ws-text-3);
    margin-left: auto;
}

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
    .history-page {
        padding: 24px 16px 48px;
    }

    .history-header {
        flex-direction: column;
    }

    .filter-bar {
        gap: 8px;
    }

    .filter-select-comp {
        width: 160px;
    }

    .search-wrap {
        max-width: 100%;
    }

    .th-template,
    .td-template,
    .th-date,
    .td-date {
        display: none;
    }
}
</style>