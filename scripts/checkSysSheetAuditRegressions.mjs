import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('../', import.meta.url).pathname);
const inventoryPath = path.join(root, 'test/fixtures/sys-sheet-audit-inventory.json');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

const SCAN_EXTENSIONS = new Set(['.js', '.html', '.mjs']);
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'services', '.git', '.cashcompass-push', '.vite'
]);

const WORKBOOK_MUTATION_PATTERNS = [
  /\bdeleteSheet\s*\(/,
  /\bclear\s*\(\s*\)/,
  /\bclearContents\s*\(/,
  /\bclearFormat\s*\(/,
  /\bsetName\s*\(/,
  /\bmoveActiveSheet\s*\(/,
  /\bdeleteRows\s*\(/,
  /\bdeleteColumns\s*\(/,
  /\binsertSheet\s*\(/,
  /\bappendRow\s*\(/,
  /\bsetValues\s*\(/,
  /\bgetUserSpreadsheet_\s*\(/,
  /\bSpreadsheetApp\.open/
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function relative(p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function extractConfigSysSheetNames() {
  const config = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
  const names = new Map();
  const block = config.match(/function getSheetNames_\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(block, 'getSheetNames_ must exist in config.js');
  const re = /^\s*([A-Z0-9_]+):\s*'(SYS -[^']+)'/gm;
  let match;
  while ((match = re.exec(block[1])) !== null) {
    names.set(match[2], match[1]);
  }
  return names;
}

function scanSysReferences(files, knownNames) {
  const bySheet = new Map();
  const quotedRe = /['"](SYS - [^'"]+)['"]/g;
  const keyRe = /getSheetNames_\(\)\.([A-Z0-9_]+)/g;

  for (const file of files) {
    const rel = relative(file);
    if (rel === 'test/fixtures/sys-sheet-audit-inventory.json') continue;
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = quotedRe.exec(text)) !== null) {
      const name = m[1].trim();
      if (!knownNames.has(name)) continue;
      if (!bySheet.has(name)) bySheet.set(name, new Set());
      bySheet.get(name).add(rel);
    }
    while ((m = keyRe.exec(text)) !== null) {
      const key = m[1];
      if (!bySheet.has(`__KEY__:${key}`)) bySheet.set(`__KEY__:${key}`, new Set());
      bySheet.get(`__KEY__:${key}`).add(rel);
    }
  }
  return bySheet;
}

function inventorySheetNames() {
  return inventory.sheets.map((row) => row.exactName);
}

function assertAuditScriptsReadOnly() {
  const auditFiles = [
    'scripts/checkSysSheetAuditRegressions.mjs',
    'scripts/checkSysSheetRuntimeSnapshotRegressions.mjs',
    'test/fixtures/sys-sheet-audit-inventory.json',
    'test/fixtures/sys-sheet-runtime-snapshot-schema.json'
  ];
  for (const rel of auditFiles) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.doesNotMatch(text, /\bgetUserSpreadsheet_\s*\(/,
      `${rel} must not call getUserSpreadsheet_`);
    for (const pattern of WORKBOOK_MUTATION_PATTERNS) {
      if (pattern.source.includes('getUserSpreadsheet_')) continue;
      assert.doesNotMatch(text, pattern, `${rel} must remain read-only (${pattern})`);
    }
  }

  const snapshotSource = fs.readFileSync(path.join(root, 'sys_sheet_runtime_snapshot.js'), 'utf8');
  const builderBlock = snapshotSource.match(
    /function buildSysSheetRuntimeSnapshot_\(ss\) \{([\s\S]*?)\n\}/
  );
  assert.ok(builderBlock, 'buildSysSheetRuntimeSnapshot_ must exist');
  assert.doesNotMatch(builderBlock[0], /\bgetUserSpreadsheet_\s*\(/,
    'runtime snapshot builder must not resolve workbooks internally');
  for (const pattern of WORKBOOK_MUTATION_PATTERNS) {
    if (pattern.source.includes('getUserSpreadsheet_')) continue;
    assert.doesNotMatch(snapshotSource, pattern,
      `sys_sheet_runtime_snapshot.js must remain read-only (${pattern})`);
  }
}

function assertUnifiedSheetSchema() {
  const applySheet = fs.readFileSync(path.join(root, 'bounded_holdings_preview_apply_sheet.js'), 'utf8');
  const unified = inventory.sheets.find((row) => row.exactName === 'SYS - Investment Holdings Unified');
  assert.ok(unified && unified.schema, 'inventory must describe unified schema');

  assert.match(applySheet, /BOUNDED_HOLDINGS_UNIFIED_HEADERS_/);
  assert.match(applySheet, /CASH_BALANCE:\s*14/);
  assert.match(applySheet, /AS_OF_DATE:\s*15/);
  assert.match(applySheet, /IMPORTED_AT:\s*18/);
  assert.match(applySheet, /boundedHoldingsPreviewApplyFormatUnifiedSheet_/);
  assert.match(applySheet, /BOUNDED_HOLDINGS_UNIFIED_CURRENCY_FORMAT_/);
  assert.match(applySheet, /hideColumns/);
  assert.doesNotMatch(
    applySheet,
    /getRange\([\s\S]*CASH_BALANCE[\s\S]*yyyy-mm-dd/
  );

  const headerMatch = applySheet.match(/var BOUNDED_HOLDINGS_UNIFIED_HEADERS_ = \[([\s\S]*?)\];/);
  assert.ok(headerMatch, 'BOUNDED_HOLDINGS_UNIFIED_HEADERS_ must exist');
  const headers = [...headerMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(headers.length, unified.schema.columnCount);
  assert.equal(headers[13], 'Cash balance');
  assert.equal(headers[14], 'As-of date');
  assert.equal(headers[17], 'Imported at');

  const rowValuesFn = applySheet.match(/function boundedHoldingsPreviewApplyRowToSheetValues_[\s\S]*?return \[[\s\S]*?\];/);
  assert.ok(rowValuesFn, 'row value mapper must exist');
  assert.match(rowValuesFn[0], /cashBalance[\s\S]*asOfDate/s,
    'cashBalance must precede asOfDate in stored row array');
}

function assertRobinhoodTrace() {
  const activity = fs.readFileSync(path.join(root, 'investment_activity.js'), 'utf8');
  const adapters = fs.readFileSync(path.join(root, 'investment_adapters.js'), 'utf8');
  const foundation = fs.readFileSync(path.join(root, 'investment_portfolio_foundation.js'), 'utf8');
  const apply = fs.readFileSync(path.join(root, 'bounded_holdings_preview_apply.js'), 'utf8');

  assert.match(activity, /rebuildInvestmentHoldingsForAccount_/);
  assert.match(activity, /importInvestmentActivityFromDashboard/);
  assert.match(activity, /getSheetNames_\(\)\.INVESTMENT_HOLDINGS/);
  assert.match(adapters, /ROBINHOOD_CSV/);
  assert.match(foundation, /investmentPortfolioRobinhoodImportEligible_/);
  assert.doesNotMatch(apply, /ROBINHOOD|Robinhood/);
  assert.doesNotMatch(
    fs.readFileSync(path.join(root, 'bounded_holdings_preview_apply_sheet.js'), 'utf8'),
    /ROBINHOOD|Robinhood/
  );

  const migration = inventory.robinhoodMigration;
  assert.equal(migration.currentHoldingsSheet, 'SYS - Investment Holdings');
  assert.equal(migration.futureImportsWriteUnified, false);
  assert.equal(migration.futureImportsWriteLegacyHoldings, true);
}

function assertInventoryComplete(configNames, scanned) {
  const inventoryNames = new Set(inventorySheetNames());
  for (const name of configNames.keys()) {
    assert.ok(inventoryNames.has(name), `inventory missing config sheet ${name}`);
  }
  assert.ok(inventoryNames.has('SYS - Meta'), 'inventory must include SYS - Meta');

  for (const sheet of inventory.sheets) {
    assert.ok(sheet.exactName, 'each inventory row needs exactName');
    assert.ok(sheet.purpose, `${sheet.exactName} needs purpose`);
    assert.ok(sheet.recommendedStatus, `${sheet.exactName} needs recommendedStatus`);
    assert.ok(Array.isArray(sheet.readFunctions), `${sheet.exactName} needs readFunctions`);
    assert.ok(Array.isArray(sheet.writeFunctions), `${sheet.exactName} needs writeFunctions`);
  }
}

function assertScannedReferencesKnown(scanned) {
  const known = new Set(inventorySheetNames());

  for (const [name, files] of scanned.entries()) {
    if (name.startsWith('__KEY__:')) continue;
    assert.ok(known.has(name), `scanned sheet must be in inventory: ${name}`);
    assert.ok(files.size > 0, `${name} should have at least one code reference`);
  }
}

function assertKeySheetsReferenced(scanned, configNames) {
  const mustAppear = [
    'SYS - Investment Holdings Unified',
    'SYS - Investment Holdings',
    'SYS - Financial Accounts',
    'SYS - Investment Activity'
  ];
  for (const name of mustAppear) {
    assert.ok(scanned.has(name), `${name} must appear in repository scan`);
  }
  for (const [name, key] of configNames.entries()) {
    assert.ok(scanned.has(`__KEY__:${key}`) || scanned.has(name),
      `${name} should be referenced literally or via getSheetNames_.${key}`);
  }
}

function assertNoProductionPathTouchesUnifiedOutsideApply() {
  const boundedPreview = fs.readFileSync(path.join(root, 'bounded_holdings_preview.js'), 'utf8');
  assert.doesNotMatch(boundedPreview, /INVESTMENT_HOLDINGS_UNIFIED/);
  assert.doesNotMatch(boundedPreview, /Investment Holdings Unified/);
}

// --- Run audit regressions ---
assert.equal(inventory.auditVersion, 'SYS_SHEET_AUDIT_V1');
assert.ok(inventory.runtimeSnapshot, 'inventory must describe runtime snapshot module');
assert.equal(inventory.runtimeSnapshot.version, 'SYS_SHEET_RUNTIME_SNAPSHOT_V1');
assertAuditScriptsReadOnly();

const configNames = extractConfigSysSheetNames();
const knownNames = new Set(inventorySheetNames());
for (const name of configNames.keys()) knownNames.add(name);
const files = walk(root).filter((f) => !relative(f).startsWith('scripts/checkSysSheetAuditRegressions.mjs'));
const scanned = scanSysReferences(files, knownNames);

assertInventoryComplete(configNames, scanned);
assertScannedReferencesKnown(scanned);
assertKeySheetsReferenced(scanned, configNames);
assertUnifiedSheetSchema();
assertRobinhoodTrace();
assertNoProductionPathTouchesUnifiedOutsideApply();

const statusCounts = inventory.sheets.reduce((acc, row) => {
  acc[row.recommendedStatus] = (acc[row.recommendedStatus] || 0) + 1;
  return acc;
}, {});
assert.ok(statusCounts.KEEP_ACTIVE >= 10, 'expected majority KEEP_ACTIVE');
assert.equal(statusCounts.SAFE_REMOVAL_CANDIDATE || 0, 0,
  'audit must not recommend removal without explicit legacy proof');

console.log('SYS sheet audit regressions passed.');
console.log(JSON.stringify({
  auditVersion: inventory.auditVersion,
  sheetCount: inventory.sheets.length,
  scannedSheetLiterals: [...scanned.keys()].filter((k) => !k.startsWith('__KEY__:')).length,
  recommendedStatus: statusCounts
}));
