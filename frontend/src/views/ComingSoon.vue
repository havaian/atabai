<template>
    <div class="min-h-screen bg-gradient-atabai relative overflow-hidden">
        <!-- Grid Pattern Background -->
        <div class="absolute inset-0 bg-grid-pattern opacity-10"></div>

        <!-- Coming Soon Content -->
        <div class="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative z-10">
            <div class="sm:mx-auto sm:w-full sm:max-w-lg">
                <div
                    class="bg-white/90 backdrop-blur-sm py-12 px-8 shadow-2xl sm:rounded-3xl sm:px-12 border border-white/30">

                    <!-- Logo/Brand -->
                    <div class="text-center mb-8">
                        <div class="text-4xl font-bold text-primary mb-4">ATABAI</div>
                        <div class="w-16 h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
                    </div>

                    <!-- Main Content -->
                    <div class="text-center space-y-6">
                        <!-- Icon -->
                        <div class="flex justify-center">
                            <div
                                class="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                                <CogIcon class="w-10 h-10 text-white animate-spin-slow" />
                            </div>
                        </div>

                        <!-- Title -->
                        <h1 class="text-3xl font-bold text-gray-900 mb-4">
                            {{ $t('comingSoon.title') }}
                        </h1>

                        <!-- Description -->
                        <p class="text-lg text-gray-600 leading-relaxed">
                            {{ $t('comingSoon.description') }}
                        </p>

                        <!-- Features Preview -->
                        <div class="bg-gray-50 rounded-2xl p-6 mt-8 text-left">
                            <h3 class="text-lg font-semibold text-gray-900 mb-4 text-center">
                                {{ $t('comingSoon.featuresTitle') }}
                            </h3>
                            <ul class="space-y-3">
                                <li class="flex items-center text-gray-700">
                                    <CheckCircleIcon class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                                    {{ $t('comingSoon.feature1') }}
                                </li>
                                <li class="flex items-center text-gray-700">
                                    <CheckCircleIcon class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                                    {{ $t('comingSoon.feature2') }}
                                </li>
                                <li class="flex items-center text-gray-700">
                                    <CheckCircleIcon class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                                    {{ $t('comingSoon.feature3') }}
                                </li>
                                <li class="flex items-center text-gray-700">
                                    <CheckCircleIcon class="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                                    {{ $t('comingSoon.feature4') }}
                                </li>
                            </ul>
                        </div>

                        <!-- Contact Info -->
                        <div class="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-6 mt-6">
                            <h3 class="text-lg font-semibold text-gray-900 mb-3">
                                {{ $t('comingSoon.contactTitle') }}
                            </h3>
                            <p class="text-gray-600 mb-4">
                                {{ $t('comingSoon.contactDescription') }}
                            </p>

                            <!-- Contact Buttons -->
                            <div class="flex flex-col sm:flex-row gap-3 justify-center">
                                <button @click="window.open('https://t.me/atabai_official', '_blank')"
                                    class="btn-secondary inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium transition-all duration-200">
                                    <TelegramIcon size="20" className="mr-2" />
                                    {{ $t('comingSoon.telegram') }}
                                </button>

                                <button @click="window.open('mailto:contact@atabai.uz', '_blank')"
                                    class="btn-ghost inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium transition-all duration-200">
                                    <MailIcon size="20" className="mr-2" />
                                    {{ $t('comingSoon.email') }}
                                </button>
                            </div>
                        </div>

                        <!-- Back to Home -->
                        <div class="pt-6">
                            <router-link to="/"
                                class="btn-primary inline-flex items-center px-8 py-3 rounded-xl font-medium transition-all duration-200 hover:shadow-lg">
                                <ArrowLeftIcon class="w-5 h-5 mr-2" />
                                {{ $t('comingSoon.backToHome') }}
                            </router-link>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Background decoration -->
        <div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div class="absolute -top-40 -right-32 w-80 h-80 bg-primary/20 rounded-full blur-3xl"></div>
            <div class="absolute -bottom-40 -left-32 w-80 h-80 bg-accent/20 rounded-full blur-3xl"></div>
            <div
                class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/10 rounded-full blur-3xl">
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
        linear-gradient(rgba(117, 95, 198, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(117, 95, 198, 0.05) 1px, transparent 1px);
    background-size: 40px 40px;
}

/* ATABAI Gradient background */
.bg-gradient-atabai {
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 25%, #f0f4ff 50%, #faf5ff 75%, #f9fafb 100%);
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

.animate-spin-slow {
    animation: spin-slow 3s linear infinite;
}

/* Glass morphism effect */
.bg-white\/90 {
    background-color: rgba(255, 255, 255, 0.9);
}

.backdrop-blur-sm {
    backdrop-filter: blur(8px);
}

/* Blur effects for background decoration */
.blur-3xl {
    filter: blur(64px);
}

/* Z-index management */
.-z-10 {
    z-index: -10;
}

/* Enhanced transitions */
.transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
}

/* Responsive adjustments */
@media (max-width: 640px) {
    .sm\:rounded-3xl {
        border-radius: 1.5rem;
    }

    .sm\:px-12 {
        padding-left: 2rem;
        padding-right: 2rem;
    }
}
</style>