<template>
    <div
        class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 flex items-center justify-center relative overflow-hidden">
        <div class="relative z-10 max-w-md w-full mx-4">
            <!-- Main Card -->
            <div
                class="bg-white/80 backdrop-blur-sm border border-black rounded-3xl shadow-2xl shadow-primary/5 p-8 relative">
                <!-- Gradient border effect -->
                <div
                    class="absolute inset-0 p-[1px]">
                    <div class="w-full h-full bg-white rounded-3xl"></div>
                </div>

                <div class="relative z-10 text-center space-y-6">
                    <!-- Loading State -->
                    <div v-if="isLoading" class="space-y-6">
                        <!-- Animated Logo Spinner -->
                        <div class="relative mx-auto w-20 h-20">
                            <!-- Outer rotating ring -->
                            <div class="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                            <div
                                class="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin">
                            </div>
                            <!-- Inner pulsing dot -->
                            <div
                                class="absolute inset-4 bg-gradient-to-br from-primary to-primary/80 rounded-full animate-pulse flex items-center justify-center">
                                <div class="w-4 h-4 bg-white rounded-full"></div>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <h2
                                class="text-2xl font-bold bg-gradient-to-r from-gray-900 to-primary bg-clip-text text-transparent">
                                {{ $t('auth.processingLogin') }}
                            </h2>
                            <p class="text-gray-600 leading-relaxed">
                                {{ $t('auth.pleaseWait') }}
                            </p>
                        </div>
                    </div>

                    <!-- Error State -->
                    <div v-else-if="error" class="space-y-6">
                        <!-- Error Icon -->
                        <div
                            class="mx-auto w-20 h-20 bg-gradient-to-br from-red-100 to-red-50 rounded-full flex items-center justify-center">
                            <div class="w-12 h-12 text-red-500">
                                <ExclamationTriangleIcon />
                            </div>
                        </div>

                        <div class="space-y-3">
                            <h2 class="text-2xl font-bold text-black">
                                {{ $t('auth.loginFailed') }}
                            </h2>
                            <p class="text-black leading-relaxed">{{ error }}</p>
                        </div>

                        <!-- Error Action Button -->
                        <button @click="goHome"
                            class="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-red-600 border border-black bg-transparent rounded-xl hover:bg-red-600 hover:border-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2">
                            <span class="relative z-10 flex items-center space-x-2">
                                <HomeIcon class="w-5 h-5" />
                                <span>{{ $t('common.goHome') }}</span>
                            </span>
                            <div
                                class="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300">
                            </div>
                        </button>
                    </div>

                    <!-- Success State -->
                    <div v-else class="space-y-6">
                        <!-- Success Icon with animation -->
                        <div
                            class="mx-auto w-20 h-20 bg-gradient-to-br from-green-100 to-green-50 rounded-full flex items-center justify-center animate-bounce-subtle">
                            <div class="w-12 h-12 text-green-500">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    class="w-full h-full animate-draw-check">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3"
                                        d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>

                        <div class="space-y-3">
                            <h2
                                class="text-2xl font-bold bg-gradient-to-r from-green-700 to-green-600 bg-clip-text text-transparent">
                                {{ $t('auth.loginSuccessful') }}
                            </h2>
                            <p class="text-green-600 leading-relaxed">
                                {{ $t('auth.redirectingToDashboard') }}
                            </p>
                        </div>

                        <!-- Success progress bar -->
                        <div class="w-full bg-green-100 rounded-full h-2 overflow-hidden">
                            <div
                                class="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full animate-progress">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { ExclamationTriangleIcon, HomeIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const isLoading = ref(true)
const error = ref(null)

onMounted(async () => {
    try {
        // Get authorization code from URL
        const code = route.query.code
        const errorParam = route.query.error

        if (errorParam) {
            throw new Error(t('auth.oauthCancelled'))
        }

        if (!code) {
            throw new Error(t('auth.invalidOauthResponse'))
        }

        // Handle OAuth callback
        await authStore.handleOAuthCallback(code)

        // Small delay for user to see success message
        setTimeout(() => {
            router.push('/dashboard')
        }, 2000) // Slightly longer to see the animation

    } catch (err) {
        error.value = err.message || t('auth.unexpectedError')
        isLoading.value = false
    }
})

function goHome() {
    router.push('/')
}
</script>

<style scoped>
/* Custom animations */
@keyframes draw-check {
    0% {
        stroke-dasharray: 0 24;
    }

    100% {
        stroke-dasharray: 24 24;
    }
}

@keyframes progress {
    0% {
        width: 0%;
    }

    100% {
        width: 100%;
    }
}

@keyframes bounce-subtle {

    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-8px);
    }
}

.animate-draw-check {
    animation: draw-check 0.8s ease-in-out;
    stroke-dasharray: 24;
}

.animate-progress {
    animation: progress 2s ease-out;
}

.animate-bounce-subtle {
    animation: bounce-subtle 1s ease-in-out;
}

/* Gradient background utilities */
.bg-gradient-radial {
    background: radial-gradient(circle, var(--tw-gradient-stops));
}

/* Custom glass effect */
.backdrop-blur-sm {
    backdrop-filter: blur(8px);
}

/* Ensure proper primary color (toxic violet) */
:root {
    --color-primary: #9500FF;
}

.text-primary {
    color: var(--color-primary);
}

.bg-primary {
    background-color: var(--color-primary);
}

.border-primary {
    border-color: var(--color-primary);
}

.from-primary {
    --tw-gradient-from: var(--color-primary);
}

.to-primary {
    --tw-gradient-to: var(--color-primary);
}
</style>