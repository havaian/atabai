<!-- frontend/src/components/TransformationView.vue -->
<!-- Before/After spreadsheet diff view for a processed file.                 -->
<!-- Lazy-loads Univer on mount; only mounted when parent section is expanded.-->
<template>
    <div class="tv-root" ref="rootRef">

        <!-- Loading states (fetching data or regenerating) -->
        <div v-if="phase === 'loading'" class="tv-state">
            <div class="tv-spinner"></div>
            <span>{{ $t('transformation.loading') }}</span>
        </div>

        <!-- Transformation data not yet available — offer regenerate -->
        <div v-else-if="phase === 'needs-regenerate'" class="tv-state">
            <div class="tv-state-icon">
                <ExclamationCircleIcon class="w-5 h-5" />
            </div>
            <div class="tv-state-text">
                <div class="tv-state-title">{{ $t('transformation.notAvailable.title') }}</div>
                <div class="tv-state-sub">{{ $t('transformation.notAvailable.description') }}</div>
            </div>
            <button class="tv-btn tv-btn-primary" @click="doRegenerate" :disabled="regenerating">
                {{ regenerating ? $t('transformation.generating') : $t('transformation.generate') }}
            </button>
        </div>

        <!-- Template not supported -->
        <div v-else-if="phase === 'unsupported'" class="tv-state">
            <div class="tv-state-icon">
                <ExclamationCircleIcon class="w-5 h-5" />
            </div>
            <div class="tv-state-text">
                <div class="tv-state-title">{{ $t('transformation.unsupported.title') }}</div>
                <div class="tv-state-sub">{{ $t('transformation.unsupported.description') }}</div>
            </div>
        </div>

        <!-- Generic error -->
        <div v-else-if="phase === 'error'" class="tv-state">
            <div class="tv-state-icon tv-state-icon-error">
                <ExclamationCircleIcon class="w-5 h-5" />
            </div>
            <div class="tv-state-text">
                <div class="tv-state-title">{{ $t('transformation.error.title') }}</div>
                <div class="tv-state-sub">{{ errorMessage }}</div>
            </div>
            <button class="tv-btn tv-btn-secondary" @click="load">
                {{ $t('common.retry') }}
            </button>
        </div>

        <!-- Ready: toggle + Univer host -->
        <template v-else-if="phase === 'ready'">
            <!-- Sheet toggle -->
            <div class="tv-toggle">
                <button class="tv-toggle-btn" :class="{ active: activeSheet === 'original' }"
                    @click="switchSheet('original')">
                    {{ $t('transformation.toggle.original') }}
                </button>
                <button class="tv-toggle-btn" :class="{ active: activeSheet === 'ifrs' }" @click="switchSheet('ifrs')">
                    {{ $t('transformation.toggle.ifrs') }}
                </button>
            </div>

            <!-- Univer container — fixed height, contained -->
            <div class="tv-univer" ref="univerHostRef"></div>
        </template>

    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'
import { ExclamationCircleIcon } from '@heroicons/vue/24/outline'

const props = defineProps({
    fileId: { type: String, required: true },
})

const { t } = useI18n()
const filesStore = useFilesStore()

// phase: 'loading' | 'needs-regenerate' | 'unsupported' | 'error' | 'ready'
const phase = ref('loading')
const errorMessage = ref('')
const regenerating = ref(false)
const activeSheet = ref('original')

const rootRef = ref(null)
const univerHostRef = ref(null)

// Univer instance handles — kept in closure, not reactive (Univer internals hate reactivity)
let univerInstance = null
let workbookRef = null
let ICommandService = null
let SetWorksheetActiveOperation = null

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(() => {
    load()
})

onBeforeUnmount(() => {
    destroyUniver()
})

// ── Load transformation data ──────────────────────────────────────────────
async function load() {
    phase.value = 'loading'
    errorMessage.value = ''

    try {
        const data = await filesStore.fetchTransformation(props.fileId)
        // Flip phase FIRST so the <div ref="univerHostRef"> gets rendered
        phase.value = 'ready'
        await nextTick()
        await mountUniver(data)
    } catch (err) {
        if (err.code === 'TRANSFORMATION_NOT_AVAILABLE') {
            phase.value = 'needs-regenerate'
        } else if (err.code === 'TEMPLATE_NOT_SUPPORTED') {
            phase.value = 'unsupported'
        } else {
            phase.value = 'error'
            errorMessage.value = err.message || t('transformation.error.generic')
        }
    }
}

