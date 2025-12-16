import dotenv from 'dotenv';
dotenv.config();
import { ClientEncryption, MongoClient } from 'mongodb';

async function setupEncryptionKeys() {
  console.log('🔐 MongoDB CSFLE + GCP KMS Setup Script');
  console.log('========================================\n');

  // Load configuration
  const mongoUri = process.env.API_MONGODB_URI;
  const encryptionDbName = process.env.ENCRYPTION_MONGODB_DB;
  const gcpProjectId = process.env.GCP_PROJECT_ID;
  const kmsLocation = process.env.KMS_LOCATION;
  const kmsKeyring = process.env.KMS_KEYRING;
  const kmsKeyName = process.env.KMS_KEY_NAME;
  const kmsEmail = process.env.KMS_EMAIL;
  const kmsPk = process.env.KMS_PK;
  const kmsKeyVersion = process.env.KMS_KEY_VERSION;

  if (!mongoUri || !gcpProjectId) {
    console.error('❌ Missing required environment variables:');
    console.error('   - API_MONGODB_URI or LANGGRAPH_MONGODB_URI');
    console.error('   - GCP_PROJECT_ID');
    process.exit(1);
  }

  if (!kmsKeyVersion) {
    console.error('❌ KMS_KEY_VERSION is required');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(
    `  API MongoDB URI: ${mongoUri ? mongoUri.replace(/\/\/.*@/, '//<credentials>@') : '(not set)'
    }`,
  );

  console.log(`  GCP Project: ${gcpProjectId}`);
  console.log(`  Encryption DB Name: ${encryptionDbName}`);
  console.log(`  KMS Location: ${kmsLocation}`);
  console.log(`  KMS Key Ring: ${kmsKeyring}`);
  console.log(`  KMS Key Name: ${kmsKeyName}\n`);

  const kmsProviders = {
    gcp: (kmsEmail && kmsPk) ? {
      email: kmsEmail,
      privateKey: kmsPk,
    } : {},
  };

  const keyVaultNamespace = `${encryptionDbName}.__keyVault`;
  const [keyVaultDb, keyVaultColl] = keyVaultNamespace.split('.');

  console.log('Step 1: Connecting to MongoDB...');
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    console.log('Step 2: Creating key vault collection...');
    const db = client.db(keyVaultDb);

    try {
      await db.createCollection(keyVaultColl);
      console.log('✅ Key vault collection created\n');
    } catch (error: any) {
      if (error?.codeName === 'NamespaceExists') {
        console.log('✅ Key vault collection already exists\n');
      } else {
        throw error;
      }
    }

    console.log('Step 3: Creating unique index on keyAltNames...');
    await db.collection(keyVaultColl).createIndex(
      { keyAltNames: 1 },
      {
        unique: true,
        partialFilterExpression: { keyAltNames: { $exists: true } },
      },
    );
    console.log('✅ Index created\n');

    console.log('Step 4: Initializing encryption client...');
    const encryption = new ClientEncryption(client as any, {
      keyVaultNamespace,
      kmsProviders: kmsProviders as any,
    });
    console.log('✅ Encryption client initialized\n');

    console.log('Step 5: Checking for existing Data Encryption Key...');
    const keyVaultCollection = client.db(keyVaultDb).collection(keyVaultColl);
    const existingKey = await keyVaultCollection.findOne({
      keyAltNames: 'composerAI-main-key',
    });

    if (existingKey) {
      console.log('✅ Data Encryption Key already exists');
      console.log(`   Key ID: ${existingKey._id.toString()}\n`);
      console.log('🎉 Setup complete! Use this Key ID in your application configuration.\n');
      return existingKey._id;
    }

    console.log('Step 6: Creating Data Encryption Key (DEK)...');
    console.log('   This DEK will be encrypted by your GCP KMS key...', gcpProjectId, kmsLocation, kmsKeyring, kmsKeyName);


    const dataKeyId = await encryption.createDataKey('gcp', {
      masterKey: {
        projectId: gcpProjectId,
        location: kmsLocation,
        keyRing: kmsKeyring,
        keyName: kmsKeyName,
        keyVersion: kmsKeyVersion,
      },
      keyAltNames: ['composerAI-main-key'],
    });

    console.log('✅ Data Encryption Key created successfully!\n');
    console.log('📋 Setup Summary:');
    console.log('=================');
    console.log(`Key ID: ${dataKeyId.toString()}`);
    console.log(`Key Vault: ${keyVaultNamespace}`);
    console.log(`Key Alias: composerAI-main-key`);
    console.log(
      `GCP KMS Key: projects/${gcpProjectId}/locations/${kmsLocation}/keyRings/${kmsKeyring}/cryptoKeys/${kmsKeyName}\n`,
    );

    console.log('🎉 Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Add this Key ID to your environment variables:');
    console.log(`   MONGODB_ENCRYPTION_KEY_ID="${dataKeyId.toString()}"`);
    console.log('2. Configure encrypted fields in your MongoDB connection');
    console.log('3. Deploy your application\n');

    return dataKeyId;
  } catch (error: any) {
    console.error('❌ Setup failed:', error);

    if (error?.code === 'PermissionDenied' || error?.message?.includes('permission')) {
      console.error('\n💡 Permission Issue Troubleshooting:');
      console.error('   1. Verify service account has cloudkms.cryptoKeyEncrypterDecrypter role');
      console.error('   3. Ensure KMS API is enabled in your GCP project');
    }

    throw error;
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

setupEncryptionKeys()
  .then((keyId) => {
    console.log(`\nData Encryption Key ID: ${keyId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to setup encryption keys:', error);
    process.exit(1);
  });


