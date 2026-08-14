/**
 * RFP-3a — deterministic household facts and unranked Capital Allocation Queue.
 *
 * This module is deliberately read-only. It builds an in-memory decision input
 * from an explicitly supplied spreadsheet, but it does not rank candidates,
 * allocate cash, write recommendations, transfer money, pay debt, or trade.
 */

var CAPITAL_ALLOCATION_SCHEMA_VERSION_ = 'RFP_3A_V1';
var CAPITAL_ALLOCATION_PLAN_SCHEMA_VERSION_ = 'RFP_3B_V1';
var CAPITAL_ALLOCATION_PRIMARY_INCOME_ACCOUNT_NAME_ = 'Samer Robinhood';
var CAPITAL_ALLOCATION_PRIMARY_INCOME_WEEKLY_MINIMUM_ = 500;
var CAPITAL_ALLOCATION_CRITICAL_DEBT_APR_ = 20;
var CAPITAL_ALLOCATION_HIGH_DEBT_APR_ = 10;
var CAPITAL_ALLOCATION_MODERATE_DEBT_APR_ = 6;

function getCapitalAllocationQueueFromDashboard(payload) {
  return getCapitalAllocationQueueForSpreadsheet_(getUserSpreadsheet_(), payload);
}

/** Explicit-workbook seam for production and marker-verified disposable tests. */
function getCapitalAllocationQueueForSpreadsheet_(ss, payload) {
  if (!ss || typeof ss.getSheetByName !== 'function') {
    throw new Error('A spreadsheet is required for the Capital Allocation Queue.');
  }
  var asOfDate = capitalAllocationAsOfDate_(payload && payload.asOfDate);
  return buildCapitalAllocationQueue_(readCapitalAllocationFacts_(ss, asOfDate));
}

/** Main Planning → This Week endpoint. Read-only by contract. */
function getCapitalAllocationPlanFromDashboard(payload) {
  return getCapitalAllocationPlanForSpreadsheet_(getUserSpreadsheet_(), payload);
}

/** Explicit-workbook seam for production and marker-verified disposable tests. */
function getCapitalAllocationPlanForSpreadsheet_(ss, payload) {
  if (!ss || typeof ss.getSheetByName !== 'function') {
    throw new Error('A spreadsheet is required for the Capital Allocation Plan.');
  }
  var asOfDate = capitalAllocationAsOfDate_(payload && payload.asOfDate);
  return buildCapitalAllocationPlan_(readCapitalAllocationFacts_(ss, asOfDate));
}

/**
 * RFP-3b pure decision kernel.
 *
 * Policy order is deliberately visible and uncomplicated: required household
 * actions, a rolling 90-day operating floor, the normal Samer Robinhood policy
 * unless the emergency override is active, account-buffer restoration, serial
 * extra-debt principal ordered by APR, confirmed account-scoped investment
 * pace, then explicitly held cash. A blocking data-quality finding leaves
 * every discretionary dollar unallocated.
 */
function buildCapitalAllocationPlan_(facts) {
  var queue = buildCapitalAllocationQueue_(facts);
  var blockers = queue.dataQuality.filter(function(row) { return row.blocksAllocation; });
  var openingCash = capitalAllocationMoney_(queue.totals.cashToUse);
  var plan = {
    schemaVersion: CAPITAL_ALLOCATION_PLAN_SCHEMA_VERSION_,
    queueSchemaVersion: queue.schemaVersion,
    asOfDate: queue.asOfDate,
    mode: 'READ_ONLY_WEEKLY_RECOMMENDATION',
    allocationStatus: blockers.length ? 'BLOCKED' : 'ALLOCATED',
    policy: {
      version: 'RFP_3B_POLICY_V1',
      order: [
        'REQUIRED_HOUSEHOLD_ACTIONS',
        'PROTECT_90_DAY_OPERATING_RESERVE',
        'FUND_SAMER_ROBINHOOD_WEEKLY_MINIMUM_UNLESS_EMERGENCY_OVERRIDE',
        'RESTORE_ACCOUNT_RESERVES',
        'PAY_EXTRA_DEBT_BY_APR',
        'FUND_CONFIRMED_INCOME_PRODUCING_PACE',
        'HOLD_REMAINING_CASH'
      ],
      note: 'Samer Robinhood normally receives its $500 weekly policy minimum, but required payments, the operating floor, missed payments, and dangerous revolving debt can trigger a visible safety pause. Every active positive-balance debt remains visible; APR changes extra-principal order, not eligibility.'
    },
    summary: {
      openingCash: openingCash,
      expectedIncomeThisWeek: facts && facts.income &&
        Number(facts.income.expectedThisWeek) > 0
          ? capitalAllocationMoney_(facts.income.expectedThisWeek) : 0,
      protectedCash: queue.totals.protectedCashAmount,
      reserve90Days: capitalAllocationMoney_(facts && facts.forecast90 &&
        facts.forecast90.requiredReserveAmount || 0),
      requiredThisWeek: queue.totals.requiredActionAmount,
      householdRequiredThisWeek: 0,
      standingInvestmentMinimum: 0,
      standingInvestmentFunded: 0,
      emergencyInvestmentOverride: false,
      emergencyInvestmentOverrideReasons: [],
      projectedProtectedCashAfterActions: 0,
      reserveSurplusAfterActions: 0,
      deployableAfterRequired: 0,
      availableForGoals: 0,
      recommendedUses: 0,
      endingCash: openingCash,
      blockingFindingCount: blockers.length
    },
    weeklyActions: [],
    rankedCandidates: [],
    monthlyOutlook: null,
    forecast90: facts && facts.forecast90 || {},
    existingInvestmentContributions: facts && facts.existingInvestmentContributions || [],
    dataQuality: queue.dataQuality,
    queue: queue,
    reconciliation: {
      openingCash: openingCash,
      expectedInflows: 0,
      cashUses: 0,
      endingCash: openingCash,
      difference: 0,
      exact: true
    }
  };

  plan.summary.deployableAfterRequired = Math.max(0, capitalAllocationMoney_(
    plan.summary.openingCash + plan.summary.expectedIncomeThisWeek - plan.summary.requiredThisWeek));
  plan.summary.availableForGoals = Math.max(0, capitalAllocationMoney_(
    plan.summary.deployableAfterRequired - plan.summary.reserve90Days));

  var remaining = openingCash;
  var sequence = 0;
  var cashUses = 0;
  var requiredUses = 0;
  var expectedInflows = plan.summary.expectedIncomeThisWeek;
  remaining = capitalAllocationMoney_(remaining + expectedInflows);

  var requiredRows = queue.hardConstraints.filter(function(row) {
    return row.actionClass === 'REQUIRED_ACTION';
  });
  var standingMinimumAmount = capitalAllocationMoney_(requiredRows.reduce(function(sum, row) {
    return sum + (row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM'
      ? Number(row.requestedAmount || 0) : 0);
  }, 0));
  var householdRequiredAmount = capitalAllocationMoney_(
    queue.totals.requiredActionAmount - standingMinimumAmount);
  var operatingReserveAmount = capitalAllocationMoney_(plan.summary.reserve90Days);
  var emergencyOverrideReasons = capitalAllocationInvestmentOverrideReasons_(
    openingCash + expectedInflows, householdRequiredAmount, standingMinimumAmount,
    operatingReserveAmount, facts);
  var emergencyInvestmentOverride = emergencyOverrideReasons.length > 0;
  plan.summary.householdRequiredThisWeek = householdRequiredAmount;
  plan.summary.standingInvestmentMinimum = standingMinimumAmount;
  plan.summary.emergencyInvestmentOverride = emergencyInvestmentOverride;
  plan.summary.emergencyInvestmentOverrideReasons = emergencyOverrideReasons;
  var effectiveRequiredAmount = capitalAllocationMoney_(householdRequiredAmount +
    (emergencyInvestmentOverride ? 0 : standingMinimumAmount));
  plan.summary.requiredThisWeek = effectiveRequiredAmount;

  requiredRows.sort(function(a, b) {
    var aMinimum = a.actionType === 'FUND_INCOME_PRODUCING_MINIMUM' ? 1 : 0;
    var bMinimum = b.actionType === 'FUND_INCOME_PRODUCING_MINIMUM' ? 1 : 0;
    if (aMinimum !== bMinimum) return aMinimum - bMinimum;
    return String(a.dueDate + ':' + a.candidateId).localeCompare(
      String(b.dueDate + ':' + b.candidateId));
  }).forEach(function(row) {
    if (row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM' && emergencyInvestmentOverride) {
      var overrideRow = {};
      Object.keys(row).forEach(function(key) { overrideRow[key] = row[key]; });
      overrideRow.reason = 'Temporarily pause the standing investment minimum because an emergency-liquidity, missed-payment, or dangerous revolving-debt rule is active.';
      plan.weeklyActions.push(capitalAllocationWeeklyAction_(++sequence, overrideRow,
        0, remaining, 'EMERGENCY_OVERRIDE'));
      return;
    }
    var amount = Math.min(remaining, capitalAllocationMoney_(row.requestedAmount));
    remaining = capitalAllocationMoney_(remaining - amount);
    cashUses = capitalAllocationMoney_(cashUses + amount);
    requiredUses = capitalAllocationMoney_(requiredUses + amount);
    plan.weeklyActions.push(capitalAllocationWeeklyAction_(++sequence, row,
      amount, remaining, amount + 0.005 >= Number(row.requestedAmount) ? 'REQUIRED' : 'PARTIAL'));
    if (row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM') {
      plan.summary.standingInvestmentFunded = amount;
    }
  });

  if (emergencyInvestmentOverride) {
    plan.dataQuality.push(capitalAllocationFinding_(
      'STANDING_INVESTMENT_MINIMUM_EMERGENCY_OVERRIDE', 'WARNING', false,
      'Samer Robinhood\'s $500 weekly minimum is temporarily paused by the emergency solvency policy; review liquidity, missed payments, and critical revolving debt.',
      'Capital Allocation emergency-liquidity policy'));
  }

  if (requiredUses + 0.005 < effectiveRequiredAmount) {
    plan.allocationStatus = 'INSUFFICIENT_CASH';
    var shortfall = capitalAllocationMoney_(effectiveRequiredAmount - requiredUses);
    plan.dataQuality.push(capitalAllocationFinding_(
      'INSUFFICIENT_CASH_FOR_REQUIRED_ACTIONS', 'ERROR', true,
      'Required payments exceed available cash by $' + shortfall.toFixed(2) + '.',
      'Capital Allocation reconciliation'));
    plan.summary.blockingFindingCount += 1;
  }

  plan.summary.deployableAfterRequired = remaining;

  if (blockers.length) {
    plan.summary.availableForGoals = 0;
    plan.summary.recommendedUses = 0;
    plan.summary.endingCash = remaining;
    plan.reconciliation = {
      openingCash: openingCash,
      expectedInflows: expectedInflows,
      cashUses: cashUses,
      endingCash: remaining,
      difference: capitalAllocationMoney_(openingCash + expectedInflows - cashUses - remaining),
      exact: true
    };
    return finalizeCapitalAllocationDecisionViews_(facts, plan);
  }

  var requested90DayReserve = Math.max(0, capitalAllocationMoney_(plan.summary.reserve90Days));
  var held90DayReserve = Math.min(remaining, requested90DayReserve);
  var allocatable = capitalAllocationMoney_(remaining - held90DayReserve);
  plan.summary.availableForGoals = allocatable;
  if (requested90DayReserve > 0) {
    plan.weeklyActions.push(capitalAllocationWeeklyAction_(++sequence, {
      candidateId: 'PROTECT_90_DAY_OPERATING_RESERVE',
      actionClass: 'HARD_CONSTRAINT',
      actionType: 'PROTECT_90_DAY_OPERATING_RESERVE',
      targetName: 'Next 90 days',
      reason: 'Keep cash available for forecast operating bills, debt minimums, Upcoming expenses, and unscheduled property costs after estimated income. Normal investment-policy contributions remain visible but do not inflate the operating floor.',
      provenance: 'INPUT - Bills / INPUT - Debts / INPUT - Upcoming Expenses / INPUT - Cash Flow / HOUSES - *'
    }, held90DayReserve, allocatable,
    held90DayReserve + 0.005 >= requested90DayReserve ? 'PROTECTED' : 'PARTIAL'));
  }
  if (plan.allocationStatus === 'ALLOCATED' &&
      held90DayReserve + 0.005 < requested90DayReserve) {
    plan.allocationStatus = 'RESERVE_SHORTFALL';
    plan.dataQuality.push(capitalAllocationFinding_(
      'INSUFFICIENT_CASH_FOR_90_DAY_RESERVE', 'ERROR', true,
      'Available cash is short of the calculated 90-day reserve by $' +
        capitalAllocationMoney_(requested90DayReserve - held90DayReserve).toFixed(2) + '.',
      '90-day cash forecast'));
    plan.summary.blockingFindingCount += 1;
  }

  queue.hardConstraints.filter(function(row) {
    return row.actionClass === 'HARD_CONSTRAINT';
  }).forEach(function(row) {
    plan.weeklyActions.push(capitalAllocationWeeklyAction_(++sequence, row,
      capitalAllocationMoney_(row.requestedAmount), allocatable, 'PROTECTED'));
  });

  var ranked = queue.discretionaryCandidates.slice().sort(function(a, b) {
    var pa = capitalAllocationCandidatePriority_(a, facts);
    var pb = capitalAllocationCandidatePriority_(b, facts);
    if (pa !== pb) return pa - pb;
    return capitalAllocationActionSort_(a, b);
  });

  for (var i = 0; i < ranked.length; i++) {
    var candidate = ranked[i];
    var copy = {};
    Object.keys(candidate).forEach(function(key) { copy[key] = candidate[key]; });
    copy.rank = i + 1;
    copy.status = 'WAIT';
    copy.allocatedAmount = 0;
    copy.remainingCashAfter = allocatable;
    copy.confidence = capitalAllocationCandidateConfidence_(copy);

    if (copy.actionType === 'HOLD_CASH') {
      copy.allocatedAmount = allocatable;
      copy.status = allocatable > 0 ? 'RECOMMENDED' : 'NOT_NEEDED';
      copy.reason = allocatable > 0
        ? 'Keep the cash that remains after this week\'s higher-priority actions.'
        : 'No unallocated cash remains after this week\'s higher-priority actions.';
    } else {
      var requested = Math.max(0, capitalAllocationMoney_(copy.requestedAmount));
      if (copy.actionType === 'PAY_EXTRA_DEBT') {
        var candidateDebt = capitalAllocationDebtForCandidate_(facts, copy);
        if (!candidateDebt || Number(candidateDebt.interestRate || 0) <
            CAPITAL_ALLOCATION_HIGH_DEBT_APR_) {
          requested = 0;
        }
        var minimumAlreadyPlanned = plan.weeklyActions.reduce(function(sum, action) {
          return sum + (action.actionType === 'PAY_DEBT_MINIMUM' &&
            action.targetName === copy.targetName ? Number(action.amount || 0) : 0);
        }, 0);
        requested = Math.max(0, capitalAllocationMoney_(requested - minimumAlreadyPlanned));
      }
      var allocated = Math.min(allocatable, requested);
      copy.allocatedAmount = allocated;
      allocatable = capitalAllocationMoney_(allocatable - allocated);
      copy.remainingCashAfter = allocatable;
      if (allocated > 0) {
        copy.status = allocated + 0.005 >= requested ? 'RECOMMENDED' : 'PARTIAL';
        cashUses = capitalAllocationMoney_(cashUses + allocated);
        plan.weeklyActions.push(capitalAllocationWeeklyAction_(++sequence, copy,
          allocated, allocatable, copy.status));
      } else {
        copy.reason = capitalAllocationWaitReason_(copy, facts);
      }
    }

    if (copy.actionType === 'PAY_EXTRA_DEBT' && copy.allocatedAmount > 0) {
      var debt = capitalAllocationDebtForCandidate_(facts, copy);
      copy.estimatedAnnualInterestAvoided = debt
        ? capitalAllocationMoney_(copy.allocatedAmount * Number(debt.interestRate || 0) / 100)
        : null;
      copy.benefitBasis = 'APPROXIMATE_FIRST_YEAR_INTEREST_AT_CURRENT_APR';
    }
    plan.rankedCandidates.push(copy);
  }

  plan.summary.recommendedUses = capitalAllocationMoney_(cashUses - requiredUses);
  remaining = capitalAllocationMoney_(held90DayReserve + allocatable);
  plan.summary.endingCash = remaining;
  plan.reconciliation = {
    openingCash: openingCash,
    expectedInflows: expectedInflows,
    cashUses: cashUses,
    endingCash: remaining,
    difference: capitalAllocationMoney_(openingCash + expectedInflows - cashUses - remaining),
    exact: true
  };
  return finalizeCapitalAllocationDecisionViews_(facts, plan);
}

