<!-- frontend/src/components/ui/UiField.vue
     Labeled form control (input or textarea) on the .ui-field namespace,
     styled with --ws-* tokens. Fallthrough attributes (placeholder, maxlength,
     inputmode, etc.) land on the inner control, so callers keep using native
     attributes as before. Use type="textarea" for multiline.

     v-model works directly. For inputs that transform on change (e.g. forcing
     uppercase), bind explicitly instead:
       :model-value="x" @update:model-value="v => x = v.toUpperCase()"
     Set `trim` to mirror the old v-model.trim behavior. -->
<template>
    <label class="ui-field" :class="{ 'ui-field--error': !!error }">
        <span v-if="label" class="ui-field-label">{{ label }}</span>
        <textarea
            v-if="type === 'textarea'"
            class="ui-field-control"
            :value="modelValue"
            :disabled="disabled"
            :rows="rows"
            v-bind="$attrs"
            @input="onInput"
        />
        <input
            v-else
            class="ui-field-control"
            :type="type"
            :value="modelValue"
            :disabled="disabled"
            v-bind="$attrs"
            @input="onInput"
        />
        <span v-if="error" class="ui-field-msg ui-field-msg--error">{{ error }}</span>
        <span v-else-if="hint" class="ui-field-msg">{{ hint }}</span>
    </label>
</template>

<script lang="ts">
// Attributes belong on the inner control, not the wrapping <label>.
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
// @ts-nocheck
const props = defineProps({
    modelValue: { type: [String, Number], default: '' },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    error: { type: String, default: '' },
    // text | number | textarea | email | ...
    type: { type: String, default: 'text' },
    rows: { type: [String, Number], default: 3 },
    disabled: { type: Boolean, default: false },
    trim: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
function onInput(e) {
    let v = e.target.value
    if (props.trim && typeof v === 'string') v = v.trim()
    emit('update:modelValue', v)
}
</script>

<style scoped>
.ui-field { display: flex; flex-direction: column; gap: 5px; justify-content: end; }
.ui-field-label { font-size: 0.8rem; font-weight: 500; color: var(--ws-text-2); }
.ui-field-control {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 12px;
    font-size: 0.9rem;
    color: var(--ws-text);
    background: var(--ws-bg);
    border: 1px solid var(--ws-border-2);
    border-radius: 8px;
    outline: none;
    font-family: inherit;
    resize: vertical;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.ui-field-control::placeholder { color: var(--ws-text-3); }
.ui-field-control:hover:not(:focus):not(:disabled) { border-color: rgba(124, 58, 237, 0.25); }
.ui-field-control:focus { border-color: var(--ws-purple); box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15); }
.ui-field-control:disabled { background: var(--ws-surface-2); color: var(--ws-text-3); cursor: not-allowed; }
/* Tint the native date-picker glyph in dark theme — the default black glyph
   would otherwise vanish against a dark field. */
[data-theme="dark"] .ui-field-control[type="date"]::-webkit-calendar-picker-indicator {
    filter: invert(0.7) sepia(1) saturate(5) hue-rotate(230deg);
}
.ui-field--error .ui-field-control { border-color: #ef4444; }
.ui-field-msg { font-size: 0.76rem; color: var(--ws-text-3); }
.ui-field-msg--error { color: #ef4444; }
</style>
