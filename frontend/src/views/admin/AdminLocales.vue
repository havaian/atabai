<template>
    <div class="adm-page" style="max-width: none;">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.locales.title') }}</h1>
                <div class="adm-page-subtitle">{{ $t('admin.locales.subtitle') }}</div>
            </div>
            <div class="adm-row">
                <button v-if="isSuperAdmin" class="adm-btn adm-btn--ghost" @click="openCreateModal">
                    {{ $t('admin.locales.addKey') }}
                </button>
                <button v-if="isSuperAdmin" class="adm-btn adm-btn--ghost" @click="runSeed" :disabled="seeding"
                    :title="$t('admin.locales.seedTooltip')">
                    {{ seeding ? $t('admin.locales.runningSeed') : $t('admin.locales.runSeed') }}
                </button>
            </div>
        </div>

        <!-- Stats summary -->
        <div v-if="stats" class="adm-stats-grid">
            <div class="adm-stat" v-for="app in ['user', 'admin']" :key="app">
                <div class="adm-stat-label">{{ $t(`admin.locales.appLabel.${app}`) }}</div>
                <div class="adm-stat-value">{{ stats[app]?.total || 0 }}</div>
                <div class="adm-stat-sub adm-text-xs adm-muted">
                    {{ $t('admin.locales.missing') }}:
                    <span v-for="lang in LANGS" :key="lang" style="margin-right: 8px;">
                        {{ lang.toUpperCase() }} <strong>{{ stats[app]?.missing?.[lang] || 0 }}</strong>
                    </span>
                </div>
            </div>
        </div>

        <!-- Filters -->
        <div class="adm-filter-bar">
            <input v-model="filters.q" @keyup.enter="loadKeys(1)" class="adm-input adm-input--search"
                :placeholder="$t('admin.locales.searchPlaceholder')" />
            <select v-model="filters.app" @change="onAppChange" class="adm-select">
                <option value="">{{ $t('admin.locales.allApps') }}</option>
                <option value="user">{{ $t('admin.locales.appLabel.user') }}</option>
                <option value="admin">{{ $t('admin.locales.appLabel.admin') }}</option>
            </select>
            <select v-model="filters.namespace" @change="loadKeys(1)" class="adm-select">
                <option value="">{{ $t('admin.locales.allNamespaces') }}</option>
                <option v-for="ns in availableNamespaces" :key="ns" :value="ns">{{ ns }}</option>
            </select>
            <select v-model="filters.missing" @change="loadKeys(1)" class="adm-select">
                <option value="">{{ $t('admin.locales.allKeys') }}</option>
                <option value="ru">{{ $t('admin.locales.missingRu') }}</option>
                <option value="en">{{ $t('admin.locales.missingEn') }}</option>
                <option value="uz">{{ $t('admin.locales.missingUz') }}</option>
            </select>
            <button class="adm-btn adm-btn--ghost" @click="loadKeys(1)">{{ $t('admin.common.apply') }}</button>
        </div>

        <!-- Table -->
        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <div v-else-if="keys.length === 0" class="adm-empty">{{ $t('admin.locales.noKeys') }}</div>
        <div v-else class="adm-table-wrap">
            <table class="adm-table">
                <thead>
                    <tr>
                        <th>{{ $t('admin.locales.colKey') }}</th>
                        <th>{{ $t('admin.locales.colApp') }}</th>
                        <th style="min-width: 220px;">RU</th>
                        <th style="min-width: 220px;">EN</th>
                        <th style="min-width: 220px;">UZ</th>
                        <th>{{ $t('admin.locales.colSource') }}</th>
                        <th v-if="isSuperAdmin"></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="k in keys" :key="k._id">
                        <td class="adm-mono adm-text-xs">{{ k.key }}</td>
                        <td>
                            <span class="adm-badge"
                                :class="k.app === 'admin' ? 'adm-badge--role-admin' : 'adm-badge--role-user'">
                                {{ k.app }}
                            </span>
                        </td>
                        <td v-for="lang in LANGS" :key="lang"
                            :class="['adm-locale-cell', !k.values?.[lang] && 'adm-locale-cell--missing']"
                            @click="isSuperAdmin && startEdit(k, lang)">
                            <template v-if="editing.keyId === k._id && editing.lang === lang">
                                <textarea ref="editTextarea" v-model="editing.value"
                                    @keydown.enter.exact.prevent="saveEdit" @keydown.esc="cancelEdit" @blur="saveEdit"
                                    class="adm-locale-edit-textarea" rows="2"></textarea>
                            </template>
                            <template v-else>
                                <span v-if="k.values?.[lang]" class="adm-locale-value">{{ k.values[lang] }}</span>
                                <span v-else class="adm-locale-empty adm-muted">—</span>
                            </template>
                        </td>
                        <td>
                            <span class="adm-badge adm-text-xs"
                                :style="k.source === 'db' ? 'background: rgba(168, 85, 247, 0.15); color: #c084fc;' : 'background: rgba(100, 100, 100, 0.2); color: rgba(240, 236, 246, 0.6);'">
                                {{ k.source }}
                            </span>
                        </td>
                        <td v-if="isSuperAdmin">
                            <button class="adm-btn adm-btn--sm adm-btn--danger" @click="confirmDelete(k)">×</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination && pagination.pages > 1" class="adm-pagination">
            <span>{{ $t('admin.users.pagination', {
                page: pagination.page, pages: pagination.pages, total:
                pagination.total })
                }}</span>
            <div class="adm-pagination-buttons">
                <button class="adm-btn adm-btn--sm adm-btn--ghost" @click="loadKeys(pagination.page - 1)"
                    :disabled="pagination.page <= 1">{{ $t('admin.common.prev') }}</button>
                <button class="adm-btn adm-btn--sm adm-btn--ghost" @click="loadKeys(pagination.page + 1)"
                    :disabled="pagination.page >= pagination.pages">{{ $t('admin.common.next') }}</button>
            </div>
        </div>

        <!-- Edit hint -->
        <div v-if="isSuperAdmin && keys.length > 0" class="adm-text-xs adm-muted" style="margin-top: 8px;">
            {{ $t('admin.locales.editHint') }}
        </div>

        <!-- Create modal -->
        <div v-if="showCreate" class="adm-modal-backdrop" @click.self="closeCreate">
            <div class="adm-modal">
                <h3 class="adm-modal-title">{{ $t('admin.locales.createTitle') }}</h3>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.locales.fieldKey') }} *</div>
                    <input v-model="createForm.key" class="adm-input adm-mono"
                        placeholder="namespace.subsection.label" />
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.locales.fieldApp') }} *</div>
                    <select v-model="createForm.app" class="adm-select">
                        <option value="user">{{ $t('admin.locales.appLabel.user') }}</option>
                        <option value="admin">{{ $t('admin.locales.appLabel.admin') }}</option>
                    </select>
                </div>
                <div class="adm-field" v-for="lang in LANGS" :key="lang">
                    <div class="adm-field-label">{{ lang.toUpperCase() }}</div>
                    <textarea v-model="createForm.values[lang]" class="adm-textarea" rows="2"></textarea>
                </div>
                <div v-if="createError" class="adm-2fa-error">{{ createError }}</div>
                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="closeCreate">{{ $t('admin.common.cancel') }}</button>
                    <button class="adm-btn adm-btn--primary" @click="doCreate" :disabled="!createForm.key || creating">
                        {{ creating ? $t('admin.common.loading') : $t('admin.common.save') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import { refreshLocaleFromAPI } from '@/utils/i18n'

const adminStore = useAdminStore()
const { t } = useI18n()

const LANGS = ['ru', 'en', 'uz']

const keys = ref([])
const pagination = ref(null)
const stats = ref(null)
const availableNamespaces = ref([])

const loading = ref(false)
const seeding = ref(false)
const error = ref(null)

const filters = reactive({
    q: '',
    app: 'admin',     // start on admin namespace — most likely target for translators
    namespace: '',
    missing: ''
})

const isSuperAdmin = computed(() => adminStore.isSuperAdmin)

// Inline edit state — only one cell can be in edit mode at a time
const editing = reactive({
    keyId: null,
    lang: null,
    value: '',
    original: ''
})
const editTextarea = ref(null)

// Create modal state
const showCreate = ref(false)
const creating = ref(false)
const createError = ref(null)
const createForm = reactive({
    key: '',
    app: 'admin',
    values: { ru: '', en: '', uz: '' }
})

async function loadKeys(page = 1) {
    loading.value = true
    error.value = null
    try {
        const params = { page, limit: 50 }
        if (filters.q) params.q = filters.q
        if (filters.app) params.app = filters.app
        if (filters.namespace) params.namespace = filters.namespace
        if (filters.missing) params.missing = filters.missing

        const data = await adminStore.listLocaleKeys(params)
        keys.value = data.keys || []
        pagination.value = data.pagination
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.locales.loadError')
    } finally {
        loading.value = false
    }
}

async function loadStats() {
    try {
        const data = await adminStore.fetchLocaleStats()
        stats.value = data.stats
    } catch (err) {
        // non-critical, ignore
    }
}

async function loadNamespaces() {
    try {
        const data = await adminStore.listLocaleNamespaces()
        // When app filter is set, show only that app's namespaces; else show union
        if (filters.app === 'user') {
            availableNamespaces.value = data.user || []
        } else if (filters.app === 'admin') {
            availableNamespaces.value = data.admin || []
        } else {
            const set = new Set([...(data.user || []), ...(data.admin || [])])
            availableNamespaces.value = Array.from(set).sort()
        }
    } catch (err) {
        availableNamespaces.value = []
    }
}

function onAppChange() {
    // Reset namespace filter when switching apps — namespaces are per-app
    filters.namespace = ''
    loadNamespaces()
    loadKeys(1)
}

// ─── Inline edit ─────────────────────────────────────────────────────────────
async function startEdit(key, lang) {
    if (!isSuperAdmin.value) return
    editing.keyId = key._id
    editing.lang = lang
    editing.original = key.values?.[lang] || ''
    editing.value = editing.original
    await nextTick()
    // Focus the textarea (it's an array ref because it's inside v-for)
    const ta = Array.isArray(editTextarea.value) ? editTextarea.value[0] : editTextarea.value
    if (ta) {
        ta.focus()
        ta.select()
    }
}

function cancelEdit() {
    editing.keyId = null
    editing.lang = null
    editing.value = ''
    editing.original = ''
}

async function saveEdit() {
    if (!editing.keyId || !editing.lang) return
    const newValue = editing.value
    const original = editing.original
    const keyId = editing.keyId
    const lang = editing.lang

    // Clear edit state immediately so the textarea doesn't re-trigger blur
    cancelEdit()

    // No change — skip server call
    if (newValue === original) return

    try {
        const payload = { values: { [lang]: newValue } }
        const data = await adminStore.updateLocaleKey(keyId, payload)

        // Update in-place in the local list
        const idx = keys.value.findIndex(k => k._id === keyId)
        if (idx !== -1 && data.key) {
            keys.value[idx] = data.key
        }

        // Trigger immediate UI hot-reload across the app
        refreshLocaleFromAPI().catch(() => { })
        // Stats may have shifted (one fewer "missing")
        loadStats().catch(() => { })
    } catch (err) {
        alert(err.response?.data?.message || t('admin.locales.saveError'))
    }
}

// ─── Create ─────────────────────────────────────────────────────────────────
function openCreateModal() {
    createForm.key = ''
    createForm.app = filters.app || 'admin'
    createForm.values.ru = ''
    createForm.values.en = ''
    createForm.values.uz = ''
    createError.value = null
    showCreate.value = true
}

function closeCreate() {
    showCreate.value = false
}

async function doCreate() {
    if (!createForm.key.trim()) return
    creating.value = true
    createError.value = null
    try {
        await adminStore.createLocaleKey({
            key: createForm.key.trim(),
            app: createForm.app,
            values: { ...createForm.values }
        })
        showCreate.value = false
        await Promise.all([loadKeys(1), loadStats(), loadNamespaces()])
        refreshLocaleFromAPI().catch(() => { })
    } catch (err) {
        createError.value = err.response?.data?.message || t('admin.locales.createError')
    } finally {
        creating.value = false
    }
}

// ─── Delete ─────────────────────────────────────────────────────────────────
async function confirmDelete(key) {
    if (!confirm(t('admin.locales.deleteConfirm', { key: key.key }))) return
    try {
        await adminStore.deleteLocaleKey(key._id)
        keys.value = keys.value.filter(k => k._id !== key._id)
        await loadStats()
        refreshLocaleFromAPI().catch(() => { })
    } catch (err) {
        alert(err.response?.data?.message || t('admin.locales.deleteError'))
    }
}

// ─── Seed ───────────────────────────────────────────────────────────────────
async function runSeed() {
    if (!confirm(t('admin.locales.seedConfirm'))) return
    seeding.value = true
    try {
        await adminStore.runLocaleSeed()
        await Promise.all([loadKeys(1), loadStats(), loadNamespaces()])
        refreshLocaleFromAPI().catch(() => { })
    } catch (err) {
        alert(err.response?.data?.message || t('admin.locales.seedError'))
    } finally {
        seeding.value = false
    }
}

onMounted(async () => {
    await Promise.all([loadKeys(1), loadStats(), loadNamespaces()])
})
</script>

<style scoped>
.adm-stat-sub {
    margin-top: 4px;
}

.adm-locale-cell {
    cursor: text;
    vertical-align: top;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.4;
    max-width: 280px;
    overflow-wrap: break-word;
}

.adm-locale-cell--missing {
    background: rgba(239, 68, 68, 0.04);
}

.adm-locale-value {
    color: rgba(240, 236, 246, 0.92);
}

.adm-locale-empty {
    font-style: italic;
}

.adm-locale-edit-textarea {
    width: 100%;
    background: rgba(15, 10, 26, 0.9);
    border: 1px solid rgba(168, 85, 247, 0.5);
    color: rgba(240, 236, 246, 0.95);
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    line-height: 1.4;
    resize: vertical;
    min-height: 44px;
    outline: none;
}

.adm-locale-edit-textarea:focus {
    border-color: #c084fc;
    box-shadow: 0 0 0 2px rgba(192, 132, 252, 0.18);
}

.adm-badge--role-user {
    background: rgba(96, 165, 250, 0.15);
    color: #93c5fd;
}

.adm-2fa-error {
    color: #fca5a5;
    font-size: 12px;
    padding: 6px 10px;
    background: rgba(220, 38, 38, 0.08);
    border: 1px solid rgba(220, 38, 38, 0.2);
    border-radius: 6px;
    margin-top: 10px;
}
</style>