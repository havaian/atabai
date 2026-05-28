<!-- frontend/src/views/admin/AdminLedgerOverview.vue
     Landing page for the NEW (ledger-spine) admin mode.

     Scope note: the concrete new-admin features (cross-org oversight, org
     ownership reassignment, master chart-of-accounts editing, ingestion
     debugging) are deliberately NOT built yet — their exact shape is still
     being decided. This page is an honest placeholder: it names the planned
     capability areas (from the architecture doc) so the New mode isn't an
     empty void, without faking functionality that doesn't exist.

     When a capability area is built, replace its card's "planned" treatment
     with a real route + view. -->
<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.ledger.title') }}</h1>
                <p class="adm-page-subtitle">{{ $t('admin.ledger.subtitle') }}</p>
            </div>
        </div>

        <div class="adm-ledger-grid">
            <div v-for="area in areas" :key="area.key" class="adm-card adm-ledger-card">
                <div class="adm-ledger-card-head">
                    <component :is="area.icon" :size="18" class="adm-ledger-icon" />
                    <span class="adm-badge adm-badge--mappingset-draft">{{ $t('admin.ledger.planned') }}</span>
                </div>
                <h3 class="adm-ledger-card-title">{{ $t(`admin.ledger.areas.${area.key}.title`) }}</h3>
                <p class="adm-ledger-card-desc">{{ $t(`admin.ledger.areas.${area.key}.desc`) }}</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { Building2, RefreshCcw, BookOpen, FileSearch } from 'lucide-vue-next'

// Planned capability areas — names only, no behavior. Mirrors the
// architecture doc's notion of platform-super-admin oversight over the
// org-scoped ledger world. Order = rough build priority.
const areas = [
    { key: 'organizations', icon: Building2 },
    { key: 'ownership', icon: RefreshCcw },
    { key: 'masterChart', icon: BookOpen },
    { key: 'ingestion', icon: FileSearch },
]
</script>

<style scoped>
.adm-ledger-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
}

.adm-ledger-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.adm-ledger-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.adm-ledger-icon {
    color: var(--ws-purple);
}

.adm-ledger-card-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--adm-text);
    margin: 0;
}

.adm-ledger-card-desc {
    font-size: 13px;
    line-height: 1.5;
    color: var(--adm-text-muted);
    margin: 0;
}
</style>
