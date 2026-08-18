/**
 * Part 2A-5 customer-facing Financial Facts readiness projection.
 *
 * This module is read-only except for the separately invoked, digest-guarded
 * verified-manual debt seam already owned by debt_import.js. Planning remains
 * on its legacy authority until a later reviewed migration.
 */

var DATA_READINESS_VIEW_VERSION_ = 'DATA_READINESS_VIEW_V1';
var DATA_READINESS_DEBT_FACTS_ = [
  { type: 'CURRENT_BALANCE', label: 'Balance' },
  { type: 'APR', label: 'APR' },
  { type: 'MINIMUM_PAYMENT', label: 'Minimum payment' },
  { type: 'NEXT_PAYMENT_DATE', label: 'Due date' }
];

function getPlanningDataReadinessFromDashboard(payload) {
  var p = payload || {};
  return buildPlanningDataReadinessModel_(getUserSpreadsheet_(), p.asOf || new Date());
}

function buildPlanningDataReadinessModel_(ss, asOf) {
  var comparisonAt = financialFactIso_(asOf || new Date(), 'asOf');
  var registry = financialIdentityReadRegistry_(ss);
  var links = cashImportReadSourceLinks_(ss);
  var facts = readFinancialFacts_(ss);
  var factIndex = indexFinancialFacts_(facts);
  var cashLegacy = cashImportLegacyBalanceIndex_(ss, registry.accounts);
  var debtLegacy = debtImportLegacyIndex_(ss, registry.accounts);
  var activeCash = registry.accounts.filter(function(account) {
    return String(account.domain || '').toUpperCase() === 'CASH' &&
      dataReadinessAccountActive_(account);
  });
  var activeDebt = registry.accounts.filter(function(account) {
    return String(account.domain || '').toUpperCase() === 'DEBT' &&
      dataReadinessAccountActive_(account) && debtImportIsRevolvingType_(account.accountType);
  });
  var readiness = evaluateWeeklyPlanDataReadinessFromState_(
    registry.accounts, factIndex, comparisonAt);
  var cashRows = activeCash.map(function(account) {
    return dataReadinessCashRow_(account, links, factIndex, cashLegacy, comparisonAt);
  });
  var debtRows = activeDebt.map(function(account) {
    return dataReadinessDebtRow_(account, links, factIndex, debtLegacy, comparisonAt);
  });
  var attention = dataReadinessAttention_(cashRows, debtRows);
  cashRows.sort(dataReadinessAccountSort_);
  debtRows.sort(dataReadinessAccountSort_);
  var overall = dataReadinessCustomerState_(cashRows.length, debtRows.length,
    readiness, attention);
  var cashSummary = dataReadinessDomainSummary_('cash', cashRows);
  var debtSummary = dataReadinessDomainSummary_('debt', debtRows);
  var authority = dataReadinessAuthorityPresentation_(overall.code);
  return {
    version: DATA_READINESS_VIEW_VERSION_,
    generatedAt: financialFactIso_(new Date(), 'observedAt'),
    asOf: comparisonAt,
    authority: {
      planningUsesNormalizedData: false,
      status: 'SHADOW_ONLY',
      customerState: overall.code,
      headline: authority.headline,
      supporting: authority.supporting,
      customerMessage: 'Cash Compass is comparing imported data with the values your weekly plan currently uses. Your plan has not switched to imported data yet.'
    },
    summary: {
      status: overall.code,
      label: overall.label,
      message: overall.message,
      overviewHeadline: overall.overviewHeadline,
      overviewMessage: overall.overviewMessage,
      attentionEmptyMessage: overall.attentionEmptyMessage,
      blockingCount: attention.filter(function(issue) { return issue.blocksReadiness; }).length,
      attentionCount: attention.length,
      cashReadyCount: cashRows.filter(function(row) { return row.ready; }).length,
      cashAccountCount: cashRows.length,
      cardReadyCount: debtRows.filter(function(row) { return row.ready; }).length,
      cardAccountCount: debtRows.length,
      cashPresentation: cashSummary,
      cardPresentation: debtSummary
    },
    cash: cashRows,
    debts: debtRows,
    attention: attention,
    weeklyPlanReadiness: dataReadinessWeeklyPresentation_(readiness,
      cashRows.length, debtRows.length, overall),
    unsupportedDomains: [
      { domain: 'Investments', status: 'Authoritative data not connected yet' },
      { domain: 'Properties', status: 'Authoritative data not connected yet' },
      { domain: 'Retirement', status: 'Authoritative data not connected yet' }
    ]
  };
}

