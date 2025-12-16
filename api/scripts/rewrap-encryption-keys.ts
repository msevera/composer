import dotenv from 'dotenv';
dotenv.config();
import { ClientEncryption, MongoClient, Binary } from 'mongodb';

async function rewrapEncryptionKeys() {
  console.log('🔄 MongoDB CSFLE + GCP KMS Rewrap Script');
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
  const currentDEKIdStr = process.env.MONGODB_ENCRYPTION_KEY_ID;
  const kmsKeyVersion = process.env.KMS_KEY_VERSION;

  if (!mongoUri || !gcpProjectId) {
    console.error('❌ Missing required environment variables:');
    console.error('   - API_MONGODB_URI');
    console.error('   - GCP_PROJECT_ID');
    process.exit(1);
  }

  if (!currentDEKIdStr) {
    console.error('❌ MONGODB_ENCRYPTION_KEY_ID is required');
    process.exit(1);
  }

  if (!kmsKeyVersion) {
    console.error('❌ KMS_KEY_VERSION is required');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  GCP Project: ${gcpProjectId}`);
  console.log(`  Encryption DB Name: ${encryptionDbName}`);
  console.log(`  KMS Location: ${kmsLocation}`);
  console.log(`  KMS Key Ring: ${kmsKeyring}`);
  console.log(`  KMS Key Name: ${kmsKeyName}`);
  console.log(`  Current DEK ID: ${currentDEKIdStr}\n`);

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

    console.log('Step 2: Initializing encryption client...');
    const encryption = new ClientEncryption(client as any, {
      keyVaultNamespace,
      kmsProviders: kmsProviders as any,
    });
    console.log('✅ Encryption client initialized\n');

    console.log('Step 3: Verifying existing DEK...');
    const keyVaultCollection = client.db(keyVaultDb).collection(keyVaultColl);
    const currentDEKId = new Binary(Buffer.from(currentDEKIdStr, 'base64'), 4);
    const existingKey = await keyVaultCollection.findOne({ _id: currentDEKId });

    if (!existingKey) {
      console.error(`❌ DEK with ID ${currentDEKIdStr} not found in key vault`);
      process.exit(1);
    }

    console.log('✅ DEK found:');
    console.log(`   ID: ${existingKey._id.toString()}`);
    console.log(`   Alt Names: ${existingKey.keyAltNames?.join(', ') || 'none'}`);
    console.log(`   Master Key: ${JSON.stringify(existingKey.masterKey)}\n`);

    console.log('Step 4: Rewrapping DEK with new CMK version...');
    console.log('   This will re-encrypt the DEK using the current primary CMK version...\n');

    // Rewrap the DEK - this re-encrypts it with the new primary CMK version
    // The filter targets the specific DEK by _id
    // If masterKey is not specified, it uses the same key path with the new primary version
    const result = await encryption.rewrapManyDataKey(
      { _id: currentDEKId },
      {
        provider: 'gcp',
        masterKey: {
          projectId: gcpProjectId,
          location: kmsLocation,
          keyRing: kmsKeyring,
          keyName: kmsKeyName,
          keyVersion: kmsKeyVersion,
        },
      },
    );

    console.log('✅ Rewrap completed!\n');
    console.log('📋 Rewrap Summary:');
    console.log('=================');

    if (result.bulkWriteResult) {
      console.log(`Keys matched: ${result.bulkWriteResult.matchedCount}`);
      console.log(`Keys modified: ${result.bulkWriteResult.modifiedCount}`);

      if (result.bulkWriteResult.modifiedCount === 0) {
        console.log('\n⚠️  No keys were modified. This might mean:');
        console.log('   - The DEK is already encrypted with the current primary CMK version');
        console.log('   - Or the KMS key hasn\'t been rotated yet\n');
      }
    } else {
      console.log('⚠️  No keys matched the filter');
      console.log('   This means the DEK was not found or the filter did not match\n');
    }

    console.log(`DEK ID: ${currentDEKIdStr} (unchanged)`);
    console.log(
      `GCP KMS Key: projects/${gcpProjectId}/locations/${kmsLocation}/keyRings/${kmsKeyring}/cryptoKeys/${kmsKeyName}\n`,
    );

    console.log('🎉 Rewrap complete!');
    console.log('\nNote:');
    console.log('- The DEK ID remains the same (no need to update MONGODB_ENCRYPTION_KEY_ID)');
    console.log('- Old and new data will continue to work');
    console.log('- The DEK is now protected by the new CMK version\n');
  } catch (error: any) {
    console.error('❌ Rewrap failed:', error);

    if (error?.code === 'PermissionDenied' || error?.message?.includes('permission')) {
      console.error('\n💡 Permission Issue Troubleshooting:');
      console.error('   1. Verify service account has cloudkms.cryptoKeyEncrypterDecrypter role');
      console.error('   2. Ensure KMS API is enabled in your GCP project');
      console.error('   3. Verify the old CMK version is still enabled (needed to decrypt DEK)');
    }

    throw error;
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

rewrapEncryptionKeys()
  .then(() => {
    console.log('\n✅ Rewrap script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to rewrap encryption keys:', error);
    process.exit(1);
  });