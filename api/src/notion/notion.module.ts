import { Module } from '@nestjs/common';
import { NotionService } from './notion.service';
import { NotionResolver } from './notion.resolver';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [NotionService, NotionResolver],
  exports: [NotionService],
})
export class NotionModule {}
