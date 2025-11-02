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
          <!-- <p
            class="max-w-xl text-xl text-black font-medium text-center leading-7 mt-8 md:text-base md:leading-6 md:mt-4 md:px-2">
            {{ $t('hero.subtitle') }}
          </p> -->
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
          <section class="flex w-full max-w-4xl gap-5 text-black flex-wrap justify-center mx-auto px-4 md:px-4">
            <div class="bg-neutral-100 min-w-60 grow shrink basis-80 px-7 py-8 rounded-32 md:px-5">
              <div class="text-44 font-semibold leading-none tracking-tight">~ 15 {{ $t('stats.seconds') }}</div>
              <div class="w-full text-2xl font-medium leading-8 mt-6">{{ $t('stats.analysisTime') }}</div>
            </div>
            <div class="bg-neutral-100 min-w-60 grow shrink basis-80 px-7 py-8 rounded-32 md:px-5">
              <div class="text-44 font-semibold leading-none tracking-tight">99.9%</div>
              <div class="w-full text-2xl font-medium leading-8 mt-6">{{ $t('stats.accuracy') }}</div>
            </div>
            <div class="bg-neutral-100 min-w-60 grow shrink basis-80 px-7 py-8 rounded-32 md:px-5">
              <div class="text-44 font-semibold leading-none tracking-tight">24 / 7</div>
              <div class="w-full text-2xl font-medium leading-8 mt-6">{{ $t('stats.availability') }}</div>
            </div>
            <div class="bg-neutral-100 min-w-60 grow shrink basis-80 px-7 py-8 rounded-32 md:px-5">
              <div class="text-44 font-semibold leading-none tracking-tight">60%</div>
              <div class="w-full text-2xl font-medium leading-8 mt-6">{{ $t('stats.timeSaving') }}</div>
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
            <div class="bg-neutral-100 w-full px-8 py-8 rounded-32 md:px-5">
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
            <div class="bg-neutral-100 min-w-60 basis-96 px-7 py-8 rounded-32 md:px-5 md:w-full">
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
                  <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span class="text-sm font-medium">{{ $t('templates.depreciation') }}</span>
                    <span class="text-xs bg-primary text-white px-2 py-1 rounded">IAS 16</span>
                  </div>
                  <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span class="text-sm font-medium">{{ $t('templates.discounts') }}</span>
                    <span class="text-xs bg-primary text-white px-2 py-1 rounded">IFRS 15</span>
                  </div>
                  <div class="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span class="text-sm font-medium">{{ $t('templates.impairment') }}</span>
                    <span class="text-xs bg-primary text-white px-2 py-1 rounded">IAS 36</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3: Get Results -->
            <div class="bg-neutral-100 min-w-60 basis-96 px-7 py-8 rounded-32 md:px-5 md:w-full">
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
                    <span class="text-sm">{{ $t('howItWorks.step3.processed') }}</span>
                    <CheckCircleIcon class="h-5 w-5 text-green-500" />
                  </div>
                  <div class="text-sm text-gray-600">
                    <div class="flex justify-between">
                      <span>{{ $t('howItWorks.step3.changes') }}:</span>
                      <span class="font-medium">247</span>
                    </div>
                    <div class="flex justify-between">
                      <span>{{ $t('howItWorks.step3.formulas') }}:</span>
                      <span class="font-medium">85</span>
                    </div>
                  </div>
                  <button
                    class="btn-primary bg-black text-white border-black hover:bg-transparent hover:text-black hover:border-black w-full">
                    {{ $t('common.download') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- CTA Section -->
            <section
              class="bg-gradient-hero shadow-atabai flex w-full flex-col overflow-hidden items-center mt-24 pt-12 pb-14 px-5 rounded-40 md:mt-10 md:rounded-32">
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
            <div class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5">
              <DocumentCheckIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.automation.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.automation.description')
                }}</p>
              </div>
            </div>
            <div class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5">
              <ShieldCheckIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.compliance.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.compliance.description')
                }}</p>
              </div>
            </div>
            <div class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5">
              <ClockIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.speed.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.speed.description') }}
                </p>
              </div>
            </div>
            <div class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5">
              <CalculatorIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.accuracy.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.accuracy.description') }}
                </p>
              </div>
            </div>
            <div class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5">
              <CogIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.easy.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.easy.description') }}</p>
              </div>
            </div>
            <div class="bg-neutral-100 self-stretch min-w-60 grow shrink basis-80 my-auto px-7 py-8 rounded-32 md:px-5">
              <GlobeAltIcon class="w-9 h-9 text-primary mb-6" />
              <div class="w-full">
                <h3 class="text-2xl font-bold leading-none tracking-tight">{{ $t('features.universal.title') }}</h3>
                <p class="text-base font-medium leading-6 tracking-tight mt-2">{{ $t('features.universal.description')
                }}</p>
              </div>
            </div>
          </div>

          <!-- <div class="self-center flex justify-center mt-13 md:mt-10">
              @click="true ? goToComingSoon() : (authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login())"
              class="btn-rounded min-w-60 min-h-14 flex items-center gap-2 justify-center md:px-5">
              {{ $t('hero.tryFree') }}
            </button>
          </div> -->
        </section>
      </div>

      <!-- Pricing Section -->
      <!-- <div id="pricing" class="animate-fade-in [animation-delay:800ms]">
        <section
          class="bg-white flex flex-col overflow-hidden items-center justify-center px-4 md:px-20 py-20 md:py-31">
          <div class="max-w-4xl">
            <h1 class="text-black text-3xl md:text-5xl mb-8 font-extrabold leading-tight text-center">
              {{ $t('pricing.title') }}
            </h1>
          </div>
          <div class="flex flex-col md:flex-row w-full gap-5 mt-8 max-w-4xl">
            <!-- Basic Plan
            <div
              class="bg-card text-card-foreground shadow-sm flex-1 relative overflow-hidden rounded-3xl border-2 border-gray-200">
              <div class="relative">
                <div class="flex flex-col space-y-1.5 p-6 pb-4">
                  <div class="flex flex-col items-start text-center">
                    <div class="flex items-center justify-between w-full">
                      <div
                        class="inline-flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary hover:bg-secondary text-secondary-foreground px-3 py-1 text-xl font-semibold mb-6 border-0">
                        {{ $t('pricing.basic.title') }}
                      </div>
                    </div>
                    <div class="text-3xl font-bold text-gray-900 mb-2">{{ $t('pricing.basic.price') }}</div>
                    <div class="invisible text-sm text-gray-600 mb-6">placeholder</div>
                    <button 
                      @click="true ? goToComingSoon() : (authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login())"
                      class="btn-secondary w-full h-10">
                      {{ $t('pricing.getStarted') }}
                    </button>
                  </div>
                </div>
                <div class="p-6 pt-0">
                  <ul class="space-y-3">
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.premium.files') }}</span>
                    </li>
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.premium.templates') }}</span>
                    </li>
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.premium.priority') }}</span>
                    </li>
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.premium.history') }}</span>
                    </li>
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.premium.support') }}</span>
                    </li>
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.premium.api') }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Enterprise Plan
            <div
              class="bg-card text-card-foreground shadow-sm flex-1 relative overflow-hidden rounded-3xl border-2 border-gray-200">
              <div class="relative">
                <div class="flex flex-col space-y-1.5 p-6 pb-4">
                  <div class="flex flex-col items-start text-center">
                    <div class="flex items-center justify-between w-full">
                      <div
                        class="inline-flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary hover:bg-secondary text-secondary-foreground px-3 py-1 text-xl font-semibold mb-6 border-0">
                        {{ $t('pricing.enterprise.title') }}
                      </div>
                    </div>
                    <div class="text-3xl font-bold text-gray-900 mb-2">{{ $t('pricing.enterprise.price') }}</div>
                    <div class="invisible text-sm text-gray-600 mb-6">placeholder</div>
                    <button 
                      @click="true ? goToComingSoon() : (authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login())"
                      class="btn-secondary w-full h-10">
                      {{ $t('pricing.contactUs') }}
                    </button>
                  </div>
                </div>
                <div class="p-6 pt-0">
                  <ul class="space-y-3">
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.enterprise.custom') }}</span>
                    </li>
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.enterprise.dedicated') }}</span>
                    </li>
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.enterprise.sla') }}</span>
                    </li>
                    <li class="flex items-start gap-3">
                      <CheckIcon class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span class="text-gray-900">{{ $t('pricing.enterprise.training') }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div> -->

      <!-- Final CTA Section -->
      <div class="animate-fade-in [animation-delay:1000ms]">
        <section
          class="bg-gradient-hero flex w-full max-w-4xl flex-col overflow-hidden items-center mt-40 px-6 py-12 rounded-40 md:mt-10 mx-auto shadow-atabai md:rounded-32">
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
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
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

// Methods
function goToComingSoon() {
  router.push('/coming-soon')
}

// Lifecycle
onMounted(async () => {
  await authStore.checkAuth()
})
</script>

<style scoped>
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
}
</style>