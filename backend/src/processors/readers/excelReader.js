// processors/readers/excelReader.js

const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

/**
 * Universal Excel Reader
 * Handles .xlsx, .xls, and ExcelJS Workbook objects
 * Returns a normalized data structure that extractors can work with
 */

/**
 * Read Excel file and return normalized workbook structure
 * @param {string|Buffer|ExcelJS.Workbook} input - File path, buffer, or ExcelJS Workbook
 * @returns {Object} Normalized workbook object
 */
async function readExcelFile(input) {
    try {
        // Check if input is already an ExcelJS Workbook
        if (input && input.worksheets && Array.isArray(input.worksheets)) {
            return await normalizeExcelJSWorkbook(input);
        }

        // Read the workbook using xlsx library (supports both .xlsx and .xls)
        const workbook = XLSX.read(input, {
            type: Buffer.isBuffer(input) ? 'buffer' : 'file',
            cellStyles: true,
            cellDates: true
        });

        return normalizeXLSXWorkbook(workbook);
    } catch (error) {
        throw new Error(`Failed to read Excel file: ${error.message}`);
    }
}

/**
 * Normalize ExcelJS workbook to common format
 * @param {ExcelJS.Workbook} workbook - ExcelJS workbook object
 * @returns {Object} Normalized workbook
 */
async function normalizeExcelJSWorkbook(workbook) {
    const sheets = [];

    for (const worksheet of workbook.worksheets) {
        const normalized = normalizeExcelJSWorksheet(worksheet);
        sheets.push({
            name: worksheet.name,
            data: normalized.data,
            range: normalized.range,
            rowCount: normalized.rowCount,
            columnCount: normalized.columnCount
        });
    }

    return {
        sheets,
        sheetCount: sheets.length
    };
}

/**
 * Normalize ExcelJS worksheet to common format
 * @param {ExcelJS.Worksheet} worksheet - ExcelJS worksheet
 * @returns {Object} Normalized worksheet
 */
function normalizeExcelJSWorksheet(worksheet) {
    const data = [];
    let maxRow = 0;
    let maxCol = 0;

    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const rowData = [];

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            maxCol = Math.max(maxCol, colNumber);

            rowData.push({
                value: getCellValueFromExcelJS(cell),
                rawValue: cell.value,
                type: cell.type,
                formula: cell.formula,
                column: colNumber,
                row: rowNumber
            });
        });

        // Fill empty cells up to maxCol
        while (rowData.length < maxCol) {
            rowData.push({
                value: null,
                rawValue: null,
                type: null,
                formula: null,
                column: rowData.length + 1,
                row: rowNumber
            });
        }

        data.push(rowData);
        maxRow = Math.max(maxRow, rowNumber);
    });

    return {
        data,
        range: {
            startRow: 1,
            endRow: maxRow,
            startCol: 1,
            endCol: maxCol
        },
        rowCount: maxRow,
        columnCount: maxCol
    };
}

/**
 * Get cell value from ExcelJS cell
 * @param {ExcelJS.Cell} cell - ExcelJS cell
 * @returns {string|number|null} Cell value
 */
function getCellValueFromExcelJS(cell) {
    if (!cell || !cell.value) return null;

    // Handle rich text
    if (cell.value.richText) {
        return cell.value.richText.map(t => t.text || '').join(' ');
    }

    // Handle hyperlink
    if (cell.value.hyperlink) {
        return cell.value.text || cell.value.hyperlink;
    }

    // Handle formula
    if (cell.value.formula) {
        return cell.value.result;
    }

    // Handle date
    if (cell.value instanceof Date) {
        return cell.value;
    }

    // Handle error
    if (cell.value.error) {
        return null;
    }

    // Return raw value
    return cell.value;
}

/**
 * Normalize XLSX workbook to a common format
 * @param {Object} workbook - XLSX workbook object
 * @returns {Object} Normalized workbook
 */
function normalizeXLSXWorkbook(workbook) {
    const sheets = [];

    workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const normalized = normalizeXLSXWorksheet(worksheet);
        sheets.push({
            name: sheetName,
            data: normalized.data,
            range: normalized.range,
            rowCount: normalized.rowCount,
            columnCount: normalized.columnCount
        });
    });

    return {
        sheets,
        sheetCount: sheets.length
    };
}

/**
 * Normalize XLSX worksheet to a common data structure
 * @param {Object} worksheet - XLSX worksheet object
 * @returns {Object} Normalized worksheet with row/column access
 */
function normalizeXLSXWorksheet(worksheet) {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const data = [];

    // Convert to row-based structure
    for (let R = range.s.r; R <= range.e.r; ++R) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];

            row.push({
                value: cell ? getCellValueFromXLSX(cell) : null,
                rawValue: cell ? cell.v : null,
                type: cell ? cell.t : null,
                formula: cell ? cell.f : null,
                column: C + 1, // 1-indexed for compatibility
                row: R + 1     // 1-indexed for compatibility
            });
        }
        data.push(row);
    }

    return {
        data,
        range: {
            startRow: range.s.r + 1,
            endRow: range.e.r + 1,
            startCol: range.s.c + 1,
            endCol: range.e.c + 1
        },
        rowCount: range.e.r + 1,
        columnCount: range.e.c + 1
    };
}

/**
 * Get cell value from XLSX cell in a consistent format
 * @param {Object} cell - XLSX cell object
 * @returns {string|number|null} Cell value
 */
function getCellValueFromXLSX(cell) {
    if (!cell) return null;

    // Handle different cell types
    switch (cell.t) {
        case 's': // string
        case 'str': // string formula
            return cell.v || '';
        case 'n': // number
            return cell.v;
        case 'b': // boolean
            return cell.v;
        case 'd': // date
            return cell.v;
        case 'e': // error
            return null;
        default:
            return cell.v || null;
    }
}

/**
 * Get cell at specific position (1-indexed)
 * @param {Object} normalizedSheet - Normalized sheet object
 * @param {number} row - Row number (1-indexed)
 * @param {number} col - Column number (1-indexed)
 * @returns {Object|null} Cell object or null
 */
function getCell(normalizedSheet, row, col) {
    if (row < 1 || col < 1) return null;

    const rowData = normalizedSheet.data[row - 1];
    if (!rowData) return null;

    return rowData[col - 1] || null;
}

/**
 * Get row data (1-indexed)
 * @param {Object} normalizedSheet - Normalized sheet object
 * @param {number} row - Row number (1-indexed)
 * @returns {Array} Array of cell objects
 */
function getRow(normalizedSheet, row) {
    if (row < 1) return [];
    return normalizedSheet.data[row - 1] || [];
}

/**
 * Iterate through cells in a row
 * @param {Object} normalizedSheet - Normalized sheet object
 * @param {number} row - Row number (1-indexed)
 * @param {Function} callback - Callback function(cell, colIndex)
 */
function eachCellInRow(normalizedSheet, row, callback) {
    const rowData = getRow(normalizedSheet, row);
    rowData.forEach((cell, index) => {
        if (cell && cell.value !== null && cell.value !== '') {
            callback(cell, index + 1); // Pass 1-indexed column
        }
    });
}

module.exports = {
    readExcelFile,
    normalizeExcelJSWorkbook,
    normalizeXLSXWorkbook,
    getCell,
    getRow,
    eachCellInRow,
    getCellValueFromExcelJS,
    getCellValueFromXLSX
};