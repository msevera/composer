import { Module } from '@nestjs/common';
import { NotionService } from './notion.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [NotionService],
  exports: [NotionService],
})
export class NotionModule {}
