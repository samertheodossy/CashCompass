/**
 * test_harness_data.js — deterministic representative populated-workbook seed.
 *
 * WRITES ONLY through a Test Harness ctx whose target has already passed
 * assertDisposableTarget_ and the Restricted-sharing gate. Every module calls
 * ctx.assertWritable() immediately before writing. Production wrappers keep
 * their existing no-argument behavior; the harness uses only explicit-ss
 * creators/helpers so getUserSpreadsheet_() can never redirect these writes.
 */

/** Synthetic, non-personal values used by the populated-fixture scenario. */
function getHarnessRepresentativeProfile_() {
  return {
    profile: {
      name: 'Test Household',
      // Intentionally blank: later planner scenarios must never attempt email.
      email: '',
      dob: '1985-06-15'
    },
    bank: {
      name: 'Test Checking',
      balance: 12500,
      availableNow: 11000,
      minBuffer: 3000,
      type: 'Checking',
      usePolicy: 'USE_FOR_BILLS',
      priority: 1
    },
    investment: {
      name: 'Test Brokerage',
      type: 'Brokerage',
      balance: 85000
    },
    house: {
      name: 'Test Home',
      type: 'Primary Residence',
      value: 650000,
      loan: 320000
    },
    debt: {
      name: 'Test Visa',
      type: 'Credit Card',
      balance: 4500,
      dueDay: 15,
      creditLimit: 15000,
      minimumPayment: 150,
      creditLeft: 10500,
      interestRate: 21.9,
      pctAvailable: 70
    },
    bill: {
      payee: 'Test Electric',
      category: 'Utilities',
      dueDay: 12,
      amount: 180,
      paymentSource: 'CASH',
      frequency: 'Monthly'
    },
    income: {
      payee: 'Test Salary',
      amount: 6500
    },
    upcoming: {
      id: 'HARNESS-UPCOMING-001',
      name: 'Test Annual Insurance',
      category: 'Insurance',
      payee: 'Test Insurance Co',
      amount: 1200,
      accountSource: 'CASH'
    },
    retirement: {
      targetAge: 65,
      annualSpending: 72000,
      socialSecurity: 30000,
      spouseSocialSecurity: 0,
      otherIncome: 0,
      contributions: 18000,
      returnPct: 6,
      inflationPct: 2.5,
      withdrawalPct: 4,
      futureNeeds: 50000
    }
  };
}

/** Seed the complete representative profile and retain locations for assertions. */
function harnessSeedRepresentativeWorkbook_(ctx) {
  var p = getHarnessRepresentativeProfile_();
  var ss = ctx.ss;
  var year = (typeof getCurrentYear_ === 'function') ? getCurrentYear_() : new Date().getFullYear();
  var today = new Date();
  var locations = {};

  harnessSeedProfile_(ctx, p.profile);
  locations.bank = harnessSeedBank_(ctx, p.bank, year, today);
  locations.investment = harnessSeedInvestment_(ctx, p.investment, year, today);
  locations.house = harnessSeedHouse_(ctx, p.house, year, today);
  locations.debt = harnessSeedDebt_(ctx, p.debt);
  locations.bill = harnessSeedBill_(ctx, p.bill);
  locations.income = harnessSeedIncome_(ctx, p.income, year, today);
  locations.upcoming = harnessSeedUpcoming_(ctx, p.upcoming, today);
  locations.retirement = harnessSeedRetirement_(ctx, p.retirement);

  ctx.assertWritable();
  ensureActivityLogSheet_(ss);
  ctx.actions.push('Create canonical LOG - Activity structure');

  SpreadsheetApp.flush();
  ctx.representativeProfile = p;
  ctx.representativeLocations = locations;
}

function harnessSeedProfile_(ctx, profile) {
  ctx.assertWritable();
  var sheet = ensureInputSettingsSheet_(ctx.ss);
  writeSetting_(sheet, PROFILE_KEYS_.NAME, profile.name, true);
  writeSetting_(sheet, PROFILE_KEYS_.EMAIL, profile.email, true);
  writeSetting_(sheet, PROFILE_KEYS_.DOB, profile.dob, true);
  ctx.actions.push('Seed synthetic Profile and Date of Birth');
}

function harnessSeedBank_(ctx, bank, year, today) {
  ctx.assertWritable();
  ensureOnboardingBankAccountsSheetFromDashboard('normal', ctx.ss);
  var input = ctx.ss.getSheetByName(getSheetNames_().BANK_ACCOUNTS);
  var block = getBankAccountsYearBlock_(input, year);
  var row = insertNewBankAccountHistoryRow_(input, block, bank.name);
  var monthCol = getMonthColumnByDate_(input, today, block.headerRow);
  setCurrencyCellPreserveRowFormat_(input, row, monthCol, bank.balance, block.firstMonthCol);
  refreshBankAccountsTotalAccountsRow_(input, year);

  ctx.assertWritable();
  var sys = ensureSysAccountsSheet_(ctx.ss);
  var sysRow = harnessAppendByHeader_(sys, {
    'Account Name': bank.name,
    'Current Balance': bank.balance,
    'Available Now': bank.availableNow,
    'Min Buffer': bank.minBuffer,
    'Type': bank.type,
    'Use Policy': bank.usePolicy,
    'Priority': bank.priority,
    'Active': 'Yes'
  });
  ctx.actions.push('Seed representative Bank Account and SYS mirror');
  return { inputSheet: input.getName(), row: row, monthCol: monthCol, sysSheet: sys.getName(), sysRow: sysRow };
}

