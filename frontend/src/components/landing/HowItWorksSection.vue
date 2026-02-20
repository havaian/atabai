<template>
    <section id="how-it-works" class="hiw-section">
        <div class="hiw-inner">
            <div class="hiw-header">
                <span class="hiw-label">{{ $t('landing.hiw.label') }}</span>
                <h2 class="hiw-title">{{ $t('howItWorks.title') }}</h2>
                <p class="hiw-subtitle">{{ $t('landing.hiw.subtitle') }}</p>
            </div>

            <div class="hiw-layout">
                <!-- Timeline sidebar -->
                <div class="hiw-timeline">
                    <div v-for="(step, i) in steps" :key="i" :class="['hiw-step', { active: activeStep === i }]"
                        @click="activeStep = i">
                        <div class="hiw-num">{{ String(i + 1).padStart(2, '0') }}</div>
                        <div class="hiw-step-info">
                            <div class="hiw-step-title">{{ $t(`howItWorks.step${i + 1}.title`) }}</div>
                            <div class="hiw-step-desc">{{ $t(`howItWorks.step${i + 1}.description`) }}</div>
                        </div>
                    </div>
                </div>

                <!-- Preview panel -->
                <div class="hiw-preview">
                    <Transition name="panel-fade" mode="out-in">
                        <!-- Panel 0: Upload -->
                        <div v-if="activeStep === 0" key="upload" class="hiw-panel">
                            <div class="p-upload-zone">
                                <CloudArrowUpIcon class="p-upload-icon" />
                                <p class="p-upload-text">{{ $t('howItWorks.step1.uploadText') }}</p>
                                <p class="p-upload-hint mono">{{ $t('howItWorks.step1.supportedFormats') }}</p>
                                <div class="p-upload-chips">
                                    <span class="p-chip mono">.xlsx</span>
                                    <span class="p-chip mono">.xls</span>
                                    <span class="p-chip mono">.csv</span>
                                </div>
                            </div>
                        </div>

                        <!-- Panel 1: Templates -->
                        <div v-else-if="activeStep === 1" key="templates" class="hiw-panel">
                            <div class="p-tmpl-list">
                                <button v-for="tmpl in templates" :key="tmpl.key"
                                    :class="['p-tmpl-item', { 'p-tmpl-active': selectedTemplate === tmpl.key }]"
                                    @click="selectedTemplate = tmpl.key">
                                    <component :is="tmpl.icon" class="p-tmpl-icon" />
                                    <div class="p-tmpl-info">
                                        <span class="p-tmpl-name">{{ $t(`templates.${tmpl.key}`) }}</span>
                                        <span class="p-tmpl-std mono">{{ tmpl.std }}</span>
                                    </div>
                                    <div v-if="selectedTemplate === tmpl.key" class="p-tmpl-check">✓</div>
                                </button>
                            </div>
                        </div>

                        <!-- Panel 2: Processing -->
                        <div v-else-if="activeStep === 2" key="processing" class="hiw-panel">
                            <div class="p-proc">
                                <div class="p-proc-bar">
                                    <div class="p-proc-bar-fill"></div>
                                </div>
                                <div class="p-proc-steps">
                                    <div class="p-proc-item"><span class="p-proc-check p-proc-done">✓</span><span>{{
                                            $t('landing.hiw.proc.read') }}</span></div>
                                    <div class="p-proc-item"><span class="p-proc-check p-proc-done">✓</span><span>{{
                                            $t('landing.hiw.proc.structure') }}</span></div>
                                    <div class="p-proc-item"><span class="p-proc-check p-proc-done">✓</span><span>{{
                                            $t('landing.hiw.proc.mapping') }}</span></div>
                                    <div class="p-proc-item"><span class="p-proc-check p-proc-prog">⟳</span><span>{{
                                            $t('landing.hiw.proc.formulas') }}</span></div>
                                </div>
                            </div>
                        </div>

                        <!-- Panel 3: Result -->
                        <div v-else key="result" class="hiw-panel">
                            <div class="p-result">
                                <div class="p-result-grid">
                                    <div class="p-res-sheet p-res-before mono">
                                        <div class="p-res-hd">
                                            <div class="p-res-label p-res-label-r"><span class="p-res-dot"></span> {{
                                                $t('howItWorks.step4.before') }}</div><span
                                                class="p-res-tag p-res-tag-r">НСБУ</span>
                                        </div>
                                        <div class="p-res-body">
                                            <div class="p-res-row p-res-row-h">
                                                <div class="p-res-c">{{
                                                    $t('howItWorks.step4.spreadsheet.depreciation.before.headers.item')
                                                    }}</div>
                                                <div class="p-res-c">{{
                                                    $t('howItWorks.step4.spreadsheet.depreciation.before.headers.amount')
                                                    }}</div>
                                            </div>
                                            <div class="p-res-row">
                                                <div class="p-res-c">{{
                                                    $t('howItWorks.step4.spreadsheet.depreciation.before.data.ppe') }}
                                                </div>
                                                <div class="p-res-c">1,250,000</div>
                                            </div>
                                            <div class="p-res-row p-res-row-e">
                                                <div class="p-res-c">⚠ {{
                                                    $t('howItWorks.step4.spreadsheet.depreciation.before.data.error') }}
                                                </div>
                                                <div class="p-res-c">±12%</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="p-res-arrow">
                                        <div class="p-res-arrow-c">
                                            <ArrowRightIcon class="w-4 h-4" />
                                        </div>
                                    </div>
                                    <div class="p-res-sheet p-res-after mono">
                                        <div class="p-res-hd">
                                            <div class="p-res-label p-res-label-g"><span class="p-res-dot"></span> {{
                                                $t('howItWorks.step4.after') }}</div><span
                                                class="p-res-tag p-res-tag-g">IFRS</span>
                                        </div>
                                        <div class="p-res-body">
                                            <div class="p-res-row p-res-row-h">
                                                <div class="p-res-c">Line Item</div>
                                                <div class="p-res-c">Amount</div>
                                            </div>
                                            <div class="p-res-row">
                                                <div class="p-res-c">PPE — Cost</div>
                                                <div class="p-res-c">1,250,000</div>
                                            </div>
                                            <div class="p-res-row p-res-row-s">
                                                <div class="p-res-c">✓ IAS 16</div>
                                                <div class="p-res-c">{{
                                                    $t('howItWorks.step4.spreadsheet.depreciation.after.data.accurate')
                                                    }}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="p-result-badge mono">✓ {{ $t('landing.hiw.resultBadge') }}</div>
                            </div>
                        </div>
                    </Transition>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
