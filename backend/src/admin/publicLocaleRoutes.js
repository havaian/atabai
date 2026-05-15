/**
 * Public locale routes — exposed without authentication so the frontend i18n
 * loader can fetch translations for everyone (including unauthenticated
 * visitors on landing page).
 *
 * Mounted at /api/locales in index.js (NOT under /api/admin).
 *
 * Endpoints:
 *   GET /api/locales/version           — current bundle versions per app
 *   GET /api/locales/bundle/:app/:lang — full translation bundle (nested)
 */

const express = require('express');
const localesController = require('./locales.controller');

const router = express.Router();

router.get('/version', localesController.publicGetVersions);
router.get('/bundle/:app/:lang', localesController.publicGetBundle);

module.exports = router;