function harnessSeedInvestment_(ctx, investment, year, today) {
  ctx.assertWritable();
  var input = ensureInputInvestmentsSheet_(ctx.ss);
  var block = getInvestmentsYearBlock_(input, year);
  var row = insertNewInvestmentHistoryRow_(input, block, investment.name, investment.type);
  var monthCol = getMonthColumnByDate_(input, today, block.headerRow);
  setCurrencyCellPreserveRowFormat_(input, row, monthCol, investment.balance, block.firstMonthCol);
  refreshInvestmentsAccountTotalsRow_(input, year);

  ctx.assertWritable();
  var sys = ensureSysAssetsSheet_(ctx.ss);
  var sysRow = harnessAppendByHeader_(sys, {
    'Account Name': investment.name,
    'Type': investment.type,
    'Current Balance': investment.balance,
    'Active': 'Yes'
  });
  ctx.actions.push('Seed representative Investment and SYS mirror');
  return { inputSheet: input.getName(), row: row, monthCol: monthCol, sysSheet: sys.getName(), sysRow: sysRow };
}

function harnessSeedHouse_(ctx, house, year, today) {
  ctx.assertWritable();
  var input = ensureInputHouseValuesSheet_(ctx.ss);
  var block = getHouseValuesYearBlock_(input, year);
  var row = insertNewHouseHistoryRow_(input, block, house.name, house.loan);
  var monthCol = getMonthColumnByDate_(input, today, block.headerRow);
  setCurrencyCellPreserveRowFormat_(input, row, monthCol, house.value, block.firstMonthCol);

  ctx.assertWritable();
  var sys = ensureSysHouseAssetsSheet_(ctx.ss);
  var sysRow = harnessAppendByHeader_(sys, {
    'House': house.name,
    'Type': house.type,
    'Loan Amount Left': house.loan,
    'Current Value': house.value,
    'Active': 'Yes'
  });

  ctx.assertWritable();
  createHousesExpenseSheet_(ctx.ss, house.name);
  ctx.actions.push('Seed representative House, SYS mirror, and property expense sheet');
  return { inputSheet: input.getName(), row: row, monthCol: monthCol, sysSheet: sys.getName(), sysRow: sysRow };
}

function harnessSeedDebt_(ctx, debt) {
  ctx.assertWritable();
  ensureOnboardingDebtsSheetFromDashboard('normal', ctx.ss);
  var sheet = ctx.ss.getSheetByName(getSheetNames_().DEBTS);
  var hm = getDebtsHeaderMap_(sheet);
  var existingTotalRow = findDebtTotalRow_(sheet, hm);
  var debtValues = {
    'Account Name': debt.name,
    'Type': debt.type,
    'Account Balance': debt.balance,
    'Due Date': debt.dueDay,
    'Credit Limit': debt.creditLimit,
    'Minimum Payment': debt.minimumPayment,
    'Credit Left': debt.creditLeft,
    'Int Rate': debt.interestRate,
    'Acct PCT Avail': debt.pctAvailable,
    'Active': 'Yes',
    'Linked Property': ''
  };
  // Central first-create sheets already contain TOTAL DEBT. Insert the
  // representative debt above that summary so the fixture matches the same
  // row ordering used by the production debt writer. Never append active
  // fixture data below the summary row.
  var row = existingTotalRow === -1
    ? harnessAppendByHeader_(sheet, debtValues)
    : harnessInsertBeforeByHeader_(sheet, existingTotalRow, debtValues);
  var totalRow = seedDebtsTotalRow_(sheet, hm);
  refreshDebtsTotalRow_(sheet, hm, totalRow);
  // insertRowBefore() inherits the TOTAL DEBT row's green band when the
  // summary is the only existing body row. Reapply the canonical Debts
  // presentation so the fixture's new account row is white and only the
  // summary remains green—the same visual contract as a production add.
  applyDebtsSheetStyling_(sheet);
  ctx.actions.push('Seed representative Debt and TOTAL DEBT formulas');
  return { sheet: sheet.getName(), row: row, balanceCol: hm.balanceCol };
}

function harnessSeedBill_(ctx, bill) {
  ctx.assertWritable();
  ensureOnboardingBillsSheetFromDashboard('normal', ctx.ss);
  var sheet = ctx.ss.getSheetByName(getSheetNames_().BILLS);
  var row = harnessAppendByHeader_(sheet, {
    'Payee': bill.payee,
    'Category': bill.category,
    'Due Day': bill.dueDay,
    'Default Amount': bill.amount,
    'Varies': 'No',
    'Autopay': 'No',
    'Active': 'Yes',
    'Payment Source': bill.paymentSource,
    'Frequency': bill.frequency,
    'Start Month': 1,
    'Notes': 'Synthetic harness bill'
  });
  ctx.actions.push('Seed representative recurring Bill');
  return { sheet: sheet.getName(), row: row, amountCol: harnessHeaderColumn_(sheet, 'Default Amount') };
}