import { ref } from 'vue'
import {
    CloudArrowUpIcon,
    ArrowRightIcon,
    CalculatorIcon,
    CurrencyDollarIcon,
    ChartBarIcon
} from '@heroicons/vue/24/outline'

const activeStep = ref(0)
const selectedTemplate = ref('depreciation')

const steps = [
    { key: 'step1' },
    { key: 'step2' },
    { key: 'step3' },
    { key: 'step4' }
]

const templates = [
    { key: 'depreciation', icon: CalculatorIcon, std: 'IAS 16' },
    { key: 'discounts', icon: CurrencyDollarIcon, std: 'IFRS 15' },
    { key: 'impairment', icon: ChartBarIcon, std: 'IAS 36' }
]
</script>

<style scoped>
.hiw-section {
    padding: 6rem 1.5rem;
}

.hiw-inner {
    max-width: 960px;
    margin: 0 auto;
}

.mono {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

/* Header */
.hiw-header {
    text-align: center;
    margin-bottom: 3.5rem;
}

.hiw-label {
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

.hiw-title {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--landing-text);
}

.hiw-subtitle {
    font-size: 1rem;
    color: var(--landing-text-secondary);
    max-width: 500px;
    margin: .75rem auto 0;
    line-height: 1.6;
}

/* Layout */
.hiw-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 2rem;
    min-height: 420px;
}

/* Timeline */
.hiw-step {
    display: flex;
    gap: 1rem;
    cursor: pointer;
    padding: 1.25rem;
    border-radius: 16px;
    border: 1px solid transparent;
    transition: all .3s;
    position: relative;
}

.hiw-step:hover {
    background: rgba(149, 0, 255, 0.06);
}

.hiw-step.active {
    background: var(--landing-surface);
    border-color: var(--landing-border-accent);
    box-shadow: 0 4px 20px rgba(149, 0, 255, 0.06);
}

:global(.dark) .hiw-step.active {
    box-shadow: 0 4px 20px rgba(149, 0, 255, 0.1);
}

.hiw-num {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .7rem;
    font-weight: 700;
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
    transition: all .3s;
    background: var(--landing-surface-2);
    color: var(--landing-text-muted);
    border: 1px solid var(--landing-border);
}

.hiw-step.active .hiw-num {
    background: #9500FF;
    color: #fff;
    border-color: #9500FF;
    box-shadow: 0 0 16px rgba(149, 0, 255, 0.3);
}

