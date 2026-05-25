import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';

import { AppLoggerService } from '../common/logger/app-logger.service';
import { File, type FileDocument, type FileModel } from '../files/schemas/file.schema';
import {
  User,
  type UserDocument,
  type UserModel,
  type UserRole,
} from '../users/schemas/user.schema';

interface ListUsersOptions {
  q?: string;
  role?: string;
  isActive?: string;
  subscription?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: UserModel,
    @InjectModel(File.name) private readonly fileModel: FileModel,
    private readonly logger: AppLoggerService,
  ) {}

  async listUsers(opts: ListUsersOptions) {
    const filter: FilterQuery<UserDocument> = {};

    if (opts.q) {
      const safe = String(opts.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { email: { $regex: safe, $options: 'i' } },
        { name: { $regex: safe, $options: 'i' } },
      ];
    }
    if (opts.role) filter.role = opts.role;
    if (opts.isActive === 'true') filter.isActive = true;
    if (opts.isActive === 'false') filter.isActive = false;
    if (opts.subscription) filter.subscriptionType = opts.subscription;

    const allowedSort = ['createdAt', 'lastLoginAt', 'email', 'filesProcessedThisMonth'];
    const sortField = opts.sort && allowedSort.includes(opts.sort) ? opts.sort : 'createdAt';
    const sortOrder: 1 | -1 = opts.order === 'asc' ? 1 : -1;
    const pageNum = Math.max(1, Number(opts.page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(opts.limit) || 25));

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      this.userModel.countDocuments(filter),
    ]);

    return {
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });

    const raw = await this.fileModel.aggregate<{ _id: string; count: number; totalSize: number }>([
      { $match: { userId: user._id } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalSize: { $sum: '$fileSize' } } },
    ]);

    const fileStats = {
      total: 0,
      uploaded: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      totalSize: 0,
    };
    for (const row of raw) {
      if (row._id in fileStats) (fileStats as Record<string, number>)[row._id] = row.count;
      fileStats.total += row.count;
      fileStats.totalSize += row.totalSize || 0;
    }

    return { success: true, user, fileStats };
  }

  async updateUserRole(adminUserId: string | Types.ObjectId, userId: string, role: UserRole) {
    if (String(adminUserId) === String(userId)) {
      throw new BadRequestException({
        error: 'CANNOT_MODIFY_SELF',
        message: 'You cannot change your own role',
      });
    }
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    const previousRole = user.role;
    user.role = role;
    await user.save();
    this.logger.logSecurity('User role changed', {
      adminId: adminUserId.toString(),
      targetUserId: user._id.toString(),
      previousRole,
      newRole: role,
    });
    return {
      success: true,
      user: { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
    };
  }

  async updateUserActive(
    adminUserId: string | Types.ObjectId,
    userId: string,
    isActive: boolean,
  ) {
    if (String(adminUserId) === String(userId)) {
      throw new BadRequestException({
        error: 'CANNOT_MODIFY_SELF',
        message: 'You cannot deactivate your own account',
      });
    }
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    user.isActive = isActive;
    await user.save();
    this.logger.info(`User ${isActive ? 'activated' : 'deactivated'}: ${user.email}`, {
      adminId: adminUserId.toString(),
      targetUserId: user._id.toString(),
      category: 'admin',
    });
    return {
      success: true,
      user: { id: user._id.toString(), email: user.email, isActive: user.isActive },
    };
  }

  async updateUserSubscription(
    adminUserId: string | Types.ObjectId,
    userId: string,
    subscriptionType: 'basic' | 'premium',
    subscriptionExpiresAt?: string | null,
  ) {
    let expiresAt: Date | null = null;
    if (subscriptionExpiresAt) {
      const d = new Date(subscriptionExpiresAt);
      if (isNaN(d.getTime())) {
        throw new BadRequestException({
          error: 'INVALID_EXPIRY',
          message: 'subscriptionExpiresAt must be a valid date or null',
        });
      }
      expiresAt = d;
    }
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    const previousType = user.subscriptionType;
    user.subscriptionType = subscriptionType;
    user.subscriptionExpiresAt = subscriptionType === 'basic' ? null : expiresAt;
    await user.save();
    this.logger.logSecurity(
      'Subscription changed by admin',
      {
        adminId: adminUserId.toString(),
        targetUserId: user._id.toString(),
        previousType,
        newType: subscriptionType,
        expiresAt: user.subscriptionExpiresAt,
      },
      'info',
    );
    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        subscriptionType: user.subscriptionType,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      },
    };
  }

  async getUserFiles(
    userId: string,
    opts: { status?: string; templateType?: string; page?: number; limit?: number },
  ) {
    const exists = await this.userModel.exists({ _id: userId });
    if (!exists) {
      throw new NotFoundException({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const filter: FilterQuery<FileDocument> = { userId };
    if (opts.status) filter.status = opts.status;
    if (opts.templateType) filter.templateType = opts.templateType;

    const pageNum = Math.max(1, Number(opts.page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(opts.limit) || 25));

    const [files, total] = await Promise.all([
      this.fileModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      this.fileModel.countDocuments(filter),
    ]);

    return {
      success: true,
      files,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    };
  }
}
