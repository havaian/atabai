// processors/readers/excelReader.js

const XLSX = require('xlsx');

/**
 * Universal Excel Reader
 * Handles .xlsx, .xls, and other Excel formats
 * Returns a normalized data structure that extractors can work with
 */

/**
 * Read Excel file and return normalized workbook structure
 * @param {string|Buffer} input - File path or buffer
 * @returns {Object} Normalized workbook object
 */
function readExcelFile(input) {
    try {
        // Read the workbook using xlsx library (supports both .xlsx and .xls)
        const workbook = XLSX.read(input, {
            type: Buffer.isBuffer(input) ? 'buffer' : 'file',
            cellStyles: true,
            cellDates: true
        });

        return normalizeWorkbook(workbook);
    } catch (error) {
        throw new Error(`Failed to read Excel file: ${error.message}`);
    }
}

/**
 * Normalize XLSX workbook to a common format
 * @param {Object} workbook - XLSX workbook object
 * @returns {Object} Normalized workbook
 */
function normalizeWorkbook(workbook) {
    const sheets = [];

    workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const normalized = normalizeWorksheet(worksheet);
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
 * Normalize worksheet to a common data structure
 * @param {Object} worksheet - XLSX worksheet object
 * @returns {Object} Normalized worksheet with row/column access
 */
function normalizeWorksheet(worksheet) {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const data = [];

    // Convert to row-based structure
    for (let R = range.s.r; R <= range.e.r; ++R) {
        const row = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];

            row.push({
                value: cell ? getCellValue(cell) : null,
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
 * Get cell value in a consistent format
 * @param {Object} cell - XLSX cell object
 * @returns {string|number|null} Cell value
 */
function getCellValue(cell) {
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
    normalizeWorkbook,
    normalizeWorksheet,
    getCell,
    getRow,
    eachCellInRow,
    getCellValue
};