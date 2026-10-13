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
function getDebtPayoffReadData() {
  const ss = getUserSpreadsheet_();
  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const y = getCurrentYear_();
  const projectionYears = [y - 1, y];

  // Blank-workbook safety: on a fresh sheet INPUT - Debts / SYS - Accounts
  // don't exist yet and readSheetAsObjects_ -> getSheet_() would throw a
  // red banner on Debt Overview. Return the same shape with empty rows
  // and zeroed summary so the page renders clean. The populated path
  // below is unchanged.
  const sheetNames = getSheetNames_();
  if (
    !ss.getSheetByName(sheetNames.DEBTS) ||
    !ss.getSheetByName(sheetNames.ACCOUNTS)
  ) {
    return {
      projectionYears: projectionYears,
      debts: [],
      summary: {
        totalDebtBalance: 0,
        totalMinimumPayments: 0,
        usableCashAfterBuffers: 0,
        totalAvailableNow: 0,
        totalBuffers: 0,
        projectedMonthNetCashFlow: 0,
        longestRoughPayoff: null,
        payoffMethodNote:
          'Loan & HELOC: estimated months use a monthly amortization loop (interest on remaining balance, then principal). Other types: balance ÷ minimum payment (rough). If payment ≤ monthly interest on a loan, payoff is shown as unavailable.'
      },
      recommendations: [],
      warnings: [],
      missingCashFlowSheets: [],
      supportedMonthlyExtra: debtPayoffSupportedMonthlyExtraUnavailable_(
        'INPUT - Debts or SYS - Accounts is missing.')
    };
  }

  const debtRows = readSheetAsObjects_(ss, 'DEBTS');
  const accountRows = readSheetAsObjects_(ss, 'ACCOUNTS');
  const aliasMap = getAliasMap_();
  const debts = normalizeDebts_(debtRows, aliasMap);
  const accounts = normalizeAccounts_(accountRows);
  const usableCash = calculateUsableCash_(accounts);

  const minimumDueTotal = round2_(
    debts.filter(function(d) {
      return d.active;
    }).reduce(function(sum, d) {
      return sum + d.minimumPayment;
    }, 0)
  );

  let thisMonthCashFlow = 0;
  try {
    const cashFlowRows = readCashFlowSheetAsObjects_(ss, y);
    const monthHeader = getCurrentMonthHeader_(today, tz);
    const cashFlow = normalizeCashFlow_(cashFlowRows, monthHeader, aliasMap);
    thisMonthCashFlow = round2_(cashFlow.monthNet);
  } catch (e) {
    // ignore — recommendations will omit projected CF line
  }

  const warnings = [];
  const missingCashFlowSheets = [];

  // Debt Overview is an active-debts-only view. Stop-tracked debts (Active=No)
  // stay on INPUT - Debts for history + name reservation but should NOT appear
  // in the bar chart, table, or "longest payoff" callout here.
  const debtsOut = debts
    .filter(function(d) { return d.active; })
    .map(function(d) {
      const totalPaid = sumExpensePaymentsForDebtPayee_(ss, d.name, projectionYears, aliasMap, missingCashFlowSheets);
      const est = estimateRoughPayoffMonths_(d.balance, d.minimumPayment, d.interestRate, d.type);

      return {
        name: d.name,
        type: d.type,
        balance: d.balance,
        minimumPayment: d.minimumPayment,
        interestRate: d.interestRate,
        active: d.active,
        cashFlowPaid: totalPaid,
        estimatedPayoffMonths: est,
        payoffEstimateMethod: isLoanTypeForAmortization_(d.type) ? 'amortization' : 'simple',
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

  const summary = {
    totalDebtBalance: totalDebtBalance,
    totalMinimumPayments: minimumDueTotal,
    usableCashAfterBuffers: round2_(usableCash.usableAfterBuffers),
    totalAvailableNow: round2_(usableCash.totalAvailableNow),
    totalBuffers: round2_(usableCash.totalBuffers),
    projectedMonthNetCashFlow: thisMonthCashFlow,
    longestRoughPayoff: longest,
    payoffMethodNote:
      'Loan & HELOC: estimated months use a monthly amortization loop (interest on remaining balance, then principal). Other types: balance ÷ minimum payment (rough). If payment ≤ monthly interest on a loan, payoff is shown as unavailable.'
  };

  const recommendations = buildDebtPayoffRecommendations_({
    debts: debts,
    debtsOut: debtsOut,
    usableCash: usableCash,
    minimumDueTotal: minimumDueTotal,
    thisMonthCashFlow: thisMonthCashFlow,
    projectionYears: projectionYears,
    longest: longest
  });

  return {
    projectionYears: projectionYears,
    debts: debtsOut,
    summary: summary,
    recommendations: recommendations,
    warnings: warnings,
    missingCashFlowSheets: missingCashFlowSheets,
    supportedMonthlyExtra: readDebtPayoffSupportedMonthlyExtra_(ss, debts, accounts)
  };
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
function sumExpensePaymentsForDebtPayee_(ss, debtName, years, aliasMap, missingOut) {
  let totalPaid = 0;

  years.forEach(function(year) {
    let sheet;
    try {
      sheet = getCashFlowSheet_(ss, year);
    } catch (e) {
      const tabName = getCashFlowSheetName_(year);
      if (missingOut.indexOf(tabName) === -1) {
        missingOut.push(tabName);
      }
      return;
    }

    const lastCol = sheet.getLastColumn();
    if (lastCol < 2) return;

    const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    let headerMap;
    try {
      headerMap = getCashFlowHeaderMap_(sheet);
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
    const target = String(debtName || '').trim();

    for (let r = 1; r < values.length; r++) {
      const type = String(values[r][headerMap.typeColZero] || '').trim();
      if (type !== 'Expense') continue;

      const payee = normalizeName_(String(values[r][headerMap.payeeColZero] || ''), aliasMap);
      if (payee !== target) continue;

      monthColZero.forEach(function(c) {
        totalPaid += Math.abs(toNumber_(values[r][c]));
      });
    }
  });

  return round2_(totalPaid);
}

/** Months of hypothetical extra-payoff forecast. Same cap as Overview amortization. */
var DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_ = 600;
var DEBT_PAYOFF_SCENARIO_ZERO_BAL_ = 0.005;

/**
 * Read-only household strategy comparison from current INPUT - Debts.
 * payload.monthlyExtra is the only extra input. It is never inferred from
 * This Week, never persisted, and is not an affordability proof.
 */
var DEBT_PAYOFF_SCENARIO_EXTRA_INVALID_ =
  'Enter a valid monthly extra of $0.00 or more. Negative and non-numeric amounts are not used.';

function getDebtPayoffStrategyComparison(payload) {
  payload = payload || {};
  const parsed = parseDebtPayoffScenarioMonthlyExtra_(payload.monthlyExtra);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const monthlyExtra = parsed.amount;
  const today = new Date();
  const ss = getUserSpreadsheet_();
  const sheetNames = getSheetNames_();
  if (!ss.getSheetByName(sheetNames.DEBTS)) {
    var empty = compareDebtPayoffStrategies_([], monthlyExtra, { asOfDate: today });
    empty.supportedMonthlyExtra = debtPayoffSupportedMonthlyExtraUnavailable_(
      'INPUT - Debts is missing.');
    return empty;
  }
  const debtRows = readSheetAsObjects_(ss, 'DEBTS');
  const aliasMap = getAliasMap_();
  const debts = normalizeDebts_(debtRows, aliasMap);
  var comparison = compareDebtPayoffStrategies_(debts, monthlyExtra, { asOfDate: today });
  var accountRows = [];
  try {
    if (ss.getSheetByName(sheetNames.ACCOUNTS)) {
      accountRows = readSheetAsObjects_(ss, 'ACCOUNTS');
    }
  } catch (e) {
    accountRows = [];
  }
  comparison.supportedMonthlyExtra = readDebtPayoffSupportedMonthlyExtra_(
    ss, debts, normalizeAccounts_(accountRows));
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
  const balance = Number(debt.balance) || 0;
  const minPay = Number(debt.minimumPayment) || 0;
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

function debtPayoffScenarioSortTargets_(debts, strategy) {
  const rows = (debts || []).slice();
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

function debtPayoffScenarioAssumptions_(monthlyExtra, horizonMonths) {
  return [
    'This is a hypothetical scenario. The extra amount is not saved, is not a payment, and is not proof that the extra is affordable.',
    'Monthly extra applied to avalanche and snowball: ' +
      fmtCurrency_(monthlyExtra) +
      '. Minimum-only uses $0.00 extra.',
    'The comparison does not model future income, expenses, cash reserves, or changing rates.',
    'Contractual minimums are held at the current recorded amount for every forecast month (estimate).',
    'Interest each month is remaining balance × (APR ÷ 100 ÷ 12), rounded to cents, then payments apply.',
    'Forecast horizon is ' +
      horizonMonths +
      ' months. A household that still has a balance after that is reported as not within the forecast horizon.',
    'Only debts with a remaining balance and usable APR and minimum-payment inputs are modeled.'
  ];
}

function copyDebtPayoffScenarioWorkingDebts_(debts) {
  return (debts || []).map(function(debt) {
    return {
      name: String(debt.name || ''),
      type: String(debt.type || ''),
      balance: round2_(debt.balance),
      minimumPayment: round2_(debt.minimumPayment),
      interestRate: round2_(debt.interestRate)
    };
  });
}

/**
 * Month-loop payoff path. strategy: 'minimum_only' | 'avalanche' | 'snowball'.
 * Extra is applied only after every modeled debt receives its current minimum.
 */
function simulateDebtPayoffSchedule_(normalizedDebts, monthlyTotalToExtra, strategy, options) {
  options = options || {};
  const horizon = Number(options.horizonMonths) > 0
    ? Number(options.horizonMonths)
    : DEBT_PAYOFF_SCENARIO_HORIZON_MONTHS_;
  const extra = strategy === 'minimum_only'
    ? 0
    : Math.max(0, round2_(monthlyTotalToExtra));
  const asOfDate = options.asOfDate;
  const working = copyDebtPayoffScenarioWorkingDebts_(normalizedDebts);
  const extraPriorityOrder = strategy === 'minimum_only'
    ? []
    : debtPayoffScenarioSortTargets_(working, strategy).map(function(row) {
        return row.name;
      });
  const cannotAmortizeAtMinimum = working.filter(debtPayoffScenarioCannotAmortizeAtMinimum_)
    .map(function(row) { return row.name; });
  const emptyResult = {
    strategy: strategy,
    monthlyExtra: extra,
    debtFreeWithinHorizon: false,
    debtFreeMonthIndex: null,
    debtFreeMonthKey: null,
    totalInterest: 0,
    payoffOrder: [],
    extraPriorityOrder: extraPriorityOrder,
    cannotAmortizeAtMinimum: cannotAmortizeAtMinimum,
    remainingBalance: 0,
    remainingDebtNames: []
  };
  if (!working.length) return emptyResult;
  const payoffOrder = [];
  let totalInterest = 0;
  let remaining = working.slice();

  for (let m = 1; m <= horizon; m++) {
    remaining.forEach(function(d) {
      const interest = debtPayoffScenarioMonthlyInterest_(d.balance, d.interestRate);
      totalInterest = round2_(totalInterest + interest);
      d.balance = round2_(d.balance + interest);
    });

    remaining.forEach(function(d) {
      const pay = Math.min(Math.max(0, Number(d.minimumPayment) || 0), d.balance);
      d.balance = round2_(d.balance - pay);
    });

    if (extra > DEBT_PAYOFF_SCENARIO_ZERO_BAL_) {
      let leftover = extra;
      const targets = debtPayoffScenarioSortTargets_(
        remaining.filter(function(d) { return d.balance > DEBT_PAYOFF_SCENARIO_ZERO_BAL_; }),
        strategy
      );
      for (let t = 0; t < targets.length && leftover > DEBT_PAYOFF_SCENARIO_ZERO_BAL_; t++) {
        const pay = Math.min(leftover, targets[t].balance);
        targets[t].balance = round2_(targets[t].balance - pay);
        leftover = round2_(leftover - pay);
      }
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
        return;
      }
      stillOpen.push(d);
    });
    remaining = stillOpen;
    if (!remaining.length) {
      return {
        strategy: strategy,
        monthlyExtra: extra,
        debtFreeWithinHorizon: true,
        debtFreeMonthIndex: m,
        debtFreeMonthKey: debtPayoffScenarioMonthKey_(asOfDate, m),
        totalInterest: round2_(totalInterest),
        payoffOrder: payoffOrder,
        extraPriorityOrder: extraPriorityOrder,
        cannotAmortizeAtMinimum: cannotAmortizeAtMinimum,
        remainingBalance: 0,
        remainingDebtNames: []
      };
    }
  }

  return {
    strategy: strategy,
    monthlyExtra: extra,
    debtFreeWithinHorizon: false,
    debtFreeMonthIndex: null,
    debtFreeMonthKey: null,
    totalInterest: round2_(totalInterest),
    payoffOrder: payoffOrder,
    extraPriorityOrder: extraPriorityOrder,
    cannotAmortizeAtMinimum: cannotAmortizeAtMinimum,
    remainingBalance: round2_(remaining.reduce(function(sum, d) {
      return sum + Number(d.balance || 0);
    }, 0)),
    remainingDebtNames: remaining.map(function(d) { return d.name; })
  };
}

function summarizeDebtPayoffScenario_(result, minOnlyInterest) {
  const interestSaved = result.strategy === 'minimum_only'
    ? 0
    : round2_(Math.max(0, Number(minOnlyInterest || 0) - Number(result.totalInterest || 0)));
  return {
    strategy: result.strategy,
    monthlyExtra: result.monthlyExtra,
    payoffOrder: result.payoffOrder,
    extraPriorityOrder: result.extraPriorityOrder,
    debtFreeWithinHorizon: result.debtFreeWithinHorizon,
    debtFreeMonthIndex: result.debtFreeMonthIndex,
    debtFreeMonthKey: result.debtFreeMonthKey,
    totalInterest: result.totalInterest,
    interestSavedVsMinimumOnly: interestSaved,
    cannotAmortizeAtMinimum: result.cannotAmortizeAtMinimum,
    remainingBalance: result.remainingBalance,
    remainingDebtNames: result.remainingDebtNames
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
  const simOptions = {
    asOfDate: options.asOfDate,
    horizonMonths: horizonMonths
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
    householdComparisonComplete: classified.blockers.length === 0 && classified.modeled.length > 0,
    monthlyExtra: extra,
    horizonMonths: horizonMonths,
    asOfMonthKey: debtPayoffScenarioMonthKey_(options.asOfDate, 1),
    modeledDebtNames: classified.modeled.map(function(d) { return d.name; }),
    blockers: classified.blockers,
    assumptions: debtPayoffScenarioAssumptions_(extra, horizonMonths),
    strategies: {
      minimum_only: summarizeDebtPayoffScenario_(minOnly, minOnly.totalInterest),
      avalanche: summarizeDebtPayoffScenario_(avalanche, minOnly.totalInterest),
      snowball: summarizeDebtPayoffScenario_(snowball, minOnly.totalInterest)
    }
  };
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
  return { skip: false, monthlyAmount: monthly };
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

/**
 * Pure recurring-surplus estimate. Does not use This Week’s weekly extra,
 * current-month Cash Flow net, or Rolling Debt Payoff caps.
 */
function buildDebtPayoffSupportedMonthlyExtra_(input) {
  input = input || {};
  var blockers = [];
  var source =
    'Confirmed Cash Flow recurring income, INPUT - Bills scheduled amounts, INPUT - Debts known minimums, SYS - Accounts usable cash after buffers, standing investment policy floors, and This Week’s canonical reserve (including upcoming expenses and property contingency).';
  var assumptions = [
    'This amount is an estimate of recurring monthly surplus after required bills, known debt minimums, and standing investment policy floors.',
    'It is not This Week’s weekly extra, is not four times any weekly figure, and is not treated as affordable until you choose to use it.',
    'Only income with an explicit Recurring confirmation, a usable Frequency, and an Expected Amount is included. Each Manage Income group is one forecast: Expected Amount is per occurrence, converted by frequency (Biweekly = amount × 26 ÷ 12; Semi-monthly / twice monthly = amount × 24 ÷ 12). Multiple Cash Flow history rows in the same group are not multiplied. Bonus, RSU/ESPP, one-time, and variable sources are excluded from the raw payee before any name normalization. Historical averages are not used as Expected Amount.',
    'Protected cash is This Week’s canonical reserve, including upcoming expenses and property contingency. A bills-only three-month proxy is not used.',
    'Matching Bills for a tracked debt are counted only as the contractual minimum. A policy-floor bill is not added on top of the standing weekly floor converted at 52 ÷ 12.',
    'Cisco Mid Year Bonus and Cisco End Year Bonus are separate annual income rows with Recurring = Yes and Frequency = Yearly. They are not included in recurring monthly income, are not treated as cash available each month, are not used to satisfy the 90-day cash reserve, and are not applied to the strategy comparison. If a yearly amount is shown as a monthly equivalent, that figure is an estimate only.'
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

  var income = 0;
  (input.recurringIncomeSources || []).forEach(function(sourceRow) {
    var classified = debtPayoffClassifySupportedIncomeSource_(sourceRow);
    if (classified.skip) return;
    if (classified.blocker) {
      blockers.push(classified.blocker);
      return;
    }
    income = round2_(income + classified.monthlyAmount);
  });

  var debtMinimums = 0;
  var debtKeys = {};
  (input.debts || []).forEach(function(debt) {
    if (!debt || debt.active === false) return;
    if (!(Number(debt.balance) > 0.005)) return;
    debtKeys[debtPayoffScenarioPayeeKey_(debt.name)] = true;
    debtKeys[debtPayoffScenarioPayeeKey_(debt.originalName)] = true;
    if (debt.minimumPaymentKnown === false) {
      blockers.push({
        code: 'MINIMUM_UNKNOWN',
        reason: (debt.name || 'A debt') + ' has no usable contractual minimum.'
      });
      return;
    }
    debtMinimums = round2_(debtMinimums + Math.max(0, Number(debt.minimumPayment) || 0));
  });

  var billsMonthly = 0;
  var unmatchedInvestmentBillsMonthly = 0;
  var policyFloorNames = {};
  (input.policyFloors || []).forEach(function(floor) {
    policyFloorNames[debtPayoffScenarioPayeeKey_(floor.accountName)] = true;
  });

  (input.bills || []).forEach(function(bill) {
    if (!bill || bill.active === false) return;
    var payeeKey = debtPayoffScenarioPayeeKey_(bill.payee || bill.name);
    if (bill.debtOwned || debtKeys[payeeKey]) return;
    if (String(bill.varies || '').toLowerCase() === 'yes') {
      blockers.push({
        code: 'VARIABLE_BILL',
        reason: (bill.payee || bill.name || 'A bill') +
          ' varies and is not a reliable recurring monthly amount.'
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
      var matchedFloor = bill.matchedInvestmentAccount &&
        policyFloorNames[debtPayoffScenarioPayeeKey_(bill.matchedInvestmentAccount)];
      if (matchedFloor || policyFloorNames[payeeKey]) return;
      unmatchedInvestmentBillsMonthly = round2_(unmatchedInvestmentBillsMonthly + monthly);
      return;
    }
    billsMonthly = round2_(billsMonthly + monthly);
  });

  var policyFloorMonthly = 0;
  (input.policyFloors || []).forEach(function(floor) {
    var weekly = Math.max(
      Number(floor.weeklyAmount) || 0,
      Number(floor.requestedWeeklyPace) || 0
    );
    policyFloorMonthly = round2_(
      policyFloorMonthly + debtPayoffScenarioWeeklyToMonthly_(weekly));
  });

  var components = {
    recurringIncomeMonthly: income,
    debtMinimumsMonthly: debtMinimums,
    recurringBillsMonthly: billsMonthly,
    policyFloorMonthly: policyFloorMonthly,
    unmatchedInvestmentBillsMonthly: unmatchedInvestmentBillsMonthly
  };
  var commitments = round2_(
    debtMinimums + billsMonthly + policyFloorMonthly + unmatchedInvestmentBillsMonthly);
  var surplus = round2_(income - commitments);
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
      deficit: false,
      source: source,
      blockers: blockers,
      components: components,
      requiredReserveAmount: requiredReserve,
      usableCashAfterBuffers: isFinite(usable) ? round2_(usable) : null,
      assumptions: assumptions,
      datedBonusScenario: input.datedBonusScenario || null
    };
  }

  var deficit = surplus <= 0.005;
  var amount = 0;
  if (!deficit && !reserveShort) amount = surplus;

  return {
    available: true,
    amount: round2_(amount),
    label: 'Estimate',
    persisted: false,
    extraIsAffordable: null,
    reserveProtects: reserveShort,
    deficit: deficit,
    source: source,
    blockers: [],
    components: components,
    requiredReserveAmount: requiredReserve,
    usableCashAfterBuffers: round2_(usable),
    recurringSurplusBeforeReserve: surplus,
    assumptions: assumptions.concat([
      'Recurring income $' + income.toFixed(2) +
        ' − bills $' + billsMonthly.toFixed(2) +
        ' − debt minimums $' + debtMinimums.toFixed(2) +
        ' − policy floors $' + policyFloorMonthly.toFixed(2) +
        ' − other investment bills $' + unmatchedInvestmentBillsMonthly.toFixed(2) +
        ' = $' + surplus.toFixed(2) + ' before reserve protection.'
    ]),
    datedBonusScenario: input.datedBonusScenario || null
  };
}

function readDebtPayoffSupportedMonthlyExtra_(ss, debts, accounts) {
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

  var reserveKnown = false;
  var requiredReserveAmount = null;
  var reserveUnavailableReason = '';
  try {
    if (typeof readCapitalAllocationFacts_ !== 'function') {
      reserveUnavailableReason =
        'This Week’s canonical reserve reader is unavailable. A bills-only proxy was not used.';
    } else {
      var facts = readCapitalAllocationFacts_(ss, new Date());
      var reserve = debtPayoffReserveFromCanonicalForecast_(facts && facts.forecast90);
      if (reserve.ok) {
        reserveKnown = true;
        requiredReserveAmount = reserve.amount;
      } else {
        reserveUnavailableReason = reserve.reason;
      }
    }
  } catch (e4) {
    reserveUnavailableReason =
      'This Week’s canonical reserve, including upcoming expenses and property contingency, could not be read.';
  }

  var billsResult = readDebtPayoffSupportedMonthlyExtraBills_(ss, policyFloors);
  return buildDebtPayoffSupportedMonthlyExtra_({
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
    reserveUnavailableReason: reserveUnavailableReason
  });
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
    var display = sheet.getDataRange().getDisplayValues();
    var values = sheet.getDataRange().getValues();
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
  'The household strategy comparison uses one constant monthly extra and does not model month-specific inflows. ' +
  'These bonus amounts are not applied to avalanche or snowball, are not treated as cash available each month, ' +
  'and are not used to satisfy the 90-day cash reserve.';

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
 * never applies it to the strategy comparison.
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
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
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
      active: true,
      isInvestmentContribution: investment.isInvestmentContribution === true,
      matchedInvestmentAccount: investment.accountName || ''
    });
  }
  return { unavailable: false, rows: rows };
}
