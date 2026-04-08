function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Debt Planner')
    .addItem('Open House Values UI', 'showHouseValuesSidebar')
    .addItem('Open House Expenses UI', 'showHouseExpensesSidebar')
    .addItem('Open Bank Accounts UI', 'showBankAccountsSidebar')
    .addItem('Open Investments UI', 'showInvestmentsSidebar')
    .addItem('Open Debts UI', 'showDebtsSidebar')
    .addItem('Open Quick add to Cash Flow (sidebar)', 'showQuickAddPaymentSidebar')
    .addItem('Run Planner', 'runDebtPlanner')
    .addSeparator()
    .addItem('Create Next Year Cash Flow Sheet', 'createNextYearCashFlowSheet')
    .addItem('Rebuild HOME', 'buildHomePage')
    .addSeparator()
    .addItem('Open Planner Dashboard', 'openPlannerDashboard')
    .addSeparator()
    .addItem('Open Planner Dashboard Web', 'openPlannerDashboardWebLauncher')
    .addItem('Set Planner Dashboard Web App URL', 'setPlannerDashboardWebAppUrl')
    .addToUi();
}

function showHouseValuesSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('HouseValuesUI')
    .setTitle('House Values');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showHouseExpensesSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('HouseExpensesUI')
    .setTitle('House Expenses');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showBankAccountsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('BankAccountsUI')
    .setTitle('Bank Accounts');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showInvestmentsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('InvestmentsUI')
    .setTitle('Investments');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showDebtsSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('DebtsUI')
    .setTitle('Debts');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showQuickAddPaymentSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('QuickAddPaymentUI')
    .setTitle('Quick add to Cash Flow');
  SpreadsheetApp.getUi().showSidebar(html);
}

