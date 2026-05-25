// @ts-nocheck
/* eslint-disable */
/**
 * Auto-converted from src/stores/admin.js.
 * Behavior preserved 1:1; types tightened later.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/plugins/axios'

const ADMIN_SESSION_STORAGE_KEY = 'atabai-admin-session'

export const useAdminStore = defineStore('admin', () => {
    // ─── State ────────────────────────────────────────────────────────────────
    const adminInfo = ref(null)              // { id, email, name, role, totpEnabled }
    const isAdmin = computed(() => !!adminInfo.value)
    const isSuperAdmin = computed(() => adminInfo.value?.role === 'super_admin')

    const accessChecked = ref(false)
    const accessError = ref(null)

    // 2FA session
    const adminSessionId = ref(loadSessionFromStorage())
    const adminSessionExpiresAt = ref(loadSessionExpiryFromStorage())

    const hasValidAdminSession = computed(() => {
        if (!adminSessionId.value || !adminSessionExpiresAt.value) return false
        return new Date(adminSessionExpiresAt.value).getTime() > Date.now()
    })

    function loadSessionFromStorage() {
        try { return localStorage.getItem(ADMIN_SESSION_STORAGE_KEY) || null } catch { return null }
    }
    function loadSessionExpiryFromStorage() {
        try { return localStorage.getItem(ADMIN_SESSION_STORAGE_KEY + ':expires') || null } catch { return null }
    }
    function persistSession(sid, expiresAt) {
        try {
            if (sid) {
                localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, sid)
                if (expiresAt) localStorage.setItem(ADMIN_SESSION_STORAGE_KEY + ':expires', String(expiresAt))
            } else {
                localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
                localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY + ':expires')
            }
        } catch { /* ignore */ }
    }

    function setAdminSession(sid, expiresAt) {
        adminSessionId.value = sid
        adminSessionExpiresAt.value = expiresAt
        persistSession(sid, expiresAt)
    }

    function clearAdminSession() {
        adminSessionId.value = null
        adminSessionExpiresAt.value = null
        persistSession(null, null)
    }

    /**
     * Build axios config object with the X-Admin-Session header attached
     * if we have a valid session. Used by all protected admin requests.
     */
    function adminRequestConfig(extra = {}) {
        const headers = { ...(extra.headers || {}) }
        if (adminSessionId.value) {
            headers['X-Admin-Session'] = adminSessionId.value
        }
        return { ...extra, headers }
    }

    /**
     * Inspect an admin error. If the server says the admin session is expired
     * or missing, clear local state so the layout re-renders the 2FA gate.
     */
    function handleAdminError(err) {
        const code = err?.response?.data?.error
        if (code === '2FA_REQUIRED_VERIFY' || code === '2FA_REQUIRED_SETUP') {
            clearAdminSession()
            // If totpEnabled changed server-side, refresh adminInfo too.
            if (code === '2FA_REQUIRED_SETUP' && adminInfo.value) {
                adminInfo.value = { ...adminInfo.value, totpEnabled: false }
            }
        }
        throw err
    }

    /**
     * Wrap an axios call so that a 2FA_REQUIRED_* response automatically
     * clears local session state. All protected admin requests should go
     * through these wrappers instead of calling apiClient directly.
     */
    async function adminGet(url, extra = {}) {
        try { return await apiClient.get(url, adminRequestConfig(extra)) }
        catch (err) { return handleAdminError(err) }
    }
    async function adminPost(url, body, extra = {}) {
        try { return await apiClient.post(url, body, adminRequestConfig(extra)) }
        catch (err) { return handleAdminError(err) }
    }
    async function adminPut(url, body, extra = {}) {
        try { return await apiClient.put(url, body, adminRequestConfig(extra)) }
        catch (err) { return handleAdminError(err) }
    }
    async function adminPatch(url, body, extra = {}) {
        try { return await apiClient.patch(url, body, adminRequestConfig(extra)) }
        catch (err) { return handleAdminError(err) }
    }
    async function adminDelete(url, extra = {}) {
        try { return await apiClient.delete(url, adminRequestConfig(extra)) }
        catch (err) { return handleAdminError(err) }
    }

    // ─── Access check ─────────────────────────────────────────────────────────
    async function checkAdminAccess() {
        try {
            accessError.value = null
            const response = await apiClient.get('/admin/me')
            adminInfo.value = response.data.admin
            accessChecked.value = true
            return true
        } catch (err) {
            adminInfo.value = null
            accessError.value = err.response?.status === 403
                ? 'FORBIDDEN'
                : (err.response?.data?.error || 'UNKNOWN')
            accessChecked.value = true
            return false
        }
    }

    function clearAdminState() {
        adminInfo.value = null
        accessChecked.value = false
        accessError.value = null
        clearAdminSession()
    }

    // ─── 2FA ──────────────────────────────────────────────────────────────────
    async function fetch2FAStatus() {
        const response = await apiClient.get('/admin/2fa/status')
        return response.data
    }

    async function setup2FA() {
        const response = await apiClient.post('/admin/2fa/setup')
        return response.data
    }

    async function confirm2FA(code) {
        const response = await apiClient.post('/admin/2fa/confirm', { code })
        if (response.data.adminSession) {
            setAdminSession(response.data.adminSession.sessionId, response.data.adminSession.expiresAt)
        }
        // Refresh admin info so totpEnabled reflects new state
        await checkAdminAccess()
        return response.data
    }

    async function verify2FA(code) {
        const response = await apiClient.post('/admin/2fa/verify', { code })
        if (response.data.adminSession) {
            setAdminSession(response.data.adminSession.sessionId, response.data.adminSession.expiresAt)
        }
        return response.data
    }

    async function adminLogout2FA() {
        try {
            await apiClient.post('/admin/2fa/logout', {}, adminRequestConfig())
        } catch (err) {
            // Idempotent — swallow errors
        }
        clearAdminSession()
    }

    async function disable2FA(code) {
        const response = await apiClient.post('/admin/2fa/disable', { code })
        clearAdminSession()
        await checkAdminAccess()
        return response.data
    }

    async function regenerateBackupCodes(code) {
        const response = await adminPost('/admin/2fa/backup-codes/regenerate', { code })
        return response.data
    }

    // ─── Stats ────────────────────────────────────────────────────────────────
    async function fetchStats() {
        const response = await adminGet('/admin/stats')
        return response.data.stats
    }

    // ─── Users ────────────────────────────────────────────────────────────────
    async function listUsers(params = {}) {
        const response = await adminGet('/admin/users', { params })
        return response.data
    }

    async function getUserDetails(userId) {
        const response = await adminGet(`/admin/users/${userId}`)
        return response.data
    }

    async function getUserFiles(userId, params = {}) {
        const response = await adminGet(`/admin/users/${userId}/files`, { params })
        return response.data
    }

    async function updateUserRole(userId, role) {
        const response = await adminPatch(`/admin/users/${userId}/role`, { role })
        return response.data
    }

    async function updateUserActive(userId, isActive) {
        const response = await adminPatch(`/admin/users/${userId}/active`, { isActive })
        return response.data
    }

    async function updateUserSubscription(userId, subscriptionType, subscriptionExpiresAt = null) {
        const response = await adminPatch(`/admin/users/${userId}/subscription`, {
            subscriptionType,
            subscriptionExpiresAt
        })
        return response.data
    }

    // ─── Email whitelist ──────────────────────────────────────────────────────
    async function listWhitelist() {
        const response = await adminGet('/admin/whitelist')
        return response.data
    }

    async function addWhitelistEntry(email, note = '') {
        const response = await adminPost('/admin/whitelist', { email, note })
        return response.data
    }

    async function bulkAddWhitelist(emails, note = '') {
        const response = await adminPost('/admin/whitelist/bulk', { emails, note })
        return response.data
    }

    async function removeWhitelistEntry(entryId) {
        const response = await adminDelete(`/admin/whitelist/${entryId}`)
        return response.data
    }

    // ─── Files ────────────────────────────────────────────────────────────────
    async function listAllFiles(params = {}) {
        const response = await adminGet('/admin/files', { params })
        return response.data
    }

    async function getFileDetails(fileId) {
        const response = await adminGet(`/admin/files/${fileId}`)
        return response.data
    }

    async function getFileTransformation(fileId) {
        const response = await adminGet(`/admin/files/${fileId}/transformation`)
        return response.data
    }

    function downloadFileUrl(fileId, type = 'processed') {
        const base = apiClient.defaults.baseURL || ''
        return `${base}/admin/files/${fileId}/download?type=${type}`
    }

    async function downloadFile(fileId, type = 'processed') {
        const response = await adminGet(
            `/admin/files/${fileId}/download`,
            { params: { type }, responseType: 'blob' }
        )
        return response
    }

    // ─── Mappings ─────────────────────────────────────────────────────────────
    async function listMappingSets() {
        const response = await adminGet('/admin/mappings')
        return response.data
    }

    async function getPublishedSet(reportType) {
        const response = await adminGet(`/admin/mappings/${reportType}/published`)
        return response.data
    }

    async function getDraftSet(reportType) {
        try {
            const response = await adminGet(`/admin/mappings/${reportType}/draft`)
            return response.data
        } catch (err) {
            if (err.response?.status === 404) return null
            throw err
        }
    }

    async function getSetById(setId) {
        const response = await adminGet(`/admin/mappings/sets/${setId}`)
        return response.data
    }

    async function createDraft(reportType) {
        const response = await adminPost(`/admin/mappings/${reportType}/draft`, {})
        return response.data
    }

    // Fork an arbitrary set (published or archived) into a new draft. Optional
    // body overrides assignedUsers and label.
    async function forkSet(setId, { assignedUsers, label } = {}) {
        const body = {}
        if (Array.isArray(assignedUsers)) body.assignedUsers = assignedUsers
        if (typeof label === 'string') body.label = label
        const response = await adminPost(`/admin/mappings/sets/${setId}/fork`, body)
        return response.data
    }

    // Create a blank user-specific draft. assignedUsers is required.
    async function createBlankDraft(reportType, { assignedUsers, label } = {}) {
        const response = await adminPost(`/admin/mappings/${reportType}/blank-draft`, {
            assignedUsers: assignedUsers || [],
            label: label || ''
        })
        return response.data
    }

    // Update assignedUsers and/or label on a draft.
    async function updateSetScope(setId, { assignedUsers, label } = {}) {
        const body = {}
        if (Array.isArray(assignedUsers)) body.assignedUsers = assignedUsers
        if (typeof label === 'string') body.label = label
        const response = await adminPatch(`/admin/mappings/sets/${setId}/scope`, body)
        return response.data
    }

    async function publishDraft(setId, notes) {
        const response = await adminPost(`/admin/mappings/sets/${setId}/publish`, { notes })
        return response.data
    }

    async function deleteSet(setId) {
        const response = await adminDelete(`/admin/mappings/sets/${setId}`)
        return response.data
    }

    async function addRow(setId, payload) {
        const response = await adminPost(`/admin/mappings/sets/${setId}/rows`, payload)
        return response.data
    }

    async function updateRow(rowId, payload) {
        const response = await adminPatch(`/admin/mappings/rows/${rowId}`, payload)
        return response.data
    }

    async function deleteRow(rowId) {
        const response = await adminDelete(`/admin/mappings/rows/${rowId}`)
        return response.data
    }

    async function updateEquityConfig(setId, payload) {
        const response = await adminPut(`/admin/mappings/sets/${setId}/equity`, payload)
        return response.data
    }

    async function runMappingSeed() {
        const response = await adminPost('/admin/mappings/seed', {})
        return response.data
    }

    // ─── Locales (i18n editor) ───────────────────────────────────────────────
    async function listLocaleKeys(params = {}) {
        const response = await adminGet('/admin/locales', { params })
        return response.data
    }

    async function listLocaleNamespaces() {
        const response = await adminGet('/admin/locales/namespaces')
        return response.data
    }

    async function fetchLocaleStats() {
        const response = await adminGet('/admin/locales/stats')
        return response.data
    }

    async function createLocaleKey(payload) {
        const response = await adminPost('/admin/locales/keys', payload)
        return response.data
    }

    async function updateLocaleKey(keyId, payload) {
        const response = await adminPatch(`/admin/locales/keys/${keyId}`, payload)
        return response.data
    }

    async function deleteLocaleKey(keyId) {
        const response = await adminDelete(`/admin/locales/keys/${keyId}`)
        return response.data
    }

    async function runLocaleSeed() {
        const response = await adminPost('/admin/locales/seed', {})
        return response.data
    }

    return {
        // state
        adminInfo,
        accessChecked,
        accessError,
        adminSessionId,
        adminSessionExpiresAt,
        // getters
        isAdmin,
        isSuperAdmin,
        hasValidAdminSession,
        // access
        checkAdminAccess,
        clearAdminState,
        clearAdminSession,
        // 2FA
        fetch2FAStatus,
        setup2FA,
        confirm2FA,
        verify2FA,
        adminLogout2FA,
        disable2FA,
        regenerateBackupCodes,
        // stats
        fetchStats,
        // users
        listUsers,
        getUserDetails,
        getUserFiles,
        updateUserRole,
        updateUserActive,
        updateUserSubscription,
        // whitelist
        listWhitelist,
        addWhitelistEntry,
        bulkAddWhitelist,
        removeWhitelistEntry,
        // files
        listAllFiles,
        getFileDetails,
        getFileTransformation,
        downloadFileUrl,
        downloadFile,
        // mappings
        listMappingSets,
        getPublishedSet,
        getDraftSet,
        getSetById,
        createDraft,
        forkSet,
        createBlankDraft,
        updateSetScope,
        publishDraft,
        deleteSet,
        addRow,
        updateRow,
        deleteRow,
        updateEquityConfig,
        runMappingSeed,
        // locales
        listLocaleKeys,
        listLocaleNamespaces,
        fetchLocaleStats,
        createLocaleKey,
        updateLocaleKey,
        deleteLocaleKey,
        runLocaleSeed
    }
})
