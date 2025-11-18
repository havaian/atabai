<template>
    <div class="max-w-4xl mx-auto p-6 lg:p-8">
        <!-- Welcome Section -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">
                {{ $t('dashboard.welcome', { name: authStore.user?.name?.split(' ')[0] || 'User' }) }}
            </h1>
            <p class="text-gray-600">{{ $t('dashboard.subtitle') }}</p>
        </div>

        <!-- Template Selection -->
        <div class="grid gap-4 md:gap-6">
            <div v-for="template in templates" :key="template.id" @click="selectTemplate(template)"
                class="group relative bg-white border border-gray-200 rounded-xl p-6 hover:border-accent hover:shadow-md transition-all duration-200 cursor-pointer">
                <!-- Template Icon -->
                <div class="flex items-center mb-4">
                    <div
                        class="w-12 h-12 bg-gradient-to-br from-accent/10 to-atabai-violet/10 rounded-lg flex items-center justify-center mr-4">
                        <component :is="template.icon" class="h-6 w-6 text-atabai-violet" />
                    </div>
                    <div class="flex-1">
                        <h3
                            class="text-lg font-semibold text-gray-900 transition-colors">
                            {{ $t(`templates.${template.key}`) }}
                        </h3>
                        <div class="flex items-center mt-1">
                            <span class="text-xs font-medium text-atabai-violet bg-atabai-violet/10 px-2 py-1 rounded">
                                {{ template.standard }}
                            </span>
                            <span class="text-sm text-gray-500 ml-2">{{ template.category }}</span>
                        </div>
                    </div>
                    <ChevronRightIcon class="h-5 w-5 text-gray-400 group-hover:text-atabai-violet transition-colors" />
                </div>

                <!-- Template Description -->
                <p class="text-gray-600 text-sm leading-relaxed">{{
                    $t(`templates.${template.key}Description`) }}</p>
            </div>
        </div>

        <!-- Usage Stats -->
        <!-- <div class="mt-12 bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('dashboard.usageStats') }}</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="text-center">
                    <div class="text-3xl font-bold text-atabai-violet">{{ authStore.filesProcessedThisMonth }}</div>
                    <div class="text-sm text-gray-500 mt-1">{{ $t('dashboard.filesThisMonth') }}</div>
                    <div class="text-xs text-gray-400 mt-1">
                        {{ $t('dashboard.limit', {
                            current: authStore.filesProcessedThisMonth, total:
                                authStore.monthlyLimit
                        }) }}
                    </div>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-atabai-violet">{{
                        authStore.subscriptionType.toUpperCase() }}</div>
                    <div class="text-sm text-gray-500 mt-1">{{ $t('dashboard.subscription') }}</div>
                    <button v-if="authStore.subscriptionType === 'basic'" @click="navigateTo('/pricing')"
                        class="text-xs text-atabai-violet hover:text-accent mt-1 transition-colors">
                        {{ $t('dashboard.upgrade') }}
                    </button>
                </div>
                <div class="text-center">
                    <div class="text-3xl font-bold text-atabai-violet">{{ totalProcessed }}</div>
                    <div class="text-sm text-gray-500 mt-1">{{ $t('dashboard.totalProcessed') }}</div>
                </div>
            </div>
        </div> -->
    </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useFilesStore } from '@/stores/files'
import { useTemplatesStore } from '@/stores/templates'

// Icons
import { ChevronRightIcon } from '@heroicons/vue/24/outline'

// Composables
const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()
const filesStore = useFilesStore()
const templatesStore = useTemplatesStore()

onMounted(() => {
    // Load initial data
    filesStore.fetchRecentFiles()
    templatesStore.fetchTemplates()
})

// Computed properties
const templates = computed(() => templatesStore.availableTemplates)
const totalProcessed = computed(() => filesStore.totalFilesProcessed)

// Methods
const navigateTo = (path) => {
    router.push(path)
}

const selectTemplate = (template) => {
    // Navigate to file upload with template pre-selected
    router.push(`/app/upload?template=${template.id}`)
}
</script>