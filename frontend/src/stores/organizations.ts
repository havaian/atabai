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
    /**
     * Currently-active org id. Initially read from localStorage so the first
     * /session call carries it in the header, but the SERVER is the source
     * of truth — the response either echoes our claim (valid) or replaces
     * it (stale / revoked / never-valid). On every /session response we
     * overwrite from `session.activeOrgId`, not the other way around.
     */
    const currentOrgId = ref(readActiveOrgId())
    const isLoading = ref(false)
    const error = ref(null)
    /** True after the first successful list fetch — controls onboarding redirect. */
    const isInitialized = ref(false)

    /**
     * Authoritative capability set for the active membership, as resolved by
     * the backend's /session endpoint. UI gates on this — NOT on local
     * inference from items[].membership — because the backend is the only
     * place that can honestly say "you are an admin here" or "you have
     * cap X". Empty when there is no active org.
     */
    const capabilities = ref([])
    /** Backend's verdict on whether the user is admin in the active org. */
    const isOrgAdmin = ref(false)

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

    /**
     * Fetch the authoritative session from the backend. Replaces the
     * previous two-call pattern (listMine + listPendingInvites). The
     * backend honours our X-Active-Org-Id claim only if it matches a real
     * active membership; otherwise it picks a default and tells us. We
     * then mirror its choice into localStorage so subsequent requests
     * carry the same valid id in the header.
     *
     * Single round-trip on bootstrap, single round-trip on org switch.
     * Anything else (gating sidebar nav off localStorage) re-introduces
     * the divergence between the UI's idea of "current org" and the
     * server's idea of what the user can do — the exact bug we are
     * avoiding by going through this endpoint.
     */
    async function fetchSession() {
        isLoading.value = true
        error.value = null
        try {
            // apiClient axios interceptor attaches X-Active-Org-Id from
            // currentOrgId.value on every request — the backend uses it
            // to either honour or replace our claim.
            const resp = await apiClient.get('/organizations/session')
            const session = resp.data.session || {}
            items.value = resp.data.organizations || []
            pendingInvites.value = resp.data.pendingInvites || []
            // Critical: trust the server's activeOrgId. If our local claim
            // was stale, this corrects it.
            const serverActive = session.activeOrgId || null
            if (serverActive !== currentOrgId.value) {
                currentOrgId.value = serverActive
                persistActiveOrgId(serverActive)
            }
            capabilities.value = session.capabilities || []
            isOrgAdmin.value = !!session.isOrgAdmin
            isInitialized.value = true
            return { orgs: items.value, invites: pendingInvites.value, session }
        } catch (err) {
            error.value = err?.response?.data?.message || err?.message || 'Failed to load session'
            console.error('organizations.fetchSession error:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /** Back-compat alias — older call sites still reference fetchAll. */
    const fetchAll = fetchSession

    /**
     * Convenience: call this once after auth bootstrap. No-op if already
     * initialized — multiple call sites (App.vue mount, router guard, org
     * switcher mount) can all call it safely.
     */
    async function ensureInitialized(force = false) {
        if (isInitialized.value && !force) return
        await fetchSession()
    }

    /**
     * Switch the active org. The client's idea of "active" changes locally
     * first (so the request that follows carries the new X-Active-Org-Id),
     * then /session is re-fetched to lock it in with the backend's blessing
     * + the new capability set. If the backend rejects the claim (revoked
     * mid-session, etc.) fetchSession will overwrite back to a valid org.
     *
     * Throws if the id isn't in the user's known active list — silently
     * switching to an org the user can't access is the kind of bug that
     * causes "why are my balances empty?" support tickets.
     */
    async function setCurrentOrg(orgId) {
        if (!orgId) {
            currentOrgId.value = null
            persistActiveOrgId(null)
            capabilities.value = []
            isOrgAdmin.value = false
            return
        }
        const match = items.value.find((o) => o.id === orgId)
        if (!match) {
            throw new Error(`Organization ${orgId} is not in the active list`)
        }
        currentOrgId.value = orgId
        persistActiveOrgId(orgId)
        // Re-fetch /session so capabilities and isOrgAdmin reflect the new
        // active org. Without this the UI would carry the previous org's
        // capability set until the next bootstrap.
        await fetchSession()
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
            // Promote the new org to active locally BEFORE the next /session
            // call, so the X-Active-Org-Id header sent by the axios
            // interceptor on that call is already the new org id. This is
            // what causes the server's /session response to return the new
            // org as activeOrgId — without it, the server would default to
            // whichever org was first in the sorted list (which, for a
            // brand-new tenant, may be a different one).
            const newOrgId = resp.data.organization?.id
            if (newOrgId) {
                currentOrgId.value = newOrgId
                persistActiveOrgId(newOrgId)
            }
            // One /session call replaces the old (fetchAll + setCurrentOrg)
            // two-call sequence: it returns the canonical list including
            // the new org AND the server-validated capability set for it.
            await fetchSession()
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
        capabilities.value = []
        isOrgAdmin.value = false
        isInitialized.value = false
        error.value = null
        persistActiveOrgId(null)
    }

    // ─── Internal helpers ───────────────────────────────────────────────────
    //
    // Note: the previous `reconcileActiveOrg()` helper has been removed.
    // Reconciliation is now the backend's job — /session decides which org
    // is active given the client's claim and the membership table. Doing
    // it locally would re-introduce the divergence between UI state and
    // authorization state.

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
        capabilities,
        isOrgAdmin,
        // getters
        currentOrg,
        currentMembership,
        hasOrgs,
        hasInvites,
        needsOnboarding,
        // actions
        fetchAll,
        fetchSession,
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
