import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import * as path from 'path';

import type { AppConfig } from '../../config/configuration';

/**
 * Multer disk-storage configuration — ported from backend/src/config/multer.js
 * with the upload path now coming from config (was hard-coded `/uploads`).
 *
 * Filenames are UUIDs to avoid encoding issues with Cyrillic / Uzbek
 * characters in the original filename; we preserve the original name on the
 * File document instead.
 */
export function buildMulterOptions(configService: ConfigService<AppConfig, true>): MulterOptions {
  const files = configService.get('files', { infer: true });

  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        if (!fs.existsSync(files.uploadPath)) {
          fs.mkdirSync(files.uploadPath, { recursive: true });
        }
        cb(null, files.uploadPath);
      },
      filename: (_req, file, cb) => {
        const id = crypto.randomUUID();
        const ext = path.extname(file.originalname);
        cb(null, `${id}${ext}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.xlsx' && ext !== '.xls') {
        cb(new BadRequestException({ error: 'INVALID_FILE_TYPE', message: 'Only .xlsx and .xls files are allowed' }), false);
        return;
      }
      cb(null, true);
    },
    // Use the basic-tier cap as the hard limit at the multer layer; the per-user
    // premium cap (200MB) is enforced at the controller via subscriptionType,
    // matching legacy behavior.
    limits: { fileSize: files.maxSizeBasic },
  };
}
