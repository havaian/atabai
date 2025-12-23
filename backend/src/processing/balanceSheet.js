const ExcelJS = require('exceljs');
const { BALANCE_SHEET_MAPPING, SECTION_TOTALS } = require('../mappings/balanceSheetMapping');

function detectBalanceSheetStructure(worksheet) {
    let headerRow = null;
    let codeColumn = null;
    let nameColumn = null;
    let dataStartRow = null;
    let unitOfMeasurement = null;
    let unitDivisor = 1; // Default: no conversion

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

    // Find end markers and unit of measurement
    for (let rowNum = 1; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);

        row.eachCell((cell) => {
            const cellText = getCellText(cell);
            const normalized = normalizeText(cellText);

            // Check for end markers
            if (normalized.includes('раҳбар') || normalized.includes('руководитель') ||
                normalized.includes('бош бухгалтер') || normalized.includes('главный бухгалтер')) {
                lastMeaningfulRow = rowNum;
                global.logger.logInfo(`Found end marker at row ${rowNum}`);
            }

            // Extract unit of measurement and determine divisor
            if ((normalized.includes('единица измерения') || normalized.includes('ўлчов бирлиги')) && !unitOfMeasurement) {
                const match = cellText.match(/[,،]\s*(.+?)$/);
                if (match) {
                    unitOfMeasurement = match[1].trim();
                    const unitNormalized = normalizeText(unitOfMeasurement);

                    // Determine divisor based on unit
                    if (unitNormalized.includes('тыс') || unitNormalized.includes('минг')) {
                        unitDivisor = 1000;
                        global.logger.logInfo('Detected unit: thousands (divisor = 1000)');
                    } else if (unitNormalized.includes('млн') || unitNormalized.includes('миллион')) {
                        unitDivisor = 1000000;
                        global.logger.logInfo('Detected unit: millions (divisor = 1000000)');
                    } else if (unitNormalized.includes('млрд') || unitNormalized.includes('миллиард')) {
                        unitDivisor = 1000000000;
                        global.logger.logInfo('Detected unit: billions (divisor = 1000000000)');
                    } else {
                        unitDivisor = 1;
                        global.logger.logInfo('Detected unit: base units (divisor = 1)');
                    }

                    global.logger.logInfo(`Found unit of measurement: ${unitOfMeasurement}`);
                }
            }
        });

        if (rowNum > lastMeaningfulRow + 5) break;
    }

    // Default to thousands if not found
    if (!unitOfMeasurement) {
        unitOfMeasurement = 'тыс. сум. / thousands of sums';
        unitDivisor = 1000;
        global.logger.logWarn('Unit of measurement not found, defaulting to thousands (divisor = 1000)');
    }

    global.logger.logInfo(`Searching for structure in ${lastMeaningfulRow} meaningful rows`);

    // ... rest of the function stays the same ...

    return {
        headerRow,
        dataStartRow,
        codeColumn,
        nameColumn,
        valueColumns,
        lastMeaningfulRow,
        unitOfMeasurement,
        unitDivisor  // ← Add this
    };
}

function extractBalanceSheetData(worksheet, structure) {
    const { dataStartRow, codeColumn, nameColumn, valueColumns, unitDivisor } = structure;
    const dataMap = new Map();

    for (let rowNum = dataStartRow; rowNum <= worksheet.rowCount; rowNum++) {
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
                if (value === '-' || value === '') {
                    value = 0;
                } else {
                    value = parseFloat(value) || 0;
                }
            } else if (typeof value === 'number') {
                value = value;
            } else {
                value = 0;
            }

            // Apply unit divisor to convert to declared unit
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

async function transformToIFRS(dataMap) {
    const ifrsData = {};

    // Process all mapped codes
    Object.keys(BALANCE_SHEET_MAPPING).forEach(code => {
        if (dataMap.has(code)) {
            const nsbuData = dataMap.get(code);
            const mapping = BALANCE_SHEET_MAPPING[code];

            ifrsData[code] = {
                code,
                section: mapping.section,
                subsection: mapping.subsection,
                label: mapping.ifrsClassification,
                start: nsbuData.start || 0,
                end: nsbuData.end || 0,
                isNegative: mapping.isNegative || false
            };
        }
    });

    // Also include section totals
    Object.keys(SECTION_TOTALS).forEach(code => {
        if (dataMap.has(code) && !ifrsData[code]) {
            const nsbuData = dataMap.get(code);
            ifrsData[code] = {
                code,
                section: 'TOTALS',
                subsection: 'Summary',
                label: SECTION_TOTALS[code],
                start: nsbuData.start || 0,
                end: nsbuData.end || 0
            };
        }
    });

    return ifrsData;
}

async function processBalanceSheetTemplate(workbook) {
    const result = {
        workbook: new ExcelJS.Workbook(),
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

        // Detect structure
        const structure = detectBalanceSheetStructure(worksheet);
        global.logger.logInfo(`Detected structure: ${JSON.stringify(structure)}`);

        // Extract data
        const dataMap = extractBalanceSheetData(worksheet, structure);
        global.logger.logInfo(`Extracted ${dataMap.size} line items`);

        // Transform to IFRS
        const ifrsData = await transformToIFRS(dataMap);

        // Create IFRS sheet
        const outputSheet = result.workbook.addWorksheet('IFRS Balance Sheet');

        outputSheet.addRow(['BALANCE SHEET - IFRS PRESENTATION']);
        outputSheet.addRow(['As of Period End']);
        outputSheet.addRow([`Unit: ${structure.unitOfMeasurement}`]);
        outputSheet.addRow([]);
        outputSheet.addRow(['Account', 'Start Period', 'End Period']);

        // Sort by section order
        const sectionOrder = [
            'ASSETS - NON-CURRENT',
            'ASSETS - CURRENT',
            'TOTALS', // For asset totals
            'EQUITY',
            'LIABILITIES - NON-CURRENT',
            'LIABILITIES - CURRENT'
        ];

        const sortedData = Object.values(ifrsData).sort((a, b) => {
            const sectionA = sectionOrder.indexOf(a.section);
            const sectionB = sectionOrder.indexOf(b.section);
            if (sectionA !== sectionB) return sectionA - sectionB;
            return parseInt(a.code) - parseInt(b.code);
        });

        sortedData.forEach(data => {
            outputSheet.addRow([data.label, data.start, data.end]);
        });

        // Set column widths
        outputSheet.getColumn(1).width = 45;
        outputSheet.getColumn(2).width = 18;
        outputSheet.getColumn(3).width = 18;

        // Format number columns
        outputSheet.getColumn(2).numFmt = '#,##0.00';
        outputSheet.getColumn(3).numFmt = '#,##0.00';

        result.summary.transformations = dataMap.size;
        result.summary.changes = Object.keys(ifrsData).length;
        result.summary.originalRows = dataMap.size;
        result.summary.processedRows = Object.keys(ifrsData).length;

        global.logger.logInfo(`Balance sheet processing completed: ${result.summary.changes} transformations`);

        return result;

    } catch (error) {
        global.logger.logError(`Balance sheet processing error: ${error.message}`);
        throw new Error(`Failed to process balance sheet: ${error.message}`);
    }
}

module.exports = {
    processBalanceSheetTemplate
};