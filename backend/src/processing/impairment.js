const ExcelJS = require('exceljs');

/**
 * Process impairment template according to IAS 36 standards
 * Transforms NSBU asset data to IAS 36 compliant impairment testing format
 */
async function processImpairmentTemplate(workbook) {
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
        // Copy workbook structure
        result.workbook = workbook.clone();

        let totalTransformations = 0;
        let totalChanges = 0;
        let totalOriginalRows = 0;
        let totalProcessedRows = 0;

        // Process each worksheet
        workbook.eachSheet((worksheet, sheetId) => {
            const worksheetResult = processImpairmentWorksheet(worksheet, result.workbook.getWorksheet(sheetId));

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

        // Add IAS 36 compliance notes
        addIAS36ComplianceSheet(result.workbook, result.summary);

        result.summary.summary = `Processed ${totalOriginalRows} assets with ${totalChanges} IAS 36 impairment tests applied. ${result.summary.warnings.length} warnings generated.`;

        global.logger.logInfo(`Impairment processing completed: ${totalChanges} changes applied to ${totalOriginalRows} rows`);

        return result;

    } catch (error) {
        global.logger.logError('Impairment processing error:', error);
        throw new Error(`Failed to process impairment data: ${error.message}`);
    }
}

/**
 * Process individual worksheet for impairment testing
 */
function processImpairmentWorksheet(sourceWorksheet, targetWorksheet) {
    const result = {
        transformations: 0,
        changes: 0,
        originalRows: 0,
        processedRows: 0,
        warnings: []
    };

    try {
        // Detect column structure
        const columns = detectImpairmentColumns(sourceWorksheet);
        if (!columns.assetName || !columns.carryingValue) {
            result.warnings.push({
                message: `Worksheet "${sourceWorksheet.name}" does not contain required columns (Asset Name, Carrying Value)`,
                severity: 'error'
            });
            return result;
        }

        // Add IAS 36 columns
        const ias36Columns = addIAS36Columns(targetWorksheet, columns);
        result.transformations += ias36Columns.added;

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
            if (!assetData.assetName || !assetData.carryingValue || assetData.carryingValue <= 0) {
                result.warnings.push({
                    message: `Row ${rowNumber}: Missing or invalid asset data`,
                    row: rowNumber,
                    severity: 'warning'
                });
                return;
            }

            // Apply IAS 36 transformations
            const ias36Data = applyIAS36Transformations(assetData, rowNumber, result.warnings);

            // Update target worksheet row
            const targetRow = targetWorksheet.getRow(rowNumber);
            const changes = updateRowWithIAS36Data(targetRow, ias36Data, ias36Columns.positions);

            changesApplied += changes;
            rowsProcessed++;
        });

        result.processedRows = rowsProcessed;
        result.changes = changesApplied;

        // Add summary row if significant changes were made
        if (changesApplied > 0) {
            addWorksheetSummary(targetWorksheet, result, ias36Columns.positions);
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
function detectImpairmentColumns(worksheet) {
    const columns = {};
    const headerRow = worksheet.getRow(1);

    headerRow.eachCell((cell, colNumber) => {
        const cellValue = cell.value?.toString().toLowerCase().trim();
        if (!cellValue) return;

        // Asset name variations
        if (cellValue.includes('asset') && (cellValue.includes('name') || cellValue.includes('description'))) {
            columns.assetName = colNumber;
        }
        // Carrying value variations
        else if (cellValue.includes('carrying') || cellValue.includes('book') || cellValue.includes('net')) {
            columns.carryingValue = colNumber;
        }
        // Fair value variations
        else if (cellValue.includes('fair') && cellValue.includes('value')) {
            columns.fairValue = colNumber;
        }
        // Value in use
        else if (cellValue.includes('value') && cellValue.includes('use')) {
            columns.valueInUse = colNumber;
        }
        // Cash flow data
        else if (cellValue.includes('cash') && cellValue.includes('flow')) {
            columns.cashFlow = colNumber;
        }
        // Testing date
        else if (cellValue.includes('test') && cellValue.includes('date')) {
            columns.testingDate = colNumber;
        }
        // Status or indicators
        else if (cellValue.includes('status') || cellValue.includes('indicator')) {
            columns.status = colNumber;
        }
        // CGU (Cash Generating Unit)
        else if (cellValue.includes('cgu') || cellValue.includes('unit')) {
            columns.cgu = colNumber;
        }
    });

    return columns;
}

/**
 * Add IAS 36 compliant columns to worksheet
 */
function addIAS36Columns(worksheet, existingColumns) {
    const headerRow = worksheet.getRow(1);
    let maxCol = headerRow.cellCount;
    let addedColumns = 0;

    const ias36Columns = {
        positions: { ...existingColumns },
        added: 0
    };

    // Add IAS 36 required columns
    const requiredIAS36Columns = [
        { key: 'ias36RecoverableAmount', header: 'IAS 36 Recoverable Amount' },
        { key: 'ias36ImpairmentLoss', header: 'IAS 36 Impairment Loss' },
        { key: 'ias36TestRequired', header: 'Impairment Test Required' },
        { key: 'ias36Indicators', header: 'Impairment Indicators' },
        { key: 'ias36CGU', header: 'Cash Generating Unit' },
        { key: 'ias36ReversalPotential', header: 'Reversal Potential' },
        { key: 'ias36Compliance', header: 'IAS 36 Compliance Status' }
    ];

    requiredIAS36Columns.forEach(column => {
        if (!ias36Columns.positions[column.key]) {
            maxCol++;
            const cell = headerRow.getCell(maxCol);
            cell.value = column.header;
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFE6E6' } // Light red for IAS 36 columns
            };

            ias36Columns.positions[column.key] = maxCol;
            addedColumns++;
        }
    });

    ias36Columns.added = addedColumns;
    return ias36Columns;
}

/**
 * Extract asset data from row
 */
function extractAssetData(row, columns) {
    return {
        assetName: getCellValue(row, columns.assetName),
        carryingValue: parseNumericValue(getCellValue(row, columns.carryingValue)),
        fairValue: parseNumericValue(getCellValue(row, columns.fairValue)),
        valueInUse: parseNumericValue(getCellValue(row, columns.valueInUse)),
        cashFlow: parseNumericValue(getCellValue(row, columns.cashFlow)),
        testingDate: parseDateValue(getCellValue(row, columns.testingDate)),
        status: getCellValue(row, columns.status),
        cgu: getCellValue(row, columns.cgu)
    };
}

/**
 * Apply IAS 36 impairment testing transformations
 */
function applyIAS36Transformations(assetData, rowNumber, warnings) {
    const ias36Data = { ...assetData };

    try {
        // Step 1: Identify impairment indicators
        ias36Data.ias36Indicators = identifyImpairmentIndicators(assetData, warnings, rowNumber);

        // Step 2: Determine if impairment test is required
        ias36Data.ias36TestRequired = determineTestRequirement(assetData, ias36Data.ias36Indicators);

        // Step 3: Determine Cash Generating Unit
        ias36Data.ias36CGU = determineCGU(assetData);

        // Step 4: Calculate recoverable amount
        ias36Data.ias36RecoverableAmount = calculateRecoverableAmount(assetData, warnings, rowNumber);

        // Step 5: Calculate impairment loss
        ias36Data.ias36ImpairmentLoss = calculateImpairmentLoss(
            ias36Data.carryingValue,
            ias36Data.ias36RecoverableAmount
        );

        // Step 6: Assess reversal potential
        ias36Data.ias36ReversalPotential = assessReversalPotential(ias36Data, warnings, rowNumber);

        // IAS 36 compliance status
        ias36Data.ias36Compliance = determineCompliance(ias36Data, warnings, rowNumber);

        return ias36Data;

    } catch (error) {
        warnings.push({
            message: `Row ${rowNumber}: Error in IAS 36 calculations: ${error.message}`,
            row: rowNumber,
            severity: 'error'
        });
        return ias36Data;
    }
}

/**
 * IAS 36 calculation functions
 */
function identifyImpairmentIndicators(assetData, warnings, rowNumber) {
    const indicators = [];

    // External indicators
    if (assetData.fairValue && assetData.carryingValue && assetData.fairValue < assetData.carryingValue * 0.8) {
        indicators.push('Market value decline');
    }

    // Internal indicators
    if (assetData.cashFlow && assetData.cashFlow < 0) {
        indicators.push('Negative cash flows');
    }

    // Asset condition indicators
    const assetAge = estimateAssetAge(assetData.assetName);
    if (assetAge > 15) {
        indicators.push('Asset obsolescence');
    }

    // Economic indicators
    if (assetData.status && assetData.status.toLowerCase().includes('impair')) {
        indicators.push('Management identified indicators');
    }

    if (indicators.length === 0) {
        indicators.push('No clear indicators identified');
    }

    return indicators.join('; ');
}

function determineTestRequirement(assetData, indicators) {
    // Test required if indicators are present or asset is significant
    if (indicators && !indicators.includes('No clear indicators')) {
        return 'Yes - Indicators present';
    }

    if (assetData.carryingValue > 1000000) { // Significant asset threshold
        return 'Yes - Significant asset';
    }

    return 'No - No indicators';
}

function determineCGU(assetData) {
    if (assetData.cgu) {
        return assetData.cgu;
    }

    // Estimate CGU based on asset name
    const assetName = assetData.assetName.toLowerCase();

    if (assetName.includes('building') || assetName.includes('facility')) {
        return 'Property CGU';
    } else if (assetName.includes('equipment') || assetName.includes('machine')) {
        return 'Production CGU';
    } else if (assetName.includes('vehicle') || assetName.includes('transport')) {
        return 'Transport CGU';
    }

    return 'Individual asset';
}

function calculateRecoverableAmount(assetData, warnings, rowNumber) {
    let fairValueLessCosts = null;
    let valueInUse = null;

    // Fair value less costs to sell
    if (assetData.fairValue) {
        const estimatedCosts = assetData.fairValue * 0.05; // Assume 5% disposal costs
        fairValueLessCosts = assetData.fairValue - estimatedCosts;
    }

    // Value in use
    if (assetData.valueInUse) {
        valueInUse = assetData.valueInUse;
    } else if (assetData.cashFlow) {
        // Simplified DCF calculation
        const discountRate = 0.10; // 10% discount rate
        const growthRate = 0.02; // 2% growth rate
        const terminalValue = assetData.cashFlow * (1 + growthRate) / (discountRate - growthRate);
        valueInUse = terminalValue;

        warnings.push({
            message: `Row ${rowNumber}: Value in use estimated using simplified DCF (10% discount rate)`,
            row: rowNumber,
            severity: 'info'
        });
    }

    // Recoverable amount is higher of the two
    if (fairValueLessCosts && valueInUse) {
        return Math.max(fairValueLessCosts, valueInUse);
    } else if (fairValueLessCosts) {
        return fairValueLessCosts;
    } else if (valueInUse) {
        return valueInUse;
    }

    // If no information available, assume recoverable amount equals carrying value
    warnings.push({
        message: `Row ${rowNumber}: Insufficient data for recoverable amount - assumed equal to carrying value`,
        row: rowNumber,
        severity: 'warning'
    });

    return assetData.carryingValue;
}

function calculateImpairmentLoss(carryingValue, recoverableAmount) {
    const impairmentLoss = Math.max(0, carryingValue - recoverableAmount);
    return impairmentLoss;
}

function assessReversalPotential(ias36Data, warnings, rowNumber) {
    if (ias36Data.ias36ImpairmentLoss === 0) {
        return 'N/A - No impairment';
    }

    // Simplified reversal assessment
    const indicators = ias36Data.ias36Indicators.toLowerCase();

    if (indicators.includes('market value decline')) {
        return 'Possible if market conditions improve';
    } else if (indicators.includes('cash flows')) {
        return 'Possible if operations improve';
    } else if (indicators.includes('obsolescence')) {
        return 'Unlikely - technological obsolescence';
    }

    return 'Review required based on future conditions';
}

function determineCompliance(ias36Data, warnings, rowNumber) {
    const issues = [];

    // Check for potential compliance issues
    if (ias36Data.ias36TestRequired.includes('Yes') && !ias36Data.ias36RecoverableAmount) {
        issues.push('Missing recoverable amount calculation');
    }

    if (ias36Data.ias36ImpairmentLoss > ias36Data.carryingValue) {
        issues.push('Impairment loss exceeds carrying value');
    }

    if (ias36Data.carryingValue < 0) {
        issues.push('Negative carrying value');
    }

    if (issues.length > 0) {
        warnings.push({
            message: `Row ${rowNumber}: IAS 36 compliance issues: ${issues.join(', ')}`,
            row: rowNumber,
            severity: 'warning'
        });
        return 'Review Required';
    }

    if (ias36Data.ias36ImpairmentLoss > 0) {
        return 'Impairment Identified';
    }

    return 'No Impairment';
}

/**
 * Update worksheet row with IAS 36 data
 */
function updateRowWithIAS36Data(row, ias36Data, columnPositions) {
    let changes = 0;

    const updates = [
        { col: columnPositions.ias36RecoverableAmount, value: ias36Data.ias36RecoverableAmount, format: '#,##0.00' },
        { col: columnPositions.ias36ImpairmentLoss, value: ias36Data.ias36ImpairmentLoss, format: '#,##0.00' },
        { col: columnPositions.ias36TestRequired, value: ias36Data.ias36TestRequired },
        { col: columnPositions.ias36Indicators, value: ias36Data.ias36Indicators },
        { col: columnPositions.ias36CGU, value: ias36Data.ias36CGU },
        { col: columnPositions.ias36ReversalPotential, value: ias36Data.ias36ReversalPotential },
        { col: columnPositions.ias36Compliance, value: ias36Data.ias36Compliance }
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

function estimateAssetAge(assetName) {
    // Simplified asset age estimation based on name
    const name = assetName?.toLowerCase() || '';

    if (name.includes('new') || name.includes('2024') || name.includes('2023')) {
        return 1;
    } else if (name.includes('old') || name.includes('legacy')) {
        return 20;
    }

    // Default estimate
    return 10;
}

function addWorksheetSummary(worksheet, result, columnPositions) {
    const lastRow = worksheet.rowCount + 2;

    // Add summary header
    const summaryHeaderRow = worksheet.getRow(lastRow);
    summaryHeaderRow.getCell(1).value = 'IAS 36 Processing Summary';
    summaryHeaderRow.getCell(1).font = { bold: true, size: 12 };

    // Add summary data
    const summaryRow = worksheet.getRow(lastRow + 1);
    summaryRow.getCell(1).value = `Assets Tested: ${result.processedRows}`;
    summaryRow.getCell(2).value = `Changes Applied: ${result.changes}`;
    summaryRow.getCell(3).value = `Warnings: ${result.warnings.length}`;
}

function addIAS36ComplianceSheet(workbook, summary) {
    const complianceSheet = workbook.addWorksheet('IAS 36 Compliance Notes');

    // Add headers
    complianceSheet.getCell('A1').value = 'ATABAI - IAS 36 Impairment Testing Processing Report';
    complianceSheet.getCell('A1').font = { bold: true, size: 14 };

    complianceSheet.getCell('A3').value = 'Processing Summary:';
    complianceSheet.getCell('A3').font = { bold: true };

    complianceSheet.getCell('A4').value = `• Total assets tested: ${summary.originalRows}`;
    complianceSheet.getCell('A5').value = `• IAS 36 transformations applied: ${summary.changes}`;
    complianceSheet.getCell('A6').value = `• Warnings generated: ${summary.warnings.length}`;

    complianceSheet.getCell('A8').value = 'IAS 36 Compliance Notes:';
    complianceSheet.getCell('A8').font = { bold: true };

    const complianceNotes = [
        'All impairment testing follows IAS 36 - Impairment of Assets standards',
        'Recoverable amount is the higher of fair value less costs to sell and value in use',
        'Impairment loss is recognized when carrying amount exceeds recoverable amount',
        'Cash generating units (CGUs) are identified for assets that do not generate independent cash flows',
        'Professional judgment is required for key assumptions in value in use calculations',
        'This analysis should be reviewed by qualified accounting professionals'
    ];

    complianceNotes.forEach((note, index) => {
        complianceSheet.getCell(`A${10 + index}`).value = `• ${note}`;
    });

    // Auto-fit columns
    complianceSheet.getColumn('A').width = 80;
}

module.exports = {
    processImpairmentTemplate
};