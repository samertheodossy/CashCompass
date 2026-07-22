/**
 * Financial Integrity Audit framework — Stage 2 Product Hardening.
 *
 * Read-only, admin-gated diagnostics that prove the approved Financial
 * Integrity Phase 3 canonical basis and surface reconciliation blockers. The
 * output never mutates the workbook.
 *
 * Hard guarantees for every function in this file:
 *   - Read-only. No sheet writes, no dashboard/planner/history writes, no
 *     touchDashboardSourceUpdated_(), no workbook mutations of any kind.
 *   - Admin-only at the UI seam (adminUiGetFinancialIntegrityAudit()).
 *   - Reconciliation differences are observations. Only audit execution or
 *     source-read problems produce a FAILURE / FAIL status. Release gating is
 *     wired separately after these modules are runtime-proven.
 *
 * Architecture:
 *   runFinancialIntegrityAudit()            — master aggregator
 *     -> runDebtAudit()
 *     -> runAssetAudit()
 *     -> runPlannerAudit()
 *     -> runDashboardAudit()
 *     -> runHistoryAudit()
 *
 * Modules are registered as metadata in getFinancialAuditModules_() so adding
 * a future audit is: write the function, add one registry entry. The master
 * aggregator and the generic Admin Diagnostics renderer need no changes.
 */

/* -------------------------------------------------------------------------- */
/*  Framework constants                                                       */
/* -------------------------------------------------------------------------- */

var FINANCIAL_AUDIT_TOLERANCE_USD_ = 0.01;

var FINANCIAL_AUDIT_STATUS_ = {
  PASS: 'PASS',
  PASS_WITH_OBSERVATIONS: 'PASS_WITH_OBSERVATIONS',
  // Informational, non-error state: the workbook is still in bootstrap/blank
  // state (no financial sheets) so there is nothing to audit. This is NOT a
  // failure — nothing is wrong, the workbook simply hasn't been set up.
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  FAIL: 'FAIL'
};

/**
 * Informational message shown when the workbook has not been initialized.
 */
var FINANCIAL_AUDIT_NOT_INITIALIZED_MESSAGE_ =
  'This workbook has not been initialized yet.\n' +
  'Financial Integrity Audit requires a completed CashCompass workbook.';

/**
 * Numeric precedence for status escalation. A result can only ever move to a
 * more severe status, never back down.
 */
function financialAuditStatusRank_(status) {
  if (status === FINANCIAL_AUDIT_STATUS_.FAIL) return 2;
  if (status === FINANCIAL_AUDIT_STATUS_.PASS_WITH_OBSERVATIONS) return 1;
  return 0; // PASS (or unknown → treated as PASS)
}

/* -------------------------------------------------------------------------- */
/*  Reusable audit-result builders (used by every module)                     */
/* -------------------------------------------------------------------------- */

/**
 * Creates a fresh module result. Starts optimistic at PASS; helpers escalate.
 * @param {string} name  stable module id (e.g. 'debt')
 * @returns {{name:string, status:string, checks:!Array, warnings:!Array,
 *            failures:!Array, metrics:!Object}}
 */
function newAuditResult_(name) {
  return {
    name: String(name || ''),
    status: FINANCIAL_AUDIT_STATUS_.PASS,
    checks: [],
    warnings: [],
    failures: [],
    metrics: {}
  };
}

/** Escalates a result's status (never de-escalates). */
function auditPromoteStatus_(result, status) {
  if (financialAuditStatusRank_(status) > financialAuditStatusRank_(result.status)) {
    result.status = status;
  }
}

/**
 * Records a neutral check. `observed` is a boolean only when there is a
 * genuine yes/no fact (e.g. "Active column present"); for pure measurements
 * pass null and put numbers in `extra`.
 */
function auditAddCheck_(result, id, label, observed, detail, extra) {
  var check = {
    id: String(id || ''),
    label: String(label || ''),
    observed: (observed === null || observed === undefined) ? null : !!observed,
    detail: String(detail == null ? '' : detail)
  };
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(function(k) { check[k] = extra[k]; });
  }
  result.checks.push(check);
  return check;
}

/**
 * Records an observed difference / non-fatal note. Escalates status to
 * PASS_WITH_OBSERVATIONS (never FAIL). This is how financial divergences are
 * reported — as observations, not verdicts.
 */
function auditAddWarning_(result, code, message, data) {
  result.warnings.push({
    code: String(code || ''),
    message: String(message == null ? '' : message),
    data: (data && typeof data === 'object') ? data : {}
  });
  auditPromoteStatus_(result, FINANCIAL_AUDIT_STATUS_.PASS_WITH_OBSERVATIONS);
}

/**
 * Records an execution failure (could not compute something). Escalates
 * status to FAIL. Reserved for audit machinery problems, NOT for financial
 * differences.
 */
