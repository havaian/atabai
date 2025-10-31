<template>
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-indigo-900 relative overflow-hidden">
        <!-- Subtle Background Elements -->
        <div class="absolute inset-0">
            <!-- Clean floating orbs -->
            <div class="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-xl animate-float-slow">
            </div>
            <div class="absolute top-3/4 right-1/4 w-48 h-48 bg-accent/8 rounded-full blur-2xl animate-float-slower">
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
                            <div
                                class="w-full h-full bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-2xl">
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

                    <p class="text-lg sm:text-xl text-white/80 max-w-md mx-auto">
                        {{ $t('comingSoon.description') }}
                    </p>
                </div>

                <!-- Features Preview -->
                <div class="mb-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-lg mx-auto">
                    <h3 class="text-lg font-semibold text-white mb-4">
                        {{ $t('comingSoon.featuresTitle') }}
                    </h3>
                    <ul class="space-y-3 text-left">
                        <li class="flex items-center text-white/90">
                            <CheckCircleIcon class="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                            {{ $t('comingSoon.feature1') }}
                        </li>
                        <li class="flex items-center text-white/90">
                            <CheckCircleIcon class="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                            {{ $t('comingSoon.feature2') }}
                        </li>
                        <li class="flex items-center text-white/90">
                            <CheckCircleIcon class="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                            {{ $t('comingSoon.feature3') }}
                        </li>
                        <li class="flex items-center text-white/90">
                            <CheckCircleIcon class="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
                            {{ $t('comingSoon.feature4') }}
                        </li>
                    </ul>
                </div>

                <!-- Clean actions -->
                <div class="space-y-4">
                    <!-- Contact buttons -->
                    <div class="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto mb-6">
                        <button @click="window.open('https://t.me/atabai_official', '_blank')"
                            class="bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg inline-flex items-center justify-center">
                            <TelegramIcon size="20" className="mr-2" />
                            {{ $t('comingSoon.telegram') }}
                        </button>

                        <button @click="window.open('mailto:contact@atabai.uz', '_blank')"
                            class="text-white/80 hover:text-white font-medium py-3 px-6 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center">
                            <MailIcon size="20" className="mr-2" />
                            {{ $t('comingSoon.email') }}
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
                <div class="mt-16 text-center">
                    <div
                        class="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 animate-float">
                        <div class="text-2xl font-bold text-white">A</div>
                    </div>
                    <div class="text-white/40 text-sm font-medium">
                        ATABAI
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { CogIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline'
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import MailIcon from '@/components/icons/MailIcon.vue'

const { t } = useI18n()

onMounted(() => {
    document.title = `${t('comingSoon.pageTitle')} | ATABAI`
})
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