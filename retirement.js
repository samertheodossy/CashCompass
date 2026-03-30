var RETIREMENT_SCENARIOS_ = ['Conservative', 'Base', 'Aggressive'];

function getRetirementUiData() {
  const sheet = getOrCreateRetirementSheet_();
  const data = getRetirementModelData_(sheet);
  writeRetirementOutputs_(sheet, data.analysis);
  return data;
}

function saveRetirementInputs(payload) {
  const sheet = getOrCreateRetirementSheet_();

  const selectedScenario = normalizeRetirementScenario_(payload.selectedScenario || 'Base');
  const household = {
    yourCurrentAge: toNumber_(payload.yourCurrentAge),
    spouseCurrentAge: toNumber_(payload.spouseCurrentAge)
  };

  const scenarioInputs = {
    targetRetirementAge: toNumber_(payload.targetRetirementAge),
    householdRetirementSpendingPerYear: toNumber_(payload.householdRetirementSpendingPerYear),
    yourSocialSecurityPerYear: toNumber_(payload.yourSocialSecurityPerYear),
    spouseSocialSecurityPerYear: toNumber_(payload.spouseSocialSecurityPerYear),
    otherRetirementIncomePerYear: toNumber_(payload.otherRetirementIncomePerYear),
    annualContributions: toNumber_(payload.annualContributions),
    expectedAnnualReturnPct: toNumber_(payload.expectedAnnualReturnPct),
    inflationPct: toNumber_(payload.inflationPct),
    safeWithdrawalRatePct: toNumber_(payload.safeWithdrawalRatePct),
    oneTimeFutureCashNeeds: toNumber_(payload.oneTimeFutureCashNeeds)
  };

  validateRetirementHousehold_(household);
  validateRetirementScenarioInputs_(household, scenarioInputs);

  writeRetirementHouseholdInputs_(sheet, household);
  writeRetirementScenarioInputs_(sheet, selectedScenario, scenarioInputs);
  setSelectedRetirementScenario_(sheet, selectedScenario);

  const data = getRetirementModelData_(sheet);
  writeRetirementOutputs_(sheet, data.analysis);
  touchDashboardSourceUpdated_('retirement');

  return {
    ok: true,
    message: 'Retirement assumptions updated.',
    data: data
  };
}

function getRetirementSummary_() {
  const sheet = getOrCreateRetirementSheet_();
  return getRetirementModelData_(sheet);
}

function getRetirementSummarySafe_() {
  try {
    return getRetirementSummary_();
  } catch (e) {
    return {
      selectedScenario: 'Base',
      household: null,
      scenarios: null,
      analyses: null,
      analysis: null,
      error: e && e.message ? e.message : String(e)
    };
  }
}

function getRetirementModelData_(sheet) {
  const selectedScenario = getSelectedRetirementScenario_(sheet);
  const household = getRetirementHouseholdInputs_(sheet);
  const scenarios = {};
  const analyses = {};

  RETIREMENT_SCENARIOS_.forEach(function(name) {
    const inputs = getRetirementScenarioInputs_(sheet, name);
    scenarios[name] = inputs;
    analyses[name] = calculateRetirementPlan_(household, inputs, name);
  });

  return {
    selectedScenario: selectedScenario,
    household: household,
    scenarios: scenarios,
    analyses: analyses,
    analysis: analyses[selectedScenario]
  };
}

function getOrCreateRetirementSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'INPUT - Retirement';
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);

  const rows = [
    ['Setting', 'Value', '', ''],
    ['Selected Scenario', 'Base', '', ''],
    ['', '', '', ''],
    ['Household Input', 'Value', '', ''],
    ['Your Current Age', 53, '', ''],
    ['Spouse Current Age', 47, '', ''],
    ['', '', '', ''],
    ['Scenario Input', 'Conservative', 'Base', 'Aggressive'],
    ['Target Retirement Age', 60, 60, 58],
    ['Household Retirement Spending / Year', 180000, 180000, 180000],
    ['Your Social Security / Year', 36000, 36000, 35000],
    ['Spouse Social Security / Year', 20000, 20000, 18000],
    ['Other Retirement Income / Year', 0, 0, 0],
    ['Annual Contributions', 0, 50000, 60000],
    ['Expected Annual Return %', 4, 6, 8.5],
    ['Inflation %', 2.5, 2.5, 2.25],
    ['Safe Withdrawal Rate %', 4, 4, 4.25],
    ['One-Time Future Cash Needs', 0, 0, 100000],
    ['', '', '', ''],
    ['Selected Scenario Output', 'Value', '', ''],
    ['Current Investable Assets', '', '', ''],
    ['Retirement Goal Amount', '', '', ''],
    ['Funded %', '', '', ''],
    ['Can Retire Now', '', '', ''],
    ['Estimated Retirement Age', '', '', ''],
    ['Years Until Retirement', '', '', ''],
    ['Projected Assets At Target Age', '', '', ''],
    ['Surplus At Target Age', '', '', ''],
    ['Shortfall At Target Age', '', '', ''],
    ['Max Annual Spend Today', '', '', ''],
    ['Household Retirement Income / Year', '', '', ''],
    ['Spouse Age At Retirement', '', '', ''],
    ['Real Return %', '', '', ''],
    ['Money Runs Out Age', '', '', ''],
    ['Monte Carlo Success %', '', '', ''],
    ['Scenario Summary', '', '', '']
  ];

  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 4, 220);

  sheet.getRange('A1:D1').setFontWeight('bold');
  sheet.getRange('A4:B4').setFontWeight('bold');
  sheet.getRange('A8:D8').setFontWeight('bold');
  sheet.getRange('A20:B20').setFontWeight('bold');

  applyCurrencyFormat_(sheet.getRange('B10:D10'));
  applyCurrencyFormat_(sheet.getRange('B11:D11'));
  applyCurrencyFormat_(sheet.getRange('B12:D12'));
  applyCurrencyFormat_(sheet.getRange('B13:D13'));
  applyCurrencyFormat_(sheet.getRange('B14:D14'));
  sheet.getRange('B15:D15').setNumberFormat('0.00');
  sheet.getRange('B16:D16').setNumberFormat('0.00');
  sheet.getRange('B17:D17').setNumberFormat('0.00');
  applyCurrencyFormat_(sheet.getRange('B18:D18'));

  applyCurrencyFormat_(sheet.getRange('B21'));
  applyCurrencyFormat_(sheet.getRange('B22'));
  sheet.getRange('B23').setNumberFormat('0.00%');
  sheet.getRange('B24').setNumberFormat('@');
  sheet.getRange('B25').setNumberFormat('0');
  sheet.getRange('B26').setNumberFormat('0');
  applyCurrencyFormat_(sheet.getRange('B27'));
  applyCurrencyFormat_(sheet.getRange('B28'));
  applyCurrencyFormat_(sheet.getRange('B29'));
  applyCurrencyFormat_(sheet.getRange('B30'));
  applyCurrencyFormat_(sheet.getRange('B31'));
  sheet.getRange('B32').setNumberFormat('0');
  sheet.getRange('B33').setNumberFormat('0.00%');
  sheet.getRange('B34').setNumberFormat('@');
  sheet.getRange('B35').setNumberFormat('0.00%');

  return sheet;
}

function getSelectedRetirementScenario_(sheet) {
  const cell = findLabelValueCell_(sheet, 'Selected Scenario');
  const value = cell ? String(cell.getValue() || '').trim() : 'Base';
  return normalizeRetirementScenario_(value || 'Base');
}

function setSelectedRetirementScenario_(sheet, scenarioName) {
  const cell = findLabelValueCell_(sheet, 'Selected Scenario');
  if (!cell) throw new Error('Selected Scenario label not found.');
  cell.setValue(normalizeRetirementScenario_(scenarioName));
}

