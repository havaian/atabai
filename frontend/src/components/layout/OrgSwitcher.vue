<!-- frontend/src/components/layout/OrgSwitcher.vue
     Active-organization indicator + dropdown switcher. Lives in the user
     layout chrome; collapses to a single-letter avatar when the sidebar is
     collapsed so it still surfaces the active context.

     When the user has no orgs OR exactly one, the dropdown becomes a
     read-only label — there's nothing to switch to. The "Create / Manage"
     entry at the bottom of the menu is the universal escape hatch. -->
<template>
    <div class="org-switcher" :class="{ 'org-switcher--collapsed': collapsed }" ref="rootRef">
        <button
            v-if="orgs.hasOrgs"
            class="org-switcher-trigger"
            :class="{ 'org-switcher-trigger--collapsed': collapsed }"
            @click="toggle"
        >
            <span class="org-switcher-avatar">{{ initials }}</span>
            <span v-if="!collapsed" class="org-switcher-info">
                <span class="org-switcher-label">{{ $t('organizations.switcher.activeLabel') }}</span>
                <span class="org-switcher-name">{{ orgs.currentOrg?.name || $t('organizations.switcher.none') }}</span>
            </span>
            <ChevronDown v-if="!collapsed" :size="14" class="org-switcher-chevron" />
        </button>

        <button v-else class="org-switcher-empty" @click="goToOnboarding">
            <Plus :size="16" />
            <span v-if="!collapsed">{{ $t('organizations.switcher.createFirst') }}</span>
        </button>

        <Transition name="org-switcher-pop">
            <div v-if="isOpen && orgs.hasOrgs" class="org-switcher-menu">
                <div class="org-switcher-menu-header">
                    {{ $t('organizations.switcher.switchTo') }}
                </div>
                <ul class="org-switcher-menu-list">
                    <li v-for="org in orgs.items" :key="org.id">
                        <button
                            class="org-switcher-menu-item"
                            :class="{ 'org-switcher-menu-item--active': org.id === orgs.currentOrgId }"
                            @click="select(org.id)"
                        >
                            <span class="org-switcher-menu-name">{{ org.name }}</span>
                            <Check v-if="org.id === orgs.currentOrgId" :size="14" class="org-switcher-menu-check" />
                        </button>
                    </li>
                </ul>
                <div class="org-switcher-menu-footer">
                    <button class="org-switcher-menu-link" @click="manage">
                        <Settings :size="14" />
                        {{ $t('organizations.switcher.manage') }}
                    </button>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Check, ChevronDown, Plus, Settings } from 'lucide-vue-next'
import { useOrganizationsStore } from '@/stores/organizations'

defineProps({
    collapsed: { type: Boolean, default: false },
})

const router = useRouter()
const orgs = useOrganizationsStore()
const isOpen = ref(false)
const rootRef = ref(null)

const initials = computed(() => {
    const name = orgs.currentOrg?.name || ''
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('') || '·'
})

function toggle() {
    isOpen.value = !isOpen.value
}

function close() {
    isOpen.value = false
}

function select(orgId) {
    if (orgId === orgs.currentOrgId) {
        close()
        return
    }
    orgs.setCurrentOrg(orgId)
    close()
    // Reload current route data — simplest cross-page invalidation.
    router.push('/app/dashboard')
}

function goToOnboarding() {
    router.push('/app/organizations/onboarding')
}

function manage() {
    close()
    router.push('/app/organizations')
}

function handleDocumentClick(event) {
    if (!rootRef.value) return
    if (!rootRef.value.contains(event.target)) close()
}

onMounted(() => document.addEventListener('mousedown', handleDocumentClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleDocumentClick))
</script>

<style scoped>
.org-switcher {
    position: relative;
    width: 100%;
}

.org-switcher-trigger,
.org-switcher-empty {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}

.org-switcher-trigger:hover,
.org-switcher-empty:hover {
    background: var(--accent);
    border-color: var(--primary-light);
}

.org-switcher-trigger--collapsed {
    padding: 8px;
    justify-content: center;
}

.org-switcher-avatar {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.78rem;
    font-weight: 600;
}

.org-switcher-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    flex: 1;
}

.org-switcher-label {
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-light);
}

.org-switcher-name {
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
}

.org-switcher-chevron {
    color: var(--text-light);
    flex-shrink: 0;
}

.org-switcher-empty {
    color: var(--primary);
    font-weight: 500;
    font-size: 0.88rem;
    border-style: dashed;
}

.org-switcher-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    min-width: 240px;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
    z-index: 50;
    overflow: hidden;
}

.org-switcher-menu-header {
    padding: 10px 12px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-light);
    border-bottom: 1px solid var(--border);
}

.org-switcher-menu-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    max-height: 260px;
    overflow-y: auto;
}

.org-switcher-menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 0.88rem;
    text-align: left;
    cursor: pointer;
}

.org-switcher-menu-item:hover {
    background: var(--accent);
}

.org-switcher-menu-item--active {
    color: var(--primary);
    font-weight: 500;
}

.org-switcher-menu-check {
    color: var(--primary);
}

.org-switcher-menu-footer {
    border-top: 1px solid var(--border);
    padding: 4px 0;
}

.org-switcher-menu-link {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: var(--text);
    font-size: 0.85rem;
    cursor: pointer;
}

.org-switcher-menu-link:hover {
    background: var(--accent);
}

.org-switcher-pop-enter-active,
.org-switcher-pop-leave-active {
    transition: opacity 0.1s, transform 0.1s;
    transform-origin: top center;
}

.org-switcher-pop-enter-from,
.org-switcher-pop-leave-to {
    opacity: 0;
    transform: scaleY(0.96);
}
</style>
