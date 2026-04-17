/**
 * Maps Apps Script `getRollingDebtPayoffPlan` JSON into RollingDebtPayoffDashboardData.
 * Snapshot rows mirror server `buildPostPaymentSnapshotLines_` (execute-now + HELOC to target only).
 */

import type {
  ExecutionPresentationMode,
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
