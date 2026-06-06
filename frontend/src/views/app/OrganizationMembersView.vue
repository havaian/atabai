<!-- frontend/src/views/app/OrganizationMembersView.vue
     Member management for the active org. Admin-only — non-admins see a
     read-only view of the member list.

     Backend invariants visible here:
       - Never-last-admin: demoting / revoking the only active admin
         returns LAST_ADMIN; we surface the error inline rather than
         pre-blocking the UI (the server is the single source of truth).
       - Pending email invites: members with userId === null and
         invitedEmail set are pre-registration invites waiting to be
         resolved on the invitee's first Google login. -->
<template>
    <div class="members-view">
        <header class="members-header">
            <button class="members-back" @click="back">
                <ArrowLeft :size="16" /> {{ $t('common.back') }}
            </button>
            <div>
                <h1>{{ $t('members.title') }}</h1>
                <p>{{ orgs.currentOrg?.name }}</p>
            </div>
            <UiButton v-if="isAdmin" variant="primary" @click="openInvite">
                <UserPlus :size="16" /> {{ $t('members.invite') }}
            </UiButton>
        </header>

        <div v-if="isLoading && members.length === 0" class="members-empty">
            <div class="spinner" />
        </div>

        <ul v-else-if="members.length > 0" class="members-list">
            <li v-for="m in members" :key="m.id" class="member-card"
                :class="{ 'member-card--pending': m.status === 'invited', 'member-card--revoked': m.status === 'revoked', 'member-card--self': isSelf(m) }">
                <div class="member-card-avatar">{{ initialsFor(m) }}</div>
                <div class="member-card-info">
                    <div class="member-card-name">
                        {{ displayName(m) }}
                        <span v-if="isSelf(m)" class="member-card-status member-card-status--self">
                            {{ $t('members.you') }}
                        </span>
                        <span v-if="m.status === 'invited'" class="member-card-status member-card-status--pending">
                            {{ $t('members.status.pending') }}
                        </span>
                        <span v-if="m.status === 'revoked'" class="member-card-status member-card-status--revoked">
                            {{ $t('members.status.revoked') }}
                        </span>
                    </div>
                    <div v-if="subtitleFor(m)" class="member-card-subtitle">{{ subtitleFor(m) }}</div>
                    <div class="member-card-meta">
                        <span class="member-card-role">{{ $t(`organizations.role.${m.role}`) }}</span>
                        <span v-if="m.capabilities?.length" class="member-card-caps">
                            · {{ m.capabilities.join(', ') }}
                        </span>
                    </div>
                </div>
                <!-- Admins manage everyone EXCEPT themselves — self-edit/revoke
                     is blocked here (and the never-last-admin rule guards the
                     server side anyway). -->
                <div v-if="isAdmin && m.status !== 'revoked' && !isSelf(m)" class="member-card-actions">
                    <button class="member-action" @click="openEdit(m)">{{ $t('members.actions.edit') }}</button>
                    <button class="member-action member-action--danger" @click="revoke(m)"
                        :disabled="actingOn === m.id">
                        {{ actingOn === m.id ? $t('common.loading') : $t('members.actions.revoke') }}
                    </button>
                </div>
            </li>
        </ul>

        <div v-else class="members-empty">
            <p>{{ $t('members.empty') }}</p>
        </div>

        <div v-if="error" class="members-error">{{ error }}</div>

        <!-- Invite modal -->
        <UiModal v-model="showInvite" :title="$t('members.inviteTitle')" @close="closeInvite">
            <div class="modal-fields">
                <UiField :label="$t('members.fields.email')" v-model="inviteForm.email"
                    type="email" placeholder="user@example.com" />
                <label class="modal-field">
                    <span>{{ $t('members.fields.role') }}</span>
                    <select v-model="inviteForm.role" class="modal-select">
                        <option value="member">{{ $t('organizations.role.member') }}</option>
                        <option value="admin">{{ $t('organizations.role.admin') }}</option>
                    </select>
                </label>
                <fieldset v-if="inviteForm.role === 'member'" class="modal-field modal-fieldset">
                    <legend>{{ $t('members.fields.capabilities') }}</legend>
                    <label v-for="c in allCapabilities" :key="c.value" class="modal-checkbox">
                        <input type="checkbox" :value="c.value" v-model="inviteForm.capabilities" />
                        <span class="modal-checkbox-box"><Check :size="12" :stroke-width="3" /></span>
                        <span class="modal-checkbox-label">{{ c.label }}</span>
                    </label>
                </fieldset>
                <div v-if="modalError" class="modal-error">{{ modalError }}</div>
            </div>
            <template #footer>
                <UiButton variant="ghost" @click="closeInvite">{{ $t('common.cancel') }}</UiButton>
                <UiButton variant="primary" :loading="isSubmitting" :disabled="!inviteForm.email" @click="submitInvite">
                    {{ $t('members.send') }}
                </UiButton>
            </template>
        </UiModal>

        <!-- Edit member modal -->
        <UiModal v-model="editOpen" :title="$t('members.editTitle')" @close="closeEdit">
            <div class="modal-fields">
                <p class="modal-context">{{ editing && displayName(editing) }}</p>
                <label class="modal-field">
                    <span>{{ $t('members.fields.role') }}</span>
                    <select v-model="editForm.role" class="modal-select">
                        <option value="member">{{ $t('organizations.role.member') }}</option>
                        <option value="admin">{{ $t('organizations.role.admin') }}</option>
                    </select>
                </label>
                <fieldset v-if="editForm.role === 'member'" class="modal-field modal-fieldset">
                    <legend>{{ $t('members.fields.capabilities') }}</legend>
                    <label v-for="c in allCapabilities" :key="c.value" class="modal-checkbox">
                        <input type="checkbox" :value="c.value" v-model="editForm.capabilities" />
                        <span class="modal-checkbox-box"><Check :size="12" :stroke-width="3" /></span>
                        <span class="modal-checkbox-label">{{ c.label }}</span>
                    </label>
                </fieldset>
                <div v-if="modalError" class="modal-error">{{ modalError }}</div>
            </div>
            <template #footer>
                <UiButton variant="ghost" @click="closeEdit">{{ $t('common.cancel') }}</UiButton>
                <UiButton variant="primary" :loading="isSubmitting" @click="submitEdit">
                    {{ $t('common.save') }}
                </UiButton>
            </template>
        </UiModal>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, UserPlus, Check } from 'lucide-vue-next'