function dataReadinessCashRow_(account, links, factIndex, legacyIndex, asOf) {
  var selection = selectCurrentFinancialFactFromIndex_(factIndex,
    account.stableAccountId, 'CURRENT_BALANCE', asOf);
  var normalized = selection.fact ? Number(selection.fact.numericValue) : null;
  var legacy = Object.prototype.hasOwnProperty.call(legacyIndex, account.stableAccountId)
    ? legacyIndex[account.stableAccountId] : null;
  var reconciliation = cashImportReconcileValues_(legacy, normalized);
  var link = dataReadinessAccountLink_(links, account.stableAccountId);
  var fact = dataReadinessFactPresentation_(selection, 'CURRENT_BALANCE');
  var identity = dataReadinessIdentity_(account);
  var difference = reconciliation.difference;
  var needsAttention = !selection.fact || !selection.freshness.safeToAct ||
    reconciliation.exactStatus === 'DIFFERENCE_DETECTED' || identity.status !== 'VERIFIED';
  return {
    stableAccountId: account.stableAccountId,
    domain: 'CASH', displayName: account.displayName || 'Cash account',
    institution: account.institution || (link && link.institution) || '',
    maskedIdentifier: dataReadinessMaskedIdentifier_(account, link),
    planningValue: legacy, normalizedValue: normalized,
    difference: difference, differenceStatus: reconciliation.exactStatus,
    fact: fact, source: dataReadinessSource_(selection.fact),
    identity: identity, ready: !!(selection.fact && selection.freshness.safeToAct &&
      identity.status === 'VERIFIED'), needsAttention: needsAttention,
    reviewStatus: needsAttention ? 'Review data' : 'Ready',
    refreshMethod: link ? 'Imported evidence available' : 'Refresh method not yet available',
    advanced: dataReadinessAdvanced_(selection, account)
  };
}

function dataReadinessDebtRow_(account, links, factIndex, legacyIndex, asOf) {
  var legacy = legacyIndex[account.stableAccountId] || {};
  var link = dataReadinessAccountLink_(links, account.stableAccountId);
  var comparisons = {};
  DATA_READINESS_DEBT_FACTS_.forEach(function(definition) {
    comparisons[definition.type] = debtImportSelectedShadowFact_(factIndex,
      account.stableAccountId, definition.type, legacy, asOf);
  });
  var diagnostics = debtImportSelectedDiagnostics_(factIndex, account.stableAccountId,
    comparisons, asOf);
  var quality = evaluateRevolvingDebtActionabilityFromComparisons_(comparisons, [], diagnostics);
  var identity = dataReadinessIdentity_(account);
  var facts = DATA_READINESS_DEBT_FACTS_.map(function(definition) {
    var comparison = comparisons[definition.type];
    var presentation = dataReadinessFactPresentation_(comparison.selection, definition.type);
    presentation.label = definition.label;
    presentation.planningValue = comparison.legacyValue;
    presentation.normalizedValue = comparison.normalizedValue;
    presentation.difference = comparison.difference;
    presentation.differenceStatus = comparison.reconciliationStatus;
    presentation.canVerifyManually = definition.type === 'APR' &&
      (!comparison.selection.fact || diagnostics.indexOf('MULTIPLE_APR_REVIEW_REQUIRED') !== -1);
    return presentation;
  });
  var needsAttention = !quality.safeToAct || identity.status !== 'VERIFIED' ||
    facts.some(function(fact) { return fact.differenceStatus === 'DIFFERENCE_DETECTED'; });
  return {
    stableAccountId: account.stableAccountId,
    domain: 'DEBT', displayName: account.displayName || 'Credit card',
    institution: account.institution || (link && link.institution) || '',
    maskedIdentifier: dataReadinessMaskedIdentifier_(account, link),
    facts: facts, diagnostics: diagnostics,
    readiness: {
      balance: quality.balanceReadiness,
      interestRanking: quality.interestRankingReadiness,
      paymentObligation: quality.paymentObligationReadiness,
      exactPayoff: quality.exactPayoffReadiness
    },
    ready: quality.safeToAct && identity.status === 'VERIFIED',
    needsAttention: needsAttention,
    reviewStatus: quality.safeToAct ? 'Data ready' : dataReadinessDebtReviewLabel_(diagnostics, facts),
    identity: identity,
    refreshMethod: link ? 'Imported evidence available' : 'Refresh method not yet available',
    advanced: dataReadinessDebtAdvanced_(comparisons, diagnostics, account)
  };
}

