<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="max-w-md w-full space-y-8">
            <div class="text-center">
                <div v-if="isLoading" class="space-y-4">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto"></div>
                    <h2 class="text-xl font-semibold text-gray-900">Completing login...</h2>
                </div>

                <div v-else-if="error" class="space-y-4">
                    <div class="text-red-500 text-4xl">⚠️</div>
                    <h2 class="text-xl font-semibold text-red-600">Login Failed</h2>
                    <p class="text-gray-600">{{ error }}</p>
                    <button @click="redirectToLogin"
                        class="mt-4 bg-violet-600 text-white px-6 py-2 rounded-lg hover:bg-violet-700 transition-colors">
                        Try Again
                    </button>
                </div>

                <div v-else class="space-y-4">
                    <div class="text-green-500 text-4xl">✅</div>
                    <h2 class="text-xl font-semibold text-green-600">Login Successful</h2>
                    <p class="text-gray-600">Redirecting to dashboard...</p>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(true)
const error = ref('')

onMounted(async () => {
    try {
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search)

        // Check for error parameter first
        const errorParam = urlParams.get('error')
        if (errorParam) {
            error.value = 'Authentication failed. Please try again.'
            isLoading.value = false
            return
        }

        // Handle successful authentication
        const success = authStore.handleAuthSuccess(urlParams)

        if (success) {
            // Clear URL parameters
            window.history.replaceState({}, document.title, window.location.pathname)

            // Redirect to dashboard or intended destination
            const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/dashboard'
            sessionStorage.removeItem('redirectAfterLogin')

            setTimeout(() => {
                router.push(redirectTo)
            }, 1500) // Brief delay to show success message
        } else {
            error.value = 'Invalid authentication parameters.'
        }
    } catch (err) {
        console.error('Auth success handling error:', err)
        error.value = 'An unexpected error occurred.'
    } finally {
        isLoading.value = false
    }
})

const redirectToLogin = () => {
    router.push('/login')
}
</script>