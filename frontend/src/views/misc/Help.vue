<template>
    <div class="help-page">
        <div class="help-grid" aria-hidden="true"></div>
        <div class="help-glow" aria-hidden="true"></div>

        <div class="help-inner">

            <!-- Brand -->
            <div class="help-brand">
                <div class="help-logo">
                    <LogoComponent class="w-8 h-8" />
                </div>
                <span class="help-brand-name">ATABAI</span>
            </div>

            <!-- Headline -->
            <div class="help-headline">
                <h1 class="help-title">{{ $t('help.title') || 'Get in touch' }}</h1>
                <p class="help-sub">{{ $t('help.description') || "We're here to help with any questions about ATABAI and IFRS automation." }}</p>
            </div>

            <!-- Contact cards -->
            <div class="help-cards">
                <button class="help-card" @click="openTelegram">
                    <div class="help-card-icon">
                        <TelegramIcon class="w-6 h-6" />
                    </div>
                    <div class="help-card-body">
                        <div class="help-card-name">{{ $t('help.telegram') }}</div>
                        <div class="help-card-hint">@atabai_official</div>
                    </div>
                    <ArrowRightIcon class="help-card-arrow w-4 h-4" />
                </button>

                <button class="help-card" @click="openMail">
                    <div class="help-card-icon">
                        <EnvelopeIcon class="w-6 h-6" />
                    </div>
                    <div class="help-card-body">
                        <div class="help-card-name">{{ $t('help.email') }}</div>
                        <div class="help-card-hint">contact@atabai.uz</div>
                    </div>
                    <ArrowRightIcon class="help-card-arrow w-4 h-4" />
                </button>

                <button class="help-card" @click="openInstagram">
                    <div class="help-card-icon">
                        <InstagramIcon class="w-6 h-6" />
                    </div>
                    <div class="help-card-body">
                        <div class="help-card-name">{{ $t('help.instagram') }}</div>
                        <div class="help-card-hint">@atabai.official</div>
                    </div>
                    <ArrowRightIcon class="help-card-arrow w-4 h-4" />
                </button>
            </div>

            <!-- Back -->
            <router-link :to="isAuthenticated ? '/app/dashboard' : '/'" class="help-back">
                <ArrowLeftIcon class="w-4 h-4" />
                {{ $t('help.backToDashboard') }}
            </router-link>

        </div>
    </div>
</template>

<script setup>
import LogoComponent from '@/components/Logo.vue'
import { computed } from 'vue'
import { ArrowLeftIcon, ArrowRightIcon, EnvelopeIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import InstagramIcon from '@/components/icons/InstagramIcon.vue'

const authStore = useAuthStore()
const isAuthenticated = computed(() => authStore.isAuthenticated)

function openTelegram() { window.open('https://t.me/atabai_official', '_blank') }
function openMail() { window.open('mailto:contact@atabai.uz', '_blank') }
function openInstagram() { window.open('https://instagram.com/atabai.official', '_blank') }
</script>

<style scoped>
.help-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--misc-bg);
    position: relative;
    overflow: hidden;
    padding: 40px 24px;
}

.help-grid {
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(var(--misc-grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--misc-grid) 1px, transparent 1px);
    background-size: 56px 56px;
    pointer-events: none;
}

.help-glow {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--misc-glow) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
}

.help-inner {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 36px;
    text-align: center;
    max-width: 460px;
    width: 100%;
}

.help-brand {
    display: flex;
    align-items: center;
    gap: 10px;
}

.help-brand-name {
    font-size: 18px;
    font-weight: 800;
    color: var(--misc-text);
    letter-spacing: 0.06em;
}

.help-headline {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.help-title {
    font-size: clamp(36px, 7vw, 52px);
    font-weight: 800;
    color: var(--misc-text);
    letter-spacing: -0.03em;
    line-height: 1.1;
    margin: 0;
}

.help-sub {
    font-size: 15px;
    color: var(--misc-text-2);
    line-height: 1.6;
    margin: 0;
}

/* Cards */
.help-cards {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
}

.help-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: var(--misc-card-bg);
    border: 1px solid var(--misc-card-border);
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
    width: 100%;
}

.help-card:hover {
    border-color: rgba(149, 0, 255, 0.25);
    background: var(--misc-badge-bg);
}

.help-card-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(149, 0, 255, 0.1);
    color: #A78BFA;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.help-card-body {
    flex: 1;
    min-width: 0;
}

.help-card-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--misc-text);
    margin-bottom: 2px;
}

.help-card-hint {
    font-size: 12.5px;
    color: var(--misc-text-3);
}

.help-card-arrow {
    color: rgba(240, 236, 246, 0.2);
    flex-shrink: 0;
    transition: color 0.15s, transform 0.15s;
}

.help-card:hover .help-card-arrow {
    color: #A78BFA;
    transform: translateX(3px);
}

/* Back */
.help-back {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--misc-text-3);
    text-decoration: none;
    transition: color 0.15s;
}

.help-back:hover {
    color: var(--misc-text-2);
}
</style>