function finalizeCapitalAllocationDecisionViews_(facts, plan) {
  plan.summary.projectedProtectedCashAfterActions = Math.min(
    Number(plan.summary.endingCash || 0), Number(plan.summary.reserve90Days || 0));
  plan.summary.reserveSurplusAfterActions = Math.max(0, capitalAllocationMoney_(
    Number(plan.summary.endingCash || 0) - Number(plan.summary.reserve90Days || 0)));
  plan.monthlyOutlook = capitalAllocationMonthlyOutlook_(plan);
  plan.capitalSourceLadder = buildCapitalAllocationSourceLadder_(facts, plan);
  plan.contributionStrategy = buildCapitalAllocationContributionStrategy_(facts, plan);
  plan.afterAction = buildCapitalAllocationAfterAction_(facts, plan);
  plan.nextDollar = buildCapitalAllocationNextDollar_(facts, plan);
  plan.whyNot = buildCapitalAllocationWhyNot_(facts, plan);
  return plan;
}

function capitalAllocationShouldOverrideInvestmentMinimum_(availableCash, householdRequired,
    standingMinimum, operatingReserve, facts) {
  return capitalAllocationInvestmentOverrideReasons_(availableCash, householdRequired,
    standingMinimum, operatingReserve, facts).length > 0;
}

function capitalAllocationInvestmentOverrideReasons_(availableCash, householdRequired,
    standingMinimum, operatingReserve, facts) {
  var reasons = [];
  if (!(Number(standingMinimum || 0) > 0)) return reasons;
  (facts && facts.obligations || []).forEach(function(row) {
    if (row.requiredThisWeek && /overdue|past due|missed/i.test(String(row.reason || ''))) {
      reasons.push({ code: 'MISSED_OR_OVERDUE_REQUIRED_PAYMENT', targetName: row.name,
        message: (row.name || 'A required payment') + ' is overdue or missed.' });
    }
  });
  (facts && facts.debts || []).forEach(function(debt) {
    if (debt.active && Number(debt.balance || 0) > 0 &&
      Number(debt.interestRate || 0) >= CAPITAL_ALLOCATION_CRITICAL_DEBT_APR_ &&
      /credit|card|revolving/i.test(String(debt.type || ''))) {
      reasons.push({ code: 'CRITICAL_REVOLVING_DEBT', targetName: debt.name,
        apr: Number(debt.interestRate || 0),
        message: debt.name + ' is critical revolving debt at ' +
          Number(debt.interestRate || 0).toFixed(2) + '% APR.' });
    }
  });
  var afterHouseholdRequired = capitalAllocationMoney_(
    Number(availableCash || 0) - Number(householdRequired || 0));
  var requiredForPolicy = capitalAllocationMoney_(
    Number(operatingReserve || 0) + Number(standingMinimum || 0));
  if (afterHouseholdRequired + 0.005 < requiredForPolicy) {
    reasons.push({ code: 'OPERATING_FLOOR_CONFLICT',
      availableAfterHouseholdRequired: afterHouseholdRequired,
      requiredOperatingReserve: capitalAllocationMoney_(operatingReserve),
      standingInvestmentMinimum: capitalAllocationMoney_(standingMinimum),
      shortfall: capitalAllocationMoney_(requiredForPolicy - afterHouseholdRequired),
      message: 'Funding the normal investment policy would leave cash below the operating floor by $' +
        capitalAllocationMoney_(requiredForPolicy - afterHouseholdRequired).toFixed(2) + '.' });
  }
  return reasons;
}

function buildCapitalAllocationSourceLadder_(facts, plan) {
  var steps = [];
  (facts && facts.liquidity && facts.liquidity.accounts || []).forEach(function(account) {
    steps.push({
      sourceType: account.included ? 'CURRENT_ELIGIBLE_CASH' : 'PROTECTED_OR_EXCLUDED_CASH',
      sourceName: account.accountName,
      amount: account.included ? capitalAllocationMoney_(account.usable) : 0,
      visibleBalance: capitalAllocationMoney_(account.balance),
      status: account.included ? 'ELIGIBLE' : 'EXCLUDED',
      reason: account.included
        ? 'Eligible only above its minimum buffer and according to its Use Policy.'
        : capitalAllocationSourceExclusionReason_(account),
      planningRole: account.planningRole || '',
      usePolicy: account.usePolicy || '',
      precedence: 'OWNERSHIP_OR_HARD_EXCLUSION > USE_POLICY > MINIMUM_BUFFER > PLANNING_ROLE > OPTIMIZER'
    });
  });
  var monthlyFreeCashFlow = capitalAllocationEstimatedMonthlyFreeCashFlow_(facts);
  steps.push({ sourceType: 'WEEKLY_FREE_CASH_FLOW', sourceName: 'Estimated household free cash flow',
    amount: monthlyFreeCashFlow > 0 ? capitalAllocationMoney_(monthlyFreeCashFlow * 12 / 52) : 0,
    status: monthlyFreeCashFlow > 0 ? 'ELIGIBLE_FUTURE_CASH_FLOW' : 'NO_SURPLUS_ESTABLISHED',
    reason: 'Forecast cash flow is a future source only; it is never counted as cash available today.' });
  var optionalContributions = capitalAllocationOptionalContributionRows_(facts);
  optionalContributions.forEach(function(row) {
    steps.push({ sourceType: 'PAUSE_OR_REDIRECT_FUTURE_CONTRIBUTION',
      sourceName: row.name, amount: capitalAllocationMoney_(row.amount),
      status: 'ELIGIBLE_FUTURE_CASH_FLOW',
      reason: 'This is the normalized weekly value of the active contribution schedule.' +
        (row.frequency ? ' Current schedule: $' + Number(row.scheduledAmount || 0).toFixed(2) +
          ' ' + row.frequency + '.' : '') +
        ' Stopping future funding changes cash flow only; it does not transfer or sell existing securities.',
      provenance: row.provenance || 'INPUT - Bills' });
  });
  var excludedAssets = [];
  (facts && facts.brokerageFoundation || []).forEach(function(account) {
    if (!account.actionableSource) {
      excludedAssets.push({ accountName: account.accountName,
        currentBalance: capitalAllocationMoney_(account.currentBalance),
        assetClass: account.assetClass, reason: account.exclusionReason,
        investmentId: account.investmentId || '', sysAssetsRow: account.sysAssetsRow });
      return;
    }
    steps.push({ sourceType: 'BROKERAGE_IN_KIND_TRANSFER_REVIEW',
      sourceName: account.accountName, amount: capitalAllocationMoney_(account.currentBalance),
      status: account.inKindTransferStatus,
      reason: account.identityMessage + ' An in-kind transfer changes custodian only and does not create income or change the investment strategy.',
      investmentId: account.investmentId || '', sysAssetsRow: account.sysAssetsRow });
    steps.push({ sourceType: 'BROKERAGE_SELL_OR_TRIM_REVIEW',
      sourceName: account.accountName, amount: null,
      status: account.salePlanningStatus,
      reason: account.salePlanningStatus === 'TAX_DATA_REQUIRED'
        ? account.identityMessage + ' A taxable sale cannot be recommended until positions, basis, tax lots, holding period, and wash-sale inputs are available.'
        : 'This account is not currently an eligible taxable-sale source.',
      investmentId: account.investmentId || '', sysAssetsRow: account.sysAssetsRow });
  });
  return { steps: steps, estimatedMonthlyFreeCashFlow:
    monthlyFreeCashFlow,
    brokerageDataContract: {
      fields: ['security', 'account', 'quantity', 'marketValue', 'costBasis',
        'taxLots', 'holdingPeriod', 'unrealizedGainLoss', 'planningStatus'],
      planningStatuses: ['TAX_DATA_REQUIRED', 'TAX_LOSS_CANDIDATE',
        'HIGH_BASIS_LOW_TAX_COST', 'CONCENTRATION_REVIEW', 'DO_NOT_SELL'],
      status: 'FOUNDATION_ONLY'
    }, excludedAssets: excludedAssets };
}

