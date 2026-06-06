<!-- frontend/src/views/app/PeriodsView.vue
     Reporting period management: list + open/locked status + per-period
     entry points (ОСВ upload, bank statement, adjustment) + admin actions
     (create regular period, lock, reopen).

     Lock is admin-only; reopen is super_admin-only — both enforced at the
     backend service layer. The UI hides the actions when the active
     membership lacks the right role. -->
<template>
    <div class="periods-view">
        <header class="periods-header">
            <div>
                <h1>{{ $t('periods.title') }}</h1>
                <p>{{ $t('periods.subtitle') }}</p>
            </div>
            <UiButton v-if="isAdmin" variant="primary" @click="openCreate">
                <Plus :size="16" /> {{ $t('periods.createNew') }}
            </UiButton>
        </header>

        <div v-if="ledger.isLoadingPeriods" class="periods-empty"><div class="spinner" /></div>

        <div v-else-if="ledger.periods.length === 0" class="periods-empty">
            <p>{{ $t('periods.empty') }}</p>
        </div>

        <ul v-else class="periods-list">
            <li v-for="p in ledger.periods" :key="p.id" class="period-card"
                :class="{ 'period-card--locked': p.status === 'locked' }">
                <div class="period-card-info">
                    <div class="period-card-name">
                        <span class="period-card-label">{{ p.label }}</span>
                        <span class="period-card-kind">{{ $t(`periods.kind.${p.kind}`) }}</span>
                        <span v-if="p.status === 'locked'" class="period-card-lock">
                            <Lock :size="12" /> {{ $t('periods.locked') }}
                        </span>
                    </div>
                    <div class="period-card-dates">
                        {{ formatDate(p.startDate) }} — {{ formatDate(p.endDate) }}
                    </div>
                </div>
                <div class="period-card-actions">
                    <button class="period-card-action" @click="goBatches(p.id)">
                        <Layers :size="14" /> {{ $t('periods.actions.bankBatches') }}
                    </button>
                    <button class="period-card-action" :disabled="p.status === 'locked'" @click="goBank(p.id)">
                        <Banknote :size="14" /> {{ $t('periods.actions.bank') }}
                    </button>
                    <button v-if="isAdmin && p.status === 'open'" class="period-card-action period-card-action--lock"
                        @click="lock(p)" :disabled="lockingId === p.id">
                        <Lock :size="14" />
                        {{ lockingId === p.id ? $t('common.loading') : $t('periods.actions.lock') }}
                    </button>
                    <button v-if="isSuperAdmin && p.status === 'locked'"
                        class="period-card-action period-card-action--reopen"
                        @click="reopen(p)" :disabled="lockingId === p.id">
                        <Unlock :size="14" />
                        {{ lockingId === p.id ? $t('common.loading') : $t('periods.actions.reopen') }}
                    </button>
                </div>
            </li>
        </ul>

        <div v-if="ledger.error" class="periods-error">{{ ledger.error }}</div>
        <div v-if="actionError" class="periods-error">{{ actionError }}</div>

        <!-- Create regular period modal -->
        <UiModal v-model="showCreate" :title="$t('periods.createTitle')" @close="closeCreate">
            <div class="modal-fields">
                <UiField :label="$t('periods.fields.label')" v-model="form.label"
                    :placeholder="$t('periods.fields.labelPlaceholder')" />
                <UiField :label="$t('periods.fields.startDate')" v-model="form.startDate" type="date" />
                <UiField :label="$t('periods.fields.endDate')" v-model="form.endDate" type="date" />
                <div v-if="modalError" class="modal-error">{{ modalError }}</div>
            </div>
            <template #footer>
                <UiButton variant="ghost" @click="closeCreate">{{ $t('common.cancel') }}</UiButton>
                <UiButton variant="primary" :loading="isSubmitting" :disabled="!canSubmit" @click="submitCreate">
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
import { Banknote, FileSpreadsheet, Layers, Lock, Plus, SlidersHorizontal, Unlock } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useLedgerStore } from '@/stores/ledger'
import { useOrganizationsStore } from '@/stores/organizations'
import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'
import UiModal from '@/components/ui/UiModal.vue'

const router = useRouter()
const ledger = useLedgerStore()
const orgs = useOrganizationsStore()
const authStore = useAuthStore()

const lockingId = ref(null)
const actionError = ref('')
const showCreate = ref(false)
const isSubmitting = ref(false)
const modalError = ref('')

const form = reactive({
    label: '',
    startDate: '',
    endDate: '',
})

