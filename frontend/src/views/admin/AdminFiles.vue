<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.files.title') }}</h1>
                <div class="adm-page-subtitle">{{ $t('admin.files.totalCount', { count: pagination?.total ?? 0 }) }}</div>
            </div>
        </div>

        <div class="adm-filter-bar">
            <input
                v-model="filters.q"
                @keyup.enter="loadFiles(1)"
                class="adm-input adm-input--search"
                :placeholder="$t('admin.files.searchFilesPlaceholder')"
            />
            <input
                v-model="filters.userEmail"
                @keyup.enter="loadFiles(1)"
                class="adm-input"
                :placeholder="$t('admin.files.searchUserPlaceholder')"
            />
            <select v-model="filters.status" @change="loadFiles(1)" class="adm-select">
                <option value="">{{ $t('admin.files.allStatuses') }}</option>
                <option value="uploaded">uploaded</option>
                <option value="processing">processing</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
            </select>
            <select v-model="filters.templateType" @change="loadFiles(1)" class="adm-select">
                <option value="">{{ $t('admin.files.allTypes') }}</option>
                <option value="balance">balance</option>
                <option value="cashflow">cashflow</option>
                <option value="profitloss">profitloss</option>
                <option value="profitloss_form2">profitloss_form2</option>
                <option value="equity">equity</option>
            </select>
            <button class="adm-btn adm-btn--ghost" @click="loadFiles(1)">{{ $t('admin.common.apply') }}</button>
        </div>

        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <div v-else-if="files.length === 0" class="adm-empty">{{ $t('admin.files.noFiles') }}</div>
        <div v-else class="adm-table-wrap">
            <table class="adm-table">
                <thead>
                    <tr>
                        <th>{{ $t('admin.files.tableFile') }}</th>
                        <th>{{ $t('admin.files.tableUser') }}</th>
                        <th>{{ $t('admin.files.tableType') }}</th>
                        <th>{{ $t('admin.files.tableStatus') }}</th>
                        <th>{{ $t('admin.files.tableCreated') }}</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="f in files"
                        :key="f._id"
                        class="adm-row-clickable"
                        @click="openFile(f._id)"
                    >
                        <td class="adm-mono adm-text-sm">{{ f.originalName }}</td>
                        <td class="adm-text-sm">
                            <div>{{ f.userId?.name || '—' }}</div>
                            <div class="adm-muted adm-text-xs adm-mono">{{ f.userId?.email }}</div>
                        </td>
                        <td class="adm-text-sm">{{ f.templateType }}</td>
                        <td>
                            <span class="adm-badge" :class="`adm-badge--status-${f.status}`">{{ f.status }}</span>
                        </td>
                        <td class="adm-text-sm adm-muted">{{ formatDate(f.createdAt) }}</td>
                        <td>
                            <button class="adm-btn adm-btn--sm adm-btn--ghost" @click.stop="openFile(f._id)">
                                {{ $t('admin.common.open') }}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="pagination && pagination.pages > 1" class="adm-pagination">
            <span>{{ $t('admin.users.pagination', { page: pagination.page, pages: pagination.pages, total: pagination.total }) }}</span>
            <div class="adm-pagination-buttons">
                <button class="adm-btn adm-btn--sm adm-btn--ghost"
                    @click="loadFiles(pagination.page - 1)"
                    :disabled="pagination.page <= 1">{{ $t('admin.common.prev') }}</button>
                <button class="adm-btn adm-btn--sm adm-btn--ghost"
                    @click="loadFiles(pagination.page + 1)"
                    :disabled="pagination.page >= pagination.pages">{{ $t('admin.common.next') }}</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const adminStore = useAdminStore()
const { t, locale } = useI18n()

const files = ref([])
const pagination = ref(null)
const loading = ref(false)
const error = ref(null)

const filters = reactive({
    q: '',
    userEmail: '',
    status: '',
    templateType: ''
})

async function loadFiles(page = 1) {
    loading.value = true
    error.value = null
    try {
        const params = { page, limit: 25 }
        if (filters.q) params.q = filters.q
        if (filters.userEmail) params.userEmail = filters.userEmail
        if (filters.status) params.status = filters.status
        if (filters.templateType) params.templateType = filters.templateType

        const data = await adminStore.listAllFiles(params)
        files.value = data.files
        pagination.value = data.pagination
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.files.loadError')
    } finally {
        loading.value = false
    }
}

function openFile(fileId) {
    router.push(`/admin/files/${fileId}`)
}

function formatDate(d) {
    if (!d) return '—'
    const localeMap = { ru: 'ru-RU', en: 'en-GB', uz: 'uz-UZ' }
    return new Date(d).toLocaleString(localeMap[locale.value] || 'ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

onMounted(() => loadFiles(1))
</script>
