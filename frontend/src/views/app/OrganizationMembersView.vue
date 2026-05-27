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
            <button v-if="isAdmin" class="btn-primary" @click="openInvite">
                <UserPlus :size="16" /> {{ $t('members.invite') }}
            </button>
        </header>

        <div v-if="isLoading && members.length === 0" class="members-empty">
            <div class="spinner" />
        </div>

        <ul v-else-if="members.length > 0" class="members-list">
            <li v-for="m in members" :key="m.id" class="member-card"
                :class="{ 'member-card--pending': m.status === 'invited', 'member-card--revoked': m.status === 'revoked' }">
                <div class="member-card-avatar">{{ initialsFor(m) }}</div>
                <div class="member-card-info">
                    <div class="member-card-name">
                        {{ m.invitedEmail || m.userId || '—' }}
                        <span v-if="m.status === 'invited'" class="member-card-status member-card-status--pending">
                            {{ $t('members.status.pending') }}
                        </span>
                        <span v-if="m.status === 'revoked'" class="member-card-status member-card-status--revoked">
                            {{ $t('members.status.revoked') }}
                        </span>
                    </div>
                    <div class="member-card-meta">
                        <span class="member-card-role">{{ $t(`organizations.role.${m.role}`) }}</span>
                        <span v-if="m.capabilities?.length" class="member-card-caps">
                            · {{ m.capabilities.join(', ') }}
                        </span>
                    </div>
                </div>
                <div v-if="isAdmin && m.status !== 'revoked'" class="member-card-actions">
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
        <Transition name="modal-fade">
            <div v-if="showInvite" class="modal-backdrop" @click.self="closeInvite">
                <div class="modal-card">
                    <header class="modal-header">
                        <h2>{{ $t('members.inviteTitle') }}</h2>
                        <button class="modal-close" @click="closeInvite"><X :size="18" /></button>
                    </header>
                    <div class="modal-body">
                        <label class="modal-field">
                            <span>{{ $t('members.fields.email') }}</span>
                            <input v-model="inviteForm.email" type="email" placeholder="user@example.com" />
                        </label>
                        <label class="modal-field">
                            <span>{{ $t('members.fields.role') }}</span>
                            <select v-model="inviteForm.role">
                                <option value="member">{{ $t('organizations.role.member') }}</option>
                                <option value="admin">{{ $t('organizations.role.admin') }}</option>
                            </select>
                        </label>
                        <fieldset v-if="inviteForm.role === 'member'" class="modal-field">
                            <legend>{{ $t('members.fields.capabilities') }}</legend>
                            <label v-for="c in allCapabilities" :key="c.value" class="modal-checkbox">
                                <input type="checkbox" :value="c.value" v-model="inviteForm.capabilities" />
                                <span>{{ c.label }}</span>
                            </label>
                        </fieldset>
                        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
                    </div>
                    <footer class="modal-footer">
                        <button class="btn-ghost" @click="closeInvite">{{ $t('common.cancel') }}</button>
                        <button class="btn-primary" @click="submitInvite" :disabled="!inviteForm.email || isSubmitting">
                            {{ isSubmitting ? $t('common.loading') : $t('members.send') }}
                        </button>
                    </footer>
                </div>
            </div>
        </Transition>

        <!-- Edit member modal -->
        <Transition name="modal-fade">
            <div v-if="editing" class="modal-backdrop" @click.self="closeEdit">
                <div class="modal-card">
                    <header class="modal-header">
                        <h2>{{ $t('members.editTitle') }}</h2>
                        <button class="modal-close" @click="closeEdit"><X :size="18" /></button>
                    </header>
                    <div class="modal-body">
                        <p class="modal-context">{{ editing.invitedEmail || editing.userId || '—' }}</p>
                        <label class="modal-field">
                            <span>{{ $t('members.fields.role') }}</span>
                            <select v-model="editForm.role">
                                <option value="member">{{ $t('organizations.role.member') }}</option>
                                <option value="admin">{{ $t('organizations.role.admin') }}</option>
                            </select>
                        </label>
                        <fieldset v-if="editForm.role === 'member'" class="modal-field">
                            <legend>{{ $t('members.fields.capabilities') }}</legend>
                            <label v-for="c in allCapabilities" :key="c.value" class="modal-checkbox">
                                <input type="checkbox" :value="c.value" v-model="editForm.capabilities" />
                                <span>{{ c.label }}</span>
                            </label>
                        </fieldset>
                        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
                    </div>
                    <footer class="modal-footer">
                        <button class="btn-ghost" @click="closeEdit">{{ $t('common.cancel') }}</button>
                        <button class="btn-primary" @click="submitEdit" :disabled="isSubmitting">
                            {{ isSubmitting ? $t('common.loading') : $t('common.save') }}
                        </button>
                    </footer>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, UserPlus, X } from 'lucide-vue-next'
