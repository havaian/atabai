<!-- frontend/src/views/auth/LoginPage.vue -->

<template>
    <div class="login-page">
        <div class="login-card">
            <RouterLink to="/" class="login-logo-link" :aria-label="$t('nav.home')">
                <LogoComponent class="login-logo" />
            </RouterLink>

            <div class="login-content">
                <h1 class="login-title">
                    {{ wasRedirected ? $t('auth.signInRequiredTitle') : $t('auth.signInTitle') }}
                </h1>
                <p class="login-subtitle">
                    {{ wasRedirected ? $t('auth.signInRequiredSubtitle') : $t('auth.signInSubtitle') }}
                </p>
            </div>

            <button class="login-google-btn" :disabled="authStore.isLoading" @click="authStore.login()">
                <GoogleIcon :size="18" />
                <span>{{ $t('auth.signInWithGoogle') }}</span>
            </button>

            <RouterLink to="/" class="login-back-link">
                <ArrowLeftIcon class="w-4 h-4" />
                <span>{{ $t('auth.backToHome') }}</span>
            </RouterLink>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import LogoComponent from '@/components/Logo.vue'
import GoogleIcon from '@/components/icons/GoogleIcon.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// Capture redirect state at mount time — sessionStorage value is set by the
// router guard before navigating here, and we don't want to flicker between
// the two subtitle variants if it gets cleared mid-flow.
const wasRedirected = ref(false)

onMounted(() => {
    wasRedirected.value = !!sessionStorage.getItem('redirectAfterLogin')
})
</script>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--auth-bg);
    color: var(--auth-title);
}

.login-card {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 40px 32px 32px;
    background: var(--auth-card-bg);
    border: 1px solid var(--auth-card-border);
    border-radius: 20px;
    box-shadow: var(--auth-card-shadow);
}

.login-logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
}

.login-logo {
    height: 32px;
    width: auto;
}

.login-content {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.login-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--auth-title);
    margin: 0;
    line-height: 1.3;
}

.login-subtitle {
    font-size: 14px;
    color: var(--auth-sub);
    margin: 0;
    line-height: 1.5;
}

/* Google button — matches the landing sidebar's primary auth button */
.login-google-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 13px 20px;
    border: none;
    border-radius: 12px;
    background: #9500FF;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}

.login-google-btn:hover:not(:disabled) {
    background: #7B00D4;
}

.login-google-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.login-back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--auth-sub);
    font-size: 13px;
    text-decoration: none;
    transition: color 0.15s;
}

.login-back-link:hover {
    color: var(--auth-title);
}

@media (max-width: 480px) {
    .login-card {
        padding: 32px 24px 24px;
        gap: 24px;
    }

    .login-title {
        font-size: 20px;
    }
}
</style>