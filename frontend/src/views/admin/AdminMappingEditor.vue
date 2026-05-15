<template>
    <div class="adm-page" style="max-width: none;">
        <div class="adm-page-header">
            <div>
                <router-link to="/admin/mappings" class="adm-page-subtitle" style="text-decoration: none;">
                    ← Маппинги
                </router-link>
                <h1 class="adm-page-title" v-if="set">
                    {{ reportTypeLabel(set.reportType) }} v{{ set.version }}
                </h1>
                <div v-if="set" class="adm-page-subtitle">
                    <span class="adm-badge" :class="`adm-badge--mappingset-${set.status}`">{{ set.status }}</span>
                    <span v-if="set.publishedAt" class="adm-muted" style="margin-left: 8px;">
                        опубликовано {{ formatDate(set.publishedAt) }}
                    </span>
                </div>
            </div>
            <div class="adm-row">
                <button v-if="isDraft && isSuperAdmin && isRowBased"
                    class="adm-btn adm-btn--ghost"
                    @click="showAddRowModal = true">
                    + Добавить строку
                </button>
                <button v-if="isDraft && isSuperAdmin"
                    class="adm-btn adm-btn--primary"
                    @click="showPublishModal = true">
                    Опубликовать draft
                </button>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">Загрузка...</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <template v-else-if="set">
            <!-- View toggle -->
            <div class="adm-card" style="padding: 12px 16px;" v-if="isRowBased">
                <div class="adm-row" style="gap: 8px;">
                    <button class="adm-btn adm-btn--sm"
                        :class="viewMode === 'table' ? 'adm-btn--primary' : 'adm-btn--ghost'"
                        @click="viewMode = 'table'">
                        Таблица
                    </button>
                    <button class="adm-btn adm-btn--sm"
                        :class="viewMode === 'graph' ? 'adm-btn--primary' : 'adm-btn--ghost'"
                        @click="viewMode = 'graph'">
                        Граф
                    </button>
                    <input
                        v-if="viewMode === 'table'"
                        v-model="rowSearch"
                        class="adm-input"
                        placeholder="Поиск по коду/IFRS/секции..."
                        style="margin-left: auto; max-width: 320px;"
                    />
                </div>
            </div>

            <!-- Row-based: table view -->
            <div v-if="isRowBased && viewMode === 'table'" class="adm-table-wrap">
                <table class="adm-table">
                    <thead>
                        <tr>
                            <th>НСБУ-код</th>
                            <th>НСБУ-счета</th>
                            <th>IFRS</th>
                            <th>Секция</th>
                            <th>Флаги</th>
                            <th>Формула</th>
                            <th v-if="isDraft && isSuperAdmin"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in filteredRows" :key="row._id">
                            <td class="adm-mono">{{ row.nsbuRowCode }}</td>
                            <td class="adm-mono adm-text-xs adm-muted">
                                {{ (row.nsbuCodes || []).join(', ') || '—' }}
                            </td>
                            <td class="adm-text-sm">{{ row.ifrsClassification }}</td>
                            <td class="adm-text-sm adm-muted">
                                {{ row.section }}<span v-if="row.subsection"> / {{ row.subsection }}</span>
                            </td>
                            <td>
                                <span v-if="row.isCalculated" class="adm-badge" style="background: rgba(168, 85, 247, 0.18); color: #c084fc;">calc</span>
                                <span v-if="row.isNegative" class="adm-badge" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5; margin-left: 4px;">neg</span>
                                <span v-if="row.flowType" class="adm-badge" style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; margin-left: 4px;">{{ row.flowType }}</span>
                            </td>
                            <td class="adm-mono adm-text-xs adm-muted">
                                {{ formatFormula(row.formula) }}
                            </td>
                            <td v-if="isDraft && isSuperAdmin">
                                <button class="adm-btn adm-btn--sm adm-btn--ghost"
                                    @click="editRow(row)">Изм.</button>
                                <button class="adm-btn adm-btn--sm adm-btn--danger"
                                    style="margin-left: 4px;"
                                    @click="deleteRow(row)">×</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Row-based: graph view -->
            <div v-else-if="isRowBased && viewMode === 'graph'" class="adm-graph-container">
                <div class="adm-graph-toolbar">
                    <div class="adm-text-sm adm-muted">
                        Слева: НСБУ-коды · Справа: IFRS-классификации.
                        В draft можно перетягивать связи и редактировать узлы.
                    </div>
                    <select v-model="graphSectionFilter" class="adm-select" style="width: auto; min-width: 200px;">
                        <option value="">Все секции</option>
                        <option v-for="sec in availableSections" :key="sec" :value="sec">{{ sec }}</option>
                    </select>
                </div>
                <div class="adm-graph-canvas">
                    <VueFlow
                        v-model:nodes="graphNodes"
                        v-model:edges="graphEdges"
                        :default-viewport="{ zoom: 0.85 }"
                        :nodes-draggable="isDraft && isSuperAdmin"
                        :nodes-connectable="isDraft && isSuperAdmin"
                        :elements-selectable="true"
                        @node-click="onNodeClick"
                        @connect="onGraphConnect"
                        @edge-click="onGraphEdgeClick"
                    >
                        <Background pattern-color="rgba(149, 0, 255, 0.08)" :gap="20" />
                        <MiniMap pannable zoomable />
                        <Controls />
                    </VueFlow>
                </div>
                <div v-if="isDraft && isSuperAdmin" class="adm-graph-hint">
                    Перетащите курсор от узла НСБУ к узлу IFRS — соответствие будет обновлено.
                    Кликните на стрелку, чтобы удалить связь.
                </div>
            </div>

            <!-- Equity view (read-only summary) -->
            <div v-else-if="set.reportType === 'equity'" class="adm-card">
                <h3 class="adm-card-title">Конфигурация Equity</h3>
                <div v-if="!equityConfig" class="adm-empty">Нет конфигурации</div>
                <template v-else>
                    <div class="adm-field">
                        <div class="adm-field-label">Колонки IFRS</div>
                        <div class="adm-equity-list">
                            <div v-for="c in equityConfig.columns" :key="c.key" class="adm-equity-item">
                                <span class="adm-mono">{{ c.key }}</span>
                                <span class="adm-text-sm">{{ c.label }}</span>
                                <span v-if="c.isNegative" class="adm-badge" style="background: rgba(239, 68, 68, 0.15); color: #fca5a5;">neg</span>
                                <span v-if="c.isCalculated" class="adm-badge" style="background: rgba(168, 85, 247, 0.18); color: #c084fc;">calc</span>
                                <span class="adm-mono adm-text-xs adm-muted">
                                    [{{ (c.nsbuRows || []).join(', ') }}]
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="adm-field">
                        <div class="adm-field-label">Строки движения</div>
                        <div class="adm-equity-list">
                            <div v-for="r in equityConfig.movementRows" :key="r.key" class="adm-equity-item">
                                <span class="adm-mono">{{ r.key }}</span>
                                <span class="adm-text-sm">{{ r.label }}</span>
                                <span v-if="r.isTotal" class="adm-badge" style="background: rgba(168, 85, 247, 0.18); color: #c084fc;">total</span>
                            </div>
                        </div>
                    </div>

                    <div class="adm-field">
                        <div class="adm-field-label">Паттерны строк Form 4</div>
                        <div class="adm-equity-list">
                            <div v-for="p in equityConfig.rowPatterns" :key="p.key" class="adm-equity-item">
                                <span class="adm-mono">{{ p.key }}</span>
                                <span class="adm-mono adm-text-xs adm-muted">/{{ p.pattern }}/{{ p.flags || 'i' }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="adm-field">
                        <div class="adm-field-label">Паттерны колонок Form 4</div>
                        <div class="adm-equity-list">
                            <div v-for="p in equityConfig.columnPatterns" :key="p.key" class="adm-equity-item">
                                <span class="adm-mono">{{ p.key }}</span>
                                <span class="adm-mono adm-text-xs adm-muted">/{{ p.pattern }}/{{ p.flags || 'i' }}</span>
                            </div>
                        </div>
                    </div>

                    <div v-if="isDraft && isSuperAdmin" class="adm-muted adm-text-sm" style="margin-top: 16px;">
                        Редактирование equity в этом MVP делается через PUT API напрямую — UI-редактор будет позже.
                    </div>
                </template>
            </div>
        </template>

        <!-- Add/Edit row modal -->
        <div v-if="showAddRowModal" class="adm-modal-backdrop" @click.self="closeRowModal">
            <div class="adm-modal">
                <h3 class="adm-modal-title">{{ editingRow ? 'Изменить строку' : 'Новая строка' }}</h3>
                <div class="adm-grid-2">
                    <div class="adm-field">
                        <div class="adm-field-label">НСБУ-код *</div>
                        <input v-model="rowForm.nsbuRowCode" class="adm-input" placeholder="010" :disabled="!!editingRow" />
                    </div>
                    <div class="adm-field">
                        <div class="adm-field-label">IFRS *</div>
                        <input v-model="rowForm.ifrsClassification" class="adm-input" placeholder="PP&E - Gross" />
                    </div>
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">НСБУ-счета (через запятую)</div>
                    <input v-model="rowForm.nsbuCodesString" class="adm-input" placeholder="0100, 0300" />
                </div>
                <div class="adm-grid-2">
                    <div class="adm-field">
                        <div class="adm-field-label">Секция</div>
                        <input v-model="rowForm.section" class="adm-input" placeholder="ASSETS - NON-CURRENT" />
                    </div>
                    <div class="adm-field">
                        <div class="adm-field-label">Подсекция</div>
                        <input v-model="rowForm.subsection" class="adm-input" placeholder="Property, Plant & Equipment" />
                    </div>
                </div>
                <div class="adm-row" style="gap: 16px; margin: 12px 0;">
                    <label class="adm-row" style="gap: 6px;">
                        <input type="checkbox" v-model="rowForm.isNegative" />
                        <span class="adm-text-sm">Negative</span>
                    </label>
                    <label class="adm-row" style="gap: 6px;">
                        <input type="checkbox" v-model="rowForm.isCalculated" />
                        <span class="adm-text-sm">Calculated</span>
                    </label>
                </div>
                <div class="adm-field" v-if="rowForm.isCalculated">
                    <div class="adm-field-label">Формула</div>
                    <input v-model="rowForm.formulaString" class="adm-input" placeholder="010 - 011" />
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">Описание НСБУ</div>
                    <input v-model="rowForm.nsbuDescription" class="adm-input" />
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">Заметки</div>
                    <textarea v-model="rowForm.notes" class="adm-textarea"></textarea>
                </div>
                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="closeRowModal">Отмена</button>
                    <button class="adm-btn adm-btn--primary" @click="saveRow" :disabled="!rowForm.nsbuRowCode || !rowForm.ifrsClassification">
                        Сохранить
                    </button>
                </div>
            </div>
        </div>

        <!-- Publish modal -->
        <div v-if="showPublishModal" class="adm-modal-backdrop" @click.self="showPublishModal = false">
            <div class="adm-modal">
                <h3 class="adm-modal-title">Опубликовать draft</h3>
                <div class="adm-text-sm" style="margin-bottom: 12px;">
                    Текущий published-набор для этого типа отчёта будет переведён в archived.
                    Новые трансформации сразу начнут использовать этот draft.
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">Заметки к публикации</div>
                    <textarea v-model="publishNotes" class="adm-textarea" placeholder="Что изменилось?"></textarea>
                </div>
                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="showPublishModal = false">Отмена</button>
                    <button class="adm-btn adm-btn--primary" @click="doPublish">Опубликовать</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { VueFlow, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'
import '@vue-flow/minimap/dist/style.css'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()

const set = ref(null)
const rows = ref([])
const equityConfig = ref(null)

const loading = ref(false)
const error = ref(null)

const viewMode = ref('table') // 'table' | 'graph'
const rowSearch = ref('')
const graphSectionFilter = ref('')

const graphNodes = ref([])
const graphEdges = ref([])

const showAddRowModal = ref(false)
const showPublishModal = ref(false)
const editingRow = ref(null)
const publishNotes = ref('')

const rowForm = reactive({
    nsbuRowCode: '',
    ifrsClassification: '',
    nsbuCodesString: '',
    nsbuDescription: '',
    section: '',
    subsection: '',
    isNegative: false,
    isCalculated: false,
    formulaString: '',
    notes: ''
})

const setId = computed(() => route.params.setId)
const isDraft = computed(() => set.value?.status === 'draft')
const isRowBased = computed(() => set.value && ['balance_sheet', 'cash_flow', 'profit_loss_form2'].includes(set.value.reportType))
const isSuperAdmin = computed(() => adminStore.isSuperAdmin)

const availableSections = computed(() => {
    const s = new Set()
    rows.value.forEach(r => { if (r.section) s.add(r.section) })
    return Array.from(s).sort()
})

const filteredRows = computed(() => {
    const q = rowSearch.value.trim().toLowerCase()
    if (!q) return rows.value
    return rows.value.filter(r =>
        r.nsbuRowCode?.toLowerCase().includes(q) ||
        r.ifrsClassification?.toLowerCase().includes(q) ||
        r.section?.toLowerCase().includes(q) ||
        (r.nsbuCodes || []).some(c => c.toLowerCase().includes(q))
    )
})

function reportTypeLabel(rt) {
    return {
        balance_sheet: 'Баланс',
        cash_flow: 'Cash Flow',
        profit_loss_form2: 'P&L Form 2',
        equity: 'Equity'
    }[rt] || rt
}

function formatFormula(f) {
    if (!f) return ''
    if (typeof f === 'string') return f
    // Structured form: {op, operands}
    try { return JSON.stringify(f) } catch { return '' }
}

function formatDate(d) {
    if (!d) return '—'
    return new Date(d).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })
}

