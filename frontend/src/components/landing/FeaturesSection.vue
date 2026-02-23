<template>
    <section id="features" class="feat-section">
        <div class="feat-inner">
            <div class="feat-header">
                <span class="feat-label">{{ $t('landing.feat.label') }}</span>
                <h2 class="feat-title">{{ $t('landing.feat.title') }}</h2>
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
                            <span class="bf-node mono">НСБУ</span>
                            <span class="bf-arr">→</span>
                            <span class="bf-node bf-node-hl mono">ATABAI</span>
                            <span class="bf-arr">→</span>
                            <span class="bf-node mono">МСФО</span>
                        </div>
                        <div class="bf-flow-formats mono">
                            <span>.xlsx</span>
                            <span></span>
                            <span>AI</span>
                            <span></span>
                            <span>.xlsx</span>
                        </div>
                    </div>
                </div>

                <!-- Hero card 2: Accuracy (spans 2 rows) -->
                <div class="bf bf-hero">
                    <div class="bf-icon">
                        <ShieldCheckIcon class="w-6 h-6" />
                    </div>
                    <h3 class="bf-title bf-title-lg">{{ $t('features.compliance.title') }}</h3>
                    <p class="bf-desc">{{ $t('landing.feat.accuracyDesc') }}</p>
                    <div class="bf-visual">
                        <div class="bf-metrics">
                            <div class="bf-metric">
                                <div class="bf-metric-val">99.9<span>%</span></div>
                                <div class="bf-metric-lbl mono">{{ $t('stats.accuracy') }}</div>
                            </div>
                            <div class="bf-metric">
                                <div class="bf-metric-val">0<span>%</span></div>
                                <div class="bf-metric-lbl mono">{{ $t('landing.feat.hardcode') }}</div>
                            </div>
                            <div class="bf-metric">
                                <div class="bf-metric-val">100<span>%</span></div>
                                <div class="bf-metric-lbl mono">{{ $t('landing.feat.formulas') }}</div>
                            </div>
                            <div class="bf-metric">
                                <div class="bf-metric-val">✓</div>
                                <div class="bf-metric-lbl mono">{{ $t('landing.feat.auditReady') }}</div>
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
                        <CloudArrowUpIcon class="w-6 h-6" />
                    </div>
                    <h3 class="bf-title">{{ $t('landing.feat.cloud.title') }}</h3>
                    <p class="bf-desc">{{ $t('landing.feat.cloud.desc') }}</p>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
import {
    DocumentCheckIcon, ShieldCheckIcon, ClockIcon,
    CogIcon, GlobeAltIcon, CloudArrowUpIcon
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
    padding: 1.25rem;
    border-radius: 14px;
    background: var(--landing-surface-2);
    border: 1px solid var(--landing-border);
}

/* Flow diagram — compact, no wrap */
.bf-flow {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    align-items: center;
    gap: .5rem;
    text-align: center;
}

.bf-node {
    padding: .5rem .5rem;
    border-radius: 8px;
    font-size: .72rem;
    font-weight: 600;
    background: var(--landing-surface);
    border: 1px solid var(--landing-border);
    color: var(--landing-text-secondary);
    white-space: nowrap;
}

.bf-node-hl {
    border-color: #9500FF;
    color: #9500FF;
    background: rgba(149, 0, 255, 0.06);
}

.bf-arr {
    color: #9500FF;
    font-size: .85rem;
    text-align: center;
}

.bf-flow-formats {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    align-items: center;
    gap: .5rem;
    text-align: center;
    margin-top: .35rem;
    font-size: .6rem;
    color: var(--landing-text-muted);
}

/* Metrics grid */
.bf-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: .625rem;
}

.bf-metric {
    text-align: center;
    padding: .75rem .5rem;
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
    font-size: .6rem;
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
}
</style>