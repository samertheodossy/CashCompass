import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (name) => read(`test/fixtures/m1/${name}`);

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

const context = {
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algorithm, value) {
      return [...crypto.createHash('sha256').update(String(value), 'utf8').digest()]
        .map((byte) => (byte > 127 ? byte - 256 : byte));
    }
  },
  String, Number, Object, Array, Math, isFinite, Error, JSON, console
};
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
`, context, { filename: 'investment_activity_partial.js' });
vm.runInContext(read('investment_etrade_csv.js'), context, { filename: 'investment_etrade_csv.js' });
vm.runInContext(read('investment_etrade_positions_pdf.js'), context, {
  filename: 'investment_etrade_positions_pdf.js'
});
vm.runInContext(read('investment_m1_statement_pdf.js'), context, {
  filename: 'investment_m1_statement_pdf.js'
});
vm.runInContext(read('investment_adapters.js'), context, { filename: 'investment_adapters.js' });

const statementFixture = fixture('synthetic_m1_statement_minimal.txt');
const pdfjsLayoutFixture = fixture('synthetic_m1_statement_pdfjs_layout.txt');
const pdfjsCharSpacedFixture = fixture('synthetic_m1_statement_pdfjs_char_spaced.txt');
const childStructureFixture = fixture('synthetic_m1_statement_child_preview_structure.txt');
const charSpacedChildStructureFixture = fixture('synthetic_m1_statement_pdfjs_char_spaced_child_structure.txt');
const etradeFixture = read('test/fixtures/etrade/synthetic_etrade_positions_minimal.txt');
const m1Source = read('investment_m1_statement_pdf.js');
const adaptersSource = read('investment_adapters.js');

const accountMeta = {
  stableAccountId: 'INV-M1-SYNTH-1',
  registrationType: 'TAXABLE',
  accountName: 'Synthetic M1 Taxable',
  explicitAccountMatch: true
};

// --- Registry ---
assert.deepEqual(context.listInvestmentAdapterSources_().sort(), [
  'ETRADE_CSV', 'ETRADE_PACKAGE', 'ETRADE_POSITIONS_PDF', 'M1_STATEMENT_PDF', 'ROBINHOOD_CSV'
]);
assert.throws(() => context.getInvestmentAdapter_('M1_CSV'), /not implemented/);
assert.equal(context.getInvestmentAdapter_('M1_STATEMENT_PDF').source, 'M1_STATEMENT_PDF');
assert.equal(context.investmentPortfolioNormalizeSource_('m1_statement_pdf'), 'M1_STATEMENT_PDF');

// --- Detect ---
assert.equal(context.investmentM1DetectStatementPdf_({
  rawStatementText: statementFixture
}).ok, true);

assert.equal(context.investmentM1DetectStatementPdf_({
  rawStatementText: pdfjsLayoutFixture
}).ok, true);

assert.equal(context.investmentM1DetectStatementPdf_({
  rawStatementText: pdfjsCharSpacedFixture
}).ok, true);

const nonM1Detect = context.investmentM1DetectStatementPdf_({
  rawStatementText: etradeFixture
});
assert.equal(nonM1Detect.ok, false);
assert.match(nonM1Detect.reason, /Missing required marker\(s\): Statement period/);

// --- Parse structure ---
const parsed = context.investmentM1ParseStatementPdfText_(statementFixture);
assert.equal(parsed.ok, true, parsed.error || 'parse failed');
assert.equal(parsed.preamble.statementPeriodEnd, '08/31/2026');
assert.equal(parsed.preamble.maskedAccountNumber, 'XXXX1234');
assert.equal(parsed.preamble.cashBalance, 5);
assert.equal(parsed.preamble.equitiesSubtotal, 9500);
assert.equal(parsed.preamble.totalAccountValue, 10000);
assert.equal(parsed.holdings.length, 2);
assert.equal(parsed.excluded.filter((row) => row.reason === 'PAGE_TOTAL').length, 1);
assert.equal(parsed.instruments.SYNA.description, 'SYNTHETIC ALPHA INC COM');

const pdfjsParsed = context.investmentM1ParseStatementPdfText_(pdfjsLayoutFixture);
assert.equal(pdfjsParsed.ok, true, pdfjsParsed.error || 'pdfjs layout parse failed');
assert.equal(pdfjsParsed.preamble.statementPeriodEnd, '08/31/2026');
assert.equal(pdfjsParsed.preamble.maskedAccountNumber, 'XXXX5678');
assert.equal(pdfjsParsed.preamble.accountType, 'Margin');
assert.equal(pdfjsParsed.holdings.length, 2);
assert.equal(pdfjsParsed.instruments.SYNA.description, 'SYNTHETIC ALPHA INC COM');
assert.equal(pdfjsParsed.preamble.cashBalance, 5);

const childStructureParsed = context.investmentM1ParseStatementPdfText_(childStructureFixture);
assert.equal(childStructureParsed.ok, true, childStructureParsed.error || 'child structure parse failed');
assert.equal(childStructureParsed.preamble.cashBalance, 6.92);
assert.equal(childStructureParsed.preamble.equitiesSubtotal, 18370.44);
assert.equal(childStructureParsed.preamble.totalAccountValue, 18377.36);
assert.equal(context.investmentM1BreakdownReconcilesToTotal_(childStructureParsed.preamble), true);

const charSpacedChildStructureParsed = context.investmentM1ParseStatementPdfText_(charSpacedChildStructureFixture);
assert.equal(charSpacedChildStructureParsed.ok, true,
  charSpacedChildStructureParsed.error || 'char-spaced child structure parse failed');
assert.equal(charSpacedChildStructureParsed.preamble.cashBalance, 6.92);
assert.equal(charSpacedChildStructureParsed.preamble.equitiesSubtotal, 18370.44);
assert.equal(charSpacedChildStructureParsed.preamble.totalAccountValue, 18377.36);
assert.equal(
  context.investmentM1BreakdownReconcilesToTotal_(charSpacedChildStructureParsed.preamble), true);

const twoColumnCashText = childStructureFixture.replace(
  'Cash $6.92 $6.92 $0.00',
  'Cash $6.92 $0.00'
);
const twoColumnCashParsed = context.investmentM1ParseStatementPdfText_(twoColumnCashText);
assert.equal(twoColumnCashParsed.preamble.cashBalance, 6.92,
  'two-column cash row must use last-period value, not change column');
assert.notEqual(twoColumnCashParsed.preamble.cashBalance, 0);
assert.equal(context.investmentM1BreakdownReconcilesToTotal_(twoColumnCashParsed.preamble), true);

const charSpacedParsed = context.investmentM1ParseStatementPdfText_(pdfjsCharSpacedFixture);
assert.equal(charSpacedParsed.ok, true, charSpacedParsed.error || 'char-spaced pdfjs parse failed');
assert.equal(charSpacedParsed.preamble.statementPeriodEnd, '08/31/2026');
assert.equal(charSpacedParsed.preamble.maskedAccountNumber, 'XXXX5678');
assert.equal(charSpacedParsed.holdings.length, 2);
assert.match(
  context.investmentM1DetectStatementPdf_({ rawStatementText: etradeFixture }).reason,
  /Missing required marker\(s\): Statement period/
);

// --- Registration suggestion is conservative ---
const marginOnlySuggest = context.investmentM1SuggestRegistrationTypeFromStatement_(pdfjsLayoutFixture);
assert.equal(marginOnlySuggest.suggested, 'TAXABLE');
assert.equal(marginOnlySuggest.confidence, 'MEDIUM');
assert.equal(marginOnlySuggest.source, 'BROKERAGE_STATEMENT');
assert.notEqual(marginOnlySuggest.source, 'MARGIN');

const rothFixture = pdfjsLayoutFixture.replace('Account type:  Margin', 'Account type:  Roth IRA');
const rothSuggest = context.investmentM1SuggestRegistrationTypeFromStatement_(rothFixture);
assert.equal(rothSuggest.suggested, 'ROTH_IRA');
assert.equal(rothSuggest.confidence, 'HIGH');

// --- Unified preview ---
const preview = context.investmentAdapterPreviewM1StatementPdf_({
  source: 'M1_STATEMENT_PDF',
  rawStatementText: statementFixture,
  accountMeta
});
assert.equal(preview.ok, true, preview.error || 'preview failed');
assert.equal(preview.normalized.contractVersion, 'PORTFOLIO_INTELLIGENCE_HOLDINGS_V1');
assert.equal(context.investmentPortfolioValidateUnifiedHoldingsPreview_(preview.normalized).ok, true);
assert.equal(preview.normalized.holdings.length, 2);
assert.equal(preview.normalized.securities.length, 2);
assert.equal(preview.normalized.accounts[0].matchStatus, 'EXPLICIT_MATCH');
assert.equal(preview.normalized.accounts[0].taxStatus, 'TAXABLE');
assert.equal(preview.normalized.accounts[0].sourceAccountKey, accountMeta.stableAccountId);
assert.notEqual(preview.normalized.accounts[0].sourceAccountKey, parsed.preamble.maskedAccountNumber);
assert.match(preview.normalized.asOf, /2026-08-31/);
assert.equal(preview.normalized.accountSnapshots[0].cashBalance, 5);
assert.equal(preview.normalized.accountSnapshots[0].marketValue, 10000);
assert.equal(preview.normalized.statementParseMeta.equitiesSubtotal, 9500);

const childStructurePreview = context.investmentAdapterPreviewM1StatementPdf_({
  source: 'M1_STATEMENT_PDF',
  rawStatementText: childStructureFixture,
  accountMeta: {
    stableAccountId: 'PREVIEW-CHILD-1',
    registrationType: 'TAXABLE',
    accountName: 'Account 1',
    explicitAccountMatch: true
  }
});
assert.equal(childStructurePreview.ok, true, childStructurePreview.error || 'child structure preview failed');
assert.equal(childStructurePreview.normalized.accountSnapshots[0].cashBalance, 6.92);
assert.equal(childStructurePreview.normalized.accountSnapshots[0].marketValue, 18377.36);
assert.equal(childStructurePreview.normalized.statementParseMeta.equitiesSubtotal, 18370.44);
assert.equal(childStructurePreview.normalized.statementParseMeta.cashPlusEquitiesReconciles, true);
assert.equal(childStructurePreview.normalized.accounts[0].displayName, 'Account 1');
assert.notEqual(
  childStructurePreview.normalized.accounts[0].displayName,
  childStructureParsed.preamble.accountLabel
);
assert.match(childStructureParsed.preamble.accountLabel, /Synthetic M1 Joint Brokerage Account/i);
assert.notEqual(
  childStructurePreview.normalized.accounts[0].sourceAccountKey,
  childStructureParsed.preamble.maskedAccountNumber
);

const syna = preview.normalized.holdings.find((row) => row.ticker === 'SYNA');
assert.equal(syna.shares, 57.65199);
assert.equal(syna.price, 100);
assert.equal(syna.marketValue, 5765.2);
assert.equal(syna.providerCostBasis, 2000);
assert.equal(syna.costBasisQuality, 'PROVIDER_AGGREGATE');
assert.equal(syna.unrealizedGainLoss, 3765.2);
assert.ok(syna.replayKey);

const synb = preview.normalized.holdings.find((row) => row.ticker === 'SYNB');
assert.equal(synb.unrealizedGainLoss, -91.09);

// --- Security identity ---
preview.normalized.securities.forEach((security) => {
  assert.notEqual(security.sourceSecurityKey, security.ticker);
  assert.match(security.sourceSecurityKey, /^M1\|/);
  assert.equal(context.investmentPortfolioValidateUnifiedSecurityIdentity_(security).ok, true);
});

// --- Cash and totals are not holdings ---
assert.ok(!preview.normalized.holdings.some((row) => /^(Cash|Total)$/i.test(row.ticker)));
assert.ok(!preview.normalized.securities.some((row) => row.ticker === 'Cash'));

// --- No tax lots or distributions invented ---
assert.equal(preview.normalized.taxLots.length, 0);
assert.equal(preview.normalized.distributions.length, 0);
assert.equal(preview.normalized.activities.length, 0);
assert.ok(preview.normalized.warnings.some((text) => /dividend rollups/i.test(text)));

// --- Readiness ---
assert.equal(preview.normalized.recommendationReadiness.trustedForHoldingsVisibility, true);
assert.equal(preview.normalized.recommendationReadiness.trustedForIncomeAnalysis, false);
assert.equal(preview.normalized.recommendationReadiness.trustedForTaxLotSalePlanning, false);

// --- Account metadata required ---
assert.equal(context.investmentAdapterPreviewM1StatementPdf_({
  source: 'M1_STATEMENT_PDF',
  rawStatementText: statementFixture,
  accountMeta: { registrationType: 'TAXABLE', explicitAccountMatch: true }
}).ok, false);
assert.equal(context.investmentAdapterPreviewM1StatementPdf_({
  source: 'M1_STATEMENT_PDF',
  rawStatementText: statementFixture,
  accountMeta: { stableAccountId: 'INV-M1-SYNTH-1', registrationType: 'TAXABLE' }
}).ok, false);
assert.equal(context.investmentAdapterPreviewM1StatementPdf_({
  source: 'M1_STATEMENT_PDF',
  rawStatementText: statementFixture,
  accountMeta
}).normalized.recommendationReadiness.trustedForHoldingsVisibility, true);

const withoutExplicit = context.investmentAdapterPreviewM1StatementPdf_({
  source: 'M1_STATEMENT_PDF',
  rawStatementText: statementFixture,
  accountMeta: {
    stableAccountId: 'INV-M1-SYNTH-1',
    registrationType: 'TAXABLE',
    accountName: 'Synthetic M1 Taxable'
  }
});
assert.equal(withoutExplicit.ok, false);

// --- No duplicate holdings ---
assert.equal(
  preview.normalized.holdings.length,
  new Set(preview.normalized.holdings.map((row) =>
    `${row.stableAccountId}|${row.stableSecurityId}`)).size
);

// --- Stable replay key ---
const replayAgain = context.investmentAdapterPreviewM1StatementPdf_({
  source: 'M1_STATEMENT_PDF',
  rawStatementText: statementFixture,
  accountMeta
});
assert.deepEqual(
  preview.normalized.holdings.map((row) => row.replayKey).sort(),
  replayAgain.normalized.holdings.map((row) => row.replayKey).sort()
);

// --- Safety ---
assert.doesNotMatch(m1Source, /SpreadsheetApp|setValues|appendRow/);
assert.doesNotMatch(m1Source, /PropertiesService|CacheService|DriveApp|Logger\.log/);
assert.doesNotMatch(adaptersSource, /investmentPortfolioEnsure/);

console.log('M1 Statement PDF regressions passed.');
