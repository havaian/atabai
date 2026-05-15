<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">Файлы</h1>
                <div class="adm-page-subtitle">{{ pagination?.total ?? 0 }} всего</div>
            </div>
        </div>

        <div class="adm-filter-bar">
            <input
                v-model="filters.q"
                @keyup.enter="loadFiles(1)"
                class="adm-input adm-input--search"
                placeholder="Поиск по имени файла..."
            />
            <input
                v-model="filters.userEmail"
                @keyup.enter="loadFiles(1)"
                class="adm-input"
                placeholder="Email пользователя..."
            />
            <select v-model="filters.status" @change="loadFiles(1)" class="adm-select">
                <option value="">Все статусы</option>
                <option value="uploaded">uploaded</option>
                <option value="processing">processing</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
            </select>
            <select v-model="filters.templateType" @change="loadFiles(1)" class="adm-select">
                <option value="">Все типы</option>
                <option value="balance">balance</option>
                <option value="cashflow">cashflow</option>
                <option value="profitloss">profitloss</option>
                <option value="profitloss_form2">profitloss_form2</option>
                <option value="equity">equity</option>
            </select>
            <button class="adm-btn adm-btn--ghost" @click="loadFiles(1)">Применить</button>
        </div>

        <div v-if="loading" class="adm-empty">Загрузка...</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <div v-else-if="files.length === 0" class="adm-empty">Файлы не найдены</div>
        <div v-else class="adm-table-wrap">
            <table class="adm-table">
                <thead>
                    <tr>
                        <th>Файл</th>
                        <th>Пользователь</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        <th>Создан</th>
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
                                Открыть
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="pagination && pagination.pages > 1" class="adm-pagination">
            <span>Стр. {{ pagination.page }} из {{ pagination.pages }} ({{ pagination.total }} всего)</span>
            <div class="adm-pagination-buttons">
                <button class="adm-btn adm-btn--sm adm-btn--ghost"
                    @click="loadFiles(pagination.page - 1)"
                    :disabled="pagination.page <= 1">Назад</button>
                <button class="adm-btn adm-btn--sm adm-btn--ghost"
                    @click="loadFiles(pagination.page + 1)"
                    :disabled="pagination.page >= pagination.pages">Вперёд</button>
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
        error.value = err.response?.data?.message || 'Ошибка загрузки файлов'
    } finally {
        loading.value = false
    }
}

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

onMounted(() => loadFiles(1))
</script>
