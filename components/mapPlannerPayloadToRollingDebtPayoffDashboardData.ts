/**
 * Maps Apps Script `getRollingDebtPayoffPlan` JSON into RollingDebtPayoffDashboardData.
 * Snapshot rows mirror server `buildPostPaymentSnapshotLines_` (execute-now + HELOC to target only).
 */

import type {
  CardSpendConfidence,
  CardSpendEstimationMethod,
  ExecutionPresentationMode,
  HelocAdvisorDebt,
  HelocAdvisorSnapshot,
  PlannedExpenseImpactBlock,
  PlannedExpenseImpactRow,
  PlannedExpenseImpactRowVariant,
  RollingDebtPayoffAllocationAudit,
  RollingDebtPayoffCashBridge,
  RollingDebtPayoffDashboardData,
  SnapshotRow
} from './RollingDebtPayoffDashboard';

const HELOC_MIN_MONTHLY_DRAW = 1000;
const PHASE2_PRIMARY_FRACTION = 0.9;
const RECONCILE_EPS = 0.15;
/** Waterfall snapshot: per-row rounding vs execution_total_now — $0.15 is too tight for many-account totals. */
const RECONCILE_WF_MIN_EPS = 5;
const VALIDATION_EPS = 0.05;

function buildCashBridgeFromLiquidity(liq: Record<string, unknown>): RollingDebtPayoffCashBridge | null {
  if (liq.liquid_total_sheet == null || liq.liquid_total_sheet !== liq.liquid_total_sheet) return null;
  const warns = (liq.cash_bridge_validation_warnings as unknown[] | undefined)?.map((w) => String(w || '').trim()).filter(Boolean);
  return {
    liquidTotalSheet: round2(num(liq.liquid_total_sheet)),
    doNotTouchExcludedCash: round2(num(liq.do_not_touch_excluded_cash)),
    policyEligibleCashBeforeBuffers: round2(num(liq.policy_eligible_cash_before_buffers)),
    unsupportedPolicyBalanceTotal:
      liq.unsupported_policy_balance_total != null && liq.unsupported_policy_balance_total === liq.unsupported_policy_balance_total
        ? round2(num(liq.unsupported_policy_balance_total))
        : undefined,
    policyScopedBalanceTotal:
      liq.policy_scoped_balance_total != null && liq.policy_scoped_balance_total === liq.policy_scoped_balance_total
        ? round2(num(liq.policy_scoped_balance_total))
        : undefined,
    accountMinBuffersTotal: round2(num(liq.account_min_buffers_total)),
    totalUsableCash: round2(num(liq.total_usable_cash)),
    bridgeLinearSubtotalAfterBuffers:
      liq.bridge_linear_subtotal_after_buffers != null && liq.bridge_linear_subtotal_after_buffers === liq.bridge_linear_subtotal_after_buffers
        ? round2(num(liq.bridge_linear_subtotal_after_buffers))
        : undefined,
    bridgePerAccountFloorDelta:
      liq.bridge_per_account_floor_delta != null && liq.bridge_per_account_floor_delta === liq.bridge_per_account_floor_delta
        ? round2(num(liq.bridge_per_account_floor_delta))
        : undefined,
    reserveHold: round2(num(liq.reserve_hold)),
    globalBufferHold: round2(num(liq.global_buffer_hold)),
    nearTermPlannedCashHold: round2(num(liq.near_term_planned_cash_hold)),
    unmappedCardRiskHold: round2(num(liq.unmapped_card_risk_hold)),
    finalExecuteNowCash: round2(num(liq.final_execute_now_cash)),
    monthlyExecutionCap: round2(num(liq.monthly_execution_cap)),
    executableNowBudget: round2(num(liq.executable_now_budget)),
    month0ExecuteNowBudget:
      liq.month0_execute_now_budget != null && liq.month0_execute_now_budget === liq.month0_execute_now_budget
        ? round2(num(liq.month0_execute_now_budget))
        : round2(num(liq.executable_now_budget)),
    cashBridgeValidationWarnings: warns && warns.length ? warns : undefined
  };
}

/**
 * Maps server month-0 `allocation_audit` block onto the dashboard shape, with a small
 * backfill: if the backend did not attach the object (older payloads), we leave the block
 * empty so the UI skips rendering. The dashboard uses this only for debug drift warnings.
 */
