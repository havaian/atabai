<template>
  <div class="landing-page min-h-screen">
    <!-- Main Content -->
    <main>
      <!-- ===================== NEW HERO AREA ===================== -->
      <div class="landing-hero-area">
        <HeroSection @book-demo="openCalendlyPopup" />
        <TransformVisual />
        <StatsBar />
        <TrustBadges />
      </div>

      <!-- ===================== EXISTING SECTIONS BELOW ===================== -->
      <!-- How It Works Section -->
      <div id="how-it-works" class="animate-fade-in [animation-delay:400ms]">
        <section class="mt-42 md:mt-10">
          <h2 class="text-black text-5xl font-extrabold leading-none text-center md:text-4xl">
            {{ $t('howItWorks.title') }}
          </h2>
          <div class="flex w-full max-w-4xl gap-5 flex-wrap mt-13 md:mt-10 mx-auto px-4">
            <!-- Step 1: Upload Files -->
            <div
              class="bg-neutral-100 w-full px-8 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <div class="mb-8">
                <h3 class="text-black text-2xl font-semibold leading-none tracking-tight">
                  {{ $t('howItWorks.step1.title') }}
                </h3>
                <p class="text-black text-base font-medium leading-6 tracking-tight mt-2 whitespace-pre-line">
                  {{ $t('howItWorks.step1.description') }}
                </p>
              </div>
              <div class="bg-white p-6 rounded-20">
                <div class="flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <CloudArrowUpIcon class="w-12 h-12 text-primary mb-4" />
                  <p class="text-gray-600 font-medium">{{ $t('howItWorks.step1.uploadText') }}</p>
                  <p class="text-gray-400 text-sm mt-2">{{ $t('howItWorks.step1.supportedFormats') }}</p>
                </div>
              </div>
            </div>

            <!-- Step 2: Select Template -->
            <div
              class="bg-neutral-100 w-full px-8 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <div class="mb-8">
                <h3 class="text-black text-2xl font-semibold leading-none tracking-tight">
                  {{ $t('howItWorks.step2.title') }}
                </h3>
                <p class="text-black text-base font-medium leading-6 tracking-tight mt-2">
                  {{ $t('howItWorks.step2.description') }}
                </p>
              </div>
              <div class="bg-white p-4 rounded-20">
                <div class="grid grid-cols-3 gap-3">
                  <button
                    v-for="template in ['depreciation', 'discounts', 'impairment']"
                    :key="template"
                    @click="selectTemplate(template)"
                    :class="[
                      'p-4 rounded-lg text-center transition-all duration-200',
                      selectedTemplate === template
                        ? 'bg-primary/10 border-2 border-primary'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                    ]">
                    <DocumentCheckIcon class="w-6 h-6 mx-auto mb-2" :class="selectedTemplate === template ? 'text-primary' : 'text-gray-400'" />
                    <span class="text-xs font-medium" :class="selectedTemplate === template ? 'text-primary' : 'text-gray-600'">
                      {{ $t(`howItWorks.step2.templates.${template}`) }}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Step 3: Get Results -->
            <div
              class="bg-neutral-100 w-full px-8 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <div class="mb-8">
                <h3 class="text-black text-2xl font-semibold leading-none tracking-tight">
                  {{ $t('howItWorks.step3.title') }}
                </h3>
                <p class="text-black text-base font-medium leading-6 tracking-tight mt-2">
                  {{ $t('howItWorks.step3.description') }}
                </p>
              </div>
              <div class="bg-white p-6 rounded-20">
                <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div class="flex items-center space-x-3">
                    <CheckCircleIcon class="w-8 h-8 text-green-500" />
                    <div>
                      <p class="font-medium text-green-700">{{ $t('howItWorks.step3.processed') }}</p>
                      <p class="text-sm text-green-600">{{ $t('howItWorks.step3.changes') }}: 12 | {{ $t('howItWorks.step3.formulas') }}: 8</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 4: Before/After Comparison -->
            <div
              class="bg-neutral-100 w-full px-8 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <div class="mb-8">
                <h3 class="text-black text-2xl font-semibold leading-none tracking-tight">
                  {{ $t('howItWorks.step4.title') }}
                </h3>
                <p class="text-black text-base font-medium leading-6 tracking-tight mt-2">
                  {{ $t('howItWorks.step4.description') }}
                </p>
              </div>

              <div class="bg-white p-6 rounded-20">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <!-- Before -->
                  <div>
                    <h4 class="text-lg font-semibold mb-4 text-gray-700">{{ $t('howItWorks.step4.before') }}</h4>
                    <div class="border rounded-lg overflow-hidden shadow-sm">
                      <div class="spreadsheet-container">
                        <table class="spreadsheet-table">
                          <thead>
                            <tr>
                              <th class="spreadsheet-header">A</th>
                              <th class="spreadsheet-header">B</th>
                              <th class="spreadsheet-header">C</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr class="spreadsheet-header-row">
                              <td class="spreadsheet-cell font-medium">{{ getBeforeData().headers[0] }}</td>
                              <td class="spreadsheet-cell font-medium">{{ getBeforeData().headers[1] }}</td>
                              <td class="spreadsheet-cell font-medium">{{ getBeforeData().headers[2] }}</td>
                            </tr>
                            <tr v-for="(row, index) in getBeforeData().rows" :key="index">
                              <td class="spreadsheet-cell">{{ row[0] }}</td>
                              <td class="spreadsheet-cell">{{ row[1] }}</td>
                              <td class="spreadsheet-cell">{{ row[2] }}</td>
                            </tr>
                            <tr class="spreadsheet-warning-row">
                              <td class="spreadsheet-cell text-red-600">{{ getBeforeData().warning[0] }}</td>
                              <td class="spreadsheet-cell text-red-600">{{ getBeforeData().warning[1] }}</td>
                              <td class="spreadsheet-cell text-red-600">{{ getBeforeData().warning[2] }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <!-- After -->
                  <div>
                    <h4 class="text-lg font-semibold mb-4 text-green-700">{{ $t('howItWorks.step4.after') }}</h4>
                    <div class="border rounded-lg overflow-hidden shadow-sm">
                      <div class="spreadsheet-container">
                        <table class="spreadsheet-table after-table">
                          <thead>
                            <tr>
                              <th class="spreadsheet-header">A</th>
                              <th class="spreadsheet-header">B</th>
                              <th class="spreadsheet-header">C</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr class="spreadsheet-header-row after-header">
                              <td class="spreadsheet-cell font-medium">{{ getAfterData().headers[0] }}</td>
                              <td class="spreadsheet-cell font-medium">{{ getAfterData().headers[1] }}</td>
                              <td class="spreadsheet-cell font-medium">{{ getAfterData().headers[2] }}</td>
                            </tr>
                            <tr v-for="(row, index) in getAfterData().rows" :key="index">
                              <td class="spreadsheet-cell">{{ row[0] }}</td>
                              <td class="spreadsheet-cell">{{ row[1] }}</td>
                              <td class="spreadsheet-cell">{{ row[2] }}</td>
                            </tr>
                            <tr class="spreadsheet-success-row">
                              <td class="spreadsheet-cell text-green-600">{{ getAfterData().success[0] }}</td>
                              <td class="spreadsheet-cell text-green-600">{{ getAfterData().success[1] }}</td>
                              <td class="spreadsheet-cell text-green-600">{{ getAfterData().success[2] }}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Transformation Arrow -->
                <div class="flex justify-center items-center my-6">
                  <div class="flex items-center space-x-2 bg-primary/10 px-4 py-2 rounded-full">
                    <span class="text-sm font-medium text-primary">{{ $t('howItWorks.step4.transformation') }}</span>
                    <ArrowRightIcon class="w-4 h-4 text-primary" />
                    <span class="text-sm font-medium text-green-600">{{ $t('howItWorks.step4.compliant') }}</span>
                  </div>
                </div>

                <!-- Key Changes Summary -->
                <div class="bg-gradient-to-r from-primary/5 to-green-50 p-4 rounded-lg text-center">
                  <h5 class="font-semibold text-sm mb-2">{{ $t('howItWorks.step4.keyChanges') }}</h5>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span class="text-primary">•</span> {{ $t(`howItWorks.step4.changes.${selectedTemplate}`) }}
                    </div>
                    <div>
                      <span class="text-primary">•</span> {{ $t('howItWorks.step4.changes.translation') }}
                    </div>
                    <div>
                      <span class="text-primary">•</span> {{ $t('howItWorks.step4.changes.standards') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- CTA Section inside How It Works -->
            <section
              class="bg-gradient-hero shadow-gradient-hero flex w-full flex-col overflow-hidden items-center mt-24 pt-12 pb-14 px-5 rounded-40 md:mt-10 md:rounded-32 hover:shadow-gradient-hero transition-shadow duration-300">
              <div class="flex w-full max-w-3xl flex-col items-center md:max-w-full">
                <div class="flex w-full flex-col items-center text-center">
                  <h2
                    class="text-white text-5xl font-extrabold leading-tight md:max-w-full md:text-4xl md:leading-tight whitespace-pre-line">
                    {{ $t('cta.title') }}
                  </h2>
                  <p class="text-white/80 text-xl font-medium leading-7 tracking-tight max-w-md mt-5 md:text-base">
                    {{ $t('cta.subtitle') }}
                  </p>
                </div>
                <!-- Fixed mask button structure -->
                <div class="btn-mask-container mt-12 md:mt-10">
                  <button
                    @click="openCalendlyPopup"
                    class="btn-primary bg-white text-black border-white hover:bg-transparent hover:text-white hover:border-white min-w-60 min-h-14 px-7">
                    {{ $t('cta.button') }}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>

      <!-- Features Section -->
      <div id="features" class="animate-fade-in [animation-delay:600ms]">
        <section class="flex w-full max-w-4xl flex-col items-stretch mt-54 md:mt-10 md:px-4 mx-auto">
          <h2 class="text-black text-5xl font-extrabold leading-none text-center md:text-4xl md:px-4">
            {{ $t('features.title') }}
          </h2>
          <div class="flex w-full items-center gap-5 text-black flex-wrap justify-center mt-13 md:mt-10">
            <div
              class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <DocumentCheckIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.automation.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.automation.description')
                }}</p>
              </div>
            </div>
            <div
              class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <ShieldCheckIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.compliance.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.compliance.description')
                }}</p>
              </div>
            </div>
            <div
              class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <ClockIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.speed.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.speed.description') }}
                </p>
              </div>
            </div>
            <div
              class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <CalculatorIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.accuracy.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.accuracy.description') }}
                </p>
              </div>
            </div>
            <div
              class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <CogIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.easy.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.easy.description') }}</p>
              </div>
            </div>
            <div
              class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5 hover:shadow-lg transition-shadow duration-300">
              <GlobeAltIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.universal.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.universal.description')
                }}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Final CTA Section -->
      <div class="animate-fade-in [animation-delay:1000ms]">
        <section
          class="bg-gradient-hero shadow-gradient-hero flex w-full max-w-4xl flex-col overflow-hidden items-center mt-40 px-6 py-12 rounded-40 md:mt-10 mx-auto md:rounded-32 hover:shadow-gradient-hero transition-shadow duration-300">
          <div class="flex w-full flex-col items-center text-center">
            <h2 class="text-white text-5xl font-extrabold leading-none md:text-4xl md:leading-tight">
              {{ $t('finalCta.title') }}
            </h2>
            <p
              class="text-white text-xl font-medium leading-6 tracking-tight max-w-96 mt-3 md:text-lg md:px-4 whitespace-pre-line">
              {{ $t('finalCta.subtitle') }}
            </p>
          </div>
          <div class="flex md:flex-col md:mt-10 md:items-center mt-10">
            <button
              @click="openCalendlyPopup"
              class="btn-circle w-65 h-65 flex justify-center items-center flex-col gap-5 text-xl font-medium whitespace-pre-line leading-tight text-center">
              <ArrowRightIcon class="w-12 h-12 text-black" />
              {{ $t('finalCta.button') }}
            </button>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  ClockIcon,
  CalculatorIcon,
  CogIcon,
  GlobeAltIcon,
  ArrowRightIcon
} from '@heroicons/vue/24/outline'