// ─── Loading ──────────────────────────────────────────────────────────────────
async function loadSet() {
    loading.value = true
    error.value = null
    try {
        const data = await adminStore.getSetById(setId.value)
        set.value = data.set
        rows.value = data.rows || []
        equityConfig.value = data.config || null
        buildGraph()
    } catch (err) {
        error.value = err.response?.data?.message || 'Ошибка загрузки'
    } finally {
        loading.value = false
    }
}

// ─── Graph ────────────────────────────────────────────────────────────────────
function buildGraph() {
    if (!isRowBased.value) return

    const filtered = graphSectionFilter.value
        ? rows.value.filter(r => r.section === graphSectionFilter.value)
        : rows.value

    const nodes = []
    const edges = []

    // Collect unique NSBU codes (left column) and IFRS classifications (right column)
    const nsbuCodeSet = new Set()
    const ifrsClassSet = new Set()

    filtered.forEach(r => {
        const codes = (r.nsbuCodes || []).filter(c => c && c !== 'calculated')
        if (codes.length === 0) {
            nsbuCodeSet.add(`row:${r.nsbuRowCode}`)
        } else {
            codes.forEach(c => nsbuCodeSet.add(c))
        }
        if (r.ifrsClassification) ifrsClassSet.add(r.ifrsClassification)
    })

    const nsbuList = Array.from(nsbuCodeSet).sort()
    const ifrsList = Array.from(ifrsClassSet).sort()

    const xLeft = 50
    const xRight = 500
    const ySpacing = 38

    nsbuList.forEach((code, i) => {
        nodes.push({
            id: `nsbu:${code}`,
            type: 'default',
            position: { x: xLeft, y: 30 + i * ySpacing },
            data: { label: code },
            sourcePosition: 'right',
            targetPosition: 'left',
            class: 'adm-flow-node adm-flow-node--nsbu',
            style: { width: 120 }
        })
    })

    ifrsList.forEach((cls, i) => {
        nodes.push({
            id: `ifrs:${cls}`,
            type: 'default',
            position: { x: xRight, y: 30 + i * ySpacing },
            data: { label: cls },
            sourcePosition: 'right',
            targetPosition: 'left',
            class: 'adm-flow-node adm-flow-node--ifrs',
            style: { width: 280 }
        })
    })

    filtered.forEach(r => {
        const codes = (r.nsbuCodes || []).filter(c => c && c !== 'calculated')
        const targets = codes.length > 0 ? codes : [`row:${r.nsbuRowCode}`]
        targets.forEach(code => {
            if (!r.ifrsClassification) return
            edges.push({
                id: `e:${code}->${r.nsbuRowCode}->${r.ifrsClassification}`,
                source: `nsbu:${code}`,
                target: `ifrs:${r.ifrsClassification}`,
                label: r.nsbuRowCode,
                labelStyle: { fontSize: '10px', fill: 'rgba(240, 236, 246, 0.7)' },
                style: {
                    stroke: r.isNegative ? '#f87171' : '#a855f7',
                    strokeWidth: 1.5
                },
                markerEnd: { type: MarkerType.ArrowClosed, color: r.isNegative ? '#f87171' : '#a855f7' }
            })
        })
    })

    graphNodes.value = nodes
    graphEdges.value = edges
}