function auditAddFailure_(result, code, message) {
  result.failures.push({
    code: String(code || ''),
    message: String(message == null ? '' : message)
  });
  auditPromoteStatus_(result, FINANCIAL_AUDIT_STATUS_.FAIL);
}

/** Sets a metric value on the result. */
function auditSetMetric_(result, key, value) {
  result.metrics[key] = value;
}

/**
 * Marks a result as NOT_INITIALIZED (informational, non-error) and attaches a
 * human-readable message. Callers should return immediately after this.
 */
function auditMarkNotInitialized_(result, message) {
  result.status = FINANCIAL_AUDIT_STATUS_.NOT_INITIALIZED;
  result.message = String(message == null ? '' : message);
}

/**
 * True when the workbook has real financial/app sheets to audit. Read-only.
 * Reuses the app's canonical blank-workbook detector (workbookHasAnyAppSheet_,
 * sheet_bootstrap.js), which ignores the seed-only INPUT - Settings / SYS -
 * Meta scaffolding. Fails closed to "initialized" (true) so a real, populated
 * workbook is never mislabeled as uninitialized because of a probe hiccup.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {boolean}
 */
function financialAuditWorkbookInitialized_(ss) {
  try {
    if (!ss) return true;
    return !!workbookHasAnyAppSheet_(ss);
  } catch (_e) {
    return true;
  }
}

/** Signed money delta a - b, rounded to cents. */
function auditDelta_(a, b) {
  return round2_(toNumber_(a) - toNumber_(b));
}

/** True when |a - b| is within the money tolerance. */
function auditWithinTolerance_(a, b, tol) {
  var t = (tol === null || tol === undefined) ? FINANCIAL_AUDIT_TOLERANCE_USD_ : tol;
  return Math.abs(toNumber_(a) - toNumber_(b)) <= t;
}

/* -------------------------------------------------------------------------- */
/*  Metadata-driven module registry                                          */
/* -------------------------------------------------------------------------- */

/**
 * The audit registry. Each entry is metadata; `fn` returns a module result
 * built with newAuditResult_/auditAdd*. Add future modules here — nothing
 * else in the framework or UI needs to change.
 *
 * @returns {!Array<{id:string, title:string, order:number, enabled:boolean,
 *                    version:number, fn:!Function}>}
 */
function getFinancialAuditModules_() {
  return [
    {
      id: 'debt',
      title: 'Debt Integrity',
      order: 10,
      enabled: true,
      version: 2,
      fn: runDebtAudit
    },
    {
      id: 'assets',
      title: 'Asset Integrity',
      order: 20,
      enabled: true,
      version: 1,
      fn: runAssetAudit
    },
    {
      id: 'planner',
      title: 'Planner Integrity',
      order: 30,
      enabled: true,
      version: 1,
      fn: runPlannerAudit
    },
    {
      id: 'dashboard',
      title: 'Dashboard Integrity',
      order: 40,
      enabled: true,
      version: 1,
      fn: runDashboardAudit
    },
    {
      id: 'history',
      title: 'History Freshness',
      order: 50,
      enabled: true,
      version: 1,
      fn: runHistoryAudit
    }
  ];
}

/* -------------------------------------------------------------------------- */
/*  Master aggregator                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Runs every enabled audit module (in `order`) and aggregates the results
 * into one report. Read-only. A module that throws is caught and recorded as
 * its own FAIL module so the rest of the report still renders.
 *
 * @returns {!Object} aggregated audit report (see file header / design doc)
 */