function normalizeRetirementScenario_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'conservative') return 'Conservative';
  if (text === 'aggressive') return 'Aggressive';
  return 'Base';
}

function getRetirementHouseholdInputs_(sheet) {
  return {
    yourCurrentAge: toNumber_(findLabelValueCell_(sheet, 'Your Current Age').getValue()),
    spouseCurrentAge: toNumber_(findLabelValueCell_(sheet, 'Spouse Current Age').getValue())
  };
}

function writeRetirementHouseholdInputs_(sheet, household) {
  setRetirementLabelValue_(sheet, 'Your Current Age', round2_(household.yourCurrentAge));
  setRetirementLabelValue_(sheet, 'Spouse Current Age', round2_(household.spouseCurrentAge));
}

function getRetirementScenarioInputs_(sheet, scenarioName) {
  const col = getRetirementScenarioColumn_(scenarioName);
  return {
    targetRetirementAge: toNumber_(sheet.getRange(getRetirementScenarioRow_('Target Retirement Age'), col).getValue()),
    householdRetirementSpendingPerYear: toNumber_(sheet.getRange(getRetirementScenarioRow_('Household Retirement Spending / Year'), col).getValue()),
    yourSocialSecurityPerYear: toNumber_(sheet.getRange(getRetirementScenarioRow_('Your Social Security / Year'), col).getValue()),
    spouseSocialSecurityPerYear: toNumber_(sheet.getRange(getRetirementScenarioRow_('Spouse Social Security / Year'), col).getValue()),
    otherRetirementIncomePerYear: toNumber_(sheet.getRange(getRetirementScenarioRow_('Other Retirement Income / Year'), col).getValue()),
    annualContributions: toNumber_(sheet.getRange(getRetirementScenarioRow_('Annual Contributions'), col).getValue()),
    expectedAnnualReturnPct: toNumber_(sheet.getRange(getRetirementScenarioRow_('Expected Annual Return %'), col).getValue()),
    inflationPct: toNumber_(sheet.getRange(getRetirementScenarioRow_('Inflation %'), col).getValue()),
    safeWithdrawalRatePct: toNumber_(sheet.getRange(getRetirementScenarioRow_('Safe Withdrawal Rate %'), col).getValue()),
    oneTimeFutureCashNeeds: toNumber_(sheet.getRange(getRetirementScenarioRow_('One-Time Future Cash Needs'), col).getValue())
  };
}

function writeRetirementScenarioInputs_(sheet, scenarioName, inputs) {
  const col = getRetirementScenarioColumn_(scenarioName);
  sheet.getRange(getRetirementScenarioRow_('Target Retirement Age'), col).setValue(round2_(inputs.targetRetirementAge));
  sheet.getRange(getRetirementScenarioRow_('Household Retirement Spending / Year'), col).setValue(round2_(inputs.householdRetirementSpendingPerYear));
  sheet.getRange(getRetirementScenarioRow_('Your Social Security / Year'), col).setValue(round2_(inputs.yourSocialSecurityPerYear));
  sheet.getRange(getRetirementScenarioRow_('Spouse Social Security / Year'), col).setValue(round2_(inputs.spouseSocialSecurityPerYear));
  sheet.getRange(getRetirementScenarioRow_('Other Retirement Income / Year'), col).setValue(round2_(inputs.otherRetirementIncomePerYear));
  sheet.getRange(getRetirementScenarioRow_('Annual Contributions'), col).setValue(round2_(inputs.annualContributions));
  sheet.getRange(getRetirementScenarioRow_('Expected Annual Return %'), col).setValue(round2_(inputs.expectedAnnualReturnPct));
  sheet.getRange(getRetirementScenarioRow_('Inflation %'), col).setValue(round2_(inputs.inflationPct));
  sheet.getRange(getRetirementScenarioRow_('Safe Withdrawal Rate %'), col).setValue(round2_(inputs.safeWithdrawalRatePct));
  sheet.getRange(getRetirementScenarioRow_('One-Time Future Cash Needs'), col).setValue(round2_(inputs.oneTimeFutureCashNeeds));
}

