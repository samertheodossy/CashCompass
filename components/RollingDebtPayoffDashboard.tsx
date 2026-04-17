/**
 * Rolling Debt Payoff dashboard — React + TypeScript + inline styles only.
 */

import React, { useEffect, useMemo, useState } from 'react';

// —— Types (single export each) ————————————————————————————————————————

/**
 * Presentation mode — the "view" the user is in. Audit/debug panels are no
 * longer a separate view; they are gated by the independent boolean
 * {@link RollingDebtPayoffDashboardProps#defaultIsAdvancedView Advanced toggle}
 * so the user can stay in Standard and just flip on details when needed.
 *
 * Legacy tokens still recognized on input (see {@link normalizeModeFromSummary}):
 *   - `'operator'` / `'advanced'` → presentation `'standard'`, advanced view `true`
 *   - `'aggressive'`              → presentation `'standard'`, advanced view `true`,
 *                                   strategy `'aggressive'`
 */
export type ExecutionPresentationMode = 'standard' | 'automation';

/**
 * Allocation strategy — separate from presentation. Aggressive changes how
 * extra cash is routed (cleanup → primary concentration → secondary spill)
 * and enables the Aggressive concentration panel. It does NOT change the
 * visual layout.
 */
export type PayoffStrategy = 'standard' | 'aggressive';

export type SnapshotRow = {
  account: string;
  balanceBefore: number;
  paymentAppliedNow: number;
  balanceAfterNow: number;
  status: 'CLOSED' | '↓ PRIMARY' | '↓ SECONDARY' | 'OPEN';
};

export type ExtraLine = {
  account: string;
  amount: number;
  bucket: 'cleanup' | 'primary' | 'secondary' | 'overflow';
};

export type PlannedExpenseImpactRowVariant = 'cash' | 'card' | 'card-unmapped' | 'mid-term' | 'long-term' | 'other';

export type PlannedExpenseImpactRow = {
  expense: string;
  due: string;
  amount: number;
  fundingType: string;
  executionEffect: string;
  planningEffect: string;
  status: string;
  variant: PlannedExpenseImpactRowVariant;
  /** Server: mapped credit card debt name when card-funded and resolved. */
  mappedCardName?: string;
};

export type PlannedExpenseImpactBlock = {
  summary: {
    nearTermCashReserved: number;
    /** Near-term card-funded amounts applied to modeled balances on mapped cards only. */
    cardFundedModeledLoad: number;
    /** Unmapped near-term card-funded amounts held against deployable cash until mapped. */
    unmappedCashRiskHold: number;
    midTermCaution: number;
  };
  lines: PlannedExpenseImpactRow[];
  /** First unmapped near-term card-funded expense (copy matches product guidance). */
  unmappedCardWarning?: string;
};

/**
 * Read-only HELOC advisor snapshot — inputs for the dashboard's client-side
 * HELOC decision model + 12-month acceleration plan. Populated by the backend
 * from the month-0 `debt_balances_start` plus the identified HELOC line.
 *
 * The advisor consumes this snapshot and the user's Cash-to-use-now to derive
 * `helocStrategyModel` and `helocExecutionPlan`. It never mutates the planner
 * waterfall, allocation, or execution totals — purely decision support.
 */
export type HelocAdvisorDebt = {
  name: string;
  originalName?: string;
  type: string;
  balance: number;
  /** Annual percentage rate as a percentage (e.g. 22.49 for 22.49%). */
  aprPercent: number;
  minimumPayment: number;
};

export type HelocAdvisorSnapshot = {
  helocAprPercent: number;
  helocCurrentBalance: number;
  helocAccountName: string;
  helocMinimumPayment: number;
  debts: HelocAdvisorDebt[];
  /** Required spread over HELOC APR (percentage points) for a debt to be eligible. */
  minSpreadPercent: number;
  /** Optional estimate of HELOC credit limit, used to cap recommended draw at 30–40%. */
  estimatedHelocLimit?: number;
  /** Optional user-defined override cap on HELOC draw. */
  userDefinedCap?: number;
  /**
   * Recurring monthly paydown capacity for the HELOC — i.e. monthly free cash
   * flow that can be trusted to repeat. This is the ONLY input that sizes
   * ongoing HELOC payments. "Cash to use now" is a one-time input and is
   * never treated as recurring. Default 0 when the planner cannot supply a
   * trustworthy surplus figure (the conservative fallback).
   */
  monthlyRecurringPaydownCapacity?: number;
  /**
   * Optional, informational: conditional lump-sum paydown (e.g. RSU vests,
   * stock sales). NEVER used to size the safe draw — only surfaced in the UI.
   */
  conditionalLumpPaydownCapacity?: number;
  /** Optional human-readable note about cadence/likelihood of the lump. */
  conditionalLumpFrequencyNote?: string;
  /**
   * Known large one-time expenses the user already has on the books within
   * the next ~120 days (fence, solar, taxes, car, etc.). Their total is
   * reserved OFF the upfront cash before any HELOC draw is considered. Items
   * without `dueInDays` are treated as falling inside the window.
   */
  upcomingExpenses?: Array<{ label: string; amount: number; dueInDays?: number }>;
  /**
   * Conservative estimate of monthly spending. The safety layer reserves
   * `estimate × 1.5` of upfront cash so a draw does not put the user at risk
   * of missing 1.5 months of living expenses. When absent the advisor falls
   * back to `HELOC_DEFAULT_MONTHLY_SPENDING_ESTIMATE` and flags the value as
   * a default in the UI.
   */
  monthlySpendingEstimate?: number;
  /**
   * Expected ADDITIONAL monthly spending pressure that will reduce the
   * recurring paydown capacity (e.g. renovations, childcare, elevated tax
   * withholdings). Default 0.
   */
  monthlyNewSpendingEstimate?: number;
  /**
   * Ongoing credit-card spend signals — used by the HELOC realism layer to
   * (a) detect whether the planner's recurring surplus already nets out card
   * spending and (b) warn about the "double-debt trap" where a HELOC draw
   * pays off cards while new charges rebuild balances. All fields optional;
   * when the block is absent the advisor falls back to "no data, low
   * confidence" and the UI surfaces that gap instead of inventing numbers.
   */
  cardSpend?: {
    /** Trusted recent average (last 3–6 months) of card-paid spend. */
    recentMonthlyAverage?: number;
    /** Per-card breakdown (optional; display only). */
    byAccount?: Array<{ account: string; monthlyAverage: number }>;
    /** Known fixed card-routed recurring bills (Tahoe, ATT, subscriptions…). */
    recurringBills?: Array<{ label: string; monthlyAmount: number }>;
    /**
     * Upcoming one-time card-funded expenses within ~120 days. Tracked
     * informationally — they do NOT feed into recurring repayment math.
     */
    plannedCardFundedNext120Days?: number;
    /**
     * Trailing-4-month spiky / non-recurring card-funded spend (property
     * taxes, federal taxes, one-off large charges) — a near-term proxy
     * separate from `plannedCardFundedNext120Days`, which is forward-looking.
     */
    spikyCardSpendNext120Days?: number;
    /** Per-month history of recurring card-routed totals (last 6 months). */
    recurringCardSpendByMonth?: Array<{ month: string; amount: number }>;
    /** Per-month history of spiky / non-recurring card-routed totals. */
    plannedOrSpikyCardSpendByMonth?: Array<{ month: string; amount: number }>;
    /** Payees classified as recurring (display / debug). */
    recurringPayees?: string[];
    /** Payees classified as spiky / non-recurring (display / debug). */
    spikyPayees?: string[];
    /** Number of months of CF history walked to build the signal. */
    monthsObserved?: number;
    /** Number of those months that actually had any card-routed charges. */
    monthsWithCardData?: number;
    /**
     * Whether the planner's recurring surplus (`monthlyRecurringPaydownCapacity`)
     * already nets out card spending. Default `true` when omitted — the
     * pragmatic assumption for income-minus-expenses planners, and the only
     * safe default against double-counting. Set to `false` if the planner's
     * surplus is pre-card-spend.
     */
    alreadyInCashflow?: boolean;
    /** How the estimate was produced — drives the UI confidence badge. */
    estimationMethod?: CardSpendEstimationMethod;
    /** Self-reported confidence from the planner. */
    confidence?: CardSpendConfidence;
    /**
     * Whether any scanned Cash Flow sheet carried the optional "Active"
     * column. When `false` (legacy tabs), every row is treated as active.
     */
    activeColumnPresent?: boolean;
    /**
     * Total trailing-6-month CREDIT_CARD spend that was skipped because the
     * row's `Active` cell was `NO` / `N` / `FALSE` / `INACTIVE`. Debug-only
     * — never feeds into recurring or spiky totals.
     */
    inactiveCardSpendRemoved?: number;
    /** Top inactive payees removed, sorted by amount descending (debug). */
    inactivePayeesRemoved?: Array<{ account: string; amount: number }>;
    /**
     * Bills-based forward-looking card obligation signal (INPUT - Bills
     * with `Payment Source = CREDIT_CARD`). Always present when the
     * combined-burden layer is in play; every field is optional so legacy
     * workbooks without the Payment Source column simply omit this block.
     */
    billsPaymentSourceColumnPresent?: boolean;
    /** Count of active CREDIT_CARD bills read from INPUT - Bills. */
    activeCardBillCount?: number;
    /** Monthly-equivalent burden from active Bills CREDIT_CARD rows. */
    billsRecurringCardBurden?: number;
    /** Scheduled card-funded spikes landing in the next 120 days. */
    billsSpikyCardBurdenNext120Days?: number;
    /** Trailing-history recurring card spend (mirror of `recentMonthlyAverage`). */
    historicalRecurringCardSpend?: number;
    /** Trailing-history spiky card-funded spend. */
    historicalSpikyCardSpendNext120Days?: number;
    /**
     * `max(history_recurring, bills_recurring)` — the value actually fed
     * into `recentMonthlyAverage` so the existing realism ladder lights
     * up. Surfaced here so the UI can show both inputs + the chosen value.
     */
    chosenRecurringCardBurden?: number;
    /** `max(history_spiky, bills_spiky)` — drives the near-term proxy. */
    chosenSpikyCardBurdenNext120Days?: number;
    /** Which source dominated the recurring-burden selection. */
    sourceDecision?:
      | 'history_dominated'
      | 'bills_dominated'
      | 'tied'
      | 'history_only'
      | 'bills_only'
      | 'no_data';
    /** Which source dominated the spiky-burden selection. */
    spikySourceDecision?:
      | 'history_dominated'
      | 'bills_dominated'
      | 'tied'
      | 'history_only'
      | 'bills_only'
      | 'no_data';
    /** Bills-based recurring card obligations (monthly equivalent), sorted desc. */
    recurringCardBillsFromBills?: Array<{ account: string; monthlyEquivalent: number }>;
    /** Bills-based spiky (next-120-day dollars), sorted desc. */
    upcomingCardBillsFromBills?: Array<{ account: string; next120DayBurden: number }>;
    /** Full bills-schedule debug (frequency / due day / occurrences). */
    upcomingCardBillsSchedule?: Array<{
      payee: string;
      frequency: string;
      defaultAmount: number;
      monthlyEquivalent: number;
      next120DayBurden: number;
      next120DayDates?: string[];
      isRecurring: boolean;
      category?: string;
    }>;
    /** Payees classified as recurring by the bills model. */
    recurringCardPayeesFromBills?: string[];
    /** Payees classified as spiky by the bills model. */
    spikyCardPayeesFromBills?: string[];
  };
};

/** How `recurringMonthlyCardSpend` was derived. */
export type CardSpendEstimationMethod =
  | 'actual_recent'
  | 'recurring_bills_only'
  | 'explicit'
  | 'conservative_default'
  | 'no_data'
  /** Forward-looking, derived from INPUT - Bills (Payment Source = CREDIT_CARD). */
  | 'bills_scheduled'
  /** Both Cash-Flow history and INPUT - Bills contributed; max() wins. */
  | 'combined_history_and_bills';

/** Qualitative confidence for a card-spend estimate. */
export type CardSpendConfidence = 'high' | 'medium' | 'low';

/**
 * Estimation of ongoing credit-card spending used by the HELOC realism
 * layer. Everything here is read-only / advisory and never mutates actual
 * planner allocations.
 */
export type CardSpendModel = {
  recurringMonthlyCardSpend: number;
  recurringCardSpendByAccount: Array<{ account: string; monthlyAverage: number }>;
  /** Optional itemized list of card-routed recurring bills used to derive the total. */
  recurringCardBills: Array<{ label: string; monthlyAmount: number }>;
  /** Optional forward-looking one-time card-funded spend within the next ~120 days. */
  plannedCardFundedSpendNext120Days: number;
  /**
   * Trailing spiky / non-recurring card-funded spend (~last 4 months). Acts
   * as a near-term proxy for the next 120 days when the planner hasn't
   * explicitly listed upcoming spikes. Never mixes with the recurring total.
   */
  spikyCardSpendNext120Days: number;
  /** Per-month recurring card-routed totals (up to last 6 months). */
  recurringCardSpendByMonth: Array<{ month: string; amount: number }>;
  /** Per-month spiky / non-recurring card-routed totals. */
  plannedOrSpikyCardSpendByMonth: Array<{ month: string; amount: number }>;
  /** Payees classified as recurring. */
  recurringPayees: string[];
  /** Payees classified as spiky / non-recurring. */
  spikyPayees: string[];
  spendEstimationMethod: CardSpendEstimationMethod;
  spendConfidence: CardSpendConfidence;
  cardSpendAlreadyInCashflow: boolean;
  /**
   * Whether any scanned Cash Flow sheet carried the optional "Active"
   * column. Drives whether the UI surfaces the "Inactive card expenses are
   * excluded from recurring spend" note — on legacy tabs without the
   * column the note stays hidden because nothing is being filtered.
   */
  activeColumnPresent: boolean;
  /**
   * Total trailing-6-month CREDIT_CARD spend removed because its `Active`
   * cell was `NO` / `N` / `FALSE` / `INACTIVE`. Purely informational; these
   * rows do NOT feed into `recurringMonthlyCardSpend` or the spiky total.
   */
  inactiveCardSpendRemoved: number;
  /** Top inactive payees removed (debug/review), sorted by amount desc. */
  inactivePayeesRemoved: Array<{ account: string; amount: number }>;
  /*
   * ── Bills-based forward-looking signal (INPUT - Bills) ─────────────────
   * Every field defaults to zero / empty / false on legacy workbooks that
   * don't yet have the `Payment Source` column so the UI can render a
   * clean "Scheduled card bills — none" state instead of hiding the whole
   * block.
   */
  billsPaymentSourceColumnPresent: boolean;
  /** Count of active CREDIT_CARD rows found in INPUT - Bills. */
  activeCardBillCount: number;
  /** Monthly-equivalent burden from active CREDIT_CARD bills. */
  billsRecurringCardBurden: number;
  /** Scheduled card-funded spikes landing in the next 120 days. */
  billsSpikyCardBurdenNext120Days: number;
  /**
   * Trailing-history values — duplicated here for UI transparency so the
   * panel can show "Historical recurring card spend" alongside
   * "Bills-based recurring card burden" and "Chosen burden".
   */
  historicalRecurringCardSpend: number;
  historicalSpikyCardSpendNext120Days: number;
  /**
   * `max(history_recurring, bills_recurring)` — this is what actually
   * drives the HELOC realism math (via `recurringMonthlyCardSpend`).
   */
  chosenRecurringCardBurden: number;
  chosenSpikyCardBurdenNext120Days: number;
  /** Which source dominated the recurring-burden selection. */
  sourceDecision:
    | 'history_dominated'
    | 'bills_dominated'
    | 'tied'
    | 'history_only'
    | 'bills_only'
    | 'no_data';
  spikySourceDecision:
    | 'history_dominated'
    | 'bills_dominated'
    | 'tied'
    | 'history_only'
    | 'bills_only'
    | 'no_data';
  /** Recurring CREDIT_CARD bills from INPUT - Bills (monthly-equivalent). */
  recurringCardBillsFromBills: Array<{ account: string; monthlyEquivalent: number }>;
  /** Spiky CREDIT_CARD bills from INPUT - Bills (next-120-day dollars). */
  upcomingCardBillsFromBills: Array<{ account: string; next120DayBurden: number }>;
  /** Payees classified as recurring by the Bills model. */
  recurringCardPayeesFromBills: string[];
  /** Payees classified as spiky by the Bills model. */
  spikyCardPayeesFromBills: string[];
};

/**
 * Walks the user step-by-step from raw recurring surplus to the
 * after-card-spend effective repayment capacity that the HELOC advisor
 * actually uses.
 */
export type EffectiveHelocRepaymentModel = {
  /**
   * Recurring surplus after generic "new spending" pressure but BEFORE the
   * card-spend adjustment: `max(0, monthlyRecurring − monthlyNewSpending)`.
   */
  recurringMonthlySurplusBeforeCardAdjustment: number;
  recurringMonthlyCardSpend: number;
  /**
   * Post-adjustment capacity. Equals the "before" value when
   * `cardSpendAlreadyInCashflow` is true (to prevent double-counting);
   * otherwise `max(0, before − card_spend)`. This is the figure used for
   * safe-draw sizing and payoff months.
   */
  recurringMonthlyRepaymentCapacityEffective: number;
  cardSpendAlreadyInCashflow: boolean;
};

/** "Double-debt trap" severity — feeds the UI warning band and the guardrail. */
export type DoubleDebtSeverity = 'none' | 'watch' | 'critical';

/** Trap-risk tier — coarser, outcome-oriented classification for the UI badge. */
export type DoubleDebtTrapRiskLevel = 'low' | 'medium' | 'high';

/**
 * Structured double-debt-trap assessment. Captures the coarse risk tier, the
 * human-readable reasons (shown in the UI) and the underlying numbers so the
 * debug/automation output doesn't have to re-derive anything.
 */
export type DoubleDebtTrapModel = {
  trapRiskLevel: DoubleDebtTrapRiskLevel;
  warningReasons: string[];
  recurringCardSpend: number;
  recurringRepaymentCapacityEffective: number;
  /** Near-term spiky card-funded risk that reduces confidence. */
  spikyCardSpendNext120Days: number;
};

/** Auditable SYS–Accounts cash path (rolling debt payoff). */
export type RollingDebtPayoffCashBridge = {
  liquidTotalSheet: number;
  doNotTouchExcludedCash: number;
  policyEligibleCashBeforeBuffers: number;
  unsupportedPolicyBalanceTotal?: number;
  policyScopedBalanceTotal?: number;
  accountMinBuffersTotal: number;
  totalUsableCash: number;
  bridgeLinearSubtotalAfterBuffers?: number;
  bridgePerAccountFloorDelta?: number;
  reserveHold: number;
  globalBufferHold: number;
  nearTermPlannedCashHold: number;
  unmappedCardRiskHold: number;
  finalExecuteNowCash: number;
  monthlyExecutionCap: number;
  executableNowBudget: number;
  /** Canonical month-0 execute-now budget = min(finalExecuteNowCash, monthlyExecutionCap). */
  month0ExecuteNowBudget: number;
  cashBridgeValidationWarnings?: string[];
};

/** Month-0 allocation audit totals vs canonical execute-now budget. */
export type RollingDebtPayoffAllocationAudit = {
  allocatedCleanupTotal: number;
  allocatedPrimaryTotal: number;
  allocatedSecondaryTotal: number;
  allocatedOverflowTotal: number;
  allocatedExecuteNowCashTotal: number;
  month0ExecuteNowBudget: number;
  allocationGapToBudget: number;
  warnings?: string[];
};

export type RollingDebtPayoffDashboardData = {
  summary: {
    planStatus: string;
    anchorMonth: string;
    confidence: string;
    executionPlanMode?: string;
  };
  liquidity: {
    totalCash: number;
    reserveTarget: number;
    buffer: number;
    deployableCash: number;
    cashAvailableForExtraDebt: number;
    helocRecommended: string;
    conditionalExtraLaterThisMonth: number;
    /** SYS - Accounts policy pools after global holds (reserve, buffer, planned, unmapped). */
    debtPreferredCash?: number;
    billsAvailableCash?: number;
    cautionCash?: number;
    totalUsableCash?: number;
    /** Post–global-holds budget (not capped by monthly deploy / waterfall). */
    finalExecuteNowCash?: number;
    monthlyExecutionCap?: number;
    executableNowBudget?: number;
    /** Canonical source of truth for month-0 execute-now capacity. */
    month0ExecuteNowBudget?: number;
    /**
     * Near-term planned cash hold (global liquidity subtraction applied against total cash
     * before the UI Deployable Max. Kept separate from per-account min buffers, which stay in
     * the cash bridge audit only.
     */
    nearTermPlannedCashHold?: number;
    /**
     * Temporary cash-risk hold for unmapped card-funded near-term expenses. Shown as its own
     * KPI card so it does not hide inside "Buffer" or "Near-term planned hold".
     */
    unmappedCardRiskHold?: number;
    /**
     * Deployable Max = max(0, totalCash − reserve − buffer − nearTermHold − unmappedCardRiskHold).
     * Server-hinted ceiling; UI re-derives locally as defense-in-depth.
     */
    deployableMax?: number;
    /**
     * Calculated reserve = sum of Current Balance for DO_NOT_TOUCH cash accounts (SYS - Accounts).
     * Authoritative source for the top-row Reserve KPI, replacing legacy planner constants.
     */
    calculatedReserve?: number;
    /**
     * Calculated buffer = sum of per-account Min Buffer for non-DO_NOT_TOUCH policy-eligible
     * cash accounts. Authoritative source for the top-row Buffer KPI.
     */
    calculatedBuffer?: number;
    /** Number of DO_NOT_TOUCH cash accounts contributing to calculatedReserve (audit). */
    reserveAccountCount?: number;
    /** Number of policy-eligible cash accounts contributing a Min Buffer to calculatedBuffer (audit). */
    bufferAccountCount?: number;
    /** Human-readable source label for calculatedReserve (debug/audit). */
    reserveSource?: string;
    /** Human-readable source label for calculatedBuffer (debug/audit). */
    bufferSource?: string;
    /** Server-computed deployable_max using the calculated reserve/buffer formula (audit). */
    deployableMaxCalculated?: number;
    /** Legacy hardcoded planner reserve target (audit/debug only; must NOT drive top KPIs). */
    legacyReserveTarget?: number;
    /** Legacy hardcoded planner buffer above reserve (audit/debug only; must NOT drive top KPIs). */
    legacyBufferAboveReserve?: number;
  };
  /**
   * Optional read-only HELOC advisor inputs (debt list + identified HELOC line).
   * When present, the dashboard renders the "HELOC strategy" advisory card and
   * the 12-month acceleration plan. Never drives backend allocation / execution.
   */
  helocAdvisor?: HelocAdvisorSnapshot | null;
  /** Strict 10-step cash bridge for auditing deployable amounts. */
  cashBridge?: RollingDebtPayoffCashBridge | null;
  /** Month-0 allocation audit: totals per bucket vs month0_execute_now_budget. */
  allocationAudit?: RollingDebtPayoffAllocationAudit | null;
  alreadyPaid: { account: string }[];
  minimums: { account: string; amountDue: number }[];
  extraPayments: {
    cleanup: ExtraLine[];
    primary: ExtraLine[];
    secondary: ExtraLine[];
    overflow: ExtraLine[];
  };
  conditionalPayments: { account: string; amount: number }[];
  executionTotals: {
    fromCash: number;
    fromHeloc: number;
    totalNow: number;
    conditionalLater: number;
  };
  decisionBox: Record<string, string>;
  next3Months: { month: string; focus: string; detail?: string }[];
  watchouts: string[];
  snapshot: SnapshotRow[];
  snapshotSummary?: {
    accountsClosedNow: number;
    deployedNow: number;
    primaryReduced: number;
  };
  aggressiveMeta?: {
    postCleanupExtraPool: number;
    primaryAllocated: number;
    primaryShareOfRemainingPct: number;
    primaryBelow90: boolean;
    primaryBelow90Reason?: string;
  };
  /** INPUT - Upcoming Expenses (planned) — how deployable cash and modeled cards move. */
  plannedExpenseImpact?: PlannedExpenseImpactBlock | null;
  snapshotExecuteNowOnly?: boolean;
  /** Server: strict serial waterfall — shown when multiple concentration lines exist. */
  strictWaterfallSplitNote?: string;
  /** Server: strict waterfall validation failures (execute-now vs primary/secondary ordering). */
  strictWaterfallErrors?: string[];
  /** Server: trace-based strict waterfall self-check (month 0 execute-now). */
  waterfallExecutionValidated?: 'PASS' | 'FAIL';
  waterfallExecutionValidationFailures?: string[];
  /** Dashboard: row execution_extra_cash_total vs liquidity payload vs totals. */
  executeNowSourceValidated?: 'PASS' | 'FAIL';
  executeNowSourceValidationFailures?: string[];
  /** Dashboard: snapshot rows vs execution totals and status rules. */
  snapshotStatusValidated?: 'PASS' | 'FAIL';
  snapshotStatusValidationFailures?: string[];
};

export type RollingDebtPayoffDashboardProps = {
  data?: Partial<RollingDebtPayoffDashboardData> | null;
  /** When false, planner payload is used as-is (no merge with demoRollingDebtPayoffDashboardData). */
  useDemoFallback?: boolean;
  defaultPresentationMode?: ExecutionPresentationMode;
  onPresentationModeChange?: (mode: ExecutionPresentationMode) => void;
  /**
   * When true, audit / debug panels (cash bridge, allocation audit, display
   * plan validator, aggressive panel) are shown in the Standard view. Default
   * is `false` — the user stays in the clean Standard view and only flips
   * Advanced on when they need to inspect the numbers. Automation view is
   * unaffected by this toggle.
   */
  defaultIsAdvancedView?: boolean;
  onIsAdvancedViewChange?: (on: boolean) => void;
  /** Payoff allocation strategy — orthogonal to presentation mode. */
  defaultPayoffStrategy?: PayoffStrategy;
  onPayoffStrategyChange?: (strategy: PayoffStrategy) => void;
  className?: string;
  style?: React.CSSProperties;
};

// —— Design tokens —————————————————————————————————————————————————————

const C = {
  bg: '#f4f6f9',
  paper: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  primary: '#1e3a5f',
  primaryHi: '#2d5a8a',
  success: '#0d7d4d',
  successBg: '#ecfdf5',
  warn: '#b45309',
  warnBg: '#fffbeb',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  cashAccent: '#2563eb',
  cashAccentBg: '#eff6ff',
  indigoBg: '#eef2ff',
  execGrad: 'linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%)'
} as const;

// —— Helpers (one definition each) ——————————————————————————————————————

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function currency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
}

function currencyDetailed(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
}

function pct(num: number, den: number): number {
  return den > 0.0001 ? Math.round((100 * num) / den) : 0;
}

/**
 * Parses a user-typed cash amount. Accepts currency symbols, commas, whitespace, and negative
 * signs; returns null for unparseable input so the caller can fall back to a default.
 * Non-finite or negative values clamp to 0.
 */
function parseUserNumber(raw: string): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, n);
}

function shortenWatchout(text: string, maxLen = 96): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + '…';
}

/**
 * Main user-facing cash bridge: mirrors the top KPI row
 * (Total cash → Safe to use → Planned payment this month).
 * The legacy 10-step policy chain (DO_NOT_TOUCH, policy-eligible, min buffers, total usable cash)
 * is moved behind a "Show full policy bridge" toggle so the primary audit stays intuitive.
 */