function capitalAllocationSourceExclusionReason_(account) {
  if (String(account.planningRole || '').toUpperCase() === 'CHILD_CUSTODIAL') {
    return 'Child or custodial ownership is a hard exclusion and cannot be overridden.';
  }
  if (String(account.planningRole || '').toUpperCase() === 'DO_NOT_TOUCH') {
    return 'This account role is a hard exclusion and cannot be overridden.';
  }
  if (account.excludedReason === 'do_not_touch_policy') {
    return 'Do Not Touch cash remains visible but cannot fund recommendations.';
  }
  if (account.excludedReason === 'inactive') return 'Inactive accounts are excluded.';
  return 'This account is not eligible under its current Type and Use Policy.';
}

function capitalAllocationOptionalContributionRows_(facts) {
  var recurring = facts && facts.recurringInvestmentContributions || [];
  var rows = recurring.length ? recurring : facts && facts.existingInvestmentContributions || [];
  return rows.filter(function(row) {
    return capitalAllocationMatchText_(row.matchedAccountName || row.name) !==
      capitalAllocationMatchText_(CAPITAL_ALLOCATION_PRIMARY_INCOME_ACCOUNT_NAME_);
  });
}

function capitalAllocationEstimatedMonthlyFreeCashFlow_(facts) {
  var forecast = facts && facts.forecast90 || {};
  return capitalAllocationMoney_(Number(forecast.expectedIncome || 0) / 3 -
    Number(forecast.futureOperatingOutflowsAmount || 0) / 3);
}

function buildCapitalAllocationContributionStrategy_(facts, plan) {
  var optionalRows = capitalAllocationOptionalContributionRows_(facts);
  var optionalWeekly = capitalAllocationMoney_(optionalRows.reduce(function(sum, row) {
    return sum + Number(row.amount || 0);
  }, 0));
  var debts = (facts && facts.debts || []).filter(function(row) {
    return row.active && Number(row.balance || 0) > 0;
  }).sort(function(a, b) { return Number(b.interestRate || 0) - Number(a.interestRate || 0); });
  var highest = debts[0] || null;
  var result = { currentOptionalWeekly: optionalWeekly,
    standingRobinhoodMinimum: Number(plan.summary.standingInvestmentMinimum || 0),
    standingRobinhoodFunded: Number(plan.summary.standingInvestmentFunded || 0),
    recommendation: 'KEEP_CURRENT', destination: '', redirectedWeekly: 0,
    reason: optionalWeekly > 0 ? 'No higher-value redirect has been proven.' : 'No optional recurring contribution is scheduled.',
    sourceContributions: optionalRows };
  if (plan.summary.emergencyInvestmentOverride) {
    result.recommendation = 'PAUSE_OPTIONAL_AND_MINIMUM_FOR_EMERGENCY_LIQUIDITY';
    result.destination = 'Operating reserve and required payments';
    result.redirectedWeekly = optionalWeekly;
    result.reason = 'Required payments and the operating floor take precedence over every investment contribution.';
  } else if (highest && Number(highest.interestRate || 0) >= CAPITAL_ALLOCATION_HIGH_DEBT_APR_) {
    result.recommendation = 'REDIRECT_OPTIONAL_CONTRIBUTIONS_TO_DEBT';
    result.destination = highest.name;
    result.redirectedWeekly = optionalWeekly;
    result.reason = 'The guaranteed avoided cost at ' + Number(highest.interestRate).toFixed(2) +
      '% APR outranks optional investment funding.';
  } else if (highest && Number(highest.interestRate || 0) >= CAPITAL_ALLOCATION_MODERATE_DEBT_APR_) {
    result.recommendation = 'REVIEW_DEBT_VS_INVESTMENT_SPLIT';
    result.destination = highest.name + ' or ' + CAPITAL_ALLOCATION_PRIMARY_INCOME_ACCOUNT_NAME_;
    result.reason = 'Moderate-cost debt requires an explicit risk/return comparison before redirecting optional contributions.';
  } else if (optionalWeekly > 0) {
    result.recommendation = 'REDIRECT_OPTIONAL_CONTRIBUTIONS_TO_PASSIVE_INCOME';
    result.destination = CAPITAL_ALLOCATION_PRIMARY_INCOME_ACCOUNT_NAME_;
    result.redirectedWeekly = optionalWeekly;
    result.reason = 'No higher-cost debt currently outranks the household passive-income strategy.';
  }
  return result;
}

function buildCapitalAllocationAfterAction_(facts, plan) {
  var payments = {};
  (plan.weeklyActions || []).forEach(function(action) {
    if (action.actionType !== 'PAY_DEBT_MINIMUM' && action.actionType !== 'PAY_EXTRA_DEBT') return;
    payments[action.targetName] = capitalAllocationMoney_(
      Number(payments[action.targetName] || 0) + Number(action.amount || 0));
  });
  var debtRows = (facts && facts.debts || []).filter(function(debt) {
    return debt.active && Number(debt.balance || 0) > 0;
  }).map(function(debt) {
    var payment = Math.min(Number(debt.balance || 0), Number(payments[debt.name] || 0));
    var ending = capitalAllocationMoney_(Number(debt.balance || 0) - payment);
    var annualBefore = capitalAllocationMoney_(Number(debt.balance || 0) * Number(debt.interestRate || 0) / 100);
    var annualAfter = capitalAllocationMoney_(ending * Number(debt.interestRate || 0) / 100);
    return { name: debt.name, apr: Number(debt.interestRate || 0),
      priorityClass: capitalAllocationDebtPriorityClass_(debt.interestRate),
      startingBalance: capitalAllocationMoney_(debt.balance), payment: payment,
      endingBalance: ending, estimatedAnnualInterestBefore: annualBefore,
      estimatedAnnualInterestAfter: annualAfter,
      estimatedAnnualInterestAvoided: capitalAllocationMoney_(annualBefore - annualAfter),
      monthlyMinimumReleased: ending <= 0.005 ? capitalAllocationMoney_(debt.minimumPayment) : 0 };
  });
  var releasedMonthly = capitalAllocationMoney_(debtRows.reduce(function(sum, row) {
    return sum + Number(row.monthlyMinimumReleased || 0);
  }, 0));
  var robinhood = (facts && facts.incomeProducingAccounts || []).filter(function(account) {
    return capitalAllocationMinimumWeeklyCommitment_(account) > 0;
  })[0] || {};
  var robinhoodFunding = capitalAllocationMoney_((plan.weeklyActions || []).reduce(function(sum, row) {
    return sum + (/^FUND_INCOME_PRODUCING_/.test(String(row.actionType || ''))
      ? Number(row.amount || 0) : 0);
  }, 0));
  return { cashBefore: capitalAllocationMoney_(plan.summary.openingCash),
    cashAfter: capitalAllocationMoney_(plan.summary.endingCash),
    reserveAfter: capitalAllocationMoney_(plan.summary.reserve90Days),
    debts: debtRows,
    debtBefore: capitalAllocationMoney_(debtRows.reduce(function(sum, row) { return sum + row.startingBalance; }, 0)),
    debtAfter: capitalAllocationMoney_(debtRows.reduce(function(sum, row) { return sum + row.endingBalance; }, 0)),
    estimatedAnnualInterestAvoided: capitalAllocationMoney_(debtRows.reduce(function(sum, row) { return sum + row.estimatedAnnualInterestAvoided; }, 0)),
    releasedMonthlyMinimums: releasedMonthly,
    releasedWeeklyEquivalent: capitalAllocationMoney_(releasedMonthly * 12 / 52),
    robinhoodBalanceBefore: capitalAllocationMoney_(robinhood.currentBalance || 0),
    robinhoodFundingThisWeek: robinhoodFunding,
    robinhoodBalanceAfterContributions: capitalAllocationMoney_(Number(robinhood.currentBalance || 0) + robinhoodFunding),
    passiveIncomeImpact: null,
    passiveIncomeImpactStatus: 'YIELD_DATA_REQUIRED' };
}

function capitalAllocationDebtPriorityClass_(apr) {
  var rate = Number(apr || 0);
  if (rate >= CAPITAL_ALLOCATION_CRITICAL_DEBT_APR_) return 'CRITICAL';
  if (rate >= CAPITAL_ALLOCATION_HIGH_DEBT_APR_) return 'HIGH';
  if (rate >= CAPITAL_ALLOCATION_MODERATE_DEBT_APR_) return 'MODERATE';
  return 'LOW_COST';
}

function buildCapitalAllocationNextDollar_(facts, plan) {
  var after = plan.afterAction || buildCapitalAllocationAfterAction_(facts, plan);
  if (Number(plan.summary.endingCash || 0) + 0.005 < Number(plan.summary.reserve90Days || 0)) {
    return { amount: 1000, actionType: 'HOLD_OR_RESTORE_OPERATING_RESERVE',
      destination: 'Household operating reserve',
      reason: 'The next dollar must restore liquidity before optional debt or investment use.', confidence: 'HIGH' };
  }
  var debts = (after.debts || []).filter(function(row) {
    return row.endingBalance > 0 && row.apr >= CAPITAL_ALLOCATION_HIGH_DEBT_APR_;
  }).sort(function(a, b) { return b.apr - a.apr; });
  if (debts.length) {
    return { amount: Math.min(1000, debts[0].endingBalance), actionType: 'PAY_EXTRA_DEBT',
      destination: debts[0].name, guaranteedReturnRate: debts[0].apr,
      newlyReleasedWeeklyCashFlow: Number(after.releasedWeeklyEquivalent || 0),
      reason: 'This is the highest remaining guaranteed economic cost.' +
        (Number(after.releasedWeeklyEquivalent || 0) > 0
          ? ' Redirect the newly released ' +
            '$' + Number(after.releasedWeeklyEquivalent).toFixed(2) +
            ' per week from completed debts here in the next planning period.' : ''),
      confidence: 'HIGH' };
  }
  var strategy = plan.contributionStrategy || buildCapitalAllocationContributionStrategy_(facts, plan);
  if (strategy.recommendation === 'REDIRECT_OPTIONAL_CONTRIBUTIONS_TO_PASSIVE_INCOME') {
    return { amount: 1000, actionType: 'FUND_INCOME_PRODUCING_ACCOUNT',
      destination: CAPITAL_ALLOCATION_PRIMARY_INCOME_ACCOUNT_NAME_,
      newlyReleasedWeeklyCashFlow: Number(after.releasedWeeklyEquivalent || 0),
      reason: 'Required reserves and high-cost debt no longer outrank the passive-income strategy.' +
        (Number(after.releasedWeeklyEquivalent || 0) > 0
          ? ' The next planning period can add the released debt minimum to this funding pace.' : ''),
      confidence: 'MEDIUM' };
  }
  return { amount: 1000, actionType: 'HOLD_FOR_REVIEW', destination: 'Household liquidity',
    reason: 'The next decision requires a debt-versus-investment scenario or missing tax data.', confidence: 'MEDIUM' };
}

function buildCapitalAllocationWhyNot_(facts, plan) {
  var next = plan.nextDollar || buildCapitalAllocationNextDollar_(facts, plan);
  if (next.actionType === 'PAY_EXTRA_DEBT') {
    return { recommended: 'Pay ' + next.destination,
      alternative: 'Add the same amount to ' + CAPITAL_ALLOCATION_PRIMARY_INCOME_ACCOUNT_NAME_,
      comparison: Number(next.guaranteedReturnRate || 0).toFixed(2) +
        '% avoided interest is near-guaranteed; investment return and distributions are uncertain.',
      winner: 'PAY_DEBT', confidence: 'HIGH' };
  }
  if (next.actionType === 'FUND_INCOME_PRODUCING_ACCOUNT') {
    return { recommended: 'Fund ' + CAPITAL_ALLOCATION_PRIMARY_INCOME_ACCOUNT_NAME_,
      alternative: 'Prepay low-cost debt',
      comparison: 'High-cost debt and required reserves are satisfied; low-cost debt remains visible but does not automatically outrank long-term investing.',
      winner: 'FUND_PASSIVE_INCOME', confidence: 'MEDIUM' };
  }
  return { recommended: 'Hold or review', alternative: 'Sell taxable investments',
    comparison: 'A sale is not ranked until basis, tax lots, holding period, and wash-sale inputs are available.',
    winner: 'WAIT_FOR_DATA', confidence: 'HIGH' };
}

