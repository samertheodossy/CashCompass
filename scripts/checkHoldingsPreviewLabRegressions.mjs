import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (subdir, name) => read(`test/fixtures/${subdir}/${name}`);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`${name} must have a complete body`);
}

const utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  computeDigest(_algorithm, value) {
    return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
      .map((byte) => (byte > 127 ? byte - 256 : byte));
  }
};

function buildContext(overrides = {}) {
  const context = {
    Utilities: utilities,
    String, Number, Object, Array, Math, isFinite, Error, JSON, console,
    assertAdmin_: () => {
      if (!context.__admin) throw new Error('Admin access required.');
    },
    isAdminUser_: () => !!context.__admin,
    isCentralModeEnabled_: () => context.__central !== false,
    ...overrides
  };
  context.__admin = overrides.admin !== false;
  context.__central = overrides.central !== false;
  vm.createContext(context);
  vm.runInContext(read('config.js'), context, { filename: 'config.js' });
  vm.runInContext(read('financial_identity.js'), context, { filename: 'financial_identity.js' });
  vm.runInContext(read('investment_portfolio_foundation.js'), context, {
    filename: 'investment_portfolio_foundation.js'
  });
  vm.runInContext(`
    function round2_(value) { return Math.round(Number(value) * 100) / 100; }
    ${extractFunction(read('investment_activity.js'), 'normalizeInvestmentImportDate_')}
    ${extractFunction(read('investment_activity.js'), 'parseInvestmentImportMoney_')}
    ${extractFunction(read('investment_activity.js'), 'parseInvestmentImportNumber_')}
  `, context, { filename: 'activity-stubs.js' });
  vm.runInContext(read('investment_etrade_csv.js'), context, { filename: 'investment_etrade_csv.js' });
  vm.runInContext(read('investment_etrade_positions_pdf.js'), context, {
    filename: 'investment_etrade_positions_pdf.js'
  });
  vm.runInContext(read('investment_etrade_client_statement_pdf.js'), context, {
    filename: 'investment_etrade_client_statement_pdf.js'
  });
  vm.runInContext(read('investment_m1_statement_pdf.js'), context, {
    filename: 'investment_m1_statement_pdf.js'
  });
  vm.runInContext(read('investment_adapters.js'), context, { filename: 'investment_adapters.js' });
  vm.runInContext(read('central_holdings_preview_lab.js'), context, {
    filename: 'central_holdings_preview_lab.js'
  });
  return context;
}

const etradeFixture = fixture('etrade', 'synthetic_etrade_positions_minimal.txt');
const etradeStatementFixture = fixture('etrade', 'synthetic_etrade_client_statement_main.txt');
const m1Fixture = fixture('m1', 'synthetic_m1_statement_minimal.txt');
const labSource = read('central_holdings_preview_lab.js');
const htmlSource = read('HoldingsPreviewLabUI.html');
const webappSource = read('webapp.js');
const adminDiagSource = read('AdminDiagnostics.html');
const etradeLabSource = read('central_etrade_preview_lab.js');

const ctx = buildContext();
const baseIdentity = {
  stableAccountId: 'INV-HOLDINGS-LAB-1',
  accountName: 'Synthetic Holdings Lab Account',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
};

// --- Admin + Central gating ---
const denied = buildContext({ admin: false });
assert.equal(denied.adminUiHoldingsPreviewLabPreview({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  ...baseIdentity
}).ok, false);
assert.match(denied.adminUiHoldingsPreviewLabPreview({}).error, /Admin access required/);

const bounded = buildContext({ central: false });
assert.equal(bounded.adminUiHoldingsPreviewLabPreview({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  ...baseIdentity
}).ok, false);
assert.match(bounded.adminUiHoldingsPreviewLabPreview({}).error, /Central mode only/);

// --- Identity validation ---
assert.match(ctx.adminUiHoldingsPreviewLabPreview({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  accountName: 'A',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
}).error, /stableAccountId is required/);

assert.match(ctx.adminUiHoldingsPreviewLabPreview({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  stableAccountId: 'XXXX1234',
  accountName: 'Masked',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
}).error, /Masked account numbers cannot be used as stableAccountId/);

assert.match(ctx.adminUiHoldingsPreviewLabPreview({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  stableAccountId: 'INV-M1-1',
  accountName: 'M1',
  registrationType: 'TAXABLE',
  explicitAccountMatch: false
}).error, /Explicit account-match confirmation is required/);