function runFinancialIntegrityAudit(explicitSpreadsheet, options) {
  options = options || {};
  var suppliedHistorySnapshot =
    Object.prototype.hasOwnProperty.call(options, 'historySnapshot')
      ? options.historySnapshot
      : null;
  // Early informational short-circuit: if the caller's workbook is still in
  // bootstrap/blank state (no financial sheets), there is nothing to audit.
  // Report NOT_INITIALIZED rather than letting each module FAIL on missing
  // sheets. Read-only; if the workbook can't be resolved we skip this check
  // and let the modules run (they surface a genuine FAIL).
  var ssForInit = explicitSpreadsheet || null;
  try {
    if (!ssForInit) ssForInit = getUserSpreadsheet_();
  } catch (_e) {
    ssForInit = null;
  }
  if (ssForInit && !financialAuditWorkbookInitialized_(ssForInit)) {
    return {
      status: FINANCIAL_AUDIT_STATUS_.NOT_INITIALIZED,
      generatedAt: new Date().toISOString(),
      toleranceUsd: FINANCIAL_AUDIT_TOLERANCE_USD_,
      message: FINANCIAL_AUDIT_NOT_INITIALIZED_MESSAGE_,
      summary: { moduleCount: 0, warningCount: 0, failureCount: 0 },
      modules: []
    };
  }

  var modules = getFinancialAuditModules_()
    .filter(function(m) { return m && m.enabled; })
    .sort(function(a, b) { return (a.order || 0) - (b.order || 0); });

  var results = [];
  var overall = FINANCIAL_AUDIT_STATUS_.PASS;
  var warningCount = 0;
  var failureCount = 0;
  var canonicalSnapshot = null;
  var canonicalReadError = null;
  if (ssForInit) {
    try {
      canonicalSnapshot = readCanonicalFinancialSnapshot_(ssForInit);
    } catch (err) {
      canonicalReadError = err;
    }
  }

  modules.forEach(function(m) {
    var moduleResult;
    try {
      moduleResult = m.fn(ssForInit, canonicalSnapshot, canonicalReadError,
        suppliedHistorySnapshot);
      if (!moduleResult || typeof moduleResult !== 'object') {
        moduleResult = newAuditResult_(m.id);
        auditAddFailure_(moduleResult, 'EMPTY_RESULT',
          'Audit module returned no result.');
      }
    } catch (err) {
      moduleResult = newAuditResult_(m.id);
      auditAddFailure_(moduleResult, 'MODULE_THREW',
        'Audit module threw: ' + (err && err.message ? err.message : err));
    }

    warningCount += (moduleResult.warnings || []).length;
    failureCount += (moduleResult.failures || []).length;
    if (financialAuditStatusRank_(moduleResult.status) >
        financialAuditStatusRank_(overall)) {
      overall = moduleResult.status;
    }

    results.push({
      id: m.id,
      title: m.title,
      order: m.order,
      version: m.version,
      name: moduleResult.name,
      status: moduleResult.status,
      message: moduleResult.message || '',
      checks: moduleResult.checks,
      warnings: moduleResult.warnings,
      failures: moduleResult.failures,
      metrics: moduleResult.metrics
    });
  });

  // Defensive: if every module independently reported NOT_INITIALIZED (e.g. the
  // early short-circuit was skipped because the workbook couldn't be resolved
  // there), surface NOT_INITIALIZED overall rather than a misleading PASS.
  var report = {
    status: overall,
    generatedAt: new Date().toISOString(),
    toleranceUsd: FINANCIAL_AUDIT_TOLERANCE_USD_,
    summary: {
      moduleCount: results.length,
      warningCount: warningCount,
      failureCount: failureCount
    },
    modules: results
  };

  if (results.length > 0 &&
      results.every(function(r) { return r.status === FINANCIAL_AUDIT_STATUS_.NOT_INITIALIZED; })) {
    report.status = FINANCIAL_AUDIT_STATUS_.NOT_INITIALIZED;
    report.message = FINANCIAL_AUDIT_NOT_INITIALIZED_MESSAGE_;
  }

  return report;
}

/* -------------------------------------------------------------------------- */
/*  Phase 3 canonical audit helpers and modules                              */
/* -------------------------------------------------------------------------- */

function financialAuditModuleContext_(result, explicitSpreadsheet,
    suppliedSnapshot, suppliedReadError) {
  var ss = explicitSpreadsheet || null;
  try {
    if (!ss) ss = getUserSpreadsheet_();
  } catch (err) {
    auditAddFailure_(result, 'NO_SPREADSHEET',
      'Could not resolve workbook: ' + (err && err.message ? err.message : err));
    return null;
  }
  if (!ss) {
    auditAddFailure_(result, 'NO_SPREADSHEET', 'No active workbook available.');
    return null;
  }
  if (!financialAuditWorkbookInitialized_(ss)) {
    auditMarkNotInitialized_(result, FINANCIAL_AUDIT_NOT_INITIALIZED_MESSAGE_);
    return null;
  }
  if (suppliedReadError) {
    auditAddFailure_(result, 'CANONICAL_SNAPSHOT_FAILED',
      'Canonical snapshot failed: ' +
      (suppliedReadError.message || suppliedReadError));
    return null;
  }
  var snapshot = suppliedSnapshot;
  if (!snapshot) {
    try {
      snapshot = readCanonicalFinancialSnapshot_(ss);
    } catch (err2) {
      auditAddFailure_(result, 'CANONICAL_SNAPSHOT_FAILED',
        'Canonical snapshot failed: ' +
        (err2 && err2.message ? err2.message : err2));
      return null;
    }
  }
  return { ss: ss, snapshot: snapshot };
}

function auditCanonicalDelta_(result, deltas, key, actual, expected, label) {
  var delta = auditDelta_(actual, expected);
  deltas[key] = delta;
  if (Math.abs(delta) > FINANCIAL_AUDIT_TOLERANCE_USD_) {
    auditAddWarning_(result, 'CANONICAL_RECONCILIATION_DIFFERENCE',
      label + ' differs from the canonical basis by ' + delta + '.',
      { comparison: key, deltaUsd: delta });
  }
}

