<template>
    <footer class="site-footer">
        <router-link to="/" class="footer-logo">
            <LogoComponent size="medium" />
        </router-link>

        <div class="footer-links">
            <button class="footer-icon-btn" @click="openLink('https://t.me/atabai_official')" title="Telegram">
                <TelegramIcon size="20" />
            </button>
            <button class="footer-icon-btn" @click="openLink('mailto:contact@atabai.uz')" title="Email">
                <MailIcon size="20" />
            </button>
            <button class="footer-icon-btn" @click="openLink('https://instagram.com/atabai.official')"
                title="Instagram">
                <InstagramIcon size="20" />
            </button>
        </div>
    </footer>
</template>

<script setup>
import LogoComponent from '@/components/Logo.vue'
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import MailIcon from '@/components/icons/MailIcon.vue'
import InstagramIcon from '@/components/icons/InstagramIcon.vue'

function openLink(url) {
    window.open(url, '_blank')
}
</script>

<style scoped>
.site-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    max-width: 960px;
    margin: 0 auto;
    padding: 32px 24px 48px;
    border-top: 1px solid var(--landing-border);
}

@media (min-width: 768px) {
    .site-footer {
        flex-direction: row;
        justify-content: space-between;
    }
}

.footer-logo {
    display: flex;
    align-items: center;
    text-decoration: none;
}

.footer-links {
    display: flex;
    align-items: center;
    gap: 8px;
}

.footer-icon-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--landing-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.footer-icon-btn:hover {
    background: var(--landing-border-accent);
    color: var(--landing-text);
}
</style>