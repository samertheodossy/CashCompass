function getPurchaseSimulatorUiData() {
  const snapshot = buildDashboardSnapshot_();
  const latest = getLatestPlannerHistoryMetrics_();

  return {
    snapshot: snapshot,
    defaults: {
      purchaseDate: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      fundingMode: 'Cash',
      treatAsAsset: false,
      termMonths: 60,
      aprPct: 7.5,
      monthlyRunningCost: 0
    },
    latestMetrics: latest
  };
}

function runPurchaseSimulation(payload) {
  const purchaseName = String(payload.purchaseName || '').trim();
  const purchaseAmount = toNumber_(payload.purchaseAmount);
  const fundingMode = String(payload.fundingMode || 'Cash').trim();
  const treatAsAsset = !!payload.treatAsAsset;
  const cashDown = toNumber_(payload.cashDown);
  const aprPct = toNumber_(payload.aprPct);
  const termMonths = Math.max(1, Math.round(toNumber_(payload.termMonths)));
  const monthlyRunningCost = toNumber_(payload.monthlyRunningCost);

  if (purchaseAmount <= 0) throw new Error('Purchase Amount must be greater than 0.');
  if (fundingMode !== 'Cash' && fundingMode !== 'Finance' && fundingMode !== 'Split') {
    throw new Error('Funding Mode must be Cash, Finance, or Split.');
  }

  const snapshot = buildDashboardSnapshot_();
  const latest = getLatestPlannerHistoryMetrics_();

  const currentCash = Number(snapshot.cash || 0);
  const currentNetWorth = Number(snapshot.netWorth || 0);
  const usableCash = latest ? Number(latest.usableCash || 0) : currentCash;
  const currentProjectedCashFlow = latest ? Number(latest.projectedCashFlow || 0) : 0;

  let immediateCashHit = 0;
  let financedAmount = 0;

  if (fundingMode === 'Cash') {
    immediateCashHit = purchaseAmount;
    financedAmount = 0;
  } else if (fundingMode === 'Finance') {
    immediateCashHit = 0;
    financedAmount = purchaseAmount;
  } else {
    immediateCashHit = Math.min(Math.max(cashDown, 0), purchaseAmount);
    financedAmount = Math.max(0, purchaseAmount - immediateCashHit);
  }

  const monthlyPayment = financedAmount > 0
    ? calculateLoanPayment_(financedAmount, aprPct, termMonths)
    : 0;

  const totalMonthlyImpact = round2_(monthlyPayment + monthlyRunningCost);
  const newProjectedCashFlow = round2_(currentProjectedCashFlow - totalMonthlyImpact);
  const newCash = round2_(currentCash - immediateCashHit);
  const newUsableCash = round2_(usableCash - immediateCashHit);

  const immediateNetWorthChange = treatAsAsset ? 0 : round2_(-purchaseAmount);
  const newNetWorth = round2_(currentNetWorth + immediateNetWorthChange);

  const runwayBefore = buildRunwayFromValues_(usableCash, currentProjectedCashFlow);
  const runwayAfter = buildRunwayFromValues_(newUsableCash, newProjectedCashFlow);

  return {
    purchaseName: purchaseName || 'Purchase',
    purchaseAmount: round2_(purchaseAmount),
    fundingMode: fundingMode,
    treatAsAsset: treatAsAsset,
    immediateCashHit: round2_(immediateCashHit),
    financedAmount: round2_(financedAmount),
    monthlyPayment: round2_(monthlyPayment),
    monthlyRunningCost: round2_(monthlyRunningCost),
    totalMonthlyImpact: totalMonthlyImpact,
    currentCash: round2_(currentCash),
    newCash: newCash,
    currentUsableCash: round2_(usableCash),
    newUsableCash: newUsableCash,
    currentProjectedCashFlow: round2_(currentProjectedCashFlow),
    newProjectedCashFlow: newProjectedCashFlow,
    currentNetWorth: round2_(currentNetWorth),
    newNetWorth: round2_(newNetWorth),
    immediateNetWorthChange: round2_(immediateNetWorthChange),
    runwayBefore: runwayBefore,
    runwayAfter: runwayAfter,
    warning: buildPurchaseSimulationWarning_({
      newCash: newCash,
      newUsableCash: newUsableCash,
      newProjectedCashFlow: newProjectedCashFlow,
      treatAsAsset: treatAsAsset,
      immediateNetWorthChange: immediateNetWorthChange
    })
  };
}

function getPurchaseSimulationSummarySafe_() {
  try {
    return getPurchaseSimulatorUiData();
  } catch (e) {
    return { snapshot: null, defaults: null, latestMetrics: null, error: String(e && e.message ? e.message : e) };
  }
}

function calculateLoanPayment_(principal, aprPct, termMonths) {
  const r = (aprPct / 100) / 12;
  if (r === 0) return round2_(principal / termMonths);
  return round2_(principal * r / (1 - Math.pow(1 + r, -termMonths)));
}

function buildPurchaseSimulationWarning_(result) {
  if (result.newUsableCash < 0) {
    return 'This purchase would push usable cash below zero.';
  }
  if (result.newProjectedCashFlow < 0) {
    return 'This purchase would make projected monthly cash flow negative.';
  }
  if (!result.treatAsAsset && result.immediateNetWorthChange < 0) {
    return 'This is modeled as an expense, so it immediately reduces net worth.';
  }
  return '';
}