async function doRegenerate() {
    regenerating.value = true
    try {
        await filesStore.regenerateTransformation(props.fileId)
        // Immediately reload the now-generated data
        await load()
    } catch (err) {
        phase.value = 'error'
        errorMessage.value = err.message || t('transformation.error.generic')
    } finally {
        regenerating.value = false
    }
}

// ── Univer mount ──────────────────────────────────────────────────────────
async function mountUniver(transformation) {
    if (!univerHostRef.value) {
        console.warn('[TransformationView] host element not mounted yet')
        // Wait one more tick and retry
        await nextTick()
        if (!univerHostRef.value) {
            throw new Error('Univer host container never mounted')
        }
    }
    
    // Lazy-import Univer and locales. Paths are for 0.20.x plugin mode.
    const [
        core,
        renderEngine,
        formulaEngine,
        ui,
        docs,
        docsUi,
        sheets,
        sheetsUi,
        sheetsFormula,
        sheetsFormulaUi,
        DesignLocale,
        UILocale,
        DocsUILocale,
        SheetsLocale,
        SheetsUILocale,
        SheetsFormulaUILocale,
    ] = await Promise.all([
        import('@univerjs/core'),
        import('@univerjs/engine-render'),
        import('@univerjs/engine-formula'),
        import('@univerjs/ui'),
        import('@univerjs/docs'),
        import('@univerjs/docs-ui'),
        import('@univerjs/sheets'),
        import('@univerjs/sheets-ui'),
        import('@univerjs/sheets-formula'),
        import('@univerjs/sheets-formula-ui'),
        import('@univerjs/design/locale/en-US'),
        import('@univerjs/ui/locale/en-US'),
        import('@univerjs/docs-ui/locale/en-US'),
        import('@univerjs/sheets/locale/en-US'),
        import('@univerjs/sheets-ui/locale/en-US'),
        import('@univerjs/sheets-formula-ui/locale/en-US'),
    ])

    // CSS — only packages that actually ship styles.
    await Promise.all([
        import('@univerjs/design/lib/index.css'),
        import('@univerjs/ui/lib/index.css'),
        import('@univerjs/docs-ui/lib/index.css'),
        import('@univerjs/sheets-ui/lib/index.css'),
        import('@univerjs/sheets-formula-ui/lib/index.css'),
    ])

    const { Univer, UniverInstanceType, LocaleType, merge, ICommandService: CoreICommandService } = core

    ICommandService = CoreICommandService
    SetWorksheetActiveOperation = sheets.SetWorksheetActiveOperation

    const mergedLocale = merge(
        {},
        DesignLocale.default,
        UILocale.default,
        DocsUILocale.default,
        SheetsLocale.default,
        SheetsUILocale.default,
        SheetsFormulaUILocale.default,
    )

    univerInstance = new Univer({
        locale: LocaleType.EN_US,
        locales: {
            [LocaleType.EN_US]: mergedLocale,
        },
    })

    univerInstance.registerPlugin(renderEngine.UniverRenderEnginePlugin)
    univerInstance.registerPlugin(formulaEngine.UniverFormulaEnginePlugin)
    univerInstance.registerPlugin(ui.UniverUIPlugin, {
        container: univerHostRef.value,
        header: false,
        footer: false,
        contextMenu: false,
    })
    univerInstance.registerPlugin(docs.UniverDocsPlugin)
    univerInstance.registerPlugin(docsUi.UniverDocsUIPlugin)
    univerInstance.registerPlugin(sheets.UniverSheetsPlugin)
    univerInstance.registerPlugin(sheetsUi.UniverSheetsUIPlugin, {
        formulaBar: false,
    })
    univerInstance.registerPlugin(sheetsFormula.UniverSheetsFormulaPlugin)
    univerInstance.registerPlugin(sheetsFormulaUi.UniverSheetsFormulaUIPlugin)

    const workbookData = buildWorkbookData(transformation)
    const workbook = univerInstance.createUnit(UniverInstanceType.UNIVER_SHEET, workbookData)

    // Stash for sheet switching — we use Univer's low-level API rather than
    // the facade, which has moved across versions.
    workbookRef = workbook

    switchSheet('original')
}

function switchSheet(which) {
    activeSheet.value = which
    if (!univerInstance || !ICommandService || !SetWorksheetActiveOperation) return
    try {
        const sheetId = which === 'original' ? 'sheet-original' : 'sheet-ifrs'
        const commandService = univerInstance.__getInjector().get(ICommandService)
        commandService.executeCommand(SetWorksheetActiveOperation.id, {
            unitId: 'tv-workbook',
            subUnitId: sheetId,
        })
    } catch (err) {
        console.warn('[TransformationView] switchSheet failed:', err)
    }
}

