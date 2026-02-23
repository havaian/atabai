<template>
    <div class="space-y-6">
        <!-- Section Header -->
        <div class="pb-4 border-b border-gray-200">
            <h2 class="text-lg font-medium text-gray-900">{{ $t('settings.personal.title') }}</h2>
            <p class="mt-1 text-sm text-gray-500">{{ $t('settings.personal.description') }}</p>
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

const showSaveNotification = ref(false)
</script>