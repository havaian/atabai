<template>
    <section class="wif-section">
        <div class="wif-inner">
            <div class="wif-header">
                <span class="wif-label">{{ $t('landing.wif.label') }}</span>
                <h2 class="wif-title">{{ $t('landing.wif.title') }}</h2>
                <p class="wif-subtitle">{{ $t('landing.wif.subtitle') }}</p>
            </div>

            <div class="wif-grid">
                <div v-for="card in audiences" :key="card.key" class="wif-card">
                    <div class="wif-icon-wrap">
                        <component :is="card.icon" class="wif-icon" />
                    </div>
                    <h3 class="wif-card-title">{{ $t(`landing.wif.${card.key}.title`) }}</h3>
                    <p class="wif-card-desc">{{ $t(`landing.wif.${card.key}.desc`) }}</p>
                    <div class="wif-tags">
                        <span v-for="ti in card.tagCount" :key="ti" class="wif-tag mono">{{
                            $t(`landing.wif.${card.key}.tag${ti}`) }}</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
import {
    BuildingOfficeIcon,
    ChartBarSquareIcon,
    GlobeAltIcon
} from '@heroicons/vue/24/outline'

const audiences = [
    {
        key: 'sme',
        icon: BuildingOfficeIcon,
        tagCount: 3
    },
    {
        key: 'accounting',
        icon: ChartBarSquareIcon,
        tagCount: 3
    },
    {
        key: 'international',
        icon: GlobeAltIcon,
        tagCount: 3
    }
]
</script>

<style scoped>
.wif-section {
    padding: 6rem 1.5rem;
}

.wif-inner {
    max-width: 960px;
    margin: 0 auto;
}

.mono {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* Header */
.wif-header {
    text-align: center;
    margin-bottom: 3.5rem;
}

.wif-label {
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

.wif-title {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--landing-text);
}

.wif-subtitle {
    font-size: 1rem;
    color: var(--landing-text-secondary);
    max-width: 500px;
    margin: .75rem auto 0;
    line-height: 1.6;
}

/* Grid - equal height cards */
.wif-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
    align-items: stretch;
}

/* Card - flex column for consistent alignment */
.wif-card {
    border-radius: 20px;
    padding: 2rem;
    border: 1px solid var(--landing-border);
    background: var(--landing-surface);
    transition: all .3s;
    display: flex;
    flex-direction: column;
}

.wif-card:hover {
    border-color: var(--landing-border-accent);
    box-shadow: 0 8px 30px rgba(149, 0, 255, 0.06);
}

/* Icon instead of emoji */
.wif-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1.25rem;
    color: #9500FF;
    background: rgba(149, 0, 255, 0.06);
    border: 1px solid var(--landing-border-accent);
}

.wif-icon {
    width: 26px;
    height: 26px;
}

.wif-card-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--landing-text);
    margin-bottom: .5rem;
}

.wif-card-desc {
    font-size: .85rem;
    color: var(--landing-text-secondary);
    line-height: 1.6;
    flex: 1;
}

/* Tags pinned to bottom */
.wif-tags {
    display: flex;
    flex-wrap: wrap;
    gap: .4rem;
    margin-top: 1.25rem;
}

.wif-tag {
    font-size: .65rem;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(149, 0, 255, 0.06);
    color: #9500FF;
    border: 1px solid var(--landing-border-accent);
}

@media (max-width: 768px) {
    .wif-section {
        padding: 4rem 1rem;
    }

    .wif-grid {
        grid-template-columns: 1fr;
    }
}
</style>