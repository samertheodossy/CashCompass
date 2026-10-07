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
      missingCashFlowSheets: []
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
    missingCashFlowSheets: missingCashFlowSheets
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
    return compareDebtPayoffStrategies_([], monthlyExtra, { asOfDate: today });
  }
  const debtRows = readSheetAsObjects_(ss, 'DEBTS');
  const aliasMap = getAliasMap_();
  const debts = normalizeDebts_(debtRows, aliasMap);
  return compareDebtPayoffStrategies_(debts, monthlyExtra, { asOfDate: today });
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
