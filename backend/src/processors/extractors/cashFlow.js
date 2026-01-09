// processors/extractors/cashFlow.js

const { getCell } = require('../readers/excelReader');

/**
 * Cash Flow Statement Data Extractor - Enhanced Version
 * Extracts ALL line items with flexible classification for company-specific names
 */

function extractCashFlowData(normalizedSheet) {
    const structure = detectCashFlowStructure(normalizedSheet);
    const metadata = extractMetadata(normalizedSheet, structure);
    const dataMap = extractDataMap(normalizedSheet, structure);

    return {
        metadata,
        dataMap,
        structure
    };
}

function detectCashFlowStructure(sheet) {
    let dataStartRow = 3; // Default
    let lineNameColumn = 1;
    let valueColumns = [];

    // Find first row with data
    for (let rowNum = 1; rowNum <= Math.min(sheet.rowCount, 10); rowNum++) {
        const firstCell = getCell(sheet, rowNum, 1);
        const firstCellText = getCellText(firstCell);
        const normalized = normalizeText(firstCellText);

        if (normalized.includes('операционная') || normalized.includes('названия строк')) {
            dataStartRow = rowNum;
            break;
        }
    }

    // Detect value columns (columns 2-13 for monthly data, or more)
    for (let colNum = 2; colNum <= Math.min(sheet.maxColumn, 30); colNum++) {
        const cell = getCell(sheet, dataStartRow, colNum);
        if (cell && cell.value !== null && cell.value !== undefined) {
            valueColumns.push(colNum);
        }
    }

    // If no columns found, default to 2-13
    if (valueColumns.length === 0) {
        valueColumns = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    }

    return {
        dataStartRow,
        lineNameColumn,
        valueColumns,
        lastMeaningfulRow: Math.min(sheet.rowCount, 150)
    };
}

function extractMetadata(sheet, structure) {
    return {
        companyName: null,
        reportDate: null,
        inn: null,
        period: 'For the year'
    };
}

function extractDataMap(sheet, structure) {
    const dataMap = new Map();
    let currentSection = null;
    let isInflowSubsection = false;
    let isOutflowSubsection = false;
    let itemCounter = { operating: 0, investing: 0, financing: 0 };

    for (let rowNum = structure.dataStartRow; rowNum <= structure.lastMeaningfulRow; rowNum++) {
        const lineNameCell = getCell(sheet, rowNum, structure.lineNameColumn);
        const lineName = getCellText(lineNameCell);

        if (!lineName || lineName.trim() === '') continue;

        const lineNormalized = normalizeText(lineName);
        const rowTotal = sumRowValues(sheet, rowNum, structure.valueColumns);

        // Detect section headers
        if (lineNormalized.includes('операционная') && lineNormalized.includes('деятельность')) {
            currentSection = 'operating';
            isInflowSubsection = false;
            isOutflowSubsection = false;

            dataMap.set('operating_section_total', {
                lineName: lineName.trim(),
                netAmount: rowTotal,
                section: 'OPERATING ACTIVITIES',
                itemType: 'section_header'
            });
            continue;
        }

        if (lineNormalized.includes('инвестиционная') && lineNormalized.includes('деятельность')) {
            currentSection = 'investing';
            isInflowSubsection = false;
            isOutflowSubsection = false;

            dataMap.set('investing_section_total', {
                lineName: lineName.trim(),
                netAmount: rowTotal,
                section: 'INVESTING ACTIVITIES',
                itemType: 'section_header'
            });
            continue;
        }

        if (lineNormalized.includes('финансовая') && lineNormalized.includes('деятельность')) {
            currentSection = 'financing';
            isInflowSubsection = false;
            isOutflowSubsection = false;

            dataMap.set('financing_section_total', {
                lineName: lineName.trim(),
                netAmount: rowTotal,
                section: 'FINANCING ACTIVITIES',
                itemType: 'section_header'
            });
            continue;
        }

        // Skip if no section is set yet
        if (!currentSection) continue;

        // Detect "Приток" (inflow) and "Отток" (outflow) markers
        if (lineNormalized === 'приток') {
            isInflowSubsection = true;
            isOutflowSubsection = false;

            dataMap.set(`${currentSection}_total_inflow`, {
                lineName: 'Total cash receipts',
                netAmount: rowTotal,
                section: getSectionName(currentSection),
                itemType: 'subsection_total',
                flowType: 'inflow'
            });
            continue;
        }

        if (lineNormalized === 'отток') {
            isInflowSubsection = false;
            isOutflowSubsection = true;

            dataMap.set(`${currentSection}_total_outflow`, {
                lineName: 'Total cash payments',
                netAmount: rowTotal,
                section: getSectionName(currentSection),
                itemType: 'subsection_total',
                flowType: 'outflow'
            });
            continue;
        }

        // Extract individual line items
        if (isInflowSubsection || isOutflowSubsection) {
            const classification = classifyLineItem(lineName, lineNormalized, currentSection, isInflowSubsection);
            const itemKey = `${currentSection}_item_${itemCounter[currentSection]++}`;

            dataMap.set(itemKey, {
                lineName: lineName.trim(),
                netAmount: rowTotal,
                section: getSectionName(currentSection),
                itemType: 'line_item',
                flowType: isInflowSubsection ? 'inflow' : 'outflow',
                classification: classification,
                originalName: lineName.trim()
            });
        }
    }

    return dataMap;
}

/**
 * Intelligently classify line items based on keywords
 */
