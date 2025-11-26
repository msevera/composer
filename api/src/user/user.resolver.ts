import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UserDocument } from './schemas/user.schema';

@Resolver(() => User)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query(() => User, { nullable: true })
  async me(@Context() context: any): Promise<User | null> {
    const betterAuthUser = context.req.user;
    const userEmail = betterAuthUser?.email;
    if (!userEmail) {
      return null;
    }

    let userDoc = await this.userService.findByEmail(userEmail);
    if (!userDoc) {
      userDoc = await this.userService.create(userEmail, betterAuthUser?.name);
    } else if (betterAuthUser?.name && betterAuthUser.name !== userDoc.name) {
      userDoc = (await this.userService.updateName(userEmail, betterAuthUser.name)) ?? userDoc;
    }

    return this.mapUser(userDoc);
  }

  @Mutation(() => User)
  async updateSendProductUpdates(
    @Context() context: any,
    @Args('sendProductUpdates') sendProductUpdates: boolean,
  ): Promise<User | null> {
    const betterAuthUser = context.req.user;
    if (!betterAuthUser) {
      throw new Error('Unauthorized');
    }
    
    // Get user email from Better Auth user object
    const userEmail = betterAuthUser.email;
    if (!userEmail) {
      throw new Error('User email not found');
    }
    
    // Find or create user in our database
    let userDoc = await this.userService.findByEmail(userEmail);
    if (!userDoc) {
      // Create user if they don't exist in our database
      userDoc = await this.userService.create(userEmail, betterAuthUser.name);
    } else if (betterAuthUser?.name && betterAuthUser.name !== userDoc.name) {
      userDoc = (await this.userService.updateName(userEmail, betterAuthUser.name)) ?? userDoc;
    }
    
    // If user already has sendProductUpdates set to true, skip updating
    if (userDoc.sendProductUpdates === true) {
      return this.mapUser(userDoc);
    }
    
    const updated = await this.userService.updateSendProductUpdates(
      userEmail,
      sendProductUpdates,
    );
    if (!updated) {
      throw new Error('Failed to update user');
    }
    return this.mapUser(updated);
  }

  @Mutation(() => User)
  async setOnboardingCompleted(
    @Context() context: any,
    @Args('onboardingCompleted') onboardingCompleted: boolean,
  ): Promise<User | null> {
    const betterAuthUser = context.req.user;
    if (!betterAuthUser?.email) {
      throw new Error('Unauthorized');
    }

    let userDoc = await this.userService.findByEmail(betterAuthUser.email);
    if (!userDoc) {
      userDoc = await this.userService.create(betterAuthUser.email, betterAuthUser.name);
    }

    const updated = await this.userService.updateOnboardingCompleted(
      betterAuthUser.email,
      onboardingCompleted,
    );
    if (!updated) {
      throw new Error('Failed to update onboarding status');
    }

    return this.mapUser(updated);
  }

  private mapUser(userDoc: UserDocument): User {
    return {
      id: userDoc._id.toString(),
      email: userDoc.email,
      name: userDoc.name,
      lastSignIn: userDoc.lastSignIn,
      sendProductUpdates: userDoc.sendProductUpdates ?? false,
      onboardingCompleted: userDoc.onboardingCompleted ?? false,
      createdAt: userDoc.createdAt || new Date(),
      updatedAt: userDoc.updatedAt || new Date(),
    };
  }
}