assert.match(ctx.adminUiHoldingsPreviewLabPreview({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  stableAccountId: 'INV-M1-1',
  accountName: 'M1',
  registrationType: '',
  explicitAccountMatch: true
}).error, /registrationType is required/);

// --- E*TRADE Positions PDF source ---
const etradePreview = ctx.adminUiHoldingsPreviewLabPreview({
  source: 'ETRADE_POSITIONS_PDF',
  rawDocumentText: etradeFixture,
  stableAccountId: 'INV-ET-POS-LAB',
  accountName: 'E*TRADE Positions Lab',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(etradePreview.ok, true, etradePreview.error || 'etrade preview failed');
assert.equal(etradePreview.source, 'ETRADE_POSITIONS_PDF');
assert.equal(etradePreview.contractVersion, 'PORTFOLIO_INTELLIGENCE_HOLDINGS_V1');
assert.equal(etradePreview.account.matchStatus, 'EXPLICIT_MATCH');
assert.equal(etradePreview.account.stableAccountId, 'INV-ET-POS-LAB');
assert.notEqual(etradePreview.account.displayName, 'TEST-ACCT-POS-1');
assert.ok(etradePreview.holdingsRows.length >= 3);
assert.equal(etradePreview.readiness.trustedForIncomeAnalysis, false);
assert.equal(etradePreview.cashBalance, 12345.67);

const etradeCashRow = etradePreview.holdingsRows.find((row) => row.symbol === 'Cash');
assert.equal(etradeCashRow, undefined);

const etradeSynaaa = etradePreview.holdingsRows.find((row) => row.symbol === 'SYNAAA');
assert.ok(etradeSynaaa);
assert.match(etradeSynaaa.sourceSecurityKey, /^ETRADE\|/);
assert.notEqual(etradeSynaaa.sourceSecurityKey, etradeSynaaa.symbol);
assert.equal(etradeSynaaa.costBasis, 3500);

// --- E*TRADE Client Statement PDF source ---
const etradeStatementPreview = ctx.adminUiHoldingsPreviewLabPreview({
  source: 'ETRADE_CLIENT_STATEMENT_PDF',
  rawDocumentText: etradeStatementFixture,
  stableAccountId: 'INV-ET-STATEMENT-LAB',
  accountName: 'E*TRADE Main Statement Lab',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true,
  extractionMeta: { method: 'TEXT_FILE', quality: 'USABLE', usable: true }
});
assert.equal(etradeStatementPreview.ok, true, etradeStatementPreview.error || 'statement preview failed');
assert.equal(etradeStatementPreview.source, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(etradeStatementPreview.provider, 'ETRADE');
assert.equal(etradeStatementPreview.account.matchStatus, 'EXPLICIT_MATCH');
assert.equal(etradeStatementPreview.holdingsRows.length, 2);
assert.equal(etradeStatementPreview.cashBalance, 5000);
assert.equal(etradeStatementPreview.reconciliation.ok, true);
assert.equal(etradeStatementPreview.extraction.method, 'TEXT_FILE');
assert.equal(etradeStatementPreview.accountKind, 'BROKERAGE');

// --- M1 Statement PDF source ---
const m1Preview = ctx.adminUiHoldingsPreviewLabPreview({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  stableAccountId: 'INV-M1-LAB-1',
  accountName: 'Synthetic M1 Taxable',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
});
assert.equal(m1Preview.ok, true, m1Preview.error || 'm1 preview failed');
assert.equal(m1Preview.source, 'M1_STATEMENT_PDF');
assert.equal(m1Preview.account.matchStatus, 'EXPLICIT_MATCH');
assert.equal(m1Preview.holdingsRows.length, 2);
assert.equal(m1Preview.readiness.trustedForTaxLotSalePlanning, false);
assert.equal(m1Preview.readiness.trustedForIncomeAnalysis, false);
assert.ok(m1Preview.analysis.readinessObservations.some((line) =>
  /Income analysis is not ready/.test(line)));

// --- Allocation + concentration ---
const etradeAnalysis = etradePreview.analysis;
assert.ok(etradeAnalysis.totalPreviewValue > 0);
const etradeAllocSum = etradeAnalysis.allocationByHolding.reduce((sum, row) => sum + row.percent, 0) +
  etradeAnalysis.cashPercent;
assert.ok(Math.abs(etradeAllocSum - 100) <= 2, `etrade allocation sum ${etradeAllocSum}`);
assert.ok(etradeAnalysis.concentrationObservations.some((line) =>
  /Cash represents/.test(line)));

const analysis = m1Preview.analysis;
assert.ok(analysis.totalPreviewValue > 0);
assert.equal(analysis.topFiveHoldings.length, 2);
assert.ok(analysis.allocationByHolding.every((row) => typeof row.percent === 'number'));
assert.ok(analysis.concentrationObservations.some((line) =>
  /Largest holding represents/.test(line)));
assert.ok(analysis.concentrationObservations.some((line) =>
  /Cash represents/.test(line)));

// --- One document per account (no multi-file requirement in payload) ---
assert.equal(ctx.adminUiHoldingsPreviewLabPreview({
  source: 'M1_STATEMENT_PDF',
  rawDocumentText: m1Fixture,
  ...baseIdentity,
  stableAccountId: 'INV-M1-SINGLE-DOC'
}).ok, true);

// --- In-memory session aggregation ---
const sessionItemA = JSON.parse(JSON.stringify(m1Preview));
const sessionItemB = JSON.parse(JSON.stringify(etradePreview));
sessionItemB.account.stableAccountId = 'INV-ET-SESSION-2';
const aggregate = ctx.adminUiHoldingsPreviewLabAggregateSession({
  sessionPreviews: [sessionItemA, sessionItemB]
});
assert.equal(aggregate.ok, true, aggregate.error || 'aggregate failed');
assert.equal(aggregate.aggregate.scopeLabel, 'Previewed accounts only');
assert.equal(aggregate.aggregate.accountCount, 2);
assert.ok(aggregate.aggregate.totalPreviewedValue > 0);
assert.ok(aggregate.aggregate.accountAllocations.length === 2);
assert.ok(aggregate.aggregate.topHoldingsAcrossAccounts.length >= 2);

const duplicateAggregate = ctx.adminUiHoldingsPreviewLabAggregateSession({
  sessionPreviews: [sessionItemA, sessionItemA]
});
assert.equal(duplicateAggregate.ok, false);
assert.match(duplicateAggregate.error, /Duplicate preview session/);

// --- Clear RPC ---
assert.equal(ctx.adminUiHoldingsPreviewLabClear().ok, true);

// --- No persistence / workbook writes ---
assert.doesNotMatch(labSource, /SpreadsheetApp|getUserSpreadsheet_|getActiveSpreadsheet/);
assert.doesNotMatch(labSource, /CacheService|PropertiesService|DriveApp|Firestore/);
assert.doesNotMatch(labSource, /setValues|appendRow|investmentPortfolioEnsure/);
assert.doesNotMatch(labSource, /previewInvestmentActivityImport|plaidImport/);

// --- No auto-map / auto-apply ---
assert.doesNotMatch(labSource, /autoMap|autoApply|applyInvestment|saveMapping/i);
assert.doesNotMatch(htmlSource, /autoMap|autoApply|applyInvestment/i);

// --- Routing + admin link ---
assert.match(webappSource, /view === 'holdings-preview-lab' && isAdminUser_\(\)/);
assert.match(webappSource, /HoldingsPreviewLabUI/);
assert.match(adminDiagSource, /holdings-preview-lab/);
assert.match(htmlSource, /adminUiHoldingsPreviewLabPreview/);
assert.match(htmlSource, /adminUiHoldingsPreviewLabAggregateSession/);
assert.match(htmlSource, /ETRADE_CLIENT_STATEMENT_PDF/);
assert.match(htmlSource, /explicitAccountMatch/);
assert.match(htmlSource, /Add to session preview/);
assert.match(htmlSource, /scopeLabel/);
assert.match(labSource, /Previewed accounts only/);
assert.doesNotMatch(htmlSource, /rebalance|buy recommendation|sell recommendation|tax optimization/i);

// --- Existing E*TRADE Preview Lab preserved ---
assert.match(etradeLabSource, /adminUiEtradePreviewLabPreview/);
assert.match(webappSource, /view === 'etrade-preview-lab' && isAdminUser_\(\)/);

// --- Fixtures remain synthetic (no real brokerage documents in Git) ---
assert.ok(m1Fixture.includes('Synthetic'));
assert.ok(etradeFixture.includes('Synthetic'));
assert.doesNotMatch(labSource, /samertheodossy@gmail\.com/i);

console.log('Holdings Preview Lab regressions passed.');
