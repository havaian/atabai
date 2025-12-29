const ExcelJS = require('exceljs');
const { BALANCE_SHEET_MAPPING } = require('../mappings/accountMapping');
const { styleReport } = require('../utils/excelStyler');

/**
 * Balance Sheet Processor - Data Transformation Only
 * Styling is handled by the universal excelStyler module
 */

function detectBalanceSheetStructure(worksheet) {
    let headerRow = null;
    let codeColumn = null;
    let nameColumn = null;
    let dataStartRow = null;
    let unitOfMeasurement = null;
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

    // Extract metadata and find structure
    for (let rowNum = 1; rowNum <= Math.min(worksheet.rowCount, 100); rowNum++) {
        const row = worksheet.getRow(rowNum);

        row.eachCell((cell) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            // Extract company name (usually near the top)
            if (!companyName && rowNum <= 10) {
                if (normalized.includes('жамият') || normalized.includes('мчж') ||
                    normalized.includes('общество') || normalized.includes('ооо')) {
                    companyName = cellText.trim();
                }
            }

            // Extract INN
            if (!inn && (normalized.includes('инн') || normalized.includes('стир'))) {
                const innMatch = cellText.match(/(\d{9,})/);
                if (innMatch) {
                    inn = innMatch[1];
                }
            }

            // Extract report date
            if (!reportDate && (normalized.includes('отчетная дата') || normalized.includes('ҳисобот санаси'))) {
                const dateMatch = cellText.match(/(\d{2}[-./]\d{2}[-./]\d{4})/);
                if (dateMatch) {
                    reportDate = dateMatch[1];
                }
            }

            // Find document end markers
            if (normalized.includes('раҳбар') || normalized.includes('руководитель') ||
                normalized.includes('бош бухгалтер') || normalized.includes('главный бухгалтер')) {
                lastMeaningfulRow = Math.min(lastMeaningfulRow, rowNum);
            }

            // Extract unit of measurement
            if ((normalized.includes('единица измерения') || normalized.includes('ўлчов бирлиги')) && !unitOfMeasurement) {
                const match = cellText.match(/[,،]\s*(.+?)$/);
                if (match) {
                    unitOfMeasurement = match[1].trim();
                    const unitNormalized = normalizeText(unitOfMeasurement);

                    if (unitNormalized.includes('тыс') || unitNormalized.includes('минг')) {
                        unitDivisor = 1000;
                    } else if (unitNormalized.includes('млн') || unitNormalized.includes('миллион')) {
                        unitDivisor = 1000000;
                    } else if (unitNormalized.includes('млрд') || unitNormalized.includes('миллиард')) {
                        unitDivisor = 1000000000;
                    }
                }
            }

            // Find code column
            if (!codeColumn && (normalized.includes('код стр') || normalized.includes('сатр коди'))) {
                codeColumn = cell.col;
                headerRow = rowNum;
            }
        });

        if (rowNum > lastMeaningfulRow + 5) break;
    }

    // Defaults if not found
    if (!unitOfMeasurement) {
        unitOfMeasurement = 'тыс. сум.';
        unitDivisor = 1000;
    }

    if (!codeColumn) {
        throw new Error('Could not find code column in balance sheet');
    }

    // Find data start row (AKTIV section)
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

    // Find value columns
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
        unitOfMeasurement,
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

        if (!code || code === '' || isNaN(parseInt(code))) {
            continue;
        }

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

        dataMap.set(code, {
            code,
            name,
            ...values
        });
    }

    return dataMap;
}

function transformToIFRSStructure(dataMap) {
    // Group data by sections
    const sections = {
        nonCurrentAssets: {
            name: 'NON-CURRENT ASSETS',
            items: [],
            totalStart: 0,
            totalEnd: 0
        },
        currentAssets: {
            name: 'CURRENT ASSETS',
            items: [],
            totalStart: 0,
            totalEnd: 0
        },
        equity: {
            name: 'EQUITY',
            items: [],
            totalStart: 0,
            totalEnd: 0
        },
        nonCurrentLiabilities: {
            name: 'NON-CURRENT LIABILITIES',
            items: [],
            totalStart: 0,
            totalEnd: 0
        },
        currentLiabilities: {
            name: 'CURRENT LIABILITIES',
            items: [],
            totalStart: 0,
            totalEnd: 0
        }
    };

    // Process each mapped account
    Object.keys(BALANCE_SHEET_MAPPING).forEach(code => {
        if (dataMap.has(code)) {
            const nsbuData = dataMap.get(code);
            const mapping = BALANCE_SHEET_MAPPING[code];

            const item = {
                code: mapping.ifrsCode,
                label: mapping.ifrsClassification,
                nsbuCode: code,
                start: nsbuData.start || 0,
                end: nsbuData.end || 0
            };

            // Determine which section this belongs to
            const section = mapping.section || 'currentAssets';

            if (sections[section]) {
                sections[section].items.push(item);
                sections[section].totalStart += item.start;
                sections[section].totalEnd += item.end;
            }
        }
    });

    // Convert to array format for styler
    const sectionsArray = Object.values(sections).filter(s => s.items.length > 0);

    // Calculate grand totals
    const totalAssetsStart = sections.nonCurrentAssets.totalStart + sections.currentAssets.totalStart;
    const totalAssetsEnd = sections.nonCurrentAssets.totalEnd + sections.currentAssets.totalEnd;
    const totalEquityLiabStart = sections.equity.totalStart + sections.nonCurrentLiabilities.totalStart + sections.currentLiabilities.totalStart;
    const totalEquityLiabEnd = sections.equity.totalEnd + sections.nonCurrentLiabilities.totalEnd + sections.currentLiabilities.totalEnd;

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

        // Step 1: Detect structure and extract metadata
        const structure = detectBalanceSheetStructure(worksheet);

        // Step 2: Extract raw data
        const dataMap = extractBalanceSheetData(worksheet, structure);

        // Step 3: Transform to IFRS structure
        const ifrsStructure = transformToIFRSStructure(dataMap);

        // Step 4: Prepare data for styler
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

        // Step 5: Use universal styler to create final workbook
        result.workbook = styleReport(styledData, 'balanceSheet');

        // Update summary
        result.summary.transformations = dataMap.size;
        result.summary.changes = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);
        result.summary.originalRows = dataMap.size;
        result.summary.processedRows = ifrsStructure.sections.reduce((sum, s) => sum + s.items.length, 0);

        return result;

    } catch (error) {
        throw new Error(`Failed to process balance sheet: ${error.message}`);
    }
}

module.exports = {
    processBalanceSheetTemplate
};