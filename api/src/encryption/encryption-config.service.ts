import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { Binary } from 'mongodb';
import * as path from 'path';

interface KMSProviders {
  gcp: {
    // Empty config uses Application Default Credentials / Workload Identity
    // for GCP KMS in the MongoDB driver.
  };
}

interface EncryptedField {
  path: string;
  bsonType: string;
  keyId: Binary;
}

@Injectable()
export class EncryptionConfigService {
  private readonly logger = new Logger(EncryptionConfigService.name);
  private kmsProviders!: KMSProviders;
  private schemaMap!: any;
  private keyVaultNamespace!: string;
  private dataKeyId!: Binary;

  constructor(private readonly configService: ConfigService) {
    console.log('Initializing MongoDB CSFLE configuration...');
    this.logger.log('Initializing MongoDB CSFLE configuration...');

    const gcpProjectId = this.configService.get<string>('GCP_PROJECT_ID');
    const dataKeyIdStr = this.configService.get<string>('MONGODB_ENCRYPTION_KEY_ID');
    const apiDbName = this.configService.get<string>('API_MONGODB_DB');
    const langgraphDbName = this.configService.get<string>('LANGGRAPH_MONGODB_DB');
    const encryptionDbName = this.configService.get<string>('ENCRYPTION_MONGODB_DB');
    const kmsEmail = this.configService.get<string>('KMS_EMAIL');
    const kmsPk = this.configService.get<string>('KMS_PK');

    if (!gcpProjectId) {
      throw new Error('GCP_PROJECT_ID is required for MongoDB encryption');
    }

    if (!dataKeyIdStr) {
      throw new Error('MONGODB_ENCRYPTION_KEY_ID is required. Run: npm run setup-encryption');
    }

    this.dataKeyId = new Binary(Buffer.from(dataKeyIdStr, 'base64'), 4);

    // Configure KMS providers synchronously so Mongoose sees them during initial connect.
    // The MongoDB driver will use ADC / Workload Identity for actual credentials.
    this.kmsProviders = {
      gcp: {
        email: kmsEmail,
        privateKey: kmsPk,
      },
    };

    this.keyVaultNamespace = `${encryptionDbName}.__keyVault`;

    this.schemaMap = {      
      [`${langgraphDbName}.checkpoints`]: {
        bsonType: "object",
        encryptMetadata: {
          keyId: [this.dataKeyId],
        },
        properties: {
          checkpoint: {
            encrypt: {
              bsonType: "binData",
              algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random",
            },
          },
        },
      },
      [`${langgraphDbName}.checkpoint_writes`]: {
        bsonType: "object",
        encryptMetadata: {
          keyId: [this.dataKeyId],
        },
        properties: {
          value: {
            encrypt: {
              bsonType: "binData",
              algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random",
            },
          },
        },
      },
      [`${apiDbName}.accounts`]: {
        bsonType: "object",
        encryptMetadata: {
          keyId: [this.dataKeyId],
        },
        properties: {
          accessToken: {
            encrypt: {
              bsonType: "string",
              algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random",
            },
          },
          refreshToken: {
            encrypt: {
              bsonType: "string",
              algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random",
            },
          },
        },
      },
    };

    this.logger.log('MongoDB CSFLE configuration initialized');
    this.logger.debug(`Key Vault: ${this.keyVaultNamespace}`);
    this.logger.debug(`Encrypted collections: ${Object.keys(this.schemaMap).join(', ')}`);
  }

  async getGcpAccessToken() {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    if (!token) {
      throw new Error('Failed to obtain GCP access token from Application Default Credentials');
    }

    return token;
  }

  getAutoEncryptionOptions() {
    // When compiled, __dirname is in api/dist/src/encryption
    // Go up 4 levels to reach project root, then into crypt_shared
    // Alternatively, use process.cwd() (api directory) and go up one level
    const cryptSharedPath = path.resolve(__dirname, '../../../crypt_shared/lib/mongo_crypt_v1.dylib');
    this.logger.debug(`cryptSharedLibPath: ${cryptSharedPath}`);

    return {
      keyVaultNamespace: this.keyVaultNamespace,
      kmsProviders: this.kmsProviders,
      schemaMap: this.schemaMap,
      bypassAutoEncryption: false,
      extraOptions: {
        // Use the shared library instead of mongocryptd process
        // The driver will look for it in node_modules/mongodb-client-encryption/lib/mongocryptd
        // or you can specify a custom path
        cryptSharedLibRequired: true,
        // Path is relative to project root (go up 4 levels from api/dist/src/encryption to project root)
        cryptSharedLibPath: cryptSharedPath,
      },
    };
  }
}


