/**
 * Representative populated-workbook scenario.
 *
 * Central creates the workbook through the shared harness lifecycle. The core
 * verifies Restricted sharing before this scenario writes, every seed targets
 * ctx.ss explicitly, and requiresTrashCleanup forces verified soft-Trash even
 * when a caller forgets to request it.
 */

function getHarnessPopulatedFixtureScenario_() {
  var year = (typeof getCurrentYear_ === 'function') ? getCurrentYear_() : new Date().getFullYear();
  var names = getSheetNames_();
  return {
    id: 'SMOKE-POPULATED-FIXTURE',
    category: 'SMOKE',
    executionLevel: 'INTEGRATION',
    description: 'Create, seed, validate, and Trash a Restricted representative household fixture.',
    requiresTrashCleanup: true,
    expectedSheets: [
      PROFILE_SETTINGS_SHEET_NAME_,
      names.BANK_ACCOUNTS,
      names.ACCOUNTS,
      names.INVESTMENTS,
      names.ASSETS,
      names.HOUSE_VALUES,
      names.HOUSE_ASSETS,
      names.DEBTS,
      names.BILLS,
      getCashFlowSheetName_(year),
      'INPUT - Upcoming Expenses',
      ACTIVITY_LOG_SHEET_NAME,
      'SYS - Meta'
    ],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision Central-style minimal workbook on explicit disposable target');
    },
    actions: function(ctx) {
      harnessSeedRepresentativeWorkbook_(ctx);
    },
    expectedOutcome: function(ctx) {
      var p = ctx.representativeProfile;
      var l = ctx.representativeLocations;
      if (!p || !l) throw new Error('Harness: representative seed manifest is unavailable.');

      harnessAssertSeedValue_(ctx, 'Bank balance', 'Bank', l.bank.inputSheet,
        l.bank.row, l.bank.monthCol, p.bank.balance);
      harnessAssertSeedValue_(ctx, 'Investment balance', 'Investments', l.investment.inputSheet,
        l.investment.row, l.investment.monthCol, p.investment.balance);
      harnessAssertSeedValue_(ctx, 'House value', 'Properties', l.house.inputSheet,
        l.house.row, l.house.monthCol, p.house.value);
      harnessAssertSeedValue_(ctx, 'Debt balance', 'Debts', l.debt.sheet,
        l.debt.row, l.debt.balanceCol, p.debt.balance);
      ctx.assert.equals('Debts fresh schema ends with Linked Property',
        ctx.read.sheetValue(l.debt.sheet, 1, 11), DEBTS_LINKED_PROPERTY_HEADER_, {
          module: 'Debts', location: l.debt.sheet + '!R1C11'
        });
      harnessAssertSeedValue_(ctx, 'Bill amount', 'Bills', l.bill.sheet,
        l.bill.row, l.bill.amountCol, p.bill.amount);
      harnessAssertSeedValue_(ctx, 'Income amount', 'Income', l.income.sheet,
        l.income.row, l.income.monthCol, p.income.amount);
      harnessAssertSeedValue_(ctx, 'Upcoming amount', 'Upcoming', l.upcoming.sheet,
        l.upcoming.row, l.upcoming.amountCol, p.upcoming.amount);
      harnessAssertSeedValue_(ctx, 'Retirement annual spending', 'Retirement', l.retirement.sheet,
        l.retirement.spendingRow, l.retirement.baseCol, p.retirement.annualSpending);

      ctx.assert.exists('Property expense sheet',
        ctx.read.sheetValue('HOUSES - ' + p.house.name, 1, 1), {
          module: 'Properties',
          location: 'HOUSES - ' + p.house.name + '!R1C1'
        });
    }
  };
}

function harnessAssertSeedValue_(ctx, label, moduleName, sheetName, row, col, expected) {
  ctx.assert.equals(label, ctx.read.sheetValue(sheetName, row, col), expected, {
    module: moduleName,
    location: sheetName + '!R' + row + 'C' + col
  });
}