function capitalAllocationCandidatePriority_(candidate, facts) {
  if (candidate.actionType === 'RESTORE_RESERVE') return 100;
  if (candidate.actionType === 'PAY_EXTRA_DEBT') {
    var debt = capitalAllocationDebtForCandidate_(facts, candidate);
    return 300 - Math.max(0, Number(debt && debt.interestRate || 0));
  }
  if (candidate.actionType === 'FUND_INCOME_PRODUCING_ACCOUNT') return 400;
  if (candidate.actionType === 'HOLD_CASH') return 1000;
  return 900;
}

function capitalAllocationDebtForCandidate_(facts, candidate) {
  var debts = facts && facts.debts || [];
  for (var i = 0; i < debts.length; i++) {
    if (String(debts[i].name) === String(candidate.targetName)) return debts[i];
  }
  return null;
}

function capitalAllocationCandidateConfidence_(candidate) {
  if (candidate.actionType === 'FUND_INCOME_PRODUCING_ACCOUNT') return 'MEDIUM';
  return 'HIGH';
}

function capitalAllocationWaitReason_(candidate, facts) {
  if (candidate.actionType === 'FUND_INCOME_PRODUCING_ACCOUNT' &&
      !(Number(candidate.requestedAmount) > 0)) {
    return 'No active recurring plan sizes this account, so no contribution is recommended.';
  }
  if (candidate.actionType === 'PAY_EXTRA_DEBT') {
    var debt = capitalAllocationDebtForCandidate_(facts, candidate);
    var apr = Number(debt && debt.interestRate || 0);
    if (apr >= CAPITAL_ALLOCATION_MODERATE_DEBT_APR_ &&
        apr < CAPITAL_ALLOCATION_HIGH_DEBT_APR_) {
      return 'This moderate-cost debt waits for an explicit debt-versus-investment scenario comparison.';
    }
    if (apr < CAPITAL_ALLOCATION_MODERATE_DEBT_APR_) {
      return 'This lower-cost debt stays visible, but does not receive extra principal while higher-value uses rank ahead of it.';
    }
  }
  return 'This waits because higher-priority actions use all deployable cash this week.';
}

function capitalAllocationWeeklyAction_(sequence, row, amount, remaining, status) {
  return {
    sequence: sequence,
    candidateId: row.candidateId,
    actionClass: row.actionClass,
    actionType: row.actionType,
    targetName: row.targetName,
    amount: capitalAllocationMoney_(amount),
    status: status,
    reason: row.reason,
    provenance: row.provenance,
    remainingCashAfter: capitalAllocationMoney_(remaining)
  };
}

function capitalAllocationMonthlyOutlook_(plan) {
  var totals = {
    requiredActions: 0,
    reserve90Days: capitalAllocationMoney_(plan.summary.reserve90Days),
    reserveRestoration: 0,
    incomeProducingFunding: 0,
    extraDebt: 0,
    heldCash: capitalAllocationMoney_(plan.summary.endingCash),
    endingCash: capitalAllocationMoney_(plan.summary.endingCash)
  };
  (plan.weeklyActions || []).forEach(function(row) {
    if (row.actionType === 'FUND_INCOME_PRODUCING_MINIMUM') {
      totals.incomeProducingFunding += Number(row.amount || 0);
    } else if (row.actionClass === 'REQUIRED_ACTION') totals.requiredActions += Number(row.amount || 0);
    else if (row.actionType === 'PROTECT_90_DAY_OPERATING_RESERVE') return;
    else if (row.actionType === 'RESTORE_RESERVE') totals.reserveRestoration += Number(row.amount || 0);
    else if (row.actionType === 'FUND_INCOME_PRODUCING_ACCOUNT') totals.incomeProducingFunding += Number(row.amount || 0);
    else if (row.actionType === 'PAY_EXTRA_DEBT') totals.extraDebt += Number(row.amount || 0);
  });
  Object.keys(totals).forEach(function(key) { totals[key] = capitalAllocationMoney_(totals[key]); });
  return {
    month: String(plan.asOfDate || '').slice(0, 7),
    coverage: 'CURRENT_WEEK_ONLY',
    label: 'Current recorded week; future weeks require authoritative income timing.',
    totals: totals
  };
}

/** Pure kernel. Identical normalized facts produce equivalent ordered output. */
function buildCapitalAllocationQueue_(facts) {
  facts = facts || {};
  var liquidity = facts.liquidity || { cashToUse: 0, accounts: [] };
  var debts = (facts.debts || []).filter(function(row) {
    return row.active && Number(row.balance || 0) > 0;
  });
  var findings = (facts.dataQuality || []).slice();
  var required = [];
  var candidates = [];

  (liquidity.accounts || []).forEach(function(account) {
    var balance = capitalAllocationMoney_(account.balance);
    var buffer = Math.max(0, capitalAllocationMoney_(account.minBuffer));
    if ((account.excludedReason === 'do_not_touch_policy' ||
         account.excludedReason === 'hard_exclusion_role') && balance > 0) {
      required.push(capitalAllocationAction_(
        'PROTECT_CASH:' + capitalAllocationKey_(account.accountName),
        'HARD_CONSTRAINT', 'PROTECT_CASH', account.accountName, balance,
        'CURRENT_BALANCE', account.excludedReason === 'hard_exclusion_role'
          ? 'Protected by ownership or its hard-exclusion Planning Role.'
          : 'Protected by the account Use Policy.', 'SYS - Accounts'));
    } else if (account.included && buffer > 0) {
      required.push(capitalAllocationAction_(
        'PROTECT_BUFFER:' + capitalAllocationKey_(account.accountName),
        'HARD_CONSTRAINT', 'PROTECT_MINIMUM_BUFFER', account.accountName,
        Math.min(Math.max(0, balance), buffer), 'CURRENT_BALANCE',
        'Keep this account at or above its configured minimum buffer.', 'SYS - Accounts'));
      if (balance < buffer) {
        candidates.push(capitalAllocationAction_(
          'RESTORE_RESERVE:' + capitalAllocationKey_(account.accountName),
          'DISCRETIONARY', 'RESTORE_RESERVE', account.accountName,
          capitalAllocationMoney_(buffer - balance), 'BUFFER_SHORTFALL',
          'Restore the configured account buffer before optional uses of cash.', 'SYS - Accounts'));
      }
    }
  });

  (facts.obligations || []).forEach(function(item) {
    if (!item.requiredThisWeek || Number(item.amount || 0) <= 0) return;
    var action = capitalAllocationAction_(
      'REQUIRED:' + capitalAllocationKey_(item.sourceType + ':' + item.sourceId),
      'REQUIRED_ACTION', item.actionType || 'PAY_OBLIGATION', item.name,
      item.amount, item.amountBasis || 'DUE_AMOUNT', item.reason, item.provenance);
    action.dueDate = String(item.dueDate || '');
    required.push(action);
  });

  var primaryIncomeAccountFound = false;
  (facts.incomeProducingAccounts || []).forEach(function(account) {
    var minimumCommitment = capitalAllocationMinimumWeeklyCommitment_(account);
    if (!(minimumCommitment > 0) || !account.eligible) return;
    primaryIncomeAccountFound = true;
    var commitment = capitalAllocationAction_(
      'REQUIRED_INCOME_COMMITMENT:' + capitalAllocationKey_(account.investmentId || account.accountName),
      'REQUIRED_ACTION', 'FUND_INCOME_PRODUCING_MINIMUM', account.accountName,
      minimumCommitment, 'STANDING_WEEKLY_MINIMUM',
      '$500 is the standing weekly Samer Robinhood commitment and is not optional.',
      'SYS - Assets / Capital Allocation policy');
    commitment.dueDate = String(facts.asOfDate || '');
    commitment.investmentId = account.investmentId || '';
    required.push(commitment);
  });
  if (!primaryIncomeAccountFound) {
    findings.push(capitalAllocationFinding_(
      'PRIMARY_INCOME_ACCOUNT_UNAVAILABLE', 'ERROR', true,
      'Samer Robinhood must remain active and Income-Producing so its required $500 weekly commitment can be allocated.',
      'SYS - Assets'));
  }

  debts.forEach(function(debt) {
    candidates.push(capitalAllocationAction_(
      'EXTRA_DEBT:' + capitalAllocationKey_(debt.originalName || debt.name),
      'DISCRETIONARY', 'PAY_EXTRA_DEBT', debt.name, debt.balance,
      'MAXIMUM_BALANCE',
      'Every active positive-balance debt remains eligible; APR affects later ordering only.',
      'INPUT - Debts'));
    if (!Number(debt.interestRate || 0)) {
      findings.push(capitalAllocationFinding_(
        'MISSING_DEBT_APR:' + capitalAllocationKey_(debt.originalName || debt.name),
        'WARNING', true,
        debt.name + ' has no usable APR. It remains in the queue, but ranking must wait.',
        'INPUT - Debts'));
    }
  });

  (facts.incomeProducingAccounts || []).forEach(function(account) {
    if (!account.eligible) return;
    var minimumCommitment = capitalAllocationMinimumWeeklyCommitment_(account);
    var plannedExtra = Math.max(0, capitalAllocationMoney_(
      Number(account.requestedWeeklyPace || 0) - minimumCommitment));
    var redirectExtra = minimumCommitment > 0
      ? capitalAllocationOptionalRedirectToIncomeAmount_(facts) : 0;
    var requested = capitalAllocationMoney_(plannedExtra + redirectExtra);
    candidates.push(capitalAllocationAction_(
      'FUND_INCOME_ACCOUNT:' + capitalAllocationKey_(account.investmentId),
      'DISCRETIONARY', 'FUND_INCOME_PRODUCING_ACCOUNT', account.accountName,
      requested > 0 ? requested : null,
      requested > 0 ? 'NORMALIZED_WEEKLY_PLAN_PACE' : 'UNSIZED_INTENT',
      requested > 0
        ? redirectExtra > 0
          ? 'Redirect optional future contributions here because required reserves and higher-cost debt no longer outrank the passive-income strategy.'
          : 'Additional funding above the standing minimum comes from active account-scoped plans after cash protection and higher-priority debt.'
        : minimumCommitment > 0
          ? 'The required $500 weekly commitment is already included; no additional confirmed pace is recorded.'
          : 'The account is eligible, but no active recurring plan sizes this candidate.',
      'SYS - Assets / SYS - Investment Plans'));
    if (!(requested > 0) && !(minimumCommitment > 0)) {
      findings.push(capitalAllocationFinding_(
        'UNSIZED_INCOME_ACCOUNT:' + capitalAllocationKey_(account.investmentId),
        'WARNING', false,
        account.accountName + ' has no active recurring plan, so its funding candidate is intentionally unsized.',
        'SYS - Investment Plans'));
    }
  });

  candidates.push(capitalAllocationAction_(
    'HOLD_CASH', 'DISCRETIONARY', 'HOLD_CASH', 'Household liquidity',
    capitalAllocationMoney_(liquidity.cashToUse), 'MAXIMUM_DEPLOYABLE_CASH',
    'Holding cash remains an explicit alternative to every deployment candidate.',
    'SYS - Accounts'));

  required.sort(capitalAllocationActionSort_);
  candidates.sort(capitalAllocationActionSort_);
  findings.sort(function(a, b) { return String(a.findingId).localeCompare(String(b.findingId)); });
  var requiredActionAmount = capitalAllocationMoney_(required.reduce(function(sum, row) {
    return sum + (row.actionClass === 'REQUIRED_ACTION' ? Number(row.requestedAmount || 0) : 0);
  }, 0));
  var protectedCashAmount = capitalAllocationMoney_(required.reduce(function(sum, row) {
    return sum + (row.actionClass === 'HARD_CONSTRAINT' ? Number(row.requestedAmount || 0) : 0);
  }, 0));
  var outputFacts = {};
  Object.keys(facts).forEach(function(key) { outputFacts[key] = facts[key]; });
  outputFacts.dataQuality = findings;

  return {
    schemaVersion: CAPITAL_ALLOCATION_SCHEMA_VERSION_,
    asOfDate: String(facts.asOfDate || ''),
    mode: 'READ_ONLY_FACTS_AND_UNRANKED_CANDIDATES',
    allocationStatus: 'NOT_ALLOCATED',
    facts: outputFacts,
    hardConstraints: required,
    discretionaryCandidates: candidates,
    dataQuality: findings,
    totals: {
      cashToUse: capitalAllocationMoney_(liquidity.cashToUse),
      requiredActionAmount: requiredActionAmount,
      protectedCashAmount: protectedCashAmount,
      activePositiveDebtBalance: capitalAllocationMoney_(debts.reduce(function(sum, row) {
        return sum + Number(row.balance || 0);
      }, 0)),
      blockingFindingCount: findings.filter(function(row) { return row.blocksAllocation; }).length
    },
    reconciliation: {
      allocatedAmount: 0,
      remainingCash: capitalAllocationMoney_(liquidity.cashToUse),
      exact: true,
      note: 'RFP-3a does not allocate or rank discretionary candidates.'
    }
  };
}

