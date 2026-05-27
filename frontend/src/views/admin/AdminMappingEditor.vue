<template>
    <div class="adm-page" style="max-width: none;">
        <div class="adm-page-header">
            <div>
                <router-link to="/admin/mappings" class="adm-page-subtitle" style="text-decoration: none;">
                    {{ $t('admin.mappingEditor.backLink') }}
                </router-link>
                <h1 class="adm-page-title" v-if="set">
                    {{ reportTypeLabel(set.reportType) }} {{ $t('admin.mappingEditor.versionLabel', { version: set.version }) }}
                </h1>
                <div v-if="set" class="adm-page-subtitle">
                    <span class="adm-badge" :class="`adm-badge--mappingset-${set.status}`">{{ set.status }}</span>
                    <span v-if="set.publishedAt" class="adm-muted" style="margin-left: 8px;">
                        {{ $t('admin.mappingEditor.publishedAt', { date: formatDate(set.publishedAt) }) }}
                    </span>
                </div>
            </div>
            <div class="adm-row">
                <button v-if="isDraft && isSuperAdmin && isRowBased"
                    class="adm-btn adm-btn--ghost"
                    @click="showAddRowModal = true">
                    {{ $t('admin.mappingEditor.addRow') }}
                </button>
                <button v-if="isDraft && isSuperAdmin"
                    class="adm-btn adm-btn--primary"
                    @click="showPublishModal = true">
                    {{ $t('admin.mappingEditor.publishDraft') }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="adm-empty">{{ $t('admin.common.loading') }}</div>
        <div v-else-if="error" class="adm-empty">{{ error }}</div>
        <template v-else-if="set">
            <!-- Metadata: who created/published this version + their notes -->
            <div class="adm-card adm-meta-card">
                <div class="adm-meta-row">
                    <div class="adm-meta-item">
                        <div class="adm-meta-label">{{ $t('admin.mappingEditor.metaCreatedBy') }}</div>
                        <div class="adm-meta-value">
                            {{ set.createdBy?.name || set.createdBy?.email || $t('admin.mappingEditor.metaSystem') }}
                            <span v-if="set.createdAt" class="adm-muted adm-text-xs">
                                · {{ formatDate(set.createdAt) }}
                            </span>
                        </div>
                    </div>
                    <div v-if="set.publishedBy" class="adm-meta-item">
                        <div class="adm-meta-label">{{ $t('admin.mappingEditor.metaPublishedBy') }}</div>
                        <div class="adm-meta-value">
                            {{ set.publishedBy?.name || set.publishedBy?.email }}
                            <span v-if="set.publishedAt" class="adm-muted adm-text-xs">
                                · {{ formatDate(set.publishedAt) }}
                            </span>
                        </div>
                    </div>
                </div>
                <div v-if="set.notes" class="adm-meta-notes">
                    <div class="adm-meta-label">{{ $t('admin.mappingEditor.metaNotes') }}</div>
                    <div class="adm-meta-notes-text">{{ set.notes }}</div>
                </div>
            </div>

            <!-- Scope card: shows assignedUsers and label. Editable for drafts
                 by super_admin. For published/archived, read-only. -->
            <div class="adm-card adm-meta-card">
                <div class="adm-row" style="justify-content: space-between; margin-bottom: 8px;">
                    <div class="adm-meta-label">{{ $t('admin.mappingEditor.scopeTitle') }}</div>
                    <button v-if="isDraft && isSuperAdmin && !scopeEditMode"
                        class="adm-btn adm-btn--sm adm-btn--ghost"
                        @click="openScopeEditor">
                        {{ $t('admin.common.edit') }}
                    </button>
                </div>

                <div v-if="!scopeEditMode">
                    <div v-if="!isUserSpecificSet" class="adm-text-sm adm-muted">
                        {{ $t('admin.mappingEditor.scopeGlobalNote') }}
                    </div>
                    <div v-else>
                        <div v-if="set.label" class="adm-meta-value" style="margin-bottom: 6px;">
                            <strong>{{ set.label }}</strong>
                        </div>
                        <div class="adm-text-sm adm-muted">
                            {{ $t('admin.mappingEditor.scopeAssignedTo') }}:
                        </div>
                        <div class="adm-text-sm" style="margin-top: 4px;">
                            <span v-for="u in set.assignedUsers" :key="u._id || u" class="adm-user-multi-chip"
                                style="margin: 2px 4px 2px 0;">
                                <span class="adm-user-multi-chip-email">{{ u.email || u }}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <div v-else>
                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappings.scopeLabel') }}</div>
                        <input v-model="scopeForm.label" type="text" class="adm-input"
                            :placeholder="$t('admin.mappings.scopeLabelPlaceholder')" />
                    </div>
                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappings.scopeAssignedUsers') }}</div>
                        <div class="adm-text-sm adm-muted" style="margin-bottom: 6px;">
                            {{ $t('admin.mappingEditor.scopeAssignedHint') }}
                        </div>
                        <UserMultiSelect v-model="scopeForm.assignedUsers" />
                    </div>
                    <div class="adm-row" style="gap: 8px; justify-content: flex-end;">
                        <button class="adm-btn adm-btn--ghost" @click="cancelScopeEdit"
                            :disabled="scopeSubmitting">
                            {{ $t('admin.common.cancel') }}
                        </button>
                        <button class="adm-btn adm-btn--primary" @click="saveScopeEdit"
                            :disabled="scopeSubmitting">
                            {{ scopeSubmitting ? $t('admin.common.saving') : $t('admin.common.save') }}
                        </button>
                    </div>
                </div>
            </div>

            <!-- View toggle -->
            <div class="adm-card" style="padding: 12px 16px;" v-if="isRowBased">
                <div class="adm-row" style="gap: 8px;">
                    <button class="adm-btn adm-btn--sm"
                        :class="viewMode === 'table' ? 'adm-btn--primary' : 'adm-btn--ghost'"
                        @click="viewMode = 'table'">
                        {{ $t('admin.mappingEditor.viewTable') }}
                    </button>
                    <button class="adm-btn adm-btn--sm"
                        :class="viewMode === 'graph' ? 'adm-btn--primary' : 'adm-btn--ghost'"
                        @click="viewMode = 'graph'">
                        {{ $t('admin.mappingEditor.viewGraph') }}
                    </button>
                    <input
                        v-if="viewMode === 'table'"
                        v-model="rowSearch"
                        class="adm-input"
                        :placeholder="$t('admin.mappingEditor.searchPlaceholder')"
                        style="margin-left: auto; max-width: 320px;"
                    />
                </div>
            </div>

            <!-- Row-based: table view -->
            <div v-if="isRowBased && viewMode === 'table'" class="adm-table-wrap">
                <table class="adm-table">
                    <thead>
                        <tr>
                            <th>{{ $t('admin.mappingEditor.tableNsbuCode') }}</th>
                            <th>{{ $t('admin.mappingEditor.tableNsbuAccounts') }}</th>
                            <th>{{ $t('admin.mappingEditor.tableIFRS') }}</th>
                            <th>{{ $t('admin.mappingEditor.tableSection') }}</th>
                            <th>{{ $t('admin.mappingEditor.tableFlags') }}</th>
                            <th>{{ $t('admin.mappingEditor.tableFormula') }}</th>
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
                                <span v-if="row.isCalculated" class="adm-badge adm-badge--flag-calc">{{ $t('admin.mappingEditor.flagCalc') }}</span>
                                <span v-if="row.isNegative" class="adm-badge adm-badge--flag-neg">{{ $t('admin.mappingEditor.flagNeg') }}</span>
                                <span v-if="row.flowType" class="adm-badge adm-badge--flag-flow">{{ row.flowType }}</span>
                            </td>
                            <td class="adm-mono adm-text-xs adm-muted">
                                {{ formatFormula(row.formula) }}
                            </td>
                            <td v-if="isDraft && isSuperAdmin">
                                <button class="adm-btn adm-btn--sm adm-btn--ghost"
                                    @click="editRow(row)">{{ $t('admin.mappingEditor.btnEdit') }}</button>
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
                        {{ $t('admin.mappingEditor.graphHint') }}
                    </div>
                    <select v-model="graphSectionFilter" class="adm-select" style="width: auto; min-width: 200px;">
                        <option value="">{{ $t('admin.mappingEditor.filterAllSections') }}</option>
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
                        <!-- Vue Flow `Background` paints SVG dots inline and
                             does not read CSS custom properties. A faint
                             purple at 0.08 alpha is visible (just barely)
                             on both light and dark theme surfaces, so we
                             leave it literal rather than maintain two
                             variants. -->
                        <Background pattern-color="rgba(124, 58, 237, 0.12)" :gap="20" />
                        <MiniMap pannable zoomable />
                        <Controls />
                    </VueFlow>
                </div>
                <div v-if="isDraft && isSuperAdmin" class="adm-graph-hint">
                    {{ $t('admin.mappingEditor.graphDragHint') }}
                </div>
            </div>

            <!-- Equity view (read-only summary) -->
            <div v-else-if="set.reportType === 'equity'" class="adm-card">
                <h3 class="adm-card-title">{{ $t('admin.mappingEditor.equityConfigTitle') }}</h3>
                <div v-if="!equityConfig" class="adm-empty">{{ $t('admin.mappingEditor.equityNoConfig') }}</div>
                <template v-else>
                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappingEditor.equityColumns') }}</div>
                        <div class="adm-equity-list">
                            <div v-for="c in equityConfig.columns" :key="c.key" class="adm-equity-item">
                                <span class="adm-mono">{{ c.key }}</span>
                                <span class="adm-text-sm">{{ c.label }}</span>
                                <span v-if="c.isNegative" class="adm-badge adm-badge--flag-neg">{{ $t('admin.mappingEditor.flagNeg') }}</span>
                                <span v-if="c.isCalculated" class="adm-badge adm-badge--flag-calc">{{ $t('admin.mappingEditor.flagCalc') }}</span>
                                <span class="adm-mono adm-text-xs adm-muted">
                                    [{{ (c.nsbuRows || []).join(', ') }}]
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappingEditor.equityMovementRows') }}</div>
                        <div class="adm-equity-list">
                            <div v-for="r in equityConfig.movementRows" :key="r.key" class="adm-equity-item">
                                <span class="adm-mono">{{ r.key }}</span>
                                <span class="adm-text-sm">{{ r.label }}</span>
                                <span v-if="r.isTotal" class="adm-badge adm-badge--flag-calc">{{ $t('admin.mappingEditor.equityFlagTotal') }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappingEditor.equityRowPatterns') }}</div>
                        <div class="adm-equity-list">
                            <div v-for="p in equityConfig.rowPatterns" :key="p.key" class="adm-equity-item">
                                <span class="adm-mono">{{ p.key }}</span>
                                <span class="adm-mono adm-text-xs adm-muted">/{{ p.pattern }}/{{ p.flags || 'i' }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappingEditor.equityColumnPatterns') }}</div>
                        <div class="adm-equity-list">
                            <div v-for="p in equityConfig.columnPatterns" :key="p.key" class="adm-equity-item">
                                <span class="adm-mono">{{ p.key }}</span>
                                <span class="adm-mono adm-text-xs adm-muted">/{{ p.pattern }}/{{ p.flags || 'i' }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Inline JSON editor for the equity config. Available
                         only on draft sets and only for super admins (same
                         constraint as the previous "edit via API" note).
                         A JSON form is the most pragmatic choice here — the
                         schema has 4 array-shaped sections (columns,
                         movementRows, rowPatterns, columnPatterns) and
                         building a structured UI for each would be much
                         more code without meaningfully reducing error
                         surface, since the admin still has to know the
                         field names. Validation happens on save: we parse
                         JSON locally and the backend validates regex
                         patterns before persisting. -->
                    <div v-if="isDraft && isSuperAdmin" class="adm-equity-editor">
                        <div class="adm-row" style="justify-content: space-between; margin-bottom: 10px;">
                            <div class="adm-field-label" style="margin: 0;">
                                {{ $t('admin.mappingEditor.equityJsonEditorTitle') }}
                            </div>
                            <div class="adm-row" style="gap: 8px;">
                                <button v-if="!equityEditMode"
                                    class="adm-btn adm-btn--ghost"
                                    @click="openEquityEditor">
                                    {{ $t('admin.mappingEditor.equityEditBtn') }}
                                </button>
                                <template v-else>
                                    <button class="adm-btn adm-btn--ghost"
                                        @click="cancelEquityEdit"
                                        :disabled="equitySaving">
                                        {{ $t('admin.common.cancel') }}
                                    </button>
                                    <button class="adm-btn adm-btn--primary"
                                        @click="saveEquityConfig"
                                        :disabled="equitySaving || !!equityJsonError">
                                        {{ equitySaving ? $t('admin.common.saving') : $t('admin.common.save') }}
                                    </button>
                                </template>
                            </div>
                        </div>

                        <div v-if="equityEditMode">
                            <textarea
                                v-model="equityJsonDraft"
                                class="adm-equity-json"
                                spellcheck="false"
                                @input="validateEquityJson"
                            />
                            <div class="adm-muted adm-text-xs" style="margin-top: 6px;">
                                {{ $t('admin.mappingEditor.equityJsonHint') }}
                            </div>
                            <div v-if="equityJsonError" class="adm-text-sm" style="color: var(--adm-danger-text); margin-top: 8px;">
                                {{ equityJsonError }}
                            </div>
                            <div v-else-if="equitySaveError" class="adm-text-sm" style="color: var(--adm-danger-text); margin-top: 8px;">
                                {{ equitySaveError }}
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </template>

        <!-- Add/Edit row modal -->
        <div v-if="showAddRowModal" class="adm-modal-backdrop" @click.self="closeRowModal">
            <div class="adm-modal">
                <h3 class="adm-modal-title">{{ editingRow ? $t('admin.mappingEditor.rowModalEdit') : $t('admin.mappingEditor.rowModalNew') }}</h3>
                <div class="adm-grid-2">
                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappingEditor.fieldNsbuCode') }} *</div>
                        <input v-model="rowForm.nsbuRowCode" class="adm-input" placeholder="010" :disabled="!!editingRow" />
                    </div>
                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappingEditor.fieldIFRS') }} *</div>
                        <AdminCombobox
                            v-model="rowForm.ifrsClassification"
                            :suggestions="suggestionsIfrs"
                            datalist-id="mapeditor-ifrs"
                            placeholder="PP&E - Gross"
                        />
                    </div>
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappingEditor.fieldNsbuCodes') }}</div>
                    <AdminCombobox
                        v-model="rowForm.nsbuCodesString"
                        :suggestions="suggestionsNsbuCodes"
                        datalist-id="mapeditor-nsbu-codes"
                        placeholder="0100, 0300"
                    />
                </div>
                <div class="adm-grid-2">
                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappingEditor.fieldSection') }}</div>
                        <AdminCombobox
                            v-model="rowForm.section"
                            :suggestions="suggestionsSection"
                            datalist-id="mapeditor-section"
                            placeholder="ASSETS - NON-CURRENT"
                        />
                    </div>
                    <div class="adm-field">
                        <div class="adm-field-label">{{ $t('admin.mappingEditor.fieldSubsection') }}</div>
                        <AdminCombobox
                            v-model="rowForm.subsection"
                            :suggestions="suggestionsSubsection"
                            datalist-id="mapeditor-subsection"
                            placeholder="Property, Plant & Equipment"
                        />
                    </div>
                </div>
                <!-- Flags: stacked vertically with helper text so the meaning
                     is explicit instead of a bare "Calculated" checkbox. -->
                <div class="adm-flag-group">
                    <label class="adm-flag-row">
                        <input type="checkbox" v-model="rowForm.isNegative" />
                        <span class="adm-flag-body">
                            <span class="adm-flag-label">{{ $t('admin.mappingEditor.fieldFlagNegative') }}</span>
                            <span class="adm-flag-hint">{{ $t('admin.mappingEditor.fieldFlagNegativeHint') }}</span>
                        </span>
                    </label>
                    <label class="adm-flag-row">
                        <input type="checkbox" v-model="rowForm.isCalculated" />
                        <span class="adm-flag-body">
                            <span class="adm-flag-label">{{ $t('admin.mappingEditor.fieldFlagCalculated') }}</span>
                            <span class="adm-flag-hint">{{ $t('admin.mappingEditor.fieldFlagCalculatedHint') }}</span>
                        </span>
                    </label>
                </div>
                <div class="adm-field" v-if="rowForm.isCalculated">
                    <div class="adm-field-label">{{ $t('admin.mappingEditor.fieldFormula') }}</div>
                    <input v-model="rowForm.formulaString" class="adm-input" placeholder="010 - 011" />
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappingEditor.fieldDescription') }}</div>
                    <input v-model="rowForm.nsbuDescription" class="adm-input" />
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappingEditor.fieldNotes') }}</div>
                    <textarea v-model="rowForm.notes" class="adm-textarea"></textarea>
                </div>
                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="closeRowModal">{{ $t('admin.common.cancel') }}</button>
                    <button class="adm-btn adm-btn--primary" @click="saveRow" :disabled="!rowForm.nsbuRowCode || !rowForm.ifrsClassification">
                        {{ $t('admin.common.save') }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Publish modal -->
        <div v-if="showPublishModal" class="adm-modal-backdrop" @click.self="showPublishModal = false">
            <div class="adm-modal">
                <h3 class="adm-modal-title">{{ $t('admin.mappingEditor.publishModalTitle') }}</h3>
                <div class="adm-text-sm" style="margin-bottom: 12px;">
                    {{ $t('admin.mappingEditor.publishModalDescription') }}
                </div>
                <div class="adm-field">
                    <div class="adm-field-label">{{ $t('admin.mappingEditor.publishModalNotes') }}</div>
                    <textarea v-model="publishNotes" class="adm-textarea" :placeholder="$t('admin.mappingEditor.publishModalNotesPlaceholder')"></textarea>
                </div>
                <div class="adm-modal-actions">
                    <button class="adm-btn adm-btn--ghost" @click="showPublishModal = false">{{ $t('admin.common.cancel') }}</button>
                    <button class="adm-btn adm-btn--primary" @click="doPublish">{{ $t('admin.mappingEditor.publishModalAction') }}</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdminStore } from '@/stores/admin'
import AdminCombobox from '@/components/admin/AdminCombobox.vue'
import UserMultiSelect from '@/components/admin/UserMultiSelect.vue'
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
const { t, locale } = useI18n()

const set = ref(null)
const rows = ref([])
const equityConfig = ref(null)

// Equity JSON editor state. Activated only when admin clicks "Edit" on a
// draft equity set. The textarea is bound to equityJsonDraft; on input we
// re-parse and store any error in equityJsonError so the Save button can
// stay disabled until the JSON is syntactically valid. Server-side validation
// errors (e.g. bad regex) come back as equitySaveError.
const equityEditMode = ref(false)
const equityJsonDraft = ref('')
const equityJsonError = ref('')
const equitySaveError = ref('')
const equitySaving = ref(false)

// Scope editor state — assigns the draft to specific users (or makes it global
// by clearing the user list). Editable only on drafts by super_admin.
const scopeEditMode = ref(false)
const scopeSubmitting = ref(false)
const scopeForm = reactive({
    assignedUsers: [],
    label: ''
})

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
const isUserSpecificSet = computed(() => Array.isArray(set.value?.assignedUsers) && set.value.assignedUsers.length > 0)

const availableSections = computed(() => {
    const s = new Set()
    rows.value.forEach(r => { if (r.section) s.add(r.section) })
    return Array.from(s).sort()
})

// ── Combobox suggestion sources ──
// All four fields surface existing distinct values from rows.value as
// autocomplete hints. As the methodology stabilizes, admin will start seeing
// well-known classifications and pick them; new ones still allowed via
// free-text input. See AdminCombobox.vue for rationale.
const suggestionsIfrs = computed(() => {
    const s = new Set()
    rows.value.forEach(r => { if (r.ifrsClassification) s.add(r.ifrsClassification) })
    return Array.from(s)
})

const suggestionsSection = computed(() => availableSections.value)

const suggestionsSubsection = computed(() => {
    const s = new Set()
    rows.value.forEach(r => { if (r.subsection) s.add(r.subsection) })
    return Array.from(s)
})

// NSBU codes: individual codes (e.g. '0100') unrolled from nsbuCodes arrays.
// We surface ALL codes seen across rows so admin can spot which codes are
// already mapped elsewhere — useful for catching accidental double-mappings.
const suggestionsNsbuCodes = computed(() => {
    const s = new Set()
    rows.value.forEach(r => {
        (r.nsbuCodes || []).forEach(c => {
            if (c && c !== 'calculated') s.add(c)
        })
    })
    return Array.from(s)
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
    const key = {
        balance_sheet: 'admin.mappings.reportTypeBalanceSheet',
        cash_flow: 'admin.mappings.reportTypeCashFlow',
        profit_loss_form2: 'admin.mappings.reportTypeProfitLossForm2',
        equity: 'admin.mappings.reportTypeEquity'
    }[rt]
    return key ? t(key) : rt
}

function formatFormula(f) {
    if (!f) return ''
    if (typeof f === 'string') return f
    // Structured form: {op, operands}
    try { return JSON.stringify(f) } catch { return '' }
}

function formatDate(d) {
    if (!d) return '—'
    const localeMap = { ru: 'ru-RU', en: 'en-GB', uz: 'uz-UZ' }
    return new Date(d).toLocaleString(localeMap[locale.value] || 'ru-RU', {
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
        error.value = err.response?.data?.message || t('admin.common.error')
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
            // Vue Flow renders these as inline SVG attributes and does not
            // resolve CSS custom properties. Colors here are chosen to stay
            // legible on both light and dark surfaces:
            //   - label fill: mid-grey (#71717a) reads on white and on
            //     the dark workspace bg.
            //   - edge stroke: saturated red (#ef4444) and saturated
            //     purple (#a855f7) are visible in both themes.
            edges.push({
                id: `e:${code}->${r.nsbuRowCode}->${r.ifrsClassification}`,
                source: `nsbu:${code}`,
                target: `ifrs:${r.ifrsClassification}`,
                label: r.nsbuRowCode,
                labelStyle: { fontSize: '10px', fill: '#71717a' },
                style: {
                    stroke: r.isNegative ? '#ef4444' : '#a855f7',
                    strokeWidth: 1.5
                },
                markerEnd: { type: MarkerType.ArrowClosed, color: r.isNegative ? '#ef4444' : '#a855f7' }
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
        alert(t('admin.mappingEditor.graphOnlyNsbuToIfrs'))
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
            if (!confirm(t('admin.mappingEditor.graphRetargetSingle', { code: byRowCode.nsbuRowCode, target: ifrsClassification }))) return
            try {
                await adminStore.updateRow(byRowCode._id, { ifrsClassification })
                await loadSet()
            } catch (err) {
                alert(err.response?.data?.message || t('admin.mappingEditor.graphUpdateError'))
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
        if (!confirm(t('admin.mappingEditor.graphRetargetExisting', { code: r.nsbuRowCode, current: r.ifrsClassification, target: ifrsClassification }))) {
            buildGraph()
            return
        }
        try {
            await adminStore.updateRow(r._id, { ifrsClassification })
            await loadSet()
        } catch (err) {
            alert(err.response?.data?.message || t('admin.mappingEditor.graphUpdateError'))
            buildGraph()
        }
        return
    }

    // Multiple rows contain this NSBU code — ambiguous, ask which one to edit.
    const labels = matchingRows.map((r, i) => `${i + 1}: ${r.nsbuRowCode} (${r.ifrsClassification})`).join('\n')
    const choice = prompt(`${t('admin.mappingEditor.graphMultipleRows', { code: nsbuCode, target: ifrsClassification })}\n\n${labels}\n\n${t('admin.mappingEditor.graphEnterNumber')}`)
    const idx = parseInt(choice, 10) - 1
    if (Number.isNaN(idx) || idx < 0 || idx >= matchingRows.length) {
        buildGraph()
        return
    }
    try {
        await adminStore.updateRow(matchingRows[idx]._id, { ifrsClassification })
        await loadSet()
    } catch (err) {
        alert(err.response?.data?.message || t('admin.mappingEditor.graphUpdateError'))
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

    if (!confirm(t('admin.mappingEditor.graphRemoveEdgeConfirm', { code: nsbuCode, rowCode: row.nsbuRowCode, ifrs: row.ifrsClassification }))) {
        return
    }

    const newCodes = (row.nsbuCodes || []).filter(c => c !== nsbuCode)
    try {
        await adminStore.updateRow(row._id, { nsbuCodes: newCodes })
        await loadSet()
    } catch (err) {
        alert(err.response?.data?.message || t('admin.mappingEditor.graphUpdateError'))
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
        alert(err.response?.data?.message || t('admin.mappingEditor.saveRowError'))
    }
}

async function deleteRow(row) {
    if (!confirm(t('admin.mappingEditor.deleteRowConfirm', { code: row.nsbuRowCode }))) return
    try {
        await adminStore.deleteRow(row._id)
        await loadSet()
    } catch (err) {
        alert(err.response?.data?.message || t('admin.mappingEditor.deleteRowError'))
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
        alert(err.response?.data?.message || t('admin.mappingEditor.publishError'))
    }
}

// ─── Equity JSON editor ──────────────────────────────────────────────────────
// We serialize only the editable parts of the equity config — internal fields
// (mappingSetId, _id, timestamps) are stripped to keep the JSON manageable
// and match exactly the shape the PUT endpoint accepts.
function buildEquityDraftJson(config) {
    if (!config) {
        // Bootstrap an empty skeleton if nothing exists yet.
        return JSON.stringify({
            columns: [],
            movementRows: [],
            rowPatterns: [],
            columnPatterns: [],
            bsRowToEquityColumn: {},
            notes: ''
        }, null, 2)
    }
    // bsRowToEquityColumn comes back as a plain object from .lean() / JSON
    // serialization. If it's a Map (unlikely here, but guard anyway), convert.
    let bsMap = config.bsRowToEquityColumn || {}
    if (bsMap instanceof Map) {
        bsMap = Object.fromEntries(bsMap)
    }
    return JSON.stringify({
        columns: config.columns || [],
        movementRows: config.movementRows || [],
        rowPatterns: config.rowPatterns || [],
        columnPatterns: config.columnPatterns || [],
        bsRowToEquityColumn: bsMap,
        notes: config.notes || ''
    }, null, 2)
}

function openEquityEditor() {
    equityJsonDraft.value = buildEquityDraftJson(equityConfig.value)
    equityJsonError.value = ''
    equitySaveError.value = ''
    equityEditMode.value = true
}

function cancelEquityEdit() {
    equityEditMode.value = false
    equityJsonDraft.value = ''
    equityJsonError.value = ''
    equitySaveError.value = ''
}

function validateEquityJson() {
    equitySaveError.value = ''
    if (!equityJsonDraft.value.trim()) {
        equityJsonError.value = t('admin.mappingEditor.equityJsonEmpty')
        return
    }
    try {
        const parsed = JSON.parse(equityJsonDraft.value)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            equityJsonError.value = t('admin.mappingEditor.equityJsonNotObject')
            return
        }
        equityJsonError.value = ''
    } catch (err) {
        equityJsonError.value = t('admin.mappingEditor.equityJsonInvalid', { message: err.message })
    }
}

async function saveEquityConfig() {
    validateEquityJson()
    if (equityJsonError.value) return
    equitySaving.value = true
    equitySaveError.value = ''
    try {
        const payload = JSON.parse(equityJsonDraft.value)
        const result = await adminStore.updateEquityConfig(setId.value, payload)
        // Refresh from server response so we see canonical state (server may
        // have normalized fields, defaults, etc.)
        if (result?.config) {
            equityConfig.value = result.config
        } else {
            await loadSet()
        }
        equityEditMode.value = false
        equityJsonDraft.value = ''
    } catch (err) {
        // Backend returns specific error codes (INVALID_REGEX, WRONG_REPORT_TYPE)
        // — show whichever message the server provides, falling back to a
        // generic one.
        equitySaveError.value = err.response?.data?.message
            || err.message
            || t('admin.mappingEditor.equityJsonSaveError')
    } finally {
        equitySaving.value = false
    }
}

// ─── Scope editor (assignedUsers + label) ────────────────────────────────────
function openScopeEditor() {
    scopeForm.assignedUsers = (set.value?.assignedUsers || []).map(u => u._id || u)
    scopeForm.label = set.value?.label || ''
    scopeEditMode.value = true
}

function cancelScopeEdit() {
    scopeEditMode.value = false
}

async function saveScopeEdit() {
    scopeSubmitting.value = true
    try {
        await adminStore.updateSetScope(setId.value, {
            assignedUsers: scopeForm.assignedUsers,
            label: scopeForm.label
        })
        // Re-fetch the set to get the populated assignedUsers (emails) back.
        await loadSet()
        scopeEditMode.value = false
    } catch (err) {
        alert(err.response?.data?.message || t('admin.common.error'))
    } finally {
        scopeSubmitting.value = false
    }
}

onMounted(loadSet)
</script>

<style scoped>
.adm-graph-container {
    background: var(--adm-surface);
    border: 1px solid var(--adm-border);
    border-radius: 12px;
    overflow: hidden;
}

.adm-graph-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--adm-border-soft);
}

.adm-graph-hint {
    padding: 8px 16px;
    border-top: 1px solid var(--adm-border-soft);
    font-size: 11px;
    color: var(--adm-text-muted);
    background: var(--adm-input-bg);
}

.adm-graph-canvas {
    height: calc(100vh - 280px);
    min-height: 500px;
    /* Canvas keeps a slightly recessed surface so the Vue Flow nodes and
       edges have contrast against it in both themes. --adm-input-bg has
       the right "darker than the card" character in both light and dark. */
    background: var(--adm-input-bg);
}

/* ─── Inline flag badges (used in row + equity column lists) ──────────────
   Replaced four inline `style="background: rgba(...); color: #..."`
   sites that hardcoded dark-theme values. The classes below use the
   shared --adm-badge-* token pairs so they swap with theme. */
.adm-badge--flag-calc {
    background: var(--adm-badge-purple-bg);
    color: var(--adm-badge-purple-text);
}
.adm-badge--flag-neg {
    background: var(--adm-badge-danger-bg);
    color: var(--adm-badge-danger-text);
    margin-left: 4px;
}
.adm-badge--flag-flow {
    background: var(--adm-badge-info-bg);
    color: var(--adm-badge-info-text);
    margin-left: 4px;
}
/* When a flag-calc badge directly follows another badge (e.g. the equity
   column where flag-neg is rendered before flag-calc), inherit the small
   gap so the badges don't visually collide. */
.adm-badge--flag-neg + .adm-badge--flag-calc,
.adm-badge--flag-flow + .adm-badge--flag-calc {
    margin-left: 4px;
}

/* vue-flow node styling */
:deep(.vue-flow__node) {
    background: var(--adm-surface-2);
    border: 1px solid var(--adm-border);
    color: var(--adm-text);
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
}

:deep(.adm-flow-node--nsbu) {
    /* NSBU side of the graph — purple accent to match the product palette. */
    border-color: var(--adm-badge-purple-bg);
    font-family: 'SF Mono', Monaco, Consolas, monospace;
}

:deep(.adm-flow-node--ifrs) {
    /* IFRS side — blue accent so the two columns are visually distinct
       regardless of label content. */
    border-color: var(--adm-badge-info-bg);
    background: var(--adm-badge-info-bg);
}

:deep(.vue-flow__node.selected) {
    border-color: var(--adm-input-border-focus);
    box-shadow: 0 0 0 2px var(--adm-nav-bg-active);
}

:deep(.vue-flow__minimap) {
    background: var(--adm-surface);
}

:deep(.vue-flow__controls) {
    background: var(--adm-surface);
    border: 1px solid var(--adm-input-border);
    border-radius: 6px;
}

:deep(.vue-flow__controls-button) {
    background: transparent;
    color: var(--adm-text);
    border-bottom: 1px solid var(--adm-border-soft);
}

:deep(.vue-flow__controls-button:hover) {
    background: var(--adm-nav-bg-hover);
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
    background: var(--adm-input-bg);
    border-radius: 6px;
    flex-wrap: wrap;
}

/* Stacked, descriptive checkboxes for row flags (isNegative, isCalculated).
   Replaces the previous bare side-by-side checkboxes — each flag now has
   an explicit label and a one-line hint so the admin understands what
   "Calculated" actually means without referring to docs. */
.adm-flag-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 12px 0;
}

.adm-flag-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    background: var(--adm-input-bg);
    border: 1px solid var(--adm-border-soft);
    border-radius: 8px;
    cursor: pointer;
}

.adm-flag-row:hover {
    background: var(--adm-nav-bg-hover);
}

.adm-flag-row input[type="checkbox"] {
    margin-top: 2px;
    flex-shrink: 0;
}

.adm-flag-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
}

.adm-flag-label {
    font-size: 13px;
    color: var(--adm-text);
    font-weight: 500;
}

.adm-flag-hint {
    font-size: 12px;
    color: var(--adm-text-muted);
    line-height: 1.4;
}

/* Equity JSON editor — appears only on draft equity sets. The textarea is
   monospaced and sized generously so admin can comfortably edit nested
   arrays without constant scrolling. */
.adm-equity-editor {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--adm-border-soft);
}

.adm-equity-json {
    width: 100%;
    min-height: 400px;
    padding: 12px;
    font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--adm-text);
    background: var(--adm-input-bg);
    border: 1px solid var(--adm-input-border);
    border-radius: 8px;
    resize: vertical;
    box-sizing: border-box;
}

.adm-equity-json:focus {
    outline: none;
    border-color: var(--adm-input-border-focus);
}

/* Local copy of the chip style from UserMultiSelect — needed here because
   the chip class in UserMultiSelect.vue is scoped and won't apply to chips
   rendered directly in this template. Display-only (no remove button). */
.adm-user-multi-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--adm-nav-bg-active);
    border: 1px solid var(--adm-border);
    border-radius: 12px;
    font-size: 12px;
    color: var(--adm-text);
}

.adm-user-multi-chip-email {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
