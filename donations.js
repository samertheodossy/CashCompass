/**
 * INPUT - Donation: append rows within Year blocks (row "Year" + year value, then header row, then data).
 * Sheet layout matches user workbook; headers must include the tokens below exactly.
 */

var DONATION_SHEET_NAME_ = 'INPUT - Donation';

var DONATION_REQUIRED_HEADERS_ = [
  'Name of Charity',
  'Date',
  'Amount',
  'Tax Year',
  'Comments',
  'Payment type'
];

// Canonical widen-only column widths for INPUT - Donation, keyed by header name
// (matched case-insensitively by applyCanonicalColumnWidthsByHeader_). Chosen for
// readability of the year-block layout: charity names + comments get wide columns,
// Date/Amount are sized to their number formats, Tax Year stays compact. Applied
// FIRST-CREATE ONLY and widen-only, so a user who narrows/widens a column later is
// never overridden.
var DONATION_CANONICAL_WIDTHS_ = {
  'Name of Charity': 260,
  'Date': 110,
  'Amount': 130,
  'Tax Year': 90,
  'Comments': 300,
  'Payment type': 150
};

/**
 * Canonical from-scratch creator for `INPUT - Donation`.
 *
 * Seeds the canonical year-block layout that `getDonationsFormData`,
 * `addDonation`, and the activity-undo path all expect:
 *
 *   Row 1: A1 = "Year", B1 = <current calendar year>
 *   Row 2: canonical header row matching DONATION_REQUIRED_HEADERS_
 *          ("Name of Charity", "Date", "Amount", "Tax Year",
 *          "Comments", "Payment type") so that
 *          `readDonationBlockAtYearRow_` -> `mapHeaders_` resolves
 *          every required column on the first save.
 *
 * Additive contract: idempotent no-op when the sheet already exists
 * (returns the existing handle). When the sheet does not exist, the
 * race-safe insert pattern from `ensureSysAccountsSheet_` /
 * `ensureInputHouseValuesSheet_` handles the concurrent-creation case.
 *
 * Mirrors the canonical seed pattern used by
 * `ensureInputHouseValuesSheet_` and `ensureInputInvestmentsSheet_` —
 * one current-year banner row + one header row — so that on a blank
 * workbook the Donations form has at least one Tax Year option in its
 * dropdown and a successful first-save can resolve a Year block via
 * `findDonationBlockForTaxYear_`.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureInputDonationSheet_(optionalSs) {
  // Central-aware workbook resolution. In the standalone Central project there
  // is no bound/active spreadsheet, so SpreadsheetApp.getActiveSpreadsheet()
  // returns null and every downstream ss.getSheetByName(...) threw
  // "Cannot read properties of null (reading 'getSheetByName')" on the
  // Donations page. getUserSpreadsheet_() returns the bound spreadsheet in
  // bound mode and resolves/provisions the caller's own workbook in Central
  // mode. It throws a clear error if the user cannot be resolved, so genuine
  // Central resolution failures are surfaced rather than masked.
  const ss = optionalSs || getUserSpreadsheet_();
  const existing = ss.getSheetByName(DONATION_SHEET_NAME_);
  if (existing) return existing;

  let sheet;
  try {
    sheet = ss.insertSheet(DONATION_SHEET_NAME_);
  } catch (e) {
    const racedSheet = ss.getSheetByName(DONATION_SHEET_NAME_);
    if (racedSheet) return racedSheet;
    throw e;
  }

  const year = (typeof getCurrentYear_ === 'function')
    ? getCurrentYear_()
    : new Date().getFullYear();

  sheet.getRange(1, 1, 1, 2).setValues([['Year', year]]);
  sheet.getRange(2, 1, 1, DONATION_REQUIRED_HEADERS_.length)
    .setValues([DONATION_REQUIRED_HEADERS_.slice()]);

  // Canonical year-block presentation (FIRST-CREATE ONLY — guarded by the
  // `if (existing) return existing` above, so populated workbooks are never
  // restyled). Donation is structurally a Financial-Ledger year-block sheet
  // (row 1 Year banner, row 2 column header, rows 3+ data, additional tax years
  // stacked as more blocks), so it reuses the shared year-block walker rather
  // than the flat Operational helper.
  applyDonationSheetStyling_(sheet);

  return sheet;
}

/**
 * Canonical FIRST-CREATE styling for INPUT - Donation.
 *
 * Donation shares the Financial-Ledger year-block structure (Year banner in
 * row 1, column header in row 2, data below, additional tax years stacked as
 * more Year blocks), so it routes through the shared marker-driven walker
 * `applyFinancialLedgerBaseStyle_` — the SAME source of truth used by
 * Investments / House Values / Bank Accounts — instead of the flat Operational
 * helper (which would wrongly paint the Year banner as the column header).
 *
 * Produces the canonical appearance:
 *   - Year banner (row 1): #f4a300, bold black, 20pt, 40px, vertical-middle
 *   - Header row (row 2):  #ffe599, bold black, 16pt, centered, vertical-middle,
 *                          40px, thin black bottom border
 *   - Body rows (3+):      white background, 14pt, 26px
 *   - Freeze rows 2 + column 1
 *   - Widen-only header-keyed widths (DONATION_CANONICAL_WIDTHS_)
 *
 * Donation has no Totals/Delta bands, so those markers are null. Number formats
 * (Amount / Date) are owned by the write path and intentionally left untouched.
 *
 * SAFETY: FIRST-CREATE ONLY. Callers must invoke this only from the
 * post-insertSheet path (guarded by the `if (existing) return existing;` return
 * in ensureInputDonationSheet_), so populated Donation workbooks are never
 * reshaped. Cosmetic only; idempotent.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function applyDonationSheetStyling_(sheet) {
  if (!sheet) return;

  applyFinancialLedgerBaseStyle_(sheet, {
    mode: 'firstCreate',
    headerMarkerLabel: 'Name of Charity',
    headerRequireColB: null,
    totalMarkerLabel: null,
    deltaMarkerLabel: null,
    freezeRows: 2,
    freezeColumns: 1,
    firstCreate: { bodyWash: true, geometry: true }
  });

  // Canonical widen-only column widths by header name (replaces the old
  // autoResizeColumns, which fit columns too tightly to the bold header).
  try {
    applyCanonicalColumnWidthsByHeader_(sheet, 2, DONATION_CANONICAL_WIDTHS_);
  } catch (_widthErr) { /* cosmetic only */ }
}