function auditCanonicalAssetSnapshot_(snapshot) {
  var result = newAuditResult_('assets');
  var snap = snapshot || {};
  var sources = snap.sources || {};
  var mirrors = snap.mirrors || {};
  var financing = snap.propertyFinancing || {};

  ['cash', 'investments', 'properties'].forEach(function(domain) {
    var available = !!(sources[domain] && sources[domain].available);
    auditAddCheck_(result, domain + '_source_available',
      domain + ' authoritative source available', available,
      available ? 'Authoritative input ledger read.' :
        'Source is missing or unreadable.');
    if (!available) {
      auditAddFailure_(result, 'CANONICAL_SOURCE_UNAVAILABLE',
        'Authoritative ' + domain + ' source is missing or unreadable.');
    }

    var mirror = mirrors[domain] || {};
    auditAddCheck_(result, domain + '_mirror_matches',
      domain + ' source and mirror reconcile', !!mirror.matches,
      mirror.available === false ? 'Mirror is missing or unreadable.' :
        ('difference ' + String(
          mirror.difference == null ? 'unknown' : mirror.difference)));
    if (mirror.available === false) {
      auditAddFailure_(result, 'CANONICAL_MIRROR_UNAVAILABLE',
        'Runtime ' + domain + ' mirror is missing or unreadable.');
    } else if (!mirror.matches) {
      auditAddWarning_(result, 'CANONICAL_MIRROR_MISMATCH',
        domain + ' source and runtime mirror differ by ' +
        String(mirror.difference == null ?
          'an unknown amount' : mirror.difference) + '.',
        {
          domain: domain,
          differenceUsd: mirror.difference,
          rowDifferences: mirror.rowDifferences || []
        });
    }
  });

  var propertyBlocked = financing.status === 'BLOCKED' ||
    (financing.blockingIssues || []).length > 0;
  auditSetMetric_(result, 'canonicalTotals', snap.totals || {});
  auditSetMetric_(result, 'mirrorFreshness', mirrors);
  auditSetMetric_(result, 'propertyFinancing', financing);
  auditSetMetric_(result, 'reconciliationBlocked', propertyBlocked);
  auditAddCheck_(result, 'property_financing_reconciles',
    'Property financing reconciles', !propertyBlocked,
    propertyBlocked ?
      'One or more property-financing issues require resolution.' :
      'Linked active financing and legacy references reconcile.');
  (financing.blockingIssues || []).forEach(function(issue) {
    auditAddWarning_(result, issue.code || 'PROPERTY_FINANCING_BLOCKED',
      issue.message || 'Property financing reconciliation is blocked.',
      issue.data || {});
  });
  return result;
}

function auditCanonicalPlannerSnapshot_(snapshot) {
  var result = newAuditResult_('planner');
  var snap = snapshot || {};
  var rows = snap.rows || {};
  var totals = snap.totals || {};
  var calculated = {
    cash: canonicalFinancialSumIncluded_(rows.cash || [], 'currentValue'),
    investments: canonicalFinancialSumIncluded_(
      rows.investments || [], 'currentValue'),
    grossRealEstate: canonicalFinancialSumIncluded_(
      rows.properties || [], 'currentValue'),
    totalLiabilities: round2_((rows.debts || []).reduce(function(sum, debt) {
      return debt && debt.included ? sum + toNumber_(debt.balance) : sum;
    }, 0))
  };
  calculated.totalAssets = round2_(calculated.cash + calculated.investments +
    calculated.grossRealEstate);
  calculated.netWorth = round2_(
    calculated.totalAssets - calculated.totalLiabilities);

  var deltas = {};
  ['cash', 'investments', 'grossRealEstate', 'totalAssets',
    'totalLiabilities', 'netWorth'].forEach(function(key) {
    auditCanonicalDelta_(result, deltas, key, calculated[key], totals[key],
      'Planner ' + key);
  });
  var reconciles = Object.keys(deltas).every(function(key) {
    return Math.abs(deltas[key]) <= FINANCIAL_AUDIT_TOLERANCE_USD_;
  });
  auditSetMetric_(result, 'plannerTotals', calculated);
  auditSetMetric_(result, 'canonicalTotals', totals);
  auditSetMetric_(result, 'deltas', deltas);
  auditSetMetric_(result, 'reconciles', reconciles);
  auditAddCheck_(result, 'planner_current_position_reconciles',
    'Planner current position reconciles to canonical totals', reconciles,
    'Active source rows, liabilities, assets, and net worth compared to $0.01.');
  return result;
}

