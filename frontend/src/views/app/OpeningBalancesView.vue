<!--
  Opening-balance entry (methodology §6.2 - «ввод начальных остатков»).

  A company migrating onto ATABAI enters its incoming counterparty balances
  here, PER DOCUMENT (Filipp 02.07.26): one open contract/invoice per row, with
  its position (receivable / payable / advance), amount and date. The backend
  records the batch as one balanced `opening_balance` journal entry (each row a
  counterparty leg on 4010/4310/6010/6310, balanced against the auxiliary
  account 0000) and rolls up the affected balances, so a later bank payment on
  the same document settles the opening debt per document.

  The document is entered by number: an existing document (same counterparty +
  number) is reused, a new number is created. The rare no-breakdown case is
  just a placeholder document number (the dummy-document fallback).

  Period-scoped: the periodId comes from the route. The balance preview here is
  display-only - the server re-validates and hard-gates on balance before
  anything is written.
-->
<template>
  <div class="ob-page">
    <header class="ob-header">
      <div>
        <h1 class="ob-title">{{ $t('openingBalances.title') }}</h1>
        <p class="ob-subtitle">{{ $t('openingBalances.subtitle') }}</p>
      </div>
      <div v-if="period" class="ob-period">
        <span class="ob-period-label">{{ $t('openingBalances.period') }}</span>
        <span class="ob-period-name">{{ period.label || period.kind }}</span>
      </div>
    </header>

    <div v-if="!period" class="ob-notice">
      {{ $t('openingBalances.noPeriod') }}
      <button class="ob-link" type="button" @click="goPeriods">
        {{ $t('openingBalances.goPeriods') }}
      </button>
    </div>

    <template v-else>
      <div v-if="!isLoadingCps && counterparties.length === 0" class="ob-notice">
        {{ $t('openingBalances.noCounterparties') }}
      </div>

      <!-- Entry -->
      <section class="ob-card">
        <div class="ob-card-head">
          <h2 class="ob-card-title">{{ $t('openingBalances.entryTitle') }}</h2>
          <button
            class="ob-btn ob-btn--ghost"
            type="button"
            :disabled="counterparties.length === 0"
            @click="addRow"
          >
            + {{ $t('openingBalances.addRow') }}
          </button>
        </div>

        <div v-if="rows.length" class="ob-table-wrap">
          <table class="ob-table">
            <thead>
              <tr>
                <th>{{ $t('openingBalances.col.counterparty') }}</th>
                <th>{{ $t('openingBalances.col.position') }}</th>
                <th>{{ $t('openingBalances.col.documentType') }}</th>
                <th>{{ $t('openingBalances.col.documentNumber') }}</th>
                <th>{{ $t('openingBalances.col.documentDate') }}</th>
                <th class="ob-num">{{ $t('openingBalances.col.amount') }}</th>
                <th class="ob-col-x"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in rows" :key="row._key">
                <td>
                  <select v-model="row.counterpartyId" @change="onCounterpartyChange(row)">
                    <option value="" disabled>{{ $t('openingBalances.selectCounterparty') }}</option>
                    <option v-for="c in counterparties" :key="c.id" :value="c.id">
                      {{ c.name }}<template v-if="c.inn"> · {{ c.inn }}</template>
                    </option>
                  </select>
                </td>
                <td>
                  <select v-model="row.account">
                    <option v-for="opt in positionOptions" :key="opt.account" :value="opt.account">
                      {{ opt.label }}
                    </option>
                  </select>
                </td>
                <td>
                  <select v-model="row.documentType">
                    <option value="contract">{{ $t('openingBalances.docType.contract') }}</option>
                    <option value="invoice">{{ $t('openingBalances.docType.invoice') }}</option>
                  </select>
                </td>
                <td>
                  <input
                    v-model.trim="row.documentNumber"
                    type="text"
                    :placeholder="$t('openingBalances.documentNumberPh')"
                  />
                </td>
                <td>
                  <input v-model="row.documentDate" type="date" />
                </td>
                <td class="ob-num">
                  <input
                    v-model.trim="row.amount"
                    type="text"
                    inputmode="decimal"
                    placeholder="0.00"
                    :class="{ 'ob-invalid': row.amount && !isValidAmount(row.amount) }"
                  />
                </td>
                <td class="ob-col-x">
                  <button
                    class="ob-row-remove"
                    type="button"
                    :title="$t('openingBalances.remove')"
                    @click="removeRow(i)"
                  >
                    ×
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="ob-empty">{{ $t('openingBalances.noRows') }}</p>

        <!-- Balance preview (display only; server re-validates) -->
        <div v-if="rows.length" class="ob-balance">
          <div class="ob-balance-line">
            <span>{{ $t('openingBalances.totalDebit') }}</span>
            <b>{{ fmt(totals.debit) }}</b>
          </div>
          <div class="ob-balance-line">
            <span>{{ $t('openingBalances.totalCredit') }}</span>
            <b>{{ fmt(totals.credit) }}</b>
          </div>
          <div v-if="totals.offsetLabel" class="ob-balance-line ob-balance-line--offset">
            <span>{{ $t('openingBalances.offset') }}</span>
            <b>{{ totals.offsetLabel }}</b>
          </div>
          <p class="ob-balance-note">{{ $t('openingBalances.offsetNote') }}</p>
        </div>

        <div v-if="rows.length" class="ob-actions">
          <label class="ob-asof">
            {{ $t('openingBalances.asOfDate') }}
            <input v-model="asOfDate" type="date" />
          </label>
          <button
            class="ob-btn ob-btn--primary"
            type="button"
            :disabled="!canSubmit || isSubmitting"
            @click="submit"
          >
            {{ isSubmitting ? $t('openingBalances.submitting') : $t('openingBalances.submit') }}
          </button>
        </div>

        <p
          v-if="message"
          class="ob-msg"
          :class="{ 'ob-msg--err': messageErr, 'ob-msg--ok': !messageErr }"
        >
          {{ message }}
        </p>
      </section>

      <!-- Already entered -->
      <section class="ob-card">
        <div class="ob-card-head">
          <h2 class="ob-card-title">{{ $t('openingBalances.enteredTitle') }}</h2>
          <button
            class="ob-btn ob-btn--ghost"
            type="button"
            :disabled="isLoadingEntered"
            @click="refreshEntered"
          >
            {{ $t('openingBalances.refresh') }}
          </button>
        </div>
        <div v-if="entered.length" class="ob-table-wrap">
          <table class="ob-table">
            <thead>
              <tr>
                <th>{{ $t('openingBalances.col.date') }}</th>
                <th>{{ $t('openingBalances.col.account') }}</th>
                <th>{{ $t('openingBalances.col.side') }}</th>
                <th class="ob-num">{{ $t('openingBalances.col.amount') }}</th>
                <th>{{ $t('openingBalances.col.document') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="e in entered" :key="e.id">
                <tr v-for="(it, j) in e.items" :key="e.id + '-' + j">
                  <td>{{ formatDate(e.date) }}</td>
                  <td>{{ it.accountCode }}</td>
                  <td>
                    {{ it.direction === 'debit'
                      ? $t('openingBalances.debit')
                      : $t('openingBalances.credit') }}
                  </td>
                  <td class="ob-num">{{ fmt(it.amount) }}</td>
                  <td>{{ documentLabel(it) }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p v-else class="ob-empty">{{ $t('openingBalances.noneEntered') }}</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useLedgerStore } from '@/stores/ledger'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const ledger = useLedgerStore()

const periodId = computed(() => route.params.periodId)
const period = computed(
  () => ledger.periods.find((p) => p.id === periodId.value) || null
)

const counterparties = ref([])
const isLoadingCps = ref(false)
const entered = ref([])
const isLoadingEntered = ref(false)
const isSubmitting = ref(false)
const message = ref('')
const messageErr = ref(false)
const asOfDate = ref('')

let keySeq = 0
const rows = reactive([])

// The four settlement positions, mirrored from the backend's
// OPENING_BALANCE_ACCOUNTS. 4010/4310 are debit-natured (assets), 6010/6310
// credit-natured (liabilities) - the same rule the server uses.
const DEBIT_ACCOUNTS = ['4010', '4310']
const positionOptions = computed(() => [
  { account: '4010', label: t('openingBalances.pos.receivable') },
  { account: '6010', label: t('openingBalances.pos.payable') },
  { account: '4310', label: t('openingBalances.pos.advanceIssued') },
  { account: '6310', label: t('openingBalances.pos.advanceReceived') },
])

function addRow() {
  rows.push({
    _key: ++keySeq,
    counterpartyId: '',
    account: '4010',
    documentType: 'contract',
    documentNumber: '',
    documentDate: '',
    amount: '',
    description: '',
  })
}
function removeRow(i) {
  rows.splice(i, 1)
}

// Soft default: if the counterparty's stored settlement depth is known, match
// the document type to it. The user can still change it.
function onCounterpartyChange(row) {
  const c = counterparties.value.find((x) => x.id === row.counterpartyId)
  if (c && c.settlementDepth === 'invoice') row.documentType = 'invoice'
  else if (c && c.settlementDepth === 'contract') row.documentType = 'contract'
}

function isValidAmount(v) {
  const s = String(v || '').trim()
  return /^\d+(?:\.\d+)?$/.test(s) && Number(s) > 0
}

// Display-only balance mirror of the server logic: sum debit-side vs credit-side
// legs, the 0000 offset absorbs the net. The server re-validates and hard-gates.
const totals = computed(() => {
  let debit = 0
  let credit = 0
  for (const r of rows) {
    if (!isValidAmount(r.amount)) continue
    const amt = Number(r.amount)
    if (DEBIT_ACCOUNTS.includes(r.account)) debit += amt
    else credit += amt
  }
  const net = Number((debit - credit).toFixed(2))
  let offsetLabel = ''
  if (net > 0) offsetLabel = `Cr 0000 ${net.toFixed(2)}`
  else if (net < 0) offsetLabel = `Dt 0000 ${Math.abs(net).toFixed(2)}`
  return { debit, credit, net, offsetLabel }
})

const canSubmit = computed(
  () =>
    rows.length > 0 &&
    rows.every(
      (r) =>
        r.counterpartyId &&
        isValidAmount(r.amount) &&
        r.documentNumber &&
        r.documentType &&
        r.account
    )
)

function fmt(n) {
  const num = typeof n === 'number' ? n : Number(n)
  if (Number.isNaN(num)) return String(n)
  const l = locale.value === 'en' ? 'en-US' : locale.value === 'uz' ? 'uz-UZ' : 'ru-RU'
  return num.toLocaleString(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function formatDate(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString()
  } catch (_) {
    return String(d)
  }
}
function documentLabel(it) {
  if (it.documentType === 'invoice') return t('openingBalances.docType.invoice')
  if (it.documentType === 'contract') return t('openingBalances.docType.contract')
  return ''
}

function goPeriods() {
  router.push('/app/ledger/periods')
}

async function loadCounterparties() {
  isLoadingCps.value = true
  try {
    counterparties.value = await ledger.fetchCounterparties()
  } catch (_) {
    counterparties.value = []
  } finally {
    isLoadingCps.value = false
  }
}

async function refreshEntered() {
  if (!periodId.value) return
  isLoadingEntered.value = true
  try {
    entered.value = await ledger.listOpeningBalances({ periodId: periodId.value })
  } catch (_) {
    entered.value = []
  } finally {
    isLoadingEntered.value = false
  }
}

async function submit() {
  if (!canSubmit.value || !periodId.value) return
  isSubmitting.value = true
  message.value = ''
  messageErr.value = false
  try {
    const items = rows.map((r) => ({
      counterpartyId: r.counterpartyId,
      account: r.account,
      amount: String(r.amount).trim(),
      documentType: r.documentType,
      documentNumber: r.documentNumber.trim(),
      documentDate: r.documentDate || undefined,
      description: r.description || undefined,
    }))
    const res = await ledger.createOpeningBalances({
      periodId: periodId.value,
      items,
      asOfDate: asOfDate.value || undefined,
    })
    message.value = t('openingBalances.posted', { n: res.itemsPosted })
    messageErr.value = false
    rows.splice(0, rows.length)
    await refreshEntered()
  } catch (err) {
    message.value =
      err?.response?.data?.message || err?.message || t('openingBalances.postFailed')
    messageErr.value = true
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  if (!ledger.periods.length) {
    try {
      await ledger.fetchPeriods()
    } catch (_) {
      /* periods list is optional here */
    }
  }
  await Promise.all([loadCounterparties(), refreshEntered()])
  if (rows.length === 0) addRow()
})
</script>

<style scoped>
.ob-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px 20px 64px;
  color: var(--ws-text);
}

.ob-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.ob-title {
  font-size: 22px;
  font-weight: 650;
  margin: 0 0 4px;
}
.ob-subtitle {
  margin: 0;
  color: var(--ws-text-3);
  font-size: 13px;
  max-width: 620px;
  line-height: 1.5;
}
.ob-period {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  white-space: nowrap;
}
.ob-period-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ws-text-3);
}
.ob-period-name {
  font-size: 14px;
  font-weight: 600;
}

