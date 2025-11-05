<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Main Content -->
    <main>
      <!-- Hero Section -->
      <section class="flex flex-col items-center justify-center text-center mt-16 mx-auto px-4 max-md:px-2">
        <div class="animate-fade-in">
          <h1 class="text-black hero-title font-extrabold max-w-4xl md:max-w-3xl">
            {{ $t('hero.title') }}
          </h1>
          <!-- Centered first CTA button -->
          <div class="flex justify-center mt-15 md:mt-10 md:mb-15">
            <button
              @click="true ? goToComingSoon() : (authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login())"
              class="btn-rounded pulse-glow min-w-60 min-h-14 flex items-center gap-2 justify-center md:px-5">
              {{ $t('hero.tryFree') }}
            </button>
          </div>
        </div>

        <!-- Statistics Section -->
        <div class="animate-fade-in [animation-delay:200ms] mt-27 md:mt-15">
          <section class="w-full max-w-4xl mx-auto px-4 text-black">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-number">~ 15 {{ $t('stats.seconds') }}</div>
                <div class="stat-description">{{ $t('stats.analysisTime') }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">99.9%</div>
                <div class="stat-description">{{ $t('stats.accuracy') }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">24 / 7</div>
                <div class="stat-description">{{ $t('stats.availability') }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">60%</div>
                <div class="stat-description">{{ $t('stats.timeSaving') }}</div>
              </div>
            </div>
          </section>
        </div>
      </section>

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
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <CloudArrowUpIcon class="mx-auto h-12 w-12 text-gray-400" />
                  <p class="mt-2 text-sm text-gray-600">{{ $t('howItWorks.step1.uploadText') }}</p>
                  <p class="text-xs text-gray-500 mt-1">{{ $t('howItWorks.step1.supportedFormats') }}</p>
                </div>
              </div>
            </div>

            <!-- Step 2: Select Template -->
            <div class="flex w-full gap-5 flex-wrap">
              <div
                class="bg-neutral-100 flex-1 basis-96 px-7 py-8 rounded-32 md:px-5 md:w-full transition-shadow duration-300">
                <div class="mb-8">
                  <h3 class="text-black text-2xl font-semibold leading-none tracking-tight">
                    {{ $t('howItWorks.step2.title') }}
                  </h3>
                  <p class="text-black text-base font-medium leading-6 tracking-tight mt-2 whitespace-pre-line">
                    {{ $t('howItWorks.step2.description') }}
                  </p>
                </div>
                <div class="bg-white p-6 rounded-20">
                  <div class="space-y-3">
                    <div @click="selectTemplate('depreciation')"
                      :class="['p-3 rounded-lg flex items-center justify-between cursor-pointer transition-colors duration-200',
                        selectedTemplate === 'depreciation' ? 'bg-primary/10 border border-primary' : 'bg-gray-50 hover:bg-gray-100']">
                      <span class="text-sm font-medium">{{ $t('templates.depreciation') }}</span>
                      <span class="text-xs bg-primary text-white px-2 py-1 rounded">IAS 16</span>
                    </div>
                    <div @click="selectTemplate('discounts')"
                      :class="['p-3 rounded-lg flex items-center justify-between cursor-pointer transition-colors duration-200',
                        selectedTemplate === 'discounts' ? 'bg-primary/10 border border-primary' : 'bg-gray-50 hover:bg-gray-100']">
                      <span class="text-sm font-medium">{{ $t('templates.discounts') }}</span>
                      <span class="text-xs bg-primary text-white px-2 py-1 rounded">IFRS 15</span>
                    </div>
                    <div @click="selectTemplate('impairment')"
                      :class="['p-3 rounded-lg flex items-center justify-between cursor-pointer transition-colors duration-200',
                        selectedTemplate === 'impairment' ? 'bg-primary/10 border border-primary' : 'bg-gray-50 hover:bg-gray-100']">
                      <span class="text-sm font-medium">{{ $t('templates.impairment') }}</span>
                      <span class="text-xs bg-primary text-white px-2 py-1 rounded">IAS 36</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 3: Get Results -->
              <div
                class="bg-neutral-100 flex-1 basis-96 px-7 py-8 rounded-32 md:px-5 md:w-full transition-shadow duration-300">
                <div class="mb-8">
                  <h3 class="text-black text-2xl font-semibold leading-none tracking-tight">
                    {{ $t('howItWorks.step3.title') }}
                  </h3>
                  <p class="text-black text-base font-medium leading-6 tracking-tight mt-2 whitespace-pre-line">
                    {{ $t('howItWorks.step3.description') }}
                  </p>
                </div>
                <div class="bg-white p-6 rounded-20">
                  <div class="space-y-4">
                    <div class="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span class="text-sm">{{ $t(`howItWorks.templates.${selectedTemplate}.processed`) }}</span>
                      <CheckCircleIcon class="h-5 w-5 text-green-500" />
                    </div>
                    <div class="text-sm text-gray-600">
                      <div class="flex justify-between">
                        <span>{{ $t(`howItWorks.templates.${selectedTemplate}.changesLabel`) }}:</span>
                        <span class="font-medium">{{ $t(`howItWorks.templates.${selectedTemplate}.changes`) }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span>{{ $t(`howItWorks.templates.${selectedTemplate}.formulasLabel`) }}:</span>
                        <span class="font-medium">{{ $t(`howItWorks.templates.${selectedTemplate}.formulas`) }}</span>
                      </div>
                    </div>
                    <button
                      class="btn-primary bg-black text-white border-black hover:bg-transparent hover:text-black hover:border-black w-full">
                      {{ $t('common.download') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>


            <!-- Step 4: Before/After Preview -->
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

            <!-- CTA Section -->
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
                    @click="true ? goToComingSoon() : (authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login())"
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
              @click="true ? goToComingSoon() : (authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login())"
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
import { ref, computed } from 'vue'
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
        t('howItWorks.step4.spreadsheet.discounts.before.data.nonifrs')
      ]
    }
  } else {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.impairment.before.headers.asset'),
        t('howItWorks.step4.spreadsheet.impairment.before.headers.carrying'),
        t('howItWorks.step4.spreadsheet.impairment.before.headers.status')
      ],
      rows: [
        [t('howItWorks.step4.spreadsheet.impairment.before.data.equipment'), '800,000', t('howItWorks.step4.spreadsheet.impairment.before.data.untested')],
        [t('howItWorks.step4.spreadsheet.impairment.before.data.buildings'), '1,200,000', t('howItWorks.step4.spreadsheet.impairment.before.data.untested')]
      ],
      warning: [
        t('howItWorks.step4.spreadsheet.impairment.before.data.notesting'),
        t('howItWorks.step4.spreadsheet.impairment.before.data.noias36'),
        t('howItWorks.step4.spreadsheet.impairment.before.data.risk')
      ]
    }
  }
}