function destroyUniver() {
    try {
        if (univerInstance) {
            univerInstance.dispose()
            univerInstance = null
        }
        workbookRef = null
    } catch (err) {
        console.warn('[TransformationView] destroy failed:', err)
    }
}

// ── Build IWorkbookData from transformation JSON ──────────────────────────
function buildWorkbookData(tr) {
    return {
        id: 'tv-workbook',
        sheetOrder: ['sheet-original', 'sheet-ifrs'],
        name: 'transformation',
        appVersion: '0.20.0',
        locale: 'enUS',
        styles: {},
        sheets: {
            'sheet-original': buildOriginalSheet(tr),
            'sheet-ifrs': buildIfrsSheet(tr),
        },
    }
}

// Number format — parens on negatives, thousand separators
const NUM_FMT = '#,##0.00;(#,##0.00)'

// Color tokens (hex strings — Univer wants them, not CSS vars)
const COLORS = {
    headerBg: '#F3F0FA',
    headerFg: '#1F1A2C',
    sectionBg: '#E9E3F5',
    calcBg: '#E8F0FE',
    droppedBg: '#F5F5F7',
    droppedFg: '#9E9AA8',
    borderGray: '#D8D5E0',
}

function cell(value, style = {}) {
    const c = { v: value }
    if (Object.keys(style).length) c.s = style
    return c
}

// Minimal-but-complete worksheet scaffold. All fields are required by
// Univer 0.20's selection/render services or rendering will fail with
// "cannot read properties of undefined (reading 'worksheet')".
function worksheetBase(id, name) {
    return {
        id,
        name,
        tabColor: '',
        hidden: 0,
        zoomRatio: 1,
        freeze: { startRow: -1, startColumn: -1, xSplit: 0, ySplit: 0 },
        scrollTop: 0,
        scrollLeft: 0,
        defaultColumnWidth: 110,
        defaultRowHeight: 24,
        mergeData: [],
        rowData: {},
        columnData: {},
        rowHeader: { width: 46 },
        columnHeader: { height: 20 },
        showGridlines: 1,
        rightToLeft: 0,
    }
}

function buildOriginalSheet(tr) {
    const rows = tr.source?.rows || []
    const cellData = {}

    // Header row (row 0)
    let r = 0
    cellData[r] = {
        0: cell('NSBU Code', headerStyle()),
        1: cell('Label', headerStyle()),
        2: cell('Beginning', headerStyle()),
        3: cell('Ending', headerStyle()),
        4: cell('Mapped To (IFRS)', headerStyle()),
    }
    r++

    // Data rows
    rows.forEach(row => {
        const mapped = row.mapping !== null
        const rowStyle = mapped ? {} : droppedStyle()

        cellData[r] = {
            0: cell(row.nsbuCode, rowStyle),
            1: cell(row.label || '', rowStyle),
            2: cell(row.start || 0, { ...rowStyle, n: { pattern: NUM_FMT } }),
            3: cell(row.end || 0, { ...rowStyle, n: { pattern: NUM_FMT } }),
            4: cell(mapped ? row.mapping.ifrsClassification : '—', rowStyle),
        }
        r++
    })

    return {
        ...worksheetBase('sheet-original', 'Original'),
        rowCount: Math.max(r + 5, 50),
        columnCount: 8,
        cellData,
        columnData: {
            0: { w: 80 },
            1: { w: 280 },
            2: { w: 130 },
            3: { w: 130 },
            4: { w: 240 },
        },
    }
}

