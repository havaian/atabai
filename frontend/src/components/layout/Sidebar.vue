<template>
    <!-- Sidebar -->
    <div v-if="isLargeScreen" class="flex h-full">
        <!-- Desktop Sidebar -->
        <div :class="[
            'bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out',
            isSidebarOpen ? 'w-64' : 'w-16'
        ]">
            <!-- Header -->
            <div class="p-4 border-b border-gray-200 flex-shrink-0">
                <div class="flex items-center justify-between">
                    <div v-show="isSidebarOpen" class="flex items-center space-x-2">
                        <LogoComponent class="h-8 w-8" />
                    </div>
                    <button v-show="isSidebarOpen" @click="$emit('toggle')"
                        class="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowLeftEndOnRectangleIcon class="h-4 w-4 text-gray-600" />
                    </button>
                    <button v-show="!isSidebarOpen" @click="$emit('toggle')"
                        class="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <ArrowRightEndOnRectangleIcon class="h-4 w-4 text-gray-600" />
                    </button>
                </div>
            </div>

            <!-- Navigation -->
            <div class="p-4 border-b border-gray-200 space-y-2 flex-shrink-0">
                <!-- New File Button -->
                <button @click="navigateTo('/app/upload')"
                    class="w-full flex items-center justify-center bg-atabai-violet text-white rounded-lg hover:bg-atabai-violet/90 transition-all duration-200"
                    :class="{ 'px-2 py-2': !isSidebarOpen, 'px-3 py-2': isSidebarOpen }">
                    <PlusIcon class="h-4 w-4" :class="{ 'mr-2': isSidebarOpen }" />
                    <span v-show="isSidebarOpen">{{ $t('dashboard.newProject') }}</span>
                </button>

                <!-- Templates Button -->
                <!-- <button @click="navigateTo('/app/dashboard')"
                    class="w-full flex items-center justify-center text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                    :class="{ 'px-2 py-2': !isSidebarOpen, 'px-3 py-2': isSidebarOpen }">
                    <DocumentTextIcon class="h-4 w-4" :class="{ 'mr-2': isSidebarOpen }" />
                    <span v-show="isSidebarOpen">{{ $t('nav.templates') }}</span>
                </button> -->

                <!-- History Button -->
                <button @click="navigateTo('/app/history')"
                    class="w-full flex items-center justify-center text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200"
                    :class="{ 'px-2 py-2': !isSidebarOpen, 'px-3 py-2': isSidebarOpen }">
                    <ArchiveBoxIcon class="h-4 w-4" :class="{ 'mr-2': isSidebarOpen }" />
                    <span v-show="isSidebarOpen">{{ $t('nav.history') }}</span>
                </button>
            </div>

            <!-- Scrollable Content Area -->
            <div class="flex-1 overflow-y-auto">
                <!-- File History -->
                <div v-show="isSidebarOpen" class="px-4 pb-4">
                    <div class="my-4">
                        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            {{ $t('dashboard.recentFiles') }}
                        </h3>

                        <!-- Loading State -->
                        <div v-if="filesStore.isLoading && recentFiles.length === 0" class="text-center py-4">
                            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-atabai-violet mx-auto">
                            </div>
                            <p class="text-xs text-gray-500 mt-2">{{ $t('common.loading') }}</p>
                        </div>

                        <!-- Empty State -->
                        <div v-else-if="recentFiles.length === 0" class="text-center py-6">
                            <div class="text-gray-400 mb-2">
                                <DocumentIcon class="h-8 w-8 mx-auto" />
                            </div>
                            <p class="text-sm text-gray-500">{{ $t('dashboard.emptyState') }}</p>
                        </div>

                        <!-- File List -->
                        <div v-else class="space-y-1">
                            <div v-for="file in recentFiles" :key="file.id" @click="openFile(file)"
                                class="flex items-center p-2 rounded-lg hover:bg-gray-100 cursor-pointer group">
                                <img src="/images/icons/excel.svg" class="h-8 w-8 text-gray-400 mr-3 flex-shrink-0" />
                                <div class="inline-flex w-full justify-between min-w-0">
                                    <div class="grid">
                                        <p class="text-sm font-medium text-gray-900 truncate">{{ file.originalName }}
                                        </p>
                                        <div class="items-center justify-between">
                                            <p class="text-xs text-gray-500">{{ formatDate(file.createdAt) }}</p>
                                        </div>
                                    </div>
                                    <span :class="statusClasses(file.status)"
                                        class="flex text-xs px-2 my-1 rounded-full items-center">
                                        {{ $t(`processing.status.${file.status}`) }}
                                    </span>
                                </div>
                                <ChevronRightIcon
                                    class="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Profile Menu -->
            <div class="border-t border-gray-200 flex-shrink-0">
                <div class="relative" ref="profileMenuRef">
                    <button @click="toggleProfileMenu" :class="[
                        'w-full flex items-center p-4 hover:bg-gray-50 transition-colors',
                        { 'justify-center': !isSidebarOpen }
                    ]">
                        <div
                            class="w-8 h-8 bg-atabai-violet rounded-full flex items-center justify-center flex-shrink-0">
                            <span class="text-white font-medium text-sm">
                                {{ authStore.user?.displayName?.charAt(0)?.toUpperCase() || 'U' }}
                            </span>
                        </div>
                        <div v-show="isSidebarOpen" class="ml-3 flex-1 text-left">
                            <p class="text-sm font-medium text-gray-900 truncate">
                                {{ authStore.user?.displayName || 'User' }}
                            </p>
                            <p class="text-xs text-gray-500 truncate">
                                {{ authStore.user?.email }}
                            </p>
                        </div>
                        <ChevronUpIcon v-if="isSidebarOpen && isProfileMenuOpen" class="h-4 w-4 text-gray-400 ml-2" />
                        <ChevronDownIcon v-else-if="isSidebarOpen" class="h-4 w-4 text-gray-400 ml-2" />
                    </button>

                    <!-- Profile Dropdown -->
                    <div v-if="isProfileMenuOpen" :class="[
                        'absolute bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50',
                        isSidebarOpen ? 'left-0 right-0' : 'left-0 w-64'
                    ]">

                        <!-- Language Selection -->
                        <div class="px-3 py-2 border-b border-gray-100">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    {{ $t('nav.language') }}
                                </span>
                                <button @click="showLanguageDropdown = !showLanguageDropdown"
                                    class="flex items-center text-xs text-gray-700 hover:text-atabai-violet">
                                    {{ currentLocale.name }}
                                    <ChevronDownIcon class="h-3 w-3 ml-1" />
                                </button>
                            </div>

                            <!-- Language Dropdown -->
                            <div v-if="showLanguageDropdown" class="mt-2 space-y-1">
                                <button v-for="lang in availableLocales" :key="lang.code"
                                    @click="selectLanguage(lang.code)"
                                    class="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 text-xs">
                                    <div class="flex items-center">
                                        <span>{{ lang.name }}</span>
                                    </div>
                                    <CheckIcon v-if="locale === lang.code" class="h-3 w-3 text-atabai-violet" />
                                </button>
                            </div>
                        </div>

                        <!-- Menu Items -->
                        <div v-for="(item, index) in profileMenuItems" :key="index">
                            <button @click="item.action"
                                class="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                <component :is="item.icon" class="h-4 w-4 mr-3 text-gray-400" />
                                {{ item.label }}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Mobile Overlay -->
    <div v-else>
        <!-- Mobile Sidebar Overlay -->
        <div v-if="isSidebarOpen" class="fixed inset-0 z-50 lg:hidden">
            <!-- Backdrop -->
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50" @click="$emit('close')"></div>

            <!-- Mobile Sidebar -->
            <div class="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col">
                <!-- Header -->
                <div class="p-4 border-b border-gray-200 flex items-center justify-between">
                    <div class="flex items-center space-x-2">
                        <LogoComponent class="h-8 w-8" />
                        <span class="font-semibold text-gray-900 text-lg">ATABAI</span>
                    </div>
                    <button @click="$emit('close')" class="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <XMarkIcon class="h-5 w-5 text-gray-600" />
                    </button>
                </div>

                <!-- Navigation -->
                <div class="p-4 border-b border-gray-200 space-y-2">
                    <!-- New File Button -->
                    <button @click="navigateAndClose('/app/upload')"
                        class="w-full flex items-center px-3 py-2 bg-atabai-violet text-white rounded-lg hover:bg-atabai-violet/90 transition-colors">
                        <PlusIcon class="h-4 w-4 mr-2" />
                        {{ $t('dashboard.newProject') }}
                    </button>

                    <!-- Templates Button -->
                    <button @click="navigateAndClose('/app/dashboard')"
                        class="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                        <DocumentTextIcon class="h-4 w-4 mr-2" />
                        {{ $t('nav.templates') }}
                    </button>

                    <!-- History Button -->
                    <button @click="navigateAndClose('/app/history')"
                        class="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                        <ArchiveBoxIcon class="h-4 w-4 mr-2" />
                        {{ $t('nav.history') }}
                    </button>
                </div>

                <!-- Scrollable Content Area -->
                <div class="flex-1 overflow-y-auto px-4 pb-4">
                    <div class="mb-4">
                        <h3 class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            {{ $t('dashboard.recentFiles') }}
                        </h3>

                        <!-- Loading State -->
                        <div v-if="filesStore.isLoading && recentFiles.length === 0" class="text-center py-4">
                            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-atabai-violet mx-auto">
                            </div>
                            <p class="text-xs text-gray-500 mt-2">{{ $t('common.loading') }}</p>
                        </div>

                        <!-- Empty State -->
                        <div v-else-if="recentFiles.length === 0" class="text-center py-6">
                            <div class="text-gray-400 mb-2">
                                <DocumentIcon class="h-8 w-8 mx-auto" />
                            </div>
                            <p class="text-sm text-gray-500">{{ $t('dashboard.emptyState') }}</p>
                        </div>

                        <!-- File List -->
                        <div v-else class="space-y-1">
                            <div v-for="file in recentFiles" :key="file.id" @click="openFileAndClose(file)"
                                class="flex items-center p-2 rounded-lg hover:bg-gray-100 cursor-pointer group">
                                <DocumentIcon class="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium text-gray-900 truncate">{{ file.originalName }}</p>
                                    <div class="flex items-center justify-between">
                                        <p class="text-xs text-gray-500">{{ formatDate(file.createdAt) }}</p>
                                        <span :class="statusClasses(file.status)"
                                            class="text-xs px-2 py-1 rounded-full">
                                            {{ $t(`processing.status.${file.status}`) }}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRightIcon
                                    class="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Profile Menu -->
                <div class="border-t border-gray-200">
                    <div class="relative" ref="profileMenuRef">
                        <button @click="toggleProfileMenu"
                            class="w-full flex items-center p-4 hover:bg-gray-50 transition-colors">
                            <div class="w-8 h-8 bg-atabai-violet rounded-full flex items-center justify-center">
                                <span class="text-white font-medium text-sm">
                                    {{ authStore.user?.displayName?.charAt(0)?.toUpperCase() || 'U' }}
                                </span>
                            </div>
                            <div class="ml-3 flex-1 text-left">
                                <p class="text-sm font-medium text-gray-900 truncate">
                                    {{ authStore.user?.displayName || 'User' }}
                                </p>
                                <p class="text-xs text-gray-500 truncate">
                                    {{ authStore.user?.email }}
                                </p>
                            </div>
                            <ChevronUpIcon v-if="isProfileMenuOpen" class="h-4 w-4 text-gray-400" />
                            <ChevronDownIcon v-else class="h-4 w-4 text-gray-400" />
                        </button>

                        <!-- Profile Dropdown -->
                        <div v-if="isProfileMenuOpen"
                            class="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">

                            <!-- Language Selection -->
                            <div class="px-3 py-2 border-b border-gray-100">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        {{ $t('nav.language') }}
                                    </span>
                                    <button @click="showLanguageDropdown = !showLanguageDropdown"
                                        class="flex items-center text-xs text-gray-700 hover:text-atabai-violet">
                                        {{ currentLocale.name }}
                                        <ChevronUpIcon v-if="showLanguageDropdown" class="h-3 w-3 ml-1" />
                                        <ChevronDownIcon v-else-if="!showLanguageDropdown" class="h-3 w-3 ml-1" />
                                    </button>
                                </div>

                                <!-- Language Dropdown -->
                                <div v-if="showLanguageDropdown" class="mt-2 space-y-1">
                                    <button v-for="lang in availableLocales" :key="lang.code"
                                        @click="selectLanguage(lang.code)"
                                        class="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-gray-100 text-xs">
                                        <div class="flex items-center">
                                            <span>{{ lang.name }}</span>
                                        </div>
                                        <CheckIcon v-if="locale === lang.code" class="h-3 w-3 text-atabai-violet" />
                                    </button>
                                </div>
                            </div>

                            <!-- Menu Items -->
                            <div v-for="(item, index) in profileMenuItems" :key="index">
                                <button @click="item.action"
                                    class="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                    <component :is="item.icon" class="h-4 w-4 mr-3 text-gray-400" />
                                    {{ item.label }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFilesStore } from '@/stores/files'
