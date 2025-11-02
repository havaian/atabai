<template>
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <!-- Logo -->
                    <router-link to="/" class="flex-shrink-0 flex items-center logo-hover-group">
                        <div class="navbar-logo-svg mr-3"></div>
                        <div class="text-2xl font-bold text-primary navbar-logo-text">ATABAI</div>
                    </router-link>

                    <!-- Navigation Links -->
                    <div class="hidden md:ml-12 md:flex md:space-x-8">
                        <a href="#features" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium">
                            {{ $t('nav.features') }}
                        </a>
                        <a href="#how-it-works" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium">
                            {{ $t('nav.howItWorks') }}
                        </a>
                        <!-- <a href="#pricing" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium">
                            {{ $t('nav.pricing') }}
                        </a> -->
                    </div>
                </div>

                <!-- User Menu -->
                <div class="flex items-center space-x-4">
                    <!-- Language Selector -->
                    <div class="relative group">
                        <div
                            class="flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-full hover:bg-gray-200 cursor-pointer transition-colors duration-200">
                            <GlobeAltIcon class="w-4 h-4" />
                            <span class="text-sm font-medium">{{ currentLocale.code.toUpperCase() }}</span>
                            <ChevronDownIcon class="w-4 h-4 transition-transform duration-200 group-hover:rotate-180" />
                        </div>
                        <!-- Dropdown Menu -->
                        <div
                            class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out transform translate-y-1 group-hover:translate-y-0">
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
                        <button @click="true ? goToComingSoon() : authStore.login"
                            class="btn-auth hover-glow inline-flex items-center">
                            <GoogleIcon size="16" className="mr-2" />
                            {{ $t('auth.signInWithGoogle') }}
                        </button>
                    </div>

                    <!-- User Dropdown -->
                    <div v-if="authStore.isAuthenticated" class="relative">
                        <Menu as="div" class="relative inline-block text-left">
                            <MenuButton
                                class="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                                <img class="h-8 w-8 rounded-full"
                                    :src="authStore.user?.picture || '/images/default-avatar.png'"
                                    :alt="authStore.user?.name || 'User'" />
                                <span class="hidden md:block text-gray-700">{{ authStore.user?.name }}</span>
                                <ChevronDownIcon class="h-4 w-4 text-gray-400" />
                            </MenuButton>
                            <MenuItems
                                class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
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

                    <!-- Mobile menu button -->
                    <div class="md:hidden">
                        <button @click="mobileMenuOpen = !mobileMenuOpen"
                            class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary">
                            <Bars3Icon v-if="!mobileMenuOpen" class="block h-6 w-6" />
                            <XMarkIcon v-else class="block h-6 w-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Mobile menu -->
        <div v-show="mobileMenuOpen" class="md:hidden border-t border-gray-200">
            <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white">
                <a href="#features"
                    class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                    {{ $t('nav.features') }}
                </a>
                <a href="#how-it-works"
                    class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                    {{ $t('nav.howItWorks') }}
                </a>
                <!-- <a href="#pricing"
                    class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
                    {{ $t('nav.pricing') }}
                </a> -->
            </div>
        </div>
    </nav>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
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

<style scoped>
/* LOGO SVG - BASE STATE */
.navbar-logo-svg {
    width: 2rem;
    height: 2rem;
    background-color: #65399a;
    -webkit-mask: url('/images/icons/logo.svg') no-repeat center;
    mask: url('/images/icons/logo.svg') no-repeat center;
    -webkit-mask-size: contain;
    mask-size: contain;
    transition: all 0.3s ease;
}

/* LOGO TEXT - BASE STATE */
.navbar-logo-text {
    color: #65399a;
    transition: all 0.3s ease;
}

/* HOVER EFFECTS */
.logo-hover-group:hover .navbar-logo-svg {
    background: linear-gradient(135deg, #65399a 0%, #9333ea 50%, #65399a 100%);
    background-size: 200% 200%;
    filter: drop-shadow(0 0 20px rgba(101, 57, 154, 0.6)) drop-shadow(0 0 40px rgba(101, 57, 154, 0.3));
    animation: logoGlow 3s ease-in-out infinite alternate, gradientShift 4s ease-in-out infinite;
}

.logo-hover-group:hover .navbar-logo-text {
    background: linear-gradient(135deg, #65399a 0%, #9333ea 50%, #65399a 100%);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    filter: drop-shadow(0 0 20px rgba(101, 57, 154, 0.6)) drop-shadow(0 0 40px rgba(101, 57, 154, 0.3));
    animation: logoGlow 3s ease-in-out infinite alternate, gradientShift 4s ease-in-out infinite;
}

/* ANIMATIONS */
@keyframes logoGlow {
    0% {
        filter: drop-shadow(0 0 20px rgba(101, 57, 154, 0.6)) drop-shadow(0 0 40px rgba(101, 57, 154, 0.3));
    }

    100% {
        filter: drop-shadow(0 0 30px rgba(101, 57, 154, 0.8)) drop-shadow(0 0 60px rgba(101, 57, 154, 0.5));
    }
}

@keyframes gradientShift {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}

/* ACCESSIBILITY */
@media (prefers-reduced-motion: reduce) {

    .logo-hover-group:hover .navbar-logo-svg,
    .logo-hover-group:hover .navbar-logo-text {
        animation: none;
    }
}
</style>