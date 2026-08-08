<template>
    <div class="adm-combobox-wrap">
        <input
            :value="modelValue"
            @input="onInput"
            :list="datalistId"
            :placeholder="placeholder"
            :disabled="disabled"
            class="adm-input adm-combobox-input"
            autocomplete="off"
        />
        <datalist :id="datalistId">
            <option v-for="opt in uniqueOptions" :key="opt" :value="opt" />
        </datalist>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed } from 'vue'

/**
 * Combobox = free-text input + autocomplete from a list of suggestions.
 *
 * Why not a strict <select>?
 *  - ATABAI's IFRS taxonomy is still forming. A strict select would force
 *    admin to first add a new IFRS classification through a separate UI
 *    before mapping a row - two clicks for what should be one.
 *  - Combobox shows existing values as suggestions (typo protection: see
 *    "PP&E - Gross" already in list → don't type "PP&E Gross BV") but
 *    allows entering new values inline.
 *
 * Implementation: native HTML <datalist>. Zero dependencies, accessible by
 * default, works on all modern browsers. The downside vs a custom dropdown
 * is limited styling (Firefox/Safari render datalist slightly differently),
 * but the upside is zero maintenance.
 *
 * Once methodology stabilizes (~6-12 months), we can pass `strict: true`
 * to lock the input to existing values - but that's a future feature.
 */
const props = defineProps({
    modelValue: { type: String, default: '' },
    suggestions: { type: Array, default: () => [] },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    // Unique HTML id used to wire <input list=""> to <datalist id="">.
    // Caller must provide a unique id per instance on the same page.
    datalistId: { type: String, required: true }
})

const emit = defineEmits(['update:modelValue'])

function onInput(e) {
    emit('update:modelValue', e.target.value)
}

// Dedupe + sort suggestions for stable display order
const uniqueOptions = computed(() => {
    const seen = new Set()
    const out = []
    for (const v of props.suggestions) {
        if (typeof v !== 'string') continue
        const trimmed = v.trim()
        if (!trimmed || seen.has(trimmed)) continue
        seen.add(trimmed)
        out.push(trimmed)
    }
    return out.sort()
})
</script>

<style scoped>
.adm-combobox-wrap {
    position: relative;
    width: 100%;
}

.adm-combobox-input {
    width: 100%;
}
</style>
