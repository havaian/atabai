<template>
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <!-- Logo -->
                    <router-link to="/" class="flex-shrink-0 flex items-center justify-center h-full">
                        <LogoComponent size="large" :clickable="true" @click="$router.push('/')" />
                    </router-link>

                    <!-- Navigation Links -->
                    <div class="hidden md:ml-12 md:flex md:space-x-8">
                        <a href="#how-it-works" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium">
                            {{ $t('nav.howItWorks') }}
                        </a>
                        <a href="#features" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium">
                            {{ $t('nav.features') }}
                        </a>
                        <!-- <a href="#pricing" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium">
                            {{ $t('nav.pricing') }}
                        </a> -->
                    </div>
                </div>

                <!-- Desktop User Menu -->
                <div class="hidden md:flex items-center space-x-4">
                    <!-- Language Selector -->
                    <div class="relative group">
                        <div
                            class="flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-md hover:bg-gray-200 cursor-pointer transition-colors duration-200">
                            <GlobeAltIcon class="w-4 h-4" />
                            <span class="text-sm font-medium">{{ currentLocale.code.toUpperCase() }}</span>
                            <ChevronDownIcon class="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
                        </div>
                        <!-- Dropdown Menu -->
                        <div
                            class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out transform translate-y-1 group-hover:translate-y-0">
                            <button v-for="locale in availableLocales" :key="locale.code"
                                @click="changeLanguage(locale.code)"
                                class="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150">
                                <span class="mr-2">{{ locale.flag }}</span>
                                {{ locale.name }}
                            </button>
                        </div>
                    </div>

                    <!-- Auth Buttons -->
                    <div v-if="!authStore.isAuthenticated" class="flex items-center space-x-4">
                        <button @click="authStore.login"
                            class="btn-auth hover-glow inline-flex items-center">
                            <GoogleIcon size="16" className="mr-2" />
                            {{ $t('auth.signInWithGoogle') }}
                        </button>
                    </div>

                    <!-- User Dropdown -->
                    <div v-if="authStore.isAuthenticated" class="relative group">
                        <Menu as="div" class="relative inline-block text-left">
                            <MenuButton
                                class="flex items-center space-x-3 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary btn-auth hover-glow">
                                <img class="h-8 w-8 rounded-full"
                                    :src="authStore.user?.picture || '/images/default-avatar.png'"
                                    :alt="authStore.user?.name || 'User'" />
                                <span class="hidden lg:block text-gray-700">{{ authStore.user?.name }}</span>
                            </MenuButton>
                            <MenuItems
                                class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <MenuItem v-slot="{ active }">
                                <router-link to="/dashboard"
                                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">
                                    {{ $t('nav.dashboard') }}
                                </router-link>
                                </MenuItem>
                                <MenuItem v-slot="{ active }">
                                <router-link to="/profile"
                                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">
                                    {{ $t('nav.profile') }}
                                </router-link>
                                </MenuItem>
                                <MenuItem v-slot="{ active }">
                                <button @click="authStore.logout"
                                    :class="[active ? 'bg-gray-100' : '', 'block w-full text-left px-4 py-2 text-sm text-gray-700']">
                                    {{ $t('nav.logout') }}
                                </button>
                                </MenuItem>
                            </MenuItems>
                        </Menu>
                    </div>
                </div>

                <!-- Mobile menu button -->
                <div class="flex md:hidden">
                    <button @click="mobileMenuOpen = !mobileMenuOpen"
                        class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary">
                        <Bars3Icon v-if="!mobileMenuOpen" class="block h-6 w-6" />
                        <XMarkIcon v-else class="block h-6 w-6" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Mobile menu -->
        <div v-show="mobileMenuOpen" class="md:hidden border-t border-gray-200">
            <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white">
                <!-- Navigation Links -->
                <a href="#features" @click="mobileMenuOpen = false"
                    class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                    {{ $t('nav.features') }}
                </a>
                <a href="#how-it-works" @click="mobileMenuOpen = false"
                    class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                    {{ $t('nav.howItWorks') }}
                </a>
                <!-- <a href="#pricing" @click="mobileMenuOpen = false"
                    class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                    {{ $t('nav.pricing') }}
                </a> -->

                <!-- Language Selector for Mobile -->
                <div class="px-3 py-2">
                    <div class="text-sm font-medium text-gray-500 mb-2">{{ $t('nav.language') }}</div>
                    <div class="grid grid-cols-2 gap-2">
                        <button v-for="locale in availableLocales" :key="locale.code"
                            @click="changeLanguage(locale.code)" :class="[
                                'flex items-center px-3 py-2 text-sm rounded-md transition-colors duration-150',
                                locale.code === currentLocale.code
                                    ? 'bg-primary text-white'
                                    : 'text-gray-700 hover:bg-gray-100'
                            ]">
                            <span class="mr-2">{{ locale.flag }}</span>
                            {{ locale.name }}
                        </button>
                    </div>
                </div>

                <!-- Mobile Auth Section -->
                <div class="border-t border-gray-200 pt-3">
                    <!-- Not Authenticated -->
                    <div v-if="!authStore.isAuthenticated" class="px-3 py-2">
                        <button @click="goToComingSoon() || authStore.login; mobileMenuOpen = false"
                            class="w-full btn-auth hover-glow inline-flex items-center justify-center">
                            <GoogleIcon size="16" className="mr-2" />
                            {{ $t('auth.signInWithGoogle') }}
                        </button>
                    </div>

                    <!-- Authenticated User Menu -->
                    <div v-if="authStore.isAuthenticated" class="px-3 py-2">
                        <!-- User Info -->
                        <div class="flex items-center space-x-3 px-3 py-2 mb-2">
                            <img class="h-8 w-8"
                                :src="authStore.user?.picture || '/images/default-avatar.png'"
                                :alt="authStore.user?.name || 'User'" />
                            <span class="text-gray-700 font-medium">{{ authStore.user?.name }}</span>
                        </div>

                        <!-- User Menu Items -->
                        <router-link to="/dashboard" @click="mobileMenuOpen = false"
                            class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md">
                            {{ $t('nav.dashboard') }}
                        </router-link>
                        <router-link to="/profile" @click="mobileMenuOpen = false"
                            class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md">
                            {{ $t('nav.profile') }}
                        </router-link>
                        <button @click="authStore.logout; mobileMenuOpen = false"
                            class="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md">
                            {{ $t('nav.logout') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </nav>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import LogoComponent from '@/components/Logo.vue'
import GoogleIcon from '@/components/icons/GoogleIcon.vue'
import {
    ChevronDownIcon,
    Bars3Icon,
    XMarkIcon,
    GlobeAltIcon
} from '@heroicons/vue/24/outline'

// Composables
import { useAuthStore } from '@/stores/auth'
import { availableLocales, changeLocale } from '@/utils/i18n'

const router = useRouter()
const { locale } = useI18n()
const authStore = useAuthStore()

// State
const mobileMenuOpen = ref(false)

// Computed
const currentLocale = computed(() => {
    return availableLocales.find(l => l.code === locale.value) || availableLocales[0]
})

// Methods
async function changeLanguage(newLocale) {
    await changeLocale(newLocale)
}

function goToComingSoon() {
    router.push('/coming-soon')
}
</script>