watch(graphSectionFilter, () => buildGraph())

function onNodeClick(event) {
    const id = event.node?.id
    if (!id) return
    if (id.startsWith('ifrs:')) {
        const cls = id.substring(5)
        const matches = rows.value.filter(r => r.ifrsClassification === cls)
        const summary = matches.map(r => `${r.nsbuRowCode} → ${r.ifrsClassification}`).join('\n')
        alert(`IFRS: ${cls}\n\n${summary}`)
    }
}

/**
 * Handle a new connection drawn in the graph: NSBU node → IFRS node.
 *
 * Strategy:
 *   - Find the RowMapping that contains the NSBU code in its `nsbuCodes` array
 *     (these are the rows that actually contribute the value to the IFRS line).
 *   - If found: PATCH that row's `ifrsClassification` to the target IFRS label.
 *     This effectively REPOINTS the row to the new IFRS line.
 *   - If not found (NSBU code exists in graph only because some row's
 *     `nsbuRowCode` matched, but isn't in any row's `nsbuCodes`):
 *     open the row-create modal pre-filled with this connection.
 *
 * Only works in draft mode for super_admin (gated by `:nodes-connectable` already).
 */
async function onGraphConnect(connection) {
    if (!isDraft.value || !isSuperAdmin.value) return
    if (!connection?.source || !connection?.target) return

    if (!connection.source.startsWith('nsbu:') || !connection.target.startsWith('ifrs:')) {
        alert('Связи поддерживаются только от НСБУ-узла (слева) к IFRS-узлу (справа).')
        return
    }

    const nsbuCode = connection.source.substring(5)
    const ifrsClassification = connection.target.substring(5)

    // Find row(s) that include this NSBU code in nsbuCodes
    const matchingRows = rows.value.filter(r => (r.nsbuCodes || []).includes(nsbuCode))

    if (matchingRows.length === 0) {
        // No existing row references this NSBU code as a source. Maybe it's a
        // standalone row (nsbuRowCode = nsbuCode but empty nsbuCodes). Try that.
        const byRowCode = rows.value.find(r => r.nsbuRowCode === nsbuCode)
        if (byRowCode) {
            if (!confirm(`Изменить IFRS-цель строки "${byRowCode.nsbuRowCode}" на "${ifrsClassification}"?`)) return
            try {
                await adminStore.updateRow(byRowCode._id, { ifrsClassification })
                await loadSet()
            } catch (err) {
                alert(err.response?.data?.message || 'Ошибка обновления')
                buildGraph()
            }
            return
        }

        // Genuinely new mapping — open create modal pre-filled
        editingRow.value = null
        rowForm.nsbuRowCode = ''
        rowForm.ifrsClassification = ifrsClassification
        rowForm.nsbuCodesString = nsbuCode
        rowForm.nsbuDescription = ''
        rowForm.section = ''
        rowForm.subsection = ''
        rowForm.isNegative = false
        rowForm.isCalculated = false
        rowForm.formulaString = ''
        rowForm.notes = ''
        showAddRowModal.value = true
        // Revert the graph edge we just drew — it will reappear after user saves the row
        buildGraph()
        return
    }

    if (matchingRows.length === 1) {
        const r = matchingRows[0]
        if (r.ifrsClassification === ifrsClassification) {
            // Already mapped this way — no-op (vue-flow might still create
            // a duplicate edge; rebuild to dedupe).
            buildGraph()
            return
        }
        if (!confirm(`Изменить IFRS-цель строки "${r.nsbuRowCode}" с "${r.ifrsClassification}" на "${ifrsClassification}"?`)) {
            buildGraph()
            return
        }
        try {
            await adminStore.updateRow(r._id, { ifrsClassification })
            await loadSet()
        } catch (err) {
            alert(err.response?.data?.message || 'Ошибка обновления')
            buildGraph()
        }
        return
    }

    // Multiple rows contain this NSBU code — ambiguous, ask which one to edit.
    const labels = matchingRows.map((r, i) => `${i + 1}: ${r.nsbuRowCode} (${r.ifrsClassification})`).join('\n')
    const choice = prompt(`НСБУ-код ${nsbuCode} используется в нескольких строках. Какую переназначить на "${ifrsClassification}"?\n\n${labels}\n\nВведите номер:`)
    const idx = parseInt(choice, 10) - 1
    if (Number.isNaN(idx) || idx < 0 || idx >= matchingRows.length) {
        buildGraph()
        return
    }
    try {
        await adminStore.updateRow(matchingRows[idx]._id, { ifrsClassification })
        await loadSet()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка обновления')
        buildGraph()
    }
}