function getDonationsSheet_(optionalSs) {
  // Lazy-create on first read so a blank workbook can open the
  // Donations form without surfacing a red banner. Idempotent on
  // populated workbooks (returns the existing handle byte-for-byte).
  return ensureInputDonationSheet_(optionalSs);
}

/**
 * @returns {{ taxYears: number[], defaultTaxYear: number|null, charitySuggestions: string[], paymentTypeSuggestions: string[] }}
 */
function getDonationsFormData() {
  const sheet = getDonationsSheet_();
  const values = sheet.getDataRange().getValues();
  const taxYears = collectDonationTaxYears_(values);
  const tz = Session.getScriptTimeZone();
  const calendarYear = Number(Utilities.formatDate(new Date(), tz, 'yyyy'));
  let defaultTaxYear = null;
  if (taxYears.indexOf(calendarYear) !== -1) {
    defaultTaxYear = calendarYear;
  } else if (taxYears.length) {
    defaultTaxYear = taxYears[0];
  }
  const charitySuggestions = collectDistinctCharityNames_(values);
  const paymentTypeSuggestions = collectDistinctPaymentTypes_(values);
  const recentDonations = getRecentDonationsForUi_(values, 8);

  return {
    taxYears: taxYears,
    defaultTaxYear: defaultTaxYear,
    charitySuggestions: charitySuggestions,
    paymentTypeSuggestions: paymentTypeSuggestions,
    recentDonations: recentDonations
  };
}

function collectDonationTaxYears_(values) {
  const years = [];
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() !== 'year') continue;
    const y = Number(values[r][1]);
    if (!isNaN(y) && y >= 1990 && y <= 2100) years.push(y);
  }
  years.sort(function(a, b) {
    return b - a;
  });
  return uniqueSortedYears_(years);
}

function uniqueSortedYears_(years) {
  const seen = {};
  const out = [];
  years.forEach(function(y) {
    if (!seen[y]) {
      seen[y] = true;
      out.push(y);
    }
  });
  out.sort(function(a, b) {
    return b - a;
  });
  return out;
}

function collectDistinctCharityNames_(values) {
  const names = {};
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() !== 'year') continue;
    const block = readDonationBlockAtYearRow_(values, r);
    if (!block) continue;
    const colCharity = block.colMap['Name of Charity'];
    const start = block.dataStart0;
    for (let dr = start; dr < values.length; dr++) {
      if (String(values[dr][0] || '').trim().toLowerCase() === 'year') break;
      const name = String(values[dr][colCharity] || '').trim();
      if (name) names[name] = true;
    }
  }
  const list = Object.keys(names);
  list.sort(function(a, b) {
    return a.localeCompare(b);
  });
  return list.slice(0, 150);
}

/**
 * Collapse "Check #4768", "Check #4783", plain "Check", etc. to one dropdown label "Check".
 */
function normalizeDonationPaymentTypeForDropdown_(raw) {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (/^check\s*$/i.test(t)) return 'Check';
  if (/^check\s*#\s*\S+/i.test(t)) return 'Check';
  return t;
}

function collectDistinctPaymentTypes_(values) {
  const types = {};
  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() !== 'year') continue;
    const block = readDonationBlockAtYearRow_(values, r);
    if (!block) continue;
    const colPay = block.colMap['Payment type'];
    const start = block.dataStart0;
    for (let dr = start; dr < values.length; dr++) {
      if (String(values[dr][0] || '').trim().toLowerCase() === 'year') break;
      const t = String(values[dr][colPay] || '').trim();
      if (!t) continue;
      const key = normalizeDonationPaymentTypeForDropdown_(t);
      if (key) types[key] = true;
    }
  }
  const list = Object.keys(types);
  list.sort(function(a, b) {
    return a.localeCompare(b);
  });
  return list.slice(0, 80);
}

