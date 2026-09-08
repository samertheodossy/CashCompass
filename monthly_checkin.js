/**
 * Monthly Financial Check-In pure state model.
 *
 * Read-only, in-memory helpers for cycle state normalization, reviewed-key
 * intersection, and derived domain/cycle status. No workbook access, Settings
 * I/O, RPC endpoints, or persistence writes.
 */

var MONTHLY_CHECKIN_STATE_VERSION_ = 1;
var MONTHLY_CHECKIN_CYCLE_KEY_PATTERN_ = /^\d{4}-(0[1-9]|1[0-2])$/;
var MONTHLY_CHECKIN_STATE_DOMAINS_ = ['bank', 'houses', 'investments', 'debts'];
var MONTHLY_CHECKIN_MONTH_VALUE_DOMAINS_ = ['bank', 'houses', 'investments'];
var MONTHLY_CHECKIN_DEBT_ACK_DOMAIN_ = 'debts';
var MONTHLY_CHECKIN_DOMAIN_NAV_ = {
  bank: { page: 'assets', tab: 'bank', label: 'Bank accounts' },
  houses: { page: 'assets', tab: 'houses', label: 'Houses' },
  investments: { page: 'assets', tab: 'investments', label: 'Investments' },
  debts: { page: 'assets', tab: 'debts', label: 'Debts' }
};
var MONTHLY_CHECKIN_ACCOUNT_KEY_PATTERN_ = /^(bank|house|investment|debt):v1:[^:\s]+$/;
var MONTHLY_CHECKIN_ACCOUNT_KEY_PREFIX_BY_STATE_DOMAIN_ = {
  bank: 'bank:v1:',
  houses: 'house:v1:',
  investments: 'investment:v1:',
  debts: 'debt:v1:'
};

function monthlyCheckinValidateCycleKey_(cycleKey) {
  return MONTHLY_CHECKIN_CYCLE_KEY_PATTERN_.test(String(cycleKey || '').trim());
}

function monthlyCheckinSettingsKey_(cycleKey) {
  return 'monthly_checkin.v1.' + String(cycleKey || '').trim();
}

function monthlyCheckinDefaultState_(cycleKey) {
  var key = String(cycleKey || '').trim();
  if (!monthlyCheckinValidateCycleKey_(key)) {
    throw new Error('monthlyCheckinDefaultState_ requires a valid YYYY-MM cycle key.');
  }
  return {
    version: MONTHLY_CHECKIN_STATE_VERSION_,
    cycleKey: key,
    revision: 0,
    updatedAt: null,
    domains: {
      bank: { reviewedKeys: [] },
      houses: { reviewedKeys: [] },
      investments: { reviewedKeys: [] },
      debts: { reviewedKeys: [] }
    }
  };
}

function monthlyCheckinNormalizeStateDomainKey_(value) {
  var key = String(value || '').trim().toLowerCase();
  if (key === 'bank' || key === 'banks' || key === 'cash') return 'bank';
  if (key === 'house' || key === 'houses' || key === 'property') return 'houses';
  if (key === 'investment' || key === 'investments' || key === 'retirement') return 'investments';
  if (key === 'debt' || key === 'debts') return 'debts';
  return '';
}

function monthlyCheckinIsValidAccountKey_(accountKey) {
  var normalized = String(accountKey || '').trim();
  if (!MONTHLY_CHECKIN_ACCOUNT_KEY_PATTERN_.test(normalized)) return false;
  var parts = normalized.split(':');
  var stableComponent = parts.length >= 3 ? parts[2] : '';
  if (/^\d+$/.test(stableComponent)) return false;
  return true;
}

function monthlyCheckinNormalizeAccountKeyList_(keys, stateDomainKey) {
  var prefix = MONTHLY_CHECKIN_ACCOUNT_KEY_PREFIX_BY_STATE_DOMAIN_[stateDomainKey] || '';
  var seen = Object.create(null);
  var out = [];
  (keys || []).forEach(function(key) {
    var normalized = String(key || '').trim();
    if (!normalized || seen[normalized]) return;
    if (!monthlyCheckinIsValidAccountKey_(normalized)) return;
    if (prefix && normalized.indexOf(prefix) !== 0) return;
    seen[normalized] = true;
    out.push(normalized);
  });
  out.sort();
  return out;
}

