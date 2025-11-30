import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectModel, getConnectionToken } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { SegmentService } from '../segment/segment.service';
import { ObjectId } from 'mongodb';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => SegmentService))
    private segmentService: SegmentService,
    @Inject(getConnectionToken()) private connection: Connection,
  ) {}

  async create(email: string, name?: string): Promise<UserDocument> {
    // Check if a deleted user exists with this email
    const deletedUser = await this.findByEmailIncludingDeleted(email);
    
    if (deletedUser && deletedUser.deletedAt) {
      // Restore the deleted user account, preserving draftsUsed and maxDraftsAllowed
      deletedUser.deletedAt = undefined;
      deletedUser.name = name || deletedUser.name;
      deletedUser.onboardingCompleted = false; // Reset onboarding
      deletedUser.sendProductUpdates = false; // Reset preferences
      const restoredUser = await deletedUser.save();
      
      // Track account restoration
      this.segmentService.track(restoredUser._id.toString(), 'User Account Restored', {
        email: restoredUser.email,
        name: restoredUser.name,
        draftsUsed: restoredUser.draftsUsed,
        maxDraftsAllowed: restoredUser.maxDraftsAllowed,
      });
      
      // Identify the user
      this.segmentService.identify(restoredUser._id.toString(), {
        email: restoredUser.email,
        name: restoredUser.name,
      });

      return restoredUser;
    }
    
    // Create new user
    const user = new this.userModel({ email, name });
    const savedUser = await user.save();
    
    // Track new user account creation
    this.segmentService.track(savedUser._id.toString(), 'User Account Created', {
      email: savedUser.email,
      name: savedUser.name,
    });
    
    // Identify the user
    this.segmentService.identify(savedUser._id.toString(), {
      email: savedUser.email,
      name: savedUser.name,
    });

    return savedUser;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email, deletedAt: null }).exec();
  }

  async findByEmailIncludingDeleted(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async updateLastSignIn(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email, deletedAt: null },
        { lastSignIn: new Date() },
        { new: true },
      )
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  async updateSendProductUpdates(email: string, sendProductUpdates: boolean): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email, deletedAt: null },
        { sendProductUpdates },
        { new: true },
      )
      .exec();
  }

  async updateName(email: string, name: string): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        { email, deletedAt: null },
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
        { email, deletedAt: null },
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
    const user = await this.findById(userId);
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

  async deleteAccount(email: string): Promise<boolean> {
    const db = this.connection.db;
    
    // Find the user in our custom users collection (including deleted ones)
    const userDoc = await this.findByEmailIncludingDeleted(email);
    if (!userDoc) {
      throw new Error('User not found');
    }

    const userId = userDoc._id.toString();
    const userIdObjectId = userDoc._id;

    // Track account deletion before marking as deleted
    try {
      this.segmentService.track(userId, 'User Account Deleted', {
        email: userDoc.email,
        draftsUsed: userDoc.draftsUsed,
        maxDraftsAllowed: userDoc.maxDraftsAllowed,
      });
    } catch (error) {
      console.error('Failed to track account deletion:', error);
    }

    // Mark user as deleted instead of deleting the document
    // This preserves draftsUsed and maxDraftsAllowed to prevent cheating
    await this.userModel.updateOne(
      { _id: userIdObjectId },
      { deletedAt: new Date() }
    ).exec();

    // Delete all accounts associated with this user from better-auth's accounts collection
    const accountQueries: Record<string, any>[] = [
      { userId: userId },
      { userId: userIdObjectId },
    ];
    
    if (ObjectId.isValid(userId)) {
      accountQueries.push({ userId: new ObjectId(userId) });
    }

    for (const filter of accountQueries) {
      await db.collection('accounts').deleteMany(filter);
    }

    // Delete the user from better-auth's users collection
    const userQueries: Record<string, any>[] = [
      { id: userId },
      { email: email },
    ];

    if (ObjectId.isValid(userId)) {
      userQueries.push({ id: new ObjectId(userId) });
    }

    // for (const filter of userQueries) {
    //   await db.collection('users').deleteMany(filter);
    // }

    // Delete sessions associated with this user
    for (const filter of accountQueries) {
      await db.collection('sessions').deleteMany({ userId: filter.userId });
    }

    return true;
  }
}

