/**
 * Planning → Next Actions (v1) — backend aggregator.
 *
 * `getNextActionsData()` answers "what should I do next?" by reading the same
 * sources already powering the dashboard — no new storage, no writes, no
 * planner mutations. The return value is a small, explainable payload that
 * the Planning → Next Actions panel renders as-is.
 *
 * v1 scope is intentionally tight — see:
 *   PROJECT_CONTEXT.md → Decision Layer → Next Actions v1 decision logic
 *
 * Reused readers (single source of truth per bucket):
 *   - Liquidity ............. `getCashToUse()`                   (cash_to_use.js)
 *   - Bills / debt minimums . `getBillsDueFromCashFlowForDashboard()`
 *                             (overdue + next 7 days; already merges
 *                              INPUT - Debts minimums + INPUT - Bills)
 *   - Upcoming .............. `getUpcomingExpensesUiData()`
 *                             (Planned + remaining > 0, with dayBucket)
 *   - Rolling Debt target ... lightweight waterfall-style heuristic on
 *                             `INPUT - Debts` via `normalizeDebts_()` — we
 *                             deliberately do NOT call the full
 *                             `getRollingDebtPayoffPlan()` here because it
 *                             is an expensive computation meant for its own
 *                             dashboard tab. The shape below is stable so
 *                             a future pass can swap in Rolling's real
 *                             `focus_debt` without changing consumers.
 *
 * Non-goals in v1 (do NOT add here):
 *   - retirement / investment optimization
 *   - purchase simulation
 *   - scenario planning
 *   - writes / Quick Add hooks (single payment path stays Cash Flow → Quick Add)
 */

// Window used for "urgent" obligations (today + next 7 days, plus overdue).
var NEXT_ACTIONS_URGENT_WINDOW_DAYS_ = 7;
// Wider window for "recommended" near-term Upcoming items.
var NEXT_ACTIONS_RECOMMENDED_WINDOW_DAYS_ = 30;
// Rendering caps.
//   - `urgent` is intentionally UNCAPPED in v1: the summary `urgentTotal`
//     is computed from the full candidate list, so capping the rendered
//     array made the displayed obligations disagree with the Due-soon
//     total. The UI trims visually (grouped "Other bills due soon" row)
//     but the backend returns the full set so the two always reconcile.
//     `NEXT_ACTIONS_MAX_URGENT_` is kept for reference/future UI work
//     and is deliberately unused right now.
//   - `recommended` and `optimize` keep their caps — those buckets are
//     meant to be short, and extra noise there hurts more than it helps.
var NEXT_ACTIONS_MAX_URGENT_ = 3;            // reserved for future UI trimming
var NEXT_ACTIONS_MAX_RECOMMENDED_ = 3;
var NEXT_ACTIONS_MAX_OPTIMIZE_ = 2;

// Soft cap for the recommended `pay_extra_debt` amount. v1 rule:
//   amount = min(recommendedCapacity * pct, maxDollars, debt.balance)
// Purpose: keep the suggested extra payment conservative so Next Actions
// never implies "put 100% of free cash against debt," and never suggests
// more than the debt itself owes (which would overstate the plan and
// confuse the user). The balance cap is the hard ceiling of the three.
var NEXT_ACTIONS_EXTRA_DEBT_SOFT_CAP_PCT_ = 0.5;      // 50% of free cash
var NEXT_ACTIONS_EXTRA_DEBT_SOFT_CAP_MAX_ = 1000;     // capped at $1,000

// Ranking weight for recommended Upcoming items: dollars of remaining
// amount worth "one day" of priority. Lower resulting score = higher rank.
//   score = daysUntilDue - (amount / weight)
// With weight=500, a $5,000 item effectively ranks ~10 days earlier than
// it would by due date alone. Tuned so small housekeeping items (a $200
// garden visit) don't bury major obligations (roof, solar) in the same
// 8–30 day window, while moderate size differences still respect due date.
var NEXT_ACTIONS_RECOMMENDED_AMOUNT_WEIGHT_ = 500;