/**
 * 1-based sheet row of last non-empty data row in block, or 0 if none.
 */
function getDonationLastDataRow1_(values, block) {
  const start = block.dataStart0;
  let lastNonEmpty0 = -1;
  for (let r = start; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() === 'year') break;
    const row = values[r];
    let any = false;
    Object.keys(block.colMap).forEach(function(k) {
      const idx = block.colMap[k];
      if (String(row[idx] || '').trim() !== '') any = true;
    });
    if (any) lastNonEmpty0 = r;
  }
  return lastNonEmpty0 >= 0 ? lastNonEmpty0 + 1 : 0;
}

function donationRowSortTime_(raw) {
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw.getTime();
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.getTime();
  return 0;
}

function formatDonationDateLabel_(raw) {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return Utilities.formatDate(raw, Session.getScriptTimeZone(), 'M/d/yyyy');
  }
  const s = String(raw || '').trim();
  return s || '—';
}

/**
 * @returns {Array<{charity:string,dateLabel:string,amount:number,taxYear:number,comments:string,paymentType:string}>}
 */
function getRecentDonationsForUi_(values, limit) {
  const cap = Math.min(Math.max(Number(limit) || 8, 1), 25);
  const rows = [];

  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() !== 'year') continue;
    const block = readDonationBlockAtYearRow_(values, r);
    if (!block) continue;
    const yBlock = Number(values[r][1]);
    const cm = block.colMap;
    const start = block.dataStart0;

    for (let dr = start; dr < values.length; dr++) {
      if (String(values[dr][0] || '').trim().toLowerCase() === 'year') break;
      const charity = String(values[dr][cm['Name of Charity']] || '').trim();
      const rawDate = values[dr][cm['Date']];
      const amtRaw = values[dr][cm['Amount']];
      const comments = String(values[dr][cm['Comments']] || '').trim();
      const paymentType = String(values[dr][cm['Payment type']] || '').trim();
      const taxCell = values[dr][cm['Tax Year']];
      const taxY = Number(taxCell);
      const amount = round2_(toNumber_(amtRaw));

      let any = false;
      Object.keys(cm).forEach(function(k) {
        const idx = cm[k];
        if (String(values[dr][idx] || '').trim() !== '') any = true;
      });
      if (!any) continue;

      rows.push({
        charity: charity,
        dateLabel: formatDonationDateLabel_(rawDate),
        sortTime: donationRowSortTime_(rawDate),
        amount: amount,
        taxYear: !isNaN(taxY) ? taxY : yBlock,
        comments: comments,
        paymentType: paymentType
      });
    }
  }

  rows.sort(function(a, b) {
    return b.sortTime - a.sortTime;
  });

  return rows.slice(0, cap).map(function(x) {
    return {
      charity: x.charity,
      dateLabel: x.dateLabel,
      amount: x.amount,
      taxYear: x.taxYear,
      comments: x.comments,
      paymentType: x.paymentType
    };
  });
}

/**
 * @param {number} yearRow0 0-based row index where column A is "Year"
 * @returns {{ headerRow0: number, dataStart0: number, colMap: Object.<string,number> }|null}
 */
function readDonationBlockAtYearRow_(values, yearRow0) {
  const headerRow0 = yearRow0 + 1;
  if (headerRow0 >= values.length) return null;
  let colMap;
  try {
    colMap = mapHeaders_(values[headerRow0], DONATION_REQUIRED_HEADERS_);
  } catch (e) {
    return null;
  }
  return {
    headerRow0: headerRow0,
    dataStart0: headerRow0 + 1,
    colMap: colMap
  };
}

function findDonationBlockForTaxYear_(values, taxYear) {
  const ty = Number(taxYear);
  if (isNaN(ty)) return null;

  for (let r = 0; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() !== 'year') continue;
    const y = Number(values[r][1]);
    if (y !== ty) continue;
    return readDonationBlockAtYearRow_(values, r);
  }
  return null;
}

/**
 * 1-based sheet row index where the new donation row should be written.
 */
function getDonationAppendRow1_(values, block) {
  const start = block.dataStart0;
  const colCharity = block.colMap['Name of Charity'];
  let lastNonEmpty0 = start - 1;

  for (let r = start; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() === 'year') break;
    const row = values[r];
    let any = false;
    Object.keys(block.colMap).forEach(function(k) {
      const idx = block.colMap[k];
      if (String(row[idx] || '').trim() !== '') any = true;
    });
    if (any) lastNonEmpty0 = r;
  }

  return lastNonEmpty0 + 2;
}

function buildDonationOutputRow_(colMap, charityName, dateValue, amount, taxYear, comments, paymentType) {
  let maxIdx = 0;
  Object.keys(colMap).forEach(function(k) {
    if (colMap[k] > maxIdx) maxIdx = colMap[k];
  });
  const width = maxIdx + 1;
  const row = [];
  for (let i = 0; i < width; i++) row.push('');

  row[colMap['Name of Charity']] = charityName;
  row[colMap['Date']] = dateValue;
  row[colMap['Amount']] = amount;
  row[colMap['Tax Year']] = taxYear;
  row[colMap['Comments']] = comments;
  row[colMap['Payment type']] = paymentType;

  return row;
}

