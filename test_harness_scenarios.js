/**
 * test_harness_scenarios.js — Test Harness · declarative scenarios (V1).
 *
 * The registry contains smoke/regression scenarios that create their own
 * disposable workbooks, drive real spreadsheet-scoped seams, and have the
 * read-only Validator judge them. Design of record:
 * TEST_HARNESS_ARCHITECTURE.md §3.
 *
 * Scenario contract: { id, category, executionLevel, description, expectedSheets?,
 * setup(ctx), actions(ctx), expectedOutcome?(ctx) }. `ctx` carries
 * { ss, runId, actions[], assertWritable(), assert, read }. Scenarios MUST call
 * ctx.assertWritable() immediately before every write.
 *
 * executionLevel classifies what a tester should EXPECT (see HARNESS_EXECUTION_LEVELS_):
 *   PURE ......... minimal disposable workbook; no visual inspection expected;
 *                  validates algorithms only (e.g. the recurrence-engine scenarios).
 *   INTEGRATION .. visible workbook artifacts expected; intended for workbook
 *                  inspection; validates production sheet behavior (e.g. the Bills
 *                  monthly-integration / cash-flow scenarios).
 *   E2E .......... validates a complete feature workflow — workbook + dashboard +
 *                  activity log + cash flow + summaries (none yet; reserved).
 *
 * FIDELITY NOTE (V1 seam limitation): the production create-a-workbook workflows
 * (ensureInputDonationSheet_ / addDonation, ensureCashFlowYearSheet_, …) resolve
 * their workbook internally via getUserSpreadsheet_(), which has no injection
 * seam — so calling them from the Harness could touch a REAL workbook. To stay
 * strictly inside the disposable target, V1 invokes the workbook-SCOPED real
 * production seams directly: runMinimalBootstrap_(ss) for provisioning, and the
 * exact pure row-building helpers addDonation() uses (findDonationBlockForTaxYear_
 * → getDonationAppendRow1_ → buildDonationOutputRow_) plus applyDonationSheetStyling_
 * for the row. Only the workbook-resolution + sheet-insert lines are substituted;
 * behavior comes from shipping code. A future ss-injection refactor will let
 * scenarios invoke the top-level workflows verbatim.
 */

/* -------------------------------------------------------------------------- */
/*  Execution-level classification                                             */
/* -------------------------------------------------------------------------- */

/**
 * The execution levels a scenario can declare, with the tester-facing expectation
 * text surfaced in the console UI and the human report. Single source of truth so
 * the UI, report, and docs stay in sync.
 */
var HARNESS_EXECUTION_LEVELS_ = {
  PURE: {
    label: 'PURE',
    expectation: 'Minimal disposable workbook. No visual inspection expected. Validates algorithms only.'
  },
  INTEGRATION: {
    label: 'INTEGRATION',
    expectation: 'Visible workbook artifacts expected. Intended for workbook inspection. Validates production sheet behavior.'
  },
  E2E: {
    label: 'E2E',
    expectation: 'Validates a complete feature workflow: workbook + dashboard + activity log + cash flow + summaries.'
  }
};

/**
 * Resolve the { label, expectation } for a scenario execution level, tolerating
 * unknown/blank values (defaults to a neutral UNKNOWN descriptor).
 * @param {string} level
 * @returns {{label:string, expectation:string}}
 */
function harnessExecutionLevelInfo_(level) {
  var key = String(level || '').toUpperCase();
  return HARNESS_EXECUTION_LEVELS_[key] || { label: key || 'UNKNOWN', expectation: '' };
}

/* -------------------------------------------------------------------------- */
/*  Scenario registry                                                          */
/* -------------------------------------------------------------------------- */

/**
 * All Test Harness scenarios available to the runners/console, in a stable order.
 * The registry is the single source of truth so adding a scenario (e.g. a new Bills
 * case) surfaces it in BOTH the editor runner (testRunScenarioById_) and the
 * console dropdown (vtListHarnessScenarios) with no other wiring. Each additional
 * pack is referenced defensively (typeof guard) so a missing file never breaks the
 * registry.
 *
 * @returns {Array<Object>} scenario objects
 */
