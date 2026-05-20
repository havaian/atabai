<!-- frontend/src/layouts/UserLayout.vue -->
<template>
    <div class="ws-layout">
        <!-- Sidebar -->
        <Sidebar
            :is-sidebar-open="isSidebarOpen"
            :is-mobile-menu-open="isMobileDrawerOpen"
            :is-large-screen="isLargeScreen"
            @toggle="toggleSidebar"
            @close="closeMobileDrawer"
        />

        <!-- Main content -->
        <div class="ws-main">
            <!-- Mobile header -->
            <div class="ws-mobile-header">
                <button class="ws-mobile-menu-btn" @click="openMobileDrawer" :aria-label="$t('nav.openMenu')">
                    <Bars3Icon class="h-5 w-5" />
                </button>
                <router-link to="/app/dashboard" class="ws-mobile-logo-link">
                    <LogoComponent class="ws-mobile-logo" />
                </router-link>
                <div class="ws-mobile-spacer"></div>
            </div>

            <!-- Page content — overflow only when needed -->
            <div class="ws-content">
                <router-view />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from '@/components/layout/Sidebar.vue'
import LogoComponent from '@/components/Logo.vue'
import { Bars3Icon } from '@heroicons/vue/24/outline'

// Single source of truth for "what is mobile". Matches Sidebar.vue's internal
// breakpoint (must stay in sync — DRY violation but Sidebar is too big to refactor here).
const MOBILE_BREAKPOINT = 768

const isLargeScreen = ref(window.innerWidth >= MOBILE_BREAKPOINT)

// Desktop: controls sidebar collapsed/expanded state.
// Mobile: ignored — mobile uses isMobileDrawerOpen instead.
const isSidebarOpen = ref(true)

// Mobile-only: controls drawer open/closed.
// Always false on desktop (drawer simply isn't rendered there).
const isMobileDrawerOpen = ref(false)

const route = useRoute()

const handleResize = () => {
    const wasLarge = isLargeScreen.value
    isLargeScreen.value = window.innerWidth >= MOBILE_BREAKPOINT
    // Auto-close mobile drawer when resizing up to desktop
    if (!wasLarge && isLargeScreen.value) {
        isMobileDrawerOpen.value = false
    }
}

onMounted(() => {
    const saved = localStorage.getItem('atabai-sidebar-open')
    if (saved !== null) isSidebarOpen.value = JSON.parse(saved)
    window.addEventListener('resize', handleResize)
})

onUnmounted(() => window.removeEventListener('resize', handleResize))

// Persist desktop sidebar state only (mobile drawer state is ephemeral)
watch(isSidebarOpen, (v) => {
    localStorage.setItem('atabai-sidebar-open', JSON.stringify(v))
})

// Auto-close mobile drawer on route change (so navigation feels right)
watch(() => route.fullPath, () => {
    if (!isLargeScreen.value) isMobileDrawerOpen.value = false
})

// Lock body scroll while mobile drawer is open
watch(isMobileDrawerOpen, (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
})

const toggleSidebar = () => {
    if (isLargeScreen.value) {
        isSidebarOpen.value = !isSidebarOpen.value
    } else {
        isMobileDrawerOpen.value = !isMobileDrawerOpen.value
    }
}
const openMobileDrawer = () => { isMobileDrawerOpen.value = true }
const closeMobileDrawer = () => { isMobileDrawerOpen.value = false }
</script>

<style scoped>
.ws-layout {
    display: flex;
    height: 100vh;
    /* Use dynamic viewport height on supporting browsers (iOS Safari) so
       address bar shrinking doesn't cut off bottom of pages. Fallback to 100vh. */
    height: 100dvh;
    background: var(--ws-bg);
    overflow: hidden;
}

.ws-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
}

/* Content scrolls only if taller than viewport */
.ws-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    /* iOS momentum scrolling */
    -webkit-overflow-scrolling: touch;
}

.ws-content::-webkit-scrollbar {
    width: 5px;
}

.ws-content::-webkit-scrollbar-track {
    background: transparent;
}

.ws-content::-webkit-scrollbar-thumb {
    background: rgba(149, 0, 255, 0.2);
    border-radius: 3px;
}

.ws-content::-webkit-scrollbar-thumb:hover {
    background: rgba(149, 0, 255, 0.35);
}

/* Mobile header */
.ws-mobile-header {
    display: none;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--ws-bg);
    border-bottom: 1px solid rgba(149, 0, 255, 0.1);
}

/* Breakpoint changed from 1023 → 767 per spec (mobile = <768px) */
@media (max-width: 767px) {
    .ws-mobile-header {
        display: flex;
    }
}

.ws-mobile-menu-btn {
    background: transparent;
    border: none;
    color: rgba(240, 236, 246, 0.6);
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
}

.ws-mobile-logo {
    height: 28px;
    width: 100px;
}

/* Click target wrapping the logo in the mobile top bar — navigates to
   /app/dashboard. Kept as inline-flex so the existing height/width on
   .ws-mobile-logo continues to work. */
.ws-mobile-logo-link {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    color: inherit;
}

.ws-mobile-spacer {
    width: 32px;
}
</style>