function capitalAllocationOptionalRedirectToIncomeAmount_(facts) {
  var hasModerateOrHigherDebt = (facts && facts.debts || []).some(function(debt) {
    return debt.active && Number(debt.balance || 0) > 0 &&
      Number(debt.interestRate || 0) >= CAPITAL_ALLOCATION_MODERATE_DEBT_APR_;
  });
  if (hasModerateOrHigherDebt) return 0;
  return capitalAllocationMoney_(capitalAllocationOptionalContributionRows_(facts)
    .reduce(function(sum, row) { return sum + Number(row.amount || 0); }, 0));
}

function capitalAllocationMinimumWeeklyCommitment_(account) {
  if (!account) return 0;
  if (Number(account.minimumWeeklyContribution || 0) > 0) {
    return capitalAllocationMoney_(account.minimumWeeklyContribution);
  }
  var isPrimaryRole = String(account.planningRole || '').toUpperCase() ===
    'PRIMARY_INCOME_STRATEGY';
  var isCurrentPrimary = capitalAllocationMatchText_(account.accountName) ===
    capitalAllocationMatchText_(CAPITAL_ALLOCATION_PRIMARY_INCOME_ACCOUNT_NAME_);
  return isPrimaryRole || isCurrentPrimary
    ? CAPITAL_ALLOCATION_PRIMARY_INCOME_WEEKLY_MINIMUM_ : 0;
}

function readCapitalAllocationFacts_(ss, asOfDate) {
  var findings = [];
  var property = readCapitalAllocationProperty_(ss, asOfDate, findings);
  var income = readCapitalAllocationIncome_(ss, findings, property);
  var debts = readCapitalAllocationDebts_(ss, findings);
  var assetFoundation = readCapitalAllocationAssetFoundation_(ss);
  var incomeProducingAccounts = readCapitalAllocationInvestments_(ss, assetFoundation);
  var obligationResult = readCapitalAllocationObligations_(
    ss, asOfDate, findings, incomeProducingAccounts);
  var recurringInvestmentContributions = readCapitalAllocationRecurringInvestmentContributions_(
    ss, incomeProducingAccounts);
  var forecast90 = readCapitalAllocationForecast90_(ss, asOfDate, findings, {
    currentRequired: obligationResult.required,
    debts: debts,
    income: income,
    property: property,
    incomeProducingAccounts: incomeProducingAccounts
  });
  return {
    asOfDate: capitalAllocationIso_(asOfDate),
    liquidity: readCapitalAllocationLiquidity_(ss, findings),
    income: income,
    debts: debts,
    obligations: obligationResult.required,
    existingInvestmentContributions: obligationResult.investmentContributions,
    recurringInvestmentContributions: recurringInvestmentContributions,
    property: property,
    incomeProducingAccounts: incomeProducingAccounts,
    brokerageFoundation: readCapitalAllocationBrokerageFoundation_(assetFoundation),
    forecast90: forecast90,
    dataQuality: findings
  };
}

function readCapitalAllocationRecurringInvestmentContributions_(ss, incomeProducingAccounts) {
  var sheet = ss.getSheetByName(getSheetNames_().BILLS);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];
  var headers = (display[0] || []).map(function(value) {
    return String(value || '').trim().toLowerCase();
  });
  function col(name) { return headers.indexOf(String(name || '').toLowerCase()); }
  var payeeCol = col('Payee');
  var categoryCol = col('Category');
  var amountCol = col('Default Amount');
  var frequencyCol = col('Frequency');
  var activeCol = col('Active');
  if (payeeCol === -1 || amountCol === -1 || activeCol === -1) return [];
  var rows = [];
  for (var r = 1; r < display.length; r++) {
    if (normalizeYesNo_(display[r][activeCol]) !== 'yes') continue;
    var bill = { payee: String(display[r][payeeCol] || '').trim(),
      category: categoryCol === -1 ? '' : String(display[r][categoryCol] || '').trim() };
    var match = capitalAllocationClassifyInvestmentContribution_(
      bill, incomeProducingAccounts || []);
    if (!match.isInvestmentContribution) continue;
    var amount = Math.max(0, capitalAllocationMoney_(toNumber_(values[r][amountCol])));
    if (!(amount > 0)) continue;
    var frequency = normalizeFrequency_(frequencyCol === -1 ? '' : display[r][frequencyCol]);
    rows.push({ name: bill.payee || 'Investment contribution',
      scheduledAmount: amount, frequency: frequency,
      amount: capitalAllocationNormalizeContributionWeekly_(amount, frequency),
      matchedInvestmentId: match.investmentId, matchedAccountName: match.accountName,
      classificationBasis: match.basis, provenance: 'INPUT - Bills recurring schedule' });
  }
  return rows.sort(function(a, b) { return a.name.localeCompare(b.name); });
}

function capitalAllocationNormalizeContributionWeekly_(amount, frequency) {
  var value = Math.max(0, Number(amount || 0));
  var occurrencesPerYear = { weekly: 52, biweekly: 26, monthly: 12,
    bimonthly: 6, quarterly: 4, semi_annually: 2, yearly: 1 };
  return capitalAllocationMoney_(value * Number(occurrencesPerYear[frequency] || 12) / 52);
}

function readCapitalAllocationLiquidity_(ss, findings) {
  var sheet = ss.getSheetByName(getSheetNames_().ACCOUNTS);
  var result = { cashToUse: 0, accounts: [], provenance: 'SYS - Accounts' };
  if (!sheet) {
    findings.push(capitalAllocationFinding_('CASH_DATA_UNAVAILABLE', 'ERROR', true,
      'SYS - Accounts is missing, so deployable cash cannot be proven.', 'SYS - Accounts'));
    return result;
  }
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return result;
  var map;
  try { map = getAccountsHeaderMap_(sheet, display); } catch (e) {
    findings.push(capitalAllocationFinding_('CASH_SCHEMA_INVALID', 'ERROR', true,
      'SYS - Accounts headers are not readable.', 'SYS - Accounts'));
    return result;
  }
  var total = 0;
  var headers = display[0] || [];
  var planningRoleCol = headers.indexOf('Planning Role');
  var accountIdCol = headers.indexOf('Account Id');
  for (var r = 1; r < display.length; r++) {
    var name = String(display[r][map.nameColZero] || '').trim();
    if (!name) continue;
    var balance = map.balanceColZero === -1 ? 0 : capitalAllocationMoney_(toNumber_(values[r][map.balanceColZero]));
    var buffer = map.bufferColZero === -1 ? 0 : Math.max(0, capitalAllocationMoney_(toNumber_(values[r][map.bufferColZero])));
    var type = map.typeColZero === -1 ? '' : String(display[r][map.typeColZero] || '').trim().toLowerCase();
    var policy = map.policyColZero === -1 ? '' : String(display[r][map.policyColZero] || '').trim().toLowerCase();
    var planningRole = planningRoleCol === -1 ? '' :
      String(display[r][planningRoleCol] || '').trim().toUpperCase();
    var accountId = accountIdCol === -1 ? '' : String(display[r][accountIdCol] || '').trim();
    var activeRaw = map.activeColZero === -1 ? '' : String(display[r][map.activeColZero] || '').trim().toLowerCase();
    var inactive = ['no', 'n', 'false', 'inactive'].indexOf(activeRaw) !== -1;
    var reason = '';
    if (planningRole === 'CHILD_CUSTODIAL' || planningRole === 'DO_NOT_TOUCH') {
      reason = 'hard_exclusion_role';
    }
    else if (inactive) reason = 'inactive';
    else if (CASH_TO_USE_ALLOWED_TYPES_.indexOf(type) === -1) reason = 'non_cash_type';
    else if (policy === CASH_TO_USE_DO_NOT_TOUCH_POLICY_) reason = 'do_not_touch_policy';
    else if (CASH_TO_USE_ALLOWED_POLICIES_.indexOf(policy) === -1) reason = 'unsupported_use_policy';
    var included = !reason;
    var usable = included ? Math.max(0, capitalAllocationMoney_(balance - buffer)) : 0;
    total = capitalAllocationMoney_(total + usable);
    var account = { accountId: accountId, accountName: name, balance: balance,
      minBuffer: buffer, type: type, usePolicy: policy, planningRole: planningRole,
      usable: usable, included: included, provenance: 'SYS - Accounts' };
    if (reason) account.excludedReason = reason;
    result.accounts.push(account);
    if (capitalAllocationIsSamerAllyAccount_(name) &&
        reason === 'do_not_touch_policy') {
      findings.push(capitalAllocationFinding_(
        'SAMER_ALLY_USE_POLICY_CONFLICT', 'ERROR', true,
        name + ' is intended to be eligible household capital but is currently marked Do Not Touch. In Assets & Liabilities → Bank accounts → Manage, change its Use Policy to Extra Cash and set the minimum buffer before using this plan.',
        'SYS - Accounts / approved household capital policy'));
    }
  }
  result.accounts.sort(function(a, b) { return a.accountName.localeCompare(b.accountName); });
  result.cashToUse = total;
  return result;
}

function capitalAllocationIsSamerAllyAccount_(name) {
  var normalized = capitalAllocationMatchText_(name);
  return /\bally\b/.test(normalized) && /\bsamer\b/.test(normalized) &&
    /\bsavings?\b/.test(normalized);
}

function readCapitalAllocationDebts_(ss, findings) {
  if (!ss.getSheetByName(getSheetNames_().DEBTS)) {
    findings.push(capitalAllocationFinding_('DEBT_DATA_UNAVAILABLE', 'ERROR', true,
      'INPUT - Debts is missing, so debt candidates cannot be proven.', 'INPUT - Debts'));
    return [];
  }
  return normalizeDebts_(readSheetAsObjects_(ss, 'DEBTS'), getAliasMap_())
    .filter(function(row) { return row.active && Number(row.balance || 0) > 0; })
    .sort(function(a, b) { return String(a.name).localeCompare(String(b.name)); });
}

