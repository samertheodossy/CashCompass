/**
 * Decision Layer — v1 liquidity reader.
 *
 * `getCashToUse()` returns a conservative, current-state-only measure of how
 * much cash is safely available to act on recommendations right now. Consumed
 * later by the Planning → Next Actions aggregator. Deliberately simpler than
 * the richer Safe-to-use math inside Rolling Debt Payoff — see
 * `PROJECT_CONTEXT.md → Decision Layer → Liquidity model v1 — cash_to_use`.
 *
 * No UI / planner integration in this pass. Backend-only, read-only.
 */

/**
 * v1 structured eligibility allow-lists.
 *
 * SYS - Accounts carries two structured columns we rely on:
 *   - Type      ∈ { Cash, Checking, Savings, Credit Card, … }
 *   - Use Policy∈ { USE_FOR_BILLS, USE_FOR_DEBT, USE_WITH_CAUTION,
 *                   DO_NOT_TOUCH }
 *
 * v1 is strict: we only count an account toward `cash_to_use` when BOTH the
 * Type and the Use Policy land in an explicit allow-list below. Anything
 * else (blank policy, "other" type, credit cards, DO_NOT_TOUCH, etc.) is
 * excluded with a specific reason so the UI / debug preview can explain why.
 *
 * Matching is case-insensitive on the trimmed display value. Extend with
 * care — every addition widens what counts as usable cash.
 */
var CASH_TO_USE_ALLOWED_TYPES_ = ['cash', 'checking', 'savings'];
var CASH_TO_USE_ALLOWED_POLICIES_ = [
  'use_for_bills',
  'use_for_debt',
  'use_with_caution'
];
var CASH_TO_USE_DO_NOT_TOUCH_POLICY_ = 'do_not_touch';

/**
 * Canonical v1 liquidity reader.
 *
 * Returns:
 *   {
 *     cashToUse: number,              // sum of usable across included accounts, 2dp
 *     accounts: Array<{
 *       accountName: string,
 *       balance: number,              // 2dp, normalized number (not a string)
 *       minBuffer: number,            // 2dp, 0 when SYS - Accounts has no Min Buffer
 *       usable: number,               // max(0, balance - minBuffer), 0 when excluded
 *       included: boolean,            // true iff this account contributed to cashToUse
 *       excludedReason?: string       // 'inactive' | 'non_cash_type'
 *                                     // | 'do_not_touch_policy'
 *                                     // | 'unsupported_use_policy'
 *                                     // (only when included=false)
 *     }>
 *   }
 *
 * Reads SYS - Accounts only (the canonical dashboard/bank-account data path
 * already used by `getAccountsRowData_` and the inactive-filter helper).
 * Inactive accounts are filtered via `getInactiveBankAccountsSet_()` so the
 * "blank = active, explicit No/n/false/inactive = inactive" rule is shared
 * with every other Bank Accounts consumer.
 *
 * Guardrails:
 *   - Per-account `usable` is clamped at 0 — `balance - minBuffer` is never
 *     allowed to contribute negatively to the total.
 *   - Min Buffer is always respected; a missing Min Buffer column defaults
 *     to 0 (fall through to the balance itself being usable).
 *   - Credit cards and any non-cash Type are excluded outright — they are
 *     debts / payment instruments, not liquid cash.
 *   - DO_NOT_TOUCH is excluded outright regardless of balance or buffer.
 *   - No credit lines, HELOC, investments, future income, or forecasts are
 *     considered. Bank Accounts only.
 *
 * Even excluded rows are returned in `accounts` (with `included: false` and
 * `excludedReason`) so the UI / debugging can show why a number is what it is.
 */
function getCashToUse() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ACCOUNTS');

  const raw = sheet.getDataRange().getValues();       // numeric values for money
  const display = sheet.getDataRange().getDisplayValues(); // strings for names/type/policy
  const result = { cashToUse: 0, accounts: [] };

  if (display.length < 2) return result;

  let headerMap;
  try {
    headerMap = getAccountsHeaderMap_(sheet);
  } catch (e) {
    // SYS - Accounts must at minimum carry Account Name; if the sheet is
    // malformed, surface an empty result rather than throwing — Next Actions
    // will simply treat cash_to_use as 0 and emit review_cash_gap when
    // obligations are non-zero.
    Logger.log('getCashToUse header map: ' + e);
    return result;
  }

  // Shared inactive rule (explicit No / n / false / inactive = inactive;
  // blank / missing column = active). Lower-case name → true.
  let inactive = Object.create(null);
  try {
    inactive = getInactiveBankAccountsSet_();
  } catch (e) {
    Logger.log('getCashToUse inactive filter: ' + e);
  }

  let total = 0;

  for (let r = 1; r < display.length; r++) {
    const accountName = String(display[r][headerMap.nameColZero] || '').trim();
    if (!accountName) continue;

    const balance = headerMap.balanceColZero === -1
      ? 0
      : round2_(toNumber_(raw[r][headerMap.balanceColZero]));
    const minBuffer = headerMap.bufferColZero === -1
      ? 0
      : round2_(toNumber_(raw[r][headerMap.bufferColZero]));
    const typeRaw = headerMap.typeColZero === -1
      ? ''
      : String(display[r][headerMap.typeColZero] || '').trim();
    const usePolicyRaw = headerMap.policyColZero === -1
      ? ''
      : String(display[r][headerMap.policyColZero] || '').trim();

    const typeKey = typeRaw.toLowerCase();
    const policyKey = usePolicyRaw.toLowerCase();

    // Eligibility is evaluated in priority order. The first matching exclude
    // reason wins, so `excludedReason` stays stable and explainable even when
    // multiple rules would fire (e.g. inactive + DO_NOT_TOUCH).
    let included = true;
    let excludedReason;

    if (inactive[accountName.toLowerCase()]) {
      included = false;
      excludedReason = 'inactive';
    } else if (CASH_TO_USE_ALLOWED_TYPES_.indexOf(typeKey) === -1) {
      // Covers Credit Card, blank/missing Type, and any other non-cash Type.
      included = false;
      excludedReason = 'non_cash_type';
    } else if (policyKey === CASH_TO_USE_DO_NOT_TOUCH_POLICY_) {
      included = false;
      excludedReason = 'do_not_touch_policy';
    } else if (CASH_TO_USE_ALLOWED_POLICIES_.indexOf(policyKey) === -1) {
      // Blank Use Policy or anything outside the v1 allow-list.
      included = false;
      excludedReason = 'unsupported_use_policy';
    }

    // max(0, balance - minBuffer). 2dp, number (not string). Zero when
    // excluded so the breakdown row still reads cleanly.
    const rawUsable = included ? (balance - minBuffer) : 0;
    const usable = rawUsable > 0 ? round2_(rawUsable) : 0;

    if (included) total += usable;

    const entry = {
      accountName: accountName,
      balance: balance,
      minBuffer: minBuffer,
      usable: usable,
      included: included
    };
    if (!included) entry.excludedReason = excludedReason;
    result.accounts.push(entry);
  }

  result.cashToUse = round2_(total);
  return result;
}
