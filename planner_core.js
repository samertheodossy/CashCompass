var ACTION_PLAN_MAX_VISIBLE_PAY_ITEMS_ = 12;

function appendScheduledMinimumLines_(lines, items) {
  const cap = ACTION_PLAN_MAX_VISIBLE_PAY_ITEMS_;
  if (!items || items.length === 0) {
    lines.push('  (none)');
    return;
  }
  const show = Math.min(items.length, cap);
  for (let i = 0; i < show; i++) {
    const p = items[i];
    lines.push(
      '  • ' +
        p.account +
        ' - ' +
        fmtCurrency_(p.minimumPayment) +
        ' min, due ' +
        p.dueDate +
        ' (' +
        p.daysUntilDue +
        'd)'
    );
  }
  if (items.length > show) {
    let hiddenSum = 0;
    for (let j = show; j < items.length; j++) hiddenSum += items[j].minimumPayment;
    lines.push(
      '  • ... and ' +
        (items.length - show) +
        ' more - ' +
        fmtCurrency_(round2_(hiddenSum)) +
        ' in minimums (included in total above).'
    );
  }
}

function appendOverdueBillLines_(lines, items, today) {
  const cap = ACTION_PLAN_MAX_VISIBLE_PAY_ITEMS_;
  const todayOnly = stripTime_(today);
  if (!items || items.length === 0) {
    lines.push('  (none)');
    return;
  }
  const show = Math.min(items.length, cap);
  for (let i = 0; i < show; i++) {
    const row = items[i];
    const label = String(row.name || row.payee || 'Bill').trim() || 'Bill';
    const amt = round2_(Math.abs(toNumber_(row.amount)));
    const dueStr = String(row.dueDate || '').trim();
    let lateSuffix = '';
    if (dueStr) {
      const dueDate = new Date(dueStr + 'T00:00:00');
      if (!isNaN(dueDate.getTime())) {
        const daysLate = Math.floor((todayOnly.getTime() - stripTime_(dueDate).getTime()) / 86400000);
        if (daysLate > 0) lateSuffix = ', (' + daysLate + 'd overdue)';
      }
    }
    lines.push(
      '  • ' + label + ' - ' + fmtCurrency_(amt) + ', due ' + dueStr + lateSuffix
    );
  }
  if (items.length > show) {
    let hiddenSum = 0;
    for (let j = show; j < items.length; j++) hiddenSum += Math.abs(toNumber_(items[j].amount));
    lines.push(
      '  • ... and ' +
        (items.length - show) +
        ' more - ' +
        fmtCurrency_(round2_(hiddenSum)) +
        ' (included in total above).'
    );
  }
}

function buildActionPlan_(data) {
  const lines = [];

  const overdue = data.overdueBills || [];
  if (overdue.length > 0) {
    let overdueSum = 0;
    overdue.forEach(function(r) {
      overdueSum += Math.abs(toNumber_(r.amount));
    });
    lines.push('Overdue bills -- total ' + fmtCurrency_(round2_(overdueSum)) + ':');
    appendOverdueBillLines_(lines, overdue, data.today);
    lines.push('');
  }

  lines.push('Pay now — total ' + fmtCurrency_(data.payNowMinimumTotal) + ':');
  appendScheduledMinimumLines_(lines, data.payNow);
  lines.push('');

  lines.push('Pay soon — total ' + fmtCurrency_(data.paySoonMinimumTotal) + ':');
  appendScheduledMinimumLines_(lines, data.paySoon);
  lines.push('');

  if (data.recommendation && data.recommendation.suggestedExtraPayment > 0) {
    lines.push('Extra payment target this cycle: ' + data.recommendation.targetAccount + ' for ' + fmtCurrency_(data.recommendation.suggestedExtraPayment) + '.');
    lines.push(
      'Recommended total to pay now (pay-now minimums plus suggested extra): ' +
        fmtCurrency_(data.recommendedTotalToPayNow) +
        '.'
    );
  }

  return lines;
}