/**
 * Handle clicking an edge in the graph: offer to remove the NSBU code from
 * the row's nsbuCodes (which severs this particular contribution).
 */
async function onGraphEdgeClick(event) {
    if (!isDraft.value || !isSuperAdmin.value) return
    const edge = event.edge
    if (!edge) return

    const nsbuCode = String(edge.source || '').replace(/^nsbu:/, '')
    const ifrsTarget = String(edge.target || '').replace(/^ifrs:/, '')
    const rowCode = edge.label

    // Find the row this edge represents
    const row = rows.value.find(r =>
        r.nsbuRowCode === rowCode &&
        r.ifrsClassification === ifrsTarget &&
        (r.nsbuCodes || []).includes(nsbuCode)
    )
    if (!row) {
        // Edge represents a synthetic row->ifrs link (no nsbuCodes), nothing to detach
        return
    }

    if (!confirm(`Убрать НСБУ-код "${nsbuCode}" из строки "${row.nsbuRowCode}" (${row.ifrsClassification})?`)) {
        return
    }

    const newCodes = (row.nsbuCodes || []).filter(c => c !== nsbuCode)
    try {
        await adminStore.updateRow(row._id, { nsbuCodes: newCodes })
        await loadSet()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка обновления')
    }
}

// ─── Row CRUD ─────────────────────────────────────────────────────────────────
function editRow(row) {
    editingRow.value = row
    rowForm.nsbuRowCode = row.nsbuRowCode || ''
    rowForm.ifrsClassification = row.ifrsClassification || ''
    rowForm.nsbuCodesString = (row.nsbuCodes || []).join(', ')
    rowForm.nsbuDescription = row.nsbuDescription || ''
    rowForm.section = row.section || ''
    rowForm.subsection = row.subsection || ''
    rowForm.isNegative = !!row.isNegative
    rowForm.isCalculated = !!row.isCalculated
    rowForm.formulaString = typeof row.formula === 'string' ? row.formula : (row.formula ? JSON.stringify(row.formula) : '')
    rowForm.notes = row.notes || ''
    showAddRowModal.value = true
}

