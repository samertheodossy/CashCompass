/**
 * Planning → Education (slices A/B): saved education-plan inputs.
 *
 * Scope: navigation, exact 529 identities, two-sheet INPUT model, edit/clear/save.
 * This file does not calculate forecasts, coverage, overlap paths, or run-workbook
 * writes. Projection math is a later slice.
 *
 * Implementation notes — end-of-month balance start rule (slice C):
 * A projection based on an end-of-month investment balance starts in the
 * following calendar month. Contributions or expenses already reflected in that
 * end-of-month balance are not counted twice. Example: a September 30 balance
 * is the opening position for October; September contributions already inside
 * that balance must not be applied again as October inflows.
 *
 * Architecture notes (approved design vs existing CashCompass):
 * - Account identity is exact `Lutfi 529` and `Laith 529`. No beneficiary
 *   fuzzy-match and no type-based auto-map onto other 529 rows.
 * - Live balances are read from existing investment data (`SYS - Assets`,
 *   and `INPUT - Investments` when present). Education sheets never store or
 *   rewrite those balances.
 * - Blank Education amounts mean unknown. `toNumber_('') → 0` is unsafe here;
 *   optional money uses present/absent evidence, matching Investments.
 * - First-create is an insert-only no-op when the sheet already exists
 *   (Retirement convention). Existing Education data is never reformatted.
 * - Retirement is unchanged in this slice. `getCurrentInvestableAssetsForRetirement_`
 *   still sums every named `SYS - Assets` Current Balance, including 529s.
 *   Filtering 529s out of Retirement investable assets is a separate review.
 *
 * Customer editing stays under Planning → Education. There is no Education
 * card on frozen Planning Overview / This Week.
 */

var EDUCATION_SHEET_NAME_ = 'INPUT - Education';
var EDUCATION_LINE_ITEMS_SHEET_NAME_ = 'INPUT - Education Line Items';
var EDUCATION_ACCOUNT_NAMES_ = ['Lutfi 529', 'Laith 529'];
var EDUCATION_SCENARIOS_ = ['Low', 'Base', 'High'];
var EDUCATION_RECORD_TYPES_ = ['STAGE', 'COST', 'CONTRIBUTION_CHANGE'];
var EDUCATION_ENTRY_STATUSES_ = ['ESTIMATE', 'CONFIRMED'];
var EDUCATION_PLANNED_CHOICES_ = ['CONTINUE', 'REDUCE', 'PAUSE'];
var EDUCATION_OVERLAP_POLICIES_ = ['ADDS', 'REPLACES'];
var EDUCATION_REMAINDER_POLICIES_ = ['CONTINUE', 'REDUCE', 'PAUSE'];
var EDUCATION_YEAR_COMPLETENESS_ = ['COMPLETE', 'PARTIAL'];
var EDUCATION_STAGE_KINDS_ = ['UNDERGRAD', 'GRAD', 'LAW', 'STUDY_ABROAD', 'OTHER'];
var EDUCATION_COST_KINDS_ = ['TUITION_SEMESTER', 'LIVING_MONTHLY', 'ONE_TIME', 'ANNUAL_ESTIMATE'];
var EDUCATION_CONTRIBUTION_CHANGE_KINDS_ = ['CONTINUE', 'REDUCE', 'PAUSE', 'START'];

var EDUCATION_HOUSEHOLD_HEADERS_ = ['Setting', 'Low', 'Base', 'High', 'Value'];
var EDUCATION_PLAN_HEADERS_ = [
  'Account Name',
  'Coverage Goal',
  'Current Monthly Contribution',
  'Contribution Entry Status',
  'Planned Choice',
  'Planned Choice Entry Status',
  'Notes'
];
var EDUCATION_LINE_ITEM_HEADERS_ = [
  'Item Id',
  'Account Name',
  'Record Type',
  'Kind',
  'Label',
  'Amount',
  'Entry Status',
  'Start Month',
  'End Month',
  'Academic Year',
  'Year Completeness',
  'Overlap Policy',
  'Remainder Policy',
  'Notes'
];

function getEducationUiData(optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
  const planSheet = getOrCreateEducationSheet_(ss);
  const lineSheet = getOrCreateEducationLineItemsSheet_(ss);
  return buildEducationUiData_(ss, planSheet, lineSheet);
}

