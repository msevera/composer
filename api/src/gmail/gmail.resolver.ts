import { Resolver, Query, Mutation, Context, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GmailService } from './gmail.service';
import { getConnectionToken } from '@nestjs/mongoose';
import { Inject } from '@nestjs/common';
import { Connection } from 'mongoose';

@Resolver()
export class GmailResolver {
  constructor(
    private gmailService: GmailService,
    @Inject(getConnectionToken()) private connection: Connection,
  ) {}

  @Query(() => Boolean)
  @UseGuards(AuthGuard)
  async isGmailConnected(@Context() context: any): Promise<boolean> {
    const user = context.req.user;
    if (!user) {
      console.log('No user in context');
      return false;
    }

    // Better-Auth user ID might be in different formats
    const userId = user.id || user.userId || user._id;
    if (!userId) {
      console.log('No userId found in user object:', user);
      return false;
    }

    try {
      // Check directly in MongoDB accounts collection
      const db = this.connection.db;
      
      // Try with userId as string
      let account = await db.collection('accounts').findOne({
        userId: userId.toString(),
        providerId: 'google',
      });

      console.log('account First', account);
      
      // If not found, try with userId as ObjectId or different format
      if (!account) {
        account = await db.collection('accounts').findOne({
          userId: userId,
          providerId: 'google',
        });
      }
      
      // Also check all accounts for this user to see what's stored
      const allAccounts = await db.collection('accounts').find({ 
        $or: [
          { userId: userId.toString() },
          { userId: userId },
        ]
      }).toArray();
      console.log('All accounts for user:', JSON.stringify(allAccounts, null, 2));
      console.log('Gmail account check for userId:', userId, 'Found:', !!account);
      
      // If still not found, check if any account has provider 'google' (case-insensitive)
      if (!account && allAccounts.length > 0) {
        account = allAccounts.find((acc: any) => 
          (acc.providerId === 'google' || acc.provider === 'google' || acc.id === 'google') &&
          (acc.userId?.toString() === userId.toString() || acc.userId === userId)
        );
        console.log('Found account in allAccounts:', !!account);
      }
      
      return !!account;
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
      return false;
    }
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthGuard)
  async disconnectGmail(@Context() context: any): Promise<boolean> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Better-Auth user ID might be in different formats
    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    try {
      const disconnected = await this.gmailService.disconnectGmail(userId.toString());
      console.log('Gmail disconnected for userId:', userId, 'Success:', disconnected);
      return disconnected;
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      throw new Error('Failed to disconnect Gmail account');
    }
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthGuard)
  async storeGmailTokens(
    @Context() context: any,
    @Args('accessToken') accessToken: string,
    @Args('refreshToken') refreshToken: string,
    @Args('expiresIn') expiresIn: number,
  ): Promise<boolean> {
    const user = context.req.user;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.id || user.userId || user._id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    try {
      const stored = await this.gmailService.storeOAuthTokens(
        userId.toString(),
        accessToken,
        refreshToken,
        expiresIn,
      );
      return stored;
    } catch (error) {
      console.error('Error storing Gmail tokens:', error);
      throw new Error('Failed to store Gmail tokens');
    }
  }
}