function buildAllocationAuditBlock(
  row0: Record<string, unknown> | null | undefined,
  month0ExecuteNowBudget: number | null
): RollingDebtPayoffAllocationAudit | null {
  if (!row0 || typeof row0 !== 'object') return null;
  const audit = row0.allocation_audit as Record<string, unknown> | null | undefined;
  if (!audit || typeof audit !== 'object') return null;
  const warnings = ((audit.warnings as unknown[] | undefined) || [])
    .map((w) => String(w || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const budget =
    audit.month0_execute_now_budget != null && audit.month0_execute_now_budget === audit.month0_execute_now_budget
      ? round2(num(audit.month0_execute_now_budget))
      : month0ExecuteNowBudget != null
      ? month0ExecuteNowBudget
      : 0;
  const allocatedTotal = round2(num(audit.allocated_execute_now_cash_total));
  return {
    allocatedCleanupTotal: round2(num(audit.allocated_cleanup_total)),
    allocatedPrimaryTotal: round2(num(audit.allocated_primary_total)),
    allocatedSecondaryTotal: round2(num(audit.allocated_secondary_total)),
    allocatedOverflowTotal: round2(num(audit.allocated_overflow_total)),
    allocatedExecuteNowCashTotal: allocatedTotal,
    month0ExecuteNowBudget: budget,
    allocationGapToBudget:
      audit.allocation_gap_to_budget != null && audit.allocation_gap_to_budget === audit.allocation_gap_to_budget
        ? round2(num(audit.allocation_gap_to_budget))
        : round2(budget - allocatedTotal),
    warnings: warnings.length ? warnings : undefined
  };
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function num(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

type ExecBuckets = {
  cleanup: { name: string; amt: number }[];
  primary: { name: string; amt: number }[];
  secondary: { name: string; amt: number }[];
  overflow: { name: string; amt: number }[];
};

function buildExecutionExtraBuckets(
  eca: Record<string, unknown> | null | undefined,
  execCashMap: Record<string, number>,
  planInvalid: boolean
): ExecBuckets {
  const cleanup: { name: string; amt: number }[] = [];
  const primary: { name: string; amt: number }[] = [];
  const secondary: { name: string; amt: number }[] = [];
  const overflow: { name: string; amt: number }[] = [];
  if (planInvalid) {
    return { cleanup, primary, secondary, overflow };
  }
  const assigned: Record<string, boolean> = Object.create(null);
  function amtFor(nm: string): number {
    return round2(num(execCashMap[nm]));
  }
  if (eca) {
    const ci = (eca.cleanup_items as { name?: string; amount?: unknown }[] | undefined) || [];
    ci.forEach((c) => {
      const nm = str(c?.name);
      if (!nm) return;
      let a = amtFor(nm);
      if (a <= 0.005 && c && c.amount != null && num(c.amount) > 0.005) {
        a = round2(num(c.amount));
      }
      if (a <= 0.005) return;
      assigned[nm] = true;
      cleanup.push({ name: nm, amt: a });
    });

    const hasStrictPrimary =
      eca && Object.prototype.hasOwnProperty.call(eca, 'concentration_primary_items');
    const pItems = (eca.concentration_primary_items as { name?: string; amount?: unknown }[] | undefined) || [];
    const sItems = (eca.concentration_secondary_items as { name?: string; amount?: unknown }[] | undefined) || [];

    if (hasStrictPrimary) {
      const pushBucket = (items: { name?: string; amount?: unknown }[], bucket: { name: string; amt: number }[]) => {
        items.forEach((it) => {
          const nm = str(it?.name);
          if (!nm) return;
          let a = amtFor(nm);
          const amti = it?.amount;
          if (a <= 0.005 && amti != null && num(amti) > 0.005) {
            a = round2(num(amti));
          }
          if (a <= 0.005) return;
          assigned[nm] = true;
          bucket.push({ name: nm, amt: a });
        });
      };
      pushBucket(pItems, primary);
      pushBucket(sItems, secondary);
    } else {
      const conc = (eca.concentration_items as { name?: string; amount?: unknown }[] | undefined) || [];
      if (conc.length >= 1) {
        const nm0 = str(conc[0]?.name);
        let a0 = amtFor(nm0);
        const amt0 = conc[0]?.amount;
        if (a0 <= 0.005 && amt0 != null && num(amt0) > 0.005) {
          a0 = round2(num(amt0));
        }
        if (a0 > 0.005) {
          assigned[nm0] = true;
          primary.push({ name: nm0, amt: a0 });
        }
      }
      for (let i = 1; i < conc.length; i++) {
        const nm = str(conc[i]?.name);
        let a = amtFor(nm);
        const amti = conc[i]?.amount;
        if (a <= 0.005 && amti != null && num(amti) > 0.005) {
          a = round2(num(amti));
        }
        if (a <= 0.005) continue;
        assigned[nm] = true;
        secondary.push({ name: nm, amt: a });
      }
    }
  }
  Object.keys(execCashMap || {}).forEach((k) => {
    if (assigned[k]) return;
    const a = amtFor(k);
    if (a <= 0.005) return;
    overflow.push({ name: k, amt: a });
  });
  overflow.sort((a, b) => a.name.localeCompare(b.name));
  return { cleanup, primary, secondary, overflow };
}

/** When server sends per-account waterfall snapshot with `phase`, drive execute-now cards from real trace (not modeled buckets). */
function buildExtraPaymentsFromWaterfallSnapshot(
  wfSnap:
    | {
        account?: string;
        payment_applied_now?: unknown;
        phase?: string;
      }[]
    | undefined
): ExecBuckets | null {
  if (!wfSnap || !Array.isArray(wfSnap) || !wfSnap.length) return null;
  const hasPhase = wfSnap.some((r) => {
    const p = str(r?.phase || '');
    return p === 'cleanup' || p === 'primary' || p === 'secondary' || p === 'overflow';
  });
  if (!hasPhase) return null;
  const cleanup: { name: string; amt: number }[] = [];
  const primary: { name: string; amt: number }[] = [];
  const secondary: { name: string; amt: number }[] = [];
  const overflow: { name: string; amt: number }[] = [];
  for (const r of wfSnap) {
    const account = str(r?.account);
    const amt = round2(num(r?.payment_applied_now));
    if (!account || amt <= 0.005) continue;
    const ph = str(r?.phase || '');
    const line = { name: account, amt };
    if (ph === 'cleanup') cleanup.push(line);
    else if (ph === 'primary') primary.push(line);
    else if (ph === 'secondary') secondary.push(line);
    else if (ph === 'overflow') overflow.push(line);
  }
  return { cleanup, primary, secondary, overflow };
}

function rollingAggressiveCashExtrasReconcile(buckets: ExecBuckets, execCashDisplayed: number) {
  const c = buckets.cleanup.reduce((s, x) => round2(s + x.amt), 0);
  const p = buckets.primary.reduce((s, x) => round2(s + x.amt), 0);
  const sec = buckets.secondary.reduce((s, x) => round2(s + x.amt), 0);
  const o = buckets.overflow.reduce((s, x) => round2(s + x.amt), 0);
  const sumLines = round2(c + p + sec + o);
  const remaining = round2(execCashDisplayed - c);
  const nonCleanup = round2(p + sec + o);
  const primarySharePct =
    remaining > 0.005 ? round2((100 * p) / remaining) : p > 0.005 ? 100 : 0;
  return {
    cleanup_cash: c,
    primary_cash: p,
    secondary_cash: sec,
    overflow_cash: o,
    remaining_after_cleanup: remaining,
    non_cleanup_sum: nonCleanup,
    primary_share_of_remaining_pct: primarySharePct,
    sum_lines_matches_exec: Math.abs(sumLines - round2(execCashDisplayed)) <= 0.15,
    remaining_matches_buckets: Math.abs(nonCleanup - remaining) <= 0.15
  };
}

type Phase2Pass = {
  R0: number;
  primary_paid: number;
  secondary_paid: number;
  ideal_primary: number;
  cap_primary_at_phase2_start: number;
  primary_capped_at_payoff_balance: boolean;
  primary_name: string;
};

function passPhase2(meta: Record<string, unknown> | null | undefined): Phase2Pass {
  const m = meta || {};
  const R0 = round2(num(m.phase2_R0));
  const paidP = round2(num(m.phase2_primary_paid));
  const paidS = round2(num(m.phase2_secondary_paid));
  const capP = round2(num(m.cap_primary_at_phase2_start));
  const idealP = R0 > 0.005 ? round2(PHASE2_PRIMARY_FRACTION * R0) : 0;
  const wantsMorePrimary = idealP > paidP + 0.5;
  const maxPrimaryThisPass =
    R0 <= 0.005 ? 0 : capP > 0.005 ? round2(Math.min(capP, idealP)) : round2(idealP);
  const primary_capped_at_payoff_balance =
    R0 > 0.005 &&
    wantsMorePrimary &&
    maxPrimaryThisPass > 0.005 &&
    paidP + 0.5 >= maxPrimaryThisPass - 1.0;
  return {
    R0,
    primary_paid: paidP,
    secondary_paid: paidS,
    ideal_primary: idealP,
    cap_primary_at_phase2_start: capP,
    primary_capped_at_payoff_balance,
    primary_name: str(m.phase2_primary_name)
  };
}

function buildAggressivePhase2Audit(
  openMeta: Record<string, unknown> | null | undefined,
  depMeta: Record<string, unknown> | null | undefined
) {
  const o = passPhase2(openMeta);
  const d = passPhase2(depMeta);
  const pool = round2(o.R0 + d.R0);
  const primaryTotal = round2(o.primary_paid + d.primary_paid);
  const secondaryTotal = round2(o.secondary_paid + d.secondary_paid);
  let sharePct = 100;
  if (pool > 0.005) {
    sharePct = round2((primaryTotal / pool) * 100);
  }
  const primary_share_met_target = pool <= 0.005 || sharePct >= 89.5;
  const capped_excuse_applies = o.primary_capped_at_payoff_balance || d.primary_capped_at_payoff_balance;
  const below_target_anomaly = pool > 0.005 && sharePct < 89.5 && !capped_excuse_applies;
  return {
    primary_share_pct: sharePct,
    primary_share_met_target,
    capped_excuse_applies,
    below_target_anomaly
  };
}

function computeExecuteNowSourceValidation(args: {
  canonicalCash: number;
  totalNow: number;
  helocApplied: number;
  liquidityCashRaw: number;
}): { validated: 'PASS' | 'FAIL'; failures: string[] } {
  const failures: string[] = [];
  if (args.helocApplied <= VALIDATION_EPS && Math.abs(args.totalNow - args.canonicalCash) > VALIDATION_EPS) {
    failures.push(`executionTotals.totalNow (${args.totalNow}) ≠ execute-now cash (${args.canonicalCash}) with HELOC 0`);
  }
  if (Math.abs(args.liquidityCashRaw - args.canonicalCash) > VALIDATION_EPS) {
    failures.push(
      `payload liquidity.cash_available_for_extra_debt_today (${args.liquidityCashRaw}) ≠ capped execute-now cash (${args.canonicalCash})`
    );
  }
  return { validated: failures.length ? 'FAIL' : 'PASS', failures };
}

function computeSnapshotStatusValidation(args: {
  snapshot: SnapshotRow[];
  snapshotSummary: RollingDebtPayoffDashboardData['snapshotSummary'] | undefined;
  totalNow: number;
  primaryNm: string;
}): { validated: 'PASS' | 'FAIL'; failures: string[] } {
  const failures: string[] = [];
  const { snapshot, snapshotSummary, totalNow, primaryNm } = args;
  for (const r of snapshot) {
    if (r.status === 'CLOSED' && r.balanceAfterNow > 0.01 + 1e-9) {
      failures.push(`CLOSED with balanceAfterNow ${r.balanceAfterNow}: ${r.account}`);
    }
    if (r.status === '↓ PRIMARY' && (r.paymentAppliedNow <= 0.005 || r.balanceAfterNow <= 0.01 + 1e-9)) {
      failures.push(`PRIMARY status invalid (payment ${r.paymentAppliedNow}, after ${r.balanceAfterNow}): ${r.account}`);
    }
    if (r.status === '↓ SECONDARY' && (r.paymentAppliedNow <= 0.005 || r.balanceAfterNow <= 0.01 + 1e-9)) {
      failures.push(`SECONDARY status invalid (payment ${r.paymentAppliedNow}, after ${r.balanceAfterNow}): ${r.account}`);
    }
  }
  if (snapshotSummary != null && Math.abs(snapshotSummary.deployedNow - totalNow) > VALIDATION_EPS) {
    failures.push(`snapshot deployedNow (${snapshotSummary.deployedNow}) ≠ executionTotals.totalNow (${totalNow})`);
  }
  const closedCount = snapshot.filter((r) => r.balanceAfterNow <= 0.01 + 1e-9 && r.balanceBefore > 0.005).length;
  if (snapshotSummary != null && snapshotSummary.accountsClosedNow !== closedCount) {
    failures.push(`accountsClosedNow (${snapshotSummary.accountsClosedNow}) ≠ rows with after≤0.01 (${closedCount})`);
  }
  if (primaryNm) {
    const pr = snapshot.find((x) => x.account === primaryNm);
    const priAfter = pr ? pr.balanceAfterNow : 0;
    if (priAfter > 0.01 + 1e-9) {
      const secPay = snapshot.some(
        (x) => x.status === '↓ SECONDARY' && x.paymentAppliedNow > 0.005
      );
      if (secPay) {
        failures.push('Secondary payment while primary balanceAfterNow > 0.01');
      }
    }
  }
  return { validated: failures.length ? 'FAIL' : 'PASS', failures };
}

/**
 * Build the read-only HELOC advisor snapshot from either the slim
 * `rolling_dashboard_execution_row` or the first `next_12_months` row. Returns
 * `null` when the planner did not emit advisor data so the UI can hide the
 * advisor section gracefully.
 */
function buildHelocAdvisorSnapshot(
  data: Record<string, unknown>,
  row0: Record<string, unknown>
): HelocAdvisorSnapshot | null {
  const slimRow = data.rolling_dashboard_execution_row as Record<string, unknown> | undefined;
  const slim = (slimRow && slimRow.heloc_advisor_snapshot) as Record<string, unknown> | undefined;
  const fromRow = row0.heloc_advisor_snapshot as Record<string, unknown> | undefined;
  const raw = fromRow || slim;
  if (!raw || typeof raw !== 'object') return null;
  const debtsRaw = Array.isArray(raw.debts) ? (raw.debts as Record<string, unknown>[]) : [];
  const debts: HelocAdvisorDebt[] = debtsRaw
    .map((d) => ({
      name: str(d.name),
      originalName: str(d.original_name) || undefined,
      type: str(d.type),
      balance: round2(num(d.balance)),
      aprPercent: num(d.apr_percent),
      minimumPayment: round2(num(d.minimum_payment))
    }))
    .filter((d) => d.name && d.balance > 0.005);
  const helocAprPercent = num(raw.heloc_apr_percent);
  if (!debts.length && helocAprPercent <= 0) return null;
  const monthlyRecurring = num(
    (raw.monthly_recurring_paydown_capacity as unknown) ??
      (raw.monthly_recurring_paydown_capacity_monthly as unknown) ??
      (raw.recurring_monthly_surplus as unknown)
  );
  const conditionalLump = num(
    (raw.conditional_lump_paydown_capacity as unknown) ??
      (raw.optional_variable_income_capacity as unknown)
  );
  const conditionalNote = str(
    (raw.conditional_lump_frequency_note as unknown) ??
      (raw.optional_variable_income_note as unknown)
  );

  // Upcoming expenses — explicit advisor snapshot field wins; otherwise
  // fall back to near-term CASH-funded planned expenses (the same items the
  // planner already reserves against in `liquidity.near_term_planned_cash_hold`).
  type RawExpense = { label?: unknown; title?: unknown; name?: unknown; amount?: unknown; due_in_days?: unknown; dueInDays?: unknown; horizon?: unknown };
  const explicitExpensesRaw = Array.isArray(raw.upcoming_expenses)
    ? (raw.upcoming_expenses as RawExpense[])
    : [];
  let upcomingExpenses: { label: string; amount: number; dueInDays?: number }[] | undefined;
  if (explicitExpensesRaw.length) {
    upcomingExpenses = explicitExpensesRaw
      .map((e) => {
        const label = str(e?.label || e?.title || e?.name);
        const amount = round2(num(e?.amount));
        const due = e?.due_in_days ?? e?.dueInDays;
        const dueInDays =
          due != null && due === due && Number.isFinite(Number(due))
            ? Math.max(0, Math.round(Number(due)))
            : undefined;
        return { label, amount, dueInDays };
      })
      .filter((e) => e.label && e.amount > 0);
    if (!upcomingExpenses.length) upcomingExpenses = undefined;
  } else {
    const pei = (data.planned_expense_impact as Record<string, unknown>) || {};
    const displayLines = Array.isArray(pei.display_lines)
      ? (pei.display_lines as Record<string, unknown>[])
      : [];
    const nearTermCashLines = displayLines.filter((ln) => {
      const horizon = str(ln?.horizon).toLowerCase();
      const tag = str(ln?.impact_tag).toLowerCase();
      const unmapped = Boolean(ln?.is_unmapped_card);
      // Include near-term cash outflows; exclude card-funded items (they don't
      // consume upfront cash) and mid/long-term items (outside the 120-day
      // safety window the advisor uses).
      return horizon === 'near_term' && !unmapped && tag.indexOf('cash \u2192') >= 0;
    });
    if (nearTermCashLines.length) {
      upcomingExpenses = nearTermCashLines
        .map((ln) => ({
          label: str(ln?.title) || 'Upcoming expense',
          amount: round2(num(ln?.amount))
        }))
        .filter((e) => e.amount > 0);
      if (!upcomingExpenses.length) upcomingExpenses = undefined;
    }
  }

  const monthlySpending = num(
    (raw.monthly_spending_estimate as unknown) ??
      (raw.estimated_monthly_spending as unknown)
  );
  const monthlyNewSpending = num(
    (raw.monthly_new_spending_estimate as unknown) ??
      (raw.new_monthly_spending_pressure as unknown)
  );

  const cardSpend = buildHelocCardSpend(data, raw);

  return {
    helocAprPercent,
    helocCurrentBalance: round2(num(raw.heloc_current_balance)),
    helocAccountName: str(raw.heloc_account_name) || 'HELOC',
    helocMinimumPayment: round2(num(raw.heloc_minimum_payment)),
    debts,
    minSpreadPercent: num(raw.min_spread_percent) || 3,
    monthlyRecurringPaydownCapacity:
      monthlyRecurring > 0 ? round2(monthlyRecurring) : undefined,
    conditionalLumpPaydownCapacity:
      conditionalLump > 0 ? round2(conditionalLump) : undefined,
    conditionalLumpFrequencyNote: conditionalNote || undefined,
    upcomingExpenses,
    monthlySpendingEstimate: monthlySpending > 0 ? round2(monthlySpending) : undefined,
    monthlyNewSpendingEstimate: monthlyNewSpending > 0 ? round2(monthlyNewSpending) : undefined,
    cardSpend
  };
}

/**
 * Build the HELOC advisor's "ongoing card spending" signal. Walks the
 * planner payload in descending order of trust:
 *
 *   1. Explicit `raw.card_spend` block (richest — full method/confidence
 *      override, per-account breakdown, recurring bills, 120-day planned).
 *   2. `planned_expense_impact.display_lines` filtered to `near_term` +
 *      card-funded variants → feeds `plannedCardFundedNext120Days` only.
 *      Recurring monthly spend is left undefined so the advisor falls
 *      through to `no_data` / low confidence instead of fabricating a
 *      number.
 *
 * Returns `undefined` when the payload carries no signal at all — the
 * strategy model treats that as "no data" and surfaces the gap in the UI.
 */
function buildHelocCardSpend(
  data: Record<string, unknown>,
  raw: Record<string, unknown>
): HelocAdvisorSnapshot['cardSpend'] {
  const block = raw.card_spend as Record<string, unknown> | undefined;

  // Fallback: infer `plannedCardFundedNext120Days` from the planner's own
  // near-term card-funded expense lines (same data the UI already shows).
  let plannedCardFundedNext120DaysFallback = 0;
  const pei = (data.planned_expense_impact as Record<string, unknown>) || {};
  const displayLines = Array.isArray(pei.display_lines)
    ? (pei.display_lines as Record<string, unknown>[])
    : [];
  for (const ln of displayLines) {
    const horizon = str(ln?.horizon).toLowerCase();
    if (horizon !== 'near_term') continue;
    const tag = str(ln?.impact_tag).toLowerCase();
    const unmapped = Boolean(ln?.is_unmapped_card);
    const mappedCardName = str(ln?.mapped_card_name);
    const isCardFunded =
      unmapped ||
      tag.includes('credit card') ||
      tag.includes('mapped') ||
      !!mappedCardName;
    if (!isCardFunded) continue;
    plannedCardFundedNext120DaysFallback = round2(
      plannedCardFundedNext120DaysFallback + num(ln?.amount)
    );
  }

  if (!block || typeof block !== 'object') {
    if (plannedCardFundedNext120DaysFallback > 0.005) {
      return {
        plannedCardFundedNext120Days: plannedCardFundedNext120DaysFallback
      };
    }
    return undefined;
  }

  // Normalize per-account breakdown.
  type RawAcct = { account?: unknown; name?: unknown; monthly_average?: unknown; monthlyAverage?: unknown };
  const byAccountRaw = Array.isArray(block.by_account)
    ? (block.by_account as RawAcct[])
    : [];
  const byAccount = byAccountRaw
    .map((a) => ({
      account: str(a?.account ?? a?.name),
      monthlyAverage: round2(num(a?.monthly_average ?? a?.monthlyAverage))
    }))
    .filter((a) => a.account && a.monthlyAverage > 0.005);

  // Normalize recurring bills (Tahoe, ATT, Xfinity, subscriptions…).
  type RawBill = { label?: unknown; name?: unknown; monthly_amount?: unknown; monthlyAmount?: unknown; amount?: unknown };
  const billsRaw = Array.isArray(block.recurring_bills)
    ? (block.recurring_bills as RawBill[])
    : [];
  const recurringBills = billsRaw
    .map((b) => ({
      label: str(b?.label ?? b?.name),
      monthlyAmount: round2(num(b?.monthly_amount ?? b?.monthlyAmount ?? b?.amount))
    }))
    .filter((b) => b.label && b.monthlyAmount > 0.005);

  const recentMonthlyAverageRaw = block.recent_monthly_average ?? block.recentMonthlyAverage;
  const recentMonthlyAverage =
    recentMonthlyAverageRaw != null && Number.isFinite(Number(recentMonthlyAverageRaw))
      ? round2(num(recentMonthlyAverageRaw))
      : undefined;

  const plannedRaw =
    block.planned_card_funded_next_120_days ?? block.plannedCardFundedNext120Days;
  const plannedCardFundedNext120Days =
    plannedRaw != null && Number.isFinite(Number(plannedRaw))
      ? round2(num(plannedRaw))
      : plannedCardFundedNext120DaysFallback > 0.005
      ? plannedCardFundedNext120DaysFallback
      : undefined;

  const alreadyRaw = block.already_in_cashflow ?? block.alreadyInCashflow;
  const alreadyInCashflow = typeof alreadyRaw === 'boolean' ? alreadyRaw : undefined;

  const methodRaw = str(block.estimation_method ?? block.estimationMethod).toLowerCase();
  const VALID_METHODS: readonly CardSpendEstimationMethod[] = [
    'actual_recent',
    'recurring_bills_only',
    'explicit',
    'conservative_default',
    'no_data',
    'bills_scheduled',
    'combined_history_and_bills'
  ];
  const estimationMethod = (VALID_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as CardSpendEstimationMethod)
    : undefined;

  const confidenceRaw = str(block.confidence).toLowerCase();
  const VALID_CONFIDENCE: readonly CardSpendConfidence[] = ['high', 'medium', 'low'];
  const confidence = (VALID_CONFIDENCE as readonly string[]).includes(confidenceRaw)
    ? (confidenceRaw as CardSpendConfidence)
    : undefined;

  // Trailing spiky/nonrecurring trailing-4-months estimate, separate from
  // the forward-looking `plannedCardFundedNext120Days`. Used as a near-term
  // proxy when the planner doesn't enumerate upcoming card-funded spikes.
  const spikyRaw =
    block.spiky_card_spend_next_120_days ?? block.spikyCardSpendNext120Days;
  const spikyCardSpendNext120Days =
    spikyRaw != null && Number.isFinite(Number(spikyRaw))
      ? round2(num(spikyRaw))
      : undefined;

  // Per-month series (debug / automation output). Silently drop malformed
  // entries so one bad row can't hide the rest of the signal.
  type RawMonth = { month?: unknown; amount?: unknown };
  const mapMonths = (arr: unknown): Array<{ month: string; amount: number }> | undefined => {
    if (!Array.isArray(arr)) return undefined;
    const out = (arr as RawMonth[])
      .map((m) => ({ month: str(m?.month), amount: round2(num(m?.amount)) }))
      .filter((m) => m.month);
    return out.length ? out : undefined;
  };
  const recurringCardSpendByMonth = mapMonths(
    block.recurring_card_spend_by_month ?? block.recurringCardSpendByMonth
  );
  const plannedOrSpikyCardSpendByMonth = mapMonths(
    block.planned_or_spiky_card_spend_by_month ??
      block.plannedOrSpikyCardSpendByMonth
  );

  // Payee classification lists — string arrays, filtered of empties.
  const toStringArr = (arr: unknown): string[] | undefined => {
    if (!Array.isArray(arr)) return undefined;
    const out = (arr as unknown[]).map((v) => str(v)).filter(Boolean);
    return out.length ? out : undefined;
  };
  const recurringPayees = toStringArr(block.recurring_payees ?? block.recurringPayees);
  const spikyPayees = toStringArr(block.spiky_payees ?? block.spikyPayees);

  const monthsObservedRaw = block.months_observed ?? block.monthsObserved;
  const monthsObserved =
    monthsObservedRaw != null && Number.isFinite(Number(monthsObservedRaw))
      ? Math.max(0, Math.round(Number(monthsObservedRaw)))
      : undefined;
  const monthsWithCardDataRaw =
    block.months_with_card_data ?? block.monthsWithCardData;
  const monthsWithCardData =
    monthsWithCardDataRaw != null && Number.isFinite(Number(monthsWithCardDataRaw))
      ? Math.max(0, Math.round(Number(monthsWithCardDataRaw)))
      : undefined;

  // Active-filter bookkeeping (Part 4). Mirrors what `buildHelocFlowSourceCardSpend_`
  // emits on the backend so the UI can: (a) show the "Inactive card
  // expenses are excluded from recurring spend" note when the `Active`
  // column is actually populated, and (b) surface the removed payees in
  // the debug review block.
  const activeColumnPresent =
    block.active_column_present == null
      ? undefined
      : Boolean(block.active_column_present);
  const inactiveCardSpendRemovedRaw =
    block.inactive_card_spend_removed ?? block.inactiveCardSpendRemoved;
  const inactiveCardSpendRemoved =
    inactiveCardSpendRemovedRaw != null &&
    Number.isFinite(Number(inactiveCardSpendRemovedRaw))
      ? round2(Math.max(0, num(inactiveCardSpendRemovedRaw)))
      : undefined;
  const rawInactivePayees = Array.isArray(
    block.inactive_payees_removed || block.inactivePayeesRemoved
  )
    ? ((block.inactive_payees_removed || block.inactivePayeesRemoved) as Array<
        Record<string, unknown>
      >)
    : [];
  const inactivePayeesRemovedList = rawInactivePayees
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const account = String(
        (entry.account ?? entry.payee ?? entry.name ?? '') as string
      ).trim();
      const amountRaw = entry.amount ?? entry.monthly_amount ?? entry.value;
      const amount = Number(amountRaw);
      if (!account || !Number.isFinite(amount) || amount <= 0.005) return null;
      return { account, amount: round2(amount) };
    })
    .filter((x): x is { account: string; amount: number } => x !== null);
  const inactivePayeesRemoved = inactivePayeesRemovedList.length
    ? inactivePayeesRemovedList
    : undefined;

  // ── Bills-based forward-looking card obligation signal ───────────────
  // All fields optional — absent on legacy workbooks without the Payment
  // Source column in INPUT - Bills.
  const readNumOrUndef = (v: unknown): number | undefined =>
    v != null && Number.isFinite(Number(v))
      ? round2(Math.max(0, num(v)))
      : undefined;
  const billsPaymentSourceColumnPresent =
    block.bills_payment_source_column_present == null
      ? undefined
      : Boolean(block.bills_payment_source_column_present);
  const activeCardBillCountRaw =
    block.active_card_bill_count ?? block.activeCardBillCount;
  const activeCardBillCount =
    activeCardBillCountRaw != null && Number.isFinite(Number(activeCardBillCountRaw))
      ? Math.max(0, Math.round(Number(activeCardBillCountRaw)))
      : undefined;
  const billsRecurringCardBurden = readNumOrUndef(
    block.bills_recurring_card_burden ?? block.billsRecurringCardBurden
  );
  const billsSpikyCardBurdenNext120Days = readNumOrUndef(
    block.bills_spiky_card_burden_next_120_days ??
      block.billsSpikyCardBurdenNext120Days
  );
  const historicalRecurringCardSpend = readNumOrUndef(
    block.historical_recurring_card_spend ?? block.historicalRecurringCardSpend
  );
  const historicalSpikyCardSpendNext120Days = readNumOrUndef(
    block.historical_spiky_card_spend_next_120_days ??
      block.historicalSpikyCardSpendNext120Days
  );
  const chosenRecurringCardBurden = readNumOrUndef(
    block.chosen_recurring_card_burden ?? block.chosenRecurringCardBurden
  );
  const chosenSpikyCardBurdenNext120Days = readNumOrUndef(
    block.chosen_spiky_card_burden_next_120_days ??
      block.chosenSpikyCardBurdenNext120Days
  );
  const VALID_DECISIONS = [
    'history_dominated',
    'bills_dominated',
    'tied',
    'history_only',
    'bills_only',
    'no_data'
  ] as const;
  type SourceDecision = (typeof VALID_DECISIONS)[number];
  const parseDecision = (v: unknown): SourceDecision | undefined => {
    const s = str(v).toLowerCase();
    return (VALID_DECISIONS as readonly string[]).includes(s)
      ? (s as SourceDecision)
      : undefined;
  };
  const sourceDecision = parseDecision(block.source_decision ?? block.sourceDecision);
  const spikySourceDecision = parseDecision(
    block.spiky_source_decision ?? block.spikySourceDecision
  );

  type RawBillsRecurring = {
    account?: unknown;
    payee?: unknown;
    name?: unknown;
    monthly_equivalent?: unknown;
    monthlyEquivalent?: unknown;
  };
  const billsRecurringRaw = Array.isArray(
    block.recurring_card_bills_from_bills ?? block.recurringCardBillsFromBills
  )
    ? ((block.recurring_card_bills_from_bills ??
        block.recurringCardBillsFromBills) as RawBillsRecurring[])
    : [];
  const recurringCardBillsFromBills = billsRecurringRaw
    .map((entry) => {
      const account = str(entry?.account ?? entry?.payee ?? entry?.name);
      const monthlyEquivalent = round2(
        Math.max(0, num(entry?.monthly_equivalent ?? entry?.monthlyEquivalent))
      );
      return account && monthlyEquivalent > 0.005
        ? { account, monthlyEquivalent }
        : null;
    })
    .filter(
      (x): x is { account: string; monthlyEquivalent: number } => x !== null
    );

  type RawBillsUpcoming = {
    account?: unknown;
    payee?: unknown;
    name?: unknown;
    next_120_day_burden?: unknown;
    next120DayBurden?: unknown;
  };
  const billsUpcomingRaw = Array.isArray(
    block.upcoming_card_bills_from_bills ?? block.upcomingCardBillsFromBills
  )
    ? ((block.upcoming_card_bills_from_bills ??
        block.upcomingCardBillsFromBills) as RawBillsUpcoming[])
    : [];
  const upcomingCardBillsFromBills = billsUpcomingRaw
    .map((entry) => {
      const account = str(entry?.account ?? entry?.payee ?? entry?.name);
      const burden = round2(
        Math.max(0, num(entry?.next_120_day_burden ?? entry?.next120DayBurden))
      );
      return account && burden > 0.005
        ? { account, next120DayBurden: burden }
        : null;
    })
    .filter(
      (x): x is { account: string; next120DayBurden: number } => x !== null
    );

  type RawBillSched = {
    payee?: unknown;
    category?: unknown;
    frequency?: unknown;
    default_amount?: unknown;
    defaultAmount?: unknown;
    monthly_equivalent?: unknown;
    monthlyEquivalent?: unknown;
    next_120_day_burden?: unknown;
    next120DayBurden?: unknown;
    next_120_day_dates?: unknown;
    next120DayDates?: unknown;
    is_recurring?: unknown;
    isRecurring?: unknown;
  };
  const schedRaw = Array.isArray(
    block.upcoming_card_bills_schedule ?? block.upcomingCardBillsSchedule
  )
    ? ((block.upcoming_card_bills_schedule ??
        block.upcomingCardBillsSchedule) as RawBillSched[])
    : [];
  const upcomingCardBillsSchedule = schedRaw
    .map((entry) => {
      const payee = str(entry?.payee);
      if (!payee) return null;
      const datesRaw = entry?.next_120_day_dates ?? entry?.next120DayDates;
      const dates = Array.isArray(datesRaw)
        ? (datesRaw as unknown[]).map((d) => str(d)).filter(Boolean)
        : undefined;
      return {
        payee,
        category: str(entry?.category) || undefined,
        frequency: str(entry?.frequency) || 'monthly',
        defaultAmount: round2(
          Math.max(0, num(entry?.default_amount ?? entry?.defaultAmount))
        ),
        monthlyEquivalent: round2(
          Math.max(0, num(entry?.monthly_equivalent ?? entry?.monthlyEquivalent))
        ),
        next120DayBurden: round2(
          Math.max(0, num(entry?.next_120_day_burden ?? entry?.next120DayBurden))
        ),
        next120DayDates: dates && dates.length ? dates : undefined,
        isRecurring: Boolean(entry?.is_recurring ?? entry?.isRecurring)
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const recurringCardPayeesFromBills = toStringArr(
    block.recurring_card_payees_from_bills ?? block.recurringCardPayeesFromBills
  );
  const spikyCardPayeesFromBills = toStringArr(
    block.spiky_card_payees_from_bills ?? block.spikyCardPayeesFromBills
  );

  return {
    recentMonthlyAverage,
    byAccount: byAccount.length ? byAccount : undefined,
    recurringBills: recurringBills.length ? recurringBills : undefined,
    plannedCardFundedNext120Days,
    spikyCardSpendNext120Days,
    recurringCardSpendByMonth,
    plannedOrSpikyCardSpendByMonth,
    recurringPayees,
    spikyPayees,
    monthsObserved,
    monthsWithCardData,
    alreadyInCashflow,
    estimationMethod,
    confidence,
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
    recurringCardBillsFromBills: recurringCardBillsFromBills.length
      ? recurringCardBillsFromBills
      : undefined,
    upcomingCardBillsFromBills: upcomingCardBillsFromBills.length
      ? upcomingCardBillsFromBills
      : undefined,
    upcomingCardBillsSchedule: upcomingCardBillsSchedule.length
      ? upcomingCardBillsSchedule
      : undefined,
    recurringCardPayeesFromBills,
    spikyCardPayeesFromBills
  };
}

function executionRow0FromPayload(data: Record<string, unknown>): Record<string, unknown> {
  const m12 = (data.next_12_months as Record<string, unknown>[] | undefined) || [];
  if (m12.length && m12[0] && typeof m12[0] === 'object') {
    return m12[0] as Record<string, unknown>;
  }
  const slim = data.rolling_dashboard_execution_row;
  if (slim && typeof slim === 'object') {
    return slim as Record<string, unknown>;
  }
  return {};
}

function execMapFromRow(row: Record<string, unknown>): Record<string, number> {
  const raw = row.extra_principal_allocations_execution_now as Record<string, unknown> | undefined;
  const out: Record<string, number> = Object.create(null);
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach((k) => {
    const v = round2(num(raw[k]));
    if (v > 0.005) out[k] = v;
  });
  return out;
}

function condMapFromRow(row: Record<string, unknown>): Record<string, number> {
  const raw = row.extra_principal_allocations_conditional_variable as Record<string, unknown> | undefined;
  const out: Record<string, number> = Object.create(null);
  if (!raw || typeof raw !== 'object') return out;
  Object.keys(raw).forEach((k) => {
    const v = round2(num(raw[k]));
    if (v > 0.005) out[k] = v;
  });
  return out;
}

function mapDecisionBox(box: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!box || typeof box !== 'object') return {};
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  return {
    'Can I make an extra payment?': str(box.can_make_extra_payment) || '—',
    'Should I draw from HELOC this month?': str(box.should_draw_from_heloc) || '—',
    'Maximum HELOC draw allowed now': fmt(num(box.max_heloc_draw_allowed_now)),
    'Should I hold cash instead?': str(box.should_hold_cash_instead) || '—',
    'Cleanup target this month': str(box.cleanup_target_this_month) || '—',
    'Primary priority debt': str(box.primary_priority_debt || box.current_priority_debt) || '—',
    'Is allocation optimized for interest savings?': str(box.is_allocation_optimized_for_interest_savings) || '—',
    'Reserve protection mode': str(box.reserve_protection_mode) || '—'
  };
}

function buildSnapshotRows(
  row0: Record<string, unknown>,
  planInvalid: boolean,
  ctx: {
    execCashMap: Record<string, number>;
    buckets: ExecBuckets;
    eca: Record<string, unknown> | null | undefined;
    execTotalDisplayed: number;
    execHelocAmount: number;
  }
): { snapshot: SnapshotRow[]; snapshotSummary?: RollingDebtPayoffDashboardData['snapshotSummary']; ok: boolean } {
  if (planInvalid) return { snapshot: [], ok: true };

  const execCashMap = ctx.execCashMap;
  const buckets = ctx.buckets;
  const eca = ctx.eca;
  const execTotalDisplayed = round2(ctx.execTotalDisplayed);
  const execHelocAmount =
    ctx.execHelocAmount != null && Number.isFinite(ctx.execHelocAmount) ? round2(ctx.execHelocAmount) : 0;
  const helocTargetRaw = str(row0.heloc_target_account);

  const sheetAnchor = row0.debt_balances_sheet_anchor as { name?: string; balance?: unknown }[] | undefined;
  const s0: Record<string, number> = Object.create(null);
  if (sheetAnchor && sheetAnchor.length) {
    for (const d of sheetAnchor) {
      const nm = str(d?.name);
      if (!nm) continue;
      s0[nm] = round2(num(d?.balance));
    }
  }

  const primaryNm = str(
    (eca?.concentration_items as { name?: string }[] | undefined)?.[0]?.name ||
      row0.primary_priority_debt ||
      row0.focus_debt
  );
  const secondarySet: Record<string, boolean> = Object.create(null);
  const concItems = (eca?.concentration_items as { name?: string }[] | undefined) || [];
  for (let i = 1; i < concItems.length; i++) {
    const n = str(concItems[i]?.name);
    if (n) secondarySet[n] = true;
  }
  const cleanupNameSet: Record<string, boolean> = Object.create(null);
  const cleanupItems = (eca?.cleanup_items as { name?: string }[] | undefined) || [];
  for (const c of cleanupItems) {
    const nm = str(c?.name);
    if (nm) cleanupNameSet[nm] = true;
  }

  const wfSnap = row0.waterfall_execution_snapshot as
    | {
        account?: string;
        balance_before?: unknown;
        payment_applied_now?: unknown;
        balance_after_now?: unknown;
        closed?: boolean;
        phase?: string;
      }[]
    | undefined;
  if (wfSnap && Array.isArray(wfSnap) && wfSnap.length) {
    let sumPayRounded = 0;
    let sumPayRaw = 0;
    const snapshot: SnapshotRow[] = [];
    for (const r of wfSnap) {
      const account = str(r?.account);
      if (!account) continue;
      const beforeRaw = num(r?.balance_before);
      const afterRawNum = num(r?.balance_after_now);
      const impliedPay = beforeRaw - afterRawNum;
      let payRaw = num(r?.payment_applied_now);
      if (payRaw <= 0.005 && impliedPay > 0.005) payRaw = impliedPay;
      if (payRaw <= 0.005) continue;
      const pay = round2(payRaw);
      sumPayRounded = round2(sumPayRounded + pay);
      sumPayRaw += payRaw;
      const before = round2(beforeRaw);
      const rawAfter = afterRawNum;
      const afterNow = rawAfter <= 0.01 ? 0 : Math.max(0, round2(rawAfter));
      const ph = str(r?.phase || '');
      const isPrimary = ph === 'primary' || (!ph && !!(primaryNm && account === primaryNm));
      const isSecondary = ph === 'secondary' || (!ph && !!secondarySet[account]);
      let st: SnapshotRow['status'] = 'OPEN';
      if (afterNow <= 0.01 && pay > 0.005) st = 'CLOSED';
      else if (pay > 0.005 && isPrimary && afterNow > 0.01) st = '↓ PRIMARY';
      else if (pay > 0.005 && isSecondary && afterNow > 0.01) st = '↓ SECONDARY';
      snapshot.push({
        account,
        balanceBefore: before,
        paymentAppliedNow: pay,
        balanceAfterNow: afterNow,
        status: st
      });
    }
    if (helocTargetRaw && execHelocAmount > 0.005) {
      const has = snapshot.some((s) => s.account === helocTargetRaw);
      if (!has) {
        const hb = s0[helocTargetRaw] != null ? s0[helocTargetRaw] : 0;
        const payH = execHelocAmount;
        const rawHelocAfter = hb - payH;
        const afterH = rawHelocAfter <= 0.01 ? 0 : Math.max(0, round2(rawHelocAfter));
        snapshot.push({
          account: helocTargetRaw,
          balanceBefore: hb,
          paymentAppliedNow: payH,
          balanceAfterNow: afterH,
          status: hb > 0.005 && afterH <= 0.01 ? 'CLOSED' : '↓ PRIMARY'
        });
        sumPayRounded = round2(sumPayRounded + payH);
        sumPayRaw += payH;
      }
    }
    const sumPay = round2(sumPayRaw);
    const wfReconcileEps = Math.max(RECONCILE_WF_MIN_EPS, execTotalDisplayed * 0.0005, RECONCILE_EPS);
    const okRec = Math.abs(sumPay - execTotalDisplayed) <= wfReconcileEps;
    if (!okRec && typeof console !== 'undefined' && console.warn) {
      console.warn('[Rolling debt payoff dashboard] waterfall snapshot payment sum vs execution_total_now', {
        sumPaymentsRounded: sumPayRounded,
        sumPaymentsRaw: sumPay,
        executionTotalNow: execTotalDisplayed,
        tolerance: wfReconcileEps
      });
    }
    let eliminatedNow = 0;
    let primaryPay = 0;
    for (const r of snapshot) {
      if (r.balanceBefore > 0.005 && r.balanceAfterNow <= 0.01) eliminatedNow++;
      if (primaryNm && r.account === primaryNm) primaryPay = round2(primaryPay + r.paymentAppliedNow);
    }
    return {
      snapshot,
      snapshotSummary: {
        accountsClosedNow: eliminatedNow,
        deployedNow: execTotalDisplayed,
        primaryReduced: primaryPay
      },
      ok: true
    };
  }

  function paymentNowForName(nm: string): number {
    let p = round2(num(execCashMap[nm]));
    if (helocTargetRaw && nm === helocTargetRaw && execHelocAmount > 0.005) {
      p = round2(p + execHelocAmount);
    }
    return p;
  }

  const candidateNames: Record<string, boolean> = Object.create(null);
  Object.keys(execCashMap || {}).forEach((k) => {
    if (round2(num(execCashMap[k])) > 0.005) candidateNames[k] = true;
  });
  if (helocTargetRaw && execHelocAmount > 0.005) {
    candidateNames[helocTargetRaw] = true;
  }
  Object.keys(cleanupNameSet).forEach((k) => {
    candidateNames[k] = true;
  });
  if (primaryNm) candidateNames[primaryNm] = true;
  Object.keys(secondarySet).forEach((k) => {
    candidateNames[k] = true;
  });

  const orderedNames: string[] = [];
  const seen: Record<string, boolean> = Object.create(null);
  function pushBucketOrder(items: { name: string; amt: number }[] | undefined) {
    (items || []).forEach((e) => {
      const nm = str(e?.name);
      if (!nm || seen[nm]) return;
      if (!candidateNames[nm]) return;
      seen[nm] = true;
      orderedNames.push(nm);
    });
  }
  pushBucketOrder(buckets.cleanup);
  pushBucketOrder(buckets.primary);
  pushBucketOrder(buckets.secondary);
  pushBucketOrder(buckets.overflow);
  const remainder: string[] = [];
  Object.keys(candidateNames).forEach((nm) => {
    if (!seen[nm]) remainder.push(nm);
  });
  remainder.sort();
  for (const nm of remainder) orderedNames.push(nm);

  type Row = { name: string; before: number; pay: number; after: number; status: string };
  const rows: Row[] = [];
  let sumPay = 0;
  for (const nm of orderedNames) {
    const pay = paymentNowForName(nm);
    const isCleanup = !!cleanupNameSet[nm];
    const isPrimary = !!(primaryNm && nm === primaryNm);
    const isSecondary = !!secondarySet[nm];
    if (pay <= 0.005 && !isCleanup && !isPrimary && !isSecondary) {
      continue;
    }
    const before = s0[nm] != null ? s0[nm] : 0;
    const afterRaw = before - pay;
    const afterAdj = afterRaw <= 0.01 ? 0 : Math.max(0, round2(afterRaw));
    let status = 'OPEN';
    if (pay > 0.005 && afterAdj <= 0.01) status = 'CLOSED';
    else if (pay > 0.005 && isPrimary && afterAdj > 0.01) status = '↓ PRIMARY';
    else if (pay > 0.005 && isSecondary && afterAdj > 0.01) status = '↓ SECONDARY';
    sumPay = round2(sumPay + pay);
    rows.push({ name: nm, before, pay, after: afterAdj, status });
  }

  const reconcileOk = Math.abs(sumPay - execTotalDisplayed) <= RECONCILE_EPS;
  if (!reconcileOk) {
    return { snapshot: [], ok: false };
  }
  if (!rows.length && execTotalDisplayed <= 0.005) {
    return { snapshot: [], ok: true };
  }

  let eliminatedNow = 0;
  let primaryPay = 0;
  for (const r of rows) {
    if (r.before > 0.005 && r.after <= 0.01) eliminatedNow++;
    if (primaryNm && r.name === primaryNm) {
      primaryPay = round2(primaryPay + r.pay);
    }
  }

  const snapshot: SnapshotRow[] = rows.map((r) => {
    const paymentAppliedNow = round2(r.pay);
    const balanceBefore = round2(r.before);
    const balanceAfterNow = r.after;
    let st: SnapshotRow['status'] = 'OPEN';
    if (r.status === 'CLOSED') st = 'CLOSED';
    else if (r.status.includes('PRIMARY')) st = '↓ PRIMARY';
    else if (r.status.includes('SECONDARY')) st = '↓ SECONDARY';
    return {
      account: r.name,
      balanceBefore,
      paymentAppliedNow,
      balanceAfterNow,
      status: st
    };
  });

  return {
    snapshot,
    snapshotSummary: {
      accountsClosedNow: eliminatedNow,
      deployedNow: execTotalDisplayed,
      primaryReduced: primaryPay
    },
    ok: true
  };
}

function presentationFromSummaryMode(raw: string | undefined): ExecutionPresentationMode | null {
  // Presentation view is now only Standard or Automation. Audit/debug panels
  // are controlled by an independent Advanced toggle parsed separately by the
  // dashboard. Legacy tokens like `operator` / `advanced` / `aggressive` are
  // handled downstream — we return `null` here so the raw string passes
  // through untouched and the dashboard's own normalizer can inspect tokens.
  const m = String(raw || '')
    .toLowerCase()
    .trim();
  if (!m) return null;
  const tokens = m.split(/[\s,|]+/).filter(Boolean);
  if (tokens.indexOf('automation') >= 0) return 'automation';
  if (tokens.indexOf('standard') >= 0) return 'standard';
  return null;
}

function plannedExpenseRawLines(data: Record<string, unknown>, tmp: Record<string, unknown>): Record<string, unknown>[] {
  const pei = (data.planned_expense_impact as Record<string, unknown>) || {};
  const fromPei = pei.display_lines;
  if (Array.isArray(fromPei) && fromPei.length) return fromPei as Record<string, unknown>[];
  const fromTmp = tmp.planned_expense_lines;
  if (Array.isArray(fromTmp) && fromTmp.length) return fromTmp as Record<string, unknown>[];
  return [];
}

function mapDisplayLineToPlannedExpenseRow(line: Record<string, unknown>): PlannedExpenseImpactRow {
  const horizon = str(line.horizon).toLowerCase();
  const tag = str(line.impact_tag).toLowerCase();
  const unmapped = Boolean(line.is_unmapped_card);
  const amt = round2(num(line.amount));
  const expense = str(line.title) || 'Planned expense';
  const due = str(line.due_label) || '—';
  const mappedCardName = str(line.mapped_card_name);

  const isNearCash = horizon === 'near_term' && tag.indexOf('cash →') >= 0;
  const isNearCardUnmapped = horizon === 'near_term' && unmapped;
  const isNearCardMapped =
    horizon === 'near_term' && !unmapped && (tag.includes('credit card') || tag.includes('mapped') || !!mappedCardName);

  let variant: PlannedExpenseImpactRowVariant = 'other';
  if (isNearCardUnmapped) variant = 'card-unmapped';
  else if (isNearCardMapped) variant = 'card';
  else if (isNearCash) variant = 'cash';
  else if (horizon === 'mid_term') variant = 'mid-term';
  else if (horizon === 'long_term') variant = 'long-term';

  let fundingType = '—';
  let executionEffect = '—';
  let planningEffect = '—';
  let status = '—';

  if (variant === 'cash') {
    fundingType = 'Cash';
    executionEffect = 'Reserved from deployable cash';
    planningEffect = 'Reduces extra debt capacity now';
    status = 'Reserved in liquidity';
  } else if (variant === 'card-unmapped') {
    fundingType = 'Card-funded';
    executionEffect = 'Temporarily reduces extra debt capacity now';
    planningEffect = 'Conservative cash hold until mapping is assigned';
    status = 'Unmapped — treated as cash risk until mapped';
  } else if (variant === 'card') {
    fundingType = 'Card-funded';
    executionEffect = 'Does not reduce cash today';
    planningEffect = mappedCardName
      ? `Increases modeled balance on mapped card (${mappedCardName})`
      : 'Increases modeled balance on mapped card';
    status = mappedCardName ? `Mapped to ${mappedCardName}` : 'Mapped to card';
  } else if (variant === 'mid-term') {
    fundingType = 'Mid-term';
    executionEffect = 'Not deducted today';
    planningEffect = 'Future caution within 90 days';
    status = 'Watch';
  } else if (variant === 'long-term') {
    fundingType = 'Long-term';
    executionEffect = 'Not deducted today';
    planningEffect = 'Future watch beyond near term';
    status = 'Watch';
  } else {
    fundingType = horizon === 'unknown' ? 'Review' : horizon.replace(/_/g, ' ');
    executionEffect = 'See INPUT - Upcoming Expenses';
    planningEffect = str(line.impact_tag) || '—';
    status = 'Review';
  }

  return {
    expense,
    due,
    amount: amt,
    fundingType,
    executionEffect,
    planningEffect,
    status,
    variant,
    mappedCardName: mappedCardName || undefined
  };
}

function buildPlannedExpenseImpactBlock(
  data: Record<string, unknown>,
  tmp: Record<string, unknown>,
  liqIn: Record<string, unknown>
): PlannedExpenseImpactBlock | null {
  const pei = (data.planned_expense_impact as Record<string, unknown>) || {};
  const raw = plannedExpenseRawLines(data, tmp);
  if (!raw.length) return null;

  const lines = raw.map((ln) => mapDisplayLineToPlannedExpenseRow(ln));

  let nearTermCashReserved = round2(num(pei.near_term_cash_reserved));
  if (nearTermCashReserved <= 0.005) {
    nearTermCashReserved = round2(num(liqIn.near_term_planned_cash_reserved));
  }
  const sumCashLines = lines.filter((l) => l.variant === 'cash').reduce((s, l) => round2(s + l.amount), 0);
  if (nearTermCashReserved <= 0.005 && sumCashLines > 0.005) {
    nearTermCashReserved = sumCashLines;
  }

  let cardFundedModeledLoad = round2(num(pei.near_term_card_funded_mapped_total));
  if (cardFundedModeledLoad <= 0.005) {
    cardFundedModeledLoad = lines.filter((l) => l.variant === 'card').reduce((s, l) => round2(s + l.amount), 0);
  }

  let unmappedCashRiskHold = round2(num(pei.unmapped_card_funded_cash_risk));
  if (unmappedCashRiskHold <= 0.005) {
    unmappedCashRiskHold = lines.filter((l) => l.variant === 'card-unmapped').reduce((s, l) => round2(s + l.amount), 0);
  }

  const midTermCaution = lines.filter((l) => l.variant === 'mid-term').reduce((s, l) => round2(s + l.amount), 0);

  const un = lines.find((l) => l.variant === 'card-unmapped');
  const unmappedCardWarning = un
    ? `${un.expense} is card-funded but not mapped; treated as cash risk until mapped.`
    : undefined;

  return {
    summary: {
      nearTermCashReserved,
      cardFundedModeledLoad,
      unmappedCashRiskHold,
      midTermCaution
    },
    lines,
    unmappedCardWarning
  };
}

/**
 * Maps the planner JSON payload to dashboard props data (complete object; no demo merge).
 */
export function mapPlannerPayloadToRollingDebtPayoffDashboardData(payload: unknown): RollingDebtPayoffDashboardData | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  const summaryIn = (data.summary as Record<string, unknown>) || {};
  const planInvalid = str(summaryIn.plan_status).toUpperCase() === 'INVALID';
  const row0 = executionRow0FromPayload(data);
  const tmp = (data.this_month_plan as Record<string, unknown>) || {};
  const liqIn = (tmp.liquidity as Record<string, unknown>) || {};
  const ams = (tmp.anchor_month_minimum_schedule as Record<string, unknown>) || {};

  const execCashMap = execMapFromRow(row0);
  const condVarMap = condMapFromRow(row0);
  const eca = row0.execution_concentration_analysis as Record<string, unknown> | null | undefined;

  const executionExtraCash =
    row0.execution_extra_cash_total != null && row0.execution_extra_cash_total === row0.execution_extra_cash_total
      ? round2(num(row0.execution_extra_cash_total))
      : round2(
          Object.keys(execCashMap).reduce((s, k) => round2(s + num(execCashMap[k])), 0)
        );

  const finalExecuteBridge =
    liqIn.final_execute_now_cash != null && liqIn.final_execute_now_cash === liqIn.final_execute_now_cash
      ? round2(num(liqIn.final_execute_now_cash))
      : null;
  /**
   * Single source of truth for month-0 execute-now capacity in the dashboard.
   * Prefer month0_execute_now_budget if the backend attaches it; otherwise fall back to
   * executable_now_budget, then final_execute_now_cash. All execute-now display fields
   * (cash available for extra debt, executionTotals.fromCash, decision-box max, snapshot
   * deployed-now footer) resolve to this value.
   */
  const month0ExecuteNowBudget: number | null =
    liqIn.month0_execute_now_budget != null && liqIn.month0_execute_now_budget === liqIn.month0_execute_now_budget
      ? round2(num(liqIn.month0_execute_now_budget))
      : liqIn.executable_now_budget != null && liqIn.executable_now_budget === liqIn.executable_now_budget
      ? round2(num(liqIn.executable_now_budget))
      : finalExecuteBridge;
  const canonicalExecuteNowCash =
    month0ExecuteNowBudget != null ? round2(Math.min(executionExtraCash, month0ExecuteNowBudget)) : executionExtraCash;

  const helocFromRow = round2(num(row0.heloc_draw_this_month));
  const helocApplied = helocFromRow >= HELOC_MIN_MONTHLY_DRAW ? helocFromRow : 0;

  const execTotalNow =
    row0.execution_total_now != null && row0.execution_total_now === row0.execution_total_now
      ? round2(num(row0.execution_total_now))
      : round2(canonicalExecuteNowCash + helocApplied);

  const condLater =
    row0.conditional_variable_extra_total != null && row0.conditional_variable_extra_total === row0.conditional_variable_extra_total
      ? round2(num(row0.conditional_variable_extra_total))
      : round2(Object.keys(condVarMap).reduce((s, k) => round2(s + num(condVarMap[k])), 0));

  const buckets = buildExecutionExtraBuckets(eca, execCashMap, planInvalid);
  const wfSnapRaw = row0.waterfall_execution_snapshot as Parameters<typeof buildExtraPaymentsFromWaterfallSnapshot>[0];
  const bucketsFromWf = buildExtraPaymentsFromWaterfallSnapshot(wfSnapRaw);
  const bucketsForUi = bucketsFromWf || buckets;
  const extraPaymentsOut = {
    cleanup: bucketsForUi.cleanup.map((e) => ({ account: e.name, amount: e.amt, bucket: 'cleanup' as const })),
    primary: bucketsForUi.primary.map((e) => ({ account: e.name, amount: e.amt, bucket: 'primary' as const })),
    secondary: bucketsForUi.secondary.map((e) => ({ account: e.name, amount: e.amt, bucket: 'secondary' as const })),
    overflow: bucketsForUi.overflow.map((e) => ({ account: e.name, amount: e.amt, bucket: 'overflow' as const }))
  };

  const bucketsEmpty =
    !extraPaymentsOut.cleanup.length &&
    !extraPaymentsOut.primary.length &&
    !extraPaymentsOut.secondary.length &&
    !extraPaymentsOut.overflow.length;
  if (typeof console !== 'undefined' && console.warn && execTotalNow > 0.005 && bucketsEmpty) {
    console.warn(
      'Rolling debt payoff dashboard: execute-now total is non-zero but extra payment buckets are empty.'
    );
  }

  const snap = buildSnapshotRows(row0, planInvalid, {
    execCashMap,
    buckets,
    eca,
    execTotalDisplayed: execTotalNow,
    execHelocAmount: helocApplied
  });

  const alreadyPaidRaw = (ams.already_paid as { account?: string; cf_paid_this_month?: unknown }[] | undefined) || [];
  const payNowRaw = (ams.pay_now as { account?: string; minimum_required?: unknown }[] | undefined) || [];

  const condPayments = Object.keys(condVarMap).map((account) => ({
    account,
    amount: round2(num(condVarMap[account]))
  }));

  const next3Raw = (data.next_3_month_preview as Record<string, unknown>[] | undefined) || [];
  const next3Months: RollingDebtPayoffDashboardData['next3Months'] = next3Raw.map((r) => ({
    month: str(r.month),
    focus: str(r.expected_debt_focus) || str(r.expected_focus) || '—',
    detail: [str(r.expected_cash_pressure), str(r.extra_payments_likely)].filter(Boolean).join(' · ') || undefined
  }));

  const warnings = (data.key_warnings as unknown[] | undefined) || [];
  const watchouts = warnings.map((w) => String(w || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const strictErrs = (
    (eca?.strict_waterfall_errors as unknown[] | undefined)?.map((w) => String(w || '').replace(/\s+/g, ' ').trim()) || []
  ).filter(Boolean);
  const watchoutsMerged = strictErrs.length ? strictErrs.concat(watchouts) : watchouts;

  const execModeStr = str(summaryIn.execution_plan_mode);
  const modesList = execModeStr.toLowerCase().split(/[\s,|]+/).filter(Boolean);
  const isAggressiveRequest = modesList.indexOf('aggressive') >= 0;

  let aggressiveMeta: RollingDebtPayoffDashboardData['aggressiveMeta'];
  if (!planInvalid && isAggressiveRequest) {
    const disp = rollingAggressiveCashExtrasReconcile(bucketsForUi, canonicalExecuteNowCash);
    const openMeta = row0.opening_concentration_meta as Record<string, unknown> | null | undefined;
    const depMeta = row0.deployable_concentration_meta as Record<string, unknown> | null | undefined;
    const audit = buildAggressivePhase2Audit(openMeta, depMeta);
    const primaryBelow90 = disp.primary_share_of_remaining_pct < 90;
    let primaryBelow90Reason: string | undefined;
    if (primaryBelow90) {
      if (audit.capped_excuse_applies) {
        primaryBelow90Reason = 'Primary capped at remaining payoff balance; spill to secondary was required.';
      } else if (audit.below_target_anomaly) {
        primaryBelow90Reason = 'Primary share is below 90% without a confirmed payoff cap — review concentration audit in full plan output.';
      }
    }
    aggressiveMeta = {
      postCleanupExtraPool: disp.remaining_after_cleanup,
      primaryAllocated: disp.primary_cash,
      primaryShareOfRemainingPct: disp.primary_share_of_remaining_pct,
      primaryBelow90,
      primaryBelow90Reason
    };
  }

  const helocRec = str(liqIn.heloc_recommended_now);
  const deployable =
    liqIn.deployable_cash_after_protections != null
      ? round2(num(liqIn.deployable_cash_after_protections))
      : round2(num(liqIn.deployable_cash));

  const presentationHint = presentationFromSummaryMode(str(summaryIn.execution_plan_mode));
  const summaryModeLabel = presentationHint || (execModeStr ? execModeStr : 'standard');

  const plannedExpenseImpact = buildPlannedExpenseImpactBlock(data, tmp, liqIn);

  const strictSplitNote = str(eca?.strict_serial_split_note);
  const strictWaterfallErrors = strictErrs;

  const wfValidatedRaw = str(row0.waterfall_execution_validated || '').toUpperCase();
  const waterfallExecutionValidated =
    wfValidatedRaw === 'PASS' || wfValidatedRaw === 'FAIL' ? wfValidatedRaw : undefined;
  const waterfallExecutionValidationFailures = (
    (row0.waterfall_execution_validation_failures as unknown[] | undefined) || []
  )
    .map((w) => String(w || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const liquidityCashRaw = round2(num(liqIn.cash_available_for_extra_debt_today));
  const displayTotalNow = round2(canonicalExecuteNowCash + helocApplied);
  const executeNowSourceCheck = computeExecuteNowSourceValidation({
    canonicalCash: canonicalExecuteNowCash,
    totalNow: displayTotalNow,
    helocApplied,
    liquidityCashRaw
  });
  const primaryNmForValidation = str(
    (eca?.concentration_items as { name?: string }[] | undefined)?.[0]?.name ||
      row0.primary_priority_debt ||
      row0.focus_debt
  );
  const snapshotStatusCheck = computeSnapshotStatusValidation({
    snapshot: snap.snapshot,
    snapshotSummary: snap.snapshotSummary,
    totalNow: execTotalNow,
    primaryNm: primaryNmForValidation
  });

  if (typeof console !== 'undefined' && console.error) {
    if (
      helocApplied <= 0.005 &&
      month0ExecuteNowBudget == null &&
      Math.abs(canonicalExecuteNowCash - execTotalNow) > VALIDATION_EPS
    ) {
      console.error(
        '[Rolling debt payoff dashboard] executionTotals.fromCash vs total_now mismatch (HELOC 0)',
        { fromCash: canonicalExecuteNowCash, totalNow: execTotalNow }
      );
    }
    if (snap.snapshotSummary && Math.abs(snap.snapshotSummary.deployedNow - execTotalNow) > VALIDATION_EPS) {
      console.error('[Rolling debt payoff dashboard] snapshot deployedNow vs executionTotals.total_now', {
        deployedNow: snap.snapshotSummary.deployedNow,
        totalNow: execTotalNow
      });
    }
    if (Math.abs(liquidityCashRaw - canonicalExecuteNowCash) > VALIDATION_EPS) {
      console.error(
        '[Rolling debt payoff dashboard] KPI uses row execution_extra_cash_total; liquidity.cash_available differs',
        { liquidityCashRaw, canonicalExecuteNowCash }
      );
    }
  }

  return {
    summary: {
      planStatus: str(summaryIn.plan_status) || '—',
      anchorMonth: str(summaryIn.anchor_month) || '—',
      confidence: str(summaryIn.overall_confidence) || '—',
      executionPlanMode: summaryModeLabel
    },
    liquidity: {
      /**
       * `totalCash` is the true full liquid total from the sheet (all cash + checking + savings),
       * not the policy-eligible subset. Prefer `liquid_total_sheet` (10-step cash-bridge input);
       * fall back to legacy `total_cash` only when the bridge field is absent. Policy-usable
       * subset is available in `totalUsableCash` for debug/details.
       */
      totalCash: (function () {
        const sheet = liqIn.liquid_total_sheet;
        if (sheet != null && sheet === sheet) return round2(num(sheet));
        return round2(num(liqIn.total_cash));
      })(),
      /**
       * Reserve and Buffer on the dashboard are CALCULATED from SYS - Accounts
       * (DO_NOT_TOUCH balances and per-account Min Buffer). Prefer the calculated
       * fields from the backend cash_policy model. Fall back to the legacy
       * reserve_target / buffer_above_reserve only when the calculated fields are
       * missing (older payloads). The legacy 100k / 100k planner constants are
       * recorded separately under legacyReserveTarget / legacyBufferAboveReserve
       * for audit/debug and MUST NOT drive the top-row KPIs.
       */
      reserveTarget: (function () {
        const calc = liqIn.calculated_reserve;
        if (calc != null && calc === calc) return round2(num(calc));
        return round2(num(liqIn.reserve_target));
      })(),
      buffer: (function () {
        const calc = liqIn.calculated_buffer;
        if (calc != null && calc === calc) return round2(num(calc));
        return round2(num(liqIn.buffer_above_reserve));
      })(),
      calculatedReserve:
        liqIn.calculated_reserve != null && liqIn.calculated_reserve === liqIn.calculated_reserve
          ? round2(num(liqIn.calculated_reserve))
          : undefined,
      calculatedBuffer:
        liqIn.calculated_buffer != null && liqIn.calculated_buffer === liqIn.calculated_buffer
          ? round2(num(liqIn.calculated_buffer))
          : undefined,
      reserveAccountCount:
        liqIn.reserve_account_count != null && liqIn.reserve_account_count === liqIn.reserve_account_count
          ? Number(liqIn.reserve_account_count) || 0
          : undefined,
      bufferAccountCount:
        liqIn.buffer_account_count != null && liqIn.buffer_account_count === liqIn.buffer_account_count
          ? Number(liqIn.buffer_account_count) || 0
          : undefined,
      reserveSource: liqIn.reserve_source ? String(liqIn.reserve_source) : undefined,
      bufferSource: liqIn.buffer_source ? String(liqIn.buffer_source) : undefined,
      deployableMaxCalculated:
        liqIn.deployable_max_calculated != null && liqIn.deployable_max_calculated === liqIn.deployable_max_calculated
          ? round2(num(liqIn.deployable_max_calculated))
          : undefined,
      legacyReserveTarget:
        liqIn.legacy_reserve_target != null && liqIn.legacy_reserve_target === liqIn.legacy_reserve_target
          ? round2(num(liqIn.legacy_reserve_target))
          : undefined,
      legacyBufferAboveReserve:
        liqIn.legacy_buffer_above_reserve != null && liqIn.legacy_buffer_above_reserve === liqIn.legacy_buffer_above_reserve
          ? round2(num(liqIn.legacy_buffer_above_reserve))
          : undefined,
      deployableCash: deployable,
      cashAvailableForExtraDebt: canonicalExecuteNowCash,
      helocRecommended: helocRec || '—',
      conditionalExtraLaterThisMonth: round2(num(liqIn.conditional_variable_extra_total ?? condLater)),
      debtPreferredCash:
        liqIn.debt_preferred_cash != null && liqIn.debt_preferred_cash === liqIn.debt_preferred_cash
          ? round2(num(liqIn.debt_preferred_cash))
          : undefined,
      billsAvailableCash:
        liqIn.bills_available_cash != null && liqIn.bills_available_cash === liqIn.bills_available_cash
          ? round2(num(liqIn.bills_available_cash))
          : undefined,
      cautionCash:
        liqIn.caution_cash != null && liqIn.caution_cash === liqIn.caution_cash
          ? round2(num(liqIn.caution_cash))
          : undefined,
      totalUsableCash:
        liqIn.total_usable_cash != null && liqIn.total_usable_cash === liqIn.total_usable_cash
          ? round2(num(liqIn.total_usable_cash))
          : undefined,
      finalExecuteNowCash:
        liqIn.final_execute_now_cash != null && liqIn.final_execute_now_cash === liqIn.final_execute_now_cash
          ? round2(num(liqIn.final_execute_now_cash))
          : undefined,
      monthlyExecutionCap:
        liqIn.monthly_execution_cap != null && liqIn.monthly_execution_cap === liqIn.monthly_execution_cap
          ? round2(num(liqIn.monthly_execution_cap))
          : undefined,
      executableNowBudget:
        liqIn.executable_now_budget != null && liqIn.executable_now_budget === liqIn.executable_now_budget
          ? round2(num(liqIn.executable_now_budget))
          : undefined,
      month0ExecuteNowBudget: month0ExecuteNowBudget != null ? month0ExecuteNowBudget : undefined,
      nearTermPlannedCashHold: (function () {
        /**
         * Prefer explicit hold > reserved > plannedExpenseImpact summary. All three fall back to 0
         * so the UI Deployable Max formula stays well-defined even when no near-term expense exists.
         */
        const holdRaw = liqIn.near_term_planned_cash_hold;
        if (holdRaw != null && holdRaw === holdRaw) return round2(num(holdRaw));
        const reservedRaw = liqIn.near_term_planned_cash_reserved;
        if (reservedRaw != null && reservedRaw === reservedRaw) return round2(num(reservedRaw));
        return 0;
      })(),
      unmappedCardRiskHold: (function () {
        /**
         * Temporary cash hold reserved for unmapped card-funded near-term expenses.
         * Prefer the cash-bridge hold; fall back to the planned-expense-impact surface;
         * default to 0 so the Deployable Max formula stays well-defined.
         */
        const holdRaw = liqIn.unmapped_card_risk_hold;
        if (holdRaw != null && holdRaw === holdRaw) return round2(num(holdRaw));
        const exec = liqIn.unmapped_card_funded_cash_risk;
        if (exec != null && exec === exec) return round2(num(exec));
        return 0;
      })(),
      deployableMax: (function () {
        /**
         * Deployable Max = max(0, TotalCash − CalculatedReserve − CalculatedBuffer − NearTermHold − UnmappedCardRiskHold).
         * Uses the full liquid total from the sheet and the CALCULATED reserve/buffer from the
         * SYS - Accounts policy model (DO_NOT_TOUCH balances / per-account Min Buffer). Legacy
         * reserve_target / buffer_above_reserve from the payload are used only as fallbacks
         * when the calculated fields are missing (older payloads).
         */
        const sheet = liqIn.liquid_total_sheet;
        const totalCash =
          sheet != null && sheet === sheet ? round2(num(sheet)) : round2(num(liqIn.total_cash));
        const calcReserveRaw = liqIn.calculated_reserve;
        const reserveTarget =
          calcReserveRaw != null && calcReserveRaw === calcReserveRaw
            ? round2(num(calcReserveRaw))
            : round2(num(liqIn.reserve_target));
        const calcBufferRaw = liqIn.calculated_buffer;
        const buffer =
          calcBufferRaw != null && calcBufferRaw === calcBufferRaw
            ? round2(num(calcBufferRaw))
            : round2(num(liqIn.buffer_above_reserve));
        const holdRaw = liqIn.near_term_planned_cash_hold;
        const reservedRaw = liqIn.near_term_planned_cash_reserved;
        const nearTerm =
          holdRaw != null && holdRaw === holdRaw
            ? round2(num(holdRaw))
            : reservedRaw != null && reservedRaw === reservedRaw
            ? round2(num(reservedRaw))
            : 0;
        const unmappedRaw = liqIn.unmapped_card_risk_hold;
        const unmappedExec = liqIn.unmapped_card_funded_cash_risk;
        const unmapped =
          unmappedRaw != null && unmappedRaw === unmappedRaw
            ? round2(num(unmappedRaw))
            : unmappedExec != null && unmappedExec === unmappedExec
            ? round2(num(unmappedExec))
            : 0;
        return Math.max(0, round2(totalCash - reserveTarget - buffer - nearTerm - unmapped));
      })()
    },
    helocAdvisor: buildHelocAdvisorSnapshot(data, row0),
    cashBridge: buildCashBridgeFromLiquidity(liqIn),
    allocationAudit: buildAllocationAuditBlock(row0, month0ExecuteNowBudget),
    alreadyPaid: alreadyPaidRaw.map((r) => ({ account: str(r.account) })).filter((x) => x.account),
    minimums: payNowRaw
      .map((r) => ({ account: str(r.account), amountDue: round2(num(r.minimum_required)) }))
      .filter((x) => x.account),
    extraPayments: extraPaymentsOut,
    conditionalPayments: condPayments,
    executionTotals: {
      fromCash: canonicalExecuteNowCash,
      fromHeloc: helocApplied,
      totalNow: round2(canonicalExecuteNowCash + helocApplied),
      conditionalLater: condLater
    },
    decisionBox: mapDecisionBox((data.action_decision_box as Record<string, unknown>) || undefined),
    next3Months,
    watchouts: watchoutsMerged,
    strictWaterfallSplitNote: strictSplitNote || undefined,
    strictWaterfallErrors: strictWaterfallErrors.length ? strictWaterfallErrors : undefined,
    executeNowSourceValidated: executeNowSourceCheck.validated,
    executeNowSourceValidationFailures:
      executeNowSourceCheck.failures.length > 0 ? executeNowSourceCheck.failures : undefined,
    waterfallExecutionValidated,
    waterfallExecutionValidationFailures:
      waterfallExecutionValidationFailures.length > 0 ? waterfallExecutionValidationFailures : undefined,
    snapshotStatusValidated: snapshotStatusCheck.validated,
    snapshotStatusValidationFailures:
      snapshotStatusCheck.failures.length > 0 ? snapshotStatusCheck.failures : undefined,
    snapshot: snap.snapshot,
    snapshotSummary: snap.snapshotSummary,
    aggressiveMeta,
    plannedExpenseImpact,
    snapshotExecuteNowOnly: true
  };
}
