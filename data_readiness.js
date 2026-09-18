/**
 * Part 2A-5 customer-facing Financial Facts readiness projection.
 *
 * This module is read-only except for the separately invoked, digest-guarded
 * verified-manual debt seam already owned by debt_import.js. Planning remains
 * on its legacy authority until a later reviewed migration.
 */

var DATA_READINESS_VIEW_VERSION_ = 'DATA_READINESS_VIEW_V2';
var DATA_READINESS_DEBT_FACTS_ = [
  { type: 'CURRENT_BALANCE', label: 'Balance' },
  { type: 'APR', label: 'APR' },
  { type: 'MINIMUM_PAYMENT', label: 'Minimum payment' },
  { type: 'NEXT_PAYMENT_DATE', label: 'Due date' }
];
var DATA_READINESS_APPROVED_SOURCES_ = {
  MANUAL: true, PLAID: true, CSV: true, PDF: true, FILE_IMPORT: true,
  INSTITUTION: true, STATEMENT: true, CALCULATED: true, ESTIMATED: true, LEGACY: true
};
var DATA_READINESS_EVIDENCE_SOURCE_LEGEND_ = 'Manual / Plaid / CSV / PDF';
var DATA_READINESS_STATUS_LABELS_ = {
  NOT_CONNECTED: 'Not connected',
  MORE_DATA_NEEDED: 'Needs attention',
  NEEDS_ATTENTION: 'Needs attention',
  NEEDS_REVIEW: 'Needs review',
  CURRENT: 'Current',
  READY_FOR_REVIEW: 'Ready for review'
};

function dataReadinessPresentationLabel_(code) {
  var key = String(code || '').trim().toUpperCase();
  if (key === 'READY' || key === 'CURRENT') return DATA_READINESS_STATUS_LABELS_.CURRENT;
  if (key === 'READY_FOR_REVIEW') return DATA_READINESS_STATUS_LABELS_.READY_FOR_REVIEW;
  if (key === 'NOT_CONNECTED') return DATA_READINESS_STATUS_LABELS_.NOT_CONNECTED;
  if (key === 'PARTIAL' || key === 'NOT_READY' || key === 'MISSING' ||
      key === 'MORE_DATA_NEEDED' || key === 'NEEDS_ATTENTION') {
    return DATA_READINESS_STATUS_LABELS_.NEEDS_ATTENTION;
  }
  if (key === 'INVALID' || key === 'STALE' || key === 'IDENTITY_AMBIGUOUS' ||
      key === 'CONFLICT' || key === 'NEEDS_REVIEW') {
    return DATA_READINESS_STATUS_LABELS_.NEEDS_REVIEW;
  }
  return DATA_READINESS_STATUS_LABELS_.NEEDS_REVIEW;
}

function dataReadinessIssueKind_(issueOrTitle) {
  if (issueOrTitle && typeof issueOrTitle === 'object' && issueOrTitle.kind) {
    return String(issueOrTitle.kind).toUpperCase() === 'MISSING' ? 'MISSING' : 'REVIEW';
  }
  var title = String((issueOrTitle && issueOrTitle.title) || issueOrTitle || '').toLowerCase();
  return title.indexOf('missing') !== -1 ? 'MISSING' : 'REVIEW';
}

function dataReadinessEvidenceNeedsReview_(status) {
  var code = String(status || '').toUpperCase();
  return code === 'INVALID' || code === 'STALE' || code === 'IDENTITY_AMBIGUOUS';
}

function dataReadinessHasConflict_(status) {
  return String(status || '').toUpperCase() === 'DIFFERENCE_DETECTED';
}

var DATA_READINESS_COPY_ = {
  REASON_MISSING: 'No monthly value has been entered.',
  REASON_UNMATCHED: 'Imported evidence is not matched to a CashCompass account.',
  REASON_OPTIONAL_UNMATCHED: 'Not matched — current CashCompass value is being used. No action required.',
  REASON_DIFFERENCE: 'The imported value differs from the current CashCompass value.',
  REASON_STALE: 'The imported evidence is stale.',
  REASON_INVALID: 'The evidence could not be validated.',
  REASON_VALID_SHEET: 'A valid monthly CashCompass value is present.',
  REASON_VALID_IMPORTED: 'A valid monthly imported value is present.',
  REASON_NOT_CONNECTED: 'No evidence or source is connected yet.',
  REASON_OPTIONAL: 'Older imported record — current CashCompass value is being used. No action required.',
  UNSUPPORTED_STATUS: 'Not included in this readiness review yet',
  UNSUPPORTED_NOTE: 'Investments, properties, and retirement are maintained in CashCompass but are not yet included in this readiness review. Existing CashCompass values remain authoritative.',
  PAGE_HEADLINE_CURRENT: 'Your required cash and credit-card data is current. No action is required.',
  PAGE_HEADLINE_MISSING: 'Some required monthly values still need attention.',
  PAGE_HEADLINE_REVIEW: 'Some required values still need review.',
  PAGE_HEADLINE_EMPTY: 'Cash and credit-card accounts are not connected yet.',
  IMPACT_USING: 'Planning is using the existing CashCompass value.',
  IMPACT_UNAFFECTED: 'Planning is not affected.',
  IMPACT_BLOCKING: 'Planning cannot use this value until the issue is corrected.',
  ACTION_NONE: 'No action required.',
  ACTION_CURRENT: 'Current — no action required.',
  ACTION_MATCH: 'Review the account match.',
  ACTION_COMPARE: 'Compare the imported and current values.',
  ACTION_OPTIONAL: 'No action required unless you want to replace or compare the current value.',
  ACTION_OPEN_BANK: 'Open Bank Accounts',
  ACTION_OPEN_HOUSES: 'Open Houses',
  ACTION_OPEN_DEBTS: 'Open Debts',
  ACTION_OPEN_INVESTMENTS: 'Open Investments',
  ACTION_REVIEW_IMPORTED: 'Review imported evidence',
  REVIEWED_MONTHLY: 'Reviewed in Monthly Review.',
  PLANNING_STATUS: 'Planning uses the existing CashCompass values from INPUT/SYS sheets.'
};

function dataReadinessPageHeadline_(code, actionCount) {
  var status = String(code || '').toUpperCase();
  if (status === 'CURRENT' && Number(actionCount || 0) === 0) {
    return DATA_READINESS_COPY_.PAGE_HEADLINE_CURRENT;
  }
  if (status === 'NOT_CONNECTED') return DATA_READINESS_COPY_.PAGE_HEADLINE_EMPTY;
  if (status === 'NEEDS_REVIEW') return DATA_READINESS_COPY_.PAGE_HEADLINE_REVIEW;
  if (status === 'MORE_DATA_NEEDED' || status === 'NEEDS_ATTENTION') {
    return DATA_READINESS_COPY_.PAGE_HEADLINE_MISSING;
  }
  return DATA_READINESS_COPY_.PAGE_HEADLINE_CURRENT;
}

function dataReadinessOptionalProviderSummary_(count) {
  var n = Number(count || 0);
  if (n <= 0) return '';
  return n + ' older or unmatched imported record' + (n === 1 ? ' is' : 's are') +
    ' available for reference. They do not affect Planning and do not require action.';
}

