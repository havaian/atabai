// utils/stylers/logoHelper.js
// Shared logo row helper for all IFRS report stylers.
// Adds the ATABAI logo image to the worksheet, or an "ATABAI" text cell
// as a fallback when the image file is not found.
// In both cases the entire logo row is merged across all data columns.

'use strict';

const fs = require('fs');
const { BRAND_COLORS, PRIMARY_FONT } = require('./fontConfig');

const LOGO_PATH = '/app/public/assets/images/icons/logo-text-uc.png';
const LOGO_WIDTH = 188;
const LOGO_HEIGHT = 50;

// Approximate pixels per Excel column-width character unit (standard at 96 dpi)
const PX_PER_CHAR = 7;
// EMUs per pixel (Excel internal unit: 1 inch = 914400 EMU at 96 DPI)
const EMU_PER_PX = 9525;

/**
 * Compute the EMU offset needed to horizontally centre LOGO_WIDTH
 * inside the merged area that spans columns 1..colCount.
 * Column widths are read from the worksheet (they must already be set).
 */
function centreOffsetEmu(worksheet, colCount) {
    let totalPx = 0;
    for (let c = 1; c <= colCount; c++) {
        totalPx += (worksheet.getColumn(c).width || 8) * PX_PER_CHAR;
    }
    const offsetPx = Math.max(0, (totalPx - LOGO_WIDTH) / 2);
    return Math.round(offsetPx * EMU_PER_PX);
}

/**
 * Add the ATABAI logo (or text fallback) at the given Excel row.
 * The row is merged across `colCount` columns in both cases.
 * The image is horizontally centred using column widths already set on the worksheet.
 *
 * Caller is responsible for advancing the row counter after this call.
 * Typical usage:
 *   await addLogoRow(workbook, worksheet, currentRow, periodCount + 1);
 *   currentRow += 2; // logo row + blank spacer
 *
 * @param {ExcelJS.Workbook}   workbook
 * @param {ExcelJS.Worksheet}  worksheet
 * @param {number}             excelRow  - 1-based row number for the logo
 * @param {number}             colCount  - number of columns to merge across
 */
async function addLogoRow(workbook, worksheet, excelRow, colCount) {
    const row = worksheet.getRow(excelRow);

    // Clear borders and apply white fill on all cells in the logo row
    // so gridlines don't show through the image or text
    const cleanFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        cell.fill = cleanFill;
        cell.border = {};
    }

    row.height = LOGO_HEIGHT;
    worksheet.mergeCells(excelRow, 1, excelRow, colCount);

    if (fs.existsSync(LOGO_PATH)) {
        try {
            const imageId = workbook.addImage({ filename: LOGO_PATH, extension: 'png' });
            const colOff = centreOffsetEmu(worksheet, colCount);

            worksheet.addImage(imageId, {
                tl: {
                    nativeCol: 0,
                    nativeColOff: colOff,
                    nativeRow: excelRow - 1,   // addImage uses 0-based row index
                    nativeRowOff: 0,
                },
                ext: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
            });

            global.logger.logInfo(`[LOGO] Loaded from: ${LOGO_PATH}`);
            return;
        } catch (err) {
            global.logger.logWarn(`[LOGO] File found but failed to load: ${err.message}`);
        }
    }

    // Text fallback — alignment handles centering inside the merged cell
    global.logger.logWarn('[LOGO] Not found, using text fallback');
    const cell = row.getCell(1);
    cell.value = 'ATABAI';
    cell.font = { name: PRIMARY_FONT, size: 16, bold: true, color: { argb: BRAND_COLORS.primary } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

module.exports = { addLogoRow };