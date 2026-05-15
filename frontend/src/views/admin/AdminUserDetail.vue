<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <router-link to="/admin/users" class="adm-page-subtitle" style="text-decoration: none;">
                    ← Пользователи
                </router-link>
                <h1 class="adm-page-title" v-if="user">{{ user.name }}</h1>
                <h1 class="adm-page-title" v-else>Пользователь</h1>
                <div v-if="user" class="adm-page-subtitle adm-mono">{{ user.email }}</div>
            </div>
            <div class="adm-row" v-if="user && isSuperAdmin && !isSelf">
                <button class="adm-btn adm-btn--ghost" @click="showRoleModal = true">
                    Изменить роль
                </button>
                <button
                    class="adm-btn"
                    :class="user.isActive ? 'adm-btn--danger' : 'adm-btn--primary'"
                    @click="toggleActive"
                >
                    {{ user.isActive ? 'Деактивировать' : 'Активировать' }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">Загрузка...</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <template v-else-if="user">
            <!-- User info card -->
            <div class="adm-card">
                <h3 class="adm-card-title">Информация</h3>
                <div class="adm-grid-2">
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">Роль</div>
                            <span class="adm-badge" :class="`adm-badge--role-${user.role}`">{{ user.role }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">Статус</div>
                            <span class="adm-badge" :class="user.isActive ? 'adm-badge--active' : 'adm-badge--inactive'">
                                {{ user.isActive ? 'активен' : 'деактивирован' }}
                            </span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">Подписка</div>
                            <span class="adm-text-sm">{{ user.subscriptionType }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">Язык</div>
                            <span class="adm-text-sm">{{ user.preferences?.language || '—' }}</span>
                        </div>
                    </div>
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">Регистрация</div>
                            <span class="adm-text-sm">{{ formatDate(user.createdAt) }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">Последний вход</div>
                            <span class="adm-text-sm">{{ formatDate(user.lastLoginAt) }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">Google ID</div>
                            <span class="adm-mono adm-text-xs">{{ user.googleId }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">User ID</div>
                            <span class="adm-mono adm-text-xs">{{ user._id }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- File stats -->
            <div class="adm-card">
                <h3 class="adm-card-title">Статистика файлов</h3>
                <div class="adm-stats-grid" style="margin-bottom: 0;">
                    <div class="adm-stat">
                        <div class="adm-stat-label">Всего</div>
                        <div class="adm-stat-value">{{ fileStats?.total || 0 }}</div>
                    </div>
                    <div class="adm-stat">
                        <div class="adm-stat-label">Завершено</div>
                        <div class="adm-stat-value">{{ fileStats?.completed || 0 }}</div>
                    </div>
                    <div class="adm-stat">
                        <div class="adm-stat-label">Ошибки</div>
                        <div class="adm-stat-value">{{ fileStats?.failed || 0 }}</div>
                    </div>
                    <div class="adm-stat">
                        <div class="adm-stat-label">В обработке</div>
                        <div class="adm-stat-value">{{ fileStats?.processing || 0 }}</div>
                    </div>
                </div>
            </div>

            <!-- Files list -->
            <div class="adm-card">
                <h3 class="adm-card-title">Файлы пользователя</h3>
                <div v-if="filesLoading" class="adm-empty">Загрузка...</div>
                <div v-else-if="files.length === 0" class="adm-empty">Нет файлов</div>
                <div v-else class="adm-table-wrap">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th>Имя файла</th>
                                <th>Тип</th>
                                <th>Статус</th>
                                <th>Размер</th>
                                <th>Создан</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="f in files" :key="f._id" class="adm-row-clickable" @click="openFile(f._id)">
                                <td class="adm-mono adm-text-sm">{{ f.originalName }}</td>
                                <td class="adm-text-sm">{{ f.templateType }}</td>
                                <td>
                                    <span class="adm-badge" :class="`adm-badge--status-${f.status}`">{{ f.status }}</span>
                                </td>
                                <td class="adm-text-sm adm-muted">{{ formatSize(f.fileSize) }}</td>
                                <td class="adm-text-sm adm-muted">{{ formatDate(f.createdAt) }}</td>
                                <td>
                                    <button class="adm-btn adm-btn--sm adm-btn--ghost" @click.stop="openFile(f._id)">
                                        Открыть
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-if="filesPagination && filesPagination.pages > 1" class="adm-pagination">
                    <span>Стр. {{ filesPagination.page }} из {{ filesPagination.pages }}</span>
                    <div class="adm-pagination-buttons">
                        <button class="adm-btn adm-btn--sm adm-btn--ghost"
                            @click="loadFiles(filesPagination.page - 1)"
                            :disabled="filesPagination.page <= 1">Назад</button>
                        <button class="adm-btn adm-btn--sm adm-btn--ghost"
                            @click="loadFiles(filesPagination.page + 1)"
                            :disabled="filesPagination.page >= filesPagination.pages">Вперёд</button>
                    </div>
                </div>
            </div>

            <!-- Overrides -->
            <div class="adm-card">
                <h3 class="adm-card-title">Индивидуальные оверрайды маппинга</h3>
                <div v-if="overridesLoading" class="adm-empty">Загрузка...</div>
                <div v-else-if="overrides.length === 0" class="adm-empty">
                    Нет оверрайдов — применяется глобальный маппинг
                </div>
                <div v-else class="adm-table-wrap">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th>Тип отчёта</th>
                                <th>НСБУ-код</th>
                                <th>IFRS</th>
                                <th>Секция</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="o in overrides" :key="o._id">
                                <td class="adm-text-sm">{{ o.reportType }}</td>
                                <td class="adm-mono">{{ o.nsbuRowCode }}</td>
                                <td class="adm-text-sm">{{ o.ifrsClassification }}</td>
                                <td class="adm-text-sm adm-muted">{{ o.section }}</td>
                                <td>
                                    <button v-if="isSuperAdmin"
                                        class="adm-btn adm-btn--sm adm-btn--danger"
                                        @click="deleteOverride(o)">Удалить</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>

        <!-- Role change modal -->
        <div v-if="showRoleModal" class="adm-modal-backdrop" @click.self="showRoleModal = false">
            <div class="adm-modal">
                <h3 class="adm-modal-title">Изменить роль</h3>
                <div class="adm-field">
                    <div class="adm-field-label">Новая роль</div>
                    <select v-model="newRole" class="adm-select">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="super_admin">super_admin</option>
                    </select>
                </div>
                <div class="adm-text-sm adm-muted">
                    Внимание: super_admin имеет полный доступ ко всем функциям, включая управление маппингами и ролями других пользователей.
                </div>
                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="showRoleModal = false">Отмена</button>
                    <button class="adm-btn adm-btn--primary" @click="confirmRoleChange">Сохранить</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const route = useRoute()
const adminStore = useAdminStore()

const user = ref(null)
const fileStats = ref(null)
const files = ref([])
const filesPagination = ref(null)
const overrides = ref([])

const loading = ref(false)
const filesLoading = ref(false)
const overridesLoading = ref(false)
const error = ref(null)

const showRoleModal = ref(false)
const newRole = ref('user')

const isSuperAdmin = computed(() => adminStore.isSuperAdmin)
const isSelf = computed(() => user.value?._id === adminStore.adminInfo?.id)

const userId = computed(() => route.params.userId)

async function loadUser() {
    loading.value = true
    error.value = null
    try {
        const data = await adminStore.getUserDetails(userId.value)
        user.value = data.user
        fileStats.value = data.fileStats
        newRole.value = data.user.role
    } catch (err) {
        error.value = err.response?.data?.message || 'Ошибка загрузки пользователя'
    } finally {
        loading.value = false
    }
}

async function loadFiles(page = 1) {
    filesLoading.value = true
    try {
        const data = await adminStore.getUserFiles(userId.value, { page, limit: 25 })
        files.value = data.files
        filesPagination.value = data.pagination
    } catch (err) {
        console.error('Failed to load files:', err)
    } finally {
        filesLoading.value = false
    }
}

async function loadOverrides() {
    overridesLoading.value = true
    try {
        const data = await adminStore.listUserOverrides(userId.value)
        overrides.value = data.overrides
    } catch (err) {
        console.error('Failed to load overrides:', err)
    } finally {
        overridesLoading.value = false
    }
}

async function confirmRoleChange() {
    try {
        await adminStore.updateUserRole(userId.value, newRole.value)
        showRoleModal.value = false
        await loadUser()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка изменения роли')
    }
}

async function toggleActive() {
    if (!user.value) return
    const action = user.value.isActive ? 'деактивировать' : 'активировать'
    if (!confirm(`Точно ${action} пользователя ${user.value.email}?`)) return
    try {
        await adminStore.updateUserActive(userId.value, !user.value.isActive)
        await loadUser()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка')
    }
}

async function deleteOverride(o) {
    if (!confirm(`Удалить оверрайд для ${o.reportType} / ${o.nsbuRowCode}?`)) return
    try {
        await adminStore.deleteUserOverride(userId.value, o.reportType, o.nsbuRowCode)
        await loadOverrides()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка удаления')
    }
}

import { useRouter } from 'vue-router'
const router = useRouter()
function openFile(fileId) {
    router.push(`/admin/files/${fileId}`)
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

function formatSize(bytes) {
    if (!bytes) return '—'
    const k = 1024
    if (bytes < k) return `${bytes} B`
    if (bytes < k * k) return `${(bytes / k).toFixed(1)} KB`
    return `${(bytes / k / k).toFixed(1)} MB`
}

onMounted(async () => {
    await loadUser()
    await Promise.all([loadFiles(1), loadOverrides()])
})
</script>
