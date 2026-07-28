/**
 * Browser-backed Populated Dashboard E2E lifecycle.
 *
 * Reuses the proven First-Run disposable-account provisioning and exact cleanup
 * guards, then seeds only that newly created mapped workbook through the existing
 * explicit-spreadsheet representative fixture helpers. No workbook id is accepted
 * from a caller and the permanent test identity remains a non-admin.
 */
var POPULATED_DASHBOARD_E2E_MODE_ = 'POPULATED_DASHBOARD';
var POPULATED_DASHBOARD_E2E_EVIDENCE_KEY_ = 'POPULATED_DASHBOARD_E2E_LATEST_EVIDENCE_V8';
var POPULATED_DASHBOARD_E2E_SCENARIO_ID_ = 'E2E-POPULATED-DASHBOARD';
var POPULATED_DASHBOARD_E2E_REQUIRED_ASSERTIONS_ = [
  'startup_populated_overview',
  'overview_kpis',
  'bank_selection_actions',
  'bank_loading_resilience',
  'tracked_editor_convergence',
  'debt_selection_actions',
  'debt_loading_resilience',
  'property_equity',
  'populated_workspaces',
  'retirement_ready_results',
  'income_setup_consistency',
  'subtab_retention',
  'setup_help_language',
  'customer_language',
  'refresh_button_state',
  'health_prerequisite_truth',
  'activity_operation_envelope',
  'bill_skip_stop_safety',
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
function pdE2EPrepare(confirmed, requestedReleaseRunId) {
  return frE2ESafe_(function() {
    var prepared = frE2EPrepare(confirmed, requestedReleaseRunId);
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

/**
 * Read-only verification of the exact synthetic Bill after the browser has
 * exercised Skip and Stop tracking. The caller cannot supply a workbook id or
 * payee; both come from the marker-verified active fixture and canonical
 * representative profile.
 */
function pdE2EInspectBillLifecycle(runId) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    var state = frE2EReadState_();
    if (!state || state.mode !== POPULATED_DASHBOARD_E2E_MODE_ ||
        String(runId || '') !== state.runId) {
      throw new Error('Populated Dashboard E2E refused: run token mismatch.');
    }
    assertFirstRunE2EFixture_(state, email, false);

    var ss = SpreadsheetApp.openById(state.workbookId);
    var profile = getHarnessRepresentativeProfile_();
    var bill = profile.bill;
    var sheet = ss.getSheetByName(getSheetNames_().BILLS);
    if (!sheet) throw new Error('Synthetic Bills sheet is unavailable.');

    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    var headerMap = {};
    for (var c = 0; c < headers.length; c++) {
      var header = String(headers[c] || '').trim();
      if (header) headerMap[header] = c;
    }
    ['Payee', 'Due Day', 'Default Amount', 'Active', 'Frequency', 'Notes'].forEach(function(required) {
      if (!Object.prototype.hasOwnProperty.call(headerMap, required)) {
        throw new Error('Synthetic Bills verification is missing required structure.');
      }
    });

    var row = null;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][headerMap.Payee] || '').trim() === bill.payee) {
        row = values[r];
        break;
      }
    }

    var activity = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    var activityValues = activity && activity.getLastRow() >= 2
      ? activity.getRange(2, 1, activity.getLastRow() - 1, ACTIVITY_LOG_HEADERS.length).getValues()
      : [];
    var skipCount = 0;
    var deactivateCount = 0;
    activityValues.forEach(function(activityRow) {
      if (String(activityRow[5] || '').trim() !== bill.payee) return;
      var eventType = String(activityRow[1] || '').trim();
      if (eventType === 'bill_skip') skipCount++;
      if (eventType === 'bill_deactivate') deactivateCount++;
    });

    assertFirstRunE2EFixture_(state, email, false);
    return {
      ok: true,
      verification: {
        rowPresent: !!row,
        inactive: !!row && normalizeYesNo_(row[headerMap.Active]) === 'no',
        dueDayPreserved: !!row && Number(row[headerMap['Due Day']]) === Number(bill.dueDay),
        amountPreserved: !!row && Math.abs(Number(row[headerMap['Default Amount']]) - Number(bill.amount)) < 0.005,
        frequencyPreserved: !!row &&
          String(row[headerMap.Frequency] || '').trim().toLowerCase() ===
          String(bill.frequency || '').trim().toLowerCase(),
        notesPreserved: !!row && String(row[headerMap.Notes] || '').trim() === 'Synthetic harness bill',
        skipActivityCount: skipCount,
        deactivateActivityCount: deactivateCount
      }
    };
  });
}

/**
 * Guarded disposable-account writer proof for the shared Activity operation
 * envelope. No workbook identifier or financial input is accepted from the
 * browser; the server resolves the marker-verified fixture and deterministic
 * representative Income row.
 */
function pdE2EExerciseOperationEnvelope(runId) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    var state = frE2EReadState_();
    if (!state || state.mode !== POPULATED_DASHBOARD_E2E_MODE_ ||
        String(runId || '') !== state.runId) {
      throw new Error('Populated Dashboard E2E refused: run token mismatch.');
    }
    assertFirstRunE2EFixture_(state, email, false);

    var ss = SpreadsheetApp.openById(state.workbookId);
    var profile = getHarnessRepresentativeProfile_();
    var entryDate = new Date();
    var result = quickAddPayment({
      entryType: 'Income',
      payee: profile.income.payee,
      entryDate: Utilities.formatDate(
        entryDate,
        Session.getScriptTimeZone(),
        'yyyy-MM-dd'
      ),
      amount: 123.45,
      createIfMissing: false,
      flowSource: 'CASH'
    }, ss);
    SpreadsheetApp.flush();
    assertFirstRunE2EFixture_(state, email, false);

    var operationId = String(
      result && result.activitySnapshot && result.activitySnapshot.operationId || ''
    ).trim();
    var events = operationId ? findActivityOperationEvents_(ss, operationId) : [];
    var preview = operationId
      ? previewActivityOperationInSpreadsheet_(ss, operationId)
      : { status: 'MISSING_OPERATION_ID', correctable: false, targets: [] };
    var envelope = events.length === 1 ? events[0].parsed.envelope : null;

    return {
      ok: true,
      verification: {
        operationIdPresent: !!operationId,
        eventCount: events.length,
        uniqueEventIdPresent: !!(envelope && envelope.eventId),
        envelopeVersion: envelope ? Number(envelope.envelopeVersion) : 0,
        operationType: envelope ? String(envelope.operationType || '') : '',
        actorScoped: !!(envelope && envelope.actorIdentity),
        workbookScoped: !!(envelope && envelope.workbookIdentity),
        correctable: !!(envelope && envelope.correctable),
        targetCount: envelope && Array.isArray(envelope.targets)
          ? envelope.targets.length
          : 0,
        previewStatus: String(preview.status || ''),
        previewCorrectable: preview.correctable === true
      }
    };
  });
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
    var evidenceContext = releaseValidateBrowserEvidenceContext_(state.releaseEvidenceContext);
    var report = {
      version: 1,
      type: 'browserE2E',
      suiteId: 'SUITE-POPULATED-DASHBOARD-E2E',
      scenarioId: POPULATED_DASHBOARD_E2E_SCENARIO_ID_,
      runId: state.runId,
      candidate: evidenceContext.candidate,
      releaseEligible: evidenceContext.releaseEligible,
      releaseRunId: evidenceContext.releaseRunId,
      evidenceNote: evidenceContext.reason,
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
