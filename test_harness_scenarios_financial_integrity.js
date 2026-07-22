/**
 * Financial Integrity Phase 3 canonical snapshot regression.
 *
 * Every write is confined to the Harness-created Restricted disposable
 * workbook and re-verifies ctx.assertWritable() first. The production seam
 * under test, readCanonicalFinancialSnapshot_(ctx.ss), is read-only and always
 * receives the explicit disposable spreadsheet.
 */
function getHarnessFinancialIntegrityCanonicalScenario_() {
  var names = getSheetNames_();
  return {
    id: 'REGRESSION-FINANCIAL-INTEGRITY-CANONICAL',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    description: 'Prove the approved active-owned-position snapshot, mirror freshness, and fail-closed property financing contract.',
    requiresTrashCleanup: true,
    expectedSheets: [
      names.BANK_ACCOUNTS,
      names.ACCOUNTS,
      names.INVESTMENTS,
      names.ASSETS,
      names.HOUSE_VALUES,
      names.HOUSE_ASSETS,
      names.DEBTS,
      'SYS - Meta'
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      ensureOnboardingBankAccountsSheetFromDashboard('normal', ctx.ss);
      ctx.assertWritable();
      ensureSysAccountsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureInputInvestmentsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureSysAssetsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureInputHouseValuesSheet_(ctx.ss);
      ctx.assertWritable();
      ensureSysHouseAssetsSheet_(ctx.ss);
      ctx.assertWritable();
      ensureOnboardingDebtsSheetFromDashboard('normal', ctx.ss);
      ctx.actions.push('Create canonical financial sheets on explicit disposable target');
    },
    actions: function(ctx) {
      var year = getCurrentYear_();
      var today = new Date();

      harnessFiAddBank_(ctx, year, today, 'Harness Checking', 1000, 'Yes');
      harnessFiAddBank_(ctx, year, today, 'Harness Blank Active Cash', 500, '');
      harnessFiAddBank_(ctx, year, today, 'Harness Closed Cash', 900, 'No');

      harnessFiAddInvestment_(ctx, year, today, 'Harness Brokerage', 'Brokerage', 2000, 'Yes');
      harnessFiAddInvestment_(ctx, year, today, 'Harness Closed Investment', 'Brokerage', 700, 'No');

      var home = harnessFiAddHouse_(
        ctx, year, today, 'Harness Home', 'Primary', 175000, 300000, 'Yes');
      harnessFiAddHouse_(
        ctx, year, today, 'Harness Cabin', 'Rental', 50000, 100000, 'Yes');
      harnessFiAddHouse_(
        ctx, year, today, 'Harness Sold House', 'Rental', 0, 400000, 'No');

      harnessFiAddDebt_(ctx, 'Harness Mortgage', 'Loan', 175000, 'Yes', 'Harness Home');
      harnessFiAddDebt_(ctx, 'Harness Blank Active Card', 'Credit Card', 5000, '', '');
      harnessFiAddDebt_(ctx, 'Harness Old Mortgage', 'Loan', 10000, 'No', 'Harness Home');

      SpreadsheetApp.flush();
      ctx.canonicalBaseline = readCanonicalFinancialSnapshot_(ctx.ss);
      var normalizedDebts = normalizeDebts_(
        readSheetAsObjects_(ctx.ss, 'DEBTS'), getAliasMap_());
      ctx.plannerLiabilityBasis =
        canonicalLiabilitySummaryFromNormalizedDebts_(normalizedDebts);
      ctx.rollingDebtBasis = canonicalRollingDebtBasis_(
        normalizedDebts,
        [{
          code: 'PLANNED_CARD_FUNDED_MAPPED',
          label: 'Synthetic mapped card scenario',
          amount: 250
        }],
        canonicalLiveNormalizedDebts_(normalizedDebts).map(function(debt) {
          var clone = JSON.parse(JSON.stringify(debt));
          if (clone.name === 'Harness Blank Active Card') {
            clone.balance = round2_(clone.balance + 250);
          }
          return clone;
        })
      );
      ctx.dashboardCanonicalTotals = canonicalDashboardTotals_(
        ctx.canonicalBaseline,
        {
          cash: 999999,
          investments: 999999,
          houseValues: 999999,
          houseLoans: 999999,
          debt: 999999
        }
      );
      ctx.dashboardLegacyFallback = canonicalDashboardTotals_(
        { sources: {}, totals: {}, propertyFinancing: {} },
        {
          cash: 11,
          investments: 22,
          houseValues: 33,
          houseLoans: 4,
          debt: 5
        }
      );

      // Create two deliberate post-baseline discrepancies. They prove the seam
      // observes stale mirrors and linked-vs-legacy financing without repairing.
      var accounts = ctx.ss.getSheetByName(getSheetNames_().ACCOUNTS);
      var accountsMap = getAccountsHeaderMap_(accounts);
      var accountDisplay = accounts.getDataRange().getDisplayValues();
      for (var r = 1; r < accountDisplay.length; r++) {
        if (String(accountDisplay[r][accountsMap.nameColZero] || '').trim() === 'Harness Checking') {
          ctx.assertWritable();
          accounts.getRange(r + 1, accountsMap.balanceCol).setValue(999);
          break;
        }
      }
      ctx.assertWritable();
      home.inputSheet.getRange(home.inputRow, 2).setValue(170000);
      SpreadsheetApp.flush();
      ctx.canonicalDiverged = readCanonicalFinancialSnapshot_(ctx.ss);
      ctx.actions.push('Read baseline then introduce disposable-only mirror and property-loan discrepancies');
    },
    expectedOutcome: function(ctx) {
      var baseline = ctx.canonicalBaseline;
      var diverged = ctx.canonicalDiverged;
      var moduleName = 'Financial Integrity';

      ctx.assert.equals('Explicit inactive is excluded',
        canonicalCurrentRowIncluded_(true, 'No'), false, { module: moduleName });
      ctx.assert.equals('Blank Active remains included',
        canonicalCurrentRowIncluded_(true, ''), true, { module: moduleName });
      ctx.assert.equals('Missing Active column remains included',
        canonicalCurrentRowIncluded_(false, 'No'), true, { module: moduleName });
      ctx.assert.equals('TOTAL DEBT is a summary row',
        canonicalSummaryRow_('debts', 'TOTAL DEBT'), true, { module: moduleName });

      ctx.assert.equals('Canonical cash excludes inactive balance',
        baseline.totals.cash, 1500, { module: moduleName });
      ctx.assert.equals('Canonical investments exclude inactive balance',
        baseline.totals.investments, 2000, { module: moduleName });
      ctx.assert.equals('Canonical real estate excludes inactive property',
        baseline.totals.grossRealEstate, 400000, { module: moduleName });
      ctx.assert.equals('Canonical liabilities include active and blank-Active debt only',
        baseline.totals.totalLiabilities, 180000, { module: moduleName });
      ctx.assert.equals('Canonical net worth reconciles',
        baseline.totals.netWorth, 223500, { module: moduleName });

      ctx.assert.equals('Cash source and mirror initially match',
        baseline.mirrors.cash.matches, true, { module: moduleName });
      ctx.assert.equals('Investment source and mirror initially match',
        baseline.mirrors.investments.matches, true, { module: moduleName });
      ctx.assert.equals('Property source and mirror initially match',
        baseline.mirrors.properties.matches, true, { module: moduleName });

      var homeFinancing = harnessFiFindProperty_(baseline, 'Harness Home');
      var cabinFinancing = harnessFiFindProperty_(baseline, 'Harness Cabin');
      ctx.assert.equals('Linked active debt is property authority',
        homeFinancing && homeFinancing.authority, 'LINKED_ACTIVE_DEBT', { module: moduleName });
      ctx.assert.equals('Inactive linked debt is excluded from property financing',
        homeFinancing && homeFinancing.linkedDebtCount, 1, { module: moduleName });
      ctx.assert.equals('Linked property equity uses debt once',
        homeFinancing && homeFinancing.estimatedEquity, 125000, { module: moduleName });
      ctx.assert.equals('Unlinked legacy property loan remains visible',
        cabinFinancing && cabinFinancing.authority, 'UNLINKED_LEGACY_FALLBACK', { module: moduleName });
      ctx.assert.equals('Unlinked property financing blocks reconciliation',
        harnessFiHasIssue_(baseline, 'UNLINKED_PROPERTY_FINANCING'), true, { module: moduleName });

      ctx.assert.equals('Stale cash mirror is detected',
        diverged.mirrors.cash.matches, false, { module: moduleName });
      ctx.assert.equals('Stale cash mirror difference is exact',
        diverged.mirrors.cash.difference, -1, { module: moduleName });
      ctx.assert.equals('Linked-vs-legacy property mismatch is gated',
        harnessFiHasIssue_(diverged, 'PROPERTY_FINANCING_MISMATCH'), true, { module: moduleName });
      ctx.assert.equals('Read-only divergence does not alter canonical liabilities',
        diverged.totals.totalLiabilities, 180000, { module: moduleName });
      ctx.assert.equals('Planner liability basis equals canonical liabilities',
        ctx.plannerLiabilityBasis.totalLiabilities,
        baseline.totals.totalLiabilities, { module: moduleName });
      ctx.assert.equals('Planner liability basis excludes inactive linked debt',
        ctx.plannerLiabilityBasis.loans, 175000, { module: moduleName });
      ctx.assert.equals('Rolling live anchor equals canonical liabilities',
        ctx.rollingDebtBasis.canonicalLiveDebt,
        baseline.totals.totalLiabilities, { module: moduleName });
      ctx.assert.equals('Rolling scenario adjustment remains separate',
        ctx.rollingDebtBasis.scenarioAdjustmentTotal, 250,
        { module: moduleName });
      ctx.assert.equals('Rolling modeled start is live plus scenario adjustment',
        ctx.rollingDebtBasis.modeledStartingDebt, 180250,
        { module: moduleName });
      ctx.assert.equals('Rolling debt basis reconciles',
        ctx.rollingDebtBasis.reconciles, true, { module: moduleName });
      ctx.assert.equals('Dashboard cash equals canonical cash',
        ctx.dashboardCanonicalTotals.cash, baseline.totals.cash,
        { module: moduleName });
      ctx.assert.equals('Dashboard investments equal canonical investments',
        ctx.dashboardCanonicalTotals.investments,
        baseline.totals.investments, { module: moduleName });
      ctx.assert.equals('Dashboard property value equals canonical property value',
        ctx.dashboardCanonicalTotals.houseValues,
        baseline.totals.grossRealEstate, { module: moduleName });
      ctx.assert.equals('Dashboard liabilities equal canonical liabilities',
        ctx.dashboardCanonicalTotals.debt,
        baseline.totals.totalLiabilities, { module: moduleName });
      ctx.assert.equals('Dashboard net worth equals canonical net worth',
        ctx.dashboardCanonicalTotals.netWorth, baseline.totals.netWorth,
        { module: moduleName });
      ctx.assert.equals('Dashboard property financing uses linked debt plus visible fallback',
        ctx.dashboardCanonicalTotals.houseLoans, 225000,
        { module: moduleName });
      ctx.assert.equals('Dashboard legacy source fallback preserves existing totals safely',
        ctx.dashboardLegacyFallback.netWorth, 61,
        { module: moduleName });
    }
  };
}

