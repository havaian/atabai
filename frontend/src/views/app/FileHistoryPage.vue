<template>
    <div class="history-page">

        <!-- Header -->
        <div class="history-header">
            <div>
                <h1 class="history-title">File History</h1>
                <p class="history-sub">All your processed NSBU → IFRS transformations</p>
            </div>
            <button class="new-btn" @click="router.push('/app/upload')">
                <PlusIcon class="w-4 h-4" />
                New file
            </button>
        </div>

        <!-- Filter bar -->
        <div class="filter-bar">
            <!-- Search -->
            <div class="search-wrap">
                <MagnifyingGlassIcon class="search-icon w-4 h-4" />
                <input v-model="filters.search" type="text" class="search-input" placeholder="Search by file name…"
                    @input="onSearch" />
                <button v-if="filters.search" class="search-clear" @click="filters.search = ''; applyFilters()">
                    <XMarkIcon class="w-3.5 h-3.5" />
                </button>
            </div>

            <!-- Status -->
            <select v-model="filters.status" class="filter-select" @change="applyFilters">
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
            </select>

            <!-- Template -->
            <select v-model="filters.templateType" class="filter-select" @change="applyFilters">
                <option value="">All templates</option>
                <option value="balanceSheet">Balance Sheet</option>
                <option value="cashFlow">Cash Flow</option>
                <option value="profitLoss">P&L (Budget)</option>
                <option value="profitLossForm2">P&L (Form 2)</option>
                <option value="equity">Changes in Equity</option>
            </select>

            <!-- Date range -->
            <select v-model="filters.dateRange" class="filter-select" @change="applyFilters">
                <option value="">All dates</option>
                <option value="today">Today</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="quarter">Last 3 months</option>
            </select>

            <!-- Clear filters -->
            <button v-if="hasActiveFilters" class="clear-btn" @click="clearFilters">
                <XMarkIcon class="w-3.5 h-3.5" />
                Clear
            </button>

            <!-- Count -->
            <span class="filter-count">
                {{ filteredFiles.length }} {{ filteredFiles.length === 1 ? 'file' : 'files' }}
            </span>
        </div>

        <!-- Loading -->
        <div v-if="filesStore.isLoading && allFiles.length === 0" class="state-loading">
            <div class="state-spinner"></div>
            <span>Loading files…</span>
        </div>

        <!-- Error -->
        <div v-else-if="filesStore.error" class="state-error">
            <ExclamationTriangleIcon class="w-5 h-5" />
            Failed to load files.
            <button class="error-retry" @click="refreshFiles">Try again</button>
        </div>

        <!-- Empty — no files at all -->
        <div v-else-if="allFiles.length === 0" class="state-empty">
            <div class="empty-icon">
                <DocumentPlusIcon class="w-7 h-7" />
            </div>
            <h3 class="empty-title">No files yet</h3>
            <p class="empty-desc">Upload your first NSBU report to get started.</p>
            <button class="new-btn" @click="router.push('/app/upload')">
                <PlusIcon class="w-4 h-4" />
                Upload first file
            </button>
        </div>

        <!-- Empty — filters returned nothing -->
        <div v-else-if="filteredFiles.length === 0" class="state-empty">
            <div class="empty-icon">
                <FunnelIcon class="w-7 h-7" />
            </div>
            <h3 class="empty-title">No matches</h3>
            <p class="empty-desc">Try adjusting your filters or search term.</p>
            <button class="clear-btn-lg" @click="clearFilters">Clear all filters</button>
        </div>

        <!-- Files table -->
        <div v-else class="files-card">
            <table class="files-table">
                <thead>
                    <tr class="table-head">
                        <th class="th th-file">File</th>
                        <th class="th th-template">Template</th>
                        <th class="th th-status">Status</th>
                        <th class="th th-date">Date</th>
                        <th class="th th-actions">Actions</th>
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
                                {{ file.status }}
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
                                    title="Download IFRS file" :disabled="file.downloading" @click="downloadFile(file)">
                                    <div v-if="file.downloading" class="mini-spin"></div>
                                    <ArrowDownTrayIcon v-else class="w-4 h-4" />
                                </button>

                                <!-- View / Processing -->
                                <button class="action-icon-btn"
                                    :title="file.status === 'completed' ? 'View details' : 'View processing'"
                                    @click="openFile(file)">
                                    <EyeIcon class="w-4 h-4" />
                                </button>

                                <!-- Retry -->
                                <button v-if="file.status === 'failed'" class="action-icon-btn" title="Retry"
                                    :disabled="file.retrying" @click="retryFile(file)">
                                    <div v-if="file.retrying" class="mini-spin"></div>
                                    <ArrowPathIcon v-else class="w-4 h-4" />
                                </button>

                                <!-- Delete -->
                                <button class="action-icon-btn action-icon-danger" title="Delete"
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
                    filteredFiles.length) }} of {{ filteredFiles.length }}
                </span>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFilesStore } from '@/stores/files'
import { debounce } from 'lodash-es'
import {
    PlusIcon, MagnifyingGlassIcon, XMarkIcon, DocumentIcon, DocumentPlusIcon,
    FunnelIcon, ExclamationTriangleIcon, ArrowDownTrayIcon, EyeIcon,
    ArrowPathIcon, TrashIcon, ChevronLeftIcon, ChevronRightIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
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
    if (!confirm(`Delete "${file.originalName}"? This cannot be undone.`)) return
    if (!fileStates.value[file.id]) fileStates.value[file.id] = {}
    fileStates.value[file.id].deleting = true
    try {
        await filesStore.deleteFile(file.id)
    } catch (e) { console.error(e) }
    finally { fileStates.value[file.id].deleting = false }
}

function formatTemplate(type) {
    const m = {
        balanceSheet: 'Balance Sheet',
        cashFlow: 'Cash Flow',
        profitLoss: 'P&L (Budget)',
        profitLossForm2: 'P&L (Form 2)',
        equity: 'Equity',
    }
    return m[type] || type
}

function formatDate(d) {
    if (!d) return '—'
    const date = new Date(d)
    const now = new Date()
    const diffM = Math.floor((now - date) / 60000)
    if (diffM < 60) return `${diffM}m ago`
    if (diffM < 1440) return `${Math.floor(diffM / 60)}h ago`
    if (diffM < 2880) return 'Yesterday'
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
        await filesStore.fetchRecentFiles().catch(() => { })
    }
})
</script>

<style scoped>
.history-page {
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

.search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 200px;
    max-width: 280px;
}

.search-icon {
    position: absolute;
    left: 10px;
    color: var(--ws-text-3);
    pointer-events: none;
}

.search-input {
    width: 100%;
    padding: 8px 32px 8px 34px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 9px;
    font-size: 13.5px;
    color: var(--ws-text);
    outline: none;
    transition: border-color 0.15s;
}

.search-input:focus {
    border-color: #7C3AED;
}

.search-input::placeholder {
    color: rgba(240, 236, 246, 0.15);
}

.search-clear {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--ws-text-3);
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s;
}

.search-clear:hover {
    color: var(--ws-text-2);
}

.filter-select {
    padding: 8px 12px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 9px;
    font-size: 13px;
    color: var(--ws-text-2);
    cursor: pointer;
    outline: none;
    transition: border-color 0.15s;
    appearance: none;
    padding-right: 28px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239CA3AF'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
}

.filter-select:focus {
    border-color: #7C3AED;
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
    border: 2px solid #E5E7EB;
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
    border: 1px dashed #E5E7EB;
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
    border-bottom: 1px solid #F9FAFB;
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
    display: inline-flex;
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