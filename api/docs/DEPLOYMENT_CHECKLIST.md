# Deployment Checklist - MongoDB CSFLE + GCP KMS

## Before deploying

- [ ] GCP KMS key ring and key (`mongodb-encryption-master-key`) created and rotating.
- [ ] Service account (and Cloud Run service account) has `cloudkms.cryptoKeyEncrypterDecrypter`.
- [ ] `npm run setup-encryption` executed and `MONGODB_ENCRYPTION_KEY_ID` captured.
- [ ] Environment variables set: `API_MONGODB_URI`, `MONGODB_DB_NAME`, `GCP_PROJECT_ID`, `KMS_LOCATION`, `KMS_KEYRING`, `KMS_KEY_NAME`, `MONGODB_ENCRYPTION_KEY_ID`, `CHECKPOINT_RETENTION_DAYS`.

## After deploying

- [ ] API starts without CSFLE-related errors.
- [ ] Checkpoints and accounts collections contain encrypted fields (non-plaintext).
- [ ] Conversation retrieval and OAuth flows still work end-to-end.
- [ ] TTL indexes are present on `checkpoints.createdAt` and `checkpoint_writes.createdAt`.


