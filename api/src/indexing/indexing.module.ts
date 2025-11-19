import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotionEmbedding, NotionEmbeddingSchema } from './schemas/notion-embedding.schema';
import { NotionSyncState, NotionSyncStateSchema } from './schemas/notion-sync-state.schema';
import { GmailEmbedding, GmailEmbeddingSchema } from './schemas/gmail-embedding.schema';
import { GmailSyncState, GmailSyncStateSchema } from './schemas/gmail-sync-state.schema';
import { TwitterEmbedding, TwitterEmbeddingSchema } from './schemas/twitter-embedding.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { EmbeddingService } from './services/embedding.service';
import { NotionIndexerService } from './services/notion-indexer.service';
import { GmailIndexerService } from './services/gmail-indexer.service';
import { IndexingResolver } from './indexing.resolver';
import { NotionModule } from '../notion/notion.module';
import { GmailModule } from '../gmail/gmail.module';
import { VectorSearchService } from './services/vector-search.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotionEmbedding.name, schema: NotionEmbeddingSchema },
      { name: NotionSyncState.name, schema: NotionSyncStateSchema },
      { name: GmailEmbedding.name, schema: GmailEmbeddingSchema },
      { name: GmailSyncState.name, schema: GmailSyncStateSchema },
      { name: TwitterEmbedding.name, schema: TwitterEmbeddingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    GmailModule,
    NotionModule,
    AuthModule,
  ],
  providers: [
    EmbeddingService,
    GmailIndexerService,
    NotionIndexerService,
    VectorSearchService,
    IndexingResolver,
  ],
  exports: [
    EmbeddingService,
    GmailIndexerService,
    NotionIndexerService,
    VectorSearchService,
  ],
})
export class IndexingModule {}
