<template>
    <div class="cs-page">
        <div class="cs-grid" aria-hidden="true"></div>
        <div class="cs-glow" aria-hidden="true"></div>

        <div class="cs-inner">

            <!-- Brand -->
            <div class="cs-brand">
                <div class="cs-logo">
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-8 h-8">
                        <rect width="32" height="32" rx="8" fill="#7C3AED" />
                        <path d="M8 24L16 8L24 24" stroke="white" stroke-width="2.5" stroke-linecap="round"
                            stroke-linejoin="round" />
                        <path d="M10.5 19H21.5" stroke="white" stroke-width="2.5" stroke-linecap="round" />
                    </svg>
                </div>
                <span class="cs-brand-name">ATABAI</span>
            </div>

            <!-- Headline -->
            <div class="cs-headline">
                <div class="cs-badge">
                    <span class="cs-badge-dot"></span>
                    In development
                </div>
                <h1 class="cs-title">Coming soon</h1>
                <p class="cs-sub">This feature is being built. Stay tuned for updates.</p>
            </div>

            <!-- Contact channels -->
            <div class="cs-channels">
                <button class="cs-channel" @click="openTelegram">
                    <TelegramIcon class="w-5 h-5" />
                    <span>Telegram</span>
                </button>
                <button class="cs-channel" @click="openMail">
                    <EnvelopeIcon class="w-5 h-5" />
                    <span>Email</span>
                </button>
                <button class="cs-channel" @click="openInstagram">
                    <InstagramIcon class="w-5 h-5" />
                    <span>Instagram</span>
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
    background: #07060B;
    position: relative;
    overflow: hidden;
    padding: 40px 24px;
}

/* Grid pattern */
.cs-grid {
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgba(149, 0, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(149, 0, 255, 0.04) 1px, transparent 1px);
    background-size: 56px 56px;
    pointer-events: none;
}

/* Central glow */
.cs-glow {
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(124, 58, 237, 0.12) 0%, transparent 70%);
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

.cs-brand-name {
    font-size: 18px;
    font-weight: 800;
    color: #F0ECF6;
    letter-spacing: 0.06em;
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
    border: 1px solid rgba(149, 0, 255, 0.2);
    border-radius: 100px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(240, 236, 246, 0.5);
    background: rgba(149, 0, 255, 0.06);
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
    color: #F0ECF6;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin: 0;
}

.cs-sub {
    font-size: 15px;
    color: rgba(240, 236, 246, 0.4);
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
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    color: rgba(240, 236, 246, 0.65);
    font-size: 13.5px;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.cs-channel:hover {
    border-color: rgba(149, 0, 255, 0.3);
    background: rgba(149, 0, 255, 0.08);
    color: #F0ECF6;
}

/* Back */
.cs-back {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13.5px;
    font-weight: 500;
    color: rgba(240, 236, 246, 0.3);
    text-decoration: none;
    transition: color 0.15s;
}

.cs-back:hover {
    color: rgba(240, 236, 246, 0.7);
}
</style>