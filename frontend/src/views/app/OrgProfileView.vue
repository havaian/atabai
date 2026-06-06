<!-- frontend/src/views/app/OrgProfileView.vue
     Organization requisites (ledger-side profile): legal name, ИНН, base
     currency, and the list of settlement accounts the bank engine matches
     uploaded statements against (bank ТЗ §2).

     Created once at onboarding and previously unreachable afterward - this
     screen lets an admin view and update it. Non-admins see it read-only.
     transitionDate is shown but locked: it anchors every downstream balance,
     so it is only set during first-time-adoption setup. -->
<template>
    <div class="profile-view">
        <header class="profile-header">
            <button class="profile-back" @click="back">
                <ArrowLeft :size="16" /> {{ $t('common.back') }}
            </button>
            <div class="profile-titles">
                <h1>{{ $t('orgProfile.title') }}</h1>
                <p>{{ $t('orgProfile.subtitle') }}</p>
            </div>
        </header>

        <div v-if="ledger.isLoadingProfile && !ledger.profile" class="profile-empty">
            <div class="spinner" />
        </div>

        <template v-else>
            <p v-if="!ledger.canEditProfile" class="profile-readonly-note">
                {{ $t('orgProfile.readOnlyNote') }}
            </p>

            <!-- Requisites -->
            <section class="profile-card">
                <h2 class="profile-card-title">{{ $t('orgProfile.requisites') }}</h2>

                <div class="profile-field">
                    <label>{{ $t('orgProfile.legalName') }}</label>
                    <input v-model.trim="form.legalName" type="text" :disabled="!editable"
                        :placeholder="$t('orgProfile.legalNamePlaceholder')" />
                </div>

                <div class="profile-field">
                    <label>{{ $t('orgProfile.inn') }}</label>
                    <input v-model.trim="form.inn" type="text" inputmode="numeric" maxlength="9"
                        :disabled="!editable" :placeholder="$t('orgProfile.innPlaceholder')" />
                    <span class="profile-hint">{{ $t('orgProfile.innHint') }}</span>
                </div>

                <div class="profile-field profile-field--narrow">
                    <label>{{ $t('orgProfile.baseCurrency') }}</label>
                    <input v-model.trim="form.baseCurrency" type="text" maxlength="3"
                        :disabled="!editable" placeholder="UZS" @input="upperCurrency" />
                </div>

                <div class="profile-field profile-field--locked">
                    <label>{{ $t('orgProfile.transitionDate') }}</label>
                    <div class="profile-locked-value">
                        {{ ledger.profile?.transitionDate
                            ? formatDate(ledger.profile.transitionDate)
                            : $t('orgProfile.transitionDateUnset') }}
                        <Lock :size="13" />
                    </div>
                    <span class="profile-hint">{{ $t('orgProfile.transitionDateHint') }}</span>
                </div>
            </section>

            <!-- Settlement accounts -->
            <section class="profile-card">
                <div class="profile-card-head">
                    <h2 class="profile-card-title">{{ $t('orgProfile.bankAccounts') }}</h2>
                    <button v-if="editable" class="profile-add" @click="addAccount">
                        <Plus :size="15" /> {{ $t('orgProfile.addAccount') }}
                    </button>
                </div>
                <p class="profile-card-desc">{{ $t('orgProfile.bankAccountsDesc') }}</p>

                <div v-if="form.bankAccounts.length === 0" class="profile-accounts-empty">
                    {{ $t('orgProfile.noAccounts') }}
                </div>

                <div v-for="(acc, i) in form.bankAccounts" :key="i" class="profile-account-row">
                    <div class="profile-account-grid">
                        <div class="profile-field">
                            <label>{{ $t('orgProfile.accountNumber') }}</label>
                            <input v-model.trim="acc.accountNumber" type="text" :disabled="!editable"
                                :placeholder="$t('orgProfile.accountNumberPlaceholder')" />
                        </div>
                        <div class="profile-field">
                            <label>{{ $t('orgProfile.bankCode') }}</label>
                            <input v-model.trim="acc.bankCode" type="text" :disabled="!editable"
                                :placeholder="$t('orgProfile.bankCodePlaceholder')" />
                        </div>
                        <div class="profile-field">
                            <label>{{ $t('orgProfile.accountLabel') }}</label>
                            <input v-model.trim="acc.label" type="text" :disabled="!editable"
                                :placeholder="$t('orgProfile.accountLabelPlaceholder')" />
                        </div>
                        <div class="profile-field profile-field--narrow">
                            <label>{{ $t('orgProfile.currency') }}</label>
                            <input v-model.trim="acc.currency" type="text" maxlength="3"
                                :disabled="!editable" placeholder="UZS"
                                @input="acc.currency = (acc.currency || '').toUpperCase()" />
                        </div>
                    </div>
                    <button v-if="editable" class="profile-remove" :title="$t('common.delete')"
                        @click="removeAccount(i)">
                        <Trash2 :size="15" />
                    </button>
                </div>
            </section>

            <div v-if="ledger.error" class="profile-error">{{ ledger.error }}</div>
            <div v-if="savedOk" class="profile-saved">{{ $t('orgProfile.saved') }}</div>

            <div v-if="editable" class="profile-actions">
                <button class="btn-primary" :disabled="ledger.isSavingProfile || !dirty" @click="save">
                    {{ ledger.isSavingProfile ? $t('common.loading') : $t('common.save') }}
                </button>
                <button class="btn-ghost" :disabled="ledger.isSavingProfile || !dirty" @click="resetForm">
                    {{ $t('common.cancel') }}
                </button>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Lock, Plus, Trash2 } from 'lucide-vue-next'