function buildLiquiditySummary_(usableCashAfterBuffers, activeCardDebt, minimumDueTotal, payNowMinimumTotal, paySoonMinimumTotal) {
  const monthsOfMinimumCoverage = minimumDueTotal > 0 ? round2_(usableCashAfterBuffers / minimumDueTotal) : 0;
  const cashToCardDebtRatio = activeCardDebt > 0 ? round2_(usableCashAfterBuffers / activeCardDebt) : 0;
  const payWindowCoverage = (payNowMinimumTotal + paySoonMinimumTotal) > 0
    ? round2_(usableCashAfterBuffers / (payNowMinimumTotal + paySoonMinimumTotal))
    : 0;

  return {
    usableCashAfterBuffers: round2_(usableCashAfterBuffers),
    activeCardDebt: round2_(activeCardDebt),
    monthsOfMinimumCoverage: monthsOfMinimumCoverage,
    cashToCardDebtRatio: cashToCardDebtRatio,
    payWindowCoverage: payWindowCoverage
  };
}

function buildUnusualItems_(cashFlowBreakdown) {
  return cashFlowBreakdown.filter(function(x) {
    return Math.abs(x.delta) >= 5000;
  }).slice(0, 6);
}

function normalizeHouseAssets_(rows) {
  return rows
    .filter(function(r) { return String(r['House'] || '').trim() !== ''; })
    .map(function(r) {
      const loan = round2_(toNumber_(r['Loan Amount Left']));
      const value = round2_(toNumber_(r['Current Value']));
      return {
        house: String(r['House'] || '').trim(),
        propertyType: String(r['Type'] || '').trim(),
        loanAmountLeft: loan,
        currentValue: value,
        estimatedEquity: round2_(value - loan)
      };
    });
}

function normalizeAssets_(rows) {
  return rows
    .filter(function(r) { return String(r['Account Name'] || '').trim() !== ''; })
    .map(function(r) {
      return {
        name: String(r['Account Name'] || '').trim(),
        type: String(r['Type'] || '').trim(),
        value: round2_(toNumber_(r['Current Balance']))
      };
    });
}

function calculateHouseAssetSummary_(houseAssets) {
  let totalRealEstateValue = 0;
  let totalRealEstateLoans = 0;
  let totalRealEstateEquity = 0;

  houseAssets.forEach(function(h) {
    totalRealEstateValue += h.currentValue;
    totalRealEstateLoans += h.loanAmountLeft;
    totalRealEstateEquity += h.estimatedEquity;
  });

  return {
    totalRealEstateValue: round2_(totalRealEstateValue),
    totalRealEstateLoans: round2_(totalRealEstateLoans),
    totalRealEstateEquity: round2_(totalRealEstateEquity)
  };
}

function calculateAssetSummary_(assets) {
  let total = 0;
  let brokerage = 0;
  let retirement = 0;
  let education = 0;

  assets.forEach(function(a) {
    total += a.value;
    if (a.type === 'Brokerage') brokerage += a.value;
    else if (a.type === 'Retirement') retirement += a.value;
    else if (a.type === 'Education') education += a.value;
  });

  return {
    totalAssets: round2_(total),
    brokerage: round2_(brokerage),
    retirement: round2_(retirement),
    education: round2_(education)
  };
}

function calculateLiabilitySummary_(debts) {
  let total = 0;
  let creditCards = 0;
  let loans = 0;
  let heloc = 0;
  let other = 0;

  debts.forEach(function(d) {
    total += d.balance;
    if (d.type === 'Credit Card') creditCards += d.balance;
    else if (d.type === 'Loan') loans += d.balance;
    else if (d.type === 'HELOC') heloc += d.balance;
    else other += d.balance;
  });

  return {
    totalLiabilities: round2_(total),
    creditCards: round2_(creditCards),
    loans: round2_(loans),
    heloc: round2_(heloc),
    other: round2_(other)
  };
}

function normalizeName_(name, aliasMap) {
  const raw = String(name || '').trim();
  return aliasMap[raw] || raw;
}

