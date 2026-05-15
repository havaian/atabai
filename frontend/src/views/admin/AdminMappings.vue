<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">Маппинги</h1>
                <div class="adm-page-subtitle">Преобразование НСБУ → IFRS</div>
            </div>
            <div class="adm-row">
                <button v-if="isSuperAdmin"
                    class="adm-btn adm-btn--ghost"
                    @click="runSeed"
                    :disabled="seeding"
                    title="Импортирует маппинги из файлов src/mappings/*.js. Идемпотентно: уже опубликованные типы пропускаются.">
                    {{ seeding ? 'Импорт...' : 'Запустить seed' }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">Загрузка...</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <div v-else>
            <div v-for="reportType in REPORT_TYPES" :key="reportType" class="adm-card">
                <div class="adm-card-header">
                    <h3 class="adm-card-title" style="margin: 0;">{{ reportTypeLabel(reportType) }}</h3>
                    <div class="adm-row">
                        <button class="adm-btn adm-btn--sm adm-btn--ghost"
                            @click="openSet(publishedFor(reportType))"
                            v-if="publishedFor(reportType)">
                            Открыть published
                        </button>
                        <button v-if="isSuperAdmin && publishedFor(reportType) && !draftFor(reportType)"
                            class="adm-btn adm-btn--sm adm-btn--primary"
                            @click="createDraft(reportType)">
                            Создать draft
                        </button>
                        <button v-if="draftFor(reportType)"
                            class="adm-btn adm-btn--sm adm-btn--primary"
                            @click="openSet(draftFor(reportType))">
                            Открыть draft
                        </button>
                    </div>
                </div>

                <div v-if="!grouped[reportType] || grouped[reportType].length === 0" class="adm-empty">
                    Нет ни одной версии. Запустите seed.
                </div>
                <div v-else class="adm-table-wrap">
                    <table class="adm-table">
                        <thead>
                            <tr>
                                <th>v</th>
                                <th>Статус</th>
                                <th>Строк</th>
                                <th>Опубликовано</th>
                                <th>Автор</th>
                                <th>Заметки</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="s in grouped[reportType]" :key="s._id">
                                <td class="adm-mono">{{ s.version }}</td>
                                <td>
                                    <span class="adm-badge" :class="`adm-badge--mappingset-${s.status}`">{{ s.status }}</span>
                                </td>
                                <td class="adm-text-sm">{{ s.itemCount }}</td>
                                <td class="adm-text-sm adm-muted">{{ formatDate(s.publishedAt) }}</td>
                                <td class="adm-text-sm adm-muted">{{ s.publishedBy?.email || s.createdBy?.email || '—' }}</td>
                                <td class="adm-text-sm adm-muted" style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    {{ s.notes || '—' }}
                                </td>
                                <td>
                                    <button class="adm-btn adm-btn--sm adm-btn--ghost" @click="openSet(s)">Открыть</button>
                                    <button v-if="isSuperAdmin && s.status !== 'published'"
                                        class="adm-btn adm-btn--sm adm-btn--danger"
                                        style="margin-left: 6px;"
                                        @click="deleteSet(s)">
                                        Удалить
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const adminStore = useAdminStore()

const REPORT_TYPES = ['balance_sheet', 'cash_flow', 'profit_loss_form2', 'equity']

const loading = ref(false)
const seeding = ref(false)
const error = ref(null)
const grouped = ref({})

const isSuperAdmin = computed(() => adminStore.isSuperAdmin)

function reportTypeLabel(rt) {
    return {
        balance_sheet: 'Баланс (Form 1)',
        cash_flow: 'Движение денежных средств',
        profit_loss_form2: 'Прибыль и убытки (Form 2)',
        equity: 'Изменения в капитале'
    }[rt] || rt
}

function publishedFor(rt) {
    return (grouped.value[rt] || []).find(s => s.status === 'published')
}

function draftFor(rt) {
    return (grouped.value[rt] || []).find(s => s.status === 'draft')
}

async function loadSets() {
    loading.value = true
    error.value = null
    try {
        const data = await adminStore.listMappingSets()
        grouped.value = data.grouped || {}
    } catch (err) {
        error.value = err.response?.data?.message || 'Ошибка загрузки маппингов'
    } finally {
        loading.value = false
    }
}

async function runSeed() {
    if (!confirm('Запустить seed? Существующие published-наборы не будут затронуты.')) return
    seeding.value = true
    try {
        await adminStore.runMappingSeed()
        await loadSets()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка seed')
    } finally {
        seeding.value = false
    }
}

async function createDraft(reportType) {
    try {
        const data = await adminStore.createDraft(reportType)
        router.push(`/admin/mappings/sets/${data.draft._id}`)
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка создания draft')
    }
}

async function deleteSet(s) {
    if (!confirm(`Удалить ${s.reportType} v${s.version} (${s.status})?`)) return
    try {
        await adminStore.deleteSet(s._id)
        await loadSets()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка удаления')
    }
}

function openSet(s) {
    router.push(`/admin/mappings/sets/${s._id}`)
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

onMounted(loadSets)
</script>

<style scoped>
.adm-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}
</style>
