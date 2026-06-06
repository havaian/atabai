<!-- frontend/src/views/app/BankUploadView.vue
     Upload a bank statement file. On success, navigates to the preview
     screen for the returned uploadId. The preview is where the operator
     actually does the green/yellow/red review work. -->
<template>
    <div class="upload-view">
        <header class="upload-view-header">
            <button class="upload-view-back" @click="back">
                <ArrowLeft :size="16" /> {{ $t('common.back') }}
            </button>
            <h1>{{ $t('bankUpload.title') }}</h1>
            <p>{{ $t('bankUpload.subtitle') }}</p>
        </header>

        <section class="upload-view-card">
            <div class="upload-view-period">
                <span class="upload-view-period-label">{{ $t('bankUpload.targetPeriod') }}</span>
                <strong>{{ periodLabel }}</strong>
            </div>

            <div
                class="upload-drop"
                :class="{ 'upload-drop--dragging': isDragOver, 'upload-drop--filled': !!file }"
                @drop="handleDrop"
                @dragover.prevent
                @dragenter.prevent="isDragOver = true"
                @dragleave.prevent="isDragOver = false"
                @click="pickFile"
            >
                <CloudUpload v-if="!file" :size="32" class="upload-drop-icon" />
                <FileCheck v-else :size="32" class="upload-drop-icon" />
                <div v-if="!file">
                    <div class="upload-drop-title">{{ $t('bankUpload.dropTitle') }}</div>
                    <div class="upload-drop-sub">{{ $t('bankUpload.dropSub') }}</div>
                </div>
                <div v-else>
                    <div class="upload-drop-title">{{ file.name }}</div>
                    <div class="upload-drop-sub">{{ formatSize(file.size) }}</div>
                </div>
                <input ref="fileInput" type="file" class="hidden-input" accept=".xlsx,.xls" @change="handlePick" />
            </div>

            <div v-if="errorMessage" class="upload-error">{{ errorMessage }}</div>
            <div v-if="isUploading" class="upload-processing">
                <span class="upload-processing-spinner" />
                {{ $t('bankUpload.processingNote') }}
            </div>

            <footer class="upload-view-footer">
                <button v-if="file" type="button" class="btn-ghost" @click="clearFile" :disabled="isUploading">
                    {{ $t('common.cancel') }}
                </button>
                <span class="upload-view-spacer" />
                <button type="button" class="btn-primary" :disabled="!file || isUploading" @click="submit">
                    {{ isUploading ? $t('bankUpload.uploading') : $t('bankUpload.submit') }}
                </button>
            </footer>
        </section>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, CloudUpload, FileCheck } from 'lucide-vue-next'
import { useBankStore } from '@/stores/bank'
import { useLedgerStore } from '@/stores/ledger'

const route = useRoute()
const router = useRouter()
const bank = useBankStore()
const ledger = useLedgerStore()

const file = ref(null)
const isDragOver = ref(false)
const isUploading = ref(false)
const errorMessage = ref('')
const fileInput = ref(null)

const periodId = computed(() => route.params.periodId)
const periodLabel = computed(() => {
    const p = ledger.periods.find((x) => x.id === periodId.value)
    return p?.label || periodId.value
})

onMounted(async () => {
    await ledger.fetchPeriods().catch(() => {})
})

function pickFile() {
    if (file.value) return
    fileInput.value?.click()
}
function handlePick(e) {
    const picked = e.target.files?.[0]
    if (picked) file.value = picked
}
function handleDrop(e) {
    e.preventDefault()
    isDragOver.value = false
    const dropped = e.dataTransfer?.files?.[0]
    if (dropped) file.value = dropped
}
function clearFile() {
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
}
async function submit() {
    if (!file.value || !periodId.value) return
    errorMessage.value = ''
    isUploading.value = true
    try {
        const resp = await bank.uploadStatement({ periodId: periodId.value, file: file.value })
        const uploadId = resp.uploadId || resp.summary?.uploadId
        if (uploadId) {
            router.push(`/app/ledger/periods/${periodId.value}/bank-statements/${uploadId}`)
        }
    } catch (err) {
        errorMessage.value = err?.response?.data?.message || err?.message || 'Upload failed'
    } finally {
        isUploading.value = false
    }
}
function back() {
    router.push('/app/ledger/periods')
}
function formatSize(bytes) {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
</script>

<style scoped>
/* Reuses the same look as OsvUploadView; styles inlined for self-containment. */
.upload-view { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
.upload-view-header { margin-bottom: 24px; }
.upload-view-back {
    background: transparent; border: none; color: var(--ws-text-3); cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; margin-bottom: 12px;
}
.upload-view-back:hover { color: var(--ws-text); }
.upload-view-header h1 { font-size: 1.4rem; font-weight: 600; color: var(--ws-text); margin-bottom: 4px; }
.upload-view-header p { font-size: 0.92rem; color: var(--ws-text-3); }
.upload-view-card {
    background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 14px; padding: 28px;
}
.upload-view-period {
    background: var(--ws-surface-2); padding: 12px 14px; border-radius: 8px;
    margin-bottom: 20px; display: flex; flex-direction: column; gap: 2px;
}
.upload-view-period-label {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ws-text-3);
}
.upload-drop {
    border: 2px dashed var(--ws-border); border-radius: 12px; padding: 36px 16px;
    text-align: center; cursor: pointer; transition: background 0.15s, border-color 0.15s;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.upload-drop:hover { border-color: rgba(124, 58, 237, 0.6); }
.upload-drop--dragging { border-color: var(--ws-purple); background: rgba(124, 58, 237, 0.04); }
.upload-drop--filled { border-color: var(--success); background: rgba(72, 187, 120, 0.04); cursor: default; }
.upload-drop-icon { color: var(--ws-text-3); }
.upload-drop--filled .upload-drop-icon { color: var(--success); }
.upload-drop-title { font-weight: 500; color: var(--ws-text); margin-bottom: 4px; }
.upload-drop-sub { font-size: 0.84rem; color: var(--ws-text-3); }
.hidden-input { display: none; }
.upload-error {
    margin-top: 16px; padding: 10px 14px;
    background: rgba(245, 101, 101, 0.1); color: #c53030;
    border: 1px solid rgba(245, 101, 101, 0.3); border-radius: 8px; font-size: 0.86rem;
}
.upload-processing {
    margin-top: 16px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;
    background: var(--ws-surface-2); color: var(--ws-text-2);
    border-radius: 8px; font-size: 0.86rem;
}
.upload-processing-spinner {
    width: 16px; height: 16px; flex-shrink: 0;
    border: 2px solid var(--ws-border); border-top-color: var(--ws-purple);
    border-radius: 50%; animation: upload-spin 0.85s linear infinite;
}
@keyframes upload-spin { to { transform: rotate(360deg); } }
.upload-view-footer { display: flex; align-items: center; gap: 10px; margin-top: 24px; }
.upload-view-spacer { flex: 1; }
.btn-primary {
    background: var(--ws-purple); color: white; padding: 10px 18px; border-radius: 8px;
    border: none; font-weight: 500; cursor: pointer;
}
.btn-primary:hover:not(:disabled) { background: #6D28D9; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost {
    background: transparent; color: var(--ws-text); border: 1px solid var(--ws-border);
    padding: 10px 18px; border-radius: 8px; cursor: pointer;
}
.btn-ghost:hover:not(:disabled) { background: var(--ws-surface-2); }
</style>
