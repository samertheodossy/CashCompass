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
  'quick_add_credit_card_correction',
  'donation_correction_flow',
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
    var rawState = frE2EReadState_();
    if (base.active && rawState &&
        rawState.mode === POPULATED_DASHBOARD_E2E_MODE_ &&
        base.active.runId === rawState.runId) {
      base.active.browserStartedAt = rawState.browserStartedAt || '';
    }
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
 * Claim the browser writer exactly once.
 *
 * A Populated Dashboard run is deliberately not resumable after browser writes
 * start: reopening the run URL must never replay its stateful steps. An
 * interrupted claimed run is cleaned up and replaced from the control page.
 */
function pdE2EClaimBrowserRun(runId) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var state = frE2EReadState_();
      if (!state || state.mode !== POPULATED_DASHBOARD_E2E_MODE_ ||
          String(runId || '') !== state.runId || !state.seededAt) {
        throw new Error('Populated Dashboard E2E refused: run token mismatch.');
      }
      assertFirstRunE2EFixture_(state, email, false);
      if (state.browserStartedAt) {
        return {
          ok: true,
          status: 'ALREADY_STARTED',
          startedAt: state.browserStartedAt
        };
      }
      state.browserStartedAt = new Date().toISOString();
      frE2EWriteState_(state);
      return {
        ok: true,
        status: 'CLAIMED',
        startedAt: state.browserStartedAt
      };
    } finally {
      lock.releaseLock();
    }
  });
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
      flowSource: 'CASH',
      activityOrigin: 'direct_quick_add'
    }, ss);
    SpreadsheetApp.flush();
    assertFirstRunE2EFixture_(state, email, false);

    var operationId = String(
      result && result.activitySnapshot && result.activitySnapshot.operationId || ''
    ).trim();
    var events = operationId ? findActivityOperationEvents_(ss, operationId) : [];
    var preview = operationId
      ? previewDirectQuickAddCorrectionInSpreadsheet_(ss, operationId)
      : { status: 'MISSING_OPERATION_ID', correctable: false, targets: [] };
    var envelope = events.length === 1 ? events[0].parsed.envelope : null;
    var correction = operationId
      ? correctDirectQuickAddOperationInSpreadsheet_(
          ss,
          operationId,
          'Entered twice',
          ''
        )
      : { ok: false, status: 'MISSING_OPERATION_ID' };
    SpreadsheetApp.flush();
    assertFirstRunE2EFixture_(state, email, false);
    var afterCorrection = operationId
      ? previewDirectQuickAddCorrectionInSpreadsheet_(ss, operationId)
      : { status: 'MISSING_OPERATION_ID' };
    var cashFlowSheet = ss.getSheetByName(result.preview.sheetName);
    var restoredRow = cashFlowSheet
      ? findCashFlowRowByTypeAndPayee_(
          cashFlowSheet,
          'Income',
          profile.income.payee
        )
      : null;
    var restoredCol = cashFlowSheet
      ? getMonthColumnByDate_(cashFlowSheet, entryDate, 1)
      : -1;
    var restoredValue = restoredRow && restoredCol > 0
      ? round2_(toNumber_(
          cashFlowSheet.getRange(restoredRow.row, restoredCol).getValue()
        ))
      : null;

    // Use a separate CASH expense for the sequence-correction and rendered
    // same-page reconciliation journey. Income intentionally has no payment
    // history chart, while Expense must refresh both its total and chart.
    var chainEntryType = 'Expense';
    var chainPayee = 'Test Cash Expense';
    function addChainAmount_(amount) {
      return quickAddPayment({
        entryType: chainEntryType,
        payee: chainPayee,
        entryDate: Utilities.formatDate(
          entryDate,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        ),
        amount: amount,
        createIfMissing: true,
        flowSource: 'CASH',
        activityOrigin: 'direct_quick_add'
      }, ss);
    }

    // Prove the real-workbook sequence that exposed the original limitation:
    // 100 + 25 + 50, reverse the middle 25, add another 10, then reverse the
    // earlier 100 while preserving the still-active 50 + 10.
    var chain100 = addChainAmount_(100);
    var chain25 = addChainAmount_(25);
    var chain50 = addChainAmount_(50);
    SpreadsheetApp.flush();
    var chainRow = findCashFlowRowByTypeAndPayee_(
      cashFlowSheet,
      chainEntryType,
      chainPayee
    );
    if (!chainRow) {
      throw new Error('Populated Dashboard E2E could not find its CASH expense sequence row.');
    }
    var chain25Id = String(chain25.activitySnapshot.operationId || '');
    var middlePreview = previewDirectQuickAddCorrectionInSpreadsheet_(
      ss,
      chain25Id
    );
    var middleCorrection = correctDirectQuickAddOperationInSpreadsheet_(
      ss,
      chain25Id,
      'Wrong amount',
      ''
    );
    SpreadsheetApp.flush();
    var afterMiddleValue = round2_(toNumber_(
      cashFlowSheet.getRange(chainRow.row, restoredCol).getValue()
    ));
    var chain10 = addChainAmount_(10);
    SpreadsheetApp.flush();
    var chain100Id = String(chain100.activitySnapshot.operationId || '');
    var earlierPreview = previewDirectQuickAddCorrectionInSpreadsheet_(
      ss,
      chain100Id
    );
    var earlierCorrection = correctDirectQuickAddOperationInSpreadsheet_(
      ss,
      chain100Id,
      'Entered twice',
      ''
    );
    SpreadsheetApp.flush();
    var afterEarlierValue = round2_(toNumber_(
      cashFlowSheet.getRange(chainRow.row, restoredCol).getValue()
    ));
    var latestPreview = previewDirectQuickAddCorrectionInSpreadsheet_(
      ss,
      String(chain10.activitySnapshot.operationId || '')
    );
    var chain10Id = String(chain10.activitySnapshot.operationId || '');
    var latestCorrection = correctDirectQuickAddOperationInSpreadsheet_(
      ss,
      chain10Id,
      'Entered twice',
      ''
    );
    SpreadsheetApp.flush();
    var afterLatestValue = round2_(toNumber_(
      cashFlowSheet.getRange(chainRow.row, restoredCol).getValue()
    ));
    var remainingPreview = previewDirectQuickAddCorrectionInSpreadsheet_(
      ss,
      String(chain50.activitySnapshot.operationId || '')
    );
    assertFirstRunE2EFixture_(state, email, false);
    var correctionRows = activityCorrectionIndex_(ss);

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
        previewCorrectable: preview.correctable === true,
        correctionStatus: String(correction.status || ''),
        restoredValue: restoredValue,
        expectedRestoredValue: result.activitySnapshot.previousValue,
        retryStatus: String(afterCorrection.status || ''),
        immutableCorrectionPresent: correctionRows[operationId] === true,
        middlePreviewStatus: String(middlePreview.status || ''),
        middleLaterEntryCount: Number(middlePreview.laterEntryCount || 0),
        middleCorrectionStatus: String(middleCorrection.status || ''),
        afterMiddleValue: afterMiddleValue,
        expectedAfterMiddleValue: -150,
        earlierPreviewStatus: String(earlierPreview.status || ''),
        earlierCorrectionStatus: String(earlierCorrection.status || ''),
        afterEarlierValue: afterEarlierValue,
        expectedAfterEarlierValue: -60,
        latestPreviewStatus: String(latestPreview.status || ''),
        latestCorrectionStatus: String(latestCorrection.status || ''),
        afterLatestValue: afterLatestValue,
        expectedAfterLatestValue: -50,
        remainingPreviewStatus: String(remainingPreview.status || ''),
        chainCorrectionsPresent:
          correctionRows[chain25Id] === true &&
          correctionRows[chain100Id] === true &&
          correctionRows[chain10Id] === true,
        chainOperationIdsPresent: !!(
          chain100.activitySnapshot.operationId &&
          chain25.activitySnapshot.operationId &&
          chain50.activitySnapshot.operationId &&
          chain10.activitySnapshot.operationId
        ),
        entryType: chainEntryType,
        payee: chainPayee,
        entryDate: Utilities.formatDate(
          entryDate,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        ),
        finalCashFlowValue: afterLatestValue,
        staleCashFlowValue: round2_(afterLatestValue - 100),
        middleCorrectedOperationId: chain25Id,
        middleCorrectionEntry: middleCorrection.entry || null,
        laterReceiptSnapshot: chain50.activitySnapshot || null
      }
    };
  });
}