function dataReadinessUnsupportedDomains_() {
  var status = DATA_READINESS_COPY_.UNSUPPORTED_STATUS;
  return [
    { domain: 'Investments', status: status },
    { domain: 'Properties', status: status },
    { domain: 'Retirement', status: status }
  ];
}

function dataReadinessOpenAction_(domain, fieldLabel) {
  var scope = String(domain || fieldLabel || '').toLowerCase();
  if (scope.indexOf('invest') !== -1) return DATA_READINESS_COPY_.ACTION_OPEN_INVESTMENTS;
  if (scope.indexOf('house') !== -1 || scope.indexOf('propert') !== -1) {
    return DATA_READINESS_COPY_.ACTION_OPEN_HOUSES;
  }
  if (scope.indexOf('debt') !== -1 || scope.indexOf('card') !== -1 ||
      scope.indexOf('apr') !== -1 || scope.indexOf('minimum') !== -1 ||
      scope.indexOf('due') !== -1 || scope.indexOf('payoff') !== -1 ||
      scope.indexOf('interest') !== -1) {
    return DATA_READINESS_COPY_.ACTION_OPEN_DEBTS;
  }
  return DATA_READINESS_COPY_.ACTION_OPEN_BANK;
}

function dataReadinessNavigateForDomain_(domain) {
  var scope = String(domain || '').toUpperCase();
  if (scope === 'DEBT' || scope === 'DEBTS' || scope === 'CARD') {
    return { navigatePage: 'assets', navigateTab: 'debts' };
  }
  if (scope === 'INVESTMENT' || scope === 'INVESTMENTS') {
    return { navigatePage: 'assets', navigateTab: 'investments' };
  }
  if (scope === 'HOUSE' || scope === 'HOUSES' || scope === 'PROPERTY') {
    return { navigatePage: 'assets', navigateTab: 'houses' };
  }
  return { navigatePage: 'assets', navigateTab: 'bank' };
}

function dataReadinessCycleKeyFromAsOf_(asOf) {
  var text = String(asOf || '').trim();
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : '';
}

function dataReadinessIsIdentityReason_(reason, title) {
  var haystack = (String(reason || '') + ' ' + String(title || '')).toLowerCase();
  return haystack.indexOf('match') !== -1 || haystack.indexOf('identity') !== -1 ||
    haystack.indexOf('unmatched') !== -1;
}

function dataReadinessEnterAction_(label) {
  var noun = String(label || 'value').trim().toLowerCase();
  if (noun === 'balance' || noun === 'current_balance' || noun === 'cash data' ||
      noun === 'card balances' || noun === 'exact payoff') {
    return 'Enter this month\'s balance.';
  }
  if (noun === 'apr' || noun === 'interest rates') return 'Enter this month\'s APR.';
  if (noun === 'minimum payment' || noun === 'minimum payments') {
    return 'Enter this month\'s minimum payment.';
  }
  if (noun === 'due date' || noun === 'due dates') return 'Enter this month\'s due date.';
  return 'Enter this month\'s ' + noun + '.';
}

function dataReadinessGuidanceRecord_(code, reason, impact, action, extras) {
  var details = extras || {};
  var optional = !!details.optional;
  var blocking = !!details.blocking;
  var actionable = !optional && !details.informational &&
    (code === 'MORE_DATA_NEEDED' || code === 'NEEDS_ATTENTION' || code === 'NEEDS_REVIEW');
  var hasAction = details.hasAction === true || details.hasAction === false
    ? details.hasAction
    : actionable;
  var nextAction = Object.prototype.hasOwnProperty.call(details, 'nextAction')
    ? details.nextAction
    : (hasAction || !optional ? (action || DATA_READINESS_COPY_.ACTION_NONE) : (action || ''));
  return {
    status: code,
    statusLabel: dataReadinessPresentationLabel_(code),
    reason: reason,
    planningImpact: impact,
    nextAction: nextAction,
    blocking: blocking,
    optional: optional,
    actionable: actionable,
    hasAction: hasAction,
    kind: details.kind || ((code === 'MORE_DATA_NEEDED' || code === 'NEEDS_ATTENTION') ? 'MISSING' :
      (code === 'NEEDS_REVIEW' ? 'REVIEW' : '')),
    title: details.title || '',
    fieldLabel: details.fieldLabel || '',
    reviewedNote: details.reviewedNote || '',
    navigatePage: details.navigatePage || '',
    navigateTab: details.navigateTab || '',
    reviewRoute: details.reviewRoute || '',
    actionKind: details.actionKind || '',
    accountKey: details.accountKey || '',
    cycleKey: details.cycleKey || '',
    asOf: details.asOf || '',
    optionalItems: details.optionalItems || []
  };
}

function dataReadinessHasValidPlanningValue_(evidence) {
  return !!(evidence && (evidence.planningValid || (evidence.valid &&
    String(evidence.status || '').toUpperCase() !== 'INVALID' &&
    String(evidence.status || '').toUpperCase() !== 'IDENTITY_AMBIGUOUS')));
}

