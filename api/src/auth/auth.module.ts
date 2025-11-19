import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { AuthGuard } from './auth.guard';
import { UserModule } from '../user/user.module';
import { BetterAuthModule } from './better-auth.module';

@Module({
  imports: [forwardRef(() => UserModule), BetterAuthModule],
  providers: [AuthService, AuthResolver, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}