// Landing section components
import HeroSection from '@/components/landing/HeroSection.vue'
import TransformVisual from '@/components/landing/TransformVisual.vue'
import StatsBar from '@/components/landing/StatsBar.vue'
import TrustBadges from '@/components/landing/TrustBadges.vue'

// Composables
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n()

// Template selection state
const selectedTemplate = ref('depreciation')

// Spreadsheet data
const getBeforeData = () => {
  if (selectedTemplate.value === 'depreciation') {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.depreciation.before.headers.code'),
        t('howItWorks.step4.spreadsheet.depreciation.before.headers.item'),
        t('howItWorks.step4.spreadsheet.depreciation.before.headers.amount')
      ],
      rows: [
        ['010', t('howItWorks.step4.spreadsheet.depreciation.before.data.ppe'), '1,250,000'],
        ['020', t('howItWorks.step4.spreadsheet.depreciation.before.data.depreciation'), '-320,000']
      ],
      warning: [
        t('howItWorks.step4.spreadsheet.depreciation.before.data.manual'),
        t('howItWorks.step4.spreadsheet.depreciation.before.data.calculation'),
        t('howItWorks.step4.spreadsheet.depreciation.before.data.error')
      ]
    }
  } else if (selectedTemplate.value === 'discounts') {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.discounts.before.headers.code'),
        t('howItWorks.step4.spreadsheet.discounts.before.headers.revenue'),
        t('howItWorks.step4.spreadsheet.discounts.before.headers.amount')
      ],
      rows: [
        ['9000', t('howItWorks.step4.spreadsheet.discounts.before.data.sales'), '500,000'],
        ['9010', t('howItWorks.step4.spreadsheet.discounts.before.data.returns'), '-25,000']
      ],
      warning: [
        t('howItWorks.step4.spreadsheet.discounts.before.data.simple'),
        t('howItWorks.step4.spreadsheet.discounts.before.data.basic'),
        t('howItWorks.step4.spreadsheet.discounts.before.data.noIfrs')
      ]
    }
  } else {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.impairment.before.headers.asset'),
        t('howItWorks.step4.spreadsheet.impairment.before.headers.book'),
        t('howItWorks.step4.spreadsheet.impairment.before.headers.note')
      ],
      rows: [
        [t('howItWorks.step4.spreadsheet.impairment.before.data.equipment'), '800,000', t('howItWorks.step4.spreadsheet.impairment.before.data.notTested')],
        [t('howItWorks.step4.spreadsheet.impairment.before.data.buildings'), '1,200,000', t('howItWorks.step4.spreadsheet.impairment.before.data.noReview')]
      ],
      warning: [
        t('howItWorks.step4.spreadsheet.impairment.before.data.missing'),
        t('howItWorks.step4.spreadsheet.impairment.before.data.noRecoverable'),
        t('howItWorks.step4.spreadsheet.impairment.before.data.risk')
      ]
    }
  }
}