function dataReadinessMonthLabelFromCycleKey_(cycleKey) {
  var parts = String(cycleKey || '').trim().split('-');
  if (parts.length !== 2) return '';
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  if (!year || !month) return '';
  var date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function dataReadinessMissingReason_(fieldLabel, cycleKey) {
  var field = String(fieldLabel || 'value').trim() || 'value';
  var month = dataReadinessMonthLabelFromCycleKey_(cycleKey);
  if (month) return 'No ' + month + ' ' + field + ' has been entered.';
  return DATA_READINESS_COPY_.REASON_MISSING;
}

function dataReadinessOptionalImportedItem_(reason, extras) {
  var copy = DATA_READINESS_COPY_;
  var details = extras || {};
  var unmatched = dataReadinessIsIdentityReason_(reason, details.title);
  return dataReadinessGuidanceRecord_('READY_FOR_REVIEW',
    unmatched ? copy.REASON_OPTIONAL_UNMATCHED : reason,
    unmatched ? '' : copy.IMPACT_USING, '', {
      optional: true, kind: 'REVIEW',
      title: details.title || 'Optional imported evidence to review',
      fieldLabel: details.fieldLabel || '',
      readyForReview: false,
      hasAction: false,
      nextAction: '',
      reviewRoute: '',
      actionKind: '',
      navigatePage: '',
      navigateTab: '',
      accountKey: details.accountKey || '',
      cycleKey: details.cycleKey || '',
      asOf: details.asOf || '',
      domain: details.domain || ''
    });
}

function dataReadinessCustomerStatusFromEvidence_(evidence, identity, differenceStatus) {
  var identityStatus = identity && identity.status ? String(identity.status).toUpperCase() : 'VERIFIED';
  var status = String(evidence && evidence.status || '').toUpperCase();
  if (dataReadinessHasValidPlanningValue_(evidence)) return 'CURRENT';
  if (identityStatus && identityStatus !== 'VERIFIED') return 'NEEDS_REVIEW';
  if (status === 'INVALID' || status === 'IDENTITY_AMBIGUOUS' || status === 'STALE') {
    return 'NEEDS_REVIEW';
  }
  if (status === 'MISSING') return 'MORE_DATA_NEEDED';
  return 'CURRENT';
}

function dataReadinessGuidanceFromEvidence_(evidence, identity, differenceStatus, fieldLabel, options) {
  var opts = options || {};
  var copy = DATA_READINESS_COPY_;
  var label = fieldLabel || 'value';
  var identityStatus = identity && identity.status ? String(identity.status).toUpperCase() : 'VERIFIED';
  var status = String(evidence && evidence.status || '').toUpperCase();
  var planningValid = !!(evidence && evidence.planningValid);
  var importedValid = !!(evidence && evidence.importedValid);
  var importedStale = status === 'STALE' || !!(evidence && evidence.importedStale);
  var domain = opts.domain || '';
  var nav = dataReadinessNavigateForDomain_(domain);
  var contextExtras = {
    fieldLabel: label,
    accountKey: opts.accountKey || '',
    cycleKey: opts.cycleKey || dataReadinessCycleKeyFromAsOf_(opts.asOf),
    asOf: opts.asOf || ''
  };
  var optionalContext = {
    fieldLabel: label, domain: domain,
    accountKey: contextExtras.accountKey,
    cycleKey: contextExtras.cycleKey,
    asOf: contextExtras.asOf
  };
  var optionalItems = [];
  var primary;

  if (identityStatus && identityStatus !== 'VERIFIED' && !planningValid) {
    primary = dataReadinessGuidanceRecord_('NEEDS_REVIEW', copy.REASON_UNMATCHED,
      copy.IMPACT_BLOCKING, copy.ACTION_MATCH, Object.assign({}, contextExtras, {
        blocking: true, kind: 'REVIEW', title: 'Account match needs review',
        navigatePage: nav.navigatePage, navigateTab: nav.navigateTab,
        reviewRoute: 'identity', actionKind: 'IDENTITY', hasAction: true
      }));
  } else if (status === 'INVALID' && !planningValid) {
    primary = dataReadinessGuidanceRecord_('NEEDS_REVIEW', copy.REASON_INVALID,
      copy.IMPACT_BLOCKING, 'Replace the malformed ' + String(label).toLowerCase() +
        ' with a valid value.', Object.assign({}, contextExtras, {
        blocking: true, kind: 'REVIEW', title: label + ' is invalid',
        navigatePage: nav.navigatePage, navigateTab: nav.navigateTab,
        reviewRoute: 'editor', actionKind: 'UPDATE', hasAction: true
      }));
  } else if (status === 'STALE' && !planningValid) {
    primary = dataReadinessGuidanceRecord_('NEEDS_REVIEW', copy.REASON_STALE,
      copy.IMPACT_UNAFFECTED, dataReadinessOpenAction_(domain, label),
      Object.assign({}, contextExtras, {
        kind: 'REVIEW', title: label + ' needs refresh',
        navigatePage: nav.navigatePage, navigateTab: nav.navigateTab,
        reviewRoute: 'editor', actionKind: 'UPDATE', hasAction: true
      }));
  } else if (status === 'MISSING' && !planningValid) {
    primary = dataReadinessGuidanceRecord_('MORE_DATA_NEEDED',
      dataReadinessMissingReason_(label, contextExtras.cycleKey),
      copy.IMPACT_UNAFFECTED, dataReadinessOpenAction_(domain, label),
      Object.assign({}, contextExtras, {
        kind: 'MISSING', title: label + ' is missing',
        navigatePage: nav.navigatePage, navigateTab: nav.navigateTab,
        reviewRoute: 'editor', actionKind: 'UPDATE', hasAction: true
      }));
  } else {
    primary = dataReadinessGuidanceRecord_('CURRENT',
      planningValid ? copy.REASON_VALID_SHEET : copy.REASON_VALID_IMPORTED,
      copy.IMPACT_USING, copy.ACTION_CURRENT, Object.assign({}, contextExtras, {
        reviewedNote: copy.REVIEWED_MONTHLY, hasAction: false, reviewRoute: '', actionKind: ''
      }));
  }

  if (planningValid && identityStatus && identityStatus !== 'VERIFIED') {
    optionalItems.push(dataReadinessOptionalImportedItem_(copy.REASON_UNMATCHED, Object.assign({},
      optionalContext, { title: 'Account match needs review' })));
  }
  if ((planningValid || importedValid) && importedStale) {
    optionalItems.push(dataReadinessOptionalImportedItem_(copy.REASON_STALE, Object.assign({},
      optionalContext, { title: 'Optional imported evidence to review' })));
  }
  if (planningValid && dataReadinessHasConflict_(differenceStatus)) {
    optionalItems.push(dataReadinessOptionalImportedItem_(copy.REASON_DIFFERENCE, Object.assign({},
      optionalContext, { title: label + ' differs from Planning', readyForReview: true })));
  }
  if (opts.importedUnmatched && planningValid && identityStatus === 'VERIFIED') {
    optionalItems.push(dataReadinessOptionalImportedItem_(copy.REASON_UNMATCHED, Object.assign({},
      optionalContext, { title: 'Imported evidence is not matched' })));
  }
  if (opts.aprAmbiguous && planningValid) {
    optionalItems.push(dataReadinessOptionalImportedItem_(copy.REASON_OPTIONAL, Object.assign({},
      optionalContext, { title: 'APR needs review', fieldLabel: 'APR', readyForReview: true })));
  }
  primary.optionalItems = optionalItems;
  return primary;
}

function dataReadinessRowCustomerStatus_(evidence, identity, differenceStatus) {
  return dataReadinessCustomerStatusFromEvidence_(evidence, identity, differenceStatus);
}

function dataReadinessDebtRowCustomerStatus_(identity, facts, diagnostics) {
  var identityStatus = identity && identity.status ? String(identity.status).toUpperCase() : 'VERIFIED';
  var planningComplete = !!(facts && facts.length) && facts.every(function(fact) {
    return !!(fact.evidenceValid || (fact.guidance &&
      (fact.guidance.status === 'CURRENT' || fact.guidance.status === 'READY_FOR_REVIEW') &&
      !fact.guidance.actionable));
  });
  if (identityStatus && identityStatus !== 'VERIFIED' && !planningComplete) return 'NEEDS_REVIEW';
  var hasMissing = false;
  var i;
  for (i = 0; i < (facts || []).length; i++) {
    var fact = facts[i];
    if (fact.guidance && fact.guidance.actionable) {
      if (fact.guidance.status === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
      if (fact.guidance.status === 'MORE_DATA_NEEDED' || fact.guidance.status === 'NEEDS_ATTENTION') {
        hasMissing = true;
      }
      continue;
    }
    if (fact.evidenceValid) continue;
    if (dataReadinessEvidenceNeedsReview_(fact.evidenceStatus)) return 'NEEDS_REVIEW';
    if (String(fact.evidenceStatus || '').toUpperCase() === 'MISSING') hasMissing = true;
  }
  return hasMissing ? 'MORE_DATA_NEEDED' : 'CURRENT';
}

function dataReadinessConnectedRowStatus_(row) {
  if (!row) return 'MORE_DATA_NEEDED';
  if (row.customerStatus) return row.customerStatus;
  if (String(row.domain || '').toUpperCase() === 'DEBT' || row.facts) {
    return dataReadinessDebtRowCustomerStatus_(row.identity, row.facts, row.diagnostics);
  }
  return dataReadinessCustomerStatusFromEvidence_({
    status: row.evidenceStatus,
    planningValid: !!row.ready,
    valid: !!row.ready
  }, row.identity, row.differenceStatus);
}

function dataReadinessRowsCustomerStatus_(rows) {
  if (!rows || !rows.length) return 'NOT_CONNECTED';
  var hasReview = false;
  var hasMissing = false;
  rows.forEach(function(row) {
    var code = dataReadinessConnectedRowStatus_(row);
    if (code === 'NEEDS_REVIEW') hasReview = true;
    if (code === 'MORE_DATA_NEEDED') hasMissing = true;
  });
  if (hasReview) return 'NEEDS_REVIEW';
  if (hasMissing) return 'MORE_DATA_NEEDED';
  return 'CURRENT';
}

function dataReadinessStateRecord_(code, message, overviewMessage, planMessage) {
  var label = dataReadinessPresentationLabel_(code);
  return {
    code: code,
    label: label,
    message: message,
    overviewHeadline: label,
    overviewMessage: overviewMessage,
    planStatusLabel: label,
    planMessage: planMessage,
    attentionEmptyMessage: 'Nothing currently requires attention.'
  };
}

function dataReadinessCanonicalSource_(fact, hasPlanningValue) {
  var type = String(fact && fact.sourceType || '').trim().toUpperCase();
  var system = String(fact && fact.sourceSystem || '').trim().toUpperCase();
  var authority = String(fact && fact.authorityClass || '').trim().toUpperCase();
  if (type === 'PLAID' || system.indexOf('PLAID') !== -1) {
    return { sourceCode: 'PLAID', sourceLabel: 'Plaid' };
  }
  if (type === 'CSV' || system.indexOf('CSV') !== -1) {
    return { sourceCode: 'CSV', sourceLabel: 'CSV' };
  }
  if (type === 'PDF' || system.indexOf('PDF') !== -1) {
    return { sourceCode: 'PDF', sourceLabel: 'PDF' };
  }
  if (type === 'FILE_IMPORT' || system.indexOf('OFX') !== -1 || system.indexOf('QFX') !== -1) {
    return { sourceCode: 'FILE_IMPORT', sourceLabel: 'File import' };
  }
  if (type === 'INSTITUTION' || authority === 'INSTITUTION_AUTHORITATIVE') {
    return { sourceCode: 'INSTITUTION', sourceLabel: 'Institution' };
  }
  if (type === 'STATEMENT' || authority === 'STATEMENT_DERIVED') {
    return { sourceCode: 'STATEMENT', sourceLabel: 'Statement' };
  }
  if (type === 'MANUAL' || type === 'LEGACY' || authority === 'USER_VERIFIED_MANUAL' ||
      authority === 'LEGACY_MANUAL' || hasPlanningValue) {
    return { sourceCode: 'MANUAL', sourceLabel: 'Manual' };
  }
  if (type && DATA_READINESS_APPROVED_SOURCES_[type]) {
    return { sourceCode: type, sourceLabel: type.charAt(0) + type.slice(1).toLowerCase() };
  }
  return { sourceCode: hasPlanningValue ? 'MANUAL' : '', sourceLabel: hasPlanningValue ? 'Manual' : 'Not yet available' };
}

function dataReadinessParseNumericEvidence_(raw) {
  if (raw === null || typeof raw === 'undefined' || raw === '') {
    return { present: false, valid: false, value: null };
  }
  if (typeof raw === 'number') {
    return isFinite(raw) ? { present: true, valid: true, value: raw } : { present: true, valid: false, value: null };
  }
  var text = String(raw).trim();
  if (!text) return { present: false, valid: false, value: null };
  var parsed = Number(text.replace(/\$/g, '').replace(/,/g, '').replace(/%/g, '').trim());
  if (!isFinite(parsed)) return { present: true, valid: false, value: null };
  return { present: true, valid: true, value: parsed };
}

function dataReadinessParseDateEvidence_(raw) {
  if (raw === null || typeof raw === 'undefined' || raw === '') {
    return { present: false, valid: false, value: null };
  }
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return { present: true, valid: true, value: raw };
  }
  if (typeof raw === 'number' && isFinite(raw)) {
    return { present: true, valid: true, value: raw };
  }
  var text = String(raw).trim();
  if (!text) return { present: false, valid: false, value: null };
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return { present: true, valid: true, value: text };
  var day = Number(text);
  if (isFinite(day) && day >= 1 && day <= 31) return { present: true, valid: true, value: text };
  if (!isNaN(Date.parse(text))) return { present: true, valid: true, value: text };
  return { present: true, valid: false, value: null };
}

function dataReadinessFactInTargetMonth_(fact, asOf) {
  if (!fact) return false;
  var freshness = fact.freshness || {};
  if (freshness.status === 'CURRENT' || freshness.status === 'RECENT' || freshness.safeToAct) {
    return true;
  }
  var iso = fact.effectiveAsOf || '';
  if (!iso) return false;
  var factDate = new Date(iso);
  var asOfDate = new Date(asOf || new Date());
  if (isNaN(factDate.getTime()) || isNaN(asOfDate.getTime())) return false;
  return factDate.getUTCFullYear() === asOfDate.getUTCFullYear() &&
    factDate.getUTCMonth() === asOfDate.getUTCMonth();
}

function dataReadinessEvaluateValueEvidence_(planningRaw, selection, identity, factType, asOf) {
  var dateField = factType === 'NEXT_PAYMENT_DATE';
  var parse = dateField ? dataReadinessParseDateEvidence_ : dataReadinessParseNumericEvidence_;
  var planning = parse(planningRaw);
  var fact = selection && selection.fact ? selection.fact : null;
  var importedRaw = fact
    ? (dateField ? (fact.textValue || fact.numericValue) : fact.numericValue)
    : null;
  var imported = parse(importedRaw);
  var freshness = (selection && selection.freshness) || { status: 'MISSING', safeToAct: false };
  var factForMonth = fact ? {
    effectiveAsOf: fact.effectiveAsOf,
    freshness: freshness
  } : null;
  var importedInMonth = imported.valid && dataReadinessFactInTargetMonth_(factForMonth, asOf);
  var source = dataReadinessCanonicalSource_(fact, planning.valid);
  var identityStatus = identity && identity.status && identity.status !== 'VERIFIED'
    ? String(identity.status).toUpperCase() : 'VERIFIED';
  var importedStale = imported.valid && !importedInMonth &&
    (freshness.status === 'STALE' || freshness.status === 'AGING' ||
      freshness.status === 'UNKNOWN' || (!freshness.safeToAct && freshness.status !== 'MISSING'));
  var malformed = (planning.present && !planning.valid) && !(imported.valid && importedInMonth);
  var stale = !planning.valid && importedStale;
  var missing = !planning.valid && !(imported.valid && importedInMonth) && !malformed;
  var valid = (planning.valid || importedInMonth) && identityStatus === 'VERIFIED' && !malformed && !stale;
  var status = identityStatus !== 'VERIFIED' ? 'IDENTITY_AMBIGUOUS' :
    malformed ? 'INVALID' : stale ? 'STALE' : missing ? 'MISSING' : 'CURRENT';
  var tone = status === 'CURRENT' ? 'current' :
    status === 'INVALID' || status === 'IDENTITY_AMBIGUOUS' ? 'error' : 'review';
  return {
    valid: !!valid,
    status: status,
    tone: tone,
    sourceCode: source.sourceCode,
    sourceLabel: source.sourceLabel,
    planningPresent: planning.present,
    planningValid: planning.valid,
    importedValid: imported.valid && importedInMonth,
    importedStale: !!importedStale
  };
}

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
  var providerReview = dataReadinessProviderReview_(cashRows, debtRows);
  cashRows.sort(dataReadinessAccountSort_);
  debtRows.sort(dataReadinessAccountSort_);
  var overall = dataReadinessCustomerState_(cashRows.length, debtRows.length,
    readiness, attention);
  var cashSummary = dataReadinessDomainSummary_('cash', cashRows);
  var debtSummary = dataReadinessDomainSummary_('debt', debtRows);
  var authority = dataReadinessAuthorityPresentation_(overall.code, cashSummary, debtSummary);
  return {
    version: DATA_READINESS_VIEW_VERSION_,
    generatedAt: financialFactIso_(new Date(), 'observedAt'),
    asOf: comparisonAt,
    authority: {
      planningUsesNormalizedData: false,
      status: 'SHADOW_ONLY',
      customerState: overall.code,
      planSourceHeadline: authority.planSourceHeadline,
      planSourceSupporting: authority.planSourceSupporting,
      importReadinessHeadline: authority.importReadinessHeadline,
      headline: authority.importReadinessHeadline,
      supporting: authority.supporting,
      customerMessage: 'Cash Compass uses every valid monthly value as evidence, whether you entered it or imported it. Planning, Net Worth, Cash Flow, and debt calculations still use your INPUT and SYS sheet values.'
    },
    summary: {
      status: overall.code,
      label: overall.label,
      message: overall.message,
      overviewHeadline: overall.overviewHeadline,
      overviewMessage: overall.overviewMessage,
      attentionEmptyMessage: overall.attentionEmptyMessage,
      pageHeadline: dataReadinessPageHeadline_(overall.code, attention.length),
      planningStatus: DATA_READINESS_COPY_.PLANNING_STATUS,
      optionalProviderSummary: dataReadinessOptionalProviderSummary_(providerReview.length),
      actionItemCount: attention.length,
      optionalReviewCount: providerReview.length,
      blockingCount: attention.filter(function(issue) { return issue.blocking || issue.blocksReadiness; }).length,
      attentionCount: attention.length,
      cashReadyCount: cashRows.filter(function(row) { return row.ready; }).length,
      cashAccountCount: cashRows.length,
      cardReadyCount: debtRows.filter(function(row) { return row.ready; }).length,
      cardAccountCount: debtRows.length,
      cashPresentation: cashSummary,
      cardPresentation: debtSummary,
      evidenceSourceLegend: DATA_READINESS_EVIDENCE_SOURCE_LEGEND_,
      cashSummaryLine: 'Cash data: ' + cashSummary.label,
      cardSummaryLine: 'Credit-card data: ' + debtSummary.label
    },
    cash: cashRows,
    debts: debtRows,
    attention: attention,
    providerReview: providerReview,
    weeklyPlanReadiness: dataReadinessWeeklyPresentation_(readiness,
      cashRows.length, debtRows.length, overall, cashRows, debtRows),
    unsupportedNote: DATA_READINESS_COPY_.UNSUPPORTED_NOTE,
    unsupportedDomains: dataReadinessUnsupportedDomains_()
  };
}

