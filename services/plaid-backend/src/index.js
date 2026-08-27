import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { FirestoreConnectionStore, KmsCipher, SecretCredentials } from './gcp.js';
import { createHttpHandler } from './http.js';
import { createSafeLogger } from './logger.js';
import { PlaidClient } from './plaid.js';
import { PlaidConnectionService } from './service.js';

const config = loadConfig();
const credentials = new SecretCredentials({
  projectId: config.projectId,
  clientIdSecret: config.plaidClientIdSecret,
  plaidSecret: config.plaidSecret,
  identityHmacSecret: config.identityHmacSecret
});
const store = new FirestoreConnectionStore({
  projectId: config.projectId,
  databaseId: config.firestoreDatabase,
  environment: config.environment
});
const cipher = new KmsCipher({ keyName: config.kmsCredentialKey });
const plaid = new PlaidClient({ baseUrl: config.plaidBaseUrl, credentials });
const service = new PlaidConnectionService({ config, store, cipher, credentials, plaid, randomId: randomUUID });
const handler = createHttpHandler({ config, service, store, logger: createSafeLogger() });

http.createServer(handler).listen(config.port, () => {
  console.info(JSON.stringify({ action: 'START', environment: config.environment, status: 'OK' }));
});