.hiw-step:not(:last-child)::after {
    content: '';
    position: absolute;
    left: calc(1.25rem + 17px);
    top: calc(1.25rem + 36px);
    width: 2px;
    height: calc(100% - 36px);
    background: var(--landing-border);
}

.hiw-step.active:not(:last-child)::after {
    background: linear-gradient(to bottom, #9500FF, var(--landing-border));
}

.hiw-step-title {
    font-size: .9rem;
    font-weight: 600;
    color: var(--landing-text);
    margin-bottom: 4px;
    transition: color .3s;
}

.hiw-step.active .hiw-step-title {
    color: #9500FF;
}

.hiw-step-desc {
    font-size: .75rem;
    color: var(--landing-text-muted);
    line-height: 1.5;
    display: none;
}

.hiw-step.active .hiw-step-desc {
    display: block;
    color: var(--landing-text-secondary);
}

/* Preview panel */
.hiw-preview {
    border-radius: 20px;
    border: 1px solid var(--landing-border);
    background: var(--landing-surface);
    padding: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

.hiw-preview::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 30% 30%, rgba(149, 0, 255, 0.06), transparent 60%);
    pointer-events: none;
}

.hiw-panel {
    width: 100%;
    position: relative;
    z-index: 1;
}

/* Transition */
.panel-fade-enter-active,
.panel-fade-leave-active {
    transition: all .3s ease;
}

.panel-fade-enter-from {
    opacity: 0;
    transform: translateY(12px);
}

.panel-fade-leave-to {
    opacity: 0;
    transform: translateY(-8px);
}

/* ===== PANEL 0: UPLOAD ===== */
.p-upload-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 2rem;
    border: 2px dashed var(--landing-border-accent);
    border-radius: 16px;
    text-align: center;
    background: var(--landing-surface-2);
    transition: border-color .3s;
}

.p-upload-zone:hover {
    border-color: #9500FF;
}

.p-upload-icon {
    width: 48px;
    height: 48px;
    color: #9500FF;
    opacity: .6;
    margin-bottom: 1rem;
}

.p-upload-text {
    font-size: .9rem;
    font-weight: 500;
    color: var(--landing-text-secondary);
}

.p-upload-hint {
    font-size: .72rem;
    color: var(--landing-text-muted);
    margin-top: .5rem;
}

.p-upload-chips {
    display: flex;
    gap: .5rem;
    margin-top: 1rem;
}

.p-chip {
    font-size: .65rem;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(149, 0, 255, 0.06);
    color: #9500FF;
    border: 1px solid var(--landing-border-accent);
    font-weight: 500;
}

/* ===== PANEL 1: TEMPLATES (list layout, no overflow) ===== */
.p-tmpl-list {
    display: flex;
    flex-direction: column;
    gap: .625rem;
}

.p-tmpl-item {
    display: flex;
    align-items: center;
    gap: .875rem;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    border: 1px solid var(--landing-border);
    background: var(--landing-surface-2);
    cursor: pointer;
    transition: all .25s;
    font-family: inherit;
    color: var(--landing-text-secondary);
    width: 100%;
    text-align: left;
}

.p-tmpl-item:hover {
    border-color: var(--landing-border-accent);
}

.p-tmpl-active {
    border-color: #9500FF;
    background: rgba(149, 0, 255, 0.06);
    box-shadow: 0 0 0 1px rgba(149, 0, 255, 0.15);
}

.p-tmpl-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: var(--landing-text-muted);
}

.p-tmpl-active .p-tmpl-icon {
    color: #9500FF;
}

.p-tmpl-info {
    flex: 1;
    min-width: 0;
}

.p-tmpl-name {
    display: block;
    font-size: .85rem;
    font-weight: 600;
    color: var(--landing-text);
}

.p-tmpl-active .p-tmpl-name {
    color: #9500FF;
}

.p-tmpl-std {
    display: block;
    font-size: .65rem;
    color: var(--landing-text-muted);
    margin-top: 2px;
}

.p-tmpl-check {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #9500FF;
    color: #fff;
    font-size: .7rem;
    flex-shrink: 0;
}

/* ===== PANEL 2: PROCESSING ===== */
.p-proc-bar {
    width: 100%;
    height: 8px;
    border-radius: 4px;
    background: var(--landing-surface-2);
    margin-bottom: 1.5rem;
    overflow: hidden;
}