import { useOrganizationsStore } from '@/stores/organizations'
import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiModal from '@/components/ui/UiModal.vue'

const router = useRouter()
const orgs = useOrganizationsStore()

const members = ref([])
const currentUserId = ref(null)
const isLoading = ref(false)
const error = ref('')
const actingOn = ref(null)

const showInvite = ref(false)
const editing = ref(null)
const isSubmitting = ref(false)
const modalError = ref('')

// UiModal takes a boolean v-model; bridge it to `editing` so Esc / backdrop
// close routes through closeEdit().
const editOpen = computed({
    get: () => !!editing.value,
    set: (v) => { if (!v) closeEdit() },
})

const inviteForm = reactive({ email: '', role: 'member', capabilities: [] })
const editForm = reactive({ role: 'member', capabilities: [] })

const allCapabilities = [
    { value: 'nsbu.base.read', label: 'NSBU read' },
    { value: 'nsbu.base.write', label: 'NSBU write' },
    { value: 'ifrs.overlay.read', label: 'IFRS read' },
    { value: 'ifrs.overlay.write', label: 'IFRS write' },
]

const isAdmin = computed(() => orgs.currentMembership?.role === 'admin')

onMounted(async () => {
    await refresh()
})

async function refresh() {
    isLoading.value = true
    error.value = ''
    try {
        const res = await orgs.listMembers()
        members.value = res.members
        currentUserId.value = res.currentUserId
    } catch (err) {
        error.value = err?.response?.data?.message || err?.message || 'Failed to load members'
    } finally {
        isLoading.value = false
    }
}