function dataReadinessFactPresentation_(selection, factType) {
  var selected = selection || { fact: null,
    freshness: evaluateFinancialFactFreshness_(null, new Date()) };
  var fact = selected.fact || null;
  var freshness = selected.freshness || evaluateFinancialFactFreshness_(fact, new Date());
  var status = dataReadinessFreshness_(freshness.status, !!fact);
  return {
    factType: factType, status: status.code, statusLabel: status.label,
    statusMessage: status.message, effectiveAsOf: fact ? fact.effectiveAsOf : '',
    observedAt: fact ? fact.observedAt : '', source: dataReadinessSource_(fact),
    safeToModel: !!freshness.safeToModel, safeToAct: !!freshness.safeToAct,
    internalFreshnessCode: freshness.status || 'MISSING',
    authorityClass: fact ? fact.authorityClass : '',
    verificationStatus: fact ? fact.verificationStatus : '',
    reconciliationStatus: selected.reconciliationStatus || (fact && fact.reconciliationStatus) || 'UNVERIFIED'
  };
}

function dataReadinessFreshness_(code, hasFact) {
  if (!hasFact || code === 'MISSING') return { code: 'MISSING', label: 'Missing',
    message: 'No normalized value is available.' };
  var labels = {
    CURRENT: ['CURRENT', 'Current', 'Ready to use for review.'],
    RECENT: ['CURRENT', 'Current', 'Still within the approved freshness window.'],
    AGING: ['NEEDS_REFRESH', 'Refresh recommended', 'This value is getting old.'],
    STALE: ['NEEDS_REFRESH', 'Needs refresh', 'Refresh this value before acting.'],
    UNKNOWN: ['INCOMPLETE', 'Date not verified', 'The effective date is not verified.']
  };
  var row = labels[String(code || '').toUpperCase()] || labels.UNKNOWN;
  return { code: row[0], label: row[1], message: row[2] };
}

function dataReadinessSource_(fact) {
  if (!fact) return 'Not yet available';
  var source = String(fact.sourceSystem || '').toUpperCase();
  var authority = String(fact.authorityClass || '').toUpperCase();
  var type = String(fact.sourceType || '').toUpperCase();
  if (source === 'USER_VERIFIED_MANUAL' || authority === 'USER_VERIFIED_MANUAL') {
    return 'Verified manually';
  }
  if (authority === 'STATEMENT_DERIVED' || type === 'STATEMENT') return 'Statement-derived';
  if (type === 'FILE_IMPORT' || source.indexOf('OFX') !== -1 || source.indexOf('QFX') !== -1) {
    return 'Imported QFX/OFX';
  }
  if (type === 'LEGACY' || authority === 'LEGACY_MANUAL') return 'Legacy Cash Compass entry';
  if (type === 'INSTITUTION' || authority === 'INSTITUTION_AUTHORITATIVE') {
    return 'Institution-provided';
  }
  return 'Imported evidence';
}