function monthlyCheckinIsMonthValueDomain_(stateDomainKey) {
  return MONTHLY_CHECKIN_MONTH_VALUE_DOMAINS_.indexOf(stateDomainKey) !== -1;
}

function monthlyCheckinIsDebtAckDomain_(stateDomainKey) {
  return stateDomainKey === MONTHLY_CHECKIN_DEBT_ACK_DOMAIN_;
}

function monthlyCheckinNormalizeInvestmentMonthEntries_(entries) {
  var seenByKey = Object.create(null);
  var seenByName = Object.create(null);
  var out = [];
  (entries || []).forEach(function(entry) {
    if (!entry || typeof entry !== 'object') return;
    var displayName = String(entry.displayName || '').trim();
    var accountKey = String(entry.accountKey || '').trim();
    if (!displayName && !accountKey) return;
    var hasCurrentMonthValue = !!entry.hasCurrentMonthValue;
    if (accountKey && monthlyCheckinIsValidAccountKey_(accountKey) &&
        accountKey.indexOf('investment:v1:') === 0) {
      if (seenByKey[accountKey]) return;
      seenByKey[accountKey] = true;
      out.push({
        accountKey: accountKey,
        displayName: displayName,
        hasCurrentMonthValue: hasCurrentMonthValue,
        currentMonthValue: hasCurrentMonthValue ? entry.currentMonthValue : null
      });
      return;
    }
    if (!displayName) return;
    var nameKey = displayName.toLowerCase();
    if (seenByName[nameKey]) return;
    seenByName[nameKey] = true;
    out.push({
      accountKey: '',
      displayName: displayName,
      hasCurrentMonthValue: hasCurrentMonthValue,
      currentMonthValue: hasCurrentMonthValue ? entry.currentMonthValue : null
    });
  });
  out.sort(function(a, b) {
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
      sensitivity: 'base'
    });
  });
  return out;
}

function monthlyCheckinNormalizeMonthValueActiveEntries_(entries, stateDomainKey) {
  if (stateDomainKey === 'investments') {
    return monthlyCheckinNormalizeInvestmentMonthEntries_(entries);
  }
  var prefix = MONTHLY_CHECKIN_ACCOUNT_KEY_PREFIX_BY_STATE_DOMAIN_[stateDomainKey] || '';
  var seen = Object.create(null);
  var out = [];
  (entries || []).forEach(function(entry) {
    var accountKey = '';
    var hasCurrentMonthValue = false;
    if (typeof entry === 'string') {
      accountKey = entry;
    } else if (entry && entry.accountKey) {
      accountKey = entry.accountKey;
      hasCurrentMonthValue = !!entry.hasCurrentMonthValue;
    }
    var normalized = String(accountKey || '').trim();
    if (!normalized || seen[normalized]) return;
    if (!monthlyCheckinIsValidAccountKey_(normalized)) return;
    if (prefix && normalized.indexOf(prefix) !== 0) return;
    seen[normalized] = true;
    out.push({
      accountKey: normalized,
      displayName: typeof entry === 'object' && entry ? String(entry.displayName || '').trim() : '',
      hasCurrentMonthValue: hasCurrentMonthValue,
      currentMonthValue: typeof entry === 'object' && entry && entry.hasCurrentMonthValue
        ? entry.currentMonthValue
        : null
    });
  });
  out.sort(function(a, b) {
    return a.accountKey.localeCompare(b.accountKey);
  });
  return out;
}

function monthlyCheckinNormalizeActiveEntries_(entries, stateDomainKey) {
  if (monthlyCheckinIsMonthValueDomain_(stateDomainKey)) {
    return monthlyCheckinNormalizeMonthValueActiveEntries_(entries, stateDomainKey);
  }
  var keys = [];
  (entries || []).forEach(function(entry) {
    if (typeof entry === 'string') {
      keys.push(entry);
      return;
    }
    if (entry && entry.accountKey) keys.push(entry.accountKey);
  });
  return monthlyCheckinNormalizeAccountKeyList_(keys, stateDomainKey);
}

