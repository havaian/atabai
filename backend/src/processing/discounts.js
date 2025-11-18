const ExcelJS = require('exceljs');

/**
 * Process discounts template according to IFRS 15 standards
 * Transforms NSBU revenue/discount data to IFRS 15 compliant format
 */
async function processDiscountsTemplate(workbook) {
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
            const worksheetResult = processDiscountsWorksheet(worksheet, result.workbook.getWorksheet(sheetId));

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

        // Add IFRS 15 compliance notes
        addIFRS15ComplianceSheet(result.workbook, result.summary);

        result.summary.summary = `Processed ${totalOriginalRows} revenue transactions with ${totalChanges} IFRS 15 transformations applied. ${result.summary.warnings.length} warnings generated.`;

        global.logger.logInfo(`Discounts processing completed: ${totalChanges} changes applied to ${totalOriginalRows} rows`);

        return result;

    } catch (error) {
        global.logger.logError('Discounts processing error:', error);
        throw new Error(`Failed to process discounts data: ${error.message}`);
    }
}

/**
 * Process individual worksheet for discounts
 */
function processDiscountsWorksheet(sourceWorksheet, targetWorksheet) {
    const result = {
        transformations: 0,
        changes: 0,
        originalRows: 0,
        processedRows: 0,
        warnings: []
    };

    try {
        // Detect column structure
        const columns = detectDiscountsColumns(sourceWorksheet);
        if (!columns.revenue || !columns.discountType) {
            result.warnings.push({
                message: `Worksheet "${sourceWorksheet.name}" does not contain required columns (Revenue, Discount Type)`,
                severity: 'error'
            });
            return result;
        }

        // Add IFRS 15 columns
        const ifrs15Columns = addIFRS15Columns(targetWorksheet, columns);
        result.transformations += ifrs15Columns.added;

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

            const revenueData = extractRevenueData(row, columns);
            if (!revenueData.revenue || revenueData.revenue <= 0) {
                result.warnings.push({
                    message: `Row ${rowNumber}: Missing or invalid revenue amount`,
                    row: rowNumber,
                    severity: 'warning'
                });
                return;
            }

            // Apply IFRS 15 transformations
            const ifrs15Data = applyIFRS15Transformations(revenueData, rowNumber, result.warnings);

            // Update target worksheet row
            const targetRow = targetWorksheet.getRow(rowNumber);
            const changes = updateRowWithIFRS15Data(targetRow, ifrs15Data, ifrs15Columns.positions);

            changesApplied += changes;
            rowsProcessed++;
        });

        result.processedRows = rowsProcessed;
        result.changes = changesApplied;

        // Add summary row if significant changes were made
        if (changesApplied > 0) {
            addWorksheetSummary(targetWorksheet, result, ifrs15Columns.positions);
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
function detectDiscountsColumns(worksheet) {
    const columns = {};
    const headerRow = worksheet.getRow(1);

    headerRow.eachCell((cell, colNumber) => {
        const cellValue = cell.value?.toString().toLowerCase().trim();
        if (!cellValue) return;

        // Transaction ID
        if (cellValue.includes('transaction') || cellValue.includes('id') || cellValue.includes('number')) {
            columns.transactionId = colNumber;
        }
        // Revenue/amount variations
        else if (cellValue.includes('revenue') || cellValue.includes('amount') || cellValue.includes('total')) {
            columns.revenue = colNumber;
        }
        // Discount type
        else if (cellValue.includes('discount') && cellValue.includes('type')) {
            columns.discountType = colNumber;
        }
        // Discount value/percentage
        else if (cellValue.includes('discount') && (cellValue.includes('value') || cellValue.includes('%') || cellValue.includes('percent'))) {
            columns.discountValue = colNumber;
        }
        // Customer
        else if (cellValue.includes('customer') || cellValue.includes('client')) {
            columns.customer = colNumber;
        }
        // Date
        else if (cellValue.includes('date') || cellValue.includes('time')) {
            columns.date = colNumber;
        }
        // Product/service
        else if (cellValue.includes('product') || cellValue.includes('service') || cellValue.includes('item')) {
            columns.product = colNumber;
        }
    });

    return columns;
}

/**
 * Add IFRS 15 compliant columns to worksheet
 */
function addIFRS15Columns(worksheet, existingColumns) {
    const headerRow = worksheet.getRow(1);
    let maxCol = headerRow.cellCount;
    let addedColumns = 0;

    const ifrs15Columns = {
        positions: { ...existingColumns },
        added: 0
    };

    // Add IFRS 15 required columns
    const requiredIFRS15Columns = [
        { key: 'ifrsTransactionPrice', header: 'IFRS 15 Transaction Price' },
        { key: 'ifrsRevenueRecognized', header: 'IFRS 15 Revenue Recognized' },
        { key: 'ifrsDiscountAllocation', header: 'IFRS 15 Discount Allocation' },
        { key: 'ifrsPerformanceObligation', header: 'Performance Obligation Status' },
        { key: 'ifrsRecognitionTiming', header: 'Revenue Recognition Timing' },
        { key: 'ifrsContractLiability', header: 'Contract Liability' },
        { key: 'ifrsCompliance', header: 'IFRS 15 Compliance Status' }
    ];

    requiredIFRS15Columns.forEach(column => {
        if (!ifrs15Columns.positions[column.key]) {
            maxCol++;
            const cell = headerRow.getCell(maxCol);
            cell.value = column.header;
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6FFE6' } // Light green for IFRS 15 columns
            };

            ifrs15Columns.positions[column.key] = maxCol;
            addedColumns++;
        }
    });

    ifrs15Columns.added = addedColumns;
    return ifrs15Columns;
}