function CashBridgeSection({
  bridge,
  totalCashDisplay,
  reserveDisplay,
  bufferDisplay,
  nearTermPlannedHoldDisplay,
  unmappedCardRiskHoldDisplay,
  deployableMaxDisplay,
  cashToUseNowInput,
  executeNowDisplay,
  exceedsDeployable,
  reserveAccountCount,
  bufferAccountCount,
  reserveSource,
  bufferSource,
  legacyReserveTarget,
  legacyBufferAboveReserve
}: {
  bridge: RollingDebtPayoffCashBridge | null;
  totalCashDisplay: number;
  reserveDisplay: number;
  bufferDisplay: number;
  nearTermPlannedHoldDisplay: number;
  unmappedCardRiskHoldDisplay: number;
  deployableMaxDisplay: number;
  cashToUseNowInput: number;
  executeNowDisplay: number;
  exceedsDeployable: boolean;
  reserveAccountCount?: number;
  bufferAccountCount?: number;
  reserveSource?: string;
  bufferSource?: string;
  legacyReserveTarget?: number;
  legacyBufferAboveReserve?: number;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const row = (n: string, label: string, value: string, emphasize = false) => (
    <div
      key={`${n}-${label}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 14,
        fontSize: 13,
        padding: '7px 0',
        borderBottom: `1px solid ${C.border}`,
        color: emphasize ? C.text : undefined,
        fontWeight: emphasize ? 700 : undefined
      }}
    >
      <span>
        <span
          style={{
            color: C.muted,
            fontWeight: 800,
            marginRight: 10,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {n}
        </span>
        {label}
      </span>
      <span
        style={{
          fontWeight: emphasize ? 800 : 700,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap'
        }}
      >
        {value}
      </span>
    </div>
  );
  return (
    <div style={{ ...shellStyle(), marginBottom: 28 }}>
      <SectionTitle>Cash bridge (audit)</SectionTitle>
      <p style={{ margin: '0 0 10px 0', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Trace from <strong>Total cash</strong> through reserve, buffer, and planned/unmapped holds
        to <strong>Safe to use</strong>, then your <strong>Cash to use now</strong> and the
        capped <strong>Planned payment this month</strong> the waterfall actually uses.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {row('1', 'Total cash', currency(totalCashDisplay))}
        {row('2', 'Minus reserve', `−${currency(reserveDisplay)}`)}
        {row('3', 'Minus buffer', `−${currency(bufferDisplay)}`)}
        {row('4', 'Minus near-term planned hold', `−${currency(nearTermPlannedHoldDisplay)}`)}
        {row('5', 'Minus unmapped card risk hold', `−${currency(unmappedCardRiskHoldDisplay)}`)}
        {row('6', '= Safe to use', currency(deployableMaxDisplay), true)}
        {row('7', 'Cash to use now (user input)', currency(cashToUseNowInput))}
        {row('8', '= Planned payment this month', currency(executeNowDisplay), true)}
      </div>
      <p style={{ margin: '10px 0 0 0', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
        <strong>Reserve</strong> = DO_NOT_TOUCH balances
        {reserveAccountCount != null ? ` (${reserveAccountCount} account${reserveAccountCount === 1 ? '' : 's'})` : ''}
        .{' '}
        <strong>Buffer</strong> = per-account min buffers on usable accounts only
        {bufferAccountCount != null ? ` (${bufferAccountCount} account${bufferAccountCount === 1 ? '' : 's'})` : ''}
        .
      </p>
      {reserveSource || bufferSource ? (
        <p style={{ margin: '4px 0 0 0', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          {reserveSource ? (
            <>
              <strong>Reserve source:</strong> {reserveSource}
              {bufferSource ? ' · ' : ''}
            </>
          ) : null}
          {bufferSource ? (
            <>
              <strong>Buffer source:</strong> {bufferSource}
            </>
          ) : null}
        </p>
      ) : null}
      {exceedsDeployable ? (
        <p style={{ margin: '10px 0 0 0', fontSize: 12, color: C.danger, fontWeight: 600 }}>
          Requested amount exceeds Safe to use; Planned payment this month is capped to{' '}
          {currency(deployableMaxDisplay)}.
        </p>
      ) : null}

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${C.border}` }}>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: C.muted,
            cursor: 'pointer'
          }}
        >
          {showDetails ? 'Hide full policy bridge' : 'Show full policy bridge (debug)'}
        </button>
        {showDetails && bridge ? (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
              Internal 10-step policy bridge — includes DO_NOT_TOUCH exclusions, per-account min
              buffers, and the monthly execution cap. Kept for accounting audit; not needed day to
              day.
            </p>
            {(legacyReserveTarget != null || legacyBufferAboveReserve != null) ? (
              <p style={{ margin: '0 0 8px 0', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                <strong>Legacy planner constants (not applied):</strong>{' '}
                {legacyReserveTarget != null ? `reserve ${currency(legacyReserveTarget)}` : ''}
                {legacyReserveTarget != null && legacyBufferAboveReserve != null ? ' · ' : ''}
                {legacyBufferAboveReserve != null ? `buffer ${currency(legacyBufferAboveReserve)}` : ''}
                {' '}— retained for audit only. Deployable math uses calculated reserve/buffer
                above.
              </p>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {row('01', 'Liquid total (sheet)', currency(bridge.liquidTotalSheet))}
              {row(
                '02',
                'Minus DO_NOT_TOUCH excluded',
                `−${currency(bridge.doNotTouchExcludedCash)}`
              )}
              {row(
                '03',
                '= Policy eligible (before buffers)',
                currency(bridge.policyEligibleCashBeforeBuffers)
              )}
              {row('04', 'Minus account min buffers', `−${currency(bridge.accountMinBuffersTotal)}`)}
              {row('05', '= Total usable cash', currency(bridge.totalUsableCash))}
              {row('06', 'Minus reserve hold', `−${currency(bridge.reserveHold)}`)}
              {row('07', 'Minus global buffer hold', `−${currency(bridge.globalBufferHold)}`)}
              {row(
                '08',
                'Minus near-term planned cash hold',
                `−${currency(bridge.nearTermPlannedCashHold)}`
              )}
              {row(
                '09',
                'Minus unmapped card risk hold',
                `−${currency(bridge.unmappedCardRiskHold)}`
              )}
              {row('10', '= Final cash (legacy chain)', currency(bridge.finalExecuteNowCash))}
              {row(
                '—',
                'Legacy monthly cap (retired — user input now bounds this)',
                currency(bridge.monthlyExecutionCap)
              )}
              {row(
                '—',
                'Safe to use (= final cash, legacy chain)',
                currency(
                  bridge.month0ExecuteNowBudget != null
                    ? bridge.month0ExecuteNowBudget
                    : bridge.executableNowBudget
                )
              )}
            </div>
            {bridge.unsupportedPolicyBalanceTotal != null &&
            bridge.unsupportedPolicyBalanceTotal > 0.005 ? (
              <p style={{ margin: '12px 0 0 0', fontSize: 12, color: C.muted }}>
                Unsupported / blank <strong>Use policy</strong> balance on sheet (not in usable
                buckets): {currency(bridge.unsupportedPolicyBalanceTotal)} — policy eligible
                includes this; usable uses only DEBT/BILLS/CAUTION accounts.
              </p>
            ) : null}
            {bridge.bridgePerAccountFloorDelta != null &&
            Math.abs(bridge.bridgePerAccountFloorDelta) > 0.02 ? (
              <p style={{ margin: '8px 0 0 0', fontSize: 12, color: C.muted }}>
                Per-account floor adjustment (Σ max(0, bal − min) vs linear):{' '}
                {currency(bridge.bridgePerAccountFloorDelta)}
              </p>
            ) : null}
            {bridge.cashBridgeValidationWarnings && bridge.cashBridgeValidationWarnings.length ? (
              <ul
                style={{
                  margin: '14px 0 0 0',
                  paddingLeft: 18,
                  color: '#b45309',
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: 1.45
                }}
              >
                {bridge.cashBridgeValidationWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Displays month-0 allocation audit totals vs canonical month0_execute_now_budget and
 * surfaces a red drift banner when the allocator's sum differs from the displayed
 * execute-now total by more than $0.01 (single-source-of-truth guard).
 */
function AllocationAuditSection({
  audit,
  displayedExecuteNow,
  userCashToUseNowInput,
  deployableMax
}: {
  audit: RollingDebtPayoffAllocationAudit;
  displayedExecuteNow: number;
  userCashToUseNowInput?: number;
  deployableMax?: number;
}) {
  /**
   * "Drift" here only means the backend allocator total ≠ what the user asked the
   * dashboard to deploy. That is EXPECTED when the user dials "Cash to use now" below
   * the deployable max: the backend pre-plans for max, the dashboard caps to the user's
   * input, and the extra-payment buckets scale down client-side. Only flag drift when
   * the user asked for max (or above) but the backend allocation still disagrees with
   * the display — that is a real reconciliation bug.
   */
  const userInput = Number(userCashToUseNowInput ?? NaN);
  const maxDeployable = Number(deployableMax ?? NaN);
  const requestedAtLeastMax =
    Number.isFinite(userInput) && Number.isFinite(maxDeployable)
      ? userInput >= maxDeployable - 0.01
      : true;
  const driftAmount = Math.abs(audit.allocatedExecuteNowCashTotal - displayedExecuteNow);
  const hasDrift = requestedAtLeastMax && driftAmount > 0.01;
  const gapToBudget = Math.abs(audit.allocationGapToBudget);
  const hasBudgetGap = gapToBudget > 0.01;
  const row = (label: string, value: string, bold = false) => (
    <div
      key={label}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 14,
        fontSize: 13,
        padding: '7px 0',
        borderBottom: `1px solid ${C.border}`
      }}
    >
      <span style={{ color: bold ? C.text : C.muted, fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
  return (
    <div style={{ ...shellStyle(), marginBottom: 28 }}>
      <SectionTitle>Allocation audit (month 0)</SectionTitle>
      {!hasDrift && !requestedAtLeastMax ? (
        <div
          style={{
            border: `1px dashed ${C.border}`,
            background: '#f8fafc',
            color: C.muted,
            padding: '8px 12px',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.5
          }}
        >
          User deploying <strong>{currency(userInput)}</strong> of <strong>{currency(maxDeployable)}</strong>
          {' '}Safe to use. Backend pre-planned the full waterfall for{' '}
          <strong>{currency(audit.allocatedExecuteNowCashTotal)}</strong>; dashboard scales the extra-payment
          buckets down client-side to match the Planned payment this month. This is expected — not drift.
        </div>
      ) : null}
      {hasDrift ? (
        <div
          style={{
            border: `1.5px solid ${C.danger}`,
            background: C.dangerBg,
            color: C.danger,
            padding: '10px 12px',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.4
          }}
        >
          DRIFT: allocator total {currency(audit.allocatedExecuteNowCashTotal)} ≠ displayed Planned payment this month{' '}
          {currency(displayedExecuteNow)} (Δ {currency(driftAmount)}). Dashboard and waterfall are out of sync.
        </div>
      ) : null}
      {hasBudgetGap ? (
        <div
          style={{
            border: `1.5px solid ${C.warn}`,
            background: C.warnBg,
            color: C.warn,
            padding: '10px 12px',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.4
          }}
        >
          Allocator vs Safe to use gap {currency(gapToBudget)} (allocated {currency(audit.allocatedExecuteNowCashTotal)} vs
          Safe to use {currency(audit.month0ExecuteNowBudget)}).
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {row('Small balances allocated', currency(audit.allocatedCleanupTotal))}
        {row('Focus debt allocated', currency(audit.allocatedPrimaryTotal))}
        {row('Next debt allocated', currency(audit.allocatedSecondaryTotal))}
        {row('Excess allocated', currency(audit.allocatedOverflowTotal))}
        {row('Total allocated (Planned payment this month)', currency(audit.allocatedExecuteNowCashTotal), true)}
        {row('Safe to use', currency(audit.month0ExecuteNowBudget), true)}
        {row('Gap (Safe to use − allocated)', currency(audit.allocationGapToBudget))}
      </div>
      {audit.warnings && audit.warnings.length ? (
        <ul style={{ margin: '14px 0 0 0', paddingLeft: 18, color: C.danger, fontSize: 12, fontWeight: 600, lineHeight: 1.45 }}>
          {audit.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Debug banner that confirms every downstream UI section (bucket cards, post-payment snapshot,
 * execution totals) is showing the SAME amount as `executeNow`. If any component were reading
 * stale backend allocations instead of the canonical `displayExecutionPlan` memo, this would
 * immediately show non-zero drift.
 *
 *   display_execute_now   = min(userCashToUseNow, deployableMax)
 *   display_bucket_total  = sum of cleanup + primary + secondary + overflow (displayExtras)
 *   snapshot_payment_total = sum of paymentAppliedNow in displaySnapshot
 *
 * Business rule: the client-side waterfall can only *truncate* the backend allocation — it
 * cannot grow beyond per-account payoff amounts the server already computed. When the user
 * asks for more cash than the backend allocated, the extra amount is reported as
 * "unallocated headroom" rather than phantom extra-payment lines. We surface this so the
 * drift banner stays truthful without silently hiding the gap.
 */
function DisplayPlanValidator({
  executeNow,
  extraTotal,
  snapshotPaymentTotal,
  unallocatedHeadroom,
  userCashToUseNowInput,
  deployableMax,
  exceedsDeployable,
  strategyComparison,
  isAggressiveStrategy,
  totalCash,
  reserve,
  buffer,
  nearTermPlannedHold,
  unmappedCardRiskHold,
  visible
}: {
  executeNow: number;
  extraTotal: number;
  snapshotPaymentTotal: number;
  unallocatedHeadroom: number;
  userCashToUseNowInput: number;
  deployableMax: number;
  exceedsDeployable: boolean;
  strategyComparison: StrategyComparison;
  isAggressiveStrategy: boolean;
  totalCash: number;
  reserve: number;
  buffer: number;
  nearTermPlannedHold: number;
  unmappedCardRiskHold: number;
  visible: boolean;
}) {
  if (!visible) return null;
  const bucketGap = round2(executeNow - extraTotal);
  const snapshotGap = round2(executeNow - snapshotPaymentTotal);
  const bucketVsSnapshotGap = round2(extraTotal - snapshotPaymentTotal);
  const hasRealDrift = Math.abs(bucketVsSnapshotGap) > 0.01;
  const hasHeadroom = unallocatedHeadroom > 0.01;
  /**
   * Deployable max formula check: verify that the displayed deployable max equals
   * max(0, total - reserve - buffer - near_term - unmapped). If the gap is > $0.01
   * the upstream math has stacked legacy holds that were supposed to be removed.
   */
  const computedDeployableMax = round2(
    Math.max(0, round2(totalCash - reserve - buffer - nearTermPlannedHold - unmappedCardRiskHold))
  );
  const deployableMaxFormulaGap = round2(deployableMax - computedDeployableMax);
  const hasDeployableMaxDrift = Math.abs(deployableMaxFormulaGap) > 0.01;
  const accent = hasRealDrift || hasDeployableMaxDrift ? C.danger : hasHeadroom ? C.warn : C.success;
  const accentBg = hasRealDrift || hasDeployableMaxDrift ? C.dangerBg : hasHeadroom ? C.warnBg : '#ecfdf5';
  const row = (label: string, value: string, bold = false) => (
    <div
      key={label}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 14,
        fontSize: 13,
        padding: '6px 0',
        borderBottom: `1px solid ${C.border}`
      }}
    >
      <span style={{ color: bold ? C.text : C.muted, fontWeight: bold ? 700 : 500 }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
  return (
    <div style={{ ...shellStyle(), marginBottom: 28, borderColor: accent, background: accentBg }}>
      <SectionTitle>Display plan validator (debug)</SectionTitle>
      <p style={{ margin: '0 0 10px 0', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
        Confirms bucket cards, snapshot rows and execution totals are all derived from the same{' '}
        <strong style={{ color: C.text }}>displayExecutionPlan</strong> memo (which is recomputed
        on every Cash-To-Use-Now change). Any &gt;$0.01 drift here means a section is still
        reading a stale backend allocation.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {row('total_cash', currencyDetailed(totalCash))}
        {row('reserve (DO_NOT_TOUCH accounts)', currencyDetailed(reserve))}
        {row('buffer (per-account min buffers)', currencyDetailed(buffer))}
        {row('near_term_planned_hold', currencyDetailed(nearTermPlannedHold))}
        {row('unmapped_card_risk_hold', currencyDetailed(unmappedCardRiskHold))}
        {row('deployable_max (displayed)', currencyDetailed(deployableMax), true)}
        {row('deployable_max (formula: max(0, total − reserve − buffer − near-term − unmapped))', currencyDetailed(computedDeployableMax))}
        {row('gap_deployable_max_formula', currencyDetailed(deployableMaxFormulaGap))}
        {row('user_cash_to_use_now_input', currencyDetailed(userCashToUseNowInput))}
        {row('display_execute_now', currencyDetailed(executeNow), true)}
        {row('display_bucket_total', currencyDetailed(extraTotal), true)}
        {row('snapshot_payment_total', currencyDetailed(snapshotPaymentTotal), true)}
        {row('gap_execute_vs_bucket', currencyDetailed(bucketGap))}
        {row('gap_execute_vs_snapshot', currencyDetailed(snapshotGap))}
        {row('gap_bucket_vs_snapshot', currencyDetailed(bucketVsSnapshotGap))}
        {row('unallocated_headroom (request > allocated)', currencyDetailed(unallocatedHeadroom))}
        {isAggressiveStrategy
          ? [
              row(
                'strategy_changed_allocations',
                strategyComparison.strategyChangedAllocations ? 'yes' : 'no',
                true
              ),
              !strategyComparison.strategyChangedAllocations && strategyComparison.strategyNoChangeReason
                ? row('strategy_no_change_reason', strategyComparison.strategyNoChangeReason)
                : null,
              row('post_cleanup_pool', currencyDetailed(strategyComparison.postCleanupPool)),
              row('std_primary_target_75', currencyDetailed(strategyComparison.stdPrimaryTarget)),
              row('agg_primary_target_90', currencyDetailed(strategyComparison.aggPrimaryTarget)),
              row('actual_primary_allocated', currencyDetailed(strategyComparison.actualPrimary)),
              row('actual_secondary_allocated', currencyDetailed(strategyComparison.actualSecondary))
            ]
          : null}
      </div>
      {hasDeployableMaxDrift ? (
        <p style={{ margin: '12px 0 0 0', fontSize: 13, color: C.danger, fontWeight: 700, lineHeight: 1.45 }}>
          DEPLOYABLE MAX DRIFT: displayed {currencyDetailed(deployableMax)} ≠ formula{' '}
          {currencyDetailed(computedDeployableMax)} (Δ {currencyDetailed(deployableMaxFormulaGap)}).
          An upstream path is stacking legacy reserve/buffer holds on top of the calculated values.
        </p>
      ) : null}
      {hasRealDrift ? (
        <p style={{ margin: '12px 0 0 0', fontSize: 13, color: C.danger, fontWeight: 700, lineHeight: 1.45 }}>
          DRIFT: bucket total ({currencyDetailed(extraTotal)}) ≠ snapshot total (
          {currencyDetailed(snapshotPaymentTotal)}). A section is not reading
          displayExecutionPlan.
        </p>
      ) : hasHeadroom ? (
        <p style={{ margin: '12px 0 0 0', fontSize: 12, color: C.warn, fontWeight: 700, lineHeight: 1.45 }}>
          Requested {currencyDetailed(userCashToUseNowInput)} exceeds backend-allocated waterfall
          total ({currencyDetailed(extraTotal)}) by {currencyDetailed(unallocatedHeadroom)}. Backend
          has no more per-account payoff capacity to absorb the extra — Planned payment this month
          is capped at the allocated amount until the planner re-runs.
        </p>
      ) : exceedsDeployable ? (
        <p style={{ margin: '12px 0 0 0', fontSize: 12, color: C.warn, fontWeight: 700, lineHeight: 1.45 }}>
          Input exceeds Safe to use; Planned payment this month is capped to {currencyDetailed(deployableMax)}.
        </p>
      ) : (
        <p style={{ margin: '12px 0 0 0', fontSize: 12, color: C.success, fontWeight: 700, lineHeight: 1.45 }}>
          OK — display plan is consistent (|drift| ≤ $0.01 across all sections).
        </p>
      )}
    </div>
  );
}

function mergeWithDemo(partial: Partial<RollingDebtPayoffDashboardData> | null | undefined): RollingDebtPayoffDashboardData {
  const d = demoRollingDebtPayoffDashboardData;
  if (!partial) return d;
  return {
    summary: { ...d.summary, ...partial.summary },
    liquidity: { ...d.liquidity, ...partial.liquidity },
    cashBridge: partial.cashBridge !== undefined ? partial.cashBridge : d.cashBridge,
    alreadyPaid: partial.alreadyPaid ?? d.alreadyPaid,
    minimums: partial.minimums ?? d.minimums,
    extraPayments: {
      cleanup: partial.extraPayments?.cleanup ?? d.extraPayments.cleanup,
      primary: partial.extraPayments?.primary ?? d.extraPayments.primary,
      secondary: partial.extraPayments?.secondary ?? d.extraPayments.secondary,
      overflow: partial.extraPayments?.overflow ?? d.extraPayments.overflow
    },
    conditionalPayments: partial.conditionalPayments ?? d.conditionalPayments,
    executionTotals: { ...d.executionTotals, ...partial.executionTotals },
    decisionBox: { ...d.decisionBox, ...partial.decisionBox },
    next3Months: partial.next3Months ?? d.next3Months,
    watchouts: partial.watchouts ?? d.watchouts,
    snapshot: partial.snapshot ?? d.snapshot,
    snapshotSummary:
      partial.snapshotSummary != null && d.snapshotSummary != null
        ? {
            accountsClosedNow: partial.snapshotSummary.accountsClosedNow ?? d.snapshotSummary.accountsClosedNow,
            deployedNow: partial.snapshotSummary.deployedNow ?? d.snapshotSummary.deployedNow,
            primaryReduced: partial.snapshotSummary.primaryReduced ?? d.snapshotSummary.primaryReduced
          }
        : (partial.snapshotSummary ?? d.snapshotSummary),
    aggressiveMeta: partial.aggressiveMeta ?? d.aggressiveMeta,
    plannedExpenseImpact: partial.plannedExpenseImpact !== undefined ? partial.plannedExpenseImpact : d.plannedExpenseImpact,
    snapshotExecuteNowOnly: partial.snapshotExecuteNowOnly ?? d.snapshotExecuteNowOnly,
    strictWaterfallSplitNote: partial.strictWaterfallSplitNote ?? d.strictWaterfallSplitNote,
    strictWaterfallErrors: partial.strictWaterfallErrors ?? d.strictWaterfallErrors,
    waterfallExecutionValidated: partial.waterfallExecutionValidated ?? d.waterfallExecutionValidated,
    waterfallExecutionValidationFailures:
      partial.waterfallExecutionValidationFailures ?? d.waterfallExecutionValidationFailures,
    executeNowSourceValidated: partial.executeNowSourceValidated ?? d.executeNowSourceValidated,
    executeNowSourceValidationFailures:
      partial.executeNowSourceValidationFailures ?? d.executeNowSourceValidationFailures,
    snapshotStatusValidated: partial.snapshotStatusValidated ?? d.snapshotStatusValidated,
    snapshotStatusValidationFailures:
      partial.snapshotStatusValidationFailures ?? d.snapshotStatusValidationFailures
  };
}

function totalExtraCash(extra: RollingDebtPayoffDashboardData['extraPayments']): number {
  return [...extra.cleanup, ...extra.primary, ...extra.secondary, ...extra.overflow].reduce((s, x) => s + (Number(x.amount) || 0), 0);
}

/**
 * Rerun the strict waterfall (cleanup → primary → secondary → overflow) against a new
 * target execute-now cash cap chosen by the user. Each line can grow up to its per-account
 * remaining payoff capacity (derived from the snapshot's `balanceAfterNow`), and shrink to
 * zero when the budget runs out. This is what makes bucket cards move in BOTH directions
 * as the user edits "Cash to use now" — not just truncate.
 *
 * Per-account payoff cap:
 *   maxAmountForLine = line.amount + snapshot[line.account].balanceAfterNow
 *   (paying `line.amount` + whatever is still owed on that account fully closes it)
 *
 * If snapshot data is not available we fall back to the old truncate-only behavior (the
 * line's original amount becomes its hard cap).
 */
function redistributeExtrasToBudget(
  extras: RollingDebtPayoffDashboardData['extraPayments'],
  targetExecuteNow: number,
  snapshot?: SnapshotRow[]
): RollingDebtPayoffDashboardData['extraPayments'] {
  const target = Math.max(0, round2(Number(targetExecuteNow) || 0));
  const out: RollingDebtPayoffDashboardData['extraPayments'] = {
    cleanup: [],
    primary: [],
    secondary: [],
    overflow: []
  };

  const balanceAfterByAccount: Record<string, number> = Object.create(null);
  if (snapshot && snapshot.length) {
    for (const row of snapshot) {
      if (!row || !row.account) continue;
      balanceAfterByAccount[row.account] = Math.max(0, Number(row.balanceAfterNow) || 0);
    }
  }

  let remaining = target;
  (['cleanup', 'primary', 'secondary', 'overflow'] as const).forEach((bucket) => {
    const lines = extras[bucket] || [];
    for (const line of lines) {
      if (remaining <= 0.005) break;
      const origAmt = Math.max(0, Number(line.amount) || 0);
      const remainingOnAccount = balanceAfterByAccount[line.account];
      const payoffCap =
        remainingOnAccount != null
          ? round2(origAmt + remainingOnAccount)
          : origAmt;
      if (payoffCap <= 0.005) continue;
      const take = round2(Math.min(payoffCap, remaining));
      if (take <= 0.005) continue;
      out[bucket].push({ account: line.account, amount: take, bucket });
      remaining = round2(remaining - take);
    }
  });
  return out;
}

/**
 * Build a per-account map of the original extra-cash allocation (summed across all buckets).
 * Used to compute per-account deltas when the user shrinks Cash-To-Use-Now below backend plan.
 */
function accountExtraMap(extras: RollingDebtPayoffDashboardData['extraPayments']): Record<string, number> {
  const map: Record<string, number> = Object.create(null);
  (['cleanup', 'primary', 'secondary', 'overflow'] as const).forEach((bucket) => {
    for (const line of extras[bucket] || []) {
      const nm = line.account;
      if (!nm) continue;
      map[nm] = round2((map[nm] || 0) + (Number(line.amount) || 0));
    }
  });
  return map;
}

/**
 * Recompute snapshot rows after the extra-cash waterfall has been re-truncated to a new
 * execute-now budget. Adjusts paymentAppliedNow / balanceAfterNow by the per-account delta
 * and re-derives the status pill (CLOSED vs ↓ PRIMARY/SECONDARY vs OPEN).
 */
function redistributeSnapshotRows(
  originalSnapshot: SnapshotRow[],
  originalExtras: RollingDebtPayoffDashboardData['extraPayments'],
  newExtras: RollingDebtPayoffDashboardData['extraPayments']
): SnapshotRow[] {
  const origMap = accountExtraMap(originalExtras);
  const newMap = accountExtraMap(newExtras);
  const primaryAccounts: Record<string, boolean> = Object.create(null);
  for (const l of originalExtras.primary || []) primaryAccounts[l.account] = true;
  for (const l of newExtras.primary || []) primaryAccounts[l.account] = true;
  const secondaryAccounts: Record<string, boolean> = Object.create(null);
  for (const l of originalExtras.secondary || []) secondaryAccounts[l.account] = true;
  for (const l of newExtras.secondary || []) secondaryAccounts[l.account] = true;
  return originalSnapshot.map((row) => {
    const orig = origMap[row.account] || 0;
    const next = newMap[row.account] || 0;
    const delta = round2(orig - next);
    if (Math.abs(delta) < 0.005) return row;
    const paymentApplied = Math.max(0, round2(row.paymentAppliedNow - delta));
    const balanceAfterRaw = round2(row.balanceAfterNow + delta);
    const balanceAfter = balanceAfterRaw <= 0.01 ? 0 : Math.max(0, balanceAfterRaw);
    let status: SnapshotRow['status'];
    if (balanceAfter <= 0.01 && paymentApplied > 0.005) status = 'CLOSED';
    else if (paymentApplied > 0.005 && primaryAccounts[row.account] && balanceAfter > 0.01) status = '↓ PRIMARY';
    else if (paymentApplied > 0.005 && secondaryAccounts[row.account] && balanceAfter > 0.01) status = '↓ SECONDARY';
    else status = 'OPEN';
    return {
      account: row.account,
      balanceBefore: row.balanceBefore,
      paymentAppliedNow: paymentApplied,
      balanceAfterNow: balanceAfter,
      status
    };
  });
}

const PRESENTATION_MODES: ExecutionPresentationMode[] = ['standard', 'automation'];
const PAYOFF_STRATEGIES: PayoffStrategy[] = ['standard', 'aggressive'];

/**
 * Phase-2 (post-cleanup) primary split fractions. Kept in sync with backend
 * constants `ROLLING_DP_PHASE2_PRIMARY_FRACTION_STANDARD_` (0.75) and
 * `ROLLING_DP_PHASE2_PRIMARY_FRACTION_AGGRESSIVE_` (0.90) in
 * `rolling_debt_payoff.js`. Used client-side only to compute an auditable
 * "what would Standard have done?" reference so users can see why Aggressive
 * did or did not change allocations.
 */
const STRATEGY_PRIMARY_FRACTION_STANDARD = 0.75;
const STRATEGY_PRIMARY_FRACTION_AGGRESSIVE = 0.9;

type StrategyNoChangeReason =
  | 'cleanup_consumed_budget'
  | 'no_secondary_pool'
  | 'primary_balance_capped'
  | 'other';

type StrategyComparison = {
  postCleanupPool: number;
  stdPrimaryTarget: number;
  stdSecondaryTarget: number;
  aggPrimaryTarget: number;
  aggSecondaryTarget: number;
  actualPrimary: number;
  actualSecondary: number;
  strategyChangedAllocations: boolean;
  strategyNoChangeReason: StrategyNoChangeReason | null;
  primaryReachedAggressiveTarget: boolean;
};

// —— UI primitives (single SectionTitle) ——————————————————————————————————

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: '0 0 12px 0',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: C.muted
      }}
    >
      {children}
    </p>
  );
}

function shellStyle(): React.CSSProperties {
  return {
    background: C.paper,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 22,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)'
  };
}

/**
 * Subtle wrapper around a group of KPI cards. Used to visually express the
 * HAVE → PROTECTED → CAN USE mental model: each group gets a header strip and
 * an optional muted/tinted background so the cards inside read as one unit
 * ("these are all protected") rather than as independent competing metrics.
 */
function KpiGroup({
  label,
  sublabel,
  background,
  borderColor,
  marginBottom,
  children
}: {
  label?: string;
  sublabel?: string;
  background?: string;
  borderColor?: string;
  marginBottom?: number;
  children: React.ReactNode;
}) {
  const showHeader = !!(label || sublabel);
  return (
    <section
      style={{
        marginBottom: marginBottom ?? 12,
        padding: background || borderColor ? '12px 14px' : 0,
        borderRadius: 14,
        background: background ?? 'transparent',
        border: borderColor ? `1px solid ${borderColor}` : 'none'
      }}
    >
      {showHeader ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10
          }}
        >
          {label ? (
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: C.muted
              }}
            >
              {label}
            </p>
          ) : null}
          {sublabel ? (
            <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
              {sublabel}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  sub,
  borderAccent,
  subMuted
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  borderAccent?: 'deployable' | 'extra';
  /**
   * When true, renders the helper (`sub`) text in a quieter style (smaller
   * font + lower-contrast color) so the number itself stays the focal point.
   * Used in the Protected group where the explanations are background context.
   */
  subMuted?: boolean;
}) {
  const borderColor =
    borderAccent === 'deployable' ? 'rgba(13, 125, 77, 0.35)' : borderAccent === 'extra' ? 'rgba(180, 83, 9, 0.4)' : C.border;
  const subStyle: React.CSSProperties = subMuted
    ? { margin: '8px 0 0 0', fontSize: 10.5, color: 'rgba(100, 116, 139, 0.75)', lineHeight: 1.35 }
    : { margin: '8px 0 0 0', fontSize: 11, color: C.muted, lineHeight: 1.35 };
  return (
    <div
      style={{
        minHeight: 124,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        background: C.paper,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: '16px 18px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.06)'
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: C.muted, lineHeight: 1.35 }}>{label}</p>
      <p style={{ margin: '10px 0 0 0', fontSize: 22, fontWeight: 800, color: C.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</p>
      <div style={{ flex: 1, minHeight: 4 }} aria-hidden />
      {sub ? (
        <p style={subStyle}>{sub}</p>
      ) : (
        <p style={{ margin: 0, fontSize: 11, minHeight: 16 }} aria-hidden />
      )}
    </div>
  );
}

/**
 * Editable KPI card for the user-driven "Cash To Use Now" input. Parses free-form numeric
 * input, enforces a non-negative range, and surfaces a cap warning if the typed amount
 * exceeds the computed Deployable Max. The card never mutates downstream state directly —
 * the parent owns the committed `cashToUseNow` value and recomputes Execute Now from it.
 */
/**
 * Interactive "Cash to use now" input card. Unlike the static KPI cards this card is
 * clearly editable:
 *   - labelled input with border + focus ring + placeholder
 *   - helper text + "Safe to use: $X" note
 *   - inline micro-feedback (over-the-safe-limit warning only)
 *
 * Quick-action chips (25 %, 50 %, 75 %, Use max) are rendered as a separate row
 * below the three-card flow by the parent via `CashToUseNowQuickActions`, so the
 * input card reads as a clean decision box rather than a control panel.
 *
 * The card consumes and emits raw strings so parent can keep the canonical parse
 * (see `parseUserNumber`); parent owns the source of truth and derives Planned payment.
 */
function CashToUseNowInputCard({
  label,
  helperText,
  inputValue,
  parsedInput,
  onChange,
  deployableMax,
  exceedsDeployable,
  placeholder,
  suggestedValue
}: {
  label: string;
  helperText: string;
  inputValue: string;
  parsedInput: number;
  onChange: (raw: string) => void;
  deployableMax: number;
  exceedsDeployable: boolean;
  placeholder?: string;
  suggestedValue?: number | null;
}) {
  const [focused, setFocused] = useState(false);
  /**
   * Card framing is intentionally subtler than the Planned payment result card so
   * the visual hierarchy reads Outcome > Input > Constraint. Border is neutral
   * at rest and only lights up on focus or when the input exceeds the cap.
   */
  const cardBorderColor = exceedsDeployable
    ? C.danger
    : focused
    ? C.primaryHi
    : C.border;
  const inputBorderColor = exceedsDeployable
    ? C.danger
    : focused
    ? C.primaryHi
    : 'rgba(30, 58, 95, 0.28)';
  const accentBg = exceedsDeployable
    ? 'rgba(220, 38, 38, 0.03)'
    : focused
    ? 'rgba(30, 58, 95, 0.03)'
    : '#ffffff';
  const hasInput = parsedInput > 0.005;
  const maxRounded = Math.max(0, Math.round(deployableMax));
  const setPercent = (p: number) => {
    const v = Math.max(0, Math.round((deployableMax * p) / 100));
    // Emit the formatted string so the field reads with thousands separators
    // without the user having to blur first.
    onChange(v.toLocaleString('en-US'));
  };
  const suggestionRounded =
    suggestedValue != null && Number.isFinite(suggestedValue) && suggestedValue > 0.005
      ? Math.max(0, Math.round(suggestedValue))
      : null;
  const showSuggestion = suggestionRounded != null && Math.abs(suggestionRounded - maxRounded) > 0;
  const chipStyle: React.CSSProperties = {
    appearance: 'none',
    border: `1px solid ${C.border}`,
    background: C.paper,
    color: C.text,
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
    flex: 1
  };
  const useMaxStyle: React.CSSProperties = {
    appearance: 'none',
    border: `1px solid ${C.primary}`,
    background: C.primary,
    color: '#ffffff',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums',
    width: '100%'
  };
  return (
    <div
      style={{
        minHeight: 124,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: accentBg,
        border: `1px solid ${cardBorderColor}`,
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: focused ? '0 0 0 3px rgba(30, 58, 95, 0.10)' : '0 1px 2px rgba(15,23,42,0.04)',
        transition: 'box-shadow 120ms ease, border-color 120ms ease, background 120ms ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.primaryHi }}>
          {label}
        </p>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: C.muted,
            background: 'rgba(100, 116, 139, 0.10)',
            borderRadius: 999,
            padding: '3px 9px',
            lineHeight: 1.2
          }}
          aria-label="This field is editable"
        >
          Editable
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: C.paper,
          border: `1.5px solid ${inputBorderColor}`,
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: focused ? 'inset 0 0 0 1px rgba(30, 58, 95, 0.18)' : 'none',
          transition: 'border-color 120ms ease, box-shadow 120ms ease'
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 800, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>$</span>
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            // Normalize to a thousands-separated string on blur so numbers
            // read naturally (1000 → 1,000). Parent state stays authoritative;
            // `parseUserNumber` already strips commas for downstream math.
            const parsed = parseUserNumber(e.target.value);
            if (parsed != null) {
              const rounded = Math.max(0, Math.round(parsed));
              const formatted = rounded.toLocaleString('en-US');
              if (formatted !== e.target.value) onChange(formatted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          placeholder={placeholder ?? 'Enter amount'}
          aria-label={label}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            fontSize: 26,
            fontWeight: 800,
            color: C.text,
            fontVariantNumeric: 'tabular-nums',
            background: 'transparent',
            padding: 0,
            lineHeight: 1.2
          }}
        />
      </div>
      {/**
       * Micro-feedback sits immediately under the input so the consequence of
       * typing is obvious. We only surface the amber cap warning — the
       * "within safe limits" confirmation was removed to keep standard mode
       * quiet when nothing needs attention.
       */}
      {hasInput && exceedsDeployable ? (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: C.warn,
            fontWeight: 700,
            lineHeight: 1.4,
            fontVariantNumeric: 'tabular-nums'
          }}
          role="status"
        >
          You're over the safe limit — we'll cap it to {currency(deployableMax)}
        </p>
      ) : null}
      {/**
       * Quick-amount shortcuts. 25/50/75 share one row and equally split the
       * width so they read as a single control block; "Use max" sits on its
       * own row as the strongest filled button because it is the most common
       * choice. An optional "Use suggested" row appears only when the planner
       * provided a distinct suggested amount.
       */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: -2 }}
        role="group"
        aria-label="Quick amounts"
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={chipStyle} onClick={() => setPercent(25)} aria-label="Use 25% of Safe to use">
            25%
          </button>
          <button type="button" style={chipStyle} onClick={() => setPercent(50)} aria-label="Use 50% of Safe to use">
            50%
          </button>
          <button type="button" style={chipStyle} onClick={() => setPercent(75)} aria-label="Use 75% of Safe to use">
            75%
          </button>
        </div>
        <button
          type="button"
          style={useMaxStyle}
          onClick={() => onChange(maxRounded.toLocaleString('en-US'))}
          aria-label="Use Safe to use"
        >
          Use max
        </button>
        {showSuggestion ? (
          <button
            type="button"
            style={{ ...chipStyle, flex: 'none', width: '100%' }}
            onClick={() => onChange((suggestionRounded as number).toLocaleString('en-US'))}
            aria-label={`Use suggested amount ${currency(suggestionRounded as number)}`}
            title="Suggested by planner"
          >
            Use suggested ({currency(suggestionRounded as number)})
          </button>
        ) : null}
      </div>
      <div style={{ marginTop: 'auto' }}>
        <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
          {helperText}
        </p>
      </div>
    </div>
  );
}

/**
 * Result / effect card rendered next to `CashToUseNowInputCard`. Visually it's the
 * direct consequence of the input so the relationship is obvious (cause → effect).
 * Renders:
 *   - Planned payment this month value (capped at Safe to use)
 *   - Live formula `min(Cash to use now, Safe to use)` with the current values
 *   - "Capped" badge if the user requested more than Safe to use
 *   - Remaining deployable note
 *
 * This card is driven from the same canonical display model that feeds extra-payment
 * buckets, snapshot, execution totals, aggressive panel and allocation audit, so any
 * typed value flows here and downstream in a single tick.
 */
function ExecuteNowResultCard({
  executeNow,
  exceedsDeployable,
  remainingDeployable
}: {
  executeNow: number;
  exceedsDeployable: boolean;
  remainingDeployable: number;
}) {
  const borderColor = exceedsDeployable ? C.danger : 'rgba(180, 83, 9, 0.9)';
  const bg = exceedsDeployable ? 'rgba(220, 38, 38, 0.10)' : 'rgba(180, 83, 9, 0.20)';
  return (
    <div
      style={{
        minHeight: 124,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: bg,
        border: `3px solid ${borderColor}`,
        borderRadius: 12,
        padding: '16px 18px',
        boxShadow:
          '0 6px 18px rgba(180, 83, 9, 0.22), 0 2px 4px rgba(180, 83, 9, 0.12)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(180, 83, 9, 0.95)'
          }}
        >
          Your payment this month
        </p>
        {exceedsDeployable ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#ffffff',
              background: C.danger,
              borderRadius: 999,
              padding: '3px 9px',
              lineHeight: 1.2
            }}
            aria-label="Planned payment this month is capped at Safe to use"
          >
            Capped
          </span>
        ) : null}
      </div>
      <p
        style={{
          margin: '4px 0 -2px 0',
          fontSize: 12,
          color: C.text,
          fontWeight: 700,
          letterSpacing: '0.02em',
          lineHeight: 1.2
        }}
      >
        You'll pay:
      </p>
      <p
        style={{
          margin: '2px 0 0 0',
          fontSize: 44,
          fontWeight: 900,
          color: C.text,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
          letterSpacing: '-0.02em'
        }}
      >
        {currency(executeNow)}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: C.text, fontWeight: 600, lineHeight: 1.4 }}>
        This will be paid this month
      </p>
      <div style={{ flex: 1, minHeight: 2 }} aria-hidden />
      {remainingDeployable > 0.005 ? (
        <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
          Remaining Safe to use after Planned payment this month:{' '}
          <span style={{ color: C.text, fontWeight: 700 }}>{currency(remainingDeployable)}</span>
        </p>
      ) : null}
    </div>
  );
}

function ProgressBar({ label, valuePct }: { label: string; valuePct: number }) {
  const w = Math.min(100, Math.max(0, valuePct));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, fontWeight: 600, color: C.muted }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{w}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', borderRadius: 4, background: C.primaryHi, transition: 'width 0.35s ease' }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: SnapshotRow['status'] }) {
  // Internal status tokens ("↓ PRIMARY", "↓ SECONDARY") are preserved in
  // the data model to avoid touching allocation/redistribution logic. Only
  // the user-facing label is remapped here so the snapshot reads in the
  // same vocabulary as the rest of the UI.
  const base: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800 };
  if (status === 'CLOSED') return <span style={{ ...base, background: C.successBg, color: C.success }}>CLOSED</span>;
  if (status.includes('PRIMARY')) return <span style={{ ...base, background: '#e0e7ff', color: C.primary }}>↓ FOCUS DEBT</span>;
  if (status.includes('SECONDARY')) return <span style={{ ...base, background: '#ede9fe', color: '#5b21b6' }}>↓ NEXT DEBT</span>;
  return <span style={{ ...base, background: '#f1f5f9', color: C.muted, border: `1px solid ${C.border}` }}>{status}</span>;
}

function plannedExpenseRowShell(variant: PlannedExpenseImpactRowVariant): { borderLeft: string; background: string } {
  if (variant === 'card-unmapped') {
    return { borderLeft: `4px solid ${C.danger}`, background: C.dangerBg };
  }
  if (variant === 'card') {
    return { borderLeft: '4px solid rgba(180, 83, 9, 0.85)', background: C.warnBg };
  }
  if (variant === 'cash') {
    return { borderLeft: `4px solid ${C.cashAccent}`, background: C.cashAccentBg };
  }
  if (variant === 'mid-term' || variant === 'long-term') {
    return { borderLeft: `4px solid ${C.muted}`, background: '#f8fafc' };
  }
  return { borderLeft: `4px solid ${C.border}`, background: '#fafbfc' };
}

function PlannedExpenseImpactSection({ block }: { block: PlannedExpenseImpactBlock }) {
  const { summary, lines, unmappedCardWarning } = block;
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: C.muted,
    borderBottom: `2px solid ${C.border}`,
    whiteSpace: 'nowrap'
  };
  return (
    <div style={{ ...shellStyle(), marginBottom: 32 }}>
      <h2 style={{ margin: '0 0 14px 0', fontSize: 18, fontWeight: 800, color: C.text }}>Planned Expense Impact</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 16,
          padding: 14,
          borderRadius: 10,
          background: '#f8fafc',
          border: `1px solid ${C.border}`
        }}
      >
        {(
          [
            { label: 'Near-term cash reserved', value: currency(summary.nearTermCashReserved) },
            { label: 'Card-funded modeled load (mapped only)', value: currency(summary.cardFundedModeledLoad) },
            { label: 'Unmapped cash-risk hold', value: currency(summary.unmappedCashRiskHold) },
            { label: 'Mid-term caution', value: currency(summary.midTermCaution) }
          ] as const
        ).map((x) => (
          <div key={x.label}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.muted }}>{x.label}</p>
            <p style={{ margin: '6px 0 0 0', fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: C.text }}>{x.value}</p>
          </div>
        ))}
      </div>
      {unmappedCardWarning ? (
        <div
          style={{
            marginBottom: 14,
            padding: '12px 14px',
            borderRadius: 10,
            border: `1px solid rgba(185, 28, 28, 0.35)`,
            background: C.dangerBg,
            fontSize: 13,
            fontWeight: 600,
            color: '#7f1d1d',
            lineHeight: 1.5
          }}
        >
          <p style={{ margin: 0 }}>{unmappedCardWarning}</p>
          <p style={{ margin: '8px 0 0 0', fontSize: 12, fontWeight: 600 }}>
            Unmapped card-funded expense is being treated as cash risk until mapped.
          </p>
        </div>
      ) : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#fff' }}>
              {(['Expense', 'Due', 'Amount', 'Funding Type', 'Execution Effect', 'Planning Effect', 'Status'] as const).map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((row, i) => {
              const shell = plannedExpenseRowShell(row.variant);
              return (
                <tr key={`${row.expense}-${i}`} style={{ borderBottom: `1px solid ${C.border}`, ...shell }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: C.text, maxWidth: 160 }}>{row.expense}</td>
                  <td style={{ padding: '10px 12px', color: C.muted, whiteSpace: 'nowrap' }}>{row.due}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {currencyDetailed(row.amount)}
                  </td>
                  <td style={{ padding: '10px 12px', color: C.text }}>{row.fundingType}</td>
                  <td style={{ padding: '10px 12px', color: C.muted, lineHeight: 1.45, maxWidth: 220 }}>{row.executionEffect}</td>
                  <td style={{ padding: '10px 12px', color: C.muted, lineHeight: 1.45, maxWidth: 220 }}>{row.planningEffect}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: C.text }}>{row.status}</span>
                      {row.variant === 'card-unmapped' ? (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            letterSpacing: '0.06em',
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: C.danger,
                            color: '#fff'
                          }}
                        >
                          CASH RISK
                        </span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExtraBucketCard({
  title,
  lines,
  totalExtra,
  bucketKey,
  footerNote
}: {
  title: string;
  lines: ExtraLine[];
  totalExtra: number;
  bucketKey: ExtraLine['bucket'];
  footerNote?: string;
}) {
  const sum = lines.reduce((s, l) => s + l.amount, 0);
  const share = pct(sum, totalExtra);
  // Display label mirrors the user-facing naming scheme used across the
  // rest of the UI (small balance / focus debt / next debt / excess).
  // Internal `bucketKey` (and the underlying extras bucket data) is left
  // untouched so allocation logic continues to use its canonical tokens.
  const bucketLabel =
    bucketKey === 'cleanup'
      ? 'SMALL BALANCES'
      : bucketKey === 'primary'
      ? 'FOCUS DEBT'
      : bucketKey === 'secondary'
      ? 'NEXT DEBT'
      : 'EXCESS';
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        background: 'rgba(244,246,249,0.95)',
        overflow: 'hidden',
        height: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          padding: '18px 18px 16px 18px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 10,
          minWidth: 0
        }}
      >
        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.3, wordBreak: 'break-word' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.muted, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums' }}>
          {currency(sum)}
          {totalExtra > 0 ? ` · ${share}% of extras` : ''}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: '5px 10px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              color: C.muted,
              background: C.paper
            }}
          >
            {bucketLabel}
          </span>
        </div>
      </div>
      <div style={{ padding: 16, flex: 1, minHeight: 0 }}>
        {!lines.length ? (
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>None</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lines.map((l, i) => (
              <li
                key={`${l.account}-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '12px 14px',
                  background: C.paper,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  minWidth: 0
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: C.text,
                    lineHeight: 1.4,
                    flex: '1 1 auto',
                    minWidth: 0,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {l.account}
                </span>
                <span style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingTop: 1, textAlign: 'right' }}>
                  {currencyDetailed(l.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {footerNote ? (
        <div style={{ padding: '0 16px 14px 16px', borderTop: `1px solid ${C.border}`, background: '#fafbfc' }}>
          <p style={{ margin: 0, paddingTop: 12, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{footerNote}</p>
        </div>
      ) : null}
    </div>
  );
}

function SnapshotTable({ rows, summary }: { rows: SnapshotRow[]; summary?: RollingDebtPayoffDashboardData['snapshotSummary'] }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        background: C.paper,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(15,23,42,0.08)'
      }}
    >
      <div style={{ padding: '16px 18px', background: '#f8fafc', borderBottom: `1px solid ${C.border}` }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Post-payment snapshot — planned payment this month only</h3>
        <p style={{ margin: '6px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
          Balances and payments in this table are the planned payment extras and minimum sequencing only — not modeled month-end balances.
        </p>
        <p style={{ margin: '6px 0 0 0', fontSize: 11, color: C.muted, lineHeight: 1.45, fontStyle: 'italic' }}>
          Planned expenses below may affect modeled month-end balances separately.
        </p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#fff', borderBottom: `2px solid ${C.border}` }}>
              {(['Account', 'Balance before', 'Payment applied now', 'Balance after now', 'Status'] as const).map((h, idx) => (
                <th
                  key={h}
                  style={{
                    textAlign: idx === 0 || idx === 4 ? 'left' : 'right',
                    padding: '12px 14px',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: C.muted
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.account}-${i}`} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 ? '#fafbfc' : '#fff' }}>
                <td
                  style={{
                    padding: '12px 14px',
                    fontWeight: 600,
                    color: C.text,
                    maxWidth: 220,
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.35
                  }}
                >
                  {r.account}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{currencyDetailed(r.balanceBefore)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: C.primaryHi }}>{currencyDetailed(r.paymentAppliedNow)}</td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{currencyDetailed(r.balanceAfterNow)}</td>
                <td style={{ padding: '12px 14px' }}>
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary ? (
        <div
          style={{
            padding: '14px 18px',
            background: 'rgba(30, 58, 95, 0.04)',
            borderTop: `1px solid ${C.border}`,
            fontSize: 12,
            color: C.muted,
            lineHeight: 1.55,
            clear: 'both'
          }}
        >
          <strong style={{ color: C.text }}>{summary.accountsClosedNow}</strong> accounts closed now ·{' '}
          <strong style={{ color: C.text }}>{currency(summary.deployedNow)}</strong> deployed now · Focus debt reduced by{' '}
          <strong style={{ color: C.text }}>{currency(summary.primaryReduced)}</strong>
        </div>
      ) : null}
    </div>
  );
}

