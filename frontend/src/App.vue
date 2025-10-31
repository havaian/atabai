<template>
    <div id="app" class="min-h-screen bg-gray-50">
        <!-- Router View -->
        <router-view />

        <!-- Loading Overlay -->
        <div v-if="authStore.isLoading"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 flex items-center space-x-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span class="text-gray-700">{{ authStore.loadingMessage || 'Loading...' }}</span>
            </div>
        </div>

        <!-- Error Message -->
        <div v-if="authStore.error" class="fixed bottom-4 right-4 z-50 max-w-md">
            <div class="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between">
                <span>{{ authStore.error }}</span>
                <button @click="authStore.error = null" class="ml-4 text-white hover:text-gray-200">
                    <XMarkIcon class="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, nextTick } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()

onMounted(async () => {
    try {
        // Initialize auth store first
        await authStore.checkAuth()

        // Setup page titles after everything is initialized
        await nextTick(() => {
            try {
                // Dynamically import the composable to ensure i18n is ready
                import('./composables/usePageTitle.js').then(({ setupGlobalPageTitles }) => {
                    setupGlobalPageTitles()
                }).catch(error => {
                    console.warn('Could not setup page titles:', error)
                })
            } catch (error) {
                console.warn('Page title setup error:', error)
            }
        })
    } catch (error) {
        console.error('Failed to initialize app:', error)
    }
})
</script>

<style>
/* Custom CSS Variables for ATABAI theme */
:root {
    --primary: #765fc6;
    --primary-light: #8b7ed8;
    --primary-dark: #5d4a9e;
    --secondary: #10B981;
    --danger: #EF4444;
    --warning: #F59E0B;
    --success: #10B981;
    --gray-50: #F9FAFB;
    --gray-100: #F3F4F6;
    --gray-500: #6B7280;
    --gray-900: #111827;
    --accent: #9333ea;
}

/* Apply custom colors */
.text-primary {
    color: var(--primary);
}

.bg-primary {
    background-color: var(--primary);
}

.bg-primary-dark {
    background-color: var(--primary-dark);
}

.border-primary {
    border-color: var(--primary);
}

.ring-primary {
    --tw-ring-color: var(--primary);
}

.focus\:ring-primary:focus {
    --tw-ring-color: var(--primary);
}

.hover\:bg-primary-dark:hover {
    background-color: var(--primary-dark);
}

.hover\:text-primary:hover {
    color: var(--primary);
}

/* Custom scrollbar */
::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-track {
    background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
    background: var(--primary);
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--primary-dark);
}

/* Smooth transitions */
* {
    transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

/* Typography */
body {
    font-family: 'Inter', 'Montserrat', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}

/* Smooth scrolling */
html {
    scroll-behavior: smooth;
}
</style>