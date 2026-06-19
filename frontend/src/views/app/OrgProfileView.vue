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

                <div v-for="(acc, i) in form.bankAccounts" :key="i"
                    class="profile-account-row"
                    :class="{ 'profile-account-row--inactive': acc.isActive === false }">
                    <div class="profile-account-grid">
                        <UiField
                            :label="$t('orgProfile.accountNumber')"
                            :model-value="acc.accountNumber"
                            @update:model-value="(v) => onAccountNumberInput(acc, v)"
                            trim
                            :disabled="!editable"
                            :placeholder="$t('orgProfile.accountNumberPlaceholder')"
                        />
                        <UiField
                            :label="$t('orgProfile.subAccount')"
                            v-model="acc.subAccount"
                            trim
                            :disabled="!editable"
                            :placeholder="$t('orgProfile.subAccountPlaceholder')"
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
                        <div class="profile-ledger-field">
                            <label class="profile-ledger-label">{{ $t('orgProfile.ledgerAccount') }}</label>
                            <select
                                v-model="acc.ledgerAccount"
                                class="profile-ledger-select"
                                :disabled="!editable"
                            >
                                <option value="">{{ $t('orgProfile.ledgerAccountNone') }}</option>
                                <option v-for="c in chartAccounts" :key="c.code" :value="c.code">
                                    {{ c.code }} — {{ c.name }}
                                </option>
                            </select>
                        </div>
                    </div>
                    <div class="profile-account-controls">
                        <!-- Close ≠ delete (methodology §3.5): an account in use is
                             deactivated, not removed, so its postings keep their ref.
                             A never-saved blank row can still be dropped outright. -->
                        <UiCheckbox
                            :title="$t('orgProfile.activeHint')"
                            :model-value="acc.isActive !== false"
                            :disabled="!editable"
                            @update:model-value="(v) => acc.isActive = v"
                        >
                            {{ acc.isActive === false ? $t('orgProfile.inactive') : $t('orgProfile.active') }}
                        </UiCheckbox>
                        <UiButton v-if="editable" variant="danger" size="sm" class="profile-remove-btn"
                            :title="$t('common.delete')" @click="removeAccount(i)">
                            <Trash2 :size="15" />
                        </UiButton>
                    </div>
                </div>
            </section>

            <!-- Accounting policy (methodology §9, 6 blocks) -->
            <section class="profile-card">
                <h2 class="profile-card-title">{{ $t('orgProfile.accountingPolicy') }}</h2>
                <p class="profile-card-desc">{{ $t('onboarding.policy.intro') }}</p>

                <div class="profile-policy-grid">
                    <div class="profile-policy-field">
                        <label>{{ $t('onboarding.policy.taxRegime') }}</label>
                        <select v-model="form.policy.taxRegime" class="profile-ledger-select" :disabled="!editable">
                            <option value="general">{{ $t('onboarding.policy.taxRegimeGeneral') }}</option>
                            <option value="simplified">{{ $t('onboarding.policy.taxRegimeSimplified') }}</option>
                        </select>
                    </div>
                    <div class="profile-policy-field">
                        <UiCheckbox v-model="form.policy.vatPayer" :disabled="!editable">
                            {{ $t('onboarding.policy.vatPayer') }}
                        </UiCheckbox>
                        <div class="profile-policy-rate">
                            <label>{{ $t('onboarding.policy.vatRate') }}</label>
                            <input v-model.number="form.policy.vatRate" type="number" min="0" max="100"
                                class="profile-policy-input" :disabled="!editable && !form.policy.vatPayer" />
                        </div>
                    </div>
                    <div class="profile-policy-field">
                        <label>{{ $t('onboarding.policy.inventoryValuation') }}</label>
                        <select v-model="form.policy.inventoryValuation" class="profile-ledger-select" :disabled="!editable">
                            <option value="weighted_average">{{ $t('onboarding.policy.inventoryWeightedAvg') }}</option>
                            <option value="fifo">{{ $t('onboarding.policy.inventoryFifo') }}</option>
                        </select>
                    </div>
                    <div class="profile-policy-field">
                        <label>{{ $t('onboarding.policy.settlementDepth') }}</label>
                        <select v-model="form.policy.settlementDepth" class="profile-ledger-select" :disabled="!editable">
                            <option value="invoice">{{ $t('onboarding.policy.settlementInvoice') }}</option>
                            <option value="contract">{{ $t('onboarding.policy.settlementContract') }}</option>
                        </select>
                    </div>
                    <div class="profile-policy-field">
                        <label>{{ $t('onboarding.policy.payrollDetail') }}</label>
                        <select v-model="form.policy.payrollDetail" class="profile-ledger-select" :disabled="!editable">
                            <option value="company_wide">{{ $t('onboarding.policy.payrollCompanyWide') }}</option>
                            <option value="by_employee_department">{{ $t('onboarding.policy.payrollByEmployee') }}</option>
                        </select>
                    </div>
                    <div class="profile-policy-field">
                        <label>{{ $t('onboarding.policy.leaveReserve') }}</label>
                        <select v-model="form.policy.leaveReserve" class="profile-ledger-select" :disabled="!editable">
                            <option value="accrue_monthly">{{ $t('onboarding.policy.leaveAccrueMonthly') }}</option>
                            <option value="on_actual">{{ $t('onboarding.policy.leaveOnActual') }}</option>
                        </select>
                    </div>
                    <div class="profile-policy-field">
                        <UiCheckbox v-model="form.policy.allowNegativeStock" :disabled="!editable">
                            {{ $t('onboarding.policy.allowNegativeStock') }}
                        </UiCheckbox>
                    </div>
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
import UiCheckbox from '@/components/ui/UiCheckbox.vue'

