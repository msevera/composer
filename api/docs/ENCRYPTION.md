# MongoDB CSFLE + Google Cloud KMS Encryption

This service uses MongoDB Client-Side Field Level Encryption (CSFLE) with Google Cloud KMS to encrypt:

- `checkpoints.checkpoint` (LangGraph state)
- `checkpoint_writes.value` (pending writes)
- `accounts.accessToken` and `accounts.refreshToken` (OAuth tokens)

Keys are managed in:

- **KMS**: `projects/$GCP_PROJECT_ID/locations/$KMS_LOCATION/keyRings/$KMS_KEYRING/cryptoKeys/$KMS_KEY_NAME`
- **MongoDB key vault**: `encryption.__keyVault` with alias `composerAI-main-key`

TTL indexes ensure checkpoints are automatically removed after `CHECKPOINT_RETENTION_DAYS` (default 7).