const isAdmin = computed(() => orgs.currentMembership?.role === 'admin' || authStore.user?.role === 'super_admin')
const isSuperAdmin = computed(() => authStore.user?.role === 'super_admin')

const canSubmit = computed(() =>
    form.label.trim().length > 0 && form.startDate && form.endDate
)

onMounted(async () => {
    await ledger.fetchPeriods().catch(() => {})
})

function goBank(periodId) { router.push(`/app/ledger/periods/${periodId}/bank-statements`) }
function goBatches(periodId) { router.push(`/app/ledger/periods/${periodId}/bank-batches`) }
function formatDate(d) { return d ? new Date(d).toISOString().slice(0, 10) : '' }

async function lock(p) {
    if (!confirm(`Lock "${p.label}"? Writes to this period will be blocked.`)) return
    lockingId.value = p.id
    actionError.value = ''
    try {
        await ledger.lockPeriod(p.id)
    } catch (err) {
        actionError.value = err?.response?.data?.message || err?.message || 'Lock failed'
    } finally {
        lockingId.value = null
    }
}

async function reopen(p) {
    if (!confirm(`Reopen "${p.label}"? This is audited.`)) return
    lockingId.value = p.id
    actionError.value = ''
    try {
        await ledger.reopenPeriod(p.id)
    } catch (err) {
        actionError.value = err?.response?.data?.message || err?.message || 'Reopen failed'
    } finally {
        lockingId.value = null
    }
}

function openCreate() {
    form.label = ''
    form.startDate = ''
    form.endDate = ''
    modalError.value = ''
    showCreate.value = true
}
function closeCreate() {
    showCreate.value = false
}
async function submitCreate() {
    if (!canSubmit.value) return
    isSubmitting.value = true
    modalError.value = ''
    try {
        await ledger.createPeriod({
            label: form.label.trim(),
            startDate: form.startDate,
            endDate: form.endDate,
        })
        closeCreate()
    } catch (err) {
        modalError.value = err?.response?.data?.message || err?.message || 'Failed to create'
    } finally {
        isSubmitting.value = false
    }
}
</script>

<style scoped>
.periods-view { max-width: 1000px; margin: 0 auto; padding: 24px; }
.periods-header {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    margin-bottom: 24px;
}
.periods-header h1 { font-size: 1.3rem; font-weight: 600; margin-bottom: 4px; }
.periods-header p { font-size: 0.88rem; color: var(--ws-text-3); }
.periods-empty {
    padding: 60px 24px; text-align: center; color: var(--ws-text-3);
    background: var(--ws-surface-2); border-radius: 12px;
}
.periods-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.period-card {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px 18px; background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 12px; flex-wrap: wrap;
}
.period-card--locked { opacity: 0.7; }
.period-card-info { flex: 1; min-width: 0; }
.period-card-name {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px;
}
.period-card-label { font-weight: 600; color: var(--ws-text); }
.period-card-kind {
    padding: 1px 8px; background: rgba(124, 58, 237, 0.12); color: var(--ws-purple);
    border-radius: 4px; font-size: 0.74rem; text-transform: capitalize;
}
.period-card-lock {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 1px 8px; background: var(--ws-surface-2); color: var(--ws-text-3);
    border-radius: 4px; font-size: 0.74rem;
}
.period-card-dates { font-size: 0.84rem; color: var(--ws-text-3); }
.period-card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.period-card-action {
    display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px;
    background: transparent; border: 1px solid var(--ws-border); border-radius: 6px;
    color: var(--ws-text); font-size: 0.8rem; cursor: pointer;
}
.period-card-action:hover:not(:disabled) { background: var(--ws-surface-2); border-color: rgba(124, 58, 237, 0.6); }
.period-card-action:disabled { opacity: 0.5; cursor: not-allowed; }
.period-card-action--lock { color: #c05621; border-color: rgba(237, 137, 54, 0.4); }
.period-card-action--reopen { color: #2c5282; border-color: rgba(66, 153, 225, 0.4); }
.periods-error {
    margin-top: 16px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.spinner {
    width: 24px; height: 24px; border: 2.5px solid var(--ws-surface-2); border-top-color: var(--ws-purple);
    border-radius: 50%; margin: 0 auto; animation: spin 0.85s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Create-modal body (scaffolding now from UiModal/UiField/UiButton). */
.modal-fields { display: flex; flex-direction: column; gap: 12px; }
.modal-error {
    padding: 8px 10px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 6px; font-size: 0.82rem;
}
</style>
