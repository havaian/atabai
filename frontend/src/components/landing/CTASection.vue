<template>
    <section class="cta-section">
        <div class="cta-inner">
            <div class="cta-card">
                <div class="cta-glow" aria-hidden="true"></div>
                <div class="cta-content">
                    <h2 class="cta-title">{{ $t('finalCta.title') }}</h2>
                    <p class="cta-subtitle">{{ $t('finalCta.subtitle') }}</p>
                    <button class="cta-btn" @click="$emit('bookDemo')">
                        {{ $t('finalCta.button') }}
                        <ArrowRightIcon class="w-5 h-5" />
                    </button>
                </div>
                <!-- Decorative corners -->
                <div class="cta-corner cta-corner-tl" aria-hidden="true"></div>
                <div class="cta-corner cta-corner-br" aria-hidden="true"></div>
            </div>
        </div>
    </section>
</template>

<script setup>
import { ArrowRightIcon } from '@heroicons/vue/24/outline'
defineEmits(['bookDemo'])
</script>

<style scoped>
.cta-section {
    padding: 2rem 1.5rem 6rem;
}

.cta-inner {
    max-width: 960px;
    margin: 0 auto;
}

.cta-card {
    position: relative;
    border-radius: 24px;
    padding: 4rem 2rem;
    text-align: center;
    overflow: hidden;
    background: linear-gradient(135deg, #9500FF 0%, #7C3AED 40%, #5B21B6 100%);
}

.cta-glow {
    position: absolute;
    width: 400px;
    height: 400px;
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 60%);
    pointer-events: none;
}

.cta-corner {
    position: absolute;
    width: 120px;
    height: 120px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    pointer-events: none;
}

.cta-corner-tl {
    top: -20px;
    left: -20px;
    border-right: none;
    border-bottom: none;
}

.cta-corner-br {
    bottom: -20px;
    right: -20px;
    border-left: none;
    border-top: none;
}

.cta-content {
    position: relative;
    z-index: 2;
}

.cta-title {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: white;
    margin-bottom: 1rem;
    line-height: 1.1;
}

.cta-subtitle {
    font-size: clamp(.95rem, 2vw, 1.1rem);
    color: rgba(255, 255, 255, 0.65);
    max-width: 420px;
    margin: 0 auto 2.5rem;
    line-height: 1.6;
}

.cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 36px;
    border-radius: 12px;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all .3s;
    border: none;
    background: white;
    color: #5B21B6;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.cta-btn:hover {
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
    .cta-section {
        padding: 1.5rem 1rem 4rem;
    }

    .cta-card {
        padding: 3rem 1.5rem;
        border-radius: 20px;
    }

    .cta-btn {
        width: 100%;
        justify-content: center;
    }
}
</style>