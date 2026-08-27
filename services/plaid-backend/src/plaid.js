import { ServiceError } from './errors.js';

export class PlaidError extends Error {
  constructor(message, { status = 502, errorCode = 'PLAID_ERROR', transient = false } = {}) {
    super(message);
    this.name = 'PlaidError';
    this.status = status;
    this.errorCode = errorCode;
    this.transient = transient;
  }
}

export class PlaidClient {
  constructor({ baseUrl, credentials, fetchImpl = fetch }) {
    this.baseUrl = baseUrl;
    this.credentials = credentials;
    this.fetchImpl = fetchImpl;
  }

  async post(path, input) {
    const credentials = await this.credentials.getPlaidCredentials();
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: credentials.clientId,
          secret: credentials.secret,
          ...input
        })
      });
    } catch (_error) {
      throw new PlaidError('Plaid request failed.', { transient: true });
    }
    let body = {};
    try { body = await response.json(); } catch (_error) {}
    if (!response.ok) {
      throw new PlaidError('Plaid rejected the request.', {
        status: response.status >= 500 ? 503 : 422,
        errorCode: String(body.error_code || 'PLAID_ERROR'),
        transient: response.status >= 500 || response.status === 429
      });
    }
    return body;
  }

  async createLinkToken({ userKey, correlationId }) {
    return this.post('/link/token/create', {
      user: { client_user_id: userKey },
      client_name: 'CashCompass',
      // Assets is the broad-account Link anchor and is not used to create an
      // Asset Report. Liabilities is consented but becomes a subscription only
      // when CashCompass calls /liabilities/get for an Item that contains a
      // supported credit account.
      products: ['assets'],
      additional_consented_products: ['liabilities'],
      country_codes: ['US'],
      language: 'en'
    });
  }

  async createUpdateLinkToken({ userKey, accessToken }) {
    return this.post('/link/token/create', {
      user: { client_user_id: userKey },
      client_name: 'CashCompass',
      access_token: accessToken,
      country_codes: ['US'],
      language: 'en'
    });
  }

  async exchangePublicToken(publicToken) {
    return this.post('/item/public_token/exchange', { public_token: publicToken });
  }

  async getAccounts(accessToken) {
    return this.post('/accounts/get', { access_token: accessToken });
  }

  async getLiabilities(accessToken) {
    return this.post('/liabilities/get', { access_token: accessToken });
  }

  async getInstitution(institutionId) {
    if (!institutionId) return null;
    return this.post('/institutions/get_by_id', {
      institution_id: institutionId,
      country_codes: ['US']
    });
  }

  async removeItem(accessToken) {
    try {
      return await this.post('/item/remove', { access_token: accessToken });
    } catch (error) {
      if (error instanceof PlaidError && error.errorCode === 'ITEM_NOT_FOUND') {
        return { removed: true, alreadyRemoved: true };
      }
      throw error;
    }
  }
}

export function asProviderServiceError(error) {
  if (error instanceof PlaidError) {
    return new ServiceError(error.transient ? 503 : error.status, error.errorCode, 'Provider request failed.');
  }
  return error;
}
