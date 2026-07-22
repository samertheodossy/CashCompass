/**
 * Financial Integrity Phase 3 — approved canonical current-position read model.
 *
 * This file is deliberately additive and read-only. It does not synchronize
 * mirrors or mutate a workbook. Planner and Rolling may consume the pure
 * normalized-debt helpers below; the full snapshot remains an explicit,
 * read-only diagnostic seam.
 *
 * Approved contract (2026-07-22):
 *   - explicitly inactive rows are excluded; blank/missing Active stays active;
 *   - current-year INPUT ledgers are authoritative for assets;
 *   - active non-summary INPUT - Debts rows are authoritative liabilities;
 *   - linked active Loan/HELOC debt is authoritative property financing;
 *   - an unlinked non-zero legacy property loan remains visible for property
 *     equity but blocks Financial Integrity until explicitly resolved;
 *   - SYS sheets are mirrors whose freshness is measured, never repaired here.
 */

var CANONICAL_FINANCIAL_SNAPSHOT_VERSION_ = 1;
var CANONICAL_FINANCIAL_TOLERANCE_USD_ = 0.01;
var CANONICAL_FINANCIAL_BASIS_ =
  'ACTIVE_OWNED_POSITION_LINKED_DEBT_AUTHORITY';
var CANONICAL_FINANCIAL_STATUS_ = {
  PASS: 'PASS',
  BLOCKED: 'BLOCKED'
};

/** Pure approved Active rule. Unknown values preserve backward compatibility. */
function canonicalCurrentRowIncluded_(hasActiveColumn, rawActive) {
  if (!hasActiveColumn) return true;
  var value = String(rawActive == null ? '' : rawActive).trim().toLowerCase();
  return value !== 'no' && value !== 'n' && value !== 'false' &&
    value !== 'inactive';
}

/** Pure summary-row exclusion used before any canonical amount enters a total. */
function canonicalSummaryRow_(domain, rawName) {
  var name = String(rawName || '').trim().toUpperCase();
  if (!name) return true;
  var d = String(domain || '').trim().toLowerCase();
  if (d === 'cash') {
    return name === 'TOTAL ACCOUNTS' || name === 'DELTA' ||
      name === 'ACCOUNT NAME' || name === 'YEAR';
  }
  if (d === 'investments') {
    return name === 'ACCOUNT TOTALS' || name === 'DELTA' ||
      name === 'ACCOUNT NAME' || name === 'YEAR';
  }
  if (d === 'properties') {
    return name === 'TOTAL VALUES' || name === 'HOUSE ASSETS' ||
      name === 'HOUSE' || name === 'YEAR';
  }
  if (d === 'debts') return name === 'TOTAL DEBT' || name === 'ACCOUNT NAME';
  return false;
}

function canonicalFinancialKey_(value) {
  return String(value || '').trim().toLowerCase();
}

function canonicalFinancialIssue_(code, message, details) {
  return {
    code: String(code || ''),
    message: String(message || ''),
    details: details || {}
  };
}

function canonicalFinancialSumIncluded_(rows, valueField) {
  return round2_((rows || []).reduce(function(sum, row) {
    if (!row || !row.included) return sum;
    return sum + toNumber_(row[valueField]);
  }, 0));
}

/**
 * Shared Central/bounded current-position selector for already-normalized debt
 * objects. normalizeDebts_ owns legacy Active interpretation; this helper owns
 * active-only inclusion and defensively removes summary rows. It is pure and
 * introduces no workbook read, write, schema, or environment-specific path.
 */
function canonicalLiveNormalizedDebts_(debts) {
  return (debts || []).filter(function(debt) {
    if (!debt || debt.active === false) return false;
    return !canonicalSummaryRow_(
      'debts', debt.originalName || debt.name || '');
  });
}

/** Shared active-only liability total and type breakdown for Planner. */
function canonicalLiabilitySummaryFromNormalizedDebts_(debts) {
  var summary = {
    totalLiabilities: 0,
    creditCards: 0,
    loans: 0,
    heloc: 0,
    other: 0
  };

  canonicalLiveNormalizedDebts_(debts).forEach(function(debt) {
    var balance = round2_(toNumber_(debt.balance));
    var type = String(debt.type || '').trim();
    summary.totalLiabilities += balance;
    if (type === 'Credit Card') summary.creditCards += balance;
    else if (type === 'Loan') summary.loans += balance;
    else if (type === 'HELOC') summary.heloc += balance;
    else summary.other += balance;
  });

  Object.keys(summary).forEach(function(key) {
    summary[key] = round2_(summary[key]);
  });
  return summary;
}