// Same idea for urgent, but stricter — proximity matters more when
// everything in the pool is within 7 days or already overdue. With
// weight=2000, a $14,000 item effectively shifts ~7 days earlier in
// the rank, so a $21k Roof due in 6 days is not buried behind a $50
// bill due today, but a normal-sized obligation due day 1 still beats
// a normal-sized obligation due day 5. Tuned for the 3-slot urgent cap.
var NEXT_ACTIONS_URGENT_AMOUNT_WEIGHT_ = 2000;

/**
 * Canonical v1 Next Actions reader. Read-only, no side effects.
 *
 * @returns {{
 *   summary: {
 *     cashToUse: number,
 *     urgentTotal: number,
 *     recommendedCapacity: number
 *   },
 *   urgent: Array<NextActionItem>,
 *   recommended: Array<NextActionItem>,
 *   optimize: Array<NextActionItem>
 * }}
 *
 * NextActionItem shape:
 *   {
 *     priorityBucket: 'urgent'|'recommended'|'optimize',
 *     actionType:     'pay_bill'|'pay_debt_minimum'|'pay_upcoming'
 *                    |'finish_upcoming'|'review_cash_gap'
 *                    |'pay_extra_debt',
 *     title:          string,      // short, human-readable
 *     reason:         string,      // one-sentence explanation from current data
 *     amount:         number,      // 2dp, 0 when the action is not monetary
 *     dueDate:        string|null, // ISO yyyy-mm-dd when applicable
 *     sourceEntityType:'bill'|'debt'|'upcoming'|'system',
 *     sourceEntityName:string,     // debt/bill/upcoming name, '' for system
 *     targetTab:      string       // deep-link hint: 'billsDue'|'upcoming'
 *                                  //                |'rollingDebtPayoff'
 *                                  //                |'debts'|'nextActions'
 *   }
 */
