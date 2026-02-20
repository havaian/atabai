<template>
    <div class="stats-bar">
        <div v-for="stat in stats" :key="stat.label" class="stats-item">
            <div class="stats-value">
                {{ stat.value }}<span class="stats-value-accent">{{ stat.accent }}</span>
            </div>
            <div v-if="stat.oldValue" class="stats-comparison">
                <span class="stats-old">{{ stat.oldValue }}</span>
                <span class="stats-arrow">→</span>
                <span>{{ stat.newValue }}</span>
            </div>
            <div v-else class="stats-comparison">
                {{ stat.note }}
            </div>
            <div class="stats-description">{{ stat.label }}</div>
        </div>
    </div>
</template>

<script setup>
const stats = [
    {
        value: '~15',
        accent: ' сек',
        oldValue: '2-3 часа',
        newValue: '15 сек',
        label: 'Время обработки'
    },
    {
        value: '99.9',
        accent: '%',
        oldValue: '±12% ошибок',
        newValue: 'точно',
        label: 'Точность расчётов'
    },
    {
        value: '24',
        accent: '/7',
        oldValue: null,
        newValue: null,
        note: 'без выходных',
        label: 'Доступность'
    },
    {
        value: '60',
        accent: '%',
        oldValue: null,
        newValue: null,
        note: 'экономия времени',
        label: 'Эффективность'
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

:global(.dark) .stats-bar {
    background: var(--landing-border-accent);
    box-shadow: none;
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

:global(.dark) .stats-old {
    color: rgba(239, 68, 68, 0.5);
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