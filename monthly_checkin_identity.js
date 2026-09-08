/**
 * Monthly Financial Check-In durable account identity resolver.
 *
 * Read-only. Resolves canonical review keys from the financial identity registry
 * or, for investments only, an immutable Investment Id lifecycle value.
 * Never writes workbook data and never uses sheet row numbers in review keys.
 */

var MONTHLY_CHECKIN_IDENTITY_VERSION_ = 'v1';

var MONTHLY_CHECKIN_DOMAIN_CONFIG_ = {
  bank: {
    canonicalDomain: 'bank',
    registryDomains: ['CASH'],
    legacyDomain: 'SYS_ACCOUNTS'
  },
  house: {
    canonicalDomain: 'house',
    registryDomains: ['PROPERTY'],
    legacyDomain: 'SYS_HOUSE_ASSETS'
  },
  debt: {
    canonicalDomain: 'debt',
    registryDomains: ['DEBT'],
    legacyDomain: 'INPUT_DEBTS'
  },
  investment: {
    canonicalDomain: 'investment',
    registryDomains: ['INVESTMENT', 'RETIREMENT'],
    legacyDomain: 'SYS_ASSETS'
  }
};

function monthlyCheckinNormalizeDomain_(value) {
  var key = String(value || '').trim().toLowerCase();
  if (key === 'bank' || key === 'banks' || key === 'cash') return 'bank';
  if (key === 'house' || key === 'houses' || key === 'property') return 'house';
  if (key === 'debt' || key === 'debts') return 'debt';
  if (key === 'investment' || key === 'investments' || key === 'retirement') return 'investment';
  return '';
}

function monthlyCheckinBuildRegistryIndex_(registry) {
  var accounts = (registry && registry.accounts) ? registry.accounts.slice() : [];
  var byStableId = Object.create(null);
  var byLegacy = Object.create(null);
  var stableIdCounts = Object.create(null);
  var legacyCounts = Object.create(null);
  var investmentLifecycleCounts = Object.create(null);

  accounts.forEach(function(account) {
    var stableAccountId = String(account.stableAccountId || '').trim();
    if (stableAccountId) {
      byStableId[stableAccountId] = account;
      stableIdCounts[stableAccountId] = Number(stableIdCounts[stableAccountId] || 0) + 1;
    }
    var legacyDomain = String(account.legacyDomain || '').trim();
    var legacyKey = String(account.legacyKey || '').trim();
    if (!legacyDomain || !legacyKey) return;
    var composite = legacyDomain + '::' + legacyKey;
    if (!byLegacy[composite]) byLegacy[composite] = [];
    byLegacy[composite].push(account);
    legacyCounts[composite] = Number(legacyCounts[composite] || 0) + 1;
    if (legacyDomain === 'SYS_ASSETS') {
      investmentLifecycleCounts[legacyKey] =
        Number(investmentLifecycleCounts[legacyKey] || 0) + 1;
    }
  });

  return {
    accounts: accounts,
    byStableId: byStableId,
    byLegacy: byLegacy,
    stableIdCounts: stableIdCounts,
    legacyCounts: legacyCounts,
    investmentLifecycleCounts: investmentLifecycleCounts
  };
}

function monthlyCheckinReadRegistryIndex_(ss) {
  if (!ss || typeof financialIdentityReadRegistry_ !== 'function') {
    return monthlyCheckinBuildRegistryIndex_({ accounts: [] });
  }
  return monthlyCheckinBuildRegistryIndex_(financialIdentityReadRegistry_(ss));
}

function monthlyCheckinRegistryAccountEligible_(domainKey, account) {
  if (!account) return false;
  if (String(account.identityStatus || '').trim().toUpperCase() === 'CONFLICT') return false;
  if (!String(account.stableAccountId || '').trim()) return false;
  var config = MONTHLY_CHECKIN_DOMAIN_CONFIG_[domainKey];
  if (!config) return false;
  var registryDomain = String(account.domain || '').trim().toUpperCase();
  return config.registryDomains.indexOf(registryDomain) !== -1;
}

function monthlyCheckinFormatAccountKey_(domainKey, stableComponent) {
  return domainKey + ':' + MONTHLY_CHECKIN_IDENTITY_VERSION_ + ':' +
    String(stableComponent || '').trim();
}

function monthlyCheckinIdentityResolved_(domainKey, stableComponent, displayName, identitySource) {
  return {
    ok: true,
    code: 'RESOLVED',
    domain: domainKey,
    accountKey: monthlyCheckinFormatAccountKey_(domainKey, stableComponent),
    stableAccountId: String(stableComponent || '').trim(),
    displayName: String(displayName || '').trim(),
    identitySource: identitySource || 'REGISTRY_STABLE_ACCOUNT_ID'
  };
}

function monthlyCheckinIdentityUnresolved_(code, message, details) {
  return {
    ok: false,
    code: code || 'IDENTITY_UNRESOLVED',
    message: message || 'Account identity could not be resolved.',
    details: details || {}
  };
}

function monthlyCheckinLegacyKeyFromInput_(domainKey, input) {
  var payload = input || {};
  if (domainKey === 'bank' || domainKey === 'debt') {
    return String(payload.accountName || '').trim();
  }
  if (domainKey === 'house') {
    return String(payload.houseName || '').trim();
  }
  if (domainKey === 'investment') {
    return String(payload.investmentId || '').trim();
  }
  return '';
}

