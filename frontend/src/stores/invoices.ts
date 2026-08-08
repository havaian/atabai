/**
 * Invoice-registry preview store - methodology §7 (build phase 3).
 *
 * Mirrors the bank store's upload → preview → fix → commit shape so the mental
 * model carries straight over, but talks to the invoice-registry endpoints and
 * carries a `direction` (incoming / outgoing) instead of a statement account.
 * Unlike the bank upload there is no background job - the invoice upload
 * returns its summary inline.
 *
 * Consumed by InvoiceUploadView (uploadInvoice), InvoiceBatchesView
 * (fetchBatches) and InvoicePreviewView (fetchDrafts / updateDraft / commit).
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/plugins/axios'
import { useOrganizationsStore } from '@/stores/organizations'

/** Which Didox registry an upload is (methodology §7). */
export type InvoiceDirection = 'incoming' | 'outgoing'

/** One draft leg the operator assigns an account to (RED-row fix, §7.2). */
export interface InvoiceOperatorLine {
  lineId: string
  label: string
  amount: string
  accountCode?: string | null
}

/** A single invoice draft as returned by the drafts endpoint. Kept permissive
 *  - the preview view reads a subset and tolerates extra fields. */
export interface InvoiceDraft {
  id: string
  sourceRef: string | null
  date: string | null
  description: string | null
  totalAmount: string
  status: 'draft' | 'committed' | 'reversed'
  color: 'green' | 'yellow' | 'red'
  previewReason?: string | null
  direction?: InvoiceDirection
  counterpartyName?: string | null
  subtype?: string | null
  periodId?: string | null
  periodLabel?: string | null
  periodLocked?: boolean
  operatorLines?: InvoiceOperatorLine[]
  createdAt?: string | null
}

/** One upload batch row in the period history. */
export interface InvoiceBatch {
  uploadId: string
  uploadedAt: string | null
  totalInvoices: number
  statusCounts: { draft: number; committed: number; reversed: number }
  draftColorCounts: { green: number; yellow: number; red: number }
  status: 'draft' | 'committed'
  pendingRed: number
}

/** One line-account assignment sent on a draft fix (matches the backend DTO). */
export interface InvoiceLineAccount {
  lineId: string
  accountCode: string
}

interface CommitResult {
  committed: number
  skipped: number
  reversed: number
  rolledUpKeys: number
}

export const useInvoicesStore = defineStore('invoices', () => {
  const orgs = useOrganizationsStore()

  const drafts = ref<InvoiceDraft[]>([])
  const batches = ref<InvoiceBatch[]>([])
  const isLoading = ref(false)
  const isUploading = ref(false)
  const isCommitting = ref(false)
  const error = ref<string | null>(null)

  function orgScope(path: string): string {
    if (!orgs.currentOrgId) throw new Error('No active organization')
    return `/organizations/${orgs.currentOrgId}/ledger${path}`
  }

  function messageFrom(err: unknown, fallback: string): string {
    const e = err as { response?: { data?: { message?: string } }; message?: string }
    return e?.response?.data?.message || e?.message || fallback
  }

  /** Upload a Didox registry export. `direction` says which file it is - the
   *  operator picks it (it isn't in the file), same shape as the bank module
   *  picking the statement account. Returns the uploadId + summary. */
  async function uploadInvoice(args: {
    periodId: string
    file: File
    direction: InvoiceDirection
  }): Promise<{ uploadId?: string; summary?: unknown }> {
    isUploading.value = true
    error.value = null
    try {
      const fd = new FormData()
      fd.append('file', args.file)
      fd.append('direction', args.direction)
      const resp = await apiClient.post(
        orgScope(`/periods/${args.periodId}/invoice-registry`),
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      const summary = resp.data?.summary
      return { uploadId: summary?.uploadId, summary }
    } catch (err) {
      error.value = messageFrom(err, 'Failed to upload')
      throw err
    } finally {
      isUploading.value = false
    }
  }

  /** All upload batches in a period (history list). */
  async function fetchBatches(args: { periodId: string }): Promise<InvoiceBatch[]> {
    isLoading.value = true
    error.value = null
    try {
      const resp = await apiClient.get(
        orgScope(`/periods/${args.periodId}/invoice-registry`),
      )
      batches.value = (resp.data?.batches ?? []) as InvoiceBatch[]
      return batches.value
    } catch (err) {
      error.value = messageFrom(err, 'Failed to load batches')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /** The preview feed for one upload. status='committed' loads an already-
   *  posted batch read-only; omitted → live draft preview. */
  async function fetchDrafts(args: {
    periodId: string
    uploadId: string
    status?: 'draft' | 'committed'
  }): Promise<InvoiceDraft[]> {
    isLoading.value = true
    try {
      const resp = await apiClient.get(
        orgScope(`/periods/${args.periodId}/invoice-registry/${args.uploadId}/drafts`),
        { params: args.status ? { status: args.status } : {} },
      )
      drafts.value = (resp.data?.drafts ?? []) as InvoiceDraft[]
      return drafts.value
    } catch (err) {
      error.value = messageFrom(err, 'Failed to load drafts')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /** Set the per-line accounts on a RED invoice draft (§7.2). */
  async function updateDraft(args: {
    periodId: string
    uploadId: string
    entryId: string
    lineAccounts: InvoiceLineAccount[]
  }): Promise<Partial<InvoiceDraft>> {
    const resp = await apiClient.patch(
      orgScope(
        `/periods/${args.periodId}/invoice-registry/${args.uploadId}/drafts/${args.entryId}`,
      ),
      { lineAccounts: args.lineAccounts },
    )
    const updated = resp.data?.draft as Partial<InvoiceDraft> | undefined
    if (updated) {
      const idx = drafts.value.findIndex((d) => d.id === args.entryId)
      if (idx !== -1) drafts.value[idx] = { ...drafts.value[idx], ...updated }
    }
    return updated ?? {}
  }

  /** Post all non-RED drafts. Returns the commit result counters. */
  async function commit(args: {
    periodId: string
    uploadId: string
  }): Promise<CommitResult> {
    isCommitting.value = true
    error.value = null
    try {
      const resp = await apiClient.post(
        orgScope(`/periods/${args.periodId}/invoice-registry/${args.uploadId}/commit`),
      )
      return resp.data as CommitResult
    } catch (err) {
      error.value = messageFrom(err, 'Failed to commit')
      throw err
    } finally {
      isCommitting.value = false
    }
  }

  function reset(): void {
    drafts.value = []
    batches.value = []
    error.value = null
  }

  return {
    drafts,
    batches,
    isLoading,
    isUploading,
    isCommitting,
    error,
    uploadInvoice,
    fetchBatches,
    fetchDrafts,
    updateDraft,
    commit,
    reset,
  }
})