/**
 * Extract revenue data from row
 */
function extractRevenueData(row, columns) {
    return {
        transactionId: getCellValue(row, columns.transactionId),
        revenue: parseNumericValue(getCellValue(row, columns.revenue)),
        discountType: getCellValue(row, columns.discountType) || 'none',
        discountValue: parseNumericValue(getCellValue(row, columns.discountValue)) || 0,
        customer: getCellValue(row, columns.customer),
        date: parseDateValue(getCellValue(row, columns.date)),
        product: getCellValue(row, columns.product)
    };
}

/**
 * Apply IFRS 15 revenue recognition transformations
 */
function applyIFRS15Transformations(revenueData, rowNumber, warnings) {
    const ifrs15Data = { ...revenueData };

    try {
        // Step 1: Identify the contract and performance obligations
        ifrs15Data.ifrsPerformanceObligation = identifyPerformanceObligation(revenueData);

        // Step 2: Determine transaction price
        ifrs15Data.ifrsTransactionPrice = calculateTransactionPrice(revenueData, warnings, rowNumber);

        // Step 3: Allocate discount to performance obligations
        ifrs15Data.ifrsDiscountAllocation = allocateDiscount(revenueData, warnings, rowNumber);

        // Step 4: Determine revenue recognition timing
        ifrs15Data.ifrsRecognitionTiming = determineRecognitionTiming(revenueData);

        // Step 5: Calculate revenue to be recognized
        ifrs15Data.ifrsRevenueRecognized = calculateRevenueRecognition(ifrs15Data, warnings, rowNumber);

        // Step 6: Calculate contract liability if applicable
        ifrs15Data.ifrsContractLiability = calculateContractLiability(ifrs15Data);

        // IFRS 15 compliance status
        ifrs15Data.ifrsCompliance = determineCompliance(ifrs15Data, warnings, rowNumber);

        return ifrs15Data;

    } catch (error) {
        warnings.push({
            message: `Row ${rowNumber}: Error in IFRS 15 calculations: ${error.message}`,
            row: rowNumber,
            severity: 'error'
        });
        return ifrs15Data;
    }
}