function harnessFiSetYearRowActive_(ctx, sheet, block, row, active) {
  var headers = sheet.getRange(
    block.headerRow, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  var activeCol = headers.indexOf('Active') + 1;
  if (activeCol < 1) throw new Error('Harness Financial Integrity: Active header missing.');
  ctx.assertWritable();
  if (String(active || '') === '') sheet.getRange(row, activeCol).clearContent();
  else sheet.getRange(row, activeCol).setValue(active);
}

function harnessFiAddBank_(ctx, year, today, name, balance, active) {
  var input = ctx.ss.getSheetByName(getSheetNames_().BANK_ACCOUNTS);
  var block = getBankAccountsYearBlock_(input, year);
  ctx.assertWritable();
  var row = insertNewBankAccountHistoryRow_(input, block, name);
  var monthCol = getMonthColumnByDate_(input, today, block.headerRow);
  ctx.assertWritable();
  setCurrencyCellPreserveRowFormat_(input, row, monthCol, balance, block.firstMonthCol);
  harnessFiSetYearRowActive_(ctx, input, block, row, active);
  ctx.assertWritable();
  refreshBankAccountsTotalAccountsRow_(input, year);

  var mirror = ctx.ss.getSheetByName(getSheetNames_().ACCOUNTS);
  ctx.assertWritable();
  harnessAppendByHeader_(mirror, {
    'Account Name': name,
    'Current Balance': balance,
    'Available Now': balance,
    'Min Buffer': 0,
    'Type': 'Checking',
    'Use Policy': 'USE_FOR_DEBT',
    'Priority': 1,
    'Active': active
  });
}

function harnessFiAddInvestment_(ctx, year, today, name, type, balance, active) {
  var input = ctx.ss.getSheetByName(getSheetNames_().INVESTMENTS);
  var block = getInvestmentsYearBlock_(input, year);
  ctx.assertWritable();
  var row = insertNewInvestmentHistoryRow_(input, block, name, type);
  var monthCol = getMonthColumnByDate_(input, today, block.headerRow);
  ctx.assertWritable();
  setCurrencyCellPreserveRowFormat_(input, row, monthCol, balance, block.firstMonthCol);
  harnessFiSetYearRowActive_(ctx, input, block, row, active);
  ctx.assertWritable();
  refreshInvestmentsAccountTotalsRow_(input, year);

  var mirror = ctx.ss.getSheetByName(getSheetNames_().ASSETS);
  ctx.assertWritable();
  harnessAppendByHeader_(mirror, {
    'Account Name': name,
    'Type': type,
    'Current Balance': balance,
    'Active': active
  });
}

function harnessFiAddHouse_(ctx, year, today, name, type, loan, value, active) {
  var input = ctx.ss.getSheetByName(getSheetNames_().HOUSE_VALUES);
  var block = getHouseValuesYearBlock_(input, year);
  ctx.assertWritable();
  var row = insertNewHouseHistoryRow_(input, block, name, loan);
  var monthCol = getMonthColumnByDate_(input, today, block.headerRow);
  ctx.assertWritable();
  setCurrencyCellPreserveRowFormat_(input, row, monthCol, value, block.firstMonthCol);
  harnessFiSetYearRowActive_(ctx, input, block, row, active);

  var mirror = ctx.ss.getSheetByName(getSheetNames_().HOUSE_ASSETS);
  ctx.assertWritable();
  harnessAppendByHeader_(mirror, {
    'House': name,
    'Type': type,
    'Loan Amount Left': loan,
    'Current Value': value,
    'Active': active
  });
  return { inputSheet: input, inputRow: row };
}

function harnessFiAddDebt_(ctx, name, type, balance, active, linkedProperty) {
  var sheet = ctx.ss.getSheetByName(getSheetNames_().DEBTS);
  var hm = getDebtsHeaderMap_(sheet);
  var totalRow = findDebtTotalRow_(sheet, hm);
  var values = {
    'Account Name': name,
    'Type': type,
    'Account Balance': balance,
    'Due Date': 15,
    'Credit Limit': type === 'Credit Card' ? 10000 : 0,
    'Minimum Payment': 100,
    'Credit Left': type === 'Credit Card' ? 10000 - balance : -balance,
    'Int Rate': 4.25,
    'Acct PCT Avail': 0,
    'Active': active,
    'Linked Property': linkedProperty
  };
  ctx.assertWritable();
  if (totalRow === -1) harnessAppendByHeader_(sheet, values);
  else harnessInsertBeforeByHeader_(sheet, totalRow, values);
  hm = getDebtsHeaderMap_(sheet);
  totalRow = findDebtTotalRow_(sheet, hm);
  ctx.assertWritable();
  refreshDebtsTotalRow_(sheet, hm, totalRow);
  ctx.assertWritable();
  applyDebtsSheetStyling_(sheet);
}

function harnessFiFindProperty_(snapshot, propertyName) {
  var rows = snapshot && snapshot.propertyFinancing &&
    snapshot.propertyFinancing.byProperty || [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].property === propertyName) return rows[i];
  }
  return null;
}

function harnessFiHasIssue_(snapshot, code) {
  var issues = snapshot && snapshot.blockingIssues || [];
  for (var i = 0; i < issues.length; i++) {
    if (issues[i] && issues[i].code === code) return true;
  }
  return false;
}
