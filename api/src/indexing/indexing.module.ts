import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/schemas/user.schema';
import { EmbeddingService } from './services/embedding.service';
import { IndexingResolver } from './indexing.resolver';
import { VectorSearchService } from './services/vector-search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [
    EmbeddingService,
    VectorSearchService,
    IndexingResolver,
  ],
  exports: [
    EmbeddingService,
    VectorSearchService,
  ],
})
export class IndexingModule {}
