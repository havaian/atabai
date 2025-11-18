<template>
    <div class="min-h-screen bg-gray-50 flex mt-20 pl-[25%] pr-[25%]">
        <!-- Left Sidebar -->
        <div class="w-64 flex-shrink-0">
            <!-- Settings Header -->
            <div class="px-6 py-8">
                <h1 class="text-2xl font-semibold text-gray-900">{{ $t('dashboard.settings') }}</h1>
            </div>

            <!-- Navigation -->
            <nav class="px-4 pb-4">
                <div class="space-y-1">
                    <button
                        v-for="section in sections"
                        :key="section.key"
                        @click="activeSection = section.key"
                        :disabled="section.disabled"
                        :class="[
                            'w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all text-left group',
                            activeSection === section.key
                                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50',
                            section.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        ]"
                    >
                        <component 
                            :is="section.icon" 
                            :class="[
                                'mr-3 h-5 w-5 transition-colors',
                                activeSection === section.key ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-600'
                            ]" 
                        />
                        <span class="font-medium">{{ $t(section.label) }}</span>
                    </button>
                </div>
            </nav>
        </div>

        <!-- Main Content -->
        <div class="flex-1 overflow-hidden">
            <div class="h-full overflow-y-auto">
                <div class="max-w-4xl mx-auto px-8 py-8">
                    <!-- Personal Settings Section -->
                    <PersonalSettings v-if="activeSection === 'personal'" />

                    <!-- Usage & Plan Section (Commented for future) -->
                    <!--
                    <UsagePlan v-else-if="activeSection === 'usage'" />
                    -->
                    <div v-else-if="activeSection === 'usage'" class="text-center py-12">
                        <div class="text-gray-400 mb-4">
                            <ChartBarIcon class="h-16 w-16 mx-auto" />
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('settings.comingSoon') }}</h3>
                        <p class="text-gray-500">{{ $t('settings.usageTabDescription') }}</p>
                    </div>

                    <!-- Billing Section (Commented for future) -->
                    <!--
                    <Billing v-else-if="activeSection === 'billing'" />
                    -->
                    <div v-else-if="activeSection === 'billing'" class="text-center py-12">
                        <div class="text-gray-400 mb-4">
                            <CreditCardIcon class="h-16 w-16 mx-auto" />
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('settings.comingSoon') }}</h3>
                        <p class="text-gray-500">{{ $t('settings.billingTabDescription') }}</p>
                    </div>

                    <!-- Privacy Section (Commented for future) -->
                    <!--
                    <Privacy v-else-if="activeSection === 'privacy'" />
                    -->
                    <div v-else-if="activeSection === 'privacy'" class="text-center py-12">
                        <div class="text-gray-400 mb-4">
                            <ShieldCheckIcon class="h-16 w-16 mx-auto" />
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('settings.comingSoon') }}</h3>
                        <p class="text-gray-500">{{ $t('settings.privacyTabDescription') }}</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PersonalSettings from '@/components/settings/PersonalSettings.vue'

// Future components (commented)
// import UsagePlan from '@/components/settings/UsagePlan.vue'
// import Billing from '@/components/settings/Billing.vue'
// import Privacy from '@/components/settings/Privacy.vue'

// Icons
import {
    UserIcon,
    ChartBarIcon,
    CreditCardIcon,
    ShieldCheckIcon
} from '@heroicons/vue/24/outline'

// Composables
const { t } = useI18n()

// State
const activeSection = ref('personal')

// Section configuration
const sections = [
    {
        key: 'personal',
        label: 'settings.tabs.personal',
        icon: UserIcon,
        disabled: false
    },
    // {
    //     key: 'usage',
    //     label: 'settings.tabs.usage',
    //     icon: ChartBarIcon,
    //     disabled: true // Will be enabled later
    // },
    // {
    //     key: 'billing',
    //     label: 'settings.tabs.billing',
    //     icon: CreditCardIcon,
    //     disabled: true // Will be enabled later
    // },
    // {
    //     key: 'privacy',
    //     label: 'settings.tabs.privacy',
    //     icon: ShieldCheckIcon,
    //     disabled: true // Will be enabled later
    // }
]
</script>