function getHarnessScenarios_() {
  var list = [getHarnessSmokeScenario_()];
  if (typeof getHarnessBillsMonthlyScenario_ === 'function') {
    list.push(getHarnessBillsMonthlyScenario_());
  }
  if (typeof getHarnessBillsNewCreationFloorScenario_ === 'function') {
    list.push(getHarnessBillsNewCreationFloorScenario_());
  }
  if (typeof getHarnessBillsWeeklyScenario_ === 'function') {
    list.push(getHarnessBillsWeeklyScenario_());
  }
  if (typeof getHarnessBillsWeeklyOnDayScenario_ === 'function') {
    list.push(getHarnessBillsWeeklyOnDayScenario_());
  }
  if (typeof getHarnessBillsBiweeklyScenario_ === 'function') {
    list.push(getHarnessBillsBiweeklyScenario_());
  }
  if (typeof getHarnessBillsYearBoundaryScenario_ === 'function') {
    list.push(getHarnessBillsYearBoundaryScenario_());
  }
  if (typeof getHarnessBills31stScenario_ === 'function') {
    list.push(getHarnessBills31stScenario_());
  }
  if (typeof getHarnessBillsLeapFeb29Scenario_ === 'function') {
    list.push(getHarnessBillsLeapFeb29Scenario_());
  }
  if (typeof getHarnessBillsYearlyScenario_ === 'function') {
    list.push(getHarnessBillsYearlyScenario_());
  }
  if (typeof getHarnessBillsMonthlyIntegrationScenario_ === 'function') {
    list.push(getHarnessBillsMonthlyIntegrationScenario_());
  }
  if (typeof getHarnessBillsMonthlyCashflowScenario_ === 'function') {
    list.push(getHarnessBillsMonthlyCashflowScenario_());
  }
  if (typeof getHarnessRecoveryDuplicateGuardScenario_ === 'function') {
    list.push(getHarnessRecoveryDuplicateGuardScenario_());
  }
  if (typeof getHarnessQuickAddWriteGuardScenario_ === 'function') {
    list.push(getHarnessQuickAddWriteGuardScenario_());
  }
  if (typeof getHarnessDirectQuickAddCorrectionScenario_ === 'function') {
    list.push(getHarnessDirectQuickAddCorrectionScenario_());
  }
  if (typeof getHarnessDonationCorrectionScenario_ === 'function') {
    list.push(getHarnessDonationCorrectionScenario_());
  }
  if (typeof getHarnessBillsEditIntegrityScenario_ === 'function') {
    list.push(getHarnessBillsEditIntegrityScenario_());
  }
  if (typeof getHarnessBillsAutopayFormatScenario_ === 'function') {
    list.push(getHarnessBillsAutopayFormatScenario_());
  }
  if (typeof getHarnessBillsWeekdayAutopayGuardScenario_ === 'function') {
    list.push(getHarnessBillsWeekdayAutopayGuardScenario_());
  }
  if (typeof getHarnessBillsAutopayRollbackScenario_ === 'function') {
    list.push(getHarnessBillsAutopayRollbackScenario_());
  }
  if (typeof getHarnessDonationCommentsEditScenario_ === 'function') {
    list.push(getHarnessDonationCommentsEditScenario_());
  }
  if (typeof getHarnessDonationFullEditScenario_ === 'function') {
    list.push(getHarnessDonationFullEditScenario_());
  }
  if (typeof getHarnessPopulatedFixtureScenario_ === 'function') {
    list.push(getHarnessPopulatedFixtureScenario_());
  }
  if (typeof getHarnessHouseDebtLinkSchemaScenario_ === 'function') {
    list.push(getHarnessHouseDebtLinkSchemaScenario_());
  }
  if (typeof getHarnessFinancialIntegrityCanonicalScenario_ === 'function') {
    list.push(getHarnessFinancialIntegrityCanonicalScenario_());
  }
  if (typeof getHarnessRfpInvestmentMetadataScenario_ === 'function') {
    list.push(getHarnessRfpInvestmentMetadataScenario_());
  }
  if (typeof getHarnessPerformancePlannerScenario_ === 'function') {
    list.push(getHarnessPerformancePlannerScenario_());
  }
  if (typeof getHarnessBillsPayE2EScenario_ === 'function') {
    list.push(getHarnessBillsPayE2EScenario_());
  }
  return list;
}

/**
 * Look up a scenario by id from the registry. Returns null if unknown (callers
 * fail-closed on null before any write).
 * @param {string} id
 * @returns {Object|null}
 */
