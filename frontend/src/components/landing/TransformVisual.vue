<template>
    <div class="transform-visual">
        <div class="transform-container">
            <!-- Before: NSBU -->
            <div class="sheet-card sheet-before">
                <div class="sheet-header">
                    <div class="sheet-label sheet-label-nsbu">
                        <span class="sheet-label-dot"></span>
                        НСБУ
                    </div>
                    <span class="sheet-tag sheet-tag-nsbu">.xlsx</span>
                </div>
                <div class="sheet-body">
                    <div class="sheet-row sheet-row-header">
                        <div class="sheet-cell">Статья</div>
                        <div class="sheet-cell sheet-cell-value">Сумма (сум)</div>
                    </div>
                    <div class="sheet-row">
                        <div class="sheet-cell">010 — Осн. средства</div>
                        <div class="sheet-cell sheet-cell-value">1,250,000</div>
                    </div>
                    <div class="sheet-row">
                        <div class="sheet-cell">020 — Амортизация</div>
                        <div class="sheet-cell sheet-cell-value">-320,000</div>
                    </div>
                    <div class="sheet-row sheet-row-error">
                        <div class="sheet-cell">⚠ Ручной расчёт</div>
                        <div class="sheet-cell sheet-cell-value">Ошибка ±12%</div>
                    </div>
                </div>
            </div>

            <!-- Arrow connector -->
            <div class="transform-arrow">
                <div class="transform-arrow-circle">
                    <ArrowRightIcon class="w-5 h-5" />
                </div>
                <span class="transform-arrow-label">~ 15 сек</span>
            </div>

            <!-- After: IFRS -->
            <div class="sheet-card sheet-after">
                <div class="sheet-header">
                    <div class="sheet-label sheet-label-ifrs">
                        <span class="sheet-label-dot"></span>
                        МСФО / IFRS
                    </div>
                    <span class="sheet-tag sheet-tag-ifrs">IAS 16</span>
                </div>
                <div class="sheet-body">
                    <div class="sheet-row sheet-row-header">
                        <div class="sheet-cell">Line Item</div>
                        <div class="sheet-cell sheet-cell-value">Amount (UZS)</div>
                    </div>
                    <div class="sheet-row">
                        <div class="sheet-cell">PPE — Cost</div>
                        <div class="sheet-cell sheet-cell-value">1,250,000</div>
                    </div>
                    <div class="sheet-row">
                        <div class="sheet-cell">Accum. Depr.</div>
                        <div class="sheet-cell sheet-cell-value">-312,500</div>
                    </div>
                    <div class="sheet-row sheet-row-success">
                        <div class="sheet-cell">✓ IAS 16 compliant</div>
                        <div class="sheet-cell sheet-cell-value">Validated</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ArrowRightIcon } from '@heroicons/vue/24/outline'
</script>

<style scoped>
.transform-visual {
    position: relative;
    z-index: 2;
    margin-top: 4rem;
    width: 100%;
    max-width: 900px;
    animation: tvFadeInUp 0.8s ease-out 0.5s both;
}

.transform-container {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1.5rem;
    align-items: center;
}

/* ===== SHEET CARD ===== */
.sheet-card {
    border-radius: 16px;
    overflow: hidden;

    /* Light */
    background: var(--landing-surface);
    border: 1px solid var(--landing-border);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04), 0 1px 4px rgba(0, 0, 0, 0.02);
}

.sheet-before {
    border-color: rgba(220, 38, 38, 0.12);
}

.sheet-after {
    border-color: rgba(22, 163, 74, 0.15);
    box-shadow: 0 4px 24px rgba(22, 163, 74, 0.06), 0 1px 4px rgba(0, 0, 0, 0.02);
}

/* Header */
.sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--landing-border);
    background: var(--landing-surface-2);
}

.sheet-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.sheet-label-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.sheet-label-nsbu {
    color: #DC2626;
}

.sheet-label-nsbu .sheet-label-dot {
    background: #DC2626;
}

.sheet-label-ifrs {
    color: #16A34A;
}

.sheet-label-ifrs .sheet-label-dot {
    background: #16A34A;
}

/* Tags */
.sheet-tag {
    font-size: 0.65rem;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.sheet-tag-nsbu {
    background: rgba(220, 38, 38, 0.06);
    color: #DC2626;
}

.sheet-tag-ifrs {
    background: rgba(22, 163, 74, 0.06);
    color: #16A34A;
}

/* Body & rows */
.sheet-body {
    padding: 0;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.7rem;
}

.sheet-row {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    border-bottom: 1px solid var(--landing-border);
}

.sheet-row:last-child {
    border-bottom: none;
}

.sheet-row-header {
    background: var(--landing-surface-2);
}

.sheet-row-header .sheet-cell {
    font-weight: 600;
    color: var(--landing-text-muted);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.sheet-cell {
    padding: 10px 16px;
    color: var(--landing-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sheet-cell-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
}

.sheet-row-error .sheet-cell {
    color: #DC2626;
}

.sheet-row-success .sheet-cell {
    color: #16A34A;
}

/* ===== ARROW CONNECTOR ===== */
.transform-arrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.transform-arrow-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9500FF;
    animation: tvArrowPulse 2.5s ease-in-out infinite;

    /* Light */
    background: var(--landing-surface);
    border: 1px solid var(--landing-border-accent);
    box-shadow: 0 2px 12px rgba(149, 0, 255, 0.08);
}

@keyframes tvArrowPulse {

    0%,
    100% {
        box-shadow: 0 2px 12px rgba(149, 0, 255, 0.08);
    }

    50% {
        box-shadow: 0 4px 24px rgba(149, 0, 255, 0.18);
    }
}

.transform-arrow-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: #9500FF;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

/* ===== ANIMATIONS ===== */
@keyframes tvFadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
    .transform-container {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .transform-arrow {
        flex-direction: row;
    }

    .transform-arrow-circle svg {
        transform: rotate(90deg);
    }
}
</style>