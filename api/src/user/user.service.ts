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
}