function donationSheetDateFromIso_(isoText, ss) {
  var iso = String(isoText || '').trim();
  parseIsoDateLocal_(iso);
  var timeZone = ss && typeof ss.getSpreadsheetTimeZone === 'function'
    ? String(ss.getSpreadsheetTimeZone() || '').trim()
    : '';
  if (!timeZone) timeZone = Session.getScriptTimeZone();
  return Utilities.parseDate(
    iso + ' 12:00:00',
    timeZone,
    'yyyy-MM-dd HH:mm:ss'
  );
}

/**
 * @param {Object} payload charityName, donationDate (ISO yyyy-mm-dd), amount, taxYear (number), comments?, paymentType?
 */
function addDonation(payload, optionalSs) {
  validateRequired_(payload, ['charityName', 'donationDate', 'amount', 'taxYear']);

  const charityName = String(payload.charityName || '').trim();
  if (!charityName) throw new Error('Name of Charity is required.');

  const donationDateIso = String(payload.donationDate || '').trim();
  parseIsoDateLocal_(donationDateIso);
  const amount = round2_(toNumber_(payload.amount));
  if (isNaN(amount)) throw new Error('Amount is not a valid number.');

  const taxYear = Number(payload.taxYear);
  if (isNaN(taxYear) || taxYear < 1990 || taxYear > 2100) throw new Error('Tax year is invalid.');

  const comments = String(payload.comments || '').trim();
  const paymentType = String(payload.paymentType || '').trim();
  if (!paymentType) throw new Error('Payment type is required.');

  const sheet = getDonationsSheet_(optionalSs);
  const ss = sheet.getParent();
  const donationDate = donationSheetDateFromIso_(donationDateIso, ss);
  const operationContext = createActivityOperationContext_(ss, 'donation');
  const values = sheet.getDataRange().getValues();
  const block = findDonationBlockForTaxYear_(values, taxYear);

  if (!block) {
    throw new Error(
      'No donation section found for tax year ' +
        taxYear +
        '. Add a row with Year | ' +
        taxYear +
        ' and the standard header row below it on ' +
        DONATION_SHEET_NAME_ +
        '.'
    );
  }

  const row1 = getDonationAppendRow1_(values, block);
  const row = buildDonationOutputRow_(
    block.colMap,
    charityName,
    donationDate,
    amount,
    taxYear,
    comments,
    paymentType
  );

  const numCols = row.length;
  sheet.getRange(row1, 1, 1, numCols).setValues([row]);

  const formatSourceRow1 = getDonationLastDataRow1_(values, block);
  const destRange = sheet.getRange(row1, 1, 1, numCols);
  if (formatSourceRow1 > 0 && formatSourceRow1 !== row1) {
    sheet
      .getRange(formatSourceRow1, 1, 1, numCols)
      .copyTo(destRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sheet.setRowHeight(row1, sheet.getRowHeight(formatSourceRow1));
    sheet.getRange(row1, 1, 1, numCols).setValues([row]);
  } else {
    destRange
      .setBackground('#ffffff')
      .setFontWeight('normal')
      .setFontColor('#000000')
      .setFontSize(CANON_FONT_BODY_)
      .setVerticalAlignment(CANON_VERTICAL_ALIGNMENT_);
    sheet.setRowHeight(row1, CANON_ROW_HEIGHT_BODY_);
  }
  const dateCol = block.colMap['Date'] + 1;
  const amountCol = block.colMap['Amount'] + 1;
  sheet.getRange(row1, dateCol).setNumberFormat('M/d/yyyy');
  sheet.getRange(row1, amountCol).setNumberFormat('$#,##0.00');

  touchDashboardSourceUpdated_('donations');

  const entryDateStr = donationDateIso;
  const donationState = {
    exists: true,
    taxYear: taxYear,
    charityName: charityName,
    entryDate: entryDateStr,
    amount: amount,
    comments: comments,
    paymentType: paymentType
  };

  appendActivityLog_(ss, {
    eventType: 'donation',
    entryDate: entryDateStr,
    amount: Math.abs(amount),
    direction: 'charity',
    payee: charityName,
    category: paymentType,
    accountSource: '',
    cashFlowSheet: DONATION_SHEET_NAME_,
    cashFlowMonth: 'TY ' + taxYear,
    dedupeKey: '',
    operationEnvelope: {
      context: operationContext,
      correctable: true,
      targets: [{
        targetVersion: ACTIVITY_TARGET_DESCRIPTOR_VERSION_,
        targetType: 'donation_row',
        targetKey: 'donation_row::' + operationContext.operationId,
        locator: {
          taxYear: taxYear,
          initialSheetRow: row1
        },
        before: {
          exists: false
        },
        after: donationState
      }]
    },
    details: JSON.stringify({
      taxYear: taxYear,
      comments: comments,
      paymentType: paymentType,
      sheetRow: row1,
      amountSigned: amount,
      activityOrigin: 'direct_donation'
    })
  });

  return {
    message: 'Donation saved.',
    updated: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss'
    ),
    operationId: operationContext.operationId
  };
}