import { useLedgerStore } from '@/stores/ledger'

const router = useRouter()
const ledger = useLedgerStore()

const savedOk = ref(false)

const form = reactive({
    legalName: '',
    inn: '',
    baseCurrency: 'UZS',
    bankAccounts: [],
})

const editable = computed(() => ledger.canEditProfile)

function hydrate() {
    const p = ledger.profile
    form.legalName = p?.legalName || ''
    form.inn = p?.inn || ''
    form.baseCurrency = p?.baseCurrency || 'UZS'
    form.bankAccounts = (p?.bankAccounts || []).map((a) => ({
        accountNumber: a.accountNumber || '',
        bankCode: a.bankCode || '',
        label: a.label || '',
        currency: a.currency || 'UZS',
    }))
}

// dirty = the form differs from the loaded profile. Drives the Save/Cancel
// enabled state so an untouched form can't fire a no-op PATCH.
const dirty = computed(() => {
    const p = ledger.profile
    if (!p) return true
    if ((p.legalName || '') !== form.legalName) return true
    if ((p.inn || '') !== form.inn) return true
    if ((p.baseCurrency || 'UZS') !== form.baseCurrency) return true
    const orig = p.bankAccounts || []
    if (orig.length !== form.bankAccounts.length) return true
    for (let i = 0; i < orig.length; i++) {
        const a = orig[i]
        const b = form.bankAccounts[i]
        if ((a.accountNumber || '') !== (b.accountNumber || '')) return true
        if ((a.bankCode || '') !== (b.bankCode || '')) return true
        if ((a.label || '') !== (b.label || '')) return true
        if ((a.currency || 'UZS') !== (b.currency || 'UZS')) return true
    }
    return false
})

watch(() => savedOk.value, (v) => { if (v) setTimeout(() => { savedOk.value = false }, 2500) })

function upperCurrency() { form.baseCurrency = (form.baseCurrency || '').toUpperCase() }
function addAccount() {
    form.bankAccounts.push({ accountNumber: '', bankCode: '', label: '', currency: 'UZS' })
}
function removeAccount(i) { form.bankAccounts.splice(i, 1) }
function resetForm() { hydrate() }

async function save() {
    savedOk.value = false
    const patch = {
        legalName: form.legalName || null,
        inn: form.inn || null,
        baseCurrency: form.baseCurrency || 'UZS',
        bankAccounts: form.bankAccounts
            // Drop fully-empty rows so an accidental blank line doesn't fail validation.
            .filter((a) => a.accountNumber)
            .map((a) => ({
                accountNumber: a.accountNumber,
                bankCode: a.bankCode || null,
                label: a.label || null,
                currency: a.currency || 'UZS',
            })),
    }
    try {
        await ledger.updateProfile(patch)
        hydrate()
        savedOk.value = true
    } catch (_) {
        // ledger.error already populated; renders inline.
    }
}

function back() { router.back() }
function formatDate(d) { return d ? new Date(d).toISOString().slice(0, 10) : '' }

onMounted(async () => {
    try {
        await ledger.fetchProfile()
    } catch (_) { /* inline error */ }
    hydrate()
})

// If the profile loads after mount (or org switches), re-hydrate the form.
watch(() => ledger.profile, () => { if (!dirty.value || !ledger.profile) hydrate() })
</script>

<style scoped>
.profile-view { max-width: 760px; margin: 0 auto; padding: 4px 0 40px; }

