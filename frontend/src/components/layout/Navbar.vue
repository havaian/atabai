<!-- frontend/src/components/layout/Navbar.vue -->

<template>
    <nav class="navbar">
        <div class="navbar-inner">
            <div class="navbar-row">

                <!-- Logo -->
                <RouterLink to="/" class="navbar-logo-link">
                    <LogoComponent />
                </RouterLink>

                <!-- Right side: auth button + hamburger -->
                <div class="navbar-actions">
                    <RouterLink v-if="!authStore.isAuthenticated" to="/login" class="navbar-auth-btn navbar-auth-btn--signin">
                        {{ $t('nav.signIn') }}
                    </RouterLink>
                    <RouterLink v-else to="/app/dashboard" class="navbar-auth-btn navbar-auth-btn--dashboard">
                        {{ $t('nav.dashboard') }}
                    </RouterLink>

                    <button class="navbar-burger" @click="menuOpen = !menuOpen" :aria-label="$t('nav.openMenu')">
                        <Bars3Icon class="w-5 h-5" />
                    </button>
                </div>

            </div>
        </div>
    </nav>

    <!-- Off-canvas sidebar (teleports to body, outside #app transform) -->
    <LandingMenuSidebar />
</template>

<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { Bars3Icon } from '@heroicons/vue/24/outline'
import LogoComponent from '@/components/Logo.vue'
import LandingMenuSidebar from '@/components/landing/LandingMenuSidebar.vue'
import { useLandingMenu } from '@/composables/useLandingMenu'
import { useAuthStore } from '@/stores/auth'
const authStore = useAuthStore()

const { menuOpen } = useLandingMenu()
const route = useRoute()

// Toggle #app class + body scroll lock when menu opens/closes
watch(menuOpen, (v) => {
    const app = document.getElementById('app')
    if (!app) return
    if (v) {
        app.classList.add('landing-menu-open')
        document.body.style.overflow = 'hidden'
    } else {
        app.classList.remove('landing-menu-open')
        document.body.style.overflow = ''
    }
})

// Close on route navigation
watch(route, () => {
    menuOpen.value = false
})

// Close on ESC
function onKeyDown(e) {
    if (e.key === 'Escape' && menuOpen.value) {
        menuOpen.value = false
    }
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
    const app = document.getElementById('app')
    if (app) app.classList.remove('landing-menu-open')
    document.body.style.overflow = ''
})
</script>

<style scoped>
.navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: var(--sb-bg);
    border-bottom: 1px solid var(--sb-border);
    transition: background 0.2s, border-color 0.2s;
}

.navbar-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
}

.navbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
}

.navbar-logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
    flex-shrink: 0;
}

.navbar-burger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--sb-icon-muted);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
}

.navbar-burger:hover {
    background: var(--sb-item-hover);
    color: var(--sb-icon-hover);
}
</style>

<!-- ─────────────────────────────────────────────────────────────
     Global styles for st-effect-11 "Scale & rotate pusher"
     #app is the pusher. LandingMenuSidebar teleports outside it.
     ───────────────────────────────────────────────────────────── -->
<style>
/* Body background behind the receded #app — pure CSS, reacts to theme instantly,
   no JS timing flash. data-theme is set on <html> before Vue even mounts. */
[data-theme="dark"] body,
html.dark body {
    background: #08060f;
}

[data-theme="light"] body {
    background: #ddd5ef;
}

/* Smooth transition always present so reverse animation works */
#app {
    transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1),
        border-radius 0.45s,
        box-shadow 0.45s;
    transform-origin: left center;
}

/* Pusher state — desktop only */
@media (min-width: 769px) {
    #app.landing-menu-open {
        transform: translateX(-220px) scale(0.88) rotate(-1.5deg);
        border-radius: 16px;
        overflow: hidden;
        /* Visible left edge so the separation is clear */
        box-shadow: -1px 0 0 0 rgba(149, 0, 255, 0.35),
            0 0 60px rgba(0, 0, 0, 0.6);
    }
}

/* Mobile — no push effect, sidebar just overlays */
@media (max-width: 768px) {
    #app.landing-menu-open {
        transform: none;
        border-radius: 0;
        overflow: visible;
    }
}

.navbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.navbar-auth-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
    line-height: 1;
}

.navbar-auth-btn--signin {
    background: #9500FF;
    color: #fff;
    border: 1px solid transparent;
}

.navbar-auth-btn--signin:hover {
    background: #7B00D4;
}

.navbar-auth-btn--dashboard {
    background: var(--sb-item-hover);
    color: var(--sb-text-hover);
    border: 1px solid var(--sb-border);
}

.navbar-auth-btn--dashboard:hover {
    background: var(--sb-item-active-bg);
    color: var(--sb-text-active);
}

/* Mobile — slightly smaller padding so the button doesn't crowd the burger */
@media (max-width: 480px) {
    .navbar-auth-btn {
        padding: 7px 14px;
        font-size: 12.5px;
    }
}
</style>