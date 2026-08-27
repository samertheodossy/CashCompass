const EXPECTED_FACTS = Object.freeze([
  'CURRENT_BALANCE', 'AVAILABLE_CREDIT', 'CREDIT_LIMIT', 'STATEMENT_BALANCE',
  'STATEMENT_DATE', 'MINIMUM_PAYMENT', 'NEXT_PAYMENT_DATE'
]);

const DEPOSITORY_FACTS = Object.freeze(['CURRENT_BALANCE', 'AVAILABLE_BALANCE']);
const MORTGAGE_FACTS = Object.freeze(['CURRENT_BALANCE']);

const APR_TYPES = Object.freeze({
  purchase_apr: 'PURCHASE_APR',
  cash_advance_apr: 'CASH_ADVANCE_APR',
  balance_transfer_apr: 'BALANCE_TRANSFER_APR',
  special: 'PROMOTIONAL_APR'
});

function text(value, max = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

function has(value) {
  return value !== null && value !== undefined && value !== '';
}

function number(value) {
  if (!has(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function date(value) {
  const parsed = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : '';
}

function dateTime(value) {
  const parsed = text(value, 40);
  const epoch = Date.parse(parsed);
  return parsed && Number.isFinite(epoch) ? new Date(epoch).toISOString() : '';
}

function candidate({ factType, numericValue = null, textValue = '', unit = '',
  sourceSemantic, effectiveAsOf = '', observedAt, semanticClass = 'FINANCIAL_FACT' }) {
  return {
    factType,
    valueKind: numericValue === null ? 'DATE' : 'NUMERIC',
    numericValue,
    textValue,
    currencyOrUnit: unit,
    sourceSemantic,
    providerEffectiveAsOf: effectiveAsOf,
    observedAt,
    semanticClass,
    reviewRequired: factType.endsWith('_APR') || factType === 'DISCLOSED_APR'
  };
}

function numericFact(facts, factType, value, unit, sourceSemantic, effectiveAsOf, observedAt) {
  const parsed = number(value);
  if (parsed === null) return;
  facts.push(candidate({ factType, numericValue: parsed, unit, sourceSemantic,
    effectiveAsOf, observedAt }));
}

export function normalizePlaidCreditLiabilities({ response, identitySecret, config, protectedKey, observedAt }) {
  const accounts = Array.isArray(response?.accounts) ? response.accounts : [];
  const liabilities = Array.isArray(response?.liabilities?.credit) ? response.liabilities.credit : [];
  const byAccount = new Map(liabilities.map(value => [String(value?.account_id || ''), value]));
  const output = [];
  for (const account of accounts) {
    if (String(account?.type || '').toLowerCase() !== 'credit') continue;
    const rawAccountId = String(account?.account_id || '');
    if (!rawAccountId) continue;
    const liability = byAccount.get(rawAccountId) || {};
    const currency = text(account?.balances?.iso_currency_code || account?.balances?.unofficial_currency_code, 12);
    const statementDate = date(liability.last_statement_issue_date);
    const facts = [];
    numericFact(facts, 'CURRENT_BALANCE', account?.balances?.current, currency,
      'ACCOUNT_CURRENT_BALANCE', '', observedAt);
    numericFact(facts, 'AVAILABLE_CREDIT', account?.balances?.available, currency,
      'ACCOUNT_AVAILABLE_CREDIT', '', observedAt);
    numericFact(facts, 'CREDIT_LIMIT', account?.balances?.limit, currency,
      'ACCOUNT_CREDIT_LIMIT', '', observedAt);
    numericFact(facts, 'STATEMENT_BALANCE', liability.last_statement_balance, currency,
      'CREDIT_LAST_STATEMENT_BALANCE', statementDate, observedAt);
    if (statementDate) {
      facts.push(candidate({ factType: 'STATEMENT_DATE', textValue: statementDate,
        unit: 'DATE', sourceSemantic: 'CREDIT_LAST_STATEMENT_ISSUE_DATE',
        effectiveAsOf: statementDate, observedAt, semanticClass: 'SOURCE_METADATA' }));
    }
    numericFact(facts, 'MINIMUM_PAYMENT', liability.minimum_payment_amount, currency,
      'CREDIT_MINIMUM_PAYMENT_AMOUNT', '', observedAt);
    const dueDate = date(liability.next_payment_due_date);
    if (dueDate) {
      facts.push(candidate({ factType: 'NEXT_PAYMENT_DATE', textValue: dueDate,
        unit: 'DATE', sourceSemantic: 'CREDIT_NEXT_PAYMENT_DUE_DATE',
        effectiveAsOf: '', observedAt }));
    }
    for (const apr of Array.isArray(liability.aprs) ? liability.aprs : []) {
      const factType = APR_TYPES[String(apr?.apr_type || '').toLowerCase()] || 'DISCLOSED_APR';
      numericFact(facts, factType, apr?.apr_percentage, 'PERCENT',
        'CREDIT_APR_COMPONENT_PERCENTAGE', '', observedAt);
      const latest = facts[facts.length - 1];
      if (latest && latest.factType === factType) {
        latest.component = {
          aprType: text(apr?.apr_type, 60),
          balanceSubjectToApr: number(apr?.balance_subject_to_apr),
          interestChargeAmount: number(apr?.interest_charge_amount)
        };
      }
    }
    output.push({
      protectedAccountKey: protectedKey(identitySecret, config.environment,
        `${config.providerProfile}|ACCOUNT`, rawAccountId),
      displayName: text(account?.name, 120),
      officialName: text(account?.official_name, 160),
      type: text(account?.type, 40),
      subtype: text(account?.subtype, 60),
      mask: text(account?.mask, 8),
      observedAt,
      facts
    });
  }
  return output;
}

export function normalizePlaidDepositoryAccounts({ response, identitySecret, config, protectedKey, observedAt }) {
  const accounts = Array.isArray(response?.accounts) ? response.accounts : [];
  const output = [];
  for (const account of accounts) {
    if (String(account?.type || '').toLowerCase() !== 'depository') continue;
    const rawAccountId = String(account?.account_id || '');
    if (!rawAccountId) continue;
    const currency = text(account?.balances?.iso_currency_code || account?.balances?.unofficial_currency_code, 12);
    const effectiveAsOf = dateTime(account?.balances?.last_updated_datetime);
    const facts = [];
    numericFact(facts, 'CURRENT_BALANCE', account?.balances?.current, currency,
      'ACCOUNT_CURRENT_BALANCE', effectiveAsOf, observedAt);
    numericFact(facts, 'AVAILABLE_BALANCE', account?.balances?.available, currency,
      'ACCOUNT_AVAILABLE_BALANCE', effectiveAsOf, observedAt);
    output.push({
      protectedAccountKey: protectedKey(identitySecret, config.environment,
        `${config.providerProfile}|ACCOUNT`, rawAccountId),
      displayName: text(account?.name, 120), officialName: text(account?.official_name, 160),
      type: text(account?.type, 40), subtype: text(account?.subtype, 60),
      mask: text(account?.mask, 8), observedAt, facts
    });
  }
  return output;
}

export function normalizePlaidMortgageAccounts({ response, identitySecret, config, protectedKey, observedAt }) {
  const accounts = Array.isArray(response?.accounts) ? response.accounts : [];
  const output = [];
  for (const account of accounts) {
    if (String(account?.type || '').toLowerCase() !== 'loan' ||
        String(account?.subtype || '').toLowerCase() !== 'mortgage') continue;
    const rawAccountId = String(account?.account_id || '');
    if (!rawAccountId) continue;
    const currency = text(account?.balances?.iso_currency_code || account?.balances?.unofficial_currency_code, 12);
    const effectiveAsOf = dateTime(account?.balances?.last_updated_datetime);
    const facts = [];
    numericFact(facts, 'CURRENT_BALANCE', account?.balances?.current, currency,
      'ACCOUNT_CURRENT_BALANCE', effectiveAsOf, observedAt);
    output.push({
      protectedAccountKey: protectedKey(identitySecret, config.environment,
        `${config.providerProfile}|ACCOUNT`, rawAccountId),
      displayName: text(account?.name, 120), officialName: text(account?.official_name, 160),
      type: text(account?.type, 40), subtype: text(account?.subtype, 60),
      mask: text(account?.mask, 8), observedAt, facts
    });
  }
  return output;
}

export function normalizePlaidMixedAccounts({ accountsResponse, liabilitiesResponse,
  identitySecret, config, protectedKey, observedAt }) {
  const accounts = Array.isArray(accountsResponse?.accounts) ? accountsResponse.accounts : [];
  const depository = normalizePlaidDepositoryAccounts({ response: accountsResponse,
    identitySecret, config, protectedKey, observedAt });
  const mortgage = normalizePlaidMortgageAccounts({ response: accountsResponse,
    identitySecret, config, protectedKey, observedAt });
  const credit = normalizePlaidCreditLiabilities({ response: {
    accounts,
    liabilities: liabilitiesResponse?.liabilities || {}
  }, identitySecret, config, protectedKey, observedAt });
  const supportedKeys = new Set([...depository, ...credit, ...mortgage]
    .map(account => account.protectedAccountKey));
  const unsupported = accounts.flatMap(account => {
    const rawAccountId = String(account?.account_id || '');
    if (!rawAccountId) return [];
    const accountKey = protectedKey(identitySecret, config.environment,
      `${config.providerProfile}|ACCOUNT`, rawAccountId);
    if (supportedKeys.has(accountKey)) return [];
    return [{ protectedAccountKey: accountKey, displayName: text(account?.name, 120),
      officialName: text(account?.official_name, 160), type: text(account?.type, 40),
      subtype: text(account?.subtype, 60), mask: text(account?.mask, 8), observedAt,
      unsupported: true, facts: [] }];
  });
  const byKey = new Map([...depository, ...credit, ...mortgage, ...unsupported]
    .map(account => [account.protectedAccountKey, account]));
  return accounts.map(account => byKey.get(protectedKey(identitySecret, config.environment,
    `${config.providerProfile}|ACCOUNT`, String(account.account_id || '')))).filter(Boolean);
}

function sameValue(fact, existing) {
  if (!fact || !existing) return false;
  if (fact.valueKind === 'NUMERIC') return Number(fact.numericValue) === Number(existing.value);
  return String(fact.textValue) === String(existing.value);
}

function difference(fact, existing) {
  if (!fact || !existing || fact.valueKind !== 'NUMERIC') return null;
  const value = Number(existing.value);
  return Number.isFinite(value) ? Math.round((fact.numericValue - value) * 10000) / 10000 : null;
}

function stale(fact, observedMs) {
  if (!fact?.providerEffectiveAsOf) return false;
  const effectiveMs = Date.parse(fact.providerEffectiveAsOf);
  if (!Number.isFinite(effectiveMs)) return false;
  const ageDays = Math.floor((observedMs - effectiveMs) / 86400000);
  const moderate = ['STATEMENT_BALANCE', 'STATEMENT_DATE', 'MINIMUM_PAYMENT',
    'NEXT_PAYMENT_DATE'].includes(fact.factType) || fact.factType.includes('APR');
  return ageDays > (moderate ? 120 : 14);
}

export function buildReadOnlyPreview({ accounts, existingFacts = {}, observedAt, environment,
  comparisonExplicit = false }) {
  const observedMs = Date.parse(observedAt);
  return accounts.map(account => {
    if (account.unsupported) {
      return { ...account, facts: undefined, rows: [{ factType: 'ACCOUNT_TYPE_SUPPORT',
        existingValue: null, candidate: null, effectiveAsOf: '', observedAt,
        status: 'SEMANTIC_REVIEW_REQUIRED', reason: 'UNSUPPORTED_ACCOUNT_TYPE',
        difference: null, materiality: 'NOT_EVALUATED', safeToOfferForApproval: false }] };
    }
    const groups = new Map();
    for (const fact of account.facts) {
      if (!groups.has(fact.factType)) groups.set(fact.factType, []);
      groups.get(fact.factType).push(fact);
    }
    const aprTypes = [...groups.keys()].filter(key => key.includes('APR'));
    const accountType = String(account.type || '').toLowerCase();
    const accountSubtype = String(account.subtype || '').toLowerCase();
    const expected = accountType === 'depository' ? DEPOSITORY_FACTS :
      accountType === 'loan' && accountSubtype === 'mortgage' ? MORTGAGE_FACTS : EXPECTED_FACTS;
    const factTypes = [...expected, ...aprTypes];
    const rows = [];
    if (String(account.type || '').toLowerCase() === 'credit' && !aprTypes.length) {
      rows.push({ factType: 'APR_COMPONENT_EVIDENCE', existingValue: null, candidate: null,
        effectiveAsOf: '', observedAt, status: 'PLAID_MISSING',
        reason: 'PROVIDER_APR_COMPONENTS_MISSING', difference: null,
        materiality: 'NOT_EVALUATED', safeToOfferForApproval: false });
    }
    for (const factType of [...new Set(factTypes)]) {
      const candidates = groups.get(factType) || [];
      const existing = Object.hasOwn(existingFacts, factType) ? existingFacts[factType] : null;
      if (!candidates.length) {
        rows.push({ factType, existingValue: existing?.value ?? null, candidate: null,
          effectiveAsOf: '', observedAt, status: 'PLAID_MISSING', reason: 'PROVIDER_FIELD_MISSING',
          difference: null, materiality: 'NOT_EVALUATED', safeToOfferForApproval: false });
        continue;
      }
      for (const fact of candidates) {
        let status;
        if (!comparisonExplicit) status = 'SEMANTIC_REVIEW_REQUIRED';
        else if (fact.reviewRequired) status = 'SEMANTIC_REVIEW_REQUIRED';
        else if (stale(fact, observedMs)) status = 'STALE';
        else if (!existing) status = 'EXISTING_MISSING';
        else status = sameValue(fact, existing) ? 'MATCH' : 'DIFFERENT';
        rows.push({ factType, existingValue: existing?.value ?? null, candidate: fact,
          effectiveAsOf: fact.providerEffectiveAsOf, observedAt: fact.observedAt,
          status, reason: !comparisonExplicit ? 'EXPLICIT_ACCOUNT_MAPPING_REQUIRED' :
            fact.reviewRequired ? 'APR_COMPONENT_NOT_CANONICAL_APR' :
            !fact.providerEffectiveAsOf ? 'PROVIDER_EFFECTIVE_TIME_MISSING' : '',
          difference: difference(fact, existing),
          materiality: status === 'DIFFERENT' ? 'REVIEW_REQUIRED' : 'NOT_EVALUATED',
          safeToOfferForApproval: !fact.reviewRequired && fact.semanticClass === 'FINANCIAL_FACT' &&
            !!fact.providerEffectiveAsOf });
      }
    }
    return { ...account, facts: undefined, rows };
  });
}
