<!-- frontend/src/components/layout/Navbar.vue -->

<template>
    <nav class="navbar">
        <div class="navbar-inner">
            <div class="navbar-row">

                <!-- Logo -->
                <RouterLink to="/" class="navbar-logo-link">
                    <LogoComponent />
                </RouterLink>

                <!-- Hamburger — all screen sizes -->
                <button class="navbar-burger" @click="menuOpen = !menuOpen" :aria-label="$t('nav.openMenu')">
                    <Bars3Icon class="w-5 h-5" />
                </button>

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
    // Cleanup in case component unmounts while menu is open
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
/* Smooth transition always present so reverse animation works */
#app {
    transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.45s;
}

/* Pusher state — desktop */
#app.landing-menu-open {
    transform: perspective(1400px) translateX(-200px) scale(0.88) rotateY(-4deg);
    border-radius: 16px;
    overflow: hidden;
}

/* Pusher state — mobile */
@media (max-width: 768px) {
    #app.landing-menu-open {
        transform: perspective(800px) translateX(-240px) scale(0.86);
        border-radius: 12px;
    }
}
</style>