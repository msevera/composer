import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { BetterAuthUser, BetterAuthUserDocument } from '../schemas/better-auth-user.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import { Account, AccountDocument } from '../schemas/account.schema';
import { Verification, VerificationDocument } from '../schemas/verification.schema';

@Injectable()
export class MongooseAdapter {
  constructor(
    @InjectModel(BetterAuthUser.name) private userModel: Model<BetterAuthUserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    @InjectModel(Verification.name) private verificationModel: Model<VerificationDocument>,
  ) {}

  async create({ model, data }: { model: string; data: any }) {
    let result;
    switch (model) {
      case 'user':
        result = await this.userModel.create(data);
        return this.transformUser(result);
      case 'session':
        result = await this.sessionModel.create(data);
        return this.transformSession(result);
      case 'account':
        result = await this.accountModel.create(data);
        return this.transformAccount(result);
      case 'verification':
        result = await this.verificationModel.create(data);
        return this.transformVerification(result);
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }

  async findOne({ model, where }: { model: string; where: any[] }) {
    const query = this.buildQuery(where);
    let result;
    switch (model) {
      case 'user':
        result = await this.userModel.findOne(query).exec();
        return result ? this.transformUser(result) : null;
      case 'session':
        result = await this.sessionModel.findOne(query).exec();
        return result ? this.transformSession(result) : null;
      case 'account':
        result = await this.accountModel.findOne(query).exec();
        return result ? this.transformAccount(result) : null;
      case 'verification':
        result = await this.verificationModel.findOne(query).exec();
        return result ? this.transformVerification(result) : null;
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }

  async findMany({ model, where, limit, offset, sortBy }: { model: string; where?: any[]; limit?: number; offset?: number; sortBy?: { field: string; direction: 'asc' | 'desc' } }) {
    const query = where ? this.buildQuery(where) : {};
    let queryBuilder;
    switch (model) {
      case 'user':
        queryBuilder = this.userModel.find(query);
        break;
      case 'session':
        queryBuilder = this.sessionModel.find(query);
        break;
      case 'account':
        queryBuilder = this.accountModel.find(query);
        break;
      case 'verification':
        queryBuilder = this.verificationModel.find(query);
        break;
      default:
        throw new Error(`Unknown model: ${model}`);
    }

    if (limit) queryBuilder = queryBuilder.limit(limit);
    if (offset) queryBuilder = queryBuilder.skip(offset);
    if (sortBy) {
      const sort: any = {};
      sort[sortBy.field] = sortBy.direction === 'asc' ? 1 : -1;
      queryBuilder = queryBuilder.sort(sort);
    }

    const results = await queryBuilder.exec();
    
    switch (model) {
      case 'user':
        return results.map(r => this.transformUser(r));
      case 'session':
        return results.map(r => this.transformSession(r));
      case 'account':
        return results.map(r => this.transformAccount(r));
      case 'verification':
        return results.map(r => this.transformVerification(r));
      default:
        return results;
    }
  }

  async update({ model, where, update }: { model: string; where: any[]; update: any }) {
    const query = this.buildQuery(where);
    let result;
    switch (model) {
      case 'user':
        result = await this.userModel.findOneAndUpdate(query, update, { new: true }).exec();
        return result ? this.transformUser(result) : null;
      case 'session':
        result = await this.sessionModel.findOneAndUpdate(query, update, { new: true }).exec();
        return result ? this.transformSession(result) : null;
      case 'account':
        result = await this.accountModel.findOneAndUpdate(query, update, { new: true }).exec();
        return result ? this.transformAccount(result) : null;
      case 'verification':
        result = await this.verificationModel.findOneAndUpdate(query, update, { new: true }).exec();
        return result ? this.transformVerification(result) : null;
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }

  async delete({ model, where }: { model: string; where: any[] }) {
    const query = this.buildQuery(where);
    switch (model) {
      case 'user':
        await this.userModel.deleteOne(query).exec();
        break;
      case 'session':
        await this.sessionModel.deleteOne(query).exec();
        break;
      case 'account':
        await this.accountModel.deleteOne(query).exec();
        break;
      case 'verification':
        await this.verificationModel.deleteOne(query).exec();
        break;
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }

  async deleteMany({ model, where }: { model: string; where: any[] }) {
    const query = this.buildQuery(where);
    switch (model) {
      case 'user':
        await this.userModel.deleteMany(query).exec();
        break;
      case 'session':
        await this.sessionModel.deleteMany(query).exec();
        break;
      case 'account':
        await this.accountModel.deleteMany(query).exec();
        break;
      case 'verification':
        await this.verificationModel.deleteMany(query).exec();
        break;
      default:
        throw new Error(`Unknown model: ${model}`);
    }
  }

  private buildQuery(where: any[]) {
    const query: any = {};
    for (const condition of where) {
      const { field, value, operator = '=' } = condition;
      if (operator === '=') {
        query[field] = value;
      } else if (operator === 'in') {
        query[field] = { $in: Array.isArray(value) ? value : [value] };
      } else if (operator === 'like') {
        query[field] = { $regex: value, $options: 'i' };
      }
    }
    return query;
  }

  private transformUser(doc: any) {
    return {
      id: doc._id?.toString() || doc.id,
      email: doc.email,
      name: doc.name,
      image: doc.image,
      emailVerified: doc.emailVerified,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private transformSession(doc: any) {
    return {
      id: doc._id?.toString() || doc.id,
      userId: doc.userId,
      expiresAt: doc.expiresAt,
      ipAddress: doc.ipAddress,
      userAgent: doc.userAgent,
    };
  }

  private transformAccount(doc: any) {
    return {
      id: doc._id?.toString() || doc.id,
      userId: doc.userId,
      accountId: doc.accountId,
      providerId: doc.providerId,
      accessToken: doc.accessToken,
      refreshToken: doc.refreshToken,
      idToken: doc.idToken,
      expiresAt: doc.expiresAt,
      password: doc.password,
    };
  }

  private transformVerification(doc: any) {
    return {
      id: doc._id?.toString() || doc.id,
      identifier: doc.identifier,
      value: doc.value,
      expiresAt: doc.expiresAt,
    };
  }
}

