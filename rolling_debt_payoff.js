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
/** Post-cleanup extra principal pool: fraction routed to primary APR target first (rest to secondary, then sweep). */
var ROLLING_DP_PHASE2_PRIMARY_FRACTION_STANDARD_ = 0.75;
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
 * reserves near-term cash from deployable liquidity, and increases CC balances for near-term card-funded plans.
 */
function buildRollingPlannedExpenseImpactModel_(anchorDate, tz, debts, aliasMap) {
  const out = {
    near_term_cash_total: 0,
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
        impactTag = 'credit card → increases debt';
        if (dueObj && stripTime_(dueObj).getTime() <= anchorPlus30.getTime()) {
          out.near_term_card_funded_within_30 = true;
        }
        const tgt = rollingResolveCcDebtNameForPlannedExpense_(row.accountSource, row.payee || row.expenseName, out.debts_for_sim, aliasMap);
        let lineUnmapped = false;
        if (!tgt) {
          lineUnmapped = true;
          out.has_unmapped_near_term_card = true;
          const cautionNm = rollingModelingCautionCardForUnmappedPlanned_(out.debts_for_sim);
          out.modeling_unmapped_card_assumption = cautionNm || '';
          if (cautionNm) {
            out.debts_for_sim.forEach(function(d) {
              if (d.name === cautionNm) {
                d.balance = round2_(Math.max(0, d.balance) + amt);
              }
            });
          }
          out.warnings.push(
            'Near-term planned expense "' +
              title +
              '" is card-funded but no unique credit card debt matched Account / Source — map it to a specific card. For timeline caution only, modeled balance increase is applied to ' +
              (cautionNm
                ? 'the card used for modeling caution (' +
                  cautionNm +
                  ': highest utilization where Credit Limit is set, else highest APR)'
                : '(no card identified)') +
              '; executable payment steps do not rely on that assumption.'
          );
        } else {
          out.debts_for_sim.forEach(function(d) {
            if (d.name === tgt) {
              d.balance = round2_(Math.max(0, d.balance) + amt);
            }
          });
        }
        let execTreat =
          'Does not reduce cash today; increases modeled credit-card balance and caution for optional HELOC.';
        if (lineUnmapped) {
          execTreat +=
            ' Unmapped target card — map in INPUT - Upcoming Expenses to finalize payoff sequence. Modeling-only balance load on ' +
            (out.modeling_unmapped_card_assumption || '—') +
            ' (highest utilization if limits exist, else highest APR) for caution; execution extra payments are not based on that assumption.';
        } else {
          execTreat += ' Mapped to ' + tgt + ' in the payoff model.';
        }
        out.display_lines.push({
          title: title,
          due_label: dueLabel,
          amount: amt,
          impact_tag: impactTag,
          horizon: horizon,
          execution_treatment: execTreat,
          is_unmapped_card: lineUnmapped
        });
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
      execTreatMidLong = 'Review due date and funding in INPUT - Upcoming Expenses.';
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
  out.top_warnings = (out.top_warnings || []).slice(0, 3);
  return out;
}

function slimRollingDebtPayoffForDefault_(full, defaultOutput) {
  const pei = full.planned_expense_impact || {};
  return {
    generated_at: full.generated_at,
    summary: full.summary,
    key_warnings: (full.key_warnings || []).slice(0, 3),
    default_output: defaultOutput,
    this_month_plan: slimThisMonthPlanForDashboard_(full.this_month_plan),
    this_month_execution_plan: full.this_month_execution_plan,
    action_decision_box: full.action_decision_box,
    next_3_month_preview: full.next_3_month_preview,
    planned_expense_impact: {
      near_term_cash_reserved: pei.near_term_cash_reserved,
      has_mid_term: pei.has_mid_term,
      has_unmapped_near_term_card: pei.has_unmapped_near_term_card,
      near_term_card_funded_within_30: pei.near_term_card_funded_within_30,
      warnings: (pei.warnings || []).slice(0, 2)
    },
    assumptions: {
      reserve_target: full.assumptions.reserve_target,
      lump_sum_split: full.assumptions.lump_sum_split,
      anchor_sheet_month_header: full.assumptions.anchor_sheet_month_header,
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
  const usable = calculateUsableCash_(accounts);
  const liquidTotal = round2_(
    accounts.reduce(function(s, a) {
      return s + a.currentBalance;
    }, 0)
  );
  const reservedBucketsTracked = false;
  const availableCash = round2_(reservedBucketsTracked ? usable.usableAfterBuffers : liquidTotal * 0.85);

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
      'Debt minimums are non-zero but forward stable income or forward expenses are ~0 — verify INPUT - Cash Flow Type column (Income/Expense) and payee names.'
    );
  }
  keyWarnings.push(
    'Month-0 execution uses reserve + buffer + near-term planned cash, a per-month cash cap, and split cash vs forecast variable principal. HELOC defaults to No unless every strict gate passes; when it passes it is still optional only with manual approval.'
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
      'Upcoming planned expenses (INPUT - Upcoming Expenses, due within 90 days after anchor month-end) may reduce available cash in future months.'
    );
  }
  (plannedExpenseModel.warnings || []).forEach(function(w) {
    if (w) keyWarnings.push(w);
  });

  const availableCashForSim = round2_(Math.max(0, availableCash - plannedExpenseModel.near_term_cash_total));

  const sim = simulateRollingMonths_({
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
    reserveTarget: ROLLING_DP_RESERVE_DEFAULT_,
    bufferAboveReserve: ROLLING_DP_BUFFER_ABOVE_RESERVE_,
    maxCashDeploymentMonthly: ROLLING_DP_MAX_CASH_DEPLOYMENT_MONTHLY_,
    planInvalid: planInvalidEarly,
    liquidTotal: liquidTotal,
    tz: tz,
    debtStart: plannedExpenseModel.debt_start_adjusted,
    plannedUnmappedNearTermCard: !!plannedExpenseModel.has_unmapped_near_term_card,
    plannedNearTermCardWithin30: !!plannedExpenseModel.near_term_card_funded_within_30,
    userCashPreservationMonth: false,
    modelingUnmappedCardAssumption: String(plannedExpenseModel.modeling_unmapped_card_assumption || ''),
    executionPlanAggressiveAlloc: executionPlanModesList.indexOf('aggressive') >= 0
  });

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
      'Mid-term planned expenses are due within 90 days after anchor month-end (INPUT - Upcoming Expenses) — they may reduce available cash for debt extras in upcoming months.'
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
  const next3Preview = buildNext3MonthPreview_(sim.next12, ROLLING_DP_RESERVE_DEFAULT_);
  const execPlanOut = buildThisMonthExecutionPlanText_(row0, planStatus === 'INVALID', {
    overall_confidence: overallConfidence.label,
    next_3_month_preview: next3Preview,
    execution_plan_mode: executionPlanMode
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
    near_term_planned_cash_reserved: plannedExpenseModel.near_term_cash_total,
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
      display_lines: plannedExpenseModel.display_lines,
      has_mid_term: plannedExpenseModel.has_mid_term,
      has_long_term: plannedExpenseModel.has_long_term,
      has_unmapped_near_term_card: !!plannedExpenseModel.has_unmapped_near_term_card,
      near_term_card_funded_within_30: !!plannedExpenseModel.near_term_card_funded_within_30,
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
      cash_haircut: reservedBucketsTracked ? 1 : 0.85,
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
    return slimRollingDebtPayoffForDefault_(fullRollingPayload, defaultOutput);
  }

  fullRollingPayload.default_output = defaultOutput;
  fullRollingPayload.include_debug_details = true;
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

/**
 * Cleanup trivial CC balances first, then post-cleanup pool R on at most two APR targets (primaryFraction / remainder).
 * @param {{ primaryPhase2Fraction?: number }} [opts]
 */
function runExtraWaterfallConcentratedInterest_(simDebtsSorted, pool, opts) {
  opts = opts || {};
  const primaryPhase2Fraction =
    opts.primaryPhase2Fraction != null && opts.primaryPhase2Fraction === opts.primaryPhase2Fraction
      ? Number(opts.primaryPhase2Fraction)
      : ROLLING_DP_PHASE2_PRIMARY_FRACTION_STANDARD_;
  const alloc = Object.create(null);
  let extraPool = round2_(pool);
  let totalExtra = 0;
  const smallCap = ROLLING_DP_EXEC_PLAN_SMALL_BALANCE_SNOWBALL_MAX_;
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

  function addAlloc(nm, x) {
    x = round2_(x);
    if (x <= 0.005) return;
    alloc[nm] = round2_((alloc[nm] || 0) + x);
    totalExtra = round2_(totalExtra + x);
  }

  function findDebt(nm) {
    for (let i = 0; i < simDebtsSorted.length; i++) {
      if (simDebtsSorted[i].name === nm) return simDebtsSorted[i];
    }
    return null;
  }

  const trivial = simDebtsSorted
    .filter(function(d) {
      return d.active !== false && d.balance > 0.005 && String(d.type || '').trim() === 'Credit Card' && d.balance <= smallCap + 0.005;
    })
    .sort(function(a, b) {
      return a.balance - b.balance;
    });

  trivial.forEach(function(d) {
    if (extraPool <= 0.005) return;
    const cap = rollingDebtExtraPayoffCap_(d);
    const ex = round2_(Math.min(extraPool, cap));
    if (ex > 0.005) {
      meta.cleanup_names.push(d.name);
      addAlloc(d.name, ex);
      extraPool = round2_(extraPool - ex);
      applyDebtPayment_(d, ex);
    }
  });

  const R0 = extraPool;
  meta.phase2_R0 = round2_(R0);
  if (R0 <= 0.005) {
    return { allocations: alloc, totalExtra: totalExtra, meta: meta };
  }

  function listCCsByAprDesc() {
    return simDebtsSorted
      .filter(function(d) {
        return d.active !== false && d.balance > 0.005 && String(d.type || '').trim() === 'Credit Card';
      })
      .sort(function(a, b) {
        const ra = Number(b.interestRate) || 0;
        const rb = Number(a.interestRate) || 0;
        if (Math.abs(ra - rb) > 0.005) return ra - rb;
        return b.balance - a.balance;
      });
  }

  const snapCC = listCCsByAprDesc();
  if (!snapCC.length) {
    const rest = simDebtsSorted
      .filter(function(d) {
        return d.active !== false && d.balance > 0.005;
      })
      .sort(function(a, b) {
        return (Number(b.interestRate) || 0) - (Number(a.interestRate) || 0);
      });
    if (!rest.length) {
      return { allocations: alloc, totalExtra: totalExtra, meta: meta };
    }
    const P = rest[0];
    const S = rest.length > 1 ? rest[1] : null;
    const dP0 = findDebt(P.name);
    meta.cap_primary_at_phase2_start = dP0 ? rollingDebtExtraPayoffCap_(dP0) : 0;
    rollingPhase27525TwoTargets_(findDebt, addAlloc, applyDebtPayment_, P, S, R0, meta, primaryPhase2Fraction);
    return { allocations: alloc, totalExtra: totalExtra, meta: meta };
  }

  const P = snapCC[0];
  const S = snapCC.length > 1 ? snapCC[1] : null;
  const dP0 = findDebt(P.name);
  meta.cap_primary_at_phase2_start = rollingDebtExtraPayoffCap_(dP0);
  rollingPhase27525TwoTargets_(findDebt, addAlloc, applyDebtPayment_, P, S, R0, meta, primaryPhase2Fraction);

  return { allocations: alloc, totalExtra: totalExtra, meta: meta };
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

/**
 * Classify execution extra into cleanup payoffs vs concentration bucket; validate primary share and leakage.
 */
function rollingAnalyzeExecutionConcentration_(startSnap, endSnap, execAlloc) {
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

  const concTotal = concItems.reduce(function(s, x) {
    return round2_(s + x.amount);
  }, 0);
  concItems.sort(function(a, b) {
    return aprNm(b.name) - aprNm(a.name);
  });
  const primaryName = concItems.length ? concItems[0].name : '';
  const primaryAmt = concItems.length ? round2_(concItems[0].amount) : 0;
  let secondaryAmt = 0;
  for (let i = 1; i < concItems.length; i++) {
    secondaryAmt = round2_(secondaryAmt + concItems[i].amount);
  }
  const primaryShare = concTotal > 0.005 ? round2_(primaryAmt / concTotal) : 1;
  const concentration_leak = concItems.length > 4;
  const secondary_share_ok = concItems.length <= 4;
  const cleanup_fully_paid_ok = cleanupItems.every(function(c) {
    return b1(c.name) <= 0.05;
  });
  const primary_majority_ok = concItems.length <= 4;

  return {
    cleanup_items: cleanupItems,
    concentration_items: concItems,
    concentration_total: concTotal,
    primary_name: primaryName,
    primary_amount: primaryAmt,
    primary_share_of_concentration: primaryShare,
    secondary_total: secondaryAmt,
    concentration_leak: concentration_leak,
    secondary_share_ok: secondary_share_ok,
    primary_majority_ok: primary_majority_ok,
    cleanup_fully_paid_ok: cleanup_fully_paid_ok
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
  if (!opts.helocRefSim) fail.push('no HELOC line in INPUT - Debts');
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
        'User must map each near-term planned card-funded expense to a specific credit card in INPUT - Upcoming Expenses to finalize an optimal payoff sequence.'
      );
      addItem(
        'required',
        'Map planned card expense to a target credit card (sheet update)',
        'Manual / sheet',
        'INPUT - Upcoming Expenses',
        0,
        'Planner will not guess the payee card for sequencing; modeling-only caution may load on highest-APR card until mapped.'
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
  const planInvalid = !!ctx.planInvalid;
  const displayTotalCash = ctx.displayTotalCash != null && ctx.displayTotalCash === ctx.displayTotalCash ? ctx.displayTotalCash : null;
  const nearTermPlannedCash = ctx.nearTermPlannedCashTotal != null && ctx.nearTermPlannedCashTotal === ctx.nearTermPlannedCashTotal ? round2_(ctx.nearTermPlannedCashTotal) : 0;
  const phase2PrimaryFraction =
    ctx.executionPlanAggressiveAlloc === true
      ? ROLLING_DP_PHASE2_PRIMARY_FRACTION_AGGRESSIVE_
      : ROLLING_DP_PHASE2_PRIMARY_FRACTION_STANDARD_;
  const waterfallOpts = { primaryPhase2Fraction: phase2PrimaryFraction };

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

    if (m === 0) {
      const deployOpen = Math.max(0, round2_(liquid - reserve - buffer));
      const openingIntent = round2_(Math.min(deployOpen, Math.max(0, maxCashDeploy - monthlyCashDeployUsed)));
      liquid = round2_(liquid - openingIntent);
      const openRun = runExtraWaterfall_(simDebts, openingIntent, waterfallOpts);
      openAlloc = openRun.allocations;
      openingConcMeta = openRun.meta || {};
      const appliedOpening = round2_(openRun.totalExtra);
      if (appliedOpening < openingIntent - 0.01) {
        liquid = round2_(liquid + openingIntent - appliedOpening);
      }
      openingSweepExtra = appliedOpening;
      monthlyCashDeployUsed = round2_(monthlyCashDeployUsed + appliedOpening);
    }

    const stableIn = m === 0 ? anchorStable : fwdStable;
    const variableIn = m === 0 ? anchorVar : fwdVar;
    const expensePos = m === 0 ? anchorExpensePos : fwdExpensePos;

    const netToLiquid = round2_(stableIn + (ROLLING_DP_LUMP_RESERVE_ + ROLLING_DP_LUMP_FLEX_) * variableIn - expensePos);
    const debtSideFromVariable = round2_(ROLLING_DP_LUMP_DEBT_ * variableIn);

    liquid = round2_(liquid + netToLiquid);

    const deployMid = Math.max(0, round2_(liquid - reserve - buffer));
    const roomLeft = Math.max(0, round2_(maxCashDeploy - monthlyCashDeployUsed));
    const fromLiquid = round2_(Math.min(deployMid, roomLeft));

    if (m === 0) {
      runCash = runExtraWaterfall_(simDebts, fromLiquid, waterfallOpts);
      deployableConcMeta = runCash.meta || {};
      fromLiquidUsed = round2_(Math.min(fromLiquid, runCash.totalExtra));
      liquid = round2_(liquid - fromLiquidUsed);
      monthlyCashDeployUsed = round2_(monthlyCashDeployUsed + fromLiquidUsed);
      runVar = runExtraWaterfall_(simDebts, debtSideFromVariable, waterfallOpts);
      recurringExtraDebt = round2_(runCash.totalExtra + runVar.totalExtra);
      run = {
        allocations: mergeAllocations_(runCash.allocations, runVar.allocations),
        totalExtra: recurringExtraDebt
      };
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
      const capReached = actualCashDeployment >= maxCashDeploy - 0.5;
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
      execConcAnalysis = rollingAnalyzeExecutionConcentration_(debtBalancesStart, debtBalancesEndSnapshot, execAllocCashObj);
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
      deployable_cash:
        m === 0 && displayTotalCash != null
          ? round2_(Math.max(0, displayTotalCash - reserve - buffer - nearTermPlannedCash))
          : deployableAtStart,
      deployable_cash_after_protections:
        m === 0 && displayTotalCash != null
          ? round2_(Math.max(0, displayTotalCash - reserve - buffer - nearTermPlannedCash))
          : deployableAtStart,
      cash_available_for_extra_debt_today: m === 0 ? executionExtraCashTotal : 0,
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
      debt_balances_end: debtBalancesEndSnapshot,
      execution_concentration_analysis: m === 0 ? execConcAnalysis : null,
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
      allocation_interest_optimized: m === 0 ? allocationInterestOptimized : false
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
      'Sum of active minimum payments (INPUT - Debts): ' +
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
  const deployableAfter =
    liqIn.deployable_cash_after_protections != null &&
    liqIn.deployable_cash_after_protections === liqIn.deployable_cash_after_protections
      ? round2_(liqIn.deployable_cash_after_protections)
      : liqIn.deployable_cash != null && liqIn.deployable_cash === liqIn.deployable_cash
        ? round2_(liqIn.deployable_cash)
        : round2_(Math.max(0, totalCash - reserveTarget - bufferProtected - nearTermReservedExec));
  const cashAvailExtra =
    r0.execution_extra_cash_total != null && r0.execution_extra_cash_total === r0.execution_extra_cash_total
      ? round2_(r0.execution_extra_cash_total)
      : round2_(sumRollingAllocMap_(r0.extra_principal_allocations_execution_now || {}));
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
  lines.push('deployable_cash: ' + fmtCurrency_(deployableAfter));
  lines.push('cash_for_extra_debt: ' + fmtCurrency_(planInvalid ? 0 : cashAvailExtra));
  lines.push('heloc_recommended: ' + helocRecShort);
  lines.push('');

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
  const deployableAfter =
    liqIn.deployable_cash_after_protections != null &&
    liqIn.deployable_cash_after_protections === liqIn.deployable_cash_after_protections
      ? round2_(liqIn.deployable_cash_after_protections)
      : liqIn.deployable_cash != null && liqIn.deployable_cash === liqIn.deployable_cash
        ? round2_(liqIn.deployable_cash)
        : round2_(Math.max(0, totalCash - reserveTarget - bufferProtected - nearTermReservedExec));
  const cashAvailExtra =
    r0.execution_extra_cash_total != null && r0.execution_extra_cash_total === r0.execution_extra_cash_total
      ? round2_(r0.execution_extra_cash_total)
      : round2_(sumRollingAllocMap_(r0.extra_principal_allocations_execution_now || {}));
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

  const totalCash =
    liqIn.total_cash != null && liqIn.total_cash === liqIn.total_cash
      ? round2_(liqIn.total_cash)
      : round2_(Number(r0.starting_cash) || 0);
  const reserveTargetDisplay =
    liqIn.reserve_target != null && liqIn.reserve_target === liqIn.reserve_target
      ? round2_(liqIn.reserve_target)
      : round2_(reserve);
  const bufferDisplay =
    liqIn.buffer_above_reserve != null && liqIn.buffer_above_reserve === liqIn.buffer_above_reserve
      ? round2_(liqIn.buffer_above_reserve)
      : round2_(bufDefault);
  const nearTermPlannedReserved =
    liqIn.near_term_planned_cash_reserved != null && liqIn.near_term_planned_cash_reserved === liqIn.near_term_planned_cash_reserved
      ? round2_(liqIn.near_term_planned_cash_reserved)
      : 0;
  const deployableCash =
    liqIn.deployable_cash != null && liqIn.deployable_cash === liqIn.deployable_cash
      ? round2_(liqIn.deployable_cash)
      : round2_(Math.max(0, totalCash - reserveTargetDisplay - bufferDisplay - nearTermPlannedReserved));
  const deployableAfterProtections =
    liqIn.deployable_cash_after_protections != null && liqIn.deployable_cash_after_protections === liqIn.deployable_cash_after_protections
      ? round2_(liqIn.deployable_cash_after_protections)
      : deployableCash;
  const cashAvailExtraToday =
    liqIn.cash_available_for_extra_debt_today != null && liqIn.cash_available_for_extra_debt_today === liqIn.cash_available_for_extra_debt_today
      ? round2_(liqIn.cash_available_for_extra_debt_today)
      : round2_(Number(r0.execution_extra_cash_total) || 0);
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

  return {
    anchor_month: anchorMonth,
    liquidity: liquidity,
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
      'All contractual minimums on active debts that do not already show a payment in the anchor INPUT - Cash Flow month.',
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