function monthlyCheckinIntersectReviewedKeys_(reviewedKeys, activeKeys) {
  var activeSet = Object.create(null);
  monthlyCheckinNormalizeAccountKeyList_(activeKeys).forEach(function(key) {
    activeSet[key] = true;
  });
  var seen = Object.create(null);
  var out = [];
  (reviewedKeys || []).forEach(function(key) {
    var normalized = String(key || '').trim();
    if (!normalized || seen[normalized] || !activeSet[normalized]) return;
    if (!monthlyCheckinIsValidAccountKey_(normalized)) return;
    seen[normalized] = true;
    out.push(normalized);
  });
  out.sort();
  return out;
}

function monthlyCheckinNormalizeReviewedKeys_(reviewedKeys, stateDomainKey) {
  return monthlyCheckinNormalizeAccountKeyList_(reviewedKeys, stateDomainKey);
}

function monthlyCheckinDeriveMonthValueDomainStatus_(activeEntries, identityIssueCount) {
  var entries = Array.isArray(activeEntries) ? activeEntries : [];
  var activeCount = entries.length;
  var currentMonthValueCount = entries.filter(function(entry) {
    return !!entry.hasCurrentMonthValue;
  }).length;
  var missingCurrentMonthValueCount = Math.max(0, activeCount - currentMonthValueCount);
  var unresolvedCount = Math.max(0, Number(identityIssueCount || 0));
  var base = {
    activeCount: activeCount,
    currentMonthValueCount: currentMonthValueCount,
    missingCurrentMonthValueCount: missingCurrentMonthValueCount,
    unresolvedCount: unresolvedCount,
    identityIssueCount: unresolvedCount
  };

  if (activeCount === 0 && unresolvedCount === 0) {
    return Object.assign({ status: 'COMPLETE' }, base);
  }
  if (unresolvedCount > 0) {
    return Object.assign({ status: 'IN_PROGRESS' }, base);
  }
  if (activeCount === 0) {
    return Object.assign({ status: 'COMPLETE' }, base);
  }
  if (currentMonthValueCount === 0) {
    return Object.assign({ status: 'NOT_STARTED' }, base);
  }
  if (missingCurrentMonthValueCount > 0) {
    return Object.assign({ status: 'IN_PROGRESS' }, base);
  }
  return Object.assign({ status: 'COMPLETE' }, base);
}

function monthlyCheckinDeriveDebtAckDomainStatus_(debtEntries, identityIssueCount) {
  var unresolvedCount = Math.max(0, Number(identityIssueCount || 0));
  var entries = Array.isArray(debtEntries) ? debtEntries : [];
  var activeCount = entries.length;
  var currentCount = entries.filter(function(entry) { return !!entry.currentForCycle; }).length;
  var needsUpdateCount = Math.max(0, activeCount - currentCount);
  var base = {
    activeCount: activeCount,
    currentCount: currentCount,
    needsUpdateCount: needsUpdateCount,
    reviewedCount: currentCount,
    unreviewedCount: needsUpdateCount,
    unresolvedCount: unresolvedCount,
    identityIssueCount: unresolvedCount
  };

  if (activeCount === 0 && unresolvedCount === 0) {
    return Object.assign({ status: 'COMPLETE' }, base);
  }
  if (unresolvedCount > 0) {
    return Object.assign({ status: 'IN_PROGRESS' }, base);
  }
  if (activeCount === 0) {
    return Object.assign({ status: 'COMPLETE' }, base);
  }
  if (currentCount === 0) {
    return Object.assign({ status: 'NOT_STARTED' }, base);
  }
  if (currentCount === activeCount) {
    return Object.assign({ status: 'COMPLETE', needsUpdateCount: 0, unreviewedCount: 0 }, base);
  }
  return Object.assign({ status: 'IN_PROGRESS' }, base);
}

function monthlyCheckinDeriveOverallStatus_(domainStatuses) {
  var statuses = MONTHLY_CHECKIN_STATE_DOMAINS_.map(function(domainKey) {
    var row = domainStatuses[domainKey] || {};
    return String(row.status || 'NOT_STARTED').toUpperCase();
  });
  if (statuses.every(function(status) { return status === 'COMPLETE'; })) return 'COMPLETE';
  if (statuses.every(function(status) { return status === 'NOT_STARTED'; })) return 'NOT_STARTED';
  return 'IN_PROGRESS';
}

