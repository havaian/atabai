<template>
    <div class="input-root">
        <label v-if="label" :for="inputId" class="input-label">
            {{ label }}
            <span v-if="required" class="input-required">*</span>
        </label>

        <div class="input-wrap">
            <div v-if="leadingIcon" class="input-icon input-icon-left">
                <component :is="leadingIcon" class="icon" :class="{ 'icon-error': error }" />
            </div>

            <input :id="inputId" ref="inputRef" :type="type" :value="modelValue" :placeholder="placeholder"
                :disabled="disabled" :readonly="readonly" :required="required" :autocomplete="autocomplete"
                class="input-el" :class="{
                    'has-leading': leadingIcon,
                    'has-trailing': trailingIcon || loading || (clearable && modelValue),
                    'is-error': error,
                    'is-success': success,
                    'is-disabled': disabled,
                    'is-readonly': readonly,
                }" @input="handleInput" @blur="$emit('blur', $event)" @focus="$emit('focus', $event)"
                @keyup.enter="$emit('enter', $event)" />

            <div v-if="trailingIcon || loading" class="input-icon input-icon-right">
                <div v-if="loading" class="input-spinner"></div>
                <component v-else-if="trailingIcon" :is="trailingIcon" class="icon icon-clickable"
                    :class="{ 'icon-error': error, 'icon-success': success }"
                    @click="$emit('trailing-icon-click', $event)" />
            </div>

            <button v-if="clearable && modelValue && !disabled && !readonly" class="input-clear" type="button"
                @click="clearInput">
                <XMarkIcon class="w-3.5 h-3.5" />
            </button>
        </div>

        <Transition name="helper">
            <p v-if="errorMessage || helperText" class="input-helper"
                :class="{ 'helper-error': error, 'helper-success': success }">
                {{ errorMessage || helperText }}
            </p>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
    modelValue: { type: [String, Number], default: '' },
    type: { type: String, default: 'text' },
    label: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    helperText: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
    autocomplete: { type: String, default: 'off' },
    leadingIcon: { type: [Object, Function], default: null },
    trailingIcon: { type: [Object, Function], default: null },
    inputClass: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'input', 'focus', 'blur', 'enter', 'trailing-icon-click', 'clear'])

const inputRef = ref(null)
const inputId = computed(() => `input-${Math.random().toString(36).substr(2, 9)}`)
const error = computed(() => !!props.errorMessage)
const success = computed(() => !error.value && props.helperText?.includes('✓'))

function handleInput(e) {
    emit('update:modelValue', e.target.value)
    emit('input', e.target.value, e)
}

function clearInput() {
    emit('update:modelValue', '')
    emit('clear')
    nextTick(() => inputRef.value?.focus())
}

defineExpose({
    focus: () => inputRef.value?.focus(),
    blur: () => inputRef.value?.blur(),
})
</script>

<style scoped>
.input-root {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.input-label {
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(240, 236, 246, 0.55);
    letter-spacing: 0.02em;
}

.input-required {
    color: #f87171;
    margin-left: 3px;
}

/* ── Input wrap ── */
.input-wrap {
    position: relative;
}

/* ── Input element ── */
.input-el {
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 9px;
    font-size: 13.5px;
    color: var(--ws-text);
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    line-height: 1.5;
}

.input-el::placeholder {
    color: rgba(240, 236, 246, 0.2);
}

.input-el:focus {
    border-color: #7C3AED;
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
}

.input-el:hover:not(:focus):not(.is-disabled):not(.is-readonly) {
    border-color: rgba(149, 0, 255, 0.25);
}

.input-el.has-leading {
    padding-left: 36px;
}

.input-el.has-trailing {
    padding-right: 36px;
}

.input-el.is-error {
    border-color: rgba(248, 113, 113, 0.5);
}

.input-el.is-error:focus {
    border-color: #f87171;
    box-shadow: 0 0 0 2px rgba(248, 113, 113, 0.15);
}

.input-el.is-success {
    border-color: rgba(74, 222, 128, 0.4);
}

.input-el.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: var(--ws-surface-2);
}

.input-el.is-readonly {
    background: var(--ws-surface-2);
    cursor: default;
}

/* ── Icons ── */
.input-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    pointer-events: none;
}

.input-icon-left {
    left: 10px;
}

.input-icon-right {
    right: 10px;
    pointer-events: auto;
}

.icon {
    width: 15px;
    height: 15px;
    color: rgba(240, 236, 246, 0.3);
}

.icon-error {
    color: #f87171;
}

.icon-success {
    color: #4ade80;
}

.icon-clickable {
    cursor: pointer;
    transition: color 0.12s;
}

.icon-clickable:hover {
    color: rgba(240, 236, 246, 0.7);
}

/* ── Spinner ── */
.input-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(240, 236, 246, 0.1);
    border-top-color: #7C3AED;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* ── Clear button ── */
.input-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: rgba(240, 236, 246, 0.3);
    cursor: pointer;
    padding: 3px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.12s;
}

.input-clear:hover {
    color: rgba(240, 236, 246, 0.7);
}

/* ── Helper text ── */
.input-helper {
    font-size: 12px;
    color: rgba(240, 236, 246, 0.35);
    margin: 0;
}

.helper-error {
    color: #f87171;
}

.helper-success {
    color: #4ade80;
}

.helper-enter-active,
.helper-leave-active {
    transition: opacity 0.15s, transform 0.15s;
}

.helper-enter-from,
.helper-leave-to {
    opacity: 0;
    transform: translateY(-3px);
}

/* ── Number / search native UI reset ── */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

input[type="number"] {
    -moz-appearance: textfield;
}

input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button {
    -webkit-appearance: none;
}
</style>