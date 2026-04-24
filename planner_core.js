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
    const isBill = String(p.type || '').trim() === 'Bill';
    const mid = isBill ? ', due ' : ' min, due ';
    lines.push(
      '  • ' +
        p.account +
        ' - ' +
        fmtCurrency_(p.minimumPayment) +
        mid +
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
        ' (included in total above).'
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
  // Explicit-wins-with-fallback active semantics for debts:
  //   - If the sheet exposes an Active column (any row has the key), then
  //     only an explicit 'No'/'n'/'false'/'inactive' marks a debt inactive.
  //     Blank/missing on any individual row keeps that debt active so
  //     existing workbooks with just the header added keep working.
  //   - If no row exposes an Active column at all (legacy workbook), fall
  //     back to the original implicit rule: active iff balance>0 or
  //     minimumPayment>0. This preserves behavior for sheets that have not
  //     been self-healed yet.
  var hasActiveColumn = false;
  for (var i = 0; i < rows.length; i++) {
    if (
      Object.prototype.hasOwnProperty.call(rows[i], 'Active') ||
      Object.prototype.hasOwnProperty.call(rows[i], '__display__Active')
    ) {
      hasActiveColumn = true;
      break;
    }
  }

  function isExplicitInactive(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return s === 'no' || s === 'n' || s === 'false' || s === 'inactive';
  }

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
      const originalName = String(r['Account Name'] || '').trim();
      const priorityClass =
        originalName === 'Loan Depot - San Jose House' || rate <= 2.25
          ? 'LOW_RATE_KEEP_LAST'
          : 'STANDARD';

      var active;
      if (hasActiveColumn) {
        var activeCell = Object.prototype.hasOwnProperty.call(r, '__display__Active')
          ? r['__display__Active']
          : r['Active'];
        active = !isExplicitInactive(activeCell);
      } else {
        active = balance > 0 || minPayment > 0;
      }

      return {
        name: normalizeName_(r['Account Name'], aliasMap),
        originalName: originalName,
        type: type,
        balance: round2_(balance),
        dueDay: dueDay,
        creditLimit: round2_(creditLimit),
        creditLeft: round2_(creditLeft),
        minimumPayment: minPayment,
        interestRate: round2_(rate),
        active: active,
        priorityClass: priorityClass
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
    const t = String(r['Type'] || '').trim().toUpperCase();
    return t === 'INCOME' || t === 'EXPENSE';
  });

  let incomeTotal = 0;
  let expenseTotal = 0;
  const lineItems = [];

  validRows.forEach(function(r) {
    const rawType = String(r['Type'] || '').trim();
    const typeUpper = rawType.toUpperCase();
    const typeCanon = typeUpper === 'INCOME' ? 'Income' : typeUpper === 'EXPENSE' ? 'Expense' : rawType;
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

    if (typeUpper === 'INCOME') incomeTotal += amount;
    if (typeUpper === 'EXPENSE') expenseTotal += amount;

    lineItems.push({
      type: typeCanon,
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

/**
 * Apply a total hold amount across policy pools without merging buckets first:
 * reduce USE_WITH_CAUTION, then USE_FOR_BILLS, then USE_FOR_DEBT (preserves debt-preferred cash longest).
 */
function distributeHoldAcrossPolicyPools_(debtRaw, billsRaw, cautionRaw, holdTotal) {
  let h = round2_(Math.max(0, toNumber_(holdTotal)));
  let c = round2_(Math.max(0, toNumber_(cautionRaw)));
  let b = round2_(Math.max(0, toNumber_(billsRaw)));
  let d = round2_(Math.max(0, toNumber_(debtRaw)));
  let take = round2_(Math.min(c, h));
  c = round2_(c - take);
  h = round2_(h - take);
  take = round2_(Math.min(b, h));
  b = round2_(b - take);
  h = round2_(h - take);
  take = round2_(Math.min(d, h));
  d = round2_(d - take);
  h = round2_(h - take);
  return {
    debt: round2_(Math.max(0, d)),
    bills: round2_(Math.max(0, b)),
    caution: round2_(Math.max(0, c)),
    hold_remainder: round2_(Math.max(0, h))
  };
}

/**
 * SYS - Accounts–driven cash: per-account usable = max(0, currentBalance - minBuffer), buckets by use_policy,
 * priority ASC within bucket. Global holds (optional) applied after pool totals — see distributeHoldAcrossPolicyPools_.
 *
 * @param {Array<{name:string,currentBalance:number,minBuffer:number,usePolicy:string,priority:number}>} accounts
 * @param {{nearTermPlannedCash?:number,unmappedCardFundedCashRisk?:number,reserveTarget?:number,bufferAboveReserve?:number}} globalHolds
 */
function buildAccountCashAvailabilityModel_(accounts, globalHolds) {
  globalHolds = globalHolds || {};
  const nearTerm = round2_(Math.max(0, toNumber_(globalHolds.nearTermPlannedCash)));
  const unmapped = round2_(Math.max(0, toNumber_(globalHolds.unmappedCardFundedCashRisk)));
  const reserve = round2_(Math.max(0, toNumber_(globalHolds.reserveTarget)));
  const buffer = round2_(Math.max(0, toNumber_(globalHolds.bufferAboveReserve)));
  const holdTotal = round2_(nearTerm + unmapped + reserve + buffer);

  const B_DEBT = 'USE_FOR_DEBT';
  const B_BILLS = 'USE_FOR_BILLS';
  const B_CAUTION = 'USE_WITH_CAUTION';

  const debtList = [];
  const billsList = [];
  const cautionList = [];
  const debug = [];
  let liquidTotalSheet = 0;
  let doNotTouchExcludedCash = 0;
  let unsupportedPolicyBalanceTotal = 0;
  let reserveAccountCount = 0;
  let bufferAccountCount = 0;

  accounts.forEach(function(a) {
    liquidTotalSheet = round2_(liquidTotalSheet + (Number(a.currentBalance) || 0));
  });

  function sortByPriorityAsc(list) {
    return list.slice().sort(function(x, y) {
      const px = Number(x.priority) || 9;
      const py = Number(y.priority) || 9;
      if (px !== py) return px - py;
      return String(x.name).localeCompare(String(y.name));
    });
  }

  accounts.forEach(function(a) {
    const name = String(a.name || '').trim();
    if (!name) return;
    const policy = String(a.usePolicy || '').trim().toUpperCase();
    const usable = round2_(Math.max(0, (Number(a.currentBalance) || 0) - (Number(a.minBuffer) || 0)));

    if (policy === 'DO_NOT_TOUCH') {
      doNotTouchExcludedCash = round2_(doNotTouchExcludedCash + (Number(a.currentBalance) || 0));
      reserveAccountCount += 1;
      debug.push({
        name: name,
        usable_cash: usable,
        included: false,
        reason: 'DO_NOT_TOUCH — excluded from deployable pools (contributes to calculated_reserve)'
      });
      return;
    }
    if ((Number(a.minBuffer) || 0) > 0) {
      bufferAccountCount += 1;
    }
    if (policy === B_DEBT) {
      debtList.push({
        name: name,
        priority: a.priority,
        currentBalance: Number(a.currentBalance) || 0,
        minBuffer: Number(a.minBuffer) || 0,
        usable_cash: usable
      });
      debug.push({
        name: name,
        usable_cash: usable,
        included: true,
        reason: 'USE_FOR_DEBT — highest execution preference (consumed before other pools when deploying)'
      });
      return;
    }
    if (policy === B_BILLS) {
      billsList.push({
        name: name,
        priority: a.priority,
        currentBalance: Number(a.currentBalance) || 0,
        minBuffer: Number(a.minBuffer) || 0,
        usable_cash: usable
      });
      debug.push({
        name: name,
        usable_cash: usable,
        included: true,
        reason: 'USE_FOR_BILLS — secondary pool (after debt-preferred accounts)'
      });
      return;
    }
    if (policy === B_CAUTION) {
      cautionList.push({
        name: name,
        priority: a.priority,
        currentBalance: Number(a.currentBalance) || 0,
        minBuffer: Number(a.minBuffer) || 0,
        usable_cash: usable
      });
      debug.push({
        name: name,
        usable_cash: usable,
        included: true,
        reason: 'USE_WITH_CAUTION — lowest pool (only after debt + bills pools when modeling execution order)'
      });
      return;
    }
    unsupportedPolicyBalanceTotal = round2_(
      unsupportedPolicyBalanceTotal + (Number(a.currentBalance) || 0)
    );
    debug.push({
      name: name,
      usable_cash: usable,
      included: false,
      reason: policy ? 'unsupported use_policy: ' + policy : 'missing or blank use_policy'
    });
  });

  const debtSorted = sortByPriorityAsc(debtList);
  const billsSorted = sortByPriorityAsc(billsList);
  const cautionSorted = sortByPriorityAsc(cautionList);

  function sumUsable(list) {
    return round2_(list.reduce(function(s, x) {
      return s + (Number(x.usable_cash) || 0);
    }, 0));
  }

  function sumMinBuffer(list) {
    return round2_(
      list.reduce(function(s, x) {
        return s + (Number(x.minBuffer) || 0);
      }, 0)
    );
  }

  const debtRaw = sumUsable(debtSorted);
  const billsRaw = sumUsable(billsSorted);
  const cautionRaw = sumUsable(cautionSorted);
  const totalUsable = round2_(debtRaw + billsRaw + cautionRaw);

  const accountMinBuffersTotal = round2_(
    sumMinBuffer(debtSorted) + sumMinBuffer(billsSorted) + sumMinBuffer(cautionSorted)
  );

  const policyScopedBalanceTotal = round2_(
    debtSorted.reduce(function(s, x) {
      return s + (Number(x.currentBalance) || 0);
    }, 0) +
      billsSorted.reduce(function(s, x) {
        return s + (Number(x.currentBalance) || 0);
      }, 0) +
      cautionSorted.reduce(function(s, x) {
        return s + (Number(x.currentBalance) || 0);
      }, 0)
  );

  const policyEligibleCashBeforeBuffers = round2_(liquidTotalSheet - doNotTouchExcludedCash);

  const linearSubtotalAfterBuffers = round2_(policyScopedBalanceTotal - accountMinBuffersTotal);
  const bridgePerAccountFloorDelta = round2_(totalUsable - linearSubtotalAfterBuffers);

  const liquidReconciliationDelta = round2_(
    liquidTotalSheet - doNotTouchExcludedCash - unsupportedPolicyBalanceTotal - policyScopedBalanceTotal
  );

  const dist = distributeHoldAcrossPolicyPools_(debtRaw, billsRaw, cautionRaw, holdTotal);
  const finalExecuteLinear = round2_(Math.max(0, totalUsable - holdTotal));

  const cashBridgeValidationWarnings = [];
  const bucketRawSum = round2_(debtRaw + billsRaw + cautionRaw);
  if (Math.abs(bucketRawSum - totalUsable) > 0.02) {
    cashBridgeValidationWarnings.push(
      'after_bucketing_raw_pool_sum: debt_preferred_cash_raw + bills_available_cash_raw + caution_cash_raw must equal total_usable_cash (diff ' +
        String(round2_(bucketRawSum - totalUsable)) +
        ')'
    );
  }
  const bucketPostSum = round2_(dist.debt + dist.bills + dist.caution);
  if (Math.abs(bucketPostSum - finalExecuteLinear) > 0.02) {
    cashBridgeValidationWarnings.push(
      'post_hold_named_pools: debt_preferred_cash + bills_available_cash + caution_cash must equal final_execute_now_cash (linear total_usable minus holds) (diff ' +
        String(round2_(bucketPostSum - finalExecuteLinear)) +
        ')'
    );
  }
  if (Math.abs(liquidReconciliationDelta) > 0.02) {
    cashBridgeValidationWarnings.push(
      'liquid_sheet_reconciliation: liquid_total_sheet should equal DNT + unsupported + policy-scoped balances (diff ' +
        String(liquidReconciliationDelta) +
        ')'
    );
  }

  const finalExecuteNowCash = finalExecuteLinear;

  /**
   * Calculated reserve and buffer derived directly from the SYS - Accounts policy model.
   * These replace the legacy hardcoded planner constants (reserve_hold / global_buffer_hold)
   * as the authoritative values for the top-level UI deployable math.
   *
   * calculated_reserve: sum of Current Balance for all DO_NOT_TOUCH cash accounts
   * calculated_buffer:  sum of per-account Min Buffer for all non-DO_NOT_TOUCH policy-eligible cash accounts
   */
  const calculatedReserve = round2_(doNotTouchExcludedCash);
  const calculatedBuffer = round2_(accountMinBuffersTotal);
  const deployableMaxCalculated = round2_(
    Math.max(0, liquidTotalSheet - calculatedReserve - calculatedBuffer - nearTerm - unmapped)
  );

  return {
    account_cash_policy_debug: debug,
    debt_preferred_cash: dist.debt,
    bills_available_cash: dist.bills,
    caution_cash: dist.caution,
    debt_preferred_cash_raw: debtRaw,
    bills_available_cash_raw: billsRaw,
    caution_cash_raw: cautionRaw,
    total_usable_cash: totalUsable,
    final_execute_now_cash: finalExecuteNowCash,
    /** Canonical month-0 execute-now budget = min(final_execute_now_cash, monthly_execution_cap). Set by caller after monthly_execution_cap is known. */
    month0_execute_now_budget: finalExecuteNowCash,
    global_hold_total: holdTotal,
    global_hold_applied_to_pools: round2_(Math.min(holdTotal, totalUsable)),
    liquid_total_sheet: round2_(liquidTotalSheet),
    do_not_touch_excluded_cash: round2_(doNotTouchExcludedCash),
    unsupported_policy_balance_total: round2_(unsupportedPolicyBalanceTotal),
    policy_eligible_cash_before_buffers: policyEligibleCashBeforeBuffers,
    policy_scoped_balance_total: policyScopedBalanceTotal,
    account_min_buffers_total: accountMinBuffersTotal,
    calculated_reserve: calculatedReserve,
    calculated_buffer: calculatedBuffer,
    reserve_account_count: reserveAccountCount,
    buffer_account_count: bufferAccountCount,
    reserve_source: 'Do-not-touch accounts (current balances)',
    buffer_source: 'per-account Min Buffer (non-DO_NOT_TOUCH policy-eligible accounts)',
    deployable_max_calculated: deployableMaxCalculated,
    reserve_hold: reserve,
    global_buffer_hold: buffer,
    near_term_planned_cash_hold: nearTerm,
    unmapped_card_risk_hold: unmapped,
    bridge_linear_subtotal_after_buffers: linearSubtotalAfterBuffers,
    bridge_per_account_floor_delta: bridgePerAccountFloorDelta,
    liquid_reconciliation_delta: liquidReconciliationDelta,
    cash_bridge_validation_warnings: cashBridgeValidationWarnings,
    execution_order_note:
      'Execution draws conceptually from USE_FOR_DEBT (priority ASC), then USE_FOR_BILLS, then USE_WITH_CAUTION; global holds reduce caution then bills then debt-preferred balances for reporting. final_execute_now_cash uses linear total_usable minus all holds; pool distribution is checked to match.'
  };
}

function calculateUsableCash_(accounts) {
  let totalAvailableNow = 0;
  let totalBuffers = 0;

  accounts.forEach(function(a) {
    totalAvailableNow += Number(a.currentBalance) || 0;
    totalBuffers += Number(a.minBuffer) || 0;
  });

  const model = buildAccountCashAvailabilityModel_(accounts, {
    nearTermPlannedCash: 0,
    unmappedCardFundedCashRisk: 0,
    reserveTarget: 0,
    bufferAboveReserve: 0
  });

  return {
    totalAvailableNow: round2_(totalAvailableNow),
    totalBuffers: round2_(totalBuffers),
    usableAfterBuffers: round2_(model.total_usable_cash)
  };
}

/**
 * For expense rows whose month cell looks "handled" (non-empty display + numeric value),
 * records both alias-canonical payee and normalizeBillName_(raw payee) so matching stays
 * aligned with dashboard getDebtBillsDueRows_.
 */
/**
 * Builds a map of which debt payees have already been "handled" (have a
 * non-empty current-month cell) on Cash Flow.
 *
 * `monthHeaders` may be either a single MMM-yy string (legacy behavior —
 * returns a flat map { payee: true }) or an array of MMM-yy strings
 * (preferred — returns a nested map { 'Apr-26': { payee: true }, … }).
 *
 * The nested shape lets consumers ask the correct question for each debt:
 * "is this month handled for the debt's actual next-due month?" rather
 * than always asking against the run's calendar month. This is what fixes
 * the email bug where debts with Due Day already past (e.g. Due Day 1 on
 * Apr 24) were skipped because their April cell was filled, even though
 * the next due was really May 1 and the May cell was still empty.
 */
function buildDebtMinimumHandledMap_(cashFlowRows, monthHeaders, aliasMap) {
  const headers = Array.isArray(monthHeaders) ? monthHeaders : [monthHeaders];
  const nested = Object.create(null);
  headers.forEach(function(h) {
    if (h) nested[h] = Object.create(null);
  });

  cashFlowRows.forEach(function(r) {
    if (String(r['Type'] || '').trim() !== 'Expense') return;
    const rawPayee = String(r['Payee'] || '').trim();
    const payee = normalizeName_(r['Payee'], aliasMap);
    headers.forEach(function(h) {
      if (!h) return;
      const cellValue = Object.prototype.hasOwnProperty.call(r, h) ? r[h] : '';
      const cellDisplay = Object.prototype.hasOwnProperty.call(r, '__display__' + h)
        ? r['__display__' + h]
        : '';
      if (!isCashFlowBillHandled_(cellValue, cellDisplay)) return;
      nested[h][payee] = true;
      if (rawPayee) nested[h][normalizeBillName_(rawPayee)] = true;
    });
  });

  // Legacy single-header callers expect a flat map. Flatten by returning
  // the inner bucket directly so existing signatures keep working without
  // any change.
  if (!Array.isArray(monthHeaders)) {
    return nested[monthHeaders] || Object.create(null);
  }
  return nested;
}

/**
 * Checks whether a debt's minimum has been handled for a given month.
 *
 * `handledMap` may be either the legacy flat map (just payee → bool) or
 * the nested month-keyed map. When a `monthHeader` is provided and the
 * map is nested, the per-month bucket is consulted. When the map is flat,
 * `monthHeader` is ignored and behavior matches the original signature.
 */
function isDebtMinimumHandledThisMonth_(handledMap, debt, monthHeader) {
  if (!handledMap) return false;

  // Detect nested shape: any top-level value that itself is an object
  // means the map is keyed by month header.
  let lookup = handledMap;
  if (monthHeader) {
    const bucket = handledMap[monthHeader];
    if (bucket && typeof bucket === 'object') {
      lookup = bucket;
    }
  }

  if (lookup[debt.name]) return true;
  if (debt.originalName && lookup[normalizeBillName_(debt.originalName)]) return true;
  return false;
}

function buildUpcomingPayments_(debts, today, tz, payNowWindowDays, paySoonWindowDays, debtMinimumHandledMap) {
  const payNow = [];
  const paySoon = [];

  debts
    .filter(function(d) { return d.active && d.minimumPayment > 0; })
    .forEach(function(d) {
      // Compute the debt's actual next due date FIRST. The handled-
      // this-month check must be anchored to that due date's month, not
      // to the planner's calendar month — otherwise a debt whose Due Day
      // has already passed this month (April payment recorded) gets
      // skipped even though the real next payment is next month (May)
      // and that cell is still empty.
      const dueDate = getNextDueDate_(today, d.dueDay);
      const dueMonthHeader = Utilities.formatDate(dueDate, tz, 'MMM-yy');

      if (isDebtMinimumHandledThisMonth_(debtMinimumHandledMap, d, dueMonthHeader)) return;

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

/**
 * Merges INPUT - Bills-derived lines into debt Pay now / Pay soon lists.
 * When the same payee + due date exists as a debt line, the debt row wins (no double count).
 */
function mergeDebtAndBillPaymentWindows_(debtPayNow, debtPaySoon, billPayNow, billPaySoon) {
  function key_(item) {
    return normalizeBillName_(item.account) + '|' + String(item.dueDate || '');
  }
  function mergeBucket_(debts, bills) {
    const seen = Object.create(null);
    const out = [];
    (debts || []).forEach(function(d) {
      seen[key_(d)] = true;
      out.push(d);
    });
    (bills || []).forEach(function(b) {
      if (seen[key_(b)]) return;
      seen[key_(b)] = true;
      out.push(b);
    });
    out.sort(function(a, c) {
      if (a.daysUntilDue !== c.daysUntilDue) return a.daysUntilDue - c.daysUntilDue;
      return String(a.account || '').localeCompare(String(c.account || ''));
    });
    return out;
  }
  return {
    payNow: mergeBucket_(debtPayNow, billPayNow),
    paySoon: mergeBucket_(debtPaySoon, billPaySoon)
  };
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