function monthlyCheckinNormalizeStoredState_(parsed, expectedCycleKey) {
  var expected = String(expectedCycleKey || '').trim();
  var fallback = monthlyCheckinValidateCycleKey_(expected)
    ? monthlyCheckinDefaultState_(expected)
    : null;
  if (!fallback) {
    return { ok: false, state: null, reason: 'INVALID_EXPECTED_CYCLE' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, state: fallback, reason: 'MALFORMED' };
  }
  if (Number(parsed.version) !== MONTHLY_CHECKIN_STATE_VERSION_) {
    return { ok: false, state: fallback, reason: 'UNSUPPORTED_VERSION' };
  }
  if (String(parsed.cycleKey || '').trim() !== expected) {
    return { ok: false, state: fallback, reason: 'CYCLE_MISMATCH' };
  }

  var normalized = monthlyCheckinDefaultState_(expected);
  normalized.revision = Number.isFinite(Number(parsed.revision)) && Number(parsed.revision) >= 0
    ? Math.floor(Number(parsed.revision))
    : 0;
  normalized.updatedAt = parsed.updatedAt === null || parsed.updatedAt === undefined
    ? null
    : String(parsed.updatedAt);

  var sourceDomains = parsed.domains && typeof parsed.domains === 'object' && !Array.isArray(parsed.domains)
    ? parsed.domains
    : {};
  MONTHLY_CHECKIN_STATE_DOMAINS_.forEach(function(domainKey) {
    var domain = sourceDomains[domainKey];
    var reviewedKeys = domain && Array.isArray(domain.reviewedKeys) ? domain.reviewedKeys : [];
    normalized.domains[domainKey] = {
      reviewedKeys: monthlyCheckinNormalizeReviewedKeys_(reviewedKeys, domainKey)
    };
  });

  return { ok: true, state: normalized, reason: '' };
}

function monthlyCheckinParseStoredState_(raw, expectedCycleKey) {
  var expected = String(expectedCycleKey || '').trim();
  var fallbackResult = monthlyCheckinNormalizeStoredState_(null, expected);
  if (!monthlyCheckinValidateCycleKey_(expected)) {
    return { ok: false, state: fallbackResult.state, reason: 'INVALID_EXPECTED_CYCLE' };
  }
  if (raw === null || raw === undefined || raw === '') {
    return { ok: false, state: monthlyCheckinDefaultState_(expected), reason: 'MISSING' };
  }
  try {
    var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return monthlyCheckinNormalizeStoredState_(parsed, expected);
  } catch (_parseErr) {
    return { ok: false, state: monthlyCheckinDefaultState_(expected), reason: 'MALFORMED' };
  }
}

function monthlyCheckinSerializeState_(state) {
  var normalized = monthlyCheckinNormalizeStoredState_(state, state && state.cycleKey);
  if (!normalized.ok || !normalized.state) {
    throw new Error('monthlyCheckinSerializeState_ requires a valid in-memory state object.');
  }
  return JSON.stringify(normalized.state);
}