function getRetirementScenarioColumn_(scenarioName) {
  const name = normalizeRetirementScenario_(scenarioName);
  if (name === 'Conservative') return 2;
  if (name === 'Base') return 3;
  return 4;
}

function getRetirementScenarioRow_(label) {
  const map = {
    'Target Retirement Age': 9,
    'Household Retirement Spending / Year': 10,
    'Your Social Security / Year': 11,
    'Spouse Social Security / Year': 12,
    'Other Retirement Income / Year': 13,
    'Annual Contributions': 14,
    'Expected Annual Return %': 15,
    'Inflation %': 16,
    'Safe Withdrawal Rate %': 17,
    'One-Time Future Cash Needs': 18
  };
  if (!Object.prototype.hasOwnProperty.call(map, label)) {
    throw new Error('Unknown retirement scenario row: ' + label);
  }
  return map[label];
}

function setRetirementLabelValue_(sheet, label, value) {
  const cell = findLabelValueCell_(sheet, label);
  if (!cell) throw new Error('Retirement sheet label not found: ' + label);
  cell.setValue(value);
}

function writeRetirementOutputs_(sheet, analysis) {
  setRetirementLabelValue_(sheet, 'Current Investable Assets', analysis.currentInvestableAssets);
  setRetirementLabelValue_(sheet, 'Retirement Goal Amount', analysis.retirementGoalAmount);
  setRetirementLabelValue_(sheet, 'Funded %', analysis.fundedPct / 100);
  setRetirementLabelValue_(sheet, 'Can Retire Now', analysis.canRetireNow ? 'Yes' : 'No');
  setRetirementLabelValue_(sheet, 'Estimated Retirement Age', analysis.estimatedRetirementAge === null ? '' : analysis.estimatedRetirementAge);
  setRetirementLabelValue_(sheet, 'Years Until Retirement', analysis.yearsUntilRetirement === null ? '' : analysis.yearsUntilRetirement);
  setRetirementLabelValue_(sheet, 'Projected Assets At Target Age', analysis.projectedAssetsAtTargetAge);
  setRetirementLabelValue_(sheet, 'Surplus At Target Age', analysis.surplusAtTargetAge);
  setRetirementLabelValue_(sheet, 'Shortfall At Target Age', analysis.shortfallAtTargetAge);
  setRetirementLabelValue_(sheet, 'Max Annual Spend Today', analysis.maxAnnualSpendToday);
  setRetirementLabelValue_(sheet, 'Household Retirement Income / Year', analysis.householdRetirementIncomePerYear);
  setRetirementLabelValue_(sheet, 'Spouse Age At Retirement', analysis.spouseAgeAtRetirement === null ? '' : analysis.spouseAgeAtRetirement);
  setRetirementLabelValue_(sheet, 'Real Return %', analysis.realReturnPct / 100);
  setRetirementLabelValue_(sheet, 'Money Runs Out Age', analysis.moneyRunsOutAge === null ? 'Never (under assumptions)' : analysis.moneyRunsOutAge);
  setRetirementLabelValue_(sheet, 'Monte Carlo Success %', analysis.monteCarloSuccessProbabilityPct / 100);
  setRetirementLabelValue_(sheet, 'Scenario Summary', analysis.summary);
}

function validateRetirementHousehold_(household) {
  if (household.yourCurrentAge <= 0) throw new Error('Your Current Age must be greater than 0.');
  if (household.spouseCurrentAge < 0) throw new Error('Spouse Current Age cannot be negative.');
}