.profile-header { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.profile-back {
    display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
    background: none; border: none; color: var(--ws-text-2); cursor: pointer;
    font-size: 0.86rem; padding: 4px 0;
}
.profile-back:hover { color: var(--ws-text); }
.profile-titles h1 { font-size: 1.35rem; font-weight: 600; color: var(--ws-text); margin: 0; }
.profile-titles p { font-size: 0.9rem; color: var(--ws-text-3); margin: 4px 0 0; }

.profile-readonly-note {
    margin: 0 0 16px; padding: 10px 14px; font-size: 0.85rem;
    background: var(--pill-gray-bg); color: var(--pill-gray-text); border-radius: 8px;
}

.profile-card {
    background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 12px; padding: 20px; margin-bottom: 16px;
}
.profile-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.profile-card-title { font-size: 1rem; font-weight: 600; color: var(--ws-text); margin: 0 0 14px; }
.profile-card-head .profile-card-title { margin-bottom: 0; }
.profile-card-desc { font-size: 0.84rem; color: var(--ws-text-3); margin: 6px 0 14px; }

.profile-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.profile-field:last-child { margin-bottom: 0; }
.profile-field label { font-size: 0.8rem; font-weight: 500; color: var(--ws-text-2); }
.profile-field input {
    width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 0.9rem;
    color: var(--ws-text); background: var(--ws-bg);
    border: 1px solid var(--ws-border-2); border-radius: 8px; outline: none;
}
.profile-field input:focus { border-color: var(--ws-purple); }
.profile-field input:disabled { background: var(--ws-surface-2); color: var(--ws-text-3); cursor: not-allowed; }
.profile-field--narrow { max-width: 140px; }
.profile-hint { font-size: 0.76rem; color: var(--ws-text-3); }

.profile-field--locked .profile-locked-value {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px;
    font-size: 0.9rem; color: var(--ws-text-2);
    background: var(--ws-surface-2); border: 1px dashed var(--ws-border-2); border-radius: 8px;
}
.profile-field--locked .profile-locked-value svg { color: var(--ws-text-3); }

.profile-add {
    display: inline-flex; align-items: center; gap: 5px; background: var(--ws-purple-lt);
    color: var(--ws-purple); border: none; border-radius: 8px; padding: 7px 12px;
    font-size: 0.84rem; font-weight: 500; cursor: pointer;
}
.profile-add:hover { background: var(--ws-purple); color: #fff; }

.profile-accounts-empty {
    padding: 18px; text-align: center; font-size: 0.85rem; color: var(--ws-text-3);
    background: var(--ws-surface-2); border-radius: 8px;
}
.profile-account-row {
    display: flex; align-items: flex-end; gap: 10px; padding: 14px 0;
    border-top: 1px solid var(--ws-border);
}
.profile-account-grid {
    flex: 1; display: grid; grid-template-columns: 1.4fr 0.8fr 1fr 0.6fr; gap: 10px;
}
.profile-remove {
    flex-shrink: 0; background: none; border: 1px solid var(--ws-border-2); color: #c53030;
    border-radius: 8px; padding: 8px; cursor: pointer; height: 37px;
}
.profile-remove:hover { background: rgba(245, 101, 101, 0.1); }

.profile-error {
    margin-bottom: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.profile-saved {
    margin-bottom: 12px; padding: 10px 14px; background: rgba(72, 187, 120, 0.12);
    color: #2f855a; border-radius: 8px; font-size: 0.86rem;
}

.profile-actions { display: flex; gap: 10px; }
.btn-primary {
    background: var(--ws-purple); color: #fff; padding: 9px 18px; border-radius: 8px;
    border: none; font-weight: 500; cursor: pointer; font-size: 0.9rem;
    transform: none !important; box-shadow: none !important;
}
.btn-primary:hover:not(:disabled) { background: #6D28D9; color: #fff !important; transform: none !important; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost {
    background: none; color: var(--ws-text-2); padding: 9px 16px; border-radius: 8px;
    border: 1px solid var(--ws-border-2); font-weight: 500; cursor: pointer; font-size: 0.9rem;
}
.btn-ghost:hover:not(:disabled) { color: var(--ws-text); border-color: var(--ws-text-3); }
.btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

.profile-empty {
    padding: 60px 24px; text-align: center; background: var(--ws-surface-2); border-radius: 12px;
}
.spinner {
    width: 24px; height: 24px; border: 2.5px solid var(--ws-border); border-top-color: var(--ws-purple);
    border-radius: 50%; margin: 0 auto; animation: spin 0.85s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
    .profile-account-grid { grid-template-columns: 1fr 1fr; }
    .profile-field--narrow { max-width: none; }
}
</style>
