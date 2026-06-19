<!-- frontend/src/views/app/OnboardingView.vue
     First-time-adoption wizard. Calls POST /api/onboarding/organizations,
     which atomically creates the access-spine Organization + admin Membership
     + OrganizationProfile + seeds the 507-account NSBU chart + creates the
     three first-time-adoption ReportingPeriods.

     Landed on automatically when a just-logged-in user has no orgs AND no
     pending invites (organizations.store.needsOnboarding). Also reachable
     directly via /app/organizations/onboarding so existing members can
     bootstrap additional tenants. -->
<template>
    <div class="onboarding-page">
        <div class="onboarding-card">
            <header class="onboarding-header">
                <h1>{{ $t('onboarding.title') }}</h1>
                <p>{{ $t('onboarding.subtitle') }}</p>
            </header>

            <form class="onboarding-form" @submit.prevent="submit">
                <!-- Step indicator -->
                <ol class="onboarding-steps">
                    <li :class="{ active: step === 1, done: step > 1 }">
                        <span class="onboarding-step-num">1</span>
                        <span class="onboarding-step-label">{{ $t('onboarding.step1') }}</span>
                    </li>
                    <li :class="{ active: step === 2, done: step > 2 }">
                        <span class="onboarding-step-num">2</span>
                        <span class="onboarding-step-label">{{ $t('onboarding.step2') }}</span>
                    </li>
                    <li :class="{ active: step === 3, done: step > 3 }">
                        <span class="onboarding-step-num">3</span>
                        <span class="onboarding-step-label">{{ $t('onboarding.step3') }}</span>
                    </li>
                    <li :class="{ active: step === 4 }">
                        <span class="onboarding-step-num">4</span>
                        <span class="onboarding-step-label">{{ $t('onboarding.step4') }}</span>
                    </li>
                </ol>

                <!-- Step 1: Identity -->
                <section v-if="step === 1" class="onboarding-section">
                    <label class="onboarding-field">
                        <span class="onboarding-label">{{ $t('onboarding.fields.name') }}</span>
                        <input
                            v-model.trim="form.name"
                            type="text"
                            class="onboarding-input"
                            maxlength="255"
                            :placeholder="$t('onboarding.fields.namePlaceholder')"
                            required
                        />
                        <span class="onboarding-help">{{ $t('onboarding.fields.nameHelp') }}</span>
                    </label>

                    <label class="onboarding-field">
                        <span class="onboarding-label">{{ $t('onboarding.fields.legalName') }}</span>
                        <input
                            v-model.trim="form.legalName"
                            type="text"
                            class="onboarding-input"
                            maxlength="500"
                            :placeholder="$t('onboarding.fields.legalNamePlaceholder')"
                        />
                        <span class="onboarding-help">{{ $t('onboarding.fields.legalNameHelp') }}</span>
                    </label>

                    <label class="onboarding-field">
                        <span class="onboarding-label">{{ $t('onboarding.fields.inn') }}</span>
                        <input
                            v-model.trim="form.inn"
                            type="text"
                            inputmode="numeric"
                            pattern="\d{9,14}"
                            class="onboarding-input"
                            :placeholder="$t('onboarding.fields.innPlaceholder')"
                        />
                        <span class="onboarding-help">{{ $t('onboarding.fields.innHelp') }}</span>
                    </label>
                </section>

                <!-- Step 2: Transition -->
                <section v-if="step === 2" class="onboarding-section">
                    <label class="onboarding-field">
                        <span class="onboarding-label">{{ $t('onboarding.fields.firstReportingYear') }}</span>
                        <input
                            v-model.number="form.firstReportingYear"
                            type="number"
                            min="1900"
                            max="2100"
                            class="onboarding-input"
                            required
                        />
                        <span class="onboarding-help">{{ $t('onboarding.fields.firstReportingYearHelp') }}</span>
                    </label>

                    <label class="onboarding-field">
                        <span class="onboarding-label">{{ $t('onboarding.fields.transitionDate') }}</span>
                        <input
                            v-model="form.transitionDate"
                            type="date"
                            class="onboarding-input"
                            required
                        />
                        <span class="onboarding-help">{{ $t('onboarding.fields.transitionDateHelp') }}</span>
                    </label>

                    <label class="onboarding-field">
                        <span class="onboarding-label">{{ $t('onboarding.fields.baseCurrency') }}</span>
                        <input
                            v-model.trim="form.baseCurrency"
                            type="text"
                            maxlength="3"
                            class="onboarding-input onboarding-input--currency"
                            placeholder="UZS"
                        />
                        <span class="onboarding-help">{{ $t('onboarding.fields.baseCurrencyHelp') }}</span>
                    </label>
                </section>

                <!-- Step 3: Accounting policy (methodology §9, 6 blocks) -->
                <section v-if="step === 3" class="onboarding-section">
                    <p class="onboarding-policy-intro">{{ $t('onboarding.policy.intro') }}</p>

                    <!-- Block 1: Taxes -->
                    <div class="onboarding-policy-block">
                        <span class="onboarding-policy-block-title">{{ $t('onboarding.policy.taxes') }}</span>
                        <label class="onboarding-field">
                            <span class="onboarding-label">{{ $t('onboarding.policy.taxRegime') }}</span>
                            <select v-model="policy.taxRegime" class="onboarding-input">
                                <option value="general">{{ $t('onboarding.policy.taxRegimeGeneral') }}</option>
                                <option value="simplified">{{ $t('onboarding.policy.taxRegimeSimplified') }}</option>
                            </select>
                        </label>
                        <UiCheckbox v-model="policy.vatPayer">
                            {{ $t('onboarding.policy.vatPayer') }}
                        </UiCheckbox>
                        <label v-if="policy.vatPayer" class="onboarding-field">
                            <span class="onboarding-label">{{ $t('onboarding.policy.vatRate') }}</span>
                            <input v-model.number="policy.vatRate" type="number" min="0" max="100"
                                class="onboarding-input onboarding-input--currency" />
                        </label>
                    </div>

                    <!-- Block 2: Inventory valuation -->
                    <div class="onboarding-policy-block">
                        <span class="onboarding-policy-block-title">{{ $t('onboarding.policy.inventory') }}</span>
                        <label class="onboarding-field">
                            <span class="onboarding-label">{{ $t('onboarding.policy.inventoryValuation') }}</span>
                            <select v-model="policy.inventoryValuation" class="onboarding-input">
                                <option value="weighted_average">{{ $t('onboarding.policy.inventoryWeightedAvg') }}</option>
                                <option value="fifo">{{ $t('onboarding.policy.inventoryFifo') }}</option>
                            </select>
                        </label>
                    </div>

                    <!-- Block 4: Operational control -->
                    <div class="onboarding-policy-block">
                        <span class="onboarding-policy-block-title">{{ $t('onboarding.policy.operational') }}</span>
                        <UiCheckbox v-model="policy.allowNegativeStock">
                            {{ $t('onboarding.policy.allowNegativeStock') }}
                        </UiCheckbox>
                    </div>

                    <!-- Block 5: Counterparty settlement depth -->
                    <div class="onboarding-policy-block">
                        <span class="onboarding-policy-block-title">{{ $t('onboarding.policy.settlement') }}</span>
                        <label class="onboarding-field">
                            <span class="onboarding-label">{{ $t('onboarding.policy.settlementDepth') }}</span>
                            <select v-model="policy.settlementDepth" class="onboarding-input">
                                <option value="invoice">{{ $t('onboarding.policy.settlementInvoice') }}</option>
                                <option value="contract">{{ $t('onboarding.policy.settlementContract') }}</option>
                            </select>
                        </label>
                    </div>

                    <!-- Block 6: Payroll -->
                    <div class="onboarding-policy-block">
                        <span class="onboarding-policy-block-title">{{ $t('onboarding.policy.payroll') }}</span>
                        <label class="onboarding-field">
                            <span class="onboarding-label">{{ $t('onboarding.policy.payrollDetail') }}</span>
                            <select v-model="policy.payrollDetail" class="onboarding-input">
                                <option value="company_wide">{{ $t('onboarding.policy.payrollCompanyWide') }}</option>
                                <option value="by_employee_department">{{ $t('onboarding.policy.payrollByEmployee') }}</option>
                            </select>
                        </label>
                        <label class="onboarding-field">
                            <span class="onboarding-label">{{ $t('onboarding.policy.leaveReserve') }}</span>
                            <select v-model="policy.leaveReserve" class="onboarding-input">
                                <option value="accrue_monthly">{{ $t('onboarding.policy.leaveAccrueMonthly') }}</option>
                                <option value="on_actual">{{ $t('onboarding.policy.leaveOnActual') }}</option>
                            </select>
                        </label>
                    </div>
                </section>

                <!-- Step 4: Review -->
                <section v-if="step === 4" class="onboarding-section">
                    <h3 class="onboarding-review-title">{{ $t('onboarding.review.title') }}</h3>
                    <dl class="onboarding-review">
                        <dt>{{ $t('onboarding.fields.name') }}</dt>
                        <dd>{{ form.name || '—' }}</dd>
                        <dt>{{ $t('onboarding.fields.legalName') }}</dt>
                        <dd>{{ form.legalName || form.name || '—' }}</dd>
                        <dt>{{ $t('onboarding.fields.inn') }}</dt>
                        <dd>{{ form.inn || '—' }}</dd>
                        <dt>{{ $t('onboarding.fields.transitionDate') }}</dt>
                        <dd>{{ form.transitionDate || '—' }}</dd>
                        <dt>{{ $t('onboarding.fields.firstReportingYear') }}</dt>
                        <dd>{{ form.firstReportingYear || '—' }}</dd>
                        <dt>{{ $t('onboarding.fields.baseCurrency') }}</dt>
                        <dd>{{ form.baseCurrency || 'UZS' }}</dd>
                        <dt>{{ $t('onboarding.policy.taxRegime') }}</dt>
                        <dd>{{ policy.taxRegime === 'simplified'
                            ? $t('onboarding.policy.taxRegimeSimplified')
                            : $t('onboarding.policy.taxRegimeGeneral') }}{{ policy.vatPayer ? ` · ${$t('onboarding.policy.vatPayerShort')} ${policy.vatRate}%` : '' }}</dd>
                        <dt>{{ $t('onboarding.policy.settlementDepth') }}</dt>
                        <dd>{{ policy.settlementDepth === 'contract'
                            ? $t('onboarding.policy.settlementContract')
                            : $t('onboarding.policy.settlementInvoice') }}</dd>
                    </dl>
                    <p class="onboarding-note">{{ $t('onboarding.review.note') }}</p>
                </section>

                <!-- Errors -->
                <div v-if="errorMessage" class="onboarding-error" role="alert">
                    {{ errorMessage }}
                </div>

                <!-- Navigation -->
                <footer class="onboarding-footer">
                    <button v-if="step > 1" type="button" class="onboarding-btn onboarding-btn--ghost"
                        :disabled="isSubmitting" @click="step--">
                        {{ $t('common.back') }}
                    </button>
                    <span class="onboarding-footer-spacer" />
                    <button v-if="step < 4" type="button" class="onboarding-btn onboarding-btn--primary"
                        :disabled="!canAdvance" @click="step++">
                        {{ $t('common.next') }}
                    </button>
                    <button v-else type="submit" class="onboarding-btn onboarding-btn--primary"
                        :disabled="isSubmitting">
                        {{ isSubmitting ? $t('onboarding.creating') : $t('onboarding.submit') }}
                    </button>
                </footer>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useOrganizationsStore } from '@/stores/organizations'