function validateRetirementScenarioInputs_(household, inputs) {
  if (inputs.targetRetirementAge < household.yourCurrentAge) {
    throw new Error('Target Retirement Age must be greater than or equal to Your Current Age.');
  }
  if (inputs.householdRetirementSpendingPerYear < 0) throw new Error('Household Retirement Spending / Year cannot be negative.');
  if (inputs.yourSocialSecurityPerYear < 0) throw new Error('Your Social Security / Year cannot be negative.');
  if (inputs.spouseSocialSecurityPerYear < 0) throw new Error('Spouse Social Security / Year cannot be negative.');
  if (inputs.otherRetirementIncomePerYear < 0) throw new Error('Other Retirement Income / Year cannot be negative.');
  if (inputs.annualContributions < 0) throw new Error('Annual Contributions cannot be negative.');
  if (inputs.expectedAnnualReturnPct < -100) throw new Error('Expected Annual Return % is invalid.');
  if (inputs.inflationPct < -100) throw new Error('Inflation % is invalid.');
  if (inputs.safeWithdrawalRatePct <= 0) throw new Error('Safe Withdrawal Rate % must be greater than 0.');
  if (inputs.oneTimeFutureCashNeeds < 0) throw new Error('One-Time Future Cash Needs cannot be negative.');
}

function calculateRetirementPlan_(household, inputs, scenarioName) {
  validateRetirementHousehold_(household);
  validateRetirementScenarioInputs_(household, inputs);

  const currentInvestableAssets = getCurrentInvestableAssetsForRetirement_();
  const householdRetirementIncomePerYear =
    inputs.yourSocialSecurityPerYear +
    inputs.spouseSocialSecurityPerYear +
    inputs.otherRetirementIncomePerYear;

  const spendingNeed = Math.max(0, inputs.householdRetirementSpendingPerYear - householdRetirementIncomePerYear);
  const retirementGoalAmount = round2_(
    spendingNeed / (inputs.safeWithdrawalRatePct / 100) + inputs.oneTimeFutureCashNeeds
  );

  const fundedPct = retirementGoalAmount > 0
    ? round2_((currentInvestableAssets / retirementGoalAmount) * 100)
    : 100;

  const canRetireNow = currentInvestableAssets >= retirementGoalAmount;
  const realReturn = ((1 + inputs.expectedAnnualReturnPct / 100) / (1 + inputs.inflationPct / 100)) - 1;

  let estimatedRetirementAge = null;
  let yearsUntilRetirement = null;
  let projectedAssetsAtTargetAge = currentInvestableAssets;

  for (let y = 0; y <= 70; y++) {
    const age = household.yourCurrentAge + y;
    const projected = projectRetirementAssets_(currentInvestableAssets, inputs.annualContributions, realReturn, y);

    if (age === inputs.targetRetirementAge) {
      projectedAssetsAtTargetAge = projected;
    }

    if (estimatedRetirementAge === null && projected >= retirementGoalAmount) {
      estimatedRetirementAge = age;
      yearsUntilRetirement = y;
    }
  }

  if (inputs.targetRetirementAge === household.yourCurrentAge) {
    projectedAssetsAtTargetAge = currentInvestableAssets;
  }

  const gapAtTargetAge = round2_(retirementGoalAmount - projectedAssetsAtTargetAge);
  const surplusAtTargetAge = gapAtTargetAge < 0 ? round2_(Math.abs(gapAtTargetAge)) : 0;
  const shortfallAtTargetAge = gapAtTargetAge > 0 ? round2_(gapAtTargetAge) : 0;

  const maxAnnualSpendToday = round2_(
    currentInvestableAssets * (inputs.safeWithdrawalRatePct / 100) + householdRetirementIncomePerYear
  );

  const spouseAgeAtRetirement = inputs.targetRetirementAge - household.yourCurrentAge + household.spouseCurrentAge;
  const moneyRunsOutAge = simulateMoneyRunsOutAge_(
    projectedAssetsAtTargetAge,
    spendingNeed,
    realReturn,
    inputs.targetRetirementAge
  );

  const monteCarloSuccessProbabilityPct = simulateMonteCarloSuccess_({
    currentAge: household.yourCurrentAge,
    retirementAge: inputs.targetRetirementAge,
    currentAssets: currentInvestableAssets,
    annualContribution: inputs.annualContributions,
    annualSpendingNeed: spendingNeed,
    meanRealReturn: realReturn,
    endAge: 95,
    simulations: 350
  });

  let summary = '';
  if (canRetireNow) {
    summary = scenarioName + ': household is already funded for retirement under current assumptions.';
  } else if (estimatedRetirementAge !== null) {
    summary = scenarioName + ': estimated retirement age is ' + estimatedRetirementAge + '.';
  } else {
    summary = scenarioName + ': retirement goal is not reached within the modeled horizon.';
  }

  return {
    scenarioName: scenarioName,
    yourCurrentAge: household.yourCurrentAge,
    spouseCurrentAge: household.spouseCurrentAge,
    targetRetirementAge: inputs.targetRetirementAge,
    spouseAgeAtRetirement: round2_(spouseAgeAtRetirement),
    currentInvestableAssets: round2_(currentInvestableAssets),
    householdRetirementIncomePerYear: round2_(householdRetirementIncomePerYear),
    retirementGoalAmount: round2_(retirementGoalAmount),
    fundedPct: round2_(fundedPct),
    canRetireNow: canRetireNow,
    estimatedRetirementAge: estimatedRetirementAge,
    yearsUntilRetirement: yearsUntilRetirement,
    projectedAssetsAtTargetAge: round2_(projectedAssetsAtTargetAge),
    surplusAtTargetAge: round2_(surplusAtTargetAge),
    shortfallAtTargetAge: round2_(shortfallAtTargetAge),
    maxAnnualSpendToday: round2_(maxAnnualSpendToday),
    realReturnPct: round2_(realReturn * 100),
    moneyRunsOutAge: moneyRunsOutAge,
    monteCarloSuccessProbabilityPct: round2_(monteCarloSuccessProbabilityPct),
    summary: summary
  };
}