function getAliasMap_() {
  return {
    'Loan Depot - SJ House': 'Loan Depot - San Jose House',
    'Loan Depot - San Jose': 'Loan Depot - San Jose House',
    'Credit Card - AA': 'Credit Card - CitiAA',
    'Credit Card - SW': 'Credit Card - Southwest',
    'Laith VCS Account': 'Laith VCS Bill',
    'American Express CC': 'Credit Card - American Express',
    'SW CC': 'Credit Card - Southwest'
  };
}

function normalizeDebts_(rows, aliasMap) {
  return rows
    .filter(function(r) { return String(r['Account Name'] || '').trim() !== ''; })
    .filter(function(r) { return String(r['Account Name']).trim().toUpperCase() !== 'TOTAL DEBT'; })
    .map(function(r) {
      const balance = toNumber_(r['Account Balance']);
      const minPayment = round2_(toNumber_(r['Minimum Payment']));
      const dueDay = parseInt(String(r['Due Date'] || '').trim(), 10) || 1;
      const creditLimit = toNumber_(r['Credit Limit']);
      const creditLeft = toNumber_(r['Credit Left']);
      const rate = toNumber_(r['Int Rate']);
      const type = String(r['Type'] || '').trim();

      return {
        name: normalizeName_(r['Account Name'], aliasMap),
        originalName: String(r['Account Name'] || '').trim(),
        type: type,
        balance: round2_(balance),
        dueDay: dueDay,
        creditLimit: round2_(creditLimit),
        creditLeft: round2_(creditLeft),
        minimumPayment: minPayment,
        interestRate: round2_(rate),
        active: balance > 0 || minPayment > 0
      };
    });
}

function normalizeAccounts_(rows) {
  return rows
    .filter(function(r) { return String(r['Account Name'] || '').trim() !== ''; })
    .filter(function(r) { return String(r['Account Name']).trim().toUpperCase() !== 'TOTAL ACCOUNTS'; })
    .filter(function(r) { return String(r['Account Name']).trim().toUpperCase() !== 'DELTA'; })
    .map(function(r) {
      return {
        name: String(r['Account Name'] || '').trim(),
        type: String(r['Type'] || '').trim(),
        currentBalance: round2_(toNumber_(r['Current Balance'])),
        availableNow: Math.max(0, round2_(toNumber_(r['Available Now']))),
        minBuffer: Math.max(0, round2_(toNumber_(r['Min Buffer']))),
        usePolicy: String(r['Use Policy'] || '').trim().toUpperCase(),
        priority: parseInt(String(r['Priority'] || '9'), 10) || 9
      };
    });
}

function normalizeCashFlow_(rows, monthHeader, aliasMap) {
  const validRows = rows.filter(function(r) {
    const t = String(r['Type'] || '').trim();
    return t === 'Income' || t === 'Expense';
  });

  let incomeTotal = 0;
  let expenseTotal = 0;
  const lineItems = [];

  validRows.forEach(function(r) {
    const type = String(r['Type']).trim();
    const payee = normalizeName_(r['Payee'], aliasMap);
    let amount = 0;

    if (Object.prototype.hasOwnProperty.call(r, monthHeader)) {
      amount = toNumber_(r[monthHeader]);
      if (amount === 0 && Object.prototype.hasOwnProperty.call(r, '__display__' + monthHeader)) {
        amount = toNumber_(r['__display__' + monthHeader]);
      }
    } else if (Object.prototype.hasOwnProperty.call(r, '__display__' + monthHeader)) {
      amount = toNumber_(r['__display__' + monthHeader]);
    }

    amount = round2_(amount);

    if (type === 'Income') incomeTotal += amount;
    if (type === 'Expense') expenseTotal += amount;

    lineItems.push({
      type: type,
      payee: payee,
      amount: amount
    });
  });

  return {
    monthHeader: monthHeader,
    incomeTotal: round2_(incomeTotal),
    expenseTotal: round2_(expenseTotal),
    monthNet: round2_(incomeTotal + expenseTotal),
    lineItems: lineItems
  };
}