function readCapitalAllocationIncome_(ss, findings, property) {
  var year = findLatestCashFlowYearWithIncome_(ss);
  if (year == null) {
    findings.push(capitalAllocationFinding_('INCOME_FORECAST_UNAVAILABLE', 'WARNING', false,
      'No active recurring Cash Flow income could be established; this week uses current available cash and counts no forecast income.', 'INPUT - Cash Flow'));
    return { sourceYear: null, monthlyRecurring: 0, normalizedWeeklyPace: 0,
      expectedThisWeek: null, expected90Days: 0,
      nonRentalMonthly: 0, grossRentalMonthly: 0,
      sources: [], provenance: 'INPUT - Cash Flow' };
  }
  var groups = classifyIncomeGroupsInSheet_(getCashFlowSheet_(ss, year)).recurring;
  var sources = groups.map(function(group) {
    return { sourceName: group.displayName, monthlyAmount: capitalAllocationMoney_(group.avgNonZero) };
  }).sort(function(a, b) { return a.sourceName.localeCompare(b.sourceName); });
  var monthly = capitalAllocationMoney_(sources.reduce(function(sum, row) {
    return sum + row.monthlyAmount;
  }, 0));
  var grossRentalMonthly = capitalAllocationMoney_(sources.reduce(function(sum, row) {
    return sum + (capitalAllocationIsRentalIncomeSource_(row.sourceName)
      ? Number(row.monthlyAmount || 0) : 0);
  }, 0));
  if (sources.length) {
    findings.push(capitalAllocationFinding_('INCOME_DATES_NOT_SCHEDULED', 'WARNING', false,
      'Recurring income has a monthly pace but no authoritative receipt dates; this week uses current available cash and counts no forecast income.',
      'INPUT - Cash Flow'));
  }
  var nonRentalMonthly = Math.max(0, capitalAllocationMoney_(monthly - grossRentalMonthly));
  return { sourceYear: year, monthlyRecurring: monthly,
    normalizedWeeklyPace: capitalAllocationMoney_(monthly * 12 / 52),
    expectedThisWeek: null,
    expected90Days: capitalAllocationMoney_(monthly * 3),
    nonRentalMonthly: nonRentalMonthly,
    grossRentalMonthly: grossRentalMonthly,
    sources: sources,
    provenance: 'INPUT - Cash Flow recurring-income averages' };
}

function capitalAllocationIsRentalIncomeSource_(value) {
  return /^rent(?:al)?\b/.test(capitalAllocationMatchText_(value));
}

function readCapitalAllocationObligations_(ss, asOfDate, findings, incomeProducingAccounts) {
  var tz = Session.getScriptTimeZone();
  var activeBillPayees = getInputBillsPayeeMap_(ss);
  var debtRows = getDebtBillsDueRows_(ss, asOfDate, tz, null).filter(function(row) {
    return !activeBillPayees[normalizeBillName_(row.payee || row.name)];
  });
  var billRows = getInputBillsDueRows_(ss, asOfDate, tz, { readOnly: true });
  var investmentContributions = [];
  billRows.forEach(function(row) {
    var investmentMatch = capitalAllocationClassifyInvestmentContribution_(
      row, incomeProducingAccounts || []);
    if (investmentMatch.isInvestmentContribution) {
      var due = capitalAllocationDate_(row.dueDate);
      var contributionDays = due ? daysBetween_(stripTime_(asOfDate), due) : 9999;
      if (contributionDays <= 7 && Number(row.amount || 0) > 0) {
        investmentContributions.push({
          sourceId: row.id || (row.payee + ':' + row.dueDate),
          name: row.payee || row.name,
          amount: capitalAllocationMoney_(row.amount),
          dueDate: row.dueDate,
          matchedInvestmentId: investmentMatch.investmentId,
          matchedAccountName: investmentMatch.accountName,
          classificationBasis: investmentMatch.basis,
          provenance: 'INPUT - Bills'
        });
      }
      return;
    }
    if (String(row.varies || '').toLowerCase() !== 'yes') return;
    var due = capitalAllocationDate_(row.dueDate);
    var days = due ? daysBetween_(stripTime_(asOfDate), due) : 9999;
    if (days > 7) return;
    var amount = capitalAllocationMoney_(row.amount);
    if (amount > 0) {
      var estimateFinding = capitalAllocationFinding_(
        'VARIABLE_BILL_ESTIMATE_USED:' + capitalAllocationKey_(row.id || row.payee),
        'WARNING', false,
        (row.payee || row.name || 'A tracked bill') + ' uses its saved estimate of $' +
          amount.toFixed(2) + ' for this plan.',
        'INPUT - Bills');
      estimateFinding.estimatedAmount = amount;
      findings.push(estimateFinding);
      return;
    }
    if (row.hasSavedDefaultAmount || capitalAllocationIsEpisodicVariableBill_(row)) {
      findings.push(capitalAllocationZeroEstimateFinding_(row));
      return;
    }
    findings.push(capitalAllocationFinding_(
      'VARIABLE_BILL_ESTIMATE_MISSING:' + capitalAllocationKey_(row.id || row.payee),
      'ERROR', true,
      (row.payee || row.name || 'A tracked bill') +
        ' varies and has no saved estimate. Add an estimate before allocation.',
      'INPUT - Bills'));
  });
  var out = debtRows.concat(billRows.filter(function(row) {
    return !capitalAllocationClassifyInvestmentContribution_(
      row, incomeProducingAccounts || []).isInvestmentContribution;
  })).filter(function(row) {
    var due = capitalAllocationDate_(row.dueDate);
    var days = due ? daysBetween_(stripTime_(asOfDate), due) : 9999;
    return days <= 7 && Number(row.amount || 0) > 0;
  }).map(function(row) {
    var debt = row.sourceType === 'debt' || row.matchedToDebt;
    var estimatedVariableBill = !debt && String(row.varies || '').toLowerCase() === 'yes';
    return { sourceType: debt ? 'debt_minimum' : 'tracked_bill',
      sourceId: row.id || (row.payee + ':' + row.dueDate), name: row.payee || row.name,
      actionType: debt ? 'PAY_DEBT_MINIMUM' : 'PAY_TRACKED_BILL',
      amount: capitalAllocationMoney_(row.amount), dueDate: row.dueDate,
      requiredThisWeek: true, amountBasis: debt ? 'MINIMUM_PAYMENT' :
        (estimatedVariableBill ? 'SAVED_ESTIMATED_AMOUNT' : 'DEFAULT_AMOUNT'),
      reason: capitalAllocationDate_(row.dueDate) < stripTime_(asOfDate)
        ? 'Required payment is overdue.' : estimatedVariableBill
          ? 'Variable bill is due within the next seven days; its saved estimate is protected.'
          : 'Required payment is due within the next seven days.',
      provenance: debt ? 'INPUT - Debts / INPUT - Cash Flow' : 'INPUT - Bills / INPUT - Cash Flow / Activity Log' };
  });

  var upcoming = ss.getSheetByName('INPUT - Upcoming Expenses');
  if (upcoming) {
    var values = upcoming.getDataRange().getValues();
    var display = upcoming.getDataRange().getDisplayValues();
    var headers = (display[0] || []).map(function(value) { return String(value || '').trim(); });
    var idCol = headers.indexOf('ID'), statusCol = headers.indexOf('Status');
    var nameCol = headers.indexOf('Expense Name'), dateCol = headers.indexOf('Due Date');
    var amountCol = headers.indexOf('Amount');
    if (dateCol === -1 || amountCol === -1) {
      findings.push(capitalAllocationFinding_('UPCOMING_SCHEMA_INVALID', 'WARNING', true,
        'Upcoming Expenses lacks Due Date or Amount.', 'INPUT - Upcoming Expenses'));
    } else {
      for (var r = 1; r < values.length; r++) {
        var status = statusCol === -1 ? 'Planned' : String(display[r][statusCol] || '').trim();
        if (status !== 'Planned') continue;
        var dueIso = parseSheetDateToIso_(values[r][dateCol]);
        var due = capitalAllocationDate_(dueIso);
        if (!due) continue;
        var days = daysBetween_(stripTime_(asOfDate), due);
        if (days > 7) continue;
        out.push({ sourceType: 'upcoming_expense',
          sourceId: idCol === -1 ? String(r + 1) : String(display[r][idCol] || r + 1),
          name: nameCol === -1 ? 'Upcoming expense' : String(display[r][nameCol] || '').trim(),
          actionType: 'PAY_UPCOMING_EXPENSE', amount: Math.max(0, capitalAllocationMoney_(toNumber_(values[r][amountCol]))),
          dueDate: dueIso, requiredThisWeek: true, amountBasis: 'REMAINING_PLANNED_AMOUNT',
          reason: days < 0 ? 'Planned expense is overdue.' : 'Planned expense is due within the next seven days.',
          provenance: 'INPUT - Upcoming Expenses' });
      }
    }
  }

  return { required: out.sort(function(a, b) {
    return String(a.dueDate + ':' + a.sourceId).localeCompare(String(b.dueDate + ':' + b.sourceId));
  }), investmentContributions: investmentContributions.sort(function(a, b) {
    return String(a.dueDate + ':' + a.name).localeCompare(String(b.dueDate + ':' + b.name));
  }) };
}

function capitalAllocationClassifyInvestmentContribution_(row, incomeProducingAccounts) {
  var payee = String(row && (row.payee || row.name) || '').trim();
  var category = String(row && row.category || '').trim().toLowerCase();
  var normalizedPayee = capitalAllocationMatchText_(payee);
  var accounts = incomeProducingAccounts || [];
  for (var i = 0; i < accounts.length; i++) {
    var normalizedAccount = capitalAllocationMatchText_(accounts[i].accountName);
    if (normalizedPayee && normalizedAccount &&
        (normalizedAccount.indexOf(normalizedPayee) !== -1 ||
         normalizedPayee.indexOf(normalizedAccount) !== -1)) {
      return { isInvestmentContribution: true, basis: 'MATCHED_INVESTMENT_ACCOUNT',
        investmentId: accounts[i].investmentId || '', accountName: accounts[i].accountName || '' };
    }
  }
  if (/invest|brokerage|retirement|401k|ira/.test(category) ||
      /\b(investment|brokerage|401k|ira)\b/.test(normalizedPayee)) {
    return { isInvestmentContribution: true, basis: 'INVESTMENT_CONTRIBUTION_LABEL',
      investmentId: '', accountName: '' };
  }
  return { isInvestmentContribution: false, basis: '', investmentId: '', accountName: '' };
}