.ob-notice {
  background: var(--ws-surface-2);
  border: 1px solid var(--ws-border);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 13px;
  color: var(--ws-text-2);
  margin-bottom: 16px;
}

.ob-card {
  background: var(--ws-surface);
  border: 1px solid var(--ws-border);
  border-radius: 12px;
  padding: 18px;
  margin-bottom: 18px;
}
.ob-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.ob-card-title {
  font-size: 15px;
  font-weight: 620;
  margin: 0;
}

.ob-table-wrap {
  overflow-x: auto;
}
.ob-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ob-table th {
  text-align: left;
  font-weight: 600;
  color: var(--ws-text-3);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 6px 8px;
  border-bottom: 1px solid var(--ws-border);
  white-space: nowrap;
}
.ob-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--ws-border-2);
  vertical-align: middle;
}
.ob-num {
  text-align: right;
}
.ob-col-x {
  width: 36px;
  text-align: center;
}

.ob-table select,
.ob-table input {
  width: 100%;
  min-width: 90px;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid var(--ws-border);
  border-radius: 7px;
  background: var(--ws-bg);
  color: var(--ws-text);
  font-size: 13px;
}
.ob-num input {
  text-align: right;
}
.ob-invalid {
  border-color: #d64545;
}

.ob-row-remove {
  border: none;
  background: transparent;
  color: var(--ws-text-3);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
}
.ob-row-remove:hover {
  color: #d64545;
  background: var(--ws-surface-2);
}