function runDebtPlanner() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = new Date();
  const tz = Session.getScriptTimeZone();

  syncAllHouseAssetsFromLatestCurrentYear_();
  syncAllAccountsFromLatestCurrentYear_();
  syncAllAssetsFromLatestCurrentYear_();

  const currentYear = today.getFullYear();

  const cashFlowRows = readCashFlowSheetAsObjects_(ss, currentYear);
  const debtRows = readSheetAsObjects_(ss, 'DEBTS');
  const accountRows = readSheetAsObjects_(ss, 'ACCOUNTS');
  const assetRows = readSheetAsObjects_(ss, 'ASSETS');
  const houseAssetRows = readSheetAsObjects_(ss, 'HOUSE_ASSETS');

  const payNowWindowDays = 7;
  const paySoonWindowDays = 30;
  const mode = 'BALANCED';
  
  const monthHeader = getCurrentMonthHeader_(today, tz);
  const previousMonthHeader = getPreviousMonthHeader_(today, tz);
  const aliasMap = getAliasMap_();

  const debts = normalizeDebts_(debtRows, aliasMap);
  const accounts = normalizeAccounts_(accountRows);
  const assets = normalizeAssets_(assetRows);
  const houseAssets = normalizeHouseAssets_(houseAssetRows);
  const cashFlow = normalizeCashFlow_(cashFlowRows, monthHeader, aliasMap);
  const previousCashFlow = normalizeCashFlow_(cashFlowRows, previousMonthHeader, aliasMap);

  const usableCash = calculateUsableCash_(accounts);
  const assetSummary = calculateAssetSummary_(assets);
  const houseAssetSummary = calculateHouseAssetSummary_(houseAssets);
  const liabilitySummary = calculateLiabilitySummary_(debts);

  const totalCashBalance = round2_(accounts.reduce(function(sum, a) { return sum + a.currentBalance; }, 0));
  const totalAssets = round2_(totalCashBalance + assetSummary.totalAssets + houseAssetSummary.totalRealEstateValue);
  const netWorth = round2_(totalAssets - liabilitySummary.totalLiabilities);

  const minimumDueTotal = round2_(
    debts.filter(function(d) { return d.active; })
      .reduce(function(sum, d) { return sum + d.minimumPayment; }, 0)
  );

  const thisMonthCashFlow = round2_(cashFlow.monthNet);
  const debtMinimumHandledMap = buildDebtMinimumHandledMap_(cashFlowRows, monthHeader, aliasMap);
  const nextPayments = buildUpcomingPayments_(
    debts,
    today,
    tz,
    payNowWindowDays,
    paySoonWindowDays,
    debtMinimumHandledMap
  );

  const overdueBillsForEmail = getBillsDueFromCashFlowForDashboard().overdue || [];

  const warnings = [];
  const notes = [];

  if (thisMonthCashFlow < 0) {
    warnings.push('Projected cash flow for ' + monthHeader + ' is negative: ' + fmtCurrency_(thisMonthCashFlow) + '.');
  }

  if (usableCash.usableAfterBuffers < minimumDueTotal) {
    warnings.push(
      'Usable cash after protected buffers (' +
      fmtCurrency_(usableCash.usableAfterBuffers) +
      ') is below total minimum payments (' +
      fmtCurrency_(minimumDueTotal) +
      ').'
    );
  }

  const creditCards = debts.filter(function(d) { return d.type === 'Credit Card'; });
  const otherObligations = debts.filter(function(d) {
    return d.active &&
      d.type !== 'Credit Card' &&
      d.type !== 'Loan' &&
      d.type !== 'HELOC' &&
      d.type !== 'Taxes';
  });

  const overLimitCards = creditCards.filter(function(d) {
    return d.creditLimit > 0 && d.balance > d.creditLimit;
  });
  overLimitCards.forEach(function(card) {
    warnings.push(card.name + ' is over its credit limit.');
  });

  const highUtilCards = creditCards.filter(function(d) {
    return d.creditLimit > 0 && d.balance > 0 && (d.balance / d.creditLimit) >= 0.9;
  });
  highUtilCards.forEach(function(card) {
    warnings.push(card.name + ' is above 90% utilization.');
  });

  const heloc = debts.find(function(d) {
    return d.type === 'HELOC' && d.balance > 0;
  });
  if (heloc) {
    notes.push(
      'HELOC detected: ' +
      heloc.name +
      ' at ' +
      fmtPercent_(heloc.interestRate) +
      ' with balance ' +
      fmtCurrency_(heloc.balance) +
      '.'
    );
  }

  const activeHighInterestCards = creditCards
    .filter(function(d) { return d.active && d.balance > 0; })
    .sort(function(a, b) {
      if (b.interestRate !== a.interestRate) return b.interestRate - a.interestRate;
      return b.balance - a.balance;
    });

  let recommendation = null;
  let extraPaymentCapacity = 0;

  const baselineReserve = getReserveByMode_(mode);
  const availableForPlanning = Math.max(0, usableCash.usableAfterBuffers - baselineReserve);

  if (mode === 'AGGRESSIVE') {
    extraPaymentCapacity = Math.max(0, availableForPlanning - minimumDueTotal);
  } else if (mode === 'BALANCED') {
    const rawBalancedCapacity = Math.max(
      0,
      availableForPlanning - minimumDueTotal - Math.max(0, -thisMonthCashFlow)
    );
    const balancedCap = Math.min(round2_(usableCash.usableAfterBuffers * 0.25), 20000);
    extraPaymentCapacity = Math.min(rawBalancedCapacity, balancedCap);
  } else {
    extraPaymentCapacity = 0;
  }

  const shouldSuppressExtraPayment =
    mode === 'BALANCED' &&
    (
      usableCash.usableAfterBuffers < (minimumDueTotal * 2) ||
      thisMonthCashFlow <= -15000 ||
      overLimitCards.length >= 2
    );

  if (shouldSuppressExtraPayment) {
    extraPaymentCapacity = 0;
    notes.push('Extra payment recommendation suppressed because liquidity/risk guardrails were triggered for this month.');
  }

  extraPaymentCapacity = round2_(extraPaymentCapacity);

  let nextTargetAfterThis = null;
  if (activeHighInterestCards.length > 1) {
    const nextTarget = activeHighInterestCards[1];
    nextTargetAfterThis = {
      account: nextTarget.name,
      apr: round2_(nextTarget.interestRate),
      balance: round2_(nextTarget.balance)
    };
  }

  const totalActiveCreditCardDebt = round2_(
    activeHighInterestCards.reduce(function(sum, d) { return sum + d.balance; }, 0)
  );

  if (activeHighInterestCards.length > 0) {
    const target = activeHighInterestCards[0];
    const suggestedExtraPayment = round2_(Math.min(extraPaymentCapacity, target.balance));
    const annualInterestSavingsEstimate = estimateAnnualInterestSavings_(
      suggestedExtraPayment,
      target.interestRate
    );

    const targetMonthlyPaydown = round2_(target.minimumPayment + suggestedExtraPayment);
    const estimatedMonthsToPayOffTarget = estimateMonthsToPayoff_(
      target.balance,
      targetMonthlyPaydown
    );

    const totalCardMinimums = round2_(
      activeHighInterestCards.reduce(function(sum, d) { return sum + d.minimumPayment; }, 0)
    );
    const totalMonthlyCardPaydown = round2_(totalCardMinimums + suggestedExtraPayment);
    const estimatedMonthsToPayOffAllCards = estimateMonthsToPayoff_(
      totalActiveCreditCardDebt,
      totalMonthlyCardPaydown
    );

    recommendation = {
      strategy: mode,
      targetAccount: target.name,
      targetType: target.type,
      targetAPR: round2_(target.interestRate),
      targetBalance: round2_(target.balance),
      suggestedExtraPayment: suggestedExtraPayment,
      annualInterestSavingsEstimate: annualInterestSavingsEstimate,
      nextTargetAfterThis: nextTargetAfterThis,
      estimatedMonthsToPayOffTarget: estimatedMonthsToPayOffTarget,
      estimatedMonthsToPayOffAllCards: estimatedMonthsToPayOffAllCards,
      totalActiveCreditCardDebt: totalActiveCreditCardDebt,
      reason: buildReason_(
        target,
        mode,
        thisMonthCashFlow,
        usableCash.usableAfterBuffers,
        minimumDueTotal,
        extraPaymentCapacity,
        shouldSuppressExtraPayment
      )
    };
  }

  if (!recommendation) notes.push('No eligible extra-payment target found.');
  if (mode !== 'AGGRESSIVE' && thisMonthCashFlow < 0) {
    notes.push('Because monthly cash flow is negative, the planner is prioritizing liquidity over aggressive payoff.');
  }

  const payNowMinimumTotal = round2_(nextPayments.payNow.reduce(function(sum, p) { return sum + p.minimumPayment; }, 0));
  const paySoonMinimumTotal = round2_(nextPayments.paySoon.reduce(function(sum, p) { return sum + p.minimumPayment; }, 0));
  const suggestedExtraPaymentFinal = recommendation ? round2_(recommendation.suggestedExtraPayment) : 0;
  const recommendedTotalToPayNow = round2_(payNowMinimumTotal + suggestedExtraPaymentFinal);

  const stability = getMonthlyStabilityScore_(
    thisMonthCashFlow,
    usableCash.usableAfterBuffers,
    minimumDueTotal,
    overLimitCards.length,
    highUtilCards.length
  );

  const monthChange = round2_(cashFlow.monthNet - previousCashFlow.monthNet);
  const cashFlowBreakdown = buildCashFlowChangeBreakdown_(cashFlow, previousCashFlow);
  const unusualItems = buildUnusualItems_(cashFlowBreakdown);

  const liquiditySummary = buildLiquiditySummary_(
    usableCash.usableAfterBuffers,
    totalActiveCreditCardDebt,
    minimumDueTotal,
    payNowMinimumTotal,
    paySoonMinimumTotal
  );

  const actionPlan = buildActionPlan_({
    payNow: nextPayments.payNow,
    paySoon: nextPayments.paySoon,
    overdueBills: overdueBillsForEmail,
    recommendation: recommendation,
    payNowMinimumTotal: payNowMinimumTotal,
    paySoonMinimumTotal: paySoonMinimumTotal,
    recommendedTotalToPayNow: recommendedTotalToPayNow,
    today: today
  });

  const executiveSummary = buildExecutiveSummary_({
    monthHeader: monthHeader,
    thisMonthCashFlow: thisMonthCashFlow,
    recommendation: recommendation,
    stability: stability,
    totalAssets: totalAssets,
    totalLiabilities: liabilitySummary.totalLiabilities,
    netWorth: netWorth
  });

  const summary = {
    runDate: Utilities.formatDate(today, tz, 'yyyy-MM-dd HH:mm:ss'),
    monthHeader: monthHeader,
    previousMonthHeader: previousMonthHeader,
    mode: mode,
    totalUsableCashNow: usableCash.totalAvailableNow,
    totalProtectedBuffers: usableCash.totalBuffers,
    usableCashAfterBuffers: usableCash.usableAfterBuffers,
    projectedIncome: cashFlow.incomeTotal,
    projectedExpenses: cashFlow.expenseTotal,
    thisMonthCashFlow: thisMonthCashFlow,
    previousMonthCashFlow: previousCashFlow.monthNet,
    monthChange: monthChange,
    minimumDueTotal: minimumDueTotal,
    payNow: nextPayments.payNow,
    paySoon: nextPayments.paySoon,
    recommendation: recommendation,
    warnings: warnings,
    notes: notes,
    topDebtTargets: activeHighInterestCards.slice(0, 5),
    otherObligations: otherObligations,
    payNowMinimumTotal: payNowMinimumTotal,
    paySoonMinimumTotal: paySoonMinimumTotal,
    suggestedExtraPayment: suggestedExtraPaymentFinal,
    recommendedTotalToPayNow: recommendedTotalToPayNow,
    executiveSummary: executiveSummary,
    actionPlan: actionPlan,
    liquiditySummary: liquiditySummary,
    unusualItems: unusualItems,
    stability: stability,
    totalActiveCreditCardDebt: totalActiveCreditCardDebt,
    cashFlowBreakdown: cashFlowBreakdown,
    assets: assets,
    houseAssets: houseAssets,
    assetSummary: assetSummary,
    houseAssetSummary: houseAssetSummary,
    liabilitySummary: liabilitySummary,
    totalAssets: totalAssets,
    netWorth: netWorth
  };

  appendHistory_(ss, summary);
  writeRecommendations_(ss, summary);
  sendPlannerEmailIfConfigured_(summary);
}