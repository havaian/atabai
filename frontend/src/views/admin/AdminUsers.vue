<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.users.title') }}</h1>
                <div class="adm-page-subtitle">{{ $t('admin.users.totalCount', { count: pagination?.total ?? 0 }) }}</div>
            </div>
        </div>

        <!-- Filters -->
        <div class="adm-filter-bar">
            <input
                v-model="filters.q"
                @keyup.enter="loadUsers(1)"
                class="adm-input adm-input--search"
                :placeholder="$t('admin.users.searchPlaceholder')"
            />
            <select v-model="filters.role" @change="loadUsers(1)" class="adm-select">
                <option value="">{{ $t('admin.users.allRoles') }}</option>
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
            </select>
            <select v-model="filters.isActive" @change="loadUsers(1)" class="adm-select">
                <option value="">{{ $t('admin.users.allStatuses') }}</option>
                <option value="true">{{ $t('admin.users.activeOnly') }}</option>
                <option value="false">{{ $t('admin.users.inactiveOnly') }}</option>
            </select>
            <select v-model="filters.sort" @change="loadUsers(1)" class="adm-select">
                <option value="createdAt">{{ $t('admin.users.sortCreatedAt') }}</option>
                <option value="lastLoginAt">{{ $t('admin.users.sortLastLogin') }}</option>
                <option value="email">{{ $t('admin.users.sortEmail') }}</option>
                <option value="filesProcessedThisMonth">{{ $t('admin.users.sortFilesThisMonth') }}</option>
            </select>
            <button class="adm-btn adm-btn--ghost" @click="loadUsers(1)">{{ $t('admin.common.apply') }}</button>
        </div>

        <!-- Table -->
        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <div v-else-if="users.length === 0" class="adm-empty">{{ $t('admin.users.noUsers') }}</div>
        <div v-else class="adm-table-wrap">
            <table class="adm-table">
                <thead>
                    <tr>
                        <th>{{ $t('admin.users.tableEmail') }}</th>
                        <th>{{ $t('admin.users.tableName') }}</th>
                        <th>{{ $t('admin.users.tableRole') }}</th>
                        <th>{{ $t('admin.users.tableStatus') }}</th>
                        <th>{{ $t('admin.users.tableSubscription') }}</th>
                        <th>{{ $t('admin.users.tableFilesCount') }}</th>
                        <th>{{ $t('admin.users.tableLastLogin') }}</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="u in users"
                        :key="u._id"
                        class="adm-row-clickable"
                        @click="openUser(u._id)"
                    >
                        <td class="adm-mono">{{ u.email }}</td>
                        <td>{{ u.name }}</td>
                        <td>
                            <span class="adm-badge" :class="`adm-badge--role-${u.role}`">{{ u.role }}</span>
                        </td>
                        <td>
                            <span class="adm-badge" :class="u.isActive ? 'adm-badge--active' : 'adm-badge--inactive'">
                                {{ u.isActive ? $t('admin.common.active') : $t('admin.common.inactive') }}
                            </span>
                        </td>
                        <td class="adm-text-sm">{{ u.subscriptionType }}</td>
                        <td class="adm-text-sm">{{ u.filesProcessedThisMonth || 0 }}</td>
                        <td class="adm-text-sm adm-muted">{{ formatDate(u.lastLoginAt) }}</td>
                        <td>
                            <button class="adm-btn adm-btn--sm adm-btn--ghost" @click.stop="openUser(u._id)">
                                {{ $t('admin.common.open') }}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination && pagination.pages > 1" class="adm-pagination">
            <span>{{ $t('admin.users.pagination', { page: pagination.page, pages: pagination.pages, total: pagination.total }) }}</span>
            <div class="adm-pagination-buttons">
                <button
                    class="adm-btn adm-btn--sm adm-btn--ghost"
                    @click="loadUsers(pagination.page - 1)"
                    :disabled="pagination.page <= 1"
                >{{ $t('admin.common.prev') }}</button>
                <button
                    class="adm-btn adm-btn--sm adm-btn--ghost"
                    @click="loadUsers(pagination.page + 1)"
                    :disabled="pagination.page >= pagination.pages"
                >{{ $t('admin.common.next') }}</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const adminStore = useAdminStore()
const { t, locale } = useI18n()

const users = ref([])
const pagination = ref(null)
const loading = ref(false)
const error = ref(null)

const filters = reactive({
    q: '',
    role: '',
    isActive: '',
    sort: 'createdAt'
})

async function loadUsers(page = 1) {
    loading.value = true
    error.value = null
    try {
        const params = { page, limit: 25, sort: filters.sort }
        if (filters.q) params.q = filters.q
        if (filters.role) params.role = filters.role
        if (filters.isActive) params.isActive = filters.isActive

        const data = await adminStore.listUsers(params)
        users.value = data.users
        pagination.value = data.pagination
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.users.loadError')
    } finally {
        loading.value = false
    }
}

function openUser(userId) {
    router.push(`/admin/users/${userId}`)
}

function formatDate(d) {
    if (!d) return '—'
    // Map vue-i18n locale → Intl locale tag
    const localeMap = { ru: 'ru-RU', en: 'en-GB', uz: 'uz-UZ' }
    return new Date(d).toLocaleString(localeMap[locale.value] || 'ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

onMounted(() => loadUsers(1))
</script>
