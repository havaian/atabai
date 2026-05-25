import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import {
  type IUserMethods,
  type UserDocument,
  type UserModel,
  User,
} from './schemas/user.schema';

/**
 * Lookups used by auth + admin guards. Higher-level user mutations (preferences,
 * profile update) live in their own service in Phase 4.
 */
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: UserModel) {}

  findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /** Fetch with sensitive fields (refresh secret, TOTP) needed for auth checks. */
  findByIdWithSecrets(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel
      .findById(id)
      .select('+refreshTokenSecret +refreshTokenSecretCreatedAt')
      .exec();
  }

  findByIdWithTotp(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel
      .findById(id)
      .select('+totpSecret +totpBackupCodes +refreshTokenSecret +refreshTokenSecretCreatedAt')
      .exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  getModel(): UserModel {
    return this.userModel;
  }

  /** Convenience pass-through to the schema method. */
  async ensureRefreshTokenSecret(user: UserDocument): Promise<void> {
    await (user as unknown as IUserMethods).ensureRefreshTokenSecret();
  }
}
