import { Module } from '@nestjs/common';
import { CompositionResolver } from './composition.resolver';
import { IndexingModule } from '../indexing/indexing.module';
import { CompositionService } from './composition.service';
import { CompositionAgentService } from './services/composition-agent.service';
import { GmailModule } from '../gmail/gmail.module';

@Module({
  imports: [IndexingModule, GmailModule],
  providers: [CompositionResolver, CompositionService, CompositionAgentService],
  exports: [CompositionService],
})
export class CompositionModule {}