/**
 * Shared Rolling debt basis. The live anchor and scenario adjustments remain
 * separate while modeledDebts verifies the simulator start reconciles.
 */
function canonicalRollingDebtBasis_(debts, scenarioAdjustments, modeledDebts) {
  var live = canonicalLiabilitySummaryFromNormalizedDebts_(debts)
    .totalLiabilities;
  var adjustments = (scenarioAdjustments || []).map(function(adjustment) {
    return {
      code: String(adjustment && adjustment.code || '').trim() ||
        'UNSPECIFIED_SCENARIO_ADJUSTMENT',
      label: String(adjustment && adjustment.label || '').trim(),
      amount: round2_(toNumber_(adjustment && adjustment.amount))
    };
  }).filter(function(adjustment) {
    return Math.abs(adjustment.amount) > CANONICAL_FINANCIAL_TOLERANCE_USD_;
  });
  var adjustmentTotal = round2_(adjustments.reduce(function(sum, adjustment) {
    return sum + adjustment.amount;
  }, 0));
  var modeledStart = round2_(canonicalLiveNormalizedDebts_(modeledDebts || debts)
    .reduce(function(sum, debt) {
      return sum + Math.max(0, toNumber_(debt.balance));
    }, 0));
  var expectedModeledStart = round2_(live + adjustmentTotal);
  var delta = round2_(modeledStart - expectedModeledStart);

  return {
    basis: CANONICAL_FINANCIAL_BASIS_,
    canonicalLiveDebt: live,
    scenarioAdjustments: adjustments,
    scenarioAdjustmentTotal: adjustmentTotal,
    modeledStartingDebt: modeledStart,
    expectedModeledStartingDebt: expectedModeledStart,
    reconciliationDelta: delta,
    reconciles: Math.abs(delta) <= CANONICAL_FINANCIAL_TOLERANCE_USD_
  };
}

/**
 * Read one current-year INPUT ledger block with no writes or self-heal.
 */
function canonicalReadYearLedger_(sheet, year, config) {
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  var block = config.getBlock(sheet, year, display);
  var headers = display[block.headerRow - 1] || [];
  var activeColZero = headers.indexOf('Active');
  var typeColZero = headers.indexOf('Type');
  var loanColZero = headers.indexOf('Loan Amount Left');
  var rows = [];

  for (var row1 = block.dataStartRow; row1 <= block.dataEndRow; row1++) {
    var idx = row1 - 1;
    var displayRow = display[idx] || [];
    var valueRow = values[idx] || [];
    var name = String(displayRow[0] || '').trim();
    var sub = String(displayRow[1] || '').trim();
    if (!config.isDataRow(name, sub) || canonicalSummaryRow_(config.domain, name)) {
      continue;
    }

    var latestColZero = -1;
    var latestTime = -1;
    for (var c = block.firstMonthCol - 1; c < headers.length; c++) {
      var parsed = parseMonthHeader_(headers[c]);
      if (!parsed || parsed.getFullYear() !== Number(year)) continue;
      var raw = valueRow[c];
      if (raw === '' || raw === null || raw === undefined) continue;
      if (parsed.getTime() > latestTime) {
        latestTime = parsed.getTime();
        latestColZero = c;
      }
    }

    var activeRaw = activeColZero === -1 ? '' : displayRow[activeColZero];
    rows.push({
      name: name,
      key: canonicalFinancialKey_(name),
      type: typeColZero === -1 ? '' : String(displayRow[typeColZero] || '').trim(),
      sourceRow: row1,
      activeRaw: String(activeRaw == null ? '' : activeRaw).trim(),
      included: canonicalCurrentRowIncluded_(activeColZero !== -1, activeRaw),
      currentValue: latestColZero === -1 ? 0 : round2_(toNumber_(valueRow[latestColZero])),
      currentValueHeader: latestColZero === -1 ? '' : String(headers[latestColZero] || '').trim(),
      hasCurrentValue: latestColZero !== -1,
      legacyLoanBalance: loanColZero === -1 ? 0 : round2_(toNumber_(valueRow[loanColZero]))
    });
  }

  return {
    rows: rows,
    hasActiveColumn: activeColZero !== -1,
    sheetName: sheet.getName()
  };
}

