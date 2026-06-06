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

                <div class="profile-fields">
                    <UiField
                        :label="$t('orgProfile.legalName')"
                        v-model="form.legalName"
                        trim
                        :disabled="!editable"
                        :placeholder="$t('orgProfile.legalNamePlaceholder')"
                    />

                    <UiField
                        :label="$t('orgProfile.inn')"
                        :hint="$t('orgProfile.innHint')"
                        v-model="form.inn"
                        trim
                        inputmode="numeric"
                        maxlength="9"
                        :disabled="!editable"
                        :placeholder="$t('orgProfile.innPlaceholder')"
                    />

                    <div class="profile-narrow">
                        <UiField
                            :label="$t('orgProfile.baseCurrency')"
                            :model-value="form.baseCurrency"
                            @update:model-value="(v) => form.baseCurrency = (v || '').toUpperCase()"
                            maxlength="3"
                            :disabled="!editable"
                            placeholder="UZS"
                        />
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
                </div>
            </section>

            <!-- Settlement accounts -->
            <section class="profile-card">
                <div class="profile-card-head">
                    <h2 class="profile-card-title">{{ $t('orgProfile.bankAccounts') }}</h2>
                    <UiButton v-if="editable" variant="secondary" size="sm" @click="addAccount">
                        <Plus :size="15" /> {{ $t('orgProfile.addAccount') }}
                    </UiButton>
                </div>
                <p class="profile-card-desc">{{ $t('orgProfile.bankAccountsDesc') }}</p>

                <div v-if="form.bankAccounts.length === 0" class="profile-accounts-empty">
                    {{ $t('orgProfile.noAccounts') }}
                </div>

                <div v-for="(acc, i) in form.bankAccounts" :key="i" class="profile-account-row">
                    <div class="profile-account-grid">
                        <UiField
                            :label="$t('orgProfile.accountNumber')"
                            v-model="acc.accountNumber"
                            trim
                            :disabled="!editable"
                            :placeholder="$t('orgProfile.accountNumberPlaceholder')"
                        />
                        <UiField
                            :label="$t('orgProfile.bankCode')"
                            v-model="acc.bankCode"
                            trim
                            :disabled="!editable"
                            :placeholder="$t('orgProfile.bankCodePlaceholder')"
                        />
                        <UiField
                            :label="$t('orgProfile.accountLabel')"
                            v-model="acc.label"
                            trim
                            :disabled="!editable"
                            :placeholder="$t('orgProfile.accountLabelPlaceholder')"
                        />
                        <UiField
                            :label="$t('orgProfile.currency')"
                            :model-value="acc.currency"
                            @update:model-value="(v) => acc.currency = (v || '').toUpperCase()"
                            maxlength="3"
                            :disabled="!editable"
                            placeholder="UZS"
                        />
                    </div>
                    <UiButton v-if="editable" variant="danger" size="sm" class="profile-remove-btn"
                        :title="$t('common.delete')" @click="removeAccount(i)">
                        <Trash2 :size="15" />
                    </UiButton>
                </div>
            </section>

            <div v-if="ledger.error" class="profile-error">{{ ledger.error }}</div>
            <div v-if="savedOk" class="profile-saved">{{ $t('orgProfile.saved') }}</div>

            <div v-if="editable" class="profile-actions">
                <UiButton variant="primary" :loading="ledger.isSavingProfile" :disabled="!dirty" @click="save">
                    {{ $t('common.save') }}
                </UiButton>
                <UiButton variant="ghost" :disabled="ledger.isSavingProfile || !dirty" @click="resetForm">
                    {{ $t('common.cancel') }}
                </UiButton>
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
import UiButton from '@/components/ui/UiButton.vue'
import UiField from '@/components/ui/UiField.vue'

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

/* Spacing for the requisite fields (UiField children spaced by gap). */
.profile-fields { display: flex; flex-direction: column; gap: 14px; }
.profile-narrow { max-width: 140px; }

/* Locked transition-date block (display only — not a UiField). */
.profile-field { display: flex; flex-direction: column; gap: 5px; }
.profile-field label { font-size: 0.8rem; font-weight: 500; color: var(--ws-text-2); }
.profile-hint { font-size: 0.76rem; color: var(--ws-text-3); }

.profile-field--locked .profile-locked-value {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px;
    font-size: 0.9rem; color: var(--ws-text-2);
    background: var(--ws-surface-2); border: 1px dashed var(--ws-border-2); border-radius: 8px;
}
.profile-field--locked .profile-locked-value svg { color: var(--ws-text-3); }

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
/* Keep the remove button aligned with the bottom edge of the grid inputs. */
.profile-remove-btn { flex-shrink: 0; }

.profile-error {
    margin-bottom: 12px; padding: 10px 14px; background: rgba(245, 101, 101, 0.1);
    color: #c53030; border-radius: 8px; font-size: 0.86rem;
}
.profile-saved {
    margin-bottom: 12px; padding: 10px 14px; background: rgba(72, 187, 120, 0.12);
    color: #2f855a; border-radius: 8px; font-size: 0.86rem;
}

.profile-actions { display: flex; gap: 10px; }

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
    .profile-narrow { max-width: none; }
}
</style>
