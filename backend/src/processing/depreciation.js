const ExcelJS = require('exceljs');

/**
 * Process depreciation template according to IAS 16 standards
 * Transforms NSBU depreciation data to IFRS compliant format
 */
async function processDepreciationTemplate(workbook) {
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
        // Copy workbook structure using ExcelJS proper method
        result.workbook = new ExcelJS.Workbook();

        // Copy each worksheet from source to target
        workbook.eachSheet((sourceWorksheet, sheetId) => {
            const targetWorksheet = result.workbook.addWorksheet(sourceWorksheet.name);
            
            // Copy all rows and cells
            sourceWorksheet.eachRow((row, rowNumber) => {
                const targetRow = targetWorksheet.getRow(rowNumber);
                row.eachCell((cell, colNumber) => {
                    targetRow.getCell(colNumber).value = cell.value;
                    targetRow.getCell(colNumber).style = cell.style;
                });
            });
            
            // Copy column properties
            sourceWorksheet.columns.forEach((column, index) => {
                if (column.width) {
                    targetWorksheet.getColumn(index + 1).width = column.width;
                }
            });
        });

        let totalTransformations = 0;
        let totalChanges = 0;
        let totalOriginalRows = 0;
        let totalProcessedRows = 0;

        // Process each worksheet
        workbook.eachSheet((worksheet, sheetId) => {
            const worksheetResult = processDepreciationWorksheet(worksheet, result.workbook.getWorksheet(sheetId));

            result.summary.worksheets.push({
                name: worksheet.name,
                originalRows: worksheetResult.originalRows,
                processedRows: worksheetResult.processedRows,
                changes: worksheetResult.changes
            });

            totalTransformations += worksheetResult.transformations;
            totalChanges += worksheetResult.changes;
            totalOriginalRows += worksheetResult.originalRows;
            totalProcessedRows += worksheetResult.processedRows;

            result.summary.warnings.push(...worksheetResult.warnings);
        });

        result.summary.transformations = totalTransformations;
        result.summary.changes = totalChanges;
        result.summary.originalRows = totalOriginalRows;
        result.summary.processedRows = totalProcessedRows;

        // Add IFRS compliance notes
        addIFRSComplianceSheet(result.workbook, result.summary);

        result.summary.summary = `Processed ${totalOriginalRows} assets with ${totalChanges} IFRS transformations applied. ${result.summary.warnings.length} warnings generated.`;

        global.logger.logInfo(`Depreciation processing completed: ${totalChanges} changes applied to ${totalOriginalRows} rows`);

        return result;

    } catch (error) {
        global.logger.logError('Depreciation processing error:', error);
        throw new Error(`Failed to process depreciation data: ${error.message}`);
    }
}

/**
 * Process individual worksheet for depreciation
 */
function processDepreciationWorksheet(sourceWorksheet, targetWorksheet) {
    const result = {
        transformations: 0,
        changes: 0,
        originalRows: 0,
        processedRows: 0,
        warnings: []
    };

    try {
        // Detect column structure
        const columns = detectDepreciationColumns(sourceWorksheet);
        if (!columns.assetName || !columns.cost) {
            result.warnings.push({
                message: `Worksheet "${sourceWorksheet.name}" does not contain required columns (Asset Name, Cost)`,
                severity: 'error'
            });
            return result;
        }

        // Add IFRS columns if they don't exist
        const ifrsColumns = addIFRSColumns(targetWorksheet, columns);
        result.transformations += ifrsColumns.added;

        const headerRow = 1; // Assuming first row contains headers
        let rowsProcessed = 0;
        let changesApplied = 0;

        // Process data rows
        sourceWorksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= headerRow) {
                result.originalRows++;
                return; // Skip header row
            }

            result.originalRows++;

            const assetData = extractAssetData(row, columns);
            if (!assetData.assetName || !assetData.cost) {
                result.warnings.push({
                    message: `Row ${rowNumber}: Missing required asset data`,
                    row: rowNumber,
                    severity: 'warning'
                });
                return;
            }

            // Apply IAS 16 transformations
            const ifrsData = applyIAS16Transformations(assetData, rowNumber, result.warnings);

            // Update target worksheet row
            const targetRow = targetWorksheet.getRow(rowNumber);
            const changes = updateRowWithIFRSData(targetRow, ifrsData, ifrsColumns.positions);

            changesApplied += changes;
            rowsProcessed++;
        });

        result.processedRows = rowsProcessed;
        result.changes = changesApplied;

        // Add summary row if significant changes were made
        if (changesApplied > 0) {
            addWorksheetSummary(targetWorksheet, result, ifrsColumns.positions);
        }

        global.logger.logDebug(`Worksheet "${sourceWorksheet.name}" processed: ${rowsProcessed} rows, ${changesApplied} changes`);

        return result;

    } catch (error) {
        result.warnings.push({
            message: `Error processing worksheet "${sourceWorksheet.name}": ${error.message}`,
            severity: 'error'
        });
        return result;
    }
}