function dataReadinessIdentity_(account) {
  var code = String(account.identityStatus || '').toUpperCase();
  if (!code) {
    code = account.ownerId === 'UNKNOWN_REVIEW_REQUIRED' || account.registrationType === 'UNKNOWN'
      ? 'REVIEW_REQUIRED' : 'VERIFIED';
  }
  return { status: code, label: code === 'VERIFIED' ? 'Matched' :
    code === 'CONFLICT' ? 'Needs identity review' : 'Needs review' };
}

function dataReadinessAdvanced_(selection, account) {
  var fact = selection && selection.fact;
  return {
    stableAccountId: account.stableAccountId,
    factId: fact ? fact.factId : '',
    authorityClass: fact ? fact.authorityClass : '',
    verificationStatus: fact ? fact.verificationStatus : '',
    reconciliationStatus: selection ? selection.reconciliationStatus : '',
    selectionRuleId: selection ? selection.selectionRuleId : ''
  };
}

function dataReadinessDebtAdvanced_(comparisons, diagnostics, account) {
  return {
    stableAccountId: account.stableAccountId,
    reasonCodes: diagnostics.slice(),
    facts: DATA_READINESS_DEBT_FACTS_.map(function(definition) {
      var selection = comparisons[definition.type].selection;
      var advanced = dataReadinessAdvanced_(selection, account);
      advanced.factType = definition.type;
      return advanced;
    })
  };
}

function dataReadinessAttention_(cashRows, debtRows) {
  var issues = [];
  (cashRows || []).forEach(function(row) {
    if (!row.fact || row.fact.status === 'MISSING') {
      issues.push(dataReadinessIssue_(1, true, row, 'Cash balance is missing',
        'Add current balance evidence before normalized data can support Planning.'));
    } else if (!row.fact.safeToAct) {
      issues.push(dataReadinessIssue_(2, true, row, row.fact.statusLabel,
        'Refresh the cash balance before acting on normalized data.'));
    }
    if (row.identity.status !== 'VERIFIED') {
      issues.push(dataReadinessIssue_(1, true, row, 'Account match needs review',
        'Confirm which Cash Compass account this evidence belongs to.'));
    }
    if (row.differenceStatus === 'DIFFERENCE_DETECTED') {
      issues.push(dataReadinessIssue_(3, false, row, 'Balance differs from Planning',
        'Review the imported balance and its effective date.'));
    }
  });
  (debtRows || []).forEach(function(row) {
    row.facts.forEach(function(fact) {
      if (fact.status === 'MISSING') {
        var ambiguousApr = fact.factType === 'APR' &&
          row.diagnostics.indexOf('MULTIPLE_APR_REVIEW_REQUIRED') !== -1;
        issues.push(dataReadinessIssue_(1, true, row,
          ambiguousApr ? 'APR needs review' : fact.label + ' is missing',
          ambiguousApr
            ? 'This account has more than one possible interest rate and Cash Compass cannot tell which rate applies to the carried balance.'
            : 'Add or verify this fact before normalized data can support the weekly plan.', fact.factType));
      } else if (!fact.safeToAct) {
        issues.push(dataReadinessIssue_(2, true, row, fact.label + ' needs refresh',
          fact.statusMessage, fact.factType));
      }
      if (fact.differenceStatus === 'DIFFERENCE_DETECTED') {
        issues.push(dataReadinessIssue_(3, false, row, fact.label + ' differs from Planning',
          'Review both values and the imported effective date.', fact.factType));
      }
    });
    if (row.identity.status !== 'VERIFIED') {
      issues.push(dataReadinessIssue_(1, true, row, 'Account match needs review',
        'Confirm which Cash Compass account this evidence belongs to.'));
    }
  });
  issues.sort(function(a, b) {
    return a.priority - b.priority || a.accountName.localeCompare(b.accountName) ||
      a.title.localeCompare(b.title);
  });
  return issues;
}

function dataReadinessIssue_(priority, blocks, row, title, message, factType) {
  return { priority: priority, blocksReadiness: !!blocks,
    domain: row.domain, stableAccountId: row.stableAccountId,
    accountName: row.displayName, factType: factType || '',
    title: title, message: message };
}

