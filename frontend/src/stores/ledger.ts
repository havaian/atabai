// @ts-nocheck
/* eslint-disable */
/**
 * Ledger store — periods, chart of accounts, balances.
 *
 * Scoped to the active organization in [[organizations]]. Calls into the
 * org-scoped REST surface (/api/organizations/:orgId/ledger/...). When the
 * user switches active org, the store invalidates its caches.
 */
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import { apiClient } from "@/plugins/axios";
import { useOrganizationsStore } from "@/stores/organizations";

export const useLedgerStore = defineStore("ledger", () => {
  const orgs = useOrganizationsStore();

  const periods = ref([]);
  const chart = ref([]);
  const isLoadingPeriods = ref(false);
  const isLoadingChart = ref(false);
  const error = ref(null);

  const periodsByKind = computed(() => {
    const grouped = {
      opening: [],
      comparative: [],
      reporting: [],
      regular: [],
    };
    for (const p of periods.value) {
      (grouped[p.kind] || grouped.regular).push(p);
    }
    return grouped;
  });

  const activePeriod = computed(() => {
    // Prefer the most recent open reporting period; fall back to any reporting; fall back to first.
    const reporting = periods.value.filter(
      (p) => p.kind === "reporting" && p.status === "open"
    );
    if (reporting.length) return reporting[reporting.length - 1];
    const anyReporting = periods.value.filter((p) => p.kind === "reporting");
    if (anyReporting.length) return anyReporting[anyReporting.length - 1];
    return periods.value[0] || null;
  });

  function orgScope(path) {
    if (!orgs.currentOrgId) throw new Error("No active organization");
    return `/organizations/${orgs.currentOrgId}/ledger${path}`;
  }

  async function fetchPeriods() {
    if (!orgs.currentOrgId) return [];
    isLoadingPeriods.value = true;
    try {
      // Backend doesn't yet expose a periods list endpoint (only created via bootstrap).
      // Until that controller lands we synthesise the periods from the bootstrap response
      // — the org store re-fetches /organizations after bootstrap and the response carries
      // periods. For existing orgs we leave the list empty; the UI shows "fetch periods"
      // affordances against this gap.
      // Try the endpoint anyway in case it's been added; tolerate 404.
      const resp = await apiClient.get(orgScope("/periods"));
      periods.value = resp.data.periods || [];
      return periods.value;
    } catch (err) {
      if (err?.response?.status === 404) {
        // Endpoint not yet exposed — leave the cache as-is rather than blanking it.
        return periods.value;
      }
      error.value =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load periods";
      throw err;
    } finally {
      isLoadingPeriods.value = false;
    }
  }

  async function fetchChart() {
    if (!orgs.currentOrgId) return [];
    isLoadingChart.value = true;
    try {
      const resp = await apiClient.get(orgScope("/chart-of-accounts"));
      chart.value = resp.data.accounts || [];
      return chart.value;
    } catch (err) {
      if (err?.response?.status === 404) {
        // Endpoint not yet exposed — keep the cache. Per architecture doc
        // §8.3 a chart view is in the plan; the backend READ endpoint is
        // a follow-up to the seed service.
        return chart.value;
      }
      error.value =
        err?.response?.data?.message || err?.message || "Failed to load chart";
      throw err;
    } finally {
      isLoadingChart.value = false;
    }
  }

  async function fetchBalances({ periodId }) {
    if (!orgs.currentOrgId || !periodId) return [];
    try {
      const resp = await apiClient.get(
        orgScope(`/periods/${periodId}/balances`)
      );
      return resp.data.balances || [];
    } catch (err) {
      if (err?.response?.status === 404) return [];
      throw err;
    }
  }

  async function createPeriod({ label, startDate, endDate }) {
    if (!orgs.currentOrgId) throw new Error("No active organization");
    const resp = await apiClient.post(orgScope("/periods"), {
      label,
      startDate,
      endDate,
    });
    const created = resp.data.period;
    if (created)
      periods.value = [...periods.value, created].sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );
    return created;
  }

  async function lockPeriod(periodId) {
    if (!orgs.currentOrgId) throw new Error("No active organization");
    const resp = await apiClient.post(orgScope(`/periods/${periodId}/lock`));
    const updated = resp.data.period;
    if (updated) replacePeriod(updated);
    return updated;
  }

  async function reopenPeriod(periodId) {
    if (!orgs.currentOrgId) throw new Error("No active organization");
    const resp = await apiClient.post(orgScope(`/periods/${periodId}/reopen`));
    const updated = resp.data.period;
    if (updated) replacePeriod(updated);
    return updated;
  }

  function replacePeriod(updated) {
    const idx = periods.value.findIndex((p) => p.id === updated.id);
    if (idx !== -1) periods.value[idx] = updated;
  }

  // Invalidate caches when active org changes.
  watch(
    () => orgs.currentOrgId,
    () => {
      periods.value = [];
      chart.value = [];
      error.value = null;
    }
  );

  function reset() {
    periods.value = [];
    chart.value = [];
    error.value = null;
  }

  return {
    periods,
    chart,
    periodsByKind,
    activePeriod,
    isLoadingPeriods,
    isLoadingChart,
    error,
    fetchPeriods,
    fetchChart,
    fetchBalances,
    createPeriod,
    lockPeriod,
    reopenPeriod,
    reset,
  };
});
