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

function getDonationsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(DONATION_SHEET_NAME_);
  if (!sh) {
    throw new Error(
      'Missing sheet "' +
        DONATION_SHEET_NAME_ +
        '". Add it to this spreadsheet with Year sections (see Help → Donations).'
    );
  }
  return sh;
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

/**
 * @param {Object} payload charityName, donationDate (ISO yyyy-mm-dd), amount, taxYear (number), comments?, paymentType?
 */
function addDonation(payload) {
  validateRequired_(payload, ['charityName', 'donationDate', 'amount', 'taxYear']);

  const charityName = String(payload.charityName || '').trim();
  if (!charityName) throw new Error('Name of Charity is required.');

  const donationDate = stripTime_(parseIsoDateLocal_(payload.donationDate));
  const amount = round2_(toNumber_(payload.amount));
  if (isNaN(amount)) throw new Error('Amount is not a valid number.');

  const taxYear = Number(payload.taxYear);
  if (isNaN(taxYear) || taxYear < 1990 || taxYear > 2100) throw new Error('Tax year is invalid.');

  const comments = String(payload.comments || '').trim();
  const paymentType = String(payload.paymentType || '').trim();
  if (!paymentType) throw new Error('Payment type is required.');

  const sheet = getDonationsSheet_();
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
    sheet.getRange(row1, 1, 1, numCols).setValues([row]);
  } else {
    const dateCol = block.colMap['Date'] + 1;
    const amountCol = block.colMap['Amount'] + 1;
    sheet.getRange(row1, dateCol).setNumberFormat('M/d/yyyy');
    sheet.getRange(row1, amountCol).setNumberFormat('$#,##0.00');
  }

  touchDashboardSourceUpdated_('donations');

  const ss = sheet.getParent();
  const tz = Session.getScriptTimeZone();
  const entryDateStr = Utilities.formatDate(donationDate, tz, 'yyyy-MM-dd');

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
    details: JSON.stringify({
      taxYear: taxYear,
      comments: comments,
      paymentType: paymentType,
      sheetRow: row1,
      amountSigned: amount
    })
  });

  return {
    message: 'Donation saved.',
    updated: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss')
  };
}

/**
 * Compare donation sheet date cell to yyyy-MM-dd from the activity log.
 */
function donationActivityUndoDateMatchesIso_(cellVal, isoYyyyMmDd) {
  const target = String(isoYyyyMmDd || '').trim();
  if (!target) return false;
  let d;
  if (cellVal instanceof Date && !isNaN(cellVal.getTime())) {
    d = stripTime_(cellVal);
  } else {
    try {
      const p = stripTime_(parseIsoDateLocal_(String(cellVal || '').trim()));
      if (isNaN(p.getTime())) return false;
      d = p;
    } catch (e) {
      return false;
    }
  }
  const tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd') === target;
}

function donationDataRowMatchesActivityUndo_(row, colMap, fp) {
  const charity = String(row[colMap['Name of Charity']] || '').trim();
  if (charity !== String(fp.charityName || '').trim()) return false;
  if (!donationActivityUndoDateMatchesIso_(row[colMap['Date']], fp.entryDate)) return false;

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