import { onClickOutside } from '@vueuse/core'
import LogoComponent from '@/components/Logo.vue'
import { availableLocales, changeLocale } from '@/utils/i18n'

// Icons
import {
    Bars3Icon,
    XMarkIcon,
    PlusIcon,
    DocumentIcon,
    ChevronRightIcon,
    UserIcon,
    ChevronUpIcon,
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
const recentFiles = computed(() => filesStore.recentFiles.slice(0, 10)) // Show only latest 10 files

const currentLocale = computed(() => {
    return availableLocales.find(l => l.code === locale.value) || availableLocales[0]
})

// Profile menu items
const profileMenuItems = computed(() => [
    // {
    //     icon: UserIcon,
    //     label: t('nav.profile'),
    //     action: () => navigateTo('/app/profile')
    // },
    {
        icon: Cog6ToothIcon,
        label: t('dashboard.settings'),
        action: () => navigateTo('/app/settings')
    },
    {
        icon: QuestionMarkCircleIcon,
        label: t('dashboard.help'),
        action: () => navigateTo('/help')
    },
    {
        icon: ArrowRightStartOnRectangleIcon,
        label: t('auth.signOut'),
        action: handleSignOut
    }
])

// Methods
function navigateTo(path) {
    router.push(path)
}

function navigateAndClose(path) {
    router.push(path)
    $emit('close')
}

function openFile(file) {
    if (file.status === 'completed') {
        console.log(file.id)
        router.push(`/app/files/${file.id}`)
    } else if (file.jobId) {
        router.push(`/app/processing/${file.jobId}`)
    }
}

function openFileAndClose(file) {
    openFile(file)
    $emit('close')
}

function formatDate(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))

    if (diffInMinutes < 1) {
        return t('dashboard.today')
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes}min ago`
    } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60)
        return `${hours}h ago`
    } else if (diffInMinutes < 2880) {
        return t('dashboard.yesterday')
    } else {
        return date.toLocaleDateString()
    }
}

function statusClasses(status) {
    const classes = {
        'completed': 'bg-green-100 text-green-800',
        'processing': 'bg-blue-100 text-blue-800',
        'failed': 'bg-red-100 text-red-800',
        'pending': 'bg-yellow-100 text-yellow-800',
        'uploaded': 'bg-violet-100 text-gray-800'
    }
    return classes[status] || 'bg-violet-100 text-gray-800'
}

function toggleProfileMenu() {
    isProfileMenuOpen.value = !isProfileMenuOpen.value
    showLanguageDropdown.value = false
}

function selectLanguage(langCode) {
    changeLocale(langCode)
    selectedLanguage.value = langCode
    showLanguageDropdown.value = false
}

async function handleSignOut() {
    try {
        await authStore.logout()
        router.push('/login')
    } catch (error) {
        console.error('Sign out error:', error)
    }
}

// Load recent files when component mounts - use cached data if available
onMounted(async () => {
    try {
        // Only fetch if we don't have cached data
        if (filesStore.recentFiles.length === 0) {
            await filesStore.fetchRecentFiles()
        }
    } catch (error) {
        console.error('Failed to load recent files in sidebar:', error)
    }
})
</script>

<style scoped>
/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
    width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
}
</style>