<template>
    <div class="relative">
        <!-- Label -->
        <label v-if="label" :for="inputId" class="block text-sm font-medium text-gray-700 mb-2">
            {{ label }}
            <span v-if="required" class="text-red-500 ml-1">*</span>
        </label>

        <!-- Input Container -->
        <div class="relative">
            <!-- Leading Icon -->
            <div v-if="leadingIcon" class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <component :is="leadingIcon" :class="[
                    'h-4 w-4',
                    error ? 'text-red-400' : 'text-gray-400'
                ]" />
            </div>

            <!-- Input Element -->
            <input :id="inputId" ref="inputRef" :type="type" :value="modelValue" :placeholder="placeholder"
                :disabled="disabled" :readonly="readonly" :required="required" :autocomplete="autocomplete" :class="[
                    'block w-full px-4 py-3 text-sm border rounded-lg shadow-sm transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:border-transparent',
                    'placeholder:text-gray-400',
                    // Padding adjustments for icons
                    leadingIcon ? 'pl-10' : '',
                    trailingIcon ? 'pr-10' : '',
                    // State-based styling
                    error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' :
                        success ? 'border-green-300 focus:ring-green-500 focus:border-green-500' :
                            'border-gray-300 focus:ring-accent focus:border-accent',
                    // Disabled state
                    disabled ? 'bg-gray-50 cursor-not-allowed opacity-75' : 'bg-white',
                    // Readonly state
                    readonly ? 'bg-gray-50' : '',
                    // Custom classes
                    inputClass
                ]" @input="handleInput" @blur="handleBlur" @focus="handleFocus" @keyup.enter="handleEnter" />

            <!-- Trailing Icon or Loading -->
            <div v-if="trailingIcon || loading" class="absolute inset-y-0 right-0 pr-3 flex items-center">
                <!-- Loading Spinner -->
                <div v-if="loading" class="animate-spin h-4 w-4 text-gray-400">
                    <svg class="w-full h-full" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4">
                        </circle>
                        <path class="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                        </path>
                    </svg>
                </div>

                <!-- Trailing Icon -->
                <component v-else-if="trailingIcon" :is="trailingIcon" :class="[
                    'h-4 w-4 cursor-pointer',
                    error ? 'text-red-400' : success ? 'text-green-400' : 'text-gray-400'
                ]" @click="handleTrailingIconClick" />
            </div>

            <!-- Clear Button (for clearable inputs) -->
            <button v-if="clearable && modelValue && !disabled && !readonly" @click="clearInput"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                type="button">
                <XMarkIcon class="h-4 w-4" />
            </button>
        </div>

        <!-- Helper Text / Error Message -->
        <Transition enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 transform translate-y-1" enter-to-class="opacity-100 transform translate-y-0"
            leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 transform translate-y-0"
            leave-to-class="opacity-0 transform translate-y-1">
            <p v-if="helperText || errorMessage" :class="[
                'mt-2 text-xs',
                error ? 'text-red-600' : success ? 'text-green-600' : 'text-gray-500'
            ]">
                {{ errorMessage || helperText }}
            </p>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

// Props
const props = defineProps({
    modelValue: {
        type: [String, Number],
        default: ''
    },
    type: {
        type: String,
        default: 'text',
        validator: (value) => [
            'text', 'email', 'password', 'number', 'tel', 'url', 'search', 'date', 'time', 'datetime-local'
        ].includes(value)
    },
    label: {
        type: String,
        default: ''
    },
    placeholder: {
        type: String,
        default: ''
    },
    helperText: {
        type: String,
        default: ''
    },
    errorMessage: {
        type: String,
        default: ''
    },
    disabled: {
        type: Boolean,
        default: false
    },
    readonly: {
        type: Boolean,
        default: false
    },
    required: {
        type: Boolean,
        default: false
    },
    loading: {
        type: Boolean,
        default: false
    },
    clearable: {
        type: Boolean,
        default: false
    },
    autocomplete: {
        type: String,
        default: 'off'
    },
    leadingIcon: {
        type: [Object, Function],
        default: null
    },
    trailingIcon: {
        type: [Object, Function],
        default: null
    },
    inputClass: {
        type: String,
        default: ''
    }
})

// Emits
const emit = defineEmits([
    'update:modelValue',
    'input',
    'focus',
    'blur',
    'enter',
    'trailing-icon-click',
    'clear'
])

// State
const inputRef = ref(null)

// Computed
const inputId = computed(() => `input-${Math.random().toString(36).substr(2, 9)}`)
const error = computed(() => !!props.errorMessage)
const success = computed(() => !error.value && props.helperText && props.helperText.includes('✓'))

// Methods
const handleInput = (event) => {
    const value = event.target.value
    emit('update:modelValue', value)
    emit('input', value, event)
}

const handleFocus = (event) => {
    emit('focus', event)
}

const handleBlur = (event) => {
    emit('blur', event)
}

const handleEnter = (event) => {
    emit('enter', event)
}

const handleTrailingIconClick = (event) => {
    emit('trailing-icon-click', event)
}

const clearInput = () => {
    emit('update:modelValue', '')
    emit('clear')
    nextTick(() => {
        inputRef.value?.focus()
    })
}

// Focus method (exposed for parent components)
const focus = () => {
    inputRef.value?.focus()
}

const blur = () => {
    inputRef.value?.blur()
}

// Expose methods
defineExpose({
    focus,
    blur
})
</script>

<style scoped>
/* Custom number input styling */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

input[type="number"] {
    -moz-appearance: textfield;
}

/* Search input styling */
input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
    -webkit-appearance: none;
}
</style>