function strategyNoChangeReasonLabel(reason: StrategyNoChangeReason): string {
  switch (reason) {
    case 'cleanup_consumed_budget':
      return 'Small balances consumed the entire Safe to use, so there was no remainder for Aggressive to concentrate on the focus debt.';
    case 'no_secondary_pool':
      return 'No next-debt pool existed this month — Standard and Aggressive both send 100% to the focus debt.';
    case 'primary_balance_capped':
      return 'Focus debt was balance-capped, so Aggressive could not reach its 90% target and spill went to the next debt — same result as Standard.';
    case 'other':
    default:
      return 'Allocation matched Standard within $0.01 without hitting a known constraint — review the concentration audit for the exact cause.';
  }
}

/**
 * Small reference line rendered directly under the Extra payments grid when
 * the Aggressive payoff strategy is active. Shows the Standard 75/25 split
 * alongside the actual Aggressive 90/10 split so the user can see at a glance
 * whether the strategy actually concentrated more into the primary target.
 */
function StrategyComparisonNote({ cmp }: { cmp: StrategyComparison }) {
  const changed = cmp.strategyChangedAllocations;
  const accent = changed ? '#5c6bc0' : C.muted;
  const accentBg = changed ? C.indigoBg : C.paper;
  return (
    <div
      style={{
        marginTop: 18,
        padding: '12px 14px',
        borderRadius: 10,
        border: `1px solid ${changed ? 'rgba(92,107,192,0.45)' : C.border}`,
        background: accentBg,
        fontSize: 13,
        lineHeight: 1.55,
        color: C.text
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: accent
        }}
      >
        Strategy comparison — after small balances {currency(cmp.postCleanupPool)}
      </p>
      <div
        style={{
          marginTop: 8,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontWeight: 600 }}>Standard split reference (75 / 25)</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: C.text }}>
            {currency(cmp.stdPrimaryTarget)} to focus debt / {currency(cmp.stdSecondaryTarget)} to next debt
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontWeight: 600 }}>Aggressive actual</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: C.text, fontWeight: 700 }}>
            {currency(cmp.actualPrimary)} to focus debt / {currency(cmp.actualSecondary)} to next debt
          </p>
        </div>
      </div>
      {!changed ? (
        <p style={{ margin: '10px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          Aggressive payoff produced the same allocation this month because small balances consumed
          the Safe to use or the focus debt was balance-capped.
          {cmp.strategyNoChangeReason ? (
            <>
              {' '}
              <em>Reason:</em> {strategyNoChangeReasonLabel(cmp.strategyNoChangeReason)}
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function AggressivePanel({
  meta,
  cmp,
  totalExtraCash
}: {
  meta: NonNullable<RollingDebtPayoffDashboardData['aggressiveMeta']>;
  cmp: StrategyComparison;
  totalExtraCash: number;
}) {
  const below = meta.primaryBelow90 && meta.primaryShareOfRemainingPct < 90;
  const cappedMsg =
    meta.primaryBelow90Reason || 'Focus debt capped at remaining payoff balance; spill to the next debt was required.';
  const genericMsg =
    'Focus debt share is below 90% without a confirmed payoff cap — review the concentration audit in the full plan output.';
  const shortfall = round2(cmp.aggPrimaryTarget - cmp.actualPrimary);
  const reachedTarget = cmp.primaryReachedAggressiveTarget;
  return (
    <div
      style={{
        border: '1px solid rgba(92, 107, 192, 0.45)',
        borderRadius: 12,
        background: C.indigoBg,
        padding: 20,
        boxShadow: '0 1px 2px rgba(15,23,42,0.06)'
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#5c6bc0'
        }}
      >
        Aggressive concentration
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginTop: 16
        }}
      >
        {[
          { k: 'Pool after small balances', v: currency(cmp.postCleanupPool) },
          { k: 'Standard focus-debt target (75%)', v: currency(cmp.stdPrimaryTarget) },
          { k: 'Aggressive focus-debt target (90%)', v: currency(cmp.aggPrimaryTarget) },
          { k: 'Focus debt actually allocated', v: currency(cmp.actualPrimary) },
          { k: 'Focus debt share (of remainder)', v: `${meta.primaryShareOfRemainingPct.toFixed(0)}%` }
        ].map((x) => (
          <div key={x.k}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
              {x.k}
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: C.text }}>
              {x.v}
            </p>
          </div>
        ))}
      </div>
      {!reachedTarget && cmp.postCleanupPool > 0.01 ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 10,
            border: '1px solid rgba(92, 107, 192, 0.35)',
            background: C.paper,
            fontSize: 14,
            lineHeight: 1.5,
            color: C.text
          }}
        >
          <strong>Did not reach the 90% target.</strong> Actual focus debt is
          {' '}
          {currency(cmp.actualPrimary)} vs target {currency(cmp.aggPrimaryTarget)} (shortfall
          {' '}
          {currency(shortfall)}).
          {' '}
          {cmp.strategyNoChangeReason
            ? strategyNoChangeReasonLabel(cmp.strategyNoChangeReason)
            : 'Review the concentration audit for the exact constraint.'}
        </div>
      ) : totalExtraCash > 0 && below ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 10,
            border: '1px solid rgba(92, 107, 192, 0.35)',
            background: C.paper,
            fontSize: 14,
            lineHeight: 1.5,
            color: C.text
          }}
        >
          <strong>Below 90%: </strong>
          {meta.primaryBelow90Reason ? cappedMsg : genericMsg}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Future / Conditional Cash panel — renders variable-income–contingent payments
 * BELOW execute-now and Execution totals. Collapsed by default in Standard
 * presentation; expanded by default in Advanced and Automation presentations.
 * These amounts are NOT part of execute-now calculations until income arrives.
 */
function FutureConditionalCashSection({
  conditionalPayments,
  conditionalExtraLaterThisMonth,
  conditionalLaterTotal,
  defaultOpen
}: {
  conditionalPayments: RollingDebtPayoffDashboardData['conditionalPayments'];
  conditionalExtraLaterThisMonth: number;
  conditionalLaterTotal: number;
  defaultOpen: boolean;
}) {
  const headerTotal = round2(
    Number(conditionalExtraLaterThisMonth) || Number(conditionalLaterTotal) || 0
  );
  const hasLines = Array.isArray(conditionalPayments) && conditionalPayments.length > 0;
  return (
    <details
      open={defaultOpen}
      style={{
        marginTop: 18,
        border: `1px dashed ${C.border}`,
        borderRadius: 10,
        background: '#f8fafc',
        padding: '12px 16px',
        color: C.muted
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'revert',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.muted
        }}
      >
        <span>Future / Conditional Cash (not available yet)</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 12 }}>
          {currency(headerTotal)}
        </span>
      </summary>

      <p style={{ margin: '10px 0 0 0', fontSize: 12, lineHeight: 1.5, color: C.muted }}>
        These amounts are <strong>not</strong> included in the Planned payment this month until
        received. Shown here for visibility only and will not affect the Planned payment totals or
        the payment buckets above.
      </p>

      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em'
        }}
      >
        Conditional inflows (not available yet)
      </div>

      {hasLines ? (
        <ul
          style={{
            listStyle: 'none',
            margin: '8px 0 0 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          {conditionalPayments.map((c, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 12px',
                border: `1px dashed ${C.border}`,
                borderRadius: 8,
                background: '#ffffff',
                fontSize: 13,
                fontWeight: 500,
                color: C.muted
              }}
            >
              <span>{c.account}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{currencyDetailed(c.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: '8px 0 0 0', fontSize: 12, color: C.muted }}>
          No variable-income contingent allocations for this month.
        </p>
      )}

      <p style={{ margin: '12px 0 0 0', fontSize: 11, color: C.muted, lineHeight: 1.5, fontStyle: 'italic' }}>
        If variable income arrives, these amounts follow the same order as the Planned payment this
        month: small balances first, then the focus debt, then the next debt, with any excess spilling
        afterward.
      </p>
    </details>
  );
}

// —— HELOC Advisor (decision support only — never mutates execution plan) ——
//
// This module is a pure read-only decision layer layered on top of the existing
// debt payoff dashboard. It answers three user questions: (1) Should I use
// HELOC? (2) Where should I apply it? (3) What happens month-by-month if I do?
//
// Hard rule (see PART 5 guardrails): this advisor MUST NOT call back into the
// waterfall allocator, modify `displayExecutionPlan`, or mix HELOC draws into
// the current execute-now totals. It renders an independent advisory card +
// 12-month simulation and is hidden whenever the advisor snapshot is absent.
// All math lives in pure functions so it can be unit-tested without React.

export type HelocStrategyStatus = 'not_needed' | 'recommended' | 'optional' | 'not_recommended';

export type HelocEligibleDebt = {
  name: string;
  balance: number;
  aprPercent: number;
  minimumPayment: number;
  /** `debt.apr - helocRate`, in percentage points. */
  benefitSpread: number;
  /**
   * Composite interest-dollar benefit score used to order debts during
   * greedy selection: `(APR − helocRate) * balance`. Larger score = more
   * interest dollars avoided per dollar of draw.
   */
  benefitScore: number;
};

export type HelocIneligibleDebt = {
  name: string;
  balance: number;
  aprPercent: number;
  reason: string;
};

/**
 * Paydown priority for the advisory repayment model. The advisor always
 * recommends routing `cash_to_use_now` to the HELOC first until the balance
 * hits zero, then reverting to the normal avalanche on any remaining debts.
 * This is informational only — it does not re-route actual cash flows.
 */
export type HelocRepaymentPriority = 'heloc_first';

export type HelocStrategyModel = {
  status: HelocStrategyStatus;
  /**
   * True when ≥1 active debt clears the APR-spread threshold over the HELOC
   * rate — i.e. a rate benefit mathematically exists. Distinct from
   * `status`: a HELOC can offer a rate benefit yet still be `not_recommended`
   * because repayment safety / cash-flow constraints block a safe draw. The
   * UI uses this pair to avoid the contradictory "not needed" headline when
   * clearly eligible high-APR targets are on the table.
   */
  rateBenefitExists: boolean;
  helocRatePercent: number;
  /** Balance-weighted average APR across the selected target debts. */
  avgTargetAprPercent: number;
  eligibleDebts: HelocEligibleDebt[];
  targetDebts: HelocEligibleDebt[];
  /**
   * Eligible debts that did NOT make the selection because `recommendedDraw`
   * ran out of safe capacity. UI uses this to surface "not all eligible debts
   * included" when there are leftovers.
   */
  excludedEligibleDebts: HelocEligibleDebt[];
  ineligibleDebts: HelocIneligibleDebt[];
  recommendedDrawAmount: number;
  /**
   * Which constraint bound the recommended draw.
   * - `cash_capacity_strict`: safe-draw window at the 9-month target was the tightest cap.
   * - `cash_capacity_upper`: draw extended to the 12-month upper window (status = optional).
   * - `heloc_limit` / `user_cap`: external safety caps.
   * - `none`: the total eligible balance fits well inside all caps.
   */
  drawCapApplied:
    | 'none'
    | 'cash_capacity_strict'
    | 'cash_capacity_upper'
    | 'heloc_limit'
    | 'user_cap';
  /**
   * One-time cash available to apply against the HELOC immediately at draw
   * (Month 0). Sourced from "Cash to use now". NEVER treated as recurring.
   */
  upfrontCashNow: number;
  /** Trusted recurring monthly cash that actually pays the HELOC down. */
  monthlyRecurringPaydownCapacity: number;
  /** Optional informational lump capacity (RSU, stock sale, bonus). */
  conditionalLumpPaydownCapacity: number;
  conditionalLumpFrequencyNote?: string;
  /**
   * Back-compat alias = `monthlyRecurringPaydownCapacity`. Preserved so the
   * existing Paydown-strategy panel keeps rendering without wholesale changes.
   */
  monthlyRepaymentCapacity: number;
  /**
   * Strict safe draw = `upfrontCashNow + monthlyRecurring × target`.
   * A draw at or below this is payable inside the 9-month target window.
   */
  safeDrawStrict: number;
  /**
   * Upper safe draw = `upfrontCashNow + monthlyRecurring × max`.
   * Draws between strict and upper are still serviceable, but only inside
   * the 12-month max window — status drops to `optional`.
   */
  safeDrawUpper: number;
  /** Back-compat alias of `safeDrawStrict`. */
  safeDrawCapacity: number;
  /** Target payoff window used to derive `safeDrawStrict` (default 9 mo). */
  targetPayoffMonths: number;
  /** Hard cutoff for "recommended" vs "not_recommended" status (default 12 mo). */
  maxPayoffMonths: number;

  /*
   * ── CASH PROTECTION / SAFETY BUFFER ─────────────────────────────────────
   * The HELOC advisor reserves upfront cash for (a) known upcoming expenses
   * and (b) a multiple of ongoing monthly spending, so a draw cannot leave
   * the user short on living expenses or scheduled outflows.
   */
  /** Sum of upcomingExpenses that fall within `futureExpenseWindowDays`. */
  futureExpenseReserve: number;
  /** Filtered expense items used to produce `futureExpenseReserve`. */
  futureExpenseItems: Array<{ label: string; amount: number; dueInDays?: number }>;
  /** Horizon (days) for future-expense reserve; default 120. */
  futureExpenseWindowDays: number;
  /** `monthlySpendingEstimate × 1.5` held aside from upfront cash. */
  spendingBuffer: number;
  /** Monthly spending figure used to derive `spendingBuffer`. */
  monthlySpendingEstimate: number;
  /** True when `monthlySpendingEstimate` fell back to the default constant. */
  monthlySpendingIsDefault: boolean;
  /**
   * Upfront cash that is actually safe to deploy against a HELOC after the
   * future-expense reserve and spending buffer are carved off. Clamped at 0.
   * All Month-0 paydown math uses this value, NOT the raw "Cash to use now".
   */
  adjustedUpfrontCash: number;
  /**
   * True when the future-expense reserve consumes more than 30% of raw
   * upfront cash — the UI surfaces this as "large upcoming expenses reduce
   * safe HELOC capacity".
   */
  cashProtectionWarning: boolean;
  /**
   * Expected additional monthly spending pressure (renovations, childcare,
   * tax withholdings, etc.) that reduces recurring paydown. Default 0.
   */
  monthlyNewSpendingEstimate: number;
  /**
   * Post-ALL-adjustments recurring paydown used for Month 1+ payoff math.
   * Layers applied in order:
   *   1. `max(0, monthlyRecurringPaydownCapacity − monthlyNewSpendingEstimate)`
   *      (generic new-spending pressure — childcare, renovations, taxes)
   *   2. If `cardSpendAlreadyInCashflow === false`, subtract
   *      `cardSpendModel.recurringMonthlyCardSpend` as well (clamped at 0).
   * Always ≥ 0. Consumed by the safe-draw math AND the residual payoff loop
   * — never use raw `monthlyRecurringPaydownCapacity` for sizing.
   */
  effectiveMonthlyRepayment: number;

  /*
   * ── HELOC REALISM LAYER (ongoing card spend) ────────────────────────────
   * The advisor models ongoing credit-card spend separately so it can (a)
   * avoid double-counting when the planner's surplus already nets it out,
   * and (b) warn about the "double-debt trap" where a HELOC draw clears
   * cards while new charges rebuild balances.
   */
  cardSpendModel: CardSpendModel;
  effectiveHelocRepaymentModel: EffectiveHelocRepaymentModel;
  /** True when any double-debt condition is met (watch OR critical). */
  doubleDebtWarning: boolean;
  doubleDebtSeverity: DoubleDebtSeverity;
  /**
   * Outcome-oriented trap-risk assessment (`low` / `medium` / `high`) plus
   * the enumerated reasons surfaced to the UI. Mirrors `doubleDebtSeverity`
   * on a coarser scale: `none → low`, `watch → medium`, `critical → high`,
   * promoted further when spiky near-term card spend is material.
   */
  doubleDebtTrapModel: DoubleDebtTrapModel;
  /** Advisory priority rule — always `"heloc_first"` for the current model. */
  repaymentPriority: HelocRepaymentPriority;
  /**
   * Expected principal reduction on the HELOC per month under the advisory
   * "all cash to HELOC" rule = max(0, monthlyRepaymentCapacity − monthly interest on month-0 draw).
   * Kept as a single summary number so the UI can show "$X/month reduction" without the user
   * reading the full 12-month table.
   */
  estimatedMonthlyReduction: number;
  /** Short human-readable description of the paydown rule. */
  paydownBehaviorNote: string;
  /** Linear-capacity estimate (ceil(draw / monthlyCapacity)). May be `Infinity`. */
  payoffMonths: number;
  interestSavedEstimate: number;
  payoffMonthsWithHeloc: number;
  payoffMonthsWithoutHeloc: number;
  accelerationMonthsSaved: number;
  /** True when capacity + rate push payoff past 12 months — UI surfaces a warning. */
  slowPayoffWarning: boolean;
};

export type HelocPlanRow = {
  month: number;
  startingHelocBalance: number;
  drawAmount: number;
  debtReplaced: string[];
  /**
   * Total cash applied to the HELOC in this month. For month 0 this equals
   * `immediatePaydownFromCashNow`; for month 1..N it equals
   * `recurringPaymentFromCash`. Kept for back-compat with existing UI.
   */
  payment: number;
  /**
   * Month 0 only: one-time cash (from "Cash to use now") applied to the
   * freshly-drawn HELOC balance.
   */
  immediatePaydownFromCashNow: number;
  /**
   * Month 1+: recurring monthly cash flow applied to the HELOC. Never fed
   * by a draw — always sourced from the user's recurring cash.
   */
  recurringPaymentFromCash: number;
  /**
   * Optional conditional payment (RSU/stock sale) for the month. Reserved
   * field; always 0 until the user explicitly toggles a lump scenario.
   */
  conditionalPayment: number;
  interestAccrued: number;
  endingHelocBalance: number;
  /** HELOC balance + remaining non-target debt balance at end of month. */
  remainingDebt: number;
  /**
   * Human-readable behavior note for this month under the advisory rule.
   * For months 1..N while the HELOC is not yet zero this reads:
   *   "Recurring cash is directed to HELOC until fully paid"
   * After the HELOC clears the note switches to the normal avalanche rule.
   */
  paymentBehaviorNote: string;
};

export type HelocExecutionPlan = {
  rows: HelocPlanRow[];
  summary: {
    monthsToZeroHeloc: number;
    totalInterestSaved: number;
    accelerationMonthsSaved: number;
    /** Recurring monthly cash applied to the HELOC in months 1..N. */
    monthlyCashApplied: number;
    /** Total one-time cash applied at Month 0. */
    upfrontCashApplied: number;
    /** Informational conditional lump amount (always additive, never assumed). */
    conditionalLumpCapacity: number;
    estimatedMonthlyReduction: number;
    repaymentPriority: HelocRepaymentPriority;
    paydownBehaviorNote: string;
    slowPayoffWarning: boolean;
    /** True when recurring capacity ≤ 0 — UI surfaces a conservative warning. */
    recurringCapacityWarning: boolean;
    /** Upfront cash remaining safe to deploy after reserves/buffer. */
    adjustedUpfrontCash: number;
    /** Recurring paydown used for Month 1+ payments (post new-spending drain). */
    effectiveMonthlyRepayment: number;
    /** `true` when upcoming expenses exceed 30% of raw upfront cash. */
    cashProtectionWarning: boolean;
    /**
     * Ongoing credit-card spend figure (monthly) the advisor assumed. Drives
     * the "Model assumes ongoing card spending continues at ≈ $X/month" note
     * in the 12-month plan.
     */
    ongoingCardSpendMonthly: number;
    /** Whether card spend was already netted out of the planner surplus. */
    cardSpendAlreadyInCashflow: boolean;
    /** True for watch-level or critical double-debt conditions. */
    doubleDebtWarning: boolean;
    doubleDebtSeverity: DoubleDebtSeverity;
    /** Coarser outcome-oriented trap risk tier. */
    doubleDebtTrapRiskLevel: DoubleDebtTrapRiskLevel;
    /** Enumerated reasons behind the trap risk tier, for UI rendering. */
    doubleDebtWarningReasons: string[];
    /** Trailing spiky card spend captured from CF history. */
    spikyCardSpendNext120Days: number;
  };
};

type SimDebt = { name: string; balance: number; aprPercent: number; minimumPayment: number };

/**
 * Advisory paydown behavior note reused by the strategy model and every
 * active month of the 12-month plan. Keeping it as a single constant keeps
 * the UI copy and exported model in sync.
 */
const HELOC_PAYDOWN_BEHAVIOR_NOTE =
  'Recurring cash is directed to HELOC until fully paid';

const HELOC_POST_CLEAR_BEHAVIOR_NOTE =
  'HELOC cleared — recurring cash reverts to the standard avalanche on remaining debts';

const HELOC_MONTH0_BEHAVIOR_NOTE =
  'One-time cash applied immediately to the fresh HELOC draw';

/** Target payoff window: draws are sized to clear within this many months. */
const HELOC_TARGET_PAYOFF_MONTHS = 9;
/** Hard cutoff: anything beyond this falls to `status = 'not_recommended'`. */
const HELOC_MAX_PAYOFF_MONTHS = 12;

/*
 * ─── Cash-protection / safety-buffer constants ──────────────────────────
 * Used by the HELOC advisor to prevent over-leverage when sizing a draw.
 */
/** Horizon for "future expense reserve": include upcoming expenses within N days. */
const HELOC_FUTURE_EXPENSE_WINDOW_DAYS = 120;
/** Spending buffer = monthly spending × this multiplier (~1.5 months of runway). */
const HELOC_SPENDING_BUFFER_MULTIPLIER = 1.5;
/**
 * Conservative default monthly spending estimate ($) when the planner has
 * no trustworthy figure. Intentionally generous so the buffer stays safe.
 * NOTE: this is a display constant, not a credential.
 */
const HELOC_DEFAULT_MONTHLY_SPENDING_ESTIMATE = 10_000;
/** Future-expense-to-cash ratio above which the UI warns the user. */
const HELOC_FUTURE_EXPENSE_WARNING_THRESHOLD = 0.3;

/*
 * ─── HELOC realism constants (ongoing card-spend layer) ─────────────────
 */
/**
 * Card-spend level at/above which the "double-debt trap" logic applies.
 * Below this threshold, ongoing card spend is assumed incidental and we do
 * NOT downgrade recommendations or fire the rebuild warning.
 */
const HELOC_MATERIAL_CARD_SPEND_PER_MONTH = 500;
/**
 * Effective repayment must clear at least this multiple of ongoing card
 * spend to avoid the watch-level double-debt warning. A value of 2 means
 * the user can absorb new card charges AND still have an equal amount of
 * capacity left over for HELOC paydown. Below that, the math implies cards
 * rebuild nearly as fast as the HELOC shrinks.
 */
const HELOC_DOUBLE_DEBT_WEAKNESS_MULTIPLIER = 2;

/**
 * Simulate avalanche payoff with an optional HELOC tranche on top. Returns the
 * number of months needed to zero out every debt (HELOC + non-target). Capped
 * at 240 months so a pathological input can never run away. Interest is
 * accrued monthly, minimums are paid on each active debt, and any remaining
 * capacity is routed to the highest-APR debt (HELOC included).
 */
function simulateAvalanchePayoffMonths(params: {
  helocRatePercent: number;
  helocBalance: number;
  remainingDebts: SimDebt[];
  monthlyCapacity: number;
}): number {
  const MAX_MONTHS = 240;
  const cap = Math.max(0, Number(params.monthlyCapacity) || 0);
  if (cap <= 0.005) return MAX_MONTHS;
  let helocBal = Math.max(0, Number(params.helocBalance) || 0);
  const helocMonthlyRate = Math.max(0, Number(params.helocRatePercent) || 0) / 100 / 12;
  const debts: SimDebt[] = params.remainingDebts
    .filter((d) => d && d.balance > 0.005)
    .map((d) => ({
      name: d.name,
      balance: Number(d.balance) || 0,
      aprPercent: Number(d.aprPercent) || 0,
      minimumPayment: Math.max(0, Number(d.minimumPayment) || 0)
    }));
  for (let m = 1; m <= MAX_MONTHS; m++) {
    if (helocBal <= 0.005 && debts.every((d) => d.balance <= 0.005)) {
      return m - 1;
    }
    helocBal = Math.max(0, helocBal + helocBal * helocMonthlyRate);
    for (const d of debts) {
      if (d.balance <= 0.005) continue;
      d.balance = d.balance + d.balance * (d.aprPercent / 100 / 12);
    }
    let budget = cap;
    for (const d of debts) {
      if (d.balance <= 0.005 || d.minimumPayment <= 0.005) continue;
      const pay = Math.min(d.minimumPayment, d.balance, budget);
      d.balance = Math.max(0, d.balance - pay);
      budget = Math.max(0, budget - pay);
      if (budget <= 0.005) break;
    }
    while (budget > 0.005) {
      let target: SimDebt | null = null;
      let targetApr = helocBal > 0.005 ? params.helocRatePercent : -Infinity;
      for (const d of debts) {
        if (d.balance <= 0.005) continue;
        if (d.aprPercent > targetApr) {
          target = d;
          targetApr = d.aprPercent;
        }
      }
      if (helocBal > 0.005 && (!target || params.helocRatePercent >= targetApr)) {
        const pay = Math.min(helocBal, budget);
        helocBal = Math.max(0, helocBal - pay);
        budget = Math.max(0, budget - pay);
      } else if (target) {
        const pay = Math.min(target.balance, budget);
        target.balance = Math.max(0, target.balance - pay);
        budget = Math.max(0, budget - pay);
      } else {
        break;
      }
    }
  }
  return MAX_MONTHS;
}

/**
 * Build the advisory HELOC strategy model.
 *
 * Inputs are split into three distinct buckets so the model cannot confuse
 * a one-time deployment with a recurring monthly paydown:
 *
 * - `upfrontCashNow`           → one-time cash to apply at Month 0.
 * - `monthlyRecurringPaydown`  → trusted recurring cash flow that actually
 *                                services the HELOC over months 1..N.
 *                                MUST default to 0 when not explicitly known.
 * - `conditionalLumpPaydown`   → optional, informational (RSU/stock sale).
 *                                NEVER used to size the safe draw.
 *
 * Safe-draw thresholds:
 *   safe_draw_strict = upfront + recurring × 9   (recommended window)
 *   safe_draw_upper  = upfront + recurring × 12  (still serviceable, optional)
 *
 * Returns `null` when there are no non-HELOC debts to analyse.
 */
