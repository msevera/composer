import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { AuthGuard } from './auth.guard';
import { BetterAuthMiddleware } from './better-auth.middleware';
import { UserModule } from '../user/user.module';
import { BetterAuthModule } from './better-auth.module';

@Module({
  imports: [forwardRef(() => UserModule), BetterAuthModule],
  providers: [AuthService, AuthResolver, AuthGuard, BetterAuthMiddleware],
  exports: [AuthService, AuthGuard, BetterAuthMiddleware],
})
export class AuthModule {}

