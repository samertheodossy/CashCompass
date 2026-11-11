/**
 * Debt payoff projection — read-only views from INPUT - Debts + INPUT - Cash Flow.
 * Household strategy comparison (minimum-only / avalanche / snowball) is a
 * hypothetical, non-writing overlay on Debt Overview. It does not change
 * This Week or Rolling Debt Payoff.
 */

/**
 * @returns {{
 *   projectionYears: number[],
 *   debts: Array<object>,
 *   summary: object,
 *   recommendations: string[],
 *   warnings: string[],
 *   missingCashFlowSheets: string[]
 * }}
 */
function debtPayoffPositionMethodNote_() {
  return 'Property loans: estimated months use principal-and-interest only at the saved APR. The full minimum, which may include escrow, stays the monthly budget amount and is not applied to principal. If P&I versus escrow is not saved, the estimate is incomplete. Other Loan and HELOC rows: monthly amortization of the saved minimum. Other types: balance ÷ minimum payment (rough). If payment ≤ monthly interest on a loan, payoff is shown as unavailable.';
}

function readDebtPayoffWorkbookFacts_(ss) {
  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const y = getCurrentYear_();
  const projectionYears = [y - 1, y];
  const sheetNames = getSheetNames_();
  if (
    !ss.getSheetByName(sheetNames.DEBTS) ||
    !ss.getSheetByName(sheetNames.ACCOUNTS)
  ) {
    return {
      empty: true,
      ss: ss,
      tz: tz,
      today: today,
      y: y,
      projectionYears: projectionYears
    };
  }

  const aliasMap = getAliasMap_();
  const debts = normalizeDebts_(readSheetAsObjects_(ss, 'DEBTS'), aliasMap);
  const accounts = normalizeAccounts_(readSheetAsObjects_(ss, 'ACCOUNTS'));
  return {
    empty: false,
    ss: ss,
    tz: tz,
    today: today,
    y: y,
    projectionYears: projectionYears,
    aliasMap: aliasMap,
    debts: debts,
    accounts: accounts,
    usableCash: calculateUsableCash_(accounts)
  };
}

function buildDebtPayoffEmptyPosition_(facts) {
  return {
    projectionYears: facts.projectionYears,
    debts: [],
    summary: {
      totalDebtBalance: 0,
      totalMinimumPayments: 0,
      usableCashAfterBuffers: 0,
      totalAvailableNow: 0,
      totalBuffers: 0,
      projectedMonthNetCashFlow: 0,
      longestRoughPayoff: null,
      payoffMethodNote: debtPayoffPositionMethodNote_()
    },
    recommendations: [],
    warnings: [],
    missingCashFlowSheets: []
  };
}

function buildDebtPayoffEmptyRecommendation_(facts) {
  const missingExtra = debtPayoffSupportedMonthlyExtraUnavailable_(
    'INPUT - Debts or SYS - Accounts is missing.');
  return {
    projectionYears: facts.projectionYears,
    supportedMonthlyExtra: missingExtra,
    monthlyRecommendation: buildDebtPayoffMonthlyRecommendation_([], missingExtra, {
      asOfDate: facts.today,
      savedAssumptions: readDebtPayoffSavedPlanningAssumptions_(facts.ss)
    })
  };
}

function buildDebtPayoffPositionFromFacts_(facts) {
  if (facts.empty) return buildDebtPayoffEmptyPosition_(facts);

  const debts = facts.debts;
  const usableCash = facts.usableCash;
  const projectionYears = facts.projectionYears;
  const minimumDueTotal = round2_(
    debts.filter(function(d) {
      return d.active;
    }).reduce(function(sum, d) {
      return sum + d.minimumPayment;
    }, 0)
  );

  const warnings = [];
  const missingCashFlowSheets = [];
  const activeDebts = debts.filter(function(d) { return d.active; });
  const paidByName = sumExpensePaymentsForDebtPayees_(
    facts.ss,
    activeDebts.map(function(d) { return d.name; }),
    projectionYears,
    facts.aliasMap,
    missingCashFlowSheets
  );

  // Debt Overview is an active-debts-only view. Stop-tracked debts (Active=No)
  // stay on INPUT - Debts for history + name reservation but should NOT appear
  // in the bar chart, table, or "longest payoff" callout here.
  const debtsOut = activeDebts.map(function(d) {
    const totalPaid = paidByName[String(d.name || '').trim()] || 0;
    const est = estimateDebtPayoffPositionMonths_(d);

    return {
      name: d.name,
      type: d.type,
      balance: d.balance,
      minimumPayment: d.minimumPayment,
      interestRate: d.interestRate,
      active: d.active,
      cashFlowPaid: totalPaid,
      estimatedPayoffMonths: est.months,
      payoffEstimateIncomplete: est.incomplete === true,
      payoffEstimateIncompleteReason: est.reason || '',
      payoffEstimateMethod: est.method,
      minimumPaymentKnown: d.minimumPaymentKnown !== false,
      interestRateKnown: d.interestRateKnown !== false
    };
  });

  if (missingCashFlowSheets.length > 0) {
    warnings.push(
      'Missing Cash Flow tab(s): ' +
        missingCashFlowSheets.join(', ') +
        ' — CF paid totals use only existing year sheets.'
    );
  }

  const totalDebtBalance = round2_(
    debts.filter(function(d) {
      return d.active && d.balance > 0;
    }).reduce(function(s, d) {
      return s + d.balance;
    }, 0)
  );

  const longest = findLongestRoughPayoff_(debtsOut);

  return {
    projectionYears: projectionYears,
    debts: debtsOut,
    summary: {
      totalDebtBalance: totalDebtBalance,
      totalMinimumPayments: minimumDueTotal,
      usableCashAfterBuffers: round2_(usableCash.usableAfterBuffers),
      totalAvailableNow: round2_(usableCash.totalAvailableNow),
      totalBuffers: round2_(usableCash.totalBuffers),
      projectedMonthNetCashFlow: 0,
      longestRoughPayoff: longest,
      payoffMethodNote: debtPayoffPositionMethodNote_()
    },
    recommendations: [],
    warnings: warnings,
    missingCashFlowSheets: missingCashFlowSheets
  };
}

function buildDebtPayoffRecommendationFromFacts_(facts) {
  if (facts.empty) return buildDebtPayoffEmptyRecommendation_(facts);

  const supported = readDebtPayoffSupportedMonthlyExtra_(
    facts.ss, facts.debts, facts.accounts);
  return {
    projectionYears: facts.projectionYears,
    supportedMonthlyExtra: supported,
    monthlyRecommendation: buildDebtPayoffMonthlyRecommendation_(facts.debts, supported, {
      asOfDate: facts.today,
      savedAssumptions: readDebtPayoffSavedPlanningAssumptions_(facts.ss)
    })
  };
}

function attachDebtPayoffCombinedNotes_(facts, position) {
  if (facts.empty) return position;

  let thisMonthCashFlow = 0;
  try {
    const cashFlowRows = readCashFlowSheetAsObjects_(facts.ss, facts.y);
    const monthHeader = getCurrentMonthHeader_(facts.today, facts.tz);
    const cashFlow = normalizeCashFlow_(cashFlowRows, monthHeader, facts.aliasMap);
    thisMonthCashFlow = round2_(cashFlow.monthNet);
  } catch (e) {
    // ignore — recommendations will omit projected CF line
  }

  const minimumDueTotal = position.summary.totalMinimumPayments;
  position.summary.projectedMonthNetCashFlow = thisMonthCashFlow;
  position.recommendations = buildDebtPayoffRecommendations_({
    debts: facts.debts,
    debtsOut: position.debts,
    usableCash: facts.usableCash,
    minimumDueTotal: minimumDueTotal,
    thisMonthCashFlow: thisMonthCashFlow,
    projectionYears: facts.projectionYears,
    longest: position.summary.longestRoughPayoff
  });
  return position;
}

function getDebtPayoffReadData() {
  const facts = readDebtPayoffWorkbookFacts_(getUserSpreadsheet_());
  const position = attachDebtPayoffCombinedNotes_(
    facts, buildDebtPayoffPositionFromFacts_(facts));
  return Object.assign({}, position, buildDebtPayoffRecommendationFromFacts_(facts));
}

function getDebtPayoffRecommendationData() {
  const performanceTrace = startPerformanceTrace_('debt_payoff.recommendation');
  try {
    const facts = readDebtPayoffWorkbookFacts_(getUserSpreadsheet_());
    markPerformanceTrace_(performanceTrace, 'resolve_workbook');
    const rec = buildDebtPayoffRecommendationFromFacts_(facts);
    markPerformanceTrace_(performanceTrace, 'supported_extra');
    finishPerformanceTrace_(performanceTrace, { outcome: 'ok' });
    return rec;
  } catch (err) {
    finishPerformanceTrace_(performanceTrace, {
      outcome: 'error',
      failedStage: 'supported_extra'
    });
    throw err;
  }
}

function getDebtPayoffPositionData() {
  const performanceTrace = startPerformanceTrace_('debt_payoff.position');
  try {
    const facts = readDebtPayoffWorkbookFacts_(getUserSpreadsheet_());
    markPerformanceTrace_(performanceTrace, 'resolve_workbook');
    const position = buildDebtPayoffPositionFromFacts_(facts);
    markPerformanceTrace_(performanceTrace, 'cash_flow_paid');
    finishPerformanceTrace_(performanceTrace, { outcome: 'ok' });
    return position;
  } catch (err) {
    finishPerformanceTrace_(performanceTrace, {
      outcome: 'error',
      failedStage: 'cash_flow_paid'
    });
    throw err;
  }
}

/**
 * Read-only household payoff plan for Debt Overview. Does not write, does not
 * add a mortgage extra, and does not treat a rollover schedule as affordable.
 */
function getDebtPayoffHouseholdPlan(payload) {
  payload = payload || {};
  const facts = readDebtPayoffWorkbookFacts_(getUserSpreadsheet_());
  const parsed = parseDebtPayoffScenarioMonthlyExtra_(payload.monthlyExtra);
  const extra = parsed.ok ? parsed.amount : 0;
  return buildDebtPayoffHouseholdPlan_(facts.empty ? [] : facts.debts, {
    asOfDate: new Date(),
    monthlyExtra: extra,
    extraIsSafe: payload.extraIsSafe === true && extra > DEBT_PAYOFF_SCENARIO_ZERO_BAL_,
    reserveBreached: payload.reserveBreached !== false,
    targetOrder: payload.targetOrder,
    monthlyDeficit: payload.monthlyDeficit,
    usableCashAfterBuffers: payload.usableCashAfterBuffers,
    requiredReserveAmount: payload.requiredReserveAmount
  });
}

function isLoanTypeForAmortization_(type) {
  const t = String(type || '').trim();
  return t === 'Loan' || t === 'HELOC';
}

/**
 * Revolving / non-loan: balance ÷ minimum (same as estimateMonthsToPayoff_).
 */
function estimateRoughPayoffSimple_(balance, monthlyPayment) {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return null;
  const m = estimateMonthsToPayoff_(balance, monthlyPayment);
  if (m === 'N/A') return null;
  return typeof m === 'number' ? m : null;
}

/**
 * Loan / HELOC: fixed payment with interest on declining balance. Returns null if payment does not exceed monthly interest.
 * APR 0%: falls back to simple months (principal-only paydown).
 */
function estimateMonthsAmortizingLoan_(balance, annualAprPct, monthlyPayment, maxMonths) {
  maxMonths = maxMonths || 600;
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return null;

  const apr = Number(annualAprPct);
  if (!isFinite(apr) || apr <= 0) {
    return estimateRoughPayoffSimple_(balance, monthlyPayment);
  }

  const monthlyRate = (apr / 100) / 12;
  let bal = balance;

  for (let m = 1; m <= maxMonths; m++) {
    const interestPortion = bal * monthlyRate;
    const principalPortion = monthlyPayment - interestPortion;
    if (principalPortion <= 0) {
      return null;
    }
    bal -= principalPortion;
    if (bal <= 0.005) {
      return m;
    }
  }

  return null;
}

/**
 * Loan & HELOC: amortization; others: simple balance ÷ min.
 */
function estimateRoughPayoffMonths_(balance, monthlyPayment, interestRate, type) {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return null;

  if (isLoanTypeForAmortization_(type)) {
    return estimateMonthsAmortizingLoan_(balance, interestRate, monthlyPayment, 600);
  }

  return estimateRoughPayoffSimple_(balance, monthlyPayment);
}

function findLongestRoughPayoff_(debtsOut) {
  let best = null;
  debtsOut.forEach(function(d) {
    if (d.estimatedPayoffMonths == null || typeof d.estimatedPayoffMonths !== 'number') return;
    if (!best || d.estimatedPayoffMonths > best.months) {
      best = { accountName: d.name, months: d.estimatedPayoffMonths };
    }
  });
  return best;
}

/**
 * Descriptive reference notes for the Debt Overview page. These lines are
 * purely observational ("what is true right now") — they do not make payoff
 * recommendations or direct the reader toward any action. Monthly action
 * decisions live on the Rolling Debt Planner; this page is reference only.
 */
function buildDebtPayoffRecommendations_(ctx) {
  const lines = [];
  const usable = ctx.usableCash;
  const u = round2_(usable.usableAfterBuffers);
  const minTot = ctx.minimumDueTotal;
  const yearsLabel =
    ctx.projectionYears && ctx.projectionYears.length
      ? ctx.projectionYears.join(' & ')
      : '';

  lines.push(
    'Cash snapshot: ' +
      fmtCurrency_(usable.totalAvailableNow) +
      ' available now, ' +
      fmtCurrency_(usable.totalBuffers) +
      ' in protected buffers, and ' +
      fmtCurrency_(u) +
      ' safe to use before planned expenses.'
  );

  if (minTot > 0) {
    lines.push(
      'Active debts require about ' +
        fmtCurrency_(minTot) +
        '/month in minimum payments.'
    );
  }

  if (u < minTot && minTot > 0) {
    lines.push(
      'Safe cash (before planned expenses) is currently below total minimum payments.'
    );
  } else if (u >= minTot * 2 && minTot > 0) {
    lines.push(
      'Safe cash (before planned expenses) is currently about 2× total minimum payments.'
    );
  }

  const cf = ctx.thisMonthCashFlow;
  if (cf < 0) {
    lines.push(
      'Projected net cash flow this month is negative (' + fmtCurrency_(cf) + ').'
    );
  } else if (cf > 0 && minTot > 0) {
    lines.push(
      'Projected net cash flow this month: ' + fmtCurrency_(cf) + '.'
    );
  }

  const cards = ctx.debts
    .filter(function(d) {
      return d.active && d.type === 'Credit Card' && d.balance > 0;
    })
    .sort(function(a, b) {
      return b.interestRate - a.interestRate;
    });
  if (cards.length > 0) {
    lines.push(
      'Among revolving balances, ' +
        cards[0].name +
        ' has the highest APR at ' +
        fmtPercent_(cards[0].interestRate) +
        '.'
    );
  }

  if (ctx.longest && ctx.longest.months) {
    lines.push(
      'Longest estimated payoff at the current minimum payment: ' +
        ctx.longest.accountName +
        ' (~' +
        ctx.longest.months +
        ' mo). Loan and HELOC rows use a monthly amortization loop; other types use balance ÷ minimum.'
    );
  }

  if (yearsLabel) {
    lines.push(
      'CF paid sums expense rows on Cash Flow for ' +
        yearsLabel +
        ' where Payee matches the debt name (aliases apply).'
    );
  }

  return lines;
}

/**
 * Sums absolute Expense amounts for rows whose Payee matches debt account name (after alias map).
 */
function sumExpensePaymentsForDebtPayees_(ss, debtNames, years, aliasMap, missingOut) {
  const totals = {};
  const targets = [];
  (debtNames || []).forEach(function(name) {
    const target = String(name || '').trim();
    if (!target || Object.prototype.hasOwnProperty.call(totals, target)) return;
    totals[target] = 0;
    targets.push(target);
  });
  if (!targets.length) return totals;

  (years || []).forEach(function(year) {
    let sheet;
    try {
      sheet = getCashFlowSheet_(ss, year);
    } catch (e) {
      const tabName = getCashFlowSheetName_(year);
      if (missingOut && missingOut.indexOf(tabName) === -1) {
        missingOut.push(tabName);
      }
      return;
    }

    const lastCol = sheet.getLastColumn();
    if (lastCol < 2) return;

    const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    let headerMap;
    try {
      headerMap = getCashFlowHeaderMapFromHeaders_(headers);
    } catch (e) {
      return;
    }

    const monthColZero = [];
    for (let c = 0; c < headers.length; c++) {
      const parsed = parseMonthHeader_(headers[c]);
      if (parsed && parsed.getFullYear() === Number(year)) {
        monthColZero.push(c);
      }
    }
    if (!monthColZero.length) return;

    const values = sheet.getDataRange().getValues();
    const targetIndex = {};
    targets.forEach(function(target, i) {
      targetIndex[target] = i;
    });

    for (let r = 1; r < values.length; r++) {
      const type = String(values[r][headerMap.typeColZero] || '').trim();
      if (type !== 'Expense') continue;

      const payee = normalizeName_(String(values[r][headerMap.payeeColZero] || ''), aliasMap);
      if (!Object.prototype.hasOwnProperty.call(targetIndex, payee)) continue;

      let paid = 0;
      monthColZero.forEach(function(c) {
        paid += Math.abs(toNumber_(values[r][c]));
      });
      totals[payee] += paid;
    }
  });

  Object.keys(totals).forEach(function(name) {
    totals[name] = round2_(totals[name]);
  });
  return totals;
}

function sumExpensePaymentsForDebtPayee_(ss, debtName, years, aliasMap, missingOut) {
  const totals = sumExpensePaymentsForDebtPayees_(
    ss, [debtName], years, aliasMap, missingOut);
  return totals[String(debtName || '').trim()] || 0;
}

/** Months of hypothetical extra-payoff forecast. Same cap as Overview amortization. */
var DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_ = 600;
var DEBT_PAYOFF_SCENARIO_ZERO_BAL_ = 0.005;
var DEBT_PAYOFF_VARIABLE_BILL_METHOD_ =
  'Variable bills marked Varies use a YTD running average of actual Cash Flow expenses from January through the latest completed month in the current calendar year. Monthly equivalent = YTD known spending ÷ number of completed months (January ÷ 1, January–February ÷ 2, and so on). The current incomplete month is excluded. Every month in that window must be a known number, including explicit $0. A blank or missing month withholds that bill’s estimate; it is not treated as $0 and is not omitted while still dividing by elapsed months. Default Amount is not used as a forecast. This is a YTD running average, not a full-year average; annual or seasonal costs can make it swing as payments occur.';
var DEBT_PAYOFF_CASH_SAFETY_HORIZON_MONTHS_ = 3;
var DEBT_PAYOFF_CASH_SAFETY_LOCATION_ = 'Cash Flow → Upcoming';
var DEBT_PAYOFF_CASH_SAFETY_HORIZON_LABEL_ =
  '3-month cash-safety forecast (aligned with This Week’s 90-day reserve)';
var DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_ = 12;
var DEBT_PAYOFF_ONE_TIME_HORIZON_LABEL_ =
  '12-month cash-safety forecast from current recurring surplus and known Planned upcoming expenses';
var DEBT_PAYOFF_BREAK_EVEN_CATEGORIES_ = [
  { key: 'recurringIncomeMonthly', label: 'Recurring income', kind: 'income' },
  { key: 'recurringBillsMonthly', label: 'Required bills', kind: 'commitment' },
  { key: 'variableBillsMonthly', label: 'Variable bills', kind: 'commitment' },
  { key: 'debtMinimumsMonthly', label: 'Debt minimums', kind: 'commitment' },
  { key: 'policyFloorMonthly', label: 'Investment policy floors', kind: 'commitment' },
  { key: 'unmatchedInvestmentBillsMonthly', label: 'Other investment bills', kind: 'commitment' }
];

/**
 * Read-only household strategy comparison from current INPUT - Debts.
 * payload.monthlyExtra is the recurring extra input. Optional
 * payload.bonusSelections are hypothetical Cisco bonus events. Neither is
 * inferred from This Week, persisted, or an affordability proof.
 */
var DEBT_PAYOFF_SCENARIO_EXTRA_INVALID_ =
  'Enter a valid monthly extra of $0.00 or more. Negative and non-numeric amounts are not used.';
var DEBT_PAYOFF_HYPOTHETICAL_CASH_FLOW_INVALID_ =
  'Enter a valid hypothetical cash-flow amount of $0.00 or more. Negative and non-numeric amounts are not used.';
var DEBT_PAYOFF_HYPOTHETICAL_INCOME_LABEL_ =
  'Hypothetical recurring income increase';
var DEBT_PAYOFF_HYPOTHETICAL_COMMITMENT_LABEL_ =
  'Hypothetical additional commitment';
var DEBT_PAYOFF_SCENARIO_BONUS_INVALID_ =
  'Enter the next expected payment month and year for each included Cisco bonus. Timing is not inferred from the bonus name or a historical payment month.';
var DEBT_PAYOFF_SCENARIO_BONUS_EXCLUDED_ =
  'Only Cisco Mid Year Bonus and Cisco End Year Bonus can be included. RSU/ESPP sales, Other Stock Sales, and tax refunds stay excluded.';
var DEBT_PAYOFF_SCENARIO_BASELINE_LABEL_ = 'Minimum payments only';
var DEBT_PAYOFF_SCENARIO_BASELINE_WITH_BONUS_LABEL_ =
  'Minimum contractual payments plus selected bonus events (highest APR first)';

function getDebtPayoffStrategyComparison(payload) {
  payload = payload || {};
  const parsed = parseDebtPayoffScenarioMonthlyExtra_(payload.monthlyExtra);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const scenarioPlan = parseDebtPayoffHypotheticalCashFlowScenario_(
    payload.cashFlowScenario);
  if (!scenarioPlan.ok) {
    throw new Error(scenarioPlan.error);
  }
  const today = new Date();
  const ss = getUserSpreadsheet_();
  const sheetNames = getSheetNames_();
  var debts = [];
  var extraInput = null;
  var supported;
  if (!ss.getSheetByName(sheetNames.DEBTS)) {
    supported = debtPayoffSupportedMonthlyExtraUnavailable_(
      'INPUT - Debts is missing.');
  } else {
    const debtRows = readSheetAsObjects_(ss, 'DEBTS');
    const aliasMap = getAliasMap_();
    debts = normalizeDebts_(debtRows, aliasMap);
    var accountRows = [];
    try {
      if (ss.getSheetByName(sheetNames.ACCOUNTS)) {
        accountRows = readSheetAsObjects_(ss, 'ACCOUNTS');
      }
    } catch (e) {
      accountRows = [];
    }
    extraInput = collectDebtPayoffSupportedMonthlyExtraInput_(
      ss, debts, normalizeAccounts_(accountRows));
    supported = buildDebtPayoffSupportedMonthlyExtra_(extraInput);
  }
  var cashFlowScenario = buildDebtPayoffHypotheticalCashFlowScenario_(
    extraInput, supported, scenarioPlan);
  var monthlyExtra = debtPayoffStrategyComparisonMonthlyExtra_(
    parsed.amount, cashFlowScenario);
  var bonusPlan = resolveDebtPayoffScenarioBonusEvents_(
    payload.bonusSelections,
    supported && supported.datedBonusScenario,
    today,
    DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_
  );
  if (!bonusPlan.ok) {
    throw new Error(bonusPlan.error);
  }
  var comparison = compareDebtPayoffStrategies_(debts, monthlyExtra, {
    asOfDate: today,
    bonusEvents: bonusPlan.events,
    bonusPlan: bonusPlan
  });
  comparison.supportedMonthlyExtra = supported;
  comparison.cashFlowScenario = cashFlowScenario;
  return comparison;
}

function parseDebtPayoffScenarioMonthlyExtra_(value) {
  const invalid = {
    ok: false,
    amount: null,
    error: DEBT_PAYOFF_SCENARIO_EXTRA_INVALID_
  };
  const valid = function(amount) {
    return { ok: true, amount: round2_(amount), error: '' };
  };
  if (value == null || value === '') return valid(0);
  if (typeof value === 'number') {
    if (!isFinite(value) || value < 0) return invalid;
    return valid(value);
  }
  if (typeof value !== 'string') return invalid;
  const text = String(value).replace(/\u00A0/g, ' ').trim();
  if (!text) return valid(0);
  const normalized = text.replace(/\$/g, '').replace(/,/g, '').trim();
  if (!normalized ||
      (!/^[0-9]*\.?[0-9]+$/.test(normalized) && !/^[0-9]+\.$/.test(normalized))) {
    return invalid;
  }
  const n = Number(normalized);
  if (!isFinite(n) || n < 0) return invalid;
  return valid(n);
}

function parseDebtPayoffHypotheticalCashFlowMoney_(value, label) {
  var parsed = parseDebtPayoffScenarioMonthlyExtra_(value);
  if (!parsed.ok) {
    return {
      ok: false,
      amount: null,
      error: 'Enter a valid hypothetical ' + label +
        ' of $0.00 or more. Negative and non-numeric amounts are not used.'
    };
  }
  return parsed;
}

function parseDebtPayoffHypotheticalCashFlowScenario_(payload) {
  var empty = {
    ok: true,
    applied: false,
    useForComparison: false,
    recurringIncomeIncrease: 0,
    commitmentReduction: 0,
    commitmentIncrease: 0,
    oneTimeBonusIncome: 0,
    pausePolicyFloors: false,
    error: ''
  };
  if (payload == null || payload === '') return empty;
  if (typeof payload !== 'object') {
    return {
      ok: false,
      applied: false,
      useForComparison: false,
      recurringIncomeIncrease: null,
      commitmentReduction: null,
      commitmentIncrease: null,
      oneTimeBonusIncome: null,
      pausePolicyFloors: false,
      error: DEBT_PAYOFF_HYPOTHETICAL_CASH_FLOW_INVALID_
    };
  }
  var income = parseDebtPayoffHypotheticalCashFlowMoney_(
    payload.recurringIncomeIncrease, 'recurring income increase');
  if (!income.ok) return income;
  var reduction = parseDebtPayoffHypotheticalCashFlowMoney_(
    payload.commitmentReduction, 'commitment reduction');
  if (!reduction.ok) return reduction;
  var increase = parseDebtPayoffHypotheticalCashFlowMoney_(
    payload.commitmentIncrease, 'commitment increase');
  if (!increase.ok) return increase;
  var bonus = parseDebtPayoffHypotheticalCashFlowMoney_(
    payload.oneTimeBonusIncome, 'one-time bonus');
  if (!bonus.ok) return bonus;
  var pause = payload.pausePolicyFloors === true;
  var structural = income.amount > 0.005 || reduction.amount > 0.005 ||
    increase.amount > 0.005 || pause;
  return {
    ok: true,
    applied: structural || bonus.amount > 0.005,
    useForComparison: structural,
    recurringIncomeIncrease: income.amount,
    commitmentReduction: reduction.amount,
    commitmentIncrease: increase.amount,
    oneTimeBonusIncome: bonus.amount,
    pausePolicyFloors: pause,
    error: ''
  };
}

function debtPayoffStrategyComparisonMonthlyExtra_(parsedAmount, cashFlowScenario) {
  if (cashFlowScenario && cashFlowScenario.useForComparison === true) {
    return round2_(Number(cashFlowScenario.amount) || 0);
  }
  return round2_(Number(parsedAmount) || 0);
}

function debtPayoffScenarioBonusCanonicalName_(name) {
  if (typeof isCiscoMidYearBonusIncomeName_ === 'function' &&
      isCiscoMidYearBonusIncomeName_(name)) {
    return typeof CISCO_MID_YEAR_BONUS_PAYEE_ !== 'undefined'
      ? CISCO_MID_YEAR_BONUS_PAYEE_
      : 'Cisco Mid Year Bonus';
  }
  if (typeof isCiscoEndYearBonusIncomeName_ === 'function' &&
      isCiscoEndYearBonusIncomeName_(name)) {
    return typeof CISCO_END_YEAR_BONUS_PAYEE_ !== 'undefined'
      ? CISCO_END_YEAR_BONUS_PAYEE_
      : 'Cisco End Year Bonus';
  }
  return '';
}

function parseDebtPayoffScenarioBonusMonth_(value) {
  if (typeof value === 'number' && isFinite(value) &&
      value >= 1 && value <= 12 && Math.floor(value) === value) {
    return { ok: true, month: value };
  }
  var text = String(value == null ? '' : value).replace(/\u00A0/g, ' ').trim();
  if (!/^(0?[1-9]|1[0-2])$/.test(text)) return { ok: false, month: null };
  return { ok: true, month: Number(text) };
}

function parseDebtPayoffScenarioBonusYear_(value) {
  if (typeof value === 'number' && isFinite(value) &&
      value >= 2000 && value <= 2100 && Math.floor(value) === value) {
    return { ok: true, year: value };
  }
  var text = String(value == null ? '' : value).replace(/\u00A0/g, ' ').trim();
  if (!/^\d{4}$/.test(text)) return { ok: false, year: null };
  var year = Number(text);
  if (year < 2000 || year > 2100) return { ok: false, year: null };
  return { ok: true, year: year };
}

function debtPayoffScenarioMonthIndexFromYearMonth_(asOfDate, year, month) {
  var asOf = asOfDate instanceof Date && !isNaN(asOfDate.getTime())
    ? asOfDate
    : new Date();
  var y = Number(year);
  var m = Number(month);
  if (!isFinite(y) || !isFinite(m)) return null;
  return (y - asOf.getFullYear()) * 12 + (m - (asOf.getMonth() + 1)) + 1;
}

function debtPayoffScenarioForecastStartMonthKey_(asOfDate) {
  return debtPayoffScenarioMonthKey_(asOfDate, 1);
}

function debtPayoffScenarioBonusPastDateError_(name, year, month, asOfDate) {
  var startKey = debtPayoffScenarioForecastStartMonthKey_(asOfDate);
  var monthText = String(Number(month) || '');
  if (monthText.length < 2) monthText = '0' + monthText;
  return (name || 'A selected Cisco bonus') +
    ' payment ' + year + '-' + monthText +
    ' is before the forecast start month (' + startKey +
    '). Past bonus dates are not applied and are not moved into a later month. Enter the next expected payment month on or after ' +
    startKey + '.';
}

function debtPayoffScenarioBaselineLabel_(bonusIncluded) {
  return bonusIncluded === true
    ? DEBT_PAYOFF_SCENARIO_BASELINE_WITH_BONUS_LABEL_
    : DEBT_PAYOFF_SCENARIO_BASELINE_LABEL_;
}

function debtPayoffScenarioBonusPlanIncluded_(bonusPlan) {
  return !!(bonusPlan && bonusPlan.included === true &&
    Array.isArray(bonusPlan.events) && bonusPlan.events.length);
}

function assertDebtPayoffScenarioBonusEventsInHorizon_(bonusEvents, asOfDate) {
  var startKey = debtPayoffScenarioForecastStartMonthKey_(asOfDate);
  (bonusEvents || []).forEach(function(ev) {
    var idx = Number(ev && ev.monthIndex);
    if (!(idx >= 1)) {
      throw new Error(
        (ev && ev.name ? ev.name : 'A selected Cisco bonus') +
        ' event is before the forecast start month (' + startKey +
        '). Past bonus dates are not applied and are not moved into a later month.'
      );
    }
  });
}

