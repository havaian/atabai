<template>
    <div id="app" class="min-h-screen bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <!-- Logo -->
                        <router-link to="/" class="flex-shrink-0 flex items-center">
                            <img class="h-8 w-auto" src="/images/logo.svg" alt="ATABAI" />
                            <span class="ml-2 text-xl font-bold text-primary">ATABAI</span>
                        </router-link>

                        <!-- Navigation Links -->
                        <div class="hidden md:ml-6 md:flex md:space-x-8">
                            <router-link to="/" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium"
                                :class="{ 'text-primary border-b-2 border-primary': $route.path === '/' }">
                                Главная
                            </router-link>
                            <router-link v-if="authStore.isAuthenticated" to="/dashboard"
                                class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium"
                                :class="{ 'text-primary border-b-2 border-primary': $route.path === '/dashboard' }">
                                Рабочий стол
                            </router-link>
                            <router-link v-if="authStore.isAuthenticated" to="/templates"
                                class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium"
                                :class="{ 'text-primary border-b-2 border-primary': $route.path === '/templates' }">
                                Шаблоны
                            </router-link>
                        </div>
                    </div>

                    <!-- User Menu -->
                    <div class="flex items-center space-x-4">
                        <div v-if="!authStore.isAuthenticated" class="flex items-center space-x-4">
                            <button @click="authStore.login"
                                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                                <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path
                                        d="M12 1c2.97 0 5.46.98 7.28 2.66l-3.57 2.77c-.98-.66-2.23-1.06-3.71-1.06-2.86 0-5.29 1.93-6.16 4.53H2.18V8.07C3.99 3.47 7.7 1 12 1z" />
                                </svg>
                                Войти через Google
                            </button>
                        </div>

                        <!-- User Dropdown -->
                        <div v-if="authStore.isAuthenticated" class="relative">
                            <Menu as="div" class="relative inline-block text-left">
                                <div>
                                    <MenuButton
                                        class="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                                        <img class="h-8 w-8 rounded-full"
                                            :src="authStore.user?.picture || '/images/default-avatar.png'"
                                            :alt="authStore.user?.name || 'User'" />
                                        <span class="hidden md:block text-gray-700">{{ authStore.user?.name }}</span>
                                        <ChevronDownIcon class="h-4 w-4 text-gray-400" />
                                    </MenuButton>
                                </div>
                                <transition enter-active-class="transition ease-out duration-100"
                                    enter-from-class="transform opacity-0 scale-95"
                                    enter-to-class="transform opacity-100 scale-100"
                                    leave-active-class="transition ease-in duration-75"
                                    leave-from-class="transform opacity-100 scale-100"
                                    leave-to-class="transform opacity-0 scale-95">
                                    <MenuItems
                                        class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                        <MenuItem v-slot="{ active }">
                                        <router-link to="/profile"
                                            :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">
                                            Профиль
                                        </router-link>
                                        </MenuItem>
                                        <MenuItem v-slot="{ active }">
                                        <router-link to="/history"
                                            :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">
                                            История файлов
                                        </router-link>
                                        </MenuItem>
                                        <MenuItem v-slot="{ active }">
                                        <button @click="authStore.logout"
                                            :class="[active ? 'bg-gray-100' : '', 'block w-full text-left px-4 py-2 text-sm text-gray-700']">
                                            Выйти
                                        </button>
                                        </MenuItem>
                                    </MenuItems>
                                </transition>
                            </Menu>
                        </div>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="flex-1">
            <router-view />
        </main>

        <!-- Toast Notifications -->
        <div id="toast-container"></div>

        <!-- Loading Overlay -->
        <div v-if="uiStore.isLoading"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg p-6 flex items-center space-x-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span class="text-gray-700">{{ uiStore.loadingMessage || 'Загрузка...' }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import { ChevronDownIcon } from '@heroicons/vue/24/outline'

// Stores
import { useAuthStore } from './stores/auth'
import { useUIStore } from './stores/ui'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUIStore()

// Initialize application
onMounted(async () => {
    try {
        // Check if user is already authenticated
        await authStore.checkAuth()

        // Initialize other services
        await uiStore.initialize()
    } catch (error) {
        console.error('Failed to initialize app:', error)
    }
})

// Handle route changes
router.beforeEach(async (to, from, next) => {
    // Check authentication for protected routes
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next('/')
    } else {
        next()
    }
})
</script>

<style>
/* Custom CSS Variables */
:root {
    --primary: #765fc6;
    --primary-light: #8b7ed8;
    --primary-dark: #5d4a9e;
    --secondary: #10B981;
    --danger: #EF4444;
    --warning: #F59E0B;
    --success: #10B981;
    --gray-50: #F9FAFB;
    --gray-100: #F3F4F6;
    --gray-500: #6B7280;
    --gray-900: #111827;
    --accent: #9333ea;
}

/* Apply custom colors */
.text-primary {
    color: var(--primary);
}

.bg-primary {
    background-color: var(--primary);
}

.bg-primary-dark {
    background-color: var(--primary-dark);
}

.border-primary {
    border-color: var(--primary);
}

.ring-primary {
    --tw-ring-color: var(--primary);
}

.focus\:ring-primary:focus {
    --tw-ring-color: var(--primary);
}

.hover\:bg-primary-dark:hover {
    background-color: var(--primary-dark);
}

.hover\:text-primary:hover {
    color: var(--primary);
}

/* Custom scrollbar */
::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-track {
    background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
    background: var(--primary);
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--primary-dark);
}

/* Smooth transitions */
* {
    transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}

/* Typography */
body {
    font-family: 'Montserrat', 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
}
</style>