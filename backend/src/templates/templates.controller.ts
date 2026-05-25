import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

/**
 * /api/templates — public catalog of available IFRS report templates.
 *
 * The list is hard-coded here, matching the legacy `templates/routes.js` mock
 * data. When/if templates move to the database, replace the inline arrays with
 * a TemplatesService backed by MongoDB; the response shape on the wire stays
 * the same so the frontend doesn't have to change.
 *
 * Returns Russian/English/Uzbek labels per the platform's localisation policy.
 */
@Controller('templates')
export class TemplatesController {
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list() {
    const templates = [
      {
        id: 'ias-16-depreciation',
        name: {
          en: 'IAS 16 - Property, Plant and Equipment Depreciation',
          ru: 'МСФО 16 - Амортизация основных средств',
          uz: 'IAS 16 - Asosiy vositalar amortizatsiyasi',
        },
        category: 'depreciation',
        ifrsStandard: 'IAS 16',
        description: {
          en: 'Calculate depreciation for property, plant and equipment according to IAS 16',
          ru: 'Расчет амортизации основных средств согласно МСФО 16',
          uz: 'IAS 16 ga muvofiq asosiy vositalar amortizatsiyasini hisoblash',
        },
        isPopular: true,
      },
      {
        id: 'ifrs-15-revenue',
        name: {
          en: 'IFRS 15 - Revenue from Contracts with Customers',
          ru: 'МСФО 15 - Выручка по договорам с покупателями',
          uz: 'IFRS 15 - Mijozlar bilan tuzilgan shartnomalardan tushumlar',
        },
        category: 'revenue',
        ifrsStandard: 'IFRS 15',
        description: {
          en: 'Recognize revenue from contracts with customers according to IFRS 15',
          ru: 'Признание выручки по договорам с покупателями согласно МСФО 15',
          uz: 'IFRS 15 ga muvofiq mijozlar bilan tuzilgan shartnomalardan tushumlarni tan olish',
        },
        isPopular: true,
      },
    ];
    return { success: true, templates, count: templates.length };
  }

  @Get(':id')
  getDetails(@Param('id') id: string) {
    // Stub matches the legacy controller — full template content lands when
    // templates move to MongoDB. The shape is what the frontend templates
    // store expects.
    return {
      success: true,
      template: {
        id,
        name: { en: 'Sample Template', ru: 'Образец шаблона', uz: 'Namuna shablon' },
        category: 'general',
        ifrsStandard: 'Sample',
        description: {
          en: 'Sample template description',
          ru: 'Описание образца шаблона',
          uz: 'Namuna shablon tavsifi',
        },
        fields: [],
        instructions: {
          en: 'Template instructions not implemented yet',
          ru: 'Инструкции шаблона пока не реализованы',
          uz: "Shablon ko'rsatmalari hali amalga oshirilmagan",
        },
      },
    };
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  validate(@Body() _body: unknown) {
    return {
      success: false,
      error: 'NOT_IMPLEMENTED',
      message: 'Template validation not implemented yet',
    };
  }
}
