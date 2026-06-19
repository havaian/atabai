<!-- frontend/src/components/ui/UiCheckbox.vue
     Shared styled checkbox on the .ui-* namespace (sibling to UiButton /
     UiField / UiModal). The native input is hidden and a custom box driven by
     :checked is drawn instead, so checkboxes match the rest of the form
     controls instead of falling back to the browser default. Label content
     goes in the default slot. -->
<template>
    <label class="ui-checkbox" :class="{ 'ui-checkbox--disabled': disabled }">
        <input
            type="checkbox"
            :checked="modelValue"
            :disabled="disabled"
            @change="$emit('update:modelValue', $event.target.checked)"
        />
        <span class="ui-checkbox-box"><Check :size="12" :stroke-width="3" /></span>
        <span v-if="$slots.default" class="ui-checkbox-label"><slot /></span>
    </label>
</template>

<script setup lang="ts">
// @ts-nocheck
import { Check } from 'lucide-vue-next'

defineProps({
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.ui-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-size: 0.85rem;
    line-height: 1.3;
    cursor: pointer;
}
.ui-checkbox--disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

/* Native input hidden but kept in flow for accessibility + keyboard focus. */
.ui-checkbox input[type="checkbox"] {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    margin: 0;
}

.ui-checkbox-box {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    border: 1.5px solid var(--ws-border);
    background: var(--ws-surface);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    transition: background-color 0.12s, border-color 0.12s;
}
.ui-checkbox-box :deep(svg) {
    opacity: 0;
    transition: opacity 0.12s;
}

.ui-checkbox:not(.ui-checkbox--disabled):hover .ui-checkbox-box {
    border-color: rgba(124, 58, 237, 0.45);
}
.ui-checkbox input[type="checkbox"]:checked + .ui-checkbox-box {
    background: var(--ws-purple);
    border-color: var(--ws-purple);
}
.ui-checkbox input[type="checkbox"]:checked + .ui-checkbox-box :deep(svg) {
    opacity: 1;
}
.ui-checkbox input[type="checkbox"]:focus-visible + .ui-checkbox-box {
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

.ui-checkbox-label {
    color: var(--ws-text-2);
}
</style>