/**
 * Seed an uncorrected three-entry credit-card Quick Add sequence so the
 * browser runner can drive the real Activity drawer. The middle entry is left
 * actionable; permanent server regressions separately verify the exact Cash
 * Flow and linked debt values after the browser changes $25 to $30.
 */
function pdE2EPrepareCreditCardCorrection(runId) {
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
    var entryDate = Utilities.formatDate(
      new Date(),
      String(ss.getSpreadsheetTimeZone() || '') ||
        Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );
    var payee = String(profile.debt.name || '');
    function addAmount_(amount, createIfMissing) {
      return quickAddPayment({
        entryType: 'Expense',
        payee: payee,
        entryDate: entryDate,
        amount: amount,
        createIfMissing: createIfMissing === true,
        flowSource: 'CREDIT_CARD',
        activityOrigin: 'direct_quick_add'
      }, ss);
    }

    var first = addAmount_(100, true);
    var middle = addAmount_(25, false);
    var latest = addAmount_(50, false);
    SpreadsheetApp.flush();
    var preview = previewDirectQuickAddCorrectionInSpreadsheet_(
      ss,
      middle.activitySnapshot.operationId
    );
    assertFirstRunE2EFixture_(state, email, false);
    return {
      ok: true,
      verification: {
        payee: payee,
        entryDate: entryDate,
        firstOperationId: String(first.activitySnapshot.operationId || ''),
        middleOperationId: String(middle.activitySnapshot.operationId || ''),
        latestOperationId: String(latest.activitySnapshot.operationId || ''),
        previewStatus: String(preview.status || ''),
        targetCount: Array.isArray(preview.impacts)
          ? preview.impacts.length
          : 0,
        impactTypes: Array.isArray(preview.impacts)
          ? preview.impacts.map(function(impact) {
              return String(impact.type || '');
            })
          : []
      }
    };
  });
}