function auditCanonicalDashboardSnapshot_(snapshot) {
  var result = newAuditResult_('dashboard');
  var snap = snapshot || {};
  var totals = snap.totals || {};
  var dashboard = canonicalDashboardTotals_(snap, {
    cash: 0,
    investments: 0,
    houseValues: 0,
    houseLoans: 0,
    debt: 0
  });
  var deltas = {};
  auditCanonicalDelta_(result, deltas, 'cash', dashboard.cash, totals.cash,
    'Dashboard cash');
  auditCanonicalDelta_(result, deltas, 'investments', dashboard.investments,
    totals.investments, 'Dashboard investments');
  auditCanonicalDelta_(result, deltas, 'grossRealEstate', dashboard.houseValues,
    totals.grossRealEstate, 'Dashboard property value');
  auditCanonicalDelta_(result, deltas, 'totalLiabilities', dashboard.debt,
    totals.totalLiabilities, 'Dashboard liabilities');
  auditCanonicalDelta_(result, deltas, 'netWorth', dashboard.netWorth,
    totals.netWorth, 'Dashboard net worth');

  var expectedPropertyLoans = round2_((((snap.propertyFinancing || {})
    .byProperty) || []).reduce(function(sum, property) {
      return sum + toNumber_(
        property && property.authoritativeLoanBalance);
    }, 0));
  auditCanonicalDelta_(result, deltas, 'propertyFinancing',
    dashboard.houseLoans, expectedPropertyLoans,
    'Dashboard property financing');

  var reconciles = Object.keys(deltas).every(function(key) {
    return Math.abs(deltas[key]) <= FINANCIAL_AUDIT_TOLERANCE_USD_;
  });
  auditSetMetric_(result, 'dashboardTotals', dashboard);
  auditSetMetric_(result, 'canonicalTotals', totals);
  auditSetMetric_(result, 'deltas', deltas);
  auditSetMetric_(result, 'reconciles', reconciles);
  auditAddCheck_(result, 'dashboard_current_position_reconciles',
    'Dashboard current position reconciles to canonical totals', reconciles,
    'Dashboard adapter and canonical snapshot compared to $0.01.');
  return result;
}

function readLatestFinancialHistorySnapshot_(ss) {
  var sheet = ss && ss.getSheetByName('OUT - History');
  return readLatestFinancialHistorySnapshotFromSheet_(sheet);
}

function readLatestFinancialHistorySnapshotFromSheet_(sheet) {
  if (!sheet) return { available: false, reason: 'NO_HISTORY_SHEET' };
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return { available: false, reason: 'NO_HISTORY_ROWS' };
  var headers = display[0] || [];
  var cols = {
    runDate: headers.indexOf('Run Date'),
    investments: headers.indexOf('Total Financial Assets'),
    grossRealEstate: headers.indexOf('Total Real Estate Assets'),
    totalAssets: headers.indexOf('Total Assets'),
    totalLiabilities: headers.indexOf('Total Liabilities'),
    netWorth: headers.indexOf('Net Worth')
  };
  var missing = Object.keys(cols).filter(function(key) {
    return cols[key] === -1;
  });
  if (missing.length) {
    return {
      available: false,
      reason: 'HISTORY_SCHEMA_UNREADABLE',
      missing: missing
    };
  }
  for (var r = display.length - 1; r >= 1; r--) {
    var capturedAt = String(display[r][cols.runDate] || '').trim();
    if (!capturedAt) continue;
    return {
      available: true,
      capturedAt: capturedAt,
      investments: round2_(toNumber_(values[r][cols.investments])),
      grossRealEstate: round2_(toNumber_(values[r][cols.grossRealEstate])),
      totalAssets: round2_(toNumber_(values[r][cols.totalAssets])),
      totalLiabilities: round2_(toNumber_(values[r][cols.totalLiabilities])),
      netWorth: round2_(toNumber_(values[r][cols.netWorth]))
    };
  }
  return { available: false, reason: 'NO_HISTORY_ROWS' };
}