import UiCheckbox from '@/components/ui/UiCheckbox.vue'

const router = useRouter()
const orgs = useOrganizationsStore()

const step = ref(1)
const isSubmitting = ref(false)
const errorMessage = ref('')

const now = new Date()
const defaultTransition = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
const defaultReportingYear = now.getUTCFullYear() + 1

const form = ref({
    name: '',
    legalName: '',
    inn: '',
    transitionDate: defaultTransition.toISOString().slice(0, 10),
    firstReportingYear: defaultReportingYear,
    baseCurrency: 'UZS',
})

// Accounting policy (methodology §9, 6 blocks). Defaults mirror the backend
// DEFAULT_ACCOUNTING_POLICY so the wizard opens on the same baseline the
// server would apply if this step were skipped.
const policy = ref({
    taxRegime: 'general',
    vatPayer: true,
    vatRate: 12,
    inventoryValuation: 'weighted_average',
    allowNegativeStock: false,
    settlementDepth: 'invoice',
    payrollDetail: 'company_wide',
    leaveReserve: 'accrue_monthly',
})

const canAdvance = computed(() => {
    if (step.value === 1) {
        return form.value.name.trim().length > 0
    }
    if (step.value === 2) {
        return (
            !!form.value.transitionDate &&
            Number.isFinite(form.value.firstReportingYear) &&
            form.value.firstReportingYear >= 1900
        )
    }
    return true
})

