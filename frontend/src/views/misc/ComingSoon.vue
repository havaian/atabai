<template>
    <div class="cs-page">
        <div class="cs-grid" aria-hidden="true"></div>
        <div class="cs-glow" aria-hidden="true"></div>

        <div class="cs-inner">

            <!-- Brand -->
            <div class="`cs-brand`">
                <div class="cs-logo">
                    <LogoComponent class="w-8 h-8" />
                </div>
            </div>

            <!-- Headline -->
            <div class="cs-headline">
                <div class="cs-badge">
                    <span class="cs-badge-dot"></span>
                    {{ $t('comingSoon.title') }}
                </div>
                <h1 class="cs-title">{{ $t('comingSoon.pageTitle') }}</h1>
                <p class="cs-sub">{{ $t('comingSoon.description') }}</p>
            </div>

            <!-- Contact channels -->
            <div class="cs-channels">
                <button class="cs-channel" @click="openTelegram">
                    <TelegramIcon class="w-5 h-5" />
                    <span>{{ $t('comingSoon.telegram') }}</span>
                </button>
                <button class="cs-channel" @click="openMail">
                    <EnvelopeIcon class="w-5 h-5" />
                    <span>{{ $t('comingSoon.email') }}</span>
                </button>
                <button class="cs-channel" @click="openInstagram">
                    <InstagramIcon class="w-5 h-5" />
                    <span>{{ $t('comingSoon.instagram') }}</span>
                </button>
            </div>

            <!-- Back -->
            <router-link to="/" class="cs-back">
                <ArrowLeftIcon class="w-4 h-4" />
                {{ $t('comingSoon.backToDashboard') }}
            </router-link>

        </div>
    </div>
</template>

<script setup>
import LogoComponent from '@/components/Logo.vue'
import { ArrowLeftIcon, EnvelopeIcon } from '@heroicons/vue/24/outline'
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import InstagramIcon from '@/components/icons/InstagramIcon.vue'

function openTelegram() { window.open('https://t.me/atabai_official', '_blank') }
function openMail() { window.open('mailto:contact@atabai.uz', '_blank') }
function openInstagram() { window.open('https://instagram.com/atabai.official', '_blank') }
</script>

<style scoped>
.cs-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--misc-bg);
    position: relative;
    overflow: hidden;
    padding: 40px 24px;
}

/* Grid pattern */
.cs-grid {
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(var(--misc-grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--misc-grid) 1px, transparent 1px);
    background-size: 56px 56px;
    pointer-events: none;
}

/* Central glow */
.cs-glow {
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

.cs-inner {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 36px;
    text-align: center;
    max-width: 480px;
    width: 100%;
}

/* Brand */
.cs-brand {
    display: flex;
    align-items: center;
    gap: 10px;
}

/* Headline */
.cs-headline {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

.cs-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 14px;
    border: 1px solid var(--misc-badge-border);
    border-radius: 100px;
    font-size: 12px;
    font-weight: 500;
    color: var(--ws-text-3);
    background: var(--misc-badge-bg);
}

.cs-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #A78BFA;
    animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.3;
    }
}

.cs-title {
    font-size: clamp(40px, 8vw, 64px);
    font-weight: 800;
    color: var(--misc-text);
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin: 0;
}

.cs-sub {
    font-size: 15px;
    color: var(--misc-text-2);
    line-height: 1.6;
    margin: 0;
    max-width: 360px;
}

/* Channels */
.cs-channels {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
}

.cs-channel {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border: 1px solid var(--misc-card-border);
    border-radius: 10px;
    background: var(--misc-card-bg);
    color: var(--ws-text-3);
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.cs-channel:hover {
    border-color: rgba(149, 0, 255, 0.3);
    background: rgba(149, 0, 255, 0.08);
    color: var(--ws-text);
}

/* Back */
.cs-back {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13.5px;
    font-weight: 500;
    color: var(--misc-text-3);
    text-decoration: none;
    transition: color 0.15s;
}

.cs-back:hover {
    color: var(--misc-text-2);
}
</style>