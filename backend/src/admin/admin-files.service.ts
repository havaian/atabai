import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { FilterQuery } from 'mongoose';

import { AppLoggerService } from '../common/logger/app-logger.service';
import type { AppConfig } from '../config/configuration';
import { File, type FileDocument, type FileModel } from '../files/schemas/file.schema';
import { User, type UserModel } from '../users/schemas/user.schema';

interface ListFilesOptions {
  userId?: string;
  userEmail?: string;
  status?: string;
  templateType?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/**
 * Admin-side file operations — list across users, fetch details, download
 * either original or processed artifact, fetch the transformation snapshot.
 * Ported from backend/src/admin/files.controller.js.
 */
@Injectable()
export class AdminFilesService {
  private readonly uploadPath: string;

  constructor(
    @InjectModel(File.name) private readonly fileModel: FileModel,
    @InjectModel(User.name) private readonly userModel: UserModel,
    private readonly logger: AppLoggerService,
    configService: ConfigService<AppConfig, true>,
  ) {
    this.uploadPath = configService.get('files.uploadPath', { infer: true });
  }

  async listAll(opts: ListFilesOptions) {
    const filter: FilterQuery<FileDocument> = {};

    if (opts.userId) filter.userId = opts.userId;

    if (opts.userEmail) {
      const safe = String(opts.userEmail).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matching = await this.userModel.find(
        { email: { $regex: safe, $options: 'i' } },
        { _id: 1 },
      ).lean();
      filter.userId = { $in: matching.map((u) => u._id) };
    }

    if (opts.status) filter.status = opts.status;
    if (opts.templateType) filter.templateType = opts.templateType;

    if (opts.q) {
      const safe = String(opts.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.originalName = { $regex: safe, $options: 'i' };
    }

    if (opts.from || opts.to) {
      const range: { $gte?: Date; $lte?: Date } = {};
      if (opts.from) range.$gte = new Date(opts.from);
      if (opts.to) range.$lte = new Date(opts.to);
      filter.createdAt = range;
    }

    const pageNum = Math.max(1, Number(opts.page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(opts.limit) || 25));

    const [files, total] = await Promise.all([
      this.fileModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('userId', 'email name')
        .lean(),
      this.fileModel.countDocuments(filter),
    ]);

    return {
      success: true,
      files,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    };
  }

  async getDetails(fileId: string) {
    const file = await this.fileModel
      .findById(fileId)
      .populate('userId', 'email name role')
      .lean();
    if (!file) {
      throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }
    return { success: true, file };
  }

  /** Streams the requested artifact to the response. */
  async downloadFile(
    fileId: string,
    type: 'original' | 'processed',
    adminId: string,
    adminEmail: string,
    res: Response,
  ): Promise<void> {
    const file = await this.fileModel.findById(fileId);
    if (!file) {
      throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }

    let relPath: string;
    let downloadName: string;

    if (type === 'original') {
      relPath = file.filePath;
      downloadName = file.filePath;
    } else if (type === 'processed') {
      if (!file.processedFilePath) {
        throw new BadRequestException({
          error: 'NO_PROCESSED_FILE',
          message: 'Processed file not available',
        });
      }
      relPath = file.processedFilePath;
      downloadName = file.processedFilePath;
    } else {
      throw new BadRequestException({
        error: 'INVALID_TYPE',
        message: "Query param 'type' must be 'original' or 'processed'",
      });
    }

    const fullPath = path.join(this.uploadPath, relPath);
    try {
      await fsPromises.access(fullPath);
    } catch {
      throw new NotFoundException({
        error: 'FILE_NOT_ACCESSIBLE',
        message: 'File not found on server',
      });
    }

    this.logger.logSecurity(
      'Admin downloaded user file',
      {
        adminId,
        adminEmail,
        fileId: file._id.toString(),
        fileOwnerId: file.userId.toString(),
        type,
      },
      'info',
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    fs.createReadStream(fullPath).pipe(res);
  }

  async getTransformation(fileId: string) {
    const file = await this.fileModel.findById(fileId).lean();
    if (!file) {
      throw new NotFoundException({ error: 'FILE_NOT_FOUND', message: 'File not found' });
    }
    if (!file.processedFilePath) {
      throw new BadRequestException({
        error: 'NO_PROCESSED_FILE',
        message: 'Processed file not available',
      });
    }

    const jsonPath = path.join(this.uploadPath, `${file.processedFilePath}.transformation.json`);

    let raw: string;
    try {
      raw = await fsPromises.readFile(jsonPath, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException({
          error: 'TRANSFORMATION_NOT_AVAILABLE',
          message: 'Transformation data not available',
        });
      }
      throw err;
    }

    try {
      return { success: true, transformation: JSON.parse(raw) };
    } catch (err) {
      this.logger.error(err, { context: 'admin/getTransformation corrupt JSON', jsonPath });
      throw new BadRequestException({
        error: 'TRANSFORMATION_CORRUPT',
        message: 'Transformation data is corrupted',
      });
    }
  }
}
