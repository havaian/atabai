// src/processors/stylers/logoHelper.js
// Shared logo row helper for all IFRS report stylers.
// Adds the ATABAI logo image to the worksheet, or an "ATABAI" text cell
// as a fallback when the image file is not found.
// In both cases the entire logo row is merged across all data columns.

'use strict';

const fs = require('fs');
const { BRAND_COLORS, PRIMARY_FONT } = require('./fontConfig');

const LOGO_PATH   = '/app/public/assets/images/icons/logo-text-uc.png';
const LOGO_WIDTH  = 188;
const LOGO_HEIGHT = 50;

/**
 * Add the ATABAI logo (or text fallback) at the given Excel row.
 * The row is merged across `colCount` columns in both cases.
 *
 * Caller is responsible for advancing the row counter after this call.
 * Typical usage:
 *   await addLogoRow(workbook, worksheet, currentRow, periodCount + 1);
 *   currentRow += 2; // 1 for logo row + 1 blank spacer
 *
 * @param {ExcelJS.Workbook}   workbook
 * @param {ExcelJS.Worksheet}  worksheet
 * @param {number}             excelRow  - 1-based row number for the logo
 * @param {number}             colCount  - number of columns to merge across
 */
async function addLogoRow(workbook, worksheet, excelRow, colCount) {
    const row = worksheet.getRow(excelRow);

    if (fs.existsSync(LOGO_PATH)) {
        try {
            const imageId = workbook.addImage({ filename: LOGO_PATH, extension: 'png' });
            worksheet.addImage(imageId, {
                tl: { col: 0, row: excelRow - 1 }, // addImage uses 0-based row index
                ext: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
            });
            row.height = LOGO_HEIGHT;
            worksheet.mergeCells(excelRow, 1, excelRow, colCount);
            global.logger.logInfo(`[LOGO] Loaded from: ${LOGO_PATH}`);
            return;
        } catch (err) {
            global.logger.logWarn(`[LOGO] File found but failed to load: ${err.message}`);
        }
    }

    // Text fallback — same merged layout as the image path
    global.logger.logWarn('[LOGO] Not found, using text fallback');
    const cell = row.getCell(1);
    cell.value = 'ATABAI';
    cell.font = { name: PRIMARY_FONT, size: 16, bold: true, color: { argb: BRAND_COLORS.primary } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    row.height = LOGO_HEIGHT;
    worksheet.mergeCells(excelRow, 1, excelRow, colCount);
}

module.exports = { addLogoRow };