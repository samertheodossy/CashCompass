/**
 * Rolling Debt Payoff dashboard — React + TypeScript + inline styles only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

// —— Types (single export each) ————————————————————————————————————————

/**
 * Presentation mode controls how much detail the dashboard renders. It is
 * orthogonal to {@link PayoffStrategy}. The legacy `'operator'` and
 * `'aggressive'` tab values are still accepted on input (see
 * {@link normalizeModeFromSummary}) but map to the new model:
 *   - `'operator'`   → presentation `'advanced'`, strategy `'standard'`
 *   - `'aggressive'` → presentation `'advanced'`, strategy `'aggressive'`
 */
export type ExecutionPresentationMode = 'standard' | 'advanced' | 'automation';

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
 * Main user-facing cash bridge: mirrors the top KPI row (Total cash → Execute now).
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
        to <strong>Deployable max</strong>, then your <strong>Cash to use now</strong> and the
        capped <strong>Execute now</strong> the waterfall actually uses.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {row('1', 'Total cash', currency(totalCashDisplay))}
        {row('2', 'Minus reserve', `−${currency(reserveDisplay)}`)}
        {row('3', 'Minus buffer', `−${currency(bufferDisplay)}`)}
        {row('4', 'Minus near-term planned hold', `−${currency(nearTermPlannedHoldDisplay)}`)}
        {row('5', 'Minus unmapped card risk hold', `−${currency(unmappedCardRiskHoldDisplay)}`)}
        {row('6', '= Deployable max', currency(deployableMaxDisplay), true)}
        {row('7', 'Cash to use now (user input)', currency(cashToUseNowInput))}
        {row('8', '= Execute now', currency(executeNowDisplay), true)}
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
          Requested amount exceeds deployable max; execute-now amount capped to{' '}
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
              {row('10', '= Final execute-now cash', currency(bridge.finalExecuteNowCash))}
              {row(
                '—',
                'Legacy monthly cap (retired — user input now bounds this)',
                currency(bridge.monthlyExecutionCap)
              )}
              {row(
                '—',
                'Execute-now budget (= final execute-now cash)',
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
          {' '}deployable max. Backend pre-planned the full waterfall for{' '}
          <strong>{currency(audit.allocatedExecuteNowCashTotal)}</strong>; dashboard scales the extra-payment
          buckets down client-side to match Execute now. This is expected — not drift.
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
          DRIFT: allocator total {currency(audit.allocatedExecuteNowCashTotal)} ≠ displayed execute-now{' '}
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
          Allocator vs budget gap {currency(gapToBudget)} (allocated {currency(audit.allocatedExecuteNowCashTotal)} vs
          budget {currency(audit.month0ExecuteNowBudget)}).
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {row('Cleanup allocated', currency(audit.allocatedCleanupTotal))}
        {row('Primary allocated', currency(audit.allocatedPrimaryTotal))}
        {row('Secondary allocated', currency(audit.allocatedSecondaryTotal))}
        {row('Overflow allocated', currency(audit.allocatedOverflowTotal))}
        {row('Total allocated (execute-now cash)', currency(audit.allocatedExecuteNowCashTotal), true)}
        {row('Execute-now budget', currency(audit.month0ExecuteNowBudget), true)}
        {row('Gap to budget (budget − allocated)', currency(audit.allocationGapToBudget))}
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
          has no more per-account payoff capacity to absorb the extra — execute-now total is
          capped at the allocated amount until the planner re-runs.
        </p>
      ) : exceedsDeployable ? (
        <p style={{ margin: '12px 0 0 0', fontSize: 12, color: C.warn, fontWeight: 700, lineHeight: 1.45 }}>
          Input exceeds deployable max; execute-now is capped to {currencyDetailed(deployableMax)}.
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

const PRESENTATION_MODES: ExecutionPresentationMode[] = ['standard', 'advanced', 'automation'];
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

function KpiCard({
  label,
  value,
  sub,
  borderAccent
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  borderAccent?: 'deployable' | 'extra';
}) {
  const borderColor =
    borderAccent === 'deployable' ? 'rgba(13, 125, 77, 0.35)' : borderAccent === 'extra' ? 'rgba(180, 83, 9, 0.4)' : C.border;
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
        <p style={{ margin: '8px 0 0 0', fontSize: 11, color: C.muted, lineHeight: 1.35 }}>{sub}</p>
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
 *   - quick-action chips (Clear, 25 %, 50 %, 75 %, Use max) that snap the value
 *   - helper text + "Max deployable: $X" note
 *   - cap warning shown inline when the user exceeds deployable max
 *
 * The card consumes and emits raw strings so parent can keep the canonical parse
 * (see `parseUserNumber`); parent owns the source of truth and derives Execute Now.
 */
function CashToUseNowInputCard({
  label,
  helperText,
  inputValue,
  onChange,
  deployableMax,
  capWarning,
  placeholder,
  suggestedValue,
  executeNow,
  remainingDeployable
}: {
  label: string;
  helperText: string;
  inputValue: string;
  onChange: (raw: string) => void;
  deployableMax: number;
  capWarning?: string;
  placeholder?: string;
  suggestedValue?: number | null;
  executeNow?: number;
  remainingDeployable?: number;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = capWarning
    ? C.danger
    : focused
    ? C.primaryHi
    : C.primary;
  const accentBg = capWarning
    ? 'rgba(220, 38, 38, 0.05)'
    : focused
    ? 'rgba(30, 58, 95, 0.06)'
    : 'rgba(30, 58, 95, 0.04)';
  const maxRounded = Math.max(0, Math.round(deployableMax));
  const setPercent = (p: number) => {
    const v = Math.max(0, Math.round((deployableMax * p) / 100));
    onChange(String(v));
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
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    lineHeight: 1.2,
    fontVariantNumeric: 'tabular-nums'
  };
  const primaryChipStyle: React.CSSProperties = {
    ...chipStyle,
    background: C.primary,
    color: '#ffffff',
    borderColor: C.primary
  };
  return (
    <div
      style={{
        minHeight: 124,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        background: accentBg,
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: focused ? '0 0 0 3px rgba(30, 58, 95, 0.12)' : '0 1px 2px rgba(15,23,42,0.06)',
        transition: 'box-shadow 120ms ease, border-color 120ms ease, background 120ms ease',
        gridColumn: 'span 2'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.primaryHi }}>
          {label}
        </p>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#ffffff',
            background: C.primary,
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
          border: `2px solid ${capWarning ? C.danger : focused ? C.primaryHi : C.primary}`,
          borderRadius: 10,
          padding: '10px 14px',
          boxShadow: focused ? 'inset 0 0 0 2px rgba(30, 58, 95, 0.18)' : 'none',
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
          onBlur={() => setFocused(false)}
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button type="button" style={chipStyle} onClick={() => onChange('0')} aria-label="Clear cash to use now">
          Clear
        </button>
        <button type="button" style={chipStyle} onClick={() => setPercent(25)} aria-label="Use 25% of deployable max">
          25%
        </button>
        <button type="button" style={chipStyle} onClick={() => setPercent(50)} aria-label="Use 50% of deployable max">
          50%
        </button>
        <button type="button" style={chipStyle} onClick={() => setPercent(75)} aria-label="Use 75% of deployable max">
          75%
        </button>
        <button type="button" style={primaryChipStyle} onClick={() => onChange(String(maxRounded))} aria-label="Use deployable max">
          Use max
        </button>
        {showSuggestion ? (
          <button
            type="button"
            style={chipStyle}
            onClick={() => onChange(String(suggestionRounded))}
            aria-label={`Use suggested amount ${currency(suggestionRounded as number)}`}
            title="Suggested by planner (backend execute-now budget)"
          >
            Use suggested ({currency(suggestionRounded as number)})
          </button>
        ) : null}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {capWarning ? (
          <p style={{ margin: 0, fontSize: 12, color: C.danger, fontWeight: 700, lineHeight: 1.4 }}>
            {capWarning}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
            {helperText}
            {' · '}
            <span style={{ color: C.text, fontWeight: 700 }}>
              Max deployable: {currency(deployableMax)}
            </span>
          </p>
        )}
        {executeNow != null ? (
          <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
            <span aria-hidden>→</span>{' '}
            <span style={{ fontWeight: 700, color: C.text }}>Execute now {currency(executeNow)}</span>
            {remainingDeployable != null && remainingDeployable > 0.005 ? (
              <>
                {' · '}
                Remaining deployable {currency(remainingDeployable)}
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Result / effect card rendered next to `CashToUseNowInputCard`. Visually it's the
 * direct consequence of the input so the relationship is obvious (cause → effect).
 * Renders:
 *   - Execute now value (capped at Deployable max)
 *   - Live formula `min(Cash to use now, Deployable max)` with the current values
 *   - "Capped" badge if the user requested more than Deployable max
 *   - Remaining deployable note
 *
 * This card is driven from the same canonical display model that feeds extra-payment
 * buckets, snapshot, execution totals, aggressive panel and allocation audit, so any
 * typed value flows here and downstream in a single tick.
 */
function ExecuteNowResultCard({
  executeNow,
  cashToUseNowRaw,
  deployableMax,
  exceedsDeployable,
  remainingDeployable
}: {
  executeNow: number;
  cashToUseNowRaw: number;
  deployableMax: number;
  exceedsDeployable: boolean;
  remainingDeployable: number;
}) {
  const borderColor = exceedsDeployable ? C.danger : 'rgba(180, 83, 9, 0.55)';
  const bg = exceedsDeployable ? 'rgba(220, 38, 38, 0.05)' : 'rgba(180, 83, 9, 0.05)';
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
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.06)'
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
          Execute now
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
            aria-label="Execute now is capped at deployable max"
          >
            Capped
          </span>
        ) : null}
      </div>
      <p
        style={{
          margin: '2px 0 0 0',
          fontSize: 28,
          fontWeight: 800,
          color: C.text,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15
        }}
      >
        {currency(executeNow)}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
        Amount the planner will actually deploy after caps.
      </p>
      <div style={{ flex: 1, minHeight: 2 }} aria-hidden />
      <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>
        = min(<span style={{ color: C.text, fontWeight: 700 }}>{currency(cashToUseNowRaw)}</span>,{' '}
        <span style={{ color: C.text, fontWeight: 700 }}>{currency(deployableMax)}</span>)
      </p>
      {remainingDeployable > 0.005 ? (
        <p style={{ margin: 0, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
          Remaining deployable after Execute now:{' '}
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
  const base: React.CSSProperties = { display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800 };
  if (status === 'CLOSED') return <span style={{ ...base, background: C.successBg, color: C.success }}>{status}</span>;
  if (status.includes('PRIMARY')) return <span style={{ ...base, background: '#e0e7ff', color: C.primary }}>{status}</span>;
  if (status.includes('SECONDARY')) return <span style={{ ...base, background: '#ede9fe', color: '#5b21b6' }}>{status}</span>;
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
  const bucketLabel = bucketKey.toUpperCase();
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
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.text }}>Post-payment snapshot — execute-now payments only</h3>
        <p style={{ margin: '6px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
          Balances and payments in this table are execute-now extras and minimum sequencing only — not modeled month-end balances.
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
          <strong style={{ color: C.text }}>{currency(summary.deployedNow)}</strong> deployed now · Primary reduced by{' '}
          <strong style={{ color: C.text }}>{currency(summary.primaryReduced)}</strong>
        </div>
      ) : null}
    </div>
  );
}

function OperatorChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const toggle = useCallback((id: string) => {
    setDone((d) => ({ ...d, [id]: !d[id] }));
  }, []);
  const items = [
    { id: 'min', label: 'Pay all minimums' },
    { id: 'cleanup', label: 'Pay cleanup balances' },
    { id: 'primary', label: 'Pay primary allocation' },
    { id: 'secondary', label: 'Pay secondary allocation' },
    { id: 'cond', label: 'Review conditional income' }
  ];
  return (
    <div style={{ border: '1px solid rgba(180, 83, 9, 0.35)', borderRadius: 12, background: C.warnBg, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.warn }}>Execution checklist</h3>
      <ul style={{ listStyle: 'none', margin: '16px 0 0 0', padding: 0 }}>
        {items.map((it) => (
          <li key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <button
              type="button"
              aria-pressed={!!done[it.id]}
              onClick={() => toggle(it.id)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                border: done[it.id] ? 'none' : `2px solid ${C.border}`,
                background: done[it.id] ? C.success : C.paper,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 800,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {done[it.id] ? '✓' : ''}
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, textDecoration: done[it.id] ? 'line-through' : 'none', color: done[it.id] ? C.muted : C.text }}>
              {it.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function strategyNoChangeReasonLabel(reason: StrategyNoChangeReason): string {
  switch (reason) {
    case 'cleanup_consumed_budget':
      return 'Cleanup consumed the entire execute-now budget, so there was no post-cleanup pool for Aggressive to concentrate.';
    case 'no_secondary_pool':
      return 'No secondary pool existed this month — Standard and Aggressive both send 100% to the primary target.';
    case 'primary_balance_capped':
      return 'Primary target was balance-capped, so Aggressive could not reach its 90% target and spill went to secondary — same result as Standard.';
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
        Strategy comparison — post-cleanup pool {currency(cmp.postCleanupPool)}
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
            {currency(cmp.stdPrimaryTarget)} to primary / {currency(cmp.stdSecondaryTarget)} to secondary
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontWeight: 600 }}>Aggressive actual</p>
          <p style={{ margin: '4px 0 0 0', fontSize: 14, color: C.text, fontWeight: 700 }}>
            {currency(cmp.actualPrimary)} to primary / {currency(cmp.actualSecondary)} to secondary
          </p>
        </div>
      </div>
      {!changed ? (
        <p style={{ margin: '10px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          Aggressive payoff produced the same allocation this month because cleanup consumed the
          budget or the primary target was balance-capped.
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
    meta.primaryBelow90Reason || 'Primary capped at remaining payoff balance; spill to secondary was required.';
  const genericMsg =
    'Primary share is below 90% without a confirmed payoff cap — review the concentration audit in the full plan output.';
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
          { k: 'Post-cleanup pool', v: currency(cmp.postCleanupPool) },
          { k: 'Standard primary target (75%)', v: currency(cmp.stdPrimaryTarget) },
          { k: 'Aggressive primary target (90%)', v: currency(cmp.aggPrimaryTarget) },
          { k: 'Primary actually allocated', v: currency(cmp.actualPrimary) },
          { k: 'Primary share (of remainder)', v: `${meta.primaryShareOfRemainingPct.toFixed(0)}%` }
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
          <strong>Did not reach the 90% target.</strong> Actual primary is
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
        These amounts are <strong>not</strong> included in execute-now calculations until received.
        Shown here for visibility only and will not affect the Execute-now totals or the payment
        buckets above.
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
        If variable income arrives, these amounts follow the same strict serial waterfall as
        execute-now (cleanup → primary APR → CitiAA → Southwest → Marriott → overflow).
      </p>
    </details>
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
  strategy: PayoffStrategy | null;
};

/**
 * Parse the backend `summary.executionPlanMode` string into a
 * presentation + strategy pair. The server historically emits a
 * space/comma-separated list (e.g. `"aggressive automation"`). Legacy
 * single values `"operator"` / `"aggressive"` are mapped into the new
 * orthogonal model for backward compatibility.
 */
function normalizeModeFromSummary(raw: string | undefined): NormalizedMode {
  const m = String(raw || '')
    .toLowerCase()
    .trim();
  if (!m) return { presentation: null, strategy: null };
  const tokens = m.split(/[\s,|]+/).filter(Boolean);

  let presentation: ExecutionPresentationMode | null = null;
  let strategy: PayoffStrategy | null = null;

  for (const t of tokens) {
    if (t === 'automation') presentation = 'automation';
    else if (t === 'advanced' || t === 'operator') {
      // Map legacy operator → advanced (do not downgrade 'automation' if already set).
      if (presentation !== 'automation') presentation = 'advanced';
    } else if (t === 'standard') {
      if (presentation == null) presentation = 'standard';
      if (strategy == null) strategy = 'standard';
    } else if (t === 'aggressive') {
      // Aggressive is a STRATEGY; legacy usage also implied the advanced
      // presentation (audit panels). Preserve that implication when no
      // explicit presentation was set.
      strategy = 'aggressive';
      if (presentation == null) presentation = 'advanced';
    }
  }

  return { presentation, strategy };
}

export function RollingDebtPayoffDashboard({
  data: dataProp,
  useDemoFallback = true,
  defaultPresentationMode = 'standard',
  onPresentationModeChange,
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
  const isAdvanced = presentationMode === 'advanced';
  const isAggressiveStrategy = payoffStrategy === 'aggressive';

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
          <h1 style={{ margin: '4px 0 0 0', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.02em' }}>Rolling debt payoff</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', marginTop: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, border: `1px solid ${C.primary}`, color: C.primary }}>Plan: {data.summary.planStatus}</span>
            <span style={{ fontSize: 14, color: C.muted }}>
              Anchor <strong style={{ color: C.text }}>{data.summary.anchorMonth}</strong>
            </span>
            <span style={{ fontSize: 14, color: C.muted }}>
              Confidence <strong style={{ color: C.text }}>{data.summary.confidence}</strong>
            </span>
            <span style={{ fontSize: 14, color: C.muted }}>
              Presentation{' '}
              <strong style={{ color: C.text, textTransform: 'capitalize' }}>
                {presentationMode}
              </strong>
            </span>
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 12,
            marginBottom: 14,
            alignItems: 'stretch'
          }}
        >
          <KpiCard
            label="Total cash"
            value={currency(data.liquidity.totalCash)}
            sub="Full liquid total (all cash + checking + savings)"
          />
          <KpiCard
            label="Reserve"
            value={currency(data.liquidity.reserveTarget)}
            sub="DO_NOT_TOUCH accounts"
          />
          <KpiCard
            label="Buffer"
            value={currency(data.liquidity.buffer)}
            sub="Per-account min buffers"
          />
          <KpiCard
            label="Cash available to use"
            value={currency(
              Math.max(
                0,
                round2(
                  (Number(data.liquidity.totalCash) || 0) -
                    (Number(data.liquidity.reserveTarget) || 0) -
                    (Number(data.liquidity.buffer) || 0)
                )
              )
            )}
            sub="Total cash − reserve − buffer (before near-term / unmapped holds)"
          />
          <KpiCard
            label="Near-term planned hold"
            value={currency(Number(data.liquidity.nearTermPlannedCashHold) || 0)}
            sub="Reserved for upcoming cash expenses"
          />
          <KpiCard
            label="Unmapped card risk hold"
            value={currency(Number(data.liquidity.unmappedCardRiskHold) || 0)}
            sub="Temporary safety hold for unmapped card expenses"
          />
          <KpiCard
            label="Deployable max"
            value={currency(deployableMax)}
            borderAccent="deployable"
            sub="Total − reserve − buffer − near-term − unmapped"
          />
        </div>

        {/**
         * Cause → Effect pair. The left (input) card is the user-owned Cash to use now
         * control; the right (result) card is the derived Execute now amount the planner
         * will actually deploy. Both cards read from the same canonical display model,
         * so a keystroke in the input immediately flows through executeNow, the extra
         * payment buckets, the post-payment snapshot, execution totals, the aggressive
         * panel, allocation audit, and debug/automation blocks.
         */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 2fr) minmax(220px, 1fr)',
            gap: 14,
            marginBottom: 16,
            alignItems: 'stretch'
          }}
        >
          <CashToUseNowInputCard
            label="Cash to use now"
            helperText="How much cash do you want to use this month?"
            inputValue={cashToUseNowInput}
            onChange={setCashToUseNowInput}
            deployableMax={deployableMax}
            capWarning={
              exceedsDeployable
                ? `Input exceeds deployable max. Execute now is capped at ${currency(deployableMax)}.`
                : undefined
            }
            suggestedValue={
              data.liquidity.month0ExecuteNowBudget != null &&
              Number.isFinite(data.liquidity.month0ExecuteNowBudget) &&
              data.liquidity.month0ExecuteNowBudget > 0.005 &&
              data.liquidity.month0ExecuteNowBudget < deployableMax - 0.5
                ? Math.min(data.liquidity.month0ExecuteNowBudget, deployableMax)
                : null
            }
            executeNow={executeNow}
            remainingDeployable={Math.max(0, round2(deployableMax - executeNow))}
          />
          <ExecuteNowResultCard
            executeNow={executeNow}
            cashToUseNowRaw={cashToUseNowRaw}
            deployableMax={deployableMax}
            exceedsDeployable={exceedsDeployable}
            remainingDeployable={Math.max(0, round2(deployableMax - executeNow))}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 14,
            marginBottom: 36,
            alignItems: 'stretch'
          }}
        >
          <KpiCard label="HELOC recommended" value={data.liquidity.helocRecommended} sub="Execution stance" />
        </div>

        {/**
         * Cash bridge (audit) and Allocation audit (month 0) are debug-grade views for
         * operators/analysts — hidden in Standard presentation to reduce noise. They render
         * in Advanced presentation, and Automation presentation emits equivalent structured
         * blocks further down. The "Future / Conditional Cash" and top-row KPIs already
         * carry the information a normal user needs.
         */}
        {!isAutomation && isAdvanced ? (
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

        {!isAutomation && isAdvanced && data.allocationAudit ? (
          <AllocationAuditSection
            audit={data.allocationAudit}
            displayedExecuteNow={displayExecutionTotals.fromCash}
            userCashToUseNowInput={displayExecutionPlan.cashToUseNowInput}
            deployableMax={displayExecutionPlan.deployableMax}
          />
        ) : null}

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
          visible={!isAutomation && (isAdvanced || !displayExecutionPlan.validation.isConsistent)}
        />

        {!isAutomation && data.plannedExpenseImpact && data.plannedExpenseImpact.lines.length ? (
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
            <AutomationBlock title="decision_box" body={Object.entries(data.decisionBox)
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
        ) : (
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
              <SectionTitle>Extra payments (execute now)</SectionTitle>
              <p style={{ margin: '0 0 22px 0', fontSize: 14, color: C.muted, lineHeight: 1.55 }}>
                Total execute-now extras: <strong style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{currency(extraTotal)}</strong>
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
                  <ProgressBar label="Cleanup share of extras" valuePct={pct(cleanupSum, extraTotal)} />
                  <ProgressBar label="Primary share of extras" valuePct={pct(primarySum, extraTotal)} />
                  <ProgressBar label="Secondary share of extras" valuePct={pct(secondarySum, extraTotal)} />
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                  gap: 20,
                  alignItems: 'stretch'
                }}
              >
                <ExtraBucketCard title="1 · Cleanup" lines={displayExtras.cleanup} totalExtra={extraTotal} bucketKey="cleanup" />
                <ExtraBucketCard
                  title="2 · Primary"
                  lines={displayExtras.primary}
                  totalExtra={extraTotal}
                  bucketKey="primary"
                  footerNote="Primary must be fully paid before secondary allocation begins."
                />
                <ExtraBucketCard
                  title="3 · Secondary"
                  lines={displayExtras.secondary}
                  totalExtra={extraTotal}
                  bucketKey="secondary"
                  footerNote="Secondary waterfall: CitiAA → Southwest → Marriott."
                />
                <ExtraBucketCard title="4 · Overflow" lines={displayExtras.overflow} totalExtra={extraTotal} bucketKey="overflow" />
              </div>
              {data.strictWaterfallSplitNote ? (
                <p style={{ margin: '16px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5, fontStyle: 'italic' }}>
                  {data.strictWaterfallSplitNote}
                </p>
              ) : null}
              {isAggressiveStrategy ? (
                <StrategyComparisonNote cmp={displayExecutionPlan.strategyComparison} />
              ) : null}
            </div>

            {isAggressiveStrategy && displayAggressiveMeta ? (
              <AggressivePanel
                meta={displayAggressiveMeta}
                cmp={displayExecutionPlan.strategyComparison}
                totalExtraCash={extraTotal}
              />
            ) : null}
            {isAdvanced ? <OperatorChecklist /> : null}

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
                    { k: 'From cash (Execute now)', v: currency(displayExecutionTotals.fromCash), h: false },
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
                {Object.entries(data.decisionBox).map(([q, a]) => (
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
        )}
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
    'Cleanup targets': 'Store Card A, Store Card B',
    'Primary debt': 'Southwest Priority',
    'Optimized for interest?': 'Yes'
  },
  next3Months: [
    { month: 'May 2026', focus: 'Southwest + cleanup drift', detail: 'Reserve steady' },
    { month: 'Jun 2026', focus: 'Primary on United if SW paid', detail: 'Watch variable income' },
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
    primaryBelow90Reason: 'Primary capped at remaining payoff balance; spill to secondary was required.'
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