function monthlyCheckinBuildDomainProjection_(stateDomainKey, state, activeEntries, identityIssues) {
  var domainState = (state && state.domains && state.domains[stateDomainKey]) || { reviewedKeys: [] };
  var issues = Array.isArray(identityIssues) ? identityIssues.slice() : [];
  var identityIssueCount = issues.length;

  if (monthlyCheckinIsMonthValueDomain_(stateDomainKey)) {
    var monthEntries = monthlyCheckinNormalizeMonthValueActiveEntries_(activeEntries, stateDomainKey);
    var monthCounts = monthlyCheckinDeriveMonthValueDomainStatus_(monthEntries, identityIssueCount);
    var monthRecords = monthEntries.map(function(entry) {
      return {
        accountKey: entry.accountKey,
        displayName: String(entry.displayName || '').trim(),
        hasCurrentMonthValue: !!entry.hasCurrentMonthValue,
        needsCurrentMonthValue: !entry.hasCurrentMonthValue,
        currentMonthValue: entry.hasCurrentMonthValue ? entry.currentMonthValue : null
      };
    });
    issues.forEach(function(issue) {
      monthRecords.push({
        accountKey: '',
        displayName: issue && issue.displayName ? String(issue.displayName) : '',
        hasCurrentMonthValue: false,
        needsCurrentMonthValue: false,
        identityIssue: issue || { code: 'IDENTITY_UNRESOLVED' }
      });
    });
    return {
      domain: stateDomainKey,
      domainKind: 'month_value',
      activeRecords: monthRecords,
      activeCount: monthCounts.activeCount,
      currentMonthValueCount: monthCounts.currentMonthValueCount,
      missingCurrentMonthValueCount: monthCounts.missingCurrentMonthValueCount,
      unresolvedCount: monthCounts.unresolvedCount,
      identityIssueCount: monthCounts.identityIssueCount,
      identityIssues: issues,
      status: monthCounts.status
    };
  }

  var debtEntries = monthlyCheckinNormalizeDebtActiveEntries_(
    activeEntries, state && state.cycleKey);
  var debtCounts = monthlyCheckinDeriveDebtAckDomainStatus_(debtEntries, identityIssueCount);
  var debtRecords = debtEntries.map(function(entry) {
    return {
      accountKey: entry.accountKey,
      displayName: entry.displayName,
      accountBalance: entry.accountBalance,
      type: entry.type,
      dueDate: entry.dueDate,
      minimumPayment: entry.minimumPayment,
      lastUpdated: entry.lastUpdated,
      currentForCycle: entry.currentForCycle
    };
  });
  issues.forEach(function(issue) {
    debtRecords.push({
      accountKey: '',
      displayName: issue && issue.displayName ? String(issue.displayName) : '',
      currentForCycle: false,
      identityIssue: issue || { code: 'IDENTITY_UNRESOLVED' }
    });
  });

  return {
    domain: stateDomainKey,
    domainKind: 'debt_acknowledgement',
    activeRecords: debtRecords,
    activeCount: debtCounts.activeCount,
    currentCount: debtCounts.currentCount,
    needsUpdateCount: debtCounts.needsUpdateCount,
    reviewedCount: debtCounts.reviewedCount,
    unreviewedCount: debtCounts.unreviewedCount,
    unresolvedCount: debtCounts.unresolvedCount,
    identityIssueCount: debtCounts.identityIssueCount,
    identityIssues: issues,
    status: debtCounts.status
  };
}

