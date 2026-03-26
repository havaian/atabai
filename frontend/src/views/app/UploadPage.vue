<template>
    <div class="upload-page">

        <!-- Back -->
        <button class="back-btn" @click="router.push('/app/dashboard')">
            <ArrowLeftIcon class="w-4 h-4" />
            {{ $t('common.back') }}
        </button>

        <!-- No template selected guard -->
        <div v-if="!templateId" class="no-template">
            <p>{{ $t('upload.noTemplate') }} <router-link to="/app/dashboard">{{ $t('common.goBack') }}</router-link>
            </p>
        </div>

        <template v-else>
            <!-- Template header (compact) -->
            <div class="template-header">
                <div class="template-header-icon">
                    <component :is="currentTemplate?.icon" class="w-5 h-5" />
                </div>
                <div>
                    <div class="template-header-name">
                        {{ currentTemplate?.key ? $t('templates.' + currentTemplate.key) : currentTemplate?.name }}
                    </div>
                    <div class="template-header-meta">
                        <span class="badge">{{ currentTemplate?.standard }}</span>
                        <span class="meta-sep">·</span>
                        <span class="meta-cat">
                            {{ currentTemplate?.key ? $t('templates.category.' + currentTemplate.key,
                                currentTemplate?.category) : currentTemplate?.category }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Main upload area -->
            <div class="upload-area">

                <!-- Drop zone -->
                <div v-if="!selectedFile" class="drop-zone" :class="{ 'dragging': isDragOver }" @drop="handleDrop"
                    @dragover.prevent @dragenter.prevent="isDragOver = true" @dragleave.prevent="isDragOver = false"
                    @click="$refs.fileInput.click()">
                    <div class="drop-icon">
                        <CloudArrowUpIcon class="w-8 h-8" />
                    </div>
                    <p class="drop-title">{{ $t('upload.dropTitle') }}</p>
                    <p class="drop-sub">{{ $t('upload.dropSub') }}</p>
                    <input ref="fileInput" type="file" class="hidden" accept=".xlsx,.xls" @change="handleFileSelect" />
                </div>

                <!-- File selected state -->
                <div v-else class="file-selected">
                    <div class="file-selected-icon">
                        <DocumentCheckIcon class="w-6 h-6" />
                    </div>
                    <div class="file-selected-info">
                        <div class="file-selected-name">{{ selectedFile.name }}</div>
                        <div class="file-selected-size">{{ formatSize(selectedFile.size) }}</div>
                    </div>
                    <button class="file-change-btn" @click="clearFile">
                        <XMarkIcon class="w-4 h-4" />
                    </button>
                </div>

                <!-- Instructions -->
                <div class="instructions">
                    <div class="instructions-title">
                        <InformationCircleIcon class="w-4 h-4" />
                        Expected format
                    </div>
                    <ul class="instructions-list">
                        <li v-for="(line, i) in uploadInstructions" :key="i">{{ line }}</li>
                    </ul>
                </div>

                <!-- Upload button -->
                <button class="upload-btn" :disabled="!selectedFile || isProcessing" @click="uploadFile">
                    <template v-if="isProcessing">
                        <div class="btn-spinner"></div>
                        Processing…
                    </template>
                    <template v-else>
                        <BoltIcon class="w-4 h-4" />
                        Transform to IFRS
                    </template>
                </button>

                <!-- Error -->
                <div v-if="errorMessage" class="upload-error">
                    <ExclamationCircleIcon class="w-4 h-4 flex-shrink-0" />
                    {{ errorMessage }}
                </div>
            </div>

            <!-- Previous files for this template -->
            <div v-if="prevFiles.length > 0" class="prev-section">
                <div class="prev-header">{{ $t('upload.previousFiles') }}</div>
                <div class="prev-list">
                    <div v-for="file in prevFiles" :key="file.id" class="prev-item" @click="openFile(file)">
                        <DocumentIcon class="w-4 h-4 flex-shrink-0" style="color: var(--ws-text-3)" />
                        <div class="prev-item-info">
                            <span class="prev-item-name">{{ file.originalName }}</span>
                            <span class="prev-item-date">{{ formatDate(file.createdAt) }}</span>
                        </div>
                        <span class="status-pill" :class="statusClass(file.status)">{{ $t(`processing.status.${(file.status).toString()}`) }}</span>
                        <ArrowRightIcon class="w-4 h-4" style="color: var(--ws-text-3)" />
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'
import { useTemplatesStore } from '@/stores/templates'
import {
    ArrowLeftIcon, CloudArrowUpIcon, DocumentCheckIcon, DocumentIcon,
    XMarkIcon, BoltIcon, InformationCircleIcon, ExclamationCircleIcon,
    ArrowRightIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const { t, tm } = useI18n()
const filesStore = useFilesStore()
const templatesStore = useTemplatesStore()

const templateId = computed(() => route.query.template)
const currentTemplate = computed(() => templatesStore.availableTemplates.find(t => t.id === templateId.value))

const selectedFile = ref(null)
const isDragOver = ref(false)
const isProcessing = ref(false)
const errorMessage = ref('')
const prevFiles = computed(() => (filesStore.templateFiles[templateId.value] || []).slice(0, 5))

const uploadInstructions = computed(() => {
    if (!templateId.value) return []
    try {
        const result = tm(`upload.instructions.${templateId.value}`)
        if (Array.isArray(result)) return result
        if (typeof result === 'object') return Object.values(result)
        return []
    } catch { return [] }
})

onMounted(async () => {
    if (!templateId.value) { router.push('/app/dashboard'); return }
    await templatesStore.fetchTemplates()
    await filesStore.fetchTemplateFiles(templateId.value, { limit: 5 }).catch(() => { })
})

function handleDrop(e) {
    e.preventDefault()
    isDragOver.value = false
    const file = e.dataTransfer.files[0]
    if (file) setFile(file)
}

function handleFileSelect(e) {
    const file = e.target.files[0]
    if (file) setFile(file)
}

function setFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        errorMessage.value = t('upload.errorFileType')
        return
    }
    if (file.size > 10 * 1024 * 1024) {
        errorMessage.value = t('upload.errorFileSize')
        return
    }
    errorMessage.value = ''
    selectedFile.value = file
}