.ob-empty {
  color: var(--ws-text-3);
  font-size: 13px;
  padding: 12px 4px;
  margin: 0;
}

.ob-balance {
  margin-top: 14px;
  padding: 12px 14px;
  background: var(--ws-surface-2);
  border: 1px solid var(--ws-border);
  border-radius: 10px;
  max-width: 360px;
}
.ob-balance-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  font-size: 13px;
  padding: 2px 0;
}
.ob-balance-line b {
  font-variant-numeric: tabular-nums;
}
.ob-balance-line--offset {
  color: var(--ws-purple);
  border-top: 1px dashed var(--ws-border);
  padding-top: 6px;
  margin-top: 4px;
}
.ob-balance-note {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--ws-text-3);
  line-height: 1.5;
}

.ob-actions {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.ob-asof {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--ws-text-2);
}
.ob-asof input {
  padding: 7px 9px;
  border: 1px solid var(--ws-border);
  border-radius: 8px;
  background: var(--ws-bg);
  color: var(--ws-text);
  font-size: 13px;
}

.ob-btn {
  border-radius: 8px;
  font-size: 13px;
  font-weight: 550;
  padding: 8px 14px;
  cursor: pointer;
  border: 1px solid transparent;
}
.ob-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ob-btn--ghost {
  background: transparent;
  border-color: var(--ws-border);
  color: var(--ws-text-2);
}
.ob-btn--ghost:hover:not(:disabled) {
  background: var(--ws-surface-2);
}
.ob-btn--primary {
  background: var(--ws-purple);
  color: #fff;
}
.ob-btn--primary:hover:not(:disabled) {
  background: var(--ws-purple-lt);
}

.ob-link {
  border: none;
  background: transparent;
  color: var(--ws-purple);
  cursor: pointer;
  font-size: 13px;
  padding: 0 0 0 4px;
  text-decoration: underline;
}

.ob-msg {
  margin: 12px 0 0;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
}
.ob-msg--ok {
  background: var(--ws-surface-2);
  color: var(--ws-text-2);
}
.ob-msg--err {
  background: rgba(214, 69, 69, 0.1);
  color: #d64545;
}
</style>