function harnessSeedIncome_(ctx, income, year, today) {
  ctx.assertWritable();
  var sheet = buildCashFlowYearSheet_(ctx.ss, year);
  var inserted = insertCashFlowRow_(sheet, 'Income', income.payee, 'CASH');
  var monthCol = getMonthColumnByDate_(sheet, today, 1);
  setCurrencyCellPreserveRowFormat_(sheet, inserted.row, monthCol, income.amount, 5);
  ctx.actions.push('Seed representative Income in current Cash Flow month');
  return { sheet: sheet.getName(), row: inserted.row, monthCol: monthCol };
}

function harnessSeedUpcoming_(ctx, upcoming, today) {
  ctx.assertWritable();
  var sheet = getOrCreateUpcomingExpensesSheet_(ctx.ss);
  var due = new Date(today.getFullYear(), today.getMonth() + 1, 15);
  var row = harnessAppendByHeader_(sheet, {
    'ID': upcoming.id,
    'Status': 'Planned',
    'Expense Name': upcoming.name,
    'Category': upcoming.category,
    'Payee': upcoming.payee,
    'Due Date': due,
    'Amount': upcoming.amount,
    'Account / Source': upcoming.accountSource,
    'Auto Add To Cash Flow': 'No',
    'Added To Cash Flow': 'No',
    'Notes': 'Synthetic harness upcoming expense'
  });
  ctx.actions.push('Seed representative Upcoming Expense');
  return { sheet: sheet.getName(), row: row, amountCol: harnessHeaderColumn_(sheet, 'Amount') };
}

function harnessSeedRetirement_(ctx, retirement) {
  ctx.assertWritable();
  var sheet = getOrCreateRetirementSheet_(ctx.ss);
  harnessSetRetirementScenarioValue_(sheet, 'Target Retirement Age', retirement.targetAge);
  harnessSetRetirementScenarioValue_(sheet, 'Household Retirement Spending / Year', retirement.annualSpending);
  harnessSetRetirementScenarioValue_(sheet, 'Your Social Security / Year', retirement.socialSecurity);
  harnessSetRetirementScenarioValue_(sheet, 'Spouse Social Security / Year', retirement.spouseSocialSecurity);
  harnessSetRetirementScenarioValue_(sheet, 'Other Retirement Income / Year', retirement.otherIncome);
  harnessSetRetirementScenarioValue_(sheet, 'Annual Contributions', retirement.contributions);
  harnessSetRetirementScenarioValue_(sheet, 'Expected Annual Return %', retirement.returnPct);
  harnessSetRetirementScenarioValue_(sheet, 'Inflation %', retirement.inflationPct);
  harnessSetRetirementScenarioValue_(sheet, 'Safe Withdrawal Rate %', retirement.withdrawalPct);
  harnessSetRetirementScenarioValue_(sheet, 'One-Time Future Cash Needs', retirement.futureNeeds);
  ctx.actions.push('Seed representative Base retirement assumptions');
  return {
    sheet: sheet.getName(),
    spendingRow: harnessFindLabelRow_(sheet, 'Household Retirement Spending / Year'),
    baseCol: 3
  };
}

/** Append one row by exact canonical header labels; unknown labels are refused. */
function harnessAppendByHeader_(sheet, valuesByHeader) {
  var row = harnessBuildRowByHeader_(sheet, valuesByHeader);
  sheet.appendRow(row);
  return sheet.getLastRow();
}

/** Insert one canonical row immediately before an existing summary row. */
function harnessInsertBeforeByHeader_(sheet, beforeRow, valuesByHeader) {
  var row = harnessBuildRowByHeader_(sheet, valuesByHeader);
  sheet.insertRowBefore(beforeRow);
  sheet.getRange(beforeRow, 1, 1, row.length).setValues([row]);
  return beforeRow;
}

/** Build one row by exact canonical header labels; unknown labels are refused. */
function harnessBuildRowByHeader_(sheet, valuesByHeader) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  var row = [];
  for (var i = 0; i < headers.length; i++) row.push('');
  for (var key in valuesByHeader) {
    if (!valuesByHeader.hasOwnProperty(key)) continue;
    var col = headers.indexOf(key);
    if (col === -1) throw new Error('Harness seed: missing canonical header "' + key + '" on ' + sheet.getName() + '.');
    row[col] = valuesByHeader[key];
  }
  return row;
}

function harnessHeaderColumn_(sheet, header) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  var idx = headers.indexOf(header);
  if (idx === -1) throw new Error('Harness seed: missing header "' + header + '" on ' + sheet.getName() + '.');
  return idx + 1;
}

function harnessFindLabelRow_(sheet, label) {
  var values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === label) return i + 1;
  }
  throw new Error('Harness seed: missing retirement label "' + label + '".');
}

function harnessSetRetirementScenarioValue_(sheet, label, value) {
  sheet.getRange(harnessFindLabelRow_(sheet, label), 3).setValue(value); // Base scenario column
}