function closeRowModal() {
    showAddRowModal.value = false
    editingRow.value = null
    Object.assign(rowForm, {
        nsbuRowCode: '', ifrsClassification: '', nsbuCodesString: '',
        nsbuDescription: '', section: '', subsection: '',
        isNegative: false, isCalculated: false, formulaString: '', notes: ''
    })
}

function buildRowPayload() {
    const nsbuCodes = rowForm.nsbuCodesString
        ? rowForm.nsbuCodesString.split(',').map(c => c.trim()).filter(Boolean)
        : []

    let formula = null
    if (rowForm.isCalculated && rowForm.formulaString) {
        // Try JSON first; fall back to plain string
        try {
            formula = JSON.parse(rowForm.formulaString)
        } catch {
            formula = rowForm.formulaString
        }
    }

    return {
        nsbuRowCode: rowForm.nsbuRowCode.trim(),
        nsbuCodes,
        ifrsClassification: rowForm.ifrsClassification.trim(),
        nsbuDescription: rowForm.nsbuDescription,
        section: rowForm.section,
        subsection: rowForm.subsection,
        isNegative: rowForm.isNegative,
        isCalculated: rowForm.isCalculated,
        formula,
        notes: rowForm.notes
    }
}

async function saveRow() {
    try {
        const payload = buildRowPayload()
        if (editingRow.value) {
            // nsbuRowCode is disabled on edit, don't send it
            const { nsbuRowCode, ...patch } = payload
            await adminStore.updateRow(editingRow.value._id, patch)
        } else {
            await adminStore.addRow(setId.value, payload)
        }
        closeRowModal()
        await loadSet()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка сохранения строки')
    }
}

