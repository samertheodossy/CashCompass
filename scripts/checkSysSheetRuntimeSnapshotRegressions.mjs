import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(new URL('../', import.meta.url).pathname);
const snapshotPath = path.join(root, 'sys_sheet_runtime_snapshot.js');
const inventoryPath = path.join(root, 'test/fixtures/sys-sheet-audit-inventory.json');
const schemaPath = path.join(root, 'test/fixtures/sys-sheet-runtime-snapshot-schema.json');
const validationServerPath = path.join(root, 'validation_testing_server.js');

const snapshotSource = fs.readFileSync(snapshotPath, 'utf8');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const validationSource = fs.readFileSync(validationServerPath, 'utf8');
const configSource = fs.readFileSync(path.join(root, 'config.js'), 'utf8');

const WRITE_PATTERNS = [
  /\bsetValues\s*\(/,
  /\bappendRow\s*\(/,
  /\bclearContents\s*\(/,
  /\bclearFormat\s*\(/,
  /\bdeleteSheet\s*\(/,
  /\binsertSheet\s*\(/,
  /\bsetName\s*\(/,
  /\bhideColumns\s*\(/,
  /\bsetNumberFormat\s*\(/,
  /\bensureSys[A-Za-z0-9_]*\s*\(/,
  /\bensureInvestment[A-Za-z0-9_]*\s*\(/,
  /\bensureFinancial[A-Za-z0-9_]*\s*\(/,
  /\bensureImport[A-Za-z0-9_]*\s*\(/,
  /\bensureCashImport[A-Za-z0-9_]*\s*\(/,
  /\bboundedHoldingsPreviewApplyEnsure[A-Za-z0-9_]*\s*\(/,
  /\bensureSysMetaMarker_\s*\(/
];

for (const pattern of WRITE_PATTERNS) {
  assert.doesNotMatch(snapshotSource, pattern,
    `sys_sheet_runtime_snapshot.js must stay read-only (${pattern})`);
}

assert.doesNotMatch(
  snapshotSource.match(/function buildSysSheetRuntimeSnapshot_\([\s\S]*?\n\}/)[0],
  /\bgetUserSpreadsheet_\s*\(/,
  'core builder must accept an explicit spreadsheet handle only'
);
assert.match(snapshotSource, /function adminGetSysSheetRuntimeSnapshot\(\)[\s\S]*sysSheetRuntimeSnapshotRequireSpreadsheet_\(\)/);
const adminEntryMatch = snapshotSource.match(
  /function adminGetSysSheetRuntimeSnapshot\(\) \{([\s\S]*?)\n\}/
);
assert.ok(adminEntryMatch, 'adminGetSysSheetRuntimeSnapshot must exist');
assert.match(adminEntryMatch[1], /buildSysSheetRuntimeSnapshot_\(sysSheetRuntimeSnapshotRequireSpreadsheet_\(\)\)/,
  'admin entry must call the read-only builder with an explicit resolved workbook');
assert.match(adminEntryMatch[1], /sysSheetRuntimeSnapshotWireSafe_/,
  'admin entry must wire-safe the snapshot before return/log');
assert.match(adminEntryMatch[1], /return snapshot;/,
  'admin entry must return the wire-safe snapshot object');
assert.match(adminEntryMatch[1], /return failure;/,
  'admin entry must return structured failure instead of throwing');
const adminUiEntryMatch = snapshotSource.match(
  /function adminUiGetSysSheetRuntimeSnapshot\(\) \{([\s\S]*?)\n\}/
);
assert.ok(adminUiEntryMatch, 'adminUiGetSysSheetRuntimeSnapshot must exist');
assert.doesNotMatch(adminUiEntryMatch[1], /Logger\.log/,
  'admin UI wrapper must not log snapshot payloads');
assert.match(adminUiEntryMatch[1], /sysSheetRuntimeSnapshotFormatAdminError_/,
  'admin UI wrapper must return structured errors');
const focusSummaryEntryMatch = snapshotSource.match(
  /function adminGetSysSheetRuntimeSnapshotFocusSummary\(\) \{([\s\S]*?)\n\}/
);
assert.ok(focusSummaryEntryMatch, 'adminGetSysSheetRuntimeSnapshotFocusSummary must exist');
assert.match(focusSummaryEntryMatch[1],
  /buildSysSheetRuntimeSnapshotFocusSummary_\(sysSheetRuntimeSnapshotRequireSpreadsheet_\(\)\)/,
  'focus summary admin entry must call the compact builder with an explicit resolved workbook');
assert.match(focusSummaryEntryMatch[1], /Logger\.log\(JSON\.stringify\(sheet, null, 2\)\)/,
  'focus summary admin entry must log one line per sheet');
assert.match(focusSummaryEntryMatch[1], /return summary;/,
  'focus summary admin entry must return the wire-safe summary');
assert.match(focusSummaryEntryMatch[1], /return failure;/,
  'focus summary admin entry must return structured failure instead of throwing');
assert.match(snapshotSource, /function buildSysSheetRuntimeSnapshotFocusSummary_\(ss\)/);
assert.match(snapshotSource, /function sysSheetRuntimeSnapshotRequireSpreadsheet_\(\)/);
assert.match(snapshotSource, /function sysSheetRuntimeSnapshotWireSafe_\(/);
assert.match(snapshotSource, /function sysSheetRuntimeSnapshotFormatAdminError_/);
assert.match(snapshotSource, /summaryVersion: 'SYS_SHEET_RUNTIME_FOCUS_SUMMARY_V1'/);
assert.match(snapshotSource, /assertAdmin_\(\)/);
assert.match(snapshotSource, /SYS_SHEET_RUNTIME_SNAPSHOT_VERSION_/);
assert.match(snapshotSource, /sensitiveValuesRedacted:\s*true/);
assert.equal(inventory.runtimeSnapshot.version, schema.schemaVersion);

assert.match(validationSource, /function vtRunSysSheetRuntimeSnapshot\(/);
assert.match(validationSource, /buildSysSheetRuntimeSnapshot_\(t\.ss\)/);

function inventoryStatusMap() {
  const map = new Map();
  for (const row of inventory.sheets) {
    map.set(row.exactName, row.recommendedStatus);
  }
  return map;
}

const statusMap = inventoryStatusMap();
const indexMatch = snapshotSource.match(
  /function sysSheetRuntimeSnapshotInventoryIndex_\(\) \{([\s\S]*?)\n\}/
);
assert.ok(indexMatch, 'inventory index function must exist');

for (const row of inventory.sheets) {
  assert.match(indexMatch[1], new RegExp(row.recommendedStatus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `inventory index must preserve recommendedStatus for ${row.exactName}`);
  const escapedName = row.exactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.ok(indexMatch[1].includes(row.exactName) || indexMatch[1].includes('\\u2014'),
    `inventory index must include ${row.exactName}`);
  if (row.exactName.includes('—')) {
    assert.ok(indexMatch[1].includes('\\u2014'), 'import staging/ignored names must use em dash escape');
  } else {
    assert.match(indexMatch[1], new RegExp(escapedName),
      `inventory index must include literal ${row.exactName}`);
  }
}

for (const focus of schema.focusSheets) {
  const needle = focus.includes('—')
    ? focus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('—', '\\u2014')
    : focus.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(snapshotSource, new RegExp(needle),
    `focus sheet ${focus} must be declared in snapshot module`);
}

function makeMockRange(values, formulas, numberFormats) {
  return {
    getDisplayValues: () => values,
    getFormulas: () => formulas || values.map((row) => row.map(() => '')),
    getNumberFormats: () => numberFormats || values.map((row) => row.map(() => '@'))
  };
}

function makeMockSheet(name, spec) {
  spec = spec || {};
  const headers = spec.headers || [];
  const rows = spec.rows || [];
  const lastRow = 1 + rows.length;
  const lastCol = headers.length;
  return {
    getName: () => name,
    getLastRow: () => lastRow,
    getLastColumn: () => lastCol,
    getRange: (startRow, startCol, numRows, numCols) => {
      if (startRow === 1 && startCol === 1 && numRows === 1) {
        const headerSlice = headers.slice(0, numCols || lastCol);
        return makeMockRange([headerSlice]);
      }
      const slice = rows.slice(startRow - 2, startRow - 2 + numRows).map((row) =>
        row.slice(startCol - 1, startCol - 1 + numCols));
      const formatSlice = (spec.numberFormats || [])
        .slice(startRow - 2, startRow - 2 + numRows)
        .map((row) => (row || []).slice(startCol - 1, startCol - 1 + numCols));
      return makeMockRange(slice, spec.formulas, formatSlice.length ? formatSlice : null);
    }
  };
}

const unifiedHeaders = [
  'Source', 'Provider', 'Parent CashCompass account', 'Child account/partition',
  'Investment Id', 'Source security key', 'Symbol', 'Security name', 'Shares', 'Price',
  'Market value', 'Cost basis', 'Unrealized gain/loss', 'Cash balance', 'As-of date',
  'Document fingerprint', 'Import status', 'Imported at', 'Import run/reference'
];

const mockSheets = [
  makeMockSheet('SYS - Investment Holdings Unified', {
    headers: unifiedHeaders,
    rows: [
      ['M1_STATEMENT', 'M1', 'Parent', '', 'INV-1', 'SEC-1', 'AAPL', 'Apple', '1', '100',
        '100', '90', '10', '', '2026-03-01', 'fp-1', 'APPLIED', '2026-03-01 10:00:00', 'run-1'],
      ['M1_STATEMENT', 'M1', 'Parent', '', 'INV-1', '__CASH__', 'CASH', 'Cash', '', '',
        '', '', '', '6.92', '2026-03-01', 'fp-1', 'APPLIED', '2026-03-01 10:00:00', 'run-1']
    ],
    numberFormats: [
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '$#,##0.00', 'yyyy-mm-dd'],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '$#,##0.00', 'yyyy-mm-dd']
    ]
  }),
  makeMockSheet('SYS - Investment Activity', {
    headers: [
      'Import Key', 'Investment Id', 'Account Name', 'Activity Date', 'Settle Date',
      'Ticker', 'Activity Type', 'Quantity', 'Price', 'Amount', 'Recurring',
      'Description', 'Source', 'Imported At'
    ],
    rows: [
      ['key-1', 'INV-RH', 'Account', '2026-02-01', '', 'AAPL', 'BUY', '1', '100', '100', '',
        'Buy', 'ROBINHOOD_CSV', '2026-02-01 09:00:00']
    ]
  }),
  makeMockSheet('SYS - Investment Holdings', {
    headers: [
      'Investment Id', 'Account Name', 'As Of Date', 'Ticker', 'Quantity',
      'Total Buy Cost', 'Sale Proceeds', 'Dividends Received',
      'Weekly Recurring Buy', 'Last Activity Price', 'Activity Count', 'Updated At'
    ],
    rows: [
      ['INV-RH', 'Account', '2026-02-01', 'AAPL', '1', '100', '0', '0', '0', '100', '1', '2026-02-01']
    ]
  }),
  makeMockSheet('SYS - Assets', {
    headers: ['Account Name', 'Type', 'Current Balance', 'Investment Id', 'Planning Purpose'],
    rows: [['Brokerage', 'Investment', '1000', 'INV-RH', 'Growth']]
  }),
  makeMockSheet('SYS - Financial Accounts', {
    headers: ['stableAccountId', 'domain', 'institution', 'registrationType', 'identityStatus'],
    rows: [['ACC-1', 'INVESTMENT', 'Broker', 'INDIVIDUAL', 'VERIFIED']]
  }),
  makeMockSheet('SYS - Account Source Links', {
    headers: ['stableAccountId', 'sourceSystem', 'sourceAccountKey', 'Link status'],
    rows: [['ACC-1', 'ROBINHOOD', 'sha256:abc', 'VERIFIED']]
  })
];

const mockSs = {
  id: 'mock-spreadsheet-id',
  getId: () => 'mock-spreadsheet-id',
  getSheetByName: (name) => mockSheets.find((sheet) => sheet.getName() === name) || null,
  getSheets: () => mockSheets
};

const context = {
  SYS_META_SHEET_NAME_: 'SYS - Meta',
  assertAdmin_: () => {},
  getUserSpreadsheet_: () => mockSs,
  Logger: { log: (...args) => { context.__logged.push(args.join(' ')); } },
  __logged: [],
  console
};
vm.createContext(context);
vm.runInContext(configSource, context, { filename: 'config.js' });
vm.runInContext(snapshotSource, context, { filename: 'sys_sheet_runtime_snapshot.js' });

const adminReport = context.adminGetSysSheetRuntimeSnapshot();
assert.equal(adminReport.ok, true);
assert.equal(adminReport.readOnly, true);
assert.equal(context.__logged.length, 1, 'admin entry must log exactly once');
const loggedPayload = context.__logged[0];
assert.match(loggedPayload, /"auditVersion": "SYS_SHEET_RUNTIME_SNAPSHOT_V1"/);
assert.match(loggedPayload, /"sensitiveValuesRedacted": true/);
assert.equal(loggedPayload.includes('Apple'), false,
  'logged snapshot must not expose security names from body rows');
assert.equal(loggedPayload.includes('Brokerage'), false,
  'logged snapshot must not expose asset account names from body rows');
assert.equal(loggedPayload.includes('sha256:abc'), false,
  'logged snapshot must not expose raw source account keys from body rows');
assert.equal(loggedPayload, JSON.stringify(adminReport, null, 2),
  'admin entry must log the same sanitized snapshot it returns');

const report = adminReport;
assert.equal(report.ok, true);
assert.equal(report.readOnly, true);
assert.equal(report.auditVersion, schema.schemaVersion);

for (const field of schema.requiredTopLevelFields) {
  assert.ok(Object.prototype.hasOwnProperty.call(report, field),
    `snapshot must include top-level field ${field}`);
}

for (const field of schema.requiredSheetFields) {
  for (const sheet of report.sheets) {
    assert.ok(Object.prototype.hasOwnProperty.call(sheet, field),
      `${sheet.sheetName} must include field ${field}`);
  }
}

for (const focus of schema.focusSheets) {
  assert.ok(report.focusSummaries[focus], `focusSummaries must include ${focus}`);
  assert.ok(report.focusSummaries[focus].focusMetadata,
    `${focus} must include focusMetadata`);
}

const unified = report.sheets.find((row) => row.sheetName === 'SYS - Investment Holdings Unified');
assert.ok(unified);
assert.equal(unified.dataRowCount, 2);
assert.equal(unified.headerRow.length, 19);
assert.equal(unified.focusMetadata.m1RowsPresent, true);
assert.equal(unified.focusMetadata.cashBalanceFormat.displaysAsCurrency, true);
assert.equal(unified.dataMarkers.m1, true);

const activity = report.sheets.find((row) => row.sheetName === 'SYS - Investment Activity');
assert.equal(activity.focusMetadata.robinhoodRowCount, 1);
assert.equal(activity.dataMarkers.robinhood, true);

for (const sheet of report.sheets) {
  const expectedStatus = statusMap.get(sheet.sheetName);
  if (expectedStatus) {
    assert.equal(sheet.productionRefs.recommendedStatus, expectedStatus,
      `${sheet.sheetName} must preserve inventory classification`);
  }
  for (const marker of schema.requiredDataMarkerFields) {
    assert.ok(Object.prototype.hasOwnProperty.call(sheet.dataMarkers, marker),
      `${sheet.sheetName} must expose data marker ${marker}`);
  }
}

const serialized = JSON.stringify(report);
assert.equal(serialized.includes('Apple'), false,
  'snapshot must not expose security names from body rows');
assert.equal(serialized.includes('Brokerage'), false,
  'snapshot must not expose asset account names from body rows');
assert.equal(serialized.includes('sha256:abc'), false,
  'snapshot must not expose raw source account keys from body rows');

context.__logged = [];
const focusSummary = context.adminGetSysSheetRuntimeSnapshotFocusSummary();
assert.equal(focusSummary.ok, true);
assert.equal(focusSummary.summaryVersion, schema.focusSummaryVersion);
assert.equal(focusSummary.sheets.length, schema.focusSheets.length);
assert.equal(context.__logged.length, schema.focusSheets.length,
  'focus summary admin entry must log exactly once per focus sheet');

for (const sheet of focusSummary.sheets) {
  assert.ok(schema.focusSheets.includes(sheet.sheetName),
    `unexpected focus summary sheet ${sheet.sheetName}`);
  for (const field of schema.requiredFocusSummarySheetFields) {
    assert.ok(Object.prototype.hasOwnProperty.call(sheet, field),
      `${sheet.sheetName} must include focus summary field ${field}`);
  }
  for (const forbidden of schema.forbiddenFocusSummarySheetFields) {
    assert.ok(!Object.prototype.hasOwnProperty.call(sheet, forbidden),
      `${sheet.sheetName} must not include ${forbidden}`);
  }
}

const compactUnified = focusSummary.sheets.find((row) =>
  row.sheetName === 'SYS - Investment Holdings Unified');
assert.ok(compactUnified);
assert.equal(compactUnified.dataRowCount, 2);
assert.equal(compactUnified.focusMetadata.m1RowsPresent, true);
assert.equal(compactUnified.focusMetadata.cashRowCount, 1);
assert.equal(compactUnified.focusMetadata.cashBalanceFormat.displaysAsCurrency, true);
assert.equal(compactUnified.focusMetadata.maxAsOfDate, '2026-03-01');
assert.equal(compactUnified.focusMetadata.sourceCounts.M1, 2);
assert.equal(compactUnified.focusMetadata.sourceCounts.ETRADE, 0);
assert.equal(compactUnified.focusMetadata.sourceCounts.ROBINHOOD, 0);
assert.equal(compactUnified.focusMetadata.sourceCounts.OTHER, 0);
assert.equal(Object.prototype.hasOwnProperty.call(compactUnified.focusMetadata, 'securityRowCount'), false,
  'unified focus summary must omit non-requested focus fields');

const focusSerialized = JSON.stringify(focusSummary);
assert.equal(focusSerialized.includes('headerRow'), false,
  'focus summary must not include header rows');
assert.equal(focusSerialized.includes('Apple'), false,
  'focus summary must not expose security names from body rows');
assert.equal(focusSerialized.includes('Brokerage'), false,
  'focus summary must not expose asset account names from body rows');
assert.equal(focusSerialized.includes('sha256:abc'), false,
  'focus summary must not expose raw source account keys from body rows');
assert.equal(focusSerialized.includes('fp-1'), false,
  'focus summary must not expose document fingerprints from body rows');
assert.equal(focusSerialized.includes('Parent'), false,
  'focus summary must not expose parent account labels from body rows');

for (let i = 0; i < focusSummary.sheets.length; i++) {
  assert.equal(context.__logged[i], JSON.stringify(focusSummary.sheets[i], null, 2),
    `focus summary log line ${i + 1} must match returned sheet payload`);
}

const nullWorkbookContext = {
  SYS_META_SHEET_NAME_: 'SYS - Meta',
  assertAdmin_: () => {},
  getUserSpreadsheet_: () => null,
  Logger: { log: (...args) => { nullWorkbookContext.__logged.push(args.join(' ')); } },
  __logged: [],
  console
};
vm.createContext(nullWorkbookContext);
vm.runInContext(configSource, nullWorkbookContext, { filename: 'config-null.js' });
vm.runInContext(snapshotSource, nullWorkbookContext, { filename: 'sys_sheet_runtime_snapshot-null.js' });

const nullWorkbookSummary = nullWorkbookContext.adminGetSysSheetRuntimeSnapshotFocusSummary();
assert.equal(nullWorkbookSummary.ok, false);
assert.match(nullWorkbookSummary.error, /No workbook is available/);
assert.equal(nullWorkbookSummary.failurePhase, 'focus_summary');
assert.ok(nullWorkbookSummary.stackLocation, 'failure must include stack location');
assert.equal(nullWorkbookSummary.summaryVersion, schema.focusSummaryVersion);
assert.equal(nullWorkbookSummary.readOnly, true);
assert.equal(JSON.stringify(nullWorkbookSummary).includes('Brokerage'), false,
  'failure payload must not expose workbook body values');
assert.equal(nullWorkbookContext.__logged.length, 1,
  'focus summary failure must log one structured failure line');
assert.match(nullWorkbookContext.__logged[0], /"ok": false/);

console.log('SYS sheet runtime snapshot regressions passed.');
console.log(JSON.stringify({
  schemaVersion: schema.schemaVersion,
  mockSheetCount: report.sheets.length,
  focusSheets: schema.focusSheets.length,
  unifiedDataRows: unified.dataRowCount,
  focusSummarySheets: focusSummary.sheets.length
}));