function capitalAllocationMatchText_(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function capitalAllocationIsEpisodicVariableBill_(row) {
  var label = capitalAllocationMatchText_(String(row && (row.category || '') || '') + ' ' +
    String(row && (row.payee || row.name || '') || ''));
  return /\b(medical|health|healthcare|doctor|dental|vision)\b/.test(label);
}

function capitalAllocationZeroEstimateFinding_(row) {
  var name = row && (row.payee || row.name) || 'A variable bill';
  var finding = capitalAllocationFinding_(
    'VARIABLE_BILL_ZERO_ESTIMATE_USED:' + capitalAllocationKey_(name),
    'WARNING', false,
    name + ' is treated as $0.00 when no expense is scheduled. Add an Upcoming expense or saved estimate when a cost is expected.',
    'INPUT - Bills / INPUT - Upcoming Expenses');
  finding.estimatedAmount = 0;
  return finding;
}

function readCapitalAllocationForecast90_(ss, asOfDate, findings, context) {
  context = context || {};
  var horizonDays = 90;
  var horizonEnd = new Date(asOfDate.getFullYear(), asOfDate.getMonth(),
    asOfDate.getDate() + horizonDays - 1);
  var currentRequired = context.currentRequired || [];
  var currentHouseholdRequiredAmount = capitalAllocationMoney_(currentRequired.reduce(function(sum, row) {
    return sum + Number(row.amount || 0);
  }, 0));
  var currentInvestmentCommitmentAmount = capitalAllocationMoney_(
    (context.incomeProducingAccounts || []).reduce(function(sum, account) {
      return sum + (account.eligible ? capitalAllocationMinimumWeeklyCommitment_(account) : 0);
    }, 0));
  var currentRequiredAmount = capitalAllocationMoney_(
    currentHouseholdRequiredAmount + currentInvestmentCommitmentAmount);
  var futureBills = readCapitalAllocationFutureBills_(ss, asOfDate, horizonEnd,
    findings, context.incomeProducingAccounts || []);
  var activeBillPayees = capitalAllocationActiveBillPayeeMap_(ss);
  var futureDebtMinimums = readCapitalAllocationFutureDebtMinimums_(
    context.debts || [], asOfDate, horizonEnd, activeBillPayees);
  var futureUpcoming = readCapitalAllocationFutureUpcoming_(ss, asOfDate, horizonEnd);
  var futureInvestmentCommitments = readCapitalAllocationFutureInvestmentCommitments_(
    context.incomeProducingAccounts || [], asOfDate, horizonEnd);
  var propertyContingency = readCapitalAllocationPropertyContingency_(
    ss, asOfDate, context.property || {}, futureUpcoming.rows);
  var futureOperatingOutflows = capitalAllocationMoney_(
    futureBills.total + futureDebtMinimums.total + futureUpcoming.total +
    propertyContingency.additionalReserveAmount);
  var totalOutflows = capitalAllocationMoney_(currentRequiredAmount +
    futureOperatingOutflows + futureInvestmentCommitments.total);
  var expectedIncome = capitalAllocationMoney_(context.income &&
    context.income.expected90Days || 0);
  var reserveCalculation = capitalAllocationReserve90_(futureOperatingOutflows, expectedIncome);
  return {
    horizonDays: horizonDays,
    startDate: capitalAllocationIso_(asOfDate),
    endDate: capitalAllocationIso_(horizonEnd),
    currentRequiredAmount: currentRequiredAmount,
    currentHouseholdRequiredAmount: currentHouseholdRequiredAmount,
    currentInvestmentCommitmentAmount: currentInvestmentCommitmentAmount,
    futureBillsAmount: futureBills.total,
    futureDebtMinimumsAmount: futureDebtMinimums.total,
    futureUpcomingAmount: futureUpcoming.total,
    futureInvestmentCommitmentsAmount: futureInvestmentCommitments.total,
    propertyContingencyAmount: propertyContingency.additionalReserveAmount,
    propertyContingencyMinimumFloorAmount: propertyContingency.minimumFloorAmount,
    propertyHistoricalAllowanceAmount: propertyContingency.historicalAllowanceAmount,
    propertyUpcomingOffsetAmount: propertyContingency.upcomingOffsetAmount,
    propertyContingencyRows: propertyContingency.rows,
    propertyScheduledTypesExcluded: propertyContingency.scheduledTypesExcluded,
    futureOperatingOutflowsAmount: futureOperatingOutflows,
    totalOutflows: totalOutflows,
    expectedIncome: expectedIncome,
    expectedNonRentalIncome: capitalAllocationMoney_(Number(context.income &&
      context.income.nonRentalMonthly || 0) * 3),
    expectedRentalIncome: capitalAllocationMoney_(Math.max(0, Number(context.income &&
      context.income.grossRentalMonthly || 0)) * 3),
    incomeOffsetAmount: reserveCalculation.incomeOffsetAmount,
    minimumOperatingFloorAmount: reserveCalculation.minimumOperatingFloorAmount,
    requiredReserveAmount: reserveCalculation.requiredReserveAmount,
    normalPolicyInvestmentCommitmentsAmount: futureInvestmentCommitments.total,
    confidence: 'ESTIMATED_FROM_RECORDED_AVERAGES',
    futureBills: futureBills.rows,
    futureDebtMinimums: futureDebtMinimums.rows,
    futureUpcoming: futureUpcoming.rows,
    futureInvestmentCommitments: futureInvestmentCommitments.rows,
    provenance: 'INPUT - Bills / INPUT - Debts / INPUT - Upcoming Expenses / INPUT - Cash Flow / SYS - Assets / HOUSES - *'
  };
}

function readCapitalAllocationFutureInvestmentCommitments_(accounts, asOfDate, horizonEnd) {
  var rows = [];
  (accounts || []).forEach(function(account) {
    if (!account.eligible) return;
    var amount = capitalAllocationMinimumWeeklyCommitment_(account);
    if (!(amount > 0)) return;
    for (var days = 7; days < 90; days += 7) {
      var due = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate() + days);
      if (due.getTime() > horizonEnd.getTime()) break;
      rows.push({ investmentId: account.investmentId || '', name: account.accountName,
        dueDate: capitalAllocationIso_(due), amount: amount,
        amountBasis: 'STANDING_WEEKLY_MINIMUM' });
    }
  });
  return { total: capitalAllocationMoney_(rows.reduce(function(sum, row) {
    return sum + Number(row.amount || 0);
  }, 0)), rows: rows };
}

function capitalAllocationActiveBillPayeeMap_(ss) {
  var out = getInputBillsPayeeMap_(ss);
  var sheet = ss.getSheetByName(getSheetNames_().BILLS);
  if (!sheet) return out;
  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return out;
  var headers = display[0] || [];
  var payeeCol = headers.indexOf('Payee');
  var activeCol = headers.indexOf('Active');
  if (payeeCol === -1) return out;
  var aliasMap = getAliasMap_();
  for (var r = 1; r < display.length; r++) {
    var payee = String(display[r][payeeCol] || '').trim();
    if (!payee) continue;
    if (activeCol !== -1 && normalizeYesNo_(display[r][activeCol]) !== 'yes') continue;
    out[normalizeBillName_(payee)] = true;
    out[normalizeBillName_(normalizeName_(payee, aliasMap))] = true;
  }
  return out;
}

function readCapitalAllocationPropertyContingency_(ss, asOfDate, property, futureUpcomingRows) {
  var allRows = getAllHouseExpenseRowsForSpreadsheet_(ss);
  var activeHouseNames = (property && property.rows || []).map(function(row) {
    return row.house;
  });
  return capitalAllocationBuildPropertyContingency_(
    allRows, asOfDate, activeHouseNames, futureUpcomingRows || []);
}

function capitalAllocationBuildPropertyContingency_(rows, asOfDate, activeHouseNames, futureUpcomingRows) {
  var active = {};
  (activeHouseNames || []).forEach(function(name) {
    active[capitalAllocationMatchText_(name)] = true;
  });
  var start = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate() - 365);
  var byHouse = {};
  (rows || []).forEach(function(row) {
    var house = String(row.house || '').trim();
    var houseKey = capitalAllocationMatchText_(house);
    if (!houseKey || !active[houseKey]) return;
    if (!row.sortDate || isNaN(row.sortDate.getTime())) return;
    if (!String(row.dateDisplay || '').trim() ||
        String(row.dateDisplay || '').trim().toLowerCase() === 'tbd') return;
    if (row.sortDate.getTime() < start.getTime() || row.sortDate.getTime() > asOfDate.getTime()) return;
    if (!capitalAllocationIsUnscheduledPropertyExpenseType_(row.type)) return;
    var amount = Math.max(0, capitalAllocationMoney_(
      Number(row.cost || 0) + Number(row.serviceFees || 0)));
    if (!(amount > 0)) return;
    if (!byHouse[houseKey]) byHouse[houseKey] = { house: house, trailing12MonthActual: 0 };
    byHouse[houseKey].trailing12MonthActual = capitalAllocationMoney_(
      byHouse[houseKey].trailing12MonthActual + amount);
  });
  var outputRows = Object.keys(byHouse).map(function(key) {
    var row = byHouse[key];
    row.historical90DayAllowance = capitalAllocationMoney_(row.trailing12MonthActual * 90 / 365);
    return row;
  }).sort(function(a, b) { return a.house.localeCompare(b.house); });
  var historicalAllowance = capitalAllocationMoney_(outputRows.reduce(function(sum, row) {
    return sum + row.historical90DayAllowance;
  }, 0));
  var irregularUpcoming = capitalAllocationMoney_((futureUpcomingRows || []).reduce(function(sum, row) {
    return sum + (capitalAllocationIsUnscheduledPropertyExpenseType_(row.category)
      ? Number(row.amount || 0) : 0);
  }, 0));
  var upcomingOffset = Math.min(historicalAllowance, irregularUpcoming);
  var minimumFloor = capitalAllocationMoney_(historicalAllowance * 0.25);
  return {
    historicalAllowanceAmount: historicalAllowance,
    upcomingOffsetAmount: capitalAllocationMoney_(upcomingOffset),
    minimumFloorAmount: minimumFloor,
    additionalReserveAmount: Math.max(minimumFloor,
      capitalAllocationMoney_(historicalAllowance - upcomingOffset)),
    rows: outputRows,
    scheduledTypesExcluded: ['HOA', 'Insurance', 'Utilities', 'Mgmt', 'Cleaning', 'Warranty', 'Tax'],
    provenance: 'HOUSES - * trailing 12-month Repair / Maintenance / Appliance / Other history, net of planned Upcoming items'
  };
}

function capitalAllocationIsUnscheduledPropertyExpenseType_(value) {
  var type = capitalAllocationMatchText_(value);
  return /^(repair|maintenance|appliance|other)$/.test(type);
}

function capitalAllocationReserve90_(futureOutflows, expectedIncome) {
  var outflows = Math.max(0, capitalAllocationMoney_(futureOutflows));
  var income = Math.max(0, capitalAllocationMoney_(expectedIncome));
  var minimumOperatingFloor = capitalAllocationMoney_(outflows / 3);
  var incomeOffset = Math.min(income,
    Math.max(0, capitalAllocationMoney_(outflows - minimumOperatingFloor)));
  return {
    incomeOffsetAmount: capitalAllocationMoney_(incomeOffset),
    minimumOperatingFloorAmount: minimumOperatingFloor,
    requiredReserveAmount: Math.max(minimumOperatingFloor,
      capitalAllocationMoney_(outflows - incomeOffset))
  };
}

function readCapitalAllocationFutureBills_(ss, asOfDate, horizonEnd, findings, incomeProducingAccounts) {
  var sheet = ss.getSheetByName(getSheetNames_().BILLS);
  if (!sheet) return { total: 0, rows: [] };
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return { total: 0, rows: [] };
  var headers = (display[0] || []).map(function(value) { return String(value || '').trim().toLowerCase(); });
  function col(name) { return headers.indexOf(String(name).toLowerCase()); }
  var payeeCol = col('Payee'), amountCol = col('Default Amount'), dueCol = col('Due Day');
  var activeCol = col('Active'), frequencyCol = col('Frequency'), startCol = col('Start Month');
  var weekdayCol = col('Weekday'), anchorCol = col('Anchor Date');
  var effectiveCol = col('Schedule Effective Date'), categoryCol = col('Category'), variesCol = col('Varies');
  if (payeeCol === -1 || amountCol === -1 || dueCol === -1 || activeCol === -1) {
    findings.push(capitalAllocationFinding_('FORECAST_BILLS_SCHEMA_INVALID', 'ERROR', true,
      'Bills cannot be included in the 90-day reserve because required headers are missing.', 'INPUT - Bills'));
    return { total: 0, rows: [] };
  }
  var workbookTz = ss.getSpreadsheetTimeZone ? ss.getSpreadsheetTimeZone() : Session.getScriptTimeZone();
  var rows = [];
  var missingEstimateFindings = {};
  for (var r = 1; r < display.length; r++) {
    var payee = String(display[r][payeeCol] || '').trim();
    if (!payee || normalizeYesNo_(display[r][activeCol]) !== 'yes') continue;
    var billMeta = { payee: payee,
      category: categoryCol === -1 ? '' : String(display[r][categoryCol] || '').trim() };
    if (capitalAllocationClassifyInvestmentContribution_(
      billMeta, incomeProducingAccounts).isInvestmentContribution) continue;
    var rawAmount = values[r][amountCol];
    var amount = Math.max(0, capitalAllocationMoney_(toNumber_(rawAmount)));
    var hasSavedAmount = rawAmount !== '' && rawAmount != null &&
      String(display[r][amountCol] == null ? '' : display[r][amountCol]).trim() !== '';
    var varies = variesCol === -1 ? 'no' : normalizeYesNo_(display[r][variesCol]);
    var dueDay = Number(values[r][dueCol]) || 0;
    if (!dueDay) continue;
    var anchorDate = anchorCol === -1 ? null : parseDateOnlySheetCell_(
      values[r][anchorCol], display[r][anchorCol], workbookTz);
    var effectiveDate = effectiveCol === -1 ? null : parseDateOnlySheetCell_(
      values[r][effectiveCol], display[r][effectiveCol], workbookTz);
    var occurrences = buildInputBillDueCandidates_(asOfDate, dueDay,
      frequencyCol === -1 ? '' : display[r][frequencyCol],
      startCol === -1 ? 1 : values[r][startCol],
      weekdayCol === -1 ? '' : display[r][weekdayCol], effectiveDate, anchorDate, horizonEnd);
    occurrences.forEach(function(occurrence) {
      var days = daysBetween_(stripTime_(asOfDate), stripTime_(occurrence.dueDate));
      if (days <= 7 || days >= 90) return;
      if (!(amount > 0)) {
        if (varies === 'yes') {
          var findingId = 'VARIABLE_BILL_FORECAST_ESTIMATE_MISSING:' + capitalAllocationKey_(payee);
          if (hasSavedAmount || capitalAllocationIsEpisodicVariableBill_(billMeta)) {
            var zeroFindingId = 'VARIABLE_BILL_ZERO_ESTIMATE_USED:' + capitalAllocationKey_(payee);
            if (!missingEstimateFindings[zeroFindingId]) {
              if (!findings.some(function(existing) {
                return existing.findingId === zeroFindingId;
              })) findings.push(capitalAllocationZeroEstimateFinding_(billMeta));
              missingEstimateFindings[zeroFindingId] = true;
            }
          } else if (!missingEstimateFindings[findingId]) {
            findings.push(capitalAllocationFinding_(findingId,
              'ERROR', true, payee + ' has no saved estimate for the 90-day reserve.', 'INPUT - Bills'));
            missingEstimateFindings[findingId] = true;
          }
        }
        return;
      }
      rows.push({ name: payee, dueDate: capitalAllocationIso_(occurrence.dueDate),
        amount: amount, estimated: varies === 'yes' });
    });
  }
  rows.sort(function(a, b) { return String(a.dueDate + ':' + a.name).localeCompare(String(b.dueDate + ':' + b.name)); });
  return { total: capitalAllocationMoney_(rows.reduce(function(sum, row) {
    return sum + row.amount;
  }, 0)), rows: rows };
}