function auditCanonicalHistorySnapshot_(snapshot, historySnapshot) {
  var result = newAuditResult_('history');
  var history = historySnapshot || { available: false, reason: 'NO_HISTORY_ROWS' };
  var totals = snapshot && snapshot.totals || {};
  if (!history.available) {
    auditSetMetric_(result, 'capturedAt', '');
    auditSetMetric_(result, 'materiallyStale', null);
    if (history.reason === 'HISTORY_SCHEMA_UNREADABLE') {
      auditAddFailure_(result, 'HISTORY_SCHEMA_UNREADABLE',
        'OUT - History is missing required financial columns: ' +
        (history.missing || []).join(', ') + '.');
    } else {
      auditAddWarning_(result, 'HISTORY_NOT_AVAILABLE',
        'No completed Planner History snapshot is available yet.', {});
    }
    return result;
  }

  var deltas = {};
  auditCanonicalDelta_(result, deltas, 'investments', history.investments,
    totals.investments, 'History investments');
  auditCanonicalDelta_(result, deltas, 'grossRealEstate',
    history.grossRealEstate, totals.grossRealEstate,
    'History property value');
  auditCanonicalDelta_(result, deltas, 'totalAssets', history.totalAssets,
    totals.totalAssets, 'History total assets');
  auditCanonicalDelta_(result, deltas, 'totalLiabilities',
    history.totalLiabilities, totals.totalLiabilities,
    'History liabilities');
  auditCanonicalDelta_(result, deltas, 'netWorth', history.netWorth,
    totals.netWorth, 'History net worth');
  var materiallyStale = Object.keys(deltas).some(function(key) {
    return Math.abs(deltas[key]) > FINANCIAL_AUDIT_TOLERANCE_USD_;
  });
  auditSetMetric_(result, 'capturedAt', history.capturedAt);
  auditSetMetric_(result, 'historyTotals', {
    investments: history.investments,
    grossRealEstate: history.grossRealEstate,
    totalAssets: history.totalAssets,
    totalLiabilities: history.totalLiabilities,
    netWorth: history.netWorth
  });
  auditSetMetric_(result, 'canonicalTotals', totals);
  auditSetMetric_(result, 'deltas', deltas);
  auditSetMetric_(result, 'materiallyStale', materiallyStale);
  auditSetMetric_(result, 'reconciles', !materiallyStale);
  auditAddCheck_(result, 'history_snapshot_reconciles',
    'Latest Planner History snapshot reconciles to the live canonical position',
    !materiallyStale,
    'Captured ' + history.capturedAt + '; compared to the live position at $0.01.');
  if (materiallyStale) {
    auditAddWarning_(result, 'HISTORY_MATERIALLY_STALE',
      'The latest Planner History snapshot differs materially from the live current position.',
      { capturedAt: history.capturedAt, deltas: deltas });
  }
  return result;
}

function runAssetAudit(explicitSpreadsheet, suppliedSnapshot,
    suppliedReadError) {
  var result = newAuditResult_('assets');
  var context = financialAuditModuleContext_(result, explicitSpreadsheet,
    suppliedSnapshot, suppliedReadError);
  return context ? auditCanonicalAssetSnapshot_(context.snapshot) : result;
}

function runPlannerAudit(explicitSpreadsheet, suppliedSnapshot,
    suppliedReadError) {
  var result = newAuditResult_('planner');
  var context = financialAuditModuleContext_(result, explicitSpreadsheet,
    suppliedSnapshot, suppliedReadError);
  return context ? auditCanonicalPlannerSnapshot_(context.snapshot) : result;
}

function runDashboardAudit(explicitSpreadsheet, suppliedSnapshot,
    suppliedReadError) {
  var result = newAuditResult_('dashboard');
  var context = financialAuditModuleContext_(result, explicitSpreadsheet,
    suppliedSnapshot, suppliedReadError);
  return context ? auditCanonicalDashboardSnapshot_(context.snapshot) : result;
}

function runHistoryAudit(explicitSpreadsheet, suppliedSnapshot,
    suppliedReadError, suppliedHistorySnapshot) {
  var result = newAuditResult_('history');
  var context = financialAuditModuleContext_(result, explicitSpreadsheet,
    suppliedSnapshot, suppliedReadError);
  if (!context) return result;
  var history = suppliedHistorySnapshot;
  if (!history) {
    try {
      history = readLatestFinancialHistorySnapshot_(context.ss);
    } catch (err) {
      auditAddFailure_(result, 'HISTORY_READ_FAILED',
        'Could not read OUT - History: ' +
        (err && err.message ? err.message : err));
      return result;
    }
  }
  return auditCanonicalHistorySnapshot_(context.snapshot, history);
}

/* -------------------------------------------------------------------------- */
/*  Phase 1 module — Debt Integrity                                           */
/* -------------------------------------------------------------------------- */

/**
 * Audits debt-related financial integrity by computing each independent debt
 * basis the app uses and reporting differences from the approved active-only
 * current liability basis.
 *
 * Bases measured (Phase 1):
 *   - Dashboard debt total : sumDebtBalances_()  (active-only, explicit rule)
 *   - Planner liability    : canonical active-only normalized debt summary
 *   - Sheet TOTAL DEBT row : the gross =SUM cell on INPUT - Debts
 *
 * Rolling payoff starting balance is intentionally omitted in Phase 1 — no
 * lightweight read-only accessor exists and we will not duplicate the rolling
 * business logic. It can be added later behind a real accessor.
 *
 * @returns {!Object} module result from newAuditResult_/auditAdd*
 */