/** True when this membership row belongs to the signed-in user. */
function isSelf(m) {
    return !!currentUserId.value && m.userId === currentUserId.value
}

/** Primary display: real name → invited email → raw id as last resort. */
function displayName(m) {
    return m.userName || m.invitedEmail || m.userId || '—'
}

/** Secondary line under the name: email when we have a name to pair it with. */
function subtitleFor(m) {
    if (m.userName && m.userEmail) return m.userEmail
    return ''
}

function initialsFor(m) {
    const src = m.userName || m.invitedEmail || m.userId || '?'
    // For "Firstname Lastname" use both initials; otherwise first 2 chars.
    const parts = src.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return src.slice(0, 2).toUpperCase()
}

function openInvite() {
    inviteForm.email = ''
    inviteForm.role = 'member'
    inviteForm.capabilities = []
    modalError.value = ''
    showInvite.value = true
}
function closeInvite() { showInvite.value = false }
async function submitInvite() {
    isSubmitting.value = true
    modalError.value = ''
    try {
        await orgs.inviteMember({
            email: inviteForm.email.trim(),
            role: inviteForm.role,
            capabilities: inviteForm.role === 'member' ? inviteForm.capabilities : [],
        })
        await refresh()
        closeInvite()
    } catch (err) {
        modalError.value = err?.response?.data?.message || err?.message || 'Invite failed'
    } finally {
        isSubmitting.value = false
    }
}

function openEdit(m) {
    editing.value = m
    editForm.role = m.role
    editForm.capabilities = [...(m.capabilities || [])]
    modalError.value = ''
}
function closeEdit() { editing.value = null }
async function submitEdit() {
    if (!editing.value) return
    isSubmitting.value = true
    modalError.value = ''
    try {
        await orgs.updateMember({
            membershipId: editing.value.id,
            role: editForm.role,
            capabilities: editForm.role === 'member' ? editForm.capabilities : [],
        })
        await refresh()
        closeEdit()
    } catch (err) {
        modalError.value = err?.response?.data?.message || err?.message || 'Update failed'
    } finally {
        isSubmitting.value = false
    }
}

async function revoke(m) {
    if (!confirm(`Revoke "${displayName(m)}"?`)) return
    actingOn.value = m.id
    error.value = ''
    try {
        await orgs.revokeMember({ membershipId: m.id })
        await refresh()
    } catch (err) {
        error.value = err?.response?.data?.message || err?.message || 'Revoke failed'
    } finally {
        actingOn.value = null
    }
}

function back() { router.push('/app/organizations') }
</script>

<style scoped>
.members-view { max-width: 900px; margin: 0 auto; padding: 24px; }
.members-header {
    display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    margin-bottom: 24px;
}
.members-back {
    background: transparent; border: none; color: var(--ws-text-3); cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem;
}
.members-header h1 { font-size: 1.3rem; font-weight: 600; }
.members-header p { font-size: 0.88rem; color: var(--ws-text-3); }
.members-header > div { flex: 1; }

