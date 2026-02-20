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

/* Hero area wrapper */
.landing-hero-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 2rem;
}
</style>