const getAfterData = () => {
  if (selectedTemplate.value === 'depreciation') {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.depreciation.after.headers.ifrsCode'),
        t('howItWorks.step4.spreadsheet.depreciation.after.headers.lineItem'),
        t('howItWorks.step4.spreadsheet.depreciation.after.headers.amount')
      ],
      rows: [
        ['IAS16.30', t('howItWorks.step4.spreadsheet.depreciation.after.data.ppeCost'), '1,250,000'],
        ['IAS16.43', t('howItWorks.step4.spreadsheet.depreciation.after.data.accumDepr'), '-312,500']
      ],
      success: [
        t('howItWorks.step4.spreadsheet.depreciation.after.data.compliant'),
        t('howItWorks.step4.spreadsheet.depreciation.after.data.straightLine'),
        t('howItWorks.step4.spreadsheet.depreciation.after.data.validated')
      ]
    }
  } else if (selectedTemplate.value === 'discounts') {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.discounts.after.headers.ifrsCode'),
        t('howItWorks.step4.spreadsheet.discounts.after.headers.revenue'),
        t('howItWorks.step4.spreadsheet.discounts.after.headers.amount')
      ],
      rows: [
        ['IFRS15.47', t('howItWorks.step4.spreadsheet.discounts.after.data.revenue'), '500,000'],
        ['IFRS15.52', t('howItWorks.step4.spreadsheet.discounts.after.data.variable'), '-25,000']
      ],
      success: [
        t('howItWorks.step4.spreadsheet.discounts.after.data.fiveStep'),
        t('howItWorks.step4.spreadsheet.discounts.after.data.recognized'),
        t('howItWorks.step4.spreadsheet.discounts.after.data.validated')
      ]
    }
  } else {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.impairment.after.headers.asset'),
        t('howItWorks.step4.spreadsheet.impairment.after.headers.carrying'),
        t('howItWorks.step4.spreadsheet.impairment.after.headers.status')
      ],
      rows: [
        [t('howItWorks.step4.spreadsheet.impairment.after.data.equipment'), '720,000', t('howItWorks.step4.spreadsheet.impairment.after.data.impaired')],
        [t('howItWorks.step4.spreadsheet.impairment.after.data.buildings'), '1,200,000', t('howItWorks.step4.spreadsheet.impairment.after.data.noimpairment')]
      ],
      success: [
        t('howItWorks.step4.spreadsheet.impairment.after.data.tested'),
        t('howItWorks.step4.spreadsheet.impairment.after.data.recoverable'),
        t('howItWorks.step4.spreadsheet.impairment.after.data.validated')
      ]
    }
  }
}