function canonicalReadSourceDomain_(ss, year, config) {
  var sheet = ss.getSheetByName(config.sheetName);
  if (!sheet) {
    return {
      rows: [],
      hasActiveColumn: false,
      available: false,
      issues: [canonicalFinancialIssue_(
        'MISSING_' + config.domain.toUpperCase() + '_SOURCE',
        'Authoritative source sheet is missing: ' + config.sheetName + '.',
        { domain: config.domain, sheet: config.sheetName }
      )]
    };
  }
  try {
    var read = canonicalReadYearLedger_(sheet, year, config);
    read.available = true;
    read.issues = [];
    return read;
  } catch (err) {
    return {
      rows: [],
      hasActiveColumn: false,
      available: false,
      issues: [canonicalFinancialIssue_(
        'UNREADABLE_' + config.domain.toUpperCase() + '_SOURCE',
        'Could not read authoritative ' + config.domain + ' source: ' +
          (err && err.message ? err.message : err),
        { domain: config.domain, sheet: config.sheetName }
      )]
    };
  }
}

function canonicalReadDebts_(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return {
      rows: [], hasActiveColumn: false, available: false,
      issues: [canonicalFinancialIssue_(
        'MISSING_DEBTS_SOURCE',
        'Authoritative source sheet is missing: ' + sheetName + '.',
        { domain: 'debts', sheet: sheetName }
      )]
    };
  }
  try {
    var values = sheet.getDataRange().getValues();
    var display = sheet.getDataRange().getDisplayValues();
    var headers = display[0] || [];
    var nameCol = headers.indexOf('Account Name');
    var typeCol = headers.indexOf('Type');
    var balanceCol = headers.indexOf('Account Balance');
    var activeCol = headers.indexOf('Active');
    var linkedCol = headers.indexOf('Linked Property');
    if (nameCol === -1 || balanceCol === -1) {
      throw new Error('INPUT - Debts must contain Account Name and Account Balance.');
    }
    var rows = [];
    for (var r = 1; r < display.length; r++) {
      var name = String(display[r][nameCol] || '').trim();
      if (!name || canonicalSummaryRow_('debts', name)) continue;
      var activeRaw = activeCol === -1 ? '' : display[r][activeCol];
      rows.push({
        name: name,
        key: canonicalFinancialKey_(name),
        type: typeCol === -1 ? '' : String(display[r][typeCol] || '').trim(),
        sourceRow: r + 1,
        activeRaw: String(activeRaw == null ? '' : activeRaw).trim(),
        included: canonicalCurrentRowIncluded_(activeCol !== -1, activeRaw),
        balance: round2_(toNumber_(values[r][balanceCol])),
        linkedProperty: linkedCol === -1 ? '' : String(display[r][linkedCol] || '').trim()
      });
    }
    return {
      rows: rows,
      hasActiveColumn: activeCol !== -1,
      hasLinkedPropertyColumn: linkedCol !== -1,
      available: true,
      issues: []
    };
  } catch (err) {
    return {
      rows: [], hasActiveColumn: false, available: false,
      issues: [canonicalFinancialIssue_(
        'UNREADABLE_DEBTS_SOURCE',
        'Could not read authoritative debts source: ' +
          (err && err.message ? err.message : err),
        { domain: 'debts', sheet: sheetName }
      )]
    };
  }
}

function canonicalReadMirrorRows_(sheet, config) {
  var values = sheet.getDataRange().getValues();
  var display = sheet.getDataRange().getDisplayValues();
  var headers = display[0] || [];
  var nameCol = headers.indexOf(config.nameHeader);
  var valueCol = headers.indexOf(config.valueHeader);
  var activeCol = headers.indexOf('Active');
  if (nameCol === -1 || valueCol === -1) {
    throw new Error(sheet.getName() + ' must contain ' + config.nameHeader +
      ' and ' + config.valueHeader + '.');
  }
  var rows = [];
  for (var r = 1; r < display.length; r++) {
    var name = String(display[r][nameCol] || '').trim();
    if (!name || canonicalSummaryRow_(config.domain, name)) continue;
    var activeRaw = activeCol === -1 ? '' : display[r][activeCol];
    rows.push({
      name: name,
      key: canonicalFinancialKey_(name),
      activeRaw: String(activeRaw == null ? '' : activeRaw).trim(),
      included: canonicalCurrentRowIncluded_(activeCol !== -1, activeRaw),
      currentValue: round2_(toNumber_(values[r][valueCol]))
    });
  }
  return { rows: rows, hasActiveColumn: activeCol !== -1 };
}