function getNextActionsData() {
  var result = {
    summary: { cashToUse: 0, urgentTotal: 0, recommendedCapacity: 0 },
    urgent: [],
    recommended: [],
    optimize: []
  };

  // --- 1. Liquidity (cash_to_use v1). ------------------------------------
  var cashToUse = 0;
  try {
    var liq = getCashToUse();
    cashToUse = (liq && typeof liq.cashToUse === 'number') ? liq.cashToUse : 0;
  } catch (e) {
    Logger.log('getNextActionsData cash_to_use read: ' + e);
  }
  result.summary.cashToUse = round2_(cashToUse);

  // --- 2. Urgent candidates: bills (incl. debt minimums) + upcoming. -----
  var urgentCandidates = nextActionsBuildUrgentCandidates_();

  // Keep urgentTotal honest: sum across the FULL candidate list BEFORE we
  // cap the rendered array. The cash-gap rule needs to see the real total,
  // not just what happens to fit in the top 3.
  var urgentTotal = 0;
  for (var i = 0; i < urgentCandidates.length; i++) {
    urgentTotal += Number(urgentCandidates[i].amount) || 0;
  }
  result.summary.urgentTotal = round2_(urgentTotal);
  result.summary.recommendedCapacity = round2_(Math.max(0, cashToUse - urgentTotal));

  // --- 3. Cash-gap (system) action is additive context. ------------------
  // Spec: the gap action must appear but must NOT suppress any underlying
  // urgent items. We prepend it to the rendered urgent list. v1 does not
  // cap urgent (see comment on NEXT_ACTIONS_MAX_URGENT_ above) so the
  // displayed obligations always match `urgentTotal`.
  var urgentRendered = [];
  if (urgentTotal > 0 && cashToUse + 0.005 < urgentTotal) {
    var gap = round2_(urgentTotal - cashToUse);
    urgentRendered.push({
      priorityBucket: 'urgent',
      actionType: 'review_cash_gap',
      title: 'Cash gap of ' + nextActionsFmtMoney_(gap),
      reason:
        'Urgent obligations total ' +
        nextActionsFmtMoney_(urgentTotal) +
        ' but cash_to_use is only ' +
        nextActionsFmtMoney_(cashToUse) +
        ' — short by ' +
        nextActionsFmtMoney_(gap) +
        '.',
      amount: gap,
      dueDate: null,
      sourceEntityType: 'system',
      sourceEntityName: '',
      targetTab: 'nextActions'
    });
  }

  for (var j = 0; j < urgentCandidates.length; j++) {
    urgentRendered.push(urgentCandidates[j]);
  }
  result.urgent = urgentRendered;

  // --- 4. Recommended: extra debt + near-term Upcoming. ------------------
  var recommended = [];

  var rollingTarget = nextActionsPickRollingDebtTarget_();
  if (
    rollingTarget &&
    result.summary.recommendedCapacity > 0.005 &&
    recommended.length < NEXT_ACTIONS_MAX_RECOMMENDED_
  ) {
    // The builder may return null when the balance-capped amount rounds
    // to $0 (e.g. a debt with balance < $0.005), so guard before pushing.
    var extraDebtAction = nextActionsBuildExtraDebtAction_(
      rollingTarget,
      'recommended',
      result.summary.recommendedCapacity
    );
    if (extraDebtAction) recommended.push(extraDebtAction);
  }

  var nearTermUpcoming = nextActionsBuildNearTermUpcoming_();
  for (var k = 0; k < nearTermUpcoming.length; k++) {
    if (recommended.length >= NEXT_ACTIONS_MAX_RECOMMENDED_) break;
    recommended.push(nearTermUpcoming[k]);
  }
  result.recommended = recommended;

  // --- 5. Optimize: sparse, only when we have a clear signal. ------------
  var optimize = [];

  // Extra debt acceleration — only emit when there IS a rolling target and
  // we did not already recommend it above (i.e. no capacity right now).
  if (
    rollingTarget &&
    optimize.length < NEXT_ACTIONS_MAX_OPTIMIZE_ &&
    result.summary.recommendedCapacity <= 0.005
  ) {
    // Intentionally amount = 0 in optimize: there is no cash_to_use capacity
    // right now, so sizing would be misleading. The reason line is explicit
    // about that — see nextActionsBuildExtraDebtAction_.
    optimize.push(nextActionsBuildExtraDebtAction_(rollingTarget, 'optimize', 0));
  }

  // HELOC review action intentionally removed from Next Actions.
  // Rolling Debt Payoff already owns the HELOC strategy card and its
  // "what would change this?" levers. Repeating a "review HELOC" card
  // here was a confusing overlap — users reach the same decision surface
  // through the pay_extra_debt card's targetTab and the Planning → Rolling
  // Debt Payoff link.

  result.optimize = optimize;

  return result;
}

/* =====================================================================
 * Urgent candidate builders
 * ===================================================================== */

/**
 * Builds the full urgent candidate list (NOT yet capped).
 * Sources:
 *   - overdue bills / debt minimums (from Cash Flow reader)
 *   - bills / debt minimums due in the next 7 days
 *   - Planned upcoming items overdue or due in the next 7 days, remaining > 0
 *
 * Sort order (per spec):
 *   1) overdue first
 *   2) blended score (proximity + amount) so large near-term obligations
 *      (e.g., Roof, Solar) are not buried under small bills
 *   3) debt minimum before upcoming when otherwise tied
 *
 * See NEXT_ACTIONS_URGENT_AMOUNT_WEIGHT_ for the blended scoring rationale.
 *
 * Bills / debts with amount <= 0 are dropped: zero-amount bills carry no
 * obligation we can size against cash_to_use, and including them would make
 * urgentTotal misleading. The user still sees them in the dedicated Bills
 * Due tab.
 */