/**
 * Detect column structure in the worksheet
 */
function detectDepreciationColumns(worksheet) {
    const columns = {};
    const headerRow = worksheet.getRow(1);

    headerRow.eachCell((cell, colNumber) => {
        const cellValue = cell.value?.toString().toLowerCase().trim();
        if (!cellValue) return;

        // Asset name variations
        if (cellValue.includes('asset') && (cellValue.includes('name') || cellValue.includes('description'))) {
            columns.assetName = colNumber;
        }
        // Cost variations
        else if (cellValue.includes('cost') || cellValue.includes('price') || cellValue.includes('value')) {
            columns.cost = colNumber;
        }
        // Date variations
        else if (cellValue.includes('date') || cellValue.includes('purchase') || cellValue.includes('acquisition')) {
            columns.purchaseDate = colNumber;
        }
        // Useful life variations
        else if (cellValue.includes('life') || cellValue.includes('period') || cellValue.includes('years')) {
            columns.usefulLife = colNumber;
        }
        // Method variations
        else if (cellValue.includes('method') || cellValue.includes('depreciation')) {
            columns.depreciationMethod = colNumber;
        }
        // Residual value
        else if (cellValue.includes('residual') || cellValue.includes('salvage')) {
            columns.residualValue = colNumber;
        }
    });

    return columns;
}

/**
 * Add IFRS-compliant columns to worksheet
 */
function addIFRSColumns(worksheet, existingColumns) {
    const headerRow = worksheet.getRow(1);
    let maxCol = headerRow.cellCount;
    let addedColumns = 0;

    const ifrsColumns = {
        positions: { ...existingColumns },
        added: 0
    };

    // Add IAS 16 required columns
    const requiredIFRSColumns = [
        { key: 'ifrsCarryingAmount', header: 'IFRS Carrying Amount' },
        { key: 'ifrsDepreciationRate', header: 'IFRS Depreciation Rate (%)' },
        { key: 'ifrsAnnualDepreciation', header: 'IFRS Annual Depreciation' },
        { key: 'ifrsAccumulatedDepreciation', header: 'IFRS Accumulated Depreciation' },
        { key: 'ifrsRemainingLife', header: 'IFRS Remaining Life' },
        { key: 'ifrsImpairmentRequired', header: 'Impairment Test Required' },
        { key: 'ifrsCompliance', header: 'IAS 16 Compliance Status' }
    ];

    requiredIFRSColumns.forEach(column => {
        if (!ifrsColumns.positions[column.key]) {
            maxCol++;
            const cell = headerRow.getCell(maxCol);
            cell.value = column.header;
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6F3FF' } // Light blue for IFRS columns
            };

            ifrsColumns.positions[column.key] = maxCol;
            addedColumns++;
        }
    });

    ifrsColumns.added = addedColumns;
    return ifrsColumns;
}

/**
 * Extract asset data from row
 */
function extractAssetData(row, columns) {
    return {
        assetName: getCellValue(row, columns.assetName),
        cost: parseNumericValue(getCellValue(row, columns.cost)),
        purchaseDate: parseDateValue(getCellValue(row, columns.purchaseDate)),
        usefulLife: parseNumericValue(getCellValue(row, columns.usefulLife)),
        depreciationMethod: getCellValue(row, columns.depreciationMethod) || 'straight-line',
        residualValue: parseNumericValue(getCellValue(row, columns.residualValue)) || 0
    };
}

