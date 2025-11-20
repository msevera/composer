import { Module } from '@nestjs/common';
import { CompositionResolver } from './composition.resolver';
import { IndexingModule } from '../indexing/indexing.module';

@Module({
  imports: [IndexingModule],
  providers: [CompositionResolver],
})
export class CompositionModule {}