function saveEducationInputs(payload, optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
  const planSheet = getOrCreateEducationSheet_(ss);
  const lineSheet = getOrCreateEducationLineItemsSheet_(ss);
  const normalized = normalizeEducationSavePayload_(payload);

  writeEducationHousehold_(planSheet, normalized.household);
  writeEducationPlans_(planSheet, normalized.plans);
  writeEducationLineItems_(lineSheet, normalized.lineItems);

  logEducationPlanUpdate_(ss, normalized, false);
  if (typeof touchDashboardSourceUpdated_ === 'function') {
    touchDashboardSourceUpdated_('education');
  }

  return {
    ok: true,
    message: 'Education plan saved.',
    data: buildEducationUiData_(ss, planSheet, lineSheet)
  };
}

function clearEducationPlan(payload, optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
  const accountName = educationExactAccountName_(payload && payload.accountName);
  if (!accountName) {
    throw new Error('Choose Lutfi 529 or Laith 529 before clearing.');
  }

  const current = getEducationUiData(ss);
  const clearedPlans = current.plans.map(function(plan) {
    if (plan.accountName !== accountName) return educationPlanForSave_(plan);
    return blankEducationPlan_(accountName);
  });
  const clearedItems = (current.lineItems || []).filter(function(item) {
    return item.accountName !== accountName;
  });

  const saved = saveEducationInputs({
    household: current.household,
    plans: clearedPlans,
    lineItems: clearedItems,
    clearedAccountName: accountName
  }, ss);

  saved.message = 'Cleared ' + accountName + ' education inputs.';
  return saved;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} optionalSs
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateEducationSheet_(optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
  const existing = ss.getSheetByName(EDUCATION_SHEET_NAME_);
  if (existing) return existing;

  const sheet = ss.insertSheet(EDUCATION_SHEET_NAME_);
  const rows = [
    EDUCATION_HOUSEHOLD_HEADERS_.slice(),
    ['Selected Scenario', '', '', '', 'Base'],
    ['Expected Annual Return %', '', '', '', ''],
    ['Education Cost Inflation %', '', '', '', ''],
    ['', '', '', '', ''],
    EDUCATION_PLAN_HEADERS_.slice(),
    [EDUCATION_ACCOUNT_NAMES_[0], '', '', '', '', '', ''],
    [EDUCATION_ACCOUNT_NAMES_[1], '', '', '', '', '', '']
  ];
  sheet.getRange(1, 1, rows.length, EDUCATION_PLAN_HEADERS_.length).setValues(
    rows.map(function(row) {
      const copy = row.slice();
      while (copy.length < EDUCATION_PLAN_HEADERS_.length) copy.push('');
      return copy;
    })
  );
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, EDUCATION_PLAN_HEADERS_.length, 180);
  sheet.getRange(1, 1, 1, EDUCATION_HOUSEHOLD_HEADERS_.length).setFontWeight('bold');
  sheet.getRange(6, 1, 1, EDUCATION_PLAN_HEADERS_.length).setFontWeight('bold');
  sheet.getRange(2, 5).setNumberFormat('@');
  sheet.getRange(3, 2, 2, 3).setNumberFormat('0.00');
  sheet.getRange(7, 3, 2, 1).setNumberFormat('$#,##0.00');
  sheet.getRange(7, 4, 2, 3).setNumberFormat('@');
  return sheet;
}

