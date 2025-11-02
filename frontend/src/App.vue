<template>
    <div id="app" class="min-h-screen bg-gray-50">
        <!-- Navigation -->
        <Navbar v-if="showNavbar" />

        <!-- Main Content with conditional padding -->
        <div :class="{ 'pt-16': showNavbar }">
            <router-view />
        </div>

        <!-- Footer -->
        <Footer v-if="showFooter" />

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
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import Navbar from '@/components/layout/Navbar.vue'
import Footer from '@/components/layout/Footer.vue'

const authStore = useAuthStore()
const route = useRoute()

// Computed properties to determine if navbar/footer should be shown
const showNavbar = computed(() => {
    return route.meta?.showNavbar !== false // Default to true unless explicitly false
})

const showFooter = computed(() => {
    return route.meta?.showFooter !== false // Default to true unless explicitly false
})

onMounted(async () => {
    try {
        // Initialize auth store
        await authStore.checkAuth()
    } catch (error) {
        console.error('App.vue: Failed to initialize app:', error)
    }
})
</script>

<style>
/* Custom CSS Variables for ATABAI theme */
:root {
    --primary: #65399a;
    --primary-light: #8b7ed8;
    --primary-dark: #5d4a9e;
    --secondary: #f8fafc;
    --accent: #e2e8f0;
    --text: #1a202c;
    --text-light: #4a5568;
    --success: #48bb78;
    --warning: #ed8936;
    --error: #f56565;
    --border: #e2e8f0;
}

/* Global styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

html {
    scroll-behavior: smooth;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: var(--text);
    background-color: var(--secondary);
}

/* Button styles */
.btn-primary {
    @apply bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-dark transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl;
}

.btn-secondary {
    @apply bg-white text-primary border-2 border-primary px-6 py-3 rounded-lg font-medium hover:bg-primary hover:text-white transition-all duration-300;
}

.btn-auth {
    @apply bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow-md;
}

.btn-circle {
    @apply bg-primary text-white rounded-full font-medium hover:bg-primary-dark transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl;
}

/* Animation classes */
.hover-glow:hover {
    box-shadow: 0 0 20px rgba(101, 57, 154, 0.3);
}

/* Custom scrollbar */
::-webkit-scrollbar {
    width: 8px;
}

::-webkit-scrollbar-track {
    background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
    background: var(--primary);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--primary-dark);
}

/* Loading animation */
@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

.animate-spin {
    animation: spin 1s linear infinite;
}

/* Focus styles for accessibility */
button:focus,
input:focus,
textarea:focus,
select:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}

/* Responsive utilities */
@media (max-width: 768px) {

    .btn-primary,
    .btn-secondary {
        @apply px-4 py-2 text-sm;
    }
}
</style>