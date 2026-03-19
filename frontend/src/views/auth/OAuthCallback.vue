<template>
    <div class="auth-page">
        <div class="auth-card">

            <!-- Brand -->
            <LogoComponent class="auth-logo-comp" />

            <span class="auth-brand-name">ATABAI</span>
        </div>

        <!-- Loading state -->
        <template v-if="isLoading">
            <div class="auth-spinner-wrap">
                <div class="auth-spinner"></div>
            </div>
            <h2 class="auth-title">Signing you in…</h2>
            <p class="auth-sub">{{ $t('auth.pleaseWait') }}</p>
        </template>

        <!-- Error state -->
        <template v-else-if="error">
            <div class="auth-state-icon auth-state-error">
                <XCircleIcon class="w-7 h-7" />
            </div>
            <h2 class="auth-title">{{ $t('auth.loginFailed') }}</h2>
            <p class="auth-sub auth-sub-error">{{ error }}</p>
            <button class="auth-btn" @click="router.push('/')">
                <ArrowLeftIcon class="w-4 h-4" />
                {{ $t('common.goHome') }}
            </button>
        </template>

        <!-- Success state -->
        <template v-else>
            <div class="auth-state-icon auth-state-success">
                <CheckCircleIcon class="w-7 h-7" />
            </div>
            <h2 class="auth-title">{{ $t('auth.loginSuccessful') }}</h2>
            <p class="auth-sub">{{ $t('auth.redirectingToDashboard') }}</p>
            <div class="auth-progress">
                <div class="auth-progress-fill"></div>
            </div>
        </template>

    </div>
</template>

<script setup>
import LogoComponent from '@/components/Logo.vue'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'
import { XCircleIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

const isLoading = ref(true)
const error = ref(null)

onMounted(async () => {
    try {
        const code = route.query.code
        const errorParam = route.query.error

        if (errorParam) throw new Error(t('auth.oauthCancelled'))
        if (!code) throw new Error(t('auth.invalidOauthResponse'))

        await authStore.handleOAuthCallback(code)

        setTimeout(() => router.push('/app/dashboard'), 2000)
    } catch (err) {
        error.value = err.message || t('auth.unexpectedError')
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

.auth-logo-comp {
    width: 140px;
    height: 40px;
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
    letter-spacing: -0.01em;
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
    animation: progress-fill 2s ease-out forwards;
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
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 20px;
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