/**
 * Browser-backed Populated Dashboard E2E lifecycle.
 *
 * Reuses the proven First-Run disposable-account provisioning and exact cleanup
 * guards, then seeds only that newly created mapped workbook through the existing
 * explicit-spreadsheet representative fixture helpers. No workbook id is accepted
 * from a caller and the permanent test identity remains a non-admin.
 */
var POPULATED_DASHBOARD_E2E_MODE_ = 'POPULATED_DASHBOARD';
var POPULATED_DASHBOARD_E2E_EVIDENCE_KEY_ = 'POPULATED_DASHBOARD_E2E_LATEST_EVIDENCE_V1';
var POPULATED_DASHBOARD_E2E_SCENARIO_ID_ = 'E2E-POPULATED-DASHBOARD';
var POPULATED_DASHBOARD_E2E_REQUIRED_ASSERTIONS_ = [
  'startup_populated_overview',
  'overview_kpis',
  'bank_selection_actions',
  'debt_selection_actions',
  'property_equity',
  'populated_workspaces',
  'subtab_retention',
  'setup_help_language',
  'customer_language',
  'refresh_button_state',
  'clean_console_navigation'
];

function pdE2EGetState() {
  return frE2ESafe_(function() {
    assertFirstRunE2EAllowed_();
    var latestRaw = PropertiesService.getScriptProperties()
      .getProperty(POPULATED_DASHBOARD_E2E_EVIDENCE_KEY_);
    var latest = null;
    try { latest = latestRaw ? JSON.parse(latestRaw) : null; } catch (_e) {}
    var base = frE2EPublicState_();
    return { ok: true, state: { active: base.active, latestEvidence: latest } };
  });
}

/** Provision through Central, verify identity, then seed the exact mapped fixture. */
function pdE2EPrepare(confirmed) {
  return frE2ESafe_(function() {
    var prepared = frE2EPrepare(confirmed);
    if (!prepared || !prepared.ok) {
      throw new Error((prepared && prepared.error) || 'Populated Dashboard E2E preparation failed.');
    }
    var email = assertFirstRunE2EAllowed_();
    var state = frE2EReadState_();
    if (!state) throw new Error('Populated Dashboard E2E lost its active fixture state.');
    state.mode = POPULATED_DASHBOARD_E2E_MODE_;
    frE2EWriteState_(state);

    try {
      assertFirstRunE2EFixture_(state, email, false);
      var ss = SpreadsheetApp.openById(state.workbookId);
      var ctx = {
        ss: ss,
        runId: state.runId,
        actions: [],
        assertWritable: function() {
          assertFirstRunE2EFixture_(state, email, false);
        }
      };
      ctx.assertWritable();
      runMinimalBootstrap_(ss);
      ctx.actions.push('Provision Central-style minimal workbook on exact disposable target');
      harnessSeedRepresentativeWorkbook_(ctx);
      SpreadsheetApp.flush();
      assertFirstRunE2EFixture_(state, email, false);
      state.seededAt = new Date().toISOString();
      state.seedActions = ctx.actions.length;
      frE2EWriteState_(state);
    } catch (seedErr) {
      try { frE2ECleanupVerified_(state, email); } catch (_cleanupErr) {}
      throw seedErr;
    }

    return {
      ok: true,
      runId: state.runId,
      runUrl: frE2EBaseUrl_() + '?view=populated-dashboard-e2e-run&runId=' + encodeURIComponent(state.runId),
      preflightCleanup: prepared.preflightCleanup || null,
      state: pdE2EGetState().state
    };
  });
}

/** Route guard plus deterministic synthetic expectations for the browser. */
function pdE2ERenderContext_(runId) {
  if (!isFirstRunE2EUser_()) return null;
  var state = frE2EReadState_();
  if (!state || state.mode !== POPULATED_DASHBOARD_E2E_MODE_ ||
      String(runId || '') !== state.runId || !state.seededAt) return null;
  try {
    assertFirstRunE2EFixture_(state, FIRST_RUN_E2E_TEST_EMAIL_, false);
    var p = getHarnessRepresentativeProfile_();
    return {
      runId: state.runId,
      expected: {
        bankName: p.bank.name,
        bankBalance: p.bank.balance,
        investmentName: p.investment.name,
        investmentBalance: p.investment.balance,
        houseName: p.house.name,
        houseValue: p.house.value,
        houseLoan: p.house.loan,
        debtName: p.debt.name,
        debtBalance: p.debt.balance,
        billPayee: p.bill.payee,
        incomePayee: p.income.payee,
        upcomingName: p.upcoming.name,
        upcomingAmount: p.upcoming.amount
      }
    };
  } catch (_e) {
    return null;
  }
}

/** Save privacy-safe browser evidence, then exact verified soft-Trash cleanup. */
function pdE2EComplete(runId, payload, trashAfter) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    var state = frE2EReadState_();
    if (!state || state.mode !== POPULATED_DASHBOARD_E2E_MODE_ ||
        String(runId || '') !== state.runId) {
      throw new Error('Populated Dashboard E2E refused: run token mismatch.');
    }
    assertFirstRunE2EFixture_(state, email, false);
    var sharing = frE2EInspectRestrictedSharing_(state.workbookId);
    var normalized = frE2ENormalizeEvidenceFor_(payload, POPULATED_DASHBOARD_E2E_REQUIRED_ASSERTIONS_);
    var pass = sharing.overall === 'PASS' &&
      normalized.assertions.every(function(item) { return item.pass; }) && !normalized.errors.length;
    var report = {
      version: 1,
      type: 'browserE2E',
      suiteId: 'SUITE-POPULATED-DASHBOARD-E2E',
      scenarioId: POPULATED_DASHBOARD_E2E_SCENARIO_ID_,
      runId: state.runId,
      startedAt: state.createdAt,
      finishedAt: new Date().toISOString(),
      overall: pass ? 'PASS' : 'FAIL',
      durationMs: normalized.durationMs,
      sharing: sharing,
      assertions: normalized.assertions,
      errors: normalized.errors,
      cleanup: { requested: trashAfter === true, trashed: false, verified: false }
    };
    var props = PropertiesService.getScriptProperties();
    props.setProperty(POPULATED_DASHBOARD_E2E_EVIDENCE_KEY_, JSON.stringify(report));
    if (trashAfter === true) {
      report.cleanup = frE2ECleanupVerified_(state, email);
      props.setProperty(POPULATED_DASHBOARD_E2E_EVIDENCE_KEY_, JSON.stringify(report));
    }
    return { ok: true, report: report };
  });
}

function pdE2ECleanup(confirmed) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    if (confirmed !== true) throw new Error('Disposable-account confirmation is required.');
    var state = frE2EReadState_();
    if (!state) return { ok: true, cleanup: { requested: true, trashed: false, verified: true }, state: pdE2EGetState().state };
    if (state.mode !== POPULATED_DASHBOARD_E2E_MODE_) {
      throw new Error('Populated Dashboard E2E refused: the active fixture belongs to another suite.');
    }
    var cleanup = frE2ECleanupVerified_(state, email);
    return { ok: true, cleanup: cleanup, state: pdE2EGetState().state };
  });
}