const router = useRouter()
const ledger = useLedgerStore()

const savedOk = ref(false)

const form = reactive({
    legalName: '',
    inn: '',
    baseCurrency: 'UZS',
    bankAccounts: [],
    policy: {
        taxRegime: 'general',
        vatPayer: true,
        vatRate: 12,
        inventoryValuation: 'weighted_average',
        allowNegativeStock: false,
        settlementDepth: 'invoice',
        payrollDetail: 'company_wide',
        leaveReserve: 'accrue_monthly',
    },
})

const editable = computed(() => ledger.canEditProfile)

// Chart accounts for the per-settlement-account "ledger account" dropdown.
// Sorted by code so the list is scannable.
const chartAccounts = computed(() =>
    [...(ledger.chart || [])].sort((a, b) =>
        String(a.code || '').localeCompare(String(b.code || ''))
    )
)

// §3.4 account-number mask: currency sits at digits 6-8 (000 = сумы). Only the
// confirmed codes are mapped; anything else leaves currency for manual entry.
// Mirror of backend bank/account-number-mask.ts — kept in sync by hand since
// the frontend can't import server modules.
const CURRENCY_BY_MASK_CODE = { '000': 'UZS', '840': 'USD', '978': 'EUR', '643': 'RUB' }
function deriveCurrencyFromAccountNumber(raw) {
    const n = String(raw || '').replace(/\s+/g, '')
    if (!/^\d{20}$/.test(n)) return null
    return CURRENCY_BY_MASK_CODE[n.slice(5, 8)] || null
}

// On account-number entry, auto-fill currency from the mask when we can derive
// it AND the user hasn't already typed something else. Never overwrites a
// value the user set by hand — only fills a blank/default.
function onAccountNumberInput(acc, v) {
    acc.accountNumber = (v || '').trim()
    const derived = deriveCurrencyFromAccountNumber(acc.accountNumber)
    if (derived && (!acc.currency || acc.currency === 'UZS')) {
        acc.currency = derived
    }
}

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
        ledgerAccount: a.ledgerAccount || '',
        subAccount: a.subAccount || '',
        isActive: a.isActive !== false,
    }))
    const pol = p?.accountingPolicy || {}
    form.policy = {
        taxRegime: pol.taxRegime || 'general',
        vatPayer: pol.vatPayer !== false,
        vatRate: typeof pol.vatRate === 'number' ? pol.vatRate : 12,
        inventoryValuation: pol.inventoryValuation || 'weighted_average',
        allowNegativeStock: pol.allowNegativeStock === true,
        settlementDepth: pol.settlementDepth || 'invoice',
        payrollDetail: pol.payrollDetail || 'company_wide',
        leaveReserve: pol.leaveReserve || 'accrue_monthly',
    }
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
        if ((a.ledgerAccount || '') !== (b.ledgerAccount || '')) return true
        if ((a.subAccount || '') !== (b.subAccount || '')) return true
        if ((a.isActive !== false) !== (b.isActive !== false)) return true
    }
    // Policy: compare each block field against the stored policy.
    const pol = p.accountingPolicy || {}
    const fp = form.policy
    if ((pol.taxRegime || 'general') !== fp.taxRegime) return true
    if ((pol.vatPayer !== false) !== fp.vatPayer) return true
    if ((typeof pol.vatRate === 'number' ? pol.vatRate : 12) !== fp.vatRate) return true
    if ((pol.inventoryValuation || 'weighted_average') !== fp.inventoryValuation) return true
    if ((pol.allowNegativeStock === true) !== fp.allowNegativeStock) return true
    if ((pol.settlementDepth || 'invoice') !== fp.settlementDepth) return true
    if ((pol.payrollDetail || 'company_wide') !== fp.payrollDetail) return true
    if ((pol.leaveReserve || 'accrue_monthly') !== fp.leaveReserve) return true
    return false
})

