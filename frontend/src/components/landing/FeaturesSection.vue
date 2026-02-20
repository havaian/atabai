<template>
    <section id="features" class="feat-section">
        <div class="feat-inner">
            <div class="feat-header">
                <span class="feat-label">Возможности</span>
                <h2 class="feat-title">Почему ATABAI</h2>
            </div>

            <div class="feat-bento">
                <!-- Hero card 1: Automation (spans 2 rows) -->
                <div class="bf bf-hero">
                    <div class="bf-icon">
                        <DocumentCheckIcon class="w-6 h-6" />
                    </div>
                    <h3 class="bf-title bf-title-lg">{{ $t('features.automation.title') }}</h3>
                    <p class="bf-desc">{{ $t('features.automation.description') }}</p>
                    <div class="bf-visual">
                        <div class="bf-flow">
                            <span class="bf-node mono">НСБУ .xlsx</span>
                            <span class="bf-arr">→</span>
                            <span class="bf-node bf-node-hl mono">ATABAI AI</span>
                            <span class="bf-arr">→</span>
                            <span class="bf-node mono">МСФО .xlsx</span>
                        </div>
                    </div>
                </div>

                <!-- Hero card 2: Accuracy (spans 2 rows) -->
                <div class="bf bf-hero">
                    <div class="bf-icon">
                        <ShieldCheckIcon class="w-6 h-6" />
                    </div>
                    <h3 class="bf-title bf-title-lg">{{ $t('features.accuracy.title') }}</h3>
                    <p class="bf-desc">{{ $t('features.accuracy.description') }}</p>
                    <div class="bf-visual">
                        <div class="bf-metrics">
                            <div class="bf-metric">
                                <div class="bf-metric-val">99.9<span>%</span></div>
                                <div class="bf-metric-lbl mono">Точность</div>
                            </div>
                            <div class="bf-metric">
                                <div class="bf-metric-val">0<span>%</span></div>
                                <div class="bf-metric-lbl mono">Хардкод</div>
                            </div>
                            <div class="bf-metric">
                                <div class="bf-metric-val">100<span>%</span></div>
                                <div class="bf-metric-lbl mono">Формулы</div>
                            </div>
                            <div class="bf-metric">
                                <div class="bf-metric-val">✓</div>
                                <div class="bf-metric-lbl mono">Аудит-ready</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Small cards -->
                <div class="bf">
                    <div class="bf-icon">
                        <ClockIcon class="w-6 h-6" />
                    </div>
                    <h3 class="bf-title">{{ $t('features.speed.title') }}</h3>
                    <p class="bf-desc">{{ $t('features.speed.description') }}</p>
                </div>
                <div class="bf">
                    <div class="bf-icon">
                        <CogIcon class="w-6 h-6" />
                    </div>
                    <h3 class="bf-title">{{ $t('features.easy.title') }}</h3>
                    <p class="bf-desc">{{ $t('features.easy.description') }}</p>
                </div>
                <div class="bf">
                    <div class="bf-icon">
                        <GlobeAltIcon class="w-6 h-6" />
                    </div>
                    <h3 class="bf-title">{{ $t('features.universal.title') }}</h3>
                    <p class="bf-desc">{{ $t('features.universal.description') }}</p>
                </div>
                <div class="bf">
                    <div class="bf-icon">
                        <ClockIcon class="w-6 h-6" />
                    </div>
                    <h3 class="bf-title">24/7 доступ</h3>
                    <p class="bf-desc">Облачная платформа — работайте когда удобно, откуда угодно, без установки.</p>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
import {
    DocumentCheckIcon, ShieldCheckIcon, ClockIcon,
    CogIcon, GlobeAltIcon
} from '@heroicons/vue/24/outline'
</script>

<style scoped>
.feat-section {
    padding: 6rem 1.5rem;
}

.feat-inner {
    max-width: 960px;
    margin: 0 auto;
}

.mono {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* Header */
.feat-header {
    text-align: center;
    margin-bottom: 3.5rem;
}

.feat-label {
    display: inline-block;
    font-size: .75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .1em;
    color: #9500FF;
    margin-bottom: 1rem;
    padding: 4px 14px;
    border-radius: 100px;
    background: rgba(149, 0, 255, 0.06);
    border: 1px solid var(--landing-border-accent);
}

.feat-title {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--landing-text);
}

/* Bento grid */
.feat-bento {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto auto;
    gap: 1.25rem;
}

/* Card base */
.bf {
    border-radius: 20px;
    padding: 2rem;
    border: 1px solid var(--landing-border);
    background: var(--landing-surface);
    transition: all .3s;
}

.bf:hover {
    border-color: var(--landing-border-accent);
    box-shadow: 0 8px 30px rgba(149, 0, 255, 0.06);
}

:global(.dark) .bf:hover {
    box-shadow: 0 8px 30px rgba(149, 0, 255, 0.1);
}

/* Hero cards span 2 rows */
.bf-hero {
    grid-row: span 2;
    padding: 2.5rem;
}

/* Icon */
.bf-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.25rem;
    color: #9500FF;
    background: rgba(149, 0, 255, 0.06);
    border: 1px solid var(--landing-border-accent);
}

/* Title */
.bf-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--landing-text);
    margin-bottom: .5rem;
}

.bf-title-lg {
    font-size: 1.35rem;
}

/* Description */
.bf-desc {
    font-size: .85rem;
    color: var(--landing-text-secondary);
    line-height: 1.6;
}

/* Visual container */
.bf-visual {
    margin-top: 1.5rem;
    padding: 1.5rem;
    border-radius: 14px;
    background: var(--landing-surface-2);
    border: 1px solid var(--landing-border);
}

/* Flow diagram */
.bf-flow {
    display: flex;
    align-items: center;
    gap: .75rem;
    flex-wrap: wrap;
}

.bf-node {
    padding: .5rem .85rem;
    border-radius: 8px;
    font-size: .7rem;
    font-weight: 500;
    background: var(--landing-surface);
    border: 1px solid var(--landing-border);
    color: var(--landing-text-secondary);
}

.bf-node-hl {
    border-color: #9500FF;
    color: #9500FF;
    background: rgba(149, 0, 255, 0.06);
}

.bf-arr {
    color: #9500FF;
    font-size: .85rem;
}

/* Metrics grid */
.bf-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: .75rem;
}

.bf-metric {
    text-align: center;
    padding: .75rem;
    border-radius: 10px;
    background: var(--landing-surface);
    border: 1px solid var(--landing-border);
}

.bf-metric-val {
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--landing-text);
}

.bf-metric-val span {
    color: #9500FF;
}

.bf-metric-lbl {
    font-size: .65rem;
    color: var(--landing-text-muted);
    margin-top: 2px;
}

@media (max-width: 768px) {
    .feat-section {
        padding: 4rem 1rem;
    }

    .feat-bento {
        grid-template-columns: 1fr;
    }

    .bf-hero {
        grid-row: auto;
    }

    .bf-flow {
        justify-content: center;
    }
}

@media (min-width: 769px) and (max-width: 1024px) {
    .bf-flow {
        justify-content: center;
    }
}
</style>