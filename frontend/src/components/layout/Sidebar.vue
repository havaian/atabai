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
                <div
                    class="w-8 h-8 bg-gradient-to-br from-accent to-atabai-violet rounded-lg flex items-center justify-center">
                    <span class="text-white font-bold text-sm">A</span>
                </div>
                <span class="font-semibold text-gray-900">ATABAI</span>
            </div>

            <!-- Always show toggle button, but position differently when collapsed -->
            <button @click="$emit('toggle')" class="p-2 rounded-lg hover:bg-gray-100 transition-colors" :class="[
                isSidebarOpen || !isLargeScreen ? '' : 'w-full flex justify-center'
            ]">
                <ArrowRightStartOnRectangleIcon v-if="!isSidebarOpen" class="h-5 w-5 text-gray-600" />
                <ArrowLeftStartOnRectangleIcon v-else class="h-5 w-5 text-gray-600" />
            </button>
        </div>

        <!-- Sidebar Content - Scrollable Middle Section -->
        <div class="flex-1 flex flex-col min-h-0">
            <!-- New Project Button -->
            <div class="p-4 flex-shrink-0">
                <button @click="startNewProject"
                    class="w-full flex items-center justify-center text-sm font-medium text-white bg-accent rounded-lg hover:bg-atabai-violet transition-all duration-200"
                    :class="{ 'px-2 py-2': !isSidebarOpen && isLargeScreen, 'px-3 py-2': isSidebarOpen || !isLargeScreen }">
                    <PlusIcon class="h-4 w-4" :class="{ 'mr-2': isSidebarOpen || !isLargeScreen }" />
                    <span v-show="isSidebarOpen || !isLargeScreen">{{ $t('dashboard.newProject') }}</span>
                </button>
            </div>

            <!-- Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto">
                <!-- File History -->
                <div v-show="(isSidebarOpen || !isLargeScreen) && recentFiles.length > 0" class="px-4 pb-4">
                    <div class="mb-4">
                        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            {{ $t('dashboard.recentFiles') }}
                        </h3>

                        <!-- File List -->
                        <div class="space-y-1">
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

                <!-- Navigation Icons (when collapsed) -->
                <div v-show="!isSidebarOpen && isLargeScreen" class="px-2 space-y-2">
                    <button v-for="nav in navigationItems" :key="nav.key" @click="navigateTo(nav.path)"
                        class="w-full p-2 rounded-lg hover:bg-gray-100 transition-colors flex justify-center"
                        :title="$t(nav.label)">
                        <component :is="nav.icon" class="h-5 w-5 text-gray-600" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Profile Menu - Always at bottom -->
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
                    <div v-show="isProfileMenuOpen"
                        class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                        <button v-for="item in profileMenuItems" :key="item.key" @click="handleProfileMenuItem(item)"
                            class="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                            <component :is="item.icon" class="h-4 w-4 mr-3 text-gray-400" />
                            {{ $t(item.label) }}
                            <ChevronRightIcon v-if="item.hasSubmenu" class="h-4 w-4 ml-auto text-gray-400" />
                        </button>
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

// Icons
import {
    Bars3Icon,
    XMarkIcon,
    PlusIcon,
    DocumentIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    UserIcon,
    Cog6ToothIcon,
    QuestionMarkCircleIcon,
    ArrowRightStartOnRectangleIcon,
    ArrowLeftStartOnRectangleIcon,
    ArrowRightEndOnRectangleIcon,
    ArrowLeftEndOnRectangleIcon,
    ArchiveBoxIcon,
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
const { t } = useI18n()
const authStore = useAuthStore()
const filesStore = useFilesStore()

// State
const isProfileMenuOpen = ref(false)
const profileMenuRef = ref(null)

// Close profile menu when clicking outside
onClickOutside(profileMenuRef, () => {
    isProfileMenuOpen.value = false
})

// Computed properties
const recentFiles = computed(() => filesStore.recentFiles)

// Navigation items for collapsed sidebar
const navigationItems = [
    { key: 'history', icon: ArchiveBoxIcon, label: 'nav.history', path: '/history' },
    { key: 'templates', icon: DocumentTextIcon, label: 'nav.templates', path: '/templates' }
]

// Profile menu items
const profileMenuItems = [
    { key: 'profile', icon: UserIcon, label: 'nav.profile', action: () => navigateTo('/profile') },
    { key: 'settings', icon: Cog6ToothIcon, label: 'dashboard.settings', action: () => navigateTo('/settings') },
    { key: 'help', icon: QuestionMarkCircleIcon, label: 'dashboard.help', action: () => window.open('#', '_blank') },
    { key: 'logout', icon: ArrowRightEndOnRectangleIcon, label: 'auth.signOut', action: () => authStore.logout() }
]

// Methods
const toggleProfileMenu = () => {
    isProfileMenuOpen.value = !isProfileMenuOpen.value
}

const handleProfileMenuItem = (item) => {
    isProfileMenuOpen.value = false
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