function nextActionsBuildUrgentCandidates_() {
  var items = [];

  // Bills + debt minimums (already merged + date-windowed server-side).
  try {
    var billsDue = getBillsDueFromCashFlowForDashboard();
    (billsDue.overdue || []).forEach(function(r) {
      var it = nextActionsBillRowToItem_(r, /*overdue=*/true);
      if (it) items.push(it);
    });
    (billsDue.next7 || []).forEach(function(r) {
      var it = nextActionsBillRowToItem_(r, /*overdue=*/false);
      if (it) items.push(it);
    });
  } catch (e) {
    Logger.log('getNextActionsData bills reader: ' + e);
  }

  // Upcoming (remaining > 0, status Planned, bucketed server-side).
  try {
    var upcomingData = getUpcomingExpensesUiData();
    (upcomingData.expenses || []).forEach(function(row) {
      if (row.status !== 'Planned') return;
      if (!(Number(row.amount) > 0.005)) return;
      if (row.dayBucket !== 'Overdue' && row.dayBucket !== 'Today' && row.dayBucket !== 'Next 7 Days') return;

      var isOverdue = row.dayBucket === 'Overdue';
      items.push({
        priorityBucket: 'urgent',
        actionType: 'pay_upcoming',
        title:
          (isOverdue ? 'Finish ' : 'Pay ') +
          (row.expenseName || row.payee || 'upcoming item'),
        reason: nextActionsReasonForUpcomingUrgent_(row, isOverdue),
        amount: round2_(row.amount),
        dueDate: row.dueDate || null,
        sourceEntityType: 'upcoming',
        sourceEntityName: row.expenseName || row.payee || '',
        targetTab: 'upcoming',
        __sortKey: nextActionsUrgentSortKey_(row.dueDate, row.amount, /*isDebtMin=*/false, isOverdue)
      });
    });
  } catch (e) {
    Logger.log('getNextActionsData upcoming reader: ' + e);
  }

  items.sort(function(a, b) {
    return nextActionsCompareUrgentSortKeys_(a.__sortKey, b.__sortKey);
  });

  items.forEach(function(it) { delete it.__sortKey; });
  return items;
}

/**
 * Converts a bill row from `getBillsDueFromCashFlowForDashboard()` into a
 * Next Actions item.
 *
 * Classification (tight):
 *   - sourceType === 'debt' OR matchedToDebt === true  → pay_debt_minimum
 *     (this is the shape `getDebtBillsDueRows_()` stamps for INPUT - Debts
 *      rows whose Cash Flow row we matched to a specific debt, and it is
 *      the authoritative flag for "this is a debt minimum, not a bill")
 *   - every other sourceType (input_bill, fallback, or anything else the
 *     reader might add later) → pay_bill
 *
 * This preserves the invariant that `pay_debt_minimum` is only emitted
 * when the backend has explicitly tied the row to INPUT - Debts, so a
 * Bills-only row can never silently look like a debt minimum.
 */
function nextActionsBillRowToItem_(r, isOverdue) {
  var amount = Number(r && r.amount) || 0;
  if (!(amount > 0.005)) return null;

  var sourceType = String(r.sourceType || '').toLowerCase();
  var isDebtMin = sourceType === 'debt' || r.matchedToDebt === true;
  var name = String(r.name || r.payee || '').trim() || 'bill';

  var item = {
    priorityBucket: 'urgent',
    actionType: isDebtMin ? 'pay_debt_minimum' : 'pay_bill',
    title: (isOverdue ? 'Pay overdue ' : 'Pay ') + name,
    reason: nextActionsReasonForBillUrgent_(r, isOverdue, isDebtMin),
    amount: round2_(amount),
    dueDate: r.dueDate || null,
    sourceEntityType: isDebtMin ? 'debt' : 'bill',
    sourceEntityName: name,
    targetTab: 'billsDue',
    __sortKey: nextActionsUrgentSortKey_(r.dueDate, amount, isDebtMin, isOverdue)
  };
  return item;
}