export function computeHelocStrategyModel(params: {
  debts: Array<{ name: string; type: string; balance: number; aprPercent: number; minimumPayment: number }>;
  helocRatePercent: number;
  minSpreadPercent: number;
  /** One-time cash available now (maps to the "Cash to use now" user input). */
  upfrontCashNow: number;
  /**
   * Recurring monthly cash that services the HELOC. Pass 0 when no reliable
   * surplus exists — NEVER fall back to `upfrontCashNow`.
   */
  monthlyRecurringPaydown: number;
  /** Optional informational lump (e.g. RSU/stock sale). */
  conditionalLumpPaydown?: number;
  conditionalLumpFrequencyNote?: string;
  /** Planned large expenses within the next ~120 days (fence, solar, taxes, car). */
  upcomingExpenses?: Array<{ label: string; amount: number; dueInDays?: number }>;
  /** Monthly spending; `× 1.5` is held back from upfront cash. */
  monthlySpendingEstimate?: number;
  /** Additional monthly spending pressure that erodes recurring paydown. */
  monthlyNewSpendingEstimate?: number;
  /**
   * Realism-layer signal: ongoing credit-card spend. Drives the
   * `cardSpendModel`, effective repayment adjustment, and the double-debt
   * trap warning. Pass `undefined` when the planner has no data — the
   * advisor will flag `no_data` / low confidence rather than inventing a
   * number.
   */
  cardSpend?: HelocAdvisorSnapshot['cardSpend'];
  estimatedHelocLimit?: number;
  userDefinedCap?: number;
}): HelocStrategyModel | null {
  const helocRate = Math.max(0, Number(params.helocRatePercent) || 0);
  const minSpread = Math.max(0, Number(params.minSpreadPercent) || 3);
  const upfrontCashNow = Math.max(0, Number(params.upfrontCashNow) || 0);
  const monthlyRecurring = Math.max(0, Number(params.monthlyRecurringPaydown) || 0);
  const conditionalLump = Math.max(0, Number(params.conditionalLumpPaydown) || 0);
  const conditionalNote = params.conditionalLumpFrequencyNote || undefined;
  const targetPayoffMonths = HELOC_TARGET_PAYOFF_MONTHS;
  const maxPayoffMonths = HELOC_MAX_PAYOFF_MONTHS;

  /*
   * Cash-protection layer — runs BEFORE any safe-draw math.
   *
   *   future_expense_reserve = Σ upcoming_expenses within 120 days
   *   spending_buffer        = monthly_spending × 1.5
   *   adjusted_upfront_cash  = max(0, upfrontCashNow − reserve − buffer)
   *
   * The adjusted figure is what the advisor is allowed to deploy; raw
   * upfrontCashNow is preserved for UI display only.
   */
  const futureExpenseWindowDays = HELOC_FUTURE_EXPENSE_WINDOW_DAYS;
  const futureExpenseItems = (params.upcomingExpenses || [])
    .filter(
      (e) =>
        e &&
        typeof e.label === 'string' &&
        e.label.trim() &&
        Number(e.amount) > 0 &&
        (e.dueInDays == null || Number(e.dueInDays) <= futureExpenseWindowDays)
    )
    .map((e) => ({
      label: e.label.trim(),
      amount: round2(Math.max(0, Number(e.amount) || 0)),
      dueInDays: e.dueInDays != null ? Math.max(0, Number(e.dueInDays) || 0) : undefined
    }));
  const futureExpenseReserve = round2(
    futureExpenseItems.reduce((s, e) => s + e.amount, 0)
  );

  const hasExplicitSpending =
    params.monthlySpendingEstimate != null && Number(params.monthlySpendingEstimate) > 0;
  const monthlySpendingEstimate = hasExplicitSpending
    ? round2(Math.max(0, Number(params.monthlySpendingEstimate) || 0))
    : HELOC_DEFAULT_MONTHLY_SPENDING_ESTIMATE;
  const monthlySpendingIsDefault = !hasExplicitSpending;
  const spendingBuffer = round2(monthlySpendingEstimate * HELOC_SPENDING_BUFFER_MULTIPLIER);

  const adjustedUpfrontCash = round2(
    Math.max(0, upfrontCashNow - futureExpenseReserve - spendingBuffer)
  );
  const cashProtectionWarning =
    upfrontCashNow > 0.005 &&
    futureExpenseReserve > HELOC_FUTURE_EXPENSE_WARNING_THRESHOLD * upfrontCashNow;

  const monthlyNewSpendingEstimate = Math.max(
    0,
    Number(params.monthlyNewSpendingEstimate) || 0
  );
  /*
   * Step A: surplus AFTER generic "new spending" pressure but BEFORE the
   * card-spend realism layer. Always ≥ 0.
   */
  const surplusBeforeCardAdjustment = round2(
    Math.max(0, monthlyRecurring - monthlyNewSpendingEstimate)
  );

  /*
   * ── Step B: card-spend realism layer ────────────────────────────────────
   *
   * Estimation ladder (first non-empty wins):
   *   1. `cardSpend.recentMonthlyAverage`      → method `actual_recent`
   *   2. Σ `cardSpend.recurringBills`          → method `recurring_bills_only`
   *   3. fall-through (no data)                → method `no_data`, 0 spend
   *
   * `cardSpendAlreadyInCashflow` is the ONE decision that governs whether
   * the card-spend total is subtracted from the recurring surplus. Default
   * `true` — the pragmatic guard against double-counting when the planner's
   * surplus is an income-minus-expenses figure that already nets out card
   * charges. Backend sets `false` to force subtraction.
   */
  const rawCardSpend = params.cardSpend || undefined;
  const cardSpendByAccount = (rawCardSpend?.byAccount || [])
    .filter((a) => a && typeof a.account === 'string' && a.account.trim() && Number(a.monthlyAverage) > 0)
    .map((a) => ({
      account: a.account.trim(),
      monthlyAverage: round2(Math.max(0, Number(a.monthlyAverage) || 0))
    }));
  const cardRecurringBills = (rawCardSpend?.recurringBills || [])
    .filter(
      (b) =>
        b &&
        typeof b.label === 'string' &&
        b.label.trim() &&
        Number(b.monthlyAmount) > 0
    )
    .map((b) => ({
      label: b.label.trim(),
      monthlyAmount: round2(Math.max(0, Number(b.monthlyAmount) || 0))
    }));
  const recentMonthlyAverageProvided =
    rawCardSpend?.recentMonthlyAverage != null &&
    Number(rawCardSpend.recentMonthlyAverage) >= 0;
  const recurringBillsTotal = round2(
    cardRecurringBills.reduce((s, b) => s + b.monthlyAmount, 0)
  );
  let recurringMonthlyCardSpend: number;
  let spendEstimationMethod: CardSpendEstimationMethod;
  let spendConfidence: CardSpendConfidence;
  if (recentMonthlyAverageProvided) {
    recurringMonthlyCardSpend = round2(
      Math.max(0, Number(rawCardSpend!.recentMonthlyAverage) || 0)
    );
    spendEstimationMethod = rawCardSpend!.estimationMethod || 'actual_recent';
    spendConfidence = rawCardSpend!.confidence || 'high';
  } else if (recurringBillsTotal > 0.005) {
    recurringMonthlyCardSpend = recurringBillsTotal;
    spendEstimationMethod = rawCardSpend?.estimationMethod || 'recurring_bills_only';
    spendConfidence = rawCardSpend?.confidence || 'medium';
  } else {
    recurringMonthlyCardSpend = 0;
    spendEstimationMethod = rawCardSpend?.estimationMethod || 'no_data';
    spendConfidence = rawCardSpend?.confidence || 'low';
  }
  const plannedCardFundedSpendNext120Days = round2(
    Math.max(0, Number(rawCardSpend?.plannedCardFundedNext120Days) || 0)
  );
  const spikyCardSpendNext120Days = round2(
    Math.max(0, Number(rawCardSpend?.spikyCardSpendNext120Days) || 0)
  );
  // Default TRUE: safest against double-counting when planner surplus
  // already nets card spend (the common case). Backend flips to false
  // when it knows the surplus is pre-card-spend.
  const cardSpendAlreadyInCashflow =
    rawCardSpend?.alreadyInCashflow == null ? true : rawCardSpend.alreadyInCashflow === true;

  // Per-month series + payee classification — display / debug only. Cloned
  // so downstream mutations can't leak back into the planner payload.
  const recurringCardSpendByMonth = (rawCardSpend?.recurringCardSpendByMonth || [])
    .filter((m) => m && typeof m.month === 'string' && m.month.trim())
    .map((m) => ({
      month: m.month.trim(),
      amount: round2(Math.max(0, Number(m.amount) || 0))
    }));
  const plannedOrSpikyCardSpendByMonth = (
    rawCardSpend?.plannedOrSpikyCardSpendByMonth || []
  )
    .filter((m) => m && typeof m.month === 'string' && m.month.trim())
    .map((m) => ({
      month: m.month.trim(),
      amount: round2(Math.max(0, Number(m.amount) || 0))
    }));
  const recurringPayees = (rawCardSpend?.recurringPayees || [])
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  const spikyPayees = (rawCardSpend?.spikyPayees || [])
    .map((p) => String(p || '').trim())
    .filter(Boolean);

  // Active-column bookkeeping (backend sends these whenever the Cash Flow
  // sheet has the optional `Active` column). On legacy tabs we default to
  // `false` / 0 / empty so the UI simply doesn't render the exclusion note
  // (nothing is being filtered out to warn about).
  const activeColumnPresent =
    rawCardSpend?.activeColumnPresent === true;
  const inactiveCardSpendRemoved = Math.max(
    0,
    Number(rawCardSpend?.inactiveCardSpendRemoved) || 0
  );
  const inactivePayeesRemoved = (rawCardSpend?.inactivePayeesRemoved || [])
    .filter(
      (entry): entry is { account: string; amount: number } =>
        !!entry &&
        typeof entry.account === 'string' &&
        entry.account.trim().length > 0 &&
        Number.isFinite(Number(entry.amount)) &&
        Number(entry.amount) > 0.005
    )
    .map((entry) => ({
      account: entry.account.trim(),
      amount: round2(Number(entry.amount))
    }));

  /*
   * ── Bills-based forward-looking card obligation signal ────────────────
   * Pass through the derived burden-selection fields so the UI can render
   * the full "History vs Bills vs Chosen" comparison. All values default
   * to 0 / [] / false on legacy workbooks without the Payment Source
   * column so the panel can still render a clean "Scheduled card bills —
   * none" state instead of hiding the whole block.
   */
  const billsPaymentSourceColumnPresent =
    rawCardSpend?.billsPaymentSourceColumnPresent === true;
  const activeCardBillCount = Math.max(
    0,
    Math.round(Number(rawCardSpend?.activeCardBillCount) || 0)
  );
  const billsRecurringCardBurden = round2(
    Math.max(0, Number(rawCardSpend?.billsRecurringCardBurden) || 0)
  );
  const billsSpikyCardBurdenNext120Days = round2(
    Math.max(0, Number(rawCardSpend?.billsSpikyCardBurdenNext120Days) || 0)
  );
  // Default historical to the primary `recentMonthlyAverage` /
  // `spikyCardSpendNext120Days` signals when the backend didn't emit the
  // burden-selection block (combined payload not produced). Keeps the UI
  // honest about what feeds the chosen value.
  const historicalRecurringCardSpend = round2(
    Math.max(
      0,
      Number(rawCardSpend?.historicalRecurringCardSpend) || recurringMonthlyCardSpend
    )
  );
  const historicalSpikyCardSpendNext120Days = round2(
    Math.max(
      0,
      Number(rawCardSpend?.historicalSpikyCardSpendNext120Days) ||
        spikyCardSpendNext120Days
    )
  );
  const chosenRecurringCardBurden = round2(
    Math.max(
      0,
      Number(rawCardSpend?.chosenRecurringCardBurden) ||
        Math.max(historicalRecurringCardSpend, billsRecurringCardBurden)
    )
  );
  const chosenSpikyCardBurdenNext120Days = round2(
    Math.max(
      0,
      Number(rawCardSpend?.chosenSpikyCardBurdenNext120Days) ||
        Math.max(historicalSpikyCardSpendNext120Days, billsSpikyCardBurdenNext120Days)
    )
  );
  type Decision = CardSpendModel['sourceDecision'];
  const VALID_DECISIONS: readonly Decision[] = [
    'history_dominated',
    'bills_dominated',
    'tied',
    'history_only',
    'bills_only',
    'no_data'
  ];
  const normalizeDecision = (d: string | undefined): Decision => {
    if (d && (VALID_DECISIONS as readonly string[]).includes(d)) return d as Decision;
    return 'no_data';
  };
  const sourceDecision = normalizeDecision(rawCardSpend?.sourceDecision);
  const spikySourceDecision = normalizeDecision(rawCardSpend?.spikySourceDecision);

  const recurringCardBillsFromBills = (rawCardSpend?.recurringCardBillsFromBills || [])
    .filter(
      (b): b is { account: string; monthlyEquivalent: number } =>
        !!b &&
        typeof b.account === 'string' &&
        b.account.trim().length > 0 &&
        Number.isFinite(Number(b.monthlyEquivalent)) &&
        Number(b.monthlyEquivalent) > 0.005
    )
    .map((b) => ({
      account: b.account.trim(),
      monthlyEquivalent: round2(Number(b.monthlyEquivalent))
    }));
  const upcomingCardBillsFromBills = (rawCardSpend?.upcomingCardBillsFromBills || [])
    .filter(
      (b): b is { account: string; next120DayBurden: number } =>
        !!b &&
        typeof b.account === 'string' &&
        b.account.trim().length > 0 &&
        Number.isFinite(Number(b.next120DayBurden)) &&
        Number(b.next120DayBurden) > 0.005
    )
    .map((b) => ({
      account: b.account.trim(),
      next120DayBurden: round2(Number(b.next120DayBurden))
    }));
  const recurringCardPayeesFromBills = (rawCardSpend?.recurringCardPayeesFromBills || [])
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  const spikyCardPayeesFromBills = (rawCardSpend?.spikyCardPayeesFromBills || [])
    .map((p) => String(p || '').trim())
    .filter(Boolean);

  const cardSpendModel: CardSpendModel = {
    recurringMonthlyCardSpend,
    recurringCardSpendByAccount: cardSpendByAccount,
    recurringCardBills: cardRecurringBills,
    plannedCardFundedSpendNext120Days,
    spikyCardSpendNext120Days,
    recurringCardSpendByMonth,
    plannedOrSpikyCardSpendByMonth,
    recurringPayees,
    spikyPayees,
    spendEstimationMethod,
    spendConfidence,
    cardSpendAlreadyInCashflow,
    activeColumnPresent,
    inactiveCardSpendRemoved,
    inactivePayeesRemoved,
    billsPaymentSourceColumnPresent,
    activeCardBillCount,
    billsRecurringCardBurden,
    billsSpikyCardBurdenNext120Days,
    historicalRecurringCardSpend,
    historicalSpikyCardSpendNext120Days,
    chosenRecurringCardBurden,
    chosenSpikyCardBurdenNext120Days,
    sourceDecision,
    spikySourceDecision,
    recurringCardBillsFromBills,
    upcomingCardBillsFromBills,
    recurringCardPayeesFromBills,
    spikyCardPayeesFromBills
  };

  /*
   * Step C: final effective monthly repayment.
   *   already_in_cashflow → use "before" figure (don't double-count)
   *   else                → subtract card spend, clamped at 0
   */
  const effectiveMonthlyRepayment = cardSpendAlreadyInCashflow
    ? surplusBeforeCardAdjustment
    : round2(Math.max(0, surplusBeforeCardAdjustment - recurringMonthlyCardSpend));

  const effectiveHelocRepaymentModel: EffectiveHelocRepaymentModel = {
    recurringMonthlySurplusBeforeCardAdjustment: surplusBeforeCardAdjustment,
    recurringMonthlyCardSpend,
    recurringMonthlyRepaymentCapacityEffective: effectiveMonthlyRepayment,
    cardSpendAlreadyInCashflow
  };

  // Safe-draw math now runs off the protected (adjusted + effective) figures.
  const safeDrawStrict = round2(
    adjustedUpfrontCash + effectiveMonthlyRepayment * targetPayoffMonths
  );
  const safeDrawUpper = round2(
    adjustedUpfrontCash + effectiveMonthlyRepayment * maxPayoffMonths
  );
  const working = (params.debts || [])
    .filter((d) => d && d.name && d.balance > 0.005 && String(d.type || '').toUpperCase() !== 'HELOC')
    .map((d) => ({
      name: d.name,
      type: String(d.type || ''),
      balance: round2(d.balance),
      aprPercent: Number(d.aprPercent) || 0,
      minimumPayment: round2(Number(d.minimumPayment) || 0)
    }));
  if (!working.length) return null;

  /**
   * Case-insensitive match on the debt's `type` string for the double-debt
   * warning logic. Treats any type containing "card" as a revolving card.
   */
  const isCardType = (t: string | undefined) =>
    typeof t === 'string' && /card/i.test(t);
  const cardTypeByName = new Map<string, boolean>();
  for (const d of working) cardTypeByName.set(d.name, isCardType(d.type));

  const eligible: HelocEligibleDebt[] = [];
  const ineligible: HelocIneligibleDebt[] = [];
  for (const d of working) {
    const spread = round2(d.aprPercent - helocRate);
    if (spread >= minSpread) {
      eligible.push({
        name: d.name,
        balance: d.balance,
        aprPercent: d.aprPercent,
        minimumPayment: d.minimumPayment,
        benefitSpread: spread,
        // benefit_score = interest dollars avoided per year on the moved balance
        benefitScore: round2((spread / 100) * d.balance)
      });
    } else {
      ineligible.push({
        name: d.name,
        balance: d.balance,
        aprPercent: d.aprPercent,
        reason:
          d.aprPercent <= helocRate
            ? 'Rate at or below HELOC — no benefit'
            : `Spread ${spread.toFixed(1)} pp below ${minSpread} pp threshold`
      });
    }
  }
  // Order by composite interest-dollar benefit score (spread × balance).
  // Tie-break on spread, then balance, for stable selection.
  eligible.sort(
    (a, b) =>
      b.benefitScore - a.benefitScore ||
      b.benefitSpread - a.benefitSpread ||
      b.balance - a.balance
  );

  if (!eligible.length) {
    return {
      status: 'not_needed',
      rateBenefitExists: false,
      helocRatePercent: helocRate,
      avgTargetAprPercent: 0,
      eligibleDebts: eligible,
      targetDebts: [],
      excludedEligibleDebts: [],
      ineligibleDebts: ineligible,
      recommendedDrawAmount: 0,
      drawCapApplied: 'none',
      upfrontCashNow,
      monthlyRecurringPaydownCapacity: monthlyRecurring,
      conditionalLumpPaydownCapacity: conditionalLump,
      conditionalLumpFrequencyNote: conditionalNote,
      monthlyRepaymentCapacity: monthlyRecurring,
      safeDrawStrict,
      safeDrawUpper,
      safeDrawCapacity: safeDrawStrict,
      targetPayoffMonths,
      maxPayoffMonths,
      futureExpenseReserve,
      futureExpenseItems,
      futureExpenseWindowDays,
      spendingBuffer,
      monthlySpendingEstimate,
      monthlySpendingIsDefault,
      adjustedUpfrontCash,
      cashProtectionWarning,
      monthlyNewSpendingEstimate,
      effectiveMonthlyRepayment,
      cardSpendModel,
      effectiveHelocRepaymentModel,
      doubleDebtWarning: false,
      doubleDebtSeverity: 'none',
      doubleDebtTrapModel: {
        trapRiskLevel: 'low',
        warningReasons: [],
        recurringCardSpend: recurringMonthlyCardSpend,
        recurringRepaymentCapacityEffective: effectiveMonthlyRepayment,
        spikyCardSpendNext120Days
      },
      repaymentPriority: 'heloc_first',
      estimatedMonthlyReduction: 0,
      paydownBehaviorNote: HELOC_PAYDOWN_BEHAVIOR_NOTE,
      payoffMonths: 0,
      interestSavedEstimate: 0,
      payoffMonthsWithHeloc: 0,
      payoffMonthsWithoutHeloc: 0,
      accelerationMonthsSaved: 0,
      slowPayoffWarning: false
    };
  }

  const totalEligibleBalance = round2(eligible.reduce((s, d) => s + d.balance, 0));

  /*
   * Status + draw cap order (spec):
   *   strict supports it → status = recommended, cap = min(total, strict)
   *   upper  supports it → status = optional,    cap = min(total, upper)
   *   else             → status = not_recommended,
   *                        cap = safeDrawStrict (partial, if > 0) else 0
   */
  let status: HelocStrategyStatus;
  let drawCap: number;
  let drawCapApplied: HelocStrategyModel['drawCapApplied'];
  if (totalEligibleBalance <= safeDrawStrict + 0.005) {
    status = 'recommended';
    drawCap = totalEligibleBalance;
    drawCapApplied = safeDrawStrict < totalEligibleBalance ? 'cash_capacity_strict' : 'none';
  } else if (totalEligibleBalance <= safeDrawUpper + 0.005) {
    status = 'optional';
    drawCap = totalEligibleBalance;
    drawCapApplied = 'cash_capacity_upper';
  } else {
    status = 'not_recommended';
    drawCap = Math.max(0, safeDrawStrict);
    drawCapApplied = drawCap > 0 ? 'cash_capacity_strict' : 'none';
  }

  // Tighten further with optional HELOC-limit safety / user cap.
  if (params.estimatedHelocLimit != null && params.estimatedHelocLimit > 0) {
    const safety = round2(params.estimatedHelocLimit * 0.4);
    if (safety < drawCap) {
      drawCap = safety;
      drawCapApplied = 'heloc_limit';
    }
  }
  if (params.userDefinedCap != null && params.userDefinedCap > 0 && params.userDefinedCap < drawCap) {
    drawCap = round2(params.userDefinedCap);
    drawCapApplied = 'user_cap';
  }
  drawCap = round2(Math.max(0, drawCap));

  // Greedy selection by composite benefit score. Always include a debt when
  // the running total + its balance stays within the cap, then stop — we do
  // NOT skip ahead to find smaller fits, because selection order is driven by
  // interest-dollar impact, not cap utilisation.
  const targets: HelocEligibleDebt[] = [];
  const excluded: HelocEligibleDebt[] = [];
  let runningTotal = 0;
  for (const d of eligible) {
    if (runningTotal + d.balance <= drawCap + 0.005) {
      targets.push(d);
      runningTotal = round2(runningTotal + d.balance);
    } else {
      excluded.push(d);
    }
  }
  const recommendedDraw = round2(runningTotal);

  /*
   * Residual-based payoff months. Month 0 applies `adjustedUpfrontCash`
   * (one-time, AFTER the cash-protection reserve is carved off) immediately
   * to the fresh HELOC balance. Months 1..N service the remaining residual
   * from `effectiveMonthlyRepayment` only (recurring minus new-spending
   * pressure) — upfront cash is NEVER treated as recurring and `upfrontCashNow`
   * is never used directly for payoff math.
   */
  const residualAfterUpfront = round2(Math.max(0, recommendedDraw - adjustedUpfrontCash));
  const payoffMonths =
    residualAfterUpfront <= 0.005
      ? 0
      : effectiveMonthlyRepayment > 0.005
      ? Math.ceil(residualAfterUpfront / effectiveMonthlyRepayment)
      : Number.POSITIVE_INFINITY;

  // Re-check status against the actual residual payoff curve. Strict/upper
  // selection above already biases this, but we must also downgrade when a
  // capped partial draw still cannot be serviced.
  if (recommendedDraw <= 0.005) {
    // We already passed the `!eligible.length` guard above, so a rate benefit
    // DOES exist — zero draw here means the safety layer (cash protection,
    // recurring paydown, future-expense reserve, etc.) forced the cap to 0.
    // That is "not_recommended" (rate benefit exists but unsafe to use now),
    // NOT "not_needed" (reserved for the no-rate-benefit case). Prevents the
    // contradictory "All active debts are at or below the HELOC rate" copy.
    status = 'not_recommended';
  } else if (!Number.isFinite(payoffMonths) || payoffMonths > maxPayoffMonths) {
    status = 'not_recommended';
  } else if (payoffMonths > targetPayoffMonths) {
    status = 'optional';
  } else if (status !== 'not_recommended') {
    // Already-uncontested recommended.
    status = 'recommended';
  }

  // Hard safety guardrail: if the cash-protection layer consumed all of the
  // upfront cash, no draw should be "recommended" regardless of how strong
  // recurring paydown looks. Preserves user liquidity over HELOC acceleration.
  if (recommendedDraw > 0.005 && adjustedUpfrontCash <= 0.005) {
    status = 'not_recommended';
  }

  /*
   * ── Double-debt trap detection ──────────────────────────────────────────
   *
   * Fires when a HELOC draw would clear card balances while ongoing card
   * spending is poised to rebuild them. Two severities:
   *
   *   critical → effective monthly repayment is ≤ 0 after card spend. The
   *              HELOC simply cannot be paid down on current cash flow.
   *   watch    → material card spend coexists with card-type targets AND
   *              either payoff exceeds the 9-month target OR effective
   *              capacity is less than `weakness_multiplier × card_spend`
   *              (i.e. not enough headroom to outpace new charges).
   *
   * A draw must be on the table (`recommendedDraw > 0`) for either to fire.
   */
  const anyCardTarget = targets.some((t) => cardTypeByName.get(t.name) === true);
  const materialCardSpend = recurringMonthlyCardSpend >= HELOC_MATERIAL_CARD_SPEND_PER_MONTH;
  const weakAgainstCardSpend =
    recurringMonthlyCardSpend > 0.005 &&
    effectiveMonthlyRepayment < recurringMonthlyCardSpend * HELOC_DOUBLE_DEBT_WEAKNESS_MULTIPLIER;
  const hasDraw = recommendedDraw > 0.005;
  let doubleDebtSeverity: DoubleDebtSeverity = 'none';
  if (hasDraw && materialCardSpend && effectiveMonthlyRepayment <= 0.005) {
    doubleDebtSeverity = 'critical';
  } else if (
    hasDraw &&
    materialCardSpend &&
    anyCardTarget &&
    (weakAgainstCardSpend ||
      !Number.isFinite(payoffMonths) ||
      payoffMonths > targetPayoffMonths)
  ) {
    doubleDebtSeverity = 'watch';
  }
  const doubleDebtWarning = doubleDebtSeverity !== 'none';

  /*
   * Guardrail: high card spend + weak effective capacity can't be
   * Recommended, regardless of upstream status. Downgrade:
   *   critical → not_recommended
   *   watch    → at most optional
   */
  if (doubleDebtSeverity === 'critical') {
    status = 'not_recommended';
  } else if (doubleDebtSeverity === 'watch' && status === 'recommended') {
    status = 'optional';
  }

  /*
   * ── Double-debt-trap model ─────────────────────────────────────────────
   * A coarser, outcome-oriented view on top of `doubleDebtSeverity`. Maps
   * severity to a 3-tier risk level and enumerates human-readable reasons
   * for the UI badge. Promoted one tier when near-term spiky card-funded
   * spend is also material — a signal that even if monthly math looks OK,
   * a tax/one-off charge is poised to blow the HELOC paydown off course.
   */
  const trapReasons: string[] = [];
  if (materialCardSpend) {
    trapReasons.push(
      `Recurring card spend is material (~${Math.round(recurringMonthlyCardSpend).toLocaleString('en-US')}/mo)`
    );
  }
  if (effectiveMonthlyRepayment <= 0.005) {
    trapReasons.push(
      'Effective recurring HELOC paydown capacity is zero or negative after card spend'
    );
  } else if (weakAgainstCardSpend) {
    trapReasons.push(
      'Effective recurring paydown is too small relative to ongoing card spend to outpace new charges'
    );
  }
  if (hasDraw && anyCardTarget && materialCardSpend) {
    trapReasons.push(
      'HELOC draw would clear card balances while ongoing card spending continues'
    );
  }
  if (
    hasDraw &&
    (!Number.isFinite(payoffMonths) || payoffMonths > targetPayoffMonths) &&
    materialCardSpend
  ) {
    trapReasons.push(
      `HELOC payoff exceeds the ${targetPayoffMonths}-month target window — card balances are likely to rebuild first`
    );
  }
  const spikyMaterial =
    spikyCardSpendNext120Days >= HELOC_MATERIAL_CARD_SPEND_PER_MONTH;
  if (spikyMaterial) {
    trapReasons.push(
      `Trailing spiky card-funded spend (~${Math.round(spikyCardSpendNext120Days).toLocaleString('en-US')} over last 4 months) is material`
    );
  }

  /*
   * ── Fundamental trap risk (independent of cash-slider state) ───────────
   *
   * The visible badge must not flip from "high" to "low" purely because the
   * user moved the Cash-to-use-now slider to 100% (which zeroes out the
   * current `recommendedDraw` and therefore `hasDraw`). The underlying
   * card-spend-vs-repayment-capacity relationship is what actually
   * determines whether a HELOC draw — current, hypothetical, or future —
   * would get outpaced by ongoing card spending.
   *
   * So we derive `trapRiskLevel` from the fundamental signals only:
   *   • recurring card spend is material
   *   • effective recurring repayment capacity after card spend
   *   • spiky near-term card burden
   *   • presence of any card-type debt that could rebuild
   *
   * `doubleDebtSeverity` continues to feed the *status downgrade* logic
   * (critical / watch), which legitimately depends on whether a draw is
   * currently on the table; that separation is intentional.
   */
  const anyCardDebt = Array.from(cardTypeByName.values()).some((v) => v === true);
  const fundamentalCritical =
    materialCardSpend && effectiveMonthlyRepayment <= 0.005;
  const fundamentalWatch =
    materialCardSpend && anyCardDebt && weakAgainstCardSpend;

  let trapRiskLevel: DoubleDebtTrapRiskLevel;
  if (fundamentalCritical) {
    trapRiskLevel = 'high';
  } else if (fundamentalWatch) {
    trapRiskLevel = spikyMaterial ? 'high' : 'medium';
  } else if (spikyMaterial && anyCardDebt) {
    trapRiskLevel = 'medium';
  } else {
    trapRiskLevel = 'low';
  }

  const doubleDebtTrapModel: DoubleDebtTrapModel = {
    trapRiskLevel,
    warningReasons: trapReasons,
    recurringCardSpend: recurringMonthlyCardSpend,
    recurringRepaymentCapacityEffective: effectiveMonthlyRepayment,
    spikyCardSpendNext120Days
  };

  const avgTargetApr =
    recommendedDraw > 0.005
      ? round2(targets.reduce((s, d) => s + d.aprPercent * d.balance, 0) / recommendedDraw)
      : 0;

  const payoffFraction = Math.min(
    1,
    (Number.isFinite(payoffMonths) ? payoffMonths : maxPayoffMonths) / maxPayoffMonths
  );
  const interestSaved = round2(
    targets.reduce(
      (s, d) => s + ((d.aprPercent - helocRate) / 100) * d.balance * payoffFraction,
      0
    )
  );

  /*
   * Avalanche "with vs without HELOC" comparison. Both simulations run on
   * `monthlyRecurring` only — we do NOT inflate recurring capacity with the
   * one-time upfront cash. For the HELOC path, upfront cash is applied at
   * Month 0 (balance reduced directly). For the without-HELOC path, upfront
   * is applied against the highest-APR debt at Month 0 so the comparison is
   * fair and not biased against HELOC.
   */
  const targetNames = new Set(targets.map((t) => t.name));
  const postTargetRemaining = working.filter((d) => !targetNames.has(d.name));
  const withHeloc = simulateAvalanchePayoffMonths({
    helocRatePercent: helocRate,
    helocBalance: residualAfterUpfront,
    remainingDebts: postTargetRemaining,
    monthlyCapacity: effectiveMonthlyRepayment
  });
  const withoutHelocDebts = working.map((d) => ({ ...d }));
  if (adjustedUpfrontCash > 0.005 && withoutHelocDebts.length) {
    // Highest-APR active debt absorbs the one-time cash (protected portion only).
    withoutHelocDebts.sort((a, b) => b.aprPercent - a.aprPercent);
    let remaining = adjustedUpfrontCash;
    for (const d of withoutHelocDebts) {
      if (remaining <= 0.005) break;
      const applied = Math.min(d.balance, remaining);
      d.balance = round2(Math.max(0, d.balance - applied));
      remaining = round2(remaining - applied);
    }
  }
  const withoutHeloc = simulateAvalanchePayoffMonths({
    helocRatePercent: 0,
    helocBalance: 0,
    remainingDebts: withoutHelocDebts,
    monthlyCapacity: effectiveMonthlyRepayment
  });
  const acceleration = Math.max(0, withoutHeloc - withHeloc);

  // First-full-month interest runs on the post-upfront residual balance.
  const month1Interest = round2((helocRate / 100 / 12) * residualAfterUpfront);
  const estimatedMonthlyReduction = round2(
    Math.max(0, effectiveMonthlyRepayment - month1Interest)
  );
  const slowPayoffWarning =
    !Number.isFinite(payoffMonths) || payoffMonths > maxPayoffMonths;

  return {
    status,
    rateBenefitExists: true,
    helocRatePercent: helocRate,
    avgTargetAprPercent: avgTargetApr,
    eligibleDebts: eligible,
    targetDebts: targets,
    excludedEligibleDebts: excluded,
    ineligibleDebts: ineligible,
    recommendedDrawAmount: recommendedDraw,
    drawCapApplied,
    upfrontCashNow,
    monthlyRecurringPaydownCapacity: monthlyRecurring,
    conditionalLumpPaydownCapacity: conditionalLump,
    conditionalLumpFrequencyNote: conditionalNote,
    monthlyRepaymentCapacity: monthlyRecurring,
    safeDrawStrict,
    safeDrawUpper,
    safeDrawCapacity: safeDrawStrict,
    targetPayoffMonths,
    maxPayoffMonths,
    futureExpenseReserve,
    futureExpenseItems,
    futureExpenseWindowDays,
    spendingBuffer,
    monthlySpendingEstimate,
    monthlySpendingIsDefault,
    adjustedUpfrontCash,
    cashProtectionWarning,
    monthlyNewSpendingEstimate,
    effectiveMonthlyRepayment,
    cardSpendModel,
    effectiveHelocRepaymentModel,
    doubleDebtWarning,
    doubleDebtSeverity,
    doubleDebtTrapModel,
    repaymentPriority: 'heloc_first',
    estimatedMonthlyReduction,
    paydownBehaviorNote: HELOC_PAYDOWN_BEHAVIOR_NOTE,
    payoffMonths: Number.isFinite(payoffMonths) ? payoffMonths : 0,
    interestSavedEstimate: interestSaved,
    payoffMonthsWithHeloc: withHeloc,
    payoffMonthsWithoutHeloc: withoutHeloc,
    accelerationMonthsSaved: acceleration,
    slowPayoffWarning
  };
}

/**
 * Build the 12-month HELOC acceleration plan.
 *
 * Month 0 draws `recommendedDrawAmount`, pays off the selected target debts,
 * and immediately applies `upfrontCashNow` (one-time cash from "Cash to use
 * now") against the fresh HELOC balance.
 *
 * Months 1..12 service the residual using `monthlyRecurringPaydownCapacity`
 * ONLY — the upfront cash is never assumed to recur, and conditional lump
 * income is surfaced informationally but never auto-applied.
 *
 * Non-target debts are carried at their post-month-0 balance for the
 * `remainingDebt` column only — payments to them are out of scope for this
 * advisory view and do not change the execution plan / waterfall.
 */
export function buildHelocExecutionPlan(model: HelocStrategyModel): HelocExecutionPlan {
  const rows: HelocPlanRow[] = [];
  const rateMonthly = (model.helocRatePercent || 0) / 100 / 12;
  // Post-cash-protection values drive ALL payoff math: raw `upfrontCashNow`
  // is only kept in the model for UI display.
  const monthlyRecurring = Math.max(0, model.effectiveMonthlyRepayment || 0);
  const adjustedUpfrontCash = Math.max(0, model.adjustedUpfrontCash || 0);
  const conditionalLump = Math.max(0, model.conditionalLumpPaydownCapacity || 0);
  const targetNames = new Set(model.targetDebts.map((t) => t.name));
  const nonTargetRemaining = round2(
    model.eligibleDebts
      .concat(
        model.ineligibleDebts.map((d) => ({
          name: d.name,
          balance: d.balance,
          aprPercent: d.aprPercent,
          minimumPayment: 0,
          benefitSpread: 0,
          benefitScore: 0
        }))
      )
      .filter((d) => !targetNames.has(d.name))
      .reduce((s, d) => s + d.balance, 0)
  );

  const recurringCapacityWarning = monthlyRecurring <= 0.005;

  if (model.recommendedDrawAmount <= 0.005) {
    return {
      rows: [],
      summary: {
        monthsToZeroHeloc: 0,
        totalInterestSaved: 0,
        accelerationMonthsSaved: model.accelerationMonthsSaved,
        monthlyCashApplied: monthlyRecurring,
        upfrontCashApplied: 0,
        conditionalLumpCapacity: conditionalLump,
        estimatedMonthlyReduction: 0,
        repaymentPriority: 'heloc_first',
        paydownBehaviorNote: HELOC_PAYDOWN_BEHAVIOR_NOTE,
        slowPayoffWarning: false,
        recurringCapacityWarning,
        adjustedUpfrontCash,
        effectiveMonthlyRepayment: monthlyRecurring,
        cashProtectionWarning: model.cashProtectionWarning,
        ongoingCardSpendMonthly: model.cardSpendModel.recurringMonthlyCardSpend,
        cardSpendAlreadyInCashflow: model.cardSpendModel.cardSpendAlreadyInCashflow,
        doubleDebtWarning: model.doubleDebtWarning,
        doubleDebtSeverity: model.doubleDebtSeverity,
        doubleDebtTrapRiskLevel: model.doubleDebtTrapModel.trapRiskLevel,
        doubleDebtWarningReasons: model.doubleDebtTrapModel.warningReasons.slice(),
        spikyCardSpendNext120Days: model.cardSpendModel.spikyCardSpendNext120Days
      }
    };
  }

  // Month 0: draw + immediate paydown from one-time cash (adjusted, not raw).
  const immediatePaydown = round2(Math.min(adjustedUpfrontCash, model.recommendedDrawAmount));
  const month0Ending = round2(Math.max(0, model.recommendedDrawAmount - immediatePaydown));
  rows.push({
    month: 0,
    startingHelocBalance: 0,
    drawAmount: model.recommendedDrawAmount,
    debtReplaced: model.targetDebts.map((d) => d.name),
    payment: immediatePaydown,
    immediatePaydownFromCashNow: immediatePaydown,
    recurringPaymentFromCash: 0,
    conditionalPayment: 0,
    interestAccrued: 0,
    endingHelocBalance: month0Ending,
    remainingDebt: round2(month0Ending + nonTargetRemaining),
    paymentBehaviorNote:
      immediatePaydown > 0.005 ? HELOC_MONTH0_BEHAVIOR_NOTE : HELOC_PAYDOWN_BEHAVIOR_NOTE
  });

  // Months 1..12: recurring monthly cash is the ONLY ongoing paydown source.
  let bal = month0Ending;
  let monthsToZero = bal <= 0.005 ? 0 : 0;
  for (let m = 1; m <= 12; m++) {
    const start = bal;
    const interest = round2(start * rateMonthly);
    const available = round2(start + interest);
    const recurringPayment = Math.min(monthlyRecurring, available);
    const ending = round2(Math.max(0, available - recurringPayment));
    const cleared = ending <= 0.005;
    rows.push({
      month: m,
      startingHelocBalance: start,
      drawAmount: 0,
      debtReplaced: [],
      payment: recurringPayment,
      immediatePaydownFromCashNow: 0,
      recurringPaymentFromCash: recurringPayment,
      conditionalPayment: 0,
      interestAccrued: interest,
      endingHelocBalance: ending,
      remainingDebt: round2(ending + nonTargetRemaining),
      paymentBehaviorNote: cleared
        ? HELOC_POST_CLEAR_BEHAVIOR_NOTE
        : HELOC_PAYDOWN_BEHAVIOR_NOTE
    });
    bal = ending;
    if (cleared) {
      monthsToZero = m;
      break;
    }
  }
  if (month0Ending <= 0.005) {
    // Upfront cash fully covered the draw — there is no residual to service.
    monthsToZero = 0;
  }
  const slowPayoffWarning = bal > 0.005;
  if (slowPayoffWarning) monthsToZero = rows[rows.length - 1].month;

  return {
    rows,
    summary: {
      monthsToZeroHeloc: monthsToZero,
      totalInterestSaved: model.interestSavedEstimate,
      accelerationMonthsSaved: model.accelerationMonthsSaved,
      monthlyCashApplied: monthlyRecurring,
      upfrontCashApplied: immediatePaydown,
      conditionalLumpCapacity: conditionalLump,
      estimatedMonthlyReduction: model.estimatedMonthlyReduction,
      repaymentPriority: 'heloc_first',
      paydownBehaviorNote: HELOC_PAYDOWN_BEHAVIOR_NOTE,
      slowPayoffWarning: slowPayoffWarning || model.slowPayoffWarning,
      recurringCapacityWarning,
      adjustedUpfrontCash,
      effectiveMonthlyRepayment: monthlyRecurring,
      cashProtectionWarning: model.cashProtectionWarning,
      ongoingCardSpendMonthly: model.cardSpendModel.recurringMonthlyCardSpend,
      cardSpendAlreadyInCashflow: model.cardSpendModel.cardSpendAlreadyInCashflow,
      doubleDebtWarning: model.doubleDebtWarning,
      doubleDebtSeverity: model.doubleDebtSeverity,
      doubleDebtTrapRiskLevel: model.doubleDebtTrapModel.trapRiskLevel,
      doubleDebtWarningReasons: model.doubleDebtTrapModel.warningReasons.slice(),
      spikyCardSpendNext120Days: model.cardSpendModel.spikyCardSpendNext120Days
    }
  };
}

