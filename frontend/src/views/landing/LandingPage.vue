<template>
  <div class="landing-page min-h-screen">
    <main>
      <!-- Hero area: badge, title, CTA, transform visual, stats, trust -->
      <div class="landing-hero-area">
        <HeroSection @book-demo="openCalendlyPopup" />
        <TransformVisual />
        <StatsBar />
        <TrustBadges />
      </div>

      <!-- How it works: interactive timeline with live preview panel -->
      <HowItWorksSection />

      <!-- Who it's for: target audience cards -->
      <WhoItsForSection />

      <!-- Features: bento grid with hero cards -->
      <FeaturesSection />

      <!-- Final CTA -->
      <CTASection @book-demo="openCalendlyPopup" />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

// Landing section components
import HeroSection from '@/components/landing/HeroSection.vue'
import TransformVisual from '@/components/landing/TransformVisual.vue'
import StatsBar from '@/components/landing/StatsBar.vue'
import TrustBadges from '@/components/landing/TrustBadges.vue'
import HowItWorksSection from '@/components/landing/HowItWorksSection.vue'
import WhoItsForSection from '@/components/landing/WhoItsForSection.vue'
import FeaturesSection from '@/components/landing/FeaturesSection.vue'
import CTASection from '@/components/landing/CTASection.vue'

// Calendly
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

    const link = document.createElement('link')
    link.href = 'https://assets.calendly.com/assets/external/widget.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
})
</script>

<style scoped>
.landing-page {
    background: var(--landing-bg);
    transition: background 0.2s;
}

.landing-hero-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 2rem;
}
</style>