function monthlyCheckinMonthNameFromCycleKey_(cycleKey) {
  var parts = String(cycleKey || '').trim().split('-');
  if (parts.length !== 2) return '';
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  if (!year || !month) return '';
  var date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function monthlyCheckinMissingMonthReason_(cycleKey) {
  var monthName = monthlyCheckinMonthNameFromCycleKey_(cycleKey);
  return monthName ? ('Missing ' + monthName + ' value') : 'Missing current-month value';
}

function monthlyCheckinDebtNeedsUpdateReason_() {
  return 'Needs current-cycle update';
}

function monthlyCheckinDebtCycleKeyFromIsoDate_(isoDateOnly) {
  var parts = String(isoDateOnly || '').trim().split('-');
  if (parts.length < 2) return '';
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  if (!year || !month || month < 1 || month > 12) return '';
  return String(year) + '-' + (month < 10 ? '0' : '') + month;
}

function monthlyCheckinIsDebtCurrentForCycle_(lastUpdatedIso, cycleKey) {
  if (!lastUpdatedIso) return false;
  return monthlyCheckinDebtCycleKeyFromIsoDate_(lastUpdatedIso) ===
    String(cycleKey || '').trim();
}

function monthlyCheckinDebtCurrentLabel_(cycleKey) {
  var monthName = monthlyCheckinMonthNameFromCycleKey_(cycleKey);
  return monthName ? ('Current for ' + monthName) : 'Current for current cycle';
}

function monthlyCheckinNormalizeDebtActiveEntries_(entries, cycleKey) {
  var seen = Object.create(null);
  var out = [];
  (entries || []).forEach(function(entry) {
    var accountKey = '';
    var source = entry;
    if (typeof entry === 'string') {
      accountKey = String(entry || '').trim();
      source = { accountKey: accountKey };
    } else if (entry && entry.accountKey) {
      accountKey = String(entry.accountKey || '').trim();
    }
    if (!accountKey || seen[accountKey]) return;
    if (!monthlyCheckinIsValidAccountKey_(accountKey)) return;
    if (accountKey.indexOf('debt:v1:') !== 0) return;
    seen[accountKey] = true;
    var lastUpdated = String(source.lastUpdated || source.lastReviewed || '').trim();
    var currentForCycle = monthlyCheckinIsDebtCurrentForCycle_(lastUpdated, cycleKey);
    out.push({
      accountKey: accountKey,
      displayName: String(source.displayName || '').trim(),
      accountBalance: source.accountBalance == null ? '' : source.accountBalance,
      type: String(source.type || '').trim(),
      dueDate: String(source.dueDate || '').trim(),
      minimumPayment: source.minimumPayment == null ? '' : source.minimumPayment,
      lastUpdated: lastUpdated,
      currentForCycle: currentForCycle
    });
  });
  out.sort(function(a, b) {
    return String(a.accountKey || '').localeCompare(String(b.accountKey || ''));
  });
  return out;
}

function monthlyCheckinBuildRecordUi_(domainKey, record, cycleKey) {
  var nav = MONTHLY_CHECKIN_DOMAIN_NAV_[domainKey] || {};
  var base = {
    domain: domainKey,
    accountKey: String(record.accountKey || '').trim(),
    displayName: String(record.displayName || '').trim(),
    navigatePage: nav.page || '',
    navigateTab: nav.tab || ''
  };
  if (monthlyCheckinIsMonthValueDomain_(domainKey)) {
    base.currentValue = record.hasCurrentMonthValue ? record.currentMonthValue : null;
    base.hasCurrentMonthValue = !!record.hasCurrentMonthValue;
    base.hasPriorMonthValue = !!record.hasPriorMonthValue;
    base.priorMonthValue = record.hasPriorMonthValue ? record.priorMonthValue : null;
    base.domainLabel = nav.label || domainKey;
    base.needsAttention = !record.hasCurrentMonthValue;
    base.reason = record.hasCurrentMonthValue ? '' : monthlyCheckinMissingMonthReason_(cycleKey);
    return base;
  }
  base.currentValue = record.accountBalance === '' || record.accountBalance == null
    ? null
    : record.accountBalance;
  base.currentForCycle = !!record.currentForCycle;
  base.needsAttention = !record.currentForCycle;
  base.reason = record.currentForCycle ? '' : monthlyCheckinDebtNeedsUpdateReason_();
  base.currentStatusLabel = record.currentForCycle ?
    monthlyCheckinDebtCurrentLabel_(cycleKey) : monthlyCheckinDebtNeedsUpdateReason_();
  base.lastUpdated = String(record.lastUpdated || '').trim();
  base.debtType = String(record.type || '').trim();
  base.dueDate = String(record.dueDate || '').trim();
  base.minimumPayment = record.minimumPayment === '' || record.minimumPayment == null
    ? null
    : record.minimumPayment;
  return base;
}

function monthlyCheckinBuildUiProjection_(domains, cycleKey) {
  var attentionItems = [];
  var identityRepairItems = [];
  var domainSections = [];
  var totalActiveCount = 0;
  var areasCurrent = 0;
  var attentionCount = 0;
  var identityIssueCount = 0;
  var missingMonthValueCount = 0;
  var debtNeedsUpdateCount = 0;

  MONTHLY_CHECKIN_STATE_DOMAINS_.forEach(function(domainKey) {
    var domain = domains[domainKey] || {};
    var nav = MONTHLY_CHECKIN_DOMAIN_NAV_[domainKey] || {};
    totalActiveCount += Number(domain.activeCount || 0);
    if (String(domain.status || '').toUpperCase() === 'COMPLETE') areasCurrent++;

    var sectionRecords = [];
    (domain.activeRecords || []).forEach(function(record) {
      if (record && record.identityIssue) return;
      if (!record) return;
      var hasAccountKey = !!String(record.accountKey || '').trim();
      var hasDisplayName = !!String(record.displayName || '').trim();
      if (!hasAccountKey && !(domainKey === 'investments' && hasDisplayName)) return;
      var uiRecord = monthlyCheckinBuildRecordUi_(domainKey, record, cycleKey);
      sectionRecords.push(uiRecord);
      if (uiRecord.needsAttention) {
        attentionItems.push(uiRecord);
        attentionCount++;
        if (monthlyCheckinIsMonthValueDomain_(domainKey)) {
          missingMonthValueCount++;
        } else if (domainKey === 'debts') {
          debtNeedsUpdateCount++;
        }
      }
    });
    sectionRecords.sort(function(a, b) {
      if (domainKey === 'debts') {
        if (!!a.needsAttention !== !!b.needsAttention) {
          return a.needsAttention ? -1 : 1;
        }
      }
      return String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
        sensitivity: 'base'
      });
    });

    domainSections.push({
      domain: domainKey,
      label: nav.label || domainKey,
      domainKind: domain.domainKind || '',
      navigatePage: nav.page || '',
      navigateTab: nav.tab || '',
      activeCount: Number(domain.activeCount || 0),
      currentCount: Number(domain.currentCount || domain.reviewedCount || 0),
      needsUpdateCount: Number(domain.needsUpdateCount || domain.unreviewedCount || 0),
      currentMonthValueCount: Number(domain.currentMonthValueCount || 0),
      missingCurrentMonthValueCount: Number(domain.missingCurrentMonthValueCount || 0),
      reviewedCount: Number(domain.reviewedCount || 0),
      unreviewedCount: Number(domain.unreviewedCount || 0),
      unresolvedCount: Number(domain.unresolvedCount || 0),
      records: sectionRecords
    });

    (domain.identityIssues || []).forEach(function(issue) {
      identityRepairItems.push({
        domain: domainKey,
        displayName: String((issue && issue.displayName) || '').trim(),
        code: String((issue && issue.code) || 'IDENTITY_UNRESOLVED'),
        message: String((issue && issue.message) || 'Account identity could not be resolved.'),
        navigatePage: nav.page || '',
        navigateTab: nav.tab || ''
      });
      identityIssueCount++;
    });
  });

  attentionItems.sort(function(a, b) {
    var domainCmp = String(a.domain || '').localeCompare(String(b.domain || ''));
    if (domainCmp !== 0) return domainCmp;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
      sensitivity: 'base'
    });
  });
  identityRepairItems.sort(function(a, b) {
    var domainCmp = String(a.domain || '').localeCompare(String(b.domain || ''));
    if (domainCmp !== 0) return domainCmp;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
      sensitivity: 'base'
    });
  });

  return {
    areasCurrent: areasCurrent,
    totalActiveCount: totalActiveCount,
    attentionCount: attentionCount,
    identityIssueCount: identityIssueCount,
    missingMonthValueCount: missingMonthValueCount,
    debtNeedsUpdateCount: debtNeedsUpdateCount,
    debtReviewCount: debtNeedsUpdateCount,
    needsReviewCount: attentionCount + identityIssueCount,
    attentionItems: attentionItems,
    identityRepairItems: identityRepairItems,
    domainSections: domainSections
  };
}