.p-proc-bar-fill {
    height: 100%;
    width: 85%;
    border-radius: 4px;
    background: linear-gradient(90deg, #9500FF, #C084FC);
    animation: procFill 2s ease-in-out infinite alternate;
}

@keyframes procFill {
    from {
        width: 25%
    }

    to {
        width: 92%
    }
}

.p-proc-steps {
    display: flex;
    flex-direction: column;
    gap: .75rem;
}

.p-proc-item {
    display: flex;
    align-items: center;
    gap: .75rem;
    font-size: .8rem;
    color: var(--landing-text-secondary);
}

.p-proc-check {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: .7rem;
}

.p-proc-done {
    background: rgba(22, 163, 74, 0.1);
    color: #16A34A;
}

:global(.dark) .p-proc-done {
    background: rgba(34, 197, 94, 0.1);
    color: #22C55E;
}

.p-proc-prog {
    background: rgba(149, 0, 255, 0.06);
    color: #9500FF;
    animation: procPulse 1.5s ease-in-out infinite;
}

@keyframes procPulse {

    0%,
    100% {
        opacity: 1
    }

    50% {
        opacity: .5
    }
}

/* ===== PANEL 3: RESULT ===== */
.p-result-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: .75rem;
    align-items: center;
}

.p-res-sheet {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--landing-border);
    background: var(--landing-surface-2);
}

.p-res-before {
    border-color: rgba(220, 38, 38, 0.12);
}

:global(.dark) .p-res-before {
    border-color: rgba(239, 68, 68, 0.12);
}

.p-res-after {
    border-color: rgba(22, 163, 74, 0.12);
}

:global(.dark) .p-res-after {
    border-color: rgba(34, 197, 94, 0.12);
}

.p-res-hd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--landing-border);
}

.p-res-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: .65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .05em;
}

.p-res-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}

.p-res-label-r {
    color: #DC2626;
}

.p-res-label-r .p-res-dot {
    background: #DC2626;
}

:global(.dark) .p-res-label-r {
    color: #EF4444;
}

:global(.dark) .p-res-label-r .p-res-dot {
    background: #EF4444;
}

.p-res-label-g {
    color: #16A34A;
}

.p-res-label-g .p-res-dot {
    background: #16A34A;
}

:global(.dark) .p-res-label-g {
    color: #22C55E;
}

:global(.dark) .p-res-label-g .p-res-dot {
    background: #22C55E;
}

.p-res-tag {
    font-size: .55rem;
    font-weight: 500;
    padding: 2px 6px;
    border-radius: 4px;
}

.p-res-tag-r {
    background: rgba(220, 38, 38, 0.06);
    color: #DC2626;
}

:global(.dark) .p-res-tag-r {
    background: rgba(239, 68, 68, 0.1);
    color: #EF4444;
}

.p-res-tag-g {
    background: rgba(22, 163, 74, 0.06);
    color: #16A34A;
}

:global(.dark) .p-res-tag-g {
    background: rgba(34, 197, 94, 0.1);
    color: #22C55E;
}

.p-res-body {
    font-size: .6rem;
}

.p-res-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid var(--landing-border);
}

.p-res-row:last-child {
    border-bottom: none;
}

.p-res-row-h {
    background: rgba(149, 0, 255, 0.04);
}

:global(.dark) .p-res-row-h {
    background: rgba(149, 0, 255, 0.06);
}

.p-res-row-h .p-res-c {
    font-weight: 600;
    color: var(--landing-text-muted);
    text-transform: uppercase;
    font-size: .55rem;
}

.p-res-c {
    padding: 7px 10px;
    color: var(--landing-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.p-res-row-e .p-res-c {
    color: #DC2626;
    opacity: .8;
}

:global(.dark) .p-res-row-e .p-res-c {
    color: rgba(239, 68, 68, 0.7);
}

.p-res-row-s .p-res-c {
    color: #16A34A;
    opacity: .8;
}

:global(.dark) .p-res-row-s .p-res-c {
    color: rgba(34, 197, 94, 0.7);
}

.p-res-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
}

.p-res-arrow-c {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #9500FF;
    background: var(--landing-surface);
    border: 1px solid var(--landing-border-accent);
}

.p-result-badge {
    text-align: center;
    margin-top: 1rem;
    font-size: .7rem;
    color: #16A34A;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 8px;
    background: rgba(22, 163, 74, 0.06);
}

:global(.dark) .p-result-badge {
    color: #22C55E;
    background: rgba(34, 197, 94, 0.06);
}

@media (max-width: 768px) {
    .hiw-section {
        padding: 4rem 1rem;
    }

    .hiw-layout {
        grid-template-columns: 1fr;
    }

    .hiw-preview {
        min-height: 300px;
    }

    .p-result-grid {
        grid-template-columns: 1fr;
        gap: .75rem;
    }

    .p-res-arrow {
        transform: rotate(90deg);
    }
}
</style>