/**
 * IFRS 15 calculation functions
 */
function identifyPerformanceObligation(revenueData) {
    // Simplified performance obligation identification
    if (revenueData.product) {
        return `Single performance obligation: ${revenueData.product}`;
    }
    return 'Single performance obligation: Goods/Services';
}

function calculateTransactionPrice(revenueData, warnings, rowNumber) {
    let transactionPrice = revenueData.revenue;

    // Adjust for variable consideration (discounts)
    if (revenueData.discountType && revenueData.discountValue > 0) {
        const discountType = revenueData.discountType.toLowerCase();

        if (discountType.includes('percentage') || discountType.includes('%')) {
            const discountAmount = revenueData.revenue * (revenueData.discountValue / 100);
            transactionPrice = revenueData.revenue - discountAmount;
        } else if (discountType.includes('fixed') || discountType.includes('amount')) {
            transactionPrice = revenueData.revenue - revenueData.discountValue;
        } else if (discountType.includes('volume') || discountType.includes('tiered')) {
            // Simplified volume discount calculation
            const estimatedDiscountRate = Math.min(revenueData.discountValue, 25); // Cap at 25%
            const discountAmount = revenueData.revenue * (estimatedDiscountRate / 100);
            transactionPrice = revenueData.revenue - discountAmount;

            warnings.push({
                message: `Row ${rowNumber}: Volume discount estimated at ${estimatedDiscountRate}%`,
                row: rowNumber,
                severity: 'info'
            });
        }
    }

    return Math.max(0, transactionPrice);
}

function allocateDiscount(revenueData, warnings, rowNumber) {
    if (!revenueData.discountValue || revenueData.discountValue === 0) {
        return 'No discount to allocate';
    }

    const discountType = revenueData.discountType.toLowerCase();

    if (discountType.includes('early') && discountType.includes('payment')) {
        return 'Early payment discount - reduce transaction price';
    } else if (discountType.includes('volume') || discountType.includes('quantity')) {
        return 'Volume discount - allocate proportionally to performance obligations';
    } else if (discountType.includes('seasonal') || discountType.includes('promotional')) {
        return 'Promotional discount - reduce transaction price';
    }

    return 'Standard discount allocation applied';
}

function determineRecognitionTiming(revenueData) {
    // Simplified timing determination
    // In practice, this would be much more complex based on contract terms

    if (revenueData.product) {
        const product = revenueData.product.toLowerCase();

        if (product.includes('service') || product.includes('subscription') || product.includes('maintenance')) {
            return 'Over time - as services are performed';
        } else if (product.includes('software') || product.includes('license')) {
            return 'Point in time - when control transfers';
        }
    }

    return 'Point in time - when goods are delivered';
}

function calculateRevenueRecognition(ifrs15Data, warnings, rowNumber) {
    // Simplified revenue recognition calculation
    let recognizedRevenue = ifrs15Data.ifrsTransactionPrice;

    // Adjust based on recognition timing
    if (ifrs15Data.ifrsRecognitionTiming.includes('over time')) {
        // For over-time recognition, assume partial recognition based on current period
        // In practice, this would be based on progress measurement
        recognizedRevenue = ifrs15Data.ifrsTransactionPrice * 0.25; // Assume 25% progress

        warnings.push({
            message: `Row ${rowNumber}: Over-time revenue recognition - review progress measurement`,
            row: rowNumber,
            severity: 'info'
        });
    }

    return recognizedRevenue;
}

function calculateContractLiability(ifrs15Data) {
    // Contract liability = Amount received - Revenue recognized
    const amountReceived = ifrs15Data.revenue; // Assuming this is amount received
    const contractLiability = amountReceived - ifrs15Data.ifrsRevenueRecognized;

    return Math.max(0, contractLiability);
}