function runDebtAudit(explicitSpreadsheet) {
  var result = newAuditResult_('debt');

  // --- Acquire workbook + debts sheet (read-only) --------------------------
  var ss;
  try {
    ss = explicitSpreadsheet || getUserSpreadsheet_();
  } catch (err) {
    auditAddFailure_(result, 'NO_SPREADSHEET',
      'Could not resolve workbook: ' + (err && err.message ? err.message : err));
    return result;
  }
  if (!ss) {
    auditAddFailure_(result, 'NO_SPREADSHEET', 'No active workbook available.');
    return result;
  }

  // Bootstrap/blank workbook: nothing to audit. Report the informational
  // NOT_INITIALIZED state instead of FAILing on the missing INPUT - Debts
  // sheet. Read-only; no sheet creation, no onboarding.
  if (!financialAuditWorkbookInitialized_(ss)) {
    auditMarkNotInitialized_(result, FINANCIAL_AUDIT_NOT_INITIALIZED_MESSAGE_);
    return result;
  }

  var debtsSheet;
  try {
    debtsSheet = getSheet_(ss, 'DEBTS');
  } catch (err) {
    auditAddFailure_(result, 'NO_DEBTS_SHEET',
      'Could not open INPUT - Debts: ' + (err && err.message ? err.message : err));
    return result;
  }

  // --- Basis 1: Dashboard debt total (active-only) -------------------------
  var dashboardDebtTotal = null;
  try {
    dashboardDebtTotal = sumDebtBalances_(debtsSheet);
    auditSetMetric_(result, 'dashboardDebtTotal', dashboardDebtTotal);
  } catch (err) {
    auditAddFailure_(result, 'DASHBOARD_TOTAL_FAILED',
      'sumDebtBalances_ failed: ' + (err && err.message ? err.message : err));
  }

  // --- Basis 2: Planner liability total (canonical active-only) ------------
  var plannerLiabilityTotal = null;
  var debts = null;
  var hasActiveColumn = false;
  try {
    var debtRows = readSheetAsObjects_(ss, 'DEBTS');
    hasActiveColumn = debtRowsHaveActiveColumn_(debtRows);
    debts = normalizeDebts_(debtRows, getAliasMap_());
    plannerLiabilityTotal =
      canonicalLiabilitySummaryFromNormalizedDebts_(debts).totalLiabilities;
    auditSetMetric_(result, 'plannerLiabilityTotal', plannerLiabilityTotal);
  } catch (err) {
    auditAddFailure_(result, 'PLANNER_TOTAL_FAILED',
      'Planner liability computation failed: ' +
      (err && err.message ? err.message : err));
  }

  // --- Basis 3: Sheet TOTAL DEBT row ---------------------------------------
  var sheetTotalDebtRow = null;
  try {
    var hm = getDebtsHeaderMap_(debtsSheet);
    var totalRow = findDebtTotalRow_(debtsSheet, hm);
    if (totalRow !== -1 && hm.balanceCol !== -1) {
      sheetTotalDebtRow =
        round2_(toNumber_(debtsSheet.getRange(totalRow, hm.balanceCol).getValue()));
    }
    auditSetMetric_(result, 'sheetTotalDebtRow', sheetTotalDebtRow);
    auditAddCheck_(result, 'sheet_total_row_present',
      'TOTAL DEBT summary row present', totalRow !== -1,
      totalRow !== -1 ? ('row ' + totalRow) : 'no TOTAL DEBT row found');
  } catch (err) {
    // Non-fatal: the sheet total is a nice-to-have basis, not required to
    // compare the two primary bases. Record as a warning, not a failure.
    auditAddWarning_(result, 'SHEET_TOTAL_UNAVAILABLE',
      'Could not read TOTAL DEBT row: ' + (err && err.message ? err.message : err));
    auditSetMetric_(result, 'sheetTotalDebtRow', null);
  }

  // --- Debt counts + inactive-with-balance ---------------------------------
  if (debts) {
    var activeDebts = debts.filter(function(d) { return d.active; });
    var inactiveDebts = debts.filter(function(d) { return !d.active; });
    var inactiveWithBalance = inactiveDebts
      .filter(function(d) { return Math.abs(toNumber_(d.balance)) > FINANCIAL_AUDIT_TOLERANCE_USD_; })
      .map(function(d) {
        return { name: d.originalName || d.name, balance: round2_(d.balance) };
      });

    auditSetMetric_(result, 'activeDebtCount', activeDebts.length);
    auditSetMetric_(result, 'inactiveDebtCount', inactiveDebts.length);
    auditSetMetric_(result, 'inactiveWithBalance', inactiveWithBalance);

    if (inactiveWithBalance.length > 0) {
      var inactiveSum = round2_(inactiveWithBalance.reduce(function(s, d) {
        return s + toNumber_(d.balance);
      }, 0));
      auditAddWarning_(result, 'INACTIVE_WITH_BALANCE',
        inactiveWithBalance.length + ' inactive debt(s) still carry a balance ' +
        'totaling ' + inactiveSum + '.',
        { count: inactiveWithBalance.length, totalUsd: inactiveSum });
    }
  }

  // --- Active-rule consistency / legacy fallback status --------------------
  var legacyFallbackInEffect = !hasActiveColumn;
  auditSetMetric_(result, 'activeRule', {
    hasActiveColumn: hasActiveColumn,
    legacyFallbackInEffect: legacyFallbackInEffect
  });
  auditAddCheck_(result, 'active_column_present',
    'Active column present on INPUT - Debts', hasActiveColumn,
    hasActiveColumn
      ? 'Explicit active/inactive rule in effect.'
      : 'No Active column — legacy compatibility behavior remains observable.');
  if (legacyFallbackInEffect) {
    auditAddWarning_(result, 'LEGACY_ACTIVE_FALLBACK',
      'INPUT - Debts has no Active column; legacy compatibility behavior is in effect. ' +
      'Additive schema evolution should be completed before Release Readiness.', {});
  }

  // --- Deltas against the canonical active-only consumer basis -------------
  var deltas = {};
  if (dashboardDebtTotal !== null && plannerLiabilityTotal !== null) {
    deltas.dashboard_vs_planner = auditDelta_(dashboardDebtTotal, plannerLiabilityTotal);
  }
  if (dashboardDebtTotal !== null && sheetTotalDebtRow !== null) {
    deltas.dashboard_vs_sheetTotal = auditDelta_(dashboardDebtTotal, sheetTotalDebtRow);
  }
  if (plannerLiabilityTotal !== null && sheetTotalDebtRow !== null) {
    deltas.planner_vs_sheetTotal = auditDelta_(plannerLiabilityTotal, sheetTotalDebtRow);
  }
  auditSetMetric_(result, 'deltas', deltas);

  // Report each non-trivial divergence as an OBSERVATION (never a failure).
  reportDebtBasisDivergence_(result, 'dashboard_vs_planner', deltas.dashboard_vs_planner,
    'Dashboard and Planner canonical active-only liability totals');
  reportDebtBasisDivergence_(result, 'dashboard_vs_sheetTotal', deltas.dashboard_vs_sheetTotal,
    'Dashboard debt total (active-only) and Sheet TOTAL DEBT row (gross)');
  reportDebtBasisDivergence_(result, 'planner_vs_sheetTotal', deltas.planner_vs_sheetTotal,
    'Planner canonical liability total and Sheet TOTAL DEBT row (gross)');

  // Summary check: did we successfully compute the two primary bases?
  var primaryBasesOk = (dashboardDebtTotal !== null && plannerLiabilityTotal !== null);
  auditAddCheck_(result, 'debt_sources_read',
    'Primary debt bases computed', primaryBasesOk,
    primaryBasesOk
      ? 'Dashboard + Planner bases computed.'
      : 'One or more primary debt bases could not be computed.');

  return result;
}