function projectRetirementAssets_(startingAssets, annualContributions, realReturn, years) {
  let assets = Number(startingAssets || 0);
  for (let i = 0; i < years; i++) {
    assets = assets * (1 + realReturn) + annualContributions;
  }
  return round2_(assets);
}

function simulateMoneyRunsOutAge_(startingAssetsAtRetirement, annualSpendingNeed, realReturn, retirementAge) {
  let assets = Number(startingAssetsAtRetirement || 0);

  if (annualSpendingNeed <= 0) return null;

  for (let age = retirementAge; age <= 110; age++) {
    assets = assets * (1 + realReturn) - annualSpendingNeed;
    if (assets <= 0) return age;
  }
  return null;
}

function simulateMonteCarloSuccess_(cfg) {
  const simulations = cfg.simulations || 300;
  let successCount = 0;

  for (let i = 0; i < simulations; i++) {
    let assets = Number(cfg.currentAssets || 0);

    for (let age = cfg.currentAge; age < cfg.retirementAge; age++) {
      const yearlyReturn = randomNormal_(cfg.meanRealReturn, 0.12);
      assets = assets * (1 + yearlyReturn) + cfg.annualContribution;
      if (assets <= 0) break;
    }

    if (assets > 0) {
      for (let age2 = cfg.retirementAge; age2 <= cfg.endAge; age2++) {
        const yearlyReturn2 = randomNormal_(cfg.meanRealReturn, 0.10);
        assets = assets * (1 + yearlyReturn2) - cfg.annualSpendingNeed;
        if (assets <= 0) break;
      }
    }

    if (assets > 0) successCount++;
  }

  return round2_((successCount / simulations) * 100);
}

function randomNormal_(mean, stdDev) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

function getCurrentInvestableAssetsForRetirement_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ASSETS');
  return sumColumnByHeader_(sheet, 'Current Balance');
}