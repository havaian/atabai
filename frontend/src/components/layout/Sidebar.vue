<template>
    <!-- Sidebar -->
    <div :class="[
        'fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col',
        'lg:relative lg:translate-x-0',
        isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full lg:w-16'
    ]">
        <!-- Sidebar Header -->
        <div class="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <!-- Logo and Brand -->
            <div v-show="isSidebarOpen || !isLargeScreen" class="flex items-center space-x-2">
                <LogoComponent size="large" :clickable="true" @click="$router.push('/')" />
            </div>

            <!-- Always show toggle button, but position differently when collapsed -->
            <button @click="$emit('toggle')" class="rounded-lg hover:bg-gray-100 transition-colors" :class="[
                isSidebarOpen || !isLargeScreen ? '' : 'w-full flex justify-center'
            ]">
                <ArrowRightStartOnRectangleIcon v-if="!isSidebarOpen" class="h-5 w-5 text-gray-600" />
                <ArrowLeftStartOnRectangleIcon v-else class="h-5 w-5 text-gray-600" />
            </button>
        </div>

        <!-- Sidebar Content - Scrollable Middle Section -->
        <div class="flex-1 flex flex-col min-h-0">
            <!-- Action Buttons -->
            <div class="p-4 flex-shrink-0 space-y-3">
                <!-- New Project Button -->
                <button @click="startNewProject"
                    class="w-full flex items-center justify-center text-sm font-medium text-white bg-accent rounded-lg hover:bg-atabai-violet transition-all duration-200"
                    :class="{ 'px-2 py-2': !isSidebarOpen && isLargeScreen, 'px-3 py-2': isSidebarOpen || !isLargeScreen }">
                    <PlusIcon class="h-4 w-4" :class="{ 'mr-2': isSidebarOpen || !isLargeScreen }" />
                    <span v-show="isSidebarOpen || !isLargeScreen">{{ $t('dashboard.newProject') }}</span>
                </button>

                <!-- Templates Button -->
                <button @click="navigateTo('/templates')"
                    class="w-full flex items-center justify-center text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                    :class="{ 'px-2 py-2': !isSidebarOpen && isLargeScreen, 'px-3 py-2': isSidebarOpen || !isLargeScreen }">
                    <DocumentTextIcon class="h-4 w-4" :class="{ 'mr-2': isSidebarOpen || !isLargeScreen }" />
                    <span v-show="isSidebarOpen || !isLargeScreen">{{ $t('nav.templates') }}</span>
                </button>

                <!-- History Button -->
                <button @click="navigateTo('/history')"
                    class="w-full flex items-center justify-center text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                    :class="{ 'px-2 py-2': !isSidebarOpen && isLargeScreen, 'px-3 py-2': isSidebarOpen || !isLargeScreen }">
                    <ArchiveBoxIcon class="h-4 w-4" :class="{ 'mr-2': isSidebarOpen || !isLargeScreen }" />
                    <span v-show="isSidebarOpen || !isLargeScreen">{{ $t('nav.history') }}</span>
                </button>
            </div>

            <!-- Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto">
                <!-- File History -->
                <div v-show="isSidebarOpen || !isLargeScreen" class="px-4 pb-4">
                    <div class="mb-4">
                        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            {{ $t('dashboard.recentFiles') }}
                        </h3>

                        <!-- Empty State -->
                        <div v-if="recentFiles.length === 0" class="text-center py-6">
                            <div class="text-gray-400 mb-2">
                                <DocumentIcon class="h-8 w-8 mx-auto" />
                            </div>
                            <p class="text-sm text-gray-500">{{ $t('dashboard.emptyState') }}</p>
                        </div>

                        <!-- File List -->
                        <div v-else class="space-y-1">
                            <div v-for="file in recentFiles" :key="file.id" @click="openFile(file)"
                                class="flex items-center p-2 rounded-lg hover:bg-gray-100 cursor-pointer group">
                                <DocumentIcon class="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium text-gray-900 truncate">{{ file.name }}</p>
                                    <p class="text-xs text-gray-500">{{ formatDate(file.createdAt) }}</p>
                                </div>
                                <ChevronRightIcon
                                    class="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Profile Menu -->
        <div class="border-t border-gray-200 flex-shrink-0">
            <div class="relative" ref="profileMenuRef">
                <button @click="toggleProfileMenu"
                    class="w-full flex items-center p-4 rounded-lg hover:bg-gray-100 transition-colors"
                    :class="{ 'justify-center': !isSidebarOpen && isLargeScreen }">
                    <img :src="authStore.user?.picture || '/images/default-avatar.png'"
                        :alt="authStore.user?.name || 'User'" class="h-8 w-8 rounded-full flex-shrink-0" />
                    <div v-show="isSidebarOpen || !isLargeScreen" class="ml-3 flex-1 text-left">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ authStore.user?.name }}</p>
                        <p class="text-xs text-gray-500 truncate">{{ authStore.user?.email }}</p>
                    </div>
                    <ChevronUpIcon v-show="isSidebarOpen || !isLargeScreen"
                        class="h-4 w-4 text-gray-400 ml-2 transition-transform"
                        :class="{ 'rotate-180': isProfileMenuOpen }" />
                </button>

                <!-- Profile Dropdown -->
                <Transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 scale-95"
                    enter-to-class="opacity-100 scale-100" leave-active-class="transition ease-in duration-150"
                    leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
                    <div v-show="isProfileMenuOpen" :class="[
                        'absolute bottom-full mb-2 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5',
                        isSidebarOpen ? 'left-0 right-0' : 'left-0 w-64'
                    ]">
                        <div>
                            <!-- Language Menu Item with Hover -->
                            <div class="relative" @mouseenter="showLanguageDropdown = true"
                                @mouseleave="showLanguageDropdown = false">
                                <button
                                    class="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                                    <GlobeAltIcon class="h-4 w-4 mr-3 text-gray-400" />
                                    {{ $t('settings.personal.language') }}
                                    <ChevronRightIcon class="h-4 w-4 ml-auto text-gray-400" />
                                </button>

                                <!-- Language Dropdown -->
                                <Transition enter-active-class="transition ease-out duration-200"
                                    enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100"
                                    leave-active-class="transition ease-in duration-150"
                                    leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
                                    <div v-show="showLanguageDropdown"
                                        class="absolute left-full top-0 ml-1 w-64 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-10"
                                        @mouseenter="showLanguageDropdown = true"
                                        @mouseleave="showLanguageDropdown = false">
                                        <div>
                                            <button v-for="locale in availableLocales" :key="locale.code"
                                                @click="selectLanguage(locale.code)"
                                                class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                                                :class="locale.code === selectedLanguage ? 'bg-gray-50 text-accent' : 'text-gray-700'">
                                                <span class="mr-2 flex items-center"><Flags :country="locale.code" /></span>
                                                {{ locale.name }}
                                                <CheckIcon v-if="locale.code === selectedLanguage"
                                                    class="ml-auto h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </Transition>
                            </div>

                            <!-- Other Menu Items -->
                            <button v-for="item in otherProfileMenuItems" :key="item.key"
                                @click="handleProfileMenuItem(item)"
                                class="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                                <component :is="item.icon" class="h-4 w-4 mr-3 text-gray-400" />
                                <span>{{ $t(item.label) }}</span>
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    </div>

    <!-- Mobile Sidebar Overlay -->
    <div v-if="isSidebarOpen && !isLargeScreen" @click="$emit('close')"
        class="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden"></div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFilesStore } from '@/stores/files'