function dataReadinessCashRow_(account, links, factIndex, legacyIndex, asOf) {
  var selection = selectCurrentFinancialFactFromIndex_(factIndex,
    account.stableAccountId, 'CURRENT_BALANCE', asOf);
  var normalized = selection.fact ? Number(selection.fact.numericValue) : null;
  var hasLegacy = Object.prototype.hasOwnProperty.call(legacyIndex, account.stableAccountId);
  var legacy = hasLegacy ? legacyIndex[account.stableAccountId] : null;
  var reconciliation = cashImportReconcileValues_(legacy, normalized);
  var link = dataReadinessAccountLink_(links, account.stableAccountId);
  var fact = dataReadinessFactPresentation_(selection, 'CURRENT_BALANCE');
  var identity = dataReadinessIdentity_(account);
  var difference = reconciliation.difference;
  var evidence = dataReadinessEvaluateValueEvidence_(legacy, selection, identity,
    'CURRENT_BALANCE', asOf);
  if ((evidence.valid || evidence.planningValid) && (fact.status === 'MISSING' || fact.status === 'NEEDS_REFRESH' ||
      fact.status === 'INCOMPLETE')) {
    fact.status = 'CURRENT';
    fact.statusLabel = 'Current';
    fact.statusMessage = 'Valid ' + evidence.sourceLabel + ' evidence.';
    fact.safeToModel = true;
    fact.safeToAct = true;
  }
  var importedUnmatched = !link && !!(selection && selection.fact);
  var guidance = dataReadinessGuidanceFromEvidence_(evidence, identity,
    reconciliation.exactStatus, 'Balance', {
      importedUnmatched: importedUnmatched, domain: 'CASH',
      accountKey: account.stableAccountId, asOf: asOf
    });
  var customerStatus = guidance.status;
  var needsAttention = !!guidance.actionable;
  return {
    stableAccountId: account.stableAccountId,
    domain: 'CASH', displayName: account.displayName || 'Cash account',
    institution: account.institution || (link && link.institution) || '',
    maskedIdentifier: dataReadinessMaskedIdentifier_(account, link),
    planningValue: legacy, normalizedValue: normalized,
    difference: difference, differenceStatus: reconciliation.exactStatus,
    fact: fact, source: evidence.sourceLabel,
    sourceCode: evidence.sourceCode, sourceLabel: evidence.sourceLabel,
    evidenceStatus: evidence.status, evidenceTone: evidence.tone,
    identity: identity,     ready: !!(evidence.valid || evidence.planningValid), needsAttention: needsAttention,
    customerStatus: customerStatus,
    reviewStatus: dataReadinessPresentationLabel_(customerStatus),
    guidance: guidance,
    optionalItems: guidance.optionalItems || [],
    refreshMethod: link ? 'Imported provider available' : 'Manual entry or import',
    providerReview: (guidance.optionalItems || []).map(function(item) {
      return { title: item.title || 'Optional imported evidence to review',
        message: DATA_READINESS_COPY_.REASON_OPTIONAL };
    }),
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
    var evidence = dataReadinessEvaluateValueEvidence_(comparison.legacyValue,
      comparison.selection, identity, definition.type, asOf);
    presentation.evidenceStatus = evidence.status;
    presentation.evidenceTone = evidence.tone;
    presentation.sourceCode = evidence.sourceCode;
    presentation.sourceLabel = evidence.sourceLabel;
    presentation.evidenceValid = !!(evidence.valid || evidence.planningValid);
    if ((evidence.valid || evidence.planningValid) && (presentation.status === 'MISSING' ||
        presentation.status === 'NEEDS_REFRESH' || presentation.status === 'INCOMPLETE')) {
      presentation.status = 'CURRENT';
      presentation.statusLabel = 'Current';
      presentation.statusMessage = 'Valid ' + evidence.sourceLabel + ' evidence.';
      presentation.safeToModel = true;
      presentation.safeToAct = true;
    }
    presentation.guidance = dataReadinessGuidanceFromEvidence_(evidence, identity,
      comparison.reconciliationStatus, definition.label, {
        aprAmbiguous: definition.type === 'APR' &&
          diagnostics.indexOf('MULTIPLE_APR_REVIEW_REQUIRED') !== -1,
        domain: 'DEBT',
        accountKey: account.stableAccountId,
        asOf: asOf
      });
    return presentation;
  });
  var planningComplete = facts.every(function(fact) { return !!fact.evidenceValid; });
  var needsAttention = facts.some(function(fact) {
    return fact.guidance && fact.guidance.actionable;
  });
  var ready = planningComplete;
  var optionalItems = [];
  facts.forEach(function(fact) {
    (fact.guidance && fact.guidance.optionalItems || []).forEach(function(item) {
      optionalItems.push(item);
    });
  });
  if (diagnostics.indexOf('MULTIPLE_APR_REVIEW_REQUIRED') !== -1) {
    var hasAprOptional = optionalItems.some(function(item) {
      return item.title === 'APR needs review';
    });
    if (!hasAprOptional) {
      optionalItems.push(dataReadinessOptionalImportedItem_(DATA_READINESS_COPY_.REASON_OPTIONAL, {
        title: 'APR needs review', fieldLabel: 'APR', domain: 'DEBT',
        accountKey: account.stableAccountId, asOf: asOf
      }));
    }
  }
  var identityGuidance = identity.status !== 'VERIFIED'
    ? dataReadinessGuidanceFromEvidence_({ status: 'IDENTITY_AMBIGUOUS', planningValid: planningComplete },
      identity, 'UNAVAILABLE', 'Account', {
        domain: 'DEBT', accountKey: account.stableAccountId, asOf: asOf
      })
    : null;
  if (identityGuidance && identityGuidance.optionalItems) {
    identityGuidance.optionalItems.forEach(function(item) { optionalItems.push(item); });
  }
  if (identityGuidance && identityGuidance.actionable) needsAttention = true;
  var providerReview = optionalItems.map(function(item) {
    return {
      title: item.title || 'Optional imported evidence to review',
      message: DATA_READINESS_COPY_.REASON_OPTIONAL
    };
  });
  var customerStatus = dataReadinessDebtRowCustomerStatus_(identity, facts, diagnostics);
  var rowGuidance = identityGuidance && identityGuidance.actionable ? identityGuidance :
    dataReadinessAggregateGuidance_(facts.map(function(fact) { return fact.guidance; }),
      customerStatus);
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
    ready: ready,
    needsAttention: needsAttention,
    customerStatus: customerStatus,
    reviewStatus: dataReadinessPresentationLabel_(customerStatus),
    guidance: rowGuidance,
    optionalItems: optionalItems,
    identity: identity,
    sourceCode: (facts[0] && facts[0].sourceCode) || 'MANUAL',
    sourceLabel: (facts[0] && facts[0].sourceLabel) || 'Manual',
    evidenceStatus: ready ? 'CURRENT' : (needsAttention ? 'MISSING' : 'CURRENT'),
    evidenceTone: identity.status !== 'VERIFIED' ? 'error' : (ready ? 'current' : 'review'),
    refreshMethod: link ? 'Imported provider available' : 'Manual entry or import',
    providerReview: providerReview,
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
  return dataReadinessCanonicalSource_(fact, false).sourceLabel;
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

