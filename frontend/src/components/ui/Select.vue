<template>
    <div class="relative" ref="selectRef">
        <!-- Select Trigger -->
        <button @click="toggleDropdown" :class="[
            'relative w-full px-4 py-3 text-left bg-white border border-gray-300 rounded-lg shadow-sm cursor-pointer',
            'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent',
            'transition-all duration-200',
            isOpen ? 'border-accent ring-2 ring-accent' : '',
            disabled ? 'bg-gray-50 cursor-not-allowed opacity-75' : ''
        ]" :disabled="disabled">
            <div class="flex items-center justify-between">
                <!-- Selected Value Display -->
                <div class="flex items-center space-x-2">
                    <!-- Icon if provided -->
                    <component v-if="selectedOption?.icon" :is="selectedOption.icon" class="h-4 w-4 text-gray-500" />
                    <!-- Selected Text -->
                    <span :class="[
                        'block truncate text-sm',
                        selectedOption ? 'text-gray-900' : 'text-gray-500'
                    ]">
                        {{ selectedOption ? selectedOption.label : placeholder }}
                    </span>
                </div>

                <!-- Dropdown Arrow -->
                <ChevronDownIcon :class="[
                    'h-4 w-4 text-gray-400 transition-transform duration-200',
                    isOpen ? 'rotate-180' : ''
                ]" />
            </div>
        </button>

        <!-- Dropdown Options -->
        <Transition enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 scale-95 -translate-y-2" enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-2">
            <div v-show="isOpen && !disabled" :class="[
                'absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg',
                'max-h-60 overflow-auto'
            ]">
                <button v-for="option in options" :key="option.value" @click="selectOption(option)" :class="[
                    'w-full px-4 py-2.5 text-left text-sm flex items-center space-x-2',
                    'hover:bg-violet-200 hover:text-gray-900 transition-colors duration-150',
                    option.value === modelValue ? 'bg-accent/10 text-accent' : 'text-gray-700',
                    'focus:outline-none focus:bg-gray-50'
                ]">
                    <!-- Option Icon -->
                    <component v-if="option.icon" :is="option.icon" :class="[
                        'h-4 w-4 flex-shrink-0',
                        option.value === modelValue ? 'text-accent' : 'text-gray-400'
                    ]" />

                    <!-- Option Label -->
                    <span class="truncate">{{ option.label }}</span>

                    <!-- Selected Check -->
                    <CheckIcon v-if="option.value === modelValue" class="h-4 w-4 ml-auto text-accent flex-shrink-0" />
                </button>

                <!-- No options state -->
                <div v-if="options.length === 0" class="px-4 py-2.5 text-sm text-gray-500">
                    No options available
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronDownIcon, CheckIcon } from '@heroicons/vue/24/outline'

// Props
const props = defineProps({
    modelValue: {
        type: [String, Number, Object],
        default: null
    },
    options: {
        type: Array,
        required: true,
        default: () => []
    },
    placeholder: {
        type: String,
        default: 'Select an option...'
    },
    disabled: {
        type: Boolean,
        default: false
    }
})

// Emits
const emit = defineEmits(['update:modelValue', 'change'])

// State
const isOpen = ref(false)
const selectRef = ref(null)

// Computed
const selectedOption = computed(() => {
    return props.options.find(option => option.value === props.modelValue)
})

// Methods
const toggleDropdown = () => {
    if (!props.disabled) {
        isOpen.value = !isOpen.value
    }
}

const selectOption = (option) => {
    emit('update:modelValue', option.value)
    emit('change', option.value, option)
    isOpen.value = false
}

const closeDropdown = () => {
    isOpen.value = false
}

// Close dropdown when clicking outside
onClickOutside(selectRef, closeDropdown)

// Close dropdown on escape key
const handleKeydown = (event) => {
    if (event.key === 'Escape' && isOpen.value) {
        closeDropdown()
    }
}

onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* Custom scrollbar for dropdown */
.overflow-auto::-webkit-scrollbar {
    width: 4px;
}

.overflow-auto::-webkit-scrollbar-track {
    background: transparent;
}

.overflow-auto::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 2px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}
</style>