// Methods
function selectTemplate(template) {
  selectedTemplate.value = template
}

function goToComingSoon() {
  router.push('/coming-soon')
}

const openCalendlyPopup = () => {
  if (window.Calendly) {
    window.Calendly.initPopupWidget({
      url: 'https://calendly.com/aziz-saidov918/30min'
    })
  } else {
    console.warn('Calendly not loaded yet')
  }
}

// Load Calendly script
onMounted(() => {
  if (!document.querySelector('script[src*="calendly"]')) {
    const script = document.createElement('script')
    script.src = 'https://assets.calendly.com/assets/external/widget.js'
    script.async = true
    document.head.appendChild(script)

    // Load Calendly CSS
    const link = document.createElement('link')
    link.href = 'https://assets.calendly.com/assets/external/widget.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
})
</script>

<style scoped>
/* ===================================================================
   LANDING PAGE THEME VARIABLES
   All landing section components reference these via var(--landing-*)
   =================================================================== */
.landing-page {
  /* Light theme (default) */
  --landing-bg: #FAFAFA;
  --landing-surface: #FFFFFF;
  --landing-surface-2: #F5F3F7;
  --landing-text: #111018;
  --landing-text-secondary: #5C5670;
  --landing-text-muted: #9890A8;
  --landing-border: rgba(0, 0, 0, 0.06);
  --landing-border-accent: rgba(149, 0, 255, 0.12);

  background: var(--landing-bg);
}

:global(.dark) .landing-page {
  /* Dark theme */
  --landing-bg: #07060B;
  --landing-surface: #0F0D15;
  --landing-surface-2: #16131F;
  --landing-text: #F0ECF6;
  --landing-text-secondary: rgba(240, 236, 246, 0.55);
  --landing-text-muted: rgba(240, 236, 246, 0.3);
  --landing-border: rgba(149, 0, 255, 0.08);
  --landing-border-accent: rgba(149, 0, 255, 0.12);

  background: var(--landing-bg);
}

/* ===== NEW HERO AREA ===== */
.landing-hero-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 4rem;
}

