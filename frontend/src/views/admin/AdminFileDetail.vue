<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <router-link to="/admin/files" class="adm-page-subtitle" style="text-decoration: none;">
                    {{ $t('admin.fileDetail.backLink') }}
                </router-link>
                <h1 class="adm-page-title">{{ file?.originalName || $t('admin.fileDetail.defaultTitle') }}</h1>
                <div v-if="file" class="adm-page-subtitle">
                    {{ file.templateType }} ·
                    <span class="adm-badge" :class="`adm-badge--status-${file.status}`">{{ file.status }}</span>
                </div>
            </div>
            <div class="adm-row" v-if="file">
                <button class="adm-btn adm-btn--ghost" @click="downloadOriginal" :disabled="downloading">
                    <Download :size="14" />
                    {{ $t('admin.fileDetail.downloadOriginal') }}
                </button>
                <button
                    v-if="file.processedFilePath"
                    class="adm-btn adm-btn--primary"
                    @click="downloadProcessed"
                    :disabled="downloading"
                >
                    <Download :size="14" />
                    {{ $t('admin.fileDetail.downloadProcessed') }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <template v-else-if="file">
            <!-- Info -->
            <div class="adm-card">
                <h3 class="adm-card-title">{{ $t('admin.fileDetail.infoSection') }}</h3>
                <div class="adm-grid-2">
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.fileDetail.fieldOwner') }}</div>
                            <router-link v-if="file.userId"
                                :to="`/admin/users/${file.userId._id}`"
                                style="color: #c084fc; text-decoration: none;">
                                {{ file.userId.email }}
                            </router-link>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.fileDetail.fieldTemplateType') }}</div>
                            <span class="adm-text-sm">{{ file.templateType }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.fileDetail.fieldSize') }}</div>
                            <span class="adm-text-sm">{{ formatSize(file.fileSize) }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.fileDetail.fieldJobId') }}</div>
                            <span class="adm-mono adm-text-xs">{{ file.jobId }}</span>
                        </div>
                    </div>
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.fileDetail.fieldCreated') }}</div>
                            <span class="adm-text-sm">{{ formatDate(file.createdAt) }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.fileDetail.fieldCompleted') }}</div>
                            <span class="adm-text-sm">{{ formatDate(file.completedAt) }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.fileDetail.fieldDiskFile') }}</div>
                            <span class="adm-mono adm-text-xs">{{ file.filePath }}</span>
                        </div>
                        <div class="adm-field" v-if="file.processedFilePath">
                            <div class="adm-field-label">{{ $t('admin.fileDetail.fieldDiskProcessed') }}</div>
                            <span class="adm-mono adm-text-xs">{{ file.processedFilePath }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Result -->
            <div class="adm-card" v-if="file.result">
                <h3 class="adm-card-title">{{ $t('admin.fileDetail.resultSection') }}</h3>
                <div class="adm-stats-grid" style="margin-bottom: 0;">
                    <div class="adm-stat">
                        <div class="adm-stat-label">{{ $t('admin.fileDetail.resultTransformations') }}</div>
                        <div class="adm-stat-value">{{ file.result.transformations || 0 }}</div>
                    </div>
                    <div class="adm-stat">
                        <div class="adm-stat-label">{{ $t('admin.fileDetail.resultChanges') }}</div>
                        <div class="adm-stat-value">{{ file.result.changes || 0 }}</div>
                    </div>
                    <div class="adm-stat">
                        <div class="adm-stat-label">{{ $t('admin.fileDetail.resultOriginalRows') }}</div>
                        <div class="adm-stat-value">{{ file.result.originalRows || 0 }}</div>
                    </div>
                    <div class="adm-stat">
                        <div class="adm-stat-label">{{ $t('admin.fileDetail.resultProcessedRows') }}</div>
                        <div class="adm-stat-value">{{ file.result.processedRows || 0 }}</div>
                    </div>
                </div>
                <div v-if="file.result.warnings?.length" style="margin-top: 16px;">
                    <div class="adm-field-label">{{ $t('admin.fileDetail.warningsLabel', { count: file.result.warnings.length }) }}</div>
                    <div class="adm-warnings-list">
                        <div v-for="(w, i) in file.result.warnings" :key="i" class="adm-warning-item">
                            <span class="adm-badge" :class="`adm-badge--status-${w.severity === 'error' ? 'failed' : (w.severity === 'warning' ? 'processing' : 'uploaded')}`">
                                {{ w.severity }}
                            </span>
                            <span class="adm-text-sm">{{ w.message }}</span>
                            <span v-if="w.row" class="adm-mono adm-text-xs adm-muted">row {{ w.row }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Error -->
            <div class="adm-card" v-if="file.error">
                <h3 class="adm-card-title">{{ $t('admin.fileDetail.errorSection') }}</h3>
                <pre class="adm-error-pre">{{ file.error }}</pre>
            </div>

            <!-- Transformation JSON -->
            <div class="adm-card">
                <div class="adm-row" style="justify-content: space-between; margin-bottom: 12px;">
                    <h3 class="adm-card-title" style="margin: 0;">{{ $t('admin.fileDetail.snapshotSection') }}</h3>
                    <div class="adm-row" style="gap: 8px;">
                        <button v-if="transformation"
                            class="adm-btn adm-btn--sm adm-btn--ghost"
                            @click="copyTransformation"
                            :disabled="transformationLoading">
                            {{ copyState }}
                        </button>
                        <button class="adm-btn adm-btn--sm adm-btn--ghost"
                            @click="loadTransformation"
                            :disabled="transformationLoading">
                            {{ transformation ? $t('admin.fileDetail.snapshotRefresh') : $t('admin.fileDetail.snapshotLoad') }}
                        </button>
                    </div>
                </div>
                <div v-if="transformationLoading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
                <div v-else-if="transformationError" class="adm-empty">{{ transformationError }}</div>
                <pre v-else-if="transformation" class="adm-json-pre">{{ JSON.stringify(transformation, null, 2) }}</pre>
                <div v-else class="adm-muted adm-text-sm">
                    {{ $t('admin.fileDetail.snapshotHint') }}
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import { Download } from 'lucide-vue-next'

const route = useRoute()
const adminStore = useAdminStore()
const { t, locale } = useI18n()

const file = ref(null)
const loading = ref(false)
const error = ref(null)

const transformation = ref(null)
const transformationLoading = ref(false)
const transformationError = ref(null)
const copyState = ref(t('admin.common.copy'))

const downloading = ref(false)

const fileId = computed(() => route.params.fileId)

async function loadFile() {
    loading.value = true
    error.value = null
    try {
        const data = await adminStore.getFileDetails(fileId.value)
        file.value = data.file
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.fileDetail.loadError')
    } finally {
        loading.value = false
    }
}

async function loadTransformation() {
    transformationLoading.value = true
    transformationError.value = null
    try {
        const data = await adminStore.getFileTransformation(fileId.value)
        transformation.value = data.transformation
    } catch (err) {
        transformationError.value = err.response?.data?.message || t('admin.common.error')
    } finally {
        transformationLoading.value = false
    }
}

async function copyTransformation() {
    if (!transformation.value) return
    try {
        await navigator.clipboard.writeText(JSON.stringify(transformation.value, null, 2))
        copyState.value = t('admin.common.copied')
        setTimeout(() => { copyState.value = t('admin.common.copy') }, 1800)
    } catch (err) {
        // Fallback for browsers/contexts without clipboard API (e.g. non-HTTPS)
        copyState.value = t('admin.common.error')
        setTimeout(() => { copyState.value = t('admin.common.copy') }, 1800)
    }
}

async function downloadOriginal() {
    await doDownload('original')
}

async function downloadProcessed() {
    await doDownload('processed')
}

async function doDownload(type) {
    downloading.value = true
    try {
        const response = await adminStore.downloadFile(fileId.value, type)
        const blob = new Blob([response.data])
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = type === 'original' ? file.value.filePath : file.value.processedFilePath
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    } catch (err) {
        alert(err.response?.data?.message || t('admin.fileDetail.downloadError'))
    } finally {
        downloading.value = false
    }
}

function formatDate(d) {
    if (!d) return '—'
    const localeMap = { ru: 'ru-RU', en: 'en-GB', uz: 'uz-UZ' }
    return new Date(d).toLocaleString(localeMap[locale.value] || 'ru-RU', {
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

onMounted(loadFile)
</script>

<style scoped>
.adm-warnings-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
    max-height: 300px;
    overflow-y: auto;
}

.adm-warning-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: rgba(15, 10, 26, 0.5);
    border-radius: 6px;
}

.adm-error-pre {
    background: rgba(220, 38, 38, 0.06);
    border: 1px solid rgba(220, 38, 38, 0.2);
    padding: 12px;
    border-radius: 8px;
    color: #fca5a5;
    font-size: 12px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
}

.adm-json-pre {
    background: rgba(15, 10, 26, 0.6);
    border: 1px solid rgba(149, 0, 255, 0.1);
    padding: 14px;
    border-radius: 8px;
    color: rgba(240, 236, 246, 0.85);
    font-size: 12px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    overflow-x: auto;
    max-height: 600px;
    overflow-y: auto;
    margin: 0;
}
</style>