/**
 * Compare donation sheet date cell to yyyy-MM-dd from the activity log.
 */
function donationActivityUndoDateMatchesIso_(cellVal, isoYyyyMmDd, timeZone) {
  const target = String(isoYyyyMmDd || '').trim();
  if (!target) return false;
  const tz = String(timeZone || '').trim() || Session.getScriptTimeZone();
  if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
    return Utilities.formatDate(cellVal, tz, 'yyyy-MM-dd') === target;
  }
  const raw = String(cellVal || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw === target;
  try {
    const parsed = parseIsoDateLocal_(raw);
    return parsed.getFullYear() === Number(target.slice(0, 4)) &&
      parsed.getMonth() + 1 === Number(target.slice(5, 7)) &&
      parsed.getDate() === Number(target.slice(8, 10));
  } catch (_e) {
    return false;
  }
}

function donationDataRowMatchesActivityUndo_(row, colMap, fp) {
  const charity = String(row[colMap['Name of Charity']] || '').trim();
  if (charity !== String(fp.charityName || '').trim()) return false;
  if (!donationActivityUndoDateMatchesIso_(
    row[colMap['Date']],
    fp.entryDate,
    fp.timeZone
  )) return false;

  const cellAmt = round2_(toNumber_(row[colMap['Amount']]));
  if (fp.amountSigned !== null && fp.amountSigned !== undefined && !isNaN(Number(fp.amountSigned))) {
    if (cellAmt !== round2_(fp.amountSigned)) return false;
  } else {
    if (round2_(Math.abs(cellAmt)) !== round2_(fp.amountAbs)) return false;
  }

  const ty = Number(row[colMap['Tax Year']]);
  if (ty !== Number(fp.taxYear)) return false;
  const comments = String(row[colMap['Comments']] || '').trim();
  if (comments !== String(fp.comments || '').trim()) return false;
  const pay = String(row[colMap['Payment type']] || '').trim();
  if (pay !== String(fp.paymentType || '').trim()) return false;
  return true;
}

function donationActivityState_(raw) {
  raw = raw || {};
  return {
    exists: raw.exists === true,
    taxYear: Number(raw.taxYear || 0),
    charityName: String(raw.charityName || '').trim(),
    entryDate: String(raw.entryDate || '').trim(),
    amount: round2_(toNumber_(raw.amount)),
    comments: String(raw.comments || '').trim(),
    paymentType: String(raw.paymentType || '').trim()
  };
}

function findDonationActivityTargetRow_(ss, target, expectedState) {
  target = normalizeActivityTargetDescriptor_(target);
  var expected = donationActivityState_(expectedState);
  var sheet = ss.getSheetByName(DONATION_SHEET_NAME_);
  if (!sheet) return { sheet: null, matches: [] };
  var values = sheet.getDataRange().getValues();
  var block = findDonationBlockForTaxYear_(values, expected.taxYear);
  if (!block) return { sheet: sheet, matches: [] };
  var spreadsheetTimeZone = typeof ss.getSpreadsheetTimeZone === 'function'
    ? String(ss.getSpreadsheetTimeZone() || '').trim()
    : '';
  var initialSheetRow = Number(
    target.locator && target.locator.initialSheetRow
  );
  if (Number.isInteger(initialSheetRow) &&
      initialSheetRow > block.dataStart0 &&
      initialSheetRow <= values.length &&
      donationDataRowMatchesActivityUndo_(
        values[initialSheetRow - 1],
        block.colMap,
        {
          taxYear: expected.taxYear,
          charityName: expected.charityName,
          entryDate: expected.entryDate,
          amountSigned: expected.amount,
          amountAbs: Math.abs(expected.amount),
          comments: expected.comments,
          paymentType: expected.paymentType,
          timeZone: spreadsheetTimeZone
        }
      )) {
    return {
      sheet: sheet,
      values: values,
      block: block,
      matches: [initialSheetRow]
    };
  }
  var matches = [];
  for (var r = block.dataStart0; r < values.length; r++) {
    if (String(values[r][0] || '').trim().toLowerCase() === 'year') break;
    if (donationDataRowMatchesActivityUndo_(values[r], block.colMap, {
      taxYear: expected.taxYear,
      charityName: expected.charityName,
      entryDate: expected.entryDate,
      amountSigned: expected.amount,
      amountAbs: Math.abs(expected.amount),
      comments: expected.comments,
      paymentType: expected.paymentType,
      timeZone: spreadsheetTimeZone
    })) {
      matches.push(r + 1);
    }
  }
  return {
    sheet: sheet,
    values: values,
    block: block,
    matches: matches
  };
}