function classifyLineItem(lineName, normalized, section, isInflow) {
    if (section === 'operating') {
        if (isInflow) {
            // Operating inflows
            if (normalized.includes('покупател') || normalized.includes('заказчик') || normalized.includes('customer')) {
                return 'Cash receipts from customers';
            }
            if (normalized.includes('периметр') || normalized.includes('генподряд') || normalized.includes('девелопмент')) {
                return 'Cash receipts from operations';
            }
            if (normalized.includes('автоуслуг') || normalized.includes('auto') || normalized.includes('transport')) {
                return 'Cash receipts from services';
            }
            if (normalized.includes('реализация') || normalized.includes('тмц') || normalized.includes('товар')) {
                return 'Cash receipts from goods sold';
            }
            if (normalized.includes('прочие') || normalized.includes('other')) {
                return 'Other operating receipts';
            }
            return 'Operating cash receipts';
        } else {
            // Operating outflows
            if (normalized.includes('поставщик') || normalized.includes('supplier') || normalized.includes('субподряд')) {
                return 'Cash paid to suppliers';
            }
            if (normalized.includes('зп') || normalized.includes('зарплат') || normalized.includes('персонал') || normalized.includes('salary')) {
                return 'Cash paid to employees';
            }
            if (normalized.includes('налог') || normalized.includes('tax')) {
                return 'Income taxes paid';
            }
            if (normalized.includes('техник') || normalized.includes('equipment') || normalized.includes('машин')) {
                return 'Equipment and maintenance expenses';
            }
            if (normalized.includes('аур') || normalized.includes('административ') || normalized.includes('накладн')) {
                return 'Administrative and overhead expenses';
            }
            if (normalized.includes('неактивн') || normalized.includes('inactive')) {
                return 'Other operating payments';
            }
            return 'Operating cash payments';
        }
    }

    if (section === 'investing') {
        if (isInflow) {
            if (normalized.includes('продажа') && (normalized.includes('недвиж') || normalized.includes('property') || normalized.includes('имущ'))) {
                return 'Proceeds from sale of property';
            }
            if (normalized.includes('продажа') && (normalized.includes('техник') || normalized.includes('equipment') || normalized.includes('машин'))) {
                return 'Proceeds from sale of equipment';
            }
            if (normalized.includes('продажа') && (normalized.includes('основ') || normalized.includes('ppe'))) {
                return 'Proceeds from disposal of PP&E';
            }
            return 'Investing cash receipts';
        } else {
            if (normalized.includes('приобрет') && (normalized.includes('здани') || normalized.includes('сооруж') || normalized.includes('building'))) {
                return 'Purchase of buildings';
            }
            if (normalized.includes('приобрет') && (normalized.includes('машин') || normalized.includes('техник') || normalized.includes('equipment'))) {
                return 'Purchase of equipment';
            }
            if (normalized.includes('приобрет') && (normalized.includes('транспорт') || normalized.includes('vehicle'))) {
                return 'Purchase of vehicles';
            }
            if (normalized.includes('приобрет') && (normalized.includes('немат') || normalized.includes('intangible'))) {
                return 'Purchase of intangible assets';
            }
            return 'Investing cash payments';
        }
    }

    if (section === 'financing') {
        if (isInflow) {
            if (normalized.includes('займ получ') || normalized.includes('привлечен') || normalized.includes('borrowing')) {
                return 'Proceeds from borrowings';
            }
            if (normalized.includes('возврат выдан') || normalized.includes('return') && normalized.includes('loan')) {
                return 'Repayment of loans receivable';
            }
            if (normalized.includes('проценты получ') || normalized.includes('interest received')) {
                return 'Interest received';
            }
            if (normalized.includes('взнос') && (normalized.includes('ук') || normalized.includes('capital'))) {
                return 'Proceeds from share issuance';
            }
            return 'Financing cash receipts';
        } else {
            if (normalized.includes('займ выдан') || normalized.includes('loan granted')) {
                return 'Loans granted';
            }
            if (normalized.includes('возврат средств по займ') || normalized.includes('погашение займ') || normalized.includes('repayment')) {
                return 'Repayment of borrowings';
            }
            if (normalized.includes('проценты') && (normalized.includes('кредит') || normalized.includes('пс') || normalized.includes('банк'))) {
                return 'Interest paid';
            }
            if (normalized.includes('лизинг') || normalized.includes('lease')) {
                return 'Lease payments';
            }
            if (normalized.includes('дивиденд') || normalized.includes('dividend')) {
                return 'Dividends paid';
            }
            return 'Financing cash payments';
        }
    }

    return isInflow ? 'Other cash receipts' : 'Other cash payments';
}

function getSectionName(sectionKey) {
    const map = {
        'operating': 'OPERATING ACTIVITIES',
        'investing': 'INVESTING ACTIVITIES',
        'financing': 'FINANCING ACTIVITIES'
    };
    return map[sectionKey] || 'UNKNOWN';
}

function sumRowValues(sheet, rowNum, columns) {
    let sum = 0;
    for (const colNum of columns) {
        const cell = getCell(sheet, rowNum, colNum);
        const value = getCellNumericValue(cell);
        sum += value;
    }
    return sum;
}

function getCellText(cell) {
    if (!cell) return '';
    if (cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object' && cell.value.richText) {
        return cell.value.richText.map(rt => rt.text).join('');
    }
    return String(cell.value).trim();
}

function getCellNumericValue(cell) {
    if (!cell || cell.value === null || cell.value === undefined) return 0;

    const value = cell.value;

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        const cleaned = value.replace(/[\s,]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
}

function normalizeText(text) {
    return text.toLowerCase()
        .replace(/[^а-яa-z0-9\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = {
    extractCashFlowData
};