watch(() => savedOk.value, (v) => { if (v) setTimeout(() => { savedOk.value = false }, 2500) })

function addAccount() {
    form.bankAccounts.push({ accountNumber: '', bankCode: '', label: '', currency: 'UZS', ledgerAccount: '', subAccount: '', isActive: true })
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
                ledgerAccount: a.ledgerAccount || null,
                subAccount: a.subAccount || null,
                isActive: a.isActive !== false,
            })),
        accountingPolicy: { ...form.policy },
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
    // Chart powers the per-account "ledger account" dropdown (bank ТЗ §1
    // internal-transfer mapping). Non-fatal if it fails — the field just
    // falls back to a free-text-less empty list.
    await ledger.fetchChart().catch(() => {})
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
/* Closed accounts are dimmed but kept visible — never removed (§3.5). */
.profile-account-row--inactive { opacity: 0.55; }
.profile-account-grid {
    flex: 1; display: grid; grid-template-columns: 1.4fr 0.7fr 0.8fr 1fr 0.6fr 1.2fr; gap: 10px;
}
/* Right-hand controls: active toggle stacked over the remove button, kept
   aligned with the bottom edge of the grid inputs. */
.profile-account-controls {
    flex-shrink: 0; display: flex; flex-direction: column; gap: 8px;
}
.profile-active-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.78rem; color: var(--ws-text-2); cursor: pointer; white-space: nowrap;
}
.profile-active-toggle input { cursor: pointer; }
/* Keep the remove button aligned with the bottom edge of the grid inputs. */
.profile-remove-btn { flex-shrink: 0; }

/* Ledger-account dropdown, styled to sit level with the UiField inputs in
   the same row (UiField renders label + input; we mirror that here). */
.profile-ledger-field { display: flex; flex-direction: column; gap: 6px; justify-content: end; }
.profile-ledger-label {
    font-size: 0.8rem; font-weight: 500; color: var(--ws-text-2);
}
.profile-ledger-select {
    width: 100%; box-sizing: border-box; padding: 9px 10px;
    background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 8px; color: var(--ws-text); font-size: 0.9rem; font-family: inherit;
    cursor: pointer; height: 38px;
}
/* Match the custom chevron used by the other selects instead of the OS arrow. */
.profile-ledger-select {
    appearance: none; -webkit-appearance: none; -moz-appearance: none;
    padding-right: 32px;
    background-image: var(--ws-select-chevron);
    background-repeat: no-repeat;
    background-position: right 11px center;
}
.profile-ledger-select:focus { outline: none; border-color: var(--ws-purple); }
.profile-ledger-select:disabled { opacity: 0.6; cursor: not-allowed; }

/* Accounting-policy grid (§9) */
.profile-policy-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.profile-policy-field { display: flex; flex-direction: column; gap: 6px; justify-content: flex-end; }
.profile-policy-field > label {
    font-size: 0.8rem; font-weight: 500; color: var(--ws-text-2);
}
.profile-policy-check {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.88rem; color: var(--ws-text); cursor: pointer;
}
.profile-policy-check input { cursor: pointer; }
.profile-policy-rate { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.profile-policy-rate label { font-size: 0.8rem; font-weight: 500; color: var(--ws-text-2); }
.profile-policy-input {
    width: 100%; box-sizing: border-box; padding: 9px 10px;
    background: var(--ws-surface); border: 1px solid var(--ws-border);
    border-radius: 8px; color: var(--ws-text); font-size: 0.9rem; font-family: inherit; height: 38px;
}
.profile-policy-input:focus { outline: none; border-color: var(--ws-purple); }
.profile-policy-input:disabled { opacity: 0.6; cursor: not-allowed; }

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
    .profile-ledger-field { grid-column: 1 / -1; }
    .profile-narrow { max-width: none; }
}
</style>
