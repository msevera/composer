import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionConfigService } from './encryption-config.service';
import { MongodbShutdownService } from './mongodb-shutdown.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EncryptionConfigService, MongodbShutdownService],
  exports: [EncryptionConfigService],
})
export class EncryptionModule {}