function canonicalRowsByKey_(rows, valueField) {
  var out = Object.create(null);
  (rows || []).forEach(function(row) {
    if (!row || !row.included) return;
    var key = row.key || canonicalFinancialKey_(row.name);
    if (!out[key]) out[key] = { name: row.name, value: 0, count: 0 };
    out[key].value = round2_(out[key].value + toNumber_(row[valueField]));
    out[key].count++;
  });
  return out;
}

function canonicalCompareMirror_(ss, sourceRows, config, tolerance) {
  var sheet = ss.getSheetByName(config.sheetName);
  if (!sheet) {
    return {
      domain: config.domain,
      available: false,
      matches: false,
      sourceTotal: canonicalFinancialSumIncluded_(sourceRows, 'currentValue'),
      mirrorTotal: null,
      difference: null,
      rowDifferences: [],
      issues: [canonicalFinancialIssue_(
        'MISSING_' + config.domain.toUpperCase() + '_MIRROR',
        'Runtime mirror is missing: ' + config.sheetName + '.',
        { domain: config.domain, sheet: config.sheetName }
      )]
    };
  }

  try {
    var mirror = canonicalReadMirrorRows_(sheet, config);
    var sourceByKey = canonicalRowsByKey_(sourceRows, 'currentValue');
    var mirrorByKey = canonicalRowsByKey_(mirror.rows, 'currentValue');
    var allKeys = Object.create(null);
    Object.keys(sourceByKey).forEach(function(key) { allKeys[key] = true; });
    Object.keys(mirrorByKey).forEach(function(key) { allKeys[key] = true; });
    var rowDifferences = [];
    Object.keys(allKeys).sort().forEach(function(key) {
      var sourceEntry = sourceByKey[key];
      var mirrorEntry = mirrorByKey[key];
      var sourceValue = sourceEntry ? sourceEntry.value : 0;
      var mirrorValue = mirrorEntry ? mirrorEntry.value : 0;
      var difference = round2_(mirrorValue - sourceValue);
      if (!sourceEntry || !mirrorEntry || Math.abs(difference) > tolerance) {
        rowDifferences.push({
          key: key,
          name: sourceEntry ? sourceEntry.name : mirrorEntry.name,
          sourceValue: sourceEntry ? sourceValue : null,
          mirrorValue: mirrorEntry ? mirrorValue : null,
          difference: difference
        });
      }
    });
    var sourceTotal = canonicalFinancialSumIncluded_(sourceRows, 'currentValue');
    var mirrorTotal = canonicalFinancialSumIncluded_(mirror.rows, 'currentValue');
    var totalDifference = round2_(mirrorTotal - sourceTotal);
    var matches = rowDifferences.length === 0 && Math.abs(totalDifference) <= tolerance;
    var issues = matches ? [] : [canonicalFinancialIssue_(
      config.domain.toUpperCase() + '_MIRROR_MISMATCH',
      config.sheetName + ' does not match its authoritative source to $' +
        Number(tolerance).toFixed(2) + '.',
      { domain: config.domain, difference: totalDifference, rowDifferences: rowDifferences }
    )];
    return {
      domain: config.domain,
      available: true,
      hasActiveColumn: mirror.hasActiveColumn,
      matches: matches,
      sourceTotal: sourceTotal,
      mirrorTotal: mirrorTotal,
      difference: totalDifference,
      rowDifferences: rowDifferences,
      issues: issues
    };
  } catch (err) {
    return {
      domain: config.domain,
      available: false,
      matches: false,
      sourceTotal: canonicalFinancialSumIncluded_(sourceRows, 'currentValue'),
      mirrorTotal: null,
      difference: null,
      rowDifferences: [],
      issues: [canonicalFinancialIssue_(
        'UNREADABLE_' + config.domain.toUpperCase() + '_MIRROR',
        'Could not read runtime mirror ' + config.sheetName + ': ' +
          (err && err.message ? err.message : err),
        { domain: config.domain, sheet: config.sheetName }
      )]
    };
  }
}