/**
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} optionalSs
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateEducationLineItemsSheet_(optionalSs) {
  const ss = optionalSs || getUserSpreadsheet_();
  const existing = ss.getSheetByName(EDUCATION_LINE_ITEMS_SHEET_NAME_);
  if (existing) return existing;

  const sheet = ss.insertSheet(EDUCATION_LINE_ITEMS_SHEET_NAME_);
  sheet.getRange(1, 1, 1, EDUCATION_LINE_ITEM_HEADERS_.length)
    .setValues([EDUCATION_LINE_ITEM_HEADERS_.slice()]);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, EDUCATION_LINE_ITEM_HEADERS_.length, 140);
  sheet.getRange(1, 1, 1, EDUCATION_LINE_ITEM_HEADERS_.length).setFontWeight('bold');
  sheet.getRange(1, 6, 1, 1).setNumberFormat('$#,##0.00');
  sheet.getRange(1, 8, 1, 2).setNumberFormat('@');
  return sheet;
}

function buildEducationUiData_(ss, planSheet, lineSheet) {
  const household = readEducationHousehold_(planSheet);
  const storedPlans = readEducationPlans_(planSheet);
  const plans = EDUCATION_ACCOUNT_NAMES_.map(function(accountName) {
    const stored = storedPlans[accountName] || blankEducationPlan_(accountName);
    const live = educationReadLiveAccount_(ss, accountName);
    return Object.assign({}, stored, {
      liveBalance: live
    });
  });
  return {
    projectionAvailable: false,
    household: household,
    plans: plans,
    lineItems: readEducationLineItems_(lineSheet),
    accountNames: EDUCATION_ACCOUNT_NAMES_.slice(),
    retirement529Review: {
      labeled: true,
      retirementCodeUnchanged: true,
      summary:
        'Retirement still includes 529 balances in current investable assets. That filter is a separate review.'
    }
  };
}

function readEducationHousehold_(sheet) {
  const values = sheet.getDataRange().getValues();
  const selected = educationNormalizeScenario_(
    educationFindLabelValue_(values, 'Selected Scenario', 4)
  );
  return {
    selectedScenario: selected,
    expectedAnnualReturnPct: educationReadRateRow_(values, 'Expected Annual Return %'),
    educationCostInflationPct: educationReadRateRow_(values, 'Education Cost Inflation %')
  };
}

function readEducationPlans_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headerRow = educationFindHeaderRow_(values, 'Account Name');
  const out = {};
  if (headerRow < 0) return out;
  const headers = values[headerRow].map(function(h) { return String(h || '').trim(); });
  const nameIdx = headers.indexOf('Account Name');
  if (nameIdx < 0) return out;
  for (let r = headerRow + 1; r < values.length; r++) {
    const name = String(values[r][nameIdx] || '').trim();
    if (!name) continue;
    if (EDUCATION_ACCOUNT_NAMES_.indexOf(name) === -1) continue;
    out[name] = {
      accountName: name,
      coverageGoal: educationReadText_(values[r][headers.indexOf('Coverage Goal')]),
      currentMonthlyContribution: educationReadOptionalNumber_(
        values[r][headers.indexOf('Current Monthly Contribution')]
      ),
      contributionEntryStatus: educationNormalizeEnum_(
        values[r][headers.indexOf('Contribution Entry Status')],
        EDUCATION_ENTRY_STATUSES_
      ),
      plannedChoice: educationNormalizeEnum_(
        values[r][headers.indexOf('Planned Choice')],
        EDUCATION_PLANNED_CHOICES_
      ),
      plannedChoiceEntryStatus: educationNormalizeEnum_(
        values[r][headers.indexOf('Planned Choice Entry Status')],
        EDUCATION_ENTRY_STATUSES_
      ),
      notes: educationReadText_(values[r][headers.indexOf('Notes')])
    };
  }
  return out;
}

function readEducationLineItems_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return [];
  const headers = values[0].map(function(h) { return String(h || '').trim(); });
  const nameIdx = headers.indexOf('Account Name');
  if (nameIdx < 0) return [];
  const items = [];
  for (let r = 1; r < values.length; r++) {
    const accountName = String(values[r][nameIdx] || '').trim();
    if (EDUCATION_ACCOUNT_NAMES_.indexOf(accountName) === -1) continue;
    const amountIdx = headers.indexOf('Amount');
    items.push({
      itemId: educationReadText_(values[r][headers.indexOf('Item Id')]),
      accountName: accountName,
      recordType: educationNormalizeEnum_(
        values[r][headers.indexOf('Record Type')],
        EDUCATION_RECORD_TYPES_
      ),
      kind: educationReadText_(values[r][headers.indexOf('Kind')]),
      label: educationReadText_(values[r][headers.indexOf('Label')]),
      amount: educationReadOptionalNumber_(amountIdx < 0 ? '' : values[r][amountIdx]),
      entryStatus: educationNormalizeEnum_(
        values[r][headers.indexOf('Entry Status')],
        EDUCATION_ENTRY_STATUSES_
      ),
      startMonth: educationReadMonth_(values[r][headers.indexOf('Start Month')]),
      endMonth: educationReadMonth_(values[r][headers.indexOf('End Month')]),
      academicYear: educationReadText_(values[r][headers.indexOf('Academic Year')]),
      yearCompleteness: educationNormalizeEnum_(
        values[r][headers.indexOf('Year Completeness')],
        EDUCATION_YEAR_COMPLETENESS_
      ),
      overlapPolicy: educationNormalizeEnum_(
        values[r][headers.indexOf('Overlap Policy')],
        EDUCATION_OVERLAP_POLICIES_
      ),
      remainderPolicy: educationNormalizeEnum_(
        values[r][headers.indexOf('Remainder Policy')],
        EDUCATION_REMAINDER_POLICIES_
      ),
      notes: educationReadText_(values[r][headers.indexOf('Notes')])
    });
  }
  return items;
}

function writeEducationHousehold_(sheet, household) {
  const values = sheet.getDataRange().getValues();
  educationWriteLabelRow_(sheet, values, 'Selected Scenario', [
    '', '', '', household.selectedScenario || 'Base'
  ]);
  educationWriteLabelRow_(sheet, values, 'Expected Annual Return %', [
    educationOptionalNumberForSheet_(household.expectedAnnualReturnPct.low),
    educationOptionalNumberForSheet_(household.expectedAnnualReturnPct.base),
    educationOptionalNumberForSheet_(household.expectedAnnualReturnPct.high),
    ''
  ]);
  educationWriteLabelRow_(sheet, values, 'Education Cost Inflation %', [
    educationOptionalNumberForSheet_(household.educationCostInflationPct.low),
    educationOptionalNumberForSheet_(household.educationCostInflationPct.base),
    educationOptionalNumberForSheet_(household.educationCostInflationPct.high),
    ''
  ]);
}

function writeEducationPlans_(sheet, plans) {
  const values = sheet.getDataRange().getValues();
  const headerRow = educationFindHeaderRow_(values, 'Account Name');
  if (headerRow < 0) {
    throw new Error('Education plan headers were not found.');
  }
  const headers = values[headerRow].map(function(h) { return String(h || '').trim(); });
  const nameIdx = headers.indexOf('Account Name');
  if (nameIdx < 0) throw new Error('Education plan Account Name column was not found.');

  const byName = {};
  plans.forEach(function(plan) { byName[plan.accountName] = plan; });

  EDUCATION_ACCOUNT_NAMES_.forEach(function(accountName) {
    const plan = byName[accountName] || blankEducationPlan_(accountName);
    let row1 = 0;
    for (let r = headerRow + 1; r < values.length; r++) {
      if (String(values[r][nameIdx] || '').trim() === accountName) {
        row1 = r + 1;
        break;
      }
    }
    const rowValues = EDUCATION_PLAN_HEADERS_.map(function() { return ''; });
    educationSetNamed_(rowValues, headers, 'Account Name', accountName);
    educationSetNamed_(rowValues, headers, 'Coverage Goal', plan.coverageGoal);
    educationSetNamed_(
      rowValues, headers, 'Current Monthly Contribution',
      educationOptionalNumberForSheet_(plan.currentMonthlyContribution)
    );
    educationSetNamed_(rowValues, headers, 'Contribution Entry Status', plan.contributionEntryStatus);
    educationSetNamed_(rowValues, headers, 'Planned Choice', plan.plannedChoice);
    educationSetNamed_(rowValues, headers, 'Planned Choice Entry Status', plan.plannedChoiceEntryStatus);
    educationSetNamed_(rowValues, headers, 'Notes', plan.notes);
    if (row1) {
      sheet.getRange(row1, 1, 1, headers.length).setValues([
        educationPadRow_(rowValues, headers.length)
      ]);
    } else {
      const nextRow = Math.max(sheet.getLastRow() + 1, headerRow + 2);
      sheet.getRange(nextRow, 1, 1, headers.length).setValues([
        educationPadRow_(rowValues, headers.length)
      ]);
    }
  });
}

function writeEducationLineItems_(sheet, items) {
  const values = sheet.getDataRange().getValues();
  const headers = (values[0] && values[0].length)
    ? values[0].map(function(h) { return String(h || '').trim(); })
    : EDUCATION_LINE_ITEM_HEADERS_.slice();
  const nameIdx = headers.indexOf('Account Name');
  if (nameIdx < 0) {
    throw new Error('Education line-item headers were not found.');
  }

  const kept = [headers];
  for (let r = 1; r < values.length; r++) {
    const name = String(values[r][nameIdx] || '').trim();
    if (name && EDUCATION_ACCOUNT_NAMES_.indexOf(name) === -1) {
      kept.push(values[r]);
    }
  }
  items.forEach(function(item) {
    const row = headers.map(function() { return ''; });
    educationSetNamed_(row, headers, 'Item Id', item.itemId);
    educationSetNamed_(row, headers, 'Account Name', item.accountName);
    educationSetNamed_(row, headers, 'Record Type', item.recordType);
    educationSetNamed_(row, headers, 'Kind', item.kind);
    educationSetNamed_(row, headers, 'Label', item.label);
    educationSetNamed_(row, headers, 'Amount', educationOptionalNumberForSheet_(item.amount));
    educationSetNamed_(row, headers, 'Entry Status', item.entryStatus);
    educationSetNamed_(row, headers, 'Start Month', item.startMonth);
    educationSetNamed_(row, headers, 'End Month', item.endMonth);
    educationSetNamed_(row, headers, 'Academic Year', item.academicYear);
    educationSetNamed_(row, headers, 'Year Completeness', item.yearCompleteness);
    educationSetNamed_(row, headers, 'Overlap Policy', item.overlapPolicy);
    educationSetNamed_(row, headers, 'Remainder Policy', item.remainderPolicy);
    educationSetNamed_(row, headers, 'Notes', item.notes);
    kept.push(educationPadRow_(row, headers.length));
  });

  const width = headers.length;
  const height = kept.length;
  sheet.getRange(1, 1, height, width).setValues(
    kept.map(function(row) { return educationPadRow_(row, width); })
  );
  const last = sheet.getLastRow();
  if (last > height && typeof sheet.deleteRows === 'function') {
    sheet.deleteRows(height + 1, last - height);
  } else if (last > height) {
    sheet.getRange(height + 1, 1, last - height, width).clearContent();
  }
}

function normalizeEducationSavePayload_(payload) {
  const src = payload && typeof payload === 'object' ? payload : {};
  const householdSrc = src.household && typeof src.household === 'object' ? src.household : {};
  const household = {
    selectedScenario: educationNormalizeScenario_(householdSrc.selectedScenario),
    expectedAnnualReturnPct: educationNormalizeRateGroup_(householdSrc.expectedAnnualReturnPct),
    educationCostInflationPct: educationNormalizeRateGroup_(householdSrc.educationCostInflationPct)
  };

  const incomingPlans = Array.isArray(src.plans) ? src.plans : [];
  const byName = {};
  incomingPlans.forEach(function(plan) {
    const accountName = educationExactAccountName_(plan && plan.accountName);
    if (!accountName) {
      throw new Error('Education plans must use the exact names Lutfi 529 and Laith 529.');
    }
    byName[accountName] = {
      accountName: accountName,
      coverageGoal: educationReadText_(plan.coverageGoal),
      currentMonthlyContribution: educationParseOptionalNumber_(plan.currentMonthlyContribution),
      contributionEntryStatus: educationNormalizeEnum_(plan.contributionEntryStatus, EDUCATION_ENTRY_STATUSES_),
      plannedChoice: educationNormalizeEnum_(plan.plannedChoice, EDUCATION_PLANNED_CHOICES_),
      plannedChoiceEntryStatus: educationNormalizeEnum_(plan.plannedChoiceEntryStatus, EDUCATION_ENTRY_STATUSES_),
      notes: educationReadText_(plan.notes)
    };
  });
  const plans = EDUCATION_ACCOUNT_NAMES_.map(function(name) {
    return byName[name] || blankEducationPlan_(name);
  });

  const incomingItems = Array.isArray(src.lineItems) ? src.lineItems : [];
  const lineItems = incomingItems.map(function(item, index) {
    const accountName = educationExactAccountName_(item && item.accountName);
    if (!accountName) {
      throw new Error('Each education line item must belong to Lutfi 529 or Laith 529.');
    }
    const recordType = educationNormalizeEnum_(item.recordType, EDUCATION_RECORD_TYPES_);
    if (!recordType) {
      throw new Error('Each education line item needs a record type.');
    }
    const kind = educationNormalizeLineItemKind_(recordType, item.kind);
    return {
      itemId: educationReadText_(item.itemId) || ('edu-' + String(index + 1)),
      accountName: accountName,
      recordType: recordType,
      kind: kind,
      label: educationReadText_(item.label),
      amount: educationParseOptionalNumber_(item.amount),
      entryStatus: educationNormalizeEnum_(item.entryStatus, EDUCATION_ENTRY_STATUSES_),
      startMonth: educationReadMonth_(item.startMonth),
      endMonth: educationReadMonth_(item.endMonth),
      academicYear: educationReadText_(item.academicYear),
      yearCompleteness: educationNormalizeEnum_(item.yearCompleteness, EDUCATION_YEAR_COMPLETENESS_),
      overlapPolicy: educationNormalizeEnum_(item.overlapPolicy, EDUCATION_OVERLAP_POLICIES_),
      remainderPolicy: educationNormalizeEnum_(item.remainderPolicy, EDUCATION_REMAINDER_POLICIES_),
      notes: educationReadText_(item.notes)
    };
  });

  return {
    household: household,
    plans: plans,
    lineItems: lineItems,
    clearedAccountName: educationExactAccountName_(src.clearedAccountName) || ''
  };
}

function logEducationPlanUpdate_(ss, normalized, _unused) {
  if (typeof appendActivityLog_ !== 'function') return;
  const accounts = normalized.clearedAccountName
    ? [normalized.clearedAccountName]
    : EDUCATION_ACCOUNT_NAMES_.slice();
  appendActivityLog_(ss, {
    eventType: 'education_plan_update',
    amount: 0,
    direction: '',
    payee: 'Education plan',
    category: 'Education',
    accountSource: accounts.join(', '),
    details: {
      accounts: accounts,
      lineItemCount: normalized.lineItems.length,
      cleared: !!normalized.clearedAccountName
    }
  });
}

function educationReadLiveAccount_(ss, accountName) {
  const result = {
    accountName: accountName,
    found: false,
    type: '',
    investmentId: '',
    currentBalance: '',
    currentBalancePresent: false,
    active: '',
    source: ''
  };
  if (!ss || typeof ss.getSheetByName !== 'function') return result;
  const names = typeof getSheetNames_ === 'function'
    ? getSheetNames_()
    : { ASSETS: 'SYS - Assets', INVESTMENTS: 'INPUT - Investments' };
  const assets = ss.getSheetByName(names.ASSETS || 'SYS - Assets');
  if (!assets) return result;

  const range = assets.getDataRange();
  const values = range.getValues();
  const display = range.getDisplayValues();
  if (display.length < 2) return result;
  const headers = display[0].map(function(h) { return String(h || '').trim(); });
  const nameIdx = headers.indexOf('Account Name');
  if (nameIdx < 0) return result;
  const typeIdx = headers.indexOf('Type');
  const balanceIdx = headers.indexOf('Current Balance');
  const activeIdx = headers.indexOf('Active');
  const idHeader = (typeof INVESTMENT_ID_HEADER_ === 'string') ? INVESTMENT_ID_HEADER_ : 'Investment Id';
  const idIdx = headers.indexOf(idHeader);

  for (let r = 1; r < display.length; r++) {
    if (String(display[r][nameIdx] || '').trim() !== accountName) continue;
    const rawBalance = balanceIdx < 0 ? '' : values[r][balanceIdx];
    const present = educationNumericEvidencePresent_(rawBalance);
    result.found = true;
    result.type = typeIdx < 0 ? '' : String(display[r][typeIdx] || '').trim();
    result.investmentId = idIdx < 0 ? '' : String(display[r][idIdx] || '').trim();
    result.active = activeIdx < 0 ? '' : String(display[r][activeIdx] || '').trim();
    result.currentBalancePresent = present;
    result.currentBalance = present ? round2_(toNumber_(rawBalance)) : '';
    result.source = 'SYS - Assets';
    return result;
  }
  return result;
}

function educationNumericEvidencePresent_(raw) {
  if (typeof investmentNumericEvidencePresent_ === 'function') {
    return investmentNumericEvidencePresent_(raw);
  }
  return !(raw === '' || raw === null || raw === undefined);
}

function educationIsBlank_(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return false;
  if (typeof value === 'object' && value && Object.prototype.hasOwnProperty.call(value, 'present')) {
    return !value.present;
  }
  return String(value).trim() === '';
}

function educationReadOptionalNumber_(raw) {
  if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'present')) {
    return {
      present: !!raw.present,
      value: raw.present ? round2_(raw.value) : null
    };
  }
  if (educationIsBlank_(raw)) return { present: false, value: null };
  if (!educationNumericEvidencePresent_(raw)) return { present: false, value: null };
  const n = typeof raw === 'number' ? raw : toNumber_(raw);
  if (!isFinite(n)) return { present: false, value: null };
  return { present: true, value: round2_(n) };
}

function educationParseOptionalNumber_(raw) {
  if (raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'present')) {
    if (!raw.present) return { present: false, value: null };
    const nested = educationParseOptionalNumber_(raw.value);
    return nested;
  }
  if (educationIsBlank_(raw)) return { present: false, value: null };
  if (typeof raw === 'number') {
    if (!isFinite(raw)) throw new Error('Enter a number, or leave the amount blank.');
    return { present: true, value: round2_(raw) };
  }
  const cleaned = String(raw).replace(/\$/g, '').replace(/,/g, '').trim();
  if (!cleaned) return { present: false, value: null };
  const n = Number(cleaned);
  if (!isFinite(n)) throw new Error('Enter a number, or leave the amount blank.');
  return { present: true, value: round2_(n) };
}

function educationOptionalNumberForSheet_(parsed) {
  const value = educationReadOptionalNumber_(parsed);
  return value.present ? value.value : '';
}

function educationNormalizeRateGroup_(group) {
  const src = group && typeof group === 'object' ? group : {};
  return {
    low: educationParseOptionalNumber_(src.low),
    base: educationParseOptionalNumber_(src.base),
    high: educationParseOptionalNumber_(src.high)
  };
}

function educationReadRateRow_(values, label) {
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim() !== label) continue;
    return {
      low: educationReadOptionalNumber_(values[r][1]),
      base: educationReadOptionalNumber_(values[r][2]),
      high: educationReadOptionalNumber_(values[r][3])
    };
  }
  return {
    low: { present: false, value: null },
    base: { present: false, value: null },
    high: { present: false, value: null }
  };
}

function educationFindLabelValue_(values, label, valueCol) {
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim() === label) {
      return values[r][valueCol];
    }
  }
  return '';
}

function educationWriteLabelRow_(sheet, values, label, colsBtoE) {
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim() !== label) continue;
    sheet.getRange(r + 1, 2, 1, 4).setValues([colsBtoE]);
    return;
  }
  throw new Error('Education setting "' + label + '" was not found.');
}

function educationFindHeaderRow_(values, headerName) {
  for (let r = 0; r < values.length; r++) {
    for (let c = 0; c < values[r].length; c++) {
      if (String(values[r][c] || '').trim() === headerName) return r;
    }
  }
  return -1;
}

function educationExactAccountName_(value) {
  const name = String(value || '').trim();
  return EDUCATION_ACCOUNT_NAMES_.indexOf(name) === -1 ? '' : name;
}

function educationNormalizeScenario_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'low') return 'Low';
  if (text === 'high') return 'High';
  return 'Base';
}

function educationNormalizeEnum_(value, allowed) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) return '';
  return allowed.indexOf(text) === -1 ? '' : text;
}

function educationNormalizeLineItemKind_(recordType, value) {
  const allowed = recordType === 'STAGE'
    ? EDUCATION_STAGE_KINDS_
    : (recordType === 'COST' ? EDUCATION_COST_KINDS_ : EDUCATION_CONTRIBUTION_CHANGE_KINDS_);
  const kind = educationNormalizeEnum_(value, allowed);
  return kind || educationReadText_(value);
}

function educationReadText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function educationReadMonth_(value) {
  if (educationIsBlank_(value)) return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})/);
  if (match) return match[1] + '-' + match[2];
  return text;
}

function educationSetNamed_(row, headers, header, value) {
  const idx = headers.indexOf(header);
  if (idx < 0) return;
  row[idx] = value;
}

function educationPadRow_(row, width) {
  const copy = Array.isArray(row) ? row.slice() : [];
  while (copy.length < width) copy.push('');
  return copy.slice(0, width);
}

function blankEducationPlan_(accountName) {
  return {
    accountName: accountName,
    coverageGoal: '',
    currentMonthlyContribution: { present: false, value: null },
    contributionEntryStatus: '',
    plannedChoice: '',
    plannedChoiceEntryStatus: '',
    notes: ''
  };
}

function educationPlanForSave_(plan) {
  return {
    accountName: plan.accountName,
    coverageGoal: plan.coverageGoal,
    currentMonthlyContribution: plan.currentMonthlyContribution,
    contributionEntryStatus: plan.contributionEntryStatus,
    plannedChoice: plan.plannedChoice,
    plannedChoiceEntryStatus: plan.plannedChoiceEntryStatus,
    notes: plan.notes
  };
}
