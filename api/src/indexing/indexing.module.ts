import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GmailEmbedding, GmailEmbeddingSchema } from './schemas/gmail-embedding.schema';
import { GmailSyncState, GmailSyncStateSchema } from './schemas/gmail-sync-state.schema';
import { NotionEmbedding, NotionEmbeddingSchema } from './schemas/notion-embedding.schema';
import { NotionSyncState, NotionSyncStateSchema } from './schemas/notion-sync-state.schema';
import { TwitterEmbedding, TwitterEmbeddingSchema } from './schemas/twitter-embedding.schema';
import { TwitterSyncState, TwitterSyncStateSchema } from './schemas/twitter-sync-state.schema';
import { EmbeddingService } from './services/embedding.service';
import { GmailIndexerService } from './services/gmail-indexer.service';
import { VectorSearchService } from './services/vector-search.service';
import { IndexingResolver } from './indexing.resolver';
import { GmailModule } from '../gmail/gmail.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GmailEmbedding.name, schema: GmailEmbeddingSchema },
      { name: GmailSyncState.name, schema: GmailSyncStateSchema },
      { name: NotionEmbedding.name, schema: NotionEmbeddingSchema },
      { name: NotionSyncState.name, schema: NotionSyncStateSchema },
      { name: TwitterEmbedding.name, schema: TwitterEmbeddingSchema },
      { name: TwitterSyncState.name, schema: TwitterSyncStateSchema },
    ]),
    GmailModule,
    AuthModule,
  ],
  providers: [
    EmbeddingService,
    GmailIndexerService,
    VectorSearchService,
    IndexingResolver,
  ],
  exports: [
    EmbeddingService,
    GmailIndexerService,
    VectorSearchService,
  ],
})
export class IndexingModule {}

