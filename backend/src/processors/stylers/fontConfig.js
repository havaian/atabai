// utils/stylers/fontConfig.js - Shared Font Configuration for ATABAI Stylers

/**
 * ATABAI Font Configuration Service
 * 
 * IMPORTANT TECHNICAL LIMITATION:
 * ExcelJS (and XLSX format in general) cannot embed TTF/OTF font files directly into Excel workbooks.
 * This is a limitation of both the library and the Office Open XML format specification.
 * 
 * How fonts work in Excel files:
 * 1. Font NAME is stored in the XML (e.g., "Montserrat")
 * 2. Excel looks for that font on the user's system when opening the file
 * 3. If not found, Excel uses a fallback font (usually Arial or Calibri)
 * 
 * To ensure users see Montserrat:
 * - They must have Montserrat installed on their system
 * - Or accept Arial/Calibri as automatic fallback
 * - Or we could switch to PDF output (which DOES support embedded fonts)
 */

// === ATABAI BRAND FONTS ===

/**
 * Primary brand font
 * Must match the font used in ATABAI branding materials
 */
const PRIMARY_FONT = 'Calibri';

/**
 * Fallback font (universally available)
 * Excel will automatically use this if primary font is not installed
 */
const FALLBACK_FONT = 'Arial';

/**
 * Secondary font for specific use cases (if needed)
 */
const SECONDARY_FONT = 'Times New Roman';

// === ATABAI BRAND COLORS ===

/**
 * ATABAI brand colors
 * Using ARGB format (Alpha-Red-Green-Blue)
 */
const BRAND_COLORS = {
    // Primary brand color - ATABAI Purple
    primary: 'FF65399A',        // #65399A

    // Secondary brand colors
    darkPurple: 'FF4A1F7A',     // Darker shade for headers
    lightPurple: 'FF9B7BC6',    // Lighter shade for highlights

    // UI colors
    white: 'FFFFFFFF',
    black: 'FF000000',

    // Semantic colors for financial data
    headerBlue: 'FF4472C4',     // For table headers
    sectionBlue: 'FF5B9BD5',    // For section headers
    lightBlue: 'FFD9E1F2',      // For totals
    green: 'FF70AD47',          // For positive values
    lightGreen: 'FFE2EFDA',     // For FCF highlights
    red: 'FFCC0000',            // For negative values
    orange: 'FFFCE4D6',         // For reconciliation
    gray: 'FFF2F2F2',           // For subtotals
    darkGray: 'FFE7E6E6'        // For grand totals
};

// === FONT SIZE PRESETS ===

const FONT_SIZES = {
    title: 14,          // Main report title
    subtitle: 12,       // Company name
    sectionHeader: 11,  // Section headers
    normal: 10,         // Regular data
    small: 9,           // Footnotes, watermarks
    metadata: 10        // Dates, INN, etc.
};

// === FONT WEIGHT PRESETS ===

const FONT_WEIGHTS = {
    bold: true,
    normal: false
};

// === FONT STYLE GENERATORS ===

/**
 * Generate font configuration object for ExcelJS
 * @param {Object} options - Font options
 * @param {string} options.size - Font size (use FONT_SIZES constants)
 * @param {boolean} options.bold - Bold font
 * @param {boolean} options.italic - Italic font
 * @param {string} options.color - ARGB color code (use BRAND_COLORS constants)
 * @returns {Object} ExcelJS font configuration
 */
function createFontStyle({
    size = FONT_SIZES.normal,
    bold = false,
    italic = false,
    color = null
} = {}) {
    const fontConfig = {
        name: PRIMARY_FONT,
        size: size,
        bold: bold,
        italic: italic
    };

    if (color) {
        fontConfig.color = { argb: color };
    }

    return fontConfig;
}

/**
 * Get font configuration for specific use cases
 */
const FONT_PRESETS = {
    // === TITLES AND HEADERS ===
    title: createFontStyle({
        size: FONT_SIZES.title,
        bold: true,
        color: null  // Use default text color
    }),

    subtitle: createFontStyle({
        size: FONT_SIZES.subtitle,
        bold: true
    }),

    metadata: createFontStyle({
        size: FONT_SIZES.metadata,
        bold: false
    }),

    // === TABLE HEADERS ===
    columnHeader: createFontStyle({
        size: FONT_SIZES.normal,
        bold: true,
        color: BRAND_COLORS.white
    }),

    sectionHeader: createFontStyle({
        size: FONT_SIZES.sectionHeader,
        bold: true
    }),

    // === DATA CELLS ===
    normalData: createFontStyle({
        size: FONT_SIZES.normal,
        bold: false
    }),

    boldData: createFontStyle({
        size: FONT_SIZES.normal,
        bold: true
    }),

    // === TOTALS ===
    sectionTotal: createFontStyle({
        size: FONT_SIZES.sectionHeader,
        bold: true
    }),

    grandTotal: createFontStyle({
        size: FONT_SIZES.sectionHeader,
        bold: true
    }),

    // === SPECIAL CASES ===
    negativeValue: createFontStyle({
        size: FONT_SIZES.normal,
        bold: false,
        color: BRAND_COLORS.red
    }),

    watermark: createFontStyle({
        size: FONT_SIZES.small,
        bold: false,
        italic: true,
        color: BRAND_COLORS.primary
    }),

    categoryHeader: createFontStyle({
        size: FONT_SIZES.normal,
        bold: true
    })
};

// === ALIGNMENT PRESETS ===

const ALIGNMENT_PRESETS = {
    left: { horizontal: 'left', vertical: 'center' },
    right: { horizontal: 'right', vertical: 'center' },
    center: { horizontal: 'center', vertical: 'center' },
    leftIndent: (indent = 1) => ({ horizontal: 'left', vertical: 'center', indent }),
    wrapText: { horizontal: 'center', vertical: 'center', wrapText: true }
};

// === FILL PRESETS ===

const FILL_PRESETS = {
    primary: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.primary }
    },
    headerBlue: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.headerBlue }
    },
    sectionBlue: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.sectionBlue }
    },
    lightBlue: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.lightBlue }
    },
    green: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.green }
    },
    lightGreen: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.lightGreen }
    },
    orange: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.orange }
    },
    gray: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.gray }
    },
    darkGray: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: BRAND_COLORS.darkGray }
    }
};

// === BORDER PRESETS ===

const BORDER_PRESETS = {
    thin: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    },
    topBottom: {
        top: { style: 'thin' },
        bottom: { style: 'thin' }
    },
    topMediumBottomMedium: {
        top: { style: 'medium' },
        bottom: { style: 'medium' }
    },
    bottomMedium: {
        bottom: { style: 'medium' }
    }
};

// === EXPORTS ===

module.exports = {
    // Font names
    PRIMARY_FONT,
    FALLBACK_FONT,
    SECONDARY_FONT,

    // Colors
    BRAND_COLORS,

    // Sizes
    FONT_SIZES,

    // Presets
    FONT_PRESETS,
    ALIGNMENT_PRESETS,
    FILL_PRESETS,
    BORDER_PRESETS,

    // Utilities
    createFontStyle
};