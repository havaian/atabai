<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b fixed top-0 left-0 right-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center">
            <!-- Logo -->
            <router-link to="/" class="flex-shrink-0 flex items-center">
              <div class="text-2xl font-bold text-primary">ATABAI</div>
            </router-link>

            <!-- Navigation Links -->
            <div class="hidden md:ml-12 md:flex md:space-x-8">
              <a href="#features"
                class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium transition-colors">
                {{ $t('nav.features') }}
              </a>
              <a href="#how-it-works" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium">
                {{ $t('nav.howItWorks') }}
              </a>
              <a href="#pricing" class="text-gray-900 hover:text-primary px-3 py-2 text-sm font-medium">
                {{ $t('nav.pricing') }}
              </a>
            </div>
          </div>

          <!-- User Menu -->
          <div class="flex items-center space-x-4">
            <!-- Language Selector -->
            <div class="relative">
              <Menu as="div" class="relative inline-block text-left">
                <MenuButton class="flex items-center gap-1 bg-gray-100 px-3 py-2 rounded-full hover:bg-gray-200">
                  <GlobeAltIcon class="w-4 h-4" />
                  <span class="text-sm font-medium">{{ currentLocale.code.toUpperCase() }}</span>
                  <ChevronDownIcon class="w-4 h-4" />
                </MenuButton>
                <MenuItems
                  class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <MenuItem v-for="locale in availableLocales" :key="locale.code" v-slot="{ active }">
                  <button @click="changeLanguage(locale.code)"
                    :class="[active ? 'bg-gray-100' : '', 'flex w-full items-center px-4 py-2 text-sm text-gray-700']">
                    <span class="mr-2">{{ locale.flag }}</span>
                    {{ locale.name }}
                  </button>
                  </MenuItem>
                </MenuItems>
              </Menu>
            </div>

            <!-- Auth Buttons -->
            <div v-if="!authStore.isAuthenticated" class="flex items-center space-x-4">
              <button @click="authStore.login" class="btn-auth hover-glow inline-flex items-center">
                <GoogleIcon size="16" className="mr-2" />
                {{ $t('auth.signInWithGoogle') }}
              </button>
            </div>

            <!-- User Dropdown -->
            <div v-if="authStore.isAuthenticated" class="relative">
              <Menu as="div" class="relative inline-block text-left">
                <MenuButton
                  class="flex items-center space-x-3 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                  <img class="h-8 w-8 rounded-full" :src="authStore.user?.picture || '/images/default-avatar.png'"
                    :alt="authStore.user?.name || 'User'" />
                  <span class="hidden md:block text-gray-700">{{ authStore.user?.name }}</span>
                  <ChevronDownIcon class="h-4 w-4 text-gray-400" />
                </MenuButton>
                <MenuItems
                  class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <MenuItem v-slot="{ active }">
                  <router-link to="/dashboard"
                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">
                    {{ $t('nav.dashboard') }}
                  </router-link>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                  <router-link to="/profile"
                    :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">
                    {{ $t('nav.profile') }}
                  </router-link>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                  <button @click="authStore.logout"
                    :class="[active ? 'bg-gray-100' : '', 'block w-full text-left px-4 py-2 text-sm text-gray-700']">
                    {{ $t('nav.logout') }}
                  </button>
                  </MenuItem>
                </MenuItems>
              </Menu>
            </div>

            <!-- Mobile menu button -->
            <div class="md:hidden">
              <button @click="mobileMenuOpen = !mobileMenuOpen"
                class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary">
                <Bars3Icon v-if="!mobileMenuOpen" class="block h-6 w-6" />
                <XMarkIcon v-else class="block h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <div v-show="mobileMenuOpen" class="md:hidden border-t border-gray-200">
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white">
          <a href="#features"
            class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
            {{ $t('nav.features') }}
          </a>
          <a href="#how-it-works"
            class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
            {{ $t('nav.howItWorks') }}
          </a>
          <!-- <a href="#pricing"
            class="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50">
            {{ $t('nav.pricing') }}
          </a> -->
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="pt-16">
      <!-- Hero Section -->
      <section class="flex flex-col items-center justify-center text-center mt-16 mx-auto px-4 max-md:px-2">
        <div class="animate-fade-in">
          <h1 class="text-black hero-title font-extrabold max-w-4xl md:max-w-3xl">
            {{ $t('hero.title') }}
          </h1>
          <p
            class="max-w-xl text-xl text-black font-medium text-center leading-7 mt-8 md:text-base md:leading-6 md:mt-4 md:px-2">
            {{ $t('hero.subtitle') }}
          </p>
          <!-- Centered first CTA button -->
          <div class="flex justify-center mt-15 md:mt-10 md:mb-15">
            <button @click="authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login()"
              class="btn-rounded pulse-glow min-w-60 min-h-14 flex items-center gap-2 justify-center md:px-5">
              {{ $t('hero.tryFree') }}
            </button>
          </div>
        </div>

        <!-- Statistics Section -->
        <div class="animate-fade-in [animation-delay:200ms] mt-21 md:mt-10">
          <section class="flex w-full max-w-4xl gap-5 text-black flex-wrap justify-center mx-auto px-4 md:px-4">
            <div class="bg-neutral-100 min-w-60 grow shrink basis-80 px-7 py-8 rounded-32 md:px-5">
              <div class="text-44 font-semibold leading-none tracking-tight">~ 1 {{ $t('stats.minute') }}</div>
              <div class="w-full text-2xl font-medium leading-8 mt-6">{{ $t('stats.analysisTime') }}</div>
            </div>
            <div class="bg-neutral-100 min-w-60 grow shrink basis-80 px-7 py-8 rounded-32 md:px-5">
              <div class="text-44 font-semibold leading-none tracking-tight">99.9%</div>
              <div class="w-full text-2xl font-medium leading-8 mt-6">{{ $t('stats.accuracy') }}</div>
            </div>
            <div class="bg-neutral-100 min-w-60 grow shrink basis-80 px-7 py-8 rounded-32 md:px-5">
              <div class="text-44 font-semibold leading-none tracking-tight">24/7</div>
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
                  <button class="btn-primary  bg-black text-white border-black hover:bg-white hover:text-black w-full">
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
                  <p class="text-white/60 text-xl font-medium leading-7 tracking-tight max-w-md mt-5 md:text-base">
                    {{ $t('cta.subtitle') }}
                  </p>
                </div>
                <!-- Fixed mask button structure -->
                <div class="btn-mask-container mt-12 md:mt-10">
                  <button @click="authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login()"
                    class="btn-primary btn-mask-1 min-w-60 min-h-14 px-7">
                    <!-- Hidden text for mask button -->
                    {{ $t('cta.button') }}
                  </button>
                  <div class="btn-mask-overlay">
                    {{ $t('cta.button') }}
                  </div>
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
            <button @click="authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login()"
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
                    <button @click="authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login()"
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
                    <button @click="authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login()"
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
            <button @click="authStore.isAuthenticated ? $router.push('/dashboard') : authStore.login()"
              class="btn-circle w-65 h-65 flex justify-center items-center flex-col gap-5 text-xl font-medium whitespace-pre-line leading-tight text-center">
              <ArrowRightIcon class="w-12 h-12 text-black" />
              {{ $t('finalCta.button') }}
            </button>
          </div>
        </section>
      </div>
    </main>

    <!-- Footer -->
    <footer
      class="flex w-full max-w-4xl flex-col md:flex-row items-center gap-6 md:gap-10 justify-between mt-27 py-4 px-8 rounded-47 md:mt-10 mx-auto">
      <div class="order-1 md:order-none">
        <div class="text-2xl font-bold text-primary">ATABAI</div>
      </div>
      <div class="flex items-center gap-3 order-2 md:order-none">
        <!-- Telegram Button -->
        <button @click="window.open('https://t.me/atabai_official', '_blank')"
          class="btn-ghost hover-glow p-3 rounded-full" title="Telegram">
          <TelegramIcon size="20" />
        </button>

        <!-- Mail Button -->
        <button @click="window.open('mailto:contact@atabai.uz', '_blank')" class="btn-ghost hover-glow p-3 rounded-full"
          title="Email">
          <MailIcon size="20" />
        </button>

        <!-- Instagram Button -->
        <button @click="window.open('https://instagram.com/atabai.official', '_blank')"
          class="btn-ghost hover-glow p-3 rounded-full" title="Instagram">
          <InstagramIcon size="20" />
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import GoogleIcon from '@/components/icons/GoogleIcon.vue'
import TelegramIcon from '@/components/icons/TelegramIcon.vue'
import MailIcon from '@/components/icons/MailIcon.vue'
import InstagramIcon from '@/components/icons/InstagramIcon.vue'
import {
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
  GlobeAltIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
  ClockIcon,
  CalculatorIcon,
  CogIcon,
  CheckIcon,
  ArrowRightIcon
} from '@heroicons/vue/24/outline'

// Composables
import { useAuthStore } from '@/stores/auth'
import { availableLocales, changeLocale } from '@/utils/i18n'

const router = useRouter()
const { locale } = useI18n()
const authStore = useAuthStore()

// State
const mobileMenuOpen = ref(false)

// Computed
const currentLocale = computed(() => {
  return availableLocales.find(l => l.code === locale.value) || availableLocales[0]
})

// Methods
async function changeLanguage(newLocale) {
  await changeLocale(newLocale)
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

.rounded-47 {
  border-radius: 2.9375rem;
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