function dataReadinessWeeklyPresentation_(readiness, cashAccountCount, debtAccountCount, customerState) {
  var dimensions = readiness.dimensions || {};
  var rows = [
    ['Cash data', dimensions.cash, Number(cashAccountCount || 0) > 0],
    ['Card balances', dimensions.balanceReadiness, Number(debtAccountCount || 0) > 0],
    ['Interest rates', dimensions.interestRankingReadiness, Number(debtAccountCount || 0) > 0],
    ['Minimum payments', dimensions.paymentObligationReadiness, Number(debtAccountCount || 0) > 0],
    ['Due dates', dimensions.paymentObligationReadiness, Number(debtAccountCount || 0) > 0],
    ['Exact payoff', dimensions.exactPayoffReadiness, Number(debtAccountCount || 0) > 0]
  ].map(function(row) {
    var dimension = row[1] || { status: 'NOT_READY', readyCount: 0, accountCount: 0 };
    var status = row[2] ? dimension.status : 'NOT_CONNECTED';
    return { label: row[0], status: status,
      statusLabel: dataReadinessDimensionLabel_(status),
      readyCount: Number(dimension.readyCount || 0),
      accountCount: Number(dimension.accountCount || 0),
      countLabel: status === 'NOT_CONNECTED' ? '' :
        Number(dimension.readyCount || 0) + ' / ' + Number(dimension.accountCount || 0) };
  });
  var state = customerState || dataReadinessCustomerState_(cashAccountCount,
    debtAccountCount, readiness, []);
  return { status: state.code, statusLabel: state.planStatusLabel,
    message: state.planMessage,
    authoritySwitched: false, dimensions: rows };
}

function dataReadinessDimensionLabel_(status) {
  return status === 'NOT_CONNECTED' ? 'Not connected' :
    status === 'READY' ? 'Ready' : status === 'PARTIAL' ? 'Partly ready' : 'Not ready';
}

function dataReadinessCustomerState_(cashAccountCount, debtAccountCount, readiness, attention) {
  var cashConnected = Number(cashAccountCount || 0) > 0;
  var debtConnected = Number(debtAccountCount || 0) > 0;
  var issueCount = (attention || []).length;
  if (!cashConnected && !debtConnected) {
    return { code: 'NOT_CONNECTED', label: 'Data not connected',
      message: 'Imported cash and credit-card data is not connected yet.',
      overviewHeadline: 'Not connected yet',
      overviewMessage: 'Cash and credit-card data still need to be added or verified.',
      planStatusLabel: 'Not available yet',
      planMessage: 'Add or verify cash and credit-card data before normalized-data readiness can be evaluated.',
      attentionEmptyMessage: 'No imported items currently require review.' };
  }
  if (!cashConnected || !debtConnected) {
    var missingDomain = cashConnected ? 'Credit-card' : 'Cash';
    var readyDomain = cashConnected ? 'Cash' : 'Credit-card';
    return { code: 'MORE_DATA_NEEDED', label: 'More data needed',
      message: readyDomain + ' data is connected. ' + missingDomain + ' data is not connected yet.',
      overviewHeadline: 'More data needed',
      overviewMessage: missingDomain + ' data still needs to be added or verified.',
      planStatusLabel: 'More data needed',
      planMessage: readyDomain + ' data is available. ' + missingDomain +
        ' data still needs to be connected before normalized data can support the full weekly plan.',
      attentionEmptyMessage: 'No connected items currently require review. Additional data is still needed.' };
  }
  if (readiness.overall !== 'READY_FOR_AUTHORITY_SWITCH_REVIEW' || issueCount) {
    return { code: 'NEEDS_REVIEW', label: 'Needs review',
      message: issueCount ? issueCount + ' imported item' + (issueCount === 1 ? ' needs' : 's need') +
        ' review.' : 'Connected data still needs review.',
      overviewHeadline: issueCount ? issueCount + ' item' + (issueCount === 1 ? ' needs' : 's need') +
        ' review' : 'Data needs review',
      overviewMessage: 'Review connected cash and credit-card data before it can support the weekly plan.',
      planStatusLabel: 'Needs review',
      planMessage: 'Connected cash and credit-card data has issues that must be reviewed before normalized data can support Planning.',
      attentionEmptyMessage: 'No imported items currently require review.' };
  }
  return { code: 'READY_FOR_REVIEW', label: 'Ready for review',
    message: 'Normalized cash and credit-card data meets the current weekly-plan readiness requirements.',
    overviewHeadline: 'Ready for review',
    overviewMessage: 'Normalized data meets the current weekly-plan readiness requirements.',
    planStatusLabel: 'Ready for review',
    planMessage: 'Normalized cash and credit-card data meets the current weekly-plan readiness requirements. Your weekly plan still uses existing Planning values.',
    attentionEmptyMessage: 'No imported items currently require review.' };
}

