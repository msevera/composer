import { Resolver, Query, Context } from '@nestjs/graphql';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';

@Resolver(() => User)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query(() => User, { nullable: true })
  @UseGuards(AuthGuard)
  async me(@Context() context: any): Promise<User | null> {
    const userId = context.req.user?.id;
    if (!userId) {
      return null;
    }
    const userDoc = await this.userService.findById(userId);
    if (!userDoc) {
      return null;
    }
    return {
      id: userDoc._id.toString(),
      email: userDoc.email,
      lastSignIn: userDoc.lastSignIn,
      isEmailIndexingInProgress: userDoc.isEmailIndexingInProgress ?? false,
      emailIndexingStartedAt: userDoc.emailIndexingStartedAt,
      createdAt: userDoc.createdAt || new Date(),
      updatedAt: userDoc.updatedAt || new Date(),
    };
  }
}