const getAfterData = () => {
  if (selectedTemplate.value === 'depreciation') {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.depreciation.after.headers.assets'),
        t('howItWorks.step4.spreadsheet.depreciation.after.headers.standard'),
        t('howItWorks.step4.spreadsheet.depreciation.after.headers.amount')
      ],
      rows: [
        [t('howItWorks.step4.spreadsheet.depreciation.after.data.ppe'), 'IAS 16', '1,250,000'],
        [t('howItWorks.step4.spreadsheet.depreciation.after.data.accumulated'), 'IAS 16', '-345,600']
      ],
      success: [
        t('howItWorks.step4.spreadsheet.depreciation.after.data.automated'),
        t('howItWorks.step4.spreadsheet.depreciation.after.data.compliant'),
        t('howItWorks.step4.spreadsheet.depreciation.after.data.accurate')
      ]
    }
  } else if (selectedTemplate.value === 'discounts') {
    return {
      headers: [
        t('howItWorks.step4.spreadsheet.discounts.after.headers.revenue'),
        t('howItWorks.step4.spreadsheet.discounts.after.headers.standard'),
        t('howItWorks.step4.spreadsheet.discounts.after.headers.amount')
      ],
      rows: [
        [t('howItWorks.step4.spreadsheet.discounts.after.data.contracts'), 'IFRS 15', '475,000'],
        [t('howItWorks.step4.spreadsheet.discounts.after.data.liabilities'), 'IFRS 15', '12,500']
      ],
      success: [
        t('howItWorks.step4.spreadsheet.discounts.after.data.performance'),
        t('howItWorks.step4.spreadsheet.discounts.after.data.method'),
        t('howItWorks.step4.spreadsheet.discounts.after.data.compliant')
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
</script>

<style scoped>
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
  /* Fixed height for consistency */
}

.spreadsheet-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  font-size: 12px;
  table-layout: fixed;
  /* Fixed layout for consistent column widths */
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
  /* Fixed width for column headers */
  height: 32px;
  /* Fixed height */
}

.spreadsheet-cell {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
  background: #fff;
  font-size: 11px;
  vertical-align: top;
  height: 40px;
  /* Fixed row height */
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

.animate-fade-in.\[animation-delay\:200ms\] {
  animation-delay: 200ms;
}

.animate-fade-in.\[animation-delay\:400ms\] {
  animation-delay: 400ms;
}

.animate-fade-in.\[animation-delay\:600ms\] {
  animation-delay: 600ms;
}

.animate-fade-in.\[animation-delay\:800ms\] {
  animation-delay: 800ms;
}

.animate-fade-in.\[animation-delay\:1000ms\] {
  animation-delay: 1000ms;
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Custom utility classes using proper CSS */
.hero-title {
  font-size: clamp(2rem, 8vw, 4.25rem);
  line-height: 1.1;
  letter-spacing: -0.025em;
}

.text-44 {
  font-size: 2.75rem;
}

.rounded-32 {
  border-radius: 2rem;
}

.rounded-40 {
  border-radius: 2.5rem;
}

.rounded-20 {
  border-radius: 1.25rem;
}

.w-65 {
  width: 16.25rem;
}

.h-65 {
  height: 16.25rem;
}

.mt-15 {
  margin-top: 3.75rem;
}

.mt-21 {
  margin-top: 5.25rem;
}

.mt-27 {
  margin-top: 6.75rem;
}

.mt-40 {
  margin-top: 10rem;
}

.mt-42 {
  margin-top: 10.5rem;
}

.mt-54 {
  margin-top: 13.5rem;
}

.mt-13 {
  margin-top: 3.25rem;
}

.py-31 {
  padding-top: 7.75rem;
  padding-bottom: 7.75rem;
}

.gap-5 {
  gap: 1.25rem;
}

.min-w-60 {
  min-width: 15rem;
}

.min-h-14 {
  min-height: 3.5rem;
}

.tracking-tight {
  letter-spacing: -0.025em;
}

.stats-grid, #features section > div {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 512px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
  }
}

@media (min-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem;
  }
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 1.25rem;
  }
}