function readCapitalAllocationFutureDebtMinimums_(debts, asOfDate, horizonEnd, activeBillPayees) {
  var rows = [];
  (debts || []).forEach(function(debt) {
    if (!debt.active || !(Number(debt.balance || 0) > 0) || !(Number(debt.minimumPayment || 0) > 0)) return;
    if (activeBillPayees && (activeBillPayees[normalizeBillName_(debt.name)] ||
        activeBillPayees[normalizeBillName_(debt.originalName)])) return;
    for (var offset = 0; offset <= 3; offset++) {
      var monthDate = new Date(asOfDate.getFullYear(), asOfDate.getMonth() + offset, 1);
      var lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      var due = new Date(monthDate.getFullYear(), monthDate.getMonth(),
        Math.min(Math.max(1, Number(debt.dueDay || 1)), lastDay));
      var days = daysBetween_(stripTime_(asOfDate), due);
      if (days <= 7 || due.getTime() > horizonEnd.getTime()) continue;
      rows.push({ name: debt.name, dueDate: capitalAllocationIso_(due),
        amount: capitalAllocationMoney_(debt.minimumPayment) });
    }
  });
  return { total: capitalAllocationMoney_(rows.reduce(function(sum, row) {
    return sum + row.amount;
  }, 0)), rows: rows };
}

function readCapitalAllocationFutureUpcoming_(ss, asOfDate, horizonEnd) {
  var sheet = ss.getSheetByName('INPUT - Upcoming Expenses');
  if (!sheet) return { total: 0, rows: [] };
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return { total: 0, rows: [] };
  var headers = (display[0] || []).map(function(value) { return String(value || '').trim(); });
  var nameCol = headers.indexOf('Expense Name'), dateCol = headers.indexOf('Due Date');
  var categoryCol = headers.indexOf('Category'), payeeCol = headers.indexOf('Payee');
  var amountCol = headers.indexOf('Amount'), statusCol = headers.indexOf('Status');
  var rows = [];
  if (dateCol === -1 || amountCol === -1) return { total: 0, rows: [] };
  for (var r = 1; r < values.length; r++) {
    var status = statusCol === -1 ? 'Planned' : String(display[r][statusCol] || '').trim();
    if (status !== 'Planned') continue;
    var dueIso = parseSheetDateToIso_(values[r][dateCol]);
    var due = capitalAllocationDate_(dueIso);
    if (!due) continue;
    var days = daysBetween_(stripTime_(asOfDate), due);
    if (days <= 7 || due.getTime() > horizonEnd.getTime()) continue;
    var amount = Math.max(0, capitalAllocationMoney_(toNumber_(values[r][amountCol])));
    if (!(amount > 0)) continue;
    rows.push({ name: nameCol === -1 ? 'Upcoming expense' : String(display[r][nameCol] || '').trim(),
      category: categoryCol === -1 ? '' : String(display[r][categoryCol] || '').trim(),
      payee: payeeCol === -1 ? '' : String(display[r][payeeCol] || '').trim(),
      dueDate: dueIso, amount: amount });
  }
  return { total: capitalAllocationMoney_(rows.reduce(function(sum, row) {
    return sum + row.amount;
  }, 0)), rows: rows };
}

function readCapitalAllocationProperty_(ss, asOfDate, findings) {
  var year = asOfDate.getFullYear();
  var names = getActiveHouseNamesForSpreadsheet_(ss);
  return { sourceYear: year, includedInDeployableCash: false,
    rows: names.map(function(name) { return { house: name }; }),
    provenance: 'SYS - House Assets / HOUSES - *' };
}

function readCapitalAllocationAssetFoundation_(ss) {
  var sheet = ss.getSheetByName(getSheetNames_().ASSETS);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  if (display.length < 2) return [];
  var map = getAssetsHeaderMap_(sheet, display);
  var headers = display[0] || [];
  var roleCol = headers.indexOf('Planning Role');
  var minimumCol = headers.indexOf('Minimum Weekly Contribution');
  var rows = [];
  for (var r = 1; r < display.length; r++) {
    var name = String(display[r][map.nameColZero] || '').trim();
    if (!name) continue;
    rows.push({
      sysAssetsRow: r + 1,
      accountName: name,
      type: map.typeColZero === -1 ? '' : String(display[r][map.typeColZero] || '').trim(),
      currentBalance: capitalAllocationMoney_(toNumber_(values[r][map.balanceColZero])),
      active: !isAssetRowInactive_(display[r], map),
      investmentId: map.investmentIdColZero === -1 ? '' :
        String(display[r][map.investmentIdColZero] || '').trim(),
      planningPurpose: map.planningPurposeColZero === -1 ? '' :
        String(display[r][map.planningPurposeColZero] || '').trim().toUpperCase(),
      planningRole: roleCol === -1 ? '' : String(display[r][roleCol] || '').trim().toUpperCase(),
      minimumWeeklyContribution: minimumCol === -1 ? 0 :
        Math.max(0, capitalAllocationMoney_(toNumber_(values[r][minimumCol])))
    });
  }
  return rows;
}

function readCapitalAllocationBrokerageFoundation_(assetRows) {
  var idCounts = {};
  (assetRows || []).forEach(function(row) {
    if (row.investmentId) idCounts[row.investmentId] = Number(idCounts[row.investmentId] || 0) + 1;
  });
  return (assetRows || []).filter(function(row) {
    return row.active && Number(row.currentBalance || 0) > 0;
  }).map(function(row) {
    var type = capitalAllocationMatchText_(row.type);
    var identityText = type + ' ' + capitalAllocationMatchText_(row.accountName);
    var hardExcluded = row.planningRole === 'CHILD_CUSTODIAL' ||
      /\b(529|custodial|retirement|401k|ira|pension)\b/.test(identityText);
    var strategicDestination = row.planningPurpose === 'INCOME_PRODUCING' &&
      capitalAllocationMinimumWeeklyCommitment_(row) > 0;
    var transferable = /\b(invest|brokerage|stock|securities)\b/.test(type) &&
      !hardExcluded && !strategicDestination;
    var identityStatus = row.investmentId
      ? idCounts[row.investmentId] === 1 ? 'STABLE_ID_VERIFIED' : 'DUPLICATE_IDENTITY_BLOCKED'
      : 'STABLE_ID_REQUIRED';
    var identityMessage = identityStatus === 'STABLE_ID_VERIFIED'
      ? 'Separate SYS - Assets identity verified by ' + row.investmentId + '.'
      : identityStatus === 'DUPLICATE_IDENTITY_BLOCKED'
        ? 'Duplicate Investment Id detected; this account cannot become actionable.'
        : 'This separate SYS - Assets row still needs a stable Investment Id before any transfer or sale can become actionable.';
    return {
      investmentId: row.investmentId || '', accountName: row.accountName,
      currentBalance: capitalAllocationMoney_(row.currentBalance), type: row.type,
      planningRole: row.planningRole || '', sysAssetsRow: row.sysAssetsRow,
      assetClass: hardExcluded ? 'RETIREMENT_OR_RESTRICTED'
        : strategicDestination ? 'STRATEGIC_DESTINATION' : 'TAXABLE_OR_UNCONFIRMED_BROKERAGE',
      actionableSource: transferable,
      exclusionReason: hardExcluded
        ? 'Retirement and custodial assets are excluded from the actionable Capital Source Ladder.'
        : strategicDestination ? 'This account is the strategic destination, not a funding source.'
        : 'This asset type is not an actionable brokerage source.',
      identityStatus: identityStatus, identityMessage: identityMessage,
      inKindTransferStatus: transferable
        ? identityStatus === 'STABLE_ID_VERIFIED' ? 'REVIEW_COMPATIBILITY' : identityStatus
        : 'NOT_ELIGIBLE',
      salePlanningStatus: transferable ? 'TAX_DATA_REQUIRED'
        : 'NOT_ELIGIBLE'
    };
  }).sort(function(a, b) { return a.accountName.localeCompare(b.accountName); });
}

function readCapitalAllocationInvestments_(ss, assetFoundation) {
  var config = getIncomeProducingAccountConfigurations_(ss);
  return (config.accounts || []).map(function(account) {
    var asset = (assetFoundation || []).filter(function(row) {
      return (account.investmentId && row.investmentId === account.investmentId) ||
        (!account.investmentId && row.accountName === account.accountName);
    })[0] || {};
    var plans = account.investmentId ? readInvestmentPlanRows_(ss, account.investmentId) : [];
    var activePlans = plans.filter(function(row) {
      return row.planActive && row.portfolioStatus === 'INCLUDED' && Number(row.plannedAmount || 0) > 0;
    }).map(function(row) {
      var weekly = row.planFrequency === 'WEEKLY' ? row.plannedAmount
        : row.planFrequency === 'BIWEEKLY' ? row.plannedAmount / 2
        : row.planFrequency === 'MONTHLY' ? row.plannedAmount * 12 / 52 : 0;
      return { ticker: row.ticker, planFrequency: row.planFrequency,
        plannedAmount: capitalAllocationMoney_(row.plannedAmount),
        normalizedWeeklyPace: capitalAllocationMoney_(weekly) };
    }).sort(function(a, b) { return a.ticker.localeCompare(b.ticker); });
    return { investmentId: account.investmentId, accountName: account.accountName,
      active: account.active, eligible: account.eligible,
      currentBalance: capitalAllocationMoney_(asset.currentBalance || 0),
      planningPurpose: asset.planningPurpose || '', planningRole: asset.planningRole || '',
      minimumWeeklyContribution: Number(asset.minimumWeeklyContribution || 0),
      requestedWeeklyPace: capitalAllocationMoney_(activePlans.reduce(function(sum, row) {
        return sum + row.normalizedWeeklyPace;
      }, 0)), activePlans: activePlans,
      provenance: 'SYS - Assets / SYS - Investment Plans' };
  }).sort(function(a, b) { return String(a.investmentId).localeCompare(String(b.investmentId)); });
}

function capitalAllocationAction_(id, actionClass, actionType, targetName, amount, amountBasis, reason, provenance) {
  return { candidateId: id, actionClass: actionClass, actionType: actionType,
    targetName: targetName || '', requestedAmount: amount == null ? null : capitalAllocationMoney_(amount),
    amountBasis: amountBasis || '', status: actionClass === 'DISCRETIONARY' ? 'UNRANKED' : 'REQUIRED',
    rank: null, allocatedAmount: null, reason: reason || '', provenance: provenance || '' };
}

function capitalAllocationFinding_(id, severity, blocks, message, provenance) {
  return { findingId: id, severity: severity, blocksAllocation: !!blocks,
    message: String(message || ''), provenance: provenance || '' };
}

function capitalAllocationActionSort_(a, b) { return String(a.candidateId).localeCompare(String(b.candidateId)); }
function capitalAllocationKey_(value) { return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
function capitalAllocationMoney_(value) { return Math.round((Number(value) || 0) * 100) / 100; }
function capitalAllocationIso_(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function capitalAllocationDate_(value) {
  var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(date.getTime()) ? null : date;
}
function capitalAllocationAsOfDate_(value) {
  return capitalAllocationDate_(value) || stripTime_(new Date());
}
