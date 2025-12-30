const ExcelJS = require('exceljs');
const { BALANCE_SHEET_MAPPING } = require('../mappings/accountMapping');
const { styleReport } = require('../utils/excelStyler');

/**
 * Balance Sheet Processor - FINAL FIX
 * Matches your EXACT accountMapping.js structure
 */

function detectBalanceSheetStructure(worksheet) {
    let headerRow = null;
    let codeColumn = null;
    let nameColumn = null;
    let dataStartRow = null;
    let unitDivisor = 1;
    let companyName = null;
    let reportDate = null;
    let inn = null;

    function getCellText(cell) {
        if (!cell || !cell.value) return '';
        if (typeof cell.value === 'object' && cell.value.richText) {
            return cell.value.richText.map(t => t.text || '').join(' ');
        }
        return String(cell.value);
    }

    function normalizeText(text) {
        if (!text) return '';
        return String(text).replace(/\s+/g, ' ').trim().toLowerCase();
    }

    let lastMeaningfulRow = worksheet.rowCount;

    // First pass: Find company name, INN, and report date in the header section
    for (let rowNum = 1; rowNum <= Math.min(worksheet.rowCount, 30); rowNum++) {
        const row = worksheet.getRow(rowNum);

        row.eachCell({ includeEmpty: false }, (cell) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            // Enhanced company name detection - check for company markers
            if (!companyName) {
                // Check if this cell has a label for company name
                if (normalized.includes('корхона') || normalized.includes('предприятие') || 
                    normalized.includes('ташкилот') || normalized.includes('организация')) {
                    // Look for the company name in the same row, different columns
                    row.eachCell({ includeEmpty: false }, (valueCell) => {
                        const valueText = getCellText(valueCell);
                        const valueNormalized = normalizeText(valueText);
                        
                        // Check if this cell contains company type markers
                        if (valueNormalized.includes('жамият') || valueNormalized.includes('jamiyat') ||
                            valueNormalized.includes('мчж') || valueNormalized.includes('mchj') ||
                            valueNormalized.includes('общество') || valueNormalized.includes('ооо') ||
                            valueNormalized.includes('mas\'uliyati cheklangan') ||
                            valueNormalized.includes('масъулияти чекланган')) {
                            companyName = valueText.trim();
                        }
                    });
                }
                
                // Alternative: Direct detection if the cell itself contains company type
                if (!companyName && (
                    normalized.includes('жамият') || normalized.includes('jamiyat') ||
                    normalized.includes('мчж') || normalized.includes('mchj') ||
                    normalized.includes('общество') || normalized.includes('ооо') ||
                    normalized.includes('mas\'uliyati cheklangan') ||
                    normalized.includes('масъулияти чекланган')
                )) {
                    companyName = cellText.trim();
                }
            }

            // INN detection
            if (!inn && (normalized.includes('инн') || normalized.includes('стир') || normalized.includes('inn'))) {
                // Check current cell and adjacent cells for numbers
                const innMatch = cellText.match(/(\d{9,})/);
                if (innMatch) {
                    inn = innMatch[1];
                } else {
                    // Check adjacent cells in the same row
                    row.eachCell({ includeEmpty: false }, (valueCell) => {
                        const valueText = getCellText(valueCell);
                        const match = valueText.match(/(\d{9,})/);
                        if (match && !inn) {
                            inn = match[1];
                        }
                    });
                }
            }

            // Report date detection
            if (!reportDate && (normalized.includes('отчетная дата') || normalized.includes('ҳисобот санаси') ||
                normalized.includes('hisobot sanasi'))) {
                const dateMatch = cellText.match(/(\d{2}[-./]\d{2}[-./]\d{4})/);
                if (dateMatch) {
                    reportDate = dateMatch[1];
                } else {
                    // Check adjacent cells
                    row.eachCell({ includeEmpty: false }, (valueCell) => {
                        const valueText = getCellText(valueCell);
                        const match = valueText.match(/(\d{2}[-./]\d{2}[-./]\d{4})/);
                        if (match && !reportDate) {
                            reportDate = match[1];
                        }
                    });
                }
            }

            // Detect end of header section
            if (normalized.includes('раҳбар') || normalized.includes('руководитель') ||
                normalized.includes('бош бухгалтер') || normalized.includes('главный бухгалтер')) {
                lastMeaningfulRow = Math.min(lastMeaningfulRow, rowNum);
            }

            // Detect code column (this marks the start of data section)
            if (!codeColumn && (normalized.includes('код стр') || normalized.includes('сатр коди'))) {
                codeColumn = cell.col;
                headerRow = rowNum;
            }
        });

        if (rowNum > lastMeaningfulRow + 5) break;
    }

    if (!codeColumn) {
        throw new Error('Could not find code column in balance sheet');
    }

    // Rest of the function remains the same...
    for (let rowNum = headerRow; rowNum <= Math.min(headerRow + 20, lastMeaningfulRow); rowNum++) {
        const row = worksheet.getRow(rowNum);

        row.eachCell((cell) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            if (normalized === 'актив' || normalized === 'aktiv') {
                dataStartRow = rowNum + 1;
                nameColumn = cell.col;
            }
        });

        if (dataStartRow) break;
    }

    if (!dataStartRow || !nameColumn) {
        throw new Error('Could not find Assets section');
    }

    const headerRowData = worksheet.getRow(headerRow);
    const valueColumns = [];

    headerRowData.eachCell((cell) => {
        const cellText = getCellText(cell);
        const normalized = normalizeText(cellText);

        if (normalized.includes('начало') || normalized.includes('бошига')) {
            valueColumns.push({ type: 'start', column: cell.col });
        }

        if (normalized.includes('конец') || normalized.includes('охирига') || normalized.includes('охир')) {
            valueColumns.push({ type: 'end', column: cell.col });
        }
    });

    if (valueColumns.length === 0) {
        throw new Error('Could not find value columns');
    }

    return {
        headerRow,
        dataStartRow,
        codeColumn,
        nameColumn,
        valueColumns,
        lastMeaningfulRow,
        unitDivisor,
        companyName: companyName || 'Company Name',
        reportDate: reportDate || new Date().toISOString().split('T')[0],
        inn: inn || 'N/A'
    };
}