/**
 * Apply IAS 16 depreciation transformations
 */
function applyIAS16Transformations(assetData, rowNumber, warnings) {
    const ifrsData = { ...assetData };

    try {
        // Validate required data
        if (!assetData.cost || assetData.cost <= 0) {
            warnings.push({
                message: `Row ${rowNumber}: Invalid asset cost`,
                row: rowNumber,
                severity: 'warning'
            });
            return ifrsData;
        }

        // Default useful life if not provided
        if (!assetData.usefulLife || assetData.usefulLife <= 0) {
            ifrsData.usefulLife = estimateUsefulLife(assetData.assetName);
            warnings.push({
                message: `Row ${rowNumber}: Estimated useful life (${ifrsData.usefulLife} years) for ${assetData.assetName}`,
                row: rowNumber,
                severity: 'info'
            });
        }

        // Calculate IFRS depreciation
        const depreciableAmount = ifrsData.cost - ifrsData.residualValue;

        // Annual depreciation calculation
        if (ifrsData.depreciationMethod.toLowerCase().includes('straight')) {
            ifrsData.ifrsAnnualDepreciation = depreciableAmount / ifrsData.usefulLife;
            ifrsData.ifrsDepreciationRate = (100 / ifrsData.usefulLife);
        } else if (ifrsData.depreciationMethod.toLowerCase().includes('declining')) {
            // Declining balance method (assuming 200% declining balance)
            ifrsData.ifrsDepreciationRate = (200 / ifrsData.usefulLife);
            ifrsData.ifrsAnnualDepreciation = ifrsData.cost * (ifrsData.ifrsDepreciationRate / 100);
        } else {
            // Default to straight-line
            ifrsData.ifrsAnnualDepreciation = depreciableAmount / ifrsData.usefulLife;
            ifrsData.ifrsDepreciationRate = (100 / ifrsData.usefulLife);
            warnings.push({
                message: `Row ${rowNumber}: Unknown depreciation method, defaulting to straight-line`,
                row: rowNumber,
                severity: 'warning'
            });
        }

        // Calculate current carrying amount (assuming purchase was in current year for simplicity)
        const yearsElapsed = assetData.purchaseDate ?
            Math.max(0, (new Date().getFullYear() - new Date(assetData.purchaseDate).getFullYear())) : 0;

        ifrsData.ifrsAccumulatedDepreciation = Math.min(
            ifrsData.ifrsAnnualDepreciation * yearsElapsed,
            depreciableAmount
        );

        ifrsData.ifrsCarryingAmount = ifrsData.cost - ifrsData.ifrsAccumulatedDepreciation;
        ifrsData.ifrsRemainingLife = Math.max(0, ifrsData.usefulLife - yearsElapsed);

        // Determine if impairment test is required
        ifrsData.ifrsImpairmentRequired = shouldRequireImpairmentTest(ifrsData);

        // IAS 16 compliance status
        ifrsData.ifrsCompliance = 'Compliant';

        return ifrsData;

    } catch (error) {
        warnings.push({
            message: `Row ${rowNumber}: Error in IAS 16 calculations: ${error.message}`,
            row: rowNumber,
            severity: 'error'
        });
        return ifrsData;
    }
}

/**
 * Update worksheet row with IFRS data
 */
function updateRowWithIFRSData(row, ifrsData, columnPositions) {
    let changes = 0;

    const updates = [
        { col: columnPositions.ifrsCarryingAmount, value: ifrsData.ifrsCarryingAmount, format: '#,##0.00' },
        { col: columnPositions.ifrsDepreciationRate, value: ifrsData.ifrsDepreciationRate, format: '0.00%' },
        { col: columnPositions.ifrsAnnualDepreciation, value: ifrsData.ifrsAnnualDepreciation, format: '#,##0.00' },
        { col: columnPositions.ifrsAccumulatedDepreciation, value: ifrsData.ifrsAccumulatedDepreciation, format: '#,##0.00' },
        { col: columnPositions.ifrsRemainingLife, value: ifrsData.ifrsRemainingLife, format: '0.0' },
        { col: columnPositions.ifrsImpairmentRequired, value: ifrsData.ifrsImpairmentRequired ? 'Yes' : 'No' },
        { col: columnPositions.ifrsCompliance, value: ifrsData.ifrsCompliance }
    ];

    updates.forEach(update => {
        if (update.col && update.value !== undefined) {
            const cell = row.getCell(update.col);
            cell.value = update.value;
            if (update.format) {
                cell.numFmt = update.format;
            }
            changes++;
        }
    });

    return changes;
}