async function submit() {
    if (isSubmitting.value) return
    errorMessage.value = ''
    isSubmitting.value = true
    try {
        await orgs.bootstrap({
            name: form.value.name.trim(),
            legalName: form.value.legalName.trim() || undefined,
            inn: form.value.inn.trim() || undefined,
            baseCurrency: (form.value.baseCurrency || 'UZS').toUpperCase(),
            transitionDate: form.value.transitionDate,
            firstReportingYear: form.value.firstReportingYear,
            accountingPolicy: { ...policy.value },
        })
        // Bootstrap sets the new org active. Send the user to the org landing.
        router.push('/app/dashboard')
    } catch (err) {
        errorMessage.value =
            err?.response?.data?.message || err?.message || 'Failed to create organization'
    } finally {
        isSubmitting.value = false
    }
}
</script>

<style scoped>
.onboarding-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
}

.onboarding-card {
    width: 100%;
    max-width: 560px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
    padding: 32px;
}

.onboarding-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--ws-text);
    margin-bottom: 4px;
}

.onboarding-header p {
    font-size: 0.95rem;
    color: var(--ws-text-3);
    margin-bottom: 24px;
}

.onboarding-steps {
    display: flex;
    list-style: none;
    margin: 0 0 24px;
    padding: 0;
    gap: 12px;
}

