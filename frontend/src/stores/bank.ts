// @ts-nocheck
/* eslint-disable */
/**
 * Bank statement preview store — bank ТЗ §7.
 *
 * Holds the in-flight draft batch (one upload's drafts), their preview
 * colors, and the actions the operator performs on them. Each upload gets
 * its own uploadId; the store keys drafts by uploadId so the user can
 * switch between in-progress batches without losing state.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/plugins/axios'
import { useOrganizationsStore } from '@/stores/organizations'

export const useBankStore = defineStore('bank', () => {
    const orgs = useOrganizationsStore()

    // Last upload's summary (counts of green/yellow/red, etc.).
    const lastUploadSummary = ref(null)
    const drafts = ref([])
    const isLoading = ref(false)
    const isUploading = ref(false)
    const isCommitting = ref(false)
    const error = ref(null)

    function orgScope(path) {
        if (!orgs.currentOrgId) throw new Error('No active organization')
        return `/organizations/${orgs.currentOrgId}/ledger${path}`
    }

    async function uploadStatement({ periodId, file, statementAccountNumber }) {
        isUploading.value = true
        error.value = null
        try {
            const fd = new FormData()
            fd.append('file', file)
            // The org's own account this statement belongs to (bank ТЗ §1) —
            // the org-side leg of every posting in the batch.
            if (statementAccountNumber) {
                fd.append('statementAccountNumber', statementAccountNumber)
            }
            const resp = await apiClient.post(
                orgScope(`/periods/${periodId}/bank-statements`),
                fd,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            )
            // The upload now returns immediately with a background job; the
            // server keeps processing after the response. Poll the job until
            // it leaves 'processing', then surface the same summary the
            // synchronous path used to return.
            const job = resp.data.job
            if (!job?.jobId) {
                // Backward-compat: an older backend returned the summary inline.
                lastUploadSummary.value = resp.data.summary || null
                return { uploadId: resp.data.summary?.uploadId, summary: resp.data.summary }
            }
            const finished = await waitForJob({ periodId, jobId: job.jobId })
            if (finished.status === 'failed') {
                error.value = finished.error || 'Bank statement processing failed'
                const e = new Error(error.value)
                e.jobFailed = true
                throw e
            }
            lastUploadSummary.value = finished.summary || null
            return {
                uploadId: finished.uploadId || job.uploadId,
                jobId: job.jobId,
                summary: finished.summary,
                status: finished.status,
            }
        } catch (err) {
            if (!error.value) {
                error.value = err?.response?.data?.message || err?.message || 'Failed to upload'
            }
            throw err
        } finally {
            isUploading.value = false
        }
    }

    // Single status read for a background ingestion job.
    async function fetchUploadJob({ periodId, jobId }) {
        const resp = await apiClient.get(
            orgScope(`/periods/${periodId}/bank-statements/jobs/${jobId}`),
        )
        return resp.data.job
    }

    // Poll a job until it leaves 'processing'. Each poll is a quick read, so it
    // stays well under the HTTP timeout regardless of how long the underlying
    // ingestion takes. Gives up after timeoutMs and surfaces a timeout error.
    async function waitForJob({ periodId, jobId, intervalMs = 1500, timeoutMs = 600000 }) {
        const started = Date.now()
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const job = await fetchUploadJob({ periodId, jobId })
            if (job.status !== 'processing') return job
            if (Date.now() - started > timeoutMs) {
                throw new Error('Processing is taking longer than expected. Check the statements list shortly.')
            }
            await new Promise((r) => setTimeout(r, intervalMs))
        }
    }

    // All upload batches in a period (the batch-history list). Each row is one
    // upload, discoverable again after the preview tab is closed.
    const batches = ref([])

    async function fetchBatches({ periodId }) {
        isLoading.value = true
        error.value = null
        try {
            const resp = await apiClient.get(
                orgScope(`/periods/${periodId}/bank-statements`),
            )
            batches.value = resp.data.batches || []
            return batches.value
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to load batches'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function fetchDrafts({ periodId, uploadId, status }) {
        isLoading.value = true
        try {
            const resp = await apiClient.get(
                orgScope(`/periods/${periodId}/bank-statements/${uploadId}/drafts`),
                // status=committed loads an already-posted batch read-only;
                // omitted → live draft preview (unchanged behaviour).
                { params: status ? { status } : {} },
            )
            drafts.value = resp.data.drafts || []
            return drafts.value
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to load drafts'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function updateDraft({ periodId, uploadId, entryId, patch }) {
        const resp = await apiClient.patch(
            orgScope(`/periods/${periodId}/bank-statements/${uploadId}/drafts/${entryId}`),
            patch,
        )
        // Refresh the affected row in the local cache.
        const idx = drafts.value.findIndex((d) => d.id === entryId)
        if (idx !== -1) drafts.value[idx] = { ...drafts.value[idx], ...resp.data.draft }
        return resp.data.draft
    }

    async function learnRule({ periodId, uploadId, entryId, rule }) {
        const resp = await apiClient.post(
            orgScope(`/periods/${periodId}/bank-statements/${uploadId}/drafts/${entryId}/learn-rule`),
            rule,
        )
        return resp.data.rule
    }

    async function commit({ periodId, uploadId }) {
        isCommitting.value = true
        error.value = null
        try {
            const resp = await apiClient.post(
                orgScope(`/periods/${periodId}/bank-statements/${uploadId}/commit`),
            )
            return resp.data
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to commit'
            throw err
        } finally {
            isCommitting.value = false
        }
    }

    function reset() {
        lastUploadSummary.value = null
        drafts.value = []
        batches.value = []
        error.value = null
    }

    return {
        lastUploadSummary,
        drafts,
        batches,
        isLoading,
        isUploading,
        isCommitting,
        error,
        uploadStatement,
        fetchUploadJob,
        fetchBatches,
        fetchDrafts,
        updateDraft,
        learnRule,
        commit,
        reset,
    }
})
