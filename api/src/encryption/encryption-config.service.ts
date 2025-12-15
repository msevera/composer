import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Binary } from 'mongodb';

interface KMSProviders {
  gcp: {
    projectId: string;
    location: string;
    keyRing: string;
    keyName: string;
  };
}

interface EncryptedField {
  path: string;
  bsonType: string;
  keyId: Binary;
}

interface EncryptedFieldsMap {
  [namespace: string]: {
    fields: EncryptedField[];
  };
}

@Injectable()
export class EncryptionConfigService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionConfigService.name);
  private kmsProviders!: KMSProviders;
  private encryptedFieldsMap!: EncryptedFieldsMap;
  private keyVaultNamespace!: string;
  private dataKeyId!: Binary;

  constructor(private readonly configService: ConfigService) {
    console.log('Initializing MongoDB CSFLE configuration...');
    this.logger.log('Initializing MongoDB CSFLE configuration...');

    const gcpProjectId = this.configService.get<string>('GCP_PROJECT_ID');
    const kmsLocation = this.configService.get<string>('KMS_LOCATION');
    const kmsKeyring = this.configService.get<string>('KMS_KEYRING');
    const kmsKeyName = this.configService.get<string>('KMS_KEY_NAME');
    const dataKeyIdStr = this.configService.get<string>('MONGODB_ENCRYPTION_KEY_ID');
    const apiDbName = this.configService.get<string>('API_MONGODB_DB');
    const langgraphDbName = this.configService.get<string>('LANGGRAPH_MONGODB_DB');

    if (!gcpProjectId) {
      throw new Error('GCP_PROJECT_ID is required for MongoDB encryption');
    }

    if (!dataKeyIdStr) {
      throw new Error('MONGODB_ENCRYPTION_KEY_ID is required. Run: npm run setup-encryption');
    }

    this.dataKeyId = new Binary(Buffer.from(dataKeyIdStr, 'base64'), 4);

    this.kmsProviders = {
      gcp: {
        projectId: gcpProjectId,
        location: kmsLocation,
        keyRing: kmsKeyring,
        keyName: kmsKeyName,
      },
    };

    this.keyVaultNamespace = 'encryption.__keyVault';

    this.encryptedFieldsMap = {
      // LangGraph checkpoint data (may live in a different DB)
      [`${langgraphDbName}.checkpoints`]: {
        fields: [
          {
            path: 'checkpoint',
            bsonType: 'binData',
            keyId: this.dataKeyId,
          },
        ],
      },
      [`${langgraphDbName}.checkpoint_writes`]: {
        fields: [
          {
            path: 'value',
            bsonType: 'binData',
            keyId: this.dataKeyId,
          },
        ],
      },
      // Better Auth accounts data (lives in API DB)
      [`${apiDbName}.accounts`]: {
        fields: [
          {
            path: 'accessToken',
            bsonType: 'string',
            keyId: this.dataKeyId,
          },
          {
            path: 'refreshToken',
            bsonType: 'string',
            keyId: this.dataKeyId,
          },
        ],
      },
    };

    this.logger.log('MongoDB CSFLE configuration initialized');
    this.logger.debug(`Key Vault: ${this.keyVaultNamespace}`);
    this.logger.debug(`Encrypted collections: ${Object.keys(this.encryptedFieldsMap).join(', ')}`);
  }

  async onModuleInit() {

  }

  getKMSProviders(): KMSProviders {
    return this.kmsProviders;
  }

  getEncryptedFieldsMap(): EncryptedFieldsMap {
    return this.encryptedFieldsMap;
  }

  getKeyVaultNamespace(): string {
    return this.keyVaultNamespace;
  }

  getAutoEncryptionOptions() {
    return {
      keyVaultNamespace: this.keyVaultNamespace,
      kmsProviders: this.kmsProviders,
      encryptedFieldsMap: this.encryptedFieldsMap,
      bypassAutoEncryption: false,
    };
  }
}


