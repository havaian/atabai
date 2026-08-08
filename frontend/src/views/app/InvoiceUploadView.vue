<!-- frontend/src/views/app/InvoiceUploadView.vue
     Upload a Didox invoice-registry export. The operator picks the registry
     direction (incoming = supplier invoices / payable, outgoing = your
     invoices / receivable) since it is not in the file - same shape as the
     bank module picking the statement account. On success, navigates to the
     invoice preview for the returned uploadId. -->
<template>
    <div class="upload-view">
        <header class="upload-view-header">
            <button class="upload-view-back" @click="back">
                <ArrowLeft :size="16" /> {{ $t('common.back') }}
            </button>
            <h1>{{ $t('invoiceUpload.title') }}</h1>
            <p>{{ $t('invoiceUpload.subtitle') }}</p>
        </header>

        <section class="upload-view-card">
            <div class="upload-view-period">
                <span class="upload-view-period-label">{{ $t('invoiceUpload.targetPeriod') }}</span>
                <strong>{{ periodLabel }}</strong>
            </div>

            <!-- Registry direction. Required - it decides payable vs receivable
                 and is not carried in the file. -->
            <div class="upload-direction">
                <span class="upload-direction-label">{{ $t('invoiceUpload.direction') }}</span>
                <div class="upload-direction-options">
                    <button
                        type="button"
                        class="upload-direction-option"
                        :class="{ 'upload-direction-option--active': direction === 'incoming' }"
                        :disabled="isUploading"
                        @click="direction = 'incoming'"
                    >
                        <ArrowDownLeft :size="18" />
                        <span class="upload-direction-name">{{ $t('invoiceUpload.incoming') }}</span>
                        <span class="upload-direction-hint">{{ $t('invoiceUpload.incomingHint') }}</span>
                    </button>
                    <button
                        type="button"
                        class="upload-direction-option"
                        :class="{ 'upload-direction-option--active': direction === 'outgoing' }"
                        :disabled="isUploading"
                        @click="direction = 'outgoing'"
                    >
                        <ArrowUpRight :size="18" />
                        <span class="upload-direction-name">{{ $t('invoiceUpload.outgoing') }}</span>
                        <span class="upload-direction-hint">{{ $t('invoiceUpload.outgoingHint') }}</span>
                    </button>
                </div>
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
                    <div class="upload-drop-title">{{ $t('invoiceUpload.dropTitle') }}</div>
                    <div class="upload-drop-sub">{{ $t('invoiceUpload.dropSub') }}</div>
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
                {{ $t('invoiceUpload.processingNote') }}
            </div>

            <footer class="upload-view-footer">
                <UiButton v-if="file" variant="ghost" :disabled="isUploading" @click="clearFile">
                    {{ $t('common.cancel') }}
                </UiButton>
                <span class="upload-view-spacer" />
                <UiButton variant="primary" :disabled="!file" :loading="isUploading" @click="submit">
                    {{ isUploading ? $t('invoiceUpload.uploading') : $t('invoiceUpload.submit') }}
                </UiButton>
            </footer>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, CloudUpload, FileCheck } from 'lucide-vue-next'
import { useInvoicesStore, type InvoiceDirection } from '@/stores/invoices'
import { useLedgerStore } from '@/stores/ledger'
import UiButton from '@/components/ui/UiButton.vue'

const route = useRoute()
const router = useRouter()
const invoices = useInvoicesStore()
const ledger = useLedgerStore()

const file = ref<File | null>(null)
const isDragOver = ref(false)
const errorMessage = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const direction = ref<InvoiceDirection>('incoming')

const isUploading = computed(() => invoices.isUploading)
const periodId = computed(() => String(route.params.periodId ?? ''))
const periodLabel = computed(() => {
    const list = ledger.periods as Array<{ id: string; label?: string }>
    const p = list.find((x) => x.id === periodId.value)
    return p?.label || periodId.value
})

onMounted(async () => {
    await ledger.fetchPeriods().catch(() => {})
})

function pickFile() {
    if (file.value) return
    fileInput.value?.click()
}
function handlePick(e: Event) {
    const picked = (e.target as HTMLInputElement).files?.[0]
    if (picked) file.value = picked
}
function handleDrop(e: DragEvent) {
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
    try {
        const resp = await invoices.uploadInvoice({
            periodId: periodId.value,
            file: file.value,
            direction: direction.value,
        })
        const uploadId = resp.uploadId
        if (uploadId) {
            router.push(`/app/ledger/periods/${periodId.value}/invoices/${uploadId}`)
        }
    } catch (err) {
        const e = err as { response?: { data?: { message?: string } }; message?: string }
        errorMessage.value = e?.response?.data?.message || e?.message || 'Upload failed'
    }
}
function back() {
    router.push('/app/ledger/periods')
}
function formatSize(bytes: number) {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
</script>

<style scoped>
/* Same chrome as BankUploadView; direction picker replaces the account select. */
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
.upload-direction { margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
.upload-direction-label { font-size: 0.82rem; font-weight: 500; color: var(--ws-text-2); }
.upload-direction-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.upload-direction-option {
    display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
    padding: 14px; text-align: left; cursor: pointer;
    background: var(--ws-surface); border: 1px solid var(--ws-border); border-radius: 10px;
    color: var(--ws-text-2); transition: border-color 0.15s, background 0.15s;
}
.upload-direction-option:hover { border-color: rgba(124, 58, 237, 0.5); }
.upload-direction-option--active {
    border-color: var(--ws-purple); background: rgba(124, 58, 237, 0.06); color: var(--ws-text);
}
.upload-direction-option:disabled { opacity: 0.6; cursor: not-allowed; }
.upload-direction-name { font-weight: 600; font-size: 0.92rem; }
.upload-direction-hint { font-size: 0.76rem; color: var(--ws-text-3); }
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
</style>
