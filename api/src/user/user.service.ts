import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(email: string, name?: string): Promise<UserDocument> {
    const user = new this.userModel({ email, name });
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async updateLastSignIn(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email },
        { lastSignIn: new Date() },
        { new: true },
      )
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async updateSendProductUpdates(email: string, sendProductUpdates: boolean): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email },
        { sendProductUpdates },
        { new: true },
      )
      .exec();
  }

  async updateName(email: string, name: string): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email },
        { name },
        { new: true },
      )
      .exec();
  }

  async updateOnboardingCompleted(
    email: string,
    onboardingCompleted: boolean,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email },
        { onboardingCompleted },
        { new: true },
      )
      .exec();
  }

  async incrementDraftsUsed(userId: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $inc: { draftsUsed: 1 } },
        { new: true },
      )
      .exec();
  }

  async checkDraftLimit(userId: string): Promise<{ hasReachedLimit: boolean; maxDraftsAllowed: number; draftsUsed: number }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new Error('User not found');
    }
    const maxDrafts = user.maxDraftsAllowed;
    const draftsUsed = user.draftsUsed;
    return {
      hasReachedLimit: draftsUsed >= maxDrafts,
      maxDraftsAllowed: maxDrafts,
      draftsUsed,
    };
  }

  async updateMaxDraftsAllowed(userId: string, maxDrafts: number): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { maxDraftsAllowed: maxDrafts },
        { new: true },
      )
      .exec();
  }
}