function dataReadinessAggregateGuidance_(guidances, fallbackStatus) {
  var items = (guidances || []).filter(Boolean);
  var actionable = items.filter(function(item) { return item.actionable; });
  var copy = DATA_READINESS_COPY_;
  if (!actionable.length) {
    return dataReadinessGuidanceRecord_(fallbackStatus || 'CURRENT',
      fallbackStatus === 'NOT_CONNECTED' ? copy.REASON_NOT_CONNECTED :
        (items[0] && items[0].reason) || copy.REASON_VALID_SHEET,
      copy.IMPACT_USING, fallbackStatus === 'NOT_CONNECTED' ? copy.ACTION_NONE : copy.ACTION_CURRENT);
  }
  var blocking = actionable.filter(function(item) { return item.blocking; })[0];
  var review = actionable.filter(function(item) { return item.status === 'NEEDS_REVIEW'; })[0];
  var missing = actionable.filter(function(item) { return item.status === 'MORE_DATA_NEEDED'; })[0];
  var chosen = blocking || review || missing || actionable[0];
  var reasons = [];
  actionable.forEach(function(item) {
    if (item.reason && reasons.indexOf(item.reason) === -1) reasons.push(item.reason);
  });
  chosen = dataReadinessGuidanceRecord_(chosen.status, reasons.join(' '),
    chosen.planningImpact, chosen.nextAction, {
      blocking: !!chosen.blocking, kind: chosen.kind, title: chosen.title,
      fieldLabel: chosen.fieldLabel, navigatePage: chosen.navigatePage,
      navigateTab: chosen.navigateTab, reviewRoute: chosen.reviewRoute,
      actionKind: chosen.actionKind, accountKey: chosen.accountKey,
      cycleKey: chosen.cycleKey, asOf: chosen.asOf, hasAction: !!chosen.hasAction
    });
  chosen.reasons = reasons;
  return chosen;
}