function inspectDonationActivityTargetInSpreadsheet_(ss, target) {
  target = normalizeActivityTargetDescriptor_(target);
  if (target.targetType !== 'donation_row') {
    return { supported: false, status: 'UNSUPPORTED_TARGET' };
  }
  var found = findDonationActivityTargetRow_(ss, target, target.after);
  if (found.matches.length > 1) {
    return { supported: false, status: 'AMBIGUOUS_TARGET' };
  }
  if (!found.matches.length) {
    return {
      supported: true,
      status: 'READ',
      current: { exists: false }
    };
  }
  return {
    supported: true,
    status: 'READ',
    row: found.matches[0],
    current: donationActivityState_(target.after)
  };
}

function writeDonationActivityTargetStateInSpreadsheet_(ss, target, desiredState) {
  target = normalizeActivityTargetDescriptor_(target);
  var desired = donationActivityState_(desiredState);
  var found = findDonationActivityTargetRow_(ss, target, target.after);
  if (found.matches.length === 0 && desired.exists === true) {
    var sheet = ss.getSheetByName(DONATION_SHEET_NAME_);
    if (!sheet) throw new Error('Donation sheet is no longer available.');
    var values = sheet.getDataRange().getValues();
    var block = findDonationBlockForTaxYear_(values, desired.taxYear);
    if (!block) throw new Error('Donation year section is no longer available.');
    var row1 = getDonationAppendRow1_(values, block);
    var date = donationSheetDateFromIso_(desired.entryDate, ss);
    var rowValues = buildDonationOutputRow_(
      block.colMap,
      desired.charityName,
      date,
      desired.amount,
      desired.taxYear,
      desired.comments,
      desired.paymentType
    );
    sheet.getRange(row1, 1, 1, rowValues.length).setValues([rowValues]);
    sheet.getRange(row1, block.colMap['Date'] + 1).setNumberFormat('M/d/yyyy');
    sheet.getRange(row1, block.colMap['Amount'] + 1).setNumberFormat('$#,##0.00');
    return;
  }
  if (found.matches.length !== 1) {
    throw new Error('The donation is missing or ambiguous.');
  }
  var row = found.matches[0];
  if (desired.exists === false) {
    found.sheet.deleteRow(row);
    return;
  }
  var amountCol = found.block.colMap['Amount'] + 1;
  found.sheet.getRange(row, amountCol)
    .setValue(desired.amount)
    .setNumberFormat('$#,##0.00');
}

function donationActivityEntrySummary_(events) {
  var event = events && events.length ? events[0] : null;
  var row = event && event.rowValues ? event.rowValues : [];
  var details = event && event.parsed ? event.parsed.details : {};
  var envelope = event && event.parsed ? event.parsed.envelope : null;
  var target = envelope && Array.isArray(envelope.targets) &&
    envelope.targets.length
    ? envelope.targets[0]
    : null;
  var targetEntryDate = target && target.after
    ? String(target.after.entryDate || '').trim()
    : '';
  return {
    entryType: 'Donation',
    payee: String(row[5] || '').trim(),
    entryDate: targetEntryDate ||
      activityLogEntryDateToYyyyMmDd_(row[2]),
    amount: round2_(Math.abs(toNumber_(row[3]))),
    cashFlowMonth: String(row[9] || '').trim(),
    replacesOperationId: String(details.replacesOperationId || '').trim(),
    rootOperationId: String(
      details.rootOperationId ||
      details.replacesOperationId ||
      (event && event.parsed && event.parsed.envelope
        ? event.parsed.envelope.operationId
        : '')
    ).trim(),
    correctedFromAmount: details.correctedFromAmount === undefined
      ? null
      : round2_(Math.abs(toNumber_(details.correctedFromAmount)))
  };
}

function buildDonationCorrectionPlanInSpreadsheet_(ss, operationId) {
  var requested = String(operationId || '').trim();
  var events = findActivityOperationEvents_(ss, requested);
  var entry = donationActivityEntrySummary_(events);
  if (!events.length || events.some(function(event) {
    return !event.parsed.envelope ||
      event.parsed.envelope.operationType !== 'donation';
  })) {
    return {
      ok: false,
      status: 'LEGACY_OR_NOT_FOUND',
      correctable: false,
      entryFamily: 'donation',
      message: 'This older donation remains read-only.'
    };
  }
  if (activityCorrectionIndex_(ss)[requested]) {
    return {
      ok: true,
      status: 'ALREADY_CORRECTED',
      correctable: false,
      entryFamily: 'donation',
      entry: entry,
      message: 'This donation has already been corrected.'
    };
  }
  var base = previewActivityOperationInSpreadsheet_(ss, requested);
  if (!base.ok || base.status !== 'READY' || base.correctable !== true) {
    return {
      ok: false,
      status: base.status || 'PRECONDITION_FAILED',
      correctable: false,
      entryFamily: 'donation',
      entry: entry,
      verification: {
        status: String(base.status || 'PRECONDITION_FAILED'),
        targets: Array.isArray(base.targets) ? base.targets.map(function(target) {
          return {
            targetType: String(target.targetType || ''),
            status: String(target.status || '')
          };
        }) : []
      },
      message: 'This donation changed after it was recorded. CashCompass will not overwrite it.'
    };
  }
  var targets = collectActivityOperationTargets_(events);
  if (targets.length !== 1 || targets[0].targetType !== 'donation_row') {
    return {
      ok: false,
      status: 'UNSUPPORTED_TARGET',
      correctable: false,
      entryFamily: 'donation',
      entry: entry,
      message: 'This donation does not have a complete correction record.'
    };
  }
  return {
    ok: true,
    status: 'READY',
    operationId: requested,
    operationType: 'donation',
    entryFamily: 'donation',
    correctable: true,
    entry: entry,
    impacts: [{
      type: 'donation_row',
      label: 'Donation amount',
      currentValue: entry.amount,
      restoredValue: 0,
      removesCreatedRow: false
    }],
    writes: [{
      target: targets[0],
      targetType: 'donation_row',
      current: donationActivityState_(targets[0].after),
      desired: { exists: false }
    }],
    laterEntryCount: 0,
    message: 'CashCompass verified the donation record.'
  };
}