function calculateUsableCash_(accounts) {
  let totalAvailableNow = 0;
  let totalBuffers = 0;
  let usableAfterBuffers = 0;

  const usablePolicies = ['USE_FOR_BILLS', 'USE_FOR_DEBT', 'USE_WITH_CAUTION'];

  accounts.forEach(function(a) {
    totalAvailableNow += a.availableNow;
    totalBuffers += a.minBuffer;

    if (usablePolicies.indexOf(a.usePolicy) !== -1) {
      usableAfterBuffers += Math.max(0, a.availableNow - a.minBuffer);
    }
  });

  return {
    totalAvailableNow: round2_(totalAvailableNow),
    totalBuffers: round2_(totalBuffers),
    usableAfterBuffers: round2_(usableAfterBuffers)
  };
}

/**
 * For expense rows whose month cell looks "handled" (non-empty display + numeric value),
 * records both alias-canonical payee and normalizeBillName_(raw payee) so matching stays
 * aligned with dashboard getDebtBillsDueRows_.
 */
function buildDebtMinimumHandledMap_(cashFlowRows, monthHeader, aliasMap) {
  const map = Object.create(null);
  cashFlowRows.forEach(function(r) {
    if (String(r['Type'] || '').trim() !== 'Expense') return;
    const rawPayee = String(r['Payee'] || '').trim();
    const payee = normalizeName_(r['Payee'], aliasMap);
    const cellValue = Object.prototype.hasOwnProperty.call(r, monthHeader) ? r[monthHeader] : '';
    const cellDisplay = Object.prototype.hasOwnProperty.call(r, '__display__' + monthHeader)
      ? r['__display__' + monthHeader]
      : '';
    if (!isCashFlowBillHandled_(cellValue, cellDisplay)) return;
    map[payee] = true;
    if (rawPayee) map[normalizeBillName_(rawPayee)] = true;
  });
  return map;
}

function isDebtMinimumHandledThisMonth_(handledMap, debt) {
  if (!handledMap) return false;
  if (handledMap[debt.name]) return true;
  if (debt.originalName && handledMap[normalizeBillName_(debt.originalName)]) return true;
  return false;
}

function buildUpcomingPayments_(debts, today, tz, payNowWindowDays, paySoonWindowDays, debtMinimumHandledMap) {
  const payNow = [];
  const paySoon = [];

  debts
    .filter(function(d) { return d.active && d.minimumPayment > 0; })
    .forEach(function(d) {
      if (isDebtMinimumHandledThisMonth_(debtMinimumHandledMap, d)) return;

      const dueDate = getNextDueDate_(today, d.dueDay);
      const daysUntilDue = daysBetween_(stripTime_(today), dueDate);

      const item = {
        account: d.name,
        type: d.type,
        dueDate: Utilities.formatDate(dueDate, tz, 'yyyy-MM-dd'),
        daysUntilDue: Math.round(daysUntilDue),
        minimumPayment: round2_(d.minimumPayment),
        balance: round2_(d.balance),
        interestRate: round2_(d.interestRate)
      };

      if (daysUntilDue <= payNowWindowDays) payNow.push(item);
      else if (daysUntilDue <= paySoonWindowDays) paySoon.push(item);
    });

  payNow.sort(function(a, b) { return a.daysUntilDue - b.daysUntilDue; });
  paySoon.sort(function(a, b) { return a.daysUntilDue - b.daysUntilDue; });

  return { payNow: payNow, paySoon: paySoon };
}

function estimateAnnualInterestSavings_(paymentAmount, apr) {
  return round2_(paymentAmount * (apr / 100));
}

function estimateMonthsToPayoff_(balance, monthlyPayment) {
  if (balance <= 0) return 0;
  if (monthlyPayment <= 0) return 'N/A';
  return Math.ceil(balance / monthlyPayment);
}

function getMonthlyStabilityScore_(monthCashFlow, usableCashAfterBuffers, minimumDueTotal, overLimitCount, highUtilCount) {
  if (
    monthCashFlow <= -15000 ||
    usableCashAfterBuffers < minimumDueTotal ||
    overLimitCount >= 2
  ) {
    return { label: 'Risky', detail: 'Liquidity pressure or credit stress is elevated.' };
  }

  if (
    monthCashFlow < 0 ||
    highUtilCount >= 2 ||
    usableCashAfterBuffers < (minimumDueTotal * 3)
  ) {
    return { label: 'Tight', detail: 'This month is manageable, but needs close attention.' };
  }

  return { label: 'Stable', detail: 'Cash flow and liquidity look reasonably healthy.' };
}

