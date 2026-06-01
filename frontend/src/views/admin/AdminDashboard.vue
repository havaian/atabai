<template>
    <div class="adm-page">
        <div class="adm-page-header">
            <div>
                <h1 class="adm-page-title">{{ $t('admin.dashboard.title') }}</h1>
                <div class="adm-page-subtitle">{{ $t('admin.dashboard.subtitle') }}</div>
            </div>
        </div>

        <!-- Quick links to the admin surfaces. The stats overview was removed
             along with the transformation pipeline (no file/template metrics
             to aggregate anymore); this landing just routes into the tools. -->
        <div class="adm-grid-2">
            <button class="adm-card adm-link-card" @click="go('AdminUsers')">
                <Users :size="20" class="adm-link-icon" />
                <div class="adm-link-body">
                    <h3 class="adm-card-title">{{ $t('admin.nav.users') }}</h3>
                </div>
            </button>

            <button class="adm-card adm-link-card" @click="go('AdminLocales')">
                <Languages :size="20" class="adm-link-icon" />
                <div class="adm-link-body">
                    <h3 class="adm-card-title">{{ $t('admin.nav.locales') }}</h3>
                </div>
            </button>

            <button class="adm-card adm-link-card" @click="go('AdminAccess')">
                <UserCheck :size="20" class="adm-link-icon" />
                <div class="adm-link-body">
                    <h3 class="adm-card-title">{{ $t('admin.nav.access') }}</h3>
                </div>
            </button>

            <button class="adm-card adm-link-card" @click="go('AdminSecuritySettings')">
                <ShieldCheck :size="20" class="adm-link-icon" />
                <div class="adm-link-body">
                    <h3 class="adm-card-title">{{ $t('admin.nav.security') }}</h3>
                </div>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { useRouter } from 'vue-router'
import { Users, Languages, UserCheck, ShieldCheck } from 'lucide-vue-next'

const router = useRouter()

function go(name) {
    router.push({ name })
}
</script>

<style scoped>
.adm-link-card {
    display: flex;
    align-items: center;
    gap: 14px;
    text-align: left;
    cursor: pointer;
    border: 1px solid var(--adm-border);
    background: var(--adm-card-bg, transparent);
    transition: border-color 0.15s ease, background 0.15s ease;
}

.adm-link-card:hover {
    border-color: var(--adm-border-strong, var(--adm-border));
    background: var(--adm-nav-bg-hover, transparent);
}

.adm-link-icon {
    color: var(--adm-text);
    flex-shrink: 0;
}

.adm-link-body {
    display: flex;
    flex-direction: column;
}
</style>