function monthlyCheckinBuildCycleProjection_(state, activeByDomain, identityIssuesByDomain) {
  var normalizedState = state;
  if (!normalizedState || !normalizedState.cycleKey) {
    throw new Error('monthlyCheckinBuildCycleProjection_ requires a cycle state object.');
  }
  var activeMap = activeByDomain || {};
  var issueMap = identityIssuesByDomain || {};
  var domains = Object.create(null);
  var domainStatuses = Object.create(null);

  MONTHLY_CHECKIN_STATE_DOMAINS_.forEach(function(domainKey) {
    var projection = monthlyCheckinBuildDomainProjection_(
      domainKey, normalizedState, activeMap[domainKey], issueMap[domainKey]);
    domains[domainKey] = projection;
    domainStatuses[domainKey] = { status: projection.status };
  });

  return {
    version: MONTHLY_CHECKIN_STATE_VERSION_,
    cycleKey: normalizedState.cycleKey,
    persisted: Number(normalizedState.revision || 0) > 0 || !!normalizedState.updatedAt,
    revision: Number(normalizedState.revision || 0),
    updatedAt: normalizedState.updatedAt || null,
    domains: domains,
    status: monthlyCheckinDeriveOverallStatus_(domainStatuses),
    complete: monthlyCheckinDeriveOverallStatus_(domainStatuses) === 'COMPLETE',
    ui: monthlyCheckinBuildUiProjection_(domains, normalizedState.cycleKey)
  };
}
