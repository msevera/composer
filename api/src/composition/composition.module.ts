import { Module } from '@nestjs/common';
import { CompositionResolver } from './composition.resolver';
import { CompositionService } from './composition.service';
import { CompositionAgentService } from './services/composition-agent.service';
import { GmailModule } from '../gmail/gmail.module';
import { CompositionController } from './composition.controller';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [GmailModule, UserModule],
  providers: [CompositionResolver, CompositionService, CompositionAgentService],
  controllers: [CompositionController],
  exports: [CompositionService],
})
export class CompositionModule {}

