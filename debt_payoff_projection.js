/**
 * Debt payoff projection — read-only views from INPUT - Debts + INPUT - Cash Flow.
 * Simulation / what-if lives in future phases.
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const y = getCurrentYear_();
  const projectionYears = [y - 1, y];

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

  const debtsOut = debts.map(function(d) {
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
      payoffEstimateMethod: isLoanTypeForAmortization_(d.type) ? 'amortization' : 'simple'
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
      return d.balance > 0;
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
    'Cash: ' +
      fmtCurrency_(usable.totalAvailableNow) +
      ' available now; ' +
      fmtCurrency_(usable.totalBuffers) +
      ' in protected buffers; ' +
      fmtCurrency_(u) +
      ' usable after buffers (SYS - Accounts).'
  );

  if (minTot > 0) {
    lines.push(
      'Active debts require about ' +
        fmtCurrency_(minTot) +
        '/month in minimums. Compare that to usable cash after buffers when planning extra payments.'
    );
  }

  if (u < minTot && minTot > 0) {
    lines.push(
      'Pressure: usable cash after buffers is below total minimum payments — prioritize liquidity and minimums before adding discretionary payoff.'
    );
  } else if (u >= minTot * 2 && minTot > 0) {
    lines.push(
      'Usable cash after buffers is at least 2× total minimums — you may have flexibility for targeted extra paydown (Run Planner suggests an extra target when applicable).'
    );
  }

  const cf = ctx.thisMonthCashFlow;
  if (cf < 0) {
    lines.push(
      'This month’s projected net on Cash Flow is negative (' +
        fmtCurrency_(cf) +
        ') — treat aggressive payoff as secondary until cash flow stabilizes.'
    );
  } else if (cf > 0 && minTot > 0) {
    lines.push(
      'Projected net Cash Flow this month: ' +
        fmtCurrency_(cf) +
        ' — not all of it should go to debt; keep buffers in mind.'
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
        ' has the highest APR (' +
        fmtPercent_(cards[0].interestRate) +
        ') — avalanche strategy usually applies extra principal there first.'
    );
  }

  if (ctx.longest && ctx.longest.months) {
    lines.push(
      'Longest estimated time to finish at the sheet minimum payment: ' +
        ctx.longest.accountName +
        ' (~' +
        ctx.longest.months +
        ' mo). Loan/HELOC figures use amortization; still depends on sheet APR/min matching the real note.'
    );
  }

  if (yearsLabel) {
    lines.push(
      'The CF paid column sums Expense rows on INPUT - Cash Flow for ' +
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