function monthlyCheckinResolveByStableAccountId_(domainKey, stableAccountId, index, input) {
  if (Number(index.stableIdCounts[stableAccountId] || 0) > 1) {
    return monthlyCheckinIdentityUnresolved_('DUPLICATE_STABLE_ACCOUNT_ID',
      'Multiple registry rows share the same stable account id.', { stableAccountId: stableAccountId });
  }
  var account = index.byStableId[stableAccountId];
  if (!monthlyCheckinRegistryAccountEligible_(domainKey, account)) {
    return monthlyCheckinIdentityUnresolved_('IDENTITY_UNRESOLVED',
      'No registry stable account id matches this monthly check-in domain.', {
        stableAccountId: stableAccountId, domain: domainKey
      });
  }
  return monthlyCheckinIdentityResolved_(domainKey, stableAccountId,
    (input && input.displayName) || account.displayName, 'REGISTRY_STABLE_ACCOUNT_ID');
}

function monthlyCheckinInvestmentLifecycleCounts_(index, input) {
  var counts = Object.create(null);
  var registryCounts = (index && index.investmentLifecycleCounts) || Object.create(null);
  Object.keys(registryCounts).forEach(function(key) {
    counts[key] = Number(registryCounts[key] || 0);
  });
  var sheetCounts = (input && input.investmentLifecycleCounts) || Object.create(null);
  Object.keys(sheetCounts).forEach(function(key) {
    counts[key] = Number(sheetCounts[key] || 0);
  });
  return counts;
}

function monthlyCheckinResolveOrphanInvestmentId_(investmentId, index, input) {
  var lifecycleCounts = monthlyCheckinInvestmentLifecycleCounts_(index, input);
  var lifecycleCount = Number(lifecycleCounts[investmentId] || 0);
  if (lifecycleCount > 1) {
    return monthlyCheckinIdentityUnresolved_('DUPLICATE_LEGACY_IDENTITY',
      'Multiple records share the same Investment Id.', { investmentId: investmentId });
  }
  if (lifecycleCount !== 1) {
    return monthlyCheckinIdentityUnresolved_('IDENTITY_UNRESOLVED',
      'Investment Id requires a unique registry or sheet lifecycle identity.', {
        investmentId: investmentId
      });
  }
  return monthlyCheckinIdentityResolved_('investment', investmentId,
    input && input.displayName, 'INVESTMENT_LIFECYCLE_ID');
}

function monthlyCheckinResolveByLegacyKey_(domainKey, legacyKey, index, input) {
  if (!legacyKey) {
    return monthlyCheckinIdentityUnresolved_('IDENTITY_UNRESOLVED',
      domainKey === 'investment'
        ? 'Investment Id is required to resolve investment identity.'
        : 'Registry legacy identity key is missing.');
  }
  var config = MONTHLY_CHECKIN_DOMAIN_CONFIG_[domainKey];
  var composite = config.legacyDomain + '::' + legacyKey;
  var matches = (index.byLegacy[composite] || []).filter(function(account) {
    return monthlyCheckinRegistryAccountEligible_(domainKey, account);
  });
  if (matches.length > 1 || Number(index.legacyCounts[composite] || 0) > 1) {
    return monthlyCheckinIdentityUnresolved_('DUPLICATE_LEGACY_IDENTITY',
      'Multiple registry rows share the same legacy identity key.', {
        legacyDomain: config.legacyDomain, legacyKey: legacyKey
      });
  }
  if (!matches.length) {
    if (domainKey === 'investment') {
      return monthlyCheckinResolveOrphanInvestmentId_(legacyKey, index, input);
    }
    return monthlyCheckinIdentityUnresolved_('IDENTITY_UNRESOLVED',
      'No registry row matches the legacy identity for this account.', {
        legacyDomain: config.legacyDomain, legacyKey: legacyKey
      });
  }
  return monthlyCheckinIdentityResolved_(domainKey, matches[0].stableAccountId,
    (input && input.displayName) || matches[0].displayName, 'REGISTRY_LEGACY_KEY');
}

/**
 * Resolve a canonical monthly check-in account key.
 *
 * Input:
 *   domain: bank | house | investment | debt
 *   stableAccountId?: registry stable id (preferred)
 *   accountName?: legacy lookup for bank/debt only
 *   houseName?: legacy lookup for house only
 *   investmentId?: legacy lookup / lifecycle id for investment only
 *   displayName?: optional UI label; never used as identity
 *   registry?: optional { accounts: [...] }
 *   registryIndex?: optional prebuilt index
 *   investmentLifecycleCounts?: optional { [investmentId]: count } from SYS - Assets
 */
function monthlyCheckinResolveAccountKey_(input) {
  var payload = input || {};
  var domainKey = monthlyCheckinNormalizeDomain_(payload.domain);
  if (!domainKey) {
    return monthlyCheckinIdentityUnresolved_('INVALID_DOMAIN', 'Unknown monthly check-in domain.');
  }
  var index = payload.registryIndex || monthlyCheckinBuildRegistryIndex_(payload.registry || { accounts: [] });
  var stableAccountId = String(payload.stableAccountId || '').trim();
  if (stableAccountId) {
    return monthlyCheckinResolveByStableAccountId_(domainKey, stableAccountId, index, payload);
  }
  return monthlyCheckinResolveByLegacyKey_(domainKey,
    monthlyCheckinLegacyKeyFromInput_(domainKey, payload), index, payload);
}
