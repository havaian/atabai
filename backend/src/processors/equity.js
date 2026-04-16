// processors/equity.js
// Orchestrates the Statement of Changes in Equity processing pipeline:
//   readExcelFile → extractEquityData → transformToIFRSEquity → styleEquityReport

'use strict';

const { readExcelFile, pickBestSheet } = require('./readers/excelReader');
const { extractEquityData, scoreEquityCandidate } = require('./extractors/equity');
const { transformToIFRSEquity } = require('./transformers/equity');
const { styleEquityReport } = require('./stylers/equity');

/**
 * Process a Statement of Changes in Equity from either a balance sheet
 * (Form 1) or a dedicated Form 4 file.
 *
 * @param {string|Buffer|ExcelJS.Workbook} input
 * @returns {Object} { workbook, summary }
 */
async function processEquityTemplate(input) {
    const result = {
        workbook: null,
        summary: {
            transformations: 0,
            changes: 0,
            originalRows: 0,
            processedRows: 0,
            worksheets: [],
            warnings: [],
        },
    };

    try {
        // Step 1: Read
        const normalizedWorkbook = await readExcelFile(input);
        if (normalizedWorkbook.sheetCount === 0) {
            throw new Error('No worksheets found in the file');
        }

        const sheet = pickBestSheet(normalizedWorkbook, scoreEquityCandidate, {
            minScore: 3, // either balance-sheet signals OR ≥2 form4 column headers
            label: 'equity statement',
        });
        global.logger.logInfo('[EQUITY PROCESSOR] File read, processing first sheet');

        // Step 2: Extract
        const extracted = extractEquityData(sheet);

        // Step 3: Transform
        const layout = transformToIFRSEquity(extracted);

        // Step 4: Style
        result.workbook = await styleEquityReport(layout);

        // Summary
        result.summary.sourceType = extracted.type;
        result.summary.processedRows = layout.rows.length;
        result.summary.transformations = layout.rows.length;
        result.summary.changes = layout.rows.length;

        if (layout.sourceNote) {
            result.summary.warnings.push(layout.sourceNote);
        }

        return result;

    } catch (error) {
        global.logger.logError('[EQUITY PROCESSOR ERROR]', error.message);
        throw new Error(`Failed to process equity statement: ${error.message}`);
    }
}

module.exports = { processEquityTemplate };