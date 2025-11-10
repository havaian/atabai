const express = require('express');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/templates
 * @desc    Get all available templates
 * @access  Public (with optional auth for personalization)
 */
router.get('/', optionalAuth, (req, res) => {
    // Mock templates data - replace with actual database query later
    const templates = [
        {
            id: 'ias-16-depreciation',
            name: {
                en: 'IAS 16 - Property, Plant and Equipment Depreciation',
                ru: 'МСФО 16 - Амортизация основных средств',
                uz: 'IAS 16 - Asosiy vositalar amortizatsiyasi'
            },
            category: 'depreciation',
            ifrsStandard: 'IAS 16',
            description: {
                en: 'Calculate depreciation for property, plant and equipment according to IAS 16',
                ru: 'Расчет амортизации основных средств согласно МСФО 16',
                uz: 'IAS 16 ga muvofiq asosiy vositalar amortizatsiyasini hisoblash'
            },
            isPopular: true
        },
        {
            id: 'ifrs-15-revenue',
            name: {
                en: 'IFRS 15 - Revenue from Contracts with Customers',
                ru: 'МСФО 15 - Выручка по договорам с покупателями',
                uz: 'IFRS 15 - Mijozlar bilan tuzilgan shartnomalardan tushumlar'
            },
            category: 'revenue',
            ifrsStandard: 'IFRS 15',
            description: {
                en: 'Recognize revenue from contracts with customers according to IFRS 15',
                ru: 'Признание выручки по договорам с покупателями согласно МСФО 15',
                uz: 'IFRS 15 ga muvofiq mijozlar bilan tuzilgan shartnomalardan tushumlarni tan olish'
            },
            isPopular: true
        }
    ];

    res.json({
        success: true,
        templates,
        count: templates.length
    });
});

/**
 * @route   GET /api/templates/:id
 * @desc    Get template details by ID
 * @access  Public
 */
router.get('/:id', (req, res) => {
    const { id } = req.params;

    // Mock template detail - replace with actual database query
    const template = {
        id,
        name: {
            en: 'Sample Template',
            ru: 'Образец шаблона',
            uz: 'Namuna shablon'
        },
        category: 'general',
        ifrsStandard: 'Sample',
        description: {
            en: 'Sample template description',
            ru: 'Описание образца шаблона',
            uz: 'Namuna shablon tavsifi'
        },
        fields: [],
        instructions: {
            en: 'Template instructions not implemented yet',
            ru: 'Инструкции шаблона пока не реализованы',
            uz: 'Shablon ko\'rsatmalari hali amalga oshirilmagan'
        }
    };

    res.json({
        success: true,
        template
    });
});

/**
 * @route   POST /api/templates/validate
 * @desc    Validate data against template
 * @access  Private
 */
router.post('/validate', authenticateJWT, (req, res) => {
    res.json({
        success: false,
        error: 'NOT_IMPLEMENTED',
        message: 'Template validation not implemented yet'
    });
});

module.exports = router;