/**
 * Guarded disposable-account proof for the Donation correction journey.
 *
 * The browser supplies only the active runner token. The server creates its
 * own synthetic donations inside the marker-verified fixture, including two
 * identical rows so locator identity, workbook-timezone date preservation,
 * repeated amount correction, removal, and immutable history are exercised
 * together.
 */
function pdE2EExerciseDonationCorrection(runId) {
  return frE2ESafe_(function() {
    var email = assertFirstRunE2EAllowed_();
    var state = frE2EReadState_();
    if (!state || state.mode !== POPULATED_DASHBOARD_E2E_MODE_ ||
        String(runId || '') !== state.runId) {
      throw new Error('Populated Dashboard E2E refused: run token mismatch.');
    }
    assertFirstRunE2EFixture_(state, email, false);

    var ss = SpreadsheetApp.openById(state.workbookId);
    var timeZone = String(ss.getSpreadsheetTimeZone() || '') ||
      Session.getScriptTimeZone();
    var tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    var entryDate = Utilities.formatDate(tomorrow, timeZone, 'yyyy-MM-dd');
    var taxYear = Number(entryDate.slice(0, 4));
    var payee = 'E2E Donation Correction';
    var payload = {
      charityName: payee,
      donationDate: entryDate,
      amount: 100,
      taxYear: taxYear,
      comments: 'Disposable correction browser proof',
      paymentType: 'Cash'
    };

    var original = addDonation(payload, ss);
    var identical = addDonation(payload, ss);
    SpreadsheetApp.flush();
    assertFirstRunE2EFixture_(state, email, false);

    var originalEvents = findActivityOperationEvents_(ss, original.operationId);
    var originalTarget = collectActivityOperationTargets_(originalEvents)[0];
    var originalMatch = findDonationActivityTargetRow_(
      ss,
      originalTarget,
      originalTarget.after
    );
    if (!originalMatch || originalMatch.matches.length !== 1) {
      throw new Error('Donation E2E could not resolve the original synthetic row.');
    }
    var storedDateCell = originalMatch.sheet.getRange(
      originalMatch.matches[0],
      originalMatch.block.colMap['Date'] + 1
    ).getValue();
    var storedDate = Utilities.formatDate(
      storedDateCell,
      timeZone,
      'yyyy-MM-dd'
    );

    var originalPreview = previewDonationCorrectionInSpreadsheet_(
      ss,
      original.operationId
    );
    var identicalPreview = previewDonationCorrectionInSpreadsheet_(
      ss,
      identical.operationId
    );
    var noChange = correctDonationOperationInSpreadsheet_(
      ss,
      original.operationId,
      'Wrong amount',
      '',
      'change_amount',
      100
    );
    var to125 = correctDonationOperationInSpreadsheet_(
      ss,
      original.operationId,
      'Wrong amount',
      '',
      'change_amount',
      125
    );
    SpreadsheetApp.flush();
    var preview125 = previewDonationCorrectionInSpreadsheet_(
      ss,
      to125.replacementOperationId
    );
    var to150 = correctDonationOperationInSpreadsheet_(
      ss,
      to125.replacementOperationId,
      'Wrong amount',
      '',
      'change_amount',
      150
    );
    SpreadsheetApp.flush();
    var preview150 = previewDonationCorrectionInSpreadsheet_(
      ss,
      to150.replacementOperationId
    );
    var removed = correctDonationOperationInSpreadsheet_(
      ss,
      to150.replacementOperationId,
      'Entered twice',
      '',
      'remove',
      null
    );
    SpreadsheetApp.flush();
    var removedRetry = previewDonationCorrectionInSpreadsheet_(
      ss,
      to150.replacementOperationId
    );

    var recent = getRecentDonationsForUi_(
      getDonationsSheet_(ss).getDataRange().getValues(),
      50
    );
    var remainingIdenticalCount = recent.filter(function(row) {
      return String(row.charity || '') === payee &&
        Number(row.amount) === 100 &&
        String(row.dateLabel || '') !== '';
    }).length;
    var activity = getActivityDashboardData({
      dateFrom: '',
      dateTo: '',
      payeeSearch: payee,
      kindType: '',
      amountMin: '',
      amountMax: ''
    }, ss);
    var logicalRows = activity && Array.isArray(activity.rows)
      ? activity.rows
      : [];
    var removedRows = logicalRows.filter(function(row) {
      return String(row.operationId || '') ===
        String(to150.replacementOperationId || '') &&
        String(row.correctionState || '') === 'removed';
    });
    var identicalRows = logicalRows.filter(function(row) {
      return String(row.operationId || '') ===
        String(identical.operationId || '') &&
        String(row.correctionAction || '') === 'correct_entry';
    });
    var corrections = activityCorrectionIndex_(ss);
    assertFirstRunE2EFixture_(state, email, false);

    return {
      ok: true,
      verification: {
        payee: payee,
        entryDate: entryDate,
        storedDate: storedDate,
        originalOperationId: String(original.operationId || ''),
        identicalOperationId: String(identical.operationId || ''),
        finalOperationId: String(to150.replacementOperationId || ''),
        originalPreviewStatus: String(originalPreview.status || ''),
        originalPreviewDate: String(
          originalPreview.entry && originalPreview.entry.entryDate || ''
        ),
        identicalPreviewStatus: String(identicalPreview.status || ''),
        noChangeStatus: String(noChange.status || ''),
        to125Status: String(to125.status || ''),
        preview125Status: String(preview125.status || ''),
        to150Status: String(to150.status || ''),
        preview150Status: String(preview150.status || ''),
        removeStatus: String(removed.status || ''),
        removedRetryStatus: String(removedRetry.status || ''),
        originalCorrected: corrections[String(original.operationId || '')] === true,
        replacement125Corrected:
          corrections[String(to125.replacementOperationId || '')] === true,
        replacement150Corrected:
          corrections[String(to150.replacementOperationId || '')] === true,
        remainingIdenticalCount: remainingIdenticalCount,
        removedLogicalRowCount: removedRows.length,
        removedHistoryCount: removedRows.length
          ? Number((removedRows[0].correctionHistory || []).length)
          : 0,
        identicalLogicalRowCount: identicalRows.length
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
