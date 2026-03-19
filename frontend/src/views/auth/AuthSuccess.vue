<template>
    <div class="auth-page">
        <div class="auth-card">

            <!-- Brand -->
            <div class="auth-brand">
                <div class="auth-logo">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-7 h-7">
                        <rect width="32" height="32" rx="8" fill="#7C3AED" />
                        <path d="M8 24L16 8L24 24" stroke="white" stroke-width="2.5" stroke-linecap="round"
                            stroke-linejoin="round" />
                        <path d="M10.5 19H21.5" stroke="white" stroke-width="2.5" stroke-linecap="round" />
                    </svg>
                </div>
                <span class="auth-brand-name">ATABAI</span>
            </div>

            <!-- Loading -->
            <template v-if="isLoading">
                <div class="auth-spinner-wrap">
                    <div class="auth-spinner"></div>
                </div>
                <h2 class="auth-title">Completing login…</h2>
                <p class="auth-sub">Just a moment</p>
            </template>

            <!-- Error -->
            <template v-else-if="error">
                <div class="auth-state-icon auth-state-error">
                    <XCircleIcon class="w-7 h-7" />
                </div>
                <h2 class="auth-title">Login failed</h2>
                <p class="auth-sub auth-sub-error">{{ error }}</p>
                <button class="auth-btn" @click="router.push('/')">
                    Try again
                </button>
            </template>

            <!-- Success -->
            <template v-else>
                <div class="auth-state-icon auth-state-success">
                    <CheckCircleIcon class="w-7 h-7" />
                </div>
                <h2 class="auth-title">Login successful</h2>
                <p class="auth-sub">Redirecting to dashboard…</p>
                <div class="auth-progress">
                    <div class="auth-progress-fill"></div>
                </div>
            </template>

        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { XCircleIcon, CheckCircleIcon } from '@heroicons/vue/24/outline'

const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(true)
const error = ref('')

onMounted(async () => {
    try {
        const urlParams = new URLSearchParams(window.location.search)
        const errorParam = urlParams.get('error')

        if (errorParam) {
            error.value = 'Authentication failed. Please try again.'
            isLoading.value = false
            return
        }

        const success = authStore.handleAuthSuccess(urlParams)

        if (success) {
            window.history.replaceState({}, document.title, window.location.pathname)
            const redirectTo = sessionStorage.getItem('redirectAfterLogin') || '/app/dashboard'
            sessionStorage.removeItem('redirectAfterLogin')
            setTimeout(() => router.push(redirectTo), 1500)
        } else {
            error.value = 'Invalid authentication parameters.'
        }
    } catch (err) {
        console.error('Auth success error:', err)
        error.value = 'An unexpected error occurred.'
    } finally {
        isLoading.value = false
    }
})
</script>

<style scoped>
.auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #F9FAFB;
    padding: 24px;
}

.auth-card {
    width: 100%;
    max-width: 380px;
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 20px;
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.auth-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
}

.auth-brand-name {
    font-size: 17px;
    font-weight: 800;
    color: #111827;
    letter-spacing: 0.04em;
}

.auth-spinner-wrap {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.auth-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(124, 58, 237, 0.15);
    border-top-color: #7C3AED;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.auth-state-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.auth-state-success {
    background: #dcfce7;
    color: #16a34a;
}

.auth-state-error {
    background: #fee2e2;
    color: #dc2626;
}

.auth-title {
    font-size: 18px;
    font-weight: 700;
    color: #111827;
    margin: 0;
}

.auth-sub {
    font-size: 14px;
    color: #9CA3AF;
    margin: -8px 0 0;
    line-height: 1.5;
}

.auth-sub-error {
    color: #EF4444;
}

.auth-progress {
    width: 100%;
    height: 4px;
    background: #F3F4F6;
    border-radius: 10px;
    overflow: hidden;
}

.auth-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #7C3AED, #A78BFA);
    border-radius: 10px;
    animation: progress-fill 1.5s ease-out forwards;
}

@keyframes progress-fill {
    from {
        width: 0%;
    }

    to {
        width: 100%;
    }
}

.auth-btn {
    padding: 10px 24px;
    background: #7C3AED;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}

.auth-btn:hover {
    background: #6D28D9;
}
</style>