function getHarnessScenarioById_(id) {
  var wanted = String(id || '').trim();
  var all = getHarnessScenarios_();
  for (var i = 0; i < all.length; i++) {
    if (all[i] && all[i].id === wanted) return all[i];
  }
  return null;
}

/**
 * The V1 SMOKE scenario: provision a fresh workbook (INPUT - Settings) and add
 * one real donation row, then let Workbook Health judge it.
 * @returns {Object} scenario
 */
function getHarnessSmokeScenario_() {
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string') ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var donationName = (typeof DONATION_SHEET_NAME_ === 'string') ? DONATION_SHEET_NAME_ : 'INPUT - Donation';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  return {
    id: 'SMOKE-PROVISION-DONATION',
    category: 'SMOKE',
    executionLevel: 'INTEGRATION',   // seeds a visible INPUT - Donation row for inspection
    description: 'Provision a fresh workbook (INPUT - Settings) and add one donation row.',
    // Scenario-scoped validation: this SMOKE only creates these three sheets, so
    // Workbook Health is scoped to them (validatorScopeModel_). Without this, the
    // full canonical model would WARN on sheets this scenario never provisions
    // (LOG - Activity, Cash Flow, SYS - Accounts, Bank Accounts, Upcoming Expenses).
    // This scopes validation only — it does NOT change global canonical rules.
    expectedSheets: [settingsName, donationName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      // Real production provisioning — workbook-scoped (takes ss). Creates
      // INPUT - Settings and drops the blank default Sheet1 (our banner keeps
      // Sheet1 non-blank, so it is preserved).
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision workbook (runMinimalBootstrap_ → INPUT - Settings)');
    },
    actions: function(ctx) {
      harnessSeedOneDonationRow_(ctx);
    },
    // Functional assertions (E0a) — read via the common read layer (ctx.read) and
    // compare via ctx.assert. Read/compare only.
    expectedOutcome: function(ctx) {
      var seeded = ctx.seededDonation;
      if (!seeded) {
        throw new Error('Harness: expected a seeded donation to assert against.');
      }
      // exists (Slice 3): the Donation sheet was provisioned. Reading A1 through
      // the read layer yields undefined if the sheet is missing, so a present A1
      // ('Year' banner) proves the sheet exists.
      ctx.assert.exists('Donation sheet', ctx.read.sheetValue(donationName, 1, 1), {
        module: 'Donation',
        location: donationName + '!R1C1'
      });
      // equals (Slice 1): the seeded donation Amount round-trips as 100.
      var actual = ctx.read.sheetValue(donationName, seeded.row, seeded.amountCol);
      ctx.assert.equals('Donation amount', actual, 100, {
        module: 'Donation',
        location: donationName + '!R' + seeded.row + 'C' + seeded.amountCol
      });
    }
  };
}

/**
 * Seed one donation through the real production addDonation path, using its
 * explicit disposable-workbook seam. All writes are guarded by
 * ctx.assertWritable() and confined to the disposable ss.
 *
 * @param {Object} ctx { ss, runId, actions[], assertWritable() }
 */
function harnessSeedOneDonationRow_(ctx) {
  var ss = ctx.ss;
  var name = (typeof DONATION_SHEET_NAME_ === 'string') ? DONATION_SHEET_NAME_ : 'INPUT - Donation';
  var year = (typeof getCurrentYear_ === 'function') ? getCurrentYear_() : new Date().getFullYear();
  ctx.assertWritable();
  if (typeof addDonation !== 'function') {
    throw new Error('Harness: production donation writer is unavailable.');
  }
  addDonation({
    charityName: 'Local Food Bank',
    donationDate: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    amount: 100,
    taxYear: year,
    comments: 'Smoke test donation',
    paymentType: 'Cash'
  }, ss);

  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Harness: production donation writer did not create its sheet.');
  var values = sheet.getDataRange().getValues();
  var block = findDonationBlockForTaxYear_(values, year);
  if (!block) {
    throw new Error('Harness: donation block for tax year ' + year + ' not found after production save.');
  }
  var amountCol = block.colMap['Amount'] + 1;
  var row1 = getDonationLastDataRow1_(values, block);
  if (row1 < 1) throw new Error('Harness: production donation row was not found after save.');

  // Record the seeded row location so expectedOutcome (E0a) can read the actual
  // Amount back and assert on it. Scenario scratch only — not a workbook write.
  ctx.seededDonation = { row: row1, amountCol: amountCol };

  ctx.actions.push('Add one donation row through production addDonation at row ' + row1);
}

