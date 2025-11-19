<template>
    <div class="max-w-4xl mx-auto p-6 lg:p-8">
        <!-- Back Button -->
        <button @click="goBack" class="mb-6 flex items-center text-gray-600 hover:text-atabai-violet transition-colors">
            <ArrowLeftIcon class="h-5 w-5 mr-2" />
            Back to Dashboard
        </button>

        <!-- Template Header -->
        <div class="mb-8">
            <div class="flex items-center mb-4">
                <div
                    class="w-16 h-16 bg-gradient-to-br from-accent/10 to-atabai-violet/10 rounded-xl flex items-center justify-center mr-4">
                    <component :is="currentTemplate?.icon" class="h-8 w-8 text-atabai-violet" />
                </div>
                <div>
                    <h1 class="text-3xl font-bold text-gray-900">{{ currentTemplate?.name }}</h1>
                    <div class="flex items-center mt-2">
                        <span class="text-sm font-medium text-atabai-violet bg-atabai-violet/10 px-3 py-1 rounded">
                            {{ currentTemplate?.standard }}
                        </span>
                        <span class="text-sm text-gray-500 ml-3">{{ currentTemplate?.category }}</span>
                    </div>
                </div>
            </div>
            <p class="text-gray-600 leading-relaxed">{{ currentTemplate?.description }}</p>
        </div>

        <!-- File Upload Section -->
        <div class="bg-white border border-gray-200 rounded-xl p-6 mb-8">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Upload Your File</h2>

            <!-- Upload Instructions -->
            <div class="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 class="text-sm font-medium text-blue-900 mb-2">Expected File Format:</h3>
                <ul class="text-sm text-blue-800 space-y-1">
                    <li v-for="instruction in uploadInstructions" :key="instruction">• {{ instruction }}</li>
                </ul>
            </div>

            <!-- File Drop Zone -->
            <div @drop="handleDrop" @dragover.prevent @dragenter.prevent
                class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-atabai-violet transition-colors"
                :class="{ 'border-atabai-violet bg-atabai-violet/5': isDragOver }">
                <div v-if="!selectedFile">
                    <CloudArrowUpIcon class="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 class="text-lg font-medium text-gray-900 mb-2">Drop your Excel file here</h3>
                    <p class="text-gray-500 mb-4">or click to browse files</p>
                    <input ref="fileInput" type="file" @change="handleFileSelect" accept=".xlsx,.xls" class="hidden" />
                    <button @click="$refs.fileInput.click()"
                        class="bg-atabai-violet text-white px-6 py-2 rounded-lg hover:bg-atabai-violet/90 transition-colors">
                        Choose File
                    </button>
                    <p class="text-xs text-gray-400 mt-2">Supports .xlsx and .xls files up to 50MB</p>
                </div>

                <!-- Selected File Preview -->
                <div v-else class="space-y-4">
                    <div class="flex items-center justify-center space-x-3">
                        <DocumentIcon class="h-8 w-8 text-green-600" />
                        <div class="text-left">
                            <p class="font-medium text-gray-900">{{ selectedFile.name }}</p>
                            <p class="text-sm text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
                        </div>
                    </div>

                    <!-- Upload Progress -->
                    <div v-if="isProcessing" class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-atabai-violet h-2 rounded-full transition-all duration-300"
                            :style="{ width: uploadProgress + '%' }"></div>
                    </div>
                    <p v-if="isProcessing" class="text-sm text-gray-600">{{ uploadProgress }}% uploaded</p>

                    <div class="flex space-x-3 justify-center">
                        <button @click="processFile" :disabled="isProcessing"
                            class="bg-atabai-violet text-white px-6 py-2 rounded-lg hover:bg-atabai-violet/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            <span v-if="!isProcessing">Process File</span>
                            <span v-else class="flex items-center">
                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Processing...
                            </span>
                        </button>
                        <button @click="clearFile" :disabled="isProcessing"
                            class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors">
                            Choose Different File
                        </button>
                    </div>
                </div>
            </div>

            <!-- Error Display -->
            <div v-if="uploadError" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p class="text-red-800">{{ uploadError }}</p>
            </div>
        </div>

        <!-- Sample Data Format -->
        <div class="bg-white border border-gray-200 rounded-xl p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Sample Excel Format</h2>
            <div class="overflow-x-auto">
                <table class="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                        <tr class="bg-gray-50">
                            <th v-for="header in sampleHeaders" :key="header"
                                class="border border-gray-300 px-3 py-2 text-left font-medium text-gray-900">
                                {{ header }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, index) in sampleData" :key="index">
                            <td v-for="(cell, cellIndex) in row" :key="cellIndex"
                                class="border border-gray-300 px-3 py-2 text-gray-700">
                                {{ cell }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="text-sm text-gray-500 mt-3">
                Your Excel file should have similar column structure. The system will automatically detect columns and
                apply IFRS transformations.
            </p>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTemplatesStore } from '@/stores/templates'