function debtPayoffScenarioBonusAssumptions_() {
  return [
    'Selected Cisco bonus payments are a hypothetical overlay. They are not saved, not a payment, not recurring monthly income, not the extra estimate, and not used for the 90-day reserve.',
    'The same selected bonus amounts and dates are used in the baseline, avalanche, and snowball. Bonus cash is applied after interest and contractual minimums. Avalanche applies monthly extra and bonus payments highest APR first. Snowball applies monthly extra and bonus payments smallest balance first. The baseline has no monthly extra; its bonus cash is allocated highest APR first.',
    'When a bonus repeats annually, the entered Expected Amount is held constant as a scenario assumption.',
    'Timing is the month and year you entered. It is not inferred from Mid Year / End Year names or from historical Cash Flow payment months.',
    'RSU/ESPP sales, Other Stock Sales, and tax refunds stay excluded.'
  ];
}

function debtPayoffScenarioBonusSummary_(bonusPlan) {
  bonusPlan = bonusPlan || {};
  var events = Array.isArray(bonusPlan.events) ? bonusPlan.events.slice() : [];
  return {
    included: bonusPlan.included === true && events.length > 0,
    events: events,
    selections: Array.isArray(bonusPlan.selections) ? bonusPlan.selections.slice() : [],
    persisted: false
  };
}

