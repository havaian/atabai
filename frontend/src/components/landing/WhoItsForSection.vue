<template>
    <section class="wif-section">
        <div class="wif-inner">
            <div class="wif-header">
                <span class="wif-label">Для кого</span>
                <h2 class="wif-title">Кому подходит ATABAI</h2>
                <p class="wif-subtitle">Для компаний, которым нужна МСФО отчётность без лишних затрат</p>
            </div>

            <div class="wif-grid">
                <div v-for="card in audiences" :key="card.title" class="wif-card">
                    <span class="wif-emoji">{{ card.emoji }}</span>
                    <h3 class="wif-card-title">{{ card.title }}</h3>
                    <p class="wif-card-desc">{{ card.desc }}</p>
                    <div class="wif-tags">
                        <span v-for="tag in card.tags" :key="tag" class="wif-tag mono">{{ tag }}</span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
const audiences = [
    {
        emoji: '🏢',
        title: 'МСП Узбекистана',
        desc: 'Малые и средние предприятия, которые выходят на международный рынок и нуждаются в МСФО отчётности для партнёров и инвесторов.',
        tags: ['Экспорт', 'Инвесторы', 'Кредиты']
    },
    {
        emoji: '📊',
        title: 'Бухгалтерские фирмы',
        desc: 'Аудиторские и консалтинговые компании, обслуживающие клиентов с требованиями международной отчётности. Автоматизация рутины.',
        tags: ['Аудит', 'Консалтинг', 'Масштаб']
    },
    {
        emoji: '🌍',
        title: 'Международные компании',
        desc: 'Компании с филиалами в Узбекистане, которым нужна консолидация отчётности в единый формат МСФО для головного офиса.',
        tags: ['Консолидация', 'Филиалы', 'HQ']
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

/* Grid */
.wif-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
}

/* Card */
.wif-card {
    border-radius: 20px;
    padding: 2rem;
    border: 1px solid var(--landing-border);
    background: var(--landing-surface);
    transition: all .3s;
}

.wif-card:hover {
    border-color: var(--landing-border-accent);
    box-shadow: 0 8px 30px rgba(149, 0, 255, 0.06);
}

:global(.dark) .wif-card:hover {
    box-shadow: 0 8px 30px rgba(149, 0, 255, 0.1);
}

.wif-emoji {
    font-size: 2.5rem;
    margin-bottom: 1.25rem;
    display: block;
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
    margin-bottom: 1.25rem;
}

.wif-tags {
    display: flex;
    flex-wrap: wrap;
    gap: .4rem;
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