/**
 * Verify donation amount edits/removal through the shared immutable correction
 * model. The scenario runs only on its harness-created disposable workbook.
 */
function getHarnessDonationCorrectionScenario_() {
  var donationName = (typeof DONATION_SHEET_NAME_ === 'string')
    ? DONATION_SHEET_NAME_
    : 'INPUT - Donation';
  var activityName = (typeof ACTIVITY_LOG_SHEET_NAME === 'string')
    ? ACTIVITY_LOG_SHEET_NAME
    : 'LOG - Activity';
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string')
    ? PROFILE_SETTINGS_SHEET_NAME_
    : 'INPUT - Settings';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string')
    ? SYS_META_SHEET_NAME_
    : 'SYS - Meta';
  var year = (typeof getCurrentYear_ === 'function')
    ? getCurrentYear_()
    : new Date().getFullYear();

  return {
    id: 'REGRESSION-DONATION-CORRECTION',
    category: 'REGRESSION',
    executionLevel: 'E2E',
    description: 'Validate repeated donation amount correction, final removal, immutable audit history, and changed-state refusal.',
    expectedSheets: [settingsName, donationName, activityName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.donationCorrection = {
        date: Utilities.formatDate(
          new Date(year, 6, 19),
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        )
      };
      ctx.actions.push('Provision a disposable workbook for donation correction');
    },
    actions: function(ctx) {
      var state = ctx.donationCorrection;
      ctx.assertWritable();
      state.original = addDonation({
        charityName: 'Harness Community Fund',
        donationDate: state.date,
        amount: 100,
        taxYear: year,
        comments: 'Correction chain',
        paymentType: 'Cash'
      }, ctx.ss);
      state.identical = addDonation({
        charityName: 'Harness Community Fund',
        donationDate: state.date,
        amount: 100,
        taxYear: year,
        comments: 'Correction chain',
        paymentType: 'Cash'
      }, ctx.ss);
      var originalEvents = findActivityOperationEvents_(
        ctx.ss,
        state.original.operationId
      );
      var originalTarget = collectActivityOperationTargets_(originalEvents)[0];
      var originalMatch = findDonationActivityTargetRow_(
        ctx.ss,
        originalTarget,
        originalTarget.after
      );
      var originalDateCell = originalMatch.sheet.getRange(
        originalMatch.matches[0],
        originalMatch.block.colMap['Date'] + 1
      ).getValue();
      state.storedDate = Utilities.formatDate(
        originalDateCell,
        ctx.ss.getSpreadsheetTimeZone(),
        'yyyy-MM-dd'
      );
      state.originalPreview = previewDonationCorrectionInSpreadsheet_(
        ctx.ss,
        state.original.operationId
      );
      state.identicalPreview = previewDonationCorrectionInSpreadsheet_(
        ctx.ss,
        state.identical.operationId
      );
      ctx.assertWritable();
      state.noChange = correctDonationOperationInSpreadsheet_(
        ctx.ss,
        state.original.operationId,
        'Wrong amount',
        '',
        'change_amount',
        100
      );

      ctx.assertWritable();
      state.changeTo125 = correctDonationOperationInSpreadsheet_(
        ctx.ss,
        state.original.operationId,
        'Wrong amount',
        '',
        'change_amount',
        125
      );
      state.originalRetry = previewDonationCorrectionInSpreadsheet_(
        ctx.ss,
        state.original.operationId
      );
      state.preview125 = previewDonationCorrectionInSpreadsheet_(
        ctx.ss,
        state.changeTo125.replacementOperationId
      );

      ctx.assertWritable();
      state.changeTo150 = correctDonationOperationInSpreadsheet_(
        ctx.ss,
        state.changeTo125.replacementOperationId,
        'Wrong amount',
        '',
        'change_amount',
        150
      );
      state.preview150 = previewDonationCorrectionInSpreadsheet_(
        ctx.ss,
        state.changeTo150.replacementOperationId
      );

      ctx.assertWritable();
      state.remove150 = correctDonationOperationInSpreadsheet_(
        ctx.ss,
        state.changeTo150.replacementOperationId,
        'Entered twice',
        '',
        'remove',
        null
      );
      state.removedRetry = previewDonationCorrectionInSpreadsheet_(
        ctx.ss,
        state.changeTo150.replacementOperationId
      );

      ctx.assertWritable();
      state.changed = addDonation({
        charityName: 'Harness Changed Donation',
        donationDate: state.date,
        amount: 80,
        taxYear: year,
        comments: 'Manual-change guard',
        paymentType: 'Check'
      }, ctx.ss);
      var changedEvents = findActivityOperationEvents_(
        ctx.ss,
        state.changed.operationId
      );
      var changedTarget = collectActivityOperationTargets_(changedEvents)[0];
      var changedMatch = findDonationActivityTargetRow_(
        ctx.ss,
        changedTarget,
        changedTarget.after
      );
      ctx.assertWritable();
      var manuallyChangedState = Object.assign(
        {},
        donationActivityState_(changedTarget.after),
        { amount: 81 }
      );
      writeDonationActivityTargetStateInSpreadsheet_(
        ctx.ss,
        changedTarget,
        manuallyChangedState
      );
      state.changedPreview = previewDonationCorrectionInSpreadsheet_(
        ctx.ss,
        state.changed.operationId
      );
      ctx.assertWritable();
      state.changedCorrection = correctDonationOperationInSpreadsheet_(
        ctx.ss,
        state.changed.operationId,
        'Wrong amount',
        '',
        'change_amount',
        90
      );
      var changedInspection = inspectDonationActivityTargetInSpreadsheet_(
        ctx.ss,
        Object.assign({}, changedTarget, { after: manuallyChangedState })
      );
      state.changedValue = Number(
        changedInspection && changedInspection.current
          ? changedInspection.current.amount
          : NaN
      );
      ctx.actions.push(
        'Change one donation twice, remove its current logical entry, then prove a newer manual value is preserved'
      );
    },
    expectedOutcome: function(ctx) {
      var state = ctx.donationCorrection;
      var mod = 'Donation Correction';
      ctx.assert.equals('Original donation preview is ready',
        state.originalPreview.status, 'READY', { module: mod });
      ctx.assert.equals('Donation correction preview keeps the selected calendar day',
        state.originalPreview.entry.entryDate, state.date, { module: mod });
      ctx.assert.equals('Donation date remains the selected calendar day',
        state.storedDate, state.date, { module: mod });
      ctx.assert.equals('Identical donation rows retain distinct correctable identities',
        state.identicalPreview.status, 'READY', { module: mod });
      ctx.assert.equals('Identical donation amount is rejected as a no-op',
        state.noChange.status, 'NO_CHANGE', { module: mod });
      ctx.assert.equals('Donation changes from $100 to $125',
        state.changeTo125.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Superseded original cannot be corrected twice',
        state.originalRetry.status, 'ALREADY_CORRECTED', { module: mod });
      ctx.assert.equals('Corrected $125 donation remains actionable',
        state.preview125.status, 'READY', { module: mod });
      ctx.assert.equals('Donation changes from $125 to $150',
        state.changeTo150.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Corrected $150 donation remains actionable',
        state.preview150.status, 'READY', { module: mod });
      ctx.assert.equals('Current donation can be removed',
        state.remove150.status, 'CORRECTED', { module: mod });
      ctx.assert.equals('Removed donation cannot be removed twice',
        state.removedRetry.status, 'ALREADY_CORRECTED', { module: mod });
      ctx.assert.equals('Manual donation change blocks preview',
        state.changedPreview.status, 'PRECONDITION_FAILED', { module: mod });
      ctx.assert.equals('Manual donation change blocks writer',
        state.changedCorrection.ok, false, { module: mod });
      ctx.assert.equals('Manual donation value remains untouched',
        state.changedValue, 81, { module: mod });

      var activity = ctx.ss.getSheetByName(activityName);
      var rows = activity.getDataRange().getDisplayValues();
      var corrections = 0;
      var replacements = 0;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][1] === 'donation_correction') corrections++;
        if (rows[i][1] === 'donation' &&
            String(rows[i][10] || '').indexOf('donation_replacement::') === 0) {
          replacements++;
        }
      }
      ctx.assert.equals('Every donation correction has immutable audit evidence',
        corrections, 3, { module: mod, location: activityName });
      ctx.assert.equals('Amount edits create two current replacement records',
        replacements, 2, { module: mod, location: activityName });
    }
  };
}