function dataReadinessEmptyGuidance_(noun) {
  return dataReadinessGuidanceRecord_('NOT_CONNECTED', DATA_READINESS_COPY_.REASON_NOT_CONNECTED,
    DATA_READINESS_COPY_.IMPACT_UNAFFECTED, DATA_READINESS_COPY_.ACTION_NONE, {
      informational: true, fieldLabel: noun || ''
    });
}

function dataReadinessWeeklyDimensionGuidance_(status, label) {
  var copy = DATA_READINESS_COPY_;
  if (status === 'NOT_CONNECTED') {
    return dataReadinessEmptyGuidance_(label);
  }
  if (status === 'MORE_DATA_NEEDED' || status === 'NEEDS_ATTENTION') {
    return dataReadinessGuidanceRecord_('MORE_DATA_NEEDED', copy.REASON_MISSING,
      copy.IMPACT_UNAFFECTED, dataReadinessOpenAction_('', label), { kind: 'MISSING' });
  }
  if (status === 'NEEDS_REVIEW') {
    return dataReadinessGuidanceRecord_('NEEDS_REVIEW', copy.REASON_STALE,
      copy.IMPACT_USING, copy.ACTION_COMPARE, { kind: 'REVIEW' });
  }
  return dataReadinessGuidanceRecord_('CURRENT', copy.REASON_VALID_SHEET,
    copy.IMPACT_USING, copy.ACTION_CURRENT);
}

