import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { EmailIndexingService } from './email-indexing.service';
import { EmailIndexingQueue, EMAIL_INDEXING_QUEUE } from './email-indexing.queue';
import { EmailIndexingProcessor } from './email-indexing.processor';
import { EmailSearchService } from './email-search.service';
import { EmailResolver } from './email.resolver';
import { Email, EmailSchema } from './schemas/email.schema';
import { EmailEmbedding, EmailEmbeddingSchema } from './schemas/email-embedding.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { GmailModule } from '../gmail/gmail.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Email.name, schema: EmailSchema },
      { name: EmailEmbedding.name, schema: EmailEmbeddingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    BullModule.registerQueue({
      name: EMAIL_INDEXING_QUEUE,
    }),
    GmailModule,
    forwardRef(() => AuthModule),
  ],
  providers: [
    EmailService,
    EmailIndexingService,
    EmailIndexingQueue,
    EmailIndexingProcessor,
    EmailSearchService,
    EmailResolver,
  ],
  exports: [EmailService, EmailIndexingService, EmailIndexingQueue, EmailSearchService],
})
export class EmailModule {}

