import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionConfigService } from './encryption-config.service';

describe('EncryptionConfigService', () => {
  let service: EncryptionConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                GCP_PROJECT_ID: 'test-project',
                KMS_LOCATION: 'us-east1',
                KMS_KEYRING: 'test-keyring',
                KMS_KEY_NAME: 'test-key',
                MONGODB_ENCRYPTION_KEY_ID: Buffer.from('test-key-id').toString('base64'),
                API_MONGODB_DB: 'test-api-db',
                LANGGRAPH_MONGODB_DB: 'test-lg-db',
              };
              return key in config ? config[key] : defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionConfigService>(EncryptionConfigService);
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should load KMS providers configuration', () => {
    const kmsProviders = service.getKMSProviders();

    expect(kmsProviders.gcp).toBeDefined();
    expect(kmsProviders.gcp.projectId).toBe('test-project');
    expect(kmsProviders.gcp.location).toBe('us-east1');
    expect(kmsProviders.gcp.keyRing).toBe('test-keyring');
    expect(kmsProviders.gcp.keyName).toBe('test-key');
  });

  it('should configure encrypted fields map', () => {
    const encryptedFieldsMap = service.getEncryptedFieldsMap();

    // LangGraph DB collections
    expect(encryptedFieldsMap['test-lg-db.checkpoints']).toBeDefined();
    expect(encryptedFieldsMap['test-lg-db.checkpoints'].fields).toHaveLength(1);

    const checkpointField = encryptedFieldsMap['test-lg-db.checkpoints'].fields.find(
      (f) => f.path === 'checkpoint',
    );
    expect(checkpointField).toBeDefined();
    expect(checkpointField?.bsonType).toBe('binData');

    const metadataField = encryptedFieldsMap['test-lg-db.checkpoints'].fields.find(
      (f) => f.path === 'metadata',
    );
    expect(metadataField).toBeUndefined();

    // API DB accounts collection
    expect(encryptedFieldsMap['test-api-db.accounts']).toBeDefined();
    expect(encryptedFieldsMap['test-api-db.accounts'].fields).toHaveLength(2);

    const tokenField = encryptedFieldsMap['test-api-db.accounts'].fields.find(
      (f) => f.path === 'accessToken',
    );
    expect(tokenField).toBeDefined();
    expect(tokenField?.bsonType).toBe('string');
  });

  it('should return auto-encryption options', () => {
    const options = service.getAutoEncryptionOptions();

    expect(options.keyVaultNamespace).toBe('encryption.__keyVault');
    expect(options.kmsProviders).toBeDefined();
    expect(options.encryptedFieldsMap).toBeDefined();
    expect(options.bypassAutoEncryption).toBe(false);
  });

  it('should throw error if GCP_PROJECT_ID is missing', async () => {
    const module = await Test.createTestingModule({
      providers: [
        EncryptionConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: any) => {
              if (key === 'GCP_PROJECT_ID') {
                return undefined;
              }
              if (key === 'MONGODB_ENCRYPTION_KEY_ID') {
                return Buffer.from('test-key-id').toString('base64');
              }
              return defaultValue;
            },
          },
        },
      ],
    }).compile();

    const testService = module.get<EncryptionConfigService>(EncryptionConfigService);

    await expect(testService.onModuleInit()).rejects.toThrow('GCP_PROJECT_ID is required');
  });

  it('should throw error if MONGODB_ENCRYPTION_KEY_ID is missing', async () => {
    const module = await Test.createTestingModule({
      providers: [
        EncryptionConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: any) => {
              if (key === 'MONGODB_ENCRYPTION_KEY_ID') {
                return undefined;
              }
              if (key === 'GCP_PROJECT_ID') {
                return 'test-project';
              }
              return defaultValue;
            },
          },
        },
      ],
    }).compile();

    const testService = module.get<EncryptionConfigService>(EncryptionConfigService);

    await expect(testService.onModuleInit()).rejects.toThrow('MONGODB_ENCRYPTION_KEY_ID is required');
  });
});