/* ===== EXISTING SECTION STYLES (preserved from original) ===== */

/* Custom gradient-inspired shadow */
.shadow-gradient-hero {
  box-shadow: 0 10px 25px -3px rgba(149, 0, 255, 0.3),
    0 4px 6px -2px rgba(124, 58, 237, 0.2),
    0 20px 40px -4px rgba(91, 33, 182, 0.15);
}

.hover\:shadow-gradient-hero:hover {
  box-shadow: 0 15px 35px -3px rgba(149, 0, 255, 0.4),
    0 8px 12px -2px rgba(124, 58, 237, 0.3),
    0 25px 50px -4px rgba(91, 33, 182, 0.2);
}

/* Spreadsheet styles */
.spreadsheet-container {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  height: 240px;
}

.spreadsheet-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  font-size: 12px;
  table-layout: fixed;
}

.spreadsheet-header {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 8px;
  text-align: center;
  font-weight: 600;
  font-size: 11px;
  color: #64748b;
  width: 40px;
  height: 32px;
}

.spreadsheet-cell {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
  background: #fff;
  font-size: 11px;
  vertical-align: top;
  height: 40px;
  word-wrap: break-word;
  overflow: hidden;
}

.spreadsheet-header-row {
  background: #f1f5f9;
}

.spreadsheet-header-row .spreadsheet-cell {
  background: #f1f5f9;
  font-weight: 600;
}