import { useOrganizationsStore } from '@/stores/organizations'

const router = useRouter()
const orgs = useOrganizationsStore()

const members = ref([])
const isLoading = ref(false)
const error = ref('')
const actingOn = ref(null)

const showInvite = ref(false)
const editing = ref(null)
const isSubmitting = ref(false)
const modalError = ref('')

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
        members.value = await orgs.listMembers()
    } catch (err) {
        error.value = err?.response?.data?.message || err?.message || 'Failed to load members'
    } finally {
        isLoading.value = false
    }
}

function initialsFor(m) {
    const src = m.invitedEmail || m.userId || '?'
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
    if (!confirm(`Revoke "${m.invitedEmail || m.userId}"?`)) return
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
    display: flex; align-items: flex-start; gap: 20px; flex-wrap: wrap;
    margin-bottom: 24px;
}
.members-back {
    background: transparent; border: none; color: var(--text-light); cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem;
}
.members-header h1 { font-size: 1.3rem; font-weight: 600; }
.members-header p { font-size: 0.88rem; color: var(--text-light); }
.members-header > div { flex: 1; }

.members-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.member-card {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    background: var(--card-bg, #fff); border: 1px solid var(--border); border-radius: 10px;
}
.member-card--pending { background: rgba(237, 137, 54, 0.04); border-color: rgba(237, 137, 54, 0.3); }
.member-card--revoked { opacity: 0.5; }
.member-card-avatar {
    width: 36px; height: 36px; border-radius: 8px; background: var(--primary); color: white;
    display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 600;
    flex-shrink: 0;
}
.member-card-info { flex: 1; min-width: 0; }
.member-card-name {
    display: flex; align-items: center; gap: 8px; font-weight: 500; color: var(--text);
    word-break: break-all;
}
.member-card-status {
    padding: 1px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 600;
}
.member-card-status--pending { background: rgba(237, 137, 54, 0.15); color: #c05621; }
.member-card-status--revoked { background: rgba(160, 174, 192, 0.2); color: #4a5568; }
.member-card-meta {
    font-size: 0.82rem; color: var(--text-light); display: flex; align-items: center; gap: 4px;
    margin-top: 2px;
}
.member-card-role { text-transform: capitalize; }
.member-card-caps { font-family: monospace; font-size: 0.75rem; }
.member-card-actions { display: flex; gap: 6px; }
.member-action {
    padding: 5px 10px; background: transparent; border: 1px solid var(--border); border-radius: 6px;
    color: var(--text); font-size: 0.78rem; cursor: pointer;
}
.member-action:hover:not(:disabled) { background: var(--accent); }
.member-action:disabled { opacity: 0.5; cursor: not-allowed; }
.member-action--danger { color: #c53030; border-color: rgba(245, 101, 101, 0.4); }
.member-action--danger:hover:not(:disabled) { background: rgba(245, 101, 101, 0.06); }

.members-empty {
    padding: 60px 24px; text-align: center; color: var(--text-light);
    background: var(--accent); border-radius: 12px;
}
.members-error {
    margin-top: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.spinner {
    width: 24px; height: 24px; border: 2.5px solid var(--border); border-top-color: var(--primary);
    border-radius: 50%; margin: 0 auto; animation: spin 0.85s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.btn-primary {
    background: var(--primary); color: white; padding: 9px 16px; border-radius: 8px;
    border: none; font-weight: 500; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem;
}
.btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost {
    background: transparent; color: var(--text); border: 1px solid var(--border);
    padding: 9px 16px; border-radius: 8px; cursor: pointer;
}
.btn-ghost:hover { background: var(--accent); }

/* Modal — same template as PeriodsView */
.modal-backdrop {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
    display: flex; align-items: center; justify-content: center; z-index: 90;
}
.modal-card {
    background: var(--card-bg, #fff); border-radius: 14px;
    width: 100%; max-width: 460px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}
.modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid var(--border);
}
.modal-header h2 { font-size: 1.05rem; font-weight: 600; }
.modal-close { background: transparent; border: none; cursor: pointer; color: var(--text-light); }
.modal-body { padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.modal-context {
    font-size: 0.85rem; color: var(--text-light); background: var(--accent);
    padding: 8px 12px; border-radius: 6px; word-break: break-all;
}
.modal-field { display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; }
.modal-field input,
.modal-field select {
    padding: 9px 11px; border: 1px solid var(--border); border-radius: 6px; font-size: 0.9rem;
    background: var(--card-bg, #fff);
}
.modal-field input:focus,
.modal-field select:focus { outline: none; border-color: var(--primary); }
.modal-checkbox {
    display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;
}
.modal-error {
    padding: 8px 10px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 6px; font-size: 0.82rem;
}
.modal-footer {
    display: flex; gap: 8px; justify-content: flex-end;
    padding: 12px 18px; border-top: 1px solid var(--border);
}
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.15s; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