// Reasons intentionally skip the amount and due date — both are already
// rendered as dedicated fields on the card, so the reason line only needs
// to add the "why it's urgent" context.
function nextActionsReasonForBillUrgent_(r, isOverdue, isDebtMin) {
  if (isDebtMin) {
    return isOverdue ? 'Overdue debt minimum.' : 'Debt minimum due soon.';
  }
  return isOverdue ? 'Overdue bill.' : 'Bill due within 7 days.';
}

function nextActionsReasonForUpcomingUrgent_(row, isOverdue) {
  return isOverdue
    ? 'Overdue upcoming obligation.'
    : 'Upcoming obligation due within 7 days.';
}

/**
 * Sort key mirrors the documented priority order so `urgent` output is
 * deterministic from the same inputs:
 *   overdue first → blended (proximity + amount) → debt min > upcoming.
 *
 * Within each overdue tier we use a blended score
 *   score = daysUntilDue - (amount / NEXT_ACTIONS_URGENT_AMOUNT_WEIGHT_)
 * so large obligations (Roof, Solar) are not dropped under the 3-slot
 * cap when several small bills are also due. Proximity still dominates
 * for normal-sized items; only materially larger amounts can overtake
 * an earlier-dated obligation.
 */
function nextActionsUrgentSortKey_(dueDate, amount, isDebtMin, isOverdue) {
  var dueTs = dueDate
    ? (function() {
        var d = new Date(dueDate + 'T00:00:00');
        return isNaN(d.getTime()) ? Number.MAX_SAFE_INTEGER : d.getTime();
      })()
    : Number.MAX_SAFE_INTEGER;
  // Days until due (negative if overdue). Unknown due dates get a large
  // positive value so they sort last within their overdue tier.
  var days = dueTs === Number.MAX_SAFE_INTEGER
    ? 999
    : (dueTs - nextActionsStartOfTodayMs_()) / 86400000;
  var amt = Number(amount) || 0;
  var blended = days - (amt / NEXT_ACTIONS_URGENT_AMOUNT_WEIGHT_);
  return {
    overdueRank: isOverdue ? 0 : 1,
    blended: blended,
    // debt minimum (0) sorts before upcoming (1) when other keys tie
    typeRank: isDebtMin ? 0 : 1
  };
}

function nextActionsCompareUrgentSortKeys_(a, b) {
  if (a.overdueRank !== b.overdueRank) return a.overdueRank - b.overdueRank;
  if (a.blended !== b.blended) return a.blended - b.blended;
  return a.typeRank - b.typeRank;
}

/* =====================================================================
 * Rolling Debt Payoff target (lightweight waterfall heuristic)
 * ===================================================================== */

/**
 * Picks a single "current target" active debt to recommend extra principal
 * toward. Mirrors Rolling Debt Payoff's intent without paying its cost:
 *   1) highest APR active credit-card-ish debt (balance > 0)
 *   2) else smallest-balance active debt (snowball fallback)
 * Returns a normalized debt object or null.
 *
 * IMPORTANT: This is a stable *signal*, not the planner's answer. When the
 * real Next Actions UI lands we can swap in Rolling's `focus_debt` here
 * without changing any caller. Do not expand this into a second payoff
 * algorithm — Rolling Debt Payoff remains the source of truth.
 */