function dataReadinessRowActionableItems_(row) {
  var items = [];
  if (!row) return items;
  if (row.facts && row.facts.length) {
    if (row.identity && row.identity.status !== 'VERIFIED') {
      if (row.guidance && row.guidance.actionable) items.push(row.guidance);
      return items;
    }
    row.facts.forEach(function(fact) {
      if (fact.guidance && fact.guidance.actionable) items.push(fact.guidance);
    });
    return items;
  }
  if (row.guidance && row.guidance.actionable) items.push(row.guidance);
  return items;
}

function dataReadinessRowOptionalItems_(row) {
  if (row && row.optionalItems && row.optionalItems.length) return row.optionalItems.slice();
  var items = [];
  if (row && row.guidance && row.guidance.optionalItems) {
    row.guidance.optionalItems.forEach(function(item) { items.push(item); });
  }
  ((row && row.facts) || []).forEach(function(fact) {
    ((fact.guidance && fact.guidance.optionalItems) || []).forEach(function(item) {
      items.push(item);
    });
  });
  return items;
}

function dataReadinessGroupedCard_(row, items, optional) {
  var copy = DATA_READINESS_COPY_;
  var status = optional ? 'READY_FOR_REVIEW' : dataReadinessAggregateGuidance_(items,
    row.customerStatus || 'CURRENT').status;
  var reasons = [];
  var titles = [];
  items.forEach(function(item) {
    var reason = optional ? (item.reason || copy.REASON_OPTIONAL) : item.reason;
    if (reason && reasons.indexOf(reason) === -1) reasons.push(reason);
    if (item.title && titles.indexOf(item.title) === -1) titles.push(item.title);
  });
  var primary = items[0] || {};
  var blocking = items.some(function(item) { return item.blocking; });
  var identityRoute = !optional && items.some(function(item) {
    return item.reviewRoute === 'identity' || dataReadinessIsIdentityReason_(item.reason, item.title);
  });
  var unmatchedOptional = optional && items.some(function(item) {
    return dataReadinessIsIdentityReason_(item.reason, item.title);
  });
  var primaryTitle = titles.indexOf('APR needs review') !== -1 ? 'APR needs review' :
    (titles[0] || (optional ? 'Optional imported evidence to review' : 'Review data'));
  var nav = dataReadinessNavigateForDomain_(row.domain || primary.domain);
  var reviewRoute = optional ? '' :
    (primary.reviewRoute || (blocking && identityRoute ? 'identity' : 'editor'));
  var actionKind = optional ? '' :
    (primary.actionKind || (reviewRoute === 'identity' ? 'IDENTITY' : 'UPDATE'));
  var nextAction = optional ? '' : (primary.nextAction || copy.ACTION_NONE);
  var reason = unmatchedOptional ? copy.REASON_OPTIONAL_UNMATCHED :
    (optional ? copy.REASON_OPTIONAL : (reasons[0] || primary.reason || ''));
  return {
    stableAccountId: row.stableAccountId,
    accountKey: row.stableAccountId || primary.accountKey || '',
    accountName: row.displayName,
    domain: row.domain,
    status: status,
    statusLabel: dataReadinessPresentationLabel_(status),
    title: primaryTitle,
    message: unmatchedOptional ? copy.REASON_OPTIONAL_UNMATCHED :
      (optional ? copy.REASON_OPTIONAL : (reasons[0] || primary.reason || '')),
    reason: reason,
    reasons: unmatchedOptional ? [copy.REASON_OPTIONAL_UNMATCHED] : reasons,
    planningImpact: blocking ? copy.IMPACT_BLOCKING :
      (unmatchedOptional ? '' :
        (optional ? copy.IMPACT_USING : (primary.planningImpact || copy.IMPACT_UNAFFECTED))),
    nextAction: nextAction,
    items: items,
    kind: primary.kind || (optional ? 'REVIEW' : 'MISSING'),
    blocksReadiness: blocking,
    blocking: blocking,
    actionable: !optional,
    hasAction: !optional,
    optional: !!optional,
    reviewRoute: reviewRoute,
    actionKind: actionKind,
    navigatePage: optional || reviewRoute === '' ? '' : (primary.navigatePage || nav.navigatePage),
    navigateTab: optional || reviewRoute === '' ? '' : (primary.navigateTab || nav.navigateTab),
    cycleKey: primary.cycleKey || '',
    asOf: primary.asOf || '',
    fieldLabel: primary.fieldLabel || ''
  };
}

function dataReadinessNavigationTarget_(card) {
  var item = card || {};
  if (item.optional || !item.hasAction) {
    return {
      reviewRoute: '',
      actionKind: '',
      navigatePage: '',
      navigateTab: '',
      accountKey: item.accountKey || item.stableAccountId || '',
      cycleKey: item.cycleKey || '',
      domain: item.domain || '',
      reason: item.reason || ''
    };
  }
  return {
    reviewRoute: item.reviewRoute || (item.actionKind === 'IDENTITY' ? 'identity' : 'editor'),
    actionKind: item.actionKind || (item.reviewRoute === 'identity' ? 'IDENTITY' : 'UPDATE'),
    navigatePage: item.navigatePage || 'assets',
    navigateTab: item.navigateTab || '',
    accountKey: item.accountKey || item.stableAccountId || '',
    cycleKey: item.cycleKey || '',
    domain: item.domain || '',
    reason: item.reason || ''
  };
}

function dataReadinessAttention_(cashRows, debtRows) {
  var cards = [];
  function pushRow(row) {
    var items = dataReadinessRowActionableItems_(row);
    if (!items.length) return;
    cards.push(dataReadinessGroupedCard_(row, items, false));
  }
  (cashRows || []).forEach(pushRow);
  (debtRows || []).forEach(pushRow);
  cards.sort(function(a, b) {
    return String(a.accountName || '').localeCompare(String(b.accountName || ''));
  });
  return cards;
}

function dataReadinessProviderReview_(cashRows, debtRows) {
  var cards = [];
  function pushRow(row) {
    var items = dataReadinessRowOptionalItems_(row);
    if (!items.length) return;
    cards.push(dataReadinessGroupedCard_(row, items, true));
  }
  (cashRows || []).forEach(pushRow);
  (debtRows || []).forEach(pushRow);
  return cards;
}

function dataReadinessIssue_(priority, blocks, row, title, message, factType, kind) {
  return { priority: priority, blocksReadiness: !!blocks,
    domain: row.domain, stableAccountId: row.stableAccountId,
    accountName: row.displayName, factType: factType || '',
    title: title, message: message,
    kind: dataReadinessIssueKind_({ kind: kind, title: title }) };
}