function resolveDebtPayoffScenarioBonusEvents_(
    selections, datedBonusScenario, asOfDate, horizonMonths) {
  var empty = {
    ok: true,
    included: false,
    events: [],
    selections: [],
    assumptions: [],
    error: ''
  };
  if (selections == null || selections === '') return empty;
  if (!Array.isArray(selections)) {
    return {
      ok: false,
      included: false,
      events: [],
      selections: [],
      assumptions: [],
      error: DEBT_PAYOFF_SCENARIO_BONUS_INVALID_
    };
  }
  var payments = {};
  ((datedBonusScenario && datedBonusScenario.payments) || []).forEach(function(payment) {
    if (!payment || !payment.name) return;
    payments[payment.name] = payment;
  });
  var included = [];
  var seen = {};
  for (var i = 0; i < selections.length; i++) {
    var row = selections[i] || {};
    if (row.include !== true) continue;
    var canonical = debtPayoffScenarioBonusCanonicalName_(row.name);
    if (!canonical) {
      return {
        ok: false,
        included: false,
        events: [],
        selections: [],
        assumptions: [],
        error: DEBT_PAYOFF_SCENARIO_BONUS_EXCLUDED_
      };
    }
    if (seen[canonical]) {
      return {
        ok: false,
        included: false,
        events: [],
        selections: [],
        assumptions: [],
        error: 'Each Cisco bonus can be included only once.'
      };
    }
    seen[canonical] = true;
    var monthParsed = parseDebtPayoffScenarioBonusMonth_(row.month);
    var yearParsed = parseDebtPayoffScenarioBonusYear_(row.year);
    if (!monthParsed.ok || !yearParsed.ok) {
      return {
        ok: false,
        included: false,
        events: [],
        selections: [],
        assumptions: [],
        error: 'Enter the next expected payment month and year for ' +
          canonical +
          '. Timing is not inferred from the bonus name or a historical payment month.'
      };
    }
    var repeat = String(row.repeat || '').trim().toLowerCase();
    if (repeat !== 'once' && repeat !== 'annual') {
      return {
        ok: false,
        included: false,
        events: [],
        selections: [],
        assumptions: [],
        error: 'Choose whether ' + canonical + ' occurs once or repeats annually.'
      };
    }
    var payment = payments[canonical];
    if (!payment || payment.known !== true) {
      return {
        ok: false,
        included: false,
        events: [],
        selections: [],
        assumptions: [],
        error: canonical +
          ' Expected Amount is blank (unknown). Blank was not treated as $0. Include it only when Recurring=Yes, Frequency=Yearly, and Expected Amount are known on that Cash Flow row.'
      };
    }
    var monthIndex = debtPayoffScenarioMonthIndexFromYearMonth_(
      asOfDate, yearParsed.year, monthParsed.month);
    if (monthIndex == null || monthIndex < 1) {
      return {
        ok: false,
        included: false,
        events: [],
        selections: [],
        assumptions: [],
        error: debtPayoffScenarioBonusPastDateError_(
          canonical, yearParsed.year, monthParsed.month, asOfDate)
      };
    }
    included.push({
      name: canonical,
      amount: round2_(Number(payment.amount) || 0),
      month: monthParsed.month,
      year: yearParsed.year,
      repeat: repeat,
      firstMonthIndex: monthIndex
    });
  }
  if (!included.length) return empty;

  var events = [];
  var horizon = Number(horizonMonths) > 0
    ? Number(horizonMonths)
    : DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_;
  included.forEach(function(sel) {
    var idx = sel.firstMonthIndex;
    while (idx <= horizon) {
      events.push({
        name: sel.name,
        amount: sel.amount,
        monthIndex: idx,
        monthKey: debtPayoffScenarioMonthKey_(asOfDate, idx),
        repeat: sel.repeat,
        amountHeldConstant: sel.repeat === 'annual'
      });
      if (sel.repeat !== 'annual') break;
      idx += 12;
    }
  });
  events.sort(function(a, b) {
    if (a.monthIndex !== b.monthIndex) return a.monthIndex - b.monthIndex;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return {
    ok: true,
    included: true,
    events: events,
    selections: included,
    assumptions: debtPayoffScenarioBonusAssumptions_(),
    error: ''
  };
}

function debtPayoffScenarioInputState_(debt) {
  if (!debt || debt.active === false) return 'INACTIVE';
  const balance = Number(debt.balance);
  if (!isFinite(balance) || balance <= DEBT_PAYOFF_SCENARIO_ZERO_BAL_) return 'NO_BALANCE';
  if (debt.minimumPaymentKnown === false) return 'MINIMUM_UNKNOWN';
  const minPay = Number(debt.minimumPayment);
  if (!isFinite(minPay) || minPay < 0) return 'MINIMUM_INVALID';
  if (debt.interestRateKnown === false) return 'APR_UNKNOWN';
  const apr = Number(debt.interestRate);
  if (!isFinite(apr) || apr < 0) return 'APR_INVALID';
  return 'USABLE';
}

function debtPayoffScenarioBlockerMessage_(state) {
  if (state === 'MINIMUM_UNKNOWN' || state === 'MINIMUM_INVALID') {
    return 'minimum payment is missing or not a usable amount';
  }
  if (state === 'APR_UNKNOWN' || state === 'APR_INVALID') {
    return 'APR is missing or not a usable rate';
  }
  return 'required payoff inputs are not usable';
}

function classifyDebtPayoffScenarioDebts_(debts) {
  const modeled = [];
  const blockers = [];
  (debts || []).forEach(function(debt) {
    const state = debtPayoffScenarioInputState_(debt);
    if (state === 'INACTIVE' || state === 'NO_BALANCE') return;
    if (state === 'USABLE') {
      modeled.push(debt);
      return;
    }
    blockers.push({
      name: String(debt && debt.name || ''),
      state: state,
      reason: debtPayoffScenarioBlockerMessage_(state)
    });
  });
  return { modeled: modeled, blockers: blockers };
}

function debtPayoffScenarioCannotAmortizeAtMinimum_(debt) {
  if (debt && debt.contractualPrincipalKnown === false) return false;
  const balance = Number(debt.balance) || 0;
  const minPay = debt && debt.contractualPrincipalKnown === true
    ? Number(debt.contractualPrincipalPayment) || 0
    : Number(debt.minimumPayment) || 0;
  const interest = debtPayoffScenarioMonthlyInterest_(balance, debt.interestRate);
  return minPay <= interest + DEBT_PAYOFF_SCENARIO_ZERO_BAL_;
}

function debtPayoffScenarioMonthlyInterest_(balance, aprPct) {
  const r = (Number(aprPct) || 0) / 100 / 12;
  return round2_((Number(balance) || 0) * r);
}

function debtPayoffScenarioMonthKey_(asOfDate, monthIndex) {
  const asOf = asOfDate instanceof Date && !isNaN(asOfDate.getTime())
    ? asOfDate
    : new Date();
  const d = new Date(asOf.getFullYear(), asOf.getMonth() + (monthIndex - 1), 1);
  const month = String(d.getMonth() + 1);
  return d.getFullYear() + '-' + (month.length < 2 ? '0' + month : month);
}

function debtPayoffScenarioSortTargets_(debts, strategy, targetOrder) {
  const rows = (debts || []).slice();
  if (strategy === 'custom') {
    const rank = {};
    (targetOrder || []).forEach(function(name, i) {
      rank[String(name || '')] = i;
    });
    rows.sort(function(a, b) {
      const ia = Object.prototype.hasOwnProperty.call(rank, a.name) ? rank[a.name] : 999999;
      const ib = Object.prototype.hasOwnProperty.call(rank, b.name) ? rank[b.name] : 999999;
      if (ia !== ib) return ia - ib;
      const apr = (Number(b.interestRate) || 0) - (Number(a.interestRate) || 0);
      if (apr !== 0) return apr;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return rows;
  }
  rows.sort(function(a, b) {
    if (strategy === 'snowball') {
      const bal = (Number(a.balance) || 0) - (Number(b.balance) || 0);
      if (Math.abs(bal) > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) return bal;
      const apr = (Number(b.interestRate) || 0) - (Number(a.interestRate) || 0);
      if (apr !== 0) return apr;
      return String(a.name || '').localeCompare(String(b.name || ''));
    }
    const apr = (Number(b.interestRate) || 0) - (Number(a.interestRate) || 0);
    if (apr !== 0) return apr;
    const bal = (Number(b.balance) || 0) - (Number(a.balance) || 0);
    if (Math.abs(bal) > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) return bal;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return rows;
}

function debtPayoffScenarioAssumptions_(monthlyExtra, horizonMonths, bonusPlan) {
  var lines = [
    'This is a hypothetical scenario. The extra amount is not saved, is not a payment, and is not proof that the extra is affordable.',
    'Monthly extra applied to avalanche and snowball: ' +
      fmtCurrency_(monthlyExtra) +
      '. The baseline uses $0.00 monthly extra.'
  ];
  if (debtPayoffScenarioBonusPlanIncluded_(bonusPlan)) {
    lines.push(
      'The comparison baseline is minimum contractual payments plus the selected bonus events. That baseline allocates bonus cash highest APR first after interest and contractual minimums, and it has no monthly extra. Avalanche and snowball use those same bonus amounts and dates, but each applies bonus cash with its own extra-payment rule. Interest savings are measured against this baseline. A strategy that costs more interest than the baseline is shown as additional interest, not $0 saved.'
    );
    lines = lines.concat(bonusPlan.assumptions || []);
    lines.push(
      'The comparison models only the selected Cisco bonus events. It does not model other future income, expenses, cash reserves, or changing rates.'
    );
  } else {
    lines.push(
      'The comparison does not model future income, expenses, cash reserves, or changing rates.'
    );
  }
  lines.push(
    'Contractual minimums are held at the current recorded amount for every forecast month (estimate).'
  );
  lines.push(
    'Interest each month is remaining balance × (APR ÷ 100 ÷ 12), rounded to cents, then payments apply.'
  );
  lines.push(
    'Forecast horizon is ' +
      horizonMonths +
      ' months. A household that still has a balance after that is reported as not within the forecast horizon.'
  );
  lines.push(
    'Only debts with a remaining balance and usable APR and minimum-payment inputs are modeled.'
  );
  return lines;
}

function debtPayoffScenarioNameIsAllowed_(name, extraTargetNames) {
  if (!extraTargetNames || !extraTargetNames.length) return true;
  var want = String(name || '');
  for (var i = 0; i < extraTargetNames.length; i++) {
    if (String(extraTargetNames[i] || '') === want) return true;
  }
  return false;
}

function applyDebtPayoffScenarioLeftover_(remaining, amount, allocStrategy, extraTargetNames, targetOrder) {
  var leftover = round2_(Math.max(0, Number(amount) || 0));
  var applied = [];
  if (!(leftover > DEBT_PAYOFF_SCENARIO_ZERO_BAL_)) return applied;
  var targets = debtPayoffScenarioSortTargets_(
    (remaining || []).filter(function(d) {
      return d.balance > DEBT_PAYOFF_SCENARIO_ZERO_BAL_ &&
        debtPayoffScenarioNameIsAllowed_(d.name, extraTargetNames);
    }),
    allocStrategy,
    targetOrder
  );
  for (var t = 0; t < targets.length && leftover > DEBT_PAYOFF_SCENARIO_ZERO_BAL_; t++) {
    var pay = Math.min(leftover, targets[t].balance);
    if (!(pay > DEBT_PAYOFF_SCENARIO_ZERO_BAL_)) continue;
    targets[t].balance = round2_(targets[t].balance - pay);
    leftover = round2_(leftover - pay);
    applied.push({ name: targets[t].name, amount: round2_(pay) });
  }
  return applied;
}

function debtPayoffScenarioAllocStrategy_(strategy) {
  if (strategy === 'snowball') return 'snowball';
  if (strategy === 'custom') return 'custom';
  return 'avalanche';
}

function debtPayoffKnownMoney_(value, knownFlag) {
  if (knownFlag === false) return false;
  return value != null && isFinite(Number(value));
}

function copyDebtPayoffScenarioWorkingDebts_(debts) {
  return (debts || []).map(function(debt) {
    var piKnown = debtPayoffKnownMoney_(
      debt.principalAndInterest, debt.principalAndInterestKnown);
    var escrowKnown = debtPayoffKnownMoney_(
      debt.escrowPayment, debt.escrowKnown);
    var termKnown = debt.remainingTermKnown === true ||
      (Number(debt.remainingTermMonths) > 0);
    var contractual = debtPayoffContractualPrincipalPayment_(debt);
    return {
      name: String(debt.name || ''),
      originalName: String(debt.originalName || debt.name || ''),
      type: String(debt.type || ''),
      linkedProperty: String(debt.linkedProperty || '').trim(),
      balance: round2_(debt.balance),
      minimumPayment: round2_(debt.minimumPayment),
      interestRate: Number(debt.interestRate),
      interestRateKnown: debt.interestRateKnown !== false,
      principalAndInterest: piKnown ? round2_(debt.principalAndInterest) : null,
      principalAndInterestKnown: piKnown,
      escrowPayment: escrowKnown ? round2_(debt.escrowPayment) : null,
      escrowKnown: escrowKnown,
      remainingTermMonths: termKnown ? Number(debt.remainingTermMonths) : null,
      remainingTermKnown: termKnown,
      unverifiedTaxInsuranceAmount: debt.unverifiedTaxInsuranceAmount,
      contractualPrincipalPayment: contractual.known ? contractual.amount : null,
      contractualPrincipalKnown: contractual.known === true,
      amortizationIncompleteReason: contractual.known ? '' : (contractual.reason || '')
    };
  });
}

/**
 * Month-loop payoff path. strategy: 'minimum_only' | 'avalanche' | 'snowball' | 'custom'.
 * Extra and selected bonus cash are applied only after interest and every
 * modeled debt receives its current minimum. Optional rollReleasedPayments
 * adds a paid-off debt’s freed contractual payment to later leftover; the
 * default overlay does not roll, so existing extra-only results stay the same.
 */
function simulateDebtPayoffSchedule_(normalizedDebts, monthlyTotalToExtra, strategy, options) {
  options = options || {};
  const horizon = Number(options.horizonMonths) > 0
    ? Number(options.horizonMonths)
    : DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_;
  const extra = strategy === 'minimum_only'
    ? 0
    : Math.max(0, round2_(monthlyTotalToExtra));
  const oneTimeExtra = strategy === 'minimum_only'
    ? 0
    : Math.max(0, round2_(Number(options.oneTimeExtra) || 0));
  const asOfDate = options.asOfDate;
  const bonusEvents = options.bonusEvents || [];
  const rollReleased = options.rollReleasedPayments === true && strategy !== 'minimum_only';
  const targetOrder = options.targetOrder;
  const bonusByMonth = {};
  bonusEvents.forEach(function(ev) {
    var idx = Number(ev && ev.monthIndex);
    if (!(idx >= 1)) return;
    bonusByMonth[idx] = round2_(
      (bonusByMonth[idx] || 0) + Math.max(0, Number(ev.amount) || 0)
    );
  });
  const working = copyDebtPayoffScenarioWorkingDebts_(normalizedDebts);
  const allocStrategy = debtPayoffScenarioAllocStrategy_(strategy);
  const extraTargetNames = options.extraTargetNames;
  const incompleteAmortization = [];
  const amortizable = [];
  working.forEach(function(row) {
    if (row.contractualPrincipalKnown === false) {
      incompleteAmortization.push({
        name: row.name,
        reason: row.amortizationIncompleteReason ||
          'P&I versus escrow split is not saved. The full saved minimum was not applied to principal.',
        remainingBalance: round2_(row.balance)
      });
      return;
    }
    amortizable.push(row);
  });
  const extraPriorityOrder = (strategy === 'minimum_only' && !bonusEvents.length &&
      !(oneTimeExtra > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) && !rollReleased)
    ? []
    : debtPayoffScenarioSortTargets_(
        amortizable.filter(function(row) {
          return debtPayoffScenarioNameIsAllowed_(row.name, extraTargetNames);
        }),
        allocStrategy,
        targetOrder
      ).map(function(row) {
        return row.name;
      });
  const cannotAmortizeAtMinimum = amortizable.filter(debtPayoffScenarioCannotAmortizeAtMinimum_)
    .map(function(row) { return row.name; });
  const payoffOrder = [];
  const bonusApplications = [];
  const paymentReleases = [];
  let totalInterest = 0;
  let remaining = amortizable.slice();
  let rolledBudget = extra;

  function finishSchedule_(debtFree, monthIndex) {
    const incomplete = incompleteAmortization.length > 0;
    const openBal = remaining.reduce(function(sum, d) {
      return sum + Number(d.balance || 0);
    }, 0);
    const incompleteBal = incompleteAmortization.reduce(function(sum, row) {
      return sum + Number(row.remainingBalance || 0);
    }, 0);
    return {
      strategy: strategy,
      monthlyExtra: extra,
      debtFreeWithinHorizon: debtFree === true && !incomplete,
      debtFreeMonthIndex: debtFree === true && !incomplete ? monthIndex : null,
      debtFreeMonthKey: debtFree === true && !incomplete
        ? debtPayoffScenarioMonthKey_(asOfDate, monthIndex)
        : null,
      totalInterest: incomplete ? null : round2_(totalInterest),
      totalInterestReliable: !incomplete,
      projectionIncomplete: incomplete,
      incompleteAmortization: incompleteAmortization.slice(),
      payoffOrder: payoffOrder,
      extraPriorityOrder: extraPriorityOrder,
      bonusAllocationRule: allocStrategy,
      bonusApplications: bonusApplications,
      paymentReleases: paymentReleases,
      cannotAmortizeAtMinimum: cannotAmortizeAtMinimum,
      remainingBalance: round2_(openBal + incompleteBal),
      remainingDebtNames: remaining.map(function(d) { return d.name; })
        .concat(incompleteAmortization.map(function(row) { return row.name; }))
    };
  }

  if (!working.length || !remaining.length) return finishSchedule_(false, null);

  for (let m = 1; m <= horizon; m++) {
    remaining.forEach(function(d) {
      const interest = debtPayoffScenarioMonthlyInterest_(d.balance, d.interestRate);
      totalInterest = round2_(totalInterest + interest);
      d.balance = round2_(d.balance + interest);
    });

    remaining.forEach(function(d) {
      const pay = Math.min(
        Math.max(0, Number(d.contractualPrincipalPayment) || 0),
        d.balance
      );
      d.balance = round2_(d.balance - pay);
    });

    var bonusAmount = bonusByMonth[m] || 0;
    var bonusApplied = applyDebtPayoffScenarioLeftover_(
      remaining, bonusAmount, allocStrategy, null, targetOrder);
    if (bonusApplied.length) {
      bonusApplications.push({
        monthIndex: m,
        monthKey: debtPayoffScenarioMonthKey_(asOfDate, m),
        amount: round2_(bonusAmount),
        firstTarget: bonusApplied[0].name,
        allocations: bonusApplied
      });
    }
    if (m === 1 && oneTimeExtra > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
      applyDebtPayoffScenarioLeftover_(
        remaining, oneTimeExtra, allocStrategy, extraTargetNames, targetOrder);
    }
    if (rolledBudget > DEBT_PAYOFF_SCENARIO_ZERO_BAL_ && strategy !== 'minimum_only') {
      applyDebtPayoffScenarioLeftover_(
        remaining, rolledBudget, allocStrategy, extraTargetNames, targetOrder);
    }

    const stillOpen = [];
    remaining.forEach(function(d) {
      if (d.balance <= DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
        d.balance = 0;
        payoffOrder.push({
          name: d.name,
          monthIndex: m,
          monthKey: debtPayoffScenarioMonthKey_(asOfDate, m)
        });
        var freed = debtPayoffFreedContractualPayment_(d);
        var disposition = rollReleased ? 'rolled_to_next' : 'household_cash';
        paymentReleases.push({
          name: d.name,
          monthIndex: m,
          monthKey: debtPayoffScenarioMonthKey_(asOfDate, m),
          cashFlowStartsMonthIndex: m + 1,
          cashFlowStartsMonthKey: debtPayoffScenarioMonthKey_(asOfDate, m + 1),
          amount: freed.known ? freed.amount : null,
          amountKnown: freed.known === true,
          unknownReason: freed.reason || '',
          continuingEscrow: freed.escrow,
          disposition: disposition
        });
        if (rollReleased && freed.known) {
          rolledBudget = round2_(rolledBudget + freed.amount);
        }
        return;
      }
      stillOpen.push(d);
    });
    remaining = stillOpen;
    if (!remaining.length) {
      if (rollReleased) {
        paymentReleases.forEach(function(row) {
          if (row.disposition === 'rolled_to_next') {
            row.rolloverStopsMonthIndex = m;
            row.rolloverStopsMonthKey = debtPayoffScenarioMonthKey_(asOfDate, m);
          }
        });
      }
      return finishSchedule_(true, m);
    }
  }

  return finishSchedule_(false, null);
}

function formatDebtPayoffInterestVsBaseline_(row) {
  var delta = Number(row && row.interestSavedVsMinimumOnly);
  if (!isFinite(delta) || Math.abs(delta) <= DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
    return 'Same interest as baseline.';
  }
  var amount = typeof fmtCurrency_ === 'function'
    ? fmtCurrency_(Math.abs(delta))
    : String(Math.abs(delta));
  if (delta > 0) return amount + ' less interest than baseline.';
  return amount + ' more interest than baseline.';
}

function summarizeDebtPayoffScenario_(result, minOnlyInterest) {
  const incomplete = result && result.projectionIncomplete === true;
  const interestSaved = incomplete || result.totalInterest == null
    ? null
    : (result.strategy === 'minimum_only'
        ? 0
        : (minOnlyInterest == null
            ? null
            : round2_(Number(minOnlyInterest) - Number(result.totalInterest || 0))));
  return {
    strategy: result.strategy,
    monthlyExtra: result.monthlyExtra,
    payoffOrder: result.payoffOrder,
    extraPriorityOrder: result.extraPriorityOrder,
    bonusAllocationRule: result.bonusAllocationRule || debtPayoffScenarioAllocStrategy_(result.strategy),
    bonusApplications: Array.isArray(result.bonusApplications) ? result.bonusApplications.slice() : [],
    debtFreeWithinHorizon: incomplete ? false : result.debtFreeWithinHorizon,
    debtFreeMonthIndex: incomplete ? null : result.debtFreeMonthIndex,
    debtFreeMonthKey: incomplete ? null : result.debtFreeMonthKey,
    totalInterest: incomplete ? null : result.totalInterest,
    totalInterestReliable: !incomplete,
    projectionIncomplete: incomplete,
    incompleteAmortization: Array.isArray(result.incompleteAmortization)
      ? result.incompleteAmortization.slice()
      : [],
    interestSavedVsMinimumOnly: interestSaved,
    interestVsBaselineLabel: incomplete || interestSaved == null
      ? 'Interest is incomplete until P&I versus escrow is saved.'
      : formatDebtPayoffInterestVsBaseline_({
          interestSavedVsMinimumOnly: interestSaved
        }),
    cannotAmortizeAtMinimum: result.cannotAmortizeAtMinimum,
    remainingBalance: result.remainingBalance,
    remainingDebtNames: result.remainingDebtNames,
    paymentReleases: Array.isArray(result.paymentReleases)
      ? result.paymentReleases.slice()
      : []
  };
}

function compareDebtPayoffStrategies_(normalizedDebts, monthlyExtra, options) {
  options = options || {};
  const parsed = parseDebtPayoffScenarioMonthlyExtra_(monthlyExtra);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const extra = parsed.amount;
  const horizonMonths = Number(options.horizonMonths) > 0
    ? Number(options.horizonMonths)
    : DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_;
  const classified = classifyDebtPayoffScenarioDebts_(normalizedDebts);
  const bonusEvents = Array.isArray(options.bonusEvents) ? options.bonusEvents.slice() : [];
  const bonusPlan = options.bonusPlan || {
    included: bonusEvents.length > 0,
    events: bonusEvents,
    assumptions: options.bonusAssumptions || []
  };
  assertDebtPayoffScenarioBonusEventsInHorizon_(bonusEvents, options.asOfDate);
  const bonusIncluded = debtPayoffScenarioBonusPlanIncluded_(bonusPlan);
  const incompleteMortgages = classified.modeled
    .filter(function(debt) {
      return debtPayoffHasContinuingPropertyCosts_(debt) &&
        !debtPayoffDerivedPrincipalAndInterest_(debt).known;
    })
    .map(function(debt) {
      return {
        name: String(debt && debt.name || ''),
        reason: 'P&I versus escrow split is not saved. The full saved minimum was not applied to principal.'
      };
    });
  const simOptions = {
    asOfDate: options.asOfDate,
    horizonMonths: horizonMonths,
    bonusEvents: bonusEvents
  };
  const minOnly = simulateDebtPayoffSchedule_(
    classified.modeled, extra, 'minimum_only', simOptions);
  const avalanche = simulateDebtPayoffSchedule_(
    classified.modeled, extra, 'avalanche', simOptions);
  const snowball = simulateDebtPayoffSchedule_(
    classified.modeled, extra, 'snowball', simOptions);

  return {
    recommendationState: 'HYPOTHETICAL',
    persisted: false,
    extraIsAffordable: null,
    reserveModeled: false,
    householdComparisonComplete: classified.blockers.length === 0 &&
      classified.modeled.length > 0 && incompleteMortgages.length === 0,
    incompleteMortgages: incompleteMortgages,
    monthlyExtra: extra,
    horizonMonths: horizonMonths,
    asOfMonthKey: debtPayoffScenarioForecastStartMonthKey_(options.asOfDate),
    baselineLabel: debtPayoffScenarioBaselineLabel_(bonusIncluded),
    modeledDebtNames: classified.modeled.map(function(d) { return d.name; }),
    blockers: classified.blockers,
    assumptions: debtPayoffScenarioAssumptions_(extra, horizonMonths, bonusPlan),
    scenarioBonuses: debtPayoffScenarioBonusSummary_(bonusPlan),
    strategies: {
      minimum_only: summarizeDebtPayoffScenario_(minOnly, minOnly.totalInterest),
      avalanche: summarizeDebtPayoffScenario_(avalanche, minOnly.totalInterest),
      snowball: summarizeDebtPayoffScenario_(snowball, minOnly.totalInterest)
    }
  };
}

function debtPayoffHasSavedPiOrEscrow_(debt) {
  return !!(debt && (
    debt.principalAndInterestKnown === true ||
    debt.escrowKnown === true
  ));
}

function debtPayoffHasContinuingPropertyCosts_(debt) {
  if (debtPayoffHasSavedPiOrEscrow_(debt)) return true;
  var type = String(debt && debt.type || '').trim().toLowerCase();
  if (type === 'mortgage') return true;
  if (type === 'loan' && String(debt && debt.linkedProperty || '').trim()) return true;
  return false;
}

function debtPayoffDerivedPrincipalAndInterest_(debt) {
  if (!debt) return { known: false, amount: null, derived: false };
  if (debt.principalAndInterestKnown === true &&
      isFinite(Number(debt.principalAndInterest))) {
    return { known: true, amount: round2_(debt.principalAndInterest), derived: false };
  }
  if (debt.escrowKnown === true && isFinite(Number(debt.escrowPayment)) &&
      isFinite(Number(debt.minimumPayment))) {
    var derived = round2_(Number(debt.minimumPayment) - Number(debt.escrowPayment));
    if (derived > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
      return { known: true, amount: derived, derived: true };
    }
  }
  return { known: false, amount: null, derived: false };
}

function debtPayoffContractualPrincipalPayment_(debt) {
  if (debtPayoffHasContinuingPropertyCosts_(debt)) {
    var pi = debtPayoffDerivedPrincipalAndInterest_(debt);
    if (!pi.known) {
      return {
        known: false,
        amount: null,
        reason: 'P&I versus escrow split is not saved. The full saved minimum was not applied to principal, and payoff dates and interest are not reliable.'
      };
    }
    return { known: true, amount: pi.amount, reason: '' };
  }
  return {
    known: true,
    amount: round2_(Number(debt && debt.minimumPayment) || 0),
    reason: ''
  };
}

function debtPayoffFreedContractualPayment_(debt) {
  if (debtPayoffHasContinuingPropertyCosts_(debt)) {
    var pi = debtPayoffDerivedPrincipalAndInterest_(debt);
    if (!pi.known) {
      return {
        known: false,
        amount: null,
        escrow: debt && debt.escrowKnown ? debt.escrowPayment : null,
        reason: 'P&I versus escrow split is not saved, so payment relief is unknown. The full saved minimum was not treated as freed cash. Taxes, insurance, and escrow continue as property costs after payoff.'
      };
    }
    return {
      known: true,
      amount: pi.amount,
      escrow: debt.escrowKnown
        ? debt.escrowPayment
        : round2_(Number(debt.minimumPayment) - pi.amount),
      reason: ''
    };
  }
  return {
    known: true,
    amount: round2_(Number(debt && debt.minimumPayment) || 0),
    escrow: 0,
    reason: ''
  };
}

function debtPayoffAmortizingPayment_(principal, aprPct, n) {
  var p = Number(principal) || 0;
  var months = Number(n) || 0;
  if (!(p > 0) || !(months > 0)) return null;
  var r = (Number(aprPct) || 0) / 100 / 12;
  if (!(r > 0)) return round2_(p / months);
  return round2_(p * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
}

function debtPayoffRemainingTermKnown_(debt) {
  return !!(debt && (debt.remainingTermKnown === true || Number(debt.remainingTermMonths) > 0));
}

function debtPayoffBalanceAfterScheduledPayments_(principal, aprPct, payment, n) {
  var bal = round2_(principal);
  var pay = Number(payment) || 0;
  var months = Number(n) || 0;
  if (!(months > 0)) return bal;
  for (var m = 1; m <= months; m++) {
    var interest = debtPayoffScenarioMonthlyInterest_(bal, aprPct);
    bal = round2_(bal + interest);
    bal = round2_(bal - Math.min(pay, bal));
    if (bal <= DEBT_PAYOFF_SCENARIO_ZERO_BAL_) return 0;
  }
  return bal;
}

function debtPayoffModeledPayoffMonths_(principal, aprPct, payment) {
  var bal = round2_(principal);
  var pay = Number(payment) || 0;
  if (!(bal > DEBT_PAYOFF_SCENARIO_ZERO_BAL_)) return 0;
  if (!(pay > 0)) return null;
  for (var m = 1; m <= DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_; m++) {
    var interest = debtPayoffScenarioMonthlyInterest_(bal, aprPct);
    bal = round2_(bal + interest);
    if (pay <= interest + DEBT_PAYOFF_SCENARIO_ZERO_BAL_ &&
        bal > pay + DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
      return null;
    }
    bal = round2_(bal - Math.min(pay, bal));
    if (bal <= DEBT_PAYOFF_SCENARIO_ZERO_BAL_) return m;
  }
  return null;
}

function estimateDebtPayoffPositionMonths_(debt) {
  var result = {
    months: null,
    incomplete: false,
    method: 'simple',
    reason: ''
  };
  if (!debt) return result;
  if (!(Number(debt.balance) > DEBT_PAYOFF_SCENARIO_ZERO_BAL_)) {
    result.months = 0;
    return result;
  }
  if (debtPayoffHasContinuingPropertyCosts_(debt)) {
    result.method = 'amortization_pi';
    var contractual = debtPayoffContractualPrincipalPayment_(debt);
    if (!contractual.known) {
      result.incomplete = true;
      result.reason = contractual.reason ||
        'P&I versus escrow is not saved. The full saved minimum was not applied to principal.';
      return result;
    }
    result.months = debtPayoffModeledPayoffMonths_(
      debt.balance, debt.interestRate, contractual.amount);
    return result;
  }
  result.method = isLoanTypeForAmortization_(debt.type) ? 'amortization' : 'simple';
  result.months = estimateRoughPayoffMonths_(
    debt.balance, debt.minimumPayment, debt.interestRate, debt.type);
  return result;
}

function debtPayoffIsMtbMo4Plex_(debtOrName) {
  var name = typeof debtOrName === 'string'
    ? debtOrName
    : String(debtOrName && (debtOrName.name || debtOrName.originalName) || '');
  return name.trim() === 'MTB Bank - MO 4 Plex';
}

function debtPayoffJoinEnglish_(items) {
  items = (items || []).filter(Boolean);
  if (!items.length) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items[0] + ' and ' + items[1];
  return items.slice(0, items.length - 1).join(', ') + ', and ' + items[items.length - 1];
}

function reconcileDebtPayoffMortgageTerm_(debt, asOfDate) {
  var pi = debtPayoffDerivedPrincipalAndInterest_(debt);
  var termKnown = debtPayoffRemainingTermKnown_(debt);
  var aprKnown = !(debt && debt.interestRateKnown === false);
  var result = {
    name: String(debt && debt.name || ''),
    savedBalance: round2_(Number(debt && debt.balance) || 0),
    savedApr: Number(debt && debt.interestRate),
    savedMinimum: round2_(Number(debt && debt.minimumPayment) || 0),
    escrowPayment: debt && debt.escrowKnown ? debt.escrowPayment : null,
    derivedPrincipalAndInterest: pi.known ? pi.amount : null,
    remainingTermMonths: termKnown ? Number(debt.remainingTermMonths) : null,
    remainingTermKnown: termKnown,
    amortizedPayment: null,
    modeledPayoffMonths: null,
    leftoverAfterRemainingTerm: null,
    savedLastPaymentMonthKey: '',
    modeledPayoffMonthKey: '',
    modeledReleaseMonthKey: '',
    mismatch: false,
    conditionalEstimate: false,
    estimateKind: 'incomplete',
    rateResetNotModeled: false,
    rateResetCaveat: '',
    payoffTimingReliable: false,
    mismatches: [],
    ignoredUnverifiedAmounts: [],
    savedValuesUnchanged: true
  };
  if (debt && debt.unverifiedTaxInsuranceAmount != null &&
      isFinite(Number(debt.unverifiedTaxInsuranceAmount))) {
    result.ignoredUnverifiedAmounts.push({
      amount: round2_(debt.unverifiedTaxInsuranceAmount),
      reason: 'No clear period was saved, so this tax-and-insurance figure was not treated as a monthly escrow.'
    });
  }
  if (pi.known && aprKnown) {
    result.conditionalEstimate = true;
    result.estimateKind = 'conditional';
    result.modeledPayoffMonths = debtPayoffModeledPayoffMonths_(
      debt.balance, debt.interestRate, pi.amount);
    if (result.modeledPayoffMonths != null && asOfDate) {
      result.modeledPayoffMonthKey = debtPayoffScenarioMonthKey_(
        asOfDate, result.modeledPayoffMonths);
      result.modeledReleaseMonthKey = debtPayoffScenarioMonthKey_(
        asOfDate, result.modeledPayoffMonths + 1);
    }
    if (termKnown) {
      result.amortizedPayment = debtPayoffAmortizingPayment_(
        debt.balance, debt.interestRate, debt.remainingTermMonths);
      result.leftoverAfterRemainingTerm = debtPayoffBalanceAfterScheduledPayments_(
        debt.balance, debt.interestRate, pi.amount, debt.remainingTermMonths);
      if (asOfDate) {
        result.savedLastPaymentMonthKey = debtPayoffScenarioMonthKey_(
          asOfDate, Number(debt.remainingTermMonths));
      }
      if (result.amortizedPayment != null &&
          Math.abs(result.amortizedPayment - pi.amount) > 0.01) {
        result.mismatch = true;
        result.mismatches.push(
          'Saved APR and remaining term imply a P&I of $' +
          result.amortizedPayment.toFixed(2) +
          ', which does not match derived P&I $' +
          pi.amount.toFixed(2) +
          '. This is a current-APR and P&I scenario, not a lender-confirmed date.'
        );
      }
      if (result.modeledPayoffMonths != null &&
          result.modeledPayoffMonths !== Number(debt.remainingTermMonths)) {
        result.mismatch = true;
        result.mismatches.push(
          'Modeled P&I-only amortization takes ' + result.modeledPayoffMonths +
          ' months and leaves $' +
          Number(result.leftoverAfterRemainingTerm).toFixed(2) +
          ' after the saved ' + debt.remainingTermMonths +
          ' remaining payments' +
          (result.savedLastPaymentMonthKey
            ? ' (through ' + result.savedLastPaymentMonthKey + ')'
            : '') +
          '. This is a current-APR and P&I scenario, not a lender-confirmed date.'
        );
      } else if (Number(result.leftoverAfterRemainingTerm) > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
        result.mismatch = true;
        result.mismatches.push(
          'Modeled P&I-only amortization leaves $' +
          Number(result.leftoverAfterRemainingTerm).toFixed(2) +
          ' after the saved remaining term. This is a current-APR and P&I scenario, not a lender-confirmed date.'
        );
      }
    }
    if (debtPayoffIsMtbMo4Plex_(result.name)) {
      result.rateResetNotModeled = true;
      result.rateResetCaveat =
        'MTB’s known March 2027 rate change and April 2027 P&I change are not modeled. This estimate does not invent a future rate or payment, so it is not a reliable long-term MTB date.';
    }
  }
  return result;
}

function applyDebtPayoffMortgageTimingFlags_(strategies, reconciliations) {
  var byName = {};
  (reconciliations || []).forEach(function(row) {
    if (row && row.name && (row.conditionalEstimate === true ||
        row.estimateKind === 'conditional')) {
      byName[row.name] = row;
    }
  });
  function markRow_(row) {
    if (!row) return;
    var anyConditional = false;
    (row.paymentReleases || []).forEach(function(rel) {
      var recon = byName[rel.name];
      if (!recon) {
        if (rel.timingReliable == null) rel.timingReliable = true;
        return;
      }
      anyConditional = true;
      rel.modeledMonthIndex = rel.monthIndex;
      rel.modeledMonthKey = rel.monthKey;
      rel.modeledCashFlowStartsMonthIndex = rel.cashFlowStartsMonthIndex;
      rel.modeledCashFlowStartsMonthKey = rel.cashFlowStartsMonthKey;
      rel.timingReliable = false;
      rel.conditionalEstimate = true;
      rel.estimateKind = 'conditional';
      rel.timingMismatchReason = '';
    });
    (row.payoffOrder || []).forEach(function(item) {
      if (!byName[item.name]) return;
      anyConditional = true;
      item.modeledMonthIndex = item.monthIndex;
      item.modeledMonthKey = item.monthKey;
      item.timingReliable = false;
      item.conditionalEstimate = true;
      item.estimateKind = 'conditional';
    });
    if (anyConditional) {
      row.mortgageDatesAreConditional = true;
      row.payoffTimingReliable = false;
    } else if (row.payoffTimingReliable == null) {
      row.payoffTimingReliable = true;
    }
  }
  Object.keys(strategies || {}).forEach(function(key) {
    markRow_(strategies[key]);
  });
}

function debtPayoffHouseholdPlanAssumptions_(options) {
  options = options || {};
  var extra = options.extra;
  var extraIsSafe = options.extraIsSafe === true;
  var reserveBreached = options.reserveBreached === true;
  var notes = [];
  if (options.hasConditionalMortgageEstimates) {
    notes.push(
      'Mortgage payoff months and interest are conditional estimates. They assume the current saved APR and P&I stay unchanged. They are not lender-confirmed dates.'
    );
  }
  if (options.includeMtbRateResetCaveat) {
    notes.push(
      'MTB’s known March 2027 rate change and April 2027 P&I change are not modeled. This estimate does not invent a future rate or payment, so it is not a reliable long-term MTB date.'
    );
  }
  var deficit = Number(options.monthlyDeficit);
  var hasDeficit = isFinite(deficit) && deficit > 0.005;
  var facts = [];
  if (options.usableCashAfterBuffers != null &&
      isFinite(Number(options.usableCashAfterBuffers))) {
    facts.push(fmtCurrency_(options.usableCashAfterBuffers) + ' usable cash');
  }
  if (options.requiredReserveAmount != null &&
      isFinite(Number(options.requiredReserveAmount))) {
    facts.push('a ' + fmtCurrency_(options.requiredReserveAmount) + ' reserve');
  }
  var lead = facts.length
    ? 'Current household facts show ' + debtPayoffJoinEnglish_(facts) + '. '
    : '';
  if (!extraIsSafe || reserveBreached || !(Number(extra) > DEBT_PAYOFF_SCENARIO_ZERO_BAL_)) {
    notes.push(
      lead +
      'Rollover strategies are hypothetical and not currently affordable. They assume required payments continue and that released payments can be rolled.' +
      (hasDeficit
        ? ' They do not model how the current deficit is funded or future new borrowing.'
        : ' They do not model future new borrowing.')
    );
    notes.push(
      (Number(extra) > DEBT_PAYOFF_SCENARIO_ZERO_BAL_
        ? 'Current extra remains ' + fmtCurrency_(extra) + '. '
        : '') +
      'A rollover schedule is not labeled safe. This plan does not add $400 to a mortgage.'
    );
  } else {
    notes.push(
      'This plan does not add $400 to a mortgage. Extra stays at the current recommendation of ' +
      fmtCurrency_(extra) + '.'
    );
  }
  notes.push(
    'Mortgage amortization uses principal-and-interest only. Full minimums stay in monthly budgeting. Escrow is not applied to principal. Keeping a paid-off debt’s payment improves monthly cash flow; rolling that payment does not improve cash flow until the rollover stops.'
  );
  return notes;
}

function summarizeDebtPayoffHouseholdScenario_(result, minOnlyInterest, planKey, extraIsSafe, reserveBreached) {
  var row = summarizeDebtPayoffScenario_(result, minOnlyInterest);
  row.planKey = planKey;
  row.rollReleasedPayments = planKey !== 'keep_cash';
  row.improvesMonthlyCashFlowOnRelease = planKey === 'keep_cash';
  row.rolloverIsSafe = extraIsSafe === true && reserveBreached !== true &&
    planKey !== 'keep_cash';
  row.hypothetical = planKey === 'custom_order' || extraIsSafe !== true ||
    reserveBreached === true;
  return row;
}

function buildDebtPayoffHouseholdPlan_(normalizedDebts, options) {
  options = options || {};
  var extraParsed = parseDebtPayoffScenarioMonthlyExtra_(options.monthlyExtra);
  var extra = extraParsed.ok ? extraParsed.amount : 0;
  var extraIsSafe = options.extraIsSafe === true && extra > DEBT_PAYOFF_SCENARIO_ZERO_BAL_;
  var reserveBreached = options.reserveBreached === true;
  var classified = classifyDebtPayoffScenarioDebts_(normalizedDebts);
  var simOptions = {
    asOfDate: options.asOfDate,
    horizonMonths: options.horizonMonths,
    bonusEvents: []
  };
  var keepCash = simulateDebtPayoffSchedule_(
    classified.modeled, extra, 'minimum_only', simOptions);
  var avalancheRoll = simulateDebtPayoffSchedule_(
    classified.modeled, extra, 'avalanche', Object.assign({}, simOptions, {
      rollReleasedPayments: true
    }));
  var snowballRoll = simulateDebtPayoffSchedule_(
    classified.modeled, extra, 'snowball', Object.assign({}, simOptions, {
      rollReleasedPayments: true
    }));
  var customOrder = null;
  var targetOrder = Array.isArray(options.targetOrder)
    ? options.targetOrder.map(function(name) { return String(name || ''); }).filter(Boolean)
    : [];
  if (targetOrder.length) {
    customOrder = simulateDebtPayoffSchedule_(
      classified.modeled, extra, 'custom', Object.assign({}, simOptions, {
        rollReleasedPayments: true,
        targetOrder: targetOrder
      }));
  }
  var reconciliations = classified.modeled
    .filter(debtPayoffHasContinuingPropertyCosts_)
    .map(function(debt) {
      return reconcileDebtPayoffMortgageTerm_(debt, options.asOfDate);
    });
  var incompleteMortgages = classified.modeled
    .filter(function(debt) {
      return debtPayoffHasContinuingPropertyCosts_(debt) &&
        !debtPayoffDerivedPrincipalAndInterest_(debt).known;
    })
    .map(function(debt) {
      return {
        name: String(debt && debt.name || ''),
        reason: 'P&I versus escrow split is not saved. The full saved minimum was not applied to principal, and payoff dates and interest are not reliable.'
      };
    });
  var unverified = [];
  reconciliations.forEach(function(row) {
    (row.ignoredUnverifiedAmounts || []).forEach(function(item) {
      unverified.push(item);
    });
  });
  var strategies = {
    keep_cash: summarizeDebtPayoffHouseholdScenario_(
      keepCash, keepCash.totalInterest, 'keep_cash', extraIsSafe, reserveBreached),
    avalanche_roll: summarizeDebtPayoffHouseholdScenario_(
      avalancheRoll, keepCash.totalInterest, 'avalanche_roll', extraIsSafe, reserveBreached),
    snowball_roll: summarizeDebtPayoffHouseholdScenario_(
      snowballRoll, keepCash.totalInterest, 'snowball_roll', extraIsSafe, reserveBreached),
    custom_order: customOrder
      ? summarizeDebtPayoffHouseholdScenario_(
          customOrder, keepCash.totalInterest, 'custom_order', extraIsSafe, reserveBreached)
      : null
  };
  applyDebtPayoffMortgageTimingFlags_(strategies, reconciliations);
  var monthlyDeficit = 0;
  if (options.monthlyDeficit != null && isFinite(Number(options.monthlyDeficit))) {
    monthlyDeficit = round2_(Math.max(0, Number(options.monthlyDeficit)));
  } else {
    var surplusN = Number(options.recurringSurplusBeforeReserve);
    if (isFinite(surplusN) && surplusN < -0.005) {
      monthlyDeficit = round2_(Math.abs(surplusN));
    }
  }
  var includeMtb = classified.modeled.some(debtPayoffIsMtbMo4Plex_);
  var hasConditionalMortgageEstimates = reconciliations.some(function(row) {
    return row && row.conditionalEstimate === true;
  });
  var assumptions = debtPayoffHouseholdPlanAssumptions_({
    extra: extra,
    extraIsSafe: extraIsSafe,
    reserveBreached: reserveBreached,
    monthlyDeficit: monthlyDeficit,
    usableCashAfterBuffers: options.usableCashAfterBuffers,
    requiredReserveAmount: options.requiredReserveAmount,
    includeMtbRateResetCaveat: includeMtb,
    hasConditionalMortgageEstimates: hasConditionalMortgageEstimates
  });
  return {
    persisted: false,
    extraIsAffordable: null,
    extraIsSafe: extraIsSafe,
    monthlyExtra: extra,
    mortgageExtraHypothetical: false,
    proposedMortgageExtra: 0,
    reserveBreached: reserveBreached,
    rolloverIsSafe: extraIsSafe && !reserveBreached,
    keepCashImprovesCashFlow: true,
    rolloverDoesNotImproveCashFlowUntilLastDebt: true,
    loanExtraDoesNotLowerScheduledPayment: true,
    cardMinimumsHeldConstant: true,
    householdComparisonComplete: classified.blockers.length === 0 &&
      classified.modeled.length > 0 && incompleteMortgages.length === 0,
    mortgageProjectionComplete: incompleteMortgages.length === 0,
    modeledDebtNames: classified.modeled.map(function(d) { return d.name; }),
    blockers: classified.blockers,
    incompleteMortgages: incompleteMortgages,
    mortgageReconciliations: reconciliations,
    ignoredUnverifiedAmounts: unverified,
    targetOrder: targetOrder,
    strategies: strategies,
    monthlyDeficit: monthlyDeficit,
    usableCashAfterBuffers: options.usableCashAfterBuffers,
    requiredReserveAmount: options.requiredReserveAmount,
    includeMtbRateResetCaveat: includeMtb,
    hasConditionalMortgageEstimates: hasConditionalMortgageEstimates,
    assumptions: assumptions,
    assumptionsNote: assumptions
  };
}

function debtPayoffRecommendationProtection_(supported) {
  if (!supported) return null;
  var c = supported.components || {};
  var safety = supported.cashSafety || null;
  return {
    recurringIncomeMonthly: c.recurringIncomeMonthly,
    recurringBillsMonthly: c.recurringBillsMonthly,
    variableBillsMonthly: c.variableBillsMonthly,
    debtMinimumsMonthly: c.debtMinimumsMonthly,
    policyFloorMonthly: c.policyFloorMonthly,
    unmatchedInvestmentBillsMonthly: c.unmatchedInvestmentBillsMonthly,
    debtMinimumsByType: supported.debtMinimumsByType || null,
    cashPicture: supported.cashPicture || null,
    surplusBeforeReserve: supported.recurringSurplusBeforeReserve,
    usableCashAfterBuffers: supported.usableCashAfterBuffers,
    requiredReserveAmount: supported.requiredReserveAmount,
    reserveProtects: supported.reserveProtects === true,
    futureReserveProtects: supported.futureReserveProtects === true,
    deficit: supported.deficit === true,
    cashSafetyHorizonMonths: safety && safety.horizonMonths,
    cashSafetyHorizonLabel: safety && safety.horizonLabel,
    cashSafetyReduced: safety && safety.reduced === true,
    cashSafetyReason: safety && safety.reason,
    cashSafetyBreachMonthKey: safety && safety.breachMonthKey,
    cashSafetyBreachObligation: safety && safety.breachObligation,
    cashSafetyOutsideHorizon: safety && safety.outsideHorizon,
    remainingAboveReserve: safety && safety.remainingAboveReserve,
    endingCashAtZeroExtra: safety && safety.endingCashAtZeroExtra,
    protectedReserveFloor: safety && safety.protectedReserveFloor,
    cashSafetyReconciliation: safety && safety.reconciliation || null,
    cashSafetyInWindowUpcoming: safety && safety.inWindowUpcoming || null,
    oneTimeAllocationEvaluated: safety ? safety.oneTimeAllocationEvaluated === true : false,
    oneTimeAmount: safety && safety.oneTimeAmount != null ? safety.oneTimeAmount : null,
    oneTimeTightMonthKey: safety && safety.oneTimeTightMonthKey || '',
    oneTimeHorizonMonths: safety && safety.oneTimeHorizonMonths,
    oneTimeBaselineSafe: safety ? safety.oneTimeBaselineSafe === true : false,
    oneTimeBaselineBreachMonthKey: safety && safety.oneTimeBaselineBreachMonthKey || '',
    oneTimeBaselineBreachObligation: safety && safety.oneTimeBaselineBreachObligation || '',
    oneTimeLimitedToThreeMonths: safety ? safety.oneTimeLimitedToThreeMonths === true : false,
    oneTimeThreeMonthAmount: safety && safety.oneTimeThreeMonthAmount != null
      ? safety.oneTimeThreeMonthAmount
      : null
  };
}

function debtPayoffRecommendationWithhold_(code, reason, extras) {
  extras = extras || {};
  return {
    state: 'WITHHELD',
    code: code,
    reason: String(reason || 'A monthly extra-payoff recommendation cannot be proven.'),
    reasons: extras.reasons || [String(reason || 'A monthly extra-payoff recommendation cannot be proven.')],
    monthlyExtra: extras.monthlyExtra != null ? extras.monthlyExtra : null,
    extraIsAffordable: null,
    persisted: false,
    bonusesIncluded: false,
    strategyKey: null,
    why: '',
    comparison: null,
    firstExtraDebt: '',
    nextMilestone: null,
    debtFreeMonthKey: null,
    debtFreeWithinHorizon: false,
    totalInterest: null,
    protection: extras.protection || null,
    cashSafety: extras.cashSafety || (extras.protection && extras.protection.cashSafetyReason
      ? { reason: extras.protection.cashSafetyReason }
      : null),
    refreshesFromSavedFacts: true
  };
}

function debtPayoffInterestTradeoffLabel_(pickedInterest, otherInterest, otherName) {
  var delta = round2_(Number(otherInterest) - Number(pickedInterest));
  if (!isFinite(delta) || Math.abs(delta) <= 0.005) {
    return 'Modeled interest matches ' + otherName + '.';
  }
  if (delta > 0) {
    return 'It models $' + delta.toFixed(2) + ' less interest than ' + otherName + '.';
  }
  return 'It models $' + Math.abs(delta).toFixed(2) + ' more interest than ' + otherName + '.';
}

function debtPayoffTimeTradeoffLabel_(picked, other, otherName) {
  if (picked && picked.debtFreeWithinHorizon && other && other.debtFreeWithinHorizon) {
    if (picked.debtFreeMonthIndex < other.debtFreeMonthIndex) {
      return 'Estimated debt-free month is ' + picked.debtFreeMonthKey +
        ', sooner than ' + otherName + ' (' + other.debtFreeMonthKey + ').';
    }
    if (picked.debtFreeMonthIndex > other.debtFreeMonthIndex) {
      return 'Estimated debt-free month is ' + picked.debtFreeMonthKey +
        ', later than ' + otherName + ' (' + other.debtFreeMonthKey + ').';
    }
    return 'Estimated debt-free month is ' + picked.debtFreeMonthKey +
      ', the same as ' + otherName + '.';
  }
  if (picked && picked.debtFreeWithinHorizon) {
    return 'Estimated debt-free month is ' + picked.debtFreeMonthKey +
      '. ' + otherName + ' does not finish within the forecast horizon.';
  }
  return 'Not debt-free within the forecast horizon.';
}

function pickDebtPayoffRecommendedStrategy_(comparison) {
  var avalanche = comparison.strategies.avalanche;
  var snowball = comparison.strategies.snowball;
  var avInt = Number(avalanche.totalInterest);
  var snInt = Number(snowball.totalInterest);
  var key = 'avalanche';
  var picked = avalanche;
  var other = snowball;
  var otherName = 'snowball';
  var snEarlier = snowball.debtFreeWithinHorizon && (
    !avalanche.debtFreeWithinHorizon ||
    snowball.debtFreeMonthIndex < avalanche.debtFreeMonthIndex);
  var avEarlier = avalanche.debtFreeWithinHorizon && (
    !snowball.debtFreeWithinHorizon ||
    avalanche.debtFreeMonthIndex < snowball.debtFreeMonthIndex);
  if (snInt + 0.005 < avInt) {
    key = 'snowball';
    picked = snowball;
    other = avalanche;
    otherName = 'avalanche';
  } else if (Math.abs(avInt - snInt) <= 0.005 && snEarlier && !avEarlier) {
    key = 'snowball';
    picked = snowball;
    other = avalanche;
    otherName = 'avalanche';
  }
  var title = key === 'avalanche'
    ? 'Avalanche (highest APR first)'
    : 'Snowball (smallest balance first)';
  var method = key === 'avalanche'
    ? 'Avalanche applies the estimated monthly extra to the highest-APR debt first.'
    : 'Snowball applies the estimated monthly extra to the smallest balance first.';
  var why = method + ' ' +
    formatDebtPayoffInterestVsBaseline_(picked) + ' ' +
    debtPayoffInterestTradeoffLabel_(picked.totalInterest, other.totalInterest, otherName) + ' ' +
    debtPayoffTimeTradeoffLabel_(picked, other, otherName);
  return { key: key, title: title, why: why.trim() };
}

function debtPayoffIsHeloc_(debt) {
  var type = String(debt && debt.type || '').trim().toLowerCase();
  var name = String(debt && (debt.name || debt.originalName) || '').toLowerCase();
  return type === 'heloc' || /\bheloc\b/.test(name);
}

function debtPayoffIsMortgage_(debt) {
  if (!debt || debtPayoffIsHeloc_(debt)) return false;
  var type = String(debt.type || '').trim().toLowerCase();
  if (type === 'mortgage') return true;
  var name = String(debt.name || debt.originalName || '').toLowerCase();
  if (/\bmortgage\b/.test(name)) return true;
  return type === 'loan' && /\b(house|home)\b/.test(name);
}

function debtPayoffNextDollarHorizonMonths_(options) {
  var n = Number(options && options.horizonMonths);
  return n > 0 ? n : DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_;
}

function debtPayoffUsableNamedDebts_(debts, predicate) {
  var rows = [];
  (debts || []).forEach(function(debt) {
    if (typeof predicate === 'function' && !predicate(debt)) return;
    if (debtPayoffScenarioInputState_(debt) !== 'USABLE') return;
    rows.push(debt);
  });
  return rows;
}

function debtPayoffIncompleteNamedDebts_(debts, predicate) {
  var rows = [];
  (debts || []).forEach(function(debt) {
    if (!debt || debt.active === false) return;
    if (typeof predicate === 'function' && !predicate(debt)) return;
    var state = debtPayoffScenarioInputState_(debt);
    if (state === 'INACTIVE' || state === 'NO_BALANCE' || state === 'USABLE') return;
    rows.push({
      name: String(debt.name || ''),
      reason: debtPayoffScenarioBlockerMessage_(state),
      location: 'Assets & Liabilities → Debt accounts'
    });
  });
  return rows;
}

/**
 * Read-only saved assumptions for the next-dollar comparison.
 * Does not create sheets, does not use This Week’s 7% investment default,
 * and does not invent cash APY.
 */
function readDebtPayoffSavedPlanningAssumptions_(ss) {
  var result = {
    cashYieldKnown: false,
    cashYieldStatus: 'CASH_YIELD_DATA_REQUIRED',
    cashYieldPct: null,
    cashYieldLocation: 'Cash accounts do not yet store an authoritative APY for this comparison.',
    expectedInvestmentReturnKnown: false,
    expectedInvestmentReturnPct: null,
    expectedInvestmentReturnSource: '',
    expectedInvestmentReturnLocation: 'Planning → Retirement'
  };
  if (!ss || typeof ss.getSheetByName !== 'function') return result;
  try {
    var sheet = ss.getSheetByName('INPUT - Retirement');
    if (!sheet || sheet.getLastRow() < 1) return result;
    var range = sheet.getDataRange();
    var values = range.getValues();
    var display = range.getDisplayValues();
    var selectedRow = -1;
    var returnRow = -1;
    var i;
    for (i = 0; i < values.length; i++) {
      var label = String(values[i][0] || '').trim();
      if (label === 'Selected Scenario') selectedRow = i;
      if (label === 'Expected Annual Return %') returnRow = i;
    }
    if (returnRow < 0) return result;
    var selected = 'Base';
    if (selectedRow >= 0) {
      var rawSelected = String(
        display[selectedRow][1] || values[selectedRow][1] || ''
      ).trim();
      if (/conservative/i.test(rawSelected)) selected = 'Conservative';
      else if (/aggressive/i.test(rawSelected)) selected = 'Aggressive';
      else if (rawSelected) selected = 'Base';
    }
    var col = selected === 'Conservative' ? 1 : selected === 'Aggressive' ? 3 : 2;
    var shown = String(display[returnRow][col] || '').trim();
    if (!shown) return result;
    var pct = round2_(toNumber_(values[returnRow][col]));
    if (!isFinite(pct)) return result;
    result.expectedInvestmentReturnKnown = true;
    result.expectedInvestmentReturnPct = pct;
    result.expectedInvestmentReturnSource = 'CONFIGURED_FACT';
    result.expectedInvestmentReturnLocation =
      'Planning → Retirement (' + selected + ' Expected Annual Return %)';
  } catch (err) {
    return result;
  }
  return result;
}

function debtPayoffUncertainInvestmentGrowth_(monthlyAmount, annualPct, months) {
  var amount = round2_(Math.max(0, Number(monthlyAmount) || 0));
  var n = Number(months);
  if (!(amount > 0) || !(n > 0)) return 0;
  var monthlyRate = (Number(annualPct) / 100) / 12;
  if (!isFinite(monthlyRate) || monthlyRate === 0) {
    return round2_(amount * n);
  }
  return round2_(amount * (Math.pow(1 + monthlyRate, n) - 1) / monthlyRate);
}

function debtPayoffNextDollarModeledOutcome_(minOnly, targeted, label) {
  var interestSaved = round2_(
    Number(minOnly && minOnly.totalInterest || 0) -
    Number(targeted && targeted.totalInterest || 0)
  );
  var outcome = 'Modeled interest is ' +
    formatDebtPayoffInterestVsBaseline_({
      interestSavedVsMinimumOnly: interestSaved
    });
  if (targeted && targeted.debtFreeWithinHorizon) {
    outcome += ' Estimated debt-free month is ' + targeted.debtFreeMonthKey + '.';
  } else {
    outcome += ' Not debt-free within the forecast horizon.';
  }
  return {
    interestSavedVsMinimumOnly: interestSaved,
    totalInterest: targeted ? targeted.totalInterest : null,
    debtFreeMonthKey: targeted && targeted.debtFreeMonthKey || null,
    debtFreeWithinHorizon: !!(targeted && targeted.debtFreeWithinHorizon),
    firstExtraDebt: (targeted && targeted.extraPriorityOrder && targeted.extraPriorityOrder[0]) || '',
    outcome: outcome,
    outcomeKind: 'MODELED_INTEREST',
    label: label
  };
}

function buildDebtPayoffNextDollarAlternative_(key, title, extras) {
  extras = extras || {};
  return {
    key: key,
    title: title,
    status: extras.status || 'CONDITIONAL',
    amount: extras.amount != null ? extras.amount : null,
    why: extras.why || '',
    liquidity: extras.liquidity || '',
    outcome: extras.outcome || '',
    outcomeKind: extras.outcomeKind || '',
    missingAssumption: extras.missingAssumption || '',
    location: extras.location || '',
    firstTarget: extras.firstTarget || '',
    interestSavedVsMinimumOnly: extras.interestSavedVsMinimumOnly,
    expectedReturnPct: extras.expectedReturnPct,
    cashYieldStatus: extras.cashYieldStatus || ''
  };
}

function buildDebtPayoffNextDollarComparison_(normalizedDebts, supported, rec, options) {
  options = options || {};
  rec = rec || {};
  var horizonMonths = debtPayoffNextDollarHorizonMonths_(options);
  var saved = options.savedAssumptions || {};
  var asOfDate = options.asOfDate;
  var amount = rec.monthlyExtra;
  var classified = classifyDebtPayoffScenarioDebts_(normalizedDebts);
  var modeled = classified.modeled || [];
  var highApr = debtPayoffUsableNamedDebts_(normalizedDebts, function(debt) {
    return !debtPayoffIsMortgage_(debt) && !debtPayoffIsHeloc_(debt);
  });
  var mortgages = debtPayoffUsableNamedDebts_(normalizedDebts, debtPayoffIsMortgage_);
  var incompleteHighApr = debtPayoffIncompleteNamedDebts_(normalizedDebts, function(debt) {
    return !debtPayoffIsMortgage_(debt) && !debtPayoffIsHeloc_(debt);
  });
  var incompleteMortgage = debtPayoffIncompleteNamedDebts_(normalizedDebts, debtPayoffIsMortgage_);
  var simOptions = {
    asOfDate: asOfDate,
    horizonMonths: horizonMonths,
    bonusEvents: []
  };
  var minOnly = modeled.length
    ? simulateDebtPayoffSchedule_(modeled, 0, 'minimum_only', simOptions)
    : null;
  var assumptions = [
    'This comparison uses the same supported extra after required bills, debt minimums, standing investment floors, account buffers, and the canonical 90-day reserve.',
    'Forecast horizon is ' + horizonMonths +
      ' months. Modeled interest is remaining balance × (APR ÷ 100 ÷ 12) each month, then contractual minimums, then extra.',
    'Modeled interest savings are a calculation from current balances, APRs, and minimums. Investment growth is uncertain even when a saved expected return exists.',
    'Cash APY, tax deductibility, mortgage-interest tax treatment, and prepayment penalties are not invented.'
  ];
  var missingAssumptions = [];
  if (saved.cashYieldKnown !== true) {
    missingAssumptions.push({
      code: saved.cashYieldStatus || 'CASH_YIELD_DATA_REQUIRED',
      reason: saved.cashYieldLocation ||
        'Cash accounts do not yet store an authoritative APY for this comparison.'
    });
    assumptions.push('Cash yield is labeled ' +
      (saved.cashYieldStatus || 'CASH_YIELD_DATA_REQUIRED') +
      ' and is not modeled.');
  }
  if (saved.expectedInvestmentReturnKnown !== true) {
    missingAssumptions.push({
      code: 'EXPECTED_RETURN_REQUIRED',
      reason: 'A saved expected investment return was not found. Update ' +
        (saved.expectedInvestmentReturnLocation || 'Planning → Retirement') + '.'
    });
  }

  var highAprAlt;
  if (incompleteHighApr.length) {
    highAprAlt = buildDebtPayoffNextDollarAlternative_(
      'PAY_HIGH_APR_DEBT',
      'Pay high-APR debt',
      {
        status: 'CONDITIONAL',
        amount: amount,
        missingAssumption: incompleteHighApr.map(function(row) {
          return row.name + ' (' + row.reason + ')';
        }).join('; '),
        location: 'Assets & Liabilities → Debt accounts',
        why: 'High-APR extra cannot be ranked until every non-mortgage, non-HELOC debt with a balance has a usable APR and minimum. Missing values were not replaced with $0 or 0%.',
        liquidity: 'Paying extra would reduce cash that is currently available.',
        outcome: 'Not modeled.',
        outcomeKind: 'MODELED_INTEREST'
      }
    );
  } else if (!highApr.length) {
    highAprAlt = buildDebtPayoffNextDollarAlternative_(
      'PAY_HIGH_APR_DEBT',
      'Pay high-APR debt',
      {
        status: 'NOT_APPLICABLE',
        amount: amount,
        why: 'No non-mortgage, non-HELOC debt currently has a usable balance, APR, and minimum together.',
        location: 'Assets & Liabilities → Debt accounts',
        liquidity: 'No high-APR extra payment is modeled.',
        outcome: 'Not applicable.',
        outcomeKind: 'MODELED_INTEREST'
      }
    );
  } else if (!(Number(amount) > 0.005)) {
    highAprAlt = buildDebtPayoffNextDollarAlternative_(
      'PAY_HIGH_APR_DEBT',
      'Pay high-APR debt',
      {
        status: 'READY',
        amount: amount == null ? null : 0,
        why: 'No supported extra remains after protections, so no extra high-APR payment is modeled.',
        liquidity: 'Cash stays available for required obligations and the reserve.',
        outcome: 'No extra high-APR payment this month.',
        outcomeKind: 'MODELED_INTEREST',
        firstTarget: highApr[0].name
      }
    );
  } else {
    var highAprSim = simulateDebtPayoffSchedule_(
      modeled, amount, 'avalanche', Object.assign({}, simOptions, {
        extraTargetNames: highApr.map(function(row) { return row.name; })
      })
    );
    var highAprModeled = debtPayoffNextDollarModeledOutcome_(
      minOnly, highAprSim, 'Pay high-APR debt');
    highAprAlt = buildDebtPayoffNextDollarAlternative_(
      'PAY_HIGH_APR_DEBT',
      'Pay high-APR debt',
      {
        status: 'READY',
        amount: amount,
        why: 'Avalanche applies this extra to the highest-APR non-mortgage, non-HELOC debt first after contractual minimums. ' +
          highAprModeled.outcome,
        liquidity: 'The extra leaves cash and is not kept as a reserve.',
        outcome: highAprModeled.outcome,
        outcomeKind: 'MODELED_INTEREST',
        firstTarget: highAprModeled.firstExtraDebt,
        interestSavedVsMinimumOnly: highAprModeled.interestSavedVsMinimumOnly
      }
    );
  }

  var mortgageAlt;
  if (incompleteMortgage.length && !mortgages.length) {
    mortgageAlt = buildDebtPayoffNextDollarAlternative_(
      'PAY_MORTGAGE',
      'Pay extra toward a mortgage',
      {
        status: 'CONDITIONAL',
        amount: amount,
        missingAssumption: incompleteMortgage.map(function(row) {
          return row.name + ' (' + row.reason + ')';
        }).join('; '),
        location: 'Assets & Liabilities → Debt accounts',
        why: 'A mortgage extra cannot be modeled until that loan has a usable APR and minimum. Missing values were not replaced with $0 or 0%. HELOC extra is not included in this comparison.',
        liquidity: 'Extra mortgage principal would leave cash and is not treated as liquid.',
        outcome: 'Not modeled.',
        outcomeKind: 'MODELED_INTEREST'
      }
    );
  } else if (!mortgages.length) {
    mortgageAlt = buildDebtPayoffNextDollarAlternative_(
      'PAY_MORTGAGE',
      'Pay extra toward a mortgage',
      {
        status: 'NOT_APPLICABLE',
        amount: amount,
        why: 'No mortgage with a usable balance, APR, and minimum was identified. Type Loan alone is not treated as a mortgage, and HELOC extra is not included here.',
        location: 'Assets & Liabilities → Debt accounts',
        liquidity: 'No extra mortgage principal is modeled.',
        outcome: 'Not applicable.',
        outcomeKind: 'MODELED_INTEREST'
      }
    );
  } else if (!(Number(amount) > 0.005)) {
    mortgageAlt = buildDebtPayoffNextDollarAlternative_(
      'PAY_MORTGAGE',
      'Pay extra toward a mortgage',
      {
        status: 'READY',
        amount: amount == null ? null : 0,
        why: 'No supported extra remains after protections, so no extra mortgage principal is modeled.',
        liquidity: 'Cash stays available for required obligations and the reserve.',
        outcome: 'No extra mortgage payment this month.',
        outcomeKind: 'MODELED_INTEREST',
        firstTarget: mortgages[0].name
      }
    );
  } else {
    var mortgageSim = simulateDebtPayoffSchedule_(
      modeled, amount, 'avalanche', Object.assign({}, simOptions, {
        extraTargetNames: mortgages.map(function(row) { return row.name; })
      })
    );
    var mortgageModeled = debtPayoffNextDollarModeledOutcome_(
      minOnly, mortgageSim, 'Pay extra toward a mortgage');
    mortgageAlt = buildDebtPayoffNextDollarAlternative_(
      'PAY_MORTGAGE',
      'Pay extra toward a mortgage',
      {
        status: 'READY',
        amount: amount,
        why: 'Extra is applied only to identified mortgage principal after contractual minimums. Tax deductibility and prepayment penalties are not assumed. ' +
          mortgageModeled.outcome,
        liquidity: 'Extra mortgage principal leaves cash and is not treated as liquid.',
        outcome: mortgageModeled.outcome,
        outcomeKind: 'MODELED_INTEREST',
        firstTarget: mortgageModeled.firstExtraDebt,
        interestSavedVsMinimumOnly: mortgageModeled.interestSavedVsMinimumOnly
      }
    );
  }

  var cashAlt = buildDebtPayoffNextDollarAlternative_(
    'KEEP_CASH',
    'Keep the money in cash',
    {
      status: 'READY',
      amount: amount == null ? null : Math.max(0, Number(amount) || 0),
      why: saved.cashYieldKnown === true
        ? 'Keeping the extra in cash preserves liquidity. A saved cash yield is used only as a labeled fact and is not treated as guaranteed.'
        : 'Keeping the extra in cash preserves liquidity. Cash yield is not modeled because no authoritative APY is saved.',
      liquidity: Number(amount) > 0.005
        ? 'The extra stays available as cash after required protections.'
        : 'Required upcoming payments, account buffers, and the 90-day reserve already use available cash.',
      outcome: saved.cashYieldKnown === true
        ? 'Cash remains available. Yield is a saved fact, not a guaranteed return.'
        : 'Cash remains available. No growth is modeled (' +
          (saved.cashYieldStatus || 'CASH_YIELD_DATA_REQUIRED') + ').',
      outcomeKind: 'CASH_LIQUIDITY',
      cashYieldStatus: saved.cashYieldStatus || 'CASH_YIELD_DATA_REQUIRED',
      missingAssumption: saved.cashYieldKnown === true
        ? ''
        : (saved.cashYieldLocation || 'Cash APY is not an authoritative saved fact.')
    }
  );

  var investAlt;
  if (saved.expectedInvestmentReturnKnown === true &&
      saved.expectedInvestmentReturnPct != null &&
      isFinite(Number(saved.expectedInvestmentReturnPct))) {
    var growth = Number(amount) > 0.005
      ? debtPayoffUncertainInvestmentGrowth_(
          amount, saved.expectedInvestmentReturnPct, horizonMonths)
      : 0;
    investAlt = buildDebtPayoffNextDollarAlternative_(
      'INVEST',
      'Invest',
      {
        status: 'READY',
        amount: amount,
        why: 'Uses the saved expected annual return of ' +
          Number(saved.expectedInvestmentReturnPct).toFixed(2) +
          '% from ' + saved.expectedInvestmentReturnLocation +
          '. This is an uncertain planning estimate, not modeled interest.',
        liquidity: 'Invested extra becomes market-dependent and is not treated as cash.',
        outcome: Number(amount) > 0.005
          ? ('Uncertain estimated value of contributing this extra each month for ' +
            horizonMonths + ' months is ' + fmtCurrency_(growth) +
            '. Market outcomes can be lower or higher.')
          : 'No extra is available to invest this month.',
        outcomeKind: 'UNCERTAIN_RETURN',
        expectedReturnPct: saved.expectedInvestmentReturnPct,
        location: saved.expectedInvestmentReturnLocation
      }
    );
  } else {
    investAlt = buildDebtPayoffNextDollarAlternative_(
      'INVEST',
      'Invest',
      {
        status: 'CONDITIONAL',
        amount: amount,
        why: 'Investing this extra is not ranked because no saved expected return was found. A default return is not used.',
        liquidity: 'Invested extra would become market-dependent and is not treated as cash.',
        outcome: 'Not modeled until a saved expected return exists.',
        outcomeKind: 'UNCERTAIN_RETURN',
        missingAssumption: 'Expected Annual Return % is missing or blank.',
        location: saved.expectedInvestmentReturnLocation || 'Planning → Retirement'
      }
    );
  }

  var noRecurringExtra = !(Number(amount) > 0.005);
  var safety = (supported && supported.cashSafety) || rec.cashSafety || null;
  var remainingAboveReserve = safety && isFinite(Number(safety.remainingAboveReserve))
    ? Number(safety.remainingAboveReserve)
    : null;
  if (noRecurringExtra) {
    cashAlt.why = rec.reason ||
      'No recurring extra remains after required bills, known debt minimums, and standing floors.';
    cashAlt.liquidity = '';
    cashAlt.outcome = '';
  }
  var alternatives = noRecurringExtra
    ? []
    : [highAprAlt, cashAlt, mortgageAlt, investAlt];
  var action = cashAlt;
  var why = rec.reason || 'Keep cash until extra can be proven.';
  if (rec.state === 'WITHHELD') {
    if (rec.code === 'FACTS_MISSING') {
      action = buildDebtPayoffNextDollarAlternative_(
        'NONE',
        'A next-dollar use cannot be recommended',
        {
          status: 'WITHHELD',
          amount: null,
          why: rec.reason,
          liquidity: 'Unknown extra is not treated as $0 and is not allocated.',
          outcome: 'Withheld until required facts are saved.',
          outcomeKind: 'WITHHELD'
        }
      );
      why = rec.reason;
    } else {
      action = cashAlt;
      action.status = 'READY';
      why = rec.reason || cashAlt.why;
      action.why = why;
    }
  } else if (highAprAlt.status === 'READY' &&
      Number(highAprAlt.interestSavedVsMinimumOnly) > 0.005) {
    action = highAprAlt;
    why = highAprAlt.why;
  } else {
    action = cashAlt;
    why = 'No high-APR extra payment can be shown to reduce modeled interest, and cash yield, tax, and mortgage-deductibility facts are not invented. The extra stays in cash.';
    action.why = why;
  }

  return {
    state: rec.state === 'WITHHELD' ? 'WITHHELD' : 'RECOMMENDED',
    code: rec.code || '',
    amount: action.amount,
    actionKey: action.key,
    actionTitle: action.title,
    why: why,
    liquidity: action.liquidity,
    outcome: action.outcome,
    outcomeKind: action.outcomeKind,
    horizonMonths: horizonMonths,
    horizonLabel: noRecurringExtra
      ? DEBT_PAYOFF_CASH_SAFETY_HORIZON_LABEL_
      : (horizonMonths + '-month payoff forecast'),
    firstTarget: action.firstTarget || '',
    persisted: false,
    extraIsAffordable: null,
    oneTimeAllocationEvaluated: !!(safety && safety.oneTimeAllocationEvaluated === true),
    remainingAboveReserve: remainingAboveReserve,
    reconciliation: safety && safety.reconciliation || null,
    alternatives: alternatives,
    assumptions: assumptions,
    missingAssumptions: missingAssumptions,
    cashYieldStatus: saved.cashYieldStatus || 'CASH_YIELD_DATA_REQUIRED',
    expectedInvestmentReturnKnown: saved.expectedInvestmentReturnKnown === true,
    expectedInvestmentReturnPct: saved.expectedInvestmentReturnKnown === true
      ? saved.expectedInvestmentReturnPct
      : null
  };
}

function debtPayoffOneTimeWithheld_(code, reason, extras) {
  extras = extras || {};
  return {
    state: 'WITHHELD',
    code: code || 'FACTS_MISSING',
    evaluated: false,
    persisted: false,
    extraIsAffordable: null,
    amount: extras.amount != null ? extras.amount : null,
    actionKey: 'NONE',
    actionTitle: 'A one-time extra cannot be evaluated',
    why: String(reason ||
      'One-time extra cannot be evaluated until required facts are saved. Unknown values are not treated as $0.'),
    horizonMonths: DEBT_PAYOFF_CASH_SAFETY_HORIZON_MONTHS_,
    horizonLabel: DEBT_PAYOFF_CASH_SAFETY_HORIZON_LABEL_,
    payoffHorizonMonths: DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_,
    tightMonthKey: '',
    cashYieldKnown: extras.cashYieldKnown === true,
    cashYieldStatus: extras.cashYieldStatus || 'CASH_YIELD_DATA_REQUIRED',
    ranked: false,
    keepCash: null,
    payHighApr: null,
    missingAssumptions: extras.missingAssumptions || [],
    assumptions: extras.assumptions || [
      'Unknown upcoming dates or amounts are not treated as $0.',
      'This one-time check is separate from the monthly extra recommendation and the optional hypothetical scenario.'
    ]
  };
}

function buildDebtPayoffOneTimeAllocation_(normalizedDebts, supported, rec, options) {
  options = options || {};
  rec = rec || {};
  var saved = options.savedAssumptions || {};
  var safety = (supported && supported.cashSafety) || rec.cashSafety || null;
  var cashYieldStatus = saved.cashYieldStatus || 'CASH_YIELD_DATA_REQUIRED';
  var cashYieldKnown = saved.cashYieldKnown === true &&
    saved.cashYieldPct != null && isFinite(Number(saved.cashYieldPct));
  var assumptions = [
    'This one-time amount is separate from the monthly extra recommendation and the optional hypothetical scenario. It is not added on top of a recurring extra. Optional Cisco bonuses are not assumed.',
    'The one-time check projects 12 months from current recurring surplus and known Planned upcoming expenses. It does not invent future income. Recurring bills and debt minimums stay in the surplus and are not subtracted again.',
    'Each month-end must stay at or above the protected reserve floor from This Week’s canonical 90-day reserve. Upcoming already included in that reserve is removed from the floor so those expenses are counted once.',
    'If even $0 extra would fall below the reserve in a later month, no lump is labeled safe. A lump that only holds for three months is not used when the 12-month baseline later breaches.',
    'Modeled interest uses current balances, APRs, and minimums over the payoff forecast. Cash APY is used only when an authoritative saved yield exists.'
  ];
  if (!supported || supported.available !== true) {
    var blockers = (supported && supported.blockers) || [];
    return debtPayoffOneTimeWithheld_(
      'FACTS_MISSING',
      blockers.length
        ? ('One-time extra cannot be evaluated: ' + blockers.map(function(row) {
          return row && (row.reason || row.code);
        }).filter(function(line) { return !!line; }).join(' '))
        : 'One-time extra cannot be evaluated until required facts are saved. Unknown values are not treated as $0.',
      {
        missingAssumptions: blockers,
        cashYieldStatus: cashYieldStatus,
        assumptions: assumptions
      }
    );
  }
  if (supported.reserveProtects) {
    return {
      state: 'EVALUATED',
      code: 'RESERVE_PROTECTS',
      evaluated: true,
      persisted: false,
      extraIsAffordable: null,
      amount: 0,
      actionKey: 'NONE',
      actionTitle: 'No one-time extra',
      why: 'Usable cash after buffers does not yet cover This Week’s canonical reserve, so no one-time extra debt payment is evaluated.',
      horizonMonths: DEBT_PAYOFF_CASH_SAFETY_HORIZON_MONTHS_,
      horizonLabel: DEBT_PAYOFF_CASH_SAFETY_HORIZON_LABEL_,
      payoffHorizonMonths: DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_,
      tightMonthKey: (safety && safety.oneTimeTightMonthKey) || '',
      cashYieldKnown: cashYieldKnown,
      cashYieldStatus: cashYieldStatus,
      ranked: false,
      keepCash: null,
      payHighApr: null,
      missingAssumptions: cashYieldKnown ? [] : [{
        code: cashYieldStatus,
        reason: saved.cashYieldLocation ||
          'Cash accounts do not yet store an authoritative APY for this comparison.'
      }],
      assumptions: assumptions
    };
  }
  if (!safety || safety.oneTimeAllocationEvaluated !== true) {
    return debtPayoffOneTimeWithheld_(
      'CASH_SAFETY_FACTS_MISSING',
      (safety && safety.oneTimeReason) ||
        'Usable cash, recurring surplus, or the canonical reserve could not be proven for the one-time cash-safety check. Missing values were not replaced with $0.',
      { cashYieldStatus: cashYieldStatus, assumptions: assumptions }
    );
  }
  if (safety.oneTimeLimitedToThreeMonths === true) {
    return {
      state: 'EVALUATED',
      code: 'HORIZON_LIMITED',
      evaluated: true,
      persisted: false,
      extraIsAffordable: null,
      amount: 0,
      actionKey: 'NONE',
      actionTitle: 'No one-time extra is labeled safe',
      why: safety.oneTimeReason ||
        'The one-time check is limited to three months and no lump is labeled safe beyond that horizon.',
      horizonMonths: DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_,
      horizonLabel: DEBT_PAYOFF_ONE_TIME_HORIZON_LABEL_,
      payoffHorizonMonths: DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_,
      tightMonthKey: '',
      baselineBreachMonthKey: '',
      limitedToThreeMonths: true,
      cashYieldKnown: cashYieldKnown,
      cashYieldStatus: cashYieldStatus,
      ranked: false,
      keepCash: null,
      payHighApr: null,
      missingAssumptions: cashYieldKnown ? [] : [{
        code: cashYieldStatus,
        reason: saved.cashYieldLocation ||
          'Cash accounts do not yet store an authoritative APY for this comparison.'
      }],
      assumptions: assumptions
    };
  }
  if (safety.oneTimeBaselineSafe !== true) {
    return {
      state: 'EVALUATED',
      code: 'BASELINE_RESERVE_BREACH',
      evaluated: true,
      persisted: false,
      extraIsAffordable: null,
      amount: 0,
      actionKey: 'NONE',
      actionTitle: 'No one-time extra is labeled safe',
      why: safety.oneTimeReason ||
        'Even with no one-time extra, the 12-month projection falls below the protected reserve. No lump payment is labeled safe.',
      horizonMonths: DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_,
      horizonLabel: DEBT_PAYOFF_ONE_TIME_HORIZON_LABEL_,
      payoffHorizonMonths: DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_,
      tightMonthKey: safety.oneTimeTightMonthKey || safety.oneTimeBaselineBreachMonthKey || '',
      baselineBreachMonthKey: safety.oneTimeBaselineBreachMonthKey || '',
      baselineBreachObligation: safety.oneTimeBaselineBreachObligation || '',
      threeMonthAmount: safety.oneTimeThreeMonthAmount,
      limitedToThreeMonths: false,
      cashYieldKnown: cashYieldKnown,
      cashYieldStatus: cashYieldStatus,
      ranked: false,
      keepCash: null,
      payHighApr: null,
      missingAssumptions: cashYieldKnown ? [] : [{
        code: cashYieldStatus,
        reason: saved.cashYieldLocation ||
          'Cash accounts do not yet store an authoritative APY for this comparison.'
      }],
      assumptions: assumptions
    };
  }
  var amount = round2_(Math.max(0, Number(safety.oneTimeAmount) || 0));
  var highApr = debtPayoffUsableNamedDebts_(normalizedDebts, function(debt) {
    return !debtPayoffIsMortgage_(debt) && !debtPayoffIsHeloc_(debt);
  });
  var incompleteHighApr = debtPayoffIncompleteNamedDebts_(normalizedDebts, function(debt) {
    return !debtPayoffIsMortgage_(debt) && !debtPayoffIsHeloc_(debt);
  });
  var horizonMonths = debtPayoffNextDollarHorizonMonths_(options);
  var asOfDate = options.asOfDate;
  var simOptions = {
    asOfDate: asOfDate,
    horizonMonths: horizonMonths,
    bonusEvents: []
  };
  var classified = classifyDebtPayoffScenarioDebts_(normalizedDebts);
  var modeled = classified.modeled || [];
  var minOnly = modeled.length
    ? simulateDebtPayoffSchedule_(modeled, 0, 'minimum_only', simOptions)
    : null;
  var missingAssumptions = [];
  if (!cashYieldKnown) {
    missingAssumptions.push({
      code: cashYieldStatus,
      reason: saved.cashYieldLocation ||
        'Cash accounts do not yet store an authoritative APY for this comparison.'
    });
    assumptions = assumptions.concat([
      'Cash yield is labeled ' + cashYieldStatus +
        ', so keeping cash is not ranked against paying high-APR debt.'
    ]);
  }

  var payHighApr;
  if (incompleteHighApr.length) {
    payHighApr = buildDebtPayoffNextDollarAlternative_(
      'PAY_HIGH_APR_DEBT',
      'Pay high-APR debt once',
      {
        status: 'CONDITIONAL',
        amount: amount,
        missingAssumption: incompleteHighApr.map(function(row) {
          return row.name + ' (' + row.reason + ')';
        }).join('; '),
        location: 'Assets & Liabilities → Debt accounts',
        why: 'High-APR extra cannot be ranked until every non-mortgage, non-HELOC debt with a balance has a usable APR and minimum. Missing values were not replaced with $0 or 0%.',
        liquidity: 'Paying this one-time extra would reduce cash that is currently above the protected reserve.',
        outcome: 'Not modeled.',
        outcomeKind: 'MODELED_INTEREST'
      }
    );
  } else if (!highApr.length) {
    payHighApr = buildDebtPayoffNextDollarAlternative_(
      'PAY_HIGH_APR_DEBT',
      'Pay high-APR debt once',
      {
        status: 'NOT_APPLICABLE',
        amount: amount,
        why: 'No non-mortgage, non-HELOC debt currently has a usable balance, APR, and minimum together.',
        location: 'Assets & Liabilities → Debt accounts',
        liquidity: 'No one-time high-APR extra payment is modeled.',
        outcome: 'Not applicable.',
        outcomeKind: 'MODELED_INTEREST'
      }
    );
  } else if (!(amount > 0.005)) {
    payHighApr = buildDebtPayoffNextDollarAlternative_(
      'PAY_HIGH_APR_DEBT',
      'Pay high-APR debt once',
      {
        status: 'READY',
        amount: 0,
        why: 'No one-time extra keeps usable cash at or above the protected reserve in every month of the 12-month check.',
        liquidity: 'Cash stays available for required obligations and the reserve.',
        outcome: 'No one-time high-APR payment.',
        outcomeKind: 'MODELED_INTEREST',
        firstTarget: highApr[0].name
      }
    );
  } else {
    var highAprSim = simulateDebtPayoffSchedule_(
      modeled, 0, 'avalanche', Object.assign({}, simOptions, {
        oneTimeExtra: amount,
        extraTargetNames: highApr.map(function(row) { return row.name; })
      })
    );
    var highAprModeled = debtPayoffNextDollarModeledOutcome_(
      minOnly, highAprSim, 'Pay high-APR debt once');
    payHighApr = buildDebtPayoffNextDollarAlternative_(
      'PAY_HIGH_APR_DEBT',
      'Pay high-APR debt once',
      {
        status: 'READY',
        amount: amount,
        why: 'This one-time extra is applied to the highest-APR non-mortgage, non-HELOC debt after contractual minimums. ' +
          highAprModeled.outcome,
        liquidity: 'The one-time extra leaves cash and is not kept as a reserve.',
        outcome: highAprModeled.outcome,
        outcomeKind: 'MODELED_INTEREST',
        firstTarget: highAprModeled.firstExtraDebt,
        interestSavedVsMinimumOnly: highAprModeled.interestSavedVsMinimumOnly
      }
    );
    payHighApr.debtFreeMonthKey = highAprModeled.debtFreeMonthKey;
    payHighApr.debtFreeWithinHorizon = highAprModeled.debtFreeWithinHorizon === true;
    payHighApr.minOnlyDebtFreeMonthKey = minOnly && minOnly.debtFreeMonthKey || null;
    payHighApr.minOnlyDebtFreeWithinHorizon = !!(minOnly && minOnly.debtFreeWithinHorizon);
    payHighApr.firstTargetApr = null;
    var firstTarget = highApr.filter(function(row) {
      return row.name === highAprModeled.firstExtraDebt;
    })[0] || highApr[0];
    if (firstTarget && isFinite(Number(firstTarget.interestRate))) {
      payHighApr.firstTargetApr = Number(firstTarget.interestRate);
    }
  }

  var keepCash = buildDebtPayoffNextDollarAlternative_(
    'KEEP_CASH',
    'Keep the money in cash',
    {
      status: 'READY',
      amount: amount,
      why: cashYieldKnown
        ? 'Keeping this one-time amount in cash preserves liquidity. Saved cash yield is a labeled fact and is not treated as guaranteed.'
        : 'Keeping this one-time amount in cash preserves liquidity. Cash yield is not modeled because no authoritative APY is saved.',
      liquidity: amount > 0.005
        ? 'The amount stays available as cash after the protected reserve and known upcoming expenses.'
        : 'No one-time extra stays above the protected reserve.',
      outcome: cashYieldKnown
        ? ('Cash remains available. Saved cash yield is ' +
          Number(saved.cashYieldPct).toFixed(2) + '% APY.')
        : 'Cash remains available. No growth is modeled (' + cashYieldStatus + ').',
      outcomeKind: 'CASH_LIQUIDITY',
      cashYieldStatus: cashYieldStatus,
      missingAssumption: cashYieldKnown
        ? ''
        : (saved.cashYieldLocation || 'Cash APY is not an authoritative saved fact.')
    }
  );

  var actionKey = 'UNRANKED';
  var actionTitle = 'Cash versus high-APR debt is not ranked';
  var ranked = false;
  var why = 'A one-time extra of ' +
    (typeof fmtCurrency_ === 'function' ? fmtCurrency_(amount) : String(amount)) +
    ' still leaves cash at or above the protected reserve in each of the next 12 months after required payments and known Planned upcoming expenses counted once.';
  if (!(amount > 0.005)) {
    actionKey = 'NONE';
    actionTitle = 'No one-time extra';
    ranked = false;
    why = 'No one-time extra keeps usable cash at or above the protected reserve in every month of the 12-month cash-safety forecast after required payments and known Planned upcoming expenses.';
  } else if (payHighApr.status === 'NOT_APPLICABLE') {
    actionKey = 'KEEP_CASH';
    actionTitle = keepCash.title;
    ranked = true;
    why = payHighApr.why;
  } else if (payHighApr.status === 'CONDITIONAL' || payHighApr.status !== 'READY') {
    actionKey = 'UNRANKED';
    actionTitle = 'Cash versus high-APR debt is not ranked';
    ranked = false;
    why += ' High-APR payoff is not modeled until missing debt facts are saved.';
  } else if (!cashYieldKnown) {
    actionKey = 'UNRANKED';
    actionTitle = 'Cash versus high-APR debt is not ranked';
    ranked = false;
    why += ' Modeled interest if paid to high-APR debt is shown. Cash yield is ' +
      cashYieldStatus +
      ', so this is not ranked as better or worse than keeping the cash.';
  } else {
    var apr = Number(payHighApr.firstTargetApr);
    var apy = Number(saved.cashYieldPct);
    if (isFinite(apr) && apr > apy + 0.005) {
      actionKey = 'PAY_HIGH_APR_DEBT';
      actionTitle = payHighApr.title;
      ranked = true;
      why += ' The first extra target APR of ' + apr.toFixed(2) +
        '% is higher than the saved cash yield of ' + apy.toFixed(2) + '% APY.';
    } else {
      actionKey = 'KEEP_CASH';
      actionTitle = keepCash.title;
      ranked = true;
      why += ' Saved cash yield is not lower than the first extra target APR, so the cash stays unranked as a debt-payoff winner.';
      if (isFinite(apr) && isFinite(apy) && apy + 0.005 >= apr) {
        why = 'The saved cash yield of ' + apy.toFixed(2) +
          '% APY is at least the first extra target APR of ' + apr.toFixed(2) +
          '%, so this one-time extra stays in cash.';
      }
    }
  }

  return {
    state: 'EVALUATED',
    code: amount > 0.005 ? '' : 'NO_HEADROOM',
    evaluated: true,
    persisted: false,
    extraIsAffordable: null,
    amount: amount,
    actionKey: actionKey,
    actionTitle: actionTitle,
    why: why,
    horizonMonths: DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_,
    horizonLabel: DEBT_PAYOFF_ONE_TIME_HORIZON_LABEL_,
    payoffHorizonMonths: horizonMonths,
    tightMonthKey: safety.oneTimeTightMonthKey || '',
    baselineBreachMonthKey: '',
    threeMonthAmount: safety.oneTimeThreeMonthAmount,
    cashYieldKnown: cashYieldKnown,
    cashYieldStatus: cashYieldStatus,
    cashYieldPct: cashYieldKnown ? Number(saved.cashYieldPct) : null,
    ranked: ranked,
    keepCash: keepCash,
    payHighApr: payHighApr,
    missingAssumptions: missingAssumptions,
    assumptions: assumptions
  };
}

function debtPayoffClassifySavedDebtType_(debt) {
  var type = String(debt && debt.type || '').trim().toLowerCase();
  if (type === 'credit card' || type === 'credit cards') return 'creditCards';
  if (type === 'heloc') return 'heloc';
  if (type === 'loan' || type === 'loans' || type === 'mortgage' || type === 'mortgages') {
    return 'loansMortgages';
  }
  return 'otherUnknown';
}

function debtPayoffEmptyMinimumTypeBuckets_() {
  return {
    creditCards: { key: 'creditCards', label: 'Credit Cards', amount: 0, accounts: [] },
    heloc: { key: 'heloc', label: 'HELOC', amount: 0, accounts: [] },
    loansMortgages: {
      key: 'loansMortgages',
      label: 'Loans/Mortgages',
      amount: 0,
      accounts: []
    },
    otherUnknown: { key: 'otherUnknown', label: 'Other/Unknown', amount: 0, accounts: [] }
  };
}

function collectDebtPayoffSupportedMinimums_(debts) {
  var buckets = debtPayoffEmptyMinimumTypeBuckets_();
  var unknownMinimums = [];
  var blockers = [];
  var debtKeys = {};
  var total = 0;
  (debts || []).forEach(function(debt) {
    if (!debt || debt.active === false) return;
    if (!(Number(debt.balance) > 0.005)) return;
    debtKeys[debtPayoffScenarioPayeeKey_(debt.name)] = true;
    debtKeys[debtPayoffScenarioPayeeKey_(debt.originalName)] = true;
    var typeKey = debtPayoffClassifySavedDebtType_(debt);
    var typeLabel = String(debt.type || '').trim() || 'Unknown';
    var name = debt.name || 'A debt';
    if (debt.minimumPaymentKnown === false) {
      blockers.push({
        code: 'MINIMUM_UNKNOWN',
        reason: name + ' has no usable contractual minimum.'
      });
      unknownMinimums.push({
        name: name,
        type: typeLabel,
        typeKey: typeKey,
        amount: null,
        minimumPaymentKnown: false
      });
      return;
    }
    var min = round2_(Math.max(0, Number(debt.minimumPayment) || 0));
    total = round2_(total + min);
    buckets[typeKey].amount = round2_(buckets[typeKey].amount + min);
    buckets[typeKey].accounts.push({
      name: name,
      type: typeLabel,
      amount: min,
      minimumPaymentKnown: true
    });
  });
  var subtotals = [
    buckets.creditCards,
    buckets.heloc,
    buckets.loansMortgages,
    buckets.otherUnknown
  ];
  var recon = 0;
  subtotals.forEach(function(row) {
    recon = round2_(recon + (Number(row.amount) || 0));
  });
  return {
    total: total,
    debtKeys: debtKeys,
    blockers: blockers,
    breakdown: {
      total: total,
      subtotals: subtotals,
      unknownMinimums: unknownMinimums,
      reconciles: recon === total
    }
  };
}

function buildDebtPayoffBreakEvenExplanation_(supported) {
  var extraUntil =
    'recurring commitments are covered and the reserve forecast passes';
  var minByType = supported && supported.debtMinimumsByType || null;
  var safety = supported && supported.cashSafety || null;
  var noSafeLump = !safety || safety.oneTimeAllocationEvaluated !== true ||
    !(Number(safety.oneTimeAmount) > 0.005);
  var empty = {
    state: 'FACTS_MISSING',
    gapToBreakEven: null,
    surplusBeforeReserve: null,
    income: null,
    commitmentsTotal: null,
    categories: [],
    debtMinimumsByType: minByType,
    canIdentifySafeReduction: false,
    doesNotProjectDecliningCardMinimum: true,
    loanExtraDoesNotLowerScheduledPayment: true,
    payingOffRequiresCash: true,
    noSafeLump: noSafeLump,
    extraRemainsZeroUntil: extraUntil
  };
  if (!supported || supported.available !== true) return empty;
  var c = supported.components || {};
  var categories = [];
  var income = null;
  var commitmentsTotal = 0;
  var hasCommitments = false;
  DEBT_PAYOFF_BREAK_EVEN_CATEGORIES_.forEach(function(row) {
    var amount = c[row.key];
    if (amount == null || !isFinite(Number(amount))) return;
    var n = round2_(Number(amount));
    categories.push({
      key: row.key,
      label: row.label,
      kind: row.kind,
      amount: n
    });
    if (row.kind === 'income') {
      income = n;
      return;
    }
    commitmentsTotal = round2_(commitmentsTotal + n);
    hasCommitments = true;
  });
  var surplus = supported.recurringSurplusBeforeReserve;
  var surplusKnown = surplus != null && isFinite(Number(surplus));
  var surplusN = surplusKnown ? round2_(Number(surplus)) : null;
  var deficit = supported.deficit === true ||
    (surplusKnown && surplusN <= 0.005);
  var shared = {
    surplusBeforeReserve: surplusN,
    income: income,
    commitmentsTotal: hasCommitments ? commitmentsTotal : null,
    categories: categories,
    debtMinimumsByType: minByType,
    canIdentifySafeReduction: false,
    doesNotProjectDecliningCardMinimum: true,
    loanExtraDoesNotLowerScheduledPayment: true,
    payingOffRequiresCash: true,
    noSafeLump: noSafeLump,
    extraRemainsZeroUntil: extraUntil
  };
  if (!deficit) {
    return Object.assign({ state: 'BALANCED', gapToBreakEven: 0 }, shared);
  }
  return Object.assign({
    state: 'DEFICIT',
    gapToBreakEven: surplusKnown && surplusN < -0.005
      ? round2_(Math.abs(surplusN))
      : 0
  }, shared);
}

function attachDebtPayoffNextDollar_(rec, normalizedDebts, supported, options) {
  rec = rec || {};
  rec.breakEven = buildDebtPayoffBreakEvenExplanation_(supported);
  rec.oneTimeAllocation = buildDebtPayoffOneTimeAllocation_(
    normalizedDebts, supported, rec, options);
  rec.nextDollar = buildDebtPayoffNextDollarComparison_(
    normalizedDebts, supported, rec, options);
  if (rec.oneTimeAllocation && rec.oneTimeAllocation.evaluated === true) {
    rec.nextDollar.oneTimeAllocationEvaluated = true;
  }
  rec.householdPlan = buildDebtPayoffHouseholdPlan_(normalizedDebts, {
    asOfDate: options && options.asOfDate,
    monthlyExtra: rec.monthlyExtra != null ? rec.monthlyExtra : 0,
    extraIsSafe: rec.state === 'RECOMMENDED',
    reserveBreached: !!(supported && (
      supported.reserveProtects || supported.futureReserveProtects
    )),
    cashSafety: supported && supported.cashSafety,
    recurringSurplusBeforeReserve: supported && supported.recurringSurplusBeforeReserve,
    usableCashAfterBuffers: supported && supported.usableCashAfterBuffers,
    requiredReserveAmount: supported && supported.requiredReserveAmount
  });
  return rec;
}

/**
 * Monthly extra-payoff recommendation from current saved facts.
 * Uses the supported extra estimate only. Never includes Cisco bonuses,
 * never writes, and never treats the estimate as guaranteed affordable.
 */
function buildDebtPayoffMonthlyRecommendation_(normalizedDebts, supported, options) {
  var protection = debtPayoffRecommendationProtection_(supported);
  if (!supported || supported.available !== true) {
    var blockers = (supported && supported.blockers) || [];
    var reasons = blockers.map(function(row) {
      return row && (row.reason || row.code);
    }).filter(function(line) { return !!line; });
    return attachDebtPayoffNextDollar_(
      debtPayoffRecommendationWithhold_(
        'FACTS_MISSING',
        reasons.length
          ? reasons.join(' ')
          : 'A supported monthly extra cannot be proven from current facts. Missing values were not replaced with $0.',
        { reasons: reasons, protection: protection }
      ),
      normalizedDebts, supported, options
    );
  }
  if (supported.reserveProtects) {
    return attachDebtPayoffNextDollar_(
      debtPayoffRecommendationWithhold_(
        'RESERVE_PROTECTS',
        'Usable cash after buffers does not yet cover This Week’s canonical reserve, so no extra debt payment is recommended.',
        { monthlyExtra: 0, protection: protection }
      ),
      normalizedDebts, supported, options
    );
  }
  if (supported.futureReserveProtects) {
    var futureReason = (supported.cashSafety && supported.cashSafety.reason) ||
      'A later month would fall below This Week’s canonical reserve after required payments and known upcoming expenses, so no extra debt payment is recommended.';
    return attachDebtPayoffNextDollar_(
      debtPayoffRecommendationWithhold_(
        'FUTURE_RESERVE_BREACH',
        futureReason,
        { monthlyExtra: 0, protection: protection }
      ),
      normalizedDebts, supported, options
    );
  }
  if (supported.deficit === true || !(Number(supported.amount) > 0.005)) {
    var breakEven = buildDebtPayoffBreakEvenExplanation_(supported);
    var gapPhrase = breakEven && breakEven.gapToBreakEven > 0.005
      ? (' by ' + debtPayoffFormatCashSafetyCurrency_(breakEven.gapToBreakEven))
      : '';
    return attachDebtPayoffNextDollar_(
      debtPayoffRecommendationWithhold_(
        'NO_SURPLUS',
        'Recurring commitments exceed recurring income' + gapPhrase +
          ' after required bills, known debt minimums, and standing floors, so no monthly extra remains.',
        { monthlyExtra: 0, protection: protection, cashSafety: supported.cashSafety || null }
      ),
      normalizedDebts, supported, options
    );
  }
  var comparison = compareDebtPayoffStrategies_(normalizedDebts, supported.amount, {
    asOfDate: options && options.asOfDate,
    bonusEvents: [],
    bonusPlan: { included: false, events: [], assumptions: [] }
  });
  if (!comparison.householdComparisonComplete) {
    var names = (comparison.blockers || []).map(function(row) {
      return (row.name || 'A debt') + ' (' + (row.reason || 'missing inputs') + ')';
    });
    var mortgageNames = (comparison.incompleteMortgages || []).map(function(row) {
      return (row.name || 'A property loan') + ' (' + (row.reason || 'P&I versus escrow is not saved') + ')';
    });
    var incompleteNames = names.concat(mortgageNames);
    return attachDebtPayoffNextDollar_(
      debtPayoffRecommendationWithhold_(
        'HOUSEHOLD_INCOMPLETE',
        incompleteNames.length
          ? ('A household strategy cannot be recommended until these debts have usable payoff inputs: ' +
            incompleteNames.join('; ') + '. Missing values were not replaced with $0 or 0%, and a full mortgage payment was not treated as principal-and-interest.')
          : 'No debts currently have a usable balance, APR, and minimum together.',
        {
          monthlyExtra: supported.amount,
          protection: protection,
          reasons: incompleteNames
        }
      ),
      normalizedDebts, supported, options
    );
  }
  var picked = pickDebtPayoffRecommendedStrategy_(comparison);
  var strategyRow = comparison.strategies[picked.key];
  var why = picked.why;
  if (supported.cashSafety && supported.cashSafety.reduced && supported.cashSafety.reason) {
    why = supported.cashSafety.reason + (why ? ' ' + why : '');
  }
  return attachDebtPayoffNextDollar_({
    state: 'RECOMMENDED',
    code: '',
    reason: '',
    reasons: [],
    monthlyExtra: supported.amount,
    extraIsAffordable: null,
    persisted: false,
    bonusesIncluded: false,
    strategyKey: picked.key,
    strategyTitle: picked.title,
    why: why,
    comparison: comparison,
    firstExtraDebt: (strategyRow.extraPriorityOrder && strategyRow.extraPriorityOrder[0]) || '',
    nextMilestone: (strategyRow.payoffOrder && strategyRow.payoffOrder[0]) || null,
    debtFreeMonthKey: strategyRow.debtFreeMonthKey,
    debtFreeWithinHorizon: strategyRow.debtFreeWithinHorizon === true,
    totalInterest: strategyRow.totalInterest,
    protection: protection,
    cashSafety: supported.cashSafety || null,
    refreshesFromSavedFacts: true
  }, normalizedDebts, supported, options);
}

function debtPayoffSupportedMonthlyExtraUnavailable_(reason) {
  return {
    available: false,
    amount: null,
    label: 'Estimate',
    persisted: false,
    extraIsAffordable: null,
    reserveProtects: false,
    deficit: false,
    source: '',
    blockers: [{
      code: 'UNAVAILABLE',
      reason: String(reason || 'Supported monthly extra cannot be proven.')
    }],
    components: {},
    variableBillEstimates: [],
    variableBillMethod: DEBT_PAYOFF_VARIABLE_BILL_METHOD_,
    assumptions: [
      'A supported monthly extra is an estimate from recurring recorded facts, not This Week’s weekly extra and not a saved payment.'
    ],
    datedBonusScenario: null
  };
}

function debtPayoffScenarioWeeklyToMonthly_(weekly) {
  return round2_(Math.max(0, Number(weekly) || 0) * 52 / 12);
}

function debtPayoffScenarioScheduledToMonthly_(amount, frequency) {
  var occ = {
    weekly: 52, biweekly: 26, semi_monthly: 24, monthly: 12, bimonthly: 6,
    quarterly: 4, semi_annually: 2, yearly: 1
  };
  if (!Object.prototype.hasOwnProperty.call(occ, frequency)) return null;
  return round2_(Math.max(0, Number(amount) || 0) * occ[frequency] / 12);
}

function debtPayoffRawIncomeIsExcluded_(rawPayee) {
  var raw = String(rawPayee || '').trim();
  if (!raw) return true;
  if (typeof incomeIsExcludedName_ === 'function' && incomeIsExcludedName_(raw)) return true;
  var s = raw.toLowerCase();
  return /\bbonus\b|\brefund\b|\brsu\b|\bespp\b|\bstock\s+sale\b|\bdeposit\b|\bother\s+money\b|\bone[\s-]?time\b|\bvariable\b|\birregular\b|\bvaries\b/.test(s);
}

/**
 * Recurring Yes / No / blank-unknown. Blank is unknown, never No.
 * Do not use normalizeYesNo_, which maps empty cells to no.
 */
function debtPayoffParseRecurringStatus_(value) {
  var text = String(value == null ? '' : value).replace(/\u00A0/g, ' ').trim();
  if (!text) return 'unknown';
  var v = text.toLowerCase();
  if (v === 'yes' || v === 'y' || v === 'true') return 'yes';
  if (v === 'no' || v === 'n' || v === 'false') return 'no';
  return 'unknown';
}

function debtPayoffIncomeGroupKey_(rawPayee) {
  if (typeof normalizeIncomeName_ === 'function') {
    var normalized = normalizeIncomeName_(rawPayee);
    if (normalized) return String(normalized).toLowerCase();
  }
  return String(rawPayee || '').trim().toLowerCase();
}

function debtPayoffIncomeForecastMissingFields_(row) {
  var missing = [];
  if (!row || row.recurringStatus === 'unknown') missing.push('Recurring');
  if (row && row.recurringStatus === 'yes') {
    if (row.frequency === 'unknown') missing.push('Frequency');
    if (row.amountKnown !== true) missing.push('Expected Amount');
  }
  return missing;
}

function debtPayoffFormatIncompleteIncomeRows_(rows) {
  return (rows || []).map(function(row) {
    var missing = (row.missing && row.missing.length)
      ? row.missing.join(', ')
      : 'Recurring, Frequency, or Expected Amount';
    var location = 'Cash Flow row ' + row.sheetRow;
    if (row.rawPayees && row.rawPayees.length > 1) {
      location = 'Manage Income group; history rows ' + row.rawPayees.join(', ');
    }
    return (row.payee || 'Income') +
      ' (' + location + ') needs ' + missing + '.';
  }).join(' ');
}

function debtPayoffForecastFingerprint_(row) {
  if (!row || row.recurringStatus !== 'yes') return '';
  var amount = row.amountKnown === true ? round2_(Number(row.expectedAmount) || 0) : '';
  return row.frequency + '|' + String(amount);
}

/**
 * One Manage Income group is one forecast. Multiple Cash Flow history rows
 * that share Recurring/Frequency/Expected Amount are counted once.
 */
function debtPayoffCollapseGroupForecast_(group) {
  group = group || { displayName: '', rows: [] };
  var excludedHits = [];
  var kept = [];
  (group.rows || []).forEach(function(row) {
    if (row.excluded) excludedHits.push(row.rawPayee);
    else kept.push(row);
  });
  var rawPayees = (group.rows || []).map(function(row) { return row.rawPayee; });
  if (excludedHits.length && kept.length) {
    return {
      mixed: true,
      source: {
        name: group.displayName,
        rawPayees: rawPayees,
        recurringConfirmed: false,
        cadenceKnown: false,
        frequency: 'unknown',
        expectedAmount: null,
        amountKnown: false
      }
    };
  }
  if (excludedHits.length && !kept.length) return { skip: true };

  var completeYes = [];
  var incomplete = [];
  kept.forEach(function(row) {
    if (row.recurringStatus === 'no') return;
    var missing = debtPayoffIncomeForecastMissingFields_(row);
    if (missing.length) incomplete.push({
      sheetRow: row.sheetRow,
      payee: group.displayName,
      rawPayees: kept.map(function(item) { return item.rawPayee; }),
      missing: missing
    });
    else if (row.recurringStatus === 'yes') completeYes.push(row);
  });

  if (completeYes.length) {
    var fingerprints = {};
    completeYes.forEach(function(row) {
      fingerprints[debtPayoffForecastFingerprint_(row)] = row;
    });
    var keys = Object.keys(fingerprints);
    if (keys.length > 1) {
      return {
        incomplete: [{
          sheetRow: completeYes[0].sheetRow,
          payee: group.displayName,
          rawPayees: kept.map(function(item) { return item.rawPayee; }),
          missing: ['matching Recurring, Frequency, and Expected Amount']
        }]
      };
    }
    var chosen = fingerprints[keys[0]];
    return {
      source: {
        name: group.displayName,
        rawPayee: chosen.rawPayee,
        rawPayees: kept.map(function(item) { return item.rawPayee; }),
        historyRowCount: kept.length,
        recurringConfirmed: true,
        cadenceKnown: chosen.frequency !== 'unknown',
        frequency: chosen.frequency,
        expectedAmount: chosen.amountKnown ? chosen.expectedAmount : null,
        amountKnown: chosen.amountKnown === true
      }
    };
  }
  if (incomplete.length) return { incomplete: [incomplete[0]] };
  return { skip: true };
}

function debtPayoffClassifySupportedIncomeSource_(sourceRow) {
  sourceRow = sourceRow || {};
  var rawPayees = sourceRow.rawPayees && sourceRow.rawPayees.length
    ? sourceRow.rawPayees
    : [sourceRow.rawPayee || sourceRow.name];
  var excludedHits = [];
  var kept = [];
  rawPayees.forEach(function(raw) {
    if (debtPayoffRawIncomeIsExcluded_(raw)) excludedHits.push(raw);
    else kept.push(raw);
  });
  if (excludedHits.length && kept.length) {
    return {
      skip: false,
      blocker: {
        code: 'INCOME_EXCLUDED_IDENTITY_MIXED',
        reason: 'A normalized income group mixes excluded raw payees (' +
          excludedHits.join(', ') +
          ') with other sources. Recurrence was not inferred from the combined name.'
      }
    };
  }
  if (excludedHits.length && !kept.length) return { skip: true };
  var label = kept[0] || sourceRow.name || 'An income source';
  if (sourceRow.inferredFromPositiveMonths || sourceRow.dropsZeroMonths) {
    return {
      skip: false,
      blocker: {
        code: 'INCOME_CADENCE_UNCONFIRMED',
        reason: label +
          ' cannot use a non-zero-month average as a recurring monthly amount.'
      }
    };
  }
  if (sourceRow.recurringConfirmed !== true) {
    return {
      skip: false,
      blocker: {
        code: 'INCOME_CADENCE_UNCONFIRMED',
        reason: label +
          ' has no explicit Recurring=Yes confirmation on Cash Flow. Recurrence was not inferred from month values.'
      }
    };
  }
  if (sourceRow.amountKnown === false) {
    return {
      skip: false,
      blocker: {
        code: 'INCOME_AMOUNT_UNKNOWN',
        reason: label +
          ' has a blank Expected Amount. Explicit 0 is allowed; blank was not treated as $0.'
      }
    };
  }
  var scheduled = sourceRow.expectedAmount != null
    ? sourceRow.expectedAmount
    : sourceRow.monthlyAmount;
  var monthly = debtPayoffScenarioScheduledToMonthly_(scheduled, sourceRow.frequency);
  if (monthly == null) {
    return {
      skip: false,
      blocker: {
        code: 'INCOME_FREQUENCY_UNKNOWN',
        reason: label + ' has no usable Frequency, so a monthly amount was not assumed.'
      }
    };
  }
  return { skip: false, monthlyAmount: monthly, name: label };
}

function buildDebtPayoffCashPicture_(parts) {
  parts = parts || {};
  var c = parts.components || {};
  var income = round2_(Number(c.recurringIncomeMonthly) || 0);
  var required = round2_(Number(c.recurringBillsMonthly) || 0);
  var variable = round2_(Number(c.variableBillsMonthly) || 0);
  var debts = round2_(Number(c.debtMinimumsMonthly) || 0);
  var floors = round2_(Number(c.policyFloorMonthly) || 0);
  var otherInv = round2_(Number(c.unmatchedInvestmentBillsMonthly) || 0);
  var householdBills = round2_(required + variable);
  var investments = round2_(floors + otherInv);
  var surplus = parts.surplus != null && isFinite(Number(parts.surplus))
    ? round2_(Number(parts.surplus))
    : round2_(income - householdBills - debts - investments);
  var minByType = parts.debtMinimumsByType || null;
  var typeMap = {};
  ((minByType && minByType.subtotals) || []).forEach(function(bucket) {
    if (bucket && bucket.key) typeMap[bucket.key] = bucket;
  });
  var credit = typeMap.creditCards || { amount: 0, accounts: [], label: 'Credit Cards' };
  var heloc = typeMap.heloc || { amount: 0, accounts: [], label: 'HELOC' };
  var loans = typeMap.loansMortgages || { amount: 0, accounts: [], label: 'Loans/Mortgages' };
  var otherDebt = typeMap.otherUnknown || { amount: 0, accounts: [], label: 'Other/Unknown' };
  return {
    income: {
      label: 'Income',
      total: income,
      sources: parts.incomeSources || []
    },
    householdBills: {
      label: 'Household bills',
      total: householdBills,
      required: required,
      variable: variable,
      requiredSources: parts.requiredBillSources || [],
      variableSources: parts.variableBillEstimates || []
    },
    debtPayments: {
      label: 'Debt payments',
      total: debts,
      creditCards: round2_(Number(credit.amount) || 0),
      heloc: round2_(Number(heloc.amount) || 0),
      loansMortgages: round2_(Number(loans.amount) || 0),
      otherUnknown: round2_(Number(otherDebt.amount) || 0),
      unknownMinimums: (minByType && minByType.unknownMinimums) || [],
      accounts: [].concat(
        credit.accounts || [],
        heloc.accounts || [],
        loans.accounts || [],
        otherDebt.accounts || []
      )
    },
    investments: {
      label: 'Investment commitments',
      total: investments,
      policyFloors: floors,
      otherBills: otherInv,
      policyFloorSources: parts.policyFloorSources || [],
      otherBillSources: parts.unmatchedInvestmentBillSources || []
    },
    shortfall: surplus < -0.005 ? round2_(Math.abs(surplus)) : 0,
    surplus: surplus,
    hypotheticalAdjustments: parts.hypotheticalAdjustments || null
  };
}

function debtPayoffReserveFromCanonicalForecast_(forecast) {
  if (!forecast || typeof forecast !== 'object') {
    return {
      ok: false,
      amount: null,
      reason: 'This Week’s canonical reserve packet is missing.'
    };
  }
  if (forecast.futureUpcomingAmount == null ||
      forecast.propertyContingencyAmount == null ||
      forecast.requiredReserveAmount == null) {
    return {
      ok: false,
      amount: null,
      reason: 'The canonical reserve is missing upcoming expenses or property contingency, so it was not replaced with a bills-only proxy.'
    };
  }
  var amount = Number(forecast.requiredReserveAmount);
  if (!isFinite(amount)) {
    return {
      ok: false,
      amount: null,
      reason: 'The canonical reserve amount could not be proven.'
    };
  }
  return {
    ok: true,
    amount: round2_(amount),
    reason: '',
    breakdown: {
      futureBillsAmount: round2_(Number(forecast.futureBillsAmount) || 0),
      futureDebtMinimumsAmount: round2_(Number(forecast.futureDebtMinimumsAmount) || 0),
      futureUpcomingAmount: round2_(Number(forecast.futureUpcomingAmount) || 0),
      propertyContingencyAmount: round2_(Number(forecast.propertyContingencyAmount) || 0)
    }
  };
}

function debtPayoffScenarioPayeeKey_(name) {
  if (typeof normalizeBillName_ === 'function') {
    return normalizeBillName_(name);
  }
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function debtPayoffBillIsVaries_(bill) {
  return String(bill && bill.varies || '').trim().toLowerCase() === 'yes';
}

function debtPayoffPadMonthKey_(year, month) {
  var mm = Number(month);
  return String(year) + '-' + (mm < 10 ? '0' + mm : String(mm));
}

function debtPayoffYtdCompletedMonthKeys_(asOfDate) {
  var asOf = asOfDate instanceof Date && !isNaN(asOfDate.getTime()) ? asOfDate : new Date();
  var completed = asOf.getMonth();
  var keys = [];
  for (var m = 1; m <= completed; m++) {
    keys.push(debtPayoffPadMonthKey_(asOf.getFullYear(), m));
  }
  return keys;
}

function debtPayoffLatestCompleteMonthKeys_(asOfDate) {
  return debtPayoffYtdCompletedMonthKeys_(asOfDate);
}

function debtPayoffMonthKeyFromHeader_(header) {
  if (typeof parseMonthHeader_ !== 'function') return '';
  var parsed = parseMonthHeader_(header);
  if (!(parsed instanceof Date) || isNaN(parsed.getTime())) return '';
  return debtPayoffPadMonthKey_(parsed.getFullYear(), parsed.getMonth() + 1);
}

function debtPayoffFindCashFlowMonthColumn_(headerRow, monthKey) {
  headerRow = headerRow || [];
  for (var c = 0; c < headerRow.length; c++) {
    if (debtPayoffMonthKeyFromHeader_(headerRow[c]) === monthKey) return c;
  }
  return -1;
}

function debtPayoffParseKnownCashFlowSpend_(raw, display) {
  var signed = null;
  if (typeof raw === 'number' && isFinite(raw)) {
    signed = raw;
  } else {
    var text = String(display == null ? '' : display).replace(/\u00A0/g, ' ').trim();
    if (!text) text = String(raw == null ? '' : raw).replace(/\u00A0/g, ' ').trim();
    if (!text) return { known: false, signed: null, cost: null };
    var sign = 1;
    if (/^\(.*\)$/.test(text)) {
      sign = -1;
      text = text.slice(1, -1);
    }
    var normalized = text.replace(/[$,]/g, '').replace(/[—–]/g, '-').trim();
    if (!normalized || normalized === '-') return { known: false, signed: null, cost: null };
    var n = Number(normalized);
    if (!isFinite(n)) return { known: false, signed: null, cost: null };
    signed = n * sign;
  }
  signed = round2_(signed);
  return {
    known: true,
    signed: signed,
    cost: round2_(-signed)
  };
}

function debtPayoffMatchCashFlowExpenseRow_(display, payee) {
  var name = String(payee || '').trim() || 'A variable bill';
  display = display || [];
  if (!display.length) {
    return {
      ok: false,
      code: 'VARIABLE_BILL_MATCH_MISSING',
      reason: name + ' has no Cash Flow Expense row to match.'
    };
  }
  var headers = (display[0] || []).map(function(value) {
    return String(value || '').trim().toLowerCase();
  });
  var typeCol = headers.indexOf('type');
  var payeeCol = headers.indexOf('payee');
  if (typeCol === -1 || payeeCol === -1) {
    return {
      ok: false,
      code: 'VARIABLE_BILL_HISTORY_INCOMPLETE',
      reason: name + ' cannot be estimated because Cash Flow Type and Payee headers are missing.'
    };
  }
  var want = debtPayoffScenarioPayeeKey_(name);
  var matches = [];
  for (var r = 1; r < display.length; r++) {
    if (String(display[r][typeCol] || '').trim().toLowerCase() !== 'expense') continue;
    var rowPayee = String(display[r][payeeCol] || '').trim();
    if (!rowPayee) continue;
    if (debtPayoffScenarioPayeeKey_(rowPayee) === want) matches.push(r);
  }
  if (!matches.length) {
    return {
      ok: false,
      code: 'VARIABLE_BILL_MATCH_MISSING',
      reason: name + ' has no unambiguous Cash Flow Expense match for the YTD completed months.'
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      code: 'VARIABLE_BILL_MATCH_AMBIGUOUS',
      reason: name + ' matches ' + matches.length +
        ' Cash Flow Expense rows, so spending was not assigned.'
    };
  }
  return { ok: true, row: matches[0] };
}

function estimateDebtPayoffVariableBillHistory_(payee, monthKeys, sheetsByYear, missingYears) {
  missingYears = missingYears || [];
  monthKeys = monthKeys || [];
  var name = String(payee || '').trim() || 'A variable bill';
  if (!monthKeys.length) {
    return {
      ok: false,
      code: 'VARIABLE_BILL_HISTORY_INCOMPLETE',
      reason: name + ' has no completed Cash Flow month yet this year, so a YTD running average was not used.'
    };
  }
  var periodStart = monthKeys[0];
  var periodEnd = monthKeys[monthKeys.length - 1];
  var completedMonthCount = monthKeys.length;
  if (missingYears.length) {
    return {
      ok: false,
      code: 'VARIABLE_BILL_HISTORY_INCOMPLETE',
      reason: name + ' cannot be estimated because Cash Flow ' +
        missingYears.join(', ') + ' is missing for ' + periodStart +
        ' through ' + periodEnd + '.'
    };
  }
  var ytdTotal = 0;
  var explicitZeroMonthCount = 0;
  var creditMonthCount = 0;
  var rowByYear = {};
  for (var i = 0; i < monthKeys.length; i++) {
    var key = monthKeys[i];
    var year = Number(String(key).slice(0, 4));
    var sheet = sheetsByYear && sheetsByYear[year];
    if (!sheet || !sheet.display || !sheet.display.length) {
      return {
        ok: false,
        code: 'VARIABLE_BILL_HISTORY_INCOMPLETE',
        reason: name + ' cannot be estimated because Cash Flow ' + year +
          ' is missing for ' + periodStart + ' through ' + periodEnd + '.'
      };
    }
    if (!Object.prototype.hasOwnProperty.call(rowByYear, year)) {
      var match = debtPayoffMatchCashFlowExpenseRow_(sheet.display, name);
      if (!match.ok) return match;
      rowByYear[year] = match.row;
    }
    var col = debtPayoffFindCashFlowMonthColumn_(sheet.display[0], key);
    if (col < 0) {
      return {
        ok: false,
        code: 'VARIABLE_BILL_HISTORY_INCOMPLETE',
        reason: name + ' is missing Cash Flow month ' + key +
          ' on INPUT - Cash Flow ' + year + '.'
      };
    }
    var values = sheet.values || sheet.display;
    var cell = debtPayoffParseKnownCashFlowSpend_(
      values[rowByYear[year]] && values[rowByYear[year]][col],
      sheet.display[rowByYear[year]] && sheet.display[rowByYear[year]][col]
    );
    if (!cell.known) {
      return {
        ok: false,
        code: 'VARIABLE_BILL_HISTORY_INCOMPLETE',
        reason: name + ' has a blank or missing Cash Flow amount in ' + key +
          '. Blank months are unknown and were not treated as $0 or omitted from the YTD denominator. Default Amount was not used as a forecast.'
      };
    }
    var cost = Number(cell.cost);
    if (!isFinite(cost)) {
      return {
        ok: false,
        code: 'VARIABLE_BILL_SIGN_AMBIGUOUS',
        reason: name + ' has a Cash Flow amount in ' + key +
          ' whose sign cannot be used. Expense actuals are stored negative; that cell was not converted with an absolute value.'
      };
    }
    if (Number(cell.signed) > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) creditMonthCount++;
    if (cost <= DEBT_PAYOFF_SCENARIO_ZERO_BAL_ && cost >= -DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
      explicitZeroMonthCount++;
    }
    ytdTotal = round2_(ytdTotal + cost);
  }
  if (ytdTotal < -DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
    return {
      ok: false,
      code: 'VARIABLE_BILL_SIGN_AMBIGUOUS',
      reason: name + ' nets to a YTD credit after documented Expense signs. That amount was not treated as spending and was not converted with an absolute value.'
    };
  }
  return {
    ok: true,
    periodStart: periodStart,
    periodEnd: periodEnd,
    ytdTotal: round2_(ytdTotal),
    completedMonthCount: completedMonthCount,
    monthlyEquivalent: round2_(ytdTotal / completedMonthCount),
    knownMonthCount: completedMonthCount,
    blankMonthCount: 0,
    explicitZeroMonthCount: explicitZeroMonthCount,
    creditMonthCount: creditMonthCount,
    label: 'YTD running average'
  };
}

function debtPayoffTryCashFlowSheet_(ss, year) {
  if (typeof tryGetCashFlowSheet_ === 'function') {
    return tryGetCashFlowSheet_(ss, year);
  }
  try {
    if (typeof getCashFlowSheet_ === 'function') return getCashFlowSheet_(ss, year);
  } catch (e) { /* read-only: missing year withholds the estimate */ }
  try {
    var prefix = (typeof getSheetNames_ === 'function' && getSheetNames_().CASH_FLOW_PREFIX) ||
      'INPUT - Cash Flow ';
    return ss.getSheetByName(prefix + String(year));
  } catch (e2) {
    return null;
  }
}

/**
 * Read-only. Never self-heal schema or write Cash Flow / Bills cells here.
 */
function attachDebtPayoffVariableBillHistory_(ss, bills, asOfDate) {
  var needed = false;
  (bills || []).forEach(function(bill) {
    if (bill && bill.active !== false && debtPayoffBillIsVaries_(bill)) needed = true;
  });
  if (!needed) return bills;
  var monthKeys = debtPayoffYtdCompletedMonthKeys_(asOfDate);
  var yearSeen = {};
  var missingYears = [];
  var sheetsByYear = {};
  monthKeys.forEach(function(key) {
    yearSeen[Number(String(key).slice(0, 4))] = true;
  });
  Object.keys(yearSeen).forEach(function(year) {
    var sheet = debtPayoffTryCashFlowSheet_(ss, year);
    if (!sheet) {
      missingYears.push(year);
      return;
    }
    var range = sheet.getDataRange();
    sheetsByYear[year] = {
      display: range.getDisplayValues(),
      values: range.getValues()
    };
  });
  (bills || []).forEach(function(bill) {
    if (!bill || bill.active === false || !debtPayoffBillIsVaries_(bill)) return;
    bill.variableHistory = estimateDebtPayoffVariableBillHistory_(
      bill.payee || bill.name, monthKeys, sheetsByYear, missingYears);
  });
  return bills;
}

function debtPayoffCashSafetyMoneyLabel_(amount) {
  var n = Number(amount);
  if (!isFinite(n)) return 'an unknown amount';
  return '$' + round2_(n).toFixed(2);
}

function debtPayoffFormatCashSafetyCurrency_(amount) {
  var n = Number(amount);
  if (!isFinite(n)) return 'an unknown amount';
  var text = Math.abs(round2_(n)).toFixed(2);
  var dot = text.indexOf('.');
  var whole = text.substring(0, dot);
  var frac = text.substring(dot);
  var grouped = '';
  while (whole.length > 3) {
    grouped = ',' + whole.slice(-3) + grouped;
    whole = whole.slice(0, -3);
  }
  return '$' + whole + grouped + frac;
}

function debtPayoffCashSafetyNamedObligation_(label) {
  var text = String(label || '').trim();
  if (!text || text === 'required payments and the protected reserve') return '';
  return text;
}

function debtPayoffCashSafetySurplusContinuation_(surplus) {
  var n = Number(surplus);
  if (!isFinite(n)) {
    return 'after the current recurring surplus of an unknown amount continues';
  }
  if (n < -0.005) {
    return 'as the monthly deficit of ' +
      debtPayoffFormatCashSafetyCurrency_(n) + ' continues';
  }
  return 'after the current recurring surplus of ' +
    debtPayoffCashSafetyMoneyLabel_(n) + ' continues';
}

function debtPayoffIsoDateFromSheetValue_(raw, display) {
  if (Object.prototype.toString.call(raw) === '[object Date]' &&
      !isNaN(raw.getTime())) {
    return debtPayoffPadMonthKey_(raw.getFullYear(), raw.getMonth() + 1).slice(0, 7) +
      '-' + (raw.getDate() < 10 ? '0' + raw.getDate() : String(raw.getDate()));
  }
  var text = String(
    display == null || String(display).replace(/\u00A0/g, ' ').trim() === ''
      ? (raw == null ? '' : raw)
      : display
  ).replace(/\u00A0/g, ' ').trim();
  if (!text) return '';
  var iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3];
  if (typeof parseSheetDateToIso_ === 'function') {
    return parseSheetDateToIso_(raw) || parseSheetDateToIso_(text) || '';
  }
  return '';
}

function debtPayoffIsoDateIsValid_(iso) {
  var match = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  if (!isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return false;
  var dt = new Date(year, month - 1, day);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

function debtPayoffMonthKeyFromIsoDate_(iso) {
  if (!debtPayoffIsoDateIsValid_(iso)) return '';
  var match = String(iso || '').trim().match(/^(\d{4})-(\d{2})/);
  return match ? match[1] + '-' + match[2] : '';
}

function debtPayoffIsoDaysFromAsOf_(asOfDate, iso) {
  if (!(asOfDate instanceof Date) || isNaN(asOfDate.getTime())) return null;
  if (!debtPayoffIsoDateIsValid_(iso)) return null;
  var start = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate());
  var parts = String(iso).split('-');
  var due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return Math.round((due.getTime() - start.getTime()) / 86400000);
}

function debtPayoffUpcomingCountedInCanonicalReserve_(asOfDate, iso) {
  var days = debtPayoffIsoDaysFromAsOf_(asOfDate, iso);
  if (days == null || days <= 7) return false;
  var horizonEnd = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate() + 89);
  var parts = String(iso).split('-');
  var due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return due.getTime() <= horizonEnd.getTime();
}

function debtPayoffCashSafetyReserveFloor_(requiredReserve, reserveUpcomingAmount) {
  var reserve = round2_(Number(requiredReserve));
  if (!isFinite(reserve)) return null;
  var upcomingInReserve = 0;
  if (reserveUpcomingAmount != null && isFinite(Number(reserveUpcomingAmount))) {
    upcomingInReserve = Math.max(0, round2_(Number(reserveUpcomingAmount)));
  }
  return round2_(Math.max(0, reserve - upcomingInReserve));
}

function debtPayoffUpcomingAmountIsKnown_(raw, display) {
  if (typeof debtMinimumPaymentCellIsKnown_ === 'function') {
    return debtMinimumPaymentCellIsKnown_(raw, display) === true;
  }
  if (typeof raw === 'number' && isFinite(raw)) return true;
  var displayText = String(display == null ? '' : display).replace(/\u00A0/g, ' ').trim();
  if (displayText) return true;
  return String(raw == null ? '' : raw).replace(/\u00A0/g, ' ').trim() !== '';
}

function debtPayoffUpcomingStatusIsActive_(status) {
  var key = String(status || '').trim().toLowerCase();
  return key !== 'paid' && key !== 'dismissed' && key !== 'skipped';
}

/**
 * Read-only Planned upcoming rows. Does not create the sheet, skip the next
 * 7 days, or treat a blank date or amount as $0.
 */
function readDebtPayoffUpcomingObligations_(ss) {
  if (!ss || typeof ss.getSheetByName !== 'function') {
    return {
      ok: false,
      reason: 'INPUT - Upcoming Expenses could not be read, so dated upcoming obligations were not treated as $0. Update ' +
        DEBT_PAYOFF_CASH_SAFETY_LOCATION_ + '.',
      location: DEBT_PAYOFF_CASH_SAFETY_LOCATION_,
      rows: []
    };
  }
  var sheet = ss.getSheetByName('INPUT - Upcoming Expenses');
  if (!sheet) return { ok: true, missingSheet: true, rows: [] };
  var range = sheet.getDataRange();
  var values = range.getValues();
  var display = range.getDisplayValues();
  if (!display || display.length < 2) return { ok: true, rows: [] };
  var headers = (display[0] || []).map(function(value) {
    return String(value || '').trim();
  });
  var nameCol = headers.indexOf('Expense Name');
  var dateCol = headers.indexOf('Due Date');
  var amountCol = headers.indexOf('Amount');
  var statusCol = headers.indexOf('Status');
  var payeeCol = headers.indexOf('Payee');
  if (dateCol === -1 || amountCol === -1) {
    return {
      ok: false,
      reason: 'INPUT - Upcoming Expenses is missing Due Date or Amount, so dated obligations were not treated as $0. Update ' +
        DEBT_PAYOFF_CASH_SAFETY_LOCATION_ + '.',
      location: DEBT_PAYOFF_CASH_SAFETY_LOCATION_,
      rows: []
    };
  }
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var name = nameCol === -1 ? '' : String(display[r][nameCol] || '').trim();
    var payee = payeeCol === -1 ? '' : String(display[r][payeeCol] || '').trim();
    var status = statusCol === -1 ? 'Planned' : String(display[r][statusCol] || '').trim() || 'Planned';
    if (!name && !payee) continue;
    if (!debtPayoffUpcomingStatusIsActive_(status)) continue;
    var dueDate = debtPayoffIsoDateFromSheetValue_(values[r][dateCol], display[r][dateCol]);
    if (dueDate && !debtPayoffIsoDateIsValid_(dueDate)) dueDate = '';
    var amountKnown = debtPayoffUpcomingAmountIsKnown_(values[r][amountCol], display[r][amountCol]);
    var amount = 0;
    if (amountKnown) {
      var parsed = debtPayoffParseKnownCashFlowSpend_(values[r][amountCol], display[r][amountCol]);
      if (!parsed.known) {
        amountKnown = false;
      } else {
        amount = round2_(Math.abs(Number(parsed.signed)));
      }
    }
    rows.push({
      name: name || payee || 'Upcoming expense',
      payee: payee,
      status: status,
      dueDate: dueDate,
      dueDateKnown: !!dueDate,
      amount: amountKnown ? amount : null,
      amountKnown: amountKnown === true
    });
  }
  return { ok: true, rows: rows };
}

function debtPayoffCashSafetyObligationLabel_(month) {
  var rows = (month && month.obligations) || [];
  if (!rows.length) return 'required payments and the protected reserve';
  return rows.map(function(row) {
    return (row.name || 'Upcoming expense') + ' (' +
      debtPayoffCashSafetyMoneyLabel_(row.amount) + ')';
  }).join('; ');
}

function debtPayoffBuildCashSafetyMonths_(asOfDate, horizonMonths, upcomingExpenses) {
  var months = [];
  var keyIndex = {};
  var m;
  for (m = 1; m <= horizonMonths; m++) {
    var key = debtPayoffScenarioMonthKey_(asOfDate, m);
    keyIndex[key] = m - 1;
    months.push({
      key: key,
      upcomingAmount: 0,
      obligations: []
    });
  }
  var firstKey = months[0] && months[0].key;
  var lastKey = months[months.length - 1] && months[months.length - 1].key;
  (upcomingExpenses || []).forEach(function(row) {
    if (!row || row.dueDateKnown !== true || row.amountKnown !== true) return;
    var monthKey = debtPayoffMonthKeyFromIsoDate_(row.dueDate);
    if (!monthKey) return;
    if (lastKey && monthKey > lastKey) return;
    var idx = Object.prototype.hasOwnProperty.call(keyIndex, monthKey)
      ? keyIndex[monthKey]
      : 0;
    if (firstKey && monthKey < firstKey) idx = 0;
    if (idx == null || !months[idx]) return;
    var amount = round2_(Math.max(0, Number(row.amount) || 0));
    if (!(amount > 0.005)) return;
    months[idx].upcomingAmount = round2_(months[idx].upcomingAmount + amount);
    months[idx].obligations.push({
      name: row.name || 'Upcoming expense',
      amount: amount,
      dueDate: row.dueDate,
      monthKey: months[idx].key,
      inCanonicalReserve: debtPayoffUpcomingCountedInCanonicalReserve_(asOfDate, row.dueDate)
    });
  });
  return months;
}

function debtPayoffListOutsideHorizonUpcoming_(asOfDate, horizonMonths, upcomingExpenses) {
  var lastKey = debtPayoffScenarioMonthKey_(asOfDate, horizonMonths);
  var rows = [];
  (upcomingExpenses || []).forEach(function(row) {
    if (!row || row.dueDateKnown !== true || !debtPayoffIsoDateIsValid_(row.dueDate)) return;
    var monthKey = debtPayoffMonthKeyFromIsoDate_(row.dueDate);
    if (!monthKey || !lastKey || monthKey <= lastKey) return;
    rows.push({
      name: row.name || 'Upcoming expense',
      dueDate: row.dueDate,
      amountKnown: row.amountKnown === true,
      amount: row.amountKnown === true ? round2_(Number(row.amount) || 0) : null
    });
  });
  return rows;
}

function debtPayoffListInWindowUpcoming_(months) {
  var rows = [];
  (months || []).forEach(function(month) {
    (month.obligations || []).forEach(function(row) {
      rows.push({
        name: row.name || 'Upcoming expense',
        dueDate: row.dueDate || '',
        monthKey: month.key,
        amount: round2_(Number(row.amount) || 0),
        inCanonicalReserve: row.inCanonicalReserve === true
      });
    });
  });
  return rows;
}

function debtPayoffIdentifyUpcomingDiscrepancy_(inWindow, inWindowTotal, reserveUpcomingAmount) {
  var rows = inWindow || [];
  var inReserveTotal = round2_(rows.reduce(function(sum, row) {
    return row && row.inCanonicalReserve === true
      ? sum + (Number(row.amount) || 0)
      : sum;
  }, 0));
  var lump = round2_(Math.max(0, Number(reserveUpcomingAmount) || 0));
  var walkVsLump = round2_(inWindowTotal - lump);
  var rowsVsLump = round2_(inReserveTotal - lump);
  var hasDiscrepancy = Math.abs(walkVsLump) > 0.005 || Math.abs(rowsVsLump) > 0.005;
  var identifiedRow = null;
  if (hasDiscrepancy && Math.abs(walkVsLump) > 0.005) {
    var matches = rows.filter(function(row) {
      return row && row.inCanonicalReserve !== true &&
        Math.abs(round2_(Number(row.amount) || 0) - walkVsLump) <= 0.005;
    });
    if (matches.length === 1) {
      identifiedRow = {
        name: matches[0].name || 'Upcoming expense',
        dueDate: matches[0].dueDate || '',
        amount: round2_(matches[0].amount),
        inCanonicalReserve: false
      };
    }
  }
  var label = '';
  if (hasDiscrepancy) {
    var gapLabel = debtPayoffCashSafetyMoneyLabel_(Math.abs(walkVsLump));
    if (identifiedRow) {
      label = 'The ' + gapLabel + ' difference is ' + identifiedRow.name +
        (identifiedRow.dueDate ? ' due ' + identifiedRow.dueDate : '') +
        ', which is in the 3-month check but not in This Week’s canonical reserve window (days 8–90).';
    } else {
      label = 'The 3-month check counts ' +
        debtPayoffCashSafetyMoneyLabel_(inWindowTotal) +
        ' from saved Upcoming rows. This Week’s reserve upcoming is ' +
        debtPayoffCashSafetyMoneyLabel_(lump) +
        '. The ' + gapLabel +
        ' difference is not identified as a specific Upcoming row.';
    }
  }
  return {
    hasDiscrepancy: hasDiscrepancy,
    walkVsLump: walkVsLump,
    rowsVsLump: rowsVsLump,
    inCanonicalReserveTotal: inReserveTotal,
    identifiedRow: identifiedRow,
    label: label
  };
}

function debtPayoffBuildCashSafetyReconciliation_(input) {
  input = input || {};
  var inWindow = input.inWindowUpcoming || [];
  var inWindowTotal = round2_(inWindow.reduce(function(sum, row) {
    return sum + (Number(row.amount) || 0);
  }, 0));
  var startingCash = round2_(input.startingCash);
  var endingCash = round2_(input.endingCash);
  var surplusApplied = round2_(endingCash - startingCash + inWindowTotal);
  var floor = round2_(input.protectedReserveFloor);
  var remaining = round2_(input.remainingAboveReserve);
  var lump = input.reserveUpcomingAmount == null
    ? 0
    : round2_(Math.max(0, Number(input.reserveUpcomingAmount) || 0));
  var discrepancy = debtPayoffIdentifyUpcomingDiscrepancy_(inWindow, inWindowTotal, lump);
  return {
    startingCash: startingCash,
    recurringSurplusMonthly: round2_(input.surplus),
    surplusApplied: surplusApplied,
    inWindowUpcoming: inWindow,
    inWindowUpcomingTotal: inWindowTotal,
    canonicalReserve: round2_(input.canonicalReserve),
    reserveUpcomingAmount: lump,
    inCanonicalReserveTotal: discrepancy.inCanonicalReserveTotal,
    protectedReserveFloor: floor,
    endingCash: endingCash,
    remainingAboveReserve: remaining,
    discrepancy: discrepancy,
    cashIdentityOk: Math.abs(
      round2_(startingCash + surplusApplied - inWindowTotal) - endingCash) <= 0.005,
    reserveIdentityOk: Math.abs(
      round2_(round2_(input.canonicalReserve) - lump) - floor) <= 0.005,
    remainingIdentityOk: Math.abs(round2_(endingCash - floor) - remaining) <= 0.005
  };
}

function debtPayoffOutsideHorizonLabel_(rows) {
  if (!rows || !rows.length) return '';
  return rows.map(function(row) {
    var amountText = row.amountKnown === true
      ? debtPayoffCashSafetyMoneyLabel_(row.amount)
      : 'amount unknown';
    return (row.name || 'Upcoming expense') + ' (due ' + row.dueDate + ', ' + amountText + ')';
  }).join('; ');
}

function debtPayoffWalkCashSafety_(start, surplus, extra, reserve, months, options) {
  options = options || {};
  var oneTime = options.oneTime === true;
  var cash = round2_(start);
  var firstBreach = null;
  var walks = [];
  var i;
  for (i = 0; i < months.length; i++) {
    var monthExtra = oneTime ? (i === 0 ? extra : 0) : extra;
    cash = round2_(cash + surplus - monthExtra - months[i].upcomingAmount);
    var headroom = round2_(cash - reserve);
    walks.push({
      monthKey: months[i].key,
      endingCash: cash,
      upcomingAmount: round2_(Number(months[i].upcomingAmount) || 0),
      headroom: headroom,
      ok: cash + 0.005 >= reserve
    });
    if (!firstBreach && cash + 0.005 < reserve) {
      firstBreach = {
        monthKey: months[i].key,
        endingCash: cash,
        obligationLabel: debtPayoffCashSafetyObligationLabel_(months[i]),
        obligations: months[i].obligations
      };
    }
  }
  return {
    ok: !firstBreach,
    endingCash: cash,
    monthKey: firstBreach ? firstBreach.monthKey : '',
    obligationLabel: firstBreach ? firstBreach.obligationLabel : '',
    obligations: firstBreach ? firstBreach.obligations : [],
    walks: walks
  };
}

function debtPayoffMaxOneTimePreservingReserve_(start, surplus, reserve, months) {
  var atZero = debtPayoffWalkCashSafety_(start, surplus, 0, reserve, months);
  var walks = atZero.walks || [];
  if (!walks.length) {
    return { amount: 0, tightMonthKey: '', ok: atZero.ok, walks: [] };
  }
  var minHeadroom = walks[0].headroom;
  var tightMonthKey = walks[0].monthKey;
  walks.forEach(function(row) {
    if (Number(row.headroom) < minHeadroom) {
      minHeadroom = Number(row.headroom);
      tightMonthKey = row.monthKey;
    }
  });
  if (!(minHeadroom > 0.005)) {
    return { amount: 0, tightMonthKey: tightMonthKey, ok: atZero.ok, walks: walks };
  }
  var lo = 0;
  var hi = Math.round(minHeadroom * 100);
  var best = 0;
  while (lo <= hi) {
    var midCents = Math.floor((lo + hi) / 2);
    var mid = round2_(midCents / 100);
    if (debtPayoffWalkCashSafety_(start, surplus, mid, reserve, months, { oneTime: true }).ok) {
      best = mid;
      lo = midCents + 1;
    } else {
      hi = midCents - 1;
    }
  }
  var atCap = debtPayoffWalkCashSafety_(start, surplus, best, reserve, months, { oneTime: true });
  return {
    amount: round2_(best),
    tightMonthKey: tightMonthKey,
    ok: atCap.ok,
    walks: atCap.walks
  };
}

function debtPayoffMaxExtraPreservingReserve_(start, surplus, reserve, months) {
  surplus = round2_(surplus);
  if (!(surplus > 0.005)) return 0;
  if (debtPayoffWalkCashSafety_(start, surplus, surplus, reserve, months).ok) {
    return surplus;
  }
  if (!debtPayoffWalkCashSafety_(start, surplus, 0, reserve, months).ok) {
    return 0;
  }
  var lo = 0;
  var hi = Math.round(surplus * 100);
  var best = 0;
  while (lo <= hi) {
    var midCents = Math.floor((lo + hi) / 2);
    var mid = round2_(midCents / 100);
    if (debtPayoffWalkCashSafety_(start, surplus, mid, reserve, months).ok) {
      best = mid;
      lo = midCents + 1;
    } else {
      hi = midCents - 1;
    }
  }
  return round2_(best);
}

function debtPayoffCollectOneTimeUpcomingBlockers_(input) {
  var blockers = [];
  if (input.upcomingUnavailable) {
    blockers.push({
      code: 'UPCOMING_UNAVAILABLE',
      reason: String(input.upcomingUnavailableReason ||
        ('Dated upcoming expenses could not be read, so they were not treated as $0. Update ' +
          DEBT_PAYOFF_CASH_SAFETY_LOCATION_ + '.')),
      location: input.upcomingLocation || DEBT_PAYOFF_CASH_SAFETY_LOCATION_
    });
    return blockers;
  }
  var rows = input.upcomingExpenses || [];
  if (!rows.length) return blockers;
  var asOfDate = input.asOfDate;
  if (!(asOfDate instanceof Date) || isNaN(asOfDate.getTime())) {
    blockers.push({
      code: 'CASH_SAFETY_ASOF_UNKNOWN',
      reason: 'The 12-month one-time cash-safety forecast has no as-of date, so upcoming due dates were not placed into months. Unknown timing was not treated as $0.'
    });
    return blockers;
  }
  var lastKey = debtPayoffScenarioMonthKey_(asOfDate, DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_);
  rows.forEach(function(row) {
    if (!row) return;
    var name = row.name || 'An upcoming expense';
    if (row.dueDateKnown !== true || !debtPayoffIsoDateIsValid_(row.dueDate)) {
      blockers.push({
        code: 'UPCOMING_DATE_UNKNOWN',
        reason: name +
          ' is Planned but has no usable due date, so it was not placed in the 12-month one-time cash-safety forecast or treated as $0. Update ' +
          DEBT_PAYOFF_CASH_SAFETY_LOCATION_ + '.',
        location: DEBT_PAYOFF_CASH_SAFETY_LOCATION_
      });
      return;
    }
    var monthKey = debtPayoffMonthKeyFromIsoDate_(row.dueDate);
    if (monthKey && lastKey && monthKey > lastKey) return;
    if (row.amountKnown !== true) {
      blockers.push({
        code: 'UPCOMING_AMOUNT_UNKNOWN',
        reason: name +
          ' is Planned with a due date in the 12-month one-time cash-safety forecast but has no usable Amount, so it was not treated as $0. Update ' +
          DEBT_PAYOFF_CASH_SAFETY_LOCATION_ + '.',
        location: DEBT_PAYOFF_CASH_SAFETY_LOCATION_
      });
    }
  });
  return blockers;
}

function evaluateDebtPayoffOneTimeHorizon_(input, reserveFloor) {
  input = input || {};
  var start = round2_(Number(input.startingCash));
  var surplus = round2_(Number(input.surplus));
  var result = {
    evaluated: false,
    amount: null,
    tightMonthKey: '',
    limitedToThreeMonths: false,
    baselineSafe: false,
    baselineBreachMonthKey: '',
    baselineBreachObligation: '',
    threeMonthAmount: 0,
    horizonMonths: DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_,
    horizonLabel: DEBT_PAYOFF_ONE_TIME_HORIZON_LABEL_,
    reason: '',
    blockers: []
  };
  if (!isFinite(start) || !isFinite(surplus) || reserveFloor == null) {
    result.reason = 'Usable cash, recurring surplus, or the canonical reserve could not be proven for the 12-month one-time cash-safety check. Missing values were not replaced with $0.';
    return result;
  }
  var asOfDate = input.asOfDate;
  var hasAsOf = asOfDate instanceof Date && !isNaN(asOfDate.getTime());
  if (!hasAsOf) {
    result.evaluated = true;
    result.amount = 0;
    result.limitedToThreeMonths = true;
    result.reason =
      'A 12-month one-time check needs an as-of date to place recurring surplus and Planned upcoming expenses into months. The result is limited to three months and no lump is labeled safe beyond that horizon.';
    return result;
  }
  var blockers = debtPayoffCollectOneTimeUpcomingBlockers_(input);
  if (blockers.length) {
    result.blockers = blockers;
    result.reason = blockers[0] && blockers[0].reason ||
      'Unknown Planned upcoming expenses were not treated as $0.';
    return result;
  }
  var months3 = debtPayoffBuildCashSafetyMonths_(
    asOfDate, DEBT_PAYOFF_CASH_SAFETY_HORIZON_MONTHS_, input.upcomingExpenses);
  var months12 = debtPayoffBuildCashSafetyMonths_(
    asOfDate, DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_, input.upcomingExpenses);
  var threeMonth = debtPayoffMaxOneTimePreservingReserve_(
    start, surplus, reserveFloor, months3);
  result.threeMonthAmount = threeMonth.amount;
  var atZero12 = debtPayoffWalkCashSafety_(start, surplus, 0, reserveFloor, months12);
  if (!atZero12.ok) {
    result.evaluated = true;
    result.amount = 0;
    result.tightMonthKey = atZero12.monthKey;
    result.baselineSafe = false;
    result.baselineBreachMonthKey = atZero12.monthKey;
    result.baselineBreachObligation = atZero12.obligationLabel;
    var namedObligation = debtPayoffCashSafetyNamedObligation_(atZero12.obligationLabel);
    result.reason =
      'Even with no one-time extra, usable cash would fall below the protected reserve of ' +
      debtPayoffCashSafetyMoneyLabel_(reserveFloor) + ' in ' +
      atZero12.monthKey +
      (namedObligation ? ', when ' + namedObligation + ' is due, ' : ' ') +
      debtPayoffCashSafetySurplusContinuation_(surplus) +
      '. No lump payment is labeled safe. A recurring surplus, lower commitments, or additional confirmed income is needed. Optional Cisco bonuses are not assumed.';
    return result;
  }
  var oneTime12 = debtPayoffMaxOneTimePreservingReserve_(
    start, surplus, reserveFloor, months12);
  result.evaluated = true;
  result.amount = oneTime12.amount;
  result.tightMonthKey = oneTime12.tightMonthKey;
  result.baselineSafe = true;
  result.reason = oneTime12.amount > 0.005
    ? ('A one-time extra of ' + debtPayoffCashSafetyMoneyLabel_(oneTime12.amount) +
      ' still leaves cash at or above the protected reserve in each of the next 12 months after required payments and known Planned upcoming expenses counted once.')
    : ('No one-time extra keeps usable cash at or above the protected reserve in every month of the 12-month cash-safety forecast.');
  return result;
}

function debtPayoffCollectCashSafetyBlockers_(input) {
  var blockers = [];
  if (input.upcomingUnavailable) {
    blockers.push({
      code: 'UPCOMING_UNAVAILABLE',
      reason: String(input.upcomingUnavailableReason ||
        ('Dated upcoming expenses could not be read, so they were not treated as $0. Update ' +
          DEBT_PAYOFF_CASH_SAFETY_LOCATION_ + '.')),
      location: input.upcomingLocation || DEBT_PAYOFF_CASH_SAFETY_LOCATION_
    });
    return blockers;
  }
  var rows = input.upcomingExpenses || [];
  if (!rows.length) return blockers;
  var asOfDate = input.asOfDate;
  if (!(asOfDate instanceof Date) || isNaN(asOfDate.getTime())) {
    blockers.push({
      code: 'CASH_SAFETY_ASOF_UNKNOWN',
      reason: 'The 3-month cash-safety forecast has no as-of date, so upcoming due dates were not placed into months. Unknown timing was not treated as $0.'
    });
    return blockers;
  }
  var horizonMonths = DEBT_PAYOFF_CASH_SAFETY_HORIZON_MONTHS_;
  var lastKey = debtPayoffScenarioMonthKey_(asOfDate, horizonMonths);
  rows.forEach(function(row) {
    if (!row) return;
    var name = row.name || 'An upcoming expense';
    if (row.dueDateKnown !== true || !debtPayoffIsoDateIsValid_(row.dueDate)) {
      blockers.push({
        code: 'UPCOMING_DATE_UNKNOWN',
        reason: name +
          ' is Planned but has no usable due date, so it was not placed in the 3-month cash-safety forecast or treated as $0. Update ' +
          DEBT_PAYOFF_CASH_SAFETY_LOCATION_ + '.',
        location: DEBT_PAYOFF_CASH_SAFETY_LOCATION_
      });
      return;
    }
    var monthKey = debtPayoffMonthKeyFromIsoDate_(row.dueDate);
    if (monthKey && lastKey && monthKey > lastKey) return;
    if (row.amountKnown !== true) {
      blockers.push({
        code: 'UPCOMING_AMOUNT_UNKNOWN',
        reason: name +
          ' is Planned with a due date in the 3-month cash-safety forecast but has no usable Amount, so it was not treated as $0. Update ' +
          DEBT_PAYOFF_CASH_SAFETY_LOCATION_ + '.',
        location: DEBT_PAYOFF_CASH_SAFETY_LOCATION_
      });
    }
  });
  return blockers;
}

function evaluateDebtPayoffFutureCashSafety_(input) {
  input = input || {};
  var horizonMonths = DEBT_PAYOFF_CASH_SAFETY_HORIZON_MONTHS_;
  var horizonLabel = DEBT_PAYOFF_CASH_SAFETY_HORIZON_LABEL_;
  var start = round2_(Number(input.startingCash));
  var surplus = round2_(Number(input.surplus));
  var reserve = round2_(Number(input.requiredReserve));
  var reserveFloor = debtPayoffCashSafetyReserveFloor_(
    reserve, input.reserveUpcomingAmount);
  var empty = {
    horizonMonths: horizonMonths,
    horizonLabel: horizonLabel,
    extraBeforeSafety: surplus,
    extraAfterSafety: surplus,
    reduced: false,
    withheld: false,
    safe: true,
    breachMonthKey: '',
    breachObligation: '',
    outsideHorizon: [],
    oneTimeAllocationEvaluated: false,
    oneTimeAmount: null,
    oneTimeTightMonthKey: '',
    oneTimeHorizonMonths: DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_,
    oneTimeBaselineSafe: false,
    oneTimeBaselineBreachMonthKey: '',
    oneTimeBaselineBreachObligation: '',
    oneTimeLimitedToThreeMonths: false,
    oneTimeThreeMonthAmount: null,
    reason: ''
  };
  if (!isFinite(start) || !isFinite(surplus) || !isFinite(reserve) ||
      reserveFloor == null) {
    return {
      ok: false,
      extraCap: null,
      cashSafety: empty,
      blockers: [{
        code: 'CASH_SAFETY_FACTS_MISSING',
        reason: 'Usable cash, recurring surplus, or the canonical reserve could not be proven for the 3-month cash-safety forecast. Missing values were not replaced with $0.'
      }]
    };
  }
  var asOfDate = input.asOfDate;
  var hasAsOf = asOfDate instanceof Date && !isNaN(asOfDate.getTime());
  var months = hasAsOf
    ? debtPayoffBuildCashSafetyMonths_(asOfDate, horizonMonths, input.upcomingExpenses)
    : [];
  if (!hasAsOf) {
    months = [
      { key: 'month-1', upcomingAmount: 0, obligations: [] },
      { key: 'month-2', upcomingAmount: 0, obligations: [] },
      { key: 'month-3', upcomingAmount: 0, obligations: [] }
    ];
  }
  var extraCap = debtPayoffMaxExtraPreservingReserve_(
    start, surplus, reserveFloor, months);
  var atCap = debtPayoffWalkCashSafety_(
    start, surplus, extraCap, reserveFloor, months);
  var atZero = extraCap <= 0.005
    ? atCap
    : debtPayoffWalkCashSafety_(start, surplus, 0, reserveFloor, months);
  var atSurplus = surplus > 0.005 && extraCap + 0.005 < surplus
    ? debtPayoffWalkCashSafety_(start, surplus, surplus, reserveFloor, months)
    : atCap;
  var lastKey = months.length ? months[months.length - 1].key : '';
  var outsideHorizon = hasAsOf
    ? debtPayoffListOutsideHorizonUpcoming_(
        asOfDate, horizonMonths, input.upcomingExpenses)
    : [];
  var outsideLabel = debtPayoffOutsideHorizonLabel_(outsideHorizon);
  var remainingAboveReserve = round2_(atZero.endingCash - reserveFloor);
  var inWindowUpcoming = debtPayoffListInWindowUpcoming_(months);
  var reconciliation = debtPayoffBuildCashSafetyReconciliation_({
    startingCash: start,
    surplus: surplus,
    endingCash: atZero.endingCash,
    inWindowUpcoming: inWindowUpcoming,
    canonicalReserve: reserve,
    reserveUpcomingAmount: input.reserveUpcomingAmount,
    protectedReserveFloor: reserveFloor,
    remainingAboveReserve: remainingAboveReserve
  });
  var cashSafety = {
    horizonMonths: horizonMonths,
    horizonLabel: horizonLabel,
    asOfMonthKey: hasAsOf ? debtPayoffScenarioMonthKey_(asOfDate, 1) : '',
    throughMonthKey: lastKey,
    extraBeforeSafety: surplus,
    extraAfterSafety: extraCap,
    reduced: extraCap + 0.005 < surplus && extraCap > 0.005,
    withheld: extraCap <= 0.005 && surplus > 0.005 && !atZero.ok,
    safe: atCap.ok,
    breachMonthKey: atSurplus.ok ? '' : atSurplus.monthKey,
    breachObligation: atSurplus.ok ? '' : atSurplus.obligationLabel,
    outsideHorizon: outsideHorizon,
    protectedReserveFloor: reserveFloor,
    endingCashAtZeroExtra: atZero.endingCash,
    remainingAboveReserve: remainingAboveReserve,
    inWindowUpcoming: inWindowUpcoming,
    inWindowUpcomingTotal: reconciliation.inWindowUpcomingTotal,
    reserveUpcomingAmount: reconciliation.reserveUpcomingAmount,
    reconciliation: reconciliation,
    oneTimeAllocationEvaluated: true,
    oneTimeAmount: 0,
    oneTimeTightMonthKey: '',
    oneTimeHorizonMonths: DEBT_PAYOFF_ONE_TIME_HORIZON_MONTHS_,
    oneTimeBaselineSafe: false,
    oneTimeBaselineBreachMonthKey: '',
    oneTimeBaselineBreachObligation: '',
    oneTimeLimitedToThreeMonths: false,
    oneTimeThreeMonthAmount: 0,
    reason: ''
  };
  var oneTime = evaluateDebtPayoffOneTimeHorizon_(input, reserveFloor);
  cashSafety.oneTimeAllocationEvaluated = oneTime.evaluated === true;
  cashSafety.oneTimeAmount = oneTime.amount;
  cashSafety.oneTimeTightMonthKey = oneTime.tightMonthKey || '';
  cashSafety.oneTimeHorizonMonths = oneTime.horizonMonths;
  cashSafety.oneTimeHorizonLabel = oneTime.horizonLabel;
  cashSafety.oneTimeBaselineSafe = oneTime.baselineSafe === true;
  cashSafety.oneTimeBaselineBreachMonthKey = oneTime.baselineBreachMonthKey || '';
  cashSafety.oneTimeBaselineBreachObligation = oneTime.baselineBreachObligation || '';
  cashSafety.oneTimeLimitedToThreeMonths = oneTime.limitedToThreeMonths === true;
  cashSafety.oneTimeThreeMonthAmount = oneTime.threeMonthAmount;
  cashSafety.oneTimeReason = oneTime.reason || '';
  var outsideSentence = outsideLabel
    ? ' Outside this 3-month check: ' + outsideLabel + '.'
    : '';
  if (surplus <= 0.005) {
    if (remainingAboveReserve > 0.005) {
      cashSafety.reason =
        'After the 3-month cash-safety forecast, ending cash is ' +
        debtPayoffCashSafetyMoneyLabel_(atZero.endingCash) +
        ', remaining protected reserve is ' +
        debtPayoffCashSafetyMoneyLabel_(reserveFloor) +
        ', and ' +
        debtPayoffCashSafetyMoneyLabel_(remainingAboveReserve) +
        ' remains above that reserve.' + outsideSentence;
    } else {
      cashSafety.reason =
        'After the 3-month cash-safety forecast, usable cash would not stay above the protected reserve of ' +
        debtPayoffCashSafetyMoneyLabel_(reserveFloor) +
        (atZero.monthKey
          ? (' in ' + atZero.monthKey +
            (atZero.obligationLabel ? ', when ' + atZero.obligationLabel + ' is due' : ''))
          : '') +
        '.' + outsideSentence;
    }
  } else if (cashSafety.withheld) {
    cashSafety.reason =
      'No recurring extra is recommended because even $0.00 extra would leave usable cash below the protected reserve floor of ' +
      debtPayoffCashSafetyMoneyLabel_(reserveFloor) + ' in ' +
      cashSafety.breachMonthKey + ', when ' + cashSafety.breachObligation +
      ' is due. Update ' + DEBT_PAYOFF_CASH_SAFETY_LOCATION_ +
      ' if that obligation changed.' + outsideSentence;
  } else if (cashSafety.reduced) {
    cashSafety.reason =
      'The recommended recurring extra was reduced from ' +
      debtPayoffCashSafetyMoneyLabel_(surplus) + ' to ' +
      debtPayoffCashSafetyMoneyLabel_(extraCap) +
      ' so usable cash stays at or above the protected reserve floor of ' +
      debtPayoffCashSafetyMoneyLabel_(reserveFloor) + ' in ' +
      cashSafety.breachMonthKey + ', when ' + cashSafety.breachObligation +
      ' is due.' + outsideSentence;
  } else {
    cashSafety.reason =
      'The cash-safety check covers three months through ' +
      (hasAsOf && lastKey ? lastKey : 'the 3-month horizon') +
      '. Ending cash is ' +
      debtPayoffCashSafetyMoneyLabel_(atZero.endingCash) +
      ' and ' +
      debtPayoffCashSafetyMoneyLabel_(remainingAboveReserve) +
      ' remains above the protected reserve of ' +
      debtPayoffCashSafetyMoneyLabel_(reserveFloor) +
      '.' + outsideSentence;
  }
  return {
    ok: true,
    extraCap: extraCap,
    cashSafety: cashSafety,
    blockers: []
  };
}

function debtPayoffNormalizePayeeHay_(value) {
  return ' ' + String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
}

function debtPayoffPropertyCostBillKind_(bill) {
  var payee = String(bill && (bill.payee || bill.name) || '').trim();
  var cat = String(bill && bill.category || '').trim().toLowerCase();
  var hay = debtPayoffNormalizePayeeHay_(payee);
  if (hay.indexOf(' income tax ') !== -1 || hay.indexOf(' irs ') !== -1 ||
      hay.indexOf(' auto insurance ') !== -1 || hay.indexOf(' car insurance ') !== -1 ||
      hay.indexOf(' health insurance ') !== -1 || hay.indexOf(' life insurance ') !== -1) {
    return '';
  }
  if (hay.indexOf(' property tax ') !== -1 || hay.indexOf(' real estate tax ') !== -1 ||
      cat === 'property tax') {
    return 'tax';
  }
  if (hay.indexOf(' homeowner insurance ') !== -1 || hay.indexOf(' homeowners insurance ') !== -1 ||
      hay.indexOf(' hazard insurance ') !== -1 || hay.indexOf(' flood insurance ') !== -1 ||
      hay.indexOf(' dwelling insurance ') !== -1) {
    return 'insurance';
  }
  if ((cat === 'tax' || cat === 'insurance') && payee) return 'category';
  return '';
}

function debtPayoffSameSavedPropertyLink_(billLink, debtLink) {
  var left = String(billLink || '').trim().toLowerCase();
  var right = String(debtLink || '').trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}

function buildDebtPayoffEscrowBillCoverage_(debts, bills, debtKeys) {
  var propertyDebts = [];
  (debts || []).forEach(function(debt) {
    if (!debt || debt.active === false) return;
    if (!(Number(debt.balance) > 0.005)) return;
    if (!debtPayoffHasContinuingPropertyCosts_(debt)) return;
    var pi = debtPayoffDerivedPrincipalAndInterest_(debt);
    var escrowKnown = false;
    var escrowAmount = null;
    if (debt.escrowKnown === true && isFinite(Number(debt.escrowPayment))) {
      escrowKnown = true;
      escrowAmount = round2_(debt.escrowPayment);
    } else if (pi.known && isFinite(Number(debt.minimumPayment))) {
      var derivedEscrow = round2_(Number(debt.minimumPayment) - Number(pi.amount));
      if (derivedEscrow > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
        escrowKnown = true;
        escrowAmount = derivedEscrow;
      }
    }
    propertyDebts.push({
      name: String(debt.name || debt.originalName || ''),
      linkedProperty: String(debt.linkedProperty || '').trim(),
      escrowKnown: escrowKnown,
      escrowAmount: escrowAmount
    });
  });
  var excludePayeeKeys = {};
  var excludedBills = [];
  var excludedAmount = 0;
  var blockers = [];
  var unknownBills = [];
  (bills || []).forEach(function(bill) {
    if (!bill || bill.active === false) return;
    var payeeKey = debtPayoffScenarioPayeeKey_(bill.payee || bill.name);
    if (bill.debtOwned || (debtKeys && debtKeys[payeeKey])) return;
    var kind = debtPayoffPropertyCostBillKind_(bill);
    if (!kind) return;
    var billPropertyLink = String(bill.linkedProperty || '').trim();
    if (!billPropertyLink) return;
    var matches = propertyDebts.filter(function(debt) {
      return debtPayoffSameSavedPropertyLink_(billPropertyLink, debt.linkedProperty);
    });
    if (!matches.length) return;
    if (matches.length === 1 && matches[0].escrowKnown) {
      var monthly = debtPayoffScenarioScheduledToMonthly_(bill.amount, bill.frequency);
      if (bill.amountKnown === false || monthly == null) {
        unknownBills.push(bill.payee || bill.name);
        return;
      }
      excludePayeeKeys[payeeKey] = true;
      excludedBills.push({
        payee: bill.payee || bill.name,
        monthlyAmount: monthly,
        property: matches[0].linkedProperty || matches[0].name,
        escrowAmount: matches[0].escrowAmount
      });
      excludedAmount = round2_(excludedAmount + monthly);
      return;
    }
    if (matches.length === 1 && !matches[0].escrowKnown) {
      unknownBills.push(bill.payee || bill.name);
      return;
    }
    if (matches.length > 1) {
      unknownBills.push(bill.payee || bill.name);
    }
  });
  if (unknownBills.length) {
    blockers.push({
      code: 'ESCROW_COVERAGE_UNKNOWN',
      reason: 'Escrow coverage for ' + unknownBills.join('; ') +
        ' could not be matched safely to a property loan, so extra was withheld rather than counting those property costs twice or guessing. The full saved mortgage minimum was not reduced.'
    });
    excludePayeeKeys = {};
    excludedBills = [];
    excludedAmount = 0;
  }
  return {
    excludePayeeKeys: excludePayeeKeys,
    blockers: blockers,
    summary: {
      countedOnce: excludedBills.length > 0 && blockers.length === 0,
      excludedBills: excludedBills,
      excludedAmount: excludedAmount,
      unknownBills: unknownBills
    }
  };
}

/**
 * Pure recurring-surplus estimate. Does not use This Week’s weekly extra,
 * current-month Cash Flow net, or Rolling Debt Payoff caps.
 */
function buildDebtPayoffSupportedMonthlyExtra_(input) {
  input = input || {};
  var blockers = [];
  var source =
    'Confirmed Cash Flow recurring income, INPUT - Bills scheduled amounts for fixed bills, Cash Flow YTD running averages for variable bills, INPUT - Debts known minimums, SYS - Accounts usable cash after buffers, standing investment policy floors, This Week’s canonical reserve (including upcoming expenses and property contingency), and a 3-month cash-safety forecast of that reserve after known Planned upcoming expenses.';
  var assumptions = [
    'This amount is an estimate of recurring monthly surplus after required bills, known debt minimums, and standing investment policy floors.',
    'It is not This Week’s weekly extra, is not four times any weekly figure, and is not treated as affordable until you choose to use it.',
    'Only income with an explicit Recurring confirmation, a usable Frequency, and an Expected Amount is included. Each Manage Income group is one forecast: Expected Amount is per occurrence, converted by frequency (Biweekly = amount × 26 ÷ 12; Semi-monthly / twice monthly = amount × 24 ÷ 12). Multiple Cash Flow history rows in the same group are not multiplied. Bonus, RSU/ESPP, one-time, and variable sources are excluded from the raw payee before any name normalization. Historical averages are not used as Expected Amount.',
    'Protected cash is This Week’s canonical reserve, including upcoming expenses and property contingency. A bills-only three-month proxy is not used.',
    'The recurring extra is then checked with a 3-month cash-safety forecast aligned with This Week’s 90-day reserve. It starts from usable cash after buffers. Each month, recurring surplus minus the extra and known Planned upcoming expenses in that window must leave cash at or above the protected reserve floor. Recurring bills and debt minimums stay in the surplus and are not subtracted again. Upcoming already included in This Week’s canonical reserve is removed from that month-end floor so those expenses are counted once. Planned upcoming due after the 3-month horizon is outside this check and is named. Blank or invalid upcoming dates or amounts withhold the extra instead of treating unknown as $0.',
    'Matching Bills for a tracked debt are counted only as the contractual minimum. A policy-floor bill is not added on top of the standing weekly floor converted at 52 ÷ 12.',
    'A property loan’s full saved minimum, which may include escrow, is the cash-flow amount. Property-tax and insurance bills saved as linked to that mortgaged property are counted there and are not added again. Bills for properties with no linked mortgage, including paid-off homes, stay in the bill total and do not require an escrow match. Extra is withheld only when a bill is saved as linked to a mortgaged property and that mortgage’s escrow coverage is unknown. An amount with no confirmed period is not treated as monthly.',
    'Cisco Mid Year Bonus and Cisco End Year Bonus are separate annual income rows with Recurring = Yes and Frequency = Yearly. They are not included in recurring monthly income, are not treated as cash available each month, and are not used to satisfy the 90-day cash reserve. They are not applied to the strategy comparison unless you include them in the optional scenario overlay and enter the next payment month and year. If a yearly amount is shown as a monthly equivalent, that figure is an estimate only.'
  ];

  if (input.incomeUnavailable) {
    blockers.push({
      code: 'INCOME_UNAVAILABLE',
      reason: 'Recurring Cash Flow income could not be established.'
    });
  }
  if (input.incomeCadenceUnconfirmed) {
    blockers.push({
      code: 'INCOME_CADENCE_UNCONFIRMED',
      reason: String(input.incomeCadenceReason ||
        'Cash Flow has no Recurring, Frequency, and Expected Amount confirmation, so a monthly amount was not inferred from positive months. Add those columns on the existing INPUT - Cash Flow tab (no new tab).'),
      incompleteRows: input.incomeIncompleteRows || []
    });
  }
  if (input.billsUnavailable) {
    blockers.push({
      code: 'BILLS_UNAVAILABLE',
      reason: String(input.billsUnavailableReason ||
        'INPUT - Bills could not be read, so required monthly bills cannot be proven.')
    });
  }
  if (input.investmentsUnavailable) {
    blockers.push({
      code: 'INVESTMENTS_UNAVAILABLE',
      reason: 'Standing investment policy floors could not be proven. Missing helpers are not treated as a $0 floor.'
    });
  }
  if (input.usableCashKnown === false) {
    blockers.push({
      code: 'CASH_UNAVAILABLE',
      reason: 'Usable cash after buffers could not be proven, so the canonical reserve cannot be checked.'
    });
  }
  if (input.reserveKnown === false) {
    blockers.push({
      code: 'RESERVE_UNAVAILABLE',
      reason: String(input.reserveUnavailableReason ||
        'This Week’s canonical reserve, including upcoming expenses and property contingency, could not be proven.')
    });
  }
  Array.prototype.push.apply(blockers, debtPayoffCollectCashSafetyBlockers_(input));

  var income = 0;
  var incomeSources = [];
  (input.recurringIncomeSources || []).forEach(function(sourceRow) {
    var classified = debtPayoffClassifySupportedIncomeSource_(sourceRow);
    if (classified.skip) return;
    if (classified.blocker) {
      blockers.push(classified.blocker);
      return;
    }
    income = round2_(income + classified.monthlyAmount);
    incomeSources.push({
      name: classified.name || sourceRow.name || 'An income source',
      amount: classified.monthlyAmount
    });
  });

  var collectedMins = collectDebtPayoffSupportedMinimums_(input.debts);
  var debtMinimums = collectedMins.total;
  var debtKeys = collectedMins.debtKeys;
  var debtMinimumsByType = collectedMins.breakdown;
  Array.prototype.push.apply(blockers, collectedMins.blockers);
  var escrowCoverage = buildDebtPayoffEscrowBillCoverage_(
    input.debts, input.bills, debtKeys);
  Array.prototype.push.apply(blockers, escrowCoverage.blockers);

  var billsMonthly = 0;
  var variableBillsMonthly = 0;
  var variableBillEstimates = [];
  var unmatchedInvestmentBillsMonthly = 0;
  var requiredBillSources = [];
  var unmatchedInvestmentBillSources = [];
  var policyFloorSources = [];
  var policyFloorNames = {};
  (input.policyFloors || []).forEach(function(floor) {
    policyFloorNames[debtPayoffScenarioPayeeKey_(floor.accountName)] = true;
  });

  (input.bills || []).forEach(function(bill) {
    if (!bill || bill.active === false) return;
    var payeeKey = debtPayoffScenarioPayeeKey_(bill.payee || bill.name);
    if (bill.debtOwned || debtKeys[payeeKey]) return;
    if (escrowCoverage.excludePayeeKeys[payeeKey]) return;
    var matchedFloor = bill.isInvestmentContribution && (
      (bill.matchedInvestmentAccount &&
        policyFloorNames[debtPayoffScenarioPayeeKey_(bill.matchedInvestmentAccount)]) ||
      policyFloorNames[payeeKey]
    );
    if (matchedFloor) return;
    if (debtPayoffBillIsVaries_(bill)) {
      if (assumptions.indexOf(DEBT_PAYOFF_VARIABLE_BILL_METHOD_) === -1) {
        assumptions.push(DEBT_PAYOFF_VARIABLE_BILL_METHOD_);
      }
      var hist = bill.variableHistory;
      if (!hist || hist.ok !== true) {
        blockers.push({
          code: (hist && hist.code) || 'VARIABLE_BILL_HISTORY_INCOMPLETE',
          reason: (hist && hist.reason) || (
            (bill.payee || bill.name || 'A bill') +
            ' varies and does not have complete YTD Cash Flow expense history for every completed month this year.'
          )
        });
        return;
      }
      variableBillsMonthly = round2_(variableBillsMonthly + Number(hist.monthlyEquivalent || 0));
      variableBillEstimates.push({
        payee: bill.payee || bill.name,
        periodStart: hist.periodStart,
        periodEnd: hist.periodEnd,
        ytdTotal: hist.ytdTotal,
        completedMonthCount: hist.completedMonthCount,
        monthlyEquivalent: hist.monthlyEquivalent,
        knownMonthCount: hist.knownMonthCount,
        blankMonthCount: hist.blankMonthCount,
        explicitZeroMonthCount: hist.explicitZeroMonthCount,
        label: hist.label || 'YTD running average'
      });
      return;
    }
    if (bill.amountKnown === false) {
      blockers.push({
        code: 'BILL_AMOUNT_UNKNOWN',
        reason: (bill.payee || bill.name || 'A bill') +
          ' has no usable scheduled amount.'
      });
      return;
    }
    var monthly = debtPayoffScenarioScheduledToMonthly_(bill.amount, bill.frequency);
    if (monthly == null) {
      blockers.push({
        code: 'BILL_FREQUENCY_UNKNOWN',
        reason: (bill.payee || bill.name || 'A bill') +
          ' has no usable frequency, so a monthly amount was not assumed.'
      });
      return;
    }
    if (bill.isInvestmentContribution) {
      unmatchedInvestmentBillsMonthly = round2_(unmatchedInvestmentBillsMonthly + monthly);
      unmatchedInvestmentBillSources.push({
        name: bill.payee || bill.name || 'An investment bill',
        amount: monthly
      });
      return;
    }
    billsMonthly = round2_(billsMonthly + monthly);
    requiredBillSources.push({
      name: bill.payee || bill.name || 'A bill',
      amount: monthly
    });
  });

  var policyFloorMonthly = 0;
  var pausePolicyFloors = input.pausePolicyFloors === true;
  (input.policyFloors || []).forEach(function(floor) {
    var weekly = Math.max(
      Number(floor.weeklyAmount) || 0,
      Number(floor.requestedWeeklyPace) || 0
    );
    var monthlyFloor = debtPayoffScenarioWeeklyToMonthly_(weekly);
    if (pausePolicyFloors) {
      policyFloorSources.push({
        name: floor.accountName || 'Investment policy floor',
        amount: 0,
        standingAmount: monthlyFloor,
        pausedInHypothetical: true
      });
      return;
    }
    policyFloorMonthly = round2_(policyFloorMonthly + monthlyFloor);
    policyFloorSources.push({
      name: floor.accountName || 'Investment policy floor',
      amount: monthlyFloor
    });
  });

  var requestedReduction = round2_(
    Math.max(0, Number(input.hypotheticalCommitmentReductionMonthly) || 0));
  var reducibleCommitments = round2_(
    billsMonthly + variableBillsMonthly + policyFloorMonthly +
    unmatchedInvestmentBillsMonthly);
  var appliedReduction = requestedReduction > 0.005
    ? round2_(Math.min(requestedReduction, reducibleCommitments))
    : 0;
  var components = {
    recurringIncomeMonthly: income,
    debtMinimumsMonthly: debtMinimums,
    recurringBillsMonthly: billsMonthly,
    variableBillsMonthly: variableBillsMonthly,
    policyFloorMonthly: policyFloorMonthly,
    unmatchedInvestmentBillsMonthly: unmatchedInvestmentBillsMonthly,
    hypotheticalCommitmentReductionMonthly: appliedReduction
  };
  var commitments = round2_(
    debtMinimums + billsMonthly + variableBillsMonthly +
    policyFloorMonthly + unmatchedInvestmentBillsMonthly - appliedReduction);
  var surplus = round2_(income - commitments);
  var cashPicture = buildDebtPayoffCashPicture_({
    components: components,
    surplus: surplus,
    debtMinimumsByType: debtMinimumsByType,
    incomeSources: incomeSources,
    requiredBillSources: requiredBillSources,
    variableBillEstimates: variableBillEstimates,
    policyFloorSources: policyFloorSources,
    unmatchedInvestmentBillSources: unmatchedInvestmentBillSources,
    hypotheticalAdjustments: input.hypotheticalAdjustments || null
  });
  var requiredReserve = input.reserveKnown === false
    ? null
    : round2_(Number(input.requiredReserveAmount));
  if (input.reserveKnown !== false && !isFinite(Number(requiredReserve))) {
    blockers.push({
      code: 'RESERVE_UNAVAILABLE',
      reason: 'This Week’s canonical reserve amount could not be proven.'
    });
    requiredReserve = null;
  }
  var usable = Number(input.usableCashAfterBuffers);
  var reserveShort = input.reserveKnown !== false &&
    input.usableCashKnown !== false &&
    isFinite(usable) &&
    isFinite(Number(requiredReserve)) &&
    usable + 0.005 < Number(requiredReserve);

  if (blockers.length) {
    return {
      available: false,
      amount: null,
      label: 'Estimate',
      persisted: false,
      extraIsAffordable: null,
      reserveProtects: false,
      futureReserveProtects: false,
      deficit: false,
      source: source,
      blockers: blockers,
      components: components,
      debtMinimumsByType: debtMinimumsByType,
      cashPicture: cashPicture,
      escrowCoverage: escrowCoverage.summary,
      variableBillEstimates: [],
      variableBillMethod: DEBT_PAYOFF_VARIABLE_BILL_METHOD_,
      requiredReserveAmount: requiredReserve,
      usableCashAfterBuffers: isFinite(usable) ? round2_(usable) : null,
      cashSafety: null,
      assumptions: assumptions,
      datedBonusScenario: input.datedBonusScenario || null,
      policyFloorTreatment: pausePolicyFloors
        ? 'HYPOTHETICAL_PAUSE'
        : 'STANDING_WEEKLY_FLOOR_TIMES_52_DIV_12',
      policyFloorsIncluded: !pausePolicyFloors
    };
  }

  if (pausePolicyFloors) {
    assumptions = assumptions.concat([
      'This hypothetical pauses standing investment policy floors. The saved monthly baseline still includes them. This Week’s weekly Robinhood pause does not change that saved baseline.'
    ]);
  }

  var deficit = surplus <= 0.005;
  var amount = 0;
  var futureReserveProtects = false;
  var cashSafety = null;
  if (!reserveShort &&
      input.usableCashKnown !== false &&
      isFinite(usable) &&
      isFinite(Number(requiredReserve))) {
    var safety = evaluateDebtPayoffFutureCashSafety_({
      asOfDate: input.asOfDate,
      startingCash: usable,
      surplus: surplus,
      requiredReserve: requiredReserve,
      reserveUpcomingAmount: input.reserveUpcomingAmount,
      upcomingExpenses: input.upcomingExpenses || []
    });
    if (safety.ok !== true) {
      if (!deficit) {
        return {
          available: false,
          amount: null,
          label: 'Estimate',
          persisted: false,
          extraIsAffordable: null,
          reserveProtects: false,
          futureReserveProtects: false,
          deficit: false,
          source: source,
          blockers: safety.blockers || [],
          components: components,
          debtMinimumsByType: debtMinimumsByType,
          cashPicture: cashPicture,
          escrowCoverage: escrowCoverage.summary,
          variableBillEstimates: [],
          variableBillMethod: DEBT_PAYOFF_VARIABLE_BILL_METHOD_,
          requiredReserveAmount: requiredReserve,
          usableCashAfterBuffers: round2_(usable),
          recurringSurplusBeforeReserve: surplus,
          cashSafety: safety.cashSafety || null,
          assumptions: assumptions,
          datedBonusScenario: input.datedBonusScenario || null,
          policyFloorTreatment: pausePolicyFloors
            ? 'HYPOTHETICAL_PAUSE'
            : 'STANDING_WEEKLY_FLOOR_TIMES_52_DIV_12',
          policyFloorsIncluded: !pausePolicyFloors
        };
      }
    } else {
      cashSafety = safety.cashSafety;
      if (!deficit) {
        amount = round2_(safety.extraCap);
        futureReserveProtects = cashSafety && cashSafety.withheld === true;
      }
      if (cashSafety && cashSafety.reason) assumptions = assumptions.concat([cashSafety.reason]);
    }
  }

  return {
    available: true,
    amount: round2_(amount),
    label: 'Estimate',
    persisted: false,
    extraIsAffordable: null,
    reserveProtects: reserveShort,
    futureReserveProtects: futureReserveProtects,
    deficit: deficit,
    source: source,
    blockers: [],
    components: components,
    debtMinimumsByType: debtMinimumsByType,
    cashPicture: cashPicture,
    escrowCoverage: escrowCoverage.summary,
    variableBillEstimates: variableBillEstimates,
    variableBillMethod: DEBT_PAYOFF_VARIABLE_BILL_METHOD_,
    requiredReserveAmount: requiredReserve,
    usableCashAfterBuffers: round2_(usable),
    recurringSurplusBeforeReserve: surplus,
    cashSafety: cashSafety,
    assumptions: assumptions.concat([
      'Recurring income $' + income.toFixed(2) +
        ' − bills $' + billsMonthly.toFixed(2) +
        ' − variable bills $' + variableBillsMonthly.toFixed(2) +
        ' − debt minimums $' + debtMinimums.toFixed(2) +
        ' − policy floors $' + policyFloorMonthly.toFixed(2) +
        ' − other investment bills $' + unmatchedInvestmentBillsMonthly.toFixed(2) +
        (appliedReduction > 0.005
          ? ' + hypothetical commitment reduction $' + appliedReduction.toFixed(2)
          : '') +
        ' = $' + surplus.toFixed(2) + ' before reserve protection.'
    ]),
    datedBonusScenario: input.datedBonusScenario || null,
    policyFloorTreatment: pausePolicyFloors
      ? 'HYPOTHETICAL_PAUSE'
      : 'STANDING_WEEKLY_FLOOR_TIMES_52_DIV_12',
    policyFloorsIncluded: !pausePolicyFloors
  };
}

function collectDebtPayoffSupportedMonthlyExtraInput_(ss, debts, accounts) {
  var incomeRead = readDebtPayoffSupportedMonthlyExtraIncome_(ss);

  var usableCashKnown = true;
  var usableCashAfterBuffers = 0;
  try {
    usableCashAfterBuffers = Number(calculateUsableCash_(accounts || []).usableAfterBuffers);
    if (!isFinite(usableCashAfterBuffers)) usableCashKnown = false;
  } catch (e2) {
    usableCashKnown = false;
  }

  var policyFloors = [];
  var investmentsUnavailable = false;
  if (typeof readCapitalAllocationAssetFoundation_ !== 'function' ||
      typeof readCapitalAllocationInvestments_ !== 'function' ||
      typeof capitalAllocationMinimumWeeklyCommitment_ !== 'function') {
    investmentsUnavailable = true;
  } else {
    try {
      var investments = readCapitalAllocationInvestments_(
        ss, readCapitalAllocationAssetFoundation_(ss));
      (investments || []).forEach(function(account) {
        var weekly = capitalAllocationMinimumWeeklyCommitment_(account);
        var requested = Number(account.requestedWeeklyPace) || 0;
        if (weekly > 0 || requested > 0) {
          policyFloors.push({
            accountName: account.accountName,
            weeklyAmount: weekly,
            requestedWeeklyPace: requested
          });
        }
      });
    } catch (e3) {
      investmentsUnavailable = true;
      policyFloors = [];
    }
  }

  var asOfDate = new Date();
  var reserveKnown = false;
  var requiredReserveAmount = null;
  var reserveUpcomingAmount = null;
  var reserveUnavailableReason = '';
  try {
    if (typeof readCapitalAllocationFacts_ !== 'function') {
      reserveUnavailableReason =
        'This Week’s canonical reserve reader is unavailable. A bills-only proxy was not used.';
    } else {
      var facts = readCapitalAllocationFacts_(ss, asOfDate);
      var reserve = debtPayoffReserveFromCanonicalForecast_(facts && facts.forecast90);
      if (reserve.ok) {
        reserveKnown = true;
        requiredReserveAmount = reserve.amount;
        reserveUpcomingAmount = reserve.breakdown && reserve.breakdown.futureUpcomingAmount;
      } else {
        reserveUnavailableReason = reserve.reason;
      }
    }
  } catch (e4) {
    reserveUnavailableReason =
      'This Week’s canonical reserve, including upcoming expenses and property contingency, could not be read.';
  }

  var upcomingRead = readDebtPayoffUpcomingObligations_(ss);
  var billsResult = readDebtPayoffSupportedMonthlyExtraBills_(ss, policyFloors);
  if (!billsResult.unavailable) {
    attachDebtPayoffVariableBillHistory_(ss, billsResult.rows, asOfDate);
  }
  return {
    asOfDate: asOfDate,
    recurringIncomeSources: incomeRead.sources,
    incomeUnavailable: incomeRead.unavailable,
    incomeCadenceUnconfirmed: incomeRead.cadenceUnconfirmed,
    incomeCadenceReason: incomeRead.cadenceReason,
    incomeIncompleteRows: incomeRead.incompleteRows || [],
    datedBonusScenario: incomeRead.datedBonusScenario || null,
    debts: debts || [],
    bills: billsResult.rows,
    billsUnavailable: billsResult.unavailable,
    billsUnavailableReason: billsResult.reason,
    policyFloors: policyFloors,
    investmentsUnavailable: investmentsUnavailable,
    usableCashAfterBuffers: usableCashAfterBuffers,
    usableCashKnown: usableCashKnown,
    reserveKnown: reserveKnown,
    requiredReserveAmount: requiredReserveAmount,
    reserveUpcomingAmount: reserveUpcomingAmount,
    reserveUnavailableReason: reserveUnavailableReason,
    upcomingExpenses: upcomingRead.rows || [],
    upcomingUnavailable: upcomingRead.ok === false,
    upcomingUnavailableReason: upcomingRead.reason || '',
    upcomingLocation: upcomingRead.location || DEBT_PAYOFF_CASH_SAFETY_LOCATION_
  };
}

function readDebtPayoffSupportedMonthlyExtra_(ss, debts, accounts) {
  return buildDebtPayoffSupportedMonthlyExtra_(
    collectDebtPayoffSupportedMonthlyExtraInput_(ss, debts, accounts));
}

function cloneDebtPayoffSupportedExtraInput_(input) {
  input = input || {};
  return {
    asOfDate: input.asOfDate,
    recurringIncomeSources: (input.recurringIncomeSources || []).slice(),
    incomeUnavailable: input.incomeUnavailable,
    incomeCadenceUnconfirmed: input.incomeCadenceUnconfirmed,
    incomeCadenceReason: input.incomeCadenceReason,
    incomeIncompleteRows: (input.incomeIncompleteRows || []).slice(),
    datedBonusScenario: input.datedBonusScenario || null,
    debts: (input.debts || []).slice(),
    bills: (input.bills || []).slice(),
    billsUnavailable: input.billsUnavailable,
    billsUnavailableReason: input.billsUnavailableReason,
    policyFloors: (input.policyFloors || []).slice(),
    investmentsUnavailable: input.investmentsUnavailable,
    usableCashAfterBuffers: input.usableCashAfterBuffers,
    usableCashKnown: input.usableCashKnown,
    reserveKnown: input.reserveKnown,
    requiredReserveAmount: input.requiredReserveAmount,
    reserveUpcomingAmount: input.reserveUpcomingAmount,
    reserveUnavailableReason: input.reserveUnavailableReason,
    upcomingExpenses: (input.upcomingExpenses || []).slice(),
    upcomingUnavailable: input.upcomingUnavailable,
    upcomingUnavailableReason: input.upcomingUnavailableReason,
    upcomingLocation: input.upcomingLocation,
    pausePolicyFloors: false,
    hypotheticalCommitmentReductionMonthly: 0,
    hypotheticalAdjustments: null
  };
}

function debtPayoffCashFlowScenarioSnapshot_(supported) {
  var picture = (supported && supported.cashPicture) || {};
  var components = (supported && supported.components) || {};
  return {
    available: !!(supported && supported.available === true),
    amount: supported && supported.amount != null ? supported.amount : null,
    shortfall: picture.shortfall != null ? picture.shortfall : 0,
    surplus: picture.surplus != null ? picture.surplus : null,
    recurringIncomeMonthly: components.recurringIncomeMonthly,
    policyFloorMonthly: components.policyFloorMonthly,
    usableCashAfterBuffers: supported ? supported.usableCashAfterBuffers : null,
    requiredReserveAmount: supported ? supported.requiredReserveAmount : null,
    reserveProtects: !!(supported && supported.reserveProtects === true),
    futureReserveProtects: !!(supported && supported.futureReserveProtects === true),
    deficit: !!(supported && supported.deficit === true),
    policyFloorTreatment: supported && supported.policyFloorTreatment
      ? supported.policyFloorTreatment
      : 'STANDING_WEEKLY_FLOOR_TIMES_52_DIV_12',
    policyFloorsIncluded: !(supported && supported.policyFloorsIncluded === false)
  };
}

function debtPayoffHypotheticalCashFlowBlocker_(supported) {
  if (!supported || supported.available !== true) {
    var blockers = (supported && supported.blockers) || [];
    var first = blockers[0];
    return (first && (first.reason || first.code)) ||
      'A supported extra cannot be proven from the hypothetical facts.';
  }
  if (supported.deficit === true) {
    return 'Hypothetical recurring commitments still exceed recurring income, so extra stays $0.00.';
  }
  if (supported.reserveProtects === true) {
    return 'Hypothetical recurring surplus is not enough: usable cash after buffers still does not cover This Week’s canonical reserve, so extra stays $0.00.';
  }
  if (supported.futureReserveProtects === true) {
    return (supported.cashSafety && supported.cashSafety.reason) ||
      'The reserve forecast still fails after the hypothetical change, so extra stays $0.00.';
  }
  if (!(Number(supported.amount) > 0.005)) {
    return 'The hypothetical change does not leave a safe recurring extra.';
  }
  return '';
}

function buildDebtPayoffHypotheticalCashFlowScenario_(input, baselineSupported, scenarioPlan) {
  scenarioPlan = scenarioPlan || parseDebtPayoffHypotheticalCashFlowScenario_(null);
  var baseline = debtPayoffCashFlowScenarioSnapshot_(baselineSupported);
  var empty = {
    applied: false,
    useForComparison: false,
    hypothetical: true,
    persisted: false,
    amount: 0,
    blocker: '',
    adjustments: scenarioPlan,
    baseline: baseline,
    result: null,
    oneTimeBonusIncome: scenarioPlan && scenarioPlan.oneTimeBonusIncome
      ? scenarioPlan.oneTimeBonusIncome
      : 0,
    oneTimeBonusCountedInRecurringIncome: false,
    oneTimeBonusCountedInReserve: false,
    policyFloorsIncludedInBaseline: true,
    policyFloorsPausedInScenario: false
  };
  if (!scenarioPlan || scenarioPlan.ok === false || scenarioPlan.applied !== true) {
    return empty;
  }
  if (!input) {
    empty.applied = true;
    empty.useForComparison = scenarioPlan.useForComparison === true;
    empty.blocker = 'Saved cash-flow facts were not available for this hypothetical.';
    empty.oneTimeBonusIncome = scenarioPlan.oneTimeBonusIncome || 0;
    return empty;
  }
  var adjusted = cloneDebtPayoffSupportedExtraInput_(input);
  if (scenarioPlan.recurringIncomeIncrease > 0.005) {
    adjusted.recurringIncomeSources = adjusted.recurringIncomeSources.concat([{
      rawPayee: DEBT_PAYOFF_HYPOTHETICAL_INCOME_LABEL_,
      name: DEBT_PAYOFF_HYPOTHETICAL_INCOME_LABEL_,
      recurringConfirmed: true,
      cadenceKnown: true,
      frequency: 'monthly',
      expectedAmount: scenarioPlan.recurringIncomeIncrease,
      amountKnown: true,
      hypothetical: true
    }]);
  }
  if (scenarioPlan.commitmentIncrease > 0.005) {
    adjusted.bills = adjusted.bills.concat([{
      payee: DEBT_PAYOFF_HYPOTHETICAL_COMMITMENT_LABEL_,
      amount: scenarioPlan.commitmentIncrease,
      amountKnown: true,
      frequency: 'monthly',
      active: true,
      varies: 'No',
      hypothetical: true
    }]);
  }
  if (scenarioPlan.pausePolicyFloors === true) {
    adjusted.pausePolicyFloors = true;
  }
  if (scenarioPlan.commitmentReduction > 0.005) {
    adjusted.hypotheticalCommitmentReductionMonthly =
      scenarioPlan.commitmentReduction;
  }
  adjusted.hypotheticalAdjustments = {
    recurringIncomeIncrease: scenarioPlan.recurringIncomeIncrease,
    commitmentReduction: scenarioPlan.commitmentReduction,
    commitmentIncrease: scenarioPlan.commitmentIncrease,
    oneTimeBonusIncome: scenarioPlan.oneTimeBonusIncome,
    pausePolicyFloors: scenarioPlan.pausePolicyFloors === true,
    oneTimeBonusCountedInRecurringIncome: false,
    oneTimeBonusCountedInReserve: false
  };
  var result = buildDebtPayoffSupportedMonthlyExtra_(adjusted);
  var amount = result && result.available === true ? round2_(Number(result.amount) || 0) : 0;
  var blocker = debtPayoffHypotheticalCashFlowBlocker_(result);
  return {
    applied: true,
    useForComparison: scenarioPlan.useForComparison === true,
    hypothetical: true,
    persisted: false,
    amount: amount,
    blocker: blocker,
    adjustments: scenarioPlan,
    baseline: baseline,
    result: result,
    cashPicture: result && result.cashPicture || null,
    reserveProtects: !!(result && result.reserveProtects),
    futureReserveProtects: !!(result && result.futureReserveProtects),
    deficit: !!(result && result.deficit),
    usableCashAfterBuffers: result ? result.usableCashAfterBuffers : null,
    requiredReserveAmount: result ? result.requiredReserveAmount : null,
    remainingAboveReserve: result && result.cashSafety
      ? result.cashSafety.remainingAboveReserve
      : null,
    oneTimeBonusIncome: scenarioPlan.oneTimeBonusIncome || 0,
    oneTimeBonusCountedInRecurringIncome: false,
    oneTimeBonusCountedInReserve: false,
    policyFloorsIncludedInBaseline: true,
    policyFloorsPausedInScenario: scenarioPlan.pausePolicyFloors === true,
    policyFloorTreatment: result && result.policyFloorTreatment
      ? result.policyFloorTreatment
      : (scenarioPlan.pausePolicyFloors === true
        ? 'HYPOTHETICAL_PAUSE'
        : 'STANDING_WEEKLY_FLOOR_TIMES_52_DIV_12')
  };
}

function readDebtPayoffSupportedMonthlyExtraIncome_(ss) {
  var missingCadence =
    'INPUT - Cash Flow has no Recurring, Frequency, and Expected Amount confirmation. ' +
    'A monthly amount was not inferred from positive months. Add Recurring, Frequency, ' +
    'and Expected Amount on the existing Cash Flow tab (no new tab).';
  var emptyBonus = typeof debtPayoffParseCiscoBonusScenario_ === 'function'
    ? debtPayoffParseCiscoBonusScenario_([], [])
    : null;
  // Read-only. Never self-heal schema here; the estimate must not write.
  try {
    if (typeof findLatestCashFlowYearWithIncome_ !== 'function' ||
        typeof getCashFlowSheet_ !== 'function') {
      return {
        unavailable: true,
        cadenceUnconfirmed: false,
        sources: [],
        datedBonusScenario: emptyBonus
      };
    }
    var year = findLatestCashFlowYearWithIncome_(ss);
    if (year == null) {
      return {
        unavailable: true,
        cadenceUnconfirmed: false,
        sources: [],
        datedBonusScenario: emptyBonus
      };
    }
    var sheet = getCashFlowSheet_(ss, year);
    var range = sheet.getDataRange();
    var display = range.getDisplayValues();
    var values = range.getValues();
    if (!display || display.length < 2) {
      return {
        unavailable: true,
        cadenceUnconfirmed: false,
        sources: [],
        datedBonusScenario: emptyBonus
      };
    }
    var bonusScenario = debtPayoffParseCiscoBonusScenario_(display, values);
    var parsed = debtPayoffParseConfirmedCashFlowIncome_(display, values);
    if (parsed.cadenceUnconfirmed) {
      return {
        unavailable: false,
        cadenceUnconfirmed: true,
        cadenceReason: parsed.reason || missingCadence,
        incompleteRows: parsed.incompleteRows || [],
        sources: [],
        datedBonusScenario: bonusScenario
      };
    }
    return {
      unavailable: false,
      cadenceUnconfirmed: false,
      incompleteRows: [],
      sources: parsed.sources,
      datedBonusScenario: bonusScenario
    };
  } catch (e) {
    return {
      unavailable: true,
      cadenceUnconfirmed: false,
      sources: [],
      datedBonusScenario: emptyBonus
    };
  }
}

var DEBT_PAYOFF_CISCO_BONUS_COMPARISON_CONSTRAINT_ =
  'Cisco Mid Year Bonus and Cisco End Year Bonus are separate annual cash flows. ' +
  'They are not added to recurring monthly income, are not used for the 90-day reserve, ' +
  'and are not applied until you include them in the strategy comparison and enter the next payment month and year. ' +
  'Timing is not inferred from the row name or a historical payment month. ' +
  'RSU/ESPP sales, Other Stock Sales, and tax refunds stay excluded.';

function debtPayoffCiscoBonusScenarioBase_() {
  return {
    identityKnown: false,
    identityName: 'Cisco Bonus',
    appliedToComparison: false,
    countedInRecurringIncomeMonthly: false,
    countedInReserve: false,
    comparisonConstraint: DEBT_PAYOFF_CISCO_BONUS_COMPARISON_CONSTRAINT_,
    annualizedMonthlyEquivalent: null,
    annualizedMonthlyEquivalentLabel:
      'This annualized monthly equivalent is an estimate only. It is not cash available each month, is not added to the recurring extra estimate, and is not used to satisfy the 90-day cash reserve.',
    payments: [],
    reviewReasons: [],
    withheld: true
  };
}

function debtPayoffCiscoBonusPayment_(name, extras) {
  extras = extras || {};
  var known = extras.known === true;
  var amount = known ? round2_(Number(extras.amount) || 0) : null;
  return {
    name: name,
    amount: amount,
    known: known,
    included: extras.included === true,
    withholdReason: extras.withholdReason || '',
    monthlyEquivalentEstimate: known ? round2_(amount / 12) : null
  };
}

/**
 * Independent Cisco Mid Year Bonus and Cisco End Year Bonus review.
 * Each payment is one annual Cash Flow income row using Recurring,
 * Frequency = Yearly, and Expected Amount. Never converts either amount
 * into stable monthly income, never uses it for the 90-day reserve, and
 * never auto-applies it to the strategy comparison.
 */
function debtPayoffParseCiscoBonusScenario_(display, values) {
  display = display || [];
  values = values || display;
  var result = debtPayoffCiscoBonusScenarioBase_();
  var headers = (display[0] || []).map(function(value) {
    return String(value || '').trim();
  });
  function col(name) {
    var want = String(name || '').trim().toLowerCase();
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim().toLowerCase() === want) return i;
    }
    return -1;
  }
  var typeCol = col('Type');
  var payeeCol = col('Payee');
  var activeCol = col('Active');
  var recurringCol = col('Recurring');
  var frequencyCol = col('Frequency');
  var expectedCol = col('Expected Amount');

  if (typeCol === -1 || payeeCol === -1) {
    result.reviewReasons.push(
      'Cisco Bonus identity is ambiguous because Cash Flow Type and Payee headers are missing. Cisco Mid Year Bonus and Cisco End Year Bonus amounts were withheld.'
    );
    return result;
  }

  var named = { mid: [], end: [] };
  var leftover = [];
  for (var r = 1; r < display.length; r++) {
    if (String(display[r][typeCol] || '').trim().toLowerCase() !== 'income') continue;
    if (activeCol !== -1 && String(display[r][activeCol] || '').trim() &&
        normalizeYesNo_(display[r][activeCol]) === 'no') continue;
    var rawPayee = String(display[r][payeeCol] || '').trim();
    if (!rawPayee) continue;
    var entry = {
      sheetRow: r + 1,
      rawPayee: rawPayee,
      displayRow: display[r],
      valueRow: (values[r] || [])
    };
    if (typeof isCiscoMidYearBonusIncomeName_ === 'function' &&
        isCiscoMidYearBonusIncomeName_(rawPayee)) {
      named.mid.push(entry);
    } else if (typeof isCiscoEndYearBonusIncomeName_ === 'function' &&
        isCiscoEndYearBonusIncomeName_(rawPayee)) {
      named.end.push(entry);
    } else if (typeof isLegacyCiscoBonusIncomeName_ === 'function' &&
        isLegacyCiscoBonusIncomeName_(rawPayee)) {
      leftover.push(entry);
    }
  }

  if (!named.mid.length && !named.end.length && !leftover.length) {
    result.reviewReasons.push(
      'Cisco Mid Year Bonus and Cisco End Year Bonus were not found as distinct Cash Flow income identities. Annual bonus amounts were withheld.'
    );
    return result;
  }

  result.identityKnown = named.mid.length > 0 || named.end.length > 0 || leftover.length > 0;
  result.identityName = leftover.length && !named.mid.length && !named.end.length
    ? 'Cisco Bonus'
    : 'Cisco Mid Year Bonus and Cisco End Year Bonus';
  result.rawPayees = named.mid.concat(named.end).concat(leftover).map(function(row) {
    return row.rawPayee;
  });
  result.historyRowCount = result.rawPayees.length;

  if (leftover.length && (!named.mid.length || !named.end.length)) {
    result.reviewReasons.push(
      'Split the existing Cisco Bonus entry into Cisco Mid Year Bonus and Cisco End Year Bonus from Manage Income. History was not guessed and annual bonus amounts were withheld.'
    );
  } else if (leftover.length) {
    result.reviewReasons.push(
      'A leftover Cisco Bonus row is still present. It was not added to Cisco Mid Year Bonus or Cisco End Year Bonus, so amounts are not counted twice.'
    );
  }

  function reviewNamed_(label, matcherName, rows) {
    if (!rows.length) {
      return debtPayoffCiscoBonusPayment_(label, {
        known: false,
        included: false,
        withholdReason: label +
          ' was not found as a Cash Flow income row. Timing was not inferred from a month field.'
      });
    }
    if (rows.length > 1) {
      return debtPayoffCiscoBonusPayment_(label, {
        known: false,
        included: false,
        withholdReason: 'Multiple ' + label +
          ' income rows exist, so that annual amount was withheld instead of counted twice.'
      });
    }
    var row = rows[0];
    var recurring = typeof debtPayoffParseRecurringStatus_ === 'function'
      ? debtPayoffParseRecurringStatus_(recurringCol >= 0 ? row.displayRow[recurringCol] : '')
      : 'unknown';
    var frequency = frequencyCol >= 0 && typeof normalizeFrequency_ === 'function'
      ? normalizeFrequency_(row.displayRow[frequencyCol])
      : 'unknown';
    var amountKnown = expectedCol >= 0 && typeof debtMinimumPaymentCellIsKnown_ === 'function'
      ? debtMinimumPaymentCellIsKnown_(row.valueRow[expectedCol], row.displayRow[expectedCol])
      : expectedCol >= 0 && String(row.displayRow[expectedCol] || '').trim() !== '';
    if (recurring !== 'yes') {
      return debtPayoffCiscoBonusPayment_(label, {
        known: false,
        included: false,
        withholdReason: label + ' row ' + row.sheetRow +
          ' has no Recurring=Yes confirmation, so that annual payment was withheld.'
      });
    }
    if (frequency !== 'yearly') {
      return debtPayoffCiscoBonusPayment_(label, {
        known: false,
        included: false,
        withholdReason: label + ' row ' + row.sheetRow +
          ' is not Yearly, so the amount was not treated as stable monthly income and was withheld.'
      });
    }
    if (amountKnown !== true) {
      return debtPayoffCiscoBonusPayment_(label, {
        known: false,
        included: false,
        withholdReason: label +
          ' Expected Amount is blank (unknown). Blank was not treated as $0.'
      });
    }
    return debtPayoffCiscoBonusPayment_(label, {
      known: true,
      included: leftover.length && (!named.mid.length || !named.end.length) ? false : true,
      amount: toNumber_(row.valueRow[expectedCol])
    });
  }

  var midPayee = typeof CISCO_MID_YEAR_BONUS_PAYEE_ !== 'undefined'
    ? CISCO_MID_YEAR_BONUS_PAYEE_ : 'Cisco Mid Year Bonus';
  var endPayee = typeof CISCO_END_YEAR_BONUS_PAYEE_ !== 'undefined'
    ? CISCO_END_YEAR_BONUS_PAYEE_ : 'Cisco End Year Bonus';
  var mid = reviewNamed_(midPayee, 'mid', named.mid);
  var end = reviewNamed_(endPayee, 'end', named.end);
  if (leftover.length && (!named.mid.length || !named.end.length)) {
    mid.included = false;
    end.included = false;
  }
  result.payments = [mid, end];
  if (mid.withholdReason) result.reviewReasons.push(mid.withholdReason);
  if (end.withholdReason) result.reviewReasons.push(end.withholdReason);
  var knownSum = 0;
  var knownCount = 0;
  result.payments.forEach(function(payment) {
    if (payment.included === true && payment.known === true) {
      knownSum = round2_(knownSum + Number(payment.amount || 0));
      knownCount += 1;
    }
  });
  result.annualizedMonthlyEquivalent = knownCount
    ? round2_(knownSum / 12)
    : null;
  result.countedInRecurringIncomeMonthly = false;
  result.countedInReserve = false;
  result.appliedToComparison = false;
  result.withheld = result.reviewReasons.length > 0;
  return result;
}

function debtPayoffParseConfirmedCashFlowIncome_(display, values) {
  display = display || [];
  values = values || display;
  var headers = (display[0] || []).map(function(value) {
    return String(value || '').trim().toLowerCase();
  });
  function col(name) { return headers.indexOf(String(name || '').toLowerCase()); }
  var typeCol = col('Type');
  var payeeCol = col('Payee');
  var activeCol = col('Active');
  var recurringCol = col('Recurring');
  var frequencyCol = col('Frequency');
  var expectedCol = col('Expected Amount');
  if (typeCol === -1 || payeeCol === -1) {
    return {
      cadenceUnconfirmed: true,
      reason: 'Cash Flow Type and Payee headers are required before income can be confirmed.',
      incompleteRows: [],
      sources: []
    };
  }

  function listActiveIncomeNeedingForecast_(missing) {
    var listed = [];
    var seen = {};
    for (var r = 1; r < display.length; r++) {
      if (String(display[r][typeCol] || '').trim().toLowerCase() !== 'income') continue;
      if (activeCol !== -1 && String(display[r][activeCol] || '').trim() &&
          normalizeYesNo_(display[r][activeCol]) === 'no') continue;
      var payee = String(display[r][payeeCol] || '').trim();
      if (!payee || debtPayoffRawIncomeIsExcluded_(payee)) continue;
      var key = debtPayoffIncomeGroupKey_(payee);
      if (seen[key]) {
        seen[key].rawPayees.push(payee);
        continue;
      }
      var displayName = (typeof normalizeIncomeName_ === 'function'
        ? (normalizeIncomeName_(payee) || payee)
        : payee);
      seen[key] = {
        sheetRow: r + 1,
        payee: displayName,
        rawPayees: [payee],
        missing: missing.slice()
      };
      listed.push(seen[key]);
    }
    return listed;
  }

  if (recurringCol === -1 || frequencyCol === -1 || expectedCol === -1) {
    var missingHeaders = [];
    if (recurringCol === -1) missingHeaders.push('Recurring');
    if (frequencyCol === -1) missingHeaders.push('Frequency');
    if (expectedCol === -1) missingHeaders.push('Expected Amount');
    var headerIncomplete = listActiveIncomeNeedingForecast_(missingHeaders);
    var headerReason = 'INPUT - Cash Flow has no Recurring, Frequency, and Expected Amount confirmation. ' +
      'A monthly amount was not inferred from positive months. Add Recurring, Frequency, ' +
      'and Expected Amount on the existing Cash Flow tab (no new tab).';
    if (headerIncomplete.length) {
      headerReason += ' ' + debtPayoffFormatIncompleteIncomeRows_(headerIncomplete);
    }
    return {
      cadenceUnconfirmed: true,
      reason: headerReason,
      incompleteRows: headerIncomplete,
      sources: []
    };
  }
  var groups = {};
  var groupOrder = [];
  for (var r = 1; r < display.length; r++) {
    if (String(display[r][typeCol] || '').trim().toLowerCase() !== 'income') continue;
    if (activeCol !== -1 && String(display[r][activeCol] || '').trim() &&
        normalizeYesNo_(display[r][activeCol]) === 'no') continue;
    var rawPayee = String(display[r][payeeCol] || '').trim();
    if (!rawPayee) continue;
    var key = debtPayoffIncomeGroupKey_(rawPayee);
    if (!groups[key]) {
      groups[key] = {
        displayName: (typeof normalizeIncomeName_ === 'function'
          ? (normalizeIncomeName_(rawPayee) || rawPayee)
          : rawPayee),
        rows: []
      };
      groupOrder.push(key);
    }
    var frequency = typeof normalizeFrequency_ === 'function'
      ? normalizeFrequency_(display[r][frequencyCol])
      : 'unknown';
    var expectedKnown = typeof debtMinimumPaymentCellIsKnown_ === 'function'
      ? debtMinimumPaymentCellIsKnown_(values[r][expectedCol], display[r][expectedCol])
      : String(display[r][expectedCol] || '').trim() !== '';
    groups[key].rows.push({
      sheetRow: r + 1,
      rawPayee: rawPayee,
      excluded: debtPayoffRawIncomeIsExcluded_(rawPayee),
      recurringStatus: debtPayoffParseRecurringStatus_(display[r][recurringCol]),
      frequency: frequency,
      expectedAmount: toNumber_(values[r][expectedCol]),
      amountKnown: expectedKnown
    });
  }

  var sources = [];
  var incompleteRows = [];
  for (var gi = 0; gi < groupOrder.length; gi++) {
    var collapsed = debtPayoffCollapseGroupForecast_(groups[groupOrder[gi]]);
    if (collapsed.skip) continue;
    if (collapsed.mixed && collapsed.source) {
      sources.push(collapsed.source);
      continue;
    }
    if (collapsed.incomplete && collapsed.incomplete.length) {
      incompleteRows = incompleteRows.concat(collapsed.incomplete);
      continue;
    }
    if (collapsed.source) sources.push(collapsed.source);
  }
  if (incompleteRows.length) {
    return {
      cadenceUnconfirmed: true,
      reason: debtPayoffFormatIncompleteIncomeRows_(incompleteRows) +
        ' Recurrence was not inferred from month values.',
      incompleteRows: incompleteRows,
      sources: []
    };
  }
  return { cadenceUnconfirmed: false, incompleteRows: [], sources: sources };
}

function readDebtPayoffSupportedMonthlyExtraBills_(ss, policyFloors) {
  var sheetNames = getSheetNames_();
  var sheet = ss.getSheetByName(sheetNames.BILLS);
  if (!sheet) return { unavailable: true, rows: [] };
  var range = sheet.getDataRange();
  var values = range.getValues();
  var display = range.getDisplayValues();
  if (display.length < 2) return { unavailable: false, rows: [] };
  var headers = (display[0] || []).map(function(value) {
    return String(value || '').trim().toLowerCase();
  });
  function col(name) { return headers.indexOf(String(name || '').toLowerCase()); }
  var payeeCol = col('Payee');
  var amountCol = col('Default Amount');
  var activeCol = col('Active');
  var frequencyCol = col('Frequency');
  var categoryCol = col('Category');
  var variesCol = col('Varies');
  var linkedPropertyCol = col('Linked Property');
  if (payeeCol === -1 || amountCol === -1 || activeCol === -1) {
    return {
      unavailable: true,
      reason: 'INPUT - Bills is missing required Payee, Default Amount, or Active headers.',
      rows: []
    };
  }
  if (variesCol === -1) {
    return {
      unavailable: true,
      reason: 'INPUT - Bills is missing the Varies column, so variable bills were not treated as fixed.',
      rows: []
    };
  }
  if (frequencyCol === -1) {
    return {
      unavailable: true,
      reason: 'INPUT - Bills is missing the Frequency column, so a monthly amount was not assumed.',
      rows: []
    };
  }
  var incomeProducingAccounts = (policyFloors || []).map(function(floor) {
    return { accountName: floor.accountName };
  });
  var rows = [];
  for (var r = 1; r < display.length; r++) {
    if (normalizeYesNo_(display[r][activeCol]) !== 'yes') continue;
    var payee = String(display[r][payeeCol] || '').trim();
    if (!payee) continue;
    var billMeta = {
      payee: payee,
      category: categoryCol === -1 ? '' : String(display[r][categoryCol] || '').trim()
    };
    var investment = { isInvestmentContribution: false, accountName: '' };
    if (typeof capitalAllocationClassifyInvestmentContribution_ === 'function') {
      investment = capitalAllocationClassifyInvestmentContribution_(
        billMeta, incomeProducingAccounts);
    }
    var amountKnown = typeof debtMinimumPaymentCellIsKnown_ === 'function'
      ? debtMinimumPaymentCellIsKnown_(values[r][amountCol], display[r][amountCol])
      : String(display[r][amountCol] || '').trim() !== '';
    var frequency = frequencyCol === -1 ? 'unknown'
      : (typeof normalizeFrequency_ === 'function'
        ? normalizeFrequency_(display[r][frequencyCol])
        : 'unknown');
    rows.push({
      payee: payee,
      amount: toNumber_(values[r][amountCol]),
      amountKnown: amountKnown,
      frequency: frequency,
      varies: variesCol === -1 ? '' : String(display[r][variesCol] || '').trim(),
      category: billMeta.category,
      linkedProperty: linkedPropertyCol === -1
        ? ''
        : String(display[r][linkedPropertyCol] || '').trim(),
      active: true,
      isInvestmentContribution: investment.isInvestmentContribution === true,
      matchedInvestmentAccount: investment.accountName || ''
    });
  }
  return { unavailable: false, rows: rows };
}