function clearFile() {
    selectedFile.value = null
    errorMessage.value = ''
}

async function uploadFile() {
    if (!selectedFile.value || !templateId.value || isProcessing.value) return
    isProcessing.value = true
    errorMessage.value = ''
    try {
        const result = await filesStore.uploadFile(selectedFile.value, templateId.value)
        router.push(`/app/processing/${result.jobId}`)
    } catch (err) {
        errorMessage.value = err.message || t('upload.errorUploadFailed')
        isProcessing.value = false
    }
}

function openFile(file) {
    if (file.status === 'completed') router.push(`/app/files/${file.id}`)
    else if (file.jobId) router.push(`/app/processing/${file.jobId}`)
}

function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(d) {
    const date = new Date(d)
    const now = new Date()
    const diffM = Math.floor((now - date) / 60000)
    if (diffM < 60) return `${diffM}m ago`
    if (diffM < 1440) return `${Math.floor(diffM / 60)}h ago`
    return date.toLocaleDateString()
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
</script>

<style scoped>
.upload-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 36px 4rem 64px;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

/* ─── Back ───────────────────────────────────────────────────────────────── */
.back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--ws-text-3);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
    align-self: flex-start;
}

.back-btn:hover {
    color: var(--ws-text-2);
}

/* ─── Template header ────────────────────────────────────────────────────── */
.template-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 14px;
}

.template-header-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(124, 58, 237, 0.08);
    color: #7C3AED;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.template-header-name {
    font-size: 16px;
    font-weight: 700;
    color: var(--ws-text);
    letter-spacing: -0.01em;
    margin-bottom: 5px;
}

.template-header-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}

.badge {
    font-size: 11px;
    font-weight: 600;
    color: #7C3AED;
    background: rgba(124, 58, 237, 0.08);
    padding: 2px 8px;
    border-radius: 6px;
}

.meta-sep {
    color: rgba(240, 236, 246, 0.15);
    font-size: 12px;
}

.meta-cat {
    font-size: 12px;
    color: var(--ws-text-3);
}

/* ─── Upload area ────────────────────────────────────────────────────────── */
.upload-area {
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 16px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* Drop zone */
.drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 48px 24px;
    border: 2px dashed rgba(149, 0, 255, 0.2);
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    text-align: center;
}

.drop-zone:hover,
.drop-zone.dragging {
    border-color: #7C3AED;
    background: rgba(124, 58, 237, 0.03);
}

.drop-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: rgba(124, 58, 237, 0.08);
    color: #7C3AED;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
}

.drop-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--ws-text);
    margin: 0;
}

.drop-sub {
    font-size: 12.5px;
    color: var(--ws-text-3);
    margin: 0;
}

.hidden {
    display: none;
}

/* File selected */
.file-selected {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 18px;
    background: rgba(124, 58, 237, 0.04);
    border: 1px solid rgba(124, 58, 237, 0.2);
    border-radius: 12px;
}

.file-selected-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(124, 58, 237, 0.1);
    color: #7C3AED;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.file-selected-info {
    flex: 1;
    min-width: 0;
}

.file-selected-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--ws-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-selected-size {
    font-size: 12px;
    color: var(--ws-text-3);
    margin-top: 2px;
}

.file-change-btn {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--ws-text-3);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.12s, color 0.12s;
}

.file-change-btn:hover {
    background: rgba(248, 113, 113, 0.12);
    color: #EF4444;
}

/* Instructions */
.instructions {
    padding: 14px 16px;
    background: var(--ws-surface-2);
    border-radius: 10px;
}

.instructions-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ws-text-2);
    margin-bottom: 10px;
}

.instructions-list {
    margin: 0;
    padding-left: 16px;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.instructions-list li {
    font-size: 12.5px;
    color: var(--ws-text-3);
    line-height: 1.5;
}

/* Upload button */
.upload-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 13px 24px;
    background: #7C3AED;
    color: #fff;
    border: none;
    border-radius: 11px;
    font-size: 14.5px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: -0.01em;
    transition: background 0.15s, box-shadow 0.15s;
}

.upload-btn:hover:not(:disabled) {
    background: #6D28D9;
    box-shadow: 0 6px 24px rgba(124, 58, 237, 0.35);
}

.upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* Error */
.upload-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid #FCA5A5;
    border-radius: 8px;
    font-size: 13px;
    color: #fca5a5;
}

/* ─── Previous files ─────────────────────────────────────────────────────── */
.prev-section {
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 14px;
    overflow: hidden;
}

.prev-header {
    padding: 14px 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ws-text-3);
    background: var(--ws-bg);
    border-bottom: 1px solid var(--ws-border-2);
}

.prev-list {
    display: flex;
    flex-direction: column;
}

.prev-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 20px;
    border-bottom: 1px solid var(--ws-border-2);
    cursor: pointer;
    transition: background 0.12s;
}

.prev-item:last-child {
    border-bottom: none;
}

.prev-item:hover {
    background: var(--ws-bg);
}

.prev-item-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.prev-item-name {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--ws-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.prev-item-date {
    font-size: 11.5px;
    color: var(--ws-text-3);
}

/* Status pills */
.status-pill {
    text-align: center;
    align-items: center;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
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

.no-template {
    padding: 32px;
    text-align: center;
    color: var(--ws-text-3);
}
</style>