function extractBalanceSheetData(worksheet, structure) {
    const { dataStartRow, codeColumn, nameColumn, valueColumns, unitDivisor, lastMeaningfulRow } = structure;
    const dataMap = new Map();

    for (let rowNum = dataStartRow; rowNum <= lastMeaningfulRow; rowNum++) {
        const row = worksheet.getRow(rowNum);

        const codeCell = row.getCell(codeColumn);
        const code = codeCell.value?.toString().trim();

        // Skip if not a valid code
        if (!code || code === '' || isNaN(parseInt(code))) {
            continue;
        }

        // Normalize code to 3 digits with leading zeros
        const normalizedCode = code.padStart(3, '0');

        const nameCell = row.getCell(nameColumn);
        const name = nameCell.value?.toString().trim() || '';

        const values = {};
        valueColumns.forEach(({ type, column }) => {
            const valueCell = row.getCell(column);
            let value = valueCell.value;

            if (typeof value === 'string') {
                value = value.replace(/,/g, '').replace(/\s/g, '');
                value = (value === '-' || value === '') ? 0 : (parseFloat(value) || 0);
            } else if (typeof value === 'number') {
                value = value;
            } else {
                value = 0;
            }

            // Apply unit divisor
            if (unitDivisor !== 1 && value !== 0) {
                value = value / unitDivisor;
            }

            values[type] = value;
        });

        dataMap.set(normalizedCode, {
            code: normalizedCode,
            name,
            ...values
        });
    }

    return dataMap;
}

function transformToIFRSStructure(dataMap) {
    // Dynamically extract ALL unique section names from the mapping
    const uniqueSections = [...new Set(
        Object.values(BALANCE_SHEET_MAPPING).map(m => m.section)
    )];

    // Initialize sections object dynamically
    const sections = {};
    uniqueSections.forEach(sectionName => {
        sections[sectionName] = {
            name: sectionName,
            items: [],
            totalStart: 0,
            totalEnd: 0
        };
    });

    // Process each code in the mapping
    Object.keys(BALANCE_SHEET_MAPPING).forEach(code => {
        if (dataMap.has(code)) {
            const nsbuData = dataMap.get(code);
            const mapping = BALANCE_SHEET_MAPPING[code];

            const item = {
                // code: code,
                label: mapping.ifrsClassification,
                // nsbuCode: code,
                start: nsbuData.start || 0,
                end: nsbuData.end || 0
            };

            // Use the section name directly from mapping
            const sectionKey = mapping.section;

            if (sections[sectionKey]) {
                sections[sectionKey].items.push(item);
                sections[sectionKey].totalStart += item.start;
                sections[sectionKey].totalEnd += item.end;
            }
        }
    });

    // Filter out empty sections
    const sectionsArray = Object.values(sections).filter(s => s.items.length > 0);

    // Calculate grand totals dynamically
    const assetSections = sectionsArray.filter(s => s.name.includes('ASSETS'));
    const totalAssetsStart = assetSections.reduce((sum, s) => sum + s.totalStart, 0);
    const totalAssetsEnd = assetSections.reduce((sum, s) => sum + s.totalEnd, 0);

    const nonAssetSections = sectionsArray.filter(s => !s.name.includes('ASSETS'));
    const totalEquityLiabStart = nonAssetSections.reduce((sum, s) => sum + s.totalStart, 0);
    const totalEquityLiabEnd = nonAssetSections.reduce((sum, s) => sum + s.totalEnd, 0);

    return {
        sections: sectionsArray,
        totalAssetsStart,
        totalAssetsEnd,
        totalEquityLiabStart,
        totalEquityLiabEnd
    };
}

async function processBalanceSheetTemplate(workbook) {
    const result = {
        workbook: null,
        summary: {
            transformations: 0,
            changes: 0,
            originalRows: 0,
            processedRows: 0,
            worksheets: [],
            warnings: []
        }
    };

    try {
        const worksheet = workbook.worksheets[0];


        const structure = detectBalanceSheetStructure(worksheet);

        const dataMap = extractBalanceSheetData(worksheet, structure);

        const ifrsStructure = transformToIFRSStructure(dataMap);

        const styledData = {
            title: 'STATEMENT OF FINANCIAL POSITION (IFRS)',
            companyName: structure.companyName,
            reportDate: structure.reportDate,
            inn: structure.inn,
            sections: ifrsStructure.sections,
            totalAssetsStart: ifrsStructure.totalAssetsStart,
            totalAssetsEnd: ifrsStructure.totalAssetsEnd,
            totalEquityLiabStart: ifrsStructure.totalEquityLiabStart,
            totalEquityLiabEnd: ifrsStructure.totalEquityLiabEnd
        };

        result.workbook = styleReport(styledData, 'balanceSheet');

        result.summary.transformations = dataMap.size;
        result.summary.changes = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);
        result.summary.originalRows = dataMap.size;
        result.summary.processedRows = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);

        return result;

    } catch (error) {
        console.error('[PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process balance sheet: ${error.message}`);
    }
}

module.exports = {
    processBalanceSheetTemplate
};