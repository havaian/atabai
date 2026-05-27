// @ts-nocheck
/* eslint-disable */
/**
 * Organizations store — front-end side of the access spine + ledger bootstrap
 * (architecture doc §7.6, §8.3).
 *
 * Single source of truth for:
 *   - The list of orgs the caller is an active member of.
 *   - The currently-active org (the "session context" §8.3 mentions).
 *   - The caller's pending invites that they can accept.
 *
 * Active-org is stored in localStorage so a refresh / new tab keeps the
 * same context. When the active org disappears from the list (revoked,
 * left, etc.) the store falls back to the first available org or null.
 *
 * Auth integration: this store doesn't touch authentication itself — it
 * just reads accessToken via the existing apiClient interceptor. Callers
 * MUST call `bootstrap()` after auth succeeds (typically from App.vue or
 * a router guard) to populate the initial state.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/plugins/axios'

const ACTIVE_ORG_KEY = 'atabai-active-org-id'

export const useOrganizationsStore = defineStore('organizations', () => {
    // ─── State ──────────────────────────────────────────────────────────────
    /** Active memberships (org + the caller's role/caps within it). */
    const items = ref([])
    /** Pending invites waiting on the caller's accept. */
    const pendingInvites = ref([])
    /** Currently-active org id — null when the user has no orgs yet. */
    const currentOrgId = ref(readActiveOrgId())
    const isLoading = ref(false)
    const error = ref(null)
    /** True after the first successful list fetch — controls onboarding redirect. */
    const isInitialized = ref(false)

    // ─── Getters ────────────────────────────────────────────────────────────
    const currentOrg = computed(() => {
        if (!currentOrgId.value) return null
        return items.value.find((o) => o.id === currentOrgId.value) || null
    })
    const currentMembership = computed(() => currentOrg.value?.membership || null)
    const hasOrgs = computed(() => items.value.length > 0)
    const hasInvites = computed(() => pendingInvites.value.length > 0)
    /**
     * The decision flag the auth bootstrap uses to decide where to send a
     * just-logged-in user. True iff they have no active orgs AND no pending
     * invites — the only state where the onboarding wizard is the natural
     * landing page.
     */
    const needsOnboarding = computed(
        () => isInitialized.value && !hasOrgs.value && !hasInvites.value,
    )

    // ─── Actions ────────────────────────────────────────────────────────────

    /** Fetch active memberships + pending invites in parallel. */
    async function fetchAll() {
        isLoading.value = true
        error.value = null
        try {
            const [orgsResp, invitesResp] = await Promise.all([
                apiClient.get('/organizations'),
                apiClient.get('/organizations/pending-invites'),
            ])
            items.value = orgsResp.data.organizations || []
            pendingInvites.value = invitesResp.data.invites || []
            reconcileActiveOrg()
            isInitialized.value = true
            return { orgs: items.value, invites: pendingInvites.value }
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to load organizations'
            console.error('organizations.fetchAll error:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Convenience: call this once after auth bootstrap. No-op if already
     * initialized — multiple call sites (App.vue mount, router guard, org
     * switcher mount) can all call it safely.
     */
    async function ensureInitialized(force = false) {
        if (isInitialized.value && !force) return
        await fetchAll()
    }

    /**
     * Switch the active org. Persists to localStorage so the choice
     * survives reloads. Throws if the id isn't in the user's active list —
     * silently switching to an org the user can't actually access is the
     * kind of bug that causes "why are my balances empty?" support tickets.
     */
    function setCurrentOrg(orgId) {
        if (!orgId) {
            currentOrgId.value = null
            persistActiveOrgId(null)
            return
        }
        const match = items.value.find((o) => o.id === orgId)
        if (!match) {
            throw new Error(`Organization ${orgId} is not in the active list`)
        }
        currentOrgId.value = orgId
        persistActiveOrgId(orgId)
    }

    /**
     * Bootstrap a new organization through the ledger-side onboarding endpoint
     * — atomically creates the access-spine Organization + admin Membership +
     * OrganizationProfile + seeds the 507-account NSBU chart + creates the
     * three first-time-adoption ReportingPeriods. See LedgerBootstrapService
     * on the backend.
     */
    async function bootstrap(payload) {
        isLoading.value = true
        error.value = null
        try {
            const resp = await apiClient.post('/onboarding/organizations', payload)
            // The bootstrap response shape differs from /organizations — it
            // returns the full org + membership + profile + periods + chart
            // seed counts. Re-fetch the list to pick up the new org in our
            // canonical shape rather than synthesising it locally.
            await fetchAll()
            // Make the just-created org active.
            const newOrgId = resp.data.organization?.id
            if (newOrgId && items.value.some((o) => o.id === newOrgId)) {
                setCurrentOrg(newOrgId)
            }
            return resp.data
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to create organization'
            console.error('organizations.bootstrap error:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /** Accept a pending invite. The invite flips to active membership. */
    async function acceptInvite(membershipId) {
        isLoading.value = true
        error.value = null
        try {
            await apiClient.post(`/organizations/invites/${membershipId}/accept`)
            await fetchAll()
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to accept invite'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Invite a user to the current org. Caller must be admin in the active
     * org (the OrgMembershipGuard enforces this; the UI hides the button).
     */
    async function inviteMember({ email, role = 'member', capabilities = [] }) {
        if (!currentOrgId.value) throw new Error('No active organization')
        isLoading.value = true
        error.value = null
        try {
            const resp = await apiClient.post(
                `/organizations/${currentOrgId.value}/invites`,
                { email, role, capabilities },
            )
            return resp.data.membership
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to send invite'
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /** List members of the current org. Returns the array, doesn't cache (small + dynamic). */
    async function listMembers(orgId) {
        const targetOrgId = orgId || currentOrgId.value
        if (!targetOrgId) throw new Error('No active organization')
        const resp = await apiClient.get(`/organizations/${targetOrgId}/members`)
        return resp.data.members || []
    }

    async function updateMember({ orgId, membershipId, role, capabilities }) {
        const targetOrgId = orgId || currentOrgId.value
        if (!targetOrgId) throw new Error('No active organization')
        const payload = {}
        if (role !== undefined) payload.role = role
        if (capabilities !== undefined) payload.capabilities = capabilities
        const resp = await apiClient.patch(
            `/organizations/${targetOrgId}/members/${membershipId}`,
            payload,
        )
        return resp.data.membership
    }

    async function revokeMember({ orgId, membershipId }) {
        const targetOrgId = orgId || currentOrgId.value
        if (!targetOrgId) throw new Error('No active organization')
        const resp = await apiClient.delete(
            `/organizations/${targetOrgId}/members/${membershipId}`,
        )
        return resp.data.membership
    }

    /** Clear all state — for sign-out. */
    function reset() {
        items.value = []
        pendingInvites.value = []
        currentOrgId.value = null
        isInitialized.value = false
        error.value = null
        persistActiveOrgId(null)
    }

    // ─── Internal helpers ───────────────────────────────────────────────────

    function reconcileActiveOrg() {
        if (items.value.length === 0) {
            currentOrgId.value = null
            persistActiveOrgId(null)
            return
        }
        const stillValid = currentOrgId.value && items.value.some((o) => o.id === currentOrgId.value)
        if (!stillValid) {
            currentOrgId.value = items.value[0].id
            persistActiveOrgId(currentOrgId.value)
        }
    }

    function readActiveOrgId() {
        try {
            return localStorage.getItem(ACTIVE_ORG_KEY) || null
        } catch (_) {
            return null
        }
    }

    function persistActiveOrgId(value) {
        try {
            if (value) localStorage.setItem(ACTIVE_ORG_KEY, value)
            else localStorage.removeItem(ACTIVE_ORG_KEY)
        } catch (_) {
            // localStorage unavailable — non-fatal, just won't persist.
        }
    }

    return {
        // state
        items,
        pendingInvites,
        currentOrgId,
        isLoading,
        error,
        isInitialized,
        // getters
        currentOrg,
        currentMembership,
        hasOrgs,
        hasInvites,
        needsOnboarding,
        // actions
        fetchAll,
        ensureInitialized,
        setCurrentOrg,
        bootstrap,
        acceptInvite,
        inviteMember,
        listMembers,
        updateMember,
        revokeMember,
        reset,
    }
})
