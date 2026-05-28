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
            :class="{
                'org-switcher-trigger--collapsed': collapsed,
                'org-switcher-trigger--open': isOpen,
            }"
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
/* OrgSwitcher lives inside the sidebar chrome, so it styles against the
   --sb-* token family (same as the nav items around it) rather than the
   content-area --ws-* tokens. This is what makes hover/active states and
   text colors match the surrounding sidebar in both themes — the previous
   version referenced an undefined --primary/--accent/--text/--border set,
   which fell back to browser-default blue and near-black text (invisible
   on the dark sidebar). */
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
    border: 1px solid var(--sb-border);
    border-radius: 10px;
    color: var(--sb-text);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.org-switcher-trigger:hover,
.org-switcher-empty:hover {
    background: var(--sb-item-hover);
    border-color: var(--sb-menu-border);
    color: var(--sb-text-hover);
}

/* When the menu is open, keep the trigger in its hover/active appearance
   so it reads as "this is the thing that's currently expanded" — and
   crucially uses the purple-tinted sidebar active bg, not blue. */
.org-switcher-trigger--open {
    background: var(--sb-item-active-bg);
    border-color: var(--sb-menu-border);
    color: var(--sb-text-hover);
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
    /* Product violet — was var(--primary) (undefined → browser blue). */
    background: var(--ws-purple);
    color: #fff;
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
    color: var(--sb-text);
}

.org-switcher-name {
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--sb-text-hover);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
}

.org-switcher-chevron {
    color: var(--sb-icon-muted);
    flex-shrink: 0;
}

.org-switcher-empty {
    color: var(--sb-text-active);
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
    background: var(--sb-menu-bg);
    border: 1px solid var(--sb-menu-border);
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
    color: var(--sb-text);
    border-bottom: 1px solid var(--sb-border);
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
    color: var(--sb-menu-text);
    font-size: 0.88rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
}

.org-switcher-menu-item:hover {
    background: var(--sb-item-hover);
}

/* Active org row — purple tint bg + violet text, was blue (var(--primary)). */
.org-switcher-menu-item--active {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
    font-weight: 500;
}

.org-switcher-menu-check {
    color: var(--sb-text-active);
}

.org-switcher-menu-footer {
    border-top: 1px solid var(--sb-border);
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
    color: var(--sb-menu-text);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background 0.12s;
}

.org-switcher-menu-link:hover {
    background: var(--sb-item-hover);
}

.org-switcher-pop-enter-active,
.org-switcher-pop-leave-active {
    transition: opacity 0.1s;
}

.org-switcher-pop-enter-from,
.org-switcher-pop-leave-to {
    opacity: 0;
}
</style>
