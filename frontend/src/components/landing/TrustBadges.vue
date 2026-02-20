<template>
    <div class="trust-row">
        <div v-for="badge in badges" :key="badge.label" class="trust-badge">
            <span class="trust-badge-icon">{{ badge.icon }}</span>
            {{ badge.label }}
        </div>
    </div>
</template>

<script setup>
const badges = [
    { icon: '📋', label: 'IAS 16' },
    { icon: '📊', label: 'IFRS 15' },
    { icon: '🔍', label: 'IAS 36' },
    { icon: '🇺🇿', label: 'Built for Uzbekistan' }
]
</script>

<style scoped>
.trust-row {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 2.5rem;
    flex-wrap: wrap;
    animation: tbFadeInUp 0.8s ease-out 0.9s both;
}

.trust-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 8px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;

    /* Light */
    color: var(--landing-text-muted);
    border: 1px solid var(--landing-border);
    background: var(--landing-surface);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

:global(.dark) .trust-badge {
    border-color: rgba(149, 0, 255, 0.06);
    background: var(--landing-surface);
    box-shadow: none;
}

.trust-badge-icon {
    font-size: 0.85rem;
}

@keyframes tbFadeInUp {
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
    .trust-row {
        gap: 0.75rem;
    }

    .trust-badge {
        font-size: 0.65rem;
        padding: 5px 10px;
    }
}
</style>