function HelocStatusBadge({ status }: { status: HelocStrategyStatus }) {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.04em'
  };
  if (status === 'recommended') {
    return <span style={{ ...base, background: C.successBg, color: C.success }}>Recommended</span>;
  }
  if (status === 'optional') {
    return <span style={{ ...base, background: C.warnBg, color: C.warn }}>Optional</span>;
  }
  if (status === 'not_recommended') {
    return <span style={{ ...base, background: C.dangerBg, color: C.danger }}>Not recommended</span>;
  }
  return (
    <span style={{ ...base, background: '#f1f5f9', color: C.muted, border: `1px solid ${C.border}` }}>
      Not needed
    </span>
  );
}

/**
 * Renders the "Cash protection" block inside the HELOC strategy section.
 *
 * This is the human-readable face of the safety layer built in
 * `computeHelocStrategyModel`: it walks the user through upfront cash →
 * reserved expenses → spending buffer → remaining safe cash, and shows the
 * recurring-side adjustment (raw recurring → new spending → effective
 * recurring). No math happens here — it simply reads pre-computed fields.
 */
function CashProtectionPanel({ model }: { model: HelocStrategyModel }) {
  const hasExpenses = model.futureExpenseItems.length > 0;
  const hasNewSpending = model.monthlyNewSpendingEstimate > 0.005;
  const cardSpend = model.cardSpendModel.recurringMonthlyCardSpend;
  const hasCardSpend = cardSpend > 0.005;
  const cardSubtractsHere =
    hasCardSpend && !model.cardSpendModel.cardSpendAlreadyInCashflow;
  const surplusBefore =
    model.effectiveHelocRepaymentModel.recurringMonthlySurplusBeforeCardAdjustment;
  const showAdjustmentLine = hasNewSpending || cardSubtractsHere;
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: '#f0f9ff',
        border: '1px solid #bae6fd',
        marginBottom: 12,
        fontSize: 12,
        color: C.text,
        lineHeight: 1.55
      }}
    >
      <p
        style={{
          margin: '0 0 6px 0',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: C.muted
        }}
      >
        Cash protection
      </p>
      <p style={{ margin: '0 0 10px 0', color: C.muted }}>
        Only remaining cash is considered safe for HELOC. Upcoming expenses and
        a living-expense buffer are carved off first.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: '#ffffff',
            border: `1px solid ${C.border}`
          }}
        >
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
            UPFRONT CASH
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {currency(model.upfrontCashNow)}
          </div>
        </div>
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: '#ffffff',
            border: `1px solid ${C.border}`
          }}
        >
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
            UPCOMING EXPENSES{' '}
            <span style={{ textTransform: 'lowercase' }}>
              (next {model.futureExpenseWindowDays} days)
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>
            −{currency(model.futureExpenseReserve)}
          </div>
        </div>
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: '#ffffff',
            border: `1px solid ${C.border}`
          }}
        >
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
            SPENDING BUFFER (1.5×)
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>
            −{currency(model.spendingBuffer)}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
            {model.monthlySpendingIsDefault
              ? `Default ${currency(model.monthlySpendingEstimate)}/mo estimate`
              : `${currency(model.monthlySpendingEstimate)}/mo × 1.5`}
          </div>
        </div>
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: model.adjustedUpfrontCash > 0.005 ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${
              model.adjustedUpfrontCash > 0.005 ? C.success : C.danger
            }`
          }}
        >
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.08em' }}>
            REMAINING SAFE CASH
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: model.adjustedUpfrontCash > 0.005 ? C.success : C.danger
            }}
          >
            {currency(model.adjustedUpfrontCash)}
          </div>
        </div>
      </div>

      {hasExpenses ? (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4
            }}
          >
            Reserved expenses
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontVariantNumeric: 'tabular-nums' }}>
            {model.futureExpenseItems.map((e, idx) => (
              <li key={`${e.label}-${idx}`}>
                {e.label}
                {e.dueInDays != null ? (
                  <span style={{ color: C.muted }}> · in ~{e.dueInDays} days</span>
                ) : null}
                {' — '}
                <strong>{currency(e.amount)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showAdjustmentLine ? (
        <div style={{ margin: '10px 0 0 0' }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>Recurring paydown adjustment:</div>
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>
            {currency(model.monthlyRecurringPaydownCapacity)}/mo
            {hasNewSpending ? (
              <>
                {' '}<span style={{ color: C.muted }}>−</span>{' '}
                {currency(model.monthlyNewSpendingEstimate)}/mo{' '}
                <span style={{ color: C.muted }}>(new spending)</span>
              </>
            ) : null}
            {hasNewSpending && cardSubtractsHere ? (
              <>
                {' '}={' '}{currency(surplusBefore)}/mo{' '}
                <span style={{ color: C.muted }}>before card spend</span>
              </>
            ) : null}
            {cardSubtractsHere ? (
              <>
                {' '}<span style={{ color: C.muted }}>−</span>{' '}
                {currency(cardSpend)}/mo{' '}
                <span style={{ color: C.muted }}>(card spend, not in cashflow)</span>
              </>
            ) : null}
            {' '}={' '}<strong>{currency(model.effectiveMonthlyRepayment)}/mo</strong>{' '}
            <span style={{ color: C.muted }}>(effective)</span>
          </div>
        </div>
      ) : null}
      {hasCardSpend && model.cardSpendModel.cardSpendAlreadyInCashflow ? (
        <p style={{ margin: '6px 0 0 0', color: C.muted }}>
          Ongoing card spend (~{currency(cardSpend)}/mo) is already netted out
          of the planner&apos;s recurring surplus — no additional deduction
          applied here.
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Ongoing card spending" block: exposes the realism layer inputs (recurring
 * monthly card spend, whether it's already in cash flow, planned card-funded
 * spend in the next 120 days) so the user can see *why* the effective
 * repayment capacity and safe draw came out the way they did.
 *
 * Only renders when we have SOME signal (recurring spend, bills, or planned
 * card-funded expenses). Otherwise the UI stays uncluttered.
 */
function OngoingCardSpendPanel({
  model,
  isAdvanced = false
}: {
  model: HelocStrategyModel;
  /** Advanced/debug view — surfaces a "review these payees" prompt. */
  isAdvanced?: boolean;
}) {
  const m = model.cardSpendModel;
  const trap = model.doubleDebtTrapModel;
  const hasAny =
    m.recurringMonthlyCardSpend > 0.005 ||
    m.recurringCardBills.length > 0 ||
    m.recurringCardSpendByAccount.length > 0 ||
    m.plannedCardFundedSpendNext120Days > 0.005 ||
    m.spikyCardSpendNext120Days > 0.005 ||
    m.inactiveCardSpendRemoved > 0.005 ||
    m.billsRecurringCardBurden > 0.005 ||
    m.billsSpikyCardBurdenNext120Days > 0.005 ||
    m.recurringCardBillsFromBills.length > 0 ||
    m.upcomingCardBillsFromBills.length > 0 ||
    m.spendEstimationMethod === 'no_data';
  if (!hasAny) return null;

  const methodLabel: Record<CardSpendEstimationMethod, string> = {
    actual_recent: 'Recent actuals (last 3–6 months)',
    recurring_bills_only: 'Known recurring card-routed bills',
    explicit: 'Explicit planner estimate',
    conservative_default: 'Conservative default (no planner data)',
    no_data: 'No data — treated as $0 (likely underestimate)',
    bills_scheduled: 'Scheduled bills (INPUT - Bills, Payment Source = CREDIT_CARD)',
    combined_history_and_bills:
      'Combined: Cash Flow history + scheduled Bills (max of both)'
  };
  const confidenceColor: Record<CardSpendConfidence, string> = {
    high: C.success,
    medium: C.warn,
    low: C.danger
  };
  const noDataFallback = m.spendEstimationMethod === 'no_data';
  const trapColors: Record<DoubleDebtTrapRiskLevel, { bg: string; fg: string; label: string }> = {
    low: { bg: C.successBg, fg: C.success, label: 'Trap risk: low' },
    medium: { bg: C.warnBg, fg: C.warn, label: 'Trap risk: medium' },
    high: { bg: C.dangerBg, fg: C.danger, label: 'Trap risk: high' }
  };
  const trapBadge = trapColors[trap.trapRiskLevel];
  const showTrapBadge =
    trap.trapRiskLevel !== 'low' || trap.warningReasons.length > 0;

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 10,
        background: '#fff7ed',
        border: '1px solid #fed7aa',
        marginBottom: 12,
        fontSize: 12,
        color: C.text,
        lineHeight: 1.55
      }}
    >
      <p
        style={{
          margin: '0 0 6px 0',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: C.muted
        }}
      >
        Ongoing card spending
      </p>
      {/*
        Part 4 — methodology paragraph is now gated behind Show details.
        The default view just shows the numbers + trap badge; the "why"
        text belongs in the expanded view so the section stays scannable.
      */}
      {isAdvanced ? (
        <p style={{ margin: '0 0 10px 0', color: C.muted }}>
          Normal card-routed spending continues while the HELOC is repaid.
          We surface it here so you can see whether it&apos;s already baked
          into the planner&apos;s recurring surplus — and avoid the
          &ldquo;double-debt trap&rdquo; where cards rebuild before the
          HELOC is cleared.
        </p>
      ) : null}

      {showTrapBadge ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '8px 10px',
            borderRadius: 8,
            background: trapBadge.bg,
            border: `1px solid ${trapBadge.fg}22`,
            marginBottom: 10
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: trapBadge.fg
            }}
          >
            {trapBadge.label}
          </div>
          {trap.warningReasons.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 18, color: C.text, fontSize: 11 }}>
              {trap.warningReasons.map((r, idx) => (
                <li key={`trap-${idx}`}>{r}</li>
              ))}
            </ul>
          ) : (
            <span style={{ color: C.muted, fontSize: 11 }}>
              No active trap indicators — paydown math has enough headroom.
            </span>
          )}
        </div>
      ) : null}

      {/*
        Part 4 — default view shows the two headline numbers only:
          • recurring card burden
          • spiky card-funded charges next 120 days
        Derivation lines (cash-flow netting, effective paydown capacity,
        planned-card-funded 120-day total) move behind Show details so the
        section reads at a glance.
      */}
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontVariantNumeric: 'tabular-nums'
        }}
      >
        <li>
          Estimated recurring card spend:{' '}
          <strong>{currency(m.recurringMonthlyCardSpend)}</strong> / month
          {noDataFallback ? (
            <span style={{ color: C.muted }}> (no data — fill this in for a sharper estimate)</span>
          ) : null}
        </li>
        {m.spikyCardSpendNext120Days > 0.005 ? (
          <li>
            Spiky card-funded expenses (trailing 4 months):{' '}
            <strong>{currency(m.spikyCardSpendNext120Days)}</strong>
            <span style={{ color: C.muted }}>
              {' '}— proxy for likely near-term spikes (taxes, one-offs)
            </span>
          </li>
        ) : null}
        {isAdvanced ? (
          <>
            <li>
              Counted in cash flow already:{' '}
              <strong>{m.cardSpendAlreadyInCashflow ? 'Yes' : 'No'}</strong>
              <span style={{ color: C.muted }}>
                {m.cardSpendAlreadyInCashflow
                  ? ' — planner surplus already nets it out; not subtracted again'
                  : ' — subtracted from recurring repayment capacity to avoid over-leverage'}
              </span>
            </li>
            <li>
              Effective recurring HELOC paydown capacity:{' '}
              <strong>
                {currency(trap.recurringRepaymentCapacityEffective)}
              </strong>{' '}
              / month
              <span style={{ color: C.muted }}>
                {' '}(after new-spending pressure
                {m.cardSpendAlreadyInCashflow ? '' : ' and card spend'})
              </span>
            </li>
            <li>
              Planned card-funded spending next 120 days:{' '}
              <strong>{currency(m.plannedCardFundedSpendNext120Days)}</strong>
              <span style={{ color: C.muted }}>
                {' '}(informational — does not consume upfront cash)
              </span>
            </li>
          </>
        ) : null}
      </ul>

      {/* Part 4 — debug-only derivation note, hidden from default view. */}
      {isAdvanced && m.activeColumnPresent ? (
        <p
          style={{
            margin: '8px 0 0 0',
            fontSize: 11,
            color: C.muted,
            fontStyle: 'italic'
          }}
        >
          Inactive card expenses are excluded from recurring spend
          {m.inactiveCardSpendRemoved > 0.005 ? (
            <>
              {' '}— {currency(m.inactiveCardSpendRemoved)} removed from the
              trailing 6-month CREDIT_CARD total.
            </>
          ) : (
            '.'
          )}
        </p>
      ) : null}

      {isAdvanced && m.inactivePayeesRemoved.length > 0 ? (
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(30, 58, 95, 0.05)',
            border: `1px dashed ${C.border}`
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4
            }}
          >
            Top inactive card-spend payees removed
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 11
            }}
          >
            {m.inactivePayeesRemoved.slice(0, 5).map((entry, idx) => (
              <li key={`inactive-${entry.account}-${idx}`}>
                {entry.account} —{' '}
                <strong>{currency(entry.amount)}</strong> removed
              </li>
            ))}
          </ul>
          <p style={{ margin: '4px 0 0 0', fontSize: 11, color: C.muted }}>
            These rows were skipped because their <code>Active</code> cell
            was marked <code>NO</code>. Flip back to <code>YES</code> (or
            leave blank) if any are still live.
          </p>
        </div>
      ) : null}

      {isAdvanced && m.recurringCardBills.length > 0 ? (
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(30, 58, 95, 0.05)',
            border: `1px dashed ${C.border}`
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4
            }}
          >
            Review these large recurring card-spend payees for correctness
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
            {[...m.recurringCardBills]
              .sort((a, b) => (b.monthlyAmount || 0) - (a.monthlyAmount || 0))
              .slice(0, 3)
              .map((b, idx) => (
                <li key={`review-${b.label}-${idx}`}>
                  {b.label} — <strong>{currency(b.monthlyAmount)}</strong> / month
                </li>
              ))}
          </ul>
          <p style={{ margin: '4px 0 0 0', fontSize: 11, color: C.muted }}>
            Mis-classified charges here inflate recurring card spend and can wrongly
            push HELOC into &ldquo;not recommended&rdquo;.
          </p>
        </div>
      ) : null}

      {/*
        Part 4 — repeated per-payee / per-card breakdowns are debug detail,
        not scanning surface area. Hide them from the default view.
      */}
      {isAdvanced && m.recurringCardBills.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4
            }}
          >
            Recurring card bills
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontVariantNumeric: 'tabular-nums' }}>
            {m.recurringCardBills.map((b, idx) => (
              <li key={`${b.label}-${idx}`}>
                {b.label} — <strong>{currency(b.monthlyAmount)}</strong> / month
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isAdvanced && m.recurringCardSpendByAccount.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4
            }}
          >
            By card
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontVariantNumeric: 'tabular-nums' }}>
            {m.recurringCardSpendByAccount.map((a, idx) => (
              <li key={`${a.account}-${idx}`}>
                {a.account} — <strong>{currency(a.monthlyAverage)}</strong> / month
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(() => {
        /*
         * ── Scheduled card bills (Part 8) ──────────────────────────────
         * Only show the block when the workbook actually ships with the
         * Bills Payment Source column — otherwise legacy tabs would get
         * a confusing "0 scheduled card bills" note.
         *
         * Part 4 — this is a pure derivation block (history vs Bills, the
         * chosen-max decision, per-payee breakdowns). Hide from default
         * view; only surface in Show details / Debug.
         */
        if (!isAdvanced) return null;
        if (!m.billsPaymentSourceColumnPresent) return null;
        const decisionLabel: Record<CardSpendModel['sourceDecision'], string> = {
          history_dominated: 'Cash Flow history set the chosen burden',
          bills_dominated: 'Scheduled Bills set the chosen burden',
          tied: 'Cash Flow history + scheduled Bills tied; either feeds the chosen burden',
          history_only: 'Only Cash Flow history available',
          bills_only: 'Only scheduled Bills available',
          no_data: 'No card-burden data on either side'
        };
        return (
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(30, 58, 95, 0.05)',
              border: `1px dashed ${C.border}`
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 4
              }}
            >
              Scheduled card bills (INPUT - Bills)
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontVariantNumeric: 'tabular-nums',
                fontSize: 11
              }}
            >
              <li>
                Active CREDIT_CARD bills found:{' '}
                <strong>{m.activeCardBillCount}</strong>
              </li>
              <li>
                Historical recurring card spend:{' '}
                <strong>{currency(m.historicalRecurringCardSpend)}</strong> / mo
              </li>
              <li>
                Bills-based recurring card burden:{' '}
                <strong>{currency(m.billsRecurringCardBurden)}</strong> / mo
              </li>
              <li>
                <strong>Chosen recurring burden (max):</strong>{' '}
                <strong>{currency(m.chosenRecurringCardBurden)}</strong> / mo
                <span style={{ color: C.muted }}>
                  {' '}— {decisionLabel[m.sourceDecision]}
                </span>
              </li>
              <li>
                Historical spiky (trailing 4 mo):{' '}
                <strong>{currency(m.historicalSpikyCardSpendNext120Days)}</strong>
              </li>
              <li>
                Bills-based spiky (next 120 days):{' '}
                <strong>{currency(m.billsSpikyCardBurdenNext120Days)}</strong>
              </li>
              <li>
                <strong>Chosen spiky burden (max):</strong>{' '}
                <strong>{currency(m.chosenSpikyCardBurdenNext120Days)}</strong>
                <span style={{ color: C.muted }}>
                  {' '}— {decisionLabel[m.spikySourceDecision]}
                </span>
              </li>
            </ul>
            {m.recurringCardBillsFromBills.length > 0 ? (
              <div style={{ marginTop: 6 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 2
                  }}
                >
                  Recurring card payees (from Bills)
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 11
                  }}
                >
                  {m.recurringCardBillsFromBills.slice(0, 5).map((b, idx) => (
                    <li key={`bills-recur-${b.account}-${idx}`}>
                      {b.account} —{' '}
                      <strong>{currency(b.monthlyEquivalent)}</strong> / mo
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {m.upcomingCardBillsFromBills.length > 0 ? (
              <div style={{ marginTop: 6 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 2
                  }}
                >
                  Upcoming spiky card bills (next 120 days)
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 11
                  }}
                >
                  {m.upcomingCardBillsFromBills.slice(0, 5).map((b, idx) => (
                    <li key={`bills-spiky-${b.account}-${idx}`}>
                      {b.account} —{' '}
                      <strong>{currency(b.next120DayBurden)}</strong> due
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })()}

      {/* Part 4 — source methodology / confidence is debug detail. */}
      {isAdvanced ? (
        <p style={{ margin: '10px 0 0 0', color: C.muted, fontSize: 11 }}>
          Source: {methodLabel[m.spendEstimationMethod]} · Confidence:{' '}
          <strong style={{ color: confidenceColor[m.spendConfidence] }}>
            {m.spendConfidence}
          </strong>
        </p>
      ) : null}
    </div>
  );
}

function HelocStrategySection({
  snapshot,
  model,
  plan,
  isAdvanced = false,
  illustrativeForcedDraw = null
}: {
  snapshot: HelocAdvisorSnapshot;
  model: HelocStrategyModel;
  plan: HelocExecutionPlan;
  /** Advanced/debug view — enables extra review prompts in sub-panels. */
  isAdvanced?: boolean;
  /**
   * Post-cash illustrative ceiling, computed in the parent so the KPI
   * sub-line and Decision Box row share a single source of truth. When
   * `null`, fall back to `model.recommendedDrawAmount` (pre-cash subset).
   */
  illustrativeForcedDraw?: number | null;
}) {
  const [showPlan, setShowPlan] = useState(false);

  const headline = (() => {
    if (model.status === 'recommended') {
      return `Using HELOC could pay off high-interest debt immediately and shorten payoff by ${model.accelerationMonthsSaved} ${
        model.accelerationMonthsSaved === 1 ? 'month' : 'months'
      }.`;
    }
    if (model.status === 'optional') {
      return 'HELOC can improve payoff speed but requires consistent repayment.';
    }
    if (model.status === 'not_recommended') {
      // "not_recommended" now cleanly distinguishes two sub-cases from the
      // old headline — rate benefit IS present (eligibles exist) but cash-
      // flow / upcoming-obligations safety blocks a draw. Say so plainly
      // instead of the old "no benefit from a draw" which contradicted the
      // eligible-target list rendered directly below.
      return model.rateBenefitExists
        ? 'Some debts qualify by rate, but current cash flow and upcoming obligations make HELOC unsafe right now.'
        : 'Current cash flow or payoff timeline makes HELOC too risky right now.';
    }
    // status === 'not_needed' — reserved for the genuine no-rate-benefit case.
    return 'All active debts are at or below the HELOC rate — no benefit from a draw.';
  })();

  const hasTargets = model.targetDebts.length > 0;
  const hasIneligible = model.ineligibleDebts.length > 0;

  /*
   * Part 3 — in the default view we only surface ONE warning: the highest-
   * severity risk signal currently active. Everything else (and the full
   * set in Show details) is still rendered below — we just suppress the
   * lower-priority copies in standard view so the page reads cleanly.
   *
   * Priority (highest first):
   *   1. doubleDebtSeverity === 'critical'  (danger — repayment impossible)
   *   2. doubleDebtSeverity === 'watch'     (warn — repayment marginal)
   *   3. cashProtectionWarning              (warn — upcoming expense pressure)
   *
   * `excludedEligibleDebts` is an informational targeting panel, not a
   * warning, so it remains visible separately in both views.
   */
  type HelocWarningKey = 'doubleDebtCritical' | 'doubleDebtWatch' | 'cashProtection';
  const topWarningKey: HelocWarningKey | null =
    model.doubleDebtSeverity === 'critical'
      ? 'doubleDebtCritical'
      : model.doubleDebtSeverity === 'watch'
      ? 'doubleDebtWatch'
      : model.cashProtectionWarning
      ? 'cashProtection'
      : null;
  const showWarning = (key: HelocWarningKey): boolean =>
    isAdvanced || topWarningKey === key;

  return (
    <section
      style={{
        marginBottom: 24,
        padding: '18px 20px',
        borderRadius: 14,
        background: C.paper,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 2px rgba(15,23,42,0.05)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 8
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: C.muted
            }}
          >
            HELOC strategy
          </p>
          <HelocStatusBadge status={model.status} />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
          HELOC {model.helocRatePercent.toFixed(2)}%
          {hasTargets
            ? ` · avg target APR ${model.avgTargetAprPercent.toFixed(2)}%`
            : ''}
        </p>
      </div>

      <p style={{ margin: '4px 0 6px 0', fontSize: 13, color: C.text, fontWeight: 600, lineHeight: 1.55 }}>
        {headline}
      </p>

      {/*
        Part 5 — surface the two distinct questions the status conflates so
        the user can see, at a glance, that "rate benefit exists" and "safe
        to use now" are separate decisions. Only rendered for the
        not_recommended case (where the headline now hinges on both).
      */}
      {model.status === 'not_recommended' ? (
        <ul
          style={{
            margin: '0 0 12px 0',
            paddingLeft: 18,
            fontSize: 12,
            color: C.muted,
            lineHeight: 1.55
          }}
        >
          <li>
            Rate benefit exists:{' '}
            <strong style={{ color: model.rateBenefitExists ? C.success : C.muted }}>
              {model.rateBenefitExists ? 'Yes' : 'No'}
            </strong>
          </li>
          <li>
            Safe to use now:{' '}
            <strong style={{ color: C.danger }}>No</strong>
          </li>
        </ul>
      ) : (
        <div style={{ height: 8 }} />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: hasTargets || hasIneligible ? 16 : 0
        }}
      >
        {(() => {
          /*
           * Part 3 — the KPI that used to always read "Recommended draw" now
           * splits by status so the headline and the number agree:
           *
           *   recommended / optional  → "Recommended draw" = actual amount
           *   not_recommended, draw 0 → "Advised draw now"  = $0
           *                             (no surfaced ceiling when there is
           *                             literally no safe capacity at all)
           *   not_recommended, draw>0 → "Advised draw now"  = $0 primary,
           *                             with an "illustrative max if forced"
           *                             sub-line that shows the theoretical
           *                             ceiling without pretending it's advice.
           */
          const notRecommended = model.status === 'not_recommended';
          const notNeeded = model.status === 'not_needed';
          const drawZero = model.recommendedDrawAmount <= 0.005;
          const showAdvisedZero = notRecommended || drawZero;
          const kpiLabel = showAdvisedZero
            ? 'Advised draw now'
            : notNeeded
            ? 'Advised draw now'
            : 'Recommended draw';
          const kpiValue = showAdvisedZero ? currency(0) : currency(model.recommendedDrawAmount);
          const illustrativeValue =
            illustrativeForcedDraw != null
              ? illustrativeForcedDraw
              : model.recommendedDrawAmount;
          const kpiSub = showAdvisedZero
            ? notRecommended && illustrativeValue > 0.005
              ? `Illustrative max draw if forced: ${currency(illustrativeValue)} — not advice.`
              : notRecommended && model.recommendedDrawAmount > 0.005
              ? 'No safe HELOC draw is supported right now after this month’s cash paydown.'
              : notNeeded
              ? 'No eligible debts offer a rate benefit — HELOC not needed.'
              : 'No safe HELOC draw is supported right now.'
            : model.drawCapApplied === 'cash_capacity_strict'
            ? `Capped at ${model.targetPayoffMonths}-month safe payoff window`
            : model.drawCapApplied === 'cash_capacity_upper'
            ? `Extended to ${model.maxPayoffMonths}-month max payoff window`
            : model.drawCapApplied === 'heloc_limit'
            ? 'Capped at 40% of estimated HELOC limit'
            : model.drawCapApplied === 'user_cap'
            ? 'Capped at user-defined amount'
            : hasTargets
            ? 'Sum of eligible target balances'
            : 'No eligible targets';
          return <KpiCard label={kpiLabel} value={kpiValue} sub={kpiSub} subMuted />;
        })()}
        <KpiCard
          label="Payoff time"
          value={
            hasTargets && Number.isFinite(model.payoffMonths) && model.payoffMonths > 0
              ? `${model.payoffMonths} ${model.payoffMonths === 1 ? 'month' : 'months'}`
              : hasTargets && model.payoffMonths === 0 && model.recommendedDrawAmount > 0.005
              ? 'Any payoff would rely entirely on one-time cash (no recurring paydown capacity)'
              : '—'
          }
          sub={
            hasTargets
              ? model.effectiveMonthlyRepayment > 0
                ? `At ${currency(model.effectiveMonthlyRepayment)}/mo effective recurring paydown`
                : 'No effective recurring paydown assumed'
              : 'n/a'
          }
          subMuted
        />
        <KpiCard
          label="Interest saved (est.)"
          value={hasTargets ? currency(model.interestSavedEstimate) : '—'}
          sub={
            hasTargets
              ? `Debt-free ${model.payoffMonthsWithHeloc} mo vs ${model.payoffMonthsWithoutHeloc} mo without`
              : 'n/a'
          }
          subMuted
        />
      </div>

      {/*
        Part 4 — Repayment inputs, the full cash-protection derivation, and
        the safe-draw-capacity math are methodology/derivation detail, not
        decision surface. Hide them in the default view; they remain fully
        available under Show details / Debug Details (isAdvanced).
      */}
      {isAdvanced ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: '#f8fafc',
            border: `1px solid ${C.border}`,
            marginBottom: 12,
            fontSize: 12,
            color: C.text,
            lineHeight: 1.55
          }}
        >
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: C.muted
            }}
          >
            Repayment inputs
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            <li>
              Upfront cash available now:{' '}
              <strong>{currency(model.upfrontCashNow)}</strong>{' '}
              <span style={{ color: C.muted }}>(one-time, pre-protection)</span>
            </li>
            <li>
              Recurring monthly paydown capacity:{' '}
              <strong>{currency(model.monthlyRecurringPaydownCapacity)}</strong> / month
              {model.monthlyRecurringPaydownCapacity <= 0.005 ? (
                <span style={{ color: C.muted }}> (no trusted surplus — assumed 0)</span>
              ) : null}
            </li>
            <li>
              Optional variable-income paydown:{' '}
              <strong>{currency(model.conditionalLumpPaydownCapacity)}</strong>
              {model.conditionalLumpFrequencyNote ? (
                <span style={{ color: C.muted }}>
                  {' '}
                  — {model.conditionalLumpFrequencyNote}
                </span>
              ) : (
                <span style={{ color: C.muted }}> (informational only)</span>
              )}
            </li>
          </ul>
        </div>
      ) : null}

      {isAdvanced ? <CashProtectionPanel model={model} /> : null}

      <OngoingCardSpendPanel model={model} isAdvanced={isAdvanced} />

      {isAdvanced && hasTargets ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: '#f8fafc',
            border: `1px solid ${C.border}`,
            marginBottom: 12,
            fontSize: 12,
            color: C.text,
            lineHeight: 1.55
          }}
        >
          <p
            style={{
              margin: '0 0 6px 0',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: C.muted
            }}
          >
            Safe draw capacity
          </p>
          <p style={{ margin: 0 }}>
            <strong>Safe draw (strict, {model.targetPayoffMonths}-mo target):</strong>{' '}
            {currency(model.adjustedUpfrontCash)}{' '}
            <span style={{ color: C.muted }}>(remaining safe cash)</span> +{' '}
            {currency(model.effectiveMonthlyRepayment)}/mo{' '}
            <span style={{ color: C.muted }}>(effective recurring)</span> ×{' '}
            {model.targetPayoffMonths} ={' '}
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
              {currency(model.safeDrawStrict)}
            </strong>
          </p>
          <p style={{ margin: '2px 0 0 0', color: C.muted }}>
            <strong style={{ color: C.text }}>
              Safe draw (upper, {model.maxPayoffMonths}-mo max):
            </strong>{' '}
            {currency(model.safeDrawUpper)} · beyond this the HELOC is not
            recommended.
          </p>
          <p style={{ margin: '10px 0 0 0', color: C.muted }}>
            HELOC safety is based on one-time cash available now plus recurring
            monthly repayment capacity, minus upcoming expenses and a living-
            expense buffer. Only remaining cash is considered safe for HELOC.
          </p>
          {(model.drawCapApplied === 'cash_capacity_strict' ||
            model.drawCapApplied === 'cash_capacity_upper') && hasTargets ? (
            <p style={{ margin: '4px 0 0 0', color: C.muted }}>
              Only the highest-impact debts are selected within this limit.
            </p>
          ) : null}
        </div>
      ) : null}

      {model.cashProtectionWarning && showWarning('cashProtection') ? (
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: C.warnBg,
            border: `1px solid ${C.warn}`,
            color: C.text,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          <strong>Large upcoming expenses reduce safe HELOC capacity.</strong>{' '}
          Upcoming expenses ({currency(model.futureExpenseReserve)}) exceed{' '}
          {(HELOC_FUTURE_EXPENSE_WARNING_THRESHOLD * 100).toFixed(0)}% of your
          upfront cash — consider waiting until these are paid or funded from
          other sources before drawing.
        </div>
      ) : null}

      {/*
        Part 4 — explanatory note; already implied by the not_recommended
        status and zero advised draw in the KPI row. Keep it in Show details
        for people debugging why a draw that passed rate screening got
        blocked, but don't clutter the default view with it.
      */}
      {isAdvanced &&
      model.recommendedDrawAmount > 0.005 &&
      model.adjustedUpfrontCash <= 0.005 ? (
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: C.dangerBg,
            border: `1px solid ${C.danger}`,
            color: C.text,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          <strong>Upfront cash is fully reserved after protection.</strong>{' '}
          No safe cash remains to seed the Month-0 paydown — HELOC is not
          recommended until upcoming expenses clear or more cash becomes
          available.
        </div>
      ) : null}

      {model.doubleDebtSeverity === 'critical' && showWarning('doubleDebtCritical') ? (
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: C.dangerBg,
            border: `1px solid ${C.danger}`,
            color: C.text,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          <strong>
            Current recurring cash flow does not support HELOC repayment
            after normal card spending.
          </strong>{' '}
          At{' '}
          {currency(model.cardSpendModel.recurringMonthlyCardSpend)}
          /mo of ongoing card charges, no cash is left for HELOC paydown —
          the draw has been downgraded to not recommended.
        </div>
      ) : null}

      {model.doubleDebtSeverity === 'watch' && showWarning('doubleDebtWatch') ? (
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: C.warnBg,
            border: `1px solid ${C.warn}`,
            color: C.text,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          <strong>
            HELOC may eliminate current card balances, but ongoing card
            spending could rebuild balances before HELOC is repaid.
          </strong>{' '}
          Card spend of ~
          {currency(model.cardSpendModel.recurringMonthlyCardSpend)}
          /mo is close to (or above) the{' '}
          {currency(model.effectiveMonthlyRepayment)}/mo effective recurring
          paydown. Consider tightening card use during the HELOC window.
        </div>
      ) : null}

      {/*
        Part 4 — methodology note about the conservative fallback path; the
        advised-draw KPI already carries the headline. Show only in the
        advanced / debug view.
      */}
      {isAdvanced && model.monthlyRecurringPaydownCapacity <= 0.005 && hasTargets ? (
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: C.warnBg,
            border: `1px solid ${C.warn}`,
            color: C.text,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          <strong>
            Current recurring cash flow does not support fast HELOC repayment.
          </strong>{' '}
          Recommendation is conservative — the safe draw is limited to the
          one-time cash available now.
        </div>
      ) : null}

      {model.excludedEligibleDebts.length > 0 ? (() => {
        /*
         * Uniform wording rule: whenever "Advised HELOC draw now = $0"
         * (i.e. `not_recommended` status OR `recommendedDrawAmount = 0`),
         * collapse the excluded-eligibles block to the muted
         * "Eligible by rate, excluded by safety" label used elsewhere.
         *
         * The old `drawZero` gate only caught the exact-zero case, so
         * `not_recommended` with a non-zero illustrative ceiling still
         * showed the "draw is limited to stay within the 9-month safe
         * payoff window" copy — misleading, because the advised draw in
         * that state is $0 and nothing is actually being trimmed by the
         * window. We broaden the gate to cover both paths.
         *
         * The "Not all eligible debts are included — draw is limited…"
         * message only appears when the advisor actually recommends /
         * allows a positive draw AND had to trim lower-priority eligibles
         * to fit the safe window — the only case where that wording is
         * genuine new information.
         *
         * Advanced / debug view still surfaces the full bold prose for
         * diagnostic clarity, unchanged.
         */
        const advisedZero =
          model.status === 'not_recommended' || model.recommendedDrawAmount <= 0.005;
        const showBoldIntro = !advisedZero || isAdvanced;
        const intro = advisedZero
          ? 'Some debts qualify by rate, but no safe HELOC draw is supported right now.'
          : `Not all eligible debts are included — draw is limited to stay within the ${model.targetPayoffMonths}-month safe payoff window.`;
        return (
          <div
            role="note"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: advisedZero && !showBoldIntro ? '#f8fafc' : C.warnBg,
              border: `1px solid ${advisedZero && !showBoldIntro ? C.border : C.warn}`,
              color: C.text,
              marginBottom: 12,
              fontSize: 12,
              lineHeight: 1.55
            }}
          >
            {showBoldIntro ? (
              <p style={{ margin: 0, fontWeight: 700 }}>{intro}</p>
            ) : (
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: C.muted
                }}
              >
                Eligible by rate, excluded by safety
              </p>
            )}
            <ul
              style={{
                margin: '6px 0 0 0',
                paddingLeft: 18,
                color: C.muted,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {model.excludedEligibleDebts.map((d) => (
                <li key={`heloc-excluded-${d.name}`}>
                  <strong style={{ color: C.text }}>{d.name}</strong> — {currency(d.balance)} at{' '}
                  {d.aprPercent.toFixed(2)}% APR ({d.benefitSpread.toFixed(1)} pp over HELOC)
                </li>
              ))}
            </ul>
          </div>
        );
      })() : null}

      {hasTargets ? (
        <div style={{ marginBottom: hasIneligible ? 14 : 8 }}>
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: C.success
            }}
          >
            Recommended use
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: C.text, lineHeight: 1.7 }}>
            {model.targetDebts.map((d) => (
              <li key={`heloc-target-${d.name}`}>
                <strong>{d.name}</strong> — {currency(d.balance)} at {d.aprPercent.toFixed(2)}% APR
                <span style={{ color: C.muted, marginLeft: 6, fontSize: 12 }}>
                  ({d.benefitSpread.toFixed(1)} pp over HELOC)
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/*
        Part 4 — per-debt "not recommended" reason list is explanatory /
        per-payee detail; the user doesn't need it at a glance. Hide from
        the default view, keep in Show details.
      */}
      {isAdvanced && hasIneligible ? (
        <div style={{ marginBottom: 8 }}>
          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: C.muted
            }}
          >
            Not recommended
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
            {model.ineligibleDebts.slice(0, 8).map((d) => (
              <li key={`heloc-ineligible-${d.name}`}>
                {d.name} — {currency(d.balance)} at {d.aprPercent.toFixed(2)}%{' '}
                <span style={{ color: C.muted }}>· {d.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasTargets && plan.rows.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={() => setShowPlan((v) => !v)}
            aria-expanded={showPlan}
            style={{
              appearance: 'none',
              background: showPlan ? C.primary : '#ffffff',
              color: showPlan ? '#ffffff' : C.primary,
              border: `1px solid ${C.primary}`,
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.02em'
            }}
          >
            {showPlan ? 'Hide acceleration plan' : 'View acceleration plan'}
          </button>
          {showPlan ? (
            <HelocAccelerationPlan
              snapshot={snapshot}
              plan={plan}
              model={model}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function HelocAccelerationPlan({
  snapshot,
  plan,
  model
}: {
  snapshot: HelocAdvisorSnapshot;
  plan: HelocExecutionPlan;
  model: HelocStrategyModel;
}) {
  const { summary, rows } = plan;
  return (
    <div
      style={{
        marginTop: 14,
        padding: '14px 16px',
        borderRadius: 12,
        background: '#f8fafc',
        border: `1px solid ${C.border}`
      }}
    >
      <p
        style={{
          margin: '0 0 10px 0',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: C.muted
        }}
      >
        HELOC acceleration plan (12 months)
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 12
        }}
      >
        <KpiCard
          label="Debt-free in"
          value={`${summary.monthsToZeroHeloc} mo`}
          sub={`vs ${model.payoffMonthsWithoutHeloc} mo without HELOC`}
          subMuted
        />
        <KpiCard
          label="Interest saved (est.)"
          value={currency(summary.totalInterestSaved)}
          sub={`${summary.accelerationMonthsSaved} mo faster payoff`}
          subMuted
        />
        <KpiCard
          label="Using"
          value={snapshot.helocAccountName || 'HELOC'}
          sub={`Rate ${model.helocRatePercent.toFixed(2)}% · Draw ${currency(model.recommendedDrawAmount)}`}
          subMuted
        />
      </div>

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: C.paper,
          border: `1px solid ${C.border}`,
          marginBottom: 12
        }}
      >
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: C.muted
          }}
        >
          Paydown strategy
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
            marginBottom: 8
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Upfront cash applied (Month 0)
            </p>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: 18,
                fontWeight: 800,
                color: C.text,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {currency(summary.upfrontCashApplied)}
            </p>
            <p style={{ margin: '2px 0 0 0', fontSize: 10, color: C.muted }}>
              one-time (after cash protection)
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Recurring monthly cash applied
            </p>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: 18,
                fontWeight: 800,
                color: C.text,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {currency(summary.monthlyCashApplied)}
            </p>
            <p style={{ margin: '2px 0 0 0', fontSize: 10, color: C.muted }}>
              months 1+ (effective recurring)
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Expected payoff timeline
            </p>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: 18,
                fontWeight: 800,
                color: C.text,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {summary.monthsToZeroHeloc === 0 && model.recommendedDrawAmount > 0.005
                ? 'Month 0'
                : `${summary.monthsToZeroHeloc} ${summary.monthsToZeroHeloc === 1 ? 'month' : 'months'}`}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Est. monthly HELOC reduction
            </p>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: 18,
                fontWeight: 800,
                color: C.text,
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              {currency(summary.estimatedMonthlyReduction)}
            </p>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
          <strong style={{ color: C.text }}>Behavior:</strong> {summary.paydownBehaviorNote}.{' '}
          Upfront cash is applied once at Month 0; months 1+ are serviced by recurring cash only.
        </p>
        {summary.ongoingCardSpendMonthly > 0.005 ? (
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
            Model assumes normal credit-card spending continues after the
            HELOC draw at approximately{' '}
            <strong style={{ color: C.text }}>
              {currency(summary.ongoingCardSpendMonthly)}
            </strong>
            /month{' '}
            {summary.cardSpendAlreadyInCashflow
              ? '(already netted out of the recurring surplus).'
              : '(subtracted from the recurring surplus to keep repayment honest).'}
            {summary.spikyCardSpendNext120Days > 0.005 ? (
              <>
                {' '}Plus{' '}
                <strong style={{ color: C.text }}>
                  {currency(summary.spikyCardSpendNext120Days)}
                </strong>{' '}
                of spiky card-funded charges (trailing 4 mo or scheduled
                Bills, whichever is larger).
              </>
            ) : null}
            {(() => {
              /*
               * Explain when scheduled Bills (not just trailing history)
               * drove the chosen burden, so the reader understands why
               * the monthly figure may be bigger than recent actuals.
               */
              const cs = model.cardSpendModel;
              if (!cs.billsPaymentSourceColumnPresent) return null;
              const billsDroveRecurring =
                cs.sourceDecision === 'bills_dominated' ||
                cs.sourceDecision === 'bills_only';
              const billsDroveSpiky =
                cs.spikySourceDecision === 'bills_dominated' ||
                cs.spikySourceDecision === 'bills_only';
              if (!billsDroveRecurring && !billsDroveSpiky) return null;
              return (
                <>
                  {' '}These figures include scheduled obligations from{' '}
                  <code>INPUT - Bills</code> (Payment Source ={' '}
                  <code>CREDIT_CARD</code>), which currently{' '}
                  {billsDroveRecurring && billsDroveSpiky
                    ? 'dominate both recurring and spiky'
                    : billsDroveRecurring
                    ? 'dominate the recurring'
                    : 'dominate the spiky'}{' '}
                  card burden.
                </>
              );
            })()}
          </p>
        ) : null}
        {summary.conditionalLumpCapacity > 0.005 ? (
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
            Optional variable-income capacity{' '}
            <strong style={{ color: C.text }}>{currency(summary.conditionalLumpCapacity)}</strong>{' '}
            {model.conditionalLumpFrequencyNote
              ? `(${model.conditionalLumpFrequencyNote})`
              : ''}{' '}
            is tracked informationally and is NOT assumed to recur each month.
          </p>
        ) : null}
      </div>

      {summary.cashProtectionWarning && model.recommendedDrawAmount > 0.005 ? (
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: C.warnBg,
            border: `1px solid ${C.warn}`,
            color: C.text,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          <strong>Large upcoming expenses reduce safe HELOC capacity.</strong>{' '}
          Only {currency(summary.adjustedUpfrontCash)} of upfront cash is
          treated as safe after carving off upcoming expenses and the spending
          buffer. Month-0 paydown uses this protected figure — not the raw
          "Cash to use now" amount.
        </div>
      ) : null}

      {summary.doubleDebtSeverity === 'watch' && model.recommendedDrawAmount > 0.005 ? (
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: C.warnBg,
            border: `1px solid ${C.warn}`,
            color: C.text,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          <strong>Double-debt watch:</strong> cards cleared at Month 0 could
          rebuild before the HELOC is repaid given ongoing card spend of ~
          {currency(summary.ongoingCardSpendMonthly)}/mo. Tighten card use
          during the HELOC repayment window to keep the acceleration real.
        </div>
      ) : null}

      {summary.recurringCapacityWarning && model.recommendedDrawAmount > 0.005 ? (
        <div
          role="note"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: C.warnBg,
            border: `1px solid ${C.warn}`,
            color: C.text,
            marginBottom: 12,
            fontSize: 12,
            lineHeight: 1.55
          }}
        >
          <strong>
            Current recurring cash flow does not support fast HELOC repayment.
          </strong>{' '}
          Any residual left after the Month 0 upfront paydown will sit on the
          HELOC until recurring surplus improves.
        </div>
      ) : null}

      {summary.slowPayoffWarning ? (
        <div
          role="alert"
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: C.warnBg,
            border: `1px solid ${C.warn}`,
            color: C.text,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, color: C.warn, letterSpacing: '0.06em' }}>
            WARNING
          </span>
          <span style={{ fontSize: 12, lineHeight: 1.55, color: C.text }}>
            HELOC may not be repaid quickly enough given current cash flow. At{' '}
            {currency(summary.monthlyCashApplied)}/month recurring (plus{' '}
            {currency(summary.upfrontCashApplied)} upfront), the draw is not
            cleared within 12 months — consider a smaller draw, paying off
            fewer debts, or increasing recurring monthly capacity before
            proceeding.
          </span>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r) => {
          const isDrawMonth = r.month === 0;
          const paidOff = r.endingHelocBalance <= 0.005 && r.month > 0;
          return (
            <div
              key={`heloc-plan-row-${r.month}`}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(70px, 90px) 1fr',
                gap: 14,
                padding: '10px 12px',
                borderRadius: 10,
                background: C.paper,
                border: `1px solid ${paidOff ? 'rgba(13, 125, 77, 0.35)' : C.border}`
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: C.muted,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  alignSelf: 'center'
                }}
              >
                {isDrawMonth ? 'Month 0' : `Month ${r.month}`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: C.text,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  HELOC balance: {currency(r.startingHelocBalance)} → {currency(r.endingHelocBalance)}
                  {paidOff ? (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: C.success,
                        fontWeight: 800,
                        letterSpacing: '0.08em'
                      }}
                    >
                      PAID OFF
                    </span>
                  ) : null}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: C.muted,
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {isDrawMonth ? (
                    <>
                      Draw {currency(r.drawAmount)} →{' '}
                      {r.debtReplaced.length
                        ? `pays off ${r.debtReplaced.join(', ')}`
                        : 'applied to targets'}
                    </>
                  ) : (
                    <>
                      Recurring payment to HELOC: {currency(r.recurringPaymentFromCash)}/month{' '}
                      <span style={{ color: C.muted }}>(from your cash, not funded by HELOC)</span>{' '}
                      · Interest {currency(r.interestAccrued)}
                    </>
                  )}
                </p>
                {isDrawMonth && r.immediatePaydownFromCashNow > 0.005 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: C.success,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600
                    }}
                  >
                    Immediate paydown from cash now:{' '}
                    {currency(r.immediatePaydownFromCashNow)}{' '}
                    <span style={{ color: C.muted, fontWeight: 400 }}>
                      (one-time, not recurring)
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ margin: '12px 0 0 0', fontSize: 11, color: C.muted, lineHeight: 1.55 }}>
        Advisory view only. Payments to non-HELOC debts continue per the current plan; this
        section does not change the waterfall allocation or execute-now totals.
      </p>
    </div>
  );
}

function AutomationBlock({ title, body }: { title: string; body: string }) {
  return (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: '#f8fafc', padding: 16 }}>
      <h4
        style={{
          margin: '0 0 10px 0',
          paddingBottom: 8,
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: C.muted
        }}
      >
        {title}
      </h4>
      <pre style={{ margin: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: C.text }}>
        {body}
      </pre>
    </section>
  );
}

// —— Main —————————————————————————————————————————————————————————————————

type NormalizedMode = {
  presentation: ExecutionPresentationMode | null;
  isAdvancedView: boolean;
  strategy: PayoffStrategy | null;
};

/**
 * Parse the backend `summary.executionPlanMode` string into a
 * presentation + advanced-toggle + strategy triple. The server historically
 * emits a space/comma-separated list (e.g. `"aggressive automation"`).
 * Legacy single values map into the new simplified model:
 *   - `'operator'`   → presentation `'standard'`, advanced `true`
 *   - `'advanced'`   → presentation `'standard'`, advanced `true`
 *   - `'aggressive'` → strategy `'aggressive'`, advanced `true`
 */
function normalizeModeFromSummary(raw: string | undefined): NormalizedMode {
  const m = String(raw || '')
    .toLowerCase()
    .trim();
  if (!m) return { presentation: null, isAdvancedView: false, strategy: null };
  const tokens = m.split(/[\s,|]+/).filter(Boolean);

  let presentation: ExecutionPresentationMode | null = null;
  let isAdvancedView = false;
  let strategy: PayoffStrategy | null = null;

  for (const t of tokens) {
    if (t === 'automation') {
      presentation = 'automation';
    } else if (t === 'advanced' || t === 'operator') {
      // Legacy Operator / Advanced tokens are no longer a separate view; they
      // flip the Advanced audit-panel toggle while keeping the Standard view.
      isAdvancedView = true;
      if (presentation == null) presentation = 'standard';
    } else if (t === 'standard') {
      if (presentation == null) presentation = 'standard';
      if (strategy == null) strategy = 'standard';
    } else if (t === 'aggressive') {
      // Aggressive is a STRATEGY; legacy usage also implied audit panels on.
      strategy = 'aggressive';
      isAdvancedView = true;
      if (presentation == null) presentation = 'standard';
    }
  }

  return { presentation, isAdvancedView, strategy };
}

/* ──────────────────────────────────────────────────────────────────────── *
 * Compact standard-mode cards
 *
 * The default dashboard view is a "decision console", not a report. These
 * three tiny presentational components (CompactDecisionCard,
 * CompactHelocCard, CompactPaymentResult) are the only HELOC/decision
 * surfaces visible when details are collapsed. All diagnostic breakdowns
 * (KPI Total / Protected blocks, full HelocStrategySection, planned-
 * expense impact, extras waterfall, execution totals, decision-box
 * question list, snapshot table, next-3-months, watchouts list) are
 * rendered only when `showDetails` is true.
 *
 * These components do NOT derive any financial values on their own — all
 * numbers are pre-computed upstream from the canonical model
 * (`helocStrategyModel`, `displayExecutionPlan`, `data.liquidity`,
 * `data.snapshot`) so nothing here changes calculations.
 * ──────────────────────────────────────────────────────────────────────── */

function CompactDecisionCard({
  recommendation,
  why,
  caution
}: {
  recommendation: string;
  why: string;
  caution: string | null;
}) {
  return (
    <div style={{ ...shellStyle(), padding: '18px 20px' }}>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.14em',
          color: C.muted,
          textTransform: 'uppercase'
        }}
      >
        Decision
      </p>
      <p
        style={{
          margin: '10px 0 0 0',
          fontSize: 15,
          color: C.text,
          fontWeight: 800,
          lineHeight: 1.3
        }}
      >
        <span style={{ color: C.muted, fontWeight: 700 }}>Recommendation: </span>
        {recommendation}
      </p>
      <p
        style={{
          margin: '6px 0 0 0',
          fontSize: 13,
          color: C.text,
          fontWeight: 500,
          lineHeight: 1.45
        }}
      >
        <span style={{ color: C.muted, fontWeight: 700 }}>Why: </span>
        {why}
      </p>
      {caution ? (
        <p
          style={{
            margin: '6px 0 0 0',
            fontSize: 13,
            color: C.text,
            fontWeight: 500,
            lineHeight: 1.45
          }}
        >
          <span style={{ color: C.muted, fontWeight: 700 }}>Caution: </span>
          {caution}
        </p>
      ) : null}
    </div>
  );
}

function CompactHelocCard({
  statusLabel,
  status,
  reason,
  action
}: {
  statusLabel: string;
  status: HelocStrategyStatus;
  reason: string;
  action: string;
}) {
  const accent =
    status === 'recommended'
      ? C.primary
      : status === 'optional'
      ? '#0f766e'
      : status === 'not_recommended'
      ? C.danger
      : C.muted;
  const bg =
    status === 'recommended'
      ? 'rgba(30, 58, 95, 0.05)'
      : status === 'optional'
      ? 'rgba(15, 118, 110, 0.05)'
      : status === 'not_recommended'
      ? C.dangerBg
      : '#f8fafc';
  return (
    <div
      style={{
        ...shellStyle(),
        padding: '18px 20px',
        background: bg,
        border: `1px solid ${accent}`
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.14em',
          color: C.muted,
          textTransform: 'uppercase'
        }}
      >
        HELOC
      </p>
      <p style={{ margin: '10px 0 0 0', fontSize: 16, fontWeight: 800, color: C.text }}>
        Status: <span style={{ color: accent }}>{statusLabel}</span>
      </p>
      <p style={{ margin: '8px 0 0 0', fontSize: 13, color: C.text, lineHeight: 1.45 }}>
        <strong>Reason:</strong> {reason}
      </p>
      <p style={{ margin: '6px 0 0 0', fontSize: 13, color: C.text, lineHeight: 1.45 }}>
        <strong>Action:</strong> {action}
      </p>
    </div>
  );
}

type CompactPaymentResultRoleKey =
  | 'Cleanup'
  | 'Primary'
  | 'Secondary'
  | 'Overflow'
  | 'Other';

type CompactPaymentResultRow = {
  account: string;
  role: CompactPaymentResultRoleKey;
  action: 'Closed' | 'Paid down';
  remaining: number;
};

type CompactPaymentResultValue =
  | { kind: 'empty'; message: string }
  | { kind: 'table'; rows: CompactPaymentResultRow[]; overflowCount: number };

/**
 * User-facing role labels for the Payment result table.
 *
 * Internal bucket keys ('cleanup' / 'primary' / 'secondary' / 'overflow')
 * are preserved in logic, allocation, ordering, and the details view — only
 * the label shown in the compact standard-mode table is remapped so first-
 * time users aren't confronted with planner jargon. "Overflow" (spillover
 * from a focus-debt-capped waterfall) is shown as "Excess" so the label is
 * consistent with the allocation audit and extra-bucket cards in details.
 */
const PAYMENT_RESULT_ROLE_LABEL: Record<CompactPaymentResultRoleKey, string> = {
  Cleanup: 'Small balance',
  Primary: 'Focus debt',
  Secondary: 'Next debt',
  Overflow: 'Excess',
  Other: 'Debt'
};

function CompactPaymentResult({ value }: { value: CompactPaymentResultValue }) {
  const header = (
    <p
      style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.14em',
        color: C.muted,
        textTransform: 'uppercase'
      }}
    >
      Payment result
    </p>
  );

  if (value.kind === 'empty') {
    return (
      <div style={{ ...shellStyle(), padding: '18px 20px' }}>
        {header}
        <p style={{ margin: '10px 0 0 0', fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>
          {value.message}
        </p>
      </div>
    );
  }

  // Compact table styling: minimal borders, light row separators, role hint
  // rendered inline with the account name so columns stay scannable.
  const headerCellStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.muted,
    padding: '0 0 6px 0',
    textAlign: 'left'
  };
  const bodyCellStyle: React.CSSProperties = {
    fontSize: 13,
    color: C.text,
    padding: '8px 0',
    borderTop: `1px solid ${C.border}`
  };

  return (
    <div style={{ ...shellStyle(), padding: '18px 20px' }}>
      {header}
      <div style={{ marginTop: 10, overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'inherit'
          }}
        >
          <thead>
            <tr>
              <th style={headerCellStyle}>Account</th>
              <th style={{ ...headerCellStyle, width: '22%' }}>Action</th>
              <th style={{ ...headerCellStyle, width: '26%', textAlign: 'right' }}>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row) => (
              <tr key={row.account}>
                <td style={{ ...bodyCellStyle, fontWeight: 600 }}>
                  {row.account}{' '}
                  <span style={{ color: C.muted, fontWeight: 500 }}>
                    ({PAYMENT_RESULT_ROLE_LABEL[row.role]})
                  </span>
                </td>
                <td style={{ ...bodyCellStyle, fontWeight: 600, color: row.action === 'Closed' ? C.success : C.text }}>
                  {row.action}
                </td>
                <td style={{ ...bodyCellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {currency(row.remaining)}
                </td>
              </tr>
            ))}
            {value.overflowCount > 0 ? (
              <tr>
                <td
                  colSpan={3}
                  style={{
                    ...bodyCellStyle,
                    fontSize: 12,
                    color: C.muted,
                    fontStyle: 'italic'
                  }}
                >
                  +{value.overflowCount} more account{value.overflowCount === 1 ? '' : 's'} affected
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RollingDebtPayoffDashboard({
  data: dataProp,
  useDemoFallback = true,
  defaultPresentationMode = 'standard',
  onPresentationModeChange,
  defaultIsAdvancedView,
  onIsAdvancedViewChange,
  defaultPayoffStrategy = 'standard',
  onPayoffStrategyChange,
  className,
  style: rootStyle
}: RollingDebtPayoffDashboardProps) {
  const data = useMemo(() => {
    if (useDemoFallback === false && dataProp) {
      return dataProp as RollingDebtPayoffDashboardData;
    }
    return mergeWithDemo(dataProp);
  }, [dataProp, useDemoFallback]);

  /**
   * Presentation + payoff strategy are owned by the HTML host (Apps Script
   * segmented controls). The host re-mounts this component on every tab /
   * strategy change and passes its authoritative intent via
   * `defaultPresentationMode` / `defaultPayoffStrategy`. We used to also push
   * state back to the host via `onPresentationModeChange` / `onPayoffStrategyChange`
   * inside a post-mount effect, and re-derive state from `data.summary.executionPlanMode`
   * whenever the server payload updated. That created an echo loop: the server
   * echoes the previous request's tokens (e.g. `'operator'` for Advanced), the
   * effect pushed that back into the host, which flipped the active tab to
   * Advanced and kicked off another fetch. Fix: seed state from the host's
   * explicit defaults; only fall back to the server echo when no host intent is
   * available (e.g. standalone demo), and never push mode changes back to the
   * host from a mount effect.
   */
  const [presentationMode, setPresentationMode] = useState<ExecutionPresentationMode>(() => {
    if (defaultPresentationMode) return defaultPresentationMode;
    const fromSummary = normalizeModeFromSummary(data.summary.executionPlanMode);
    return fromSummary.presentation != null ? fromSummary.presentation : 'standard';
  });

  const [isAdvancedView, setIsAdvancedView] = useState<boolean>(() => {
    if (typeof defaultIsAdvancedView === 'boolean') return defaultIsAdvancedView;
    const fromSummary = normalizeModeFromSummary(data.summary.executionPlanMode);
    return fromSummary.isAdvancedView;
  });

  const [payoffStrategy, setPayoffStrategy] = useState<PayoffStrategy>(() => {
    if (defaultPayoffStrategy) return defaultPayoffStrategy;
    const fromSummary = normalizeModeFromSummary(data.summary.executionPlanMode);
    return fromSummary.strategy != null ? fromSummary.strategy : 'standard';
  });

  // Keep linter references to the host callbacks and unused setters without
  // invoking them in a mount effect (see comment above for why the echo-back
  // effect was removed). These are available for future in-React controls.
  void setPresentationMode;
  void setPayoffStrategy;
  void onPresentationModeChange;
  void onPayoffStrategyChange;
  void onIsAdvancedViewChange;

  /**
   * Deployable Max = max(0, totalCash − reserve − buffer − nearTermHold − unmappedCardRiskHold).
   * Per-account min-buffer logic stays in the cash bridge audit (not the "Buffer" KPI).
   */
  const deployableMax = useMemo(() => {
    const totalCash = Number(data.liquidity.totalCash) || 0;
    const reserve = Number(data.liquidity.reserveTarget) || 0;
    const buffer = Number(data.liquidity.buffer) || 0;
    const nearTerm = Number(data.liquidity.nearTermPlannedCashHold) || 0;
    const unmappedRisk = Number(data.liquidity.unmappedCardRiskHold) || 0;
    return Math.max(0, round2(totalCash - reserve - buffer - nearTerm - unmappedRisk));
  }, [
    data.liquidity.totalCash,
    data.liquidity.reserveTarget,
    data.liquidity.buffer,
    data.liquidity.nearTermPlannedCashHold,
    data.liquidity.unmappedCardRiskHold
  ]);

  /**
   * Default for Cash To Use Now when no local/user value exists: Deployable max.
   * Per the month-0 cash model, this input is user-owned and must NOT be prefilled
   * from backend execute-now (which may reflect older planner constants or prior
   * allocations); the user picks how much of Deployable max to actually deploy
   * this month, and Execute now is then computed as min(input, Deployable max).
   */
  const suggestedCashToUse = useMemo(() => deployableMax, [deployableMax]);

  /** Persist per anchor month so the user's chosen amount survives reloads within a plan. */
  const persistKey = useMemo(() => {
    const anchor = (data.summary.anchorMonth || 'default').replace(/\s+/g, '_');
    return `rolling-dashboard:cashToUseNow:${anchor}`;
  }, [data.summary.anchorMonth]);

  const [cashToUseNowInput, setCashToUseNowInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(persistKey);
        if (stored != null && stored.trim() !== '') return stored;
      } catch {
        // ignore storage failures (private mode, quota, etc.)
      }
    }
    return String(Math.round(suggestedCashToUse));
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(persistKey, cashToUseNowInput);
    } catch {
      // ignore storage failures
    }
  }, [persistKey, cashToUseNowInput]);

  /** Reset stored value to the freshly computed suggestion when the plan's anchor changes. */
  useEffect(() => {
    setCashToUseNowInput((current) => {
      const parsed = parseUserNumber(current);
      if (parsed == null) return String(Math.round(suggestedCashToUse));
      return current;
    });
    // Only run when anchor month (persistKey) changes to avoid fighting the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  const cashToUseNowParsed = useMemo(() => parseUserNumber(cashToUseNowInput), [cashToUseNowInput]);
  const cashToUseNowRaw = cashToUseNowParsed != null ? cashToUseNowParsed : suggestedCashToUse;
  const executeNow = round2(Math.max(0, Math.min(cashToUseNowRaw, deployableMax)));
  const exceedsDeployable = cashToUseNowRaw > deployableMax + 0.01;

  const isAutomation = presentationMode === 'automation';
  // Audit/debug panels are now controlled by the independent Advanced toggle,
  // not by a separate presentation mode. Automation view ignores this toggle
  // (it renders plain-text blocks only).
  const isAdvanced = isAdvancedView && !isAutomation;
  const isAggressiveStrategy = payoffStrategy === 'aggressive';
  void setIsAdvancedView;

  /*
   * Standard vs details separation.
   *
   * `isAdvanced` (derived from the plan summary mode) already flags
   * operator/advanced/aggressive plans as "details on". For everyday
   * standard-mode plans we want a cleaner decision-console by default,
   * with a user-facing "Show details" button that expands the full
   * diagnostic report inline. `showDetails` is the single gate every
   * section below reads.
   *
   * Diagnostic sections (KPI Total / Protected breakdowns, full
   * HelocStrategySection, planned-expense impact, already-paid / minimums
   * lists, extras waterfall, execution totals, future/conditional cash,
   * full decision box, post-payment snapshot, next-3-months, watchouts
   * list) render only when `showDetails === true`. The top cash
   * execution row (Available: Safe to use → Cash to use now → Planned
   * payment) plus the three compact cards (Decision, HELOC, Result)
   * and an optional one-line watchout are always visible.
   *
   * Automation presentation ignores this entirely — it emits flat text
   * blocks regardless of toggle state.
   */
  const [showDetailsExpanded, setShowDetailsExpanded] = useState(false);
  const showDetails = isAdvanced || showDetailsExpanded;

  /**
   * Single canonical display-execution-plan, derived entirely from:
   *   1. the raw planner payload  (`data.extraPayments`, `data.snapshot`, …)
   *   2. `deployableMax`          (from liquidity math)
   *   3. `userCashToUseNowInput`  (`cashToUseNowRaw`)
   *   4. `executeNow = min(userCashToUseNowInput, deployableMax)`
   *
   * Every visual section (bucket cards, snapshot, execution totals, aggressive panel,
   * allocation audit drift banner, automation/debug blocks) must read from this object.
   * Do NOT read raw backend allocations for render — those are only inputs to this memo.
   */
  const displayExecutionPlan = useMemo(() => {
    const extras = redistributeExtrasToBudget(data.extraPayments, executeNow, data.snapshot);
    const snapshot = redistributeSnapshotRows(data.snapshot, data.extraPayments, extras);

    const cleanupSum = round2(extras.cleanup.reduce((s, l) => s + (Number(l.amount) || 0), 0));
    const primarySum = round2(extras.primary.reduce((s, l) => s + (Number(l.amount) || 0), 0));
    const secondarySum = round2(extras.secondary.reduce((s, l) => s + (Number(l.amount) || 0), 0));
    const overflowSum = round2(extras.overflow.reduce((s, l) => s + (Number(l.amount) || 0), 0));
    const extraTotal = round2(cleanupSum + primarySum + secondarySum + overflowSum);

    const snapshotPaymentTotal = round2(
      snapshot.reduce((s, r) => s + (Number(r.paymentAppliedNow) || 0), 0)
    );

    const snapshotSummary = data.snapshotSummary
      ? {
          accountsClosedNow: snapshot.filter(
            (r) => r.balanceAfterNow <= 0.01 + 1e-9 && r.paymentAppliedNow > 0.005
          ).length,
          deployedNow: snapshotPaymentTotal,
          primaryReduced: primarySum
        }
      : undefined;

    const executionTotals = {
      fromCash: executeNow,
      fromHeloc: Number(data.executionTotals.fromHeloc) || 0,
      totalNow: round2(executeNow + (Number(data.executionTotals.fromHeloc) || 0)),
      conditionalLater: Number(data.executionTotals.conditionalLater) || 0
    };

    const aggressiveMeta = data.aggressiveMeta
      ? (() => {
          const postCleanupPool = round2(primarySum + secondarySum + overflowSum);
          const remainder = round2(primarySum + secondarySum);
          const sharePct = remainder > 0.005 ? Math.round((100 * primarySum) / remainder) : 0;
          return {
            ...data.aggressiveMeta,
            postCleanupExtraPool: postCleanupPool,
            primaryAllocated: primarySum,
            primaryShareOfRemainingPct: sharePct,
            primaryBelow90: sharePct < 90
          };
        })()
      : undefined;

    /**
     * Strategy comparison — what would Standard (75% primary) have allocated
     * given the same post-cleanup pool, versus the Aggressive target (90%) and
     * the actual primary/secondary amounts? Used to make the Aggressive strategy
     * visibly auditable even when cleanup consumed the budget or the primary
     * target was balance-capped (in which case both strategies converge).
     * Secondary is "secondary bucket + overflow" because overflow is the spill
     * from a primary-capped waterfall — both are part of the non-primary pool.
     */
    const cmpPostCleanupPool = round2(primarySum + secondarySum + overflowSum);
    const cmpStdPrimaryTarget = round2(STRATEGY_PRIMARY_FRACTION_STANDARD * cmpPostCleanupPool);
    const cmpStdSecondaryTarget = round2(cmpPostCleanupPool - cmpStdPrimaryTarget);
    const cmpAggPrimaryTarget = round2(STRATEGY_PRIMARY_FRACTION_AGGRESSIVE * cmpPostCleanupPool);
    const cmpAggSecondaryTarget = round2(cmpPostCleanupPool - cmpAggPrimaryTarget);
    const cmpActualPrimary = primarySum;
    const cmpActualSecondary = round2(secondarySum + overflowSum);
    const strategyChangedAllocations =
      Math.abs(cmpActualPrimary - cmpStdPrimaryTarget) > 0.01;
    let strategyNoChangeReason: StrategyNoChangeReason | null = null;
    if (!strategyChangedAllocations) {
      if (cmpPostCleanupPool <= 0.01) {
        strategyNoChangeReason = 'cleanup_consumed_budget';
      } else if (cmpActualSecondary <= 0.01) {
        strategyNoChangeReason = 'no_secondary_pool';
      } else if (cmpActualPrimary < cmpAggPrimaryTarget - 0.01) {
        strategyNoChangeReason = 'primary_balance_capped';
      } else {
        strategyNoChangeReason = 'other';
      }
    }
    const strategyComparison: StrategyComparison = {
      postCleanupPool: cmpPostCleanupPool,
      stdPrimaryTarget: cmpStdPrimaryTarget,
      stdSecondaryTarget: cmpStdSecondaryTarget,
      aggPrimaryTarget: cmpAggPrimaryTarget,
      aggSecondaryTarget: cmpAggSecondaryTarget,
      actualPrimary: cmpActualPrimary,
      actualSecondary: cmpActualSecondary,
      strategyChangedAllocations,
      strategyNoChangeReason,
      primaryReachedAggressiveTarget: cmpActualPrimary >= cmpAggPrimaryTarget - 0.01
    };

    const executeNowVsBucket = round2(executeNow - extraTotal);
    const executeNowVsSnapshot = round2(executeNow - snapshotPaymentTotal);
    const bucketVsSnapshot = round2(extraTotal - snapshotPaymentTotal);
    const isConsistent =
      Math.abs(executeNowVsBucket) <= 0.01 &&
      Math.abs(executeNowVsSnapshot) <= 0.01 &&
      Math.abs(bucketVsSnapshot) <= 0.01;

    /**
     * When the user requests MORE cash than the backend's pre-allocated waterfall total,
     * the client cannot invent new per-account allocations (we have no per-account balances
     * here). Call this out as "requested but unallocated" so the drift banner stays accurate.
     */
    const unallocatedHeadroom = Math.max(0, round2(executeNow - extraTotal));

    return {
      extras,
      cleanupSum,
      primarySum,
      secondarySum,
      overflowSum,
      extraTotal,
      snapshot,
      snapshotSummary,
      snapshotPaymentTotal,
      executionTotals,
      aggressiveMeta,
      strategyComparison,
      executeNow,
      deployableMax,
      cashToUseNowInput: cashToUseNowRaw,
      exceedsDeployable,
      unallocatedHeadroom,
      validation: {
        executeNowVsBucket,
        executeNowVsSnapshot,
        bucketVsSnapshot,
        isConsistent
      }
    };
  }, [
    data.extraPayments,
    data.snapshot,
    data.snapshotSummary,
    data.executionTotals.fromHeloc,
    data.executionTotals.conditionalLater,
    data.aggressiveMeta,
    executeNow,
    deployableMax,
    cashToUseNowRaw,
    exceedsDeployable
  ]);

  // Backwards-compatible aliases so the rest of the render tree stays readable. These are
  // *views* into the single canonical `displayExecutionPlan` above — they never diverge.
  const displayExtras = displayExecutionPlan.extras;
  const displaySnapshot = displayExecutionPlan.snapshot;
  const displaySnapshotSummary = displayExecutionPlan.snapshotSummary;
  const displayExecutionTotals = displayExecutionPlan.executionTotals;
  const displayAggressiveMeta = displayExecutionPlan.aggressiveMeta;
  const extraTotal = displayExecutionPlan.extraTotal;
  const cleanupSum = displayExecutionPlan.cleanupSum;
  const primarySum = displayExecutionPlan.primarySum;
  const secondarySum = displayExecutionPlan.secondarySum;

  const watchTop3 = useMemo(() => data.watchouts.slice(0, 3).map((w) => shortenWatchout(w)), [data.watchouts]);

  /**
   * HELOC advisor derived model — pure function of the snapshot + the user's
   * Cash-to-use-now. Null when the backend did not emit an advisor snapshot
   * (older plan payloads) so the UI can cleanly hide the section.
   */
  /*
   * HELOC upfront-cash wiring — semantic fix.
   *
   * The advisor expects `upfrontCashNow` = one-time cash that is still
   * available at Month 0 to seed HELOC paydown. Previously we passed the
   * user's selected "Cash to use now" (`cashToUseNowRaw`) directly, which
   * is the OPPOSITE signal: that cash has been committed to pay current
   * debts, so it is NOT available to service/pre-pay a hypothetical HELOC.
   *
   * Symptom before the fix: pushing the cash slider UP increased the
   * "Illustrative max draw if forced" — because the advisor thought the
   * slider meant "more cash for the HELOC".
   *
   * Fix: feed the advisor the remaining safe liquidity AFTER the planned
   * cash payment — `deployableMax − executeNow` — clamped to ≥ 0. Now:
   *   • 0 cash selected   → full deployableMax available → largest draw
   *   • partial selected  → smaller remaining cash → smaller draw
   *   • max selected      → 0 remaining → 0 / near-0 draw
   *
   * `executeNow` (already capped at `deployableMax`) is used instead of
   * the raw input so users who type a value over Safe-to-use don't flip
   * the sign of the remaining cash.
   */
  const helocUpfrontCashRemaining = useMemo(
    () => Math.max(0, round2(deployableMax - executeNow)),
    [deployableMax, executeNow]
  );

  const helocStrategyModel = useMemo(() => {
    const snap = data.helocAdvisor;
    if (!snap || !snap.debts || !snap.debts.length) return null;
    return computeHelocStrategyModel({
      debts: snap.debts.map((d) => ({
        name: d.name,
        type: d.type,
        balance: d.balance,
        aprPercent: d.aprPercent,
        minimumPayment: d.minimumPayment
      })),
      helocRatePercent: snap.helocAprPercent,
      minSpreadPercent: snap.minSpreadPercent,
      // One-time cash the HELOC can actually lean on at Month 0 = deployable
      // safe liquidity that is NOT already committed to this month's planned
      // debt payment. See the block comment above for why this is
      // `deployableMax − executeNow` and not `cashToUseNowRaw`.
      upfrontCashNow: helocUpfrontCashRemaining,
      // Recurring monthly paydown must come from a trusted planner signal.
      // Fall back to 0 when the snapshot has no surplus figure — this keeps
      // recommendations conservative for users with weak/negative cash flow.
      monthlyRecurringPaydown: snap.monthlyRecurringPaydownCapacity ?? 0,
      conditionalLumpPaydown: snap.conditionalLumpPaydownCapacity ?? 0,
      conditionalLumpFrequencyNote: snap.conditionalLumpFrequencyNote,
      // Cash-protection / safety-buffer inputs. Upcoming expenses and spending
      // drive the adjusted-upfront-cash and effective-recurring figures; all
      // default conservatively (no reserves) when the planner omits them —
      // except `monthlySpendingEstimate`, which falls back to a hard default
      // inside `computeHelocStrategyModel` so the buffer is never zero.
      upcomingExpenses: snap.upcomingExpenses,
      monthlySpendingEstimate: snap.monthlySpendingEstimate,
      monthlyNewSpendingEstimate: snap.monthlyNewSpendingEstimate,
      // Realism layer: ongoing card spending (drives effective-repayment
      // adjustment and double-debt warning). Pass through as-is; the
      // advisor tolerates `undefined` → "no data" / low confidence.
      cardSpend: snap.cardSpend,
      estimatedHelocLimit: snap.estimatedHelocLimit,
      userDefinedCap: snap.userDefinedCap
    });
  }, [data.helocAdvisor, helocUpfrontCashRemaining]);

  const helocExecutionPlan = useMemo(
    () => (helocStrategyModel ? buildHelocExecutionPlan(helocStrategyModel) : null),
    [helocStrategyModel]
  );

  /**
   * Illustrative "max draw if forced" — rebuilt against a POST-CASH debt
   * subset so the sub-line on the HELOC KPI and the Decision Box row stay
   * internally consistent.
   *
   * Why this exists:
   *   The main `computeHelocStrategyModel` call above is fed post-cash
   *   liquidity (`helocUpfrontCashRemaining`) but pre-cash debt balances
   *   (`snap.debts`). That asymmetry is deliberate for the main status /
   *   recommendation path — changing the advisor's debt input would flip
   *   `totalEligibleBalance` and therefore the status decision. But it
   *   produces a stale subset for the illustrative ceiling: a debt that
   *   this month's cash waterfall already paid down can still show up at
   *   its full pre-cash balance inside the greedy selection, and at
   *   intermediate cash levels (e.g. 25%) that's what produced a
   *   seemingly-off "$799" value — the cap was right, the subset was
   *   stale.
   *
   * What this memo does:
   *   1. Starts from `model.eligibleDebts` (the pre-cash rate-eligible set).
   *   2. Reduces each debt by its `paymentAppliedNow` in
   *      `displayExecutionPlan.snapshot`, which is the canonical post-cash
   *      balance the user actually sees in the Month-0 panel.
   *   3. Filters out anything with a post-cash balance ≤ 0 (fully paid).
   *   4. Re-sorts by (spread × post-cash balance) benefit score.
   *   5. Greedy-fits against the same effective cap the advisor used
   *      (`safeDrawStrict`, further capped by HELOC 40% and user cap when
   *      present), mirroring the main algorithm so the ceiling semantics
   *      match the rest of the advisor surface.
   *
   * Scope guarantees (explicit):
   *   - Does NOT change `computeHelocStrategyModel`, `helocStrategyModel`,
   *     `recommendedDrawAmount`, `status`, or "Advised draw now".
   *   - Only affects the two "Illustrative max draw if forced" display
   *     sites (the KPI sub-line and the Decision Box row).
   */
  const illustrativeForcedDraw = useMemo<number | null>(() => {
    if (!helocStrategyModel) return null;
    if (helocStrategyModel.status !== 'not_recommended') return null;
    const model = helocStrategyModel;

    const paidByAccount = new Map<string, number>();
    for (const row of displayExecutionPlan.snapshot ?? []) {
      const prior = paidByAccount.get(row.account) ?? 0;
      paidByAccount.set(row.account, prior + (Number(row.paymentAppliedNow) || 0));
    }

    const postCashEligibles = model.eligibleDebts
      .map((d) => {
        const paid = paidByAccount.get(d.name) ?? 0;
        const balanceAfter = round2(Math.max(0, d.balance - paid));
        return {
          ...d,
          balance: balanceAfter,
          benefitScore: round2((d.benefitSpread / 100) * balanceAfter)
        };
      })
      .filter((d) => d.balance > 0.005)
      .sort(
        (a, b) =>
          b.benefitScore - a.benefitScore ||
          b.benefitSpread - a.benefitSpread ||
          b.balance - a.balance
      );

    let cap = Math.max(0, model.safeDrawStrict);
    const estimatedHelocLimit = data.helocAdvisor?.estimatedHelocLimit;
    const userDefinedCap = data.helocAdvisor?.userDefinedCap;
    if (estimatedHelocLimit != null && estimatedHelocLimit > 0) {
      cap = Math.min(cap, round2(estimatedHelocLimit * 0.4));
    }
    if (userDefinedCap != null && userDefinedCap > 0) {
      cap = Math.min(cap, round2(userDefinedCap));
    }
    cap = round2(Math.max(0, cap));
    if (cap <= 0.005) return 0;

    let runningTotal = 0;
    for (const d of postCashEligibles) {
      if (runningTotal + d.balance <= cap + 0.005) {
        runningTotal = round2(runningTotal + d.balance);
      }
    }
    return round2(Math.max(0, runningTotal));
  }, [helocStrategyModel, displayExecutionPlan, data.helocAdvisor]);

  /**
   * Decision-box wording refinements (UX only — no calc changes).
   *
   * Part 1 canonical HELOC rule: any row that tells the user a story about
   * the HELOC (draw, "should I draw", "should I hold cash") must be driven
   * by the same `helocStrategyModel` that powers the HELOC section — NOT
   * by the raw backend answers, which were computed before the realism
   * layer (cash protection, double-debt trap, card burden) ran. Otherwise
   * the decision box happily claims a $25k "Maximum HELOC draw allowed now"
   * while the HELOC section below says not_recommended with $0 advised.
   *
   * Part 2 canonical cash rule: the two cash questions are now derived from
   * the same `displayExecutionPlan` that renders "Planned payment this
   * month" in the Month-0 block. Before this fix, "Can I make an extra
   * payment from cash?" was pulled from the raw backend answer (which
   * reflects pre-slider state), so the user could see "Planned payment:
   * $10,400" above and "Can I make an extra payment? No" in the box — a
   * direct contradiction.
   *
   * Mapping rules (all UI-only):
   *   - "Can I make an extra payment from cash?" — driven by the displayed
   *     executeNow (Planned payment this month). executeNow > 0 ⇒ Yes.
   *   - "Should I deploy the full amount now?" — synthesized from model +
   *     liquidity risk signals. Independent question; answered only when
   *     executeNow > 0.
   *   - "Advised HELOC draw now" / "Illustrative max draw if forced" —
   *     chosen by status + recommendedDrawAmount (see block below).
   *   - "Should I draw from HELOC this month?" — forced to "No" copy when
   *     status is not_recommended / not_needed or draw=0, regardless of
   *     what the backend originally said.
   *   - "Should I hold cash instead?" — aligned with the same flag so it
   *     cannot contradict "Should I draw from HELOC".
   */
  const tunedDecisionBox = useMemo<Record<string, string>>(() => {
    const src = data.decisionBox || {};
    const out: Record<string, string> = {};
    const helocStatus = helocStrategyModel?.status ?? null;
    const trapRisk = helocStrategyModel?.doubleDebtTrapModel?.trapRiskLevel ?? 'low';
    const plannedHold = Number(data.liquidity?.nearTermPlannedCashHold) || 0;
    const unmappedCardRisk = Number(data.liquidity?.unmappedCardRiskHold) || 0;
    const spikyNext120 =
      Number(helocStrategyModel?.cardSpendModel?.spikyCardSpendNext120Days) || 0;
    const recommendedDrawAmount = Number(helocStrategyModel?.recommendedDrawAmount) || 0;
    const drawZero = recommendedDrawAmount <= 0.005;
    // Canonical "HELOC is not advisable right now" flag. Drives every HELOC-
    // specific row so the box speaks with one voice.
    const helocBlocked =
      helocStatus === 'not_recommended' ||
      helocStatus === 'not_needed' ||
      drawZero;

    /*
     * Canonical "cash is actually being deployed this month" signal —
     * reads from the same executeNow the Month-0 panel renders, so the two
     * surfaces can't contradict. We ignore the legacy backend "Can I make
     * an extra payment?" answer here entirely; it was computed before the
     * user's slider choice and was the source of the contradiction.
     */
    const displayExecuteNow = Number(displayExecutionPlan?.executeNow) || 0;
    const displayDeployable = Number(displayExecutionPlan?.deployableMax) || 0;
    const cashPlanned = displayExecuteNow > 0.005;
    /*
     * Full vs partial must match what the user actually sees. `currency()`
     * rounds to whole dollars, so amounts like $55,393.07 deployable and
     * $55,393.00 planned both render as "$55,393". Using a sub-cent
     * tolerance produced the "Partial — $55,393 of $55,393 safe-to-use"
     * bug: the numbers looked identical but were technically different.
     * Snap the comparison to the same $1 resolution as the display.
     */
    const cashAtDeployableMax =
      cashPlanned &&
      displayDeployable > 0.005 &&
      Math.round(displayExecuteNow) >= Math.round(displayDeployable);
    const cashPartialOfDeployable =
      cashPlanned && !cashAtDeployableMax && displayDeployable > 0.005;
    const cashAnswer = cashPlanned
      ? `Yes — ${currency(displayExecuteNow)} planned this month`
      : displayDeployable > 0.005
      ? 'No — cash is available but nothing is planned for extra debt paydown this month'
      : 'No — no safe cash available after reserves / holds';

    // Deploy-full answer is independent and only meaningful when cash is
    // actually being deployed. When nothing is planned we say "n/a" rather
    // than inventing a risk reason against a $0 outflow.
    let deployAnswer: string;
    if (!cashPlanned) {
      deployAnswer = 'n/a — no cash is being deployed this month';
    } else if (cashAtDeployableMax) {
      const reasons: string[] = [];
      if (helocStatus === 'not_recommended') reasons.push('HELOC not recommended');
      if (trapRisk === 'high') reasons.push('high double-debt risk');
      else if (trapRisk === 'medium') reasons.push('double-debt watch');
      if (plannedHold > 0.005) reasons.push('near-term planned expenses');
      if (unmappedCardRisk > 0.005) reasons.push('unmapped card-risk reserve');
      if (spikyNext120 > 0.005) reasons.push('recent spiky card-funded charges');
      const fullLine = `Full — ${currency(displayExecuteNow)} of ${currency(
        displayDeployable
      )} safe-to-use is being deployed`;
      deployAnswer = reasons.length
        ? `${fullLine}; watch ${reasons.slice(0, 2).join(' & ')}`
        : fullLine;
    } else if (cashPartialOfDeployable) {
      deployAnswer = `Partial — ${currency(displayExecuteNow)} of ${currency(
        displayDeployable
      )} safe-to-use is being deployed`;
    } else {
      deployAnswer = `Yes — ${currency(displayExecuteNow)} is being deployed this month`;
    }

    // Rebuild in a deliberate order so the split reads naturally.
    out['Can I make an extra payment from cash?'] = cashAnswer;
    out['Should I deploy the full safe amount now?'] = deployAnswer;

    /*
     * Relabel the "Maximum HELOC draw allowed now" row so the key AND value
     * track the canonical strategy model:
     *
     *   recommended / optional              → "Advised HELOC draw now" = strategy amount
     *   not_recommended, draw > 0           → "Illustrative max draw if forced"
     *                                         (value kept; key makes it clear it
     *                                         is a ceiling, not advice)
     *   not_recommended OR draw = 0 OR
     *   not_needed                          → "Advised HELOC draw now" = $0
     *
     * We intentionally IGNORE the backend's pre-formatted value when the
     * status says not_recommended/not_needed — that legacy value is what
     * produced the contradictory "$25,000 allowed" display.
     */
    const maxDrawSrcKey = 'Maximum HELOC draw allowed now';
    const maxDrawSrcValue = maxDrawSrcKey in src ? String(src[maxDrawSrcKey] ?? '—') : null;
    let maxDrawKey: string;
    let maxDrawValue: string | null;
    if (helocStatus === 'not_recommended' && !drawZero) {
      maxDrawKey = 'Illustrative max draw if forced';
      // Prefer the post-cash illustrative figure (see `illustrativeForcedDraw`
      // memo). Fall back to the main recommendedDrawAmount only if the memo
      // short-circuited (non-not_recommended / missing model).
      const illustrative =
        illustrativeForcedDraw != null ? illustrativeForcedDraw : recommendedDrawAmount;
      maxDrawValue = currency(illustrative);
    } else if (helocBlocked) {
      maxDrawKey = 'Advised HELOC draw now';
      maxDrawValue = '$0';
    } else {
      maxDrawKey = 'Advised HELOC draw now';
      // Prefer the strategy-driven amount so the two surfaces never diverge.
      maxDrawValue =
        recommendedDrawAmount > 0.005 ? currency(recommendedDrawAmount) : maxDrawSrcValue;
    }

    /*
     * "Should I draw from HELOC this month?" — legacy backend answer is kept
     * only when the strategy model confirms HELOC is on the table. Otherwise
     * we substitute a strategy-aligned "No" so the decision box cannot
     * contradict the HELOC section.
     *
     * "Should I hold cash instead?" — similarly flipped to "Yes" when HELOC
     * is blocked, so the three HELOC-flavored rows read consistently.
     */
    const rawShouldDraw = 'Should I draw from HELOC this month?' in src
      ? String(src['Should I draw from HELOC this month?'] ?? '—')
      : null;
    const rawHoldCash = 'Should I hold cash instead?' in src
      ? String(src['Should I hold cash instead?'] ?? '—')
      : null;
    const shouldDrawOverride = helocBlocked
      ? helocStatus === 'not_needed'
        ? 'No — no eligible debts offer a rate benefit'
        : 'No — HELOC not recommended right now (see HELOC section)'
      : rawShouldDraw;
    const holdCashOverride = helocBlocked
      ? 'Yes — hold cash; a safe HELOC draw is not supported right now'
      : rawHoldCash;

    // Keys on the left are the raw backend labels we may receive. Keys on
    // the right are the user-facing labels shown in the decision box. All
    // underlying data (targets, debts) is unchanged — only the heading
    // terminology is aligned with "small balance / focus debt / next debt".
    const keyMap: Record<string, string> = {
      'Cleanup target this month': 'Small balance target this month',
      'Primary priority debt': 'Focus debt'
    };
    Object.keys(keyMap).forEach((srcKey) => {
      if (srcKey in src) out[keyMap[srcKey]] = String(src[srcKey] ?? '—');
    });
    if (shouldDrawOverride != null) {
      out['Should I draw from HELOC this month?'] = shouldDrawOverride;
    }
    if (holdCashOverride != null) {
      out['Should I hold cash instead?'] = holdCashOverride;
    }
    if (maxDrawValue != null) {
      out[maxDrawKey] = maxDrawValue;
    }
    // Preserve any additional backend-added keys we didn't explicitly handle,
    // minus the ones we already consumed/renamed.
    const consumedSrcKeys = new Set<string>([
      'Can I make an extra payment?',
      'Maximum HELOC draw allowed now',
      'Should I draw from HELOC this month?',
      'Should I hold cash instead?',
      // Future-proofing: a backend that learns to emit either variant of
      // the deploy-full question should not fight our slider-driven answer.
      'Should I deploy the full amount now?',
      'Should I deploy the full safe amount now?'
    ]);
    Object.keys(src).forEach((k) => {
      if (consumedSrcKeys.has(k)) return;
      if (k in keyMap) return;
      if (k in out) return;
      out[k] = String(src[k] ?? '—');
    });
    return out;
  }, [
    data.decisionBox,
    data.liquidity,
    helocStrategyModel,
    displayExecutionPlan,
    illustrativeForcedDraw
  ]);

  /*
   * Compact standard-mode signals. Pure presentation layer — every value
   * is derived from the already-computed canonical models
   * (`displayExecutionPlan`, `helocStrategyModel`, `data.liquidity`,
   * `data.watchouts`). Nothing here recomputes safe-to-use, execute-now,
   * waterfall allocations, HELOC decisions, or trap-risk logic.
   */
  const compactDecision = useMemo(() => {
    const exec = Number(displayExecutionPlan.executeNow) || 0;
    const deployable = Number(displayExecutionPlan.deployableMax) || 0;
    const totalCash = Number(data.liquidity.totalCash) || 0;
    const reserveTarget = Number(data.liquidity.reserveTarget) || 0;
    const buffer = Number(data.liquidity.buffer) || 0;
    const plannedHold = Number(data.liquidity.nearTermPlannedCashHold) || 0;
    const unmappedHold = Number(data.liquidity.unmappedCardRiskHold) || 0;
    const hasHolds = plannedHold > 0.005 || unmappedHold > 0.005;
    const reserveBufferSignificant =
      reserveTarget + buffer > 0.005 && totalCash > 0 && deployable < totalCash * 0.9;
    const cashPlanned = exec > 0.005;
    const atMax = cashPlanned && Math.round(exec) >= Math.round(deployable);

    // Recommendation: the single action being taken this month. Intentionally
    // does not mix in alternatives ("…or hold cash instead") so the card
    // reads like one clear recommendation rather than a menu of options.
    let recommendation: string;
    if (displayExecutionPlan.exceedsDeployable) {
      recommendation = `Deploy ${currency(exec)} this month (capped at the safe limit)`;
    } else if (cashPlanned && atMax) {
      recommendation = `Deploy ${currency(exec)} this month (full amount)`;
    } else if (cashPlanned) {
      recommendation = `Deploy ${currency(exec)} this month`;
    } else {
      recommendation = 'Hold cash this month';
    }

    // Why: a short narrative sentence explaining the recommendation. Same
    // signals as the previous "Constraint" field but rewritten as a single
    // advisor-style statement instead of a label/value fragment.
    let why: string;
    if (cashPlanned) {
      if (hasHolds) {
        why = 'Cash remains available after reserving for upcoming expenses and ongoing card usage.';
      } else if (reserveBufferSignificant) {
        why = 'Cash remains available after reserves and buffers are held back.';
      } else {
        why = 'Cash remains available after required reserves and buffers.';
      }
    } else if (deployable > 0.005) {
      // User has safe cash but chose not to deploy it. Frame as conservation
      // (holding for the same risks the planner would otherwise reserve
      // against) rather than "you chose to hold" so wording stays consistent
      // with the other holding branches.
      why = 'Cash is being held for upcoming expenses and ongoing card usage.';
    } else if (hasHolds) {
      why = 'Cash is being reserved for upcoming expenses and ongoing card usage.';
    } else if (reserveBufferSignificant) {
      why = 'Cash is being held back to keep reserves and buffers intact.';
    } else {
      why = 'There is no safe cash available to deploy this month.';
    }

    // Caution: optional single-sentence complement to the HELOC card. Only
    // shown when HELOC is actively not recommended so the decision block
    // carries the "watch out" forward without re-reading the HELOC card's
    // full Status / Reason / Action paragraph.
    let caution: string | null = null;
    if (helocStrategyModel && helocStrategyModel.status === 'not_recommended') {
      const trap = helocStrategyModel.doubleDebtTrapModel?.trapRiskLevel ?? 'low';
      caution =
        trap === 'high' || trap === 'medium'
          ? 'HELOC not recommended due to lack of repayment capacity.'
          : 'HELOC is not recommended right now.';
    }

    return { recommendation, why, caution };
  }, [data.liquidity, displayExecutionPlan, helocStrategyModel]);

  /*
   * "Why not more?" amount — the sum of the two material holds the
   * user can actually understand (near-term planned expenses +
   * unmapped card-risk). Reserves and buffers are permanent floors and
   * don't read as "why not more this month", so they're excluded from
   * this particular surface. Full reserve/buffer breakdown remains in
   * the Protected KPI group under Show details.
   */
  const whyNotMoreAmount = useMemo(() => {
    const plannedHold = Number(data.liquidity.nearTermPlannedCashHold) || 0;
    const unmappedHold = Number(data.liquidity.unmappedCardRiskHold) || 0;
    return round2(Math.max(0, plannedHold + unmappedHold));
  }, [data.liquidity]);

  const compactHeloc = useMemo(() => {
    if (!helocStrategyModel) return null;
    const m = helocStrategyModel;
    const trap = m.doubleDebtTrapModel?.trapRiskLevel ?? 'low';
    const plannedHold = Number(data.liquidity.nearTermPlannedCashHold) || 0;
    const unmappedHold = Number(data.liquidity.unmappedCardRiskHold) || 0;
    const spiky = Number(m.cardSpendModel?.spikyCardSpendNext120Days) || 0;

    let statusLabel: string;
    if (m.status === 'recommended') statusLabel = 'Recommended';
    else if (m.status === 'optional') statusLabel = 'Optional';
    else if (m.status === 'not_recommended') statusLabel = 'Not recommended';
    else statusLabel = 'Not needed';

    let reason: string;
    let action: string;
    if (m.status === 'recommended') {
      reason = `Eligible debts offer a meaningful rate benefit over the ${m.helocRatePercent.toFixed(
        2
      )}% HELOC rate.`;
      action = `Consider drawing ${currency(m.recommendedDrawAmount)} to consolidate.`;
    } else if (m.status === 'optional') {
      reason = 'Rate benefit exists but repayment window is tight.';
      action = `HELOC is allowed; evaluate tradeoffs before drawing ${currency(
        m.recommendedDrawAmount
      )}.`;
    } else if (m.status === 'not_recommended') {
      if (trap === 'high') {
        reason = 'No recurring repayment capacity and ongoing card burden.';
      } else if (trap === 'medium') {
        reason = 'Ongoing card burden and weak repayment capacity — a draw would be risky.';
      } else if (plannedHold > 0.005 || unmappedHold > 0.005) {
        reason = 'Near-term cash needs block a safe draw right now.';
      } else if (spiky > 0.005) {
        reason = 'Recent spiky card-funded charges block a safe draw right now.';
      } else {
        reason = 'Current cash flow does not support safe HELOC repayment.';
      }
      action = 'Avoid using HELOC this month.';
    } else {
      reason = 'No eligible debts offer a rate benefit over the HELOC rate.';
      action = 'HELOC not needed this month.';
    }

    return { statusLabel, status: m.status, reason, action };
  }, [helocStrategyModel, data.liquidity]);

  /*
   * Compact payment-result rows.
   *
   * We intentionally avoid re-rendering the full post-payment snapshot
   * (balance before, payment applied, APR, allocation share) in standard
   * mode — that belongs under Show details. This memo produces a short
   * affected-account list keyed on "what actually changed this month":
   *
   *   include row ⇢ paymentAppliedNow > $0 (which, by the status logic
   *     in `redistributeSnapshotRows`, also covers every CLOSED row).
   *
   * Role is derived from the canonical extras buckets
   * (`displayExecutionPlan.extras`) so the label always matches the
   * allocation classification the waterfall used. Snapshot status is
   * only a fallback for rows that don't appear in any extras bucket
   * (e.g., unusual planner payloads).
   *
   * Sort order: bucket priority (Primary → Secondary → Cleanup →
   * Overflow → Other), then by paymentApplied desc within each group,
   * so the most impactful outcomes float to the top while the overall
   * shape still mirrors the waterfall the user sees in details.
   */
  const compactPaymentResult = useMemo<
    | { kind: 'empty'; message: string }
    | { kind: 'table'; rows: CompactPaymentResultRow[]; overflowCount: number }
  >(() => {
    const exec = Number(displayExecutionPlan.executeNow) || 0;
    if (exec <= 0.005) {
      return { kind: 'empty', message: 'No extra payments this month (minimums only)' };
    }
    const extras = displayExecutionPlan.extras;
    const roleByAccount = new Map<string, CompactPaymentResultRow['role']>();
    for (const l of extras.cleanup || []) roleByAccount.set(l.account, 'Cleanup');
    for (const l of extras.primary || []) roleByAccount.set(l.account, 'Primary');
    for (const l of extras.secondary || []) roleByAccount.set(l.account, 'Secondary');
    for (const l of extras.overflow || []) roleByAccount.set(l.account, 'Overflow');

    const snapshot = displayExecutionPlan.snapshot ?? [];
    const affected: Array<CompactPaymentResultRow & { _paid: number }> = [];
    for (const row of snapshot) {
      const paid = Number(row.paymentAppliedNow) || 0;
      if (paid <= 0.005) continue;
      const remaining = Math.max(0, Number(row.balanceAfterNow) || 0);
      const closed = remaining <= 0.01;
      const fallbackRole: CompactPaymentResultRow['role'] =
        row.status === '↓ PRIMARY'
          ? 'Primary'
          : row.status === '↓ SECONDARY'
          ? 'Secondary'
          : 'Other';
      affected.push({
        account: row.account,
        role: roleByAccount.get(row.account) ?? fallbackRole,
        action: closed ? 'Closed' : 'Paid down',
        remaining,
        _paid: paid
      });
    }
    if (!affected.length) {
      return { kind: 'empty', message: 'No extra payments this month (minimums only)' };
    }

    // Display order follows the user-facing waterfall: Small balance →
    // Focus debt → Next debt → Excess. This is a presentation-only sort;
    // allocation order in the waterfall itself is unchanged.
    const roleOrder: Record<CompactPaymentResultRow['role'], number> = {
      Cleanup: 0,
      Primary: 1,
      Secondary: 2,
      Overflow: 3,
      Other: 4
    };
    affected.sort(
      (a, b) => roleOrder[a.role] - roleOrder[b.role] || b._paid - a._paid
    );

    const MAX_ROWS = 6;
    const visible = affected.slice(0, MAX_ROWS).map(({ _paid, ...rest }) => rest);
    const overflowCount = Math.max(0, affected.length - visible.length);
    return { kind: 'table', rows: visible, overflowCount };
  }, [displayExecutionPlan]);

  return (
    <div
      className={className}
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        paddingBottom: 48,
        ...rootStyle
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px 18px' }}>
        <header style={{ marginBottom: 14 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: C.primaryHi
            }}
          >
            Monthly debt execution
          </p>
          <h1 style={{ margin: '4px 0 0 0', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.02em' }}>Rolling Debt Payoff</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: `1px solid ${C.primary}`, color: C.primary }}>Plan: {data.summary.planStatus}</span>
            <span style={{ fontSize: 14, color: C.muted }}>
              Anchor <strong style={{ color: C.text }}>{data.summary.anchorMonth}</strong>
            </span>
            <span style={{ fontSize: 14, color: C.muted }}>
              Confidence <strong style={{ color: C.text }}>{data.summary.confidence}</strong>
            </span>
            <span style={{ fontSize: 14, color: C.muted }}>
              View{' '}
              <strong style={{ color: C.text, textTransform: 'capitalize' }}>
                {presentationMode}
              </strong>
            </span>
            {showDetails && !isAutomation ? (
              <span
                title="Details are showing — full diagnostic report, decision box, snapshot, and HELOC analysis are visible."
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  padding: '3px 9px',
                  borderRadius: 999,
                  border: `1px solid rgba(100, 116, 139, 0.3)`,
                  background: 'rgba(100, 116, 139, 0.06)',
                  color: C.muted
                }}
              >
                Details on
              </span>
            ) : null}
            {isAggressiveStrategy ? (
              <span
                title="Payoff strategy controls how extra debt cash is allocated. Presentation is separate."
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(92, 107, 192, 0.55)',
                  background: C.indigoBg,
                  color: '#3f51b5'
                }}
              >
                Strategy: Aggressive payoff
              </span>
            ) : (
              <span style={{ fontSize: 14, color: C.muted }}>
                Strategy <strong style={{ color: C.text }}>Standard payoff</strong>
              </span>
            )}
          </div>
        </header>

        {/**
         * KPI section follows the HAVE → PROTECTED → CAN USE mental model:
         *   A. TOTAL      — everything the user has in cash
         *   B. PROTECTED  — what's effectively off-limits (muted background)
         *   C. AVAILABLE  — what can actually be deployed, plus the input + output
         * The individual values come from the same `data.liquidity` / `displayExecutionPlan`
         * sources as before; only labels and visual grouping change.
         */}
        {/*
         * TOTAL + PROTECTED KPI groups are diagnostic breakdowns that
         * explain *why* Safe to use is lower than Total cash. They are
         * not part of the decision surface, so they live behind
         * `showDetails`. The compact top cash execution row (Available
         * group below) is the canonical standard-mode surface and always
         * renders.
         */}
        {showDetails ? (
          <>
            <KpiGroup label="Total" marginBottom={12}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                  alignItems: 'stretch'
                }}
              >
                <KpiCard
                  label="Total cash"
                  value={currency(data.liquidity.totalCash)}
                  sub="Full liquid total (all cash + checking + savings)"
                />
              </div>
            </KpiGroup>

            <KpiGroup
              label="Protected"
              sublabel="Not available for deployment"
              background="rgba(100, 116, 139, 0.06)"
              borderColor="rgba(100, 116, 139, 0.25)"
              marginBottom={12}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                  alignItems: 'stretch'
                }}
              >
                <KpiCard
                  label="Do not touch"
                  value={currency(data.liquidity.reserveTarget)}
                  sub="Reserved accounts"
                  subMuted
                />
                <KpiCard
                  label="Required buffers"
                  value={currency(data.liquidity.buffer)}
                  sub="Minimum balances"
                  subMuted
                />
                <KpiCard
                  label="Planned / risk holds"
                  value={currency(
                    round2(
                      (Number(data.liquidity.nearTermPlannedCashHold) || 0) +
                        (Number(data.liquidity.unmappedCardRiskHold) || 0)
                    )
                  )}
                  sub={`Near-term ${currency(
                    Number(data.liquidity.nearTermPlannedCashHold) || 0
                  )} · Card risk ${currency(
                    Number(data.liquidity.unmappedCardRiskHold) || 0
                  )}`}
                  subMuted
                />
              </div>
            </KpiGroup>
          </>
        ) : null}

        {/**
         * AVAILABLE group: Safe to use → Cash to use now (input) → Planned payment
         * this month (result). The input + result cards stay adjacent so the cause →
         * effect relationship is visually obvious; the group wrapper adds a subtle
         * primary-tinted border so this section reads as "the part the user interacts with".
         */}
        <KpiGroup
          background="rgba(30, 58, 95, 0.03)"
          borderColor="rgba(30, 58, 95, 0.25)"
          marginBottom={showDetails ? 20 : 14}
        >
          {/*
           * Decision flow on a single row:
           *   [ Safe to use ] → [ Cash to use now (input) ] → [ Your payment this month ]
           * Labels are intentionally terse — we dropped the old "Available /
           * What you can actually deploy this month" header + the "After
           * reserves, buffers, and upcoming expenses" subtext so the row
           * reads in ~5 seconds. The "Why not more?" block below carries
           * the one piece of context users actually need.
           */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
              alignItems: 'stretch'
            }}
          >
            <KpiCard
              label="Safe to use"
              value={currency(deployableMax)}
              borderAccent="deployable"
            />
            <CashToUseNowInputCard
              label="Cash to use now"
              helperText="Enter your payment amount (capped at safe-to-use)"
              inputValue={cashToUseNowInput}
              parsedInput={cashToUseNowRaw}
              onChange={setCashToUseNowInput}
              deployableMax={deployableMax}
              exceedsDeployable={exceedsDeployable}
              suggestedValue={
                data.liquidity.month0ExecuteNowBudget != null &&
                Number.isFinite(data.liquidity.month0ExecuteNowBudget) &&
                data.liquidity.month0ExecuteNowBudget > 0.005 &&
                data.liquidity.month0ExecuteNowBudget < deployableMax - 0.5
                  ? Math.min(data.liquidity.month0ExecuteNowBudget, deployableMax)
                  : null
              }
            />
            <ExecuteNowResultCard
              executeNow={executeNow}
              exceedsDeployable={exceedsDeployable}
              remainingDeployable={Math.max(0, round2(deployableMax - executeNow))}
            />
          </div>
        </KpiGroup>

        {/*
         * "Why not more?" — single contextual block that explains why
         * Safe to use is lower than Total cash without exposing the
         * full reserve / buffer / hold breakdown. Renders only when
         * near-term planned-expense + unmapped card-risk holds are
         * materially reducing the deployable amount. The full breakdown
         * lives in the Total / Protected KPI groups under Show details.
         */}
        {whyNotMoreAmount > 0.005 ? (
          <div
            style={{
              marginTop: 4,
              marginBottom: 28,
              padding: '10px 14px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: 'rgba(100, 116, 139, 0.05)'
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: C.muted
              }}
            >
              Why not more?
            </p>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: 13,
                color: C.text,
                fontWeight: 600,
                lineHeight: 1.45
              }}
            >
              {currency(whyNotMoreAmount)} reserved for upcoming expenses and ongoing card usage
            </p>
          </div>
        ) : null}

        {/*
         * Standard-mode compact surface.
         *
         * When `showDetails` is false, only these four items render:
         *   - Compact HELOC card (Status / Reason / Action)
         *   - Compact decision card (Action / Constraint / optional watchout)
         *   - Compact payment result summary
         *   - "Show details" toggle (below)
         *
         * The full HelocStrategySection, cash-bridge audit, allocation
         * audit, planned-expense impact, and the display-plan validator
         * all move into the details container further down.
         */}
        {!isAutomation && !showDetails ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              marginBottom: 28
            }}
          >
            {compactHeloc ? (
              <CompactHelocCard
                statusLabel={compactHeloc.statusLabel}
                status={compactHeloc.status}
                reason={compactHeloc.reason}
                action={compactHeloc.action}
              />
            ) : null}
            <CompactDecisionCard
              recommendation={compactDecision.recommendation}
              why={compactDecision.why}
              caution={compactDecision.caution}
            />
            <CompactPaymentResult value={compactPaymentResult} />
            {!displayExecutionPlan.validation.isConsistent ? (
              <DisplayPlanValidator
                executeNow={displayExecutionPlan.executeNow}
                extraTotal={displayExecutionPlan.extraTotal}
                snapshotPaymentTotal={displayExecutionPlan.snapshotPaymentTotal}
                unallocatedHeadroom={displayExecutionPlan.unallocatedHeadroom}
                userCashToUseNowInput={displayExecutionPlan.cashToUseNowInput}
                deployableMax={displayExecutionPlan.deployableMax}
                exceedsDeployable={displayExecutionPlan.exceedsDeployable}
                strategyComparison={displayExecutionPlan.strategyComparison}
                isAggressiveStrategy={isAggressiveStrategy}
                totalCash={Number(data.liquidity.totalCash) || 0}
                reserve={Number(data.liquidity.reserveTarget) || 0}
                buffer={Number(data.liquidity.buffer) || 0}
                nearTermPlannedHold={Number(data.liquidity.nearTermPlannedCashHold) || 0}
                unmappedCardRiskHold={Number(data.liquidity.unmappedCardRiskHold) || 0}
                visible={true}
              />
            ) : null}
          </div>
        ) : null}

        {/*
         * User-facing toggle. Operator/advanced/aggressive plans already
         * have `isAdvanced === true`, in which case `showDetails` is
         * locked on and this button becomes a no-op label. Standard plans
         * render collapsed by default and the user can expand inline.
         */}
        {!isAutomation ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: showDetails ? 18 : 28
            }}
          >
            <button
              type="button"
              onClick={() => setShowDetailsExpanded((v) => !v)}
              aria-expanded={showDetails}
              aria-controls="rolling-debt-details"
              disabled={isAdvanced}
              title={
                isAdvanced
                  ? 'Details are always on in this plan mode.'
                  : showDetails
                  ? 'Collapse the full diagnostic report.'
                  : 'Expand the full diagnostic report.'
              }
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '7px 14px',
                borderRadius: 999,
                border: `1px solid ${C.border}`,
                background: showDetails ? 'rgba(30, 58, 95, 0.08)' : '#ffffff',
                color: isAdvanced ? C.muted : C.text,
                cursor: isAdvanced ? 'default' : 'pointer',
                opacity: isAdvanced ? 0.7 : 1
              }}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>
        ) : null}

        {/*
         * Diagnostic container. Everything below is hidden in standard
         * mode. When `showDetails` is true (operator plan OR user clicked
         * Show details) the full dashboard report renders:
         *   - Full HelocStrategySection (rate benefit, safe-to-use flags,
         *     advised draw, illustrative forced draw, payoff time,
         *     interest saved, trap risk, recurring & spiky card spend,
         *     eligible-by-rate list, recommended-use list)
         *   - Cash bridge audit & allocation audit (debug)
         *   - Display-plan validator
         *   - Planned-expense impact block
         *   - Already-paid / minimums lists
         *   - Extras waterfall buckets + aggressive panel
         *   - Execution totals gradient
         *   - Future / conditional cash
         *   - Full decision box question list
         *   - Post-payment snapshot table
         *   - Next 3 months + watchouts list
         */}
        {!isAutomation && showDetails && data.helocAdvisor && helocStrategyModel && helocExecutionPlan ? (
          <div id="rolling-debt-details">
            <HelocStrategySection
              snapshot={data.helocAdvisor}
              model={helocStrategyModel}
              plan={helocExecutionPlan}
              isAdvanced={showDetails}
              illustrativeForcedDraw={illustrativeForcedDraw}
            />
          </div>
        ) : null}

        {!isAutomation && showDetails ? (
          <CashBridgeSection
            bridge={data.cashBridge ?? null}
            totalCashDisplay={Number(data.liquidity.totalCash) || 0}
            reserveDisplay={Number(data.liquidity.reserveTarget) || 0}
            bufferDisplay={Number(data.liquidity.buffer) || 0}
            nearTermPlannedHoldDisplay={Number(data.liquidity.nearTermPlannedCashHold) || 0}
            unmappedCardRiskHoldDisplay={Number(data.liquidity.unmappedCardRiskHold) || 0}
            deployableMaxDisplay={deployableMax}
            cashToUseNowInput={cashToUseNowRaw}
            executeNowDisplay={executeNow}
            exceedsDeployable={exceedsDeployable}
            reserveAccountCount={data.liquidity.reserveAccountCount}
            bufferAccountCount={data.liquidity.bufferAccountCount}
            reserveSource={data.liquidity.reserveSource}
            bufferSource={data.liquidity.bufferSource}
            legacyReserveTarget={data.liquidity.legacyReserveTarget}
            legacyBufferAboveReserve={data.liquidity.legacyBufferAboveReserve}
          />
        ) : null}

        {!isAutomation && showDetails && data.allocationAudit ? (
          <AllocationAuditSection
            audit={data.allocationAudit}
            displayedExecuteNow={displayExecutionTotals.fromCash}
            userCashToUseNowInput={displayExecutionPlan.cashToUseNowInput}
            deployableMax={displayExecutionPlan.deployableMax}
          />
        ) : null}

        {showDetails ? (
          <DisplayPlanValidator
            executeNow={displayExecutionPlan.executeNow}
            extraTotal={displayExecutionPlan.extraTotal}
            snapshotPaymentTotal={displayExecutionPlan.snapshotPaymentTotal}
            unallocatedHeadroom={displayExecutionPlan.unallocatedHeadroom}
            userCashToUseNowInput={displayExecutionPlan.cashToUseNowInput}
            deployableMax={displayExecutionPlan.deployableMax}
            exceedsDeployable={displayExecutionPlan.exceedsDeployable}
            strategyComparison={displayExecutionPlan.strategyComparison}
            isAggressiveStrategy={isAggressiveStrategy}
            totalCash={Number(data.liquidity.totalCash) || 0}
            reserve={Number(data.liquidity.reserveTarget) || 0}
            buffer={Number(data.liquidity.buffer) || 0}
            nearTermPlannedHold={Number(data.liquidity.nearTermPlannedCashHold) || 0}
            unmappedCardRiskHold={Number(data.liquidity.unmappedCardRiskHold) || 0}
            visible={!isAutomation}
          />
        ) : null}

        {!isAutomation && showDetails && data.plannedExpenseImpact && data.plannedExpenseImpact.lines.length ? (
          <PlannedExpenseImpactSection block={data.plannedExpenseImpact} />
        ) : null}

        {isAutomation ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <AutomationBlock
              title="summary"
              body={`plan_status: ${data.summary.planStatus}\nanchor_month: ${data.summary.anchorMonth}\nconfidence: ${data.summary.confidence}`}
            />
            <AutomationBlock
              title="liquidity"
              body={[
                `total_cash: ${currencyDetailed(data.liquidity.totalCash)}`,
                `reserve: ${currencyDetailed(data.liquidity.reserveTarget)}`,
                data.liquidity.reserveAccountCount != null
                  ? `reserve_account_count: ${data.liquidity.reserveAccountCount}`
                  : '',
                data.liquidity.reserveSource
                  ? `reserve_source: ${data.liquidity.reserveSource}`
                  : '',
                `buffer: ${currencyDetailed(data.liquidity.buffer)}`,
                data.liquidity.bufferAccountCount != null
                  ? `buffer_account_count: ${data.liquidity.bufferAccountCount}`
                  : '',
                data.liquidity.bufferSource
                  ? `buffer_source: ${data.liquidity.bufferSource}`
                  : '',
                data.liquidity.legacyReserveTarget != null
                  ? `legacy_reserve_target: ${currencyDetailed(data.liquidity.legacyReserveTarget)}`
                  : '',
                data.liquidity.legacyBufferAboveReserve != null
                  ? `legacy_buffer_above_reserve: ${currencyDetailed(data.liquidity.legacyBufferAboveReserve)}`
                  : '',
                data.liquidity.deployableMaxCalculated != null
                  ? `deployable_max_calculated: ${currencyDetailed(data.liquidity.deployableMaxCalculated)}`
                  : '',
                `near_term_planned_hold: ${currencyDetailed(
                  Number(data.liquidity.nearTermPlannedCashHold) || 0
                )}`,
                `unmapped_card_risk_hold: ${currencyDetailed(
                  Number(data.liquidity.unmappedCardRiskHold) || 0
                )}`,
                `deployable_max: ${currencyDetailed(deployableMax)}`,
                `cash_to_use_now_input: ${currencyDetailed(cashToUseNowRaw)}`,
                `execute_now: ${currencyDetailed(executeNow)}`,
                exceedsDeployable ? `input_exceeds_deployable_max: true` : '',
                data.liquidity.month0ExecuteNowBudget != null
                  ? `server_month0_execute_now_budget: ${currencyDetailed(data.liquidity.month0ExecuteNowBudget)}`
                  : '',
                `heloc_recommended: ${data.liquidity.helocRecommended}`,
                data.liquidity.totalUsableCash != null
                  ? `total_usable_cash: ${currencyDetailed(data.liquidity.totalUsableCash)}`
                  : '',
                data.liquidity.debtPreferredCash != null
                  ? `debt_preferred_cash: ${currencyDetailed(data.liquidity.debtPreferredCash)}`
                  : '',
                data.liquidity.billsAvailableCash != null
                  ? `bills_available_cash: ${currencyDetailed(data.liquidity.billsAvailableCash)}`
                  : '',
                data.liquidity.cautionCash != null ? `caution_cash: ${currencyDetailed(data.liquidity.cautionCash)}` : '',
                data.liquidity.finalExecuteNowCash != null
                  ? `final_execute_now_cash: ${currencyDetailed(data.liquidity.finalExecuteNowCash)}`
                  : '',
                data.liquidity.monthlyExecutionCap != null
                  ? `monthly_execution_cap: ${currencyDetailed(data.liquidity.monthlyExecutionCap)}`
                  : '',
                data.liquidity.executableNowBudget != null
                  ? `executable_now_budget: ${currencyDetailed(data.liquidity.executableNowBudget)}`
                  : ''
              ]
                .filter(Boolean)
                .join('\n')}
            />
            {data.cashBridge ? (
              <AutomationBlock
                title="cash_bridge"
                body={[
                  `01_liquid_total_sheet: ${currencyDetailed(data.cashBridge.liquidTotalSheet)}`,
                  `02_minus_do_not_touch_excluded: ${currencyDetailed(data.cashBridge.doNotTouchExcludedCash)}`,
                  `03_policy_eligible_before_buffers: ${currencyDetailed(data.cashBridge.policyEligibleCashBeforeBuffers)}`,
                  `04_minus_account_min_buffers: ${currencyDetailed(data.cashBridge.accountMinBuffersTotal)}`,
                  `05_total_usable_cash: ${currencyDetailed(data.cashBridge.totalUsableCash)}`,
                  `06_minus_reserve_hold: ${currencyDetailed(data.cashBridge.reserveHold)}`,
                  `07_minus_global_buffer_hold: ${currencyDetailed(data.cashBridge.globalBufferHold)}`,
                  `08_minus_near_term_planned_hold: ${currencyDetailed(data.cashBridge.nearTermPlannedCashHold)}`,
                  `09_minus_unmapped_card_risk_hold: ${currencyDetailed(data.cashBridge.unmappedCardRiskHold)}`,
                  `10_final_execute_now_cash: ${currencyDetailed(data.cashBridge.finalExecuteNowCash)}`,
                  `monthly_execution_cap: ${currencyDetailed(data.cashBridge.monthlyExecutionCap)}`,
                  `executable_now_budget: ${currencyDetailed(data.cashBridge.executableNowBudget)}`,
                  `month0_execute_now_budget: ${currencyDetailed(
                    data.cashBridge.month0ExecuteNowBudget != null
                      ? data.cashBridge.month0ExecuteNowBudget
                      : data.cashBridge.executableNowBudget
                  )}`,
                  ...(data.cashBridge.cashBridgeValidationWarnings || []).map((w) => `WARNING: ${w}`)
                ].join('\n')}
              />
            ) : null}
            {data.allocationAudit ? (
              <AutomationBlock
                title="allocation_audit"
                body={[
                  `allocated_cleanup_total: ${currencyDetailed(data.allocationAudit.allocatedCleanupTotal)}`,
                  `allocated_primary_total: ${currencyDetailed(data.allocationAudit.allocatedPrimaryTotal)}`,
                  `allocated_secondary_total: ${currencyDetailed(data.allocationAudit.allocatedSecondaryTotal)}`,
                  `allocated_overflow_total: ${currencyDetailed(data.allocationAudit.allocatedOverflowTotal)}`,
                  `allocated_execute_now_cash_total: ${currencyDetailed(data.allocationAudit.allocatedExecuteNowCashTotal)}`,
                  `month0_execute_now_budget: ${currencyDetailed(data.allocationAudit.month0ExecuteNowBudget)}`,
                  `allocation_gap_to_budget: ${currencyDetailed(data.allocationAudit.allocationGapToBudget)}`,
                  Math.abs(
                    data.allocationAudit.allocatedExecuteNowCashTotal - displayExecutionTotals.fromCash
                  ) > 0.01
                    ? `DRIFT_vs_displayed_execute_now: ${currencyDetailed(
                        Math.abs(
                          data.allocationAudit.allocatedExecuteNowCashTotal - displayExecutionTotals.fromCash
                        )
                      )}`
                    : '',
                  ...(data.allocationAudit.warnings || []).map((w) => `WARNING: ${w}`)
                ]
                  .filter(Boolean)
                  .join('\n')}
              />
            ) : null}
            <AutomationBlock
              title="planned_expense_impact"
              body={
                !data.plannedExpenseImpact || !data.plannedExpenseImpact.lines.length
                  ? 'none'
                  : [
                      `near_term_cash_reserved: ${currencyDetailed(data.plannedExpenseImpact.summary.nearTermCashReserved)}`,
                      `card_funded_modeled_load_mapped: ${currencyDetailed(data.plannedExpenseImpact.summary.cardFundedModeledLoad)}`,
                      `unmapped_cash_risk_hold: ${currencyDetailed(data.plannedExpenseImpact.summary.unmappedCashRiskHold)}`,
                      `mid_term_caution: ${currencyDetailed(data.plannedExpenseImpact.summary.midTermCaution)}`,
                      ...data.plannedExpenseImpact.lines.map(
                        (l) =>
                          `row: expense=${l.expense} | due=${l.due} | amount=${currencyDetailed(l.amount)} | funding=${l.fundingType} | execution=${l.executionEffect} | planning=${l.planningEffect} | status=${l.status}`
                      ),
                      data.plannedExpenseImpact.unmappedCardWarning ? `warning: ${data.plannedExpenseImpact.unmappedCardWarning}` : ''
                    ]
                      .filter(Boolean)
                      .join('\n')
              }
            />
            <AutomationBlock
              title="minimums_due"
              body={
                data.minimums.length === 0
                  ? 'row: none | amount: 0'
                  : data.minimums.map((m) => `row: ${m.account} | due: ${currencyDetailed(m.amountDue)}`).join('\n')
              }
            />
            <AutomationBlock
              title="execute_now"
              body={[
                `total_cash_extras: ${currencyDetailed(extraTotal)}`,
                ...(['cleanup', 'primary', 'secondary', 'overflow'] as const).flatMap((b) =>
                  (displayExtras[b] as ExtraLine[]).map((l) => `pay_row: bucket=${b} | account=${l.account} | amount=${currencyDetailed(l.amount)}`)
                )
              ].join('\n')}
            />
            <AutomationBlock
              title="conditional_if_income_arrives"
              body={
                data.conditionalPayments.length === 0
                  ? 'pay_row: none | amount: 0'
                  : data.conditionalPayments
                      .map((c) => `pay_row: bucket=conditional | account=${c.account} | amount=${currencyDetailed(c.amount)}`)
                      .join('\n')
              }
            />
            <AutomationBlock
              title="execution_totals"
              body={[
                `from_cash: ${currencyDetailed(displayExecutionTotals.fromCash)}`,
                `from_heloc: ${currencyDetailed(displayExecutionTotals.fromHeloc)}`,
                `total_now: ${currencyDetailed(displayExecutionTotals.totalNow)}`,
                `conditional_later: ${currencyDetailed(displayExecutionTotals.conditionalLater)}`
              ].join('\n')}
            />
            <AutomationBlock
              title="display_plan_validator"
              body={[
                `user_cash_to_use_now_input: ${currencyDetailed(displayExecutionPlan.cashToUseNowInput)}`,
                `deployable_max: ${currencyDetailed(displayExecutionPlan.deployableMax)}`,
                `display_execute_now: ${currencyDetailed(displayExecutionPlan.executeNow)}`,
                `display_bucket_total: ${currencyDetailed(displayExecutionPlan.extraTotal)}`,
                `snapshot_payment_total: ${currencyDetailed(displayExecutionPlan.snapshotPaymentTotal)}`,
                `gap_execute_vs_bucket: ${currencyDetailed(displayExecutionPlan.validation.executeNowVsBucket)}`,
                `gap_execute_vs_snapshot: ${currencyDetailed(displayExecutionPlan.validation.executeNowVsSnapshot)}`,
                `gap_bucket_vs_snapshot: ${currencyDetailed(displayExecutionPlan.validation.bucketVsSnapshot)}`,
                `unallocated_headroom: ${currencyDetailed(displayExecutionPlan.unallocatedHeadroom)}`,
                `is_consistent: ${displayExecutionPlan.validation.isConsistent}`,
                displayExecutionPlan.exceedsDeployable ? `input_exceeds_deployable_max: true` : '',
                !displayExecutionPlan.validation.isConsistent
                  ? `WARNING: display plan drift detected — a section is not reading displayExecutionPlan`
                  : '',
                isAggressiveStrategy
                  ? `strategy_changed_allocations: ${displayExecutionPlan.strategyComparison.strategyChangedAllocations ? 'yes' : 'no'}`
                  : '',
                isAggressiveStrategy && !displayExecutionPlan.strategyComparison.strategyChangedAllocations && displayExecutionPlan.strategyComparison.strategyNoChangeReason
                  ? `strategy_no_change_reason: ${displayExecutionPlan.strategyComparison.strategyNoChangeReason}`
                  : '',
                isAggressiveStrategy ? `post_cleanup_pool: ${currencyDetailed(displayExecutionPlan.strategyComparison.postCleanupPool)}` : '',
                isAggressiveStrategy ? `std_primary_target_75: ${currencyDetailed(displayExecutionPlan.strategyComparison.stdPrimaryTarget)}` : '',
                isAggressiveStrategy ? `agg_primary_target_90: ${currencyDetailed(displayExecutionPlan.strategyComparison.aggPrimaryTarget)}` : '',
                isAggressiveStrategy ? `actual_primary_allocated: ${currencyDetailed(displayExecutionPlan.strategyComparison.actualPrimary)}` : '',
                isAggressiveStrategy ? `actual_secondary_allocated: ${currencyDetailed(displayExecutionPlan.strategyComparison.actualSecondary)}` : ''
              ]
                .filter(Boolean)
                .join('\n')}
            />
            <AutomationBlock title="decision_box" body={Object.entries(tunedDecisionBox)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n')} />
            <AutomationBlock
              title="next_3_months"
              body={data.next3Months
                .map((n) => `row: month=${n.month} | focus=${n.focus}${n.detail ? ` | detail=${n.detail}` : ''}`)
                .join('\n')}
            />
            <AutomationBlock
              title="watchouts"
              body={
                data.watchouts.length === 0
                  ? 'none'
                  : data.watchouts.map((w) => `- ${shortenWatchout(w)}`).join('\n')
              }
            />
            <div style={{ marginTop: 8, marginBottom: 20 }}>
              <SectionTitle>Post-payment snapshot</SectionTitle>
              <SnapshotTable rows={displaySnapshot} summary={displaySnapshotSummary} />
            </div>
          </div>
        ) : showDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              <div style={shellStyle()}>
                <SectionTitle>Already paid this month</SectionTitle>
                {!data.alreadyPaid.length ? (
                  <p style={{ margin: 0, fontSize: 14, color: C.muted }}>No accounts marked as satisfied from anchor cash flow.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.alreadyPaid.map((a, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
                        <span style={{ color: C.success, fontSize: 18 }}>●</span>
                        {a.account}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={shellStyle()}>
                <SectionTitle>Pay now (minimums)</SectionTitle>
                {!data.minimums.length ? (
                  <p style={{ margin: 0, fontSize: 14, color: C.muted }}>No unpaid minimums due for this view.</p>
                ) : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.minimums.map((m, i) => (
                      <li
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600
                        }}
                      >
                        <span>{m.account}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: C.primaryHi }}>{currencyDetailed(m.amountDue)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div style={{ ...shellStyle(), marginTop: 8 }}>
              <SectionTitle>Extra payments (planned payment this month)</SectionTitle>
              <p style={{ margin: '0 0 22px 0', fontSize: 14, color: C.muted, lineHeight: 1.55 }}>
                Total planned-payment extras: <strong style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{currency(extraTotal)}</strong>
              </p>
              {extraTotal > 0.005 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 18,
                    marginBottom: 26
                  }}
                >
                  <ProgressBar label="Small balance share of extras" valuePct={pct(cleanupSum, extraTotal)} />
                  <ProgressBar label="Focus debt share of extras" valuePct={pct(primarySum, extraTotal)} />
                  <ProgressBar label="Next debt share of extras" valuePct={pct(secondarySum, extraTotal)} />
                </div>
              ) : null}
              {data.strictWaterfallErrors && data.strictWaterfallErrors.length ? (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${C.danger}`,
                    background: C.dangerBg,
                    color: C.danger,
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.45
                  }}
                >
                  {data.strictWaterfallErrors.map((e, i) => (
                    <p key={i} style={{ margin: i ? '8px 0 0 0' : 0 }}>
                      {e}
                    </p>
                  ))}
                </div>
              ) : null}
              <p
                style={{
                  margin: '0 0 12px 0',
                  fontSize: 12,
                  color: C.muted,
                  lineHeight: 1.55,
                  fontStyle: 'italic'
                }}
              >
                Small balances are paid first to simplify accounts and free up minimum payments.
                After that, extra cash goes to the focus debt. Once the focus debt is cleared,
                remaining extra cash moves to the next debt, and anything beyond that is shown as
                excess.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                  gap: 20,
                  alignItems: 'stretch'
                }}
              >
                <ExtraBucketCard title="1 · Small balances" lines={displayExtras.cleanup} totalExtra={extraTotal} bucketKey="cleanup" />
                <ExtraBucketCard
                  title="2 · Focus debt"
                  lines={displayExtras.primary}
                  totalExtra={extraTotal}
                  bucketKey="primary"
                  footerNote="The focus debt must be fully paid before the next debt receives extra."
                />
                <ExtraBucketCard
                  title="3 · Next debt"
                  lines={displayExtras.secondary}
                  totalExtra={extraTotal}
                  bucketKey="secondary"
                  footerNote="Next debt order: CitiAA → Southwest → Marriott."
                />
                <ExtraBucketCard title="4 · Excess allocation" lines={displayExtras.overflow} totalExtra={extraTotal} bucketKey="overflow" />
              </div>
              {data.strictWaterfallSplitNote ? (
                <p style={{ margin: '16px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5, fontStyle: 'italic' }}>
                  {data.strictWaterfallSplitNote}
                </p>
              ) : null}
              {isAggressiveStrategy && !isAutomation ? (
                <StrategyComparisonNote cmp={displayExecutionPlan.strategyComparison} />
              ) : null}
            </div>

            {isAggressiveStrategy && !isAutomation && displayAggressiveMeta ? (
              <AggressivePanel
                meta={displayAggressiveMeta}
                cmp={displayExecutionPlan.strategyComparison}
                totalExtraCash={extraTotal}
              />
            ) : null}
            <div
              style={{
                borderRadius: 12,
                padding: '22px 24px',
                background: C.execGrad,
                color: '#fff',
                boxShadow: '0 4px 16px rgba(15, 39, 68, 0.25)'
              }}
            >
              <p style={{ margin: '0 0 16px 0', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>
                Execution totals
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 18 }}>
                {(
                  [
                    { k: 'Planned payment', v: currency(displayExecutionTotals.fromCash), h: false },
                    { k: 'From HELOC', v: currency(displayExecutionTotals.fromHeloc), h: false },
                    { k: 'Total now', v: currency(displayExecutionTotals.totalNow), h: true }
                  ] as const
                ).map((x) => (
                  <div key={x.k}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.75 }}>{x.k}</p>
                    <p style={{ margin: '8px 0 0 0', fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', opacity: x.h ? 1 : 0.95 }}>{x.v}</p>
                  </div>
                ))}
              </div>
            </div>

            <FutureConditionalCashSection
              conditionalPayments={data.conditionalPayments}
              conditionalExtraLaterThisMonth={data.liquidity.conditionalExtraLaterThisMonth}
              conditionalLaterTotal={displayExecutionTotals.conditionalLater}
              defaultOpen={isAdvanced || isAutomation}
            />

            <div style={shellStyle()}>
              <SectionTitle>Decision box</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {Object.entries(tunedDecisionBox).map(([q, a]) => (
                  <div key={q} style={{ padding: 14, borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(30, 58, 95, 0.04)' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>{q}</p>
                    <p style={{ margin: '8px 0 0 0', fontSize: 14, fontWeight: 700 }}>{a}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12, marginBottom: 28 }}>
              <SectionTitle>Post-payment snapshot</SectionTitle>
              <SnapshotTable rows={displaySnapshot} summary={displaySnapshotSummary} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
              <div style={shellStyle()}>
                <SectionTitle>Next 3 months</SectionTitle>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.next3Months.map((n, i) => (
                    <li key={i} style={{ padding: 14, border: `1px solid ${C.border}`, borderRadius: 10, background: '#fafbfc' }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.primaryHi, textTransform: 'uppercase' }}>{n.month}</p>
                      <p style={{ margin: '6px 0 0 0', fontSize: 14, fontWeight: 700 }}>{n.focus}</p>
                      {n.detail ? <p style={{ margin: '6px 0 0 0', fontSize: 12, color: C.muted }}>{n.detail}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ ...shellStyle(), background: C.warnBg, border: '1px solid rgba(180, 83, 9, 0.3)' }}>
                <SectionTitle>Watchouts (max 3)</SectionTitle>
                {!watchTop3.length ? (
                  <p style={{ margin: 0, fontSize: 14, color: C.muted }}>None flagged for this month.</p>
                ) : (
                  <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.45 }}>
                    {watchTop3.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default RollingDebtPayoffDashboard;

// —— Demo data (declared after helpers; referenced by mergeWithDemo) —————————

export const demoRollingDebtPayoffDashboardData: RollingDebtPayoffDashboardData = {
  summary: {
    planStatus: 'OK',
    anchorMonth: 'Apr 2026',
    confidence: 'MEDIUM',
    executionPlanMode: 'standard'
  },
  liquidity: {
    totalCash: 118_400,
    reserveTarget: 35_000,
    buffer: 8_000,
    deployableCash: 68_900,
    cashAvailableForExtraDebt: 22_400,
    helocRecommended: 'Optional — gates passed',
    conditionalExtraLaterThisMonth: 6_200,
    nearTermPlannedCashHold: 6_500,
    unmappedCardRiskHold: 0,
    deployableMax: 68_900,
    calculatedReserve: 35_000,
    calculatedBuffer: 8_000,
    reserveAccountCount: 2,
    bufferAccountCount: 3,
    reserveSource: 'DO_NOT_TOUCH accounts (SYS - Accounts current balances)',
    bufferSource: 'per-account Min Buffer (non-DO_NOT_TOUCH policy-eligible accounts)',
    deployableMaxCalculated: 68_900,
    legacyReserveTarget: 100_000,
    legacyBufferAboveReserve: 100_000
  },
  cashBridge: null,
  helocAdvisor: {
    helocAprPercent: 8.75,
    helocCurrentBalance: 0,
    helocAccountName: 'HELOC',
    helocMinimumPayment: 0,
    minSpreadPercent: 3,
    monthlyRecurringPaydownCapacity: 3_000,
    conditionalLumpPaydownCapacity: 12_000,
    conditionalLumpFrequencyNote: 'RSU vests (quarterly, not guaranteed)',
    upcomingExpenses: [
      { label: 'Fence replacement', amount: 9_500, dueInDays: 45 },
      { label: 'Solar install down payment', amount: 18_000, dueInDays: 90 },
      { label: 'Q2 estimated taxes', amount: 14_000, dueInDays: 60 }
    ],
    monthlySpendingEstimate: 11_000,
    monthlyNewSpendingEstimate: 500,
    cardSpend: {
      recurringBills: [
        { label: 'Lake Tahoe HOA', monthlyAmount: 680 },
        { label: 'AT&T fiber', monthlyAmount: 110 },
        { label: 'Xfinity', monthlyAmount: 95 },
        { label: 'Subscriptions (Netflix, Spotify, etc.)', monthlyAmount: 85 },
        { label: 'Groceries + gas (card-routed)', monthlyAmount: 2_200 }
      ],
      plannedCardFundedNext120Days: 3_400,
      // Planner surplus already nets monthly expenses — don't double-count.
      alreadyInCashflow: true,
      estimationMethod: 'recurring_bills_only',
      confidence: 'medium'
    },
    debts: [
      { name: 'Southwest Priority', type: 'Credit Card', balance: 51_200, aprPercent: 22.49, minimumPayment: 1_025 },
      { name: 'United Explorer', type: 'Credit Card', balance: 18_400, aprPercent: 20.24, minimumPayment: 370 },
      { name: 'Freedom Flex', type: 'Credit Card', balance: 9_100, aprPercent: 19.49, minimumPayment: 185 },
      { name: 'Ink Business', type: 'Credit Card', balance: 22_000, aprPercent: 17.99, minimumPayment: 450 },
      { name: 'Lake Tahoe Mortgage', type: 'Mortgage', balance: 420_000, aprPercent: 6.125, minimumPayment: 2_550 }
    ]
  },
  alreadyPaid: [{ account: 'Chase Sapphire' }, { account: 'Amex Gold' }],
  minimums: [
    { account: 'Citi Double Cash', amountDue: 185 },
    { account: 'Discover', amountDue: 120 }
  ],
  extraPayments: {
    cleanup: [
      { account: 'Store Card A', amount: 900, bucket: 'cleanup' },
      { account: 'Store Card B', amount: 650, bucket: 'cleanup' }
    ],
    primary: [{ account: 'Southwest Priority', amount: 12_400, bucket: 'primary' }],
    secondary: [
      { account: 'United Explorer', amount: 4_200, bucket: 'secondary' },
      { account: 'Freedom Flex', amount: 2_100, bucket: 'secondary' }
    ],
    overflow: [{ account: 'Ink Business', amount: 1_400, bucket: 'overflow' }]
  },
  conditionalPayments: [
    { account: 'Southwest Priority', amount: 3_100 },
    { account: 'United Explorer', amount: 2_000 }
  ],
  executionTotals: {
    fromCash: 21_550,
    fromHeloc: 4_000,
    totalNow: 25_550,
    conditionalLater: 6_200
  },
  decisionBox: {
    'Can I make an extra payment?': 'Yes — up to $25,550 now',
    'Use HELOC?': 'Optional with approval',
    'Hold cash instead?': 'No — reserve intact',
    'Small balance targets': 'Store Card A, Store Card B',
    'Focus debt': 'Southwest Priority',
    'Optimized for interest?': 'Yes'
  },
  next3Months: [
    { month: 'May 2026', focus: 'Southwest + small balance drift', detail: 'Reserve steady' },
    { month: 'Jun 2026', focus: 'Focus debt on United if SW paid', detail: 'Watch variable income' },
    { month: 'Jul 2026', focus: 'Maintain buffer', detail: 'Planned trip cash reserved' }
  ],
  watchouts: [
    'Roof Replacement is card-funded but not mapped; treated as cash risk until mapped.',
    'Near-term planned expenses reduce extra-payment flexibility.',
    'HELOC remains conservative while unmapped near-term expense exists.'
  ],
  snapshot: [
    { account: 'Store Card A', balanceBefore: 900, paymentAppliedNow: 900, balanceAfterNow: 0, status: 'CLOSED' },
    { account: 'Southwest Priority', balanceBefore: 51_200, paymentAppliedNow: 12_400, balanceAfterNow: 38_800, status: '↓ PRIMARY' },
    { account: 'United Explorer', balanceBefore: 18_400, paymentAppliedNow: 4_200, balanceAfterNow: 14_200, status: '↓ SECONDARY' },
    { account: 'Freedom Flex', balanceBefore: 9_100, paymentAppliedNow: 2_100, balanceAfterNow: 7_000, status: '↓ SECONDARY' },
    { account: 'Ink Business', balanceBefore: 22_000, paymentAppliedNow: 1_400, balanceAfterNow: 20_600, status: 'OPEN' }
  ],
  snapshotSummary: {
    accountsClosedNow: 1,
    deployedNow: 25_550,
    primaryReduced: 12_400
  },
  aggressiveMeta: {
    postCleanupExtraPool: 19_200,
    primaryAllocated: 12_400,
    primaryShareOfRemainingPct: 65,
    primaryBelow90: true,
    primaryBelow90Reason: 'Focus debt capped at remaining payoff balance; spill to the next debt was required.'
  },
  plannedExpenseImpact: {
    summary: {
      nearTermCashReserved: 19_000,
      cardFundedModeledLoad: 0,
      unmappedCashRiskHold: 21_000,
      midTermCaution: 4_500
    },
    lines: [
      {
        expense: 'Roof Replacement',
        due: 'Apr 27',
        amount: 21_000,
        fundingType: 'Card-funded',
        executionEffect: 'Temporarily reduces extra debt capacity now',
        planningEffect: 'Conservative cash hold until mapping is assigned',
        status: 'Unmapped — treated as cash risk until mapped',
        variant: 'card-unmapped'
      },
      {
        expense: 'Solar Addition',
        due: 'Apr 27',
        amount: 19_000,
        fundingType: 'Cash',
        executionEffect: 'Reserved from deployable cash',
        planningEffect: 'Reduces extra debt capacity now',
        status: 'Reserved in liquidity',
        variant: 'cash'
      },
      {
        expense: 'Fence Replace',
        due: 'Jun 30',
        amount: 4_500,
        fundingType: 'Mid-term',
        executionEffect: 'Not deducted today',
        planningEffect: 'Future caution within 90 days',
        status: 'Watch',
        variant: 'mid-term'
      }
    ],
    unmappedCardWarning: 'Roof Replacement is card-funded but not mapped; treated as cash risk until mapped.'
  },
  snapshotExecuteNowOnly: true,
  waterfallExecutionValidated: 'PASS',
  executeNowSourceValidated: 'PASS',
  snapshotStatusValidated: 'PASS'
};
