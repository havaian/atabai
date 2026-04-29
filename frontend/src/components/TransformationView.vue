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
    // Dispatch on template — each template has its own sheet shape
    let originalSheet, ifrsSheet
    if (tr.template === 'profitLossForm2') {
        originalSheet = buildOriginalSheetPLF2(tr)
        ifrsSheet = buildIfrsSheetPLF2(tr)
    } else if (tr.template === 'cashFlow') {
        originalSheet = buildOriginalSheetCF(tr)
        ifrsSheet = buildIfrsSheetCF(tr)
    } else if (tr.template === 'profitLoss') {
        originalSheet = buildOriginalSheetPL(tr)
        ifrsSheet = buildIfrsSheetPL(tr)
    } else if (tr.template === 'equity') {
        originalSheet = buildOriginalSheetEquity(tr)
        ifrsSheet = buildIfrsSheetEquity(tr)
    } else {
        // Default: balance sheet (template === 'balanceSheet' or unspecified)
        originalSheet = buildOriginalSheet(tr)
        ifrsSheet = buildIfrsSheet(tr)
    }

    return {
        id: 'tv-workbook',
        sheetOrder: ['sheet-original', 'sheet-ifrs'],
        name: 'transformation',
        appVersion: '0.20.0',
        locale: 'enUS',
        styles: {},
        sheets: {
            'sheet-original': originalSheet,
            'sheet-ifrs': ifrsSheet,
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

// ─── ProfitLossForm2 sheet builders ───────────────────────────────────────
// Different shape from balance sheet:
//   - Source rows have multi-period values[] instead of start/end
//   - Target rows have mixed types (title / item / total / calculated / blank)
//   - Variable number of period columns

function buildOriginalSheetPLF2(tr) {
    const rows = tr.source?.rows || []
    const periods = tr.source?.periods || tr.target?.periods || []
    const periodCount = periods.length
    const cellData = {}

    // Header row (row 0)
    let r = 0
    const header = {
        0: cell('NSBU Code', headerStyle()),
        1: cell('Label', headerStyle()),
    }
    for (let p = 0; p < periodCount; p++) {
        header[2 + p] = cell(periods[p]?.label || `Period ${p + 1}`, headerStyle())
    }
    header[2 + periodCount] = cell('Mapped To (IFRS)', headerStyle())
    cellData[r] = header
    r++

    // Data rows
    rows.forEach(row => {
        const mapped = row.mapping !== null && row.mapping !== undefined
        const rowStyle = mapped ? {} : droppedStyle()

        const dataRow = {
            0: cell(row.nsbuCode, rowStyle),
            1: cell(row.label || '', rowStyle),
        }
        const values = row.values || []
        for (let p = 0; p < periodCount; p++) {
            dataRow[2 + p] = cell(values[p] || 0, { ...rowStyle, n: { pattern: NUM_FMT } })
        }
        dataRow[2 + periodCount] = cell(mapped ? row.mapping.ifrsClassification : '—', rowStyle)
        cellData[r] = dataRow
        r++
    })

    // Build columnData with widths
    const columnData = {
        0: { w: 80 },
        1: { w: 280 },
    }
    for (let p = 0; p < periodCount; p++) {
        columnData[2 + p] = { w: 130 }
    }
    columnData[2 + periodCount] = { w: 240 }

    return {
        ...worksheetBase('sheet-original', 'Original'),
        rowCount: Math.max(r + 5, 50),
        columnCount: Math.max(2 + periodCount + 1 + 3, 8),
        cellData,
        columnData,
    }
}

function buildIfrsSheetPLF2(tr) {
    const rows = tr.target?.rows || []
    const periods = tr.target?.periods || []
    const periodCount = periods.length
    const cellData = {}
    let r = 0

    // Title
    cellData[r] = {
        0: cell(tr.target?.title || 'IFRS P&L', { ...headerStyle(), fs: 14 }),
    }
    r++
    r++ // spacer

    // Column headers
    const header = {
        0: cell('Line Item', headerStyle()),
    }
    for (let p = 0; p < periodCount; p++) {
        header[1 + p] = cell(periods[p]?.label || `Period ${p + 1}`, headerStyle())
    }
    header[1 + periodCount] = cell('NSBU Code', headerStyle())
    cellData[r] = header
    r++

    // Data rows — handle 5 row types
    rows.forEach(row => {
        if (row.type === 'blank') {
            // Empty row, advance r without writing anything
            r++
            return
        }

        if (row.type === 'title') {
            cellData[r] = {
                0: cell(row.label || '', sectionHeaderStyle()),
            }
            // Fill the rest of the row with the section background for visual continuity
            for (let p = 0; p < periodCount; p++) {
                cellData[r][1 + p] = cell('', sectionHeaderStyle())
            }
            cellData[r][1 + periodCount] = cell('', sectionHeaderStyle())
            r++
            return
        }

        if (row.type === 'item') {
            const dataRow = {
                0: cell(row.label || '', {}),
            }
            const values = row.values || []
            for (let p = 0; p < periodCount; p++) {
                dataRow[1 + p] = cell(values[p] || 0, { n: { pattern: NUM_FMT } })
            }
            dataRow[1 + periodCount] = cell(row.nsbuCode || '', {})
            cellData[r] = dataRow
            r++
            return
        }

        if (row.type === 'total') {
            const dataRow = {
                0: cell(row.label || '', totalStyle()),
            }
            const values = row.values || []
            for (let p = 0; p < periodCount; p++) {
                dataRow[1 + p] = cell(values[p] || 0, { ...totalStyle(), n: { pattern: NUM_FMT } })
            }
            dataRow[1 + periodCount] = cell('', totalStyle())
            cellData[r] = dataRow
            r++
            return
        }

        if (row.type === 'calculated') {
            const dataRow = {
                0: cell(row.label || '', calcStyle()),
            }
            const values = row.values || []
            for (let p = 0; p < periodCount; p++) {
                dataRow[1 + p] = cell(values[p] || 0, { ...calcStyle(), bl: 1, n: { pattern: NUM_FMT } })
            }
            dataRow[1 + periodCount] = cell('calc', calcStyle())
            cellData[r] = dataRow
            r++
            return
        }

        // Unknown type — skip but advance pointer
        r++
    })

    // Build columnData with widths
    const columnData = {
        0: { w: 340 },
    }
    for (let p = 0; p < periodCount; p++) {
        columnData[1 + p] = { w: 130 }
    }
    columnData[1 + periodCount] = { w: 100 }

    return {
        ...worksheetBase('sheet-ifrs', 'IFRS'),
        rowCount: Math.max(r + 5, 50),
        columnCount: Math.max(1 + periodCount + 1 + 3, 8),
        cellData,
        columnData,
    }
}

// ─── CashFlow sheet builders ──────────────────────────────────────────────
// Shape:
//   - Source rows: { lineItem, section, subSection, periodValues, total }
//     plus separate reconciliationRows and additionalSourcesRows
//   - Target sections: each with items[] that have periodValues, plus
//     summary sections (CF, FCF) flagged with isSummary

function buildOriginalSheetCF(tr) {
    const rows = tr.source?.rows || []
    const reconRows = tr.source?.reconciliationRows || []
    const additRows = tr.source?.additionalSourcesRows || []
    const periods = tr.source?.periods || tr.target?.periods || []
    const periodCount = periods.length
    const cellData = {}

    let r = 0

    // Column header row
    const header = {
        0: cell('Section', headerStyle()),
        1: cell('Line Item', headerStyle()),
    }
    for (let p = 0; p < periodCount; p++) {
        header[2 + p] = cell(periods[p]?.label || `Period ${p + 1}`, headerStyle())
    }
    header[2 + periodCount] = cell('Total', headerStyle())
    cellData[r] = header
    r++

    // Group source rows by section so the visual structure matches the file
    const grouped = {}
    rows.forEach(row => {
        const sec = row.section || 'UNCLASSIFIED'
        if (!grouped[sec]) grouped[sec] = []
        grouped[sec].push(row)
    })

    // Render section by section in extraction order (Object.keys preserves insertion order)
    Object.keys(grouped).forEach(sectionName => {
        // Section header
        const sectionRow = { 0: cell(sectionName, sectionHeaderStyle()) }
        for (let c = 1; c <= periodCount + 2; c++) {
            sectionRow[c] = cell('', sectionHeaderStyle())
        }
        cellData[r] = sectionRow
        r++

        // Items
        grouped[sectionName].forEach(row => {
            const dataRow = {
                0: cell(row.subSection || '', {}),
                1: cell(row.lineItem || '', {}),
            }
            for (let p = 0; p < periodCount; p++) {
                const v = row.periodValues?.[p]
                dataRow[2 + p] = cell(v == null ? 0 : v, { n: { pattern: NUM_FMT } })
            }
            dataRow[2 + periodCount] = cell(row.total || 0, { n: { pattern: NUM_FMT }, bl: 1 })
            cellData[r] = dataRow
            r++
        })
        // Spacer
        r++
    })

    // Reconciliation block (if present)
    if (reconRows.length > 0) {
        const sectionRow = { 0: cell('RECONCILIATION', sectionHeaderStyle()) }
        for (let c = 1; c <= periodCount + 2; c++) {
            sectionRow[c] = cell('', sectionHeaderStyle())
        }
        cellData[r] = sectionRow
        r++

        reconRows.forEach(row => {
            const dataRow = {
                0: cell('', {}),
                1: cell(row.lineItem || '', {}),
            }
            for (let p = 0; p < periodCount; p++) {
                const v = row.periodValues?.[p]
                dataRow[2 + p] = cell(v == null ? 0 : v, { n: { pattern: NUM_FMT } })
            }
            dataRow[2 + periodCount] = cell(row.total || 0, { n: { pattern: NUM_FMT }, bl: 1 })
            cellData[r] = dataRow
            r++
        })
        r++
    }

    // Additional sources block (if present)
    if (additRows.length > 0) {
        const sectionRow = { 0: cell('ADDITIONAL SOURCES', sectionHeaderStyle()) }
        for (let c = 1; c <= periodCount + 2; c++) {
            sectionRow[c] = cell('', sectionHeaderStyle())
        }
        cellData[r] = sectionRow
        r++

        additRows.forEach(row => {
            const rowStyle = row.isCategory ? { bl: 1 } : {}
            const dataRow = {
                0: cell('', rowStyle),
                1: cell(row.lineItem || '', rowStyle),
            }
            for (let p = 0; p < periodCount; p++) {
                const v = row.periodValues?.[p]
                dataRow[2 + p] = cell(v == null ? 0 : v, { ...rowStyle, n: { pattern: NUM_FMT } })
            }
            dataRow[2 + periodCount] = cell(row.total || 0, { ...rowStyle, n: { pattern: NUM_FMT }, bl: 1 })
            cellData[r] = dataRow
            r++
        })
    }

    // Column widths
    const columnData = {
        0: { w: 140 },
        1: { w: 320 },
    }
    for (let p = 0; p < periodCount; p++) {
        columnData[2 + p] = { w: 120 }
    }
    columnData[2 + periodCount] = { w: 130 }

    return {
        ...worksheetBase('sheet-original', 'Original'),
        rowCount: Math.max(r + 5, 50),
        columnCount: Math.max(2 + periodCount + 1 + 3, 8),
        cellData,
        columnData,
    }
}

function buildIfrsSheetCF(tr) {
    const sections = tr.target?.sections || []
    const periods = tr.target?.periods || []
    const periodCount = periods.length
    const cellData = {}
    let r = 0

    // Title
    cellData[r] = {
        0: cell(tr.target?.title || 'IFRS Cash Flow', { ...headerStyle(), fs: 14 }),
    }
    r++
    r++ // spacer

    // Column headers
    const header = {
        0: cell('Line Item', headerStyle()),
    }
    for (let p = 0; p < periodCount; p++) {
        header[1 + p] = cell(periods[p]?.label || `Period ${p + 1}`, headerStyle())
    }
    header[1 + periodCount] = cell('Total', headerStyle())
    cellData[r] = header
    r++

    // Section totals lookup so we can render subtotals beneath each main section
    const sectionTotalsMap = {
        'OPERATING ACTIVITIES': tr.target?.operatingTotal || [],
        'INVESTING ACTIVITIES': tr.target?.investingTotal || [],
        'FINANCING ACTIVITIES': tr.target?.financingTotal || [],
    }

    sections.forEach(section => {
        const isSummary = section.isSummary === true

        // Section header — different style for summary vs main
        const headerStyleFn = isSummary ? calcStyle : sectionHeaderStyle
        const sectionRow = {
            0: cell(`CASH FLOWS FROM ${section.name}:`, headerStyleFn()),
        }
        if (isSummary) {
            sectionRow[0] = cell(section.name, headerStyleFn())
        }
        for (let c = 1; c <= periodCount + 1; c++) {
            sectionRow[c] = cell('', headerStyleFn())
        }
        cellData[r] = sectionRow
        r++

        // Items
        section.items.forEach(item => {
            // Indent label by indent level (just visual spacing)
            const indent = item.indent || 1
            const indentSpaces = '  '.repeat(Math.max(indent - 1, 0))
            const rowStyle = item.isCategory ? { bl: 1 } : {}

            const dataRow = {
                0: cell(`${indentSpaces}${item.label || ''}`, rowStyle),
            }
            const total = typeof item.total === 'number' ? item.total : 0
            for (let p = 0; p < periodCount; p++) {
                const v = item.periodValues?.[p]
                dataRow[1 + p] = cell(v == null ? 0 : v, { ...rowStyle, n: { pattern: NUM_FMT } })
            }
            dataRow[1 + periodCount] = cell(total, { ...rowStyle, n: { pattern: NUM_FMT }, bl: 1 })
            cellData[r] = dataRow
            r++
        })

        // Section subtotal (only for main activity sections, not summaries or additional sources)
        const sectionTotals = sectionTotalsMap[section.name]
        if (!isSummary && sectionTotals && sectionTotals.length > 0) {
            const totalRow = {
                0: cell(`Net cash from ${section.name.toLowerCase()}`, totalStyle()),
            }
            let grandTotal = 0
            for (let p = 0; p < periodCount; p++) {
                const v = sectionTotals[p] || 0
                grandTotal += v
                totalRow[1 + p] = cell(v, { ...totalStyle(), n: { pattern: NUM_FMT } })
            }
            totalRow[1 + periodCount] = cell(grandTotal, { ...totalStyle(), n: { pattern: NUM_FMT } })
            cellData[r] = totalRow
            r++
        }
        r++ // spacer
    })

    // Column widths
    const columnData = {
        0: { w: 380 },
    }
    for (let p = 0; p < periodCount; p++) {
        columnData[1 + p] = { w: 120 }
    }
    columnData[1 + periodCount] = { w: 130 }

    return {
        ...worksheetBase('sheet-ifrs', 'IFRS'),
        rowCount: Math.max(r + 5, 50),
        columnCount: Math.max(1 + periodCount + 1 + 3, 8),
        cellData,
        columnData,
    }
}

// ─── ProfitLoss (budget) sheet builders ───────────────────────────────────
// Source rows are categorized into REVENUE / COGS / OVERHEAD / ADMIN / D&A /
// FINANCE-OTHER / TAX, with optional subheader rows (no values).
// IFRS target uses the same mixed-row-types format as profitLossForm2.

function buildOriginalSheetPL(tr) {
    const rows = tr.source?.rows || []
    const periods = tr.source?.periods || tr.target?.periods || []
    const periodCount = periods.length
    const cellData = {}

    let r = 0

    // Header row
    const header = {
        0: cell('Category', headerStyle()),
        1: cell('Line Item', headerStyle()),
    }
    for (let p = 0; p < periodCount; p++) {
        header[2 + p] = cell(periods[p]?.label || `Period ${p + 1}`, headerStyle())
    }
    cellData[r] = header
    r++

    // Group by category
    const grouped = {}
    rows.forEach(row => {
        const cat = row.category || 'UNCLASSIFIED'
        if (!grouped[cat]) grouped[cat] = []
        grouped[cat].push(row)
    })

    Object.keys(grouped).forEach(category => {
        // Section header
        const sectionRow = { 0: cell(category, sectionHeaderStyle()) }
        for (let c = 1; c <= periodCount + 1; c++) {
            sectionRow[c] = cell('', sectionHeaderStyle())
        }
        cellData[r] = sectionRow
        r++

        grouped[category].forEach(row => {
            const isSubheader = row.isSubheader === true
            const rowStyle = isSubheader ? { bl: 1, it: 1 } : {}

            const dataRow = {
                0: cell('', rowStyle),
                1: cell(row.label || '', rowStyle),
            }
            for (let p = 0; p < periodCount; p++) {
                if (isSubheader) {
                    dataRow[2 + p] = cell('', rowStyle)
                } else {
                    const v = row.values?.[p]
                    dataRow[2 + p] = cell(v == null ? 0 : v, { ...rowStyle, n: { pattern: NUM_FMT } })
                }
            }
            cellData[r] = dataRow
            r++
        })
        r++ // spacer
    })

    const columnData = {
        0: { w: 140 },
        1: { w: 320 },
    }
    for (let p = 0; p < periodCount; p++) {
        columnData[2 + p] = { w: 130 }
    }

    return {
        ...worksheetBase('sheet-original', 'Original'),
        rowCount: Math.max(r + 5, 50),
        columnCount: Math.max(2 + periodCount + 3, 8),
        cellData,
        columnData,
    }
}

function buildIfrsSheetPL(tr) {
    // Same row-type rendering as Form 2's IFRS sheet — reuse that logic
    return buildIfrsSheetPLF2(tr)
}

// ─── Equity sheet builders ────────────────────────────────────────────────
// Equity is the most structurally different template:
//   - Categories (Share Capital, Reserves, ...) are COLUMNS, not periods
//   - Movements (Opening, Net Profit, Closing) are ROWS
//   - Two source pipelines: balanceSheet (opening/closing only) or form4 (full movements)

function buildOriginalSheetEquity(tr) {
    const source = tr.source || {}
    const sourceType = source.sourceType || 'balanceSheet'
    const columns = tr.target?.columns || []
    const cellData = {}

    let r = 0

    // Title row indicating source type
    const sourceLabel = sourceType === 'form4'
        ? 'NSBU Form 4 (Statement of Changes in Equity)'
        : 'NSBU Balance Sheet — equity section (opening/closing only)'
    cellData[r] = {
        0: cell(sourceLabel, { ...headerStyle(), fs: 13 }),
    }
    r++
    r++ // spacer

    if (sourceType === 'balanceSheet') {
        // Render equity columns as rows: column | start | end | change
        const header = {
            0: cell('Equity Component', headerStyle()),
            1: cell('Opening Balance', headerStyle()),
            2: cell('Closing Balance', headerStyle()),
            3: cell('Net Change', headerStyle()),
        }
        cellData[r] = header
        r++

        const equityRows = source.equityRows || []
        equityRows.forEach(row => {
            const change = (row.end || 0) - (row.start || 0)
            cellData[r] = {
                0: cell(row.label || '', {}),
                1: cell(row.start || 0, { n: { pattern: NUM_FMT } }),
                2: cell(row.end || 0, { n: { pattern: NUM_FMT } }),
                3: cell(change, { n: { pattern: NUM_FMT }, bl: 1 }),
            }
            r++
        })

        const columnData = {
            0: { w: 280 },
            1: { w: 160 },
            2: { w: 160 },
            3: { w: 160 },
        }

        return {
            ...worksheetBase('sheet-original', 'Original'),
            rowCount: Math.max(r + 5, 30),
            columnCount: 8,
            cellData,
            columnData,
        }
    }

    // Form 4 source — render as matrix (movements × equity columns)
    const nonCalcCols = columns.filter(c => !c.isCalculated)
    const colCount = nonCalcCols.length

    // Column header row
    const header = { 0: cell('Movement', headerStyle()) }
    nonCalcCols.forEach((col, i) => {
        header[1 + i] = cell(col.label || '', headerStyle())
    })
    cellData[r] = header
    r++

    const movementRows = source.movementRows || []
    movementRows.forEach(row => {
        const rowStyle = row.isTotal ? totalStyle() : {}
        const dataRow = {
            0: cell(row.label || '', rowStyle),
        }
        nonCalcCols.forEach((col, i) => {
            const v = row.values?.[col.key]
            dataRow[1 + i] = cell(v == null ? 0 : v, { ...rowStyle, n: { pattern: NUM_FMT } })
        })
        cellData[r] = dataRow
        r++
    })

    // Column widths
    const columnData = { 0: { w: 280 } }
    nonCalcCols.forEach((_, i) => { columnData[1 + i] = { w: 140 } })

    return {
        ...worksheetBase('sheet-original', 'Original'),
        rowCount: Math.max(r + 5, 30),
        columnCount: Math.max(1 + colCount + 3, 8),
        cellData,
        columnData,
    }
}

function buildIfrsSheetEquity(tr) {
    const target = tr.target || {}
    const columns = target.columns || []
    const rows = target.rows || []
    const cellData = {}
    let r = 0

    // Title
    cellData[r] = {
        0: cell(target.title || 'Statement of Changes in Equity (IFRS)', { ...headerStyle(), fs: 14 }),
    }
    r++

    // Company name
    if (target.companyName) {
        cellData[r] = {
            0: cell(target.companyName, { bl: 1 }),
        }
        r++
    }
    r++ // spacer

    // Source note (if present)
    if (target.sourceNote) {
        cellData[r] = {
            0: cell(target.sourceNote, { it: 1, cl: { rgb: COLORS.droppedFg } }),
        }
        r++
        r++ // spacer
    }

    // Column headers — Movement | Share Capital | Share Premium | ... | Total
    const header = { 0: cell('Movement', headerStyle()) }
    columns.forEach((col, i) => {
        header[1 + i] = cell(col.label || '', headerStyle())
    })
    cellData[r] = header
    r++

    // Data rows — movements
    rows.forEach(row => {
        const rowStyle = row.isTotal ? totalStyle() : {}
        const dataRow = {
            0: cell(row.label || '', rowStyle),
        }
        columns.forEach((col, i) => {
            const v = row.values?.[col.key]
            // Style the calculated total column distinctly
            const cellStyle = col.isCalculated
                ? { ...rowStyle, ...calcStyle(), n: { pattern: NUM_FMT }, bl: 1 }
                : { ...rowStyle, n: { pattern: NUM_FMT } }
            dataRow[1 + i] = cell(v == null ? 0 : v, cellStyle)
        })
        cellData[r] = dataRow
        r++
    })

    // Column widths
    const columnData = { 0: { w: 280 } }
    columns.forEach((_, i) => { columnData[1 + i] = { w: 140 } })

    return {
        ...worksheetBase('sheet-ifrs', 'IFRS'),
        rowCount: Math.max(r + 5, 30),
        columnCount: Math.max(1 + columns.length + 3, 8),
        cellData,
        columnData,
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