<template>
    <div class="adm-user-multi">
        <!-- Selected chips. Click x to remove. -->
        <div class="adm-user-multi-chips" v-if="selectedUsers.length > 0">
            <span v-for="u in selectedUsers" :key="u._id" class="adm-user-multi-chip">
                <span class="adm-user-multi-chip-email">{{ u.email }}</span>
                <button type="button" class="adm-user-multi-chip-remove"
                    :title="$t('admin.common.delete')"
                    @click="removeUser(u._id)">×</button>
            </span>
        </div>

        <!-- Search input - filters loaded users by email/name substring. -->
        <input
            v-model="searchQuery"
            type="text"
            class="adm-input adm-user-multi-input"
            :placeholder="$t('admin.mappings.userMultiSelectPlaceholder')"
            @focus="dropdownOpen = true"
            @blur="onBlurDelayed"
        />

        <!-- Dropdown of matching users. Shown on focus. -->
        <div v-if="dropdownOpen && filteredUsers.length > 0" class="adm-user-multi-dropdown">
            <button
                v-for="u in filteredUsers"
                :key="u._id"
                type="button"
                class="adm-user-multi-option"
                @mousedown.prevent="addUser(u)"
            >
                <span class="adm-user-multi-option-email">{{ u.email }}</span>
                <span v-if="u.name" class="adm-user-multi-option-name">{{ u.name }}</span>
            </button>
        </div>
        <div v-else-if="dropdownOpen && searchQuery && filteredUsers.length === 0"
            class="adm-user-multi-dropdown adm-user-multi-empty">
            {{ $t('admin.common.noData') }}
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
/**
 * UserMultiSelect - pick one or more users by email.
 *
 * Loads all users once via adminStore.listUsers (paginated; we fetch up to
 * 500 to cover realistic enterprise scale). Filtering is client-side by
 * email/name substring. Selection state is exposed via v-model as an array
 * of user IDs (strings).
 *
 * Why client-side filtering: typical user count is in the low hundreds at
 * most for an enterprise B2B2B distribution. Server-side search would add
 * a round-trip per keystroke for negligible benefit.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useAdminStore } from '@/stores/admin'

const props = defineProps({
    // Array of user IDs (strings).
    modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const adminStore = useAdminStore()

const allUsers = ref([])
const searchQuery = ref('')
const dropdownOpen = ref(false)

// Selected user objects (looked up by id from modelValue).
const selectedUsers = computed(() => {
    const ids = new Set(props.modelValue.map(String))
    return allUsers.value.filter(u => ids.has(String(u._id)))
})

// Filtered for dropdown: substring match on email or name, excluding
// already-selected users.
const filteredUsers = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    const selectedIds = new Set(props.modelValue.map(String))
    return allUsers.value
        .filter(u => !selectedIds.has(String(u._id)))
        .filter(u => {
            if (!q) return true
            const email = (u.email || '').toLowerCase()
            const name = (u.name || '').toLowerCase()
            return email.includes(q) || name.includes(q)
        })
        // Cap dropdown size - 20 rows is enough for human scanning.
        .slice(0, 20)
})

function addUser(u) {
    if (props.modelValue.includes(u._id) || props.modelValue.includes(String(u._id))) return
    emit('update:modelValue', [...props.modelValue, u._id])
    searchQuery.value = ''
}

function removeUser(id) {
    emit('update:modelValue', props.modelValue.filter(x => String(x) !== String(id)))
}

// Slight delay on blur so the click on a dropdown option registers before
// the dropdown closes. Without this, mousedown.prevent isn't always enough
// across browsers.
let blurTimer = null
function onBlurDelayed() {
    if (blurTimer) clearTimeout(blurTimer)
    blurTimer = setTimeout(() => { dropdownOpen.value = false }, 150)
}

async function loadUsers() {
    try {
        // Reasonably large page size to cover typical enterprise user counts.
        const data = await adminStore.listUsers({ page: 1, limit: 500 })
        allUsers.value = data.users || []
    } catch (err) {
        console.error('Failed to load users for UserMultiSelect:', err)
    }
}

onMounted(loadUsers)

// If the modelValue contains IDs we don't have user objects for yet (e.g.
// page just opened and listUsers hasn't returned), trigger a load to
// resolve them.
watch(() => props.modelValue, (newIds) => {
    if (newIds.length === 0) return
    const haveIds = new Set(allUsers.value.map(u => String(u._id)))
    const missing = newIds.some(id => !haveIds.has(String(id)))
    if (missing && allUsers.value.length === 0) {
        loadUsers()
    }
}, { immediate: true })
</script>

<style scoped>
.adm-user-multi {
    position: relative;
}

.adm-user-multi-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
}

.adm-user-multi-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: rgba(149, 0, 255, 0.15);
    border: 1px solid rgba(149, 0, 255, 0.3);
    border-radius: 12px;
    font-size: 12px;
    color: var(--adm-text, #f0ecf6);
}

.adm-user-multi-chip-email {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.adm-user-multi-chip-remove {
    border: none;
    background: transparent;
    color: var(--adm-text-muted);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    padding: 0 2px;
}

.adm-user-multi-chip-remove:hover {
    color: var(--adm-text, #f0ecf6);
}

.adm-user-multi-input {
    width: 100%;
}

.adm-user-multi-dropdown {
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    z-index: 10;
    margin-top: 4px;
    max-height: 240px;
    overflow-y: auto;
    background: rgba(10, 6, 18, 0.98);
    border: 1px solid rgba(149, 0, 255, 0.25);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.adm-user-multi-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--adm-text, #f0ecf6);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
}

.adm-user-multi-option:hover {
    background: rgba(149, 0, 255, 0.15);
}

.adm-user-multi-option-email {
    font-size: 13px;
}

.adm-user-multi-option-name {
    font-size: 11px;
    color: var(--adm-text-muted);
}

.adm-user-multi-empty {
    padding: 12px;
    color: var(--adm-text-muted);
    font-size: 13px;
    text-align: center;
}
</style>
