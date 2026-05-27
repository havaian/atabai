<!-- frontend/src/views/app/OrganizationsListView.vue
     Registry of orgs the user is an active member of, plus any pending
     invites they can accept. Entry point for the "switch organization"
     flow and for "create another organization".

     Most users will have one org and never visit this page — they'll hit
     the dashboard for their single active org instead. This page exists
     for the IFRS-specialist B2B2B use case (one specialist serving many
     client companies) where org switching is the daily workflow. -->
<template>
    <div class="orgs-page">
        <header class="orgs-header">
            <div>
                <h1>{{ $t('organizations.title') }}</h1>
                <p>{{ $t('organizations.subtitle') }}</p>
            </div>
            <button class="orgs-create-btn" @click="goToOnboarding">
                <Plus :size="16" />
                {{ $t('organizations.createNew') }}
            </button>
        </header>

        <!-- Pending invites — surface above the org list since they're action items. -->
        <section v-if="orgs.hasInvites" class="orgs-section">
            <h2 class="orgs-section-title">{{ $t('organizations.invites.title') }}</h2>
            <ul class="orgs-invite-list">
                <li v-for="invite in orgs.pendingInvites" :key="invite.membership.id" class="orgs-invite-card">
                    <div class="orgs-invite-info">
                        <span class="orgs-invite-name">{{ invite.organization.name }}</span>
                        <span class="orgs-invite-meta">
                            {{ $t('organizations.invites.invitedAs', { role: invite.membership.role }) }}
                        </span>
                    </div>
                    <div class="orgs-invite-actions">
                        <button class="orgs-btn orgs-btn--primary" :disabled="isAccepting === invite.membership.id"
                            @click="accept(invite.membership.id)">
                            {{ isAccepting === invite.membership.id
                                ? $t('common.loading')
                                : $t('organizations.invites.accept') }}
                        </button>
                    </div>
                </li>
            </ul>
        </section>

        <!-- Active memberships -->
        <section class="orgs-section">
            <h2 class="orgs-section-title">{{ $t('organizations.list.title') }}</h2>

            <div v-if="orgs.isLoading && orgs.items.length === 0" class="orgs-empty">
                <div class="orgs-loading-spinner" />
            </div>

            <div v-else-if="orgs.items.length === 0 && !orgs.hasInvites" class="orgs-empty">
                <p>{{ $t('organizations.list.empty') }}</p>
                <button class="orgs-btn orgs-btn--primary" @click="goToOnboarding">
                    {{ $t('organizations.createNew') }}
                </button>
            </div>

            <ul v-else class="orgs-list">
                <li v-for="org in orgs.items" :key="org.id"
                    class="orgs-card"
                    :class="{ 'orgs-card--active': org.id === orgs.currentOrgId }"
                    @click="select(org.id)">
                    <div class="orgs-card-main">
                        <div class="orgs-card-name">{{ org.name }}</div>
                        <div class="orgs-card-meta">
                            <span class="orgs-card-role">{{ $t(`organizations.role.${org.membership.role}`) }}</span>
                            <span v-if="org.id === orgs.currentOrgId" class="orgs-card-active-badge">
                                {{ $t('organizations.list.activeBadge') }}
                            </span>
                        </div>
                    </div>
                    <button v-if="org.id === orgs.currentOrgId" class="orgs-card-members" @click.stop="manageMembers">
                        {{ $t('members.title') }}
                    </button>
                    <ChevronRight :size="16" class="orgs-card-chevron" />
                </li>
            </ul>
        </section>

        <div v-if="orgs.error" class="orgs-error" role="alert">{{ orgs.error }}</div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronRight, Plus } from 'lucide-vue-next'
import { useOrganizationsStore } from '@/stores/organizations'

const router = useRouter()
const orgs = useOrganizationsStore()

const isAccepting = ref(null)

onMounted(async () => {
    await orgs.ensureInitialized()
})

function goToOnboarding() {
    router.push('/app/organizations/onboarding')
}

function manageMembers() {
    router.push('/app/organizations/members')
}

function select(orgId) {
    orgs.setCurrentOrg(orgId)
    router.push('/app/dashboard')
}

async function accept(membershipId) {
    isAccepting.value = membershipId
    try {
        await orgs.acceptInvite(membershipId)
    } finally {
        isAccepting.value = null
    }
}
</script>

<style scoped>
.orgs-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 32px 24px;
}

.orgs-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 32px;
}

.orgs-header h1 {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--ws-text);
    margin-bottom: 4px;
}

.orgs-header p {
    font-size: 0.92rem;
    color: var(--ws-text-3);
}

.orgs-create-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--ws-purple);
    color: white;
    padding: 9px 14px;
    border-radius: 8px;
    border: none;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s;
}

.orgs-create-btn:hover {
    background: #6D28D9;
}

.orgs-section {
    margin-bottom: 28px;
}

.orgs-section-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ws-text-3);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 12px;
}

.orgs-invite-list,
.orgs-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.orgs-invite-card,
.orgs-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 10px;
    transition: border-color 0.15s, box-shadow 0.15s;
}

.orgs-card {
    cursor: pointer;
}

.orgs-card:hover {
    border-color: rgba(124, 58, 237, 0.6);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.orgs-card--active {
    border-color: var(--ws-purple);
    background: rgba(124, 58, 237, 0.04);
}

.orgs-card-main {
    flex: 1;
}

.orgs-card-name {
    font-weight: 500;
    color: var(--ws-text);
    margin-bottom: 2px;
}

.orgs-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: var(--ws-text-3);
}

.orgs-card-role {
    text-transform: capitalize;
}

.orgs-card-active-badge {
    background: var(--ws-purple);
    color: white;
    padding: 1px 7px;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 600;
}

.orgs-card-chevron {
    color: var(--ws-text-3);
}

.orgs-card-members {
    padding: 6px 12px; background: transparent; border: 1px solid var(--ws-border);
    border-radius: 6px; color: var(--ws-text); font-size: 0.78rem; cursor: pointer;
    margin-right: 8px;
}
.orgs-card-members:hover { background: var(--ws-surface-2); border-color: rgba(124, 58, 237, 0.6); }

.orgs-invite-info {
    flex: 1;
}

.orgs-invite-name {
    display: block;
    font-weight: 500;
    color: var(--ws-text);
}

.orgs-invite-meta {
    font-size: 0.82rem;
    color: var(--ws-text-3);
}

.orgs-btn {
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 0.86rem;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: background 0.15s;
}

.orgs-btn--primary {
    background: var(--ws-purple);
    color: white;
}

.orgs-btn--primary:hover:not(:disabled) {
    background: #6D28D9;
}

.orgs-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.orgs-empty {
    padding: 32px 16px;
    text-align: center;
    color: var(--ws-text-3);
    background: var(--ws-surface-2);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.orgs-loading-spinner {
    width: 24px;
    height: 24px;
    border: 2.5px solid var(--ws-surface-2);
    border-top-color: var(--ws-purple);
    border-radius: 50%;
    animation: spin 0.85s linear infinite;
}

.orgs-error {
    margin-top: 16px;
    padding: 10px 12px;
    background: rgba(245, 101, 101, 0.1);
    color: #c53030;
    border: 1px solid rgba(245, 101, 101, 0.3);
    border-radius: 8px;
    font-size: 0.88rem;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>