.members-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.member-card {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    background: var(--ws-surface); border: 1px solid var(--ws-border); border-radius: 10px;
}
.member-card--pending { background: rgba(237, 137, 54, 0.04); border-color: rgba(237, 137, 54, 0.3); }
.member-card--revoked { opacity: 0.5; }
.member-card--self { border-color: var(--ws-purple); background: var(--ws-purple-lt); }
.member-card-avatar {
    width: 36px; height: 36px; border-radius: 8px; background: var(--ws-purple); color: white;
    display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 600;
    flex-shrink: 0;
}
.member-card-info { flex: 1; min-width: 0; }
.member-card-name {
    display: flex; align-items: center; gap: 8px; font-weight: 500; color: var(--ws-text);
    word-break: break-word;
}
.member-card-subtitle {
    font-size: 0.8rem; color: var(--ws-text-3); margin-top: 1px; word-break: break-all;
}
.member-card-status {
    padding: 1px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 600;
}
.member-card-status--pending { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.member-card-status--revoked { background: rgba(160, 174, 192, 0.2); color: #4a5568; }
.member-card-status--self { background: var(--ws-purple); color: #fff; }
.member-card-meta {
    font-size: 0.82rem; color: var(--ws-text-3); display: flex; align-items: center; gap: 4px;
    margin-top: 2px;
}
.member-card-role { text-transform: capitalize; }
.member-card-caps { font-family: monospace; font-size: 0.75rem; }
.member-card-actions { display: flex; gap: 6px; }
.member-action {
    padding: 5px 10px; background: transparent; border: 1px solid var(--ws-border); border-radius: 6px;
    color: var(--ws-text); font-size: 0.78rem; cursor: pointer;
}
.member-action:hover:not(:disabled) { background: var(--ws-surface-2); }
.member-action:disabled { opacity: 0.5; cursor: not-allowed; }
.member-action--danger { color: #c53030; border-color: rgba(245, 101, 101, 0.4); }
.member-action--danger:hover:not(:disabled) { background: rgba(245, 101, 101, 0.06); }

.members-empty {
    padding: 60px 24px; text-align: center; color: var(--ws-text-3);
    background: var(--ws-surface-2); border-radius: 12px;
}
.members-error {
    margin-top: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.spinner {
    width: 24px; height: 24px; border: 2.5px solid var(--ws-border); border-top-color: var(--ws-purple);
    border-radius: 50%; margin: 0 auto; animation: spin 0.85s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
/* Modal body bits — scaffolding now from UiModal/UiButton; selects and
   checkboxes stay native (UiField covers text inputs only). */
.modal-fields { display: flex; flex-direction: column; gap: 12px; }
.modal-context {
    font-size: 0.85rem; color: var(--ws-text-3); background: var(--ws-surface-2);
    padding: 8px 12px; border-radius: 6px; word-break: break-all;
}
.modal-field { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; }
.modal-field > span,
.modal-fieldset > legend { color: var(--ws-text-2); font-weight: 500; }
/* Native select — atabai chrome, theme-aware via --ws-* tokens. */
.modal-select {
    width: 100%;
    padding: 9px 11px; border: 1px solid var(--ws-border); border-radius: 8px; font-size: 0.9rem;
    background: var(--ws-surface); color: var(--ws-text);
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
}
.modal-select:hover { border-color: rgba(124, 58, 237, 0.25); }
.modal-select:focus { border-color: var(--ws-purple); box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15); }
/* Native select: strip the OS arrow, draw our own chevron. */
.modal-select {
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    padding-right: 32px; cursor: pointer;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%237C3AED' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
    background-repeat: no-repeat;
    background-position: right 11px center;
}
.modal-select option { background: var(--ws-surface); color: var(--ws-text); }
.modal-fieldset { border: none; padding: 0; margin: 0; }

/* Stylized checkbox — native input hidden, custom box driven by :checked. */
.modal-checkbox {
    display: flex; align-items: center; gap: 9px; font-size: 0.85rem; cursor: pointer;
    padding: 3px 0;
}
.modal-checkbox input[type="checkbox"] {
    position: absolute; opacity: 0; width: 0; height: 0; margin: 0;
}
.modal-checkbox-box {
    flex-shrink: 0;
    width: 18px; height: 18px; border-radius: 5px;
    border: 1.5px solid var(--ws-border);
    background: var(--ws-surface);
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; transition: background 0.12s, border-color 0.12s;
}
.modal-checkbox-box :deep(svg) { opacity: 0; transition: opacity 0.12s; }
.modal-checkbox:hover .modal-checkbox-box { border-color: rgba(124, 58, 237, 0.45); }
.modal-checkbox input[type="checkbox"]:checked + .modal-checkbox-box {
    background: var(--ws-purple); border-color: var(--ws-purple);
}
.modal-checkbox input[type="checkbox"]:checked + .modal-checkbox-box :deep(svg) { opacity: 1; }
.modal-checkbox input[type="checkbox"]:focus-visible + .modal-checkbox-box {
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}
.modal-checkbox-label { color: var(--ws-text-2); }
.modal-error {
    padding: 8px 10px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 6px; font-size: 0.82rem;
}
</style>
