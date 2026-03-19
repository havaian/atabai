<template>
    <div class="ws-layout">
        <!-- Sidebar -->
        <Sidebar :is-sidebar-open="isSidebarOpen" :is-large-screen="isLargeScreen" @toggle="toggleSidebar"
            @close="closeSidebar" />

        <!-- Main content -->
        <div class="ws-main">
            <!-- Mobile header -->
            <div class="ws-mobile-header">
                <button class="ws-mobile-menu-btn" @click="toggleSidebar">
                    <Bars3Icon class="h-5 w-5" />
                </button>
                <LogoComponent class="ws-mobile-logo" />
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
import Sidebar from '@/components/layout/Sidebar.vue'
import LogoComponent from '@/components/Logo.vue'
import { Bars3Icon } from '@heroicons/vue/24/outline'

const isLargeScreen = ref(window.innerWidth >= 1024)
const isSidebarOpen = ref(true)

const handleResize = () => { isLargeScreen.value = window.innerWidth >= 1024 }

onMounted(() => {
    const saved = localStorage.getItem('atabai-sidebar-open')
    if (saved !== null) isSidebarOpen.value = JSON.parse(saved)
    window.addEventListener('resize', handleResize)
})

onUnmounted(() => window.removeEventListener('resize', handleResize))

watch(isSidebarOpen, (v) => {
    localStorage.setItem('atabai-sidebar-open', JSON.stringify(v))
})

const toggleSidebar = () => { isSidebarOpen.value = !isSidebarOpen.value }
const closeSidebar = () => { isSidebarOpen.value = false }
</script>

<style scoped>
/* ── Dark workspace theme vars ── */
.ws-layout {
    --ws-bg: #0F0D18;
    --ws-surface: #171523;
    --ws-surface-2: #1D1A2A;
    --ws-border: rgba(149, 0, 255, 0.12);
    --ws-text: #F0ECF6;
    --ws-text-2: rgba(240, 236, 246, 0.55);
    --ws-text-3: rgba(240, 236, 246, 0.3);
    --ws-purple: #7C3AED;
    --ws-purple-lt: rgba(124, 58, 237, 0.15);

    display: flex;
    height: 100vh;
    background: var(--ws-bg);
    overflow: hidden;
    /* prevent page-level scroll */
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
    background: #0F0D18;
    border-bottom: 1px solid rgba(149, 0, 255, 0.1);
}

@media (max-width: 1023px) {
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

.ws-mobile-spacer {
    width: 32px;
}
</style>