<template>
    <div class="select-wrap" ref="selectRef">
        <button class="select-trigger" :class="{ open: isOpen, disabled: disabled }" :disabled="disabled" type="button"
            @click="toggleDropdown">
            <div class="select-value">
                <component v-if="selectedOption?.icon" :is="selectedOption.icon" class="select-icon" />
                <span :class="['select-text', selectedOption ? 'selected' : 'placeholder']">
                    {{ selectedOption ? selectedOption.label : placeholder }}
                </span>
            </div>
            <ChevronDownIcon class="select-chevron" :class="{ rotated: isOpen }" />
        </button>

        <Transition name="dropdown">
            <div v-if="isOpen && !disabled" class="select-dropdown">
                <button v-for="option in options" :key="option.value" class="select-option"
                    :class="{ active: option.value === modelValue }" type="button" @click="selectOption(option)">
                    <component v-if="option.icon" :is="option.icon" class="option-icon" />
                    <span class="option-label">{{ option.label }}</span>
                    <CheckIcon v-if="option.value === modelValue" class="option-check" />
                </button>
                <div v-if="options.length === 0" class="select-empty">No options available</div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDownIcon, CheckIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
    modelValue: { type: [String, Number, Object], default: null },
    options: { type: Array, required: true, default: () => [] },
    placeholder: { type: String, default: 'Select...' },
    disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const selectRef = ref(null)

const selectedOption = computed(() => props.options.find(o => o.value === props.modelValue))

function toggleDropdown() {
    if (!props.disabled) isOpen.value = !isOpen.value
}

function selectOption(option) {
    emit('update:modelValue', option.value)
    emit('change', option.value, option)
    isOpen.value = false
}

onClickOutside(selectRef, () => { isOpen.value = false })

function handleKeydown(e) {
    if (e.key === 'Escape') isOpen.value = false
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.select-wrap {
    position: relative;
    width: 100%;
}

/* ── Trigger ── */
.select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: #171523;
    border: 1px solid rgba(149, 0, 255, 0.12);
    border-radius: 9px;
    cursor: pointer;
    transition: border-color 0.15s;
    text-align: left;
    font-size: 13px;
}

.select-trigger:hover:not(.disabled) {
    border-color: rgba(149, 0, 255, 0.25);
}

.select-trigger.open {
    border-color: #7C3AED;
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15);
}

.select-trigger.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.select-value {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.select-icon {
    width: 15px;
    height: 15px;
    color: rgba(240, 236, 246, 0.4);
    flex-shrink: 0;
}

.select-text {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
}

.select-text.selected {
    color: #F0ECF6;
}

.select-text.placeholder {
    color: rgba(240, 236, 246, 0.25);
}

.select-chevron {
    width: 15px;
    height: 15px;
    color: rgba(240, 236, 246, 0.3);
    flex-shrink: 0;
    transition: transform 0.18s;
}

.select-chevron.rotated {
    transform: rotate(180deg);
}

/* ── Dropdown ── */
.select-dropdown {
    position: absolute;
    z-index: 100;
    top: calc(100% + 6px);
    left: 0;
    min-width: 100%;
    width: max-content;
    max-width: 320px;
    background: #1D1A2A;
    border: 1px solid rgba(149, 0, 255, 0.18);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    max-height: 240px;
    overflow-y: auto;
}

.select-dropdown::-webkit-scrollbar {
    width: 4px;
}

.select-dropdown::-webkit-scrollbar-track {
    background: transparent;
}

.select-dropdown::-webkit-scrollbar-thumb {
    background: rgba(149, 0, 255, 0.2);
    border-radius: 2px;
}

.select-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 9px 14px;
    background: transparent;
    border: none;
    font-size: 13px;
    color: rgba(240, 236, 246, 0.65);
    cursor: pointer;
    text-align: left;
    transition: background 0.1s, color 0.1s;
}

.select-option:hover {
    background: rgba(124, 58, 237, 0.1);
    color: #F0ECF6;
}

.select-option.active {
    background: rgba(124, 58, 237, 0.12);
    color: #C084FC;
}

.option-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: rgba(240, 236, 246, 0.35);
}

.select-option.active .option-icon {
    color: #A78BFA;
}

.option-label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.option-check {
    width: 14px;
    height: 14px;
    color: #A78BFA;
    flex-shrink: 0;
    margin-left: auto;
}

.select-empty {
    padding: 12px 14px;
    font-size: 13px;
    color: rgba(240, 236, 246, 0.25);
}

/* ── Transition ── */
.dropdown-enter-active,
.dropdown-leave-active {
    transition: opacity 0.15s, transform 0.15s;
}

.dropdown-enter-from,
.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}
</style>