import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EncryptionConfigService } from './encryption-config.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EncryptionConfigService],
  exports: [EncryptionConfigService],
})
export class EncryptionModule {}