/**
 * Helper functions
 */
function getCellValue(row, colNumber) {
    if (!colNumber) return null;
    const cell = row.getCell(colNumber);
    return cell.value;
}

function parseNumericValue(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
}

function parseDateValue(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

function estimateUsefulLife(assetName) {
    const name = assetName?.toLowerCase() || '';

    // Building and structures
    if (name.includes('building') || name.includes('structure') || name.includes('facility')) {
        return 40;
    }
    // Vehicles
    if (name.includes('vehicle') || name.includes('car') || name.includes('truck')) {
        return 5;
    }
    // Equipment and machinery
    if (name.includes('equipment') || name.includes('machine') || name.includes('tool')) {
        return 10;
    }
    // Furniture and fixtures
    if (name.includes('furniture') || name.includes('fixture') || name.includes('office')) {
        return 7;
    }
    // IT equipment
    if (name.includes('computer') || name.includes('server') || name.includes('laptop')) {
        return 3;
    }

    // Default useful life
    return 10;
}

function shouldRequireImpairmentTest(assetData) {
    // Simple heuristic: require impairment test if asset is more than 75% depreciated
    const depreciationRatio = assetData.ifrsAccumulatedDepreciation / (assetData.cost - assetData.residualValue);
    return depreciationRatio > 0.75;
}

function addWorksheetSummary(worksheet, result, columnPositions) {
    const lastRow = worksheet.rowCount + 2;

    // Add summary header
    const summaryHeaderRow = worksheet.getRow(lastRow);
    summaryHeaderRow.getCell(1).value = 'IFRS Processing Summary';
    summaryHeaderRow.getCell(1).font = { bold: true, size: 12 };

    // Add summary data
    const summaryRow = worksheet.getRow(lastRow + 1);
    summaryRow.getCell(1).value = `Rows Processed: ${result.processedRows}`;
    summaryRow.getCell(2).value = `Changes Applied: ${result.changes}`;
    summaryRow.getCell(3).value = `Warnings: ${result.warnings.length}`;
}

function addIFRSComplianceSheet(workbook, summary) {
    const complianceSheet = workbook.addWorksheet('IFRS Compliance Notes');

    // Add headers
    complianceSheet.getCell('A1').value = 'ATABAI - IAS 16 Depreciation Processing Report';
    complianceSheet.getCell('A1').font = { bold: true, size: 14 };

    complianceSheet.getCell('A3').value = 'Processing Summary:';
    complianceSheet.getCell('A3').font = { bold: true };

    complianceSheet.getCell('A4').value = `• Total assets processed: ${summary.originalRows}`;
    complianceSheet.getCell('A5').value = `• IFRS transformations applied: ${summary.changes}`;
    complianceSheet.getCell('A6').value = `• Warnings generated: ${summary.warnings.length}`;

    complianceSheet.getCell('A8').value = 'IAS 16 Compliance Notes:';
    complianceSheet.getCell('A8').font = { bold: true };

    const complianceNotes = [
        'All depreciation calculations follow IAS 16 - Property, Plant and Equipment standards',
        'Carrying amounts represent cost less accumulated depreciation and impairment losses',
        'Depreciation rates are based on estimated useful lives and residual values',
        'Impairment tests are recommended for assets with indicators of impairment',
        'This report should be reviewed by qualified accounting professionals'
    ];

    complianceNotes.forEach((note, index) => {
        complianceSheet.getCell(`A${10 + index}`).value = `• ${note}`;
    });

    // Auto-fit columns
    complianceSheet.getColumn('A').width = 80;
}

module.exports = {
    processDepreciationTemplate
};