function dataReadinessWeeklyDomainStatus_(accountCount, rows) {
  if (Number(accountCount || 0) <= 0) return 'NOT_CONNECTED';
  if (rows && rows.length) return dataReadinessRowsCustomerStatus_(rows);
  return 'MORE_DATA_NEEDED';
}

function dataReadinessWeeklyPresentation_(readiness, cashAccountCount, debtAccountCount, customerState, cashRows, debtRows) {
  var cashReady = (cashRows || []).filter(function(row) { return row.ready; }).length;
  var debtReady = (debtRows || []).filter(function(row) { return row.ready; }).length;
  var cashCount = Number(cashAccountCount || 0);
  var debtCount = Number(debtAccountCount || 0);
  var cashStatus = dataReadinessWeeklyDomainStatus_(cashCount, cashRows);
  var debtStatus = dataReadinessWeeklyDomainStatus_(debtCount, debtRows);
  var rows = [
    ['Cash data', cashCount, cashReady, cashStatus],
    ['Card balances', debtCount, debtReady, debtStatus],
    ['Interest rates', debtCount, debtReady, debtStatus],
    ['Minimum payments', debtCount, debtReady, debtStatus],
    ['Due dates', debtCount, debtReady, debtStatus],
    ['Exact payoff', debtCount, debtReady, debtStatus]
  ].map(function(row) {
    var status = row[3];
    var guidance = dataReadinessWeeklyDimensionGuidance_(status, row[0]);
    return { label: row[0], status: status,
      statusLabel: dataReadinessDimensionLabel_(status),
      readyCount: status === 'NOT_CONNECTED' ? 0 : row[2],
      accountCount: row[1],
      countLabel: status === 'NOT_CONNECTED' ? '' : row[2] + ' / ' + row[1],
      reason: guidance.reason,
      planningImpact: guidance.planningImpact,
      nextAction: guidance.nextAction };
  });
  var state = customerState || dataReadinessCustomerState_(cashAccountCount,
    debtAccountCount, readiness, []);
  return { status: state.code, statusLabel: state.planStatusLabel,
    message: state.planMessage,
    authoritySwitched: false, dimensions: rows,
    providerReadiness: readiness || null };
}

function dataReadinessDimensionLabel_(status) {
  return dataReadinessPresentationLabel_(status);
}

function dataReadinessCustomerState_(cashAccountCount, debtAccountCount, readiness, attention) {
  var cashConnected = Number(cashAccountCount || 0) > 0;
  var debtConnected = Number(debtAccountCount || 0) > 0;
  if (!cashConnected && !debtConnected) {
    return dataReadinessStateRecord_('NOT_CONNECTED',
      'Cash and credit-card accounts are not connected yet.',
      'Cash and credit-card data still need to be added or verified.',
      'Add cash and credit-card accounts before readiness can be evaluated.');
  }
  var issues = (attention || []).filter(function(issue) { return !issue.optional; });
  var hasReview = false;
  var hasMissing = false;
  issues.forEach(function(issue) {
    var kind = dataReadinessIssueKind_(issue);
    if (kind === 'MISSING') hasMissing = true;
    else hasReview = true;
  });
  if (hasReview) {
    return dataReadinessStateRecord_('NEEDS_REVIEW',
      issues.length + ' item' + (issues.length === 1 ? ' needs' : 's need') + ' review.',
      'Some cash or credit-card values are malformed or identity-ambiguous. Planning continues using CashCompass sheet values.',
      'Some required values still need review. Planning still uses CashCompass INPUT and SYS sheet values.');
  }
  if (hasMissing) {
    return dataReadinessStateRecord_('MORE_DATA_NEEDED',
      'A connected account is missing required monthly fields.',
      'Add the missing monthly values. Manual entry and imports both count.',
      'Required monthly fields are still missing on a connected account. Planning still uses CashCompass INPUT and SYS sheet values.');
  }
  return dataReadinessStateRecord_('CURRENT',
    'Required monthly evidence is valid and current.',
    'Required cash and credit-card values are present for this period.',
    'Required monthly evidence is valid and current. Planning still uses CashCompass INPUT and SYS sheet values.');
}

function dataReadinessDomainSummary_(domain, rows) {
  var accountRows = rows || [];
  var isCash = domain === 'cash';
  var noun = isCash ? 'cash' : 'credit-card';
  if (!accountRows.length) {
    return { status: 'NOT_CONNECTED',
      label: dataReadinessPresentationLabel_('NOT_CONNECTED'),
      countLabel: dataReadinessPresentationLabel_('NOT_CONNECTED'),
      readyCount: 0, accountCount: 0,
      note: 'No ' + noun + ' accounts yet.',
      emptyMessage: isCash
        ? 'No cash accounts yet. Your weekly plan continues using your existing bank-account values.'
        : 'No credit-card accounts yet. Your weekly plan continues using your existing debt values.',
      reason: DATA_READINESS_COPY_.REASON_NOT_CONNECTED,
      planningImpact: DATA_READINESS_COPY_.IMPACT_UNAFFECTED,
      nextAction: DATA_READINESS_COPY_.ACTION_NONE,
      guidance: dataReadinessEmptyGuidance_(noun) };
  }
  var status = dataReadinessRowsCustomerStatus_(accountRows);
  var ready = accountRows.filter(function(row) { return row.ready; }).length;
  return { status: status,
    label: dataReadinessPresentationLabel_(status),
    countLabel: ready + ' of ' + accountRows.length + ' current',
    readyCount: ready, accountCount: accountRows.length,
    note: 'Evidence source: ' + DATA_READINESS_EVIDENCE_SOURCE_LEGEND_,
    emptyMessage: '' };
}

function dataReadinessAuthorityPresentation_(state, cashSummary, debtSummary) {
  var planSourceHeadline = 'Planning uses the existing CashCompass values from INPUT/SYS sheets.';
  var planSourceSupporting = DATA_READINESS_COPY_.PLANNING_STATUS;
  var cashLine = 'Cash data: ' + ((cashSummary && cashSummary.label) ||
    dataReadinessPresentationLabel_('NOT_CONNECTED'));
  var cardLine = 'Credit-card data: ' + ((debtSummary && debtSummary.label) ||
    dataReadinessPresentationLabel_('NOT_CONNECTED'));
  var sourceLine = 'Evidence source: ' + DATA_READINESS_EVIDENCE_SOURCE_LEGEND_;
  var headline = 'Data readiness: ' + dataReadinessPresentationLabel_(state);
  return {
    planSourceHeadline: planSourceHeadline,
    planSourceSupporting: planSourceSupporting,
    evidenceReadinessHeadline: headline,
    importReadinessHeadline: headline,
    headline: headline,
    cashSummaryLine: cashLine,
    cardSummaryLine: cardLine,
    evidenceSourceLegend: sourceLine,
    supporting: planSourceSupporting
  };
}

function dataReadinessDebtReviewLabel_(diagnostics, facts) {
  return dataReadinessPresentationLabel_(dataReadinessDebtRowCustomerStatus_(
    { status: 'VERIFIED' }, facts, diagnostics));
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