function nextActionsPickRollingDebtTarget_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rows = readSheetAsObjects_(ss, 'DEBTS');
    var debts = normalizeDebts_(rows, getAliasMap_()).filter(function(d) {
      return d.active && d.balance > 0.005;
    });
    if (!debts.length) return null;

    // Prefer credit-card-like debts with a non-trivial interest rate.
    var cards = debts.filter(function(d) {
      var t = String(d.type || '').toLowerCase();
      return (t.indexOf('credit') !== -1 || t.indexOf('card') !== -1) &&
        (Number(d.interestRate) || 0) > 0;
    });
    if (cards.length) {
      cards.sort(function(a, b) {
        var ar = Number(a.interestRate) || 0;
        var br = Number(b.interestRate) || 0;
        if (ar !== br) return br - ar;
        return a.balance - b.balance;
      });
      return cards[0];
    }

    // Snowball fallback: smallest active balance.
    debts.sort(function(a, b) { return a.balance - b.balance; });
    return debts[0];
  } catch (e) {
    Logger.log('getNextActionsData rolling target: ' + e);
    return null;
  }
}

/**
 * Builds a `pay_extra_debt` action.
 *
 * Wording note (explainability rule): the debt target here comes from a
 * *lightweight heuristic* over normalized debts (highest-APR active card,
 * else smallest active balance). We deliberately do NOT call the full
 * Rolling Debt Payoff engine in this aggregator — see
 * `nextActionsPickRollingDebtTarget_`. The title/reason below avoid any
 * phrasing that would imply this is the planner's final answer; the user
 * is directed to Rolling Debt Payoff for the authoritative plan and
 * sizing.
 *
 * @param {Object} debt   Normalized debt (`originalName`, `balance`,
 *                        `interestRate`, `type`, etc.).
 * @param {'recommended'|'optimize'} bucket
 * @param {number} capacity Raw free-cash capacity after urgent obligations.
 *        For `recommended` pass `summary.recommendedCapacity` — this
 *        function applies the v1 soft cap internally so the action surfaces
 *        a *suggested* extra payment, never "spend all your free cash."
 *        For `optimize` pass 0 — there is no cash available today, so
 *        sizing would be misleading.
 */
function nextActionsBuildExtraDebtAction_(debt, bucket, capacity) {
  var rawCapacity = Math.max(0, Number(capacity) || 0);
  var debtBalance = Math.max(0, Number(debt.balance) || 0);
  var amount;
  var title;
  // Keep the reason short and surface-neutral. Next Actions should not
  // re-explain the highest-APR heuristic or quote APR — those details
  // live on Rolling Debt Payoff, which is where the user confirms the
  // real allocation. Duplicating that reasoning here was a confusing
  // overlap (same "focus debt" narrative in three places).
  var reason =
    'Extra payment toward ' + debt.originalName +
    '. Confirm in Rolling Debt Payoff.';
  if (bucket === 'recommended') {
    // v1 soft cap: suggest at most half of the free cash, and at most
    // $1,000 — keeps the recommendation conservative and explainable.
    var softCapped = Math.min(
      rawCapacity * NEXT_ACTIONS_EXTRA_DEBT_SOFT_CAP_PCT_,
      NEXT_ACTIONS_EXTRA_DEBT_SOFT_CAP_MAX_
    );
    // Hard cap at current balance so the recommendation never suggests
    // paying more than the debt actually owes (e.g. a $503 balance can
    // never take a $1,000 extra payment).
    amount = round2_(Math.min(softCapped, debtBalance));
    // If nothing meaningful is left to pay, skip the action entirely —
    // the caller guards with `if (extraDebtAction) recommended.push(...)`.
    if (!(amount > 0.005)) return null;

    title = 'Apply ' + nextActionsFmtMoney_(amount) + ' to ' + debt.originalName;
  } else {
    amount = 0;
    title = 'Consider extra payments on ' + debt.originalName;
  }
  return {
    priorityBucket: bucket,
    actionType: 'pay_extra_debt',
    title: title,
    reason: reason,
    amount: amount,
    dueDate: null,
    sourceEntityType: 'debt',
    sourceEntityName: debt.originalName,
    targetTab: 'rollingDebtPayoff'
  };
}

/* =====================================================================
 * Near-term Upcoming (recommended bucket)
 * ===================================================================== */