/* -------------------------------------------------------------------------- */
/*  Debt-audit helpers                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors normalizeDebts_'s Active-column detection: true if any row exposes
 * an 'Active' (or '__display__Active') key.
 */
function debtRowsHaveActiveColumn_(rows) {
  if (!rows || !rows.length) return false;
  for (var i = 0; i < rows.length; i++) {
    if (Object.prototype.hasOwnProperty.call(rows[i], 'Active') ||
        Object.prototype.hasOwnProperty.call(rows[i], '__display__Active')) {
      return true;
    }
  }
  return false;
}

/**
 * Emits a neutral divergence observation when a delta exceeds tolerance.
 * Does nothing when the delta is undefined (basis unavailable) or within
 * tolerance.
 */
function reportDebtBasisDivergence_(result, key, delta, label) {
  if (delta === undefined || delta === null) return;
  if (Math.abs(delta) <= FINANCIAL_AUDIT_TOLERANCE_USD_) return;
  auditAddWarning_(result, 'DEBT_BASIS_DIVERGENCE',
    label + ' differ by ' + delta + '.',
    { comparison: key, deltaUsd: delta });
}

/* -------------------------------------------------------------------------- */
/*  Admin UI seam                                                             */
/* -------------------------------------------------------------------------- */

/**
 * UI endpoint for the Admin Diagnostics page. Admin-gated, read-only. Returns
 * the aggregated audit report directly — it is already a clean, serializable
 * view model that the generic renderer consumes.
 *
 * @returns {!Object} runFinancialIntegrityAudit() report
 */
function adminUiGetFinancialIntegrityAudit() {
  assertAdmin_();
  return runFinancialIntegrityAudit();
}
