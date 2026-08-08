<template>
    <div id="app" class="min-h-screen" style="background: var(--landing-bg)">
        <!-- Navigation -->
        <Navbar v-if="showNavbar" />

        <!-- Main Content with conditional padding -->
        <div :class="{ 'pt-16': showNavbar }">
            <router-view />
        </div>

        <!-- Footer -->
        <div v-if="showFooter" style="background: var(--landing-bg)">
            <Footer />
        </div>

        <!-- Loading Overlay (hidden on auth pages - they render their own spinner) -->
        <Transition name="overlay-fade">
            <div v-if="authStore.isLoading && !isAuthRoute" class="overlay-loader">
                <div class="overlay-loader-card">
                    <div class="overlay-loader-spinner"></div>
                    <span class="overlay-loader-text">{{ authStore.loadingMessage || $t('common.loading') }}</span>
                </div>
            </div>
        </Transition>

        <!-- Error Message -->
        <div v-if="authStore.error" class="fixed bottom-4 right-4 z-50 max-w-md">
            <div class="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between">
                <span>{{ authStore.error }}</span>
                <button @click="authStore.error = null" class="ml-4 text-white hover:text-gray-200">
                    <XMarkIcon class="w-5 h-5" />
                </button>
            </div>
        </div>

        <!-- <CursorEffect /> -->
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { XMarkIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import Navbar from '@/components/layout/Navbar.vue'
import Footer from '@/components/layout/Footer.vue'
// import CursorEffect from '@/components/CursorEffect.vue'

const authStore = useAuthStore()
const route = useRoute()

// Computed properties to determine if navbar/footer should be shown
const showNavbar = computed(() => {
    return route.meta?.showNavbar !== false // Default to true unless explicitly false
})

const showFooter = computed(() => {
    return route.meta?.showFooter !== false // Default to true unless explicitly false
})

const isAuthRoute = computed(() => route.path.startsWith('/auth/') || route.path === '/login')

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
    @apply bg-primary text-white rounded-full font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl;
}

/* Animation classes */
.hover-glow:hover {
    box-shadow: 0 0 20px rgba(101, 57, 154, 0.3);
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

/* Responsive utilities */
@media (max-width: 768px) {

    .btn-primary,
    .btn-secondary {
        @apply px-4 py-2 text-sm;
    }
}

/* ===== Global loading overlay ===== */
.overlay-loader {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--overlay-bg);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
}

.overlay-loader-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 22px;
    background: var(--overlay-card-bg);
    border: 1px solid var(--overlay-card-border);
    border-radius: 14px;
    box-shadow: var(--overlay-card-shadow);
}

.overlay-loader-spinner {
    width: 22px;
    height: 22px;
    border: 2.5px solid var(--overlay-spinner-track);
    border-top-color: #9500FF;
    border-radius: 50%;
    animation: overlay-spin 0.85s linear infinite;
    flex-shrink: 0;
}

.overlay-loader-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--overlay-text);
    letter-spacing: -0.005em;
}

@keyframes overlay-spin {
    to {
        transform: rotate(360deg);
    }
}

/* Fade transition */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
    transition: opacity 0.2s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
    opacity: 0;
}
</style>