.onboarding-steps li {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ws-text-3);
    font-size: 0.85rem;
}

.onboarding-steps li.active {
    color: var(--ws-purple);
    font-weight: 600;
}

.onboarding-steps li.done {
    color: var(--ws-text);
}

.onboarding-step-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--ws-surface-2);
    color: var(--ws-text-3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 600;
}

.onboarding-steps li.active .onboarding-step-num {
    background: var(--ws-purple);
    color: white;
}

.onboarding-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.onboarding-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.onboarding-label {
    font-size: 0.85rem;
    color: var(--ws-text);
    font-weight: 500;
}

.onboarding-input {
    padding: 10px 12px;
    border: 1px solid var(--ws-border);
    border-radius: 8px;
    font-size: 0.95rem;
    background: var(--ws-surface);
    color: var(--ws-text);
    transition: border-color 0.15s, box-shadow 0.15s;
}

.onboarding-input::placeholder {
    color: var(--ws-text-3);
}

.onboarding-input:hover:not(:focus) {
    border-color: rgba(124, 58, 237, 0.25);
}

.onboarding-input:focus {
    outline: none;
    border-color: var(--ws-purple);
    box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18);
}

.onboarding-input--currency {
    text-transform: uppercase;
    max-width: 120px;
}

/* Only <select> gets the chevron - plain inputs sharing this class must not.
   Element-qualified so it beats the base .onboarding-input padding. */
select.onboarding-input {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    padding-right: 32px;
    cursor: pointer;
    background-image: var(--ws-select-chevron);
    background-repeat: no-repeat;
    background-position: right 11px center;
}

/* Accounting-policy step (§9) */
.onboarding-policy-intro {
    font-size: 0.85rem;
    color: var(--ws-text-3);
    line-height: 1.5;
    margin: 0 0 4px;
}
.onboarding-policy-block {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--ws-surface-2);
    border: 1px solid var(--ws-border);
    border-radius: 10px;
}
.onboarding-policy-block-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ws-text);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.onboarding-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    color: var(--ws-text);
    cursor: pointer;
}
.onboarding-check input { cursor: pointer; }

.onboarding-help {
    font-size: 0.78rem;
    color: var(--ws-text-3);
}

.onboarding-review-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--ws-text);
    margin-bottom: 8px;
}

.onboarding-review {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 10px 16px;
    padding: 16px;
    background: var(--ws-surface-2);
    border-radius: 8px;
    font-size: 0.9rem;
}

.onboarding-review dt {
    color: var(--ws-text-3);
    font-weight: 500;
}

.onboarding-review dd {
    color: var(--ws-text);
}

.onboarding-note {
    font-size: 0.82rem;
    color: var(--ws-text-3);
    margin-top: 12px;
    line-height: 1.5;
}

.onboarding-error {
    margin-top: 16px;
    padding: 10px 12px;
    background: rgba(245, 101, 101, 0.1);
    color: #c53030;
    border: 1px solid rgba(245, 101, 101, 0.3);
    border-radius: 8px;
    font-size: 0.88rem;
}

.onboarding-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 28px;
}

.onboarding-footer-spacer {
    flex: 1;
}

.onboarding-btn {
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: background 0.15s, transform 0.05s;
}

.onboarding-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.onboarding-btn--primary {
    background: var(--ws-purple);
    color: white;
}

.onboarding-btn--primary:hover:not(:disabled) {
    background: #6D28D9;
}

.onboarding-btn--ghost {
    background: transparent;
    color: var(--ws-text);
    border: 1px solid var(--ws-border);
}

.onboarding-btn--ghost:hover:not(:disabled) {
    background: var(--ws-surface-2);
}
</style>
