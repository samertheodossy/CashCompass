/**
 * Rolling debt payoff — conservative month-anchored plan from INPUT - Cash Flow + Debts + Accounts.
 * Separate from Payoff Path (read-only payoff). See TODO.md for product rules.
 */

var ROLLING_DP_RESERVE_DEFAULT_ = 100000;
/** Liquid layer held above reserve — not deployed to extra principal (rolling plan). */
var ROLLING_DP_BUFFER_ABOVE_RESERVE_ = 100000;
/** Max extra principal from deployable cash per calendar month (rolling plan). */
var ROLLING_DP_MAX_CASH_DEPLOYMENT_MONTHLY_ = 50000;
/** Max optional HELOC draw per month when policy allows (high-APR cards + cash cap reached). */
var ROLLING_DP_MAX_HELOC_DRAW_MONTHLY_ = 25000;
/** Max cumulative new HELOC draws for payoff support (advisory / action plan). */
var ROLLING_DP_HELOC_ACTION_DRAW_CAP_ = 50000;
/** Credit card APR threshold (%) for HELOC-assisted payoff (execution plan + simulation). */
var ROLLING_DP_HELOC_CC_APR_THRESHOLD_ = 15;
/** Minimum HELOC draw in a month when policy allows (otherwise no HELOC line). */
var ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_ = 1000;
/** Replaced after key_warnings are finalized (one-page execution plan). */
var ROLLING_DP_WATCHOUTS_PLACEHOLDER_ = '__ROLLING_DP_WATCHOUTS_PLACEHOLDER__';
/** Replaced after execution checks may change plan_status. */
var ROLLING_DP_PLAN_STATUS_PLACEHOLDER_ = '__ROLLING_DP_PLAN_STATUS__';
/** Target card APR must exceed HELOC APR by at least this many percentage points for any HELOC hint. */
var ROLLING_DP_HELOC_MIN_SPREAD_OVER_HELOC_APR_ = 3;
/** Credit card balances at or below this are paid off before larger-card APR ordering. */
var ROLLING_DP_EXEC_PLAN_SMALL_BALANCE_SNOWBALL_MAX_ = 2500;
/** Post-cleanup extra principal pool: fraction routed to primary APR target first (legacy 75/25; simulation uses strict serial waterfall). */
var ROLLING_DP_PHASE2_PRIMARY_FRACTION_STANDARD_ = 0.75;
/**
 * Secondary execute-now waterfall after primary (highest APR) is exhausted for this pass.
 * Canonical labels resolved against INPUT debts via normalizeName_ + alias map.
 */
var ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_ = [
  'Credit Card - CitiAA',
  'Credit Card - Southwest',
  'Credit Card - Marriott'
];
/** Aggressive mode: concentrate post-cleanup extras on primary (remainder only to secondary / spill). */
var ROLLING_DP_PHASE2_PRIMARY_FRACTION_AGGRESSIVE_ = 0.9;
var ROLLING_DP_LUMP_DEBT_ = 0.5;
var ROLLING_DP_LUMP_RESERVE_ = 0.3;
var ROLLING_DP_LUMP_FLEX_ = 0.2;

/**
 * Recurring stable income — match Cash Flow Payee after trim + collapse spaces + lowercasing.
 * Punctuation/hyphens preserved on both sides (no alias remap for stable classification).
 */
var ROLLING_DP_EXACT_STABLE_INCOME_PAYEES_ = [
  'Cisco Pay 1',
  'Cisco Pay 2',
  'Cisco Pay 3',
  'Rent Mo House',
  'Rent Oakley House - Section 8',
  'Rent Oakley House - Tenant Part 1',
  'Rent Oakley House - Tenant Part 2',
  'Rent Oakley House - Tenant Part 3',
  'Rent San Diego House',
  'Rent MN House'
];

/** Last-12-month stable debug table (canonical → column title). */
var ROLLING_DP_STABLE_MONTHLY_DEBUG_COLUMNS_ = [
  { canonical: 'Cisco Pay 1', header: 'Cisco Pay 1' },
  { canonical: 'Cisco Pay 2', header: 'Cisco Pay 2' },
  { canonical: 'Rent Mo House', header: 'Rent Mo House' },
  { canonical: 'Rent Oakley House - Section 8', header: 'Rent Oakley Section 8' },
  { canonical: 'Rent San Diego House', header: 'Rent SD' },
  { canonical: 'Rent MN House', header: 'Rent MN' }
];

var ROLLING_DP_STABLE_PARSING_SAMPLE_PAYEES_ = ['Cisco Pay 1', 'Cisco Pay 2', 'Rent Mo House', 'Rent San Diego House'];

var ROLLING_DP_VARIABLE_INCOME_HINTS_ = [
  'RSU',
  'ESPP',
  'bonus',
  'refund',
  'stock',
  'sale',
  'vest',
  'dividend',
  'capital gain'
];

var ROLLING_DP_SD_REVIEW_LOSS_ = 1500;
var ROLLING_DP_SD_SALE_MONTHS_ = 12;
var ROLLING_DP_SD_SALE_APPREC_PCT_ = 3;

/** San Diego watchlist — explicit CF payees + conservative override when not isolated */
var ROLLING_DP_SD_RENT_PAYEE_ = 'Rent San Diego House';
var ROLLING_DP_SD_COST_PAYEES_ = ['Bank of America Loan - San Diego Condo', 'SD HOA (TownSq)'];
var ROLLING_DP_SD_OVERRIDE_RENT_ = 2600;
var ROLLING_DP_SD_OVERRIDE_COST_ = 4000;
var ROLLING_DP_SD_OVERRIDE_DRAG_ = 1400;

/** Substrings (with leading/trailing spaces) matched inside `' ' + payeeLower + ' '` for recurring operating classification. */
var ROLLING_DP_RECURRING_OP_SPACE_HINTS_ = [
  ' mortgage ',
  ' home loan ',
  ' loan ',
  ' heloc ',
  ' hoa ',
  ' dues ',
  ' utilities ',
  ' utility ',
  ' electric ',
  ' pg&e ',
  ' pge ',
  ' sdge ',
  ' edison ',
  ' water ',
  ' sewer ',
  ' trash ',
  ' waste ',
  ' gas ',
  ' tuition ',
  ' school ',
  ' cleaning ',
  ' maid ',
  ' membership ',
  ' netflix ',
  ' spotify ',
  ' hulu ',
  ' hbo ',
  ' stream ',
  ' internet ',
  ' comcast ',
  ' xfinity ',
  ' cox ',
  ' verizon ',
  ' t-mobile ',
  ' tmobile ',
  ' at&t ',
  ' att ',
  ' insurance ',
  ' lawncare ',
  ' lawn ',
  ' pest ',
  ' security ',
  ' alarm ',
  ' storage ',
  ' gym ',
  ' ymca ',
  ' subscription '
];

var ROLLING_DP_IRREGULAR_EXPENSE_SPACE_HINTS_ = [
  ' property tax ',
  ' tax bill ',
  ' income tax ',
  ' irs ',
  ' turbotax ',
  ' h&r block ',
  ' repair ',
  ' maintenance ',
  ' remodel ',
  ' contractor ',
  ' plumber ',
  ' roof ',
  ' furnace ',
  ' hvac ',
  ' permit ',
  ' special assessment ',
  ' appraisal ',
  ' closing cost ',
  ' legal fee '
];

var ROLLING_DP_DEBT_CLEANUP_SPACE_HINTS_ = [
  ' balance transfer ',
  ' card payoff ',
  ' extra payment ',
  ' principal paydown ',
  ' apple card ',
  ' chase sapphire ',
  ' discover ',
  ' amex ',
  ' synchrony ',
  ' barclays ',
  ' capital one ',
  ' citi ',
  ' cc -',
  ' cc ',
  ' credit card ',
  ' macys ',
  ' luma '
];

/** Explicit loan expense payee alias groups (INPUT - Cash Flow); normalized with alias map at runtime. */
var ROLLING_DP_LOAN_ALIAS_MERGE_GROUPS_RAW_ = [
  ['Bank of America Loan - Lake Tahoe House', 'Bofa - Tahoe Loan'],
  ['Bank of America Loan - San Diego Condo', 'Bofa - SD Loan'],
  ['MTB Bank - MO 4 Plex', 'MTB - MO Loan'],
  ['Meriwest Credit Union', 'Meriwest Credit Union Loan']
];

function cashFlowCellIsPresent_(row, monthHeader) {
  const h = String(monthHeader || '').trim();
  if (!h) return false;
  let v = row[h];
  if (v !== '' && v !== null && v !== undefined && String(v).trim() !== '') return true;
  const dKey = '__display__' + h;
  if (Object.prototype.hasOwnProperty.call(row, dKey)) {
    const d = row[dKey];
    if (d !== '' && d !== null && String(d).trim() !== '') return true;
  }
  return false;
}

/**
 * Raw cell text for a month column (for diagnostics). Null if blank / missing.
 */
function readCashFlowMonthRawDisplay_(row, monthHeader) {
  const h = String(monthHeader || '').trim();
  if (!h) return null;
  if (Object.prototype.hasOwnProperty.call(row, h)) {
    const v = row[h];
    if (v !== '' && v !== null && v !== undefined && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  const dKey = '__display__' + h;
  if (Object.prototype.hasOwnProperty.call(row, dKey)) {
    const d = row[dKey];
    if (d !== '' && d !== null && String(d).trim() !== '') {
      return String(d).trim();
    }
  }
  return null;
}

/**
 * Parse CF currency display ("$7,071.18", parentheses negatives) to a finite number.
 * Blank / null / unparsable → null (missing). "$0.00" / 0 → 0.
 */
function parseCashFlowCurrencyNullable_(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = toNumber_(raw);
  if (!isFinite(n)) return null;
  return round2_(n);
}

/**
 * Numeric month amount for a row; null = blank/missing (exclude from medians), 0 = real zero.
 */
function readCashFlowMonthAmountNullable_(row, monthHeader) {
  const raw = readCashFlowMonthRawDisplay_(row, monthHeader);
  if (raw === null) return null;
  return parseCashFlowCurrencyNullable_(raw);
}

function readCashFlowMonthAmount_(row, monthHeader) {
  const n = readCashFlowMonthAmountNullable_(row, monthHeader);
  return n === null ? 0 : n;
}

function monthHasAnyCfRowPresent_(rows, monthHeader) {
  if (!rows || !rows.length) return false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const tu = String(r.Type || '')
      .trim()
      .toUpperCase();
    if (tu !== 'INCOME' && tu !== 'EXPENSE') continue;
    if (cashFlowCellIsPresent_(r, monthHeader)) return true;
  }
  return false;
}

/**
 * Sum stable income for one CF month: only rows with non-blank numeric cells.
 * nonEmpty = at least one matched stable payee had a value (including $0.00).
 */
function stableIncomeMonthTotalFromRows_(rows, monthHeader, aliasMap) {
  if (!rows) return { sum: 0, nonEmpty: false };
  let sum = 0;
  let nonEmpty = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r.Type || '')
        .trim()
        .toUpperCase() !== 'INCOME') {
      continue;
    }
    if (!classifyStableIncomePayee_(r.Payee, aliasMap)) continue;
    const v = readCashFlowMonthAmountNullable_(r, monthHeader);
    if (v !== null) {
      sum += v;
      nonEmpty = true;
    }
  }
  return { sum: round2_(sum), nonEmpty: nonEmpty };
}

function stableIncomeFromRawRows_(rows, monthHeader, aliasMap) {
  return stableIncomeMonthTotalFromRows_(rows, monthHeader, aliasMap).sum;
}

/** Sum one canonical stable payee for a month (multiple rows rare). null = no numeric cell. */
function stableIncomeSumForCanonicalInMonth_(rows, monthHeader, canonical) {
  if (!rows || !canonical) return { sum: 0, had: false };
  let sum = 0;
  let had = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r.Type || '')
        .trim()
        .toUpperCase() !== 'INCOME') {
      continue;
    }
    if (stableCanonicalForPayeeRaw_(r.Payee) !== canonical) continue;
    const v = readCashFlowMonthAmountNullable_(r, monthHeader);
    if (v !== null) {
      sum += v;
      had = true;
    }
  }
  return { sum: round2_(sum), had: had };
}

function variableIncomeFromRawRows_(rows, monthHeader, aliasMap) {
  if (!rows) return 0;
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r.Type || '')
        .trim()
        .toUpperCase() !== 'INCOME') {
      continue;
    }
    if (!cashFlowCellIsPresent_(r, monthHeader)) continue;
    if (classifyStableIncomePayee_(r.Payee, aliasMap)) continue;
    sum += readCashFlowMonthAmount_(r, monthHeader);
  }
  return round2_(sum);
}

function totalPositiveExpenseFromRawRows_(rows, monthHeader, aliasMap) {
  if (!rows) return 0;
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r.Type || '')
        .trim()
        .toUpperCase() !== 'EXPENSE') {
      continue;
    }
    if (!cashFlowCellIsPresent_(r, monthHeader)) continue;
    sum += Math.abs(readCashFlowMonthAmount_(r, monthHeader));
  }
  return round2_(sum);
}

function expensePayeeMapFromRawRows_(rows, monthHeader, aliasMap) {
  const map = Object.create(null);
  if (!rows) return map;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (String(r.Type || '')
        .trim()
        .toUpperCase() !== 'EXPENSE') {
      continue;
    }
    if (!cashFlowCellIsPresent_(r, monthHeader)) continue;
    const raw = String(r.Payee || '').trim();
    if (!raw) continue;
    const nm = normalizeName_(raw, aliasMap);
    const pos = Math.abs(readCashFlowMonthAmount_(r, monthHeader));
    map[nm] = round2_((map[nm] || 0) + pos);
  }
  return map;
}

function collectAllExpensePayeeKeys_(history, aliasMap) {
  const keys = Object.create(null);
  history.forEach(function(h) {
    if (!h.rows) return;
    h.rows.forEach(function(r) {
      if (String(r.Type || '')
          .trim()
          .toUpperCase() !== 'EXPENSE') {
        return;
      }
      if (!cashFlowCellIsPresent_(r, h.monthHeader)) return;
      const raw = String(r.Payee || '').trim();
      if (!raw) return;
      keys[normalizeName_(raw, aliasMap)] = true;
    });
  });
  return Object.keys(keys);
}

function buildAlignedPayeeExpensesNullable_(history, payeeKeys, aliasMap) {
  const matrix = Object.create(null);
  payeeKeys.forEach(function(p) {
    matrix[p] = [];
  });
  history.forEach(function(h) {
    const map = expensePayeeMapFromRawRows_(h.rows, h.monthHeader, aliasMap);
    payeeKeys.forEach(function(p) {
      if (Object.prototype.hasOwnProperty.call(map, p)) {
        matrix[p].push(map[p]);
      } else {
        matrix[p].push(null);
      }
    });
  });
  return matrix;
}

function trailingNonNullSamples_(series, maxCount) {
  const out = [];
  for (let i = series.length - 1; i >= 0 && out.length < maxCount; i--) {
    const v = series[i];
    if (v == null || !isFinite(v)) continue;
    out.push(v);
  }
  out.reverse();
  return out;
}

function medianWithFallbacksNonNullTrail_(series) {
  const n = series.length;
  if (!n) {
    return { value: 0, windowUsed: 0, label: 'insufficient' };
  }

  const s6 = trailingNonNullSamples_(series, 6);
  if (s6.length >= 6) {
    const m = median_(s6);
    if (m > 0) return { value: round2_(m), windowUsed: 6, label: '6m_non_empty' };
  }

  const s3 = trailingNonNullSamples_(series, 3);
  if (s3.length >= 3) {
    const m = median_(s3);
    if (m > 0) return { value: round2_(m), windowUsed: 3, label: '3m_non_empty' };
  }

  const s1 = trailingNonNullSamples_(series, 1);
  if (s1.length >= 1) {
    const m = s1[s1.length - 1];
    if (m > 0) return { value: round2_(m), windowUsed: 1, label: '1m_actual' };
    return { value: round2_(m), windowUsed: 1, label: '1m_zero' };
  }

  const partial = trailingNonNullSamples_(series, 6);
  if (partial.length) {
    return { value: round2_(median_(partial)), windowUsed: partial.length, label: 'partial_non_empty' };
  }

  return { value: 0, windowUsed: 0, label: 'insufficient' };
}

function spikeSmoothNullableSeries_(series) {
  const out = series.slice();
  const n = out.length;
  if (n < 2) return out;
  const priorVals = [];
  for (let i = Math.max(0, n - 7); i < n - 1; i++) {
    const v = out[i];
    if (v != null && isFinite(v)) priorVals.push(v);
  }
  if (!priorVals.length) return out;
  const med = median_(priorVals);
  const last = out[n - 1];
  if (last != null && isFinite(last) && med > 0 && last > 2 * med) {
    out[n - 1] = med;
  }
  return out;
}

function normalizePayeeStableKey_(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function stableCanonicalForPayeeRaw_(payeeRaw) {
  const k = normalizePayeeStableKey_(payeeRaw);
  if (!k) return null;
  for (let i = 0; i < ROLLING_DP_EXACT_STABLE_INCOME_PAYEES_.length; i++) {
    const c = ROLLING_DP_EXACT_STABLE_INCOME_PAYEES_[i];
    if (normalizePayeeStableKey_(c) === k) return c;
  }
  return null;
}

function cfLineTypeUpper_(li) {
  return String(li.type || '')
    .trim()
    .toUpperCase();
}

function isIncomeLine_(li) {
  return cfLineTypeUpper_(li) === 'INCOME';
}

function isExpenseLine_(li) {
  return cfLineTypeUpper_(li) === 'EXPENSE';
}

function classifyStableIncomePayee_(payeeRaw, aliasMap) {
  void aliasMap;
  return stableCanonicalForPayeeRaw_(payeeRaw) != null;
}

function classifyVariableIncomeHint_(payeeRaw) {
  const low = String(payeeRaw || '')
    .toLowerCase()
    .trim();
  for (let j = 0; j < ROLLING_DP_VARIABLE_INCOME_HINTS_.length; j++) {
    if (low.indexOf(ROLLING_DP_VARIABLE_INCOME_HINTS_[j]) >= 0) return true;
  }
  return false;
}

function splitStableVariableIncome_(lineItems, aliasMap) {
  let stable = 0;
  let variable = 0;
  const stableLines = [];
  const variableLines = [];

  lineItems.forEach(function(li) {
    if (!isIncomeLine_(li)) return;
    const p = li.payee;
    if (classifyStableIncomePayee_(p, aliasMap)) {
      stable += li.amount;
      stableLines.push(li);
      return;
    }
    if (classifyVariableIncomeHint_(p)) {
      variable += li.amount;
      variableLines.push(li);
      return;
    }
    variable += li.amount;
    variableLines.push(li);
  });

  return {
    stableTotal: round2_(stable),
    variableTotal: round2_(variable),
    stableLines: stableLines,
    variableLines: variableLines
  };
}

function stableIncomeForMonth_(lineItems, aliasMap) {
  let s = 0;
  lineItems.forEach(function(li) {
    if (!isIncomeLine_(li)) return;
    if (classifyStableIncomePayee_(li.payee, aliasMap)) s += li.amount;
  });
  return round2_(s);
}

function monthlyPositiveExpenseOutflow_(h, aliasMap) {
  if (h.rows && h.monthHeader && aliasMap) {
    return totalPositiveExpenseFromRawRows_(h.rows, h.monthHeader, aliasMap);
  }
  const exp = h.normalized.expenseTotal;
  if (exp < 0) {
    return round2_(-exp);
  }
  let sum = 0;
  h.normalized.lineItems.forEach(function(li) {
    if (isExpenseLine_(li)) sum += Math.abs(li.amount);
  });
  return round2_(sum);
}

function historyHasAnyIncome_(history, aliasMap) {
  const am = aliasMap || getAliasMap_();
  return history.some(function(h) {
    if (h.rows && h.monthHeader) {
      return h.rows.some(function(r) {
        if (String(r.Type || '')
            .trim()
            .toUpperCase() !== 'INCOME') {
          return false;
        }
        if (!cashFlowCellIsPresent_(r, h.monthHeader)) return false;
        return Math.abs(readCashFlowMonthAmount_(r, h.monthHeader)) > 0.005;
      });
    }
    return Math.abs(h.normalized.incomeTotal) > 0.005;
  });
}

function historyHasAnyExpense_(history, aliasMap) {
  const am = aliasMap || getAliasMap_();
  return history.some(function(h) {
    return monthlyPositiveExpenseOutflow_(h, am) > 0.005;
  });
}

function historyTrulyEmptyForProjection_(history, aliasMap) {
  if (!history.length) return true;
  if (!history.some(function(h) {
    return h.monthHasCfData;
  })) {
    return true;
  }
  return !historyHasAnyIncome_(history, aliasMap) && !historyHasAnyExpense_(history, aliasMap);
}

function median_(values) {
  const a = values.filter(function(x) {
    return typeof x === 'number' && isFinite(x);
  });
  a.sort(function(x, y) {
    return x - y;
  });
  if (!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  if (a.length % 2) return a[mid];
  return (a[mid - 1] + a[mid]) / 2;
}

/**
 * Median of trailing window over **non-empty** monthly stable-income totals only (chronological).
 * 6 → 3 → 1 month(s). Zeros in the window are kept (real $0.00).
 */
function medianStableTrailingFromNonEmptyMonths_(nonEmptyTotals) {
  const n = nonEmptyTotals.length;
  if (!n) {
    return { value: 0, windowUsed: 0, label: 'insufficient', medianInput: [] };
  }
  let slice;
  let label;
  if (n >= 6) {
    slice = nonEmptyTotals.slice(-6);
    label = '6_non_empty_month_totals';
  } else if (n >= 3) {
    slice = nonEmptyTotals.slice(-3);
    label = '3_non_empty_month_totals';
  } else {
    slice = nonEmptyTotals.slice(-1);
    label = '1_non_empty_month_total';
  }
  const med = median_(slice);
  return {
    value: round2_(isFinite(med) ? med : 0),
    windowUsed: slice.length,
    label: label,
    medianInput: slice.slice()
  };
}

/**
 * Trailing 6m median → 3m → 1m actual. Returns positive statistic; label when weak.
 */
function medianWithFallbacks_(series) {
  const n = series.length;
  if (!n) {
    return { value: 0, windowUsed: 0, label: 'insufficient' };
  }

  function tailMedian(len) {
    if (n < len) return null;
    return median_(series.slice(-len));
  }

  if (n >= 6) {
    const v = tailMedian(6);
    if (v != null && isFinite(v) && v > 0) {
      return { value: round2_(v), windowUsed: 6, label: '6m' };
    }
  }

  if (n >= 3) {
    const v = tailMedian(3);
    if (v != null && isFinite(v) && v > 0) {
      return { value: round2_(v), windowUsed: 3, label: '3m' };
    }
  }

  const last = series[n - 1];
  if (last != null && isFinite(last) && last > 0) {
    return { value: round2_(last), windowUsed: 1, label: '1m' };
  }
  if (last != null && isFinite(last)) {
    return { value: round2_(last), windowUsed: 1, label: '1m_zero' };
  }

  const partialLen = Math.min(6, n);
  const vPart = median_(series.slice(-partialLen));
  return { value: round2_(isFinite(vPart) ? vPart : 0), windowUsed: partialLen, label: 'partial' };
}

function spikeSmoothSeriesForMedian_(series) {
  const out = series.slice();
  const n = out.length;
  if (n < 2) return out;
  const prior = out.slice(-7, -1);
  if (!prior.length) return out;
  const med = median_(prior);
  const last = out[n - 1];
  if (med > 0 && last > 2 * med) {
    out[n - 1] = med;
  }
  return out;
}

function buildStableMonthlyDebugMatrix_(history, aliasMap, lastN) {
  lastN = lastN || 12;
  const slice = history.slice(-lastN);
  const columnHeaders = ROLLING_DP_STABLE_MONTHLY_DEBUG_COLUMNS_.map(function(c) {
    return c.header;
  });
  const rows = slice.map(function(h) {
    const cells = Object.create(null);
    ROLLING_DP_STABLE_MONTHLY_DEBUG_COLUMNS_.forEach(function(col) {
      const sub = stableIncomeSumForCanonicalInMonth_(h.rows, h.monthHeader, col.canonical);
      cells[col.header] = sub.had ? sub.sum : null;
    });
    const tot = stableIncomeMonthTotalFromRows_(h.rows, h.monthHeader, aliasMap);
    return {
      month: h.monthHeader,
      cells: cells,
      stable_income_total: tot.nonEmpty ? tot.sum : null
    };
  });
  return {
    column_headers: columnHeaders.concat(['Stable Income Total']),
    rows: rows
  };
}

function buildStableIncomeParsingSamples_(history) {
  const tail = history.slice(-12);
  return ROLLING_DP_STABLE_PARSING_SAMPLE_PAYEES_.map(function(canonical) {
    const samples = [];
    tail.forEach(function(h) {
      if (!h.rows) return;
      const partsRaw = [];
      let sumParsed = 0;
      let any = false;
      h.rows.forEach(function(r) {
        if (String(r.Type || '')
            .trim()
            .toUpperCase() !== 'INCOME') {
          return;
        }
        if (stableCanonicalForPayeeRaw_(r.Payee) !== canonical) return;
        const raw = readCashFlowMonthRawDisplay_(r, h.monthHeader);
        const p = readCashFlowMonthAmountNullable_(r, h.monthHeader);
        if (p !== null) {
          any = true;
          sumParsed += p;
          partsRaw.push(raw != null ? raw : String(p));
        }
      });
      if (any) {
        samples.push({
          month: h.monthHeader,
          raw_cell: partsRaw.join(' + '),
          parsed: round2_(sumParsed)
        });
      }
    });
    return { payee: canonical, samples: samples };
  });
}

function forwardExpenseFromPerPayeeSmoothed_(history, aliasMap) {
  const payeeKeys = collectAllExpensePayeeKeys_(history, aliasMap);
  if (!payeeKeys.length) return 0;
  const matrix = buildAlignedPayeeExpensesNullable_(history, payeeKeys, aliasMap);
  let sum = 0;
  payeeKeys.forEach(function(p) {
    const smoothed = spikeSmoothNullableSeries_(matrix[p]);
    const fb = medianWithFallbacksNonNullTrail_(smoothed);
    sum += fb.value;
  });
  return round2_(sum);
}

function expensePayeeHaystack_(payeeKey) {
  return (
    ' ' +
    String(payeeKey || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim() +
    ' '
  );
}

function hitsSpaceHintList_(haystack, hints) {
  for (let i = 0; i < hints.length; i++) {
    if (haystack.indexOf(hints[i]) >= 0) return true;
  }
  return false;
}

function collectActiveCreditCardNormalizedPayeeKeys_(debts, aliasMap) {
  const obj = Object.create(null);
  (debts || []).forEach(function(d) {
    if (!d.active) return;
    if (String(d.type || '').trim() !== 'Credit Card') return;
    const nm = normalizeName_(String(d.name || ''), aliasMap);
    if (nm) obj[nm] = true;
  });
  return obj;
}

function expensePayeeMatchesCreditCardDebt_(payeeKey, ccNormObj) {
  if (!payeeKey) return false;
  if (ccNormObj[payeeKey]) return true;
  const pk = String(payeeKey || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const keys = Object.keys(ccNormObj);
  for (let i = 0; i < keys.length; i++) {
    const dk = String(keys[i] || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
    if (!dk || dk.length < 3) continue;
    if (pk.indexOf(dk) >= 0 || dk.indexOf(pk) >= 0) return true;
  }
  return false;
}

/**
 * Positive EXPENSE totals in the anchor Cash Flow month column, attributed to DEBTS `name`
 * keys (normalized account names). Used so mid-month plans do not duplicate minimum payments
 * already logged in INPUT - Cash Flow.
 */
function buildAnchorMonthCfPaidByDebtName_(rows, monthHeader, debts, aliasMap) {
  const map = expensePayeeMapFromRawRows_(rows, monthHeader, aliasMap);
  const out = Object.create(null);
  const consumed = Object.create(null);
  (debts || []).forEach(function(d) {
    if (d && d.name) {
      out[d.name] = 0;
    }
  });

  function markConsumed(key) {
    consumed[key] = true;
  }

  function wasConsumed(key) {
    return !!consumed[key];
  }

  (debts || []).forEach(function(d) {
    if (!d || !d.active) return;
    const k = normalizeName_(String(d.name || ''), aliasMap);
    if (!k || wasConsumed(k)) return;
    const v = map[k];
    if (v > 0.005) {
      out[d.name] = round2_((out[d.name] || 0) + v);
      markConsumed(k);
    }
  });

  ROLLING_DP_LOAN_ALIAS_MERGE_GROUPS_RAW_.forEach(function(group) {
    const groupNorm = group.map(function(a) {
      return normalizeName_(a, aliasMap);
    }).filter(Boolean);
    const debtHits = (debts || []).filter(function(d) {
      if (!d || !d.active) return false;
      if (String(d.type || '').trim() === 'Credit Card') return false;
      const dn = normalizeName_(String(d.name || ''), aliasMap);
      const orig = normalizeName_(String(d.originalName || ''), aliasMap);
      return groupNorm.indexOf(dn) >= 0 || (orig && groupNorm.indexOf(orig) >= 0);
    });
    if (debtHits.length !== 1) return;
    const target = debtHits[0];
    let pool = 0;
    groupNorm.forEach(function(gk) {
      if (!gk || wasConsumed(gk)) return;
      const amt = map[gk];
      if (amt > 0.005) {
        pool = round2_(pool + amt);
        markConsumed(gk);
      }
    });
    if (pool > 0.005) {
      out[target.name] = round2_((out[target.name] || 0) + pool);
    }
  });

  Object.keys(map).forEach(function(k) {
    if (!k || wasConsumed(k)) return;
    const amt = map[k];
    if (amt <= 0.005) return;
    const ccOneMatches = [];
    (debts || []).forEach(function(d) {
      if (!d || !d.active) return;
      if (String(d.type || '').trim() !== 'Credit Card') return;
      const ccObj = Object.create(null);
      ccObj[normalizeName_(String(d.name || ''), aliasMap)] = true;
      if (expensePayeeMatchesCreditCardDebt_(k, ccObj)) {
        ccOneMatches.push(d);
      }
    });
    if (ccOneMatches.length === 1) {
      const d = ccOneMatches[0];
      out[d.name] = round2_((out[d.name] || 0) + amt);
      markConsumed(k);
    }
  });

  return out;
}

function rollingPlannedExpenseDueDateObj_(dueIso) {
  if (!dueIso) return null;
  const p = String(dueIso).split('T')[0].split('-');
  if (p.length < 3) return null;
  const y = Number(p[0]);
  const mo = Number(p[1]);
  const day = Number(p[2]);
  if (!isFinite(y) || !isFinite(mo) || !isFinite(day)) return null;
  return stripTime_(new Date(y, mo - 1, day));
}

function rollingClassifyPlannedExpenseHorizon_(dueDateObj, anchorEnd) {
  if (!dueDateObj || !anchorEnd) return 'unknown';
  const ae = stripTime_(anchorEnd);
  const boundary30 = addCalendarDays_(ae, 30);
  const boundary90 = addCalendarDays_(ae, 90);
  const t = stripTime_(dueDateObj).getTime();
  if (t <= boundary30.getTime()) return 'near_term';
  if (t <= boundary90.getTime()) return 'mid_term';
  return 'long_term';
}

function rollingClassifyPlannedExpenseFunding_(accountSource, debts, aliasMap) {
  const raw = String(accountSource || '').trim();
  const low = raw.toLowerCase();
  if (!raw) return 'cash';
  if (low === 'cash' || low.indexOf('checking') >= 0 || low.indexOf('savings') >= 0 || low.indexOf('operating') >= 0) {
    return 'cash';
  }
  if (low.indexOf('credit') >= 0 || low.indexOf('card') >= 0) return 'credit_card';
  const norm = normalizeName_(raw, aliasMap);
  const ccDebts = (debts || []).filter(function(d) {
    return d.active && String(d.type || '').trim() === 'Credit Card';
  });
  for (let i = 0; i < ccDebts.length; i++) {
    if (normalizeName_(String(ccDebts[i].name || ''), aliasMap) === norm) {
      return 'credit_card';
    }
  }
  const fuzzy = [];
  for (let j = 0; j < ccDebts.length; j++) {
    const ccObj = Object.create(null);
    ccObj[normalizeName_(String(ccDebts[j].name || ''), aliasMap)] = true;
    if (expensePayeeMatchesCreditCardDebt_(norm, ccObj) || expensePayeeMatchesCreditCardDebt_(raw, ccObj)) {
      fuzzy.push(ccDebts[j].name);
    }
  }
  if (fuzzy.length === 1) return 'credit_card';
  return 'cash';
}

function rollingResolveCcDebtNameForPlannedExpense_(accountSource, expenseName, debts, aliasMap) {
  const src = String(accountSource || '').trim();
  const exp = String(expenseName || '').trim();
  const ccDebts = (debts || []).filter(function(d) {
    return d.active && String(d.type || '').trim() === 'Credit Card';
  });
  function uniqueNameFromNorm_(normKey) {
    if (!normKey) return null;
    const hits = [];
    for (let i = 0; i < ccDebts.length; i++) {
      if (normalizeName_(String(ccDebts[i].name || ''), aliasMap) === normKey) {
        hits.push(ccDebts[i].name);
      }
    }
    return hits.length === 1 ? hits[0] : null;
  }
  const nSrc = normalizeName_(src, aliasMap);
  const exact = uniqueNameFromNorm_(nSrc);
  if (exact) return exact;
  const fuzzy = [];
  for (let j = 0; j < ccDebts.length; j++) {
    const ccObj = Object.create(null);
    ccObj[normalizeName_(String(ccDebts[j].name || ''), aliasMap)] = true;
    if (src && expensePayeeMatchesCreditCardDebt_(nSrc, ccObj)) fuzzy.push(ccDebts[j].name);
    else if (src && expensePayeeMatchesCreditCardDebt_(src, ccObj)) fuzzy.push(ccDebts[j].name);
  }
  if (fuzzy.length === 1) return fuzzy[0];
  const nExp = normalizeName_(exp, aliasMap);
  const expHit = uniqueNameFromNorm_(nExp);
  if (expHit) return expHit;
  return null;
}

/**
 * Reads INPUT - Upcoming Expenses (Planned only), classifies by due date vs anchor month end,
 * reserves near-term cash from deployable liquidity, and increases CC balances for near-term card-funded plans
 * that are mapped to a specific card. Unmapped near-term card-funded amounts are held against deployable cash
 * (cash risk) and are not applied as modeled card balance until mapped.
 */
function buildRollingPlannedExpenseImpactModel_(anchorDate, tz, debts, aliasMap) {
  const out = {
    near_term_cash_total: 0,
    unmapped_card_funded_cash_risk_total: 0,
    near_term_card_funded_mapped_total: 0,
    debts_for_sim: debts.map(function(d) {
      return JSON.parse(JSON.stringify(d));
    }),
    debt_start_adjusted: 0,
    display_lines: [],
    has_mid_term: false,
    has_long_term: false,
    has_unmapped_near_term_card: false,
    near_term_card_funded_within_30: false,
    modeling_unmapped_card_assumption: '',
    first_unmapped_near_term_title: '',
    warnings: []
  };

  const anchorEnd = endOfMonthContainingDate_(anchorDate);
  const anchorPlus30 = addCalendarDays_(anchorEnd, 30);
  let ui;
  try {
    ui = getUpcomingExpensesUiData();
  } catch (e) {
    ui = { expenses: [] };
  }
  const rows = (ui && ui.expenses) || [];

  rows.forEach(function(row) {
    if (String(row.status || '')
        .trim()
        .toLowerCase() !== 'planned') {
      return;
    }
    const amt = round2_(Number(row.amount) || 0);
    if (amt <= 0.005) return;

    const dueObj = rollingPlannedExpenseDueDateObj_(row.dueDate);
    const horizon = rollingClassifyPlannedExpenseHorizon_(dueObj, anchorEnd);
    if (horizon === 'mid_term') out.has_mid_term = true;
    if (horizon === 'long_term') out.has_long_term = true;

    const funding = rollingClassifyPlannedExpenseFunding_(row.accountSource, debts, aliasMap);
    const title = String(row.expenseName || row.payee || 'Planned expense').trim() || 'Planned expense';
    const dueLabel = row.dueDate ? Utilities.formatDate(rollingPlannedExpenseDueDateObj_(row.dueDate), tz, 'MMM d') : '—';

    let impactTag = '';
    if (horizon === 'near_term') {
      if (funding === 'credit_card') {
        if (dueObj && stripTime_(dueObj).getTime() <= anchorPlus30.getTime()) {
          out.near_term_card_funded_within_30 = true;
        }
        const tgt = rollingResolveCcDebtNameForPlannedExpense_(row.accountSource, row.payee || row.expenseName, out.debts_for_sim, aliasMap);
        let lineUnmapped = false;
        if (!tgt) {
          lineUnmapped = true;
          out.has_unmapped_near_term_card = true;
          out.modeling_unmapped_card_assumption = '';
          out.unmapped_card_funded_cash_risk_total = round2_(out.unmapped_card_funded_cash_risk_total + amt);
          if (!out.first_unmapped_near_term_title) {
            out.first_unmapped_near_term_title = title;
          }
          impactTag = 'card-funded — unmapped (cash risk hold)';
          out.display_lines.push({
            title: title,
            due_label: dueLabel,
            amount: amt,
            impact_tag: impactTag,
            horizon: horizon,
            execution_treatment:
              'Conservative liquidity hold: treated like near-term cash risk until Account/Source maps to a specific card debt.',
            is_unmapped_card: true,
            mapped_card_name: ''
          });
        } else {
          impactTag = 'credit card → increases debt (mapped)';
          out.near_term_card_funded_mapped_total = round2_(out.near_term_card_funded_mapped_total + amt);
          out.debts_for_sim.forEach(function(d) {
            if (d.name === tgt) {
              d.balance = round2_(Math.max(0, d.balance) + amt);
            }
          });
          out.display_lines.push({
            title: title,
            due_label: dueLabel,
            amount: amt,
            impact_tag: impactTag,
            horizon: horizon,
            execution_treatment: 'Does not reduce deployable cash today; increases modeled balance on mapped card only.',
            is_unmapped_card: false,
            mapped_card_name: tgt
          });
        }
        return;
      } else {
        impactTag = 'cash → reduces deployable cash';
        out.near_term_cash_total = round2_(out.near_term_cash_total + amt);
        out.display_lines.push({
          title: title,
          due_label: dueLabel,
          amount: amt,
          impact_tag: impactTag,
          horizon: horizon,
          execution_treatment:
            'Near-term planned cash expense: subtracts from deployable cash before extra debt allocation (reserved in liquidity).',
          is_unmapped_card: false
        });
        return;
      }
    } else if (horizon === 'mid_term') {
      impactTag = 'within 90 days';
    } else if (horizon === 'long_term') {
      impactTag = 'future';
    } else {
      impactTag = 'due date unknown';
    }

    let execTreatMidLong = '';
    if (horizon === 'mid_term') {
      execTreatMidLong =
        'Mid-term (within 90 days after anchor month-end): caution for the next three months; not fully subtracted from deployable cash today.';
    } else if (horizon === 'long_term') {
      execTreatMidLong = 'Future watch item; not subtracted from deployable cash today.';
    } else {
      execTreatMidLong = 'Review due date and funding in Upcoming.';
    }

    out.display_lines.push({
      title: title,
      due_label: dueLabel,
      amount: amt,
      impact_tag: impactTag,
      horizon: horizon,
      execution_treatment: execTreatMidLong,
      is_unmapped_card: false
    });
  });

  out.near_term_cash_total = round2_(out.near_term_cash_total);
  out.unmapped_card_funded_cash_risk_total = round2_(out.unmapped_card_funded_cash_risk_total);
  out.near_term_card_funded_mapped_total = round2_(out.near_term_card_funded_mapped_total);
  out.debt_start_adjusted = round2_(
    out.debts_for_sim.reduce(function(s, d) {
      return s + Math.max(0, d.balance);
    }, 0)
  );

  return out;
}

function payeePositiveHistoricalVals_(series) {
  const out = [];
  for (let i = 0; i < series.length; i++) {
    const v = series[i];
    if (v == null || !isFinite(v)) continue;
    const a = Math.abs(v);
    if (a > 0.005) out.push(a);
  }
  return out;
}

function payeeVolatilityHigh_(vals) {
  if (vals.length < 2) return false;
  const med = median_(vals);
  if (med < 0.005) return false;
  let sum = 0;
  let max = vals[0];
  for (let i = 0; i < vals.length; i++) {
    sum += vals[i];
    if (vals[i] > max) max = vals[i];
  }
  const avg = sum / vals.length;
  return avg > 1.5 * med || max > 2 * med;
}

function classifyExpensePayeeBucket_(payeeKey, vals, ccNormObj) {
  const hay = expensePayeeHaystack_(payeeKey);
  const volatile = payeeVolatilityHigh_(vals);
  const isCc = expensePayeeMatchesCreditCardDebt_(payeeKey, ccNormObj);

  if (hitsSpaceHintList_(hay, ROLLING_DP_IRREGULAR_EXPENSE_SPACE_HINTS_)) {
    return { bucket: 'irregular_or_spike', reason: 'keyword_irregular' };
  }
  if (hitsSpaceHintList_(hay, ROLLING_DP_RECURRING_OP_SPACE_HINTS_)) {
    if (isCc && volatile) {
      return { bucket: 'debt_cleanup_or_paydown', reason: 'recurring_keyword_but_cc_volatile' };
    }
    return { bucket: 'recurring_operating', reason: 'keyword_recurring_operating' };
  }
  if (isCc) {
    if (volatile) return { bucket: 'debt_cleanup_or_paydown', reason: 'credit_card_volatile' };
    return { bucket: 'recurring_operating', reason: 'credit_card_stable' };
  }
  if (hitsSpaceHintList_(hay, ROLLING_DP_DEBT_CLEANUP_SPACE_HINTS_)) {
    return { bucket: 'debt_cleanup_or_paydown', reason: 'keyword_debt_cleanup' };
  }
  if (volatile) return { bucket: 'irregular_or_spike', reason: 'high_volatility_non_cc' };
  return { bucket: 'recurring_operating', reason: 'default_operating' };
}

function buildExpensePayeeDisplayMap_(history, aliasMap) {
  const display = Object.create(null);
  const anchor = history[history.length - 1];
  if (!anchor || !anchor.rows) return display;
  anchor.rows.forEach(function(r) {
    if (String(r.Type || '')
        .trim()
        .toUpperCase() !== 'EXPENSE') {
      return;
    }
    if (!cashFlowCellIsPresent_(r, anchor.monthHeader)) return;
    const raw = String(r.Payee || '').trim();
    if (!raw) return;
    const nk = normalizeName_(raw, aliasMap);
    if (!display[nk]) display[nk] = raw;
  });
  return display;
}

function normalizeLoanMergeGroupKeys_(rawGroup, aliasMap) {
  return rawGroup.map(function(raw) {
    return normalizeName_(String(raw || '').trim(), aliasMap);
  });
}

function isDebtLoanLikeForMerge_(d) {
  const t = String(d.type || '')
    .trim()
    .toUpperCase();
  return t === 'LOAN' || t === 'HELOC' || t === 'MORTGAGE';
}

function loanMergeGroupHasDebtMatch_(groupNormKeys, debts) {
  const set = Object.create(null);
  groupNormKeys.forEach(function(k) {
    if (k) set[k] = true;
  });
  let found = false;
  (debts || []).forEach(function(d) {
    if (!d.active || !isDebtLoanLikeForMerge_(d)) return;
    if (set[d.name]) found = true;
  });
  return found;
}

function pickLoanMergeCanonicalPayee_(groupNormKeys, debts) {
  const set = Object.create(null);
  groupNormKeys.forEach(function(k) {
    if (k) set[k] = true;
  });
  for (let i = 0; i < groupNormKeys.length; i++) {
    const k = groupNormKeys[i];
    if (!k) continue;
    let matched = false;
    (debts || []).forEach(function(d) {
      if (!d.active || !isDebtLoanLikeForMerge_(d)) return;
      if (d.name === k) matched = true;
    });
    if (matched) return k;
  }
  return groupNormKeys[0] || '';
}

function pickEffectiveMergeSeriesKey_(canonicalKey, groupNormKeys, payeeKeySet) {
  const set = Object.create(null);
  Object.keys(payeeKeySet || {}).forEach(function(k) {
    if (k) set[k] = true;
  });
  if (canonicalKey && set[canonicalKey]) return canonicalKey;
  for (let i = 0; i < groupNormKeys.length; i++) {
    const k = groupNormKeys[i];
    if (k && set[k]) return k;
  }
  return canonicalKey;
}

function buildLoanAliasSkipMap_(aliasMap, debts, payeeKeySet) {
  const skip = Object.create(null);
  ROLLING_DP_LOAN_ALIAS_MERGE_GROUPS_RAW_.forEach(function(rawGroup) {
    const groupNorm = normalizeLoanMergeGroupKeys_(rawGroup, aliasMap);
    if (!groupNorm.length) return;
    const canon = pickLoanMergeCanonicalPayee_(groupNorm, debts);
    const effective = pickEffectiveMergeSeriesKey_(canon, groupNorm, payeeKeySet);
    groupNorm.forEach(function(k) {
      if (k && k !== effective) skip[k] = effective;
    });
  });
  return skip;
}

function loanMergeAliasUnresolved_(aliasMap, debts) {
  let bad = false;
  ROLLING_DP_LOAN_ALIAS_MERGE_GROUPS_RAW_.forEach(function(rawGroup) {
    const groupNorm = normalizeLoanMergeGroupKeys_(rawGroup, aliasMap);
    if (!groupNorm.length) return;
    if (!loanMergeGroupHasDebtMatch_(groupNorm, debts)) bad = true;
  });
  return bad;
}

function countNonNullLast12_(series) {
  const tail = series.slice(-12);
  let n = 0;
  for (let i = 0; i < tail.length; i++) {
    const v = tail[i];
    if (v != null && isFinite(v) && Math.abs(v) > 0.005) n++;
  }
  return n;
}

function sumAbsLast12Months_(series) {
  const tail = series.slice(-12);
  let s = 0;
  for (let i = 0; i < tail.length; i++) {
    const v = tail[i];
    if (v == null || !isFinite(v)) continue;
    s += Math.abs(v);
  }
  return round2_(s);
}

function payeeNameContainsTax_(payeeNorm, payeeDisplay) {
  return (
    String(payeeDisplay + ' ' + payeeNorm)
      .toLowerCase()
      .indexOf('tax') >= 0
  );
}

function payeeMatchesActiveDebtLoanName_(payeeNorm, debts) {
  let hit = false;
  (debts || []).forEach(function(d) {
    if (!d.active || !isDebtLoanLikeForMerge_(d)) return;
    if (d.name === payeeNorm) hit = true;
  });
  return hit;
}

function buildRecurringBaselineValidation_(forward, simNext12, reserve) {
  const m = forward && forward.recurringExpenseModel;
  const recStrict =
    m && m.recurring_expense_forward != null ? m.recurring_expense_forward : 0;
  const stable = forward && forward.stableIncomeForward != null ? forward.stableIncomeForward : 0;
  const gap = round2_(stable - recStrict);
  let stress = 'No';
  const n12 = simNext12 || [];
  for (let i = 0; i < Math.min(3, n12.length); i++) {
    const end = Number(n12[i].ending_cash) || 0;
    if (end < reserve + 2000) {
      stress = 'Yes';
      break;
    }
  }
  return {
    stable_income_forward: stable,
    recurring_baseline_after_strict_tax_handling: recStrict,
    monthly_gap_stable_minus_recurring: gap,
    reserve_stress_within_3_months: stress,
    recurring_baseline_after_corrections: recStrict
  };
}

function payeeHaystackCombined_(row) {
  return expensePayeeHaystack_(String(row.payee_normalized || '') + ' ' + String(row.payee_display || ''));
}

function isLoanLikePayeeRow_(row) {
  const h = payeeHaystackCombined_(row);
  return h.indexOf(' loan ') >= 0 || h.indexOf(' mortgage ') >= 0 || h.indexOf(' heloc ') >= 0;
}

function loanPayeesLikelyAliasPair_(a, b) {
  if (!isLoanLikePayeeRow_(a) || !isLoanLikePayeeRow_(b)) return false;
  const na = String(a.payee_normalized || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const nb = String(b.payee_normalized || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!na || !nb || na === nb) return false;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 6 && longer.indexOf(shorter) >= 0) return true;
  const tokenize = function(s) {
    return s.split(/[^a-z0-9]+/).filter(function(x) {
      return x.length >= 5;
    });
  };
  const ta = tokenize(na);
  const tb = tokenize(nb);
  let shared = false;
  ta.forEach(function(w) {
    if (tb.indexOf(w) >= 0) shared = true;
  });
  if (!shared || na.length < 10 || nb.length < 10) return false;
  const ra = a.trailing_typical_monthly;
  const rb = b.trailing_typical_monthly;
  const ratio = Math.min(ra, rb) / Math.max(ra, rb, 0.001);
  return ratio >= 0.3;
}

function detectLoanAliasDuplicateFlags_(includedRecurringRows) {
  const flags = Object.create(null);
  const loanLike = includedRecurringRows.filter(isLoanLikePayeeRow_);
  for (let i = 0; i < loanLike.length; i++) {
    for (let j = i + 1; j < loanLike.length; j++) {
      if (loanPayeesLikelyAliasPair_(loanLike[i], loanLike[j])) {
        flags[loanLike[i].payee_normalized] = true;
        flags[loanLike[j].payee_normalized] = true;
      }
    }
  }
  return flags;
}

function suggestRecurringExpenseTreatment_(row, duplicateFlags) {
  const name = String(row.payee_display + ' ' + row.payee_normalized).toLowerCase();
  const amt = Number(row.trailing_typical_monthly) || 0;
  const months = Number(row.history_months_positive) || 0;
  const lowFreq = months > 0 && months < 4;

  if (name.indexOf('tax') >= 0) return 'prorate_annual';
  if (duplicateFlags[row.payee_normalized]) return 'merge_alias';
  if (lowFreq) {
    if (amt >= 1500) return 'exclude_irregular';
    return 'prorate_annual';
  }
  if (row.reason === 'default_operating' && amt >= 2500) return 'review_manually';
  return 'keep_monthly';
}

function buildRecurringBaselineAudit_(model) {
  const empty = {
    sum_included_recurring: 0,
    sum_included_tax_in_name: 0,
    sum_included_loan_duplicate_or_alias: 0,
    count_default_operating: 0,
    table_rows_top15: [],
    suggested_treatment_rows: [],
    duplicate_loan_payee_keys_flagged: []
  };
  if (!model || !model.payee_classifications || !model.payee_classifications.length) {
    return empty;
  }

  function auditAmt_(r) {
    return r.forward_contribution_adjusted != null ? r.forward_contribution_adjusted : r.trailing_typical_monthly;
  }

  const included = model.payee_classifications.filter(function(r) {
    return r.bucket === 'recurring_operating';
  });
  included.sort(function(a, b) {
    return auditAmt_(b) - auditAmt_(a);
  });

  const sumAll = round2_(
    included.reduce(function(s, r) {
      return s + auditAmt_(r);
    }, 0)
  );

  let sumTax = 0;
  included.forEach(function(r) {
    const n = String(r.payee_display + ' ' + r.payee_normalized).toLowerCase();
    if (n.indexOf('tax') >= 0) sumTax += auditAmt_(r);
  });
  sumTax = round2_(sumTax);

  const dupFlags = detectLoanAliasDuplicateFlags_(included);
  let sumLoanDup = 0;
  included.forEach(function(r) {
    if (dupFlags[r.payee_normalized]) sumLoanDup += auditAmt_(r);
  });
  sumLoanDup = round2_(sumLoanDup);

  const countDef = included.filter(function(r) {
    return r.reason === 'default_operating';
  }).length;

  const top15 = included.slice(0, 15).map(function(r) {
    return {
      payee: r.payee_display,
      bucket: r.bucket,
      reason: r.reason,
      months_active: r.months_active_last12 != null ? r.months_active_last12 : r.history_months_positive,
      trailing_typical_monthly: auditAmt_(r),
      trailing_window: r.trailing_window,
      included_in_forward_baseline: auditAmt_(r) > 0.005 ? 'Yes' : 'No'
    };
  });

  const suggested = included.map(function(r) {
    return {
      payee: r.payee_display,
      suggested_treatment: suggestRecurringExpenseTreatment_(r, dupFlags)
    };
  });

  const dupKeys = Object.keys(dupFlags).filter(function(k) {
    return dupFlags[k];
  });

  return {
    sum_included_recurring: sumAll,
    sum_included_tax_in_name: sumTax,
    sum_included_loan_duplicate_or_alias: sumLoanDup,
    count_default_operating: countDef,
    table_rows_top15: top15,
    suggested_treatment_rows: suggested,
    duplicate_loan_payee_keys_flagged: dupKeys
  };
}

function buildRecurringExpenseForwardModel_(history, aliasMap, debts) {
  const payeeKeys = collectAllExpensePayeeKeys_(history, aliasMap);
  const model = {
    recurring_expense_forward: 0,
    debt_cleanup_excluded_monthly_avg: 0,
    irregular_excluded_monthly_avg: 0,
    top_recurring_payees_included: [],
    top_excluded_debt_cleanup_payees: [],
    top_excluded_irregular_payees: [],
    payee_classifications: [],
    legacy_total_smoothed_forward: 0,
    recurring_payees_included_count: 0,
    baseline_adjustment_rollups: null,
    adjustment_flags: null,
    strict_tax_handling_applied: false
  };
  if (!payeeKeys.length) return model;

  const matrix = buildAlignedPayeeExpensesNullable_(history, payeeKeys, aliasMap);
  const ccObj = collectActiveCreditCardNormalizedPayeeKeys_(debts, aliasMap);
  const displayMap = buildExpensePayeeDisplayMap_(history, aliasMap);
  model.legacy_total_smoothed_forward = forwardExpenseFromPerPayeeSmoothed_(history, aliasMap);

  const payeeKeySet = Object.create(null);
  payeeKeys.forEach(function(k) {
    payeeKeySet[k] = true;
  });
  const loanAliasSkip = buildLoanAliasSkipMap_(aliasMap, debts, payeeKeySet);

  const recRows = [];
  const debtRows = [];
  const irrRows = [];

  let oldRecurringBaselineSum = 0;
  let newRecurringBaselineSum = 0;
  let reductionTax = 0;
  let reductionAlias = 0;
  let reductionSparseDefaultOp = 0;
  let reductionSparseOther = 0;
  let taxSparseMedianHypothetical = 0;
  let taxRecurringStrictBranchCount = 0;

  payeeKeys.forEach(function(p) {
    const series = matrix[p];
    const smoothed = spikeSmoothNullableSeries_(series.slice());
    const vals = payeePositiveHistoricalVals_(series);
    const cl = classifyExpensePayeeBucket_(p, vals, ccObj);
    const fb = medianWithFallbacksNonNullTrail_(smoothed);
    const display = displayMap[p] || p;
    const row = {
      payee_normalized: p,
      payee_display: display,
      bucket: cl.bucket,
      reason: cl.reason,
      trailing_typical_monthly: fb.value,
      trailing_window: fb.label,
      history_months_positive: vals.length,
      months_active_last12: countNonNullLast12_(series),
      sum_abs_last12_months: sumAbsLast12Months_(series),
      forward_contribution_adjusted: null,
      adjustment_note: null,
      merged_into_canonical: loanAliasSkip[p] || null,
      tax_original_median_monthly: null,
      tax_monthly_equivalent: null,
      tax_annualized_last12: null
    };

    if (cl.bucket === 'debt_cleanup_or_paydown') {
      model.debt_cleanup_excluded_monthly_avg += fb.value;
      debtRows.push(row);
      model.payee_classifications.push(row);
      return;
    }
    if (cl.bucket === 'irregular_or_spike') {
      model.irregular_excluded_monthly_avg += fb.value;
      irrRows.push(row);
      model.payee_classifications.push(row);
      return;
    }

    oldRecurringBaselineSum += fb.value;

    if (loanAliasSkip[p]) {
      row.forward_contribution_adjusted = 0;
      row.adjustment_note = 'loan_alias_duplicate_skipped';
      reductionAlias += fb.value;
      model.payee_classifications.push(row);
      recRows.push(row);
      return;
    }

    const monthsLast12 = row.months_active_last12;
    const sumLast12 = row.sum_abs_last12_months;
    const isTax = payeeNameContainsTax_(p, display);
    const isKnownFixed =
      cl.reason === 'keyword_recurring_operating' ||
      cl.reason === 'credit_card_stable' ||
      payeeMatchesActiveDebtLoanName_(p, debts);

    let adjusted = fb.value;
    let note = 'full_median_trail';

    if (isTax) {
      taxRecurringStrictBranchCount++;
      row.tax_original_median_monthly = fb.value;
      row.tax_annualized_last12 = sumLast12;
      if (sumLast12 < 0.01) {
        adjusted = 0;
        note = 'tax_strict_zero_insufficient_last12';
        row.tax_monthly_equivalent = 0;
        taxSparseMedianHypothetical += fb.value;
      } else {
        adjusted = round2_(sumLast12 / 12);
        row.tax_monthly_equivalent = adjusted;
        note = 'tax_prorated_annual_over_last12';
      }
      reductionTax += fb.value - adjusted;
    } else if (!isKnownFixed && monthsLast12 < 8) {
      if (sumLast12 > 0.01) {
        adjusted = round2_(sumLast12 / 12);
        note =
          cl.reason === 'default_operating'
            ? 'default_operating_sparse_prorate_last12'
            : 'sparse_frequency_prorate_last12';
      } else {
        adjusted = 0;
        note =
          cl.reason === 'default_operating'
            ? 'default_operating_sparse_excluded'
            : 'sparse_frequency_excluded';
      }
      const sparseDelta = fb.value - adjusted;
      if (cl.reason === 'default_operating') {
        reductionSparseDefaultOp += sparseDelta;
      } else {
        reductionSparseOther += sparseDelta;
      }
    }

    row.forward_contribution_adjusted = round2_(adjusted);
    row.adjustment_note = note;
    newRecurringBaselineSum += row.forward_contribution_adjusted;
    model.payee_classifications.push(row);
    recRows.push(row);
  });

  model.recurring_expense_forward = round2_(newRecurringBaselineSum);
  model.debt_cleanup_excluded_monthly_avg = round2_(model.debt_cleanup_excluded_monthly_avg);
  model.irregular_excluded_monthly_avg = round2_(model.irregular_excluded_monthly_avg);
  model.recurring_payees_included_count = recRows.filter(function(r) {
    return (r.forward_contribution_adjusted || 0) > 0.005;
  }).length;

  const reductionFreqTotal = round2_(reductionSparseDefaultOp + reductionSparseOther);
  const taxStrictTotal = model.recurring_expense_forward;
  const taxLaxHypothetical = round2_(taxStrictTotal + taxSparseMedianHypothetical);
  const strictTaxApplied = taxRecurringStrictBranchCount > 0;
  model.strict_tax_handling_applied = strictTaxApplied;
  model.baseline_adjustment_rollups = {
    old_recurring_baseline_monthly: round2_(oldRecurringBaselineSum),
    new_recurring_baseline_monthly: model.recurring_expense_forward,
    current_recurring_baseline: taxLaxHypothetical,
    recurring_baseline_after_strict_tax_exclusion: taxStrictTotal,
    difference_current_recurring_minus_strict_tax_baseline: round2_(taxSparseMedianHypothetical),
    reduction_from_tax_proration: round2_(reductionTax),
    reduction_from_alias_deduping: round2_(reductionAlias),
    reduction_from_default_operating_tightening: round2_(reductionSparseDefaultOp),
    reduction_from_other_sparse_frequency: round2_(reductionSparseOther),
    reduction_from_frequency_sparse_and_operating_total: reductionFreqTotal,
    reduction_from_default_operating_or_sparse: reductionFreqTotal
  };

  model.adjustment_flags = {
    strict_tax_handling_applied: strictTaxApplied,
    alias_unresolved: loanMergeAliasUnresolved_(aliasMap, debts)
  };

  function sortAmt_(r) {
    const a = r.forward_contribution_adjusted != null ? r.forward_contribution_adjusted : r.trailing_typical_monthly;
    return a;
  }

  function sortPick(arr, n) {
    return arr
      .slice()
      .sort(function(a, b) {
        return sortAmt_(b) - sortAmt_(a);
      })
      .slice(0, n)
      .map(function(r) {
        return {
          payee_display: r.payee_display,
          trailing_typical_monthly: sortAmt_(r),
          trailing_window: r.trailing_window,
          reason: r.reason
        };
      });
  }

  model.top_recurring_payees_included = sortPick(recRows, 12);
  model.top_excluded_debt_cleanup_payees = sortPick(debtRows, 12);
  model.top_excluded_irregular_payees = sortPick(irrRows, 12);

  model.baseline_audit = buildRecurringBaselineAudit_(model);

  return model;
}

function buildPayeeDiagnosticSamples_(history, aliasMap) {
  const anchor = history[history.length - 1];
  const stableList = [];
  const seenStable = Object.create(null);
  if (anchor.rows) {
    anchor.rows.forEach(function(r) {
      if (String(r.Type || '')
          .trim()
          .toUpperCase() !== 'INCOME') {
        return;
      }
      if (!cashFlowCellIsPresent_(r, anchor.monthHeader)) return;
      if (!classifyStableIncomePayee_(r.Payee, aliasMap)) return;
      const raw = String(r.Payee || '').trim();
      const sk = normalizePayeeStableKey_(raw);
      if (seenStable[sk]) return;
      seenStable[sk] = true;
      stableList.push({
        payee_raw: raw,
        payee_stable_key: sk,
        canonical_stable: stableCanonicalForPayeeRaw_(raw),
        raw_cell: readCashFlowMonthRawDisplay_(r, anchor.monthHeader),
        anchor_month_amount: readCashFlowMonthAmountNullable_(r, anchor.monthHeader)
      });
    });
  }

  const expMap = expensePayeeMapFromRawRows_(anchor.rows, anchor.monthHeader, aliasMap);
  const expenseTop = Object.keys(expMap)
    .map(function(k) {
      return { payee_normalized: k, anchor_month_amount: expMap[k] };
    })
    .sort(function(a, b) {
      return b.anchor_month_amount - a.anchor_month_amount;
    })
    .slice(0, 30);

  return {
    stable_income_matched_payees: stableList,
    expense_anchor_top_payees: expenseTop,
    months_with_cf_column_populated: history.filter(function(h) {
      return h.monthHasCfData;
    }).length
  };
}

/**
 * Stable-income diagnostics: candidates in CF, missing canonicals, per-canonical monthly series.
 */
function buildStableIncomeExtendedDiagnostics_(history) {
  const byCanonical = Object.create(null);
  ROLLING_DP_EXACT_STABLE_INCOME_PAYEES_.forEach(function(c) {
    byCanonical[c] = {
      canonical: c,
      sheet_payee_raw: null,
      monthly_values: []
    };
  });

  const candidateKeys = Object.create(null);
  history.forEach(function(h) {
    if (!h.rows || !h.monthHasCfData) return;
    h.rows.forEach(function(r) {
      if (String(r.Type || '')
          .trim()
          .toUpperCase() !== 'INCOME') {
        return;
      }
      const raw = String(r.Payee || '').trim();
      const canon = stableCanonicalForPayeeRaw_(raw);
      if (!canon) return;
      candidateKeys[normalizePayeeStableKey_(raw)] = raw;
      const vNull = readCashFlowMonthAmountNullable_(r, h.monthHeader);
      const rec = byCanonical[canon];
      if (rec && !rec.sheet_payee_raw) rec.sheet_payee_raw = raw;
      if (rec && vNull !== null) {
        rec.monthly_values.push({
          month: h.monthHeader,
          raw_display: readCashFlowMonthRawDisplay_(r, h.monthHeader),
          amount: round2_(vNull)
        });
      }
    });
  });

  const stable_candidate_payees_found_in_cf = Object.keys(candidateKeys).map(function(k) {
    return candidateKeys[k];
  });

  const stable_payees_not_found = [];
  const matched_stable_income_rows = [];
  let matched_stable_payee_count = 0;
  ROLLING_DP_EXACT_STABLE_INCOME_PAYEES_.forEach(function(c) {
    const rec = byCanonical[c];
    const monthsWithValues = rec.monthly_values.filter(function(m) {
      return Math.abs(m.amount) > 0.005;
    }).length;
    if (!rec.monthly_values.length) {
      stable_payees_not_found.push(c);
    } else {
      matched_stable_payee_count++;
      matched_stable_income_rows.push({
        canonical: c,
        sheet_payee_raw: rec.sheet_payee_raw || c,
        monthly_values_used: rec.monthly_values.slice(),
        months_with_nonzero_values: monthsWithValues
      });
    }
  });

  const all_income_payee_raws_in_cf = [];
  const seenInc = Object.create(null);
  history.forEach(function(h) {
    if (!h.rows) return;
    h.rows.forEach(function(r) {
      if (String(r.Type || '')
          .trim()
          .toUpperCase() !== 'INCOME') {
        return;
      }
      if (!cashFlowCellIsPresent_(r, h.monthHeader)) return;
      const raw = String(r.Payee || '').trim();
      if (!raw) return;
      const k = normalizePayeeStableKey_(raw);
      if (seenInc[k]) return;
      seenInc[k] = true;
      all_income_payee_raws_in_cf.push(raw);
    });
  });

  return {
    all_income_payee_raws_in_cf: all_income_payee_raws_in_cf,
    stable_candidate_payees_found_in_cf: stable_candidate_payees_found_in_cf,
    stable_payees_not_found: stable_payees_not_found,
    matched_stable_income_rows: matched_stable_income_rows,
    matched_stable_payee_count: matched_stable_payee_count
  };
}

function topExpensePayeeRawSamplesFromAnchor_(history, aliasMap, limit) {
  limit = limit || 10;
  const anchor = history[history.length - 1];
  const expMap = expensePayeeMapFromRawRows_(anchor.rows, anchor.monthHeader, aliasMap);
  const keys = Object.keys(expMap).sort(function(a, b) {
    return expMap[b] - expMap[a];
  });
  const out = [];
  const seenNorm = Object.create(null);
  keys.slice(0, limit).forEach(function(normKey) {
    let rawBest = '';
    if (anchor.rows) {
      anchor.rows.forEach(function(r) {
        if (String(r.Type || '')
            .trim()
            .toUpperCase() !== 'EXPENSE') {
          return;
        }
        if (!cashFlowCellIsPresent_(r, anchor.monthHeader)) return;
        if (normalizeName_(r.Payee, aliasMap) !== normKey) return;
        rawBest = String(r.Payee || '').trim();
      });
    }
    seenNorm[normKey] = true;
    out.push({ payee_normalized: normKey, payee_raw: rawBest || normKey, anchor_amount: expMap[normKey] });
  });
  return out;
}

function countExpenseMonthsForPayeeRaw_(history, payeeRaw, aliasMap) {
  const nk = normalizeName_(payeeRaw, aliasMap);
  let n = 0;
  history.forEach(function(h) {
    if (!h.rows) return;
    h.rows.forEach(function(r) {
      if (String(r.Type || '')
          .trim()
          .toUpperCase() !== 'EXPENSE') {
        return;
      }
      if (!cashFlowCellIsPresent_(r, h.monthHeader)) return;
      if (normalizeName_(r.Payee, aliasMap) !== nk) return;
      if (Math.abs(readCashFlowMonthAmount_(r, h.monthHeader)) > 0.005) n++;
    });
  });
  return n;
}

function buildPayeeDebugRows_(history, aliasMap) {
  const payeeKeys = collectAllExpensePayeeKeys_(history, aliasMap);
  const keySet = Object.create(null);
  payeeKeys.forEach(function(k) {
    keySet[k] = true;
  });

  const rows = [];
  ROLLING_DP_EXACT_STABLE_INCOME_PAYEES_.forEach(function(canonical) {
    const monthSet = Object.create(null);
    let found = false;
    let rawSeen = '';
    history.forEach(function(h) {
      if (!h.rows) return;
      h.rows.forEach(function(r) {
        if (String(r.Type || '')
            .trim()
            .toUpperCase() !== 'INCOME') {
          return;
        }
        if (stableCanonicalForPayeeRaw_(r.Payee) !== canonical) return;
        found = true;
        rawSeen = String(r.Payee || '').trim();
        if (readCashFlowMonthAmountNullable_(r, h.monthHeader) !== null) {
          monthSet[h.monthHeader] = true;
        }
      });
    });
    const monthsVals = Object.keys(monthSet).length;
    rows.push({
      category: 'Stable income',
      payee: canonical,
      found_in_cf: found ? 'Yes' : 'No',
      type_matched: found ? 'Income' : '—',
      months_with_values: monthsVals,
      included_in_projection: found ? 'Yes' : 'No',
      sheet_payee_raw: rawSeen || '—'
    });
  });

  const topExp = topExpensePayeeRawSamplesFromAnchor_(history, aliasMap, 10);
  topExp.forEach(function(t) {
    const raw = t.payee_raw;
    const nk = t.payee_normalized;
    const found = keySet[nk];
    const monthsVals = countExpenseMonthsForPayeeRaw_(history, raw, aliasMap);
    rows.push({
      category: 'Expense (top anchor)',
      payee: raw,
      found_in_cf: found ? 'Yes' : 'No',
      type_matched: found ? 'Expense' : '—',
      months_with_values: monthsVals,
      included_in_projection: found ? 'Yes (forward smoothed)' : 'No',
      sheet_payee_raw: raw
    });
  });

  return rows;
}

function buildForwardBaselines_(history, anchorSplit, anchorNorm, aliasMap, debts) {
  const historyCf = history.filter(function(h) {
    return h.monthHasCfData;
  });
  const stableMonthResults = historyCf.map(function(h) {
    return stableIncomeMonthTotalFromRows_(h.rows, h.monthHeader, aliasMap);
  });
  const stableNonEmptyTotals = [];
  stableMonthResults.forEach(function(m) {
    if (m.nonEmpty) {
      stableNonEmptyTotals.push(m.sum);
    }
  });
  const fbStable = medianStableTrailingFromNonEmptyMonths_(stableNonEmptyTotals);

  const totalOutSeriesNonEmpty = historyCf.map(function(h) {
    return monthlyPositiveExpenseOutflow_(h, aliasMap);
  });
  const fbTotalOut = medianWithFallbacks_(spikeSmoothSeriesForMedian_(totalOutSeriesNonEmpty));

  const recurringModel = buildRecurringExpenseForwardModel_(history, aliasMap, debts || []);
  let positiveExpenseForward = recurringModel.recurring_expense_forward;
  const expenseSource = 'recurring_operating_only_bucketed';

  const expenseTotalForward = round2_(-positiveExpenseForward);
  const expensePositiveForward = round2_(positiveExpenseForward);

  let stableIncomeForward = fbStable.value;
  let stableSource = 'stable_non_empty_month_median_' + fbStable.label;

  const samples = buildPayeeDiagnosticSamples_(history, aliasMap);
  const stableDiagExt = buildStableIncomeExtendedDiagnostics_(history);

  const stable6 =
    stableNonEmptyTotals.length >= 6
      ? round2_(median_(stableNonEmptyTotals.slice(-6)))
      : stableNonEmptyTotals.length
        ? round2_(median_(stableNonEmptyTotals))
        : null;

  const stableNumericAggregationError =
    stableDiagExt.matched_stable_payee_count > 0 &&
    stableNonEmptyTotals.length > 0 &&
    Math.abs(stableIncomeForward) < 0.005;

  let expenseConfidence = 'LOW';
  if (positiveExpenseForward > 0.005) {
    if (recurringModel.recurring_payees_included_count >= 8 && historyCf.length >= 12) {
      expenseConfidence = 'HIGH';
    } else if (recurringModel.recurring_payees_included_count >= 4 && historyCf.length >= 6) {
      expenseConfidence = 'MEDIUM';
    } else {
      expenseConfidence = 'LOW';
    }
  } else if (historyHasAnyExpense_(history, aliasMap)) {
    expenseConfidence = 'LOW';
  }

  const adjFlags = recurringModel.adjustment_flags || {};
  if (expenseConfidence === 'HIGH' && adjFlags.alias_unresolved) {
    expenseConfidence = 'MEDIUM';
  }

  const incomeConfidence =
    fbStable.label === 'insufficient' || fbStable.label.indexOf('zero') >= 0 ? 'LOW' : fbStable.windowUsed >= 6 ? 'MEDIUM' : 'LOW';

  return {
    stableIncomeForward: round2_(stableIncomeForward),
    variableIncomeForward: 0,
    expenseTotalForward: expenseTotalForward,
    expensePositiveForward: expensePositiveForward,
    expenseConfidence: expenseConfidence,
    incomeConfidence: incomeConfidence,
    anchorMonthNet: anchorNorm.monthNet,
    forwardMonthNetEstimate: round2_(stableIncomeForward - expensePositiveForward),
    recurringExpenseModel: recurringModel,
    diagnostics: Object.assign({}, stableDiagExt, {
      forward_stable_income_median_6m: stable6,
      forward_smoothed_expense_monthly: expensePositiveForward,
      forward_legacy_total_smoothed_expense_monthly: recurringModel.legacy_total_smoothed_forward,
      forward_total_cash_out_median_reference: fbTotalOut.value,
      forward_total_cash_out_median_window: fbTotalOut.label,
      stable_income_source: stableSource,
      expense_source: expenseSource,
      stable_fallback_window: fbStable.label,
      stable_median_label: fbStable.label,
      stable_median_window_used: fbStable.windowUsed,
      stable_median_trailing_totals_used: fbStable.medianInput,
      stable_median_input_array: fbStable.medianInput,
      stable_non_empty_income_months_count: stableNonEmptyTotals.length,
      stable_monthly_debug_last_12: buildStableMonthlyDebugMatrix_(history, aliasMap, 12),
      stable_income_parsing_samples: buildStableIncomeParsingSamples_(history),
      stable_numeric_aggregation_error: stableNumericAggregationError,
      expense_fallback_window: fbTotalOut.label,
      stable_income_matched_payees: samples.stable_income_matched_payees,
      expense_anchor_top_payees: samples.expense_anchor_top_payees,
      months_with_cf_column_populated: samples.months_with_cf_column_populated,
      recurring_expense_forward: recurringModel.recurring_expense_forward,
      debt_cleanup_excluded_monthly_avg: recurringModel.debt_cleanup_excluded_monthly_avg,
      irregular_excluded_monthly_avg: recurringModel.irregular_excluded_monthly_avg,
      top_recurring_payees_included: recurringModel.top_recurring_payees_included,
      top_excluded_debt_cleanup_payees: recurringModel.top_excluded_debt_cleanup_payees,
      top_excluded_irregular_payees: recurringModel.top_excluded_irregular_payees,
      forward_recurring_expense_model: recurringModel,
      recurring_baseline_adjustment_rollups: recurringModel.baseline_adjustment_rollups,
      recurring_baseline_adjustment_flags: recurringModel.adjustment_flags
    })
  };
}

/** True only for execution integrity issues that block trusting today's cash split. */
function rollingExecutionPlanFailureIsBlocking_(msg) {
  const m = String(msg || '');
  if (!m) return false;
  if (m.indexOf('execution cash split sum does not match') >= 0) return true;
  if (m.indexOf('total executable now does not equal') >= 0) return true;
  if (m.indexOf('execution extra cash total > 0 but no per-account') >= 0) return true;
  if (m.indexOf('Aggressive mode: phase-2 primary share') >= 0) return true;
  return false;
}

function injectRollingWatchoutsIntoExecutionPlanText_(planText, failedChecks, keyWarnings) {
  const blocking = (failedChecks || []).filter(function(fc) {
    return fc && rollingExecutionPlanFailureIsBlocking_(fc);
  });
  const picked = [];
  blocking.forEach(function(b) {
    if (picked.length >= 3) return;
    picked.push('Execution check: ' + String(b));
  });
  (keyWarnings || []).forEach(function(w) {
    if (picked.length >= 3) return;
    const s = String(w || '').trim();
    if (!s) return;
    let dup = false;
    for (let i = 0; i < picked.length; i++) {
      if (picked[i] === s) {
        dup = true;
        break;
      }
    }
    if (!dup) picked.push(s);
  });
  const body = picked.length ? picked.map(function(x) { return '- ' + x; }).join('\n') : '- None';
  return String(planText || '').replace(ROLLING_DP_WATCHOUTS_PLACEHOLDER_, body);
}

function finalizeRollingExecutionPlanText_(planText, planStatus, failedChecks, keyWarnings) {
  let t = String(planText || '').replace(ROLLING_DP_PLAN_STATUS_PLACEHOLDER_, String(planStatus || 'OK'));
  t = injectRollingWatchoutsIntoExecutionPlanText_(t, failedChecks, keyWarnings);
  return t;
}

/** Execution plan output mode: operator | aggressive | automation (optional; combine with space or comma). */
function appendRollingExecutionPlanOptionalModes_(planText, mode) {
  const modesList = String(mode || '')
    .toLowerCase()
    .trim()
    .split(/[\s,|]+/)
    .filter(Boolean);
  if (!modesList.length) return String(planText || '');
  /** Automation block is the full machine-readable payload; do not append checklist or other prose after it. */
  if (modesList.indexOf('automation') >= 0) {
    return String(planText || '');
  }
  let t = String(planText || '');
  if (modesList.indexOf('operator') >= 0) {
    t +=
      '\n--------------------------------------------------\n' +
      'EXECUTION CHECKLIST\n' +
      '\n' +
      '[ ] Pay all minimums\n' +
      '[ ] Pay cleanup balances\n' +
      '[ ] Pay primary allocation\n' +
      '[ ] Pay secondary allocation\n' +
      '[ ] Review conditional income\n' +
      '\n--------------------------------------------------';
  }
  return t;
}

function debtNameForExecutionPlan_(name, mode) {
  const nm = String(name || '').trim() || '—';
  const m = String(mode || '').toLowerCase();
  /** Automation uses full account names for structured / UI rendering (no truncation). */
  if (m === 'automation') {
    return nm;
  }
  if (nm.length > 32) {
    return nm.substring(0, 29) + '...';
  }
  return nm;
}

/**
 * Split execution cash extras into cleanup / primary / secondary / overflow for action-plan display.
 */
function sumRollingExecutionBucketItems_(items) {
  let s = 0;
  (items || []).forEach(function(e) {
    s = round2_(s + (Number(e.amt) || 0));
  });
  return round2_(s);
}

/**
 * User-facing split of cash extras: cleanup + (primary+secondary+overflow) equals exec cash total.
 * "Remaining after cleanup" is total cash extras minus cleanup only (no simulator pass labels).
 */
function rollingAggressiveCashExtrasReconcile_(buckets, execCashDisplayed) {
  const c = sumRollingExecutionBucketItems_(buckets.cleanup);
  const p = sumRollingExecutionBucketItems_(buckets.primary);
  const sec = sumRollingExecutionBucketItems_(buckets.secondary);
  const o = sumRollingExecutionBucketItems_(buckets.overflow);
  const sumLines = round2_(c + p + sec + o);
  const remaining = round2_(execCashDisplayed - c);
  const nonCleanup = round2_(p + sec + o);
  const primarySharePct =
    remaining > 0.005 ? round2_((100 * p) / remaining) : p > 0.005 ? 100 : 0;
  return {
    cleanup_cash: c,
    primary_cash: p,
    secondary_cash: sec,
    overflow_cash: o,
    remaining_after_cleanup: remaining,
    non_cleanup_sum: nonCleanup,
    primary_share_of_remaining_pct: primarySharePct,
    sum_lines_matches_exec: Math.abs(sumLines - round2_(execCashDisplayed)) <= 0.15,
    remaining_matches_buckets: Math.abs(nonCleanup - remaining) <= 0.15
  };
}

function buildExecutionExtraBuckets_(eca, execCashMap, planInvalid) {
  const cleanup = [];
  const primary = [];
  const secondary = [];
  const overflow = [];
  if (planInvalid) {
    return { cleanup: cleanup, primary: primary, secondary: secondary, overflow: overflow };
  }
  function amtFor(nm) {
    return round2_(Number(execCashMap[nm]) || 0);
  }
  const assigned = Object.create(null);
  if (eca) {
    (eca.cleanup_items || []).forEach(function(c) {
      const nm = String(c && c.name ? c.name : '').trim();
      if (!nm) return;
      const a = amtFor(nm);
      if (a <= 0.005) return;
      assigned[nm] = true;
      cleanup.push({ name: nm, amt: a });
    });
    const conc = eca.concentration_items || [];
    if (conc.length >= 1) {
      const nm = String(conc[0].name || '').trim();
      const a = amtFor(nm);
      if (a > 0.005) {
        assigned[nm] = true;
        primary.push({ name: nm, amt: a });
      }
    }
    for (let i = 1; i < conc.length; i++) {
      const nm = String(conc[i].name || '').trim();
      const a = amtFor(nm);
      if (a <= 0.005) continue;
      assigned[nm] = true;
      secondary.push({ name: nm, amt: a });
    }
  }
  Object.keys(execCashMap || {}).forEach(function(k) {
    if (assigned[k]) return;
    const a = amtFor(k);
    if (a <= 0.005) return;
    overflow.push({ name: k, amt: a });
  });
  overflow.sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });
  return { cleanup: cleanup, primary: primary, secondary: secondary, overflow: overflow };
}

/**
 * Modeled month-end balances (simulator only). Shown only when DEBUG DETAILS is on; never mixed with execute-now snapshot.
 */
function buildModeledMonthEndSnapshotDebugLines_(row0, planInvalid) {
  const lines = [];
  if (planInvalid) return lines;
  const startSnap = row0.debt_balances_start || [];
  const endSnap = row0.debt_balances_end || [];
  if (!startSnap.length || !endSnap.length) return lines;

  const b0 = Object.create(null);
  for (let i = 0; i < startSnap.length; i++) {
    const d = startSnap[i];
    b0[d.name] = round2_(Number(d.balance) || 0);
  }
  const b1 = Object.create(null);
  for (let i = 0; i < endSnap.length; i++) {
    const d = endSnap[i];
    b1[d.name] = round2_(Number(d.balance) || 0);
  }
  const namesSet = Object.create(null);
  for (let i = 0; i < startSnap.length; i++) {
    namesSet[startSnap[i].name] = true;
  }
  for (let i = 0; i < endSnap.length; i++) {
    namesSet[endSnap[i].name] = true;
  }

  const rows = [];
  Object.keys(namesSet).forEach(function(nm) {
    const ms = b0[nm] != null ? b0[nm] : 0;
    const me = b1[nm] != null ? b1[nm] : 0;
    const pay = round2_(Math.max(0, ms - me));
    if (pay <= 0.005 && ms <= 0.005 && me <= 0.005) return;
    rows.push({ name: nm, modelStart: ms, modeledPaydown: pay, modelEnd: me });
  });
  rows.sort(function(a, b) {
    return b.modeledPaydown - a.modeledPaydown;
  });
  if (!rows.length) return lines;

  function padCell_(s, w) {
    s = String(s || '');
    if (s.length > w) {
      return s.substring(0, Math.max(0, w - 1)) + '\u2026';
    }
    while (s.length < w) {
      s += ' ';
    }
    return s;
  }
  const wAcct = 28;
  const wNum = 18;
  lines.push('--------------------------------------------------');
  lines.push('MODELED MONTH-END SNAPSHOT (DEBUG ONLY)');
  lines.push('');
  lines.push(
    'Simulator month-start (incl. planned-expense balance modeling where applied), modeled paydown to month-end, and month-end balance. Not an execution checklist.'
  );
  lines.push('');
  lines.push(
    padCell_('Account', wAcct) +
      ' | ' +
      padCell_('Model month-start', wNum) +
      ' | ' +
      padCell_('Modeled paydown', wNum) +
      ' | ' +
      padCell_('Model month-end', wNum)
  );
  let dashLine = '';
  const dashLen = wAcct + wNum * 3 + 13;
  for (let di = 0; di < dashLen; di++) {
    dashLine += '-';
  }
  lines.push(dashLine);
  const cap = 16;
  for (let i = 0; i < rows.length && i < cap; i++) {
    const r = rows[i];
    lines.push(
      padCell_(r.name, wAcct) +
        ' | ' +
        padCell_(fmtCurrency_(r.modelStart), wNum) +
        ' | ' +
        padCell_(fmtCurrency_(r.modeledPaydown), wNum) +
        ' | ' +
        padCell_(fmtCurrency_(r.modelEnd), wNum)
    );
  }
  if (rows.length > cap) {
    lines.push('(' + (rows.length - cap) + ' more accounts omitted.)');
  }
  lines.push('');
  return lines;
}

/**
 * Plain-text table after EXECUTION TOTALS (Standard / Operator / Aggressive only; not Automation).
 * Execute-now snapshot only: balances from INPUT - Debts anchor; payments from extra_principal_allocations_execution_now + HELOC to target; totals must match execution_total_now.
 */
function buildPostPaymentSnapshotLines_(row0, planInvalid, ctx) {
  const lines = [];
  if (planInvalid) return lines;

  const execCashMap = ctx.execCashMap || {};
  const buckets = ctx.buckets || {};
  const eca = ctx.eca;
  const execTotalDisplayed = ctx.execTotalDisplayed != null ? round2_(ctx.execTotalDisplayed) : 0;
  const execHelocAmount =
    ctx.execHelocAmount != null && ctx.execHelocAmount === ctx.execHelocAmount
      ? round2_(ctx.execHelocAmount)
      : 0;
  const helocTargetRaw = String(row0.heloc_target_account || '').trim();
  const includeDebug = !!ctx.include_debug_details;

  const sheetAnchor = row0.debt_balances_sheet_anchor;
  const s0 = Object.create(null);
  if (sheetAnchor && sheetAnchor.length) {
    for (let si = 0; si < sheetAnchor.length; si++) {
      const d = sheetAnchor[si];
      s0[d.name] = round2_(Number(d.balance) || 0);
    }
  }

  const primaryNm = String(
    (eca && eca.concentration_items && eca.concentration_items[0] && eca.concentration_items[0].name) ||
      row0.primary_priority_debt ||
      row0.focus_debt ||
      ''
  ).trim();
  const secondarySet = Object.create(null);
  if (eca && eca.concentration_items) {
    for (let i = 1; i < eca.concentration_items.length; i++) {
      const n = String(eca.concentration_items[i].name || '').trim();
      if (n) secondarySet[n] = true;
    }
  }

  const cleanupNameSet = Object.create(null);
  if (eca && eca.cleanup_items) {
    for (let ci = 0; ci < eca.cleanup_items.length; ci++) {
      const c = eca.cleanup_items[ci];
      const nm = String(c && c.name ? c.name : '').trim();
      if (nm) cleanupNameSet[nm] = true;
    }
  }

  function paymentNowForName_(nm) {
    let p = round2_(Number(execCashMap[nm]) || 0);
    if (helocTargetRaw && nm === helocTargetRaw && execHelocAmount > 0.005) {
      p = round2_(p + execHelocAmount);
    }
    return p;
  }

  const candidateNames = Object.create(null);
  Object.keys(execCashMap || {}).forEach(function(k) {
    if (round2_(Number(execCashMap[k]) || 0) > 0.005) candidateNames[k] = true;
  });
  if (helocTargetRaw && execHelocAmount > 0.005) {
    candidateNames[helocTargetRaw] = true;
  }
  Object.keys(cleanupNameSet).forEach(function(k) {
    candidateNames[k] = true;
  });
  if (primaryNm) candidateNames[primaryNm] = true;
  Object.keys(secondarySet).forEach(function(k) {
    candidateNames[k] = true;
  });

  const orderedNames = [];
  const seen = Object.create(null);
  function pushBucketOrder_(items) {
    (items || []).forEach(function(e) {
      const nm = String(e && e.name ? e.name : '').trim();
      if (!nm || seen[nm]) return;
      if (!candidateNames[nm]) return;
      seen[nm] = true;
      orderedNames.push(nm);
    });
  }
  pushBucketOrder_(buckets.cleanup);
  pushBucketOrder_(buckets.primary);
  pushBucketOrder_(buckets.secondary);
  pushBucketOrder_(buckets.overflow);
  const remainder = [];
  Object.keys(candidateNames).forEach(function(nm) {
    if (!seen[nm]) remainder.push(nm);
  });
  remainder.sort();
  for (let ri = 0; ri < remainder.length; ri++) {
    orderedNames.push(remainder[ri]);
  }

  const rows = [];
  let sumPay = 0;
  for (let oi = 0; oi < orderedNames.length; oi++) {
    const nm = orderedNames[oi];
    const pay = paymentNowForName_(nm);
    const isCleanup = !!cleanupNameSet[nm];
    const isPrimary = primaryNm && nm === primaryNm;
    const isSecondary = !!secondarySet[nm];
    if (pay <= 0.005 && !isCleanup && !isPrimary && !isSecondary) {
      continue;
    }
    const before = s0[nm] != null ? s0[nm] : 0;
    const after = round2_(before - pay);
    let status = '';
    if (before > 0.005 && after <= 0.05) {
      status = 'CLOSED';
    } else if (isPrimary) {
      status = '\u2193 PRIMARY';
    } else if (isSecondary) {
      status = '\u2193 SECONDARY';
    }
    sumPay = round2_(sumPay + pay);
    rows.push({ name: nm, before: before, pay: pay, after: after, status: status });
  }

  const reconcileOk = Math.abs(sumPay - execTotalDisplayed) <= 0.15;

  function padCell_(s, w) {
    s = String(s || '');
    if (s.length > w) {
      return s.substring(0, Math.max(0, w - 1)) + '\u2026';
    }
    while (s.length < w) {
      s += ' ';
    }
    return s;
  }
  const wAcct = 28;
  const wNum = 20;
  const wStat = 16;

  lines.push('--------------------------------------------------');
  lines.push('POST-PAYMENT SNAPSHOT (EXECUTE NOW ONLY)');
  lines.push('');

  if (!reconcileOk) {
    lines.push('POST-PAYMENT SNAPSHOT unavailable: execution totals do not reconcile.');
    lines.push('');
    if (includeDebug) {
      buildModeledMonthEndSnapshotDebugLines_(row0, planInvalid).forEach(function(ln) {
        lines.push(ln);
      });
    }
    return lines;
  }

  if (!rows.length && execTotalDisplayed <= 0.005) {
    lines.push('(No execute-now extra principal this month.)');
    lines.push('');
    if (includeDebug) {
      buildModeledMonthEndSnapshotDebugLines_(row0, planInvalid).forEach(function(ln) {
        lines.push(ln);
      });
    }
    return lines;
  }

  let eliminatedNow = 0;
  let primaryPay = 0;
  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];
    if (r.before > 0.005 && r.after <= 0.05) eliminatedNow++;
    if (primaryNm && r.name === primaryNm) {
      primaryPay = round2_(primaryPay + r.pay);
    }
  }

  lines.push(
    padCell_('Account', wAcct) +
      ' | ' +
      padCell_('Balance Before', wNum) +
      ' | ' +
      padCell_('Payment Applied Now', wNum) +
      ' | ' +
      padCell_('Balance After Now', wNum) +
      ' | ' +
      padCell_('Status', wStat)
  );
  let dashLine = '';
  const dashLen = wAcct + wNum * 3 + wStat + 16;
  for (let di = 0; di < dashLen; di++) {
    dashLine += '-';
  }
  lines.push(dashLine);

  let sumBefore = 0;
  let sumAfter = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    sumBefore = round2_(sumBefore + r.before);
    sumAfter = round2_(sumAfter + r.after);
    lines.push(
      padCell_(r.name, wAcct) +
        ' | ' +
        padCell_(fmtCurrency_(r.before), wNum) +
        ' | ' +
        padCell_(fmtCurrency_(r.pay), wNum) +
        ' | ' +
        padCell_(fmtCurrency_(r.after), wNum) +
        ' | ' +
        padCell_(r.status, wStat)
    );
  }

  lines.push(
    padCell_('TOTAL', wAcct) +
      ' | ' +
      padCell_(fmtCurrency_(sumBefore), wNum) +
      ' | ' +
      padCell_(fmtCurrency_(execTotalDisplayed), wNum) +
      ' | ' +
      padCell_(fmtCurrency_(sumAfter), wNum) +
      ' | ' +
      padCell_('', wStat)
  );
  lines.push('');
  lines.push(
    'Result: ' +
      eliminatedNow +
      ' accounts eliminated now \u00b7 ' +
      fmtCurrency_(execTotalDisplayed) +
      ' deployed now \u00b7 primary reduced by ~' +
      fmtCurrency_(primaryPay)
  );
  lines.push('');
  if (includeDebug) {
    buildModeledMonthEndSnapshotDebugLines_(row0, planInvalid).forEach(function(ln) {
      lines.push(ln);
    });
  }
  return lines;
}

/**
 * Short, action-oriented bullets for default UI (no duplicate extra-principal lines vs execution plan).
 */
function buildRollingDefaultOutput_(summary, thisMonthPlan, actionDecisionBox, next3Preview, keyWarningsFinal) {
  const sum = summary || {};
  const plan = thisMonthPlan || {};
  const box = actionDecisionBox || {};
  const liq = plan.liquidity || {};
  const anchorMin = plan.anchor_month_minimum_schedule || {};
  const payNow = anchorMin.pay_now || [];
  const warnTop = (keyWarningsFinal || []).slice(0, 3);

  const bullets = [];
  bullets.push('Anchor month: ' + String(sum.anchor_month || plan.anchor_month || '—'));
  bullets.push(
    'Extra debt payment executable now: ' +
      fmtCurrency_(Number(liq.execution_total_now) || 0) +
      ' (cash + optional modeled HELOC per strict gates)'
  );
  bullets.push('HELOC recommendation: ' + String(liq.heloc_recommended_now || box.should_draw_from_heloc || '—'));
  bullets.push('Hold cash instead? ' + String(box.should_hold_cash_instead || '—'));
  bullets.push(
    'Reserve protected? ' +
      (plan.reserve_protection_active ? 'Yes — reserve stress mode' : 'No — path keeps ending cash at/above protections')
  );
  if (!payNow.length) {
    bullets.push(
      'Minimum payments due now: none flagged (minimums satisfied in anchor Cash Flow or no minimum rows on active debts).'
    );
  } else {
    bullets.push(
      'Minimum payments due now: ' +
        payNow
          .map(function(p) {
            return String(p.account) + ' ' + fmtCurrency_(p.minimum_required);
          })
          .join('; ')
    );
  }
  bullets.push(
    'Extra principal (cash / HELOC): use **THIS MONTH EXECUTION PLAN** below only — same numbers everywhere; do not double-pay.'
  );
  const cond = Number(liq.conditional_variable_extra_total) || 0;
  if (cond > 0.005) {
    bullets.push('Conditional extra if variable income arrives: ' + fmtCurrency_(cond) + ' (not until received).');
  }
  if (warnTop.length) {
    bullets.push('Top warnings: ' + warnTop.join(' | '));
  }

  const whyPool = [];
  if (plan.why_this_month) whyPool.push(String(plan.why_this_month));
  (plan.context_notes || []).forEach(function(n) {
    if (n) whyPool.push(String(n));
  });
  if (plan.deployment_check_note) whyPool.push(String(plan.deployment_check_note));
  warnTop.forEach(function(w) {
    if (w && whyPool.indexOf(w) < 0) whyPool.push(String(w));
  });
  const why_notes = whyPool.filter(Boolean).slice(0, 4);

  const next3short = (next3Preview || []).map(function(r) {
    return {
      month: r.month,
      expected_focus: r.expected_debt_focus || '—',
      extra_payments_likely: r.extra_payments_likely || '—'
    };
  });

  return {
    this_month_plan_bullets: bullets,
    next_3_month_preview_short: next3short,
    why_notes: why_notes
  };
}

/** Strip fields that duplicate execution plan or are debug-only. */
function slimThisMonthPlanForDashboard_(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  const out = JSON.parse(JSON.stringify(plan));
  delete out.payment_actions;
  delete out.recommended_extra_payments;
  delete out.deployment_check_note;
  delete out.modeled_extra_principal_total;
  delete out.cash_plus_heloc_execution_cap;
  delete out.execution_total_now;
  delete out.account_cash_policy_debug;
  out.top_warnings = (out.top_warnings || []).slice(0, 3);
  return out;
}

/**
 * Month-0 execution fields for dashboard clients when {@code next_12_months} is omitted from the slim payload.
 * Keeps execute-now maps + concentration analysis in sync with THIS MONTH EXECUTION PLAN text.
 */
function slimRollingDashboardExecutionRow_(row0, extras) {
  if (!row0 || typeof row0 !== 'object') return null;
  var o = row0;
  var out = {};
  var extraOpts = extras && typeof extras === 'object' ? extras : null;
  var keys = [
    'month',
    'extra_principal_allocations_execution_now',
    'execution_concentration_analysis',
    'extra_principal_allocations_conditional_variable',
    'conditional_variable_extra_total',
    'execution_total_now',
    'execution_extra_cash_total',
    'heloc_draw_this_month',
    'heloc_target_account',
    'debt_balances_sheet_anchor',
    'primary_priority_debt',
    'focus_debt',
    'opening_concentration_meta',
    'deployable_concentration_meta',
    'waterfall_execution_snapshot',
    'waterfall_execution_validated',
    'waterfall_execution_validation_failures',
    'allocation_audit',
    'liquidity_summary'
  ];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (o[k] !== undefined) out[k] = o[k];
  }
  /**
   * HELOC advisor snapshot — read-only view of the starting debt list +
   * identified HELOC line for the React dashboard's client-side advisory
   * layer (helocStrategyModel + 12-month acceleration plan). Does NOT drive
   * any backend allocation or execution logic; purely decision support.
   */
  var startSnap = Array.isArray(o.debt_balances_start) ? o.debt_balances_start : [];
  if (startSnap.length) {
    var helocRef = findHelocDebt_(startSnap);
    var debtsAdv = [];
    for (var j = 0; j < startSnap.length; j++) {
      var d = startSnap[j] || {};
      if (d.active === false) continue;
      var bal = Number(d.balance) || 0;
      if (bal <= 0.005) continue;
      debtsAdv.push({
        name: String(d.name || ''),
        original_name: String(d.originalName || ''),
        type: String(d.type || '').trim(),
        balance: round2_(bal),
        apr_percent: Number(d.interestRate) || 0,
        minimum_payment: round2_(Number(d.minimumPayment) || 0)
      });
    }
    out.heloc_advisor_snapshot = {
      heloc_apr_percent: helocRef ? Number(helocRef.interestRate) || 0 : 0,
      heloc_current_balance: helocRef ? round2_(Number(helocRef.balance) || 0) : 0,
      heloc_account_name: helocRef ? String(helocRef.name || 'HELOC') : '',
      heloc_minimum_payment: helocRef ? round2_(Number(helocRef.minimumPayment) || 0) : 0,
      debts: debtsAdv,
      min_spread_percent: ROLLING_DP_HELOC_MIN_SPREAD_OVER_HELOC_APR_
    };
    // Attach the optional card-spend realism block computed upstream from
    // Cash Flow history (Flow Source column). Keeps the existing snapshot
    // contract untouched when no data is available (legacy tabs or blank
    // Flow Source values → extras.cardSpend is null).
    if (extraOpts && extraOpts.cardSpend) {
      out.heloc_advisor_snapshot.card_spend = extraOpts.cardSpend;
    }
    // TEMPORARY: attach the flow-source debug block so dashboards can see
    // exactly what sheets/headers/rows the advisor read (or why it fell back).
    if (extraOpts && extraOpts.cardSpendDebug) {
      out.heloc_advisor_snapshot.card_spend_debug = extraOpts.cardSpendDebug;
    }
  }
  return Object.keys(out).length ? out : null;
}

function slimRollingDebtPayoffForDefault_(full, defaultOutput, extras) {
  const pei = full.planned_expense_impact || {};
  const slimExtras = extras && typeof extras === 'object' ? extras : null;
  return {
    generated_at: full.generated_at,
    summary: full.summary,
    key_warnings: (full.key_warnings || []).slice(0, 3),
    default_output: defaultOutput,
    this_month_plan: slimThisMonthPlanForDashboard_(full.this_month_plan),
    this_month_execution_plan: full.this_month_execution_plan,
    rolling_dashboard_execution_row: slimRollingDashboardExecutionRow_(
      full.next_12_months && full.next_12_months[0],
      slimExtras
    ),
    action_decision_box: full.action_decision_box,
    next_3_month_preview: full.next_3_month_preview,
    planned_expense_impact: {
      near_term_cash_reserved: pei.near_term_cash_reserved,
      unmapped_card_funded_cash_risk: pei.unmapped_card_funded_cash_risk,
      near_term_card_funded_mapped_total: pei.near_term_card_funded_mapped_total,
      display_lines: (pei.display_lines || []).slice(0, 40),
      has_mid_term: pei.has_mid_term,
      has_long_term: pei.has_long_term,
      has_unmapped_near_term_card: pei.has_unmapped_near_term_card,
      near_term_card_funded_within_30: pei.near_term_card_funded_within_30,
      modeling_unmapped_card_assumption: pei.modeling_unmapped_card_assumption || '',
      warnings: (pei.warnings || []).slice(0, 2)
    },
    assumptions: {
      reserve_target: full.assumptions.reserve_target,
      lump_sum_split: full.assumptions.lump_sum_split,
      anchor_sheet_month_header: full.assumptions.anchor_sheet_month_header,
      cash_model: full.assumptions.cash_model,
      cash_haircut: full.assumptions.cash_haircut,
      reserved_buckets_tracked: full.assumptions.reserved_buckets_tracked
    },
    include_debug_details: false
  };
}

function getRollingDebtPayoffPlan(options) {
  options = options || {};
  const includeDebugDetails = !!options.includeDebugDetails;
  const executionPlanMode = String(options.executionPlanMode || '')
    .toLowerCase()
    .trim();
  const executionPlanModesList = executionPlanMode.split(/[\s,|]+/).filter(Boolean);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = Session.getScriptTimeZone();
  const aliasMap = getAliasMap_();
  const debtRows = readSheetAsObjects_(ss, 'DEBTS');
  const accountRows = readSheetAsObjects_(ss, 'ACCOUNTS');
  const debts = normalizeDebts_(debtRows, aliasMap);
  const accounts = normalizeAccounts_(accountRows);
  const liquidTotal = round2_(
    accounts.reduce(function(s, a) {
      return s + a.currentBalance;
    }, 0)
  );
  const reservedBucketsTracked = false;

  const anchor = findRollingCashFlowAnchor_(ss);
  const anchorHeader = anchor.header;
  const anchorDate = anchor.date;

  const history = buildRollingCfHistory_(ss, anchorDate, 24, aliasMap);
  if (!history.length) {
    throw new Error('No Cash Flow history found for rolling plan.');
  }

  const anchorEntry = history[history.length - 1];
  const anchorNorm = anchorEntry.normalized;
  const incomeSplit = {
    stableTotal: stableIncomeFromRawRows_(anchorEntry.rows, anchorEntry.monthHeader, aliasMap),
    variableTotal: variableIncomeFromRawRows_(anchorEntry.rows, anchorEntry.monthHeader, aliasMap),
    stableLines: [],
    variableLines: []
  };
  const ccMeta = buildCreditCardSpendMeta_(history, debts);
  // HELOC realism: derive ongoing card-routed spend from the Cash Flow
  // "Flow Source" column in the last 6 months of history. Returns null on
  // legacy tabs (no Flow Source header) so downstream consumers fall back
  // cleanly to the planned-expense-based estimate.
  const helocFlowSourceCardSpend = buildHelocFlowSourceCardSpend_(history);
  // HELOC realism — Bills-based forward-looking companion to the Cash-Flow
  // history signal above. Reads INPUT - Bills' new "Payment Source" column
  // and converts every active credit-card bill into a monthly-equivalent
  // burden + next-120-day scheduled burden. Returns null on legacy tabs
  // (no Payment Source header) so the advisor stays history-only.
  const helocBillsCardObligations = buildHelocBillsCardObligationModel_(
    ss,
    anchorDate
  );
  // Combine the two signals using the conservative "max" rule so neither
  // trailing history nor forward-looking bills can cause the advisor to
  // under-estimate card pressure. The chosen burden is written back into
  // `recent_monthly_average` + `spiky_card_spend_next_120_days` so the
  // existing React realism ladder picks it up unchanged.
  const helocCombinedCardSpend = buildHelocCardSpendCombinedPayload_(
    helocFlowSourceCardSpend,
    helocBillsCardObligations
  );
  // TEMPORARY: verify which sheets / headers / rows the advisor is seeing so
  // we can confirm the Flow Source column is actually being read. Purely
  // observational; does not alter card-spend values or any other logic.
  const helocFlowSourceDebug = buildHelocFlowSourceDebug_(
    ss,
    history,
    helocFlowSourceCardSpend
  );
  // Extend the advisor debug block with the Bills-based obligation metrics
  // (Part 10) so automation tests can assert on them end-to-end.
  if (helocFlowSourceDebug && typeof helocFlowSourceDebug === 'object') {
    helocFlowSourceDebug.bills_card_obligations = helocBillsCardObligations
      ? {
          payment_source_column_present: true,
          active_card_bill_count: helocBillsCardObligations.active_card_bill_count,
          bills_recurring_card_burden:
            helocBillsCardObligations.recurring_monthly_equivalent_card_burden,
          bills_spiky_card_burden_next_120_days:
            helocBillsCardObligations.upcoming_card_bills_next_120_days,
          recurring_card_payees_from_bills:
            helocBillsCardObligations.recurring_card_payees.slice(),
          spiky_card_payees_from_bills:
            helocBillsCardObligations.spiky_card_payees.slice(),
          estimation_method: helocBillsCardObligations.estimation_method,
          confidence: helocBillsCardObligations.confidence
        }
      : { payment_source_column_present: false };
    if (helocCombinedCardSpend) {
      helocFlowSourceDebug.combined_card_burden = {
        historical_recurring_card_spend:
          helocCombinedCardSpend.historical_recurring_card_spend,
        historical_spiky_card_spend_next_120_days:
          helocCombinedCardSpend.historical_spiky_card_spend_next_120_days,
        bills_recurring_card_burden:
          helocCombinedCardSpend.bills_recurring_card_burden,
        bills_spiky_card_burden_next_120_days:
          helocCombinedCardSpend.bills_spiky_card_burden_next_120_days,
        chosen_recurring_card_burden:
          helocCombinedCardSpend.chosen_recurring_card_burden,
        chosen_spiky_card_burden_next_120_days:
          helocCombinedCardSpend.chosen_spiky_card_burden_next_120_days,
        source_decision: helocCombinedCardSpend.source_decision,
        spiky_source_decision: helocCombinedCardSpend.spiky_source_decision
      };
    }
  }
  const sdSeries = buildSanDiegoLossSeries_(history, 6, aliasMap);
  const triggers = buildRollingTriggers_(history, debts, anchorNorm, ccMeta, sdSeries);
  const irregularNote = computeIrregularExpenseNote_(history, aliasMap);

  const forward = buildForwardBaselines_(history, incomeSplit, anchorNorm, aliasMap, debts);
  const minTot = round2_(
    debts
      .filter(function(d) {
        return d.active;
      })
      .reduce(function(s, d) {
        return s + d.minimumPayment;
      }, 0)
  );

  const trulyEmpty = historyTrulyEmptyForProjection_(history, aliasMap);
  const fwdStable = forward.stableIncomeForward;
  const fwdExpPos = forward.expensePositiveForward != null ? forward.expensePositiveForward : Math.abs(forward.expenseTotalForward || 0);
  const matchedStablePayeeCount = (forward.diagnostics && forward.diagnostics.matched_stable_payee_count) || 0;
  const stableMatchSucceeded = matchedStablePayeeCount > 0;
  const hasIncomeCf = historyHasAnyIncome_(history, aliasMap);

  const invalidProjection =
    history.length > 0 &&
    !trulyEmpty &&
    Math.abs(fwdStable) < 0.005 &&
    Math.abs(fwdExpPos) < 0.005;

  const stableNonEmptyMonthCount = (forward.diagnostics && forward.diagnostics.stable_non_empty_income_months_count) || 0;
  const stableNumericAggregationError =
    forward.diagnostics && forward.diagnostics.stable_numeric_aggregation_error;

  const keyWarnings = [];
  if (matchedStablePayeeCount === 0 && hasIncomeCf) {
    keyWarnings.push('no stable income payees matched');
  }
  if (fwdStable < 5000 && fwdExpPos > 20000) {
    keyWarnings.push('likely income mapping failure');
  }
  if (stableNumericAggregationError) {
    keyWarnings.push('stable payees matched but numeric monthly totals still resolve to zero');
  } else if (Math.abs(fwdStable) < 0.005 && hasIncomeCf && matchedStablePayeeCount > 0) {
    keyWarnings.push('Forward stable income resolved to 0; check stable payee amounts across loaded months.');
  }
  if (Math.abs(fwdExpPos) < 0.005 && historyHasAnyExpense_(history, aliasMap)) {
    keyWarnings.push(
      'Forward recurring expense baseline resolved to 0 while history has expenses — review payee buckets (debt cleanup / irregular vs recurring) and Cash Flow rows.'
    );
  }
  const recModel = forward.recurringExpenseModel || {};
  const recFwdAmt = recModel.recurring_expense_forward != null ? recModel.recurring_expense_forward : fwdExpPos;
  if (Math.abs(fwdStable) >= 0.005 && recFwdAmt > 1.5 * Math.abs(fwdStable)) {
    keyWarnings.push('Recurring expense baseline may still be overstated (>1.5× forward stable income).');
  }
  if (trulyEmpty) {
    keyWarnings.push('Insufficient Cash Flow history: no non-zero income and expense in loaded months.');
  }
  if (invalidProjection) {
    keyWarnings.push(
      'Projection is INVALID because income/expenses are both near zero while debt/history exist — verify Cash Flow Type column and payee matching.'
    );
  }
  if (minTot > 0.005 && (Math.abs(fwdStable) < 0.005 || Math.abs(fwdExpPos) < 0.005)) {
    keyWarnings.push(
      'Debt minimums are non-zero but forward stable income or forward expenses are ~0 — verify Cash Flow Type column (Income/Expense) and payee names.'
    );
  }
  keyWarnings.push(
    'Month-0 execution uses reserve + buffer + near-term planned cash (cash-funded and unmapped card-funded cash-risk holds), a per-month cash cap, and split cash vs forecast variable principal. HELOC defaults to No unless every strict gate passes; when it passes it is still optional only with manual approval.'
  );

  const anchorExpensePositive = monthlyPositiveExpenseOutflow_(anchorEntry, aliasMap);
  const payeeDebugRows = buildPayeeDebugRows_(history, aliasMap);

  const planInvalidEarly =
    invalidProjection ||
    trulyEmpty ||
    (!stableMatchSucceeded && hasIncomeCf) ||
    !!stableNumericAggregationError ||
    (stableMatchSucceeded && Math.abs(fwdStable) < 0.005);

  const plannedExpenseModel = buildRollingPlannedExpenseImpactModel_(anchorDate, tz, debts, aliasMap);
  if (plannedExpenseModel.has_mid_term) {
    keyWarnings.push(
      'Upcoming planned expenses (due within 90 days after anchor month-end) may reduce available cash in future months.'
    );
  }
  if (plannedExpenseModel.has_unmapped_near_term_card) {
    var _uTitle = String(plannedExpenseModel.first_unmapped_near_term_title || 'Planned expense').trim() || 'Planned expense';
    keyWarnings.unshift(
      'HELOC remains conservative while unmapped near-term expense exists.',
      'Near-term planned expenses reduce extra-payment flexibility.',
      '"' + _uTitle + '" is card-funded but not mapped; treated as cash risk until mapped.'
    );
  }

  const plannedLiquidityHolds = round2_(
    plannedExpenseModel.near_term_cash_total + plannedExpenseModel.unmapped_card_funded_cash_risk_total
  );

  /**
   * Reserve and Buffer are now CALCULATED from SYS - Accounts (DO_NOT_TOUCH balances
   * and per-account Min Buffer), not from the legacy ROLLING_DP_RESERVE_DEFAULT_ /
   * ROLLING_DP_BUFFER_ABOVE_RESERVE_ planner constants. We pass reserveTarget/
   * bufferAboveReserve as 0 so legacy reserve_hold / global_buffer_hold do not reduce
   * final_execute_now_cash. The legacy planner constants are still recorded separately
   * (legacy_reserve_target / legacy_buffer_above_reserve) for audit/debug only.
   */
  const cashPolicyModel = buildAccountCashAvailabilityModel_(accounts, {
    nearTermPlannedCash: plannedExpenseModel.near_term_cash_total,
    unmappedCardFundedCashRisk: plannedExpenseModel.unmapped_card_funded_cash_risk_total,
    reserveTarget: 0,
    bufferAboveReserve: 0
  });
  cashPolicyModel.legacy_reserve_target = round2_(ROLLING_DP_RESERVE_DEFAULT_);
  cashPolicyModel.legacy_buffer_above_reserve = round2_(ROLLING_DP_BUFFER_ABOVE_RESERVE_);
  /**
   * The legacy $50k monthly execution cap (`ROLLING_DP_MAX_CASH_DEPLOYMENT_MONTHLY_`)
   * no longer gates the canonical month-0 execute-now budget. The user-facing
   * "Cash to use now" input (bounded by `deployable_max_calculated`) is now the
   * effective limit. We still surface the legacy constant as
   * `legacy_monthly_execution_cap` for audit/debug only.
   */
  cashPolicyModel.legacy_monthly_execution_cap = round2_(ROLLING_DP_MAX_CASH_DEPLOYMENT_MONTHLY_);
  cashPolicyModel.monthly_execution_cap = round2_(Number(cashPolicyModel.final_execute_now_cash) || 0);
  cashPolicyModel.executable_now_budget = round2_(Number(cashPolicyModel.final_execute_now_cash) || 0);
  /**
   * Canonical single source of truth for month-0 deployable cash.
   * month0_execute_now_budget = final_execute_now_cash (calculated-reserve / buffer /
   * near-term / unmapped holds already subtracted). Allocator, summary, liquidity,
   * decision box, and snapshot footers all resolve to this value; the user-entered
   * "Cash to use now" is clamped to this ceiling by the dashboard.
   */
  cashPolicyModel.month0_execute_now_budget = cashPolicyModel.executable_now_budget;
  (cashPolicyModel.cash_bridge_validation_warnings || []).forEach(function(w) {
    if (w) keyWarnings.push('Cash bridge: ' + w);
  });
  /** Total policy-usable cash (pre–reserve/buffer/planned holds) — replaces legacy 85% liquid haircut. */
  const availableCash = round2_(cashPolicyModel.total_usable_cash);
  /** Simulator starting envelope: usable after sheet holds only; reserve + buffer still applied inside simulateRollingMonths_. */
  const availableCashForSim = round2_(
    Math.max(0, cashPolicyModel.total_usable_cash - plannedLiquidityHolds)
  );

  const debtSheetAnchorSnapshot = snapshotDebtsForActionPlan_(
    debts.map(function(d) {
      return JSON.parse(JSON.stringify(d));
    })
  );

  const sim = simulateRollingMonths_({
    aliasMap: aliasMap,
    anchorDate: anchorDate,
    anchorHeader: anchorHeader,
    debts: plannedExpenseModel.debts_for_sim,
    forward: forward,
    incomeSplitAnchor: incomeSplit,
    anchorNorm: anchorNorm,
    anchorExpensePositive: anchorExpensePositive,
    availableCashStart: availableCashForSim,
    displayTotalCash: availableCash,
    nearTermPlannedCashTotal: plannedExpenseModel.near_term_cash_total,
    unmappedCardFundedCashRiskTotal: plannedExpenseModel.unmapped_card_funded_cash_risk_total,
    reserveTarget: ROLLING_DP_RESERVE_DEFAULT_,
    bufferAboveReserve: ROLLING_DP_BUFFER_ABOVE_RESERVE_,
    maxCashDeploymentMonthly: ROLLING_DP_MAX_CASH_DEPLOYMENT_MONTHLY_,
    month0ExecuteNowBudget: cashPolicyModel.month0_execute_now_budget,
    planInvalid: planInvalidEarly,
    liquidTotal: liquidTotal,
    tz: tz,
    debtStart: plannedExpenseModel.debt_start_adjusted,
    plannedUnmappedNearTermCard: !!plannedExpenseModel.has_unmapped_near_term_card,
    plannedNearTermCardWithin30: !!plannedExpenseModel.near_term_card_funded_within_30,
    userCashPreservationMonth: false,
    modelingUnmappedCardAssumption: String(plannedExpenseModel.modeling_unmapped_card_assumption || ''),
    executionPlanAggressiveAlloc: executionPlanModesList.indexOf('aggressive') >= 0,
    debtSheetAnchorSnapshot: debtSheetAnchorSnapshot
  });

  if (sim.next12 && sim.next12[0]) {
    sim.next12[0].cash_policy_pools = cashPolicyModel;
    const ls0 = sim.next12[0].liquidity_summary;
    const budget0 = round2_(Number(cashPolicyModel.month0_execute_now_budget) || 0);
    if (ls0) {
      /**
       * The simulator seeds `liquidity_summary` for month 0 using its own
       * `reserveTarget` / `bufferAboveReserve` inputs, which are still the legacy
       * planner constants (ROLLING_DP_RESERVE_DEFAULT_ / ROLLING_DP_BUFFER_ABOVE_RESERVE_)
       * so forward-month cash-floor protection keeps working. But for MONTH 0 the
       * canonical source of truth is the SYS - Accounts policy model: Reserve is the
       * DO_NOT_TOUCH balance total, Buffer is the per-account Min Buffer total, and
       * Deployable max / Execute-now budget are derived directly from those values
       * plus the near-term and unmapped-card-risk holds. We overwrite the legacy
       * fields here so no downstream consumer (buildThisMonthPlan_, mappers,
       * diagnostics) can accidentally re-subtract the legacy $100k / $100k on top
       * of the calculated values. Legacy constants remain accessible via
       * `cash_policy_pools.legacy_reserve_target` / `legacy_buffer_above_reserve`
       * and via the simulator's forward-month rows for audit only.
       */
      const calcReserveLs0 = round2_(Number(cashPolicyModel.calculated_reserve) || 0);
      const calcBufferLs0 = round2_(Number(cashPolicyModel.calculated_buffer) || 0);
      const nearTermLs0 = round2_(Number(cashPolicyModel.near_term_planned_cash_hold) || 0);
      const unmappedLs0 = round2_(Number(cashPolicyModel.unmapped_card_risk_hold) || 0);
      const deployableMaxLs0 = round2_(Number(cashPolicyModel.deployable_max_calculated) || 0);
      ls0.reserve_target = calcReserveLs0;
      ls0.buffer_above_reserve = calcBufferLs0;
      ls0.near_term_planned_cash_reserved = nearTermLs0;
      ls0.unmapped_card_funded_cash_risk = unmappedLs0;
      ls0.deployable_cash = deployableMaxLs0;
      ls0.deployable_cash_after_protections = deployableMaxLs0;
      ls0.month0_execute_now_budget = budget0;
      if (
        ls0.cash_available_for_extra_debt_today != null &&
        ls0.cash_available_for_extra_debt_today === ls0.cash_available_for_extra_debt_today
      ) {
        ls0.cash_available_for_extra_debt_today = round2_(
          Math.min(round2_(ls0.cash_available_for_extra_debt_today), budget0)
        );
      }
    }
    const auditWarnings =
      (sim.next12[0].allocation_audit && sim.next12[0].allocation_audit.warnings) || [];
    auditWarnings.forEach(function(w) {
      if (w) keyWarnings.push('Allocation audit: ' + w);
    });
  }

  const endingDebt84 = sim.longRange.length ? sim.longRange[sim.longRange.length - 1].ending_total_debt : sim.debtStart;
  const projectedDebtReduction84 = round2_(sim.debtStart - endingDebt84);

  let planStatus = 'OK';
  if (invalidProjection || trulyEmpty) {
    planStatus = 'INVALID';
  } else if (!stableMatchSucceeded && hasIncomeCf) {
    planStatus = 'INVALID';
  } else if (stableNumericAggregationError) {
    planStatus = 'INVALID';
  } else if (stableMatchSucceeded && Math.abs(fwdStable) < 0.005) {
    planStatus = 'INVALID';
  } else if (triggers.some(function(t) { return t.level === 'WARN' || t.level === 'ALERT'; })) {
    planStatus = 'NEEDS_REVIEW';
  }

  const planUnreliable =
    invalidProjection ||
    trulyEmpty ||
    (!stableMatchSucceeded && hasIncomeCf) ||
    !!stableNumericAggregationError ||
    (stableMatchSucceeded && Math.abs(fwdStable) < 0.005);
  const overallConfidence = computeOverallPlanConfidence_(ccMeta, irregularNote, forward, planUnreliable);

  let currentFocus = 'Maintain reserve and minimums; verify forward income/expense medians';
  if (invalidProjection || trulyEmpty) {
    currentFocus = 'Fix Cash Flow classification/history before relying on this projection';
  } else if (!stableMatchSucceeded && hasIncomeCf) {
    currentFocus = 'Map stable income payees in Cash Flow to the exact Cisco + rent list (see diagnostics)';
  } else if (stableNumericAggregationError) {
    currentFocus = 'Stable payee cells may be unparsed or mis-aggregated — see stable_income_parsing_samples and monthly debug table';
  } else if (stableMatchSucceeded && Math.abs(fwdStable) < 0.005 && history.length >= 24) {
    currentFocus = 'Stable payees matched but forward stable income is ~0 across 24 months — verify amounts and month columns';
  } else if (stableMatchSucceeded && Math.abs(fwdStable) < 0.005) {
    currentFocus = 'Stable payees matched but projected stable income is ~0 — verify month cells and parsing';
  } else if (Math.abs(fwdStable) < 0.005 || Math.abs(fwdExpPos) < 0.005) {
    currentFocus = 'Validate stable payees (Cisco + rent list) and expense columns';
  } else if (forward.expenseConfidence === 'LOW' || irregularNote.irregular_payees_this_month > 0 || (ccMeta.spikes && ccMeta.spikes.length)) {
    currentFocus =
      'Expense baseline has advisory noise (low confidence, irregular payees, and/or card spike signals) — forward extras are directional; execution-now steps still follow THIS MONTH EXECUTION PLAN.';
  }

  const propertyWatchlist = buildPropertyWatchlist_(history, aliasMap);

  if (sim.next12 && sim.next12.length) {
    sim.next12[0].anchor_cf_paid_by_debt = buildAnchorMonthCfPaidByDebtName_(
      anchorEntry.rows,
      anchorEntry.monthHeader,
      debts,
      aliasMap
    );
    sim.next12[0].planned_expense_impact = {
      display_lines: plannedExpenseModel.display_lines,
      near_term_cash_total: plannedExpenseModel.near_term_cash_total,
      unmapped_card_funded_cash_risk_total: plannedExpenseModel.unmapped_card_funded_cash_risk_total,
      near_term_card_funded_mapped_total: plannedExpenseModel.near_term_card_funded_mapped_total,
      has_mid_term: plannedExpenseModel.has_mid_term,
      has_unmapped_near_term_card: !!plannedExpenseModel.has_unmapped_near_term_card,
      near_term_card_funded_within_30: !!plannedExpenseModel.near_term_card_funded_within_30,
      modeling_unmapped_card_assumption: String(plannedExpenseModel.modeling_unmapped_card_assumption || ''),
      warnings: plannedExpenseModel.warnings || []
    };
  }

  buildRollingMonthlyActionPlan_(sim.next12, {
    reserveTarget: ROLLING_DP_RESERVE_DEFAULT_,
    plan_invalid: planStatus === 'INVALID',
    debts: debts
  });

  const row0 = sim.next12 && sim.next12.length ? sim.next12[0] : {};
  const thisMonthPlan = buildThisMonthPlan_(
    row0,
    keyWarnings,
    ROLLING_DP_RESERVE_DEFAULT_,
    planStatus === 'INVALID',
    ROLLING_DP_LUMP_DEBT_,
    ROLLING_DP_LUMP_RESERVE_,
    ROLLING_DP_LUMP_FLEX_,
    forward.expenseConfidence === 'LOW',
    debts
  );
  if (plannedExpenseModel.has_mid_term) {
    thisMonthPlan.context_notes = (thisMonthPlan.context_notes || []).concat([
      'Mid-term planned expenses are due within 90 days after anchor month-end — they may reduce available cash for debt extras in upcoming months.'
    ]);
  }
  if (plannedExpenseModel.has_unmapped_near_term_card) {
    thisMonthPlan.context_notes = (thisMonthPlan.context_notes || []).concat([
      'Unmapped card-funded expense is being treated as cash risk until mapped.'
    ]);
  }
  if (plannedExpenseModel.display_lines && plannedExpenseModel.display_lines.length) {
    thisMonthPlan.planned_expense_lines = plannedExpenseModel.display_lines;
  }
  let anchorBasisNote = '';
  if (anchor.anchor_future_only_no_data_through_current_month) {
    anchorBasisNote =
      'Anchor month is a future Cash Flow column because no month through the current calendar month has income/expense data. Populate recent months so the plan reflects where you are now.';
  } else if (anchor.anchor_capped_to_current_month) {
    anchorBasisNote =
      'A newer Cash Flow column existed for a future month, but the plan uses the latest month on or before the current calendar month.';
  }
  if (anchorBasisNote) {
    thisMonthPlan.context_notes = [anchorBasisNote].concat(thisMonthPlan.context_notes || []);
  }
  if (includeDebugDetails && cashPolicyModel.account_cash_policy_debug) {
    thisMonthPlan.account_cash_policy_debug = cashPolicyModel.account_cash_policy_debug;
  }
  const next3Preview = buildNext3MonthPreview_(sim.next12, ROLLING_DP_RESERVE_DEFAULT_);
  const execPlanOut = buildThisMonthExecutionPlanText_(row0, planStatus === 'INVALID', {
    overall_confidence: overallConfidence.label,
    next_3_month_preview: next3Preview,
    execution_plan_mode: executionPlanMode,
    include_debug_details: includeDebugDetails
  });
  let thisMonthExecutionPlan = execPlanOut.text;
  if (sim.next12 && sim.next12.length && execPlanOut.interest_allocation_execution_ok != null) {
    sim.next12[0].allocation_interest_optimized = !!execPlanOut.interest_allocation_execution_ok;
  }
  if (execPlanOut.failed_checks && execPlanOut.failed_checks.length) {
    execPlanOut.failed_checks.forEach(function(fc) {
      if (!fc) return;
      if (rollingExecutionPlanFailureIsBlocking_(fc)) {
        keyWarnings.push('Execution plan check: ' + fc);
        if (planStatus === 'OK') {
          planStatus = 'PARTIALLY_VALID';
        }
      }
    });
  }
  thisMonthExecutionPlan = finalizeRollingExecutionPlanText_(
    thisMonthExecutionPlan,
    planStatus,
    execPlanOut.failed_checks,
    keyWarnings
  );
  thisMonthExecutionPlan = appendRollingExecutionPlanOptionalModes_(thisMonthExecutionPlan, executionPlanMode);
  if (executionPlanModesList.indexOf('automation') >= 0) {
    thisMonthExecutionPlan = thisMonthExecutionPlan.replace(/ — /g, ' - ').replace(/—/g, '-');
  }
  const actionDecisionBox = buildActionDecisionBox_(row0, ROLLING_DP_RESERVE_DEFAULT_, planStatus === 'INVALID');
  const recurringBaselineValidation = buildRecurringBaselineValidation_(
    forward,
    sim.next12,
    ROLLING_DP_RESERVE_DEFAULT_
  );

  const executionPlanSoftChecks = (execPlanOut.failed_checks || []).filter(function(fc) {
    return fc && !rollingExecutionPlanFailureIsBlocking_(fc);
  });

  const summaryPayload = {
    plan_status: planStatus,
    overall_confidence: overallConfidence.label,
    execution_plan_mode: executionPlanMode || '',
    anchor_month: formatMonthIso_(anchorDate, tz),
    anchor_capped_to_current_month: !!anchor.anchor_capped_to_current_month,
    anchor_future_only_no_data_through_current_month: !!anchor.anchor_future_only_no_data_through_current_month,
    starting_available_cash: availableCash,
    cash_availability: {
      liquid_total_sheet: cashPolicyModel.liquid_total_sheet,
      do_not_touch_excluded_cash: cashPolicyModel.do_not_touch_excluded_cash,
      unsupported_policy_balance_total: cashPolicyModel.unsupported_policy_balance_total,
      policy_eligible_cash_before_buffers: cashPolicyModel.policy_eligible_cash_before_buffers,
      policy_scoped_balance_total: cashPolicyModel.policy_scoped_balance_total,
      account_min_buffers_total: cashPolicyModel.account_min_buffers_total,
      total_usable_cash: cashPolicyModel.total_usable_cash,
      bridge_linear_subtotal_after_buffers: cashPolicyModel.bridge_linear_subtotal_after_buffers,
      bridge_per_account_floor_delta: cashPolicyModel.bridge_per_account_floor_delta,
      reserve_hold: cashPolicyModel.reserve_hold,
      global_buffer_hold: cashPolicyModel.global_buffer_hold,
      legacy_reserve_target: cashPolicyModel.legacy_reserve_target,
      legacy_buffer_above_reserve: cashPolicyModel.legacy_buffer_above_reserve,
      calculated_reserve: cashPolicyModel.calculated_reserve,
      calculated_buffer: cashPolicyModel.calculated_buffer,
      reserve_account_count: cashPolicyModel.reserve_account_count,
      buffer_account_count: cashPolicyModel.buffer_account_count,
      reserve_source: cashPolicyModel.reserve_source,
      buffer_source: cashPolicyModel.buffer_source,
      deployable_max_calculated: cashPolicyModel.deployable_max_calculated,
      near_term_planned_cash_hold: cashPolicyModel.near_term_planned_cash_hold,
      unmapped_card_risk_hold: cashPolicyModel.unmapped_card_risk_hold,
      final_execute_now_cash: cashPolicyModel.final_execute_now_cash,
      monthly_execution_cap: cashPolicyModel.monthly_execution_cap,
      executable_now_budget: cashPolicyModel.executable_now_budget,
      month0_execute_now_budget: cashPolicyModel.month0_execute_now_budget,
      debt_preferred_cash: cashPolicyModel.debt_preferred_cash,
      bills_available_cash: cashPolicyModel.bills_available_cash,
      caution_cash: cashPolicyModel.caution_cash,
      debt_preferred_cash_raw: cashPolicyModel.debt_preferred_cash_raw,
      bills_available_cash_raw: cashPolicyModel.bills_available_cash_raw,
      caution_cash_raw: cashPolicyModel.caution_cash_raw,
      liquid_reconciliation_delta: cashPolicyModel.liquid_reconciliation_delta,
      cash_bridge_validation_warnings: (cashPolicyModel.cash_bridge_validation_warnings || []).slice()
    },
    near_term_planned_cash_reserved: plannedExpenseModel.near_term_cash_total,
    unmapped_card_funded_cash_risk: plannedExpenseModel.unmapped_card_funded_cash_risk_total,
    near_term_card_funded_mapped_total: plannedExpenseModel.near_term_card_funded_mapped_total,
    reserve_target: ROLLING_DP_RESERVE_DEFAULT_,
    starting_total_debt: sim.debtStart,
    projected_total_debt_84m: endingDebt84,
    projected_debt_reduction_84m: projectedDebtReduction84,
    current_focus: currentFocus
  };

  const fullRollingPayload = {
    generated_at: new Date().toISOString(),
    summary: summaryPayload,
    key_warnings: keyWarnings,
    this_month_plan: thisMonthPlan,
    this_month_execution_plan: thisMonthExecutionPlan,
    planned_expense_impact: {
      near_term_cash_reserved: plannedExpenseModel.near_term_cash_total,
      unmapped_card_funded_cash_risk: plannedExpenseModel.unmapped_card_funded_cash_risk_total,
      near_term_card_funded_mapped_total: plannedExpenseModel.near_term_card_funded_mapped_total,
      display_lines: plannedExpenseModel.display_lines,
      has_mid_term: plannedExpenseModel.has_mid_term,
      has_long_term: plannedExpenseModel.has_long_term,
      has_unmapped_near_term_card: !!plannedExpenseModel.has_unmapped_near_term_card,
      near_term_card_funded_within_30: !!plannedExpenseModel.near_term_card_funded_within_30,
      modeling_unmapped_card_assumption: String(plannedExpenseModel.modeling_unmapped_card_assumption || ''),
      warnings: plannedExpenseModel.warnings || []
    },
    action_decision_box: actionDecisionBox,
    next_3_month_preview: next3Preview,
    recurring_baseline_audit:
      forward.recurringExpenseModel && forward.recurringExpenseModel.baseline_audit
        ? forward.recurringExpenseModel.baseline_audit
        : null,
    recurring_baseline_adjustment_rollups:
      (forward.recurringExpenseModel && forward.recurringExpenseModel.baseline_adjustment_rollups) || null,
    recurring_baseline_validation: recurringBaselineValidation,
    next_12_months: sim.next12,
    yearly_projection: sim.yearlyProjection,
    debt_priority: [
      'Credit cards (highest APR first)',
      'HELOC',
      'Lake Tahoe mortgage',
      'San Diego mortgage',
      'MO mortgage',
      'San Jose mortgage last'
    ],
    property_watchlist: propertyWatchlist,
    assumptions: {
      reserve_target: ROLLING_DP_RESERVE_DEFAULT_,
      cash_model: 'SYS_ACCOUNTS_POLICY_ORDERED',
      cash_haircut: 1,
      lump_sum_split: {
        debt: ROLLING_DP_LUMP_DEBT_,
        reserve: ROLLING_DP_LUMP_RESERVE_,
        flexible: ROLLING_DP_LUMP_FLEX_
      },
      rsu_baseline_included: false,
      reserved_buckets_tracked: reservedBucketsTracked,
      anchor_sheet_month_header: anchorHeader
    },
    confidence: {
      overall: overallConfidence.label,
      income_projection: forward.incomeConfidence || 'LOW',
      expense_projection: forward.expenseConfidence || 'LOW',
      credit_card_spend: ccMeta.confidence,
      debt_balances: 'MEDIUM',
      rental_income: 'MEDIUM'
    },
    payee_debug_rows: payeeDebugRows,
    diagnostics: Object.assign({}, forward.diagnostics, {
      cash_policy_pools: {
        liquid_total_sheet: cashPolicyModel.liquid_total_sheet,
        do_not_touch_excluded_cash: cashPolicyModel.do_not_touch_excluded_cash,
        policy_eligible_cash_before_buffers: cashPolicyModel.policy_eligible_cash_before_buffers,
        account_min_buffers_total: cashPolicyModel.account_min_buffers_total,
        total_usable_cash: cashPolicyModel.total_usable_cash,
        reserve_hold: cashPolicyModel.reserve_hold,
        global_buffer_hold: cashPolicyModel.global_buffer_hold,
        legacy_reserve_target: cashPolicyModel.legacy_reserve_target,
        legacy_buffer_above_reserve: cashPolicyModel.legacy_buffer_above_reserve,
        calculated_reserve: cashPolicyModel.calculated_reserve,
        calculated_buffer: cashPolicyModel.calculated_buffer,
        reserve_account_count: cashPolicyModel.reserve_account_count,
        buffer_account_count: cashPolicyModel.buffer_account_count,
        reserve_source: cashPolicyModel.reserve_source,
        buffer_source: cashPolicyModel.buffer_source,
        deployable_max_calculated: cashPolicyModel.deployable_max_calculated,
        near_term_planned_cash_hold: cashPolicyModel.near_term_planned_cash_hold,
        unmapped_card_risk_hold: cashPolicyModel.unmapped_card_risk_hold,
        final_execute_now_cash: cashPolicyModel.final_execute_now_cash,
        monthly_execution_cap: cashPolicyModel.monthly_execution_cap,
        executable_now_budget: cashPolicyModel.executable_now_budget,
        month0_execute_now_budget: cashPolicyModel.month0_execute_now_budget,
        debt_preferred_cash_raw: cashPolicyModel.debt_preferred_cash_raw,
        bills_available_cash_raw: cashPolicyModel.bills_available_cash_raw,
        caution_cash_raw: cashPolicyModel.caution_cash_raw,
        cash_bridge_validation_warnings: (cashPolicyModel.cash_bridge_validation_warnings || []).slice(),
        execution_order_note: cashPolicyModel.execution_order_note
      },
      statement_balance_tracking: ccMeta.statement_balance_tracking,
      reserved_buckets_tracked: reservedBucketsTracked,
      history_months_loaded: history.length,
      history_truly_empty: trulyEmpty,
      matched_stable_payee_count: matchedStablePayeeCount,
      stable_non_empty_income_months_count: stableNonEmptyMonthCount,
      stable_match_succeeded: stableMatchSucceeded,
      first_month_cash_identity_residual:
        sim.next12 && sim.next12[0] && sim.next12[0].cash_identity_residual != null
          ? sim.next12[0].cash_identity_residual
          : null,
      expense_baseline: {
        irregular_payees_anchor_month_count: irregularNote.irregular_payees_this_month,
        irregular_anchor_payees: irregularNote.irregular_anchor_payees || [],
        expense_projection_confidence: forward.expenseConfidence || 'LOW',
        credit_card_spike_signals: (ccMeta.spikes && ccMeta.spikes.length) || 0,
        recurring_baseline_note: irregularNote.note,
        irregular_categories_flagged_separately: true,
        recurring_expense_forward: (forward.recurringExpenseModel && forward.recurringExpenseModel.recurring_expense_forward) || 0,
        debt_cleanup_excluded_monthly_avg:
          (forward.recurringExpenseModel && forward.recurringExpenseModel.debt_cleanup_excluded_monthly_avg) || 0,
        irregular_excluded_monthly_avg:
          (forward.recurringExpenseModel && forward.recurringExpenseModel.irregular_excluded_monthly_avg) || 0,
        top_recurring_payees_included:
          (forward.recurringExpenseModel && forward.recurringExpenseModel.top_recurring_payees_included) || [],
        top_excluded_debt_cleanup_payees:
          (forward.recurringExpenseModel && forward.recurringExpenseModel.top_excluded_debt_cleanup_payees) || [],
        top_excluded_irregular_payees:
          (forward.recurringExpenseModel && forward.recurringExpenseModel.top_excluded_irregular_payees) || [],
        baseline_audit:
          (forward.recurringExpenseModel && forward.recurringExpenseModel.baseline_audit) || null,
        recurring_baseline_adjustment_rollups:
          (forward.recurringExpenseModel && forward.recurringExpenseModel.baseline_adjustment_rollups) || null,
        recurring_baseline_adjustment_flags:
          (forward.recurringExpenseModel && forward.recurringExpenseModel.adjustment_flags) || null,
        recurring_baseline_validation: recurringBaselineValidation
      }
    }),
    _legacy_triggers: triggers,
    _legacy_credit_card_context: ccMeta,
    execution_plan_soft_checks: executionPlanSoftChecks
  };

  const defaultOutput = buildRollingDefaultOutput_(
    summaryPayload,
    thisMonthPlan,
    actionDecisionBox,
    next3Preview,
    keyWarnings
  );

  if (!includeDebugDetails) {
    const slim = slimRollingDebtPayoffForDefault_(fullRollingPayload, defaultOutput, {
      // Prefer the merged history+bills payload (Part 6); fall back to the
      // pure history payload when Bills has no Payment Source column. The
      // `card_spend` contract is identical so the React mapper is unchanged.
      cardSpend: helocCombinedCardSpend || helocFlowSourceCardSpend,
      cardSpendDebug: helocFlowSourceDebug
    });
    // Expose the debug block at the top level of the slim payload so the
    // dashboard can render it without hunting through nested rows.
    if (slim && typeof slim === 'object') {
      slim.heloc_flow_source_debug = helocFlowSourceDebug;
    }
    return slim;
  }

  fullRollingPayload.default_output = defaultOutput;
  fullRollingPayload.include_debug_details = true;
  // Mirror the HELOC realism block onto the first forward month so the debug
  // payload (non-slim path) also surfaces the Flow-Source-derived card spend
  // through the same `heloc_advisor_snapshot.card_spend` contract the
  // dashboard mapper already reads.
  if (
    Array.isArray(fullRollingPayload.next_12_months) &&
    fullRollingPayload.next_12_months[0] &&
    typeof fullRollingPayload.next_12_months[0] === 'object'
  ) {
    const firstForward = fullRollingPayload.next_12_months[0];
    const snap =
      (firstForward.heloc_advisor_snapshot &&
        typeof firstForward.heloc_advisor_snapshot === 'object' &&
        firstForward.heloc_advisor_snapshot) ||
      {};
    const mergedCardSpendForDebug = helocCombinedCardSpend || helocFlowSourceCardSpend;
    if (mergedCardSpendForDebug) {
      snap.card_spend = mergedCardSpendForDebug;
    }
    // Always attach the debug block — even when card_spend is null — so the
    // user can see *why* the advisor fell back to legacy behavior.
    snap.card_spend_debug = helocFlowSourceDebug;
    firstForward.heloc_advisor_snapshot = snap;
  }
  fullRollingPayload.heloc_flow_source_debug = helocFlowSourceDebug;
  return fullRollingPayload;
}

function formatMonthIso_(d, tz) {
  return Utilities.formatDate(d, tz, 'yyyy-MM');
}

function findRollingCashFlowAnchor_(ss) {
  const y0 = getCurrentYear_();
  const now = new Date();
  const yCur = now.getFullYear();
  const moCur = now.getMonth();
  const lastMomentCurrentMonth = new Date(yCur, moCur + 1, 0, 23, 59, 59, 999);

  let bestTime = -1;
  let bestHeader = '';
  let bestYear = y0;
  let bestDate = null;

  let bestTimeOnOrBefore = -1;
  let bestHeaderOnOrBefore = '';
  let bestYearOnOrBefore = y0;
  let bestDateOnOrBefore = null;

  for (let yr = y0 - 2; yr <= y0 + 1; yr++) {
    const sh = ss.getSheetByName(getCashFlowSheetName_(yr));
    if (!sh) continue;

    let rows;
    try {
      rows = readCashFlowSheetAsObjects_(ss, yr);
    } catch (e) {
      continue;
    }
    if (!rows.length) continue;

    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0] || [];

    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c] || '').trim();
      const parsed = parseMonthHeader_(h);
      if (!parsed) continue;

      let hasData = false;
      for (let r = 0; r < rows.length; r++) {
        const typ = String(rows[r].Type || '')
          .trim()
          .toUpperCase();
        if (typ !== 'INCOME' && typ !== 'EXPENSE') continue;
        let v = rows[r][h];
        if (v === '' || v === null) {
          v = rows[r]['__display__' + h];
        }
        if (v !== '' && v !== null && String(v).trim() !== '') {
          hasData = true;
          break;
        }
      }
      if (!hasData) continue;

      const t = parsed.getTime();
      if (t > bestTime) {
        bestTime = t;
        bestHeader = h;
        bestYear = yr;
        bestDate = parsed;
      }
      if (t <= lastMomentCurrentMonth.getTime() && t > bestTimeOnOrBefore) {
        bestTimeOnOrBefore = t;
        bestHeaderOnOrBefore = h;
        bestYearOnOrBefore = yr;
        bestDateOnOrBefore = parsed;
      }
    }
  }

  if (!bestDate || !bestHeader) {
    throw new Error('Could not find a Cash Flow month column with data.');
  }

  const capped =
    bestDateOnOrBefore != null &&
    bestHeaderOnOrBefore &&
    bestTime > lastMomentCurrentMonth.getTime();
  if (capped) {
    bestDate = bestDateOnOrBefore;
    bestHeader = bestHeaderOnOrBefore;
    bestYear = bestYearOnOrBefore;
  }

  const anchorFutureOnlyNoDataThroughCurrentMonth =
    (bestDateOnOrBefore == null || !bestHeaderOnOrBefore) && bestTime > lastMomentCurrentMonth.getTime();

  return {
    header: bestHeader,
    date: bestDate,
    sheetYear: bestYear,
    anchor_capped_to_current_month: capped,
    anchor_future_only_no_data_through_current_month: anchorFutureOnlyNoDataThroughCurrentMonth
  };
}

function addMonthsFirst_(d, delta) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function formatCfMonthHeader_(d, tz) {
  return Utilities.formatDate(d, tz, 'MMM-yy');
}

function buildRollingCfHistory_(ss, anchorDate, monthsBack, aliasMap) {
  const tz = Session.getScriptTimeZone();
  const out = [];

  for (let k = -monthsBack; k <= 0; k++) {
    const d = addMonthsFirst_(anchorDate, k);
    const y = d.getFullYear();
    const hdr = formatCfMonthHeader_(d, tz);
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(getCashFlowSheetName_(y));
    if (!sh) continue;
    let rows;
    try {
      rows = readCashFlowSheetAsObjects_(ss, y);
    } catch (e) {
      continue;
    }
    const monthHasCfData = monthHasAnyCfRowPresent_(rows, hdr);
    const normalized = normalizeCashFlow_(rows, hdr, aliasMap);
    out.push({
      monthHeader: hdr,
      monthDate: d,
      rows: rows,
      monthHasCfData: monthHasCfData,
      normalized: normalized
    });
  }

  return out;
}

/**
 * Legacy: dense matrix of expenses (zeros for missing). Prefer buildAlignedPayeeExpensesNullable_.
 */
function buildAlignedPayeeExpenses_(history, aliasMap) {
  const keys = collectAllExpensePayeeKeys_(history, aliasMap);
  const matrix = buildAlignedPayeeExpensesNullable_(history, keys, aliasMap);
  const dense = Object.create(null);
  keys.forEach(function(p) {
    dense[p] = matrix[p].map(function(v) {
      return v == null ? 0 : v;
    });
  });
  return dense;
}

function mortgageBucketRank_(d) {
  if (d.priorityClass === 'LOW_RATE_KEEP_LAST') return 99;
  const n = (String(d.originalName) + ' ' + String(d.name)).toLowerCase();
  const t = String(d.type || '').trim();
  if (t === 'HELOC' || n.indexOf('heloc') >= 0) return 1;
  if (n.indexOf('tahoe') >= 0) return 2;
  if (n.indexOf('san diego') >= 0) return 3;
  if (n.indexOf('missouri') >= 0 || /\bmo\b/.test(n) || n.indexOf('kansas city') >= 0) return 4;
  if (n.indexOf('san jose') >= 0) return 5;
  return 50;
}

function sortActiveDebtLikeWaterfall_(active) {
  const smallCap = ROLLING_DP_EXEC_PLAN_SMALL_BALANCE_SNOWBALL_MAX_;
  const smallCards = active
    .filter(function(d) {
      return String(d.type).trim() === 'Credit Card' && d.balance <= smallCap + 0.005;
    })
    .sort(function(a, b) {
      return a.balance - b.balance;
    });
  const bigCards = active
    .filter(function(d) {
      return String(d.type).trim() === 'Credit Card' && d.balance > smallCap + 0.005;
    })
    .sort(function(a, b) {
      return b.interestRate - a.interestRate;
    });
  const cards = smallCards.concat(bigCards);
  const nonCards = active
    .filter(function(d) {
      return String(d.type).trim() !== 'Credit Card';
    })
    .sort(function(a, b) {
      const ra = mortgageBucketRank_(a);
      const rb = mortgageBucketRank_(b);
      if (ra !== rb) return ra - rb;
      return b.interestRate - a.interestRate;
    });
  return cards.concat(nonCards);
}

function sortDebtsWaterfall_(debts) {
  const active = debts
    .filter(function(d) {
      return d.balance > 0.005;
    })
    .map(function(d) {
      return JSON.parse(JSON.stringify(d));
    });
  return sortActiveDebtLikeWaterfall_(active);
}

function applyDebtPayment_(d, extraPrincipal) {
  extraPrincipal = extraPrincipal || 0;
  const r = (Number(d.interestRate) || 0) / 100 / 12;
  const interest = round2_(d.balance * r);
  const payment = round2_(d.minimumPayment + extraPrincipal);
  d.balance = round2_(Math.max(0, d.balance + interest - payment));
}

/** Max extra principal (above minimum) that can be applied this month without overpaying. */
function rollingDebtExtraPayoffCap_(d) {
  const r = (Number(d.interestRate) || 0) / 100 / 12;
  const interest = round2_(d.balance * r);
  return Math.max(0, round2_(d.balance + interest - d.minimumPayment));
}

/** Balance/residual threshold: treat as paid off for waterfall gating and dust closure. */
var ROLLING_WF_ZERO_BAL_ = 0.01;
var ROLLING_WF_POOL_EPS_ = 1e-9;

/** Extra principal headroom using full-precision balance (avoids penny traps vs round2_ caps). */
function rollingDebtExtraPayoffCapHp_(d) {
  if (!d || d.active === false) return 0;
  const bal = Number(d.balance) || 0;
  if (bal <= ROLLING_WF_POOL_EPS_) return 0;
  const r = (Number(d.interestRate) || 0) / 100 / 12;
  const interest = bal * r;
  const minp = Number(d.minimumPayment) || 0;
  return Math.max(0, bal + interest - minp);
}

/** Apply extra principal with high-precision balance update; force-close dust <= ROLLING_WF_ZERO_BAL_. */
function rollingApplyExtraPrincipalHp_(d, extra) {
  extra = Math.max(0, Number(extra) || 0);
  if (extra <= ROLLING_WF_POOL_EPS_) return;
  const bal = Number(d.balance) || 0;
  const r = (Number(d.interestRate) || 0) / 100 / 12;
  const interest = bal * r;
  const minp = Number(d.minimumPayment) || 0;
  let newBal = bal + interest - minp - extra;
  if (newBal <= ROLLING_WF_ZERO_BAL_) {
    d.balance = 0;
  } else {
    d.balance = round2_(Math.max(0, newBal));
  }
}

/**
 * Post-cleanup: primary_allocation = round(f×R), secondary_allocation = R − primary_allocation (f default 0.75);
 * apply to top two APR targets only, then sweep any cap shortfall across those two until R is placed or both capped.
 */
function rollingPhase27525TwoTargets_(findDebt, addAlloc, applyDebtPayment_, P, S, R0, meta, primaryFraction) {
  const f =
    primaryFraction != null && primaryFraction === primaryFraction
      ? Math.min(0.999, Math.max(0.5, Number(primaryFraction)))
      : ROLLING_DP_PHASE2_PRIMARY_FRACTION_STANDARD_;
  meta.phase2_primary_fraction = f;
  meta.phase2_R0 = round2_(R0);
  meta.phase2_primary_name = P ? P.name : '';
  meta.phase2_secondary_name = S ? S.name : '';
  meta.phase2_primary_paid = 0;
  meta.phase2_secondary_paid = 0;
  meta.primary_majority_ok = true;
  if (R0 <= 0.005 || !P) {
    return;
  }
  const dP = findDebt(P.name);
  if (!dP || dP.balance <= 0.005) {
    return;
  }
  if (!S) {
    const capP = rollingDebtExtraPayoffCap_(dP);
    const pay = round2_(Math.min(R0, capP));
    if (pay > 0.005) {
      addAlloc(P.name, pay);
      applyDebtPayment_(dP, pay);
      meta.phase2_primary_paid = pay;
    }
    return;
  }
  const dS = findDebt(S.name);
  if (!dS || dS.balance <= 0.005) {
    const capP = rollingDebtExtraPayoffCap_(dP);
    const pay = round2_(Math.min(R0, capP));
    if (pay > 0.005) {
      addAlloc(P.name, pay);
      applyDebtPayment_(dP, pay);
      meta.phase2_primary_paid = pay;
    }
    return;
  }

  const primaryIdeal = round2_(f * R0);
  const secondaryIdeal = round2_(R0 - primaryIdeal);
  let paidP = 0;
  let paidS = 0;

  const payUpTo = function(nm, want) {
    want = round2_(want);
    if (want <= 0.005) return 0;
    const d = findDebt(nm);
    if (!d || d.balance <= 0.005) return 0;
    const cap = rollingDebtExtraPayoffCap_(d);
    const t = round2_(Math.min(want, cap));
    if (t <= 0.005) return 0;
    addAlloc(nm, t);
    applyDebtPayment_(d, t);
    return t;
  };

  paidP = payUpTo(P.name, primaryIdeal);
  const spillFromPrimary = round2_(primaryIdeal - paidP);
  const secondaryBudget = round2_(secondaryIdeal + spillFromPrimary);
  paidS = payUpTo(S.name, secondaryBudget);

  let left = round2_(R0 - paidP - paidS);
  for (let iter = 0; iter < 2000 && left > 0.005; iter++) {
    const tryP = payUpTo(P.name, left);
    if (tryP > 0.005) {
      paidP = round2_(paidP + tryP);
      left = round2_(left - tryP);
      continue;
    }
    const tryS = payUpTo(S.name, left);
    if (tryS > 0.005) {
      paidS = round2_(paidS + tryS);
      left = round2_(left - tryS);
      continue;
    }
    break;
  }

  meta.phase2_primary_paid = paidP;
  meta.phase2_secondary_paid = paidS;
}

/** Resolve a canonical CC debt label to the sheet debt `name` when present (alias-normalized). */
function rollingResolveCanonicalCcNameOnDebts_(canonical, debtsLike, aliasMap) {
  aliasMap = aliasMap || {};
  const want = normalizeName_(String(canonical || '').trim(), aliasMap);
  if (!want) return '';
  const arr = debtsLike || [];
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i];
    if (String(d.type || '').trim() !== 'Credit Card') continue;
    if (normalizeName_(String(d.name || ''), aliasMap) === want) return String(d.name || '').trim();
  }
  return '';
}

/** One dashboard row per account from waterfall trace (aggregates multi-step pays). */
function rollingBuildExecutionSnapshotFromTrace_(trace) {
  const agg = Object.create(null);
  const firstIdx = Object.create(null);
  (trace || []).forEach(function(r, idx) {
    const nm = String(r.account || '');
    if (!nm) return;
    if (firstIdx[nm] == null) firstIdx[nm] = idx;
    if (!agg[nm]) {
      agg[nm] = {
        balance_before: Number(r.balance_before) || 0,
        balance_after: Number(r.balance_after) || 0,
        phase: String(r.phase || '')
      };
    } else {
      agg[nm].balance_after = Number(r.balance_after) || 0;
    }
  });
  return Object.keys(agg)
    .sort(function(a, b) {
      return (firstIdx[a] || 0) - (firstIdx[b] || 0);
    })
    .map(function(nm) {
      const a = agg[nm];
      const before = Number(a.balance_before) || 0;
      let after = Number(a.balance_after) || 0;
      if (after <= ROLLING_WF_ZERO_BAL_ + 1e-9) after = 0;
      const payShow = Math.max(0, before - after);
      return {
        account: nm,
        balance_before: round2_(before),
        payment_applied_now: round2_(payShow),
        balance_after_now: round2_(after),
        phase: a.phase || '',
        closed: after <= ROLLING_WF_ZERO_BAL_ + 1e-9
      };
    });
}

/**
 * Strict serial execute-now / variable waterfall: literal payoff order with high-precision caps (no parallel split).
 * @param {{ primaryPhase2Fraction?: number, aliasMap?: Object }} [opts]
 * @returns {{ allocations: Object, totalExtra: number, meta: Object, trace: Array, waterfall_validation: { pass: boolean, failures: string[], label: string } }}
 */
function rollingRunStrictExecuteWaterfall_(simDebtsSorted, pool, opts) {
  opts = opts || {};
  const aliasMap = opts.aliasMap || getAliasMap_();
  const primaryPhase2Fraction =
    opts.primaryPhase2Fraction != null && opts.primaryPhase2Fraction === opts.primaryPhase2Fraction
      ? Number(opts.primaryPhase2Fraction)
      : ROLLING_DP_PHASE2_PRIMARY_FRACTION_STANDARD_;
  const smallCap = ROLLING_DP_EXEC_PLAN_SMALL_BALANCE_SNOWBALL_MAX_;
  const allocHp = Object.create(null);
  const trace = [];
  let poolRem = Number(pool) || 0;
  const meta = {
    phase2_R0: 0,
    phase2_primary_paid: 0,
    phase2_secondary_paid: 0,
    phase2_primary_name: '',
    phase2_secondary_name: '',
    phase2_primary_fraction: primaryPhase2Fraction,
    cleanup_names: [],
    primary_majority_ok: true,
    cap_primary_at_phase2_start: 0
  };

  function findDebt(nm) {
    for (let i = 0; i < simDebtsSorted.length; i++) {
      if (simDebtsSorted[i].name === nm) return simDebtsSorted[i];
    }
    return null;
  }

  function pushTrace(phase, nm, balBefore, pay, dAfter) {
    trace.push({
      phase: phase,
      account: nm,
      balance_before: Number(balBefore) || 0,
      payment_applied: Number(pay) || 0,
      balance_after: Number(dAfter.balance) || 0,
      pool_remaining_after: round2_(poolRem),
      extra_payoff_cap_after: round2_(rollingDebtExtraPayoffCapHp_(dAfter))
    });
  }

  function paySerialOnAccount(phase, nm) {
    nm = String(nm || '').trim();
    if (!nm || poolRem <= ROLLING_WF_POOL_EPS_) return 0;
    let sumPay = 0;
    while (poolRem > ROLLING_WF_POOL_EPS_) {
      const d = findDebt(nm);
      if (!d || d.active === false) break;
      const bal = Number(d.balance) || 0;
      if (bal <= ROLLING_WF_ZERO_BAL_) break;
      const cap = rollingDebtExtraPayoffCapHp_(d);
      if (!(cap > ROLLING_WF_POOL_EPS_)) break;
      const pay = Math.min(poolRem, cap);
      if (!(pay > ROLLING_WF_POOL_EPS_)) break;
      const bb = bal;
      rollingApplyExtraPrincipalHp_(d, pay);
      poolRem -= pay;
      sumPay += pay;
      allocHp[nm] = (allocHp[nm] || 0) + pay;
      pushTrace(phase, nm, bb, pay, d);
    }
    return sumPay;
  }

  function listCCsByAprDescWf() {
    return simDebtsSorted
      .filter(function(d) {
        return (
          d.active !== false &&
          (Number(d.balance) || 0) > ROLLING_WF_ZERO_BAL_ &&
          String(d.type || '').trim() === 'Credit Card'
        );
      })
      .sort(function(a, b) {
        const ra = Number(b.interestRate) || 0;
        const rb = Number(a.interestRate) || 0;
        if (Math.abs(ra - rb) > 0.005) return ra - rb;
        return (Number(b.balance) || 0) - (Number(a.balance) || 0);
      });
  }

  function primaryBlocksSecondaries_(P) {
    if (!P) return false;
    const d = findDebt(P.name);
    if (!d) return false;
    /** Strict serial: secondaries only after primary balance is fully zero (not “extra cap exhausted” with balance left). */
    if ((Number(d.balance) || 0) > ROLLING_WF_ZERO_BAL_) return true;
    return false;
  }

  function secondarySerialChainDone_(P) {
    for (let si = 0; si < ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_.length; si++) {
      const rnm = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[si], simDebtsSorted, aliasMap);
      if (!rnm) continue;
      if (P && normalizeName_(rnm, aliasMap) === normalizeName_(P.name, aliasMap)) continue;
      const dr = findDebt(rnm);
      if (!dr) continue;
      if ((Number(dr.balance) || 0) > ROLLING_WF_ZERO_BAL_) return false;
    }
    return true;
  }

  /** Preserve sheet / waterfall debt list order (strict serial “listed order”), not balance-sorted snowball. */
  const trivial = simDebtsSorted.filter(function(d) {
    return (
      d.active !== false &&
      (Number(d.balance) || 0) > ROLLING_WF_ZERO_BAL_ &&
      String(d.type || '').trim() === 'Credit Card' &&
      (Number(d.balance) || 0) <= smallCap + ROLLING_WF_ZERO_BAL_
    );
  });

  for (let ti = 0; ti < trivial.length; ti++) {
    const nm0 = trivial[ti].name;
    const paidC = paySerialOnAccount('cleanup', nm0);
    if (paidC > ROLLING_WF_POOL_EPS_ && meta.cleanup_names.indexOf(nm0) < 0) {
      meta.cleanup_names.push(nm0);
    }
  }

  meta.phase2_R0 = round2_(Math.max(0, poolRem));
  let phase2ExtraPaid = 0;
  const snapCC = listCCsByAprDescWf();
  const P = snapCC.length ? snapCC[0] : null;

  if (!snapCC.length) {
    const rest = sortActiveDebtLikeWaterfall_(
      simDebtsSorted.filter(function(d) {
        return d.active !== false && (Number(d.balance) || 0) > ROLLING_WF_ZERO_BAL_;
      })
    );
    meta.phase2_primary_paid = 0;
    meta.phase2_secondary_paid = 0;
    for (let i = 0; i < rest.length && poolRem > ROLLING_WF_POOL_EPS_; i++) {
      const nm = rest[i].name;
      const d0 = findDebt(nm);
      if (i === 0) {
        meta.phase2_primary_name = nm;
        meta.cap_primary_at_phase2_start = d0 ? round2_(rollingDebtExtraPayoffCapHp_(d0)) : 0;
        if (rest.length > 1) meta.phase2_secondary_name = rest[1].name;
      }
      const p = paySerialOnAccount('overflow', nm);
      if (i === 0) meta.phase2_primary_paid = round2_(meta.phase2_primary_paid + p);
      else meta.phase2_secondary_paid = round2_(meta.phase2_secondary_paid + p);
    }
  } else {
    const dP0 = findDebt(P.name);
    meta.phase2_primary_name = P.name;
    meta.cap_primary_at_phase2_start = dP0 ? round2_(rollingDebtExtraPayoffCapHp_(dP0)) : 0;
    const pPri = paySerialOnAccount('primary', P.name);
    meta.phase2_primary_paid = round2_(pPri);
    phase2ExtraPaid += pPri;

    let firstSecondary = '';
    if (!primaryBlocksSecondaries_(P)) {
      for (let si = 0; si < ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_.length && poolRem > ROLLING_WF_POOL_EPS_; si++) {
        const resolved = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[si], simDebtsSorted, aliasMap);
        if (!resolved) continue;
        if (normalizeName_(resolved, aliasMap) === normalizeName_(P.name, aliasMap)) continue;
        let prevOk = true;
        for (let pj = 0; pj < si; pj++) {
          const pr = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[pj], simDebtsSorted, aliasMap);
          if (!pr || normalizeName_(pr, aliasMap) === normalizeName_(P.name, aliasMap)) continue;
          const dr = findDebt(pr);
          if (!dr) continue;
          if ((Number(dr.balance) || 0) > ROLLING_WF_ZERO_BAL_) prevOk = false;
        }
        if (!prevOk) break;
        const pS = paySerialOnAccount('secondary', resolved);
        if (pS > ROLLING_WF_POOL_EPS_ && !firstSecondary) firstSecondary = resolved;
        phase2ExtraPaid += pS;
      }
      meta.phase2_secondary_name = firstSecondary;
    }

    if (!primaryBlocksSecondaries_(P) && secondarySerialChainDone_(P) && poolRem > ROLLING_WF_POOL_EPS_) {
      const skipNorm = Object.create(null);
      if (P) skipNorm[normalizeName_(P.name, aliasMap)] = true;
      trivial.forEach(function(tc) {
        skipNorm[normalizeName_(tc.name, aliasMap)] = true;
      });
      for (let sx = 0; sx < ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_.length; sx++) {
        const r2 = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[sx], simDebtsSorted, aliasMap);
        if (r2) skipNorm[normalizeName_(r2, aliasMap)] = true;
      }
      const activeAll = simDebtsSorted.filter(function(d) {
        return d.active !== false && (Number(d.balance) || 0) > ROLLING_WF_ZERO_BAL_;
      });
      const overflowList = sortActiveDebtLikeWaterfall_(activeAll).filter(function(d) {
        return !skipNorm[normalizeName_(d.name, aliasMap)];
      });
      for (let oi = 0; oi < overflowList.length && poolRem > ROLLING_WF_POOL_EPS_; oi++) {
        phase2ExtraPaid += paySerialOnAccount('overflow', overflowList[oi].name);
      }
    }
    meta.phase2_secondary_paid = round2_(Math.max(0, phase2ExtraPaid - meta.phase2_primary_paid));
  }

  const alloc = Object.create(null);
  let totalExtra = 0;
  Object.keys(allocHp).forEach(function(k) {
    const v = round2_(allocHp[k]);
    if (v > 0.005) {
      alloc[k] = v;
      totalExtra = round2_(totalExtra + v);
    }
  });

  const failures = rollingWaterfallTraceValidationFailures_(trace, alloc, trivial, P, aliasMap, simDebtsSorted, pool);
  const pass = failures.length === 0;
  const waterfall_validation = {
    pass: pass,
    failures: failures,
    label: pass ? 'PASS' : 'FAIL'
  };

  return {
    allocations: alloc,
    totalExtra: totalExtra,
    meta: meta,
    trace: trace,
    waterfall_validation: waterfall_validation
  };
}

/**
 * Post-execution checks on the trace (ordering / no illegal splits).
 */
function rollingWaterfallTraceValidationFailures_(trace, alloc, trivialArr, primaryP, aliasMap, simDebtsSorted, originalPool) {
  const failures = [];
  void originalPool;
  const trivNorm = Object.create(null);
  (trivialArr || []).forEach(function(x) {
    trivNorm[normalizeName_(x.name, aliasMap)] = true;
  });
  const primaryNm = primaryP ? String(primaryP.name) : '';
  const lastAfterByAccount = Object.create(null);
  let sawSecondaryPay = false;
  let sawOverflowPay = false;
  (trace || []).forEach(function(row) {
    const nm = String(row.account || '');
    lastAfterByAccount[nm] = Number(row.balance_after) || 0;
    const ph = String(row.phase || '');
    const payRow = Number(row.payment_applied) || 0;
    if (ph === 'secondary' && payRow > 0.005) sawSecondaryPay = true;
    if (ph === 'overflow' && payRow > 0.005) sawOverflowPay = true;
  });
  (trivialArr || []).forEach(function(tc) {
    const nm = String(tc.name || '');
    if (!nm) return;
    const bal = lastAfterByAccount[nm] != null ? Number(lastAfterByAccount[nm]) || 0 : null;
    const tot = round2_(Number(alloc[nm]) || 0);
    if (tot > 0.005 && bal != null && bal > ROLLING_WF_ZERO_BAL_ + 1e-9) {
      var lastCleanup = null;
      for (var ri = 0; ri < (trace || []).length; ri++) {
        var rw = trace[ri];
        if (String(rw.account || '') === nm && String(rw.phase || '') === 'cleanup') lastCleanup = rw;
      }
      var poolNote = '';
      if (
        lastCleanup &&
        Number(lastCleanup.pool_remaining_after) > ROLLING_WF_ZERO_BAL_ &&
        Number(lastCleanup.extra_payoff_cap_after) > ROLLING_WF_POOL_EPS_
      ) {
        poolNote =
          ' Remaining execute-now pool was $' +
          String(round2_(Number(lastCleanup.pool_remaining_after))) +
          ' with positive extra-principal headroom — payoff should have closed.';
      }
      failures.push(
        'Cleanup: ' +
          nm +
          ' had payment applied but balance_after > ' +
          ROLLING_WF_ZERO_BAL_ +
          '.' +
          poolNote
      );
    }
  });

  if (sawSecondaryPay && primaryNm) {
    const balP = lastAfterByAccount[primaryNm] != null ? Number(lastAfterByAccount[primaryNm]) || 0 : 999;
    if (balP > ROLLING_WF_ZERO_BAL_) {
      failures.push(
        'Primary/secondary: secondary received funds while primary balance_after > ' + ROLLING_WF_ZERO_BAL_ + '.'
      );
    }
  }
  if (sawOverflowPay && primaryNm) {
    const balP = lastAfterByAccount[primaryNm] != null ? Number(lastAfterByAccount[primaryNm]) || 0 : 999;
    if (balP > ROLLING_WF_ZERO_BAL_) {
      failures.push(
        'Overflow: non-primary overflow received funds while primary balance_after > ' + ROLLING_WF_ZERO_BAL_ + '.'
      );
    }
  }

  const citiN = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[0], simDebtsSorted, aliasMap);
  const swN = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[1], simDebtsSorted, aliasMap);
  const marN = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[2], simDebtsSorted, aliasMap);
  function paySumFor(nm) {
    if (!nm) return 0;
    return round2_(Number(alloc[nm]) || 0);
  }
  const balCiti = citiN ? Number(lastAfterByAccount[citiN]) || 0 : 0;
  const balSw = swN ? Number(lastAfterByAccount[swN]) || 0 : 0;
  if (citiN && balCiti > ROLLING_WF_ZERO_BAL_ && (paySumFor(swN) > 0.005 || paySumFor(marN) > 0.005)) {
    failures.push('Secondary waterfall: Southwest or Marriott received funds while CitiAA balance_after > ' + ROLLING_WF_ZERO_BAL_ + '.');
  }
  if (swN && balSw > ROLLING_WF_ZERO_BAL_ && paySumFor(marN) > 0.005) {
    failures.push('Secondary waterfall: Marriott received funds while Southwest balance_after > ' + ROLLING_WF_ZERO_BAL_ + '.');
  }

  return failures;
}

/**
 * Cleanup trivial CC balances first, then strict serial phase (single engine; high-precision payoff).
 * @param {{ primaryPhase2Fraction?: number, aliasMap?: Object }} [opts]
 */
function runExtraWaterfallConcentratedInterest_(simDebtsSorted, pool, opts) {
  return rollingRunStrictExecuteWaterfall_(simDebtsSorted, pool, opts);
}

/** Legacy spread waterfall — retained for reference; simulation uses concentrated allocator. */
function runExtraWaterfall_(simDebtsSorted, pool, opts) {
  return runExtraWaterfallConcentratedInterest_(simDebtsSorted, pool, opts);
}

/**
 * Audit aggressive phase-2 routing across opening sweep + deployable cash passes (same month).
 * Uses waterfall meta only (not display buckets).
 */
function buildAggressivePhase2Audit_(openMeta, depMeta) {
  const f = ROLLING_DP_PHASE2_PRIMARY_FRACTION_AGGRESSIVE_;
  function pass_(meta) {
    meta = meta || {};
    const R0 = round2_(Number(meta.phase2_R0) || 0);
    const paidP = round2_(Number(meta.phase2_primary_paid) || 0);
    const paidS = round2_(Number(meta.phase2_secondary_paid) || 0);
    const capP = round2_(Number(meta.cap_primary_at_phase2_start) || 0);
    const idealP = R0 > 0.005 ? round2_(f * R0) : 0;
    const wantsMorePrimary = idealP > paidP + 0.5;
    const maxPrimaryThisPass =
      R0 <= 0.005 ? 0 : capP > 0.005 ? round2_(Math.min(capP, idealP)) : round2_(idealP);
    const primary_capped_at_payoff_balance =
      R0 > 0.005 &&
      wantsMorePrimary &&
      maxPrimaryThisPass > 0.005 &&
      paidP + 0.5 >= maxPrimaryThisPass - 1.0;
    return {
      R0: R0,
      primary_paid: paidP,
      secondary_paid: paidS,
      ideal_primary: idealP,
      cap_primary_at_phase2_start: capP,
      primary_capped_at_payoff_balance: primary_capped_at_payoff_balance,
      primary_name: String(meta.phase2_primary_name || '').trim()
    };
  }
  const o = pass_(openMeta);
  const d = pass_(depMeta);
  const pool = round2_(o.R0 + d.R0);
  const primaryTotal = round2_(o.primary_paid + d.primary_paid);
  const secondaryTotal = round2_(o.secondary_paid + d.secondary_paid);
  let sharePct = 100;
  if (pool > 0.005) {
    sharePct = round2_((primaryTotal / pool) * 100);
  }
  const primary_share_met_target = pool <= 0.005 || sharePct >= 89.5;
  const capped_excuse_applies = o.primary_capped_at_payoff_balance || d.primary_capped_at_payoff_balance;
  const below_target_anomaly = pool > 0.005 && sharePct < 89.5 && !capped_excuse_applies;
  return {
    phase2_pool_total: pool,
    phase2_primary_paid_total: primaryTotal,
    phase2_secondary_paid_total: secondaryTotal,
    primary_share_pct: sharePct,
    primary_share_met_target: primary_share_met_target,
    capped_excuse_applies: capped_excuse_applies,
    below_target_anomaly: below_target_anomaly,
    opening: o,
    deployable: d
  };
}

/** For modeling only: pick highest-APR credit card with a balance (tie: larger balance). */
function rollingHighestAprCcNameForModeling_(debts) {
  let bestNm = '';
  let bestApr = -1;
  let bestBal = -1;
  (debts || []).forEach(function(d) {
    if (d.active === false) return;
    if (String(d.type || '').trim() !== 'Credit Card') return;
    if (d.balance <= 0.005) return;
    const ap = Number(d.interestRate) || 0;
    const bl = d.balance;
    if (ap > bestApr + 0.005 || (Math.abs(ap - bestApr) <= 0.005 && bl > bestBal)) {
      bestApr = ap;
      bestBal = bl;
      bestNm = d.name;
    }
  });
  return bestNm;
}

/**
 * Unmapped planned card expense: modeling caution only — prefer highest utilization among CCs with Credit Limit;
 * if no usable limits, fall back to highest APR. Execution payments must not depend on this.
 */
function rollingModelingCautionCardForUnmappedPlanned_(debts) {
  const ccs = (debts || []).filter(function(d) {
    if (d.active === false) return false;
    if (String(d.type || '').trim() !== 'Credit Card') return false;
    if ((Number(d.balance) || 0) <= 0.005) return false;
    return true;
  });
  if (!ccs.length) return '';
  const withLimit = ccs.filter(function(d) {
    return (Number(d.creditLimit) || 0) > 0.005;
  });
  if (withLimit.length) {
    let bestNm = '';
    let bestUtil = -1;
    let bestApr = -1;
    let bestBal = -1;
    withLimit.forEach(function(d) {
      const lim = Number(d.creditLimit) || 0;
      const bal = Number(d.balance) || 0;
      const ap = Number(d.interestRate) || 0;
      const util = bal / lim;
      if (
        util > bestUtil + 1e-9 ||
        (Math.abs(util - bestUtil) <= 1e-9 && (ap > bestApr + 0.005 || (Math.abs(ap - bestApr) <= 0.005 && bal > bestBal)))
      ) {
        bestUtil = util;
        bestApr = ap;
        bestBal = bal;
        bestNm = d.name;
      }
    });
    if (bestNm) return bestNm;
  }
  return rollingHighestAprCcNameForModeling_(debts);
}

/** Max extra principal on a snapshot row (same contract as rollingDebtExtraPayoffCap_). */
function rollingExtraCapOnSnapRow_(row) {
  if (!row) return 0;
  const d = {
    balance: Number(row.balance) || 0,
    interestRate: Number(row.interestRate) || 0,
    minimumPayment: round2_(Number(row.minimumPayment) || 0)
  };
  return rollingDebtExtraPayoffCap_(d);
}

/**
 * Validates strict serial waterfall invariants on execute-now allocations (allows spill when prior target has no extra-principal headroom).
 */
function rollingStrictWaterfallValidationErrors_(startSnap, endSnap, execAlloc, aliasMap) {
  const errors = [];
  aliasMap = aliasMap || getAliasMap_();

  function findSnapRow(snap, nm) {
    for (let i = 0; i < (snap || []).length; i++) {
      if ((snap[i].name || '') === nm) return snap[i];
    }
    return null;
  }

  function allocAmt(nm) {
    return round2_(Number(execAlloc[nm]) || 0);
  }

  const primaryNm = rollingHighestAprCcNameForModeling_(startSnap);
  if (primaryNm) {
    const priEnd = findSnapRow(endSnap, primaryNm);
    const priRem = priEnd ? Number(priEnd.balance) || 0 : 0;
    const priCap = rollingExtraCapOnSnapRow_(priEnd);
    let serialSecondaryTotal = 0;
    for (let si = 0; si < ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_.length; si++) {
      const resolved = rollingResolveCanonicalCcNameOnDebts_(
        ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[si],
        startSnap,
        aliasMap
      );
      if (!resolved) continue;
      if (normalizeName_(resolved, aliasMap) === normalizeName_(primaryNm, aliasMap)) continue;
      serialSecondaryTotal = round2_(serialSecondaryTotal + allocAmt(resolved));
    }
    if (priRem > 0.05 && priCap > 0.5 && serialSecondaryTotal > 0.005) {
      errors.push(
        'STRICT WATERFALL: serial secondary cards received execute-now funds while the primary (highest APR) still had extra-principal headroom — review allocations.'
      );
    }
  }

  const citi = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[0], startSnap, aliasMap);
  const sw = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[1], startSnap, aliasMap);
  const mar = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[2], startSnap, aliasMap);
  if (citi) {
    const cEnd = findSnapRow(endSnap, citi);
    const cRem = cEnd ? Number(cEnd.balance) || 0 : 0;
    const cCap = rollingExtraCapOnSnapRow_(cEnd);
    if (cRem > 0.05 && cCap > 0.5) {
      const downstream = round2_((sw ? allocAmt(sw) : 0) + (mar ? allocAmt(mar) : 0));
      if (downstream > 0.005) {
        errors.push(
          'STRICT WATERFALL: Southwest or Marriott received execute-now funds while CitiAA still had payoff headroom — review secondary ordering.'
        );
      }
    }
  }

  return errors;
}

/**
 * Classify execution extra into cleanup payoffs vs concentration bucket; order concentration for strict serial UI.
 * @param {Object} [aliasMap]
 */
function rollingAnalyzeExecutionConcentration_(startSnap, endSnap, execAlloc, aliasMap) {
  aliasMap = aliasMap || getAliasMap_();
  const smallCap = ROLLING_DP_EXEC_PLAN_SMALL_BALANCE_SNOWBALL_MAX_;
  function b0(nm) {
    for (let i = 0; i < (startSnap || []).length; i++) {
      if (startSnap[i].name === nm) return Number(startSnap[i].balance) || 0;
    }
    return 0;
  }
  function b1(nm) {
    for (let i = 0; i < (endSnap || []).length; i++) {
      if (endSnap[i].name === nm) return Number(endSnap[i].balance) || 0;
    }
    return 0;
  }
  function isCcNm(nm) {
    for (let i = 0; i < (startSnap || []).length; i++) {
      if (startSnap[i].name === nm) return String(startSnap[i].type || '').trim() === 'Credit Card';
    }
    return false;
  }
  function aprNm(nm) {
    for (let i = 0; i < (startSnap || []).length; i++) {
      if (startSnap[i].name === nm) return Number(startSnap[i].interestRate) || 0;
    }
    return 0;
  }

  const cleanupItems = [];
  const concItems = [];
  Object.keys(execAlloc || {}).forEach(function(nm) {
    const amt = round2_(Number(execAlloc[nm]) || 0);
    if (amt <= 0.005) return;
    const bs = b0(nm);
    const be = b1(nm);
    const cc = isCcNm(nm);
    const paidOff = be <= 0.05;
    if (cc && bs <= smallCap + 0.005 && paidOff) {
      cleanupItems.push({ name: nm, amount: amt });
    } else {
      concItems.push({ name: nm, amount: amt });
    }
  });

  const concByName = Object.create(null);
  for (let i = 0; i < concItems.length; i++) {
    concByName[concItems[i].name] = concItems[i];
  }

  const primaryNmModel = rollingHighestAprCcNameForModeling_(startSnap);
  let primaryConc = null;
  if (primaryNmModel && concByName[primaryNmModel]) {
    primaryConc = concByName[primaryNmModel];
  } else {
    const ccConc = concItems
      .filter(function(x) {
        return isCcNm(x.name);
      })
      .sort(function(a, b) {
        return aprNm(b.name) - aprNm(a.name);
      });
    primaryConc = ccConc.length ? ccConc[0] : null;
  }
  if (!primaryConc && concItems.length) {
    primaryConc = concItems
      .slice()
      .sort(function(a, b) {
        return aprNm(b.name) - aprNm(a.name);
      })[0];
  }

  const orderedConc = [];
  const used = Object.create(null);
  if (primaryConc) {
    orderedConc.push(primaryConc);
    used[primaryConc.name] = true;
  }
  const concentration_secondary_items = [];
  for (let si = 0; si < ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_.length; si++) {
    const resolved = rollingResolveCanonicalCcNameOnDebts_(ROLLING_DP_SECONDARY_SERIAL_CC_CANONICAL_[si], startSnap, aliasMap);
    if (!resolved || used[resolved]) continue;
    if (primaryConc && normalizeName_(resolved, aliasMap) === normalizeName_(primaryConc.name, aliasMap)) continue;
    if (concByName[resolved]) {
      orderedConc.push(concByName[resolved]);
      used[resolved] = true;
      concentration_secondary_items.push(concByName[resolved]);
    }
  }
  const tail = concItems.filter(function(x) {
    return !used[x.name];
  });
  tail.sort(function(a, b) {
    return aprNm(b.name) - aprNm(a.name);
  });
  tail.forEach(function(x) {
    orderedConc.push(x);
  });

  const concTotal = orderedConc.reduce(function(s, x) {
    return round2_(s + x.amount);
  }, 0);
  const primaryName = primaryConc ? primaryConc.name : '';
  const primaryAmt = primaryConc ? round2_(primaryConc.amount) : 0;
  let secondaryAmt = 0;
  for (let i = 0; i < orderedConc.length; i++) {
    if (primaryConc && orderedConc[i].name === primaryConc.name) continue;
    secondaryAmt = round2_(secondaryAmt + orderedConc[i].amount);
  }

  const primaryShare = concTotal > 0.005 ? round2_(primaryAmt / concTotal) : 1;
  const strict_waterfall_errors = rollingStrictWaterfallValidationErrors_(startSnap, endSnap, execAlloc, aliasMap);
  const strict_waterfall_valid = strict_waterfall_errors.length === 0;
  const concentration_leak = !strict_waterfall_valid || orderedConc.length > 6;
  const secondary_share_ok = orderedConc.length <= 6;
  const cleanup_fully_paid_ok = cleanupItems.every(function(c) {
    return b1(c.name) <= 0.05;
  });
  const primary_majority_ok = orderedConc.length <= 6;

  let strict_serial_split_note = '';
  if (orderedConc.length > 1) {
    strict_serial_split_note = 'Split occurred only because prior target reached payoff or extra-principal cap for this pass.';
  }

  const concentration_primary_items = primaryConc ? [{ name: primaryConc.name, amount: round2_(primaryConc.amount) }] : [];

  return {
    cleanup_items: cleanupItems,
    concentration_items: orderedConc,
    concentration_primary_items: concentration_primary_items,
    concentration_secondary_items: concentration_secondary_items,
    concentration_total: concTotal,
    primary_name: primaryName,
    primary_amount: primaryAmt,
    primary_share_of_concentration: primaryShare,
    secondary_total: secondaryAmt,
    concentration_leak: concentration_leak,
    secondary_share_ok: secondary_share_ok,
    primary_majority_ok: primary_majority_ok,
    cleanup_fully_paid_ok: cleanup_fully_paid_ok,
    strict_waterfall_errors: strict_waterfall_errors,
    strict_waterfall_valid: strict_waterfall_valid,
    strict_serial_split_note: strict_serial_split_note
  };
}

function pickFocusDebt_(alloc) {
  const names = Object.keys(alloc || {});
  for (let i = 0; i < names.length; i++) {
    if (alloc[names[i]] > 0.005) return names[i];
  }
  return 'Maintain reserve and minimums';
}

function pickCleanupAndPrimaryFocusDebt_(startSnap, execAlloc) {
  const out = { primary: 'Maintain reserve and minimums', cleanup: '—' };
  const alloc = execAlloc || {};
  const names = Object.keys(alloc).filter(function(k) {
    return alloc[k] > 0.005;
  });
  if (!names.length) return out;

  function balanceStart_(nm) {
    for (let i = 0; i < (startSnap || []).length; i++) {
      if (startSnap[i].name === nm) return Number(startSnap[i].balance) || 0;
    }
    return 1e12;
  }
  function rate_(nm) {
    for (let i = 0; i < (startSnap || []).length; i++) {
      if (startSnap[i].name === nm) return Number(startSnap[i].interestRate) || 0;
    }
    return 0;
  }
  function isCc_(nm) {
    for (let i = 0; i < (startSnap || []).length; i++) {
      if (startSnap[i].name === nm) return String(startSnap[i].type || '').trim() === 'Credit Card';
    }
    return false;
  }

  const smallCap = ROLLING_DP_EXEC_PLAN_SMALL_BALANCE_SNOWBALL_MAX_;
  const cleanupPool = names
    .filter(function(n) {
      return balanceStart_(n) <= smallCap + 0.005;
    })
    .sort(function(a, b) {
      return balanceStart_(a) - balanceStart_(b);
    });
  const cleanupName = cleanupPool.length ? cleanupPool[0] : '—';

  const largeCc = names.filter(function(n) {
    return isCc_(n) && balanceStart_(n) > smallCap + 0.005;
  });
  if (largeCc.length) {
    largeCc.sort(function(a, b) {
      return rate_(b) - rate_(a);
    });
    out.primary = largeCc[0];
    out.cleanup = cleanupName !== out.primary ? cleanupName : '—';
    return out;
  }

  const anyCc = names.filter(function(n) {
    return isCc_(n);
  });
  if (anyCc.length) {
    anyCc.sort(function(a, b) {
      return rate_(b) - rate_(a);
    });
    out.primary = anyCc[0];
    out.cleanup = cleanupName !== out.primary && cleanupName !== '—' ? cleanupName : '—';
    return out;
  }

  const byAmt = names.slice().sort(function(a, b) {
    return alloc[b] - alloc[a];
  });
  out.primary = byAmt[0];
  out.cleanup = cleanupName !== out.primary && cleanupName !== '—' ? cleanupName : '—';
  return out;
}

/**
 * Strict HELOC gate for execution guidance — default fail unless every check passes.
 */
function rollingHelocStrictExecutionPasses_(opts) {
  const fail = [];
  const res = Number(opts.reserve) || 0;
  const buf = Number(opts.buffer) || 0;
  const end = Number(opts.endingCash);
  if (!(end >= res + buf - 0.5)) {
    fail.push('ending cash is below reserve plus protected buffer');
  }
  if (!opts.capReached) fail.push('monthly cash deployment cap not fully used');
  if (!opts.helocRefSim) fail.push('no HELOC recorded in Debts');
  if (!opts.topCard) fail.push('no qualifying high-APR credit card with a balance');
  if (opts.plannedNearTermCardWithin30) {
    fail.push('card-funded planned expense due within 30 days of anchor month-end (bias against HELOC)');
  }
  if (opts.userCashPreservation) fail.push('cash preservation is selected for this month');
  if (opts.helocRefSim && opts.topCard) {
    const cardApr = Number(opts.topCard.interestRate) || 0;
    const helocApr = Number(opts.helocRefSim.interestRate) || 0;
    if (cardApr - helocApr < ROLLING_DP_HELOC_MIN_SPREAD_OVER_HELOC_APR_) {
      fail.push(
        'target APR must exceed HELOC APR by at least ' + ROLLING_DP_HELOC_MIN_SPREAD_OVER_HELOC_APR_ + ' percentage points'
      );
    }
  }
  return { pass: fail.length === 0, failReasons: fail };
}

function mergeAllocations_(a, b) {
  const o = Object.create(null);
  [a, b].forEach(function(src) {
    if (!src) return;
    Object.keys(src).forEach(function(k) {
      o[k] = round2_((o[k] || 0) + (src[k] || 0));
    });
  });
  return o;
}

/** Positive extra-principal amounts only, rounded (for execution / forecast maps). */
function trimRollingExtraAllocMap_(alloc) {
  const z = Object.create(null);
  Object.keys(alloc || {}).forEach(function(k) {
    const v = Number(alloc[k]) || 0;
    if (v > 0.005) z[k] = round2_(v);
  });
  return z;
}

function sumRollingAllocMap_(obj) {
  let s = 0;
  Object.keys(obj || {}).forEach(function(k) {
    s = round2_(s + (Number(obj[k]) || 0));
  });
  return s;
}

function snapshotDebtsForActionPlan_(debts) {
  return debts.map(function(d) {
    return {
      name: d.name,
      type: String(d.type || '').trim(),
      balance: round2_(Math.max(0, d.balance)),
      interestRate: Number(d.interestRate) || 0,
      minimumPayment: round2_(Number(d.minimumPayment) || 0),
      creditLimit: round2_(Math.max(0, Number(d.creditLimit) || 0))
    };
  });
}

function findHelocDebt_(debts) {
  for (let i = 0; i < debts.length; i++) {
    if (debts[i].active === false) continue;
    const t = String(debts[i].type || '').trim();
    const n = (debts[i].name + ' ' + (debts[i].originalName || '')).toLowerCase();
    if (t === 'HELOC' || n.indexOf('heloc') >= 0) return debts[i];
  }
  return null;
}

function highAprCreditCardsFromSnapshot_(snapshot, minApr) {
  const out = [];
  snapshot.forEach(function(d) {
    if (String(d.type || '').trim() !== 'Credit Card') return;
    if (d.balance <= 0.005) return;
    if ((Number(d.interestRate) || 0) <= minApr) return;
    out.push(d);
  });
  out.sort(function(a, b) {
    return b.interestRate - a.interestRate;
  });
  return out;
}

function anyCreditCardBalance_(snapshot) {
  return snapshot.some(function(d) {
    return String(d.type || '').trim() === 'Credit Card' && d.balance > 0.005;
  });
}

/**
 * Plain-English monthly action plan (low-pressure). Mutates each row in next12.
 */
function buildRollingMonthlyActionPlan_(next12, opts) {
  const reserve = opts.reserveTarget != null ? opts.reserveTarget : ROLLING_DP_RESERVE_DEFAULT_;
  const planInvalid = !!opts.plan_invalid;
  const debtsTemplate = opts.debts || [];
  const helocRef = findHelocDebt_(debtsTemplate);

  let helocDrawsCumulative = 0;

  next12.forEach(function(row, idx) {
    const startSnap = row.debt_balances_start || [];
    const endSnap = row.debt_balances_end || [];
    const extraAlloc = row.extra_principal_allocations || {};
    const startingCash = Number(row.starting_cash) || 0;
    const endingCash = Number(row.ending_cash) || 0;
    const extraTotal = Number(row.extra_debt_payment) || 0;
    const focus = String(row.focus_debt || '').trim();
    const varIn = Number(row.variable_income) || 0;

    if (!planInvalid && idx > 0) {
      const emergencyReserve = startingCash < reserve * 0.5;
      row.required_actions = [];
      row.recommended_actions = [];
      row.optional_actions = [];
      row.action_items = [];
      row.heloc_draw_this_month = Number(row.heloc_draw_this_month) || 0;
      if (row.heloc_draw_capacity_remaining != null && row.heloc_draw_capacity_remaining === row.heloc_draw_capacity_remaining) {
        row.heloc_draw_capacity_remaining = round2_(row.heloc_draw_capacity_remaining);
      } else {
        row.heloc_draw_capacity_remaining = round2_(ROLLING_DP_HELOC_ACTION_DRAW_CAP_ - helocDrawsCumulative);
      }
      row.action_note =
        'Forecast-only month — use THIS MONTH PLAN and the next-3 preview for decisions; long-range rows are not operating instructions.';
      row.reserve_protection_exception = emergencyReserve;
      return;
    }

    const required = [];
    const recommended = [];
    const optional = [];
    const items = [];

    function addItem(cat, desc, funding, target, amount, reason) {
      items.push({
        category: cat,
        description: desc,
        funding_source: funding,
        target_account: target,
        amount: round2_(amount),
        reason: reason
      });
    }

    if (idx === 0 && row.planned_unmapped_near_term_card) {
      required.push(
        'Map each near-term card-funded planned expense to a specific credit card in Upcoming; until then it is held against deployable cash as cash risk (not free capacity).'
      );
      addItem(
        'required',
        'Map planned card expense to a target credit card',
        'Manual update',
        'Upcoming',
        0,
        'Unmapped items reduce extra-payment capacity like a liquidity hold until mapped.'
      );
    }

    if (planInvalid) {
      if (idx === 0 && startSnap.length) {
        const anchorCfInv = row.anchor_cf_paid_by_debt || {};
        startSnap.forEach(function(d) {
          if (d.balance <= 0.005) return;
          if (d.minimumPayment <= 0.005) return;
          const cfPaidInv = round2_(Number(anchorCfInv[d.name]) || 0);
          const minInv = round2_(Number(d.minimumPayment) || 0);
          if (cfPaidInv >= minInv - 0.01) return;
          const dueInv = cfPaidInv > 0.005 ? round2_(minInv - cfPaidInv) : minInv;
          const lineInv =
            'Pay minimum payment of ' +
            fmtCurrency_(dueInv) +
            ' on ' +
            d.name +
            ' (from normal cash flow / scheduled bills).';
          required.push(lineInv);
          addItem(
            'required',
            lineInv,
            'Normal cash flow — checking / usable liquid',
            d.name,
            dueInv,
            'Contractual minimum while balance is outstanding.'
          );
        });
      }
      required.push('Do not execute major moves until income/expense mapping is fixed.');
      required.push('Only maintain minimum payments and preserve reserve.');
      recommended.push('Preserve reserve until cash-flow mapping is validated.');
      recommended.push('Do not make extra debt payments this month.');
      row.required_actions = required;
      row.recommended_actions = recommended;
      row.optional_actions = optional;
      row.heloc_draw_this_month = 0;
      row.heloc_draw_capacity_remaining = round2_(ROLLING_DP_HELOC_ACTION_DRAW_CAP_);
      row.action_note =
        'Planner projection is INVALID or unverified; low-pressure mode — minimums and reserve only.';
      row.action_items = items;
      row.reserve_protection_exception = false;
      return;
    }

    const reserveGap = round2_(reserve - endingCash);
    const belowReserve = endingCash < reserve - 0.5;
    const bufferFloor = ROLLING_DP_BUFFER_ABOVE_RESERVE_;
    const wellAboveReserve = startingCash >= reserve + bufferFloor + 500;
    const emergencyReserve = startingCash < reserve * 0.5;
    row.reserve_protection_exception = emergencyReserve;

    const anchorCfForRow = idx === 0 && row.anchor_cf_paid_by_debt ? row.anchor_cf_paid_by_debt : {};
    startSnap.forEach(function(d) {
      if (d.balance <= 0.005) return;
      if (d.minimumPayment <= 0.005) return;
      const cfPaid = round2_(Number(anchorCfForRow[d.name]) || 0);
      const minP = round2_(Number(d.minimumPayment) || 0);
      if (cfPaid >= minP - 0.01) return;
      const dueMin = cfPaid > 0.005 ? round2_(minP - cfPaid) : minP;
      const line =
        'Pay minimum payment of ' +
        fmtCurrency_(dueMin) +
        ' on ' +
        d.name +
        ' (from normal cash flow / scheduled bills).';
      required.push(line);
      addItem(
        'required',
        line,
        'Normal cash flow — checking / usable liquid',
        d.name,
        dueMin,
        'Contractual minimum while balance is outstanding.'
      );
    });

    const condVarRow = round2_(Number(row.conditional_variable_extra_total) || 0);
    if (varIn > 0.005 && condVarRow > 0.005) {
      required.push(
        'If variable income is actually received this month, up to an additional ' +
          fmtCurrency_(condVarRow) +
          ' may go to principal as modeled — conditional only; not part of today’s executable steps until received.'
      );
    } else {
      required.push(
        'If variable income arrives later, route it with the configured split (' +
          Math.round(ROLLING_DP_LUMP_DEBT_ * 100) +
          '% debt / ' +
          Math.round(ROLLING_DP_LUMP_RESERVE_ * 100) +
          '% reserve / ' +
          Math.round(ROLLING_DP_LUMP_FLEX_ * 100) +
          '% flexible); projection shows little/no variable inflow this month.'
      );
    }

    if (belowReserve) {
      recommended.push('Hold cash to rebuild reserve to ' + fmtCurrency_(reserve) + ' before any extra debt payments.');
      recommended.push('Do not make extra debt payments this month.');
      addItem(
        'recommended',
        'Hold cash to rebuild reserve',
        'Retain in liquid accounts',
        'Reserve target',
        Math.max(0, reserveGap),
        'Ending cash is below reserve — stability first.'
      );
    } else if (extraTotal <= 0.005) {
      recommended.push(
        'No extra principal from capped deployable cash this month after reserve + buffer and the monthly deployment cap (see THIS MONTH PLAN).'
      );
      if (endingCash < reserve + 2000 && !belowReserve) {
        recommended.push('Cash flow is tight after expenses; keep liquidity rather than forcing payoff speed.');
      }
    } else {
      const execNow = round2_(Number(row.execution_total_now) || 0);
      const execAlloc = row.extra_principal_allocations_execution_now || {};
      const parts = [];
      Object.keys(execAlloc).forEach(function(k) {
        const a = execAlloc[k];
        if (a > 0.005) parts.push(k + ': ' + fmtCurrency_(a));
      });
      const detail = parts.length ? parts.join('; ') : focus;
      recommended.push(
        'Executable-now extra principal (cash + optional approved HELOC only): ' +
          fmtCurrency_(execNow) +
          ' — ' +
          detail +
          '. Forecast total including variable if received: ' +
          fmtCurrency_(extraTotal) +
          ' (see THIS MONTH EXECUTION PLAN vs 12-month forecast).'
      );
      addItem(
        'recommended',
        'Extra principal executable now (cash waterfall)',
        'Deployable cash after protections (variable excluded until received)',
        focus !== 'Maintain reserve and minimums' ? focus : detail,
        execNow,
        'HELOC is optional only with manual approval after strict gates.'
      );
    }

    const opening = Number(row.opening_sweep_extra_debt) || 0;
    if (opening > 0.005 && idx === 0) {
      recommended.push(
        'Initial principal this month: ' +
          fmtCurrency_(opening) +
          ' from deployable cash after reserve + buffer (within monthly cap; already modeled).'
      );
    }

    let helocDraw = Number(row.heloc_draw_this_month) || 0;
    const helocLine = helocRef ? helocRef.name : 'HELOC';

    if (!planInvalid && !belowReserve && helocDraw >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_ && helocRef) {
      helocDrawsCumulative = round2_(helocDrawsCumulative + helocDraw);
      const namedTarget = row.heloc_target_account ? String(row.heloc_target_account).trim() : '';
      let helocPayeeName = namedTarget;
      if (!helocPayeeName) {
        const highCards = highAprCreditCardsFromSnapshot_(startSnap, ROLLING_DP_HELOC_CC_APR_THRESHOLD_);
        const topCard = highCards[0];
        if (topCard) helocPayeeName = topCard.name;
      }
      if (helocPayeeName) {
        optional.push(
          'Optional only with manual approval — ' +
            fmtCurrency_(helocDraw) +
            ' from ' +
            helocLine +
            ' toward ' +
            helocPayeeName +
            ' (modeled only after strict gates). Do not execute without explicit approval.'
        );
        addItem(
          'optional',
          'HELOC draw toward high-APR card (modeled — manual approval required)',
          helocLine + ' line of credit',
          helocPayeeName,
          helocDraw,
          'Strict execution gates only; max ' +
            fmtCurrency_(ROLLING_DP_MAX_HELOC_DRAW_MONTHLY_) +
            ' this month; cumulative cap ' +
            fmtCurrency_(ROLLING_DP_HELOC_ACTION_DRAW_CAP_) +
            '.'
        );
      }
    }

    const ccStillExist = anyCreditCardBalance_(startSnap);
    if (
      !planInvalid &&
      !belowReserve &&
      !ccStillExist &&
      startSnap.some(function(d) {
        return String(d.type || '').trim() === 'HELOC' && d.balance > 0.005;
      })
    ) {
      recommended.push(
        'Revolving cards are paid down in this path — next focus: pay back ' +
          helocLine +
          ' before extra mortgage principal (low-pressure order).'
      );
    }

    if (emergencyReserve) {
      recommended.unshift(
        'RESERVE PROTECTION MODE: ending cash is critically low vs reserve — treat any draw or extra payoff as exception behavior; rebuild reserve first.'
      );
      row.action_note =
        'Exception: reserve stress — favor minimums + liquidity; timeline may extend to protect monthly cash flow.';
    } else {
      row.action_note =
        'Planner is in low-pressure mode; stability and survivability beat payoff speed — timeline may extend beyond 7 years if needed.';
    }

    if (!belowReserve && extraTotal > 0.005 && wellAboveReserve) {
      optional.push('Review discretionary spend; no aggressive acceleration recommended while projection is healthy.');
    }

    row.required_actions = required;
    row.recommended_actions = recommended;
    row.optional_actions = optional;
    row.heloc_draw_this_month = helocDraw;
    row.heloc_draw_capacity_remaining = round2_(ROLLING_DP_HELOC_ACTION_DRAW_CAP_ - helocDrawsCumulative);
    row.action_items = items;
  });
}

function simulateRollingMonths_(ctx) {
  const horizon = 84;
  const detailMonths = 12;
  const tz = ctx.tz || Session.getScriptTimeZone();
  const simDebts = sortDebtsWaterfall_(
    ctx.debts.map(function(d) {
      return JSON.parse(JSON.stringify(d));
    })
  );

  let liquid = ctx.availableCashStart;
  const reserve = ctx.reserveTarget != null ? ctx.reserveTarget : ROLLING_DP_RESERVE_DEFAULT_;
  const buffer = ctx.bufferAboveReserve != null ? ctx.bufferAboveReserve : ROLLING_DP_BUFFER_ABOVE_RESERVE_;
  const maxCashDeploy = ctx.maxCashDeploymentMonthly != null ? ctx.maxCashDeploymentMonthly : ROLLING_DP_MAX_CASH_DEPLOYMENT_MONTHLY_;
  /** Canonical month-0 execute-now budget (min of final execute-now cash and monthly execution cap). Hard-caps m=0 execute-now allocation. */
  const month0ExecuteNowBudget =
    ctx.month0ExecuteNowBudget != null && ctx.month0ExecuteNowBudget === ctx.month0ExecuteNowBudget
      ? round2_(Math.max(0, Number(ctx.month0ExecuteNowBudget) || 0))
      : null;
  const planInvalid = !!ctx.planInvalid;
  const displayTotalCash = ctx.displayTotalCash != null && ctx.displayTotalCash === ctx.displayTotalCash ? ctx.displayTotalCash : null;
  const nearTermPlannedCash = ctx.nearTermPlannedCashTotal != null && ctx.nearTermPlannedCashTotal === ctx.nearTermPlannedCashTotal ? round2_(ctx.nearTermPlannedCashTotal) : 0;
  const unmappedCardFundedCashRisk =
    ctx.unmappedCardFundedCashRiskTotal != null && ctx.unmappedCardFundedCashRiskTotal === ctx.unmappedCardFundedCashRiskTotal
      ? round2_(ctx.unmappedCardFundedCashRiskTotal)
      : 0;
  const phase2PrimaryFraction =
    ctx.executionPlanAggressiveAlloc === true
      ? ROLLING_DP_PHASE2_PRIMARY_FRACTION_AGGRESSIVE_
      : ROLLING_DP_PHASE2_PRIMARY_FRACTION_STANDARD_;
  const waterfallOpts = {
    primaryPhase2Fraction: phase2PrimaryFraction,
    aliasMap: ctx.aliasMap || getAliasMap_()
  };

  const anchorStable = ctx.incomeSplitAnchor.stableTotal;
  const anchorVar = ctx.incomeSplitAnchor.variableTotal;
  const anchorExpensePos = ctx.anchorExpensePositive != null ? ctx.anchorExpensePositive : 0;

  const fwdStable = ctx.forward.stableIncomeForward;
  const fwdExpensePos =
    ctx.forward.expensePositiveForward != null
      ? ctx.forward.expensePositiveForward
      : Math.abs(ctx.forward.expenseTotalForward || 0);
  const fwdVar = ctx.forward.variableIncomeForward;

  const next12 = [];
  const longRange = [];
  const debtStart = ctx.debtStart;
  let helocDrawsCumulativeSim = 0;

  for (let m = 0; m < horizon; m++) {
    const dMonth = addMonthsFirst_(ctx.anchorDate, m);
    const labelIso = formatMonthIso_(dMonth, tz);
    const calendarYear = dMonth.getFullYear();

    const debtBalancesStart = snapshotDebtsForActionPlan_(simDebts);

    const startingCash = round2_(liquid);
    let monthlyCashDeployUsed = 0;
    let openingSweepExtra = 0;
    let openAlloc = {};
    let recurringExtraDebt = 0;
    let runCash = { allocations: {}, totalExtra: 0 };
    let runVar = { allocations: {}, totalExtra: 0 };
    let run = { allocations: {}, totalExtra: 0 };
    let fromLiquidUsed = 0;
    let openingConcMeta = {};
    let deployableConcMeta = {};
    /** Month 0: debt snapshot after opening + deployable cash extras only (before variable-income waterfall). */
    let debtBalancesAfterCashExecuteNow = null;
    let month0WaterfallExecSnap = null;
    let month0WaterfallExecValidatedLabel = null;
    let month0WaterfallExecFailures = null;

    let openingIntentMonth0 = 0;
    if (m === 0) {
      /**
       * Month-0 opening intent uses the canonical `month0ExecuteNowBudget` (min of
       * final_execute_now_cash and monthly_execution_cap) as the ceiling. That value
       * already accounts for the CALCULATED reserve / buffer / near-term / unmapped
       * holds from the SYS - Accounts policy model. Subtracting the legacy
       * $100k + $100k reserve/buffer constants here would double-count the holds and
       * collapse the waterfall to $0 whenever calculated-deployable is below the
       * legacy threshold (see "display plan validator" drift report). Forward months
       * still use reserve/buffer to protect cash projections — only m=0 changes.
       */
      const baseCap = month0ExecuteNowBudget != null
        ? round2_(Math.max(0, Math.min(round2_(liquid), month0ExecuteNowBudget)))
        : Math.max(0, round2_(liquid - reserve - buffer));
      /**
       * Month-0 opening intent is bounded by `month0ExecuteNowBudget` (= final_execute_now_cash
       * post calculated-reserve/buffer/holds) when provided. The legacy $50k
       * `maxCashDeploymentMonthly` cap only applies when `month0ExecuteNowBudget` is null.
       */
      if (month0ExecuteNowBudget != null) {
        openingIntentMonth0 = round2_(Math.min(baseCap, month0ExecuteNowBudget));
      } else {
        openingIntentMonth0 = round2_(Math.min(baseCap, Math.max(0, maxCashDeploy - monthlyCashDeployUsed)));
      }
    }

    const stableIn = m === 0 ? anchorStable : fwdStable;
    const variableIn = m === 0 ? anchorVar : fwdVar;
    const expensePos = m === 0 ? anchorExpensePos : fwdExpensePos;

    const netToLiquid = round2_(stableIn + (ROLLING_DP_LUMP_RESERVE_ + ROLLING_DP_LUMP_FLEX_) * variableIn - expensePos);
    const debtSideFromVariable = round2_(ROLLING_DP_LUMP_DEBT_ * variableIn);

    liquid = round2_(liquid + netToLiquid);

    /**
     * Month-0 deploy-mid uses the same calculated-model ceiling as opening intent:
     * `liquid` already net of the calculated reserve/buffer/holds via availableCashStart,
     * so we don't subtract the legacy $100k/$100k again. Forward months still apply
     * legacy reserve/buffer to protect projected cash flow.
     */
    const deployMid =
      m === 0 && month0ExecuteNowBudget != null
        ? Math.max(0, round2_(liquid))
        : Math.max(0, round2_(liquid - reserve - buffer));
    /**
     * Forward months keep the legacy monthly cap (`maxCashDeploy`) as a sanity bound
     * on projected cash deployment. Month 0 uses `month0ExecuteNowBudget` (canonical
     * final execute-now cash) as the only ceiling; the legacy $50k cap is ignored.
     */
    let roomLeft = Math.max(0, round2_(maxCashDeploy - monthlyCashDeployUsed));
    if (m === 0) {
      if (month0ExecuteNowBudget != null) {
        roomLeft = Math.max(0, round2_(month0ExecuteNowBudget - openingIntentMonth0));
      } else {
        roomLeft = Math.max(0, round2_(roomLeft - openingIntentMonth0));
      }
    }
    const fromLiquid = round2_(Math.min(deployMid, roomLeft));

    if (m === 0) {
      let combinedIntent = round2_(openingIntentMonth0 + fromLiquid);
      if (month0ExecuteNowBudget != null) {
        combinedIntent = round2_(Math.min(combinedIntent, month0ExecuteNowBudget));
      }
      liquid = round2_(liquid - combinedIntent);
      const combinedRun = runExtraWaterfall_(simDebts, combinedIntent, waterfallOpts);
      const combinedApplied = round2_(combinedRun.totalExtra);
      if (combinedApplied < combinedIntent - 0.01) {
        liquid = round2_(liquid + combinedIntent - combinedApplied);
      }
      openingSweepExtra = round2_(Math.min(openingIntentMonth0, combinedApplied));
      fromLiquidUsed = round2_(combinedApplied - openingSweepExtra);
      monthlyCashDeployUsed = round2_(monthlyCashDeployUsed + combinedApplied);
      openAlloc = {};
      runCash = combinedRun;
      deployableConcMeta = combinedRun.meta || {};
      openingConcMeta = combinedRun.meta || {};
      debtBalancesAfterCashExecuteNow = snapshotDebtsForActionPlan_(simDebts);
      runVar = runExtraWaterfall_(simDebts, debtSideFromVariable, waterfallOpts);
      recurringExtraDebt = round2_(combinedApplied + runVar.totalExtra);
      run = {
        allocations: mergeAllocations_(combinedRun.allocations, runVar.allocations),
        totalExtra: recurringExtraDebt
      };
      month0WaterfallExecSnap = rollingBuildExecutionSnapshotFromTrace_(combinedRun.trace || []);
      month0WaterfallExecFailures = [];
      if (combinedRun.waterfall_validation && combinedRun.waterfall_validation.failures) {
        month0WaterfallExecFailures = combinedRun.waterfall_validation.failures.slice();
      }
      let wfPass = !!(combinedRun.waterfall_validation && combinedRun.waterfall_validation.pass);
      if (runVar.waterfall_validation) {
        if (runVar.waterfall_validation.failures && runVar.waterfall_validation.failures.length) {
          month0WaterfallExecFailures = month0WaterfallExecFailures.concat(runVar.waterfall_validation.failures);
        }
        wfPass = wfPass && !!runVar.waterfall_validation.pass;
      }
      month0WaterfallExecValidatedLabel = wfPass ? 'PASS' : 'FAIL';
    } else {
      const extraPool = round2_(fromLiquid + debtSideFromVariable);
      run = runExtraWaterfall_(simDebts, extraPool, waterfallOpts);
      recurringExtraDebt = run.totalExtra;
      fromLiquidUsed = round2_(Math.min(fromLiquid, run.totalExtra));
      liquid = round2_(liquid - fromLiquidUsed);
      monthlyCashDeployUsed = round2_(monthlyCashDeployUsed + fromLiquidUsed);
    }

    const deployableAtStart = round2_(Math.max(0, startingCash - reserve - buffer));
    const actualCashDeployment = round2_(openingSweepExtra + fromLiquidUsed);

    const endingCashPreHeloc = round2_(liquid);
    let helocDrawMonth = 0;
    let helocTargetAccount = null;
    let helocStrictFailures = [];
    if (m === 0 && !planInvalid) {
      const helocRefSim = findHelocDebt_(simDebts);
      /**
       * HELOC gating: "cap reached" now means the user has deployed the full
       * month-0 execute-now budget (calculated final execute-now cash), not the
       * legacy $50k monthly cap.
       */
      const helocCapReference =
        month0ExecuteNowBudget != null ? month0ExecuteNowBudget : maxCashDeploy;
      const capReached = actualCashDeployment >= helocCapReference - 0.5;
      const snapAfterCashWaterfalls = snapshotDebtsForActionPlan_(simDebts);
      const highCardsAfterCash = highAprCreditCardsFromSnapshot_(
        snapAfterCashWaterfalls,
        ROLLING_DP_HELOC_CC_APR_THRESHOLD_
      );
      const topCard = highCardsAfterCash.length ? highCardsAfterCash[0] : null;
      const helocGate = rollingHelocStrictExecutionPasses_({
        endingCash: endingCashPreHeloc,
        reserve: reserve,
        buffer: buffer,
        capReached: capReached,
        helocRefSim: helocRefSim,
        topCard: topCard,
        plannedUnmappedNearTermCard: !!ctx.plannedUnmappedNearTermCard,
        plannedNearTermCardWithin30: !!ctx.plannedNearTermCardWithin30,
        userCashPreservation: !!ctx.userCashPreservationMonth
      });
      helocStrictFailures = helocGate.failReasons || [];
      if (helocGate.pass && helocRefSim && topCard) {
        const capRemHeloc = round2_(ROLLING_DP_HELOC_ACTION_DRAW_CAP_ - helocDrawsCumulativeSim);
        const rawHeloc = Math.min(
          ROLLING_DP_MAX_HELOC_DRAW_MONTHLY_,
          Math.max(0, topCard.balance),
          Math.max(0, capRemHeloc)
        );
        helocDrawMonth = round2_(rawHeloc);
        if (helocDrawMonth >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_) {
          helocDrawsCumulativeSim = round2_(helocDrawsCumulativeSim + helocDrawMonth);
          helocTargetAccount = topCard.name;
        } else {
          helocDrawMonth = 0;
        }
      }
    }

    const focusAllocForecast =
      m === 0
        ? mergeAllocations_(openAlloc, mergeAllocations_(runCash.allocations, runVar.allocations))
        : run.allocations;
    const extraPrincipalForecast = trimRollingExtraAllocMap_(focusAllocForecast);

    let execAllocCashObj = Object.create(null);
    let execAllocVarObj = Object.create(null);
    let executionExtraCashTotal = 0;
    let conditionalVariableExtraTotal = 0;
    let cleanupTargetDebt = '—';
    let focusDebtName = pickFocusDebt_(run.allocations);
    let execConcAnalysis = null;
    if (m === 0) {
      execAllocCashObj = trimRollingExtraAllocMap_(mergeAllocations_(openAlloc, runCash.allocations));
      execAllocVarObj = trimRollingExtraAllocMap_(runVar.allocations);
      executionExtraCashTotal = round2_(sumRollingAllocMap_(execAllocCashObj));
      conditionalVariableExtraTotal = round2_(runVar.totalExtra);
      const fPick = pickCleanupAndPrimaryFocusDebt_(debtBalancesStart, execAllocCashObj);
      focusDebtName = fPick.primary;
      cleanupTargetDebt = fPick.cleanup;
    }

    const debtBalancesEndSnapshot = snapshotDebtsForActionPlan_(simDebts);
    if (m === 0) {
      execConcAnalysis = rollingAnalyzeExecutionConcentration_(
        debtBalancesStart,
        debtBalancesAfterCashExecuteNow || debtBalancesEndSnapshot,
        execAllocCashObj,
        ctx.aliasMap || getAliasMap_()
      );
      if (execConcAnalysis && execConcAnalysis.primary_name) {
        focusDebtName = execConcAnalysis.primary_name;
      }
      const cnames = (execConcAnalysis && execConcAnalysis.cleanup_items
        ? execConcAnalysis.cleanup_items.map(function(c) {
            return c.name;
          })
        : []
      ).filter(Boolean);
      if (cnames.length) {
        cleanupTargetDebt = cnames.join(', ');
      }
      if (execConcAnalysis && debtBalancesAfterCashExecuteNow) {
        const varErrs = rollingStrictWaterfallValidationErrors_(
          debtBalancesAfterCashExecuteNow,
          debtBalancesEndSnapshot,
          execAllocVarObj,
          ctx.aliasMap || getAliasMap_()
        );
        if (varErrs && varErrs.length) {
          const prior = execConcAnalysis.strict_waterfall_errors || [];
          const merged = prior.concat(varErrs);
          execConcAnalysis.strict_waterfall_errors = merged;
          execConcAnalysis.strict_waterfall_valid = merged.length === 0;
          execConcAnalysis.concentration_leak = !!execConcAnalysis.concentration_leak || merged.length > 0;
        }
      }
      if (execConcAnalysis && month0WaterfallExecFailures && month0WaterfallExecFailures.length) {
        const prior2 = execConcAnalysis.strict_waterfall_errors || [];
        const merged2 = prior2.concat(month0WaterfallExecFailures);
        execConcAnalysis.strict_waterfall_errors = merged2;
        execConcAnalysis.strict_waterfall_valid = merged2.length === 0;
        execConcAnalysis.concentration_leak = !!execConcAnalysis.concentration_leak || merged2.length > 0;
      }
    }

    /**
     * Month-0 allocation audit (single source of truth = month0_execute_now_budget).
     * The intent/waterfall is already capped at the canonical budget; as belt-and-suspenders
     * this block clamps any rounding-drift overshoot, emits a warning to row.alerts, and
     * publishes per-bucket allocated totals for the dashboard & automation output.
     */
    let allocationAudit = null;
    if (m === 0) {
      let allocatedExecuteNowCashTotal = round2_(sumRollingAllocMap_(execAllocCashObj));
      const clampWarnings = [];
      if (month0ExecuteNowBudget != null && allocatedExecuteNowCashTotal > month0ExecuteNowBudget + 0.01) {
        const overshoot = round2_(allocatedExecuteNowCashTotal - month0ExecuteNowBudget);
        const scale = allocatedExecuteNowCashTotal > 0 ? month0ExecuteNowBudget / allocatedExecuteNowCashTotal : 0;
        const clampedMap = Object.create(null);
        let runningSum = 0;
        Object.keys(execAllocCashObj).forEach(function(nm) {
          const amt = round2_((Number(execAllocCashObj[nm]) || 0) * scale);
          if (amt > 0.005) {
            clampedMap[nm] = amt;
            runningSum = round2_(runningSum + amt);
          }
        });
        execAllocCashObj = clampedMap;
        allocatedExecuteNowCashTotal = runningSum;
        executionExtraCashTotal = runningSum;
        clampWarnings.push(
          'allocator_exceeded_month0_budget: clamped by ' +
            fmtCurrency_(overshoot) +
            ' to match month0_execute_now_budget (' +
            fmtCurrency_(month0ExecuteNowBudget) +
            ')'
        );
      }
      const auditBuckets = buildExecutionExtraBuckets_(execConcAnalysis, execAllocCashObj, planInvalid);
      function sumBucket_(list) {
        return round2_(
          (list || []).reduce(function(s, e) {
            return s + (Number(e && e.amt) || 0);
          }, 0)
        );
      }
      const allocatedCleanupTotal = sumBucket_(auditBuckets.cleanup);
      const allocatedPrimaryTotal = sumBucket_(auditBuckets.primary);
      const allocatedSecondaryTotal = sumBucket_(auditBuckets.secondary);
      const allocatedOverflowTotal = sumBucket_(auditBuckets.overflow);
      const budgetNum = month0ExecuteNowBudget != null ? round2_(month0ExecuteNowBudget) : null;
      const gap = budgetNum != null ? round2_(budgetNum - allocatedExecuteNowCashTotal) : null;
      const warnings = clampWarnings.slice();
      if (
        budgetNum != null &&
        Math.abs(allocatedExecuteNowCashTotal - budgetNum) > 0.01
      ) {
        warnings.push(
          'month0_allocation_vs_budget_drift: allocated_execute_now_cash_total (' +
            fmtCurrency_(allocatedExecuteNowCashTotal) +
            ') differs from month0_execute_now_budget (' +
            fmtCurrency_(budgetNum) +
            ') by ' +
            fmtCurrency_(Math.abs(gap || 0))
        );
      }
      allocationAudit = {
        allocated_cleanup_total: allocatedCleanupTotal,
        allocated_primary_total: allocatedPrimaryTotal,
        allocated_secondary_total: allocatedSecondaryTotal,
        allocated_overflow_total: allocatedOverflowTotal,
        allocated_execute_now_cash_total: allocatedExecuteNowCashTotal,
        month0_execute_now_budget: budgetNum,
        allocation_gap_to_budget: gap,
        warnings: warnings
      };
    }

    const helocRecExecution =
      m === 0 && helocDrawMonth >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_
        ? 'Optional only with manual approval'
        : 'No';

    let allocationInterestOptimized = false;
    if (m === 0 && execConcAnalysis) {
      allocationInterestOptimized = !execConcAnalysis.concentration_leak;
    }

    const liquiditySummary = {
      total_cash:
        m === 0 && displayTotalCash != null ? round2_(displayTotalCash) : startingCash,
      reserve_target: reserve,
      buffer_above_reserve: buffer,
      near_term_planned_cash_reserved: m === 0 && nearTermPlannedCash > 0.005 ? round2_(nearTermPlannedCash) : 0,
      unmapped_card_funded_cash_risk: m === 0 && unmappedCardFundedCashRisk > 0.005 ? round2_(unmappedCardFundedCashRisk) : 0,
      deployable_cash:
        m === 0 && displayTotalCash != null
          ? round2_(
              Math.max(0, displayTotalCash - reserve - buffer - nearTermPlannedCash - unmappedCardFundedCashRisk)
            )
          : deployableAtStart,
      deployable_cash_after_protections:
        m === 0 && displayTotalCash != null
          ? round2_(
              Math.max(0, displayTotalCash - reserve - buffer - nearTermPlannedCash - unmappedCardFundedCashRisk)
            )
          : deployableAtStart,
      cash_available_for_extra_debt_today: m === 0 ? executionExtraCashTotal : 0,
      month0_execute_now_budget:
        m === 0 && month0ExecuteNowBudget != null ? round2_(month0ExecuteNowBudget) : 0,
      heloc_recommended_now: m === 0 ? helocRecExecution : 'No',
      heloc_strict_failure_reasons: m === 0 ? helocStrictFailures.slice() : [],
      monthly_max_cash_deployment: maxCashDeploy,
      actual_cash_deployment_this_month: actualCashDeployment,
      heloc_draw_this_month: helocDrawMonth
    };

    const totalDebt = round2_(
      simDebts.reduce(function(s, d) {
        return s + Math.max(0, d.balance);
      }, 0)
    );

    const totalExtraThisMonth = round2_(openingSweepExtra + recurringExtraDebt);
    const endingStatedIdentity = round2_(startingCash + stableIn + variableIn - expensePos - totalExtraThisMonth);
    const cashIdentityResidual = round2_(liquid - endingStatedIdentity);
    const monthAlerts = [];
    if (m === 0 && openingSweepExtra > 0.005) {
      monthAlerts.push(
        'Controlled deployment: ' +
          fmtCurrency_(openingSweepExtra) +
          ' from deployable cash (after reserve + buffer, within monthly cap) applied to debt.'
      );
    }
    if (m === 0 && execConcAnalysis && execConcAnalysis.strict_waterfall_errors && execConcAnalysis.strict_waterfall_errors.length) {
      for (let ei = 0; ei < execConcAnalysis.strict_waterfall_errors.length; ei++) {
        monthAlerts.push(execConcAnalysis.strict_waterfall_errors[ei]);
      }
    }
    if (m === 0 && allocationAudit && allocationAudit.warnings && allocationAudit.warnings.length) {
      for (let ai = 0; ai < allocationAudit.warnings.length; ai++) {
        monthAlerts.push('Allocation audit: ' + allocationAudit.warnings[ai]);
      }
    }

    const row = {
      month: labelIso,
      month_index: m,
      starting_cash: startingCash,
      stable_income: stableIn,
      variable_income: variableIn,
      expenses: expensePos,
      expenses_column_label:
        m === 0 ? 'Anchor Month Actual Expenses' : 'Forward Recurring Expense Baseline',
      opening_sweep_extra_debt: m === 0 ? openingSweepExtra : 0,
      extra_debt_payment: totalExtraThisMonth,
      extra_debt_payment_forecast_total: totalExtraThisMonth,
      ending_cash: round2_(liquid),
      ending_cash_stated_identity: endingStatedIdentity,
      cash_identity_residual: cashIdentityResidual,
      ending_total_debt: totalDebt,
      focus_debt: focusDebtName,
      cleanup_target_debt: m === 0 ? cleanupTargetDebt : '—',
      primary_priority_debt: focusDebtName,
      calendar_year: calendarYear,
      alerts: monthAlerts,
      debt_balances_start: debtBalancesStart,
      debt_balances_sheet_anchor: m === 0 && ctx.debtSheetAnchorSnapshot ? ctx.debtSheetAnchorSnapshot : null,
      debt_balances_end: debtBalancesEndSnapshot,
      execution_concentration_analysis: m === 0 ? execConcAnalysis : null,
      waterfall_execution_snapshot: m === 0 ? month0WaterfallExecSnap : null,
      waterfall_execution_validated: m === 0 ? month0WaterfallExecValidatedLabel : null,
      waterfall_execution_validation_failures: m === 0 ? month0WaterfallExecFailures : null,
      opening_concentration_meta: m === 0 ? openingConcMeta : null,
      deployable_concentration_meta: m === 0 ? deployableConcMeta : null,
      planned_unmapped_near_term_card: m === 0 ? !!ctx.plannedUnmappedNearTermCard : false,
      modeling_caution_assumption_card: m === 0 ? String(ctx.modelingUnmappedCardAssumption || '') : '',
      extra_principal_allocations: extraPrincipalForecast,
      extra_principal_allocations_execution_now: m === 0 ? execAllocCashObj : {},
      extra_principal_allocations_conditional_variable: m === 0 ? execAllocVarObj : {},
      execution_extra_cash_total: m === 0 ? executionExtraCashTotal : 0,
      execution_heloc_principal: m === 0 ? helocDrawMonth : 0,
      execution_total_now: m === 0 ? round2_(executionExtraCashTotal + helocDrawMonth) : 0,
      conditional_variable_extra_total: m === 0 ? conditionalVariableExtraTotal : 0,
      heloc_draw_this_month: helocDrawMonth,
      heloc_target_account: helocTargetAccount,
      heloc_strict_execution_failures: m === 0 ? helocStrictFailures.slice() : [],
      heloc_recommendation_execution: m === 0 ? helocRecExecution : 'No',
      heloc_draw_capacity_remaining: round2_(ROLLING_DP_HELOC_ACTION_DRAW_CAP_ - helocDrawsCumulativeSim),
      liquidity_summary: liquiditySummary,
      allocation_interest_optimized: m === 0 ? allocationInterestOptimized : false,
      allocation_audit: m === 0 ? allocationAudit : null
    };

    longRange.push({
      month: labelIso,
      month_index: m,
      calendar_year: calendarYear,
      ending_total_debt: totalDebt,
      ending_cash: round2_(liquid),
      extra_debt_payment: totalExtraThisMonth,
      opening_sweep_extra_debt: m === 0 ? openingSweepExtra : 0,
      heloc_draw_this_month: helocDrawMonth,
      liquidity_summary: liquiditySummary
    });

    if (m < detailMonths) {
      next12.push(row);
    }
  }

  const yearlyProjection = buildYearlyProjectionFromLongRange_(longRange, debtStart);

  return {
    next12: next12,
    longRange: longRange,
    yearlyProjection: yearlyProjection,
    debtStart: debtStart
  };
}

function buildYearlyProjectionFromLongRange_(longRange, debtStart) {
  const lastByYear = Object.create(null);
  longRange.forEach(function(r) {
    lastByYear[r.calendar_year] = r.ending_total_debt;
  });
  const years = Object.keys(lastByYear)
    .map(function(y) {
      return Number(y);
    })
    .sort(function(a, b) {
      return a - b;
    });

  const out = [];
  let priorEnding = debtStart;
  years.forEach(function(y) {
    const end = lastByYear[y];
    const reduction = round2_(priorEnding - end);
    out.push({
      year: y,
      ending_debt: end,
      debt_reduction_vs_prior_year: reduction
    });
    priorEnding = end;
  });
  return out;
}

function normalizePayeeKey_(payeeRaw, aliasMap) {
  return normalizeName_(payeeRaw, aliasMap);
}

function isSdUtilityOrMaintenancePayee_(rawPayee) {
  const low = String(rawPayee || '').toLowerCase();
  if (low.indexOf('san diego') < 0) return false;
  return /utility|utilities|water|elect|power|gas|maint|repair|sewer|trash|internet|plumb|hvac/i.test(low);
}

function buildPropertyWatchlist_(history, aliasMap) {
  const last = history[history.length - 1];
  const refSdRent = normalizeName_(ROLLING_DP_SD_RENT_PAYEE_, aliasMap);
  const costRefs = ROLLING_DP_SD_COST_PAYEES_.map(function(c) {
    return normalizeName_(c, aliasMap);
  });

  let sdRent = 0;
  let sdCostNamed = 0;
  let sdCostSdLoose = 0;

  if (last.rows) {
    last.rows.forEach(function(r) {
      if (String(r.Type || '')
          .trim()
          .toUpperCase() !== 'INCOME') {
        return;
      }
      if (!cashFlowCellIsPresent_(r, last.monthHeader)) return;
      if (normalizePayeeKey_(r.Payee, aliasMap) === refSdRent) {
        sdRent += readCashFlowMonthAmount_(r, last.monthHeader);
      }
    });

    last.rows.forEach(function(r) {
      if (String(r.Type || '')
          .trim()
          .toUpperCase() !== 'EXPENSE') {
        return;
      }
      if (!cashFlowCellIsPresent_(r, last.monthHeader)) return;
      const nk = normalizePayeeKey_(r.Payee, aliasMap);
      const raw = String(r.Payee || '').trim();
      const amt = Math.abs(readCashFlowMonthAmount_(r, last.monthHeader));
      if (costRefs.indexOf(nk) >= 0) {
        sdCostNamed += amt;
        return;
      }
      if (isSdUtilityOrMaintenancePayee_(raw)) {
        sdCostSdLoose += amt;
      }
    });
  }

  let sdCost = round2_(sdCostNamed + sdCostSdLoose);
  let notes =
    sdCostSdLoose > 0
      ? 'Includes San Diego–labeled utilities/maintenance lines where detected.'
      : 'Costs from named loan/HOA payees only (see assumptions).';
  let usedOverride = false;

  if (sdRent < 1 && sdCostNamed < 1) {
    sdRent = ROLLING_DP_SD_OVERRIDE_RENT_;
    sdCost = ROLLING_DP_SD_OVERRIDE_COST_;
    usedOverride = true;
    notes =
      'Named San Diego rent/cost lines not found or month cells blank — using configured defaults (2600 / 4000 / 1400).';
  }

  const drag = usedOverride ? ROLLING_DP_SD_OVERRIDE_DRAG_ : round2_(sdCost - sdRent);

  return {
    san_diego: {
      status: 'HOLD / REVIEW',
      monthly_rent: round2_(sdRent),
      estimated_monthly_cost: round2_(sdCost),
      estimated_monthly_drag: drag,
      notes: notes,
      used_override: usedOverride
    },
    tahoe: {
      status: 'KEEP',
      reason: 'Protected lifestyle asset'
    }
  };
}

/**
 * Build the HELOC advisor's card-spend realism block from actual Cash Flow
 * history using the "Flow Source" column (CASH | CREDIT_CARD | blank).
 *
 * Walks the last 6 months of CF history already loaded by
 * `buildRollingCfHistory_`, filters rows where Type === "Expense" AND Flow
 * Source === "CREDIT_CARD", sums per-month per-payee, and classifies each
 * payee as recurring or spiky using a frequency heuristic:
 *   - recurring if the payee has a non-zero charge in ≥2 of the last 3 months
 *     OR ≥3 of the last 6 months.
 *   - spiky otherwise (property taxes, federal taxes, one-off large charges).
 *
 * Returns an object shaped to match the existing
 * `heloc_advisor_snapshot.card_spend` contract (so the React mapper picks it
 * up with zero extra work), plus richer per-month debug series. Returns
 * `null` when:
 *   - there is no history at all,
 *   - no row in any month has a "Flow Source" column header (legacy tab), or
 *   - no row across all months is flagged CREDIT_CARD.
 *
 * `already_in_cashflow` defaults to `true` because the planner's recurring
 * surplus (income minus expenses in the same CF sheet) already nets these
 * rows out — subtracting them again would double-count.
 */
function buildHelocFlowSourceCardSpend_(history) {
  if (!Array.isArray(history) || !history.length) return null;

  // Anchor at the last 6 months (most recent at the end of the array).
  const recent = history.slice(-6);

  // Detect whether ANY row (any month) carries a "Flow Source" header. If
  // none do, we're on a legacy tab — bail out cleanly so the UI falls back
  // to the existing no-data path instead of inventing a number.
  let sawFlowSourceColumn = false;
  for (let i = 0; i < recent.length && !sawFlowSourceColumn; i++) {
    const rows = recent[i] && recent[i].rows;
    if (!rows) continue;
    for (let r = 0; r < rows.length; r++) {
      if (Object.prototype.hasOwnProperty.call(rows[r], 'Flow Source')) {
        sawFlowSourceColumn = true;
        break;
      }
    }
  }
  if (!sawFlowSourceColumn) return null;

  // Detect whether ANY row carries an "Active" column header. On legacy
  // tabs without this column we fall back to treating every row as active,
  // which matches the pre-Active behavior (backward-compatible).
  let sawActiveColumn = false;
  for (let i = 0; i < recent.length && !sawActiveColumn; i++) {
    const rows = recent[i] && recent[i].rows;
    if (!rows) continue;
    for (let r = 0; r < rows.length; r++) {
      if (Object.prototype.hasOwnProperty.call(rows[r], 'Active')) {
        sawActiveColumn = true;
        break;
      }
    }
  }

  // Per-month per-payee card-routed expense totals.
  const byMonth = [];
  const payeeSet = Object.create(null);
  // Inactive CREDIT_CARD rows removed from the model — tracked only for debug
  // surfacing (UI note + "top inactive payees removed" list). These totals
  // are NEVER fed into the recurring/spiky math.
  const inactiveByPayee = Object.create(null);
  let inactiveTotal = 0;
  for (let mi = 0; mi < recent.length; mi++) {
    const entry = recent[mi];
    const monthHeader = entry.monthHeader;
    const rows = entry.rows || [];
    const byPayee = Object.create(null);
    let total = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const typ = String(row.Type || '').trim().toUpperCase();
      if (typ !== 'EXPENSE') continue;
      // Tolerant normalization: trim, upper-case, collapse internal spaces to
      // underscores so "credit card" / "credit_card" / "Credit Card" all
      // match. Blank / unknown values are skipped (never throws — we don't
      // want a typo in one row to kill the whole HELOC realism layer).
      const fs = String(row['Flow Source'] || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
      if (fs !== 'CREDIT_CARD') continue;
      const payee = String(row.Payee || '').trim();
      if (!payee) continue;
      const amt = Math.abs(readCashFlowMonthAmount_(row, monthHeader));
      if (!amt || !isFinite(amt)) continue;
      // Active filter: default is YES. Only explicit NO / N / FALSE /
      // INACTIVE kicks a row out. Missing column or blank value = active
      // (matches the legacy, pre-Active behavior — see Part 5).
      const activeRaw = String(row.Active == null ? '' : row.Active).trim().toUpperCase();
      const isInactive =
        activeRaw === 'NO' ||
        activeRaw === 'N' ||
        activeRaw === 'FALSE' ||
        activeRaw === 'INACTIVE';
      if (isInactive) {
        inactiveByPayee[payee] = (inactiveByPayee[payee] || 0) + amt;
        inactiveTotal += amt;
        continue;
      }
      byPayee[payee] = (byPayee[payee] || 0) + amt;
      total += amt;
      payeeSet[payee] = true;
    }
    byMonth.push({
      month: monthHeader,
      total: round2_(total),
      byPayee: byPayee
    });
  }

  const anyCardRow = byMonth.some(function(m) {
    return m.total > 0.005;
  });
  if (!anyCardRow) return null;

  // Classify each payee as recurring vs spiky.
  const payees = Object.keys(payeeSet);
  const last3 = byMonth.slice(-3);
  const last6 = byMonth.slice(-6);
  const recurringPayees = [];
  const spikyPayees = [];
  payees.forEach(function(p) {
    let cnt3 = 0;
    let cnt6 = 0;
    last3.forEach(function(m) {
      if ((m.byPayee[p] || 0) > 0.005) cnt3++;
    });
    last6.forEach(function(m) {
      if ((m.byPayee[p] || 0) > 0.005) cnt6++;
    });
    if (cnt3 >= 2 || cnt6 >= 3) {
      recurringPayees.push(p);
    } else {
      spikyPayees.push(p);
    }
  });

  // Recurring monthly average per payee — averaged over the full last-6
  // window with missing months counted as 0 (conservative; a bill that only
  // hits every other month averages down).
  const windowSize = last6.length || 1;
  const byAccount = [];
  recurringPayees.forEach(function(p) {
    let sum = 0;
    last6.forEach(function(m) {
      sum += m.byPayee[p] || 0;
    });
    const avg = round2_(sum / windowSize);
    if (avg > 0.005) {
      byAccount.push({ account: p, monthly_average: avg });
    }
  });
  byAccount.sort(function(a, b) {
    return b.monthly_average - a.monthly_average;
  });
  const recurringBills = byAccount.map(function(a) {
    return { label: a.account, monthly_amount: a.monthly_average };
  });

  // Recurring per-month totals — used for the robust "recent monthly average"
  // (median of the last 3 months, avoids one-off spikes).
  const recurringMonthlyTotals = last6.map(function(m) {
    let sum = 0;
    recurringPayees.forEach(function(p) {
      sum += m.byPayee[p] || 0;
    });
    return round2_(sum);
  });
  const recentWindow = recurringMonthlyTotals.slice(
    -Math.min(3, recurringMonthlyTotals.length)
  );
  const recentMonthlyAverage = recentWindow.length
    ? round2_(median_(recentWindow))
    : 0;

  // Spiky card-funded spend over the trailing 4 months — proxy for the next
  // 120-day near-term spiky window. Tax-like seasonality and large one-offs
  // are caught here; the advisor uses this figure as the "planned card-funded
  // next 120 days" signal the UI already surfaces.
  const last4 = byMonth.slice(-4);
  let spikyNext120 = 0;
  last4.forEach(function(m) {
    spikyPayees.forEach(function(p) {
      spikyNext120 += m.byPayee[p] || 0;
    });
  });
  spikyNext120 = round2_(spikyNext120);

  // Confidence: more months of non-zero card rows = higher confidence.
  const monthsWithCardData = byMonth.filter(function(m) {
    return m.total > 0.005;
  }).length;
  const confidence =
    monthsWithCardData >= 3 ? 'high' : monthsWithCardData >= 1 ? 'medium' : 'low';

  // Per-month series for the debug / automation output contract.
  const recurringByMonth = byMonth.map(function(m) {
    let sum = 0;
    recurringPayees.forEach(function(p) {
      sum += m.byPayee[p] || 0;
    });
    return { month: m.month, amount: round2_(sum) };
  });
  const spikyByMonth = byMonth.map(function(m) {
    let sum = 0;
    spikyPayees.forEach(function(p) {
      sum += m.byPayee[p] || 0;
    });
    return { month: m.month, amount: round2_(sum) };
  });

  // Inactive CREDIT_CARD rows removed from the model — summarised for the
  // UI note + the "top inactive payees removed" debug list. Sorted by
  // amount descending so consumers can `.slice(0, N)` for a top-N view.
  const inactivePayeesRemoved = Object.keys(inactiveByPayee)
    .map(function(p) {
      return { account: p, amount: round2_(inactiveByPayee[p]) };
    })
    .filter(function(x) {
      return x.amount > 0.005;
    })
    .sort(function(a, b) {
      return b.amount - a.amount;
    });

  return {
    recent_monthly_average: recentMonthlyAverage,
    by_account: byAccount,
    recurring_bills: recurringBills,
    planned_card_funded_next_120_days: spikyNext120,
    // Planner surplus already nets these rows out (they live in the same
    // Cash Flow sheet). Subtracting again would double-count.
    already_in_cashflow: true,
    estimation_method: 'actual_recent',
    confidence: confidence,
    // Richer debug series — surfaced by the mapper to the UI/automation.
    recurring_card_spend_by_month: recurringByMonth,
    planned_or_spiky_card_spend_by_month: spikyByMonth,
    recurring_payees: recurringPayees.slice(),
    spiky_payees: spikyPayees.slice(),
    months_observed: byMonth.length,
    months_with_card_data: monthsWithCardData,
    // Active-filter bookkeeping (Part 4). Present on every payload so the
    // UI can decide whether to show the "Inactive card expenses are
    // excluded from recurring spend" note — even when zero rows were
    // removed, because the column itself being populated is meaningful.
    active_column_present: sawActiveColumn,
    inactive_card_spend_removed: round2_(inactiveTotal),
    inactive_payees_removed: inactivePayeesRemoved
  };
}

/**
 * Build the HELOC advisor's Bills-based card-obligation model — a forward
 * looking companion to `buildHelocFlowSourceCardSpend_`'s trailing history
 * signal. Reads INPUT - Bills (using the new "Payment Source" column) and
 * converts each active credit-card bill into:
 *   (a) a monthly equivalent burden, and
 *   (b) an actual next-120-day scheduled burden built from the bill's
 *       frequency, Start Month, and Due Day.
 *
 * Gracefully returns `null` when:
 *   - INPUT - Bills does not exist (legacy workbook),
 *   - required headers (Payee / Default Amount) are missing, or
 *   - the optional "Payment Source" column is absent (legacy tab —
 *     advisor falls back cleanly to the history-only path).
 *
 * Recurring vs spiky classification (Part 4):
 *   - recurring: monthly / biweekly / weekly / bimonthly
 *   - spiky   : quarterly / semi-annually / yearly (and anything that
 *               otherwise looks one-off like tax payments)
 *
 * Frequency handling (Part 3):
 *   - monthly       → monthly_equivalent = amount,       next_120d = walked
 *   - biweekly      → monthly_equivalent = amount*26/12, next_120d ≈ amount*⌊120/14⌋
 *   - weekly        → monthly_equivalent = amount*52/12, next_120d ≈ amount*⌊120/7⌋
 *   - bimonthly     → monthly_equivalent = amount/2,     next_120d = walked via Start Month cadence
 *   - quarterly     → monthly_equivalent = amount/3,     next_120d = walked via Start Month cadence
 *   - semi_annually → monthly_equivalent = amount/6,     next_120d = walked (hits 0–1× in window)
 *   - yearly        → monthly_equivalent = amount/12,    next_120d = walked (hits 0–1× in window)
 */
function buildHelocBillsCardObligationModel_(ss, anchorDate) {
  let sheet;
  try {
    sheet = getSheet_(ss, 'BILLS');
  } catch (e) {
    return null;
  }
  if (!sheet) return null;

  const values = sheet.getDataRange().getValues();
  const display = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return null;

  const headers = (display[0] || []).map(function(h) {
    return String(h == null ? '' : h).trim();
  });
  const payeeCol = headers.indexOf('Payee');
  const dueDayCol = headers.indexOf('Due Day');
  const defaultAmtCol = headers.indexOf('Default Amount');
  const activeCol = headers.indexOf('Active');
  const paymentSourceCol = headers.indexOf('Payment Source');
  const frequencyCol = headers.indexOf('Frequency');
  const startMonthCol = headers.indexOf('Start Month');
  const categoryCol = headers.indexOf('Category');

  // Payment Source is the opt-in signal for this layer. Legacy tabs without
  // it fall back cleanly — the existing history-based card-spend model
  // continues to work unchanged.
  if (paymentSourceCol === -1) return null;
  if (payeeCol === -1 || defaultAmtCol === -1) return null;

  const anchor = anchorDate instanceof Date && !isNaN(anchorDate.getTime())
    ? new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate())
    : new Date();
  const windowEnd = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + 120);

  const recurringByPayee = Object.create(null);
  const recurringPayeeSet = Object.create(null);
  const spikyByPayee = Object.create(null);
  const spikyPayeeSet = Object.create(null);
  const schedule = [];
  let totalRecurringMonthly = 0;
  let totalSpikyNext120 = 0;
  let activeCardBillCount = 0;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const displayRow = display[r] || [];
    const payee = String(displayRow[payeeCol] == null ? '' : displayRow[payeeCol]).trim();
    if (!payee) continue;

    // Normalize Payment Source — tolerant of "credit card", "Credit_Card",
    // "CREDIT-CARD" variants. Anything else (blank, CASH, typo) is skipped.
    const paymentSourceRaw = String(
      displayRow[paymentSourceCol] == null ? '' : displayRow[paymentSourceCol]
    )
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
    if (paymentSourceRaw !== 'CREDIT_CARD') continue;

    // Active filter: blank / missing column defaults to YES for backward
    // compatibility with legacy workbooks. Only explicit NO / N / FALSE /
    // INACTIVE kicks a row out.
    const activeRawDisplay = activeCol === -1
      ? ''
      : String(displayRow[activeCol] == null ? '' : displayRow[activeCol]).trim().toUpperCase();
    const isInactive =
      activeRawDisplay === 'NO' ||
      activeRawDisplay === 'N' ||
      activeRawDisplay === 'FALSE' ||
      activeRawDisplay === 'INACTIVE';
    if (isInactive) continue;

    const defaultAmt = Math.abs(Number(row[defaultAmtCol]) || 0);
    const dueDayRaw = dueDayCol === -1 ? 1 : Number(row[dueDayCol]) || 1;
    // Clamp to 1..28 so Feb doesn't shift the due date unexpectedly for
    // bills whose source uses 30/31. Matches the existing reader's spirit.
    const dueDay = Math.max(1, Math.min(28, Math.round(dueDayRaw)));
    const startMonthRaw = startMonthCol === -1 ? 1 : Number(row[startMonthCol]) || 1;
    const startMonth = Math.max(1, Math.min(12, Math.round(startMonthRaw)));
    const frequency = frequencyCol === -1
      ? 'monthly'
      : normalizeFrequency_(displayRow[frequencyCol]);
    const category = categoryCol === -1
      ? ''
      : String(displayRow[categoryCol] == null ? '' : displayRow[categoryCol]).trim();

    activeCardBillCount++;

    // Monthly equivalent burden (Part 3 conversion rules).
    let monthlyEquivalent = 0;
    switch (frequency) {
      case 'weekly':
        monthlyEquivalent = defaultAmt * 52 / 12;
        break;
      case 'biweekly':
        monthlyEquivalent = defaultAmt * 26 / 12;
        break;
      case 'bimonthly':
        monthlyEquivalent = defaultAmt / 2;
        break;
      case 'quarterly':
        monthlyEquivalent = defaultAmt / 3;
        break;
      case 'semi_annually':
        monthlyEquivalent = defaultAmt / 6;
        break;
      case 'yearly':
        monthlyEquivalent = defaultAmt / 12;
        break;
      case 'monthly':
      default:
        monthlyEquivalent = defaultAmt;
        break;
    }
    monthlyEquivalent = round2_(monthlyEquivalent);

    // Next-120-day scheduled burden: walk months for month-tiered
    // frequencies; approximate for sub-monthly cadence.
    let next120Total = 0;
    const next120Dates = [];
    if (frequency === 'biweekly') {
      const occurrences = Math.floor(120 / 14);
      next120Total = defaultAmt * occurrences;
    } else if (frequency === 'weekly') {
      const occurrences = Math.floor(120 / 7);
      next120Total = defaultAmt * occurrences;
    } else {
      // monthly / bimonthly / quarterly / semi_annually / yearly — honor
      // each bill's Start Month / Due Day so taxes and other seasonal
      // charges only land in the window when they really do.
      let cursor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      let guard = 0; // Sanity belt against an infinite loop on bad data.
      while (cursor <= windowEnd && guard < 14) {
        guard++;
        const monthNumber = cursor.getMonth() + 1;
        if (billAppliesInMonth_(frequency, startMonth, monthNumber)) {
          const occurDate = new Date(cursor.getFullYear(), cursor.getMonth(), dueDay);
          if (!isNaN(occurDate.getTime()) && occurDate >= anchor && occurDate <= windowEnd) {
            next120Total += defaultAmt;
            next120Dates.push(Utilities.formatDate(occurDate, 'UTC', 'yyyy-MM-dd'));
          }
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }
    next120Total = round2_(next120Total);

    // Classification (Part 4): monthly / biweekly / weekly / bimonthly =
    // recurring; quarterly / semi / yearly = spiky. Recurring payees are
    // summed as monthly equivalents; spiky payees are summed as
    // next-120-day dollars (the figures the UI actually uses).
    const isRecurring =
      frequency === 'monthly' ||
      frequency === 'biweekly' ||
      frequency === 'weekly' ||
      frequency === 'bimonthly';

    if (isRecurring) {
      recurringByPayee[payee] = round2_((recurringByPayee[payee] || 0) + monthlyEquivalent);
      totalRecurringMonthly += monthlyEquivalent;
      recurringPayeeSet[payee] = true;
    } else if (next120Total > 0.005) {
      spikyByPayee[payee] = round2_((spikyByPayee[payee] || 0) + next120Total);
      totalSpikyNext120 += next120Total;
      spikyPayeeSet[payee] = true;
    } else {
      // Spiky bill whose next occurrence is outside the 120-day window —
      // still classify the payee so the UI lists it (informational) but
      // contribute $0 to the near-term burden.
      spikyPayeeSet[payee] = true;
    }

    schedule.push({
      payee: payee,
      category: category,
      frequency: frequency,
      default_amount: round2_(defaultAmt),
      monthly_equivalent: monthlyEquivalent,
      next_120_day_burden: next120Total,
      next_120_day_dates: next120Dates,
      is_recurring: isRecurring
    });
  }

  const recurringCardBillsByPayee = Object.keys(recurringByPayee)
    .map(function(p) {
      return { account: p, monthly_equivalent: recurringByPayee[p] };
    })
    .filter(function(x) {
      return x.monthly_equivalent > 0.005;
    })
    .sort(function(a, b) {
      return b.monthly_equivalent - a.monthly_equivalent;
    });

  const upcomingCardBillsByPayee = Object.keys(spikyByPayee)
    .map(function(p) {
      return { account: p, next_120_day_burden: spikyByPayee[p] };
    })
    .filter(function(x) {
      return x.next_120_day_burden > 0.005;
    })
    .sort(function(a, b) {
      return b.next_120_day_burden - a.next_120_day_burden;
    });

  const confidence =
    activeCardBillCount === 0
      ? 'low'
      : activeCardBillCount < 3
      ? 'medium'
      : 'high';

  return {
    payment_source_column_present: true,
    active_card_bill_count: activeCardBillCount,
    recurring_monthly_equivalent_card_burden: round2_(totalRecurringMonthly),
    recurring_card_bills_by_payee: recurringCardBillsByPayee,
    upcoming_card_bills_next_120_days: round2_(totalSpikyNext120),
    upcoming_card_bills_by_payee: upcomingCardBillsByPayee,
    upcoming_card_bills_schedule: schedule,
    recurring_card_payees: Object.keys(recurringPayeeSet),
    spiky_card_payees: Object.keys(spikyPayeeSet),
    estimation_method: 'bills_scheduled',
    confidence: confidence
  };
}

/**
 * Combine the trailing Cash-Flow history card-spend signal with the
 * forward-looking Bills-based card-obligation model (Part 5). Applies the
 * conservative "max" rule: whichever source reports the larger burden
 * wins, so the HELOC realism layer never under-counts card pressure.
 *
 * Returns a small burden-selection block that the `card_spend` snapshot
 * embeds alongside the raw history fields; the React mapper surfaces all
 * of these as-is for UI transparency + debug.
 */
function buildHelocCombinedCardBurden_(historyCardSpend, billsObligationModel) {
  const hist = historyCardSpend && typeof historyCardSpend === 'object'
    ? historyCardSpend
    : null;
  const bills = billsObligationModel && typeof billsObligationModel === 'object'
    ? billsObligationModel
    : null;

  const histRecurring = hist && Number.isFinite(Number(hist.recent_monthly_average))
    ? Math.max(0, Number(hist.recent_monthly_average))
    : 0;
  // The history model currently uses `planned_card_funded_next_120_days` as
  // its near-term spiky signal (trailing-4-month sum of spiky payees,
  // treated as a proxy for what's likely to recur in the next 120 days).
  const histSpiky = hist && Number.isFinite(Number(hist.planned_card_funded_next_120_days))
    ? Math.max(0, Number(hist.planned_card_funded_next_120_days))
    : 0;

  const billsRecurring = bills ? Math.max(0, Number(bills.recurring_monthly_equivalent_card_burden) || 0) : 0;
  const billsSpiky = bills ? Math.max(0, Number(bills.upcoming_card_bills_next_120_days) || 0) : 0;

  const chosenRecurring = Math.max(histRecurring, billsRecurring);
  const chosenSpiky = Math.max(histSpiky, billsSpiky);

  let recurringDecision;
  if (!hist && !bills) recurringDecision = 'no_data';
  else if (!hist) recurringDecision = 'bills_only';
  else if (!bills) recurringDecision = 'history_only';
  else if (billsRecurring > histRecurring + 0.005) recurringDecision = 'bills_dominated';
  else if (histRecurring > billsRecurring + 0.005) recurringDecision = 'history_dominated';
  else recurringDecision = 'tied';

  let spikyDecision;
  if (!hist && !bills) spikyDecision = 'no_data';
  else if (!hist) spikyDecision = 'bills_only';
  else if (!bills) spikyDecision = 'history_only';
  else if (billsSpiky > histSpiky + 0.005) spikyDecision = 'bills_dominated';
  else if (histSpiky > billsSpiky + 0.005) spikyDecision = 'history_dominated';
  else spikyDecision = 'tied';

  return {
    historical_recurring_card_spend: round2_(histRecurring),
    historical_spiky_card_spend_next_120_days: round2_(histSpiky),
    bills_recurring_card_burden: round2_(billsRecurring),
    bills_spiky_card_burden_next_120_days: round2_(billsSpiky),
    chosen_recurring_card_burden: round2_(chosenRecurring),
    chosen_spiky_card_burden_next_120_days: round2_(chosenSpiky),
    source_decision: recurringDecision,
    spiky_source_decision: spikyDecision
  };
}

/**
 * Merge the history-based `card_spend` block with the Bills-based
 * obligation model (Part 6). Produces the single `card_spend` payload
 * the React advisor consumes — with the chosen (max) burden baked into
 * `recent_monthly_average` + `spiky_card_spend_next_120_days` so all
 * downstream logic (trap model, safe-draw sizing) automatically picks up
 * the combined signal.
 *
 * Returns `null` when neither source has anything to report — caller
 * falls back to the legacy "no data" path.
 */
function buildHelocCardSpendCombinedPayload_(historyCardSpend, billsObligationModel) {
  if (!historyCardSpend && !billsObligationModel) return null;

  const combined = buildHelocCombinedCardBurden_(historyCardSpend, billsObligationModel);

  // Base payload: clone history shape when present so the rich per-month
  // series / payee classification already threaded through the mapper
  // keeps working. Otherwise scaffold a minimal block seeded from Bills.
  const base = historyCardSpend
    ? Object.assign({}, historyCardSpend)
    : {
        recent_monthly_average: 0,
        by_account: [],
        recurring_bills: [],
        planned_card_funded_next_120_days: 0,
        // Bills themselves don't tell us whether CF surplus already nets
        // them out. Assume YES — the pragmatic guard against
        // double-counting. Planner CF sheets typically include bill rows
        // in the same expense totals feeding the surplus, so subtracting
        // again would double-count.
        already_in_cashflow: true,
        estimation_method: 'bills_scheduled',
        confidence: billsObligationModel && billsObligationModel.confidence
          ? billsObligationModel.confidence
          : 'low',
        recurring_card_spend_by_month: [],
        planned_or_spiky_card_spend_by_month: [],
        recurring_payees: [],
        spiky_payees: [],
        months_observed: 0,
        months_with_card_data: 0,
        active_column_present: false,
        inactive_card_spend_removed: 0,
        inactive_payees_removed: []
      };

  // Override the advisor's primary drivers with the chosen (max) values so
  // the existing React estimation ladder picks up the combined signal
  // without code changes on the client.
  base.recent_monthly_average = combined.chosen_recurring_card_burden;
  base.spiky_card_spend_next_120_days = combined.chosen_spiky_card_burden_next_120_days;

  // If both sources contributed, bump the method label so the UI
  // confidence string reflects the combined derivation.
  if (historyCardSpend && billsObligationModel) {
    base.estimation_method = 'combined_history_and_bills';
  }

  // Expose the full burden-selection block for UI transparency + debug.
  base.historical_recurring_card_spend = combined.historical_recurring_card_spend;
  base.historical_spiky_card_spend_next_120_days = combined.historical_spiky_card_spend_next_120_days;
  base.bills_recurring_card_burden = combined.bills_recurring_card_burden;
  base.bills_spiky_card_burden_next_120_days = combined.bills_spiky_card_burden_next_120_days;
  base.chosen_recurring_card_burden = combined.chosen_recurring_card_burden;
  base.chosen_spiky_card_burden_next_120_days = combined.chosen_spiky_card_burden_next_120_days;
  base.source_decision = combined.source_decision;
  base.spiky_source_decision = combined.spiky_source_decision;

  if (billsObligationModel) {
    base.bills_payment_source_column_present = true;
    base.active_card_bill_count = billsObligationModel.active_card_bill_count;
    base.recurring_card_bills_from_bills = billsObligationModel.recurring_card_bills_by_payee;
    base.upcoming_card_bills_from_bills = billsObligationModel.upcoming_card_bills_by_payee;
    base.upcoming_card_bills_schedule = billsObligationModel.upcoming_card_bills_schedule;
    base.recurring_card_payees_from_bills = billsObligationModel.recurring_card_payees;
    base.spiky_card_payees_from_bills = billsObligationModel.spiky_card_payees;
  } else {
    base.bills_payment_source_column_present = false;
    base.active_card_bill_count = 0;
    base.recurring_card_bills_from_bills = [];
    base.upcoming_card_bills_from_bills = [];
    base.upcoming_card_bills_schedule = [];
    base.recurring_card_payees_from_bills = [];
    base.spiky_card_payees_from_bills = [];
  }

  return base;
}

/**
 * TEMPORARY DEBUG — verify exactly what the HELOC Flow Source reader sees.
 *
 * Walks the same `history` the advisor uses (trimmed to last 6 months to
 * match `buildHelocFlowSourceCardSpend_`), plus inspects each underlying
 * Cash Flow sheet directly to report:
 *   - sheets scanned + their exact names,
 *   - header-row presence of "Flow Source",
 *   - first 5 header cells of each sheet,
 *   - detected column indices for Type / Flow Source / Payee,
 *   - months included in the rolling window,
 *   - per-month & overall CREDIT_CARD match counts,
 *   - a 10-row sample of matching rows (sheet/payee/month/amount),
 *   - whether the advisor payload will use the Flow Source data or fall
 *     back to legacy / no-data behavior.
 *
 * No logic change — purely observational. Also mirrored via `Logger.log`
 * so the Apps Script execution log shows the same numbers.
 */
function buildHelocFlowSourceDebug_(ss, history, cardSpendResult) {
  const debug = {
    generated_at: new Date().toISOString(),
    advisor_will_use_flow_source_data: Boolean(cardSpendResult),
    fallback_reason: null,
    history_months_in_scope: [],
    sheets_scanned: [],
    credit_card_match_count: 0,
    credit_card_match_count_by_month: [],
    credit_card_sample_rows: [],
    // Active-column bookkeeping (Part 4). Mirrors what the advisor payload
    // carries so debug consumers can see what was filtered out and why.
    active_column_present: cardSpendResult
      ? Boolean(cardSpendResult.active_column_present)
      : false,
    inactive_card_spend_removed: cardSpendResult
      ? Number(cardSpendResult.inactive_card_spend_removed) || 0
      : 0,
    inactive_payees_removed: cardSpendResult
      ? (cardSpendResult.inactive_payees_removed || []).slice(0, 10)
      : [],
    inactive_sample_rows: [],
    notes: []
  };

  if (!Array.isArray(history) || !history.length) {
    debug.fallback_reason = 'history array is empty';
    try {
      Logger.log('[HELOC-FLOW-DEBUG] %s', JSON.stringify(debug));
    } catch (e) {}
    return debug;
  }

  // The advisor scans only the last 6 months of history. Mirror that here so
  // the debug matches what `buildHelocFlowSourceCardSpend_` actually consumed.
  const recent = history.slice(-6);
  debug.history_months_in_scope = recent.map(function(h) {
    return {
      month_header: h.monthHeader,
      month_has_cf_data: Boolean(h.monthHasCfData),
      rows_in_month: Array.isArray(h.rows) ? h.rows.length : 0
    };
  });

  // De-dupe sheets: one debug entry per distinct YYYY referenced by the
  // month window. We pull the sheet's header row directly to avoid trusting
  // the cached row objects (which normalize keys via `readCashFlowSheetAsObjects_`).
  const yearsSeen = Object.create(null);
  for (let i = 0; i < recent.length; i++) {
    const entry = recent[i];
    const d = entry.monthDate;
    if (!(d instanceof Date)) continue;
    const yr = d.getFullYear();
    if (yearsSeen[yr]) continue;
    yearsSeen[yr] = true;
    const sheetName = getCashFlowSheetName_(yr);
    const sheet = ss.getSheetByName(sheetName);
    const entryOut = {
      year: yr,
      sheet_name: sheetName,
      sheet_exists: Boolean(sheet),
      flow_source_header_found: false,
      active_header_found: false,
      first_5_header_cells: [],
      header_row_length: 0,
      type_col_index_zero_based: -1,
      flow_source_col_index_zero_based: -1,
      payee_col_index_zero_based: -1,
      active_col_index_zero_based: -1,
      rows_below_header: 0
    };
    if (sheet) {
      try {
        const lastCol = sheet.getLastColumn();
        const headers =
          sheet.getRange(1, 1, 1, Math.max(1, lastCol)).getDisplayValues()[0] || [];
        entryOut.header_row_length = headers.length;
        entryOut.first_5_header_cells = headers.slice(0, 5).map(function(h) {
          return String(h || '');
        });
        for (let c = 0; c < headers.length; c++) {
          const h = String(headers[c] || '').trim();
          const hLower = h.toLowerCase();
          if (hLower === 'type' && entryOut.type_col_index_zero_based === -1) {
            entryOut.type_col_index_zero_based = c;
          } else if (
            (hLower === 'flow source' || hLower === 'flow_source') &&
            entryOut.flow_source_col_index_zero_based === -1
          ) {
            entryOut.flow_source_col_index_zero_based = c;
            entryOut.flow_source_header_found = true;
          } else if (hLower === 'payee' && entryOut.payee_col_index_zero_based === -1) {
            entryOut.payee_col_index_zero_based = c;
          } else if (hLower === 'active' && entryOut.active_col_index_zero_based === -1) {
            entryOut.active_col_index_zero_based = c;
            entryOut.active_header_found = true;
          }
        }
        entryOut.rows_below_header = Math.max(0, sheet.getLastRow() - 1);
      } catch (e) {
        entryOut.error = 'Header inspection failed: ' + (e && e.message ? e.message : String(e));
      }
    }
    debug.sheets_scanned.push(entryOut);
  }

  // Count CREDIT_CARD matches & collect a 10-row sample, using the SAME
  // normalization rule the advisor applies (Type=Expense, Flow Source
  // canonicalized to CREDIT_CARD). `monthMatches` only counts ACTIVE rows
  // so the per-month count aligns with what feeds the recurring/spiky math.
  let totalMatches = 0;
  const countByMonth = [];
  const sample = [];
  const inactiveSample = [];
  const SAMPLE_CAP = 10;

  for (let mi = 0; mi < recent.length; mi++) {
    const entry = recent[mi];
    const rows = entry.rows || [];
    const monthHeader = entry.monthHeader;
    const sheetNameForMonth =
      entry.monthDate instanceof Date
        ? getCashFlowSheetName_(entry.monthDate.getFullYear())
        : '';
    let monthMatches = 0;
    let monthInactive = 0;
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const typ = String(row.Type || '').trim().toUpperCase();
      if (typ !== 'EXPENSE') continue;
      const rawFs = row['Flow Source'];
      // Preserve raw value in sample so the user can spot typos like leading
      // whitespace or a weird unicode hyphen.
      const fs = String(rawFs || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');
      if (fs !== 'CREDIT_CARD') continue;
      const rawActive = row.Active;
      const activeStr = String(rawActive == null ? '' : rawActive).trim().toUpperCase();
      const isInactive =
        activeStr === 'NO' ||
        activeStr === 'N' ||
        activeStr === 'FALSE' ||
        activeStr === 'INACTIVE';
      if (isInactive) {
        monthInactive++;
        if (inactiveSample.length < SAMPLE_CAP) {
          const payee = String(row.Payee || '').trim();
          const amt = readCashFlowMonthAmount_(row, monthHeader);
          inactiveSample.push({
            sheet_name: sheetNameForMonth,
            payee: payee,
            month: monthHeader,
            amount: round2_(amt),
            raw_active_value: rawActive == null ? null : String(rawActive)
          });
        }
        continue;
      }
      monthMatches++;
      totalMatches++;
      if (sample.length < SAMPLE_CAP) {
        const payee = String(row.Payee || '').trim();
        const amt = readCashFlowMonthAmount_(row, monthHeader);
        sample.push({
          sheet_name: sheetNameForMonth,
          payee: payee,
          month: monthHeader,
          amount: round2_(amt),
          raw_flow_source_value: rawFs == null ? null : String(rawFs)
        });
      }
    }
    countByMonth.push({
      month: monthHeader,
      sheet_name: sheetNameForMonth,
      credit_card_row_count: monthMatches,
      inactive_credit_card_row_count: monthInactive
    });
  }
  debug.credit_card_match_count = totalMatches;
  debug.credit_card_match_count_by_month = countByMonth;
  debug.credit_card_sample_rows = sample;
  debug.inactive_sample_rows = inactiveSample;

  // Fill in the "why is the advisor not using Flow Source data" reason when
  // the helper returned null.
  if (!cardSpendResult) {
    const anyHeader = debug.sheets_scanned.some(function(s) {
      return s.flow_source_header_found;
    });
    if (!anyHeader) {
      debug.fallback_reason =
        'No scanned sheet had a "Flow Source" header in row 1';
    } else if (!totalMatches) {
      debug.fallback_reason =
        'Flow Source header present but no Expense rows had Flow Source = CREDIT_CARD';
    } else {
      debug.fallback_reason =
        'Helper returned null for another reason (inspect Logger.log for details)';
    }
  }

  if (debug.sheets_scanned.length === 0) {
    debug.notes.push('No sheets were scanned — history array had no usable monthDate entries.');
  }

  try {
    Logger.log('[HELOC-FLOW-DEBUG] %s', JSON.stringify(debug));
  } catch (e) {
    // Logger.log on extremely large payloads can fail; ignore silently.
  }

  return debug;
}

function buildCreditCardSpendMeta_(history, debts) {
  const cardNames = debts
    .filter(function(d) {
      return String(d.type).trim() === 'Credit Card' && d.active;
    })
    .map(function(d) {
      return d.name;
    });

  const payeeTotalsByMonth = [];
  history.forEach(function(h) {
    let ccTotal = 0;
    const byPayee = Object.create(null);
    h.normalized.lineItems.forEach(function(li) {
      if (!isExpenseLine_(li)) return;
      const p = String(li.payee || '').trim();
      if (cardNames.indexOf(p) === -1) return;
      const amt = Math.abs(li.amount);
      ccTotal += amt;
      byPayee[p] = (byPayee[p] || 0) + amt;
    });
    payeeTotalsByMonth.push({ month: h.monthHeader, ccTotal: round2_(ccTotal), byPayee: byPayee });
  });

  const statementData = false;
  const confidence = statementData ? 'MEDIUM' : 'LOW';

  const spikes = [];
  if (payeeTotalsByMonth.length >= 2) {
    const last = payeeTotalsByMonth[payeeTotalsByMonth.length - 1];
    const prev = payeeTotalsByMonth.slice(0, -1);
    const totals = prev.map(function(x) {
      return x.ccTotal;
    });
    const medTotal = median_(totals.slice(-6));
    if (medTotal >= 500 && last.ccTotal > 1.3 * medTotal) {
      spikes.push({
        kind: 'PORTFOLIO_CC',
        message: 'Total CC cash-out this month exceeds 130% of trailing 6-month median — review timing and true spend vs payments.'
      });
    }

    cardNames.forEach(function(nm) {
      const series = payeeTotalsByMonth.map(function(x) {
        return x.byPayee[nm] || 0;
      });
      const hist = series.slice(0, -1);
      const cur = series[series.length - 1] || 0;
      if (hist.length >= 3) {
        const med = median_(hist.slice(-6));
        if (med >= 500 && cur > 1.5 * med && cur - med >= 500) {
          spikes.push({ kind: 'PAYEE_CC', payee: nm, message: 'Elevated vs trailing 6-month median for this card payee.' });
        }
      }
    });
  }

  return {
    confidence: confidence,
    statement_balance_tracking: statementData,
    spikes: spikes
  };
}

function buildSanDiegoLossSeries_(history, maxLen, aliasMap) {
  const refSdRent = normalizeName_(ROLLING_DP_SD_RENT_PAYEE_, aliasMap);
  const costRefs = ROLLING_DP_SD_COST_PAYEES_.map(function(c) {
    return normalizeName_(c, aliasMap);
  });
  const series = [];
  history.slice(-maxLen).forEach(function(h) {
    let rent = 0;
    let exp = 0;
    if (h.rows) {
      h.rows.forEach(function(r) {
        if (String(r.Type || '')
            .trim()
            .toUpperCase() === 'INCOME' &&
          cashFlowCellIsPresent_(r, h.monthHeader) &&
          normalizePayeeKey_(r.Payee, aliasMap) === refSdRent
        ) {
          rent += readCashFlowMonthAmount_(r, h.monthHeader);
        }
      });
      h.rows.forEach(function(r) {
        if (String(r.Type || '')
            .trim()
            .toUpperCase() !== 'EXPENSE') {
          return;
        }
        if (!cashFlowCellIsPresent_(r, h.monthHeader)) return;
        const nk = normalizePayeeKey_(r.Payee, aliasMap);
        const raw = String(r.Payee || '').trim();
        const amt = Math.abs(readCashFlowMonthAmount_(r, h.monthHeader));
        if (nk === refSdRent) return;
        if (costRefs.indexOf(nk) >= 0 || (raw.toLowerCase().indexOf('san diego') >= 0 && isSdUtilityOrMaintenancePayee_(raw))) {
          exp += amt;
        }
      });
    } else {
      h.normalized.lineItems.forEach(function(li) {
        const p = String(li.payee || '').trim();
        const low = p.toLowerCase();
        if (isIncomeLine_(li) && normalizeName_(li.payee, aliasMap) === refSdRent) {
          rent += li.amount;
        }
        if (isExpenseLine_(li) && low.indexOf('san diego') >= 0 && normalizeName_(li.payee, aliasMap) !== refSdRent) {
          exp += Math.abs(li.amount);
        }
      });
    }
    series.push(round2_(exp - rent));
  });
  return series;
}

function buildRollingTriggers_(history, debts, anchorNorm, ccMeta, sdSeries) {
  const triggers = [];

  ccMeta.spikes.forEach(function(s) {
    triggers.push({ level: 'INFO', code: s.kind, message: s.message });
  });

  if (sdSeries.length >= 6) {
    const avg =
      sdSeries.reduce(function(a, b) {
        return a + b;
      }, 0) / sdSeries.length;
    if (avg > ROLLING_DP_SD_REVIEW_LOSS_) {
      triggers.push({
        level: 'WARN',
        code: 'SAN_DIEGO_REVIEW',
        message:
          'Trailing average San Diego-oriented expense minus Rent San Diego House income exceeds $' +
          ROLLING_DP_SD_REVIEW_LOSS_ +
          '/month (advisory HOLD/REVIEW).'
      });
    }
  }

  const minTot = round2_(
    debts
      .filter(function(d) {
        return d.active;
      })
      .reduce(function(s, d) {
        return s + d.minimumPayment;
      }, 0)
  );

  triggers.push({
    level: 'INFO',
    code: 'DEBT_MINS_REFERENCE',
    message:
      'Sum of active minimum payments: ' +
      fmtCurrency_(minTot) +
      ' — context only; Cash Flow drives realized cash out.'
  });

  triggers.push({
    level: 'INFO',
    code: 'STABILITY_GUARDRAIL',
    message:
      'Projection does not change on a single outlier month; use 2–3 consecutive months of signal before treating a shift as structural (manual review).'
  });

  return triggers;
}

function computeIrregularExpenseNote_(history, aliasMap) {
  let spikeCount = 0;
  const irregularAnchorPayees = [];
  const payeeMatrix = buildAlignedPayeeExpenses_(history, aliasMap);
  Object.keys(payeeMatrix).forEach(function(p) {
    const w = payeeMatrix[p];
    if (w.length < 2) return;
    const prior = w.length >= 7 ? w.slice(-7, -1) : w.slice(0, -1);
    if (!prior.length) return;
    const med = median_(prior);
    const lastAmt = w[w.length - 1] || 0;
    if (med > 0 && lastAmt > 2 * med) {
      spikeCount++;
      irregularAnchorPayees.push(p);
    }
  });
  return {
    irregular_payees_this_month: spikeCount,
    irregular_anchor_payees: irregularAnchorPayees,
    confidence: spikeCount > 0 ? 'MEDIUM' : 'HIGH',
    note:
      'Recurring baseline uses trailing medians; payees with anchor-month spend >2× prior-window median are flagged as likely irregular (separate from recurring baseline).'
  };
}

function computeOverallPlanConfidence_(ccMeta, irregularNote, forward, forceLow) {
  let label = 'HIGH';
  if (forceLow) {
    label = 'LOW';
  } else if (ccMeta.confidence === 'LOW' || irregularNote.confidence === 'LOW' || forward.expenseConfidence === 'LOW') {
    label = 'MEDIUM';
  }
  if (!forceLow && ccMeta.confidence === 'LOW' && forward.expenseConfidence === 'LOW') {
    label = 'LOW';
  }
  const rubric =
    'Starts at HIGH; capped to MEDIUM when card spend is payment-only (LOW) or expense projection is thin; LOW when both card context and forward expense data are weak, or plan is INVALID/empty.';
  return { label: label, rubric: rubric };
}

function classifyRollingCashPressure_(row, reserve) {
  const end = Number(row.ending_cash) || 0;
  if (end < reserve - 0.5) return 'High';
  if (end < reserve + 3000) return 'Moderate';
  return 'Low';
}

function buildNext3MonthPreview_(next12, reserve) {
  const out = [];
  const n = Math.min(3, (next12 || []).length);
  for (let i = 0; i < n; i++) {
    const r = next12[i];
    const extra = Number(r.extra_debt_payment) || 0;
    const execNow = Number(r.execution_total_now) || 0;
    const extraForLikely = i === 0 && execNow > 0.005 ? execNow : extra;
    const end = Number(r.ending_cash) || 0;
    out.push({
      month: r.month,
      expected_cash_pressure: classifyRollingCashPressure_(r, reserve),
      expected_debt_focus: String(r.focus_debt || '—'),
      extra_payments_likely: extraForLikely > 500 ? 'Yes' : 'Unlikely',
      reserve_stress_likely: end < reserve + 2000 ? 'Yes' : 'No'
    });
  }
  return out;
}

/**
 * Short explanations when aggressive mode still routes material dollars to secondary/overflow.
 */
function rollingAggressiveSpilloverExplainLines_(r0, planInvalid, primaryShow, secondaryShow, overflowShow) {
  const lines = [];
  if (planInvalid) return lines;
  let sec = 0;
  let ov = 0;
  (secondaryShow || []).forEach(function(e) {
    sec = round2_(sec + (Number(e.amt) || 0));
  });
  (overflowShow || []).forEach(function(e) {
    ov = round2_(ov + (Number(e.amt) || 0));
  });
  if (sec <= 0.005 && ov <= 0.005) return lines;
  lines.push('Aggressive routing note (non-primary dollars):');
  if (sec > 0.005) {
    lines.push(
      '- Secondary: ' +
        fmtCurrency_(sec) +
        ' — primary hit payoff/cap first; remainder went to next APR target per waterfall.'
    );
  }
  if (ov > 0.005) {
    lines.push(
      '- Overflow/other: ' +
        fmtCurrency_(ov) +
        ' — split timing, non-CC rows, or name-map mismatch vs APR pair; review execution map keys.'
    );
  }
  return lines;
}

/**
 * Appends strict SYS–Accounts cash bridge (10 steps + execution cap) for auditability.
 * @param {string[]} lines
 * @param {Record<string, unknown>} cap cash_policy_pools from buildAccountCashAvailabilityModel_
 */
function appendRollingCashBridgeAuditLines_(lines, cap) {
  if (!cap || cap.liquid_total_sheet == null || cap.liquid_total_sheet !== cap.liquid_total_sheet) return;
  function f_(k) {
    return fmtCurrency_(round2_(Number(cap[k]) || 0));
  }
  lines.push('=== cash_bridge (auditable) ===');
  lines.push('01_liquid_total_sheet: ' + f_('liquid_total_sheet'));
  lines.push('02_minus_do_not_touch_excluded: ' + f_('do_not_touch_excluded_cash'));
  lines.push('03_policy_eligible_cash_before_buffers: ' + f_('policy_eligible_cash_before_buffers'));
  lines.push('04_minus_account_min_buffers_total: ' + f_('account_min_buffers_total'));
  lines.push('05_total_usable_cash: ' + f_('total_usable_cash'));
  lines.push('06_minus_reserve_hold: ' + f_('reserve_hold'));
  lines.push('07_minus_global_buffer_hold: ' + f_('global_buffer_hold'));
  lines.push('08_minus_near_term_planned_cash_hold: ' + f_('near_term_planned_cash_hold'));
  lines.push('09_minus_unmapped_card_risk_hold: ' + f_('unmapped_card_risk_hold'));
  lines.push('10_final_execute_now_cash: ' + f_('final_execute_now_cash'));
  lines.push('monthly_execution_cap: ' + f_('monthly_execution_cap'));
  lines.push('executable_now_budget_min_final_and_cap: ' + f_('executable_now_budget'));
  if (cap.unsupported_policy_balance_total != null && Number(cap.unsupported_policy_balance_total) > 0.005) {
    lines.push('note_unsupported_policy_balance_on_sheet: ' + f_('unsupported_policy_balance_total'));
  }
  if (cap.bridge_per_account_floor_delta != null && Math.abs(Number(cap.bridge_per_account_floor_delta) || 0) > 0.02) {
    lines.push('note_per_account_floor_vs_linear_buffers: ' + f_('bridge_per_account_floor_delta'));
  }
  if (cap.liquid_reconciliation_delta != null && Math.abs(Number(cap.liquid_reconciliation_delta) || 0) > 0.02) {
    lines.push('note_liquid_sheet_reconciliation_delta: ' + f_('liquid_reconciliation_delta'));
  }
  if (cap.cash_bridge_validation_warnings && cap.cash_bridge_validation_warnings.length) {
    cap.cash_bridge_validation_warnings.forEach(function(w) {
      lines.push('WARNING: ' + String(w || ''));
    });
  }
  lines.push('');
}

/**
 * Machine-oriented execution plan (no narrative paragraphs, full account names).
 */
function buildThisMonthExecutionPlanAutomationFormat_(row0, planInvalid, renderCtx) {
  renderCtx = renderCtx || {};
  const failed = [];
  const r0 = row0 || {};
  const reserve = ROLLING_DP_RESERVE_DEFAULT_;
  const bufDefault = ROLLING_DP_BUFFER_ABOVE_RESERVE_;
  const liqIn = r0.liquidity_summary || {};
  const monthTitle = String(r0.month || '').trim() || '—';
  const confidenceStr = String(renderCtx.overall_confidence || 'MEDIUM').trim();
  const next3 = renderCtx.next_3_month_preview || [];

  const totalCash =
    liqIn.total_cash != null && liqIn.total_cash === liqIn.total_cash
      ? round2_(liqIn.total_cash)
      : round2_(Number(r0.starting_cash) || 0);
  const reserveTarget =
    liqIn.reserve_target != null && liqIn.reserve_target === liqIn.reserve_target
      ? round2_(liqIn.reserve_target)
      : round2_(reserve);
  const bufferProtected =
    liqIn.buffer_above_reserve != null && liqIn.buffer_above_reserve === liqIn.buffer_above_reserve
      ? round2_(liqIn.buffer_above_reserve)
      : round2_(bufDefault);
  const nearTermReservedExec =
    liqIn.near_term_planned_cash_reserved != null && liqIn.near_term_planned_cash_reserved === liqIn.near_term_planned_cash_reserved
      ? round2_(liqIn.near_term_planned_cash_reserved)
      : 0;
  const unmappedCashRiskExecAuto =
    liqIn.unmapped_card_funded_cash_risk != null && liqIn.unmapped_card_funded_cash_risk === liqIn.unmapped_card_funded_cash_risk
      ? round2_(liqIn.unmapped_card_funded_cash_risk)
      : 0;
  const deployableAfter =
    liqIn.deployable_cash_after_protections != null &&
    liqIn.deployable_cash_after_protections === liqIn.deployable_cash_after_protections
      ? round2_(liqIn.deployable_cash_after_protections)
      : liqIn.deployable_cash != null && liqIn.deployable_cash === liqIn.deployable_cash
        ? round2_(liqIn.deployable_cash)
        : round2_(
            Math.max(0, totalCash - reserveTarget - bufferProtected - nearTermReservedExec - unmappedCashRiskExecAuto)
          );
  let cashAvailExtra =
    r0.execution_extra_cash_total != null && r0.execution_extra_cash_total === r0.execution_extra_cash_total
      ? round2_(r0.execution_extra_cash_total)
      : round2_(sumRollingAllocMap_(r0.extra_principal_allocations_execution_now || {}));
  const capPoolsAuto = r0.cash_policy_pools || {};
  if (
    !planInvalid &&
    capPoolsAuto.final_execute_now_cash != null &&
    capPoolsAuto.final_execute_now_cash === capPoolsAuto.final_execute_now_cash
  ) {
    cashAvailExtra = round2_(Math.min(cashAvailExtra, round2_(Number(capPoolsAuto.final_execute_now_cash) || 0)));
  }
  const helocUsed =
    liqIn.heloc_draw_this_month != null && liqIn.heloc_draw_this_month === liqIn.heloc_draw_this_month
      ? round2_(liqIn.heloc_draw_this_month)
      : round2_(Number(r0.heloc_draw_this_month) || 0);
  const helocRec = planInvalid
    ? 'No'
    : String(r0.heloc_recommendation_execution || liqIn.heloc_recommended_now || 'No').trim() || 'No';
  let helocRecShort = 'No';
  if (!planInvalid) {
    if (helocUsed >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_) {
      helocRecShort = 'Yes';
    } else {
      const hr = helocRec.toLowerCase();
      if (
        hr !== 'no' &&
        hr &&
        (hr.indexOf('yes') >= 0 ||
          hr.indexOf('optional') >= 0 ||
          hr.indexOf('consider') >= 0 ||
          hr.indexOf('recommend') >= 0)
      ) {
        helocRecShort = 'Yes';
      }
    }
  }
  const execCashMap = r0.extra_principal_allocations_execution_now || {};
  const condVarMap = r0.extra_principal_allocations_conditional_variable || {};
  const execCashSum = sumRollingAllocMap_(execCashMap);
  const condVarSum =
    r0.conditional_variable_extra_total != null && r0.conditional_variable_extra_total === r0.conditional_variable_extra_total
      ? round2_(r0.conditional_variable_extra_total)
      : sumRollingAllocMap_(condVarMap);
  const execTotalNow =
    r0.execution_total_now != null && r0.execution_total_now === r0.execution_total_now
      ? round2_(r0.execution_total_now)
      : round2_(execCashSum + helocUsed);
  const execCashDisplayed = planInvalid ? 0 : execCashSum;
  const execTotalDisplayed = planInvalid ? 0 : execTotalNow;
  const condVarDisplayed = planInvalid ? 0 : condVarSum;
  const helocDisplayed = planInvalid ? 0 : helocUsed;
  const helocExecAmount = !planInvalid && helocUsed >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_ ? helocDisplayed : 0;
  const eca = r0.execution_concentration_analysis;
  const interestAllocationExecutionOk = !planInvalid && (!eca || eca.concentration_leak !== true);
  const belowReserve = (Number(r0.ending_cash) || 0) < reserveTarget - 0.5;
  const primaryP =
    String(r0.primary_priority_debt != null ? r0.primary_priority_debt : r0.focus_debt || '—').trim() || '—';
  const cleanupNames = [];
  if (eca && eca.cleanup_items) {
    eca.cleanup_items.forEach(function(c) {
      if (c && c.name) cleanupNames.push(String(c.name));
    });
  }
  const cleanupTargetsNamesOnly = cleanupNames.length
    ? cleanupNames.slice(0, 12).join('|')
    : String(r0.cleanup_target_debt != null ? r0.cleanup_target_debt : '—')
        .split(',')
        .map(function(s) {
          return String(s || '').trim();
        })
        .filter(Boolean)
        .slice(0, 12)
        .join('|') || '—';

  const startSnap = r0.debt_balances_start || [];
  const anchorCfPaidByDebt = r0.anchor_cf_paid_by_debt || {};
  function anchorCfPaidForName_(nm) {
    return round2_(Number(anchorCfPaidByDebt[nm]) || 0);
  }
  const activeForSort = startSnap
    .filter(function(d) {
      return d.balance > 0.005;
    })
    .map(function(d) {
      return {
        name: d.name,
        type: String(d.type || '').trim(),
        balance: d.balance,
        minimumPayment: round2_(Number(d.minimumPayment) || 0)
      };
    });
  const ordered = sortActiveDebtLikeWaterfall_(activeForSort);

  function orderIndexForExtra_(name) {
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].name === name) return i;
    }
    return 9999;
  }

  const modeRawAll = String(renderCtx.execution_plan_mode || '')
    .toLowerCase()
    .trim();
  const modesListAll = modeRawAll.split(/[\s,|]+/).filter(Boolean);
  let aggressivePhase2Audit = null;
  if (modesListAll.indexOf('aggressive') >= 0 && !planInvalid) {
    aggressivePhase2Audit = buildAggressivePhase2Audit_(r0.opening_concentration_meta, r0.deployable_concentration_meta);
  }

  const lines = [];
  lines.push('=== summary ===');
  lines.push('schema: rolling_debt_execution_v1');
  lines.push('plan_status: ' + ROLLING_DP_PLAN_STATUS_PLACEHOLDER_);
  lines.push('anchor_month: ' + monthTitle);
  lines.push('confidence: ' + confidenceStr);
  lines.push('execution_view: automation');
  lines.push('execution_modes: ' + (modesListAll.length ? modesListAll.join('|') : 'standard'));
  lines.push('');

  lines.push('=== liquidity ===');
  lines.push('total_cash: ' + fmtCurrency_(totalCash));
  lines.push('reserve_target: ' + fmtCurrency_(reserveTarget));
  lines.push('buffer_do_not_deploy: ' + fmtCurrency_(bufferProtected));
  lines.push('near_term_planned_reserved: ' + fmtCurrency_(nearTermReservedExec));
  lines.push('unmapped_card_funded_cash_risk: ' + fmtCurrency_(unmappedCashRiskExecAuto));
  lines.push('deployable_cash: ' + fmtCurrency_(deployableAfter));
  lines.push('cash_for_extra_debt: ' + fmtCurrency_(planInvalid ? 0 : cashAvailExtra));
  lines.push('heloc_recommended: ' + helocRecShort);
  lines.push('');
  appendRollingCashBridgeAuditLines_(lines, r0.cash_policy_pools || {});

  if (!!renderCtx.include_debug_details && r0.cash_policy_pools && r0.cash_policy_pools.account_cash_policy_debug) {
    const cap = r0.cash_policy_pools;
    lines.push('=== cash_accounts_debug ===');
    cap.account_cash_policy_debug.forEach(function(row) {
      lines.push(
        'account: ' +
          String(row.name || '') +
          ' | usable: ' +
          fmtCurrency_(Number(row.usable_cash) || 0) +
          ' | ' +
          (row.included ? 'included' : 'excluded') +
          ' | ' +
          String(row.reason || '')
      );
    });
    lines.push(
      'policy_pools_after_global_holds: debt_preferred=' +
        fmtCurrency_(Number(cap.debt_preferred_cash) || 0) +
        ' | bills=' +
        fmtCurrency_(Number(cap.bills_available_cash) || 0) +
        ' | caution=' +
        fmtCurrency_(Number(cap.caution_cash) || 0)
    );
    lines.push('total_usable_cash: ' + fmtCurrency_(Number(cap.total_usable_cash) || 0));
    lines.push('final_execute_now_cash: ' + fmtCurrency_(Number(cap.final_execute_now_cash) || 0));
    lines.push('');
  }

  lines.push('=== minimums_due ===');
  if (!ordered.length) {
    lines.push('row: none | amount: 0');
  } else {
    let any = false;
    ordered.forEach(function(d) {
      const minP = round2_(Number(d.minimumPayment) || 0);
      const cf = anchorCfPaidForName_(d.name);
      if (minP <= 0.005) return;
      any = true;
      const nm = debtNameForExecutionPlan_(d.name, 'automation');
      if (cf >= minP - 0.01) {
        lines.push('row: ' + nm + ' | status: already_paid_minimum | minimum: ' + fmtCurrency_(minP));
      } else if (cf > 0.005) {
        lines.push(
          'row: ' +
            nm +
            ' | status: pay_remainder | due: ' +
            fmtCurrency_(round2_(minP - cf)) +
            ' | minimum: ' +
            fmtCurrency_(minP)
        );
      } else {
        lines.push('row: ' + nm + ' | status: pay_full_minimum | due: ' + fmtCurrency_(minP));
      }
    });
    if (!any) lines.push('row: none | amount: 0');
  }
  lines.push('');

  const buckets = buildExecutionExtraBuckets_(eca, execCashMap, planInvalid);
  lines.push('=== execute_now ===');
  lines.push('total: ' + fmtCurrency_(execCashDisplayed));
  if (!planInvalid && execCashDisplayed > 0.005) {
    const pushRows = function(label, items) {
      (items || []).forEach(function(e) {
        const nm = debtNameForExecutionPlan_(e.name, 'automation');
        lines.push('pay_row: bucket=' + label + ' | account=' + nm + ' | amount=' + fmtCurrency_(e.amt));
      });
    };
    pushRows('cleanup', buckets.cleanup);
    pushRows('primary', buckets.primary);
    pushRows('secondary', buckets.secondary);
    pushRows('overflow', buckets.overflow);
  } else {
    lines.push('pay_row: none | amount: 0');
  }
  lines.push('heloc_principal: ' + fmtCurrency_(helocExecAmount));
  lines.push('total_executable_now: ' + fmtCurrency_(execTotalDisplayed));
  if (aggressivePhase2Audit) {
    const a = aggressivePhase2Audit;
    const disp = rollingAggressiveCashExtrasReconcile_(buckets, execCashDisplayed);
    lines.push('aggressive.cleanup_within_cash_extras: ' + fmtCurrency_(disp.cleanup_cash));
    lines.push('aggressive.remaining_extra_after_cleanup: ' + fmtCurrency_(disp.remaining_after_cleanup));
    lines.push('aggressive.primary_allocated: ' + fmtCurrency_(disp.primary_cash));
    lines.push('aggressive.primary_share_of_remaining_pct: ' + String(disp.primary_share_of_remaining_pct));
    lines.push(
      'aggressive.reconcile_cleanup_plus_remaining: ' +
        fmtCurrency_(disp.cleanup_cash) +
        ' + ' +
        fmtCurrency_(disp.remaining_after_cleanup) +
        ' = ' +
        fmtCurrency_(execCashDisplayed)
    );
    lines.push(
      'aggressive.reconcile_execute_now: ' +
        fmtCurrency_(execCashDisplayed) +
        ' + ' +
        fmtCurrency_(round2_(execTotalDisplayed - execCashDisplayed)) +
        ' = ' +
        fmtCurrency_(execTotalDisplayed)
    );
    lines.push(
      'aggressive.bucket_integrity: ' +
        ((!disp.sum_lines_matches_exec || !disp.remaining_matches_buckets) ? 'mismatch' : 'ok')
    );
    if (disp.remaining_after_cleanup <= 0.005) {
      lines.push('aggressive.target_status: no_remaining_after_cleanup');
    } else if (a.primary_share_met_target) {
      lines.push('aggressive.target_status: met');
    } else if (a.capped_excuse_applies) {
      lines.push('aggressive.target_status: capped_shortfall');
      lines.push('aggressive.target_status_reason: primary_payoff_cap');
    } else {
      lines.push('aggressive.target_status: anomaly_review');
    }
  }
  lines.push('');

  lines.push('=== conditional_if_income_arrives ===');
  lines.push('total: ' + fmtCurrency_(condVarDisplayed));
  if (!planInvalid && condVarDisplayed > 0.005) {
    const varEntries = [];
    Object.keys(condVarMap).forEach(function(k) {
      const amt = Number(condVarMap[k]) || 0;
      if (amt > 0.005) varEntries.push({ name: k, amt: round2_(amt) });
    });
    varEntries.sort(function(a, b) {
      const ia = orderIndexForExtra_(a.name);
      const ib = orderIndexForExtra_(b.name);
      if (ia !== ib) return ia - ib;
      return a.name.localeCompare(b.name);
    });
    varEntries.forEach(function(e) {
      const nm = debtNameForExecutionPlan_(e.name, 'automation');
      lines.push('pay_row: bucket=conditional | account=' + nm + ' | amount=' + fmtCurrency_(e.amt));
    });
  } else {
    lines.push('pay_row: none | amount: 0');
  }
  lines.push('');

  lines.push('=== decision_box ===');
  const canExtraAmt =
    !planInvalid && !belowReserve && execTotalDisplayed > 0.005 ? fmtCurrency_(execTotalDisplayed) : fmtCurrency_(0);
  lines.push(
    'can_make_extra_payment: ' +
      (!planInvalid && !belowReserve && execTotalDisplayed > 0.005 ? 'yes' : 'no') +
      ' | max_now: ' +
      canExtraAmt
  );
  lines.push('use_heloc: ' + (helocExecAmount > 0.005 ? 'yes_executed' : helocRecShort === 'Yes' ? 'yes_modeled' : 'no'));
  lines.push('hold_cash_instead: ' + (belowReserve || execTotalDisplayed <= 0.005 ? 'yes' : 'no'));
  lines.push('cleanup_targets: ' + cleanupTargetsNamesOnly);
  lines.push('primary_debt: ' + debtNameForExecutionPlan_(primaryP, 'automation'));
  lines.push('optimized_for_interest: ' + (interestAllocationExecutionOk ? 'yes' : 'no'));
  lines.push('');

  lines.push('=== next_3_months ===');
  if (!next3.length) {
    lines.push('row: insufficient_data');
  } else {
    next3.forEach(function(entry) {
      lines.push(
        'row: month=' +
          String(entry.month || '—') +
          ' | cash_pressure=' +
          String(entry.expected_cash_pressure || '—') +
          ' | focus=' +
          String(entry.expected_debt_focus || '—') +
          ' | extra_likely=' +
          String(entry.extra_payments_likely || '—') +
          ' | reserve_stress=' +
          String(entry.reserve_stress_likely || '—')
      );
    });
  }
  lines.push('');

  lines.push('=== watchouts ===');
  lines.push(ROLLING_DP_WATCHOUTS_PLACEHOLDER_);

  const cashEntriesList = [];
  Object.keys(execCashMap || {}).forEach(function(k) {
    const amt = round2_(Number(execCashMap[k]) || 0);
    if (amt > 0.005) cashEntriesList.push({ name: k, amt: amt });
  });

  if (!planInvalid) {
    if (Math.abs(execCashSum - cashAvailExtra) > 0.15) {
      failed.push('execution cash split sum does not match execution_extra_cash_total');
    }
    if (Math.abs(condVarSum - sumRollingAllocMap_(condVarMap)) > 0.05) {
      failed.push('conditional variable allocation sum mismatch');
    }
    const sumForecastAlloc = sumRollingAllocMap_(r0.extra_principal_allocations || {});
    if (sumForecastAlloc > 0.005 && Math.abs(execCashSum + condVarSum - sumForecastAlloc) > 0.2) {
      failed.push('forecast principal split does not reconcile to execution cash plus conditional variable');
    }
    if (execCashSum > 0.005 && !cashEntriesList.length) {
      failed.push('execution extra cash total > 0 but no per-account cash extra lines');
    }
    const helocExec = helocUsed >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_ ? helocUsed : 0;
    if (Math.abs(execTotalNow - (execCashSum + helocExec)) > 0.15) {
      failed.push('total executable now does not equal cash extras plus HELOC line');
    }
    if (aggressivePhase2Audit && aggressivePhase2Audit.below_target_anomaly) {
      failed.push(
        'Aggressive mode: phase-2 primary share below 90% without primary payoff-cap evidence on opening and deployable passes'
      );
    }
  }

  return {
    text: lines.join('\n'),
    failed_checks: failed,
    interest_allocation_execution_ok: interestAllocationExecutionOk
  };
}

/**
 * One-page execution operating plan (plain text). Watchouts + final plan_status are finalized after return.
 * Returns { text, failed_checks, interest_allocation_execution_ok } for quality gates (PARTIALLY_VALID when non-empty).
 */
function buildThisMonthExecutionPlanText_(row0, planInvalid, renderCtx) {
  renderCtx = renderCtx || {};
  const modeRaw = String(renderCtx.execution_plan_mode || '')
    .toLowerCase()
    .trim();
  const modesList = modeRaw.split(/[\s,|]+/).filter(Boolean);
  function hasExecPlanMode_(token) {
    return modesList.indexOf(token) >= 0;
  }
  if (hasExecPlanMode_('automation')) {
    return buildThisMonthExecutionPlanAutomationFormat_(row0, planInvalid, renderCtx);
  }
  const sep = ' — ';
  const automationLabel = '';
  const failed = [];
  let aggAudit = null;
  const r0 = row0 || {};
  const monthTitle = String(r0.month || '').trim() || '—';
  const confidenceStr = String(renderCtx.overall_confidence || 'MEDIUM').trim();
  const next3 = renderCtx.next_3_month_preview || [];
  const liqIn = r0.liquidity_summary || {};
  const bufDefault = ROLLING_DP_BUFFER_ABOVE_RESERVE_;
  const reserve = ROLLING_DP_RESERVE_DEFAULT_;

  const totalCash =
    liqIn.total_cash != null && liqIn.total_cash === liqIn.total_cash
      ? round2_(liqIn.total_cash)
      : round2_(Number(r0.starting_cash) || 0);
  const reserveTarget =
    liqIn.reserve_target != null && liqIn.reserve_target === liqIn.reserve_target
      ? round2_(liqIn.reserve_target)
      : round2_(reserve);
  const bufferProtected =
    liqIn.buffer_above_reserve != null && liqIn.buffer_above_reserve === liqIn.buffer_above_reserve
      ? round2_(liqIn.buffer_above_reserve)
      : round2_(bufDefault);
  const nearTermReservedExec =
    liqIn.near_term_planned_cash_reserved != null && liqIn.near_term_planned_cash_reserved === liqIn.near_term_planned_cash_reserved
      ? round2_(liqIn.near_term_planned_cash_reserved)
      : 0;
  const unmappedCashRiskExecStd =
    liqIn.unmapped_card_funded_cash_risk != null && liqIn.unmapped_card_funded_cash_risk === liqIn.unmapped_card_funded_cash_risk
      ? round2_(liqIn.unmapped_card_funded_cash_risk)
      : 0;
  const deployableAfter =
    liqIn.deployable_cash_after_protections != null &&
    liqIn.deployable_cash_after_protections === liqIn.deployable_cash_after_protections
      ? round2_(liqIn.deployable_cash_after_protections)
      : liqIn.deployable_cash != null && liqIn.deployable_cash === liqIn.deployable_cash
        ? round2_(liqIn.deployable_cash)
        : round2_(
            Math.max(0, totalCash - reserveTarget - bufferProtected - nearTermReservedExec - unmappedCashRiskExecStd)
          );
  let cashAvailExtra =
    r0.execution_extra_cash_total != null && r0.execution_extra_cash_total === r0.execution_extra_cash_total
      ? round2_(r0.execution_extra_cash_total)
      : round2_(sumRollingAllocMap_(r0.extra_principal_allocations_execution_now || {}));
  const capPoolsStd = r0.cash_policy_pools || {};
  if (
    !planInvalid &&
    capPoolsStd.final_execute_now_cash != null &&
    capPoolsStd.final_execute_now_cash === capPoolsStd.final_execute_now_cash
  ) {
    cashAvailExtra = round2_(Math.min(cashAvailExtra, round2_(Number(capPoolsStd.final_execute_now_cash) || 0)));
  }
  const helocUsed =
    liqIn.heloc_draw_this_month != null && liqIn.heloc_draw_this_month === liqIn.heloc_draw_this_month
      ? round2_(liqIn.heloc_draw_this_month)
      : round2_(Number(r0.heloc_draw_this_month) || 0);
  const helocRec = planInvalid
    ? 'No'
    : String(r0.heloc_recommendation_execution || liqIn.heloc_recommended_now || 'No').trim() || 'No';
  let helocRecShort = 'No';
  if (!planInvalid) {
    if (helocUsed >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_) {
      helocRecShort = 'Yes';
    } else {
      const hr = helocRec.toLowerCase();
      if (
        hr !== 'no' &&
        hr &&
        (hr.indexOf('yes') >= 0 ||
          hr.indexOf('optional') >= 0 ||
          hr.indexOf('consider') >= 0 ||
          hr.indexOf('recommend') >= 0)
      ) {
        helocRecShort = 'Yes';
      }
    }
  }
  const execCashMap = r0.extra_principal_allocations_execution_now || {};
  const condVarMap = r0.extra_principal_allocations_conditional_variable || {};
  const execCashSum = sumRollingAllocMap_(execCashMap);
  const condVarSum =
    r0.conditional_variable_extra_total != null && r0.conditional_variable_extra_total === r0.conditional_variable_extra_total
      ? round2_(r0.conditional_variable_extra_total)
      : sumRollingAllocMap_(condVarMap);
  const execTotalNow =
    r0.execution_total_now != null && r0.execution_total_now === r0.execution_total_now
      ? round2_(r0.execution_total_now)
      : round2_(execCashSum + helocUsed);
  const execCashDisplayed = planInvalid ? 0 : execCashSum;
  const execTotalDisplayed = planInvalid ? 0 : execTotalNow;
  const condVarDisplayed = planInvalid ? 0 : condVarSum;
  const helocDisplayed = planInvalid ? 0 : helocUsed;
  const helocExecAmount = !planInvalid && helocUsed >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_ ? helocDisplayed : 0;

  const lines = [];
  lines.push('ROLLING DEBT PAYOFF');
  if (hasExecPlanMode_('aggressive')) {
    lines.push('');
    lines.push('AGGRESSIVE PAYDOWN MODE');
  }
  lines.push('');
  lines.push(
    'Plan status: ' +
      ROLLING_DP_PLAN_STATUS_PLACEHOLDER_ +
      ' · Anchor: ' +
      monthTitle +
      ' · Confidence: ' +
      confidenceStr
  );
  lines.push('');
  lines.push('--------------------------------------------------');
  lines.push('THIS MONTH EXECUTION PLAN');
  lines.push('');
  lines.push('Liquidity');
  lines.push('- Total cash: ' + fmtCurrency_(totalCash));
  lines.push('- Reserve target: ' + fmtCurrency_(reserveTarget));
  lines.push('- Buffer (do not deploy): ' + fmtCurrency_(bufferProtected));
  lines.push('- Deployable cash: ' + fmtCurrency_(deployableAfter));
  lines.push('- Cash available for extra debt: ' + fmtCurrency_(planInvalid ? 0 : cashAvailExtra));
  lines.push('- HELOC recommended: ' + helocRecShort);
  lines.push('');
  if (r0.cash_policy_pools && r0.cash_policy_pools.liquid_total_sheet != null) {
    const b = r0.cash_policy_pools;
    lines.push('Cash bridge (audit)');
    lines.push('- 1. Liquid total (sheet): ' + fmtCurrency_(Number(b.liquid_total_sheet) || 0));
    lines.push('- 2. Minus DO_NOT_TOUCH excluded: ' + fmtCurrency_(Number(b.do_not_touch_excluded_cash) || 0));
    lines.push('- 3. Policy eligible (before buffers): ' + fmtCurrency_(Number(b.policy_eligible_cash_before_buffers) || 0));
    lines.push('- 4. Minus account min buffers: ' + fmtCurrency_(Number(b.account_min_buffers_total) || 0));
    lines.push('- 5. Total usable cash: ' + fmtCurrency_(Number(b.total_usable_cash) || 0));
    lines.push('- 6. Minus reserve hold: ' + fmtCurrency_(Number(b.reserve_hold) || 0));
    lines.push('- 7. Minus global buffer hold: ' + fmtCurrency_(Number(b.global_buffer_hold) || 0));
    lines.push('- 8. Minus near-term planned hold: ' + fmtCurrency_(Number(b.near_term_planned_cash_hold) || 0));
    lines.push('- 9. Minus unmapped card risk hold: ' + fmtCurrency_(Number(b.unmapped_card_risk_hold) || 0));
    lines.push('- 10. Final execute-now cash: ' + fmtCurrency_(Number(b.final_execute_now_cash) || 0));
    lines.push('- Monthly execution cap: ' + fmtCurrency_(Number(b.monthly_execution_cap) || 0));
    lines.push('- Executable now (min of final and cap): ' + fmtCurrency_(Number(b.executable_now_budget) || 0));
    lines.push('');
    if (b.cash_bridge_validation_warnings && b.cash_bridge_validation_warnings.length) {
      lines.push('Cash bridge validation');
      b.cash_bridge_validation_warnings.forEach(function(w) {
        lines.push('- WARNING: ' + String(w || ''));
      });
      lines.push('');
    }
  }
  if (!!renderCtx.include_debug_details && r0.cash_policy_pools && r0.cash_policy_pools.account_cash_policy_debug) {
    const cap = r0.cash_policy_pools;
    lines.push('Cash accounts (SYS - Accounts policy debug)');
    cap.account_cash_policy_debug.forEach(function(row) {
      lines.push(
        '- ' +
          String(row.name || '') +
          ': usable ' +
          fmtCurrency_(Number(row.usable_cash) || 0) +
          ' · ' +
          (row.included ? 'included' : 'excluded') +
          ' — ' +
          String(row.reason || '')
      );
    });
    lines.push(
      '- After global holds — debt-preferred: ' +
        fmtCurrency_(Number(cap.debt_preferred_cash) || 0) +
        ', bills pool: ' +
        fmtCurrency_(Number(cap.bills_available_cash) || 0) +
        ', caution pool: ' +
        fmtCurrency_(Number(cap.caution_cash) || 0)
    );
    lines.push('- Total usable (pre-holds): ' + fmtCurrency_(Number(cap.total_usable_cash) || 0));
    lines.push('- Final execute-now budget (post all holds): ' + fmtCurrency_(Number(cap.final_execute_now_cash) || 0));
    lines.push('');
  }

  const startSnap = r0.debt_balances_start || [];
  const anchorCfPaidByDebt = r0.anchor_cf_paid_by_debt || {};
  function anchorCfPaidForName_(nm) {
    return round2_(Number(anchorCfPaidByDebt[nm]) || 0);
  }

  const activeForSort = startSnap
    .filter(function(d) {
      return d.balance > 0.005;
    })
    .map(function(d) {
      return {
        name: d.name,
        type: String(d.type || '').trim(),
        balance: d.balance,
        interestRate: Number(d.interestRate) || 0,
        minimumPayment: round2_(Number(d.minimumPayment) || 0),
        originalName: d.originalName || '',
        priorityClass: d.priorityClass
      };
    });
  const ordered = sortActiveDebtLikeWaterfall_(activeForSort);

  lines.push('Already paid this month');
  const alreadyPaidLines = [];
  const payNowLines = [];
  if (!ordered.length) {
    payNowLines.push('- (no active debt rows in the month snapshot)');
  } else {
    ordered.forEach(function(d) {
      const minP = round2_(Number(d.minimumPayment) || 0);
      const cf = anchorCfPaidForName_(d.name);
      if (minP <= 0.005) return;
      if (cf >= minP - 0.01) {
        alreadyPaidLines.push('- ' + debtNameForExecutionPlan_(d.name, automationLabel));
      } else if (cf > 0.005) {
        alreadyPaidLines.push('- ' + debtNameForExecutionPlan_(d.name, automationLabel));
        payNowLines.push(
          '- ' + debtNameForExecutionPlan_(d.name, automationLabel) + sep + fmtCurrency_(round2_(minP - cf))
        );
      } else {
        payNowLines.push('- ' + debtNameForExecutionPlan_(d.name, automationLabel) + sep + fmtCurrency_(minP));
      }
    });
  }
  if (!alreadyPaidLines.length) {
    lines.push('- (none)');
  } else {
    alreadyPaidLines.forEach(function(l) {
      lines.push(l);
    });
  }
  lines.push('');
  lines.push('Pay now (minimums)');
  if (!payNowLines.length) {
    lines.push('- (none)');
  } else {
    payNowLines.forEach(function(l) {
      lines.push(l);
    });
  }
  lines.push('');

  function orderIndexForExtra_(name) {
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].name === name) return i;
    }
    return 9999;
  }

  const eca = r0.execution_concentration_analysis;
  const buckets = buildExecutionExtraBuckets_(eca, execCashMap, planInvalid);
  const primaryShow = buckets.primary.slice();
  const secondaryShow = buckets.secondary.slice();
  const overflowShow = buckets.overflow.slice();
  if (hasExecPlanMode_('aggressive') && !planInvalid) {
    aggAudit = buildAggressivePhase2Audit_(r0.opening_concentration_meta, r0.deployable_concentration_meta);
  }
  const cashEntriesList = [];
  Object.keys(execCashMap || {}).forEach(function(k) {
    const amt = round2_(Number(execCashMap[k]) || 0);
    if (amt > 0.005) cashEntriesList.push({ name: k, amt: amt });
  });

  function pushBucketLines_(title, items, noneMsg) {
    lines.push(title);
    if (!items.length) {
      lines.push('   - ' + noneMsg);
    } else {
      items.forEach(function(e) {
        lines.push('   - ' + debtNameForExecutionPlan_(e.name, automationLabel) + sep + fmtCurrency_(e.amt));
      });
    }
  }

  lines.push('Extra payments (EXECUTE NOW)');
  lines.push('- Total: ' + fmtCurrency_(execCashDisplayed));
  if (hasExecPlanMode_('aggressive') && !planInvalid && aggAudit) {
    const a = aggAudit;
    const disp = rollingAggressiveCashExtrasReconcile_(buckets, execCashDisplayed);
    lines.push(
      '- Cash extras: ' +
        fmtCurrency_(execCashDisplayed) +
        ' = cleanup ' +
        fmtCurrency_(disp.cleanup_cash) +
        ' + remaining after cleanup ' +
        fmtCurrency_(disp.remaining_after_cleanup)
    );
    lines.push('- Primary allocated: ' + fmtCurrency_(disp.primary_cash));
    lines.push('- Primary share (of remaining after cleanup): ' + String(disp.primary_share_of_remaining_pct) + '%');
    const helocPartForTotal = round2_(execTotalDisplayed - execCashDisplayed);
    lines.push(
      '- Total execute now: ' +
        fmtCurrency_(execTotalDisplayed) +
        ' (cash extras ' +
        fmtCurrency_(execCashDisplayed) +
        ' + HELOC ' +
        fmtCurrency_(helocPartForTotal) +
        ')'
    );
    if (!disp.sum_lines_matches_exec || !disp.remaining_matches_buckets) {
      lines.push(
        '- Bucket check: primary + secondary + overflow = ' +
          fmtCurrency_(disp.non_cleanup_sum) +
          ' (should equal remaining after cleanup ' +
          fmtCurrency_(disp.remaining_after_cleanup) +
          ').'
      );
    }
    if (disp.remaining_after_cleanup <= 0.005) {
      lines.push('- Aggressive: no remaining extra after cleanup (all cash extras went to cleanup, or no cash extras).');
    } else if (a.primary_share_met_target) {
      lines.push(
        '- Aggressive: modeled concentration target satisfied (≥90% to primary after cleanup, within rounding).'
      );
    } else if (a.capped_excuse_applies) {
      lines.push(
        '- Aggressive: modeled primary share is below 90% **because** Primary capped at remaining payoff balance (extra-principal ceiling; cannot add more without overpaying).'
      );
    } else {
      lines.push(
        '- Aggressive: modeled primary share is below 90% without a confirmed payoff cap — see execution failed_checks.'
      );
    }
  }
  if (planInvalid) {
    pushBucketLines_('1. Cleanup (pay off small balances)', [], '(none)');
    pushBucketLines_('2. Primary (highest APR)', [], '(none)');
    pushBucketLines_('3. Secondary', [], '(none)');
    pushBucketLines_('4. Overflow (only after above)', [], '(none)');
  } else {
    pushBucketLines_(
      '1. Cleanup (pay off small balances)',
      buckets.cleanup,
      '(none)'
    );
    pushBucketLines_('2. Primary (highest APR)', primaryShow, '(none)');
    pushBucketLines_('3. Secondary', secondaryShow, '(none)');
    pushBucketLines_('4. Overflow (only after above)', overflowShow, '(none)');
  }
  if (hasExecPlanMode_('aggressive')) {
    rollingAggressiveSpilloverExplainLines_(r0, planInvalid, primaryShow, secondaryShow, overflowShow).forEach(function(
      l
    ) {
      lines.push(l);
    });
  }
  lines.push('');

  lines.push('Conditional (only if income arrives)');
  lines.push('- Total: ' + fmtCurrency_(condVarDisplayed));
  if (!planInvalid && condVarDisplayed > 0.005) {
    const varEntries = [];
    Object.keys(condVarMap).forEach(function(k) {
      const amt = Number(condVarMap[k]) || 0;
      if (amt > 0.005) varEntries.push({ name: k, amt: round2_(amt) });
    });
    varEntries.sort(function(a, b) {
      const ia = orderIndexForExtra_(a.name);
      const ib = orderIndexForExtra_(b.name);
      if (ia !== ib) return ia - ib;
      return a.name.localeCompare(b.name);
    });
    varEntries.forEach(function(e) {
      lines.push('- ' + debtNameForExecutionPlan_(e.name, automationLabel) + sep + fmtCurrency_(e.amt));
    });
  }
  lines.push('');
  lines.push('--------------------------------------------------');
  lines.push('EXECUTION TOTALS');
  lines.push('');
  lines.push('- From cash: ' + fmtCurrency_(execCashDisplayed));
  lines.push('- From HELOC: ' + fmtCurrency_(helocExecAmount));
  lines.push('- Total now: ' + fmtCurrency_(execTotalDisplayed));
  lines.push('- Conditional later: ' + fmtCurrency_(condVarDisplayed));
  lines.push('');
  buildPostPaymentSnapshotLines_(r0, planInvalid, {
    execCashMap: execCashMap,
    buckets: buckets,
    eca: eca,
    execTotalDisplayed: execTotalDisplayed,
    execHelocAmount: helocDisplayed,
    include_debug_details: !!renderCtx.include_debug_details
  }).forEach(function(ln) {
    lines.push(ln);
  });

  const interestAllocationExecutionOk = !planInvalid && (!eca || eca.concentration_leak !== true);
  const belowReserve = (Number(r0.ending_cash) || 0) < reserveTarget - 0.5;
  const cleanupNames = [];
  if (eca && eca.cleanup_items) {
    eca.cleanup_items.forEach(function(c) {
      if (c && c.name) cleanupNames.push(String(c.name));
    });
  }
  const cleanupTargetsNamesOnly = cleanupNames.length
    ? cleanupNames.slice(0, 6).join(', ')
    : String(r0.cleanup_target_debt != null ? r0.cleanup_target_debt : '—')
        .split(',')
        .map(function(s) {
          return String(s || '').trim();
        })
        .filter(Boolean)
        .slice(0, 6)
        .join(', ') || '—';
  const primaryP =
    String(r0.primary_priority_debt != null ? r0.primary_priority_debt : r0.focus_debt || '—').trim() || '—';
  const canExtraAmt =
    !planInvalid && !belowReserve && execTotalDisplayed > 0.005 ? fmtCurrency_(execTotalDisplayed) : fmtCurrency_(0);
  const canExtraAns =
    !planInvalid && !belowReserve && execTotalDisplayed > 0.005 ? 'Yes' + sep + canExtraAmt : 'No' + sep + canExtraAmt;
  const useHelocAns = helocExecAmount > 0.005 ? 'Yes' : helocRecShort === 'Yes' ? 'Yes' : 'No';
  const holdCashAns = belowReserve || execTotalDisplayed <= 0.005 ? 'Yes' : 'No';

  lines.push('--------------------------------------------------');
  lines.push('DECISION BOX');
  lines.push('');
  lines.push('- Can I make an extra payment? ' + canExtraAns);
  lines.push('- Use HELOC? ' + useHelocAns);
  lines.push('- Hold cash instead? ' + holdCashAns);
  lines.push('- Cleanup targets: ' + cleanupTargetsNamesOnly);
  lines.push('- Primary debt: ' + debtNameForExecutionPlan_(primaryP, automationLabel));
  lines.push('- Optimized for interest? ' + (interestAllocationExecutionOk ? 'Yes' : 'No'));
  lines.push('');
  lines.push('--------------------------------------------------');
  lines.push('NEXT 3 MONTHS');
  lines.push('');
  if (!next3.length) {
    lines.push('- (insufficient forecast rows)');
  } else {
    next3.forEach(function(entry) {
      const m = String(entry.month || '—').trim();
      lines.push('- ' + m + ': ' + String(entry.expected_debt_focus || '—'));
    });
  }
  lines.push('');
  lines.push('--------------------------------------------------');
  lines.push('WATCHOUTS (MAX 3)');
  lines.push('');
  lines.push(ROLLING_DP_WATCHOUTS_PLACEHOLDER_);
  lines.push('');
  lines.push('--------------------------------------------------');

  if (!planInvalid) {
    if (Math.abs(execCashSum - cashAvailExtra) > 0.15) {
      failed.push('execution cash split sum does not match execution_extra_cash_total');
    }
    if (Math.abs(condVarSum - sumRollingAllocMap_(condVarMap)) > 0.05) {
      failed.push('conditional variable allocation sum mismatch');
    }
    const sumForecastAlloc = sumRollingAllocMap_(r0.extra_principal_allocations || {});
    if (sumForecastAlloc > 0.005 && Math.abs(execCashSum + condVarSum - sumForecastAlloc) > 0.2) {
      failed.push('forecast principal split does not reconcile to execution cash plus conditional variable');
    }
    if (execCashSum > 0.005 && !cashEntriesList.length) {
      failed.push('execution extra cash total > 0 but no per-account cash extra lines');
    }
    const helocExec = helocUsed >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_ ? helocUsed : 0;
    if (Math.abs(execTotalNow - (execCashSum + helocExec)) > 0.15) {
      failed.push('total executable now does not equal cash extras plus HELOC line');
    }
    if (hasExecPlanMode_('aggressive') && aggAudit && aggAudit.below_target_anomaly) {
      failed.push(
        'Aggressive mode: phase-2 primary share below 90% without primary payoff-cap evidence on opening and deployable passes'
      );
    }
  }

  return {
    text: lines.join('\n'),
    failed_checks: failed,
    interest_allocation_execution_ok: interestAllocationExecutionOk
  };
}

function buildActionDecisionBox_(row0, reserve, planInvalid) {
  if (planInvalid) {
    return {
      can_make_extra_payment: 'No',
      should_draw_from_heloc: 'No',
      max_heloc_draw_allowed_now: round2_(ROLLING_DP_HELOC_ACTION_DRAW_CAP_),
      should_hold_cash_instead: 'Yes',
      current_priority_debt: '—',
      cleanup_target_this_month: '—',
      primary_priority_debt: '—',
      is_allocation_optimized_for_interest_savings: 'No',
      reserve_protection_mode: row0 && row0.reserve_protection_exception ? 'On' : 'Off'
    };
  }
  const r0 = row0 || {};
  const belowReserve = (Number(r0.ending_cash) || 0) < reserve - 0.5;
  const execTotalNow = round2_(Number(r0.execution_total_now) || 0);
  const heloc = Number(r0.heloc_draw_this_month) || 0;
  const helocRec = String(r0.heloc_recommendation_execution || 'No').trim();
  const capRem = Number(r0.heloc_draw_capacity_remaining);
  const primaryDebt = String(r0.primary_priority_debt != null ? r0.primary_priority_debt : r0.focus_debt || '—');
  const cleanupDebt = String(r0.cleanup_target_debt != null ? r0.cleanup_target_debt : '—');
  return {
    can_make_extra_payment: !belowReserve && execTotalNow > 0.005 ? 'Yes — up to ' + fmtCurrency_(execTotalNow) + ' executable now' : 'No',
    should_draw_from_heloc:
      heloc >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_ ? helocRec || 'Optional only with manual approval' : 'No',
    max_heloc_draw_allowed_now: round2_(
      Math.min(
        ROLLING_DP_MAX_HELOC_DRAW_MONTHLY_,
        capRem != null && capRem === capRem ? capRem : ROLLING_DP_HELOC_ACTION_DRAW_CAP_
      )
    ),
    should_hold_cash_instead: belowReserve || execTotalNow <= 0.005 ? 'Yes' : 'No',
    current_priority_debt: primaryDebt,
    cleanup_target_this_month: cleanupDebt,
    primary_priority_debt: primaryDebt,
    is_allocation_optimized_for_interest_savings: r0.allocation_interest_optimized ? 'Yes' : 'No',
    reserve_protection_mode: r0.reserve_protection_exception ? 'On' : 'Off'
  };
}

function buildThisMonthPlan_(row0, keyWarnings, reserve, planInvalid, lumpDebt, lumpRes, lumpFlex, forwardExpenseConfidenceLow, debts) {
  const r0 = row0 || {};
  const anchorMonth = String(r0.month || '');
  const focus = String(r0.focus_debt || 'Maintain reserve and minimums').trim();
  const top3 = (keyWarnings || []).slice(0, 3);
  const belowReserve = (Number(r0.ending_cash) || 0) < reserve - 0.5;
  const extra = Number(r0.extra_debt_payment) || 0;
  const reserveProtection = !!r0.reserve_protection_exception;
  const liqIn = r0.liquidity_summary || {};
  const bufDefault = ROLLING_DP_BUFFER_ABOVE_RESERVE_;
  const maxCashRef = ROLLING_DP_MAX_CASH_DEPLOYMENT_MONTHLY_;
  const poolsForBuild = r0.cash_policy_pools || {};

  const totalCash =
    liqIn.total_cash != null && liqIn.total_cash === liqIn.total_cash
      ? round2_(liqIn.total_cash)
      : round2_(Number(r0.starting_cash) || 0);
  /**
   * Reserve and Buffer on the dashboard are CALCULATED from SYS - Accounts:
   *   reserveTargetDisplay = sum of Current Balance for DO_NOT_TOUCH cash accounts
   *   bufferDisplay        = sum of Min Buffer for non-DO_NOT_TOUCH policy-eligible accounts
   * Prefer the calculated fields from the cash_policy_pools. Fall back to the legacy
   * liquidity_summary.reserve_target / buffer_above_reserve only if the calculated
   * fields are missing. The legacy planner constants (ROLLING_DP_RESERVE_DEFAULT_ /
   * ROLLING_DP_BUFFER_ABOVE_RESERVE_) are retained for audit (legacy_reserve_target /
   * legacy_buffer_above_reserve) but MUST NOT drive the top-row display values.
   */
  const calcReservePool =
    poolsForBuild.calculated_reserve != null && poolsForBuild.calculated_reserve === poolsForBuild.calculated_reserve
      ? round2_(Number(poolsForBuild.calculated_reserve) || 0)
      : null;
  const calcBufferPool =
    poolsForBuild.calculated_buffer != null && poolsForBuild.calculated_buffer === poolsForBuild.calculated_buffer
      ? round2_(Number(poolsForBuild.calculated_buffer) || 0)
      : null;
  const reserveTargetDisplay =
    calcReservePool != null
      ? calcReservePool
      : liqIn.reserve_target != null && liqIn.reserve_target === liqIn.reserve_target
      ? round2_(liqIn.reserve_target)
      : round2_(reserve);
  const bufferDisplay =
    calcBufferPool != null
      ? calcBufferPool
      : liqIn.buffer_above_reserve != null && liqIn.buffer_above_reserve === liqIn.buffer_above_reserve
      ? round2_(liqIn.buffer_above_reserve)
      : round2_(bufDefault);
  const nearTermPlannedReserved =
    liqIn.near_term_planned_cash_reserved != null && liqIn.near_term_planned_cash_reserved === liqIn.near_term_planned_cash_reserved
      ? round2_(liqIn.near_term_planned_cash_reserved)
      : 0;
  const unmappedCardCashRisk =
    liqIn.unmapped_card_funded_cash_risk != null && liqIn.unmapped_card_funded_cash_risk === liqIn.unmapped_card_funded_cash_risk
      ? round2_(liqIn.unmapped_card_funded_cash_risk)
      : 0;
  const deployableCash =
    liqIn.deployable_cash != null && liqIn.deployable_cash === liqIn.deployable_cash
      ? round2_(liqIn.deployable_cash)
      : round2_(
          Math.max(0, totalCash - reserveTargetDisplay - bufferDisplay - nearTermPlannedReserved - unmappedCardCashRisk)
        );
  const deployableAfterProtections =
    liqIn.deployable_cash_after_protections != null && liqIn.deployable_cash_after_protections === liqIn.deployable_cash_after_protections
      ? round2_(liqIn.deployable_cash_after_protections)
      : deployableCash;
  const pools = r0.cash_policy_pools || {};
  const cashAvailExtraRaw =
    liqIn.cash_available_for_extra_debt_today != null && liqIn.cash_available_for_extra_debt_today === liqIn.cash_available_for_extra_debt_today
      ? round2_(liqIn.cash_available_for_extra_debt_today)
      : round2_(Number(r0.execution_extra_cash_total) || 0);
  let cashAvailExtraToday = cashAvailExtraRaw;
  /**
   * Canonical month-0 execute-now budget is the single source of truth for "how much cash
   * we are actually telling the user to deploy this month". Cap the display field at this
   * value so the liquidity panel can never exceed the allocator's hard cap.
   */
  const month0ExecuteNowBudgetPlan =
    pools && pools.month0_execute_now_budget != null && pools.month0_execute_now_budget === pools.month0_execute_now_budget
      ? round2_(Number(pools.month0_execute_now_budget) || 0)
      : pools && pools.final_execute_now_cash != null && pools.final_execute_now_cash === pools.final_execute_now_cash
      ? round2_(Number(pools.final_execute_now_cash) || 0)
      : null;
  if (month0ExecuteNowBudgetPlan != null) {
    cashAvailExtraToday = round2_(Math.min(cashAvailExtraRaw, month0ExecuteNowBudgetPlan));
  }
  const cashUsedThisMonth =
    liqIn.actual_cash_deployment_this_month != null && liqIn.actual_cash_deployment_this_month === liqIn.actual_cash_deployment_this_month
      ? round2_(liqIn.actual_cash_deployment_this_month)
      : round2_(Number(r0.opening_sweep_extra_debt) || 0);
  const helocUsedThisMonth =
    liqIn.heloc_draw_this_month != null && liqIn.heloc_draw_this_month === liqIn.heloc_draw_this_month
      ? round2_(liqIn.heloc_draw_this_month)
      : round2_(Number(r0.heloc_draw_this_month) || 0);
  const helocRecNow =
    String(liqIn.heloc_recommended_now || r0.heloc_recommendation_execution || 'No').trim() || 'No';
  const execTotalNowPlan = round2_(Number(r0.execution_total_now) || 0);
  const condVarPlan = round2_(Number(r0.conditional_variable_extra_total) || 0);

  const liquidity = {
    total_cash: totalCash,
    reserve_target: reserveTargetDisplay,
    buffer_above_reserve: bufferDisplay,
    near_term_planned_cash_reserved: nearTermPlannedReserved,
    unmapped_card_funded_cash_risk: unmappedCardCashRisk,
    deployable_cash: deployableCash,
    deployable_cash_after_protections: deployableAfterProtections,
    cash_available_for_extra_debt_today: cashAvailExtraToday,
    heloc_recommended_now: helocRecNow,
    monthly_max_cash_deployment:
      liqIn.monthly_max_cash_deployment != null ? round2_(liqIn.monthly_max_cash_deployment) : round2_(maxCashRef),
    actual_cash_deployment_this_month: cashUsedThisMonth,
    heloc_draw_this_month: helocUsedThisMonth,
    execution_total_now: execTotalNowPlan,
    conditional_variable_extra_total: condVarPlan
  };
  if (pools && pools.total_usable_cash != null && pools.total_usable_cash === pools.total_usable_cash) {
    liquidity.liquid_total_sheet = round2_(Number(pools.liquid_total_sheet) || 0);
    liquidity.do_not_touch_excluded_cash = round2_(Number(pools.do_not_touch_excluded_cash) || 0);
    liquidity.unsupported_policy_balance_total = round2_(Number(pools.unsupported_policy_balance_total) || 0);
    liquidity.policy_eligible_cash_before_buffers = round2_(Number(pools.policy_eligible_cash_before_buffers) || 0);
    liquidity.policy_scoped_balance_total = round2_(Number(pools.policy_scoped_balance_total) || 0);
    liquidity.account_min_buffers_total = round2_(Number(pools.account_min_buffers_total) || 0);
    liquidity.total_usable_cash = round2_(Number(pools.total_usable_cash) || 0);
    liquidity.bridge_linear_subtotal_after_buffers = round2_(Number(pools.bridge_linear_subtotal_after_buffers) || 0);
    liquidity.bridge_per_account_floor_delta = round2_(Number(pools.bridge_per_account_floor_delta) || 0);
    liquidity.reserve_hold = round2_(Number(pools.reserve_hold) || 0);
    liquidity.global_buffer_hold = round2_(Number(pools.global_buffer_hold) || 0);
    if (pools.legacy_reserve_target != null && pools.legacy_reserve_target === pools.legacy_reserve_target) {
      liquidity.legacy_reserve_target = round2_(Number(pools.legacy_reserve_target) || 0);
    }
    if (pools.legacy_buffer_above_reserve != null && pools.legacy_buffer_above_reserve === pools.legacy_buffer_above_reserve) {
      liquidity.legacy_buffer_above_reserve = round2_(Number(pools.legacy_buffer_above_reserve) || 0);
    }
    if (pools.calculated_reserve != null && pools.calculated_reserve === pools.calculated_reserve) {
      liquidity.calculated_reserve = round2_(Number(pools.calculated_reserve) || 0);
    }
    if (pools.calculated_buffer != null && pools.calculated_buffer === pools.calculated_buffer) {
      liquidity.calculated_buffer = round2_(Number(pools.calculated_buffer) || 0);
    }
    if (pools.reserve_account_count != null && pools.reserve_account_count === pools.reserve_account_count) {
      liquidity.reserve_account_count = Number(pools.reserve_account_count) || 0;
    }
    if (pools.buffer_account_count != null && pools.buffer_account_count === pools.buffer_account_count) {
      liquidity.buffer_account_count = Number(pools.buffer_account_count) || 0;
    }
    if (pools.reserve_source) {
      liquidity.reserve_source = String(pools.reserve_source);
    }
    if (pools.buffer_source) {
      liquidity.buffer_source = String(pools.buffer_source);
    }
    if (pools.deployable_max_calculated != null && pools.deployable_max_calculated === pools.deployable_max_calculated) {
      liquidity.deployable_max_calculated = round2_(Number(pools.deployable_max_calculated) || 0);
    }
    liquidity.near_term_planned_cash_hold = round2_(Number(pools.near_term_planned_cash_hold) || 0);
    liquidity.unmapped_card_risk_hold = round2_(Number(pools.unmapped_card_risk_hold) || 0);
    liquidity.final_execute_now_cash = round2_(Number(pools.final_execute_now_cash) || 0);
    liquidity.monthly_execution_cap = round2_(Number(pools.monthly_execution_cap) || 0);
    liquidity.executable_now_budget = round2_(Number(pools.executable_now_budget) || 0);
    liquidity.month0_execute_now_budget =
      pools.month0_execute_now_budget != null && pools.month0_execute_now_budget === pools.month0_execute_now_budget
        ? round2_(Number(pools.month0_execute_now_budget) || 0)
        : round2_(Number(pools.executable_now_budget) || 0);
    liquidity.debt_preferred_cash = round2_(Number(pools.debt_preferred_cash) || 0);
    liquidity.bills_available_cash = round2_(Number(pools.bills_available_cash) || 0);
    liquidity.caution_cash = round2_(Number(pools.caution_cash) || 0);
    liquidity.debt_preferred_cash_raw = round2_(Number(pools.debt_preferred_cash_raw) || 0);
    liquidity.bills_available_cash_raw = round2_(Number(pools.bills_available_cash_raw) || 0);
    liquidity.caution_cash_raw = round2_(Number(pools.caution_cash_raw) || 0);
    liquidity.liquid_reconciliation_delta = round2_(Number(pools.liquid_reconciliation_delta) || 0);
    if (pools.cash_bridge_validation_warnings && pools.cash_bridge_validation_warnings.length) {
      liquidity.cash_bridge_validation_warnings = pools.cash_bridge_validation_warnings.slice();
    }
  }

  const startSnap = r0.debt_balances_start || [];
  const extraAlloc = r0.extra_principal_allocations || {};
  const execExtraAlloc = r0.extra_principal_allocations_execution_now || {};
  const anchorCfPaidByDebt = r0.anchor_cf_paid_by_debt || {};
  function cfPaidForAnchor_(nm) {
    return round2_(Number(anchorCfPaidByDebt[nm]) || 0);
  }

  const scheduleActive = startSnap
    .filter(function(d) {
      return d.balance > 0.005;
    })
    .map(function(d) {
      return {
        name: d.name,
        type: String(d.type || '').trim(),
        balance: d.balance,
        interestRate: Number(d.interestRate) || 0,
        minimumPayment: round2_(Number(d.minimumPayment) || 0),
        originalName: d.originalName || '',
        priorityClass: d.priorityClass
      };
    });
  const orderedSchedule = sortActiveDebtLikeWaterfall_(scheduleActive);
  const anchorMinAlready = [];
  const anchorMinPayNow = [];
  orderedSchedule.forEach(function(d) {
    const minP = round2_(Number(d.minimumPayment) || 0);
    const cf = cfPaidForAnchor_(d.name);
    if (minP <= 0.005) return;
    if (cf >= minP - 0.01) {
      anchorMinAlready.push({ account: d.name, cf_paid_this_month: cf });
    } else if (cf > 0.005) {
      anchorMinAlready.push({ account: d.name, cf_paid_this_month: cf });
      anchorMinPayNow.push({ account: d.name, minimum_required: round2_(minP - cf) });
    } else {
      anchorMinPayNow.push({ account: d.name, minimum_required: minP });
    }
  });
  const anchorMonthMinimumSchedule = {
    already_paid: anchorMinAlready,
    pay_now: anchorMinPayNow
  };

  function buildPaymentActions_() {
    const merged = Object.create(null);
    function ensure_(name) {
      if (!name) return;
      if (!merged[name]) merged[name] = { minimum: 0, cashExtra: 0, heloc: 0 };
    }
    startSnap.forEach(function(d) {
      if (d.balance > 0.005 && d.minimumPayment > 0.005) {
        const minP = round2_(Number(d.minimumPayment) || 0);
        const cf = cfPaidForAnchor_(d.name);
        if (cf >= minP - 0.01) return;
        ensure_(d.name);
        merged[d.name].minimum = cf > 0.005 ? round2_(minP - cf) : minP;
      }
    });
    const order = [];
    startSnap.forEach(function(d) {
      if (merged[d.name] && order.indexOf(d.name) < 0) order.push(d.name);
    });
    Object.keys(merged).forEach(function(k) {
      if (order.indexOf(k) < 0) order.push(k);
    });

    const actions = [];
    order.forEach(function(name) {
      const p = merged[name];
      if (!p) return;
      const hasMin = p.minimum > 0.005;
      if (!hasMin) return;
      actions.push(name + ' — minimum ' + fmtCurrency_(p.minimum) + ' from operating cash.');
    });

    return actions;
  }

  let sumAlloc = 0;
  Object.keys(extraAlloc).forEach(function(k) {
    sumAlloc += Number(extraAlloc[k]) || 0;
  });
  sumAlloc = round2_(sumAlloc);
  const capReference = round2_(execTotalNowPlan);
  const deploymentCheckNote =
    extra > execTotalNowPlan + 0.5 && (Number(r0.variable_income) || 0) > 0.005
      ? 'Forecast modeled extra principal is ' +
        fmtCurrency_(extra) +
        '; executable this month (cash + optional approved HELOC) is ' +
        fmtCurrency_(execTotalNowPlan) +
        '. Additional ' +
        fmtCurrency_(condVarPlan) +
        ' is conditional on variable income if received — see THIS MONTH EXECUTION PLAN.'
      : extra > execTotalNowPlan + 0.5
        ? 'Forecast modeled extra principal (' +
          fmtCurrency_(extra) +
          ') exceeds executable-now total (' +
          fmtCurrency_(execTotalNowPlan) +
          ') — use the execution plan for operating steps.'
        : null;

  const notes = [];
  if (forwardExpenseConfidenceLow) {
    notes.push('Forward recurring expense baseline confidence is LOW — treat the 12-month forecast as directional.');
  }
  notes.push(
    'Lump-sum variable income (if received): allocate ' +
      Math.round(lumpDebt * 100) +
      '% to debt, ' +
      Math.round(lumpRes * 100) +
      '% to reserve, ' +
      Math.round(lumpFlex * 100) +
      '% flexible (as in the projection).'
  );

  if (planInvalid) {
    return {
      anchor_month: anchorMonth,
      liquidity: liquidity,
      allocation_audit: r0.allocation_audit || null,
      anchor_month_minimum_schedule: anchorMonthMinimumSchedule,
      payment_actions: buildPaymentActions_(),
      narrative_bullets: [],
      context_notes: notes,
      top_warnings: top3,
      why_this_month:
        'Forward income or expenses are unreliable in the sheet — execute minimums only and fix mapping before deploying capital.',
      reserve_protection_active: reserveProtection,
      current_debt_focus: String(r0.primary_priority_debt || focus),
      cleanup_target_debt: String(r0.cleanup_target_debt || '—'),
      modeled_extra_principal_total: round2_(extra),
      execution_total_now: execTotalNowPlan,
      cash_plus_heloc_execution_cap: capReference,
      deployment_check_note: deploymentCheckNote,
      use_cash_above_reserve: 'No — projection invalid.',
      use_heloc: 'No',
      required_payments_summary:
        'Contractual minimums on active debts until mapping is fixed; omit accounts already paid in the anchor Cash Flow column.',
      recommended_extra_payments: 'None.'
    };
  }

  const paymentActions = buildPaymentActions_();
  const debtFocusPrimary = String(r0.primary_priority_debt || r0.focus_debt || focus).trim();
  let why =
    'Execution uses reserve, buffer, near-term planned cash, and the monthly cash cap; HELOC is optional only with manual approval after strict gates.';
  if (belowReserve) {
    why =
      'Ending cash is projected below your reserve target — rebuild liquidity before optional principal or HELOC acceleration.';
  } else if (execTotalNowPlan <= 0.005) {
    why =
      'No executable extra principal from cash (and no approved HELOC path) after protections and caps; forecast may still show variable-income acceleration if received.';
  }

  const allocationAuditPlan = r0.allocation_audit || null;

  return {
    anchor_month: anchorMonth,
    liquidity: liquidity,
    allocation_audit: allocationAuditPlan,
    anchor_month_minimum_schedule: anchorMonthMinimumSchedule,
    payment_actions: paymentActions,
    narrative_bullets: [],
    context_notes: notes,
    top_warnings: top3,
    why_this_month: why,
    reserve_protection_active: reserveProtection,
    current_debt_focus: debtFocusPrimary,
    cleanup_target_debt: String(r0.cleanup_target_debt || '—'),
    modeled_extra_principal_total: round2_(extra),
    execution_total_now: execTotalNowPlan,
    cash_plus_heloc_execution_cap: capReference,
    deployment_check_note: deploymentCheckNote,
    use_cash_above_reserve: 'No — use capped deployable cash only (see liquidity.actual_cash_deployment_this_month).',
    use_heloc:
      helocUsedThisMonth >= ROLLING_DP_HELOC_MIN_MONTHLY_DRAW_
        ? 'Optional only with manual approval (strict gates passed in model)'
        : 'No',
    required_payments_summary:
      'All contractual minimums on active debts that do not already show a payment in the anchor Cash Flow month.',
    recommended_extra_payments:
      belowReserve || execTotalNowPlan <= 0.005
        ? 'None beyond minimums until liquidity improves (executable-now total is $0).'
        : fmtCurrency_(execTotalNowPlan) +
          ' executable now (cash + optional HELOC with manual approval only). Forecast may show up to ' +
          fmtCurrency_(extra) +
          ' modeled extra if variable income hits; ' +
          fmtCurrency_(condVarPlan) +
          ' of that is conditional on variable income this month.'
  };
}
