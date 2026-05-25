import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { TEMPLATE_TYPES } from '../common/constants/template-types';
import { File, type FileModel } from '../files/schemas/file.schema';
import { User, type UserModel } from '../users/schemas/user.schema';

/**
 * Dashboard aggregations for /api/admin/stats. Mirrors the legacy
 * backend/src/admin/files.controller.js#getStats verbatim.
 */
@Injectable()
export class AdminStatsService {
  constructor(
    @InjectModel(User.name) private readonly userModel: UserModel,
    @InjectModel(File.name) private readonly fileModel: FileModel,
  ) {}

  async getStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      usersByRole,
      usersByActive,
      filesByStatus,
      filesByTemplate,
      filesLast7Days,
      totalUsers,
      totalFiles,
    ] = await Promise.all([
      this.userModel.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      this.userModel.aggregate([{ $group: { _id: '$isActive', count: { $sum: 1 } } }]),
      this.fileModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      this.fileModel.aggregate([{ $group: { _id: '$templateType', count: { $sum: 1 } } }]),
      this.fileModel.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.userModel.countDocuments(),
      this.fileModel.countDocuments(),
    ]);

    return {
      success: true,
      stats: {
        totalUsers,
        totalFiles,
        usersByRole,
        usersByActive,
        filesByStatus,
        filesByTemplate,
        filesLast7Days,
        templateTypes: TEMPLATE_TYPES,
      },
    };
  }
}