function previewDonationCorrectionInSpreadsheet_(ss, operationId) {
  return buildDonationCorrectionPlanInSpreadsheet_(ss, operationId);
}

function correctDonationOperationInSpreadsheet_(
  ss,
  operationId,
  reason,
  otherNote,
  correctionMode,
  correctedAmount
) {
  var reasonData = activityCorrectionReason_(reason, otherNote);
  var mode = normalizeActivityCorrectionMode_(correctionMode);
  var replacementAmount = mode === 'change_amount'
    ? activityCorrectedAmount_(correctedAmount)
    : null;
  var preview = buildDonationCorrectionPlanInSpreadsheet_(ss, operationId);
  if (!preview.ok || preview.status !== 'READY' || preview.correctable !== true) {
    return {
      ok: false,
      status: preview.status || 'CORRECTION_REFUSED',
      error: preview.message || 'This donation can no longer be corrected safely.'
    };
  }
  if (mode === 'change_amount' &&
      round2_(replacementAmount) === round2_(preview.entry.amount)) {
    return {
      ok: false,
      status: 'NO_CHANGE',
      error: 'Enter a different amount, or choose Remove donation.'
    };
  }

  var write = preview.writes[0];
  var desired = mode === 'change_amount'
    ? Object.assign({}, donationActivityState_(write.current), {
        amount: replacementAmount
      })
    : { exists: false };
  var correctionAuditDedupe =
    'donation_correction::' + String(operationId || '').trim();
  var replacementAuditDedupe =
    'donation_replacement::' + String(operationId || '').trim();
  var correctionAuditAppended = false;
  var replacementAuditAppended = false;
  try {
    writeDonationActivityTargetStateInSpreadsheet_(ss, write.target, desired);
    SpreadsheetApp.flush();
    var verificationTarget = mode === 'change_amount'
      ? Object.assign({}, write.target, { after: desired })
      : write.target;
    var inspection = mode === 'change_amount'
      ? inspectDonationActivityTargetInSpreadsheet_(ss, verificationTarget)
      : inspectDonationActivityTargetInSpreadsheet_(ss, write.target);
    var verified = mode === 'change_amount'
      ? inspection && inspection.supported === true &&
        activityStatesEqual_(inspection.current, donationActivityState_(desired))
      : inspection && inspection.supported === true &&
        inspection.current && inspection.current.exists === false;
    if (!verified) throw new Error('The corrected donation could not be verified.');

    var replacementContext = mode === 'change_amount'
      ? createActivityOperationContext_(ss, 'donation')
      : null;
    var correctionContext = createActivityOperationContext_(ss, 'donation_correction');
    var correctionAppended = appendActivityLog_(ss, {
      eventType: 'donation_correction',
      entryDate: preview.entry.entryDate,
      amount: 0,
      direction: '',
      payee: preview.entry.payee,
      category: '',
      accountSource: '',
      cashFlowSheet: DONATION_SHEET_NAME_,
      cashFlowMonth: preview.entry.cashFlowMonth,
      dedupeKey: correctionAuditDedupe,
      operationEnvelope: {
        context: correctionContext,
        correctable: false,
        targets: []
      },
      details: JSON.stringify({
        reversalOfOperationId: String(operationId || '').trim(),
        correctionMode: mode,
        replacementOperationId: replacementContext
          ? replacementContext.operationId
          : '',
        correctionReason: reasonData.reason,
        correctionNote: reasonData.note,
        originalAmount: preview.entry.amount,
        correctedAmount: replacementAmount,
        originalEntryType: 'Donation'
      })
    });
    if (!correctionAppended) throw new Error('The correction audit record could not be saved.');
    correctionAuditAppended = true;

    if (replacementContext) {
      var replacementState = donationActivityState_(desired);
      var replacementAppended = appendActivityLog_(ss, {
        eventType: 'donation',
        entryDate: preview.entry.entryDate,
        amount: replacementAmount,
        direction: 'charity',
        payee: preview.entry.payee,
        category: replacementState.paymentType,
        accountSource: '',
        cashFlowSheet: DONATION_SHEET_NAME_,
        cashFlowMonth: preview.entry.cashFlowMonth,
        dedupeKey: replacementAuditDedupe,
        operationEnvelope: {
          context: replacementContext,
          correctable: true,
          targets: [{
            targetVersion: ACTIVITY_TARGET_DESCRIPTOR_VERSION_,
            targetType: 'donation_row',
            targetKey: write.target.targetKey,
            locator: write.target.locator,
            before: donationActivityState_(write.current),
            after: replacementState
          }]
        },
        details: JSON.stringify({
          taxYear: replacementState.taxYear,
          comments: replacementState.comments,
          paymentType: replacementState.paymentType,
          amountSigned: replacementAmount,
          activityOrigin: 'direct_donation',
          replacesOperationId: String(operationId || '').trim(),
          rootOperationId: preview.entry.rootOperationId,
          correctedFromAmount: preview.entry.amount
        })
      });
      if (!replacementAppended) {
        throw new Error('The corrected donation could not be added to Activity.');
      }
      replacementAuditAppended = true;
    }
    touchDashboardSourceUpdated_('donations');
    return {
      ok: true,
      status: 'CORRECTED',
      operationId: String(operationId || '').trim(),
      replacementOperationId: replacementContext
        ? replacementContext.operationId
        : '',
      correctionMode: mode,
      entryFamily: 'donation',
      message: mode === 'change_amount'
        ? 'Donation amount changed. The correction remains in Activity history.'
        : 'Donation removed. The original Activity record remains in history.',
      entry: Object.assign({}, preview.entry, {
        correctedAmount: replacementAmount
      }),
      impacts: [{
        type: 'donation_row',
        label: 'Donation amount',
        currentValue: preview.entry.amount,
        restoredValue: mode === 'change_amount' ? replacementAmount : 0
      }]
    };
  } catch (e) {
    if (replacementAuditAppended) {
      try {
        rollbackFailedActivityAppend_(
          ss,
          'donation',
          replacementAuditDedupe
        );
      } catch (replacementAuditRollbackError) {
        Logger.log(
          'Donation replacement audit compensation failed: ' +
          replacementAuditRollbackError
        );
      }
    }
    if (correctionAuditAppended) {
      try {
        rollbackFailedActivityAppend_(
          ss,
          'donation_correction',
          correctionAuditDedupe
        );
      } catch (correctionAuditRollbackError) {
        Logger.log(
          'Donation correction audit compensation failed: ' +
          correctionAuditRollbackError
        );
      }
    }
    try {
      var rollbackTarget = Object.assign({}, write.target, { after: desired });
      writeDonationActivityTargetStateInSpreadsheet_(
        ss,
        rollbackTarget,
        write.current
      );
    } catch (rollbackError) {
      Logger.log('Donation correction compensation failed: ' + rollbackError);
    }
    return {
      ok: false,
      status: 'CORRECTION_FAILED',
      error: e && e.message ? e.message : String(e)
    };
  }
}

