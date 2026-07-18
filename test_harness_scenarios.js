/**
 * test_harness_scenarios.js — Test Harness · declarative scenarios (V1).
 *
 * V1 ships exactly ONE SMOKE scenario — the smallest end-to-end proof that the
 * Harness can create a disposable workbook, drive one real workflow into it, and
 * have the read-only Validator judge it. Design of record:
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
 * Seed the INPUT - Donation year block (if absent) and append ONE donation row
 * using the same pure production helpers addDonation() uses. All writes are
 * guarded by ctx.assertWritable() and confined to the disposable ss.
 *
 * @param {Object} ctx { ss, runId, actions[], assertWritable() }
 */
function harnessSeedOneDonationRow_(ctx) {
  var ss = ctx.ss;
  var name = (typeof DONATION_SHEET_NAME_ === 'string') ? DONATION_SHEET_NAME_ : 'INPUT - Donation';
  var year = (typeof getCurrentYear_ === 'function') ? getCurrentYear_() : new Date().getFullYear();

  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    ctx.assertWritable();
    sheet = ss.insertSheet(name);
    // Same seed shape as ensureInputDonationSheet_: Year banner + header row.
    sheet.getRange(1, 1, 1, 2).setValues([['Year', year]]);
    sheet.getRange(2, 1, 1, DONATION_REQUIRED_HEADERS_.length)
      .setValues([DONATION_REQUIRED_HEADERS_.slice()]);
    if (typeof applyDonationSheetStyling_ === 'function') {
      try { applyDonationSheetStyling_(sheet); } catch (_st) { /* cosmetic */ }
    }
    ctx.actions.push('Create INPUT - Donation year block (' + year + ')');
  }

  // Append one row via the exact pure helpers addDonation() relies on.
  ctx.assertWritable();
  var values = sheet.getDataRange().getValues();
  var block = findDonationBlockForTaxYear_(values, year);
  if (!block) {
    throw new Error('Harness: donation block for tax year ' + year + ' not found after seeding.');
  }
  var row1 = getDonationAppendRow1_(values, block);
  // Realistic short fixture data — the workbook NAME already marks it disposable
  // ("… — SAFE TO DELETE"), so the row itself stays representative and un-clipped.
  var row = buildDonationOutputRow_(
    block.colMap,
    'Local Food Bank',
    new Date(),
    100,
    year,
    'Smoke test donation',
    'Cash'
  );
  sheet.getRange(row1, 1, 1, row.length).setValues([row]);

  // Match addDonation()'s first-row number formats for a faithful row.
  var amountCol = block.colMap['Amount'] + 1;
  try {
    var dateCol = block.colMap['Date'] + 1;
    sheet.getRange(row1, dateCol).setNumberFormat('M/d/yyyy');
    sheet.getRange(row1, amountCol).setNumberFormat('$#,##0.00');
  } catch (_nf) { /* cosmetic */ }

  // Record the seeded row location so expectedOutcome (E0a) can read the actual
  // Amount back and assert on it. Scenario scratch only — not a workbook write.
  ctx.seededDonation = { row: row1, amountCol: amountCol };

  ctx.actions.push('Add one donation row (buildDonationOutputRow_) at row ' + row1);
}