function determineCompliance(ifrs15Data, warnings, rowNumber) {
    const issues = [];

    // Check for potential compliance issues
    if (ifrs15Data.ifrsTransactionPrice <= 0) {
        issues.push('Invalid transaction price');
    }

    if (ifrs15Data.ifrsRevenueRecognized > ifrs15Data.revenue) {
        issues.push('Revenue recognized exceeds received amount');
    }

    if (issues.length > 0) {
        warnings.push({
            message: `Row ${rowNumber}: IFRS 15 compliance issues: ${issues.join(', ')}`,
            row: rowNumber,
            severity: 'warning'
        });
        return 'Review Required';
    }

    return 'Compliant';
}

/**
 * Update worksheet row with IFRS 15 data
 */
function updateRowWithIFRS15Data(row, ifrs15Data, columnPositions) {
    let changes = 0;

    const updates = [
        { col: columnPositions.ifrsTransactionPrice, value: ifrs15Data.ifrsTransactionPrice, format: '#,##0.00' },
        { col: columnPositions.ifrsRevenueRecognized, value: ifrs15Data.ifrsRevenueRecognized, format: '#,##0.00' },
        { col: columnPositions.ifrsDiscountAllocation, value: ifrs15Data.ifrsDiscountAllocation },
        { col: columnPositions.ifrsPerformanceObligation, value: ifrs15Data.ifrsPerformanceObligation },
        { col: columnPositions.ifrsRecognitionTiming, value: ifrs15Data.ifrsRecognitionTiming },
        { col: columnPositions.ifrsContractLiability, value: ifrs15Data.ifrsContractLiability, format: '#,##0.00' },
        { col: columnPositions.ifrsCompliance, value: ifrs15Data.ifrsCompliance }
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

function addWorksheetSummary(worksheet, result, columnPositions) {
    const lastRow = worksheet.rowCount + 2;

    // Add summary header
    const summaryHeaderRow = worksheet.getRow(lastRow);
    summaryHeaderRow.getCell(1).value = 'IFRS 15 Processing Summary';
    summaryHeaderRow.getCell(1).font = { bold: true, size: 12 };

    // Add summary data
    const summaryRow = worksheet.getRow(lastRow + 1);
    summaryRow.getCell(1).value = `Transactions Processed: ${result.processedRows}`;
    summaryRow.getCell(2).value = `Changes Applied: ${result.changes}`;
    summaryRow.getCell(3).value = `Warnings: ${result.warnings.length}`;
}

function addIFRS15ComplianceSheet(workbook, summary) {
    const complianceSheet = workbook.addWorksheet('IFRS 15 Compliance Notes');

    // Add headers
    complianceSheet.getCell('A1').value = 'ATABAI - IFRS 15 Revenue Recognition Processing Report';
    complianceSheet.getCell('A1').font = { bold: true, size: 14 };

    complianceSheet.getCell('A3').value = 'Processing Summary:';
    complianceSheet.getCell('A3').font = { bold: true };

    complianceSheet.getCell('A4').value = `• Total transactions processed: ${summary.originalRows}`;
    complianceSheet.getCell('A5').value = `• IFRS 15 transformations applied: ${summary.changes}`;
    complianceSheet.getCell('A6').value = `• Warnings generated: ${summary.warnings.length}`;

    complianceSheet.getCell('A8').value = 'IFRS 15 Compliance Notes:';
    complianceSheet.getCell('A8').font = { bold: true };

    const complianceNotes = [
        'All revenue recognition follows IFRS 15 - Revenue from Contracts with Customers',
        'Transaction prices are adjusted for variable consideration including discounts',
        'Revenue recognition timing is determined based on performance obligation satisfaction',
        'Contract liabilities represent obligations to transfer goods/services',
        'This analysis should be reviewed by qualified accounting professionals'
    ];

    complianceNotes.forEach((note, index) => {
        complianceSheet.getCell(`A${10 + index}`).value = `• ${note}`;
    });

    // Auto-fit columns
    complianceSheet.getColumn('A').width = 80;
}

module.exports = {
    processDiscountsTemplate
};