async function deleteRow(row) {
    if (!confirm(`Удалить строку ${row.nsbuRowCode}?`)) return
    try {
        await adminStore.deleteRow(row._id)
        await loadSet()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка удаления')
    }
}

// ─── Publish ──────────────────────────────────────────────────────────────────
async function doPublish() {
    try {
        await adminStore.publishDraft(setId.value, publishNotes.value)
        showPublishModal.value = false
        publishNotes.value = ''
        await loadSet()
    } catch (err) {
        alert(err.response?.data?.message || 'Ошибка публикации')
    }
}

onMounted(loadSet)
</script>

<style scoped>
.adm-graph-container {
    background: rgba(20, 14, 32, 0.6);
    border: 1px solid rgba(149, 0, 255, 0.12);
    border-radius: 12px;
    overflow: hidden;
}

.adm-graph-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(149, 0, 255, 0.1);
}

.adm-graph-hint {
    padding: 8px 16px;
    border-top: 1px solid rgba(149, 0, 255, 0.1);
    font-size: 11px;
    color: rgba(240, 236, 246, 0.5);
    background: rgba(15, 10, 26, 0.4);
}

.adm-graph-canvas {
    height: calc(100vh - 280px);
    min-height: 500px;
    background: rgb(15, 10, 26);
}

