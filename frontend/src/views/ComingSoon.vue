<template>
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-[#312e81] to-[#0c4a6e] relative overflow-hidden">
        <!-- Subtle Background Elements -->
        <div class="absolute inset-0">
            <!-- Clean floating orbs -->
            <div class="absolute top-1/4 left-1/4 w-32 h-32 rounded-full blur-xl animate-float-slow"
                style="background-color: rgba(2, 132, 199, 0.1);">
            </div>
            <div class="absolute top-3/4 right-1/4 w-48 h-48 rounded-full blur-2xl animate-float-slower"
                style="background-color: rgba(3, 105, 161, 0.08);">
            </div>
            <div class="absolute top-1/2 left-3/4 w-24 h-24 bg-cyan-400/12 rounded-full blur-lg animate-float"></div>

            <!-- Minimal grid -->
            <div class="absolute inset-0 bg-grid-pattern opacity-3"></div>
        </div>

        <!-- Main Content -->
        <div class="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div class="max-w-2xl w-full text-center">
                <!-- Rotating Gear Icon -->
                <div class="mb-12">
                    <div class="relative inline-block">
                        <div class="w-32 h-32 mx-auto mb-8">
                            <div class="w-full h-full rounded-full flex items-center justify-center shadow-2xl"
                                style="background: linear-gradient(to bottom right, #0284c7, #0369a1);">
                                <CogIcon class="w-16 h-16 text-white animate-spin-slow" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Simple message -->
                <div class="mb-12 space-y-4">
                    <h2 class="text-3xl sm:text-4xl font-bold text-white">
                        {{ $t('comingSoon.title') }}
                    </h2>
                </div>

                <!-- Clean actions -->
                <div class="space-y-4">
                    <!-- Contact buttons -->
                    <div class="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto mb-6">
                        <button @click="window.open('https://t.me/atabai_official', '_blank')"
                            class="text-white/80 hover:text-white font-medium py-3 px-6 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center">
                            <TelegramIcon size="20" className="mr-2" />
                            {{ $t('comingSoon.telegram') }}
                        </button>

                        <button @click="window.open('mailto:contact@atabai.uz', '_blank')"
                            class="text-white/80 hover:text-white font-medium py-3 px-6 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center">
                            <MailIcon size="20" className="mr-2" />
                            {{ $t('comingSoon.email') }}
                        </button>

                        <button @click="window.open('https://instagram.com/atabai.official', '_blank')"
                            class="text-white/80 hover:text-white font-medium py-3 px-6 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center">
                            <InstagramIcon size="20" className="mr-2" />
                            {{ $t('comingSoon.instagram') }}
                        </button>
                    </div>

                    <!-- Back to home -->
                    <div class="flex justify-center">
                        <router-link to="/"
                            class="text-white/80 hover:text-white font-medium py-2 px-4 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center">
                            <ArrowLeftIcon class="w-5 h-5 mr-2" />
                            {{ $t('comingSoon.backToHome') }}
                        </router-link>
                    </div>
                </div>

                <!-- Footer -->
                <footer
                    class="flex w-full max-w-4xl flex-col md:flex-row items-center gap-6 md:gap-10 justify-center mt-15 py-4 px-8 mb-8 rounded-47 md:mt-5 mx-auto">
                    <div class="order-1 md:order-none">
                        <div class="text-5xl font-bold logo-fancy">ATABAI</div>
                    </div>
                </footer>
            </div>
        </div>
    </div>
</template>

<script setup>
import { watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { CogIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline'
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import MailIcon from '@/components/icons/MailIcon.vue'
import InstagramIcon from '@/components/icons/InstagramIcon.vue'

const { t, locale } = useI18n()

// Function to update page title
const updatePageTitle = () => {
    document.title = `${t('comingSoon.pageTitle')} | ATABAI`
}

// Watch for locale changes and update title
watch(locale, updatePageTitle, { immediate: false })
</script>

<style scoped>
/* Grid Pattern Background */
.bg-grid-pattern {
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
}

/* Simple animations */
@keyframes float {

    0%,
    100% {
        transform: translateY(0px);
    }

    50% {
        transform: translateY(-10px);
    }
}

@keyframes float-slow {

    0%,
    100% {
        transform: translateY(0px);
    }

    50% {
        transform: translateY(-15px);
    }
}

@keyframes float-slower {

    0%,
    100% {
        transform: translateY(0px);
    }

    50% {
        transform: translateY(-20px);
    }
}

/* Slow spin animation for the cog */
@keyframes spin-slow {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.animate-float {
    animation: float 6s ease-in-out infinite;
}

.animate-float-slow {
    animation: float-slow 8s ease-in-out infinite;
}

.animate-float-slower {
    animation: float-slower 10s ease-in-out infinite;
}

.animate-spin-slow {
    animation: spin-slow 3s linear infinite;
}

/* Glass morphism effect */
.bg-white\/10 {
    background-color: rgba(255, 255, 255, 0.1);
}

.backdrop-blur-sm {
    backdrop-filter: blur(8px);
}

/* Enhanced transitions */
.transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
}

/* Custom utility classes using proper CSS */
.mt-15 {
    margin-top: 3.75rem;
}

.rounded-47 {
    border-radius: 2.9375rem;
}

/* Button styles inherited from main.css */
.btn-ghost {
    border: thin solid transparent;
    background-color: rgba(243, 244, 246, 1);
    color: rgba(55, 65, 81, 1);
    font-weight: 500;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    transition: all 0.3s ease-out;
    position: relative;
    overflow: hidden;
}

.btn-ghost:hover {
    background-color: rgba(229, 231, 235, 1);
    color: rgba(17, 24, 39, 1);
}

.hover-glow {
    transition: all 0.5s;
}

.hover-glow:hover {
    box-shadow: 0 0 50px rgba(2, 132, 199, 0.4), 0 30px 60px -15px rgba(2, 132, 199, 0.3);
    filter: brightness(1.1);
}

/* Fancy logo styling */
.logo-fancy {
    background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 50%, var(--primary) 100%);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    mix-blend-mode: difference;
    filter: drop-shadow(0 0 20px rgba(2, 132, 199, 0.6)) drop-shadow(0 0 40px rgba(2, 132, 199, 0.3));
    animation: logoGlow 3s ease-in-out infinite alternate, gradientShift 4s ease-in-out infinite;
}

@keyframes logoGlow {
    0% {
        filter: drop-shadow(0 0 20px rgba(2, 132, 199, 0.6)) drop-shadow(0 0 40px rgba(2, 132, 199, 0.3));
    }

    100% {
        filter: drop-shadow(0 0 30px rgba(2, 132, 199, 0.8)) drop-shadow(0 0 60px rgba(2, 132, 199, 0.5));
    }
}

@keyframes gradientShift {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}

/* Responsive breakpoint adjustments */
@media (max-width: 768px) {
    .mt-15 {
        margin-top: 1.25rem;
    }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {

    .animate-float,
    .animate-float-slow,
    .animate-float-slower,
    .animate-spin-slow {
        animation: none;
    }
}
</style>