/**
 * Planned upcoming items with remaining > 0 that sit AFTER the urgent
 * window but within NEXT_ACTIONS_RECOMMENDED_WINDOW_DAYS_. Keeps the list
 * short and ignores the already-urgent rows (those live in `urgent`).
 */
function nextActionsBuildNearTermUpcoming_() {
  var out = [];
  try {
    var data = getUpcomingExpensesUiData();
    var rows = data.expenses || [];
    var todayMs = nextActionsStartOfTodayMs_();
    var urgentWindowMs = NEXT_ACTIONS_URGENT_WINDOW_DAYS_ * 86400000;
    var recWindowMs = NEXT_ACTIONS_RECOMMENDED_WINDOW_DAYS_ * 86400000;

    rows.forEach(function(row) {
      if (row.status !== 'Planned') return;
      if (!(Number(row.amount) > 0.005)) return;
      if (!row.dueDate) return;

      // Belt-and-suspenders: anything the server already bucketed as
      // near-term belongs to urgent, not recommended. Keeps the two
      // buckets from ever double-counting the same obligation even if
      // dayBucket and deltaMs drift due to timezone edge cases.
      if (row.dayBucket === 'Overdue' || row.dayBucket === 'Today' ||
          row.dayBucket === 'Next 7 Days') return;

      var dueMs = new Date(row.dueDate + 'T00:00:00').getTime();
      if (isNaN(dueMs)) return;

      var deltaMs = dueMs - todayMs;
      // Strictly after the urgent window (>7 days out), inside the 30-day
      // recommended window, forward-looking only.
      if (deltaMs <= urgentWindowMs) return;
      if (deltaMs > recWindowMs) return;

      var nm = row.expenseName || row.payee || 'upcoming item';
      var amountNum = Number(row.amount) || 0;
      var daysOut = deltaMs / 86400000;
      // Blended priority score (lower = higher priority). Earlier due
      // dates still dominate for comparable sizes, but a significantly
      // larger remaining amount will pull a later-due obligation above a
      // smaller-but-sooner one. See NEXT_ACTIONS_RECOMMENDED_AMOUNT_WEIGHT_
      // for the rationale behind the $500/day weight.
      var score = daysOut - (amountNum / NEXT_ACTIONS_RECOMMENDED_AMOUNT_WEIGHT_);

      out.push({
        priorityBucket: 'recommended',
        actionType: 'finish_upcoming',
        title: 'Start paying toward ' + nm,
        // Amount + due date are both on the card already. Reason only
        // needs to explain WHY we surfaced it now.
        reason: 'Pay now to keep it out of the urgent window.',
        amount: round2_(amountNum),
        dueDate: row.dueDate,
        sourceEntityType: 'upcoming',
        sourceEntityName: nm,
        targetTab: 'upcoming',
        __sortScore: score
      });
    });

    // Primary sort: blended score (due date + amount weight).
    // Tiebreakers (stable, deterministic): larger remaining first, then
    // earlier due date as a final fallback.
    out.sort(function(a, b) {
      if (a.__sortScore !== b.__sortScore) return a.__sortScore - b.__sortScore;
      var amtDelta = (Number(b.amount) || 0) - (Number(a.amount) || 0);
      if (amtDelta !== 0) return amtDelta;
      return (a.dueDate || '') < (b.dueDate || '') ? -1 : 1;
    });
    out.forEach(function(it) { delete it.__sortScore; });
  } catch (e) {
    Logger.log('getNextActionsData near-term upcoming: ' + e);
  }
  return out;
}

/* =====================================================================
 * Utilities (local — do not leak into the global dashboard helpers)
 * ===================================================================== */

function nextActionsStartOfTodayMs_() {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function nextActionsFmtMoney_(n) {
  var v = Number(n);
  if (!isFinite(v)) v = 0;
  var sign = v < 0 ? '-' : '';
  var abs = Math.abs(v);
  var parts = abs.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + '$' + parts.join('.');
}