function canonicalBuildPropertyFinancing_(propertyRows, debtRows, tolerance) {
  var blockingIssues = [];
  var propertiesByKey = Object.create(null);
  (propertyRows || []).forEach(function(property) {
    if (!property || !property.included) return;
    if (propertiesByKey[property.key]) {
      blockingIssues.push(canonicalFinancialIssue_(
        'DUPLICATE_ACTIVE_PROPERTY',
        'Duplicate active property name must be resolved: ' + property.name + '.',
        { property: property.name }
      ));
      return;
    }
    propertiesByKey[property.key] = property;
  });

  var linkedByProperty = Object.create(null);
  (debtRows || []).forEach(function(debt) {
    if (!debt || !debt.included || !String(debt.linkedProperty || '').trim()) return;
    var type = String(debt.type || '').trim().toLowerCase();
    if (type !== 'loan' && type !== 'heloc') {
      blockingIssues.push(canonicalFinancialIssue_(
        'INVALID_LINKED_DEBT_TYPE',
        'Only active Loan/HELOC debt can finance a property: ' + debt.name + '.',
        { debt: debt.name, type: debt.type, linkedProperty: debt.linkedProperty }
      ));
      return;
    }
    var propertyKey = canonicalFinancialKey_(debt.linkedProperty);
    if (!propertiesByKey[propertyKey]) {
      blockingIssues.push(canonicalFinancialIssue_(
        'LINKED_PROPERTY_UNAVAILABLE',
        'Active linked debt points to an inactive or unavailable property: ' +
          debt.linkedProperty + '.',
        { debt: debt.name, linkedProperty: debt.linkedProperty }
      ));
      return;
    }
    if (!linkedByProperty[propertyKey]) linkedByProperty[propertyKey] = [];
    linkedByProperty[propertyKey].push(debt);
  });

  var byProperty = [];
  Object.keys(propertiesByKey).sort().forEach(function(key) {
    var property = propertiesByKey[key];
    var linked = linkedByProperty[key] || [];
    var linkedBalance = round2_(linked.reduce(function(sum, debt) {
      return sum + toNumber_(debt.balance);
    }, 0));
    var legacyBalance = round2_(toNumber_(property.legacyLoanBalance));
    var authoritativeLoanBalance = linked.length ? linkedBalance : legacyBalance;
    var authority = linked.length ? 'LINKED_ACTIVE_DEBT' :
      (Math.abs(legacyBalance) > tolerance ? 'UNLINKED_LEGACY_FALLBACK' : 'NONE');

    if (!linked.length && Math.abs(legacyBalance) > tolerance) {
      blockingIssues.push(canonicalFinancialIssue_(
        'UNLINKED_PROPERTY_FINANCING',
        'Property has a non-zero legacy loan balance but no active linked debt: ' +
          property.name + '.',
        { property: property.name, legacyLoanBalance: legacyBalance }
      ));
    }
    if (linked.length && Math.abs(legacyBalance) > tolerance &&
        Math.abs(linkedBalance - legacyBalance) > tolerance) {
      blockingIssues.push(canonicalFinancialIssue_(
        'PROPERTY_FINANCING_MISMATCH',
        'Linked debt and legacy property loan differ by more than $' +
          Number(tolerance).toFixed(2) + ': ' + property.name + '.',
        {
          property: property.name,
          linkedDebtBalance: linkedBalance,
          legacyLoanBalance: legacyBalance,
          difference: round2_(linkedBalance - legacyBalance)
        }
      ));
    }

    byProperty.push({
      property: property.name,
      currentValue: round2_(property.currentValue),
      authority: authority,
      authoritativeLoanBalance: authoritativeLoanBalance,
      linkedDebtBalance: linkedBalance,
      linkedDebtCount: linked.length,
      linkedDebtNames: linked.map(function(debt) { return debt.name; }),
      legacyLoanBalance: legacyBalance,
      estimatedEquity: round2_(property.currentValue - authoritativeLoanBalance),
      reconciliationBlocked: authority === 'UNLINKED_LEGACY_FALLBACK' ||
        (linked.length && Math.abs(legacyBalance) > tolerance &&
          Math.abs(linkedBalance - legacyBalance) > tolerance)
    });
  });

  return {
    status: blockingIssues.length ? CANONICAL_FINANCIAL_STATUS_.BLOCKED :
      CANONICAL_FINANCIAL_STATUS_.PASS,
    byProperty: byProperty,
    blockingIssues: blockingIssues
  };
}

/**
 * Read the approved canonical current financial position from an explicit
 * spreadsheet. Read-only: this function contains no ensure/sync/write path.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss explicit workbook
 * @returns {!Object} versioned canonical snapshot and diagnostics
 */
