<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">Пользователи</h1>
                <div class="adm-page-subtitle">{{ pagination?.total ?? 0 }} всего</div>
            </div>
        </div>

        <!-- Filters -->
        <div class="adm-filter-bar">
            <input
                v-model="filters.q"
                @keyup.enter="loadUsers(1)"
                class="adm-input adm-input--search"
                placeholder="Поиск по email или имени..."
            />
            <select v-model="filters.role" @change="loadUsers(1)" class="adm-select">
                <option value="">Все роли</option>
                <option value="user">user</option>
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
            </select>
            <select v-model="filters.isActive" @change="loadUsers(1)" class="adm-select">
                <option value="">Все</option>
                <option value="true">Активные</option>
                <option value="false">Деактивированные</option>
            </select>
            <select v-model="filters.sort" @change="loadUsers(1)" class="adm-select">
                <option value="createdAt">Регистрация</option>
                <option value="lastLoginAt">Последний вход</option>
                <option value="email">Email</option>
                <option value="filesProcessedThisMonth">Файлов в этом месяце</option>
            </select>
            <button class="adm-btn adm-btn--ghost" @click="loadUsers(1)">Применить</button>
        </div>

        <!-- Table -->
        <div v-if="loading" class="adm-empty">Загрузка...</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <div v-else-if="users.length === 0" class="adm-empty">Пользователи не найдены</div>
        <div v-else class="adm-table-wrap">
            <table class="adm-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Имя</th>
                        <th>Роль</th>
                        <th>Статус</th>
                        <th>Подписка</th>
                        <th>Файлов</th>
                        <th>Последний вход</th>
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
                                {{ u.isActive ? 'active' : 'inactive' }}
                            </span>
                        </td>
                        <td class="adm-text-sm">{{ u.subscriptionType }}</td>
                        <td class="adm-text-sm">{{ u.filesProcessedThisMonth || 0 }}</td>
                        <td class="adm-text-sm adm-muted">{{ formatDate(u.lastLoginAt) }}</td>
                        <td>
                            <button class="adm-btn adm-btn--sm adm-btn--ghost" @click.stop="openUser(u._id)">
                                Открыть
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination && pagination.pages > 1" class="adm-pagination">
            <span>Стр. {{ pagination.page }} из {{ pagination.pages }} ({{ pagination.total }} всего)</span>
            <div class="adm-pagination-buttons">
                <button
                    class="adm-btn adm-btn--sm adm-btn--ghost"
                    @click="loadUsers(pagination.page - 1)"
                    :disabled="pagination.page <= 1"
                >Назад</button>
                <button
                    class="adm-btn adm-btn--sm adm-btn--ghost"
                    @click="loadUsers(pagination.page + 1)"
                    :disabled="pagination.page >= pagination.pages"
                >Вперёд</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const adminStore = useAdminStore()

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
        error.value = err.response?.data?.message || 'Ошибка загрузки пользователей'
    } finally {
        loading.value = false
    }
}

function openUser(userId) {
    router.push(`/admin/users/${userId}`)
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

onMounted(() => loadUsers(1))
</script>
