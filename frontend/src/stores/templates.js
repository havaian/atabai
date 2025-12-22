import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/plugins/axios'
import {
    CalculatorIcon,
    ChartBarIcon,
    CurrencyDollarIcon,
    DocumentTextIcon,
    WalletIcon
} from '@heroicons/vue/24/outline'

export const useTemplatesStore = defineStore('templates', () => {
    // State
    const templates = ref([])
    const currentTemplate = ref(null)
    const isLoading = ref(false)
    const error = ref(null)

    // Getters
    const availableTemplates = computed(() => {
        // Return mock data with icons and stats for now
        const mockTemplates = [
            {
                id: 'depreciation',
                key: 'depreciation',
                name: 'Fixed Asset Depreciation',
                standard: 'IAS 16',
                category: 'Asset Management',
                icon: CalculatorIcon,
                description: 'Automate depreciation calculations according to IAS 16 standards',
                subscriptionRequired: 'basic'
            },
            {
                id: 'discounts',
                key: 'discounts',
                name: 'Discount Calculations',
                standard: 'IFRS 15',
                category: 'Revenue Recognition',
                icon: CurrencyDollarIcon,
                description: 'Calculate revenue discounts and adjustments per IFRS 15',
                subscriptionRequired: 'basic'
            },
            {
                id: 'impairment',
                key: 'impairment',
                name: 'Asset Impairment',
                standard: 'IAS 36',
                category: 'Asset Testing',
                icon: ChartBarIcon,
                description: 'Perform impairment testing and calculations according to IAS 36',
                subscriptionRequired: 'basic'
            },
            {
                id: 'reports',
                key: 'reports',
                name: 'Financial Reports',
                standard: 'IFRS',
                category: 'Reporting',
                icon: DocumentTextIcon,
                description: 'Generate comprehensive IFRS-compliant financial reports',
                subscriptionRequired: 'premium'
            },
            {
                id: 'balance-sheet',
                key: 'balance-sheet',
                name: 'Balance Sheet Transformation',
                standard: 'IAS 1',
                category: 'Financial Statements',
                icon: WalletIcon,
                description: 'Transform NSBU balance sheet to IFRS format according to IAS 1 standards',
                subscriptionRequired: 'basic'
            },
        ]

        // Merge with actual templates from API if available
        if (templates.value.length > 0) {
            return templates.value.map(template => {
                const mockTemplate = mockTemplates.find(mock => mock.id === template.id)
                if (!mockTemplate) {
                    // Skip templates that don't have mock data (prevents undefined key errors)
                    return null
                }
                return {
                    ...template,
                    ...mockTemplate,
                    icon: mockTemplate.icon
                }
            }).filter(Boolean) // Remove null entries
        }

        return mockTemplates
    })

    const basicTemplates = computed(() =>
        availableTemplates.value.filter(template =>
            template.subscriptionRequired === 'basic'
        )
    )

    const premiumTemplates = computed(() =>
        availableTemplates.value.filter(template =>
            template.subscriptionRequired === 'premium'
        )
    )

    // Actions
    async function fetchTemplates() {
        try {
            isLoading.value = true
            error.value = null

            // For now, we'll ignore the API response since it's not properly structured
            // The availableTemplates computed will return our mock data

            // Uncomment this when the backend API is properly implemented:
            // const response = await apiClient.get('/templates')
            // templates.value = response.data.templates || []

            // Keep templates empty so we use mock data
            templates.value = []

            return templates.value
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch templates'
            console.error('Fetch templates error:', err)

            // Keep mock data on error for development
            templates.value = []
        } finally {
            isLoading.value = false
        }
    }

    async function getTemplate(templateId) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.get(`/templates/${templateId}`)
            currentTemplate.value = response.data.template

            return currentTemplate.value
        } catch (err) {
            error.value = err.response?.data?.message || 'Failed to fetch template details'
            console.error('Get template error:', err)

            // Return mock data for development
            const mockTemplate = availableTemplates.value.find(t => t.id === templateId)
            if (mockTemplate) {
                currentTemplate.value = {
                    ...mockTemplate,
                    fields: getMockTemplateFields(templateId),
                    instructions: getMockTemplateInstructions(templateId),
                    examples: getMockTemplateExamples(templateId)
                }
                return currentTemplate.value
            }

            return null
        } finally {
            isLoading.value = false
        }
    }

    async function validateTemplate(templateId, data) {
        try {
            isLoading.value = true
            error.value = null

            const response = await apiClient.post(`/templates/${templateId}/validate`, { data })
            return response.data.validation

        } catch (err) {
            error.value = err.response?.data?.message || 'Template validation failed'
            console.error('Template validation error:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    function getMockTemplateFields(templateId) {
        const fields = {
            depreciation: [
                {
                    name: 'assetName',
                    type: 'text',
                    required: true,
                    label: 'Asset Name',
                    placeholder: 'e.g., Office Building'
                },
                {
                    name: 'assetCost',
                    type: 'number',
                    required: true,
                    label: 'Asset Cost',
                    placeholder: 'Original cost in USD'
                },
                {
                    name: 'usefulLife',
                    type: 'number',
                    required: true,
                    label: 'Useful Life (years)',
                    placeholder: 'Expected useful life'
                },
                {
                    name: 'depreciationMethod',
                    type: 'select',
                    required: true,
                    label: 'Depreciation Method',
                    options: [
                        { value: 'straight-line', label: 'Straight Line' },
                        { value: 'declining-balance', label: 'Declining Balance' },
                        { value: 'units-of-production', label: 'Units of Production' }
                    ]
                }
            ],
            discounts: [
                {
                    name: 'revenueAmount',
                    type: 'number',
                    required: true,
                    label: 'Revenue Amount',
                    placeholder: 'Total revenue amount'
                },
                {
                    name: 'discountType',
                    type: 'select',
                    required: true,
                    label: 'Discount Type',
                    options: [
                        { value: 'percentage', label: 'Percentage' },
                        { value: 'fixed', label: 'Fixed Amount' },
                        { value: 'tiered', label: 'Tiered Discount' }
                    ]
                },
                {
                    name: 'discountValue',
                    type: 'number',
                    required: true,
                    label: 'Discount Value',
                    placeholder: 'Discount percentage or amount'
                }
            ],
            impairment: [
                {
                    name: 'assetCarryingValue',
                    type: 'number',
                    required: true,
                    label: 'Carrying Value',
                    placeholder: 'Current carrying value'
                },
                {
                    name: 'recoverableAmount',
                    type: 'number',
                    required: true,
                    label: 'Recoverable Amount',
                    placeholder: 'Estimated recoverable amount'
                },
                {
                    name: 'testingDate',
                    type: 'date',
                    required: true,
                    label: 'Testing Date',
                    placeholder: 'Date of impairment test'
                }
            ],
            'balance-sheet': [
                {
                    name: 'rowCode',
                    type: 'text',
                    required: true,
                    label: 'Row Code',
                    placeholder: 'e.g., 010, 220'
                },
                {
                    name: 'description',
                    type: 'text',
                    required: true,
                    label: 'Line Description',
                    placeholder: 'Asset or liability description'
                },
                {
                    name: 'beginningBalance',
                    type: 'number',
                    required: true,
                    label: 'Beginning Balance',
                    placeholder: 'Amount at period start'
                },
                {
                    name: 'endingBalance',
                    type: 'number',
                    required: true,
                    label: 'Ending Balance',
                    placeholder: 'Amount at period end'
                }
            ]

        }

        return fields[templateId] || []
    }

    function getMockTemplateInstructions(templateId) {
        const instructions = {
            depreciation: {
                en: 'Upload your asset schedule with columns for asset name, cost, useful life, and depreciation method. The template will automatically calculate depreciation according to IAS 16.',
                ru: 'Загрузите график активов с колонками для названия актива, стоимости, срока службы и метода амортизации. Шаблон автоматически рассчитает амортизацию согласно IAS 16.',
                uz: 'Aktiv jadvalini aktiv nomi, qiymati, foydali muddati va amortizatsiya usuli ustunlari bilan yuklang. Shablon IAS 16 ga muvofiq amortizatsiyani avtomatik hisoblab beradi.'
            },
            discounts: {
                en: 'Upload your revenue data with discount information. The template will apply IFRS 15 revenue recognition principles.',
                ru: 'Загрузите данные о доходах с информацией о скидках. Шаблон применит принципы признания доходов IFRS 15.',
                uz: 'Chegirma ma\'lumotlari bilan daromad ma\'lumotlarini yuklang. Shablon IFRS 15 daromadlarni tan olish tamoyillarini qo\'llaydi.'
            },
            impairment: {
                en: 'Upload asset data for impairment testing. The template will perform IAS 36 compliant impairment calculations.',
                ru: 'Загрузите данные об активах для тестирования на обесценение. Шаблон выполнит расчеты обесценения в соответствии с IAS 36.',
                uz: 'Qadrsizlanishni sinash uchun aktiv ma\'lumotlarini yuklang. Shablon IAS 36 ga muvofiq qadrsizlanish hisob-kitoblarini amalga oshiradi.'
            },
            'balance-sheet': {
                en: 'Upload your NSBU balance sheet (Form № 1). The template will map all line items to IFRS classifications according to IAS 1.',
                ru: 'Загрузите баланс в формате НСБУ (Форма № 1). Шаблон сопоставит все статьи с классификацией МСФО согласно IAS 1.',
                uz: 'NSBU balansini yuklang (Forma № 1). Shablon barcha qatorlarni IAS 1 ga muvofiq IFRS klassifikatsiyasiga moslaydi.'
            }
        }

        return instructions[templateId] || { en: '', ru: '', uz: '' }
    }

    function getMockTemplateExamples(templateId) {
        const examples = {
            depreciation: [
                {
                    name: 'Office Building Depreciation',
                    description: 'Example calculation for a $1M office building with 40-year useful life'
                },
                {
                    name: 'Equipment Depreciation',
                    description: 'Manufacturing equipment depreciation using declining balance method'
                }
            ],
            discounts: [
                {
                    name: 'Volume Discount Recognition',
                    description: 'Revenue recognition with tiered volume discounts'
                },
                {
                    name: 'Early Payment Discounts',
                    description: 'Handling of early payment discount arrangements'
                }
            ],
            impairment: [
                {
                    name: 'Property Impairment Test',
                    description: 'Impairment testing for commercial property assets'
                },
                {
                    name: 'CGU Impairment Analysis',
                    description: 'Cash-generating unit impairment assessment'
                }
            ],
            'balance-sheet': [
                {
                    name: 'Standard Balance Sheet Mapping',
                    description: 'Complete NSBU to IFRS transformation for standard Uzbek balance sheet'
                },
                {
                    name: 'Comparative Balance Sheet',
                    description: 'Side-by-side comparison of NSBU and IFRS presentations'
                }
            ]
        }

        return examples[templateId] || []
    }

    function clearError() {
        error.value = null
    }

    return {
        // State
        templates,
        currentTemplate,
        isLoading,
        error,

        // Getters
        availableTemplates,
        basicTemplates,
        premiumTemplates,

        // Actions
        fetchTemplates,
        getTemplate,
        validateTemplate,
        clearError
    }
})