function readCanonicalFinancialSnapshot_(ss) {
  if (!ss || typeof ss.getSheetByName !== 'function') {
    throw new Error('readCanonicalFinancialSnapshot_ requires an explicit spreadsheet.');
  }
  var names = getSheetNames_();
  var year = (typeof getCurrentYear_ === 'function') ? getCurrentYear_() :
    new Date().getFullYear();
  var tolerance = (typeof FINANCIAL_AUDIT_TOLERANCE_USD_ === 'number') ?
    FINANCIAL_AUDIT_TOLERANCE_USD_ : 0.01;

  var cash = canonicalReadSourceDomain_(ss, year, {
    domain: 'cash',
    sheetName: names.BANK_ACCOUNTS,
    getBlock: getBankAccountsYearBlock_,
    isDataRow: function(name) { return isBankAccountDataRowName_(name); }
  });
  var investments = canonicalReadSourceDomain_(ss, year, {
    domain: 'investments',
    sheetName: names.INVESTMENTS,
    getBlock: getInvestmentsYearBlock_,
    isDataRow: function(name) { return isInvestmentDataRowName_(name); }
  });
  var properties = canonicalReadSourceDomain_(ss, year, {
    domain: 'properties',
    sheetName: names.HOUSE_VALUES,
    getBlock: getHouseValuesYearBlock_,
    isDataRow: function(name, sub) { return isHouseDataRowName_(name, sub); }
  });
  var debts = canonicalReadDebts_(ss, names.DEBTS);

  var blockingIssues = [];
  [cash, investments, properties, debts].forEach(function(domain) {
    blockingIssues = blockingIssues.concat(domain.issues || []);
  });
  var compatibilityObservations = [];
  [
    { name: 'cash', read: cash },
    { name: 'investments', read: investments },
    { name: 'properties', read: properties },
    { name: 'debts', read: debts }
  ].forEach(function(domain) {
    if (domain.read.available && !domain.read.hasActiveColumn) {
      compatibilityObservations.push(canonicalFinancialIssue_(
        'MISSING_ACTIVE_COLUMN',
        domain.name + ' has no Active column; approved compatibility rule treats every row as active.',
        { domain: domain.name }
      ));
    }
  });

  var cashMirror = canonicalCompareMirror_(ss, cash.rows, {
    domain: 'cash', sheetName: names.ACCOUNTS,
    nameHeader: 'Account Name', valueHeader: 'Current Balance'
  }, tolerance);
  var investmentMirror = canonicalCompareMirror_(ss, investments.rows, {
    domain: 'investments', sheetName: names.ASSETS,
    nameHeader: 'Account Name', valueHeader: 'Current Balance'
  }, tolerance);
  var propertyMirror = canonicalCompareMirror_(ss, properties.rows, {
    domain: 'properties', sheetName: names.HOUSE_ASSETS,
    nameHeader: 'House', valueHeader: 'Current Value'
  }, tolerance);
  [cashMirror, investmentMirror, propertyMirror].forEach(function(mirror) {
    blockingIssues = blockingIssues.concat(mirror.issues || []);
  });

  var propertyFinancing = canonicalBuildPropertyFinancing_(
    properties.rows, debts.rows, tolerance);
  blockingIssues = blockingIssues.concat(propertyFinancing.blockingIssues || []);

  var totalCash = canonicalFinancialSumIncluded_(cash.rows, 'currentValue');
  var totalInvestments = canonicalFinancialSumIncluded_(investments.rows, 'currentValue');
  var grossRealEstate = canonicalFinancialSumIncluded_(properties.rows, 'currentValue');
  var totalLiabilities = round2_((debts.rows || []).reduce(function(sum, debt) {
    return debt && debt.included ? sum + toNumber_(debt.balance) : sum;
  }, 0));
  var totalAssets = round2_(totalCash + totalInvestments + grossRealEstate);

  return {
    schemaVersion: CANONICAL_FINANCIAL_SNAPSHOT_VERSION_,
    basis: CANONICAL_FINANCIAL_BASIS_,
    status: blockingIssues.length ? CANONICAL_FINANCIAL_STATUS_.BLOCKED :
      CANONICAL_FINANCIAL_STATUS_.PASS,
    generatedAt: new Date().toISOString(),
    currentYear: year,
    toleranceUsd: tolerance,
    totals: {
      cash: totalCash,
      investments: totalInvestments,
      grossRealEstate: grossRealEstate,
      totalAssets: totalAssets,
      totalLiabilities: totalLiabilities,
      netWorth: round2_(totalAssets - totalLiabilities)
    },
    rows: {
      cash: cash.rows,
      investments: investments.rows,
      properties: properties.rows,
      debts: debts.rows
    },
    mirrors: {
      cash: cashMirror,
      investments: investmentMirror,
      properties: propertyMirror
    },
    propertyFinancing: propertyFinancing,
    compatibilityObservations: compatibilityObservations,
    blockingIssues: blockingIssues
  };
}
