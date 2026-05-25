<template>
    <div class="stats-bar">
        <div v-for="stat in stats" :key="stat.labelKey" class="stats-item">
            <div class="stats-value">
                {{ stat.value }}<span class="stats-value-accent">{{ $t(stat.accentKey) }}</span>
            </div>
            <div v-if="stat.oldKey" class="stats-comparison">
                <span class="stats-old">{{ $t(stat.oldKey) }}</span>
                <span class="stats-arrow">→</span>
                <span>{{ $t(stat.newKey) }}</span>
            </div>
            <div v-else class="stats-comparison">
                {{ $t(stat.noteKey) }}
            </div>
            <div class="stats-description">{{ $t(stat.labelKey) }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
// Translation keys live under stats.* in the locale files.
// Numeric values stay hardcoded — they're locale-agnostic.
const stats = [
    {
        value: '~15',
        accentKey: 'stats.seconds',
        oldKey: 'stats.timeOld',
        newKey: 'stats.timeNew',
        labelKey: 'stats.analysisTime'
    },
    {
        value: '99.9',
        accentKey: 'stats.percent',
        oldKey: 'stats.accuracyOld',
        newKey: 'stats.accuracyNew',
        labelKey: 'stats.accuracy'
    },
    {
        value: '24',
        accentKey: 'stats.slashSeven',
        oldKey: null,
        newKey: null,
        noteKey: 'stats.availabilityNote',
        labelKey: 'stats.availability'
    },
    {
        value: '60',
        accentKey: 'stats.percent',
        oldKey: null,
        newKey: null,
        noteKey: 'stats.efficiencyNote',
        labelKey: 'stats.timeSaving'
    }
]
</script>

<style scoped>
.stats-bar {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    margin-top: 4rem;
    width: 100%;
    max-width: 900px;
    border-radius: 16px;
    overflow: hidden;
    animation: sbFadeInUp 0.8s ease-out 0.7s both;

    /* Light */
    background: var(--landing-border);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
}

.stats-item {
    padding: 1.5rem;
    text-align: center;
    background: var(--landing-surface);
}

.stats-value {
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
    color: var(--landing-text);
}

.stats-value-accent {
    color: #9500FF;
}

.stats-comparison {
    font-size: 0.7rem;
    color: var(--landing-text-muted);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.stats-old {
    text-decoration: line-through;
    color: rgba(220, 38, 38, 0.5);
}

.stats-arrow {
    color: #9500FF;
    margin: 0 4px;
}

.stats-description {
    font-size: 0.78rem;
    color: var(--landing-text-secondary);
    font-weight: 500;
    margin-top: 6px;
}

@keyframes sbFadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@media (max-width: 768px) {
    .stats-bar {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>