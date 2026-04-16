/**
 * Rolling Debt Payoff dashboard — React + TypeScript + inline styles only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

// —— Types (single export each) ————————————————————————————————————————

export type ExecutionPresentationMode = 'standard' | 'operator' | 'aggressive' | 'automation';

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
  };
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

function shortenWatchout(text: string, maxLen = 96): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + '…';
}

function mergeWithDemo(partial: Partial<RollingDebtPayoffDashboardData> | null | undefined): RollingDebtPayoffDashboardData {
  const d = demoRollingDebtPayoffDashboardData;
  if (!partial) return d;
  return {
    summary: { ...d.summary, ...partial.summary },
    liquidity: { ...d.liquidity, ...partial.liquidity },
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

const MODES: ExecutionPresentationMode[] = ['standard', 'operator', 'aggressive', 'automation'];

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

function AggressivePanel({ meta, totalExtraCash }: { meta: NonNullable<RollingDebtPayoffDashboardData['aggressiveMeta']>; totalExtraCash: number }) {
  const below = meta.primaryBelow90 && meta.primaryShareOfRemainingPct < 90;
  const cappedMsg =
    meta.primaryBelow90Reason || 'Primary capped at remaining payoff balance; spill to secondary was required.';
  const genericMsg =
    'Primary share is below 90% without a confirmed payoff cap — review the concentration audit in the full plan output.';
  return (
    <div style={{ border: '1px solid rgba(92, 107, 192, 0.45)', borderRadius: 12, background: C.indigoBg, padding: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.06)' }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5c6bc0' }}>Aggressive concentration</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginTop: 16 }}>
        {[
          { k: 'Post-cleanup extra pool', v: currency(meta.postCleanupExtraPool) },
          { k: 'Primary allocated', v: currency(meta.primaryAllocated) },
          { k: 'Primary share (of remainder)', v: `${meta.primaryShareOfRemainingPct.toFixed(0)}%` }
        ].map((x) => (
          <div key={x.k}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>{x.k}</p>
            <p style={{ margin: '6px 0 0 0', fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: C.text }}>{x.v}</p>
          </div>
        ))}
      </div>
      {totalExtraCash > 0 && below ? (
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

function normalizeModeFromSummary(raw: string | undefined): ExecutionPresentationMode | null {
  const m = String(raw || '')
    .toLowerCase()
    .trim();
  if (!m) return null;
  if (m === 'standard') return 'standard';
  if (MODES.includes(m as ExecutionPresentationMode)) return m as ExecutionPresentationMode;
  if (m.indexOf('automation') >= 0) return 'automation';
  return null;
}

export function RollingDebtPayoffDashboard({
  data: dataProp,
  useDemoFallback = true,
  defaultPresentationMode = 'standard',
  onPresentationModeChange,
  className,
  style: rootStyle
}: RollingDebtPayoffDashboardProps) {
  const data = useMemo(() => {
    if (useDemoFallback === false && dataProp) {
      return dataProp as RollingDebtPayoffDashboardData;
    }
    return mergeWithDemo(dataProp);
  }, [dataProp, useDemoFallback]);

  const [presentationMode, setPresentationMode] = useState<ExecutionPresentationMode>(() => {
    const fromSummary = normalizeModeFromSummary(data.summary.executionPlanMode);
    return fromSummary != null ? fromSummary : defaultPresentationMode;
  });

  useEffect(() => {
    const fromSummary = normalizeModeFromSummary(data.summary.executionPlanMode);
    setPresentationMode(fromSummary != null ? fromSummary : defaultPresentationMode);
  }, [data.summary.executionPlanMode, defaultPresentationMode]);

  const extraTotal = useMemo(() => totalExtraCash(data.extraPayments), [data.extraPayments]);
  const cleanupSum = useMemo(() => data.extraPayments.cleanup.reduce((s, l) => s + l.amount, 0), [data.extraPayments.cleanup]);
  const primarySum = useMemo(() => data.extraPayments.primary.reduce((s, l) => s + l.amount, 0), [data.extraPayments.primary]);
  const secondarySum = useMemo(() => data.extraPayments.secondary.reduce((s, l) => s + l.amount, 0), [data.extraPayments.secondary]);
  const watchTop3 = useMemo(() => data.watchouts.slice(0, 3).map((w) => shortenWatchout(w)), [data.watchouts]);

  const isAutomation = presentationMode === 'automation';
  const isOperator = presentationMode === 'operator';
  const isAggressive = presentationMode === 'aggressive';

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
            {data.summary.executionPlanMode ? (
              <span style={{ fontSize: 14, color: C.muted }}>
                Data mode <strong style={{ color: C.text }}>{data.summary.executionPlanMode}</strong>
              </span>
            ) : null}
          </div>
        </header>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
            gap: 14,
            marginBottom: 36,
            alignItems: 'stretch'
          }}
        >
          <KpiCard label="Total cash" value={currency(data.liquidity.totalCash)} />
          <KpiCard label="Reserve target" value={currency(data.liquidity.reserveTarget)} />
          <KpiCard label="Buffer" value={currency(data.liquidity.buffer)} />
          <KpiCard label="Deployable cash" value={currency(data.liquidity.deployableCash)} borderAccent="deployable" />
          <KpiCard label="Cash for extra debt" value={currency(data.liquidity.cashAvailableForExtraDebt)} borderAccent="extra" />
          <KpiCard label="HELOC recommended" value={data.liquidity.helocRecommended} sub="Execution stance" />
          <KpiCard label="Conditional extra (later)" value={currency(data.liquidity.conditionalExtraLaterThisMonth)} sub="If variable income hits" />
        </div>

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
                `reserve_target: ${currencyDetailed(data.liquidity.reserveTarget)}`,
                `buffer: ${currencyDetailed(data.liquidity.buffer)}`,
                `deployable_cash: ${currencyDetailed(data.liquidity.deployableCash)}`,
                `cash_for_extra_debt: ${currencyDetailed(data.liquidity.cashAvailableForExtraDebt)}`,
                `heloc_recommended: ${data.liquidity.helocRecommended}`
              ].join('\n')}
            />
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
                  (data.extraPayments[b] as ExtraLine[]).map((l) => `pay_row: bucket=${b} | account=${l.account} | amount=${currencyDetailed(l.amount)}`)
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
                `from_cash: ${currencyDetailed(data.executionTotals.fromCash)}`,
                `from_heloc: ${currencyDetailed(data.executionTotals.fromHeloc)}`,
                `total_now: ${currencyDetailed(data.executionTotals.totalNow)}`,
                `conditional_later: ${currencyDetailed(data.executionTotals.conditionalLater)}`
              ].join('\n')}
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
              <SnapshotTable rows={data.snapshot} summary={data.snapshotSummary} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div style={{ ...shellStyle(), marginTop: 4 }}>
              <SectionTitle>Liquidity</SectionTitle>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: C.muted, maxWidth: 720 }}>
                Deployable cash is what remains after reserve and buffer. Extra debt payments use execute-now cash (and optional HELOC when your plan
                allows it). Conditional lines only apply if variable income arrives.
              </p>
            </div>

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
                <ExtraBucketCard title="1 · Cleanup" lines={data.extraPayments.cleanup} totalExtra={extraTotal} bucketKey="cleanup" />
                <ExtraBucketCard
                  title="2 · Primary"
                  lines={data.extraPayments.primary}
                  totalExtra={extraTotal}
                  bucketKey="primary"
                  footerNote="Primary must be fully paid before secondary allocation begins."
                />
                <ExtraBucketCard
                  title="3 · Secondary"
                  lines={data.extraPayments.secondary}
                  totalExtra={extraTotal}
                  bucketKey="secondary"
                  footerNote="Secondary waterfall: CitiAA → Southwest → Marriott."
                />
                <ExtraBucketCard title="4 · Overflow" lines={data.extraPayments.overflow} totalExtra={extraTotal} bucketKey="overflow" />
              </div>
              {data.strictWaterfallSplitNote ? (
                <p style={{ margin: '16px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5, fontStyle: 'italic' }}>
                  {data.strictWaterfallSplitNote}
                </p>
              ) : null}
            </div>

            {isAggressive && data.aggressiveMeta ? <AggressivePanel meta={data.aggressiveMeta} totalExtraCash={extraTotal} /> : null}
            {isOperator ? <OperatorChecklist /> : null}

            <div style={shellStyle()}>
              <SectionTitle>Conditional (only if income arrives)</SectionTitle>
              {!data.conditionalPayments.length ? (
                <p style={{ margin: 0, fontSize: 14, color: C.muted }}>No variable-income contingent allocations for this month.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.conditionalPayments.map((c, i) => (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        border: `1px dashed ${C.border}`,
                        borderRadius: 8,
                        background: '#fafbfc',
                        fontSize: 14,
                        fontWeight: 600
                      }}
                    >
                      <span>{c.account}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: C.muted }}>{currencyDetailed(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p style={{ margin: '14px 0 0 0', fontSize: 12, color: C.muted }}>
                These amounts are <strong>not</strong> part of execute-now totals until income is realized.
              </p>
              <p style={{ margin: '10px 0 0 0', fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                Variable-income allocations use the same strict serial waterfall as execute-now (cleanup, then primary APR, then CitiAA → Southwest → Marriott, then overflow).
              </p>
            </div>

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
                    { k: 'From cash', v: currency(data.executionTotals.fromCash), h: false },
                    { k: 'From HELOC', v: currency(data.executionTotals.fromHeloc), h: false },
                    { k: 'Total now', v: currency(data.executionTotals.totalNow), h: true },
                    { k: 'Conditional later', v: currency(data.executionTotals.conditionalLater), h: false }
                  ] as const
                ).map((x) => (
                  <div key={x.k}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.75 }}>{x.k}</p>
                    <p style={{ margin: '8px 0 0 0', fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', opacity: x.h ? 1 : 0.95 }}>{x.v}</p>
                  </div>
                ))}
              </div>
            </div>

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
              <SnapshotTable rows={data.snapshot} summary={data.snapshotSummary} />
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
    conditionalExtraLaterThisMonth: 6_200
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
