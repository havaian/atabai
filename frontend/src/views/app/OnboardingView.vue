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
                    <li :class="{ active: step === 3 }">
                        <span class="onboarding-step-num">3</span>
                        <span class="onboarding-step-label">{{ $t('onboarding.step3') }}</span>
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

                <!-- Step 3: Review -->
                <section v-if="step === 3" class="onboarding-section">
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
                    <button v-if="step < 3" type="button" class="onboarding-btn onboarding-btn--primary"
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
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
    padding: 32px;
}

.onboarding-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
}

.onboarding-header p {
    font-size: 0.95rem;
    color: var(--text-light);
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
    color: var(--text-light);
    font-size: 0.85rem;
}

.onboarding-steps li.active {
    color: var(--primary);
    font-weight: 600;
}

.onboarding-steps li.done {
    color: var(--text);
}

.onboarding-step-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--text-light);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 600;
}

.onboarding-steps li.active .onboarding-step-num {
    background: var(--primary);
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
    color: var(--text);
    font-weight: 500;
}

.onboarding-input {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.95rem;
    background: var(--card-bg, #fff);
    color: var(--text);
    transition: border-color 0.15s, box-shadow 0.15s;
}

.onboarding-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(101, 57, 154, 0.18);
}

.onboarding-input--currency {
    text-transform: uppercase;
    max-width: 120px;
}

.onboarding-help {
    font-size: 0.78rem;
    color: var(--text-light);
}

.onboarding-review-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 8px;
}

.onboarding-review {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 10px 16px;
    padding: 16px;
    background: var(--accent);
    border-radius: 8px;
    font-size: 0.9rem;
}

.onboarding-review dt {
    color: var(--text-light);
    font-weight: 500;
}

.onboarding-review dd {
    color: var(--text);
}

.onboarding-note {
    font-size: 0.82rem;
    color: var(--text-light);
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
    background: var(--primary);
    color: white;
}

.onboarding-btn--primary:hover:not(:disabled) {
    background: var(--primary-dark);
}

.onboarding-btn--ghost {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
}

.onboarding-btn--ghost:hover:not(:disabled) {
    background: var(--accent);
}
</style>
