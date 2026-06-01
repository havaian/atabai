<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <router-link to="/admin/users" class="adm-page-subtitle" style="text-decoration: none;">
                    {{ $t('admin.userDetail.backLink') }}
                </router-link>
                <h1 class="adm-page-title" v-if="user">{{ user.name }}</h1>
                <h1 class="adm-page-title" v-else>{{ $t('admin.userDetail.defaultTitle') }}</h1>
                <div v-if="user" class="adm-page-subtitle adm-mono">{{ user.email }}</div>
            </div>
            <div class="adm-row" v-if="user && isSuperAdmin && !isSelf">
                <button class="adm-btn adm-btn--ghost" @click="showRoleModal = true">
                    {{ $t('admin.userDetail.changeRole') }}
                </button>
                <button
                    class="adm-btn"
                    :class="user.isActive ? 'adm-btn--danger' : 'adm-btn--primary'"
                    @click="toggleActive"
                >
                    {{ user.isActive ? $t('admin.userDetail.deactivate') : $t('admin.userDetail.activate') }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <template v-else-if="user">
            <!-- User info card -->
            <div class="adm-card">
                <h3 class="adm-card-title">{{ $t('admin.userDetail.infoSection') }}</h3>
                <div class="adm-grid-2">
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.userDetail.fieldRole') }}</div>
                            <span class="adm-badge" :class="`adm-badge--role-${user.role}`">{{ user.role }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.userDetail.fieldStatus') }}</div>
                            <span class="adm-badge" :class="user.isActive ? 'adm-badge--active' : 'adm-badge--inactive'">
                                {{ user.isActive ? $t('admin.common.active') : $t('admin.common.inactive') }}
                            </span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.userDetail.fieldSubscription') }}</div>
                            <div v-if="!subEditing" class="adm-subscription-display">
                                <span class="adm-badge" :class="user.subscriptionType === 'premium' ? 'adm-badge--premium' : ''">
                                    {{ user.subscriptionType }}
                                </span>
                                <span v-if="user.subscriptionExpiresAt" class="adm-text-xs adm-text-muted">
                                    {{ $t('admin.userDetail.subUntil') }} {{ formatDate(user.subscriptionExpiresAt) }}
                                </span>
                                <button v-if="canEditSub" class="adm-btn-link" @click="startSubEdit">
                                    {{ $t('admin.common.edit') }}
                                </button>
                            </div>
                            <div v-else class="adm-subscription-edit">
                                <select v-model="subForm.type" class="adm-input adm-input-sm">
                                    <option value="basic">basic</option>
                                    <option value="premium">premium</option>
                                </select>
                                <input
                                    v-if="subForm.type === 'premium'"
                                    type="date"
                                    v-model="subForm.expires"
                                    class="adm-input adm-input-sm"
                                    :placeholder="$t('admin.userDetail.subNoExpiry')"
                                />
                                <button class="adm-btn-sm adm-btn--primary" :disabled="subSubmitting" @click="saveSubscription">
                                    {{ subSubmitting ? '...' : $t('admin.common.save') }}
                                </button>
                                <button class="adm-btn-sm adm-btn--ghost" @click="cancelSubEdit">
                                    {{ $t('admin.common.cancel') }}
                                </button>
                            </div>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.userDetail.fieldLanguage') }}</div>
                            <span class="adm-text-sm">{{ user.preferences?.language || '—' }}</span>
                        </div>
                    </div>
                    <div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.userDetail.fieldCreated') }}</div>
                            <span class="adm-text-sm">{{ formatDate(user.createdAt) }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.userDetail.fieldLastLogin') }}</div>
                            <span class="adm-text-sm">{{ formatDate(user.lastLoginAt) }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.userDetail.fieldGoogleId') }}</div>
                            <span class="adm-mono adm-text-xs">{{ user.googleId }}</span>
                        </div>
                        <div class="adm-field">
                            <div class="adm-field-label">{{ $t('admin.userDetail.fieldUserId') }}</div>
                            <span class="adm-mono adm-text-xs">{{ user._id }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- Role change modal -->
        <div v-if="showRoleModal" class="adm-modal-backdrop" @click.self="showRoleModal = false">
            <div class="adm-modal">
                <h3 class="adm-modal-title">{{ $t('admin.userDetail.roleModalTitle') }}</h3>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.userDetail.roleModalNew') }}</div>
                    <select v-model="newRole" class="adm-select">
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="super_admin">super_admin</option>
                    </select>
                </div>
                <div class="adm-text-sm adm-muted">
                    {{ $t('admin.userDetail.roleModalWarning') }}
                </div>
                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="showRoleModal = false">{{ $t('admin.common.cancel') }}</button>
                    <button class="adm-btn adm-btn--primary" @click="confirmRoleChange">{{ $t('admin.common.save') }}</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const { t, locale } = useI18n()

const user = ref(null)

const loading = ref(false)
const error = ref(null)

const showRoleModal = ref(false)
const newRole = ref('user')

// ── Subscription inline editor ──
const subEditing = ref(false)
const subSubmitting = ref(false)
const subForm = ref({ type: 'basic', expires: '' })

const isSuperAdmin = computed(() => adminStore.isSuperAdmin)
const isSelf = computed(() => user.value?._id === adminStore.adminInfo?.id)
const canEditSub = computed(() => isSuperAdmin.value)

const userId = computed(() => route.params.userId)

function startSubEdit() {
    subForm.value.type = user.value?.subscriptionType || 'basic'
    // Convert ISO date → YYYY-MM-DD for <input type="date">
    const exp = user.value?.subscriptionExpiresAt
    subForm.value.expires = exp ? new Date(exp).toISOString().slice(0, 10) : ''
    subEditing.value = true
}

function cancelSubEdit() {
    subEditing.value = false
}

async function saveSubscription() {
    if (!user.value) return
    subSubmitting.value = true
    try {
        const expires = subForm.value.type === 'premium' && subForm.value.expires
            ? new Date(subForm.value.expires).toISOString()
            : null
        const res = await adminStore.updateUserSubscription(user.value._id, subForm.value.type, expires)
        user.value.subscriptionType = res.user.subscriptionType
        user.value.subscriptionExpiresAt = res.user.subscriptionExpiresAt
        subEditing.value = false
    } catch (err) {
        alert(t('admin.userDetail.subUpdateError'))
    } finally {
        subSubmitting.value = false
    }
}

async function loadUser() {
    loading.value = true
    error.value = null
    try {
        const data = await adminStore.getUserDetails(userId.value)
        user.value = data.user
        newRole.value = data.user.role
    } catch (err) {
        error.value = err.response?.data?.message || t('admin.userDetail.loadError')
    } finally {
        loading.value = false
    }
}

async function confirmRoleChange() {
    try {
        await adminStore.updateUserRole(userId.value, newRole.value)
        showRoleModal.value = false
        await loadUser()
    } catch (err) {
        alert(err.response?.data?.message || t('admin.common.error'))
    }
}

async function toggleActive() {
    if (!user.value) return
    const action = user.value.isActive
        ? t('admin.userDetail.deactivate').toLowerCase()
        : t('admin.userDetail.activate').toLowerCase()
    if (!confirm(t('admin.userDetail.confirmToggleActive', { action, email: user.value.email }))) return
    try {
        await adminStore.updateUserActive(userId.value, !user.value.isActive)
        await loadUser()
    } catch (err) {
        alert(err.response?.data?.message || t('admin.common.error'))
    }
}

function formatDate(d) {
    if (!d) return '—'
    const localeMap = { ru: 'ru-RU', en: 'en-GB', uz: 'uz-UZ' }
    return new Date(d).toLocaleString(localeMap[locale.value] || 'ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

onMounted(async () => {
    await loadUser()
})
</script>
