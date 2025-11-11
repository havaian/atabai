<template>
    <div class="h-screen bg-gray-50 flex">
        <!-- Sidebar Component -->
        <Sidebar :is-sidebar-open="isSidebarOpen" :is-large-screen="isLargeScreen" @toggle="toggleSidebar"
            @close="closeSidebar" />

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col">
            <!-- Mobile Header -->
            <div class="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
                <button @click="toggleSidebar" class="p-2 rounded-lg hover:bg-gray-100">
                    <Bars3Icon class="h-5 w-5 text-gray-600" />
                </button>
                <div class="flex items-center space-x-2">
                    <div
                        class="w-6 h-6 bg-gradient-to-br from-accent to-atabai-violet rounded-md flex items-center justify-center">
                        <span class="text-white font-bold text-xs">A</span>
                    </div>
                    <span class="font-semibold text-gray-900">ATABAI</span>
                </div>
                <div class="w-9"></div> <!-- Spacer for centering -->
            </div>

            <!-- Page Content -->
            <div class="flex-1 overflow-auto">
                <router-view />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import { Bars3Icon } from '@heroicons/vue/24/outline'

// Responsive state
const isLargeScreen = ref(window.innerWidth >= 1024)
const isSidebarOpen = ref(false)

// Handle window resize
const handleResize = () => {
    const newIsLargeScreen = window.innerWidth >= 1024
    if (newIsLargeScreen !== isLargeScreen.value) {
        isLargeScreen.value = newIsLargeScreen
        if (newIsLargeScreen) {
            isSidebarOpen.value = false // Auto-close sidebar on large screens
        }
    }
}

onMounted(() => {
    window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
})

// Methods
const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value
}

const closeSidebar = () => {
    isSidebarOpen.value = false
}
</script>

<style scoped>
/* Custom scrollbar */
.overflow-auto::-webkit-scrollbar {
    width: 6px;
}

.overflow-auto::-webkit-scrollbar-track {
    background: transparent;
}

.overflow-auto::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}
</style>