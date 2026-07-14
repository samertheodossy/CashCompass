/**
 * test_harness_scenarios.js — Test Harness · declarative scenarios (V1).
 *
 * V1 ships exactly ONE SMOKE scenario — the smallest end-to-end proof that the
 * Harness can create a disposable workbook, drive one real workflow into it, and
 * have the read-only Validator judge it. Design of record:
 * TEST_HARNESS_ARCHITECTURE.md §3.
 *
 * Scenario contract (V1 subset): { id, category, description, setup(ctx),
 * actions(ctx) }. `ctx` carries { ss, runId, actions[], assertWritable() }.
 * Scenarios MUST call ctx.assertWritable() immediately before every write.
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
  try {
    var dateCol = block.colMap['Date'] + 1;
    var amountCol = block.colMap['Amount'] + 1;
    sheet.getRange(row1, dateCol).setNumberFormat('M/d/yyyy');
    sheet.getRange(row1, amountCol).setNumberFormat('$#,##0.00');
  } catch (_nf) { /* cosmetic */ }

  ctx.actions.push('Add one donation row (buildDonationOutputRow_) at row ' + row1);
}
