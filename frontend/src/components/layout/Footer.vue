<template>
    <!-- Footer -->
    <footer
        class="flex w-full max-w-4xl flex-col md:flex-row items-center gap-6 md:gap-10 justify-between mt-15 py-4 px-8 mb-8 rounded-47 md:mt-5 mx-auto">
        <div class="order-1 md:order-none">
            <div class="flex items-center">
                <img src="/images/icons/logo.svg" alt="ATABAI" class="h-6 w-6 mr-2" />
                <div class="text-2xl font-bold text-primary">ATABAI</div>
            </div>
        </div>
        <div class="flex items-center gap-3 order-2 md:order-none">
            <!-- Telegram Button -->
            <button @click="window.open('https://t.me/atabai_official', '_blank')"
                class="btn-ghost hover-glow p-3 rounded-full" title="Telegram">
                <TelegramIcon size="20" />
            </button>

            <!-- Mail Button -->
            <button @click="window.open('mailto:contact@atabai.uz', '_blank')"
                class="btn-ghost hover-glow p-3 rounded-full" title="Email">
                <MailIcon size="20" />
            </button>

            <!-- Instagram Button -->
            <button @click="window.open('https://instagram.com/atabai.official', '_blank')"
                class="btn-ghost hover-glow p-3 rounded-full" title="Instagram">
                <InstagramIcon size="20" />
            </button>
        </div>
    </footer>
</template>

<script setup>
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import MailIcon from '@/components/icons/MailIcon.vue'
import InstagramIcon from '@/components/icons/InstagramIcon.vue'
</script>

<style scoped>
/* Custom utility classes using proper CSS */
.rounded-47 {
    border-radius: 2.9375rem;
}

.mt-15 {
    margin-top: 3.75rem;
}

/* Responsive breakpoint adjustments */
@media (max-width: 768px) {
    .mt-15 {
        margin-top: 2.5rem;
    }
}
</style>