.after-header .spreadsheet-cell {
  background: #f0fdf4;
  color: #166534;
}

.spreadsheet-warning-row .spreadsheet-cell {
  background: #fef3c7;
  border-color: #fbbf24;
}

.spreadsheet-success-row .spreadsheet-cell {
  background: #dcfce7;
  border-color: #22c55e;
}

.after-table .spreadsheet-header {
  background: #f0fdf4;
}

/* Custom animations with delays */
.animate-fade-in {
  animation: fadeIn 0.6s ease-out forwards;
  opacity: 0;
}

.animate-fade-in.\[animation-delay\:200ms\] { animation-delay: 200ms; }
.animate-fade-in.\[animation-delay\:400ms\] { animation-delay: 400ms; }
.animate-fade-in.\[animation-delay\:600ms\] { animation-delay: 600ms; }
.animate-fade-in.\[animation-delay\:800ms\] { animation-delay: 800ms; }
.animate-fade-in.\[animation-delay\:1000ms\] { animation-delay: 1000ms; }

@keyframes fadeIn {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Smooth scrolling for anchor links */
html { scroll-behavior: smooth; }

/* Custom utility classes */
.hero-title {
  font-size: clamp(2rem, 8vw, 4.25rem);
  line-height: 1.1;
  letter-spacing: -0.025em;
}

.text-44 { font-size: 2.75rem; }
.rounded-32 { border-radius: 2rem; }
.rounded-40 { border-radius: 2.5rem; }
.rounded-20 { border-radius: 1.25rem; }
.w-65 { width: 16.25rem; }
.h-65 { height: 16.25rem; }
.mt-15 { margin-top: 3.75rem; }
.mt-21 { margin-top: 5.25rem; }
.mt-27 { margin-top: 6.75rem; }
.mt-40 { margin-top: 10rem; }
.mt-42 { margin-top: 10.5rem; }
.mt-54 { margin-top: 13.5rem; }
.mt-13 { margin-top: 3.25rem; }
.py-31 { padding-top: 7.75rem; padding-bottom: 7.75rem; }
.gap-5 { gap: 1.25rem; }
.min-w-60 { min-width: 15rem; }
.min-h-14 { min-height: 3.5rem; }
.tracking-tight { letter-spacing: -0.025em; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

.stat-card {
  text-align: center;
  padding: 1.5rem;
  border-radius: 1rem;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s ease;
}

.stat-card:hover {
  box-shadow: 0 10px 25px -5px rgba(149, 0, 255, 0.15),
    0 8px 10px -6px rgba(149, 0, 255, 0.1);
}

.stat-number {
  font-size: 2rem;
  font-weight: 800;
  color: #111;
  letter-spacing: -0.02em;
}

.stat-description {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
  margin-top: 0.25rem;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .stat-number {
    font-size: 1.5rem;
  }

  .mt-42 { margin-top: 5rem; }
  .mt-54 { margin-top: 6rem; }
  .mt-40 { margin-top: 5rem; }
}
</style>