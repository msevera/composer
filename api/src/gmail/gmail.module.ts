import { Module, forwardRef } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [GmailService],
  exports: [GmailService],
})
export class GmailModule {}

