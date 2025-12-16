# Key Rotation for MongoDB CSFLE + Google Cloud KMS

- KMS key `mongodb-encryption-master-key` (in `encryption-keys` key ring) is configured to rotate automatically (recommended: every 90 days).
- Old key versions remain available for decryption; new writes use the latest key version.
- No data re-encryption is required, but you may optionally rewrap the Data Encryption Key stored in `encryption.__keyVault` using `ClientEncryption.rewrapManyDataKey`.

Monitor KMS usage and rotation events in Cloud Logging to ensure keys remain healthy and accessible.