/* vue-flow node styling */
:deep(.vue-flow__node) {
    background: rgba(30, 22, 50, 0.95);
    border: 1px solid rgba(149, 0, 255, 0.3);
    color: rgba(240, 236, 246, 0.95);
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
}

:deep(.adm-flow-node--nsbu) {
    border-color: rgba(168, 85, 247, 0.45);
    font-family: 'SF Mono', Monaco, Consolas, monospace;
}

:deep(.adm-flow-node--ifrs) {
    border-color: rgba(96, 165, 250, 0.45);
    background: rgba(20, 30, 50, 0.95);
}

:deep(.vue-flow__node.selected) {
    border-color: #c084fc;
    box-shadow: 0 0 0 2px rgba(192, 132, 252, 0.25);
}

:deep(.vue-flow__minimap) {
    background: rgba(15, 10, 26, 0.9);
}

:deep(.vue-flow__controls) {
    background: rgba(15, 10, 26, 0.9);
    border: 1px solid rgba(149, 0, 255, 0.2);
    border-radius: 6px;
}

:deep(.vue-flow__controls-button) {
    background: transparent;
    color: rgba(240, 236, 246, 0.85);
    border-bottom: 1px solid rgba(149, 0, 255, 0.1);
}

:deep(.vue-flow__controls-button:hover) {
    background: rgba(149, 0, 255, 0.1);
}

/* Equity list */
.adm-equity-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.adm-equity-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: rgba(15, 10, 26, 0.5);
    border-radius: 6px;
    flex-wrap: wrap;
}
</style>
