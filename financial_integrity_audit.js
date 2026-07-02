/**
 * Financial Integrity Audit framework — Stage 2 Product Hardening.
 *
 * Read-only, admin-gated diagnostics that surface differences between the
 * various financial calculation bases in the workbook WITHOUT declaring any
 * one basis canonical. The output is intended to help decide the canonical
 * financial model later; it never mutates the workbook.
 *
 * Hard guarantees for every function in this file:
 *   - Read-only. No sheet writes, no dashboard/planner/history writes, no
 *     touchDashboardSourceUpdated_(), no workbook mutations of any kind.
 *   - Admin-only at the UI seam (adminUiGetFinancialIntegrityAudit()).
 *   - Neutral reporting: observed financial differences are WARNINGS, never
 *     FAILURES. Only audit execution problems (e.g. an unreadable sheet)
 *     produce a FAILURE / FAIL status.
 *
 * Architecture:
 *   runFinancialIntegrityAudit()            — master aggregator
 *     -> runDebtAudit()                      — Phase 1 (implemented)
 *     -> (future) runAssetAudit()            — registered later
 *     -> (future) runPlannerAudit()          — registered later
 *     -> (future) runDashboardAudit()        — registered later
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
      version: 1,
      fn: runDebtAudit
    }
    // Future (not yet implemented):
    //   { id: 'assets',    title: 'Asset Integrity',     order: 20, enabled: false, version: 0, fn: runAssetAudit },
    //   { id: 'planner',   title: 'Planner Integrity',   order: 30, enabled: false, version: 0, fn: runPlannerAudit },
    //   { id: 'dashboard', title: 'Dashboard Integrity', order: 40, enabled: false, version: 0, fn: runDashboardAudit }
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
function runFinancialIntegrityAudit() {
  // Early informational short-circuit: if the caller's workbook is still in
  // bootstrap/blank state (no financial sheets), there is nothing to audit.
  // Report NOT_INITIALIZED rather than letting each module FAIL on missing
  // sheets. Read-only; if the workbook can't be resolved we skip this check
  // and let the modules run (they surface a genuine FAIL).
  var ssForInit = null;
  try { ssForInit = getUserSpreadsheet_(); } catch (_e) { ssForInit = null; }
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

  modules.forEach(function(m) {
    var moduleResult;
    try {
      moduleResult = m.fn();
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
/*  Phase 1 module — Debt Integrity                                           */
/* -------------------------------------------------------------------------- */

/**
 * Audits debt-related financial integrity by computing each independent debt
 * "basis" the app already uses and reporting their differences. Declares no
 * basis canonical.
 *
 * Bases measured (Phase 1):
 *   - Dashboard debt total : sumDebtBalances_()  (active-only, explicit rule)
 *   - Planner liability    : calculateLiabilitySummary_(normalizeDebts_())
 *                            (includes ALL rows regardless of active)
 *   - Sheet TOTAL DEBT row : the gross =SUM cell on INPUT - Debts
 *
 * Rolling payoff starting balance is intentionally omitted in Phase 1 — no
 * lightweight read-only accessor exists and we will not duplicate the rolling
 * business logic. It can be added later behind a real accessor.
 *
 * @returns {!Object} module result from newAuditResult_/auditAdd*
 */
function runDebtAudit() {
  var result = newAuditResult_('debt');

  // --- Acquire workbook + debts sheet (read-only) --------------------------
  var ss;
  try {
    ss = getUserSpreadsheet_();
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

  // --- Basis 2: Planner liability total (all rows) -------------------------
  var plannerLiabilityTotal = null;
  var debts = null;
  var hasActiveColumn = false;
  try {
    var debtRows = readSheetAsObjects_(ss, 'DEBTS');
    hasActiveColumn = debtRowsHaveActiveColumn_(debtRows);
    debts = normalizeDebts_(debtRows, getAliasMap_());
    plannerLiabilityTotal = calculateLiabilitySummary_(debts).totalLiabilities;
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
      : 'No Active column — legacy balance/min-payment fallback drives active status.');
  if (legacyFallbackInEffect) {
    auditAddWarning_(result, 'LEGACY_ACTIVE_FALLBACK',
      'INPUT - Debts has no Active column; Planner treats $0-balance/$0-min ' +
      'debts as inactive while the Dashboard treats every row as active. ' +
      'Bases can diverge until the Active column is present.', {});
  }

  // --- Deltas (neutral differences, no canonical basis declared) -----------
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
    'Dashboard debt total (active-only) and Planner liability total (all rows)');
  reportDebtBasisDivergence_(result, 'dashboard_vs_sheetTotal', deltas.dashboard_vs_sheetTotal,
    'Dashboard debt total (active-only) and Sheet TOTAL DEBT row (gross)');
  reportDebtBasisDivergence_(result, 'planner_vs_sheetTotal', deltas.planner_vs_sheetTotal,
    'Planner liability total (all rows) and Sheet TOTAL DEBT row (gross)');

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