import { useFilesStore } from '@/stores/files'
import {
    ArrowLeftIcon,
    CloudArrowUpIcon,
    DocumentIcon
} from '@heroicons/vue/24/outline'

const router = useRouter()
const route = useRoute()
const templatesStore = useTemplatesStore()
const filesStore = useFilesStore()

// State
const selectedFile = ref(null)
const isProcessing = ref(false)
const isDragOver = ref(false)
const uploadError = ref('')
const uploadProgress = computed(() => filesStore.uploadProgress)

// Get template from query params
const templateId = computed(() => route.query.template)
const currentTemplate = computed(() => {
    if (!templateId.value) return null
    return templatesStore.availableTemplates.find(t => t.id === templateId.value)
})

// Template-specific configurations
const uploadInstructions = computed(() => {
    const instructions = {
        depreciation: [
            'Excel file with asset data in NSBU format',
            'Columns: Asset Name, Original Cost, Purchase Date, Useful Life',
            'Optional: Depreciation Method, Residual Value',
            'Each row should represent one asset'
        ],
        discounts: [
            'Excel file with revenue/discount data in NSBU format',
            'Columns: Transaction ID, Revenue Amount, Discount Type, Discount Value',
            'Optional: Customer, Date, Product Category'
        ],
        impairment: [
            'Excel file with asset carrying values in NSBU format',
            'Columns: Asset Name, Carrying Value, Fair Value, Cash Flow Data',
            'Optional: Testing Date, Market Indicators'
        ]
    }
    return instructions[templateId.value] || []
})

const sampleHeaders = computed(() => {
    const headers = {
        depreciation: ['Asset Name', 'Original Cost (UZS)', 'Purchase Date', 'Useful Life (Years)', 'Method'],
        discounts: ['Transaction ID', 'Revenue (UZS)', 'Discount Type', 'Discount %', 'Customer'],
        impairment: ['Asset Name', 'Carrying Value (UZS)', 'Fair Value (UZS)', 'Testing Date', 'Status']
    }
    return headers[templateId.value] || []
})

const sampleData = computed(() => {
    const data = {
        depreciation: [
            ['Office Building', '1,000,000,000', '2020-01-15', '40', 'Straight-line'],
            ['Manufacturing Equipment', '500,000,000', '2021-06-01', '10', 'Declining Balance'],
            ['Vehicles', '150,000,000', '2022-03-10', '5', 'Straight-line']
        ],
        discounts: [
            ['TXN001', '50,000,000', 'Volume', '5', 'Customer A'],
            ['TXN002', '25,000,000', 'Early Payment', '2', 'Customer B'],
            ['TXN003', '75,000,000', 'Seasonal', '10', 'Customer C']
        ],
        impairment: [
            ['Warehouse', '800,000,000', '750,000,000', '2024-12-01', 'Test Required'],
            ['Retail Store', '300,000,000', '320,000,000', '2024-12-01', 'No Impairment'],
            ['Production Line', '600,000,000', '550,000,000', '2024-12-01', 'Impaired']
        ]
    }
    return data[templateId.value] || []
})

onMounted(() => {
    // Redirect if no template specified
    if (!templateId.value) {
        router.push('/dashboard')
    }
})

// Methods
function goBack() {
    router.push('/dashboard')
}

function handleDrop(event) {
    event.preventDefault()
    isDragOver.value = false

    const files = event.dataTransfer.files
    if (files.length > 0) {
        handleFileSelect({ target: { files } })
    }
}

function handleFileSelect(event) {
    const files = event.target.files
    if (!files.length) return

    const file = files[0]

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
        uploadError.value = 'Please select a valid Excel file (.xlsx or .xls)'
        return
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
        uploadError.value = 'File size must be less than 50MB'
        return
    }

    selectedFile.value = file
    uploadError.value = ''
}

function clearFile() {
    selectedFile.value = null
    uploadError.value = ''
    // Clear any previous upload progress
    filesStore.uploadProgress = 0
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function processFile() {
    if (!selectedFile.value || !templateId.value) return

    try {
        isProcessing.value = true
        uploadError.value = ''

        // Upload file using the correct method name and signature
        const result = await filesStore.uploadFile(selectedFile.value, templateId.value, (progress) => {
            // Progress is handled automatically by the store
            console.log(`Upload progress: ${progress}%`)
        })

        if (result && result.jobId) {
            // Redirect to processing status page
            router.push(`/app/processing/${result.jobId}`)
        }

    } catch (error) {
        uploadError.value = error.message || 'Failed to process file. Please try again.'
        console.error('File processing error:', error)
    } finally {
        isProcessing.value = false
    }
}
</script>