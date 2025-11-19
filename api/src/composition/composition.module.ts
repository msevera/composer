import { Module } from '@nestjs/common';
import { CompositionResolver } from './composition.resolver';
import { IndexingModule } from '../indexing/indexing.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [IndexingModule, AuthModule],
  providers: [CompositionResolver],
})
export class CompositionModule {}