function buildIfrsSheet(tr) {
    const sections = tr.target?.sections || []
    const cellData = {}
    let r = 0

    // Title
    cellData[r] = {
        0: cell(tr.target?.title || 'IFRS Report', { ...headerStyle(), fs: 14 }),
    }
    r++
    r++ // spacer

    // Column headers
    cellData[r] = {
        0: cell('Line Item', headerStyle()),
        1: cell('Beginning', headerStyle()),
        2: cell('Ending', headerStyle()),
        3: cell('NSBU Code', headerStyle()),
        4: cell('', headerStyle()),
    }
    r++

    sections.forEach(section => {
        // Section header row
        cellData[r] = {
            0: cell(section.name, sectionHeaderStyle()),
            1: cell('', sectionHeaderStyle()),
            2: cell('', sectionHeaderStyle()),
            3: cell('', sectionHeaderStyle()),
            4: cell('', sectionHeaderStyle()),
        }
        r++

        section.items.forEach(item => {
            const rowStyle = item.isCalculated ? calcStyle() : {}
            const flags = []
            if (item.isCalculated) flags.push('calc')
            if (item.isNegative) flags.push('negative')

            cellData[r] = {
                0: cell(item.label, rowStyle),
                1: cell(item.start || 0, { ...rowStyle, n: { pattern: NUM_FMT } }),
                2: cell(item.end || 0, { ...rowStyle, n: { pattern: NUM_FMT } }),
                3: cell(item.nsbuCode || '', rowStyle),
                4: cell(flags.join(', '), rowStyle),
            }
            r++
        })

        cellData[r] = {
            0: cell(`Total — ${section.name}`, totalStyle()),
            1: cell(section.totalStart || 0, { ...totalStyle(), n: { pattern: NUM_FMT } }),
            2: cell(section.totalEnd || 0, { ...totalStyle(), n: { pattern: NUM_FMT } }),
            3: cell('', totalStyle()),
            4: cell('', totalStyle()),
        }
        r++
        r++ // spacer
    })

    return {
        ...worksheetBase('sheet-ifrs', 'IFRS'),
        rowCount: Math.max(r + 5, 50),
        columnCount: 8,
        cellData,
        columnData: {
            0: { w: 340 },
            1: { w: 140 },
            2: { w: 140 },
            3: { w: 100 },
            4: { w: 100 },
        },
    }
}

function headerStyle() {
    return {
        bg: { rgb: COLORS.headerBg },
        cl: { rgb: COLORS.headerFg },
        bl: 1,
        ht: 2, // horizontal center — may need tweak per version
    }
}

function sectionHeaderStyle() {
    return {
        bg: { rgb: COLORS.sectionBg },
        bl: 1,
    }
}

function calcStyle() {
    return {
        bg: { rgb: COLORS.calcBg },
    }
}

function droppedStyle() {
    return {
        bg: { rgb: COLORS.droppedBg },
        cl: { rgb: COLORS.droppedFg },
        it: 1,
    }
}

function totalStyle() {
    return {
        bl: 1,
        bd: {
            t: { s: 1, cl: { rgb: COLORS.borderGray } },
        },
    }
}
</script>

<style scoped>
.tv-root {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

/* ─── Empty / loading / error states ─────────────────────────────────────── */
.tv-state {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px;
    background: var(--ws-surface);
    border: 1px solid var(--ws-border);
    border-radius: 12px;
}

.tv-state-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--pill-blue-bg);
    color: var(--pill-blue-text);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.tv-state-icon-error {
    background: var(--pill-red-bg);
    color: var(--pill-red-text);
}

.tv-state-text {
    flex: 1;
    min-width: 0;
}

.tv-state-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--ws-text);
    margin-bottom: 2px;
}

.tv-state-sub {
    font-size: 12.5px;
    color: var(--ws-text-3);
    line-height: 1.4;
}

.tv-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--ws-border);
    border-top-color: var(--ws-purple);
    border-radius: 50%;
    animation: tv-spin 0.8s linear infinite;
    flex-shrink: 0;
}

@keyframes tv-spin {
    to {
        transform: rotate(360deg);
    }
}

/* ─── Buttons ────────────────────────────────────────────────────────────── */
.tv-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 1px solid var(--ws-border);
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    background: var(--ws-surface);
    color: var(--ws-text);
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    white-space: nowrap;
}

.tv-btn:hover:not(:disabled) {
    background: var(--ws-bg);
}

.tv-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.tv-btn-primary {
    background: var(--ws-purple);
    color: #fff;
    border-color: var(--ws-purple);
}

.tv-btn-primary:hover:not(:disabled) {
    background: #6D28D9;
}

.tv-btn-secondary {
    background: var(--ws-surface);
}

/* ─── Toggle ─────────────────────────────────────────────────────────────── */
.tv-toggle {
    display: inline-flex;
    padding: 3px;
    background: var(--ws-bg);
    border: 1px solid var(--ws-border);
    border-radius: 10px;
    align-self: flex-start;
}

.tv-toggle-btn {
    padding: 7px 16px;
    border: none;
    background: transparent;
    color: var(--ws-text-3);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 7px;
    transition: background 0.15s, color 0.15s;
}

.tv-toggle-btn:hover {
    color: var(--ws-text);
}

.tv-toggle-btn.active {
    background: var(--ws-surface);
    color: var(--ws-text);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* ─── Univer host ────────────────────────────────────────────────────────── */
.tv-univer {
    width: 100%;
    height: 560px;
    border: 1px solid var(--ws-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--ws-surface);
}

/* Univer uses its own CSS vars / tokens — we let those through the scoped wrapper */
</style>