import { onClickOutside } from '@vueuse/core'
import LogoComponent from '@/components/Logo.vue'
import Flags from '@/components/icons/Flags.vue'
import { availableLocales, changeLocale } from '@/utils/i18n'

// Icons
import {
    Bars3Icon,
    XMarkIcon,
    PlusIcon,
    DocumentIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    UserIcon,
    ChevronDownIcon,
    Cog6ToothIcon,
    QuestionMarkCircleIcon,
    ArrowRightStartOnRectangleIcon,
    ArrowLeftStartOnRectangleIcon,
    ArrowRightEndOnRectangleIcon,
    ArrowLeftEndOnRectangleIcon,
    ArchiveBoxIcon,
    GlobeAltIcon,
    CheckIcon,
    DocumentTextIcon
} from '@heroicons/vue/24/outline'

// Props
defineProps({
    isSidebarOpen: {
        type: Boolean,
        required: true
    },
    isLargeScreen: {
        type: Boolean,
        required: true
    }
})

// Emits
defineEmits(['toggle', 'close'])

// Composables
const router = useRouter()
const { t, locale } = useI18n()
const authStore = useAuthStore()
const filesStore = useFilesStore()

// State
const isProfileMenuOpen = ref(false)
const profileMenuRef = ref(null)
const showLanguageDropdown = ref(false)
const selectedLanguage = ref(locale.value)

// Close profile menu when clicking outside
onClickOutside(profileMenuRef, () => {
    isProfileMenuOpen.value = false
    showLanguageDropdown.value = false
})

// Computed properties
const recentFiles = computed(() => filesStore.recentFiles)

const currentLocale = computed(() => {
    return availableLocales.find(l => l.code === locale.value) || availableLocales[0]
})

// Profile menu items (excluding language which is handled separately)
const otherProfileMenuItems = [
    { key: 'settings', icon: Cog6ToothIcon, label: 'dashboard.settings', action: () => navigateTo('/app/settings') },
    { key: 'help', icon: QuestionMarkCircleIcon, label: 'dashboard.help', action: () => navigateTo('/help?from=dashboard') },
    { key: 'logout', icon: ArrowRightEndOnRectangleIcon, label: 'auth.signOut', action: () => authStore.logout() }
]

// Methods
const toggleProfileMenu = () => {
    isProfileMenuOpen.value = !isProfileMenuOpen.value
    showLanguageDropdown.value = false
}

const handleProfileMenuItem = (item) => {
    isProfileMenuOpen.value = false
    showLanguageDropdown.value = false
    item.action()
}

const navigateTo = (path) => {
    router.push(path)
}

const startNewProject = () => {
    // Emit close to parent to handle mobile sidebar
    router.push('/dashboard')
}

const openFile = (file) => {
    // Navigate to file details or results
    router.push(`/files/${file.id}`)
}

const selectLanguage = async (languageCode) => {
    selectedLanguage.value = languageCode
    // Close the entire profile dropdown when language is selected
    isProfileMenuOpen.value = false
    showLanguageDropdown.value = false
    await changeLocale(languageCode)
}

const formatDate = (date) => {
    if (!date) return ''
    const now = new Date()
    const fileDate = new Date(date)
    const diffInHours = Math.abs(now - fileDate) / (1000 * 60 * 60)

    if (diffInHours < 24) {
        return t('dashboard.today')
    } else if (diffInHours < 48) {
        return t('dashboard.yesterday')
    } else {
        return fileDate.toLocaleDateString()
    }
}
</script>