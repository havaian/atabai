<template>
    <div class="space-y-6">
        <!-- Section Header -->
        <div class="pb-4 border-b border-gray-200">
            <h2 class="text-lg font-medium text-gray-900">{{ $t('settings.personal.title') }}</h2>
            <p class="mt-1 text-sm text-gray-500">{{ $t('settings.personal.description') }}</p>
        </div>

        <!-- Theme Setting -->
        <div class="space-y-4">
            <div class="flex items-start justify-between">
                <div class="flex-1">
                    <label class="text-sm font-medium text-gray-900">{{ $t('settings.personal.theme') }}</label>
                    <p class="text-sm text-gray-500 mt-1">{{ $t('settings.personal.themeDescription') }}</p>
                </div>
                <div class="ml-6 flex-shrink-0 w-48">
                    <Select v-model="selectedTheme" :options="themeOptions" :placeholder="$t('settings.personal.theme')"
                        @change="updateTheme" />
                </div>
            </div>
        </div>

        <!-- Save Notification -->
        <Transition enter-active-class="transition ease-out duration-300"
            enter-from-class="opacity-0 transform translate-y-2" enter-to-class="opacity-100 transform translate-y-0"
            leave-active-class="transition ease-in duration-200" leave-from-class="opacity-100 transform translate-y-0"
            leave-to-class="opacity-0 transform translate-y-2">
            <div v-if="showSaveNotification"
                class="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircleIcon class="h-5 w-5 text-green-600" />
                <span class="text-sm text-green-800">{{ $t('settings.saved') }}</span>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

// Icons
import {
    SunIcon,
    MoonIcon,
    ComputerDesktopIcon,
    CheckCircleIcon
} from '@heroicons/vue/24/outline'

// Composables
const { t } = useI18n()
const authStore = useAuthStore()
const themeStore = useThemeStore()

// State
const selectedTheme = computed({
    get: () => themeStore.preference,
    set: (val) => themeStore.setTheme(val)
})
const showSaveNotification = ref(false)

// Theme options formatted for custom Select component
const themeOptions = ref([
    {
        value: 'light',
        label: t('settings.personal.themeLight'),
        icon: SunIcon
    },
    {
        value: 'dark',
        label: t('settings.personal.themeDark'),
        icon: MoonIcon
    },
    {
        value: 'system',
        label: t('settings.personal.themeSystem'),
        icon: ComputerDesktopIcon
    }
])

// Update theme
const updateTheme = (theme) => {
    themeStore.setTheme(theme)

    showSaveNotification.value = true
    setTimeout(() => {
        showSaveNotification.value = false
    }, 3000)
}

// Watch for system theme changes when using system mode
const setupSystemThemeWatcher = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleSystemThemeChange = () => {
        if (selectedTheme.value === 'system') {
            applyTheme('system')
        }
    }

    mediaQuery.addEventListener('change', handleSystemThemeChange)

    // Return cleanup function
    return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
}

// Initialize theme on component mount
onMounted(() => {
    // Update theme option labels to be reactive
    themeOptions.value = [
        {
            value: 'light',
            label: t('settings.personal.themeLight'),
            icon: SunIcon
        },
        {
            value: 'dark',
            label: t('settings.personal.themeDark'),
            icon: MoonIcon
        },
        {
            value: 'system',
            label: t('settings.personal.themeSystem'),
            icon: ComputerDesktopIcon
        }
    ]
})
</script>