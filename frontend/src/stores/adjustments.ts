// @ts-nocheck
/* eslint-disable */
/**
 * Adjustments store — architecture doc §7.2.
 *
 * IFRS overlay journal entries. Each carries adjustmentMeta (standard +
 * reason + tax effect + disclosure text) on top of balanced Dt/Cr lines.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/plugins/axios'
import { useOrganizationsStore } from '@/stores/organizations'

export const useAdjustmentsStore = defineStore('adjustments', () => {
    const orgs = useOrganizationsStore()

    const items = ref([])
    const current = ref(null)
    const currentLines = ref([])
    const isLoading = ref(false)
    const isSubmitting = ref(false)
    const error = ref(null)

    function orgScope(path) {
        if (!orgs.currentOrgId) throw new Error('No active organization')
        return `/organizations/${orgs.currentOrgId}/ledger${path}`
    }

    async function fetchList({ periodId, status, standard } = {}) {
        isLoading.value = true
        try {
            const resp = await apiClient.get(orgScope('/adjustments'), {
                params: { periodId, status, standard },
            })
            items.value = resp.data.adjustments || []
            return items.value
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to load adjustments'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function fetchOne(entryId) {
        isLoading.value = true
        try {
            const resp = await apiClient.get(orgScope(`/adjustments/${entryId}`))
            current.value = resp.data.adjustment
            currentLines.value = resp.data.lines || []
            return resp.data
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to load adjustment'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    async function createDraft({ periodId, payload }) {
        isSubmitting.value = true
        error.value = null
        try {
            const resp = await apiClient.post(
                orgScope(`/periods/${periodId}/adjustments`),
                payload,
            )
            return resp.data.adjustment
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to create adjustment'
            throw err
        } finally {
            isSubmitting.value = false
        }
    }

    async function commit(entryId) {
        isSubmitting.value = true
        error.value = null
        try {
            const resp = await apiClient.post(orgScope(`/adjustments/${entryId}/commit`))
            return resp.data.adjustment
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to commit'
            throw err
        } finally {
            isSubmitting.value = false
        }
    }

    async function reverse({ entryId, reason }) {
        isSubmitting.value = true
        error.value = null
        try {
            const resp = await apiClient.post(orgScope(`/adjustments/${entryId}/reverse`), {
                reason,
            })
            return resp.data.reversal
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to reverse'
            throw err
        } finally {
            isSubmitting.value = false
        }
    }

    function reset() {
        items.value = []
        current.value = null
        currentLines.value = []
        error.value = null
    }

    return {
        items,
        current,
        currentLines,
        isLoading,
        isSubmitting,
        error,
        fetchList,
        fetchOne,
        createDraft,
        commit,
        reverse,
        reset,
    }
})