.stat-card {
  background: #f5f5f5;
  padding: 1.5rem 1rem;
  border-radius: 2rem;
  transition: box-shadow 0.3s ease;
  cursor: pointer;
}

.stat-card:hover {
  box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

@media (min-width: 512px) {
  main {
    padding: 0 2%;
  }
}

@media (min-width: 640px) {
  .stat-card {
    padding: 2rem 1.75rem;
  }
}

@media (min-width: 768px) {
  .stat-card {
    padding: 2rem 1.25rem;
  }
}

.stat-number {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.025em;
}

@media (min-width: 512px) {
  .stat-number {
    font-size: 2.75rem;
  }
}


@media (min-width: 640px) {
  .stat-number {
    font-size: 2.75rem;
  }
}

@media (min-width: 768px) {
  .stat-number {
    font-size: 1.875rem;
  }
}

.stat-description {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.5;
  letter-spacing: -0.025em;
  margin-top: 1rem;
}

@media (min-width: 510px) {
  .stat-description {
    font-size: 1.5rem;
    line-height: 2;
    margin-top: 1.5rem;
  }
}

@media (min-width: 640px) {
  .stat-description {
    font-size: 1.5rem;
    line-height: 2;
    margin-top: 1.5rem;
  }
}

@media (min-width: 768px) {
  .stat-description {
    font-size: 1.125rem;
    line-height: 1.5;
    margin-top: 1rem;
  }
}

/* Responsive breakpoint adjustments */
@media (max-width: 768px) {
  .mt-15 {
    margin-top: 2.5rem;
  }

  .mt-21 {
    margin-top: 2.5rem;
  }

  .mt-27 {
    margin-top: 2.5rem;
  }

  .mt-40 {
    margin-top: 2.5rem;
  }

  .mt-42 {
    margin-top: 2.5rem;
  }

  .mt-54 {
    margin-top: 2.5rem;
  }

  .py-31 {
    padding-top: 5rem;
    padding-bottom: 5rem;
  }

  .spreadsheet-container {
    height: 200px;
    /* Slightly smaller on mobile */
  }

  .spreadsheet-table {
    font-size: 10px;
  }

  .spreadsheet-cell {
    padding: 6px 8px;
    font-size: 10px;
    height: 36px;
    /* Adjusted for mobile */
  }

  .spreadsheet-header {
    padding: 6px;
    font-size: 10px;
    height: 28px;
    /* Adjusted for mobile */
    width: 35px;
  }
}
</style>