function buildCashFlowChangeBreakdown_(currentCashFlow, previousCashFlow) {
  const prevMap = {};
  previousCashFlow.lineItems.forEach(function(item) {
    prevMap[item.type + '||' + item.payee] = item.amount;
  });

  return currentCashFlow.lineItems
    .map(function(item) {
      const key = item.type + '||' + item.payee;
      const previousAmount = prevMap[key] || 0;
      return {
        type: item.type,
        payee: item.payee,
        previousAmount: previousAmount,
        currentAmount: item.amount,
        delta: round2_(item.amount - previousAmount)
      };
    })
    .filter(function(x) { return x.delta !== 0; })
    .sort(function(a, b) { return Math.abs(b.delta) - Math.abs(a.delta); })
    .slice(0, 10);
}

function buildExecutiveSummary_(data) {
  const lines = [];

  lines.push('Monthly stability: ' + data.stability.label + '. ' + data.stability.detail);
  lines.push('Total assets: ' + fmtCurrency_(data.totalAssets) + '.');
  lines.push('Total liabilities: ' + fmtCurrency_(data.totalLiabilities) + '.');
  lines.push('Net worth: ' + fmtCurrency_(data.netWorth) + '.');

  lines.push('Projected cash flow for ' + data.monthHeader + ': ' + fmtCurrency_(data.thisMonthCashFlow) + '.');

  if (data.recommendation && data.recommendation.suggestedExtraPayment > 0) {
    lines.push('Best extra-payment target: ' + data.recommendation.targetAccount + '.');
    lines.push('Suggested extra payment this cycle: ' + fmtCurrency_(data.recommendation.suggestedExtraPayment) + '.');
    lines.push('Estimated annual interest savings from that payment: ' + fmtCurrency_(data.recommendation.annualInterestSavingsEstimate) + '.');
    lines.push('Estimated months to pay off ' + data.recommendation.targetAccount + ': ' + data.recommendation.estimatedMonthsToPayOffTarget + '.');
    lines.push('Estimated months to pay off all active credit cards: ' + data.recommendation.estimatedMonthsToPayOffAllCards + '.');
    if (data.recommendation.nextTargetAfterThis) {
      lines.push('Next target after this: ' + data.recommendation.nextTargetAfterThis.account + '.');
    }
  } else if (data.recommendation) {
    lines.push('Best debt target remains ' + data.recommendation.targetAccount + ', but no extra payment is recommended this cycle.');
    if (data.recommendation.nextTargetAfterThis) {
      lines.push('Next target after this: ' + data.recommendation.nextTargetAfterThis.account + '.');
    }
  } else {
    lines.push('No extra-payment recommendation was generated.');
  }

  return lines;
}

function buildReason_(target, mode, monthCashFlow, usableCash, minimumDueTotal, extraPaymentCapacity, suppressed) {
  const reasons = [];
  reasons.push(target.name + ' has the highest priority among active credit cards based on APR (' + fmtPercent_(target.interestRate) + ').');
  reasons.push('Current balance is ' + fmtCurrency_(target.balance) + '.');

  if (monthCashFlow < 0) {
    reasons.push('Projected monthly cash flow is negative (' + fmtCurrency_(monthCashFlow) + '), so liquidity is being protected.');
  }

  if (usableCash >= minimumDueTotal) {
    reasons.push('Usable cash after buffers can cover minimum payments.');
  }

  if (mode === 'BALANCED') {
    reasons.push('Balanced mode caps extra payments to keep more liquidity available.');
  }

  if (suppressed) {
    reasons.push('No extra payment is recommended this cycle because liquidity/risk guardrails were triggered.');
  } else {
    reasons.push('Suggested extra payment this cycle is ' + fmtCurrency_(extraPaymentCapacity) + '.');
  }

  reasons.push('Planner mode is ' + mode + '.');
  return reasons.join(' ');
}