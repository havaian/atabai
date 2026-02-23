<template>
    <section class="hero-section">
        <!-- Background effects -->
        <div class="hero-bg-grid"></div>
        <div class="hero-glow-orb"></div>
        <div class="hero-particles" aria-hidden="true">
            <span v-for="n in 7" :key="n" class="hero-particle"></span>
        </div>

        <div class="hero-content">
            <div class="hero-badge">
                <span class="hero-badge-dot"></span>
                NSBU → IFRS Automation Platform
            </div>

            <h1 class="hero-title">
                Автоматизация <span class="hero-title-highlight">МСФО.</span><br>
                На основе ИИ.
            </h1>

            <p class="hero-subtitle">
                Превращайте финансовые данные в точные, готовые к аудиту отчеты МСФО — быстрее, дешевле и с полной
                прозрачностью.
            </p>

            <div class="hero-actions">
                <button class="hero-btn hero-btn-primary" @click="$emit('bookDemo')">
                    Забронировать демо
                    <ArrowRightIcon class="w-4 h-4" />
                </button>
                <button class="hero-btn hero-btn-secondary" @click="scrollToHowItWorks">
                    Как это работает
                </button>
            </div>
        </div>
    </section>
</template>

<script setup>
import { ArrowRightIcon } from '@heroicons/vue/24/outline'

defineEmits(['bookDemo'])

function scrollToHowItWorks() {
    const el = document.getElementById('how-it-works')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
}
</script>

<style scoped>
/* ===== HERO SECTION ===== */
.hero-section {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 6rem 1.5rem 2rem;
    overflow: hidden;
}

/* ===== BACKGROUND EFFECTS ===== */

/* Light: soft dot pattern */
.hero-bg-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(circle, rgba(149, 0, 255, 0.07) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse 60% 50% at 50% 40%, black 10%, transparent 60%);
    -webkit-mask-image: radial-gradient(ellipse 60% 50% at 50% 40%, black 10%, transparent 60%);
}
/* Glow orb — hidden in light, visible in dark */
.hero-glow-orb {
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    top: 10%;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    opacity: 0;
}

@keyframes heroOrbPulse {

    0%,
    100% {
        opacity: 0.7;
    }

    50% {
        opacity: 1;
    }
}

/* Particles — hidden in light, visible in dark */
.hero-particles {
    display: none;
}

.hero-particle {
    position: absolute;
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: #9500FF;
    opacity: 0;
    animation: heroParticleFloat linear infinite;
}

.hero-particle:nth-child(1) {
    left: 10%;
    animation-duration: 12s;
    animation-delay: 0s;
}

.hero-particle:nth-child(2) {
    left: 20%;
    animation-duration: 16s;
    animation-delay: 2s;
    width: 3px;
    height: 3px;
}

.hero-particle:nth-child(3) {
    left: 35%;
    animation-duration: 14s;
    animation-delay: 4s;
}

.hero-particle:nth-child(4) {
    left: 50%;
    animation-duration: 18s;
    animation-delay: 1s;
    width: 1.5px;
    height: 1.5px;
}

.hero-particle:nth-child(5) {
    left: 65%;
    animation-duration: 13s;
    animation-delay: 3s;
}

.hero-particle:nth-child(6) {
    left: 80%;
    animation-duration: 15s;
    animation-delay: 5s;
    width: 2.5px;
    height: 2.5px;
}

.hero-particle:nth-child(7) {
    left: 92%;
    animation-duration: 17s;
    animation-delay: 2.5s;
}

@keyframes heroParticleFloat {
    0% {
        opacity: 0;
        transform: translateY(100vh);
    }

    10% {
        opacity: 0.6;
    }

    90% {
        opacity: 0.6;
    }

    100% {
        opacity: 0;
        transform: translateY(-10vh);
    }
}

/* ===== HERO CONTENT ===== */
.hero-content {
    position: relative;
    z-index: 2;
    text-align: center;
    max-width: 860px;
    margin: 0 auto;
}

/* Badge */
.hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border-radius: 100px;
    font-size: 0.8rem;
    font-weight: 500;
    margin-bottom: 2rem;
    animation: heroFadeInDown 0.6s ease-out both;

    /* Light */
    border: 1px solid var(--landing-border-accent);
    background: var(--landing-surface);
    color: var(--landing-text-secondary);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.hero-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #9500FF;
    box-shadow: 0 0 8px rgba(149, 0, 255, 0.4);
    animation: heroDotPulse 2s ease-in-out infinite;
}

@keyframes heroDotPulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }
}
/* Title */
.hero-title {
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.03em;
    margin-bottom: 1.5rem;
    animation: heroFadeInUp 0.7s ease-out 0.1s both;
    color: var(--landing-text);
}

.hero-title-highlight {
    background: linear-gradient(135deg, #9500FF 0%, #B44DFF 50%, #7C3AED 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* Subtitle */
.hero-subtitle {
    font-size: clamp(1rem, 2vw, 1.15rem);
    font-weight: 400;
    color: var(--landing-text-secondary);
    max-width: 560px;
    margin: 0 auto 2.5rem;
    line-height: 1.65;
    animation: heroFadeInUp 0.7s ease-out 0.2s both;
}

/* Actions */
.hero-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    animation: heroFadeInUp 0.7s ease-out 0.3s both;
}

.hero-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    border-radius: 12px;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    border: none;
}

.hero-btn-primary {
    background: #9500FF;
    color: white;
    box-shadow: 0 4px 20px rgba(149, 0, 255, 0.25), 0 1px 4px rgba(149, 0, 255, 0.1);
}

.hero-btn-primary:hover {
    box-shadow: 0 8px 32px rgba(149, 0, 255, 0.35), 0 2px 8px rgba(149, 0, 255, 0.15);
    background: #A020FF;
}

.hero-btn-secondary {
    background: var(--landing-surface);
    color: var(--landing-text);
    border: 1px solid var(--landing-border);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.hero-btn-secondary:hover {
    border-color: var(--landing-border-accent);
    background: rgba(149, 0, 255, 0.06);
}

/* ===== ANIMATIONS ===== */
@keyframes heroFadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes heroFadeInDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
    .hero-section {
        padding: 4rem 1rem 1.5rem;
    }

    .hero-actions {
        flex-direction: column;
        width: 100%;
    }

    .hero-btn {
        width: 100%;
        justify-content: center;
    }
}
</style>