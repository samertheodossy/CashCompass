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

/** Policy substrings that mark an account as clearly restricted / do-not-use.
 *  v1 is intentionally a small, conservative allowlist-of-denials: we only
 *  exclude an account when the Use Policy string explicitly indicates the
 *  account should not be touched. Ambiguous / typical policies (Emergency
 *  Reserve, Savings, Primary Checking, blank, etc.) are included because
 *  Min Buffer is already the buffer guard for those cases.
 *
 *  Matching is case-insensitive substring match on the trimmed Use Policy
 *  value. Extend with care — every addition hides cash from Next Actions.
 */
var CASH_TO_USE_RESTRICTED_POLICY_SUBSTRINGS_ = [
  'do not use',
  'do-not-use',
  'donotuse',
  'restricted',
  'locked',
  'frozen',
  'no touch',
  'no-touch',
  'notouch',
  'untouchable'
];

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
 *       excludedReason?: string       // 'inactive' | 'restricted_use_policy' (only when included=false)
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
  const display = sheet.getDataRange().getDisplayValues(); // strings for names/policy
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
    const usePolicy = headerMap.policyColZero === -1
      ? ''
      : String(display[r][headerMap.policyColZero] || '').trim();

    const isInactive = !!inactive[accountName.toLowerCase()];
    const isRestricted = isRestrictedCashToUsePolicy_(usePolicy);

    let included = true;
    let excludedReason;
    if (isInactive) {
      included = false;
      excludedReason = 'inactive';
    } else if (isRestricted) {
      included = false;
      excludedReason = 'restricted_use_policy';
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

/**
 * @param {string} policy Trimmed Use Policy string (may be '').
 * @returns {boolean} true only when the policy contains an explicit
 *   "do not use" / restricted / locked / frozen / no-touch marker. Blank
 *   and typical policies (Emergency Reserve, Savings, Primary, etc.)
 *   return false — Min Buffer is the buffer guard for those.
 */
function isRestrictedCashToUsePolicy_(policy) {
  const p = String(policy || '').toLowerCase().trim();
  if (!p) return false;
  for (let i = 0; i < CASH_TO_USE_RESTRICTED_POLICY_SUBSTRINGS_.length; i++) {
    if (p.indexOf(CASH_TO_USE_RESTRICTED_POLICY_SUBSTRINGS_[i]) !== -1) return true;
  }
  return false;
}