/**
 * Activity Phase 1: remove matching INPUT - Donation row when log fingerprint still matches.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {number} sheetRow1 1-based row on INPUT - Donation (from log Details.sheetRow)
 * @param {{ taxYear: number, charityName: string, entryDate: string, amountAbs: number, amountSigned?: number|null, comments: string, paymentType: string }} fp
 * @returns {{ deleted: boolean, mismatch?: boolean, skip?: string, error?: string }}
 */
function tryDeleteDonationRowForActivityUndo_(ss, sheetRow1, fp) {
  try {
    const sheet = ss.getSheetByName(DONATION_SHEET_NAME_);
    if (!sheet) {
      return { deleted: false, skip: 'no_donation_sheet' };
    }
    const row = Number(sheetRow1);
    if (!isFinite(row) || row !== Math.floor(row) || row < 2) {
      return { deleted: false, skip: 'bad_row' };
    }
    if (isNaN(Number(fp.taxYear))) {
      return { deleted: false, skip: 'bad_tax_year' };
    }

    const values = sheet.getDataRange().getValues();
    if (row > values.length) {
      return { deleted: false, mismatch: true };
    }

    const block = findDonationBlockForTaxYear_(values, fp.taxYear);
    if (!block) {
      return { deleted: false, skip: 'no_block' };
    }

    const firstData1 = block.dataStart0 + 1;
    let lastData0 = block.dataStart0 - 1;
    for (let r = block.dataStart0; r < values.length; r++) {
      if (String(values[r][0] || '').trim().toLowerCase() === 'year') break;
      lastData0 = r;
    }
    const lastData1 = lastData0 + 1;
    if (lastData0 < block.dataStart0 || row < firstData1 || row > lastData1) {
      return { deleted: false, mismatch: true };
    }

    const row0 = row - 1;
    const dataRow = values[row0];
    if (!donationDataRowMatchesActivityUndo_(dataRow, block.colMap, fp)) {
      return { deleted: false, mismatch: true };
    }

    sheet.deleteRow(row);
    touchDashboardSourceUpdated_('donations');
    return { deleted: true };
  } catch (e) {
    return { deleted: false, error: String(e.message || e) };
  }
}