function dataReadinessDomainSummary_(domain, rows) {
  var accountRows = rows || [];
  var isCash = domain === 'cash';
  if (!accountRows.length) {
    return { status: 'NOT_CONNECTED', label: 'Not connected',
      note: isCash ? 'No normalized cash data yet.' : 'No normalized credit-card data yet.',
      emptyMessage: isCash
        ? 'Cash data has not been connected yet. Your weekly plan continues using your existing bank-account values.'
        : 'Credit-card data has not been connected yet. Your weekly plan continues using your existing debt values.' };
  }
  var ready = accountRows.filter(function(row) { return row.ready; }).length;
  return { status: ready === accountRows.length ? 'READY' : 'NEEDS_REVIEW',
    label: ready === accountRows.length ? 'Ready' : ready + ' / ' + accountRows.length + ' ready',
    note: accountRows.length + ' normalized account' + (accountRows.length === 1 ? '' : 's'),
    emptyMessage: '' };
}

function dataReadinessAuthorityPresentation_(state) {
  if (state === 'NOT_CONNECTED') return {
    headline: 'Imported data is not connected yet.',
    supporting: 'Your current weekly plan still uses the existing Planning values.' };
  if (state === 'READY_FOR_REVIEW') return {
    headline: 'Imported data is ready for review.',
    supporting: 'Your current weekly plan still uses the existing Planning values until a separately approved authority switch occurs.' };
  return { headline: 'Imported data is being reviewed.',
    supporting: 'Your current weekly plan still uses the existing Planning values.' };
}

function dataReadinessDebtReviewLabel_(diagnostics, facts) {
  if ((diagnostics || []).indexOf('MULTIPLE_APR_REVIEW_REQUIRED') !== -1) return 'APR needs review';
  var missing = (facts || []).filter(function(fact) { return fact.status === 'MISSING'; });
  if (missing.length) return missing[0].label + ' missing';
  var stale = (facts || []).filter(function(fact) { return !fact.safeToAct; });
  return stale.length ? stale[0].label + ' needs refresh' : 'Needs review';
}

function dataReadinessAccountSort_(a, b) {
  var aRank = a.ready ? 2 : a.needsAttention ? 0 : 1;
  var bRank = b.ready ? 2 : b.needsAttention ? 0 : 1;
  return aRank - bRank || String(a.displayName || '').localeCompare(String(b.displayName || ''));
}

function dataReadinessAccountActive_(account) {
  return !financialIdentityInactive_(account.active);
}

function dataReadinessAccountLink_(links, stableId) {
  var matches = (links || []).filter(function(link) {
    return link.stableAccountId === stableId && String(link.linkStatus || '').toUpperCase() === 'VERIFIED';
  });
  return matches[0] || null;
}

function dataReadinessMaskedIdentifier_(account, link) {
  if (link && link.maskedIdentifier) return link.maskedIdentifier;
  var last4 = String(account.last4 || '').replace(/\D/g, '').slice(-4);
  return last4 ? '••••' + last4 : '';
}
