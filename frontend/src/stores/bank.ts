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

    async function uploadStatement({ periodId, file }) {
        isUploading.value = true
        error.value = null
        try {
            const fd = new FormData()
            fd.append('file', file)
            const resp = await apiClient.post(
                orgScope(`/periods/${periodId}/bank-statements`),
                fd,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            )
            lastUploadSummary.value = resp.data.summary
            return resp.data
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to upload'
            throw err
        } finally {
            isUploading.value = false
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
        fetchBatches,
        fetchDrafts,
        updateDraft,
        learnRule,
        commit,
        reset,
    }
})
