import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (name) => read(`test/fixtures/schwab/${name}`);

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
vm.runInContext(read('investment_etrade_client_statement_pdf.js'), context, {
  filename: 'investment_etrade_client_statement_pdf.js'
});
vm.runInContext(read('investment_m1_statement_pdf.js'), context, {
  filename: 'investment_m1_statement_pdf.js'
});
vm.runInContext(read('investment_fidelity_401k_statement_pdf.js'), context, {
  filename: 'investment_fidelity_401k_statement_pdf.js'
});
vm.runInContext(read('investment_schwab_brokerage_statement_pdf.js'), context, {
  filename: 'investment_schwab_brokerage_statement_pdf.js'
});
vm.runInContext(read('investment_stash_brokerage_statement_pdf.js'), context, {
  filename: 'investment_stash_brokerage_statement_pdf.js'
});
vm.runInContext(read('investment_adapters.js'), context, { filename: 'investment_adapters.js' });
vm.runInContext(read('central_holdings_preview_lab.js'), context, {
  filename: 'central_holdings_preview_lab.js'
});
vm.runInContext(read('bounded_holdings_preview.js'), context, {
  filename: 'bounded_holdings_preview.js'
});
vm.runInContext(read('bounded_holdings_preview_identity.js'), context, {
  filename: 'bounded_holdings_preview_identity.js'
});
vm.runInContext(read('bounded_holdings_preview_pdf_client.js'), context, {
  filename: 'bounded_holdings_preview_pdf_client.js'
});
vm.runInContext(read('bounded_holdings_preview_apply_sheet.js'), context, {
  filename: 'bounded_holdings_preview_apply_sheet.js'
});
vm.runInContext(read('bounded_holdings_preview_apply_diff.js'), context, {
  filename: 'bounded_holdings_preview_apply_diff.js'
});
vm.runInContext(read('bounded_holdings_preview_apply.js'), context, {
  filename: 'bounded_holdings_preview_apply.js'
});
vm.runInContext(
  extractFunction(read('investment_portfolio_drawer.js'), 'investmentPortfolioDrawerSupportedImportFormats_'),
  context,
  { filename: 'investment_portfolio_drawer_partial.js' }
);

const statementFixture = fixture('synthetic_schwab_brokerage_statement_minimal.txt');
const reconFailFixture = fixture('synthetic_schwab_brokerage_statement_reconciliation_fail.txt');
const m1Fixture = read('test/fixtures/m1/synthetic_m1_statement_minimal.txt');
const etradeFixture = read('test/fixtures/etrade/synthetic_etrade_client_statement_main.txt');
const drawerSource = read('investment_portfolio_drawer.js');
const drawerSchwabSource = read('Dashboard_Script_InvestmentPortfolioDrawerSchwab.html');
const dashboardBody = read('Dashboard_Body.html');
const dashboardInvestments = read('Dashboard_Script_AssetsBankInvestments.html');
const plannerWeb = read('PlannerDashboardWeb.html');
const parserSource = read('investment_schwab_brokerage_statement_pdf.js');

const accountMeta = {
  stableAccountId: 'STABLE-SCHWAB-SYNTH-1',
  registrationType: 'TAXABLE',
  accountName: 'Charles Schwab - Personal',
  explicitAccountMatch: true,
  investmentId: 'INV-SCHWAB-SYNTH-1'
};

const identity = {
  stableAccountId: accountMeta.stableAccountId,
  registrationType: 'TAXABLE',
  accountName: accountMeta.accountName,
  explicitAccountMatch: true
};

assert.ok(context.listInvestmentAdapterSources_().includes('SCHWAB_BROKERAGE_STATEMENT_PDF'));
assert.equal(
  context.investmentPortfolioNormalizeSource_('schwab_brokerage_statement_pdf'),
  'SCHWAB_BROKERAGE_STATEMENT_PDF'
);
assert.equal(
  context.getInvestmentAdapter_('SCHWAB_BROKERAGE_STATEMENT_PDF').source,
  'SCHWAB_BROKERAGE_STATEMENT_PDF'
);
assert.doesNotMatch(parserSource, /\bsetValues\b|\bappendRow\b|\bgetUserSpreadsheet_\b/);
assert.doesNotMatch(drawerSchwabSource, /\bsetValues\b|\bappendRow\b/);
assert.doesNotMatch(drawerSchwabSource, /INPUT - Investments|SYS - Investment Holdings(?! Unified)/);
assert.match(drawerSchwabSource, /SYS - Investment Holdings Unified/);
assert.match(drawerSchwabSource, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(drawerSchwabSource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerSchwabSource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.doesNotMatch(drawerSchwabSource, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.doesNotMatch(drawerSchwabSource, /res\.preview\s*\|\|/);
assert.doesNotMatch(drawerSchwabSource, /bundle\.diffPreview/);
assert.match(drawerSchwabSource, /lastSinglePreview = res;/);
assert.match(drawerSchwabSource, /Monthly investment value/);
assert.doesNotMatch(drawerSchwabSource, /Replace the existing monthly value|explicitMonthlyValueReplace/);
assert.match(plannerWeb, /Dashboard_Script_InvestmentPortfolioDrawerSchwab/);
assert.match(dashboardBody, /inv_portfolio_schwab_import_view/);
assert.match(dashboardBody, /Import Schwab statement PDF/);
assert.match(dashboardInvestments, /schwabImportAvailable/);
assert.match(drawerSource, /schwabImportAvailable/);
assert.match(drawerSource, /SCHWAB_BROKERAGE_STATEMENT_PDF/);
assert.doesNotMatch(drawerSource, /SCHWAB_CSV \(future\)/);

const schwabDetect = context.investmentSchwabDetectBrokerageStatementPdf_({
  rawStatementText: statementFixture
});
assert.equal(schwabDetect.ok, true, schwabDetect.reason || 'Schwab detect failed');
assert.equal(schwabDetect.source, 'SCHWAB_BROKERAGE_STATEMENT_PDF');

const m1Rejected = context.investmentSchwabDetectBrokerageStatementPdf_({
  rawStatementText: m1Fixture
});
assert.equal(m1Rejected.ok, false);
assert.match(m1Rejected.reason, /M1 brokerage statement/i);

const etradeRejected = context.investmentSchwabDetectBrokerageStatementPdf_({
  rawStatementText: etradeFixture
});
assert.equal(etradeRejected.ok, false);
assert.match(etradeRejected.reason, /E\*TRADE/i);

const schwabNotM1 = context.investmentM1DetectStatementPdf_({
  rawStatementText: statementFixture
});
assert.equal(schwabNotM1.ok, false);
assert.match(schwabNotM1.reason, /Schwab brokerage statement/i);

assert.equal(context.boundedHoldingsPreviewLooksLikeM1StatementPdf_(statementFixture), false);
assert.equal(context.boundedHoldingsPreviewLooksLikeSchwabBrokerageStatementPdf_(statementFixture), true);
assert.equal(
  context.boundedHoldingsPreviewShouldUseM1PdfLoadPath_(
    { source: 'SCHWAB_BROKERAGE_STATEMENT_PDF', accountProvider: 'SCHWAB' },
    statementFixture
  ),
  false
);

const parsed = context.investmentSchwabParseBrokerageStatementPdfText_(statementFixture);
assert.equal(parsed.ok, true, parsed.error || 'parse failed');
assert.equal(parsed.preamble.statementPeriodEnd, '07/31/2026');
assert.equal(parsed.preamble.accountValue, 13000);
assert.equal(parsed.preamble.cashBalance, 0);
assert.equal(parsed.holdings.length, 5);
const bySymbol = Object.fromEntries(parsed.holdings.map((row) => [row.symbol, row]));
assert.equal(bySymbol.CSCO.quantity, 100);
assert.equal(bySymbol.CSCO.price, 50);
assert.equal(bySymbol.CSCO.marketValue, 5000);
assert.equal(bySymbol.DIS.quantity, 20);
assert.equal(bySymbol.DIS.marketValue, 2000);
assert.equal(bySymbol.DXC.quantity, 50);
assert.equal(bySymbol.DXC.marketValue, 1000);
assert.equal(bySymbol.INTC.quantity, 40);
assert.equal(bySymbol.INTC.marketValue, 1000);
assert.equal(bySymbol.MSFT.quantity, 10);
assert.equal(bySymbol.MSFT.marketValue, 4000);
assert.equal(parsed.holdings.some((row) => row.symbol === 'PRIV'), false);
assert.equal(parsed.reconciliation.ok, true);

const unpriced = parsed.excluded.filter((row) => row.reason === 'UNPRICED_SECURITY');
assert.equal(unpriced.length, 1);
assert.equal(unpriced[0].symbol, 'PRIV');
assert.equal(unpriced[0].quantity, 25);
assert.equal(unpriced[0].price, null);
assert.equal(unpriced[0].marketValue, null);
assert.notEqual(unpriced[0].price, 0);
assert.notEqual(unpriced[0].marketValue, 0);
assert.equal(context.investmentSchwabParseOptionalMoney_(''), null);
assert.equal(context.investmentSchwabParseOptionalMoney_('N/A'), null);
assert.equal(context.investmentSchwabParseOptionalMoney_('$0.00'), 0);

assert.equal(parsed.holdings.some((row) => /Bought|Sold/i.test(row.description || '')), false);

const spaceJoinedFixture = fixture('synthetic_schwab_brokerage_statement_pdfjs_space_joined.txt');
assert.equal(context.investmentSchwabHasPipeHoldingsLayout_(statementFixture), true);
assert.equal(context.investmentSchwabHasPipeHoldingsLayout_(spaceJoinedFixture), false);
assert.equal(context.investmentSchwabLooksLikeBrokerageStatementPdf_(spaceJoinedFixture), true);

const spaceParsed = context.investmentSchwabParseBrokerageStatementPdfText_(spaceJoinedFixture);
assert.equal(spaceParsed.ok, true, spaceParsed.error || 'space-joined parse failed');
assert.equal(spaceParsed.preamble.statementPeriodEnd, '07/31/2026');
assert.equal(spaceParsed.preamble.accountValue, 47778.84);
assert.notEqual(spaceParsed.preamble.accountValue, 44677.09);
assert.equal(spaceParsed.preamble.cashBalance, 0);
assert.equal(spaceParsed.holdings.length, 5);
const spaceBySymbol = Object.fromEntries(spaceParsed.holdings.map((row) => [row.symbol, row]));
assert.equal(spaceBySymbol.CSCO.quantity, 3.5863);
assert.equal(spaceBySymbol.CSCO.price, 115.99);
assert.equal(spaceBySymbol.CSCO.marketValue, 415.97);
assert.equal(spaceBySymbol.CSCO.providerCostBasis, 120.17);
assert.equal(spaceBySymbol.CSCO.unrealizedGainLoss, 295.8);
assert.match(spaceBySymbol.CSCO.description, /CISCO/i);
assert.equal(spaceBySymbol.DIS.quantity, 32.0537);
assert.equal(spaceBySymbol.DIS.price, 96.19);
assert.equal(spaceBySymbol.DIS.marketValue, 3083.25);
assert.equal(spaceBySymbol.DIS.providerCostBasis, 1503.11);
assert.equal(spaceBySymbol.DIS.unrealizedGainLoss, 1580.14);
assert.equal(spaceBySymbol.DXC.quantity, 24.1784);
assert.equal(spaceBySymbol.DXC.price, 11.24);
assert.equal(spaceBySymbol.DXC.marketValue, 271.77);
assert.equal(spaceBySymbol.DXC.providerCostBasis, 739.03);
assert.equal(spaceBySymbol.DXC.unrealizedGainLoss, -467.26);
assert.equal(spaceBySymbol.INTC.quantity, 84.1594);
assert.equal(spaceBySymbol.INTC.price, 90.2);
assert.equal(spaceBySymbol.INTC.marketValue, 7591.18);
assert.equal(spaceBySymbol.INTC.providerCostBasis, 2156.46);
assert.equal(spaceBySymbol.INTC.unrealizedGainLoss, 5434.72);
assert.equal(spaceBySymbol.MSFT.quantity, 78.3626);
assert.equal(spaceBySymbol.MSFT.price, 464.72);
assert.equal(spaceBySymbol.MSFT.marketValue, 36416.67);
assert.equal(spaceBySymbol.MSFT.providerCostBasis, 5156.42);
assert.equal(spaceBySymbol.MSFT.unrealizedGainLoss, 31260.25);
assert.equal(spaceParsed.holdings.filter((row) => row.symbol === 'CSCO').length, 1);
assert.equal(spaceParsed.reconciliation.ok, true);
assert.equal(spaceParsed.reconciliation.endingTotalValue, 47778.84);

const spaceUnpriced = spaceParsed.excluded.filter((row) => row.reason === 'UNPRICED_SECURITY');
assert.equal(spaceUnpriced.length, 1);
assert.match(spaceUnpriced[0].description, /TIANREN|ORGANC/i);
assert.equal(spaceUnpriced[0].quantity, 12);
assert.equal(spaceUnpriced[0].providerCostBasis, 3);
assert.equal(spaceUnpriced[0].price, null);
assert.equal(spaceUnpriced[0].marketValue, null);
assert.notEqual(spaceUnpriced[0].price, 0);
assert.notEqual(spaceUnpriced[0].marketValue, 0);
assert.equal(spaceParsed.holdings.some((row) => /TIANREN|ORGANC/i.test(row.description || '')), false);
assert.equal(spaceParsed.holdings.some((row) => /Bought|Sold|Buy|Sell/i.test(row.description || '')), false);

const spacePreview = context.investmentAdapterPreviewSchwabBrokerageStatementPdf_({
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  rawStatementText: spaceJoinedFixture,
  explicitAccountMatch: true,
  accountMeta
});
assert.equal(spacePreview.ok, true, spacePreview.error || 'space-joined preview failed');
assert.equal(spacePreview.normalized.holdings.length, 5);
assert.equal(spacePreview.normalized.activities.length, 0);
assert.equal(spacePreview.normalized.taxLots.length, 0);
assert.equal(spacePreview.normalized.asOf, '2026-07-31T00:00:00.000Z');
assert.equal(spacePreview.normalized.statementParseMeta.endingTotalValue, 47778.84);
assert.equal(spacePreview.normalized.recommendationReadiness.trustedForHoldingsVisibility, true);
assert.equal(
  context.investmentPortfolioValidateUnifiedHoldingsPreview_(spacePreview.normalized).ok,
  true
);

const spaceLab = context.holdingsPreviewLabBuildPreview_({
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  rawDocumentText: spaceJoinedFixture,
  ...identity
});
assert.equal(spaceLab.ok, true, spaceLab.error || 'space-joined lab preview failed');
assert.equal(spaceLab.holdingsRows.length, 5);
assert.equal(spaceLab.holdingsRows.some((row) => row.symbol === 'PRIV'), false);
assert.equal(spaceLab.holdingsRows.some((row) => /TIANREN|ORGANC/i.test(row.description || '')), false);
assert.equal(spaceLab.unsupportedRows.length, 1);
assert.equal(spaceLab.unsupportedRows[0].reason, 'UNPRICED_SECURITY');
assert.equal(spaceLab.unsupportedRows[0].price, null);
assert.equal(spaceLab.unsupportedRows[0].marketValue, null);
assert.notEqual(spaceLab.unsupportedRows[0].price, 0);
assert.notEqual(spaceLab.unsupportedRows[0].marketValue, 0);
assert.equal(spaceLab.activities ? spaceLab.activities.length : 0, 0);
assert.equal(spaceLab.readiness.trustedForHoldingsVisibility, true);

const preview = context.investmentAdapterPreviewSchwabBrokerageStatementPdf_({
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  rawStatementText: statementFixture,
  explicitAccountMatch: true,
  accountMeta
});
assert.equal(preview.ok, true, preview.error || 'preview failed');
assert.equal(preview.source, 'SCHWAB_BROKERAGE_STATEMENT_PDF');
assert.equal(preview.normalized.holdings.length, 5);
assert.equal(preview.normalized.activities.length, 0);
assert.equal(preview.normalized.taxLots.length, 0);
assert.equal(preview.normalized.realizedGainLoss.length, 0);
assert.equal(
  preview.normalized.recommendationReadiness.trustedForHoldingsVisibility,
  true
);
assert.ok(preview.normalized.warnings.some((row) => /Unpriced securities are excluded/i.test(row)));
assert.equal(
  context.investmentPortfolioValidateUnifiedHoldingsPreview_(preview.normalized).ok,
  true
);

const unpricedHoldingShape = {
  stableAccountId: 'STABLE-SCHWAB-SYNTH-1',
  stableSecurityId: 'SEC-UNPRICED',
  ticker: 'PRIV',
  shares: 25,
  price: null,
  marketValue: null,
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  authority: 'PROVIDER_REPORTED'
};
const unpricedValidation = context.investmentPortfolioValidateUnifiedHoldingRow_(unpricedHoldingShape);
assert.equal(unpricedValidation.ok, false);
assert.ok(unpricedValidation.errors.includes('marketValueOrPrice'));

const labPreview = context.holdingsPreviewLabBuildPreview_({
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  rawDocumentText: statementFixture,
  ...identity
});
assert.equal(labPreview.ok, true, labPreview.error || 'lab preview failed');
assert.equal(labPreview.provider, 'SCHWAB');
assert.equal(labPreview.holdingsRows.length, 5);
assert.equal(labPreview.holdingsRows.some((row) => row.symbol === 'PRIV'), false);
assert.equal(labPreview.unsupportedRows.length, 1);
assert.equal(labPreview.unsupportedRows[0].reason, 'UNPRICED_SECURITY');
assert.equal(labPreview.unsupportedRows[0].price, null);
assert.equal(labPreview.unsupportedRows[0].marketValue, null);
assert.equal(labPreview.readiness.trustedForHoldingsVisibility, true);
assert.ok(labPreview.warnings.some((row) => /Unpriced securities are excluded/i.test(row)));

const proposed = context.boundedHoldingsPreviewApplyBuildProposedRowsFromPreview_({
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  provider: 'SCHWAB',
  parentAccountName: accountMeta.accountName,
  investmentId: accountMeta.investmentId,
  documentFingerprint: 'synth'
}, labPreview);
assert.equal(proposed.some((row) => row.symbol === 'PRIV'), false);
assert.equal(proposed.filter((row) => row.symbol === 'CSCO').length, 1);
assert.equal(proposed.filter((row) => row.symbol === 'DIS').length, 1);
assert.equal(proposed.filter((row) => row.symbol === 'DXC').length, 1);
assert.equal(proposed.filter((row) => row.symbol === 'INTC').length, 1);
assert.equal(proposed.filter((row) => row.symbol === 'MSFT').length, 1);
assert.equal(
  context.boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(labPreview).ok,
  true
);

const failedPreview = context.holdingsPreviewLabBuildPreview_({
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  rawDocumentText: reconFailFixture,
  ...identity
});
assert.equal(failedPreview.ok, true, failedPreview.error || 'failed recon preview');
assert.equal(failedPreview.readiness.trustedForHoldingsVisibility, false);
assert.ok(failedPreview.readiness.blockingReasons.includes('RECONCILIATION_FAILED'));
const blockedApply = context.boundedHoldingsPreviewApplyRejectReviewRequiredPreview_(failedPreview);
assert.equal(blockedApply.ok, false);
assert.match(blockedApply.error, /not trusted for Apply/i);
assert.equal(
  context.boundedHoldingsPreviewApplyBuildProposedRowsFromPreview_({
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    provider: 'SCHWAB',
    parentAccountName: accountMeta.accountName,
    investmentId: accountMeta.investmentId
  }, failedPreview).some((row) => row.symbol === 'PRIV'),
  false
);

const missingTotalText = statementFixture.replace(/Account Value: \$13,000\.00\n/, '');
const missingTotalPreview = context.investmentAdapterPreviewSchwabBrokerageStatementPdf_({
  source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
  rawStatementText: missingTotalText,
  explicitAccountMatch: true,
  accountMeta
});
assert.equal(missingTotalPreview.ok, true);
assert.equal(
  missingTotalPreview.normalized.recommendationReadiness.trustedForHoldingsVisibility,
  false
);
assert.equal(
  missingTotalPreview.normalized.statementParseMeta.reconciliation.blockingReason,
  'MISSING_STATEMENT_TOTAL'
);
assert.equal(missingTotalPreview.normalized.statementParseMeta.endingTotalValue, null);
assert.notEqual(missingTotalPreview.normalized.statementParseMeta.reconciliation.endingTotalValue, 0);

const zeroTotalText = statementFixture.replace('Account Value: $13,000.00', 'Account Value: $0.00');
context.getCurrentYear_ = function() { return 2026; };
context.getInvestmentHistoryValueForMonth_ = function() { return ''; };
const zeroTotalParsed = context.investmentSchwabParseBrokerageStatementPdfText_(zeroTotalText);
assert.equal(zeroTotalParsed.ok, true, zeroTotalParsed.error || 'Schwab $0 parse failed');
assert.equal(zeroTotalParsed.preamble.accountValue, 0);
assert.equal(zeroTotalParsed.reconciliation.endingTotalValue, 0);
const zeroTotalProposal = context.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    accountName: 'Charles Schwab - Personal',
    explicitAccountMatch: true,
    monthlyInvestmentValueDecision: 'ADD'
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Charles Schwab - Personal', investmentId: 'INV-SCHWAB-SYNTH-1' },
  { asOf: '2026-07-31', reconciliation: zeroTotalParsed.reconciliation }
);
assert.equal(zeroTotalProposal.proposedValue, 0);
assert.notEqual(zeroTotalProposal.comparison, 'MISSING');
assert.ok(
  zeroTotalProposal.allowedDecisions.includes('ADD') || zeroTotalProposal.action === 'ADD',
  'Schwab explicit $0 must remain an Add-capable proposal'
);
const missingTotalProposal = context.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'SCHWAB_BROKERAGE_STATEMENT_PDF',
    accountName: 'Charles Schwab - Personal',
    explicitAccountMatch: true,
    monthlyInvestmentValueDecision: 'ADD'
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Charles Schwab - Personal', investmentId: 'INV-SCHWAB-SYNTH-1' },
  {
    asOf: '2026-07-31',
    reconciliation: missingTotalPreview.normalized.statementParseMeta.reconciliation
  }
);
assert.equal(missingTotalProposal.proposedValue, null);
assert.equal(missingTotalProposal.willWrite, false);
assert.ok(!missingTotalProposal.allowedDecisions.includes('ADD'));

const schwabAccount = { accountName: 'Charles Schwab - Personal', statementProvider: 'SCHWAB' };
assert.equal(
  context.boundedHoldingsPreviewInferIdentityProvider_('Charles Schwab - Personal', null),
  'SCHWAB'
);
assert.equal(
  context.boundedHoldingsPreviewDefaultSourceForAccount_(schwabAccount),
  'SCHWAB_BROKERAGE_STATEMENT_PDF'
);
assert.equal(
  context.boundedHoldingsPreviewAllowedSourcesForAccount_(schwabAccount).join(','),
  'SCHWAB_BROKERAGE_STATEMENT_PDF'
);
const wrongSource = context.boundedHoldingsPreviewValidatePreviewSourceForAccount_(
  schwabAccount,
  'M1_STATEMENT_PDF',
  statementFixture
);
assert.equal(wrongSource.ok, false);
assert.match(wrongSource.error, /SCHWAB_BROKERAGE_STATEMENT_PDF/);

assert.equal(
  context.investmentPortfolioDrawerSupportedImportFormats_('SCHWAB', 'SINGLE_ACCOUNT')[0].source,
  'SCHWAB_BROKERAGE_STATEMENT_PDF'
);
assert.equal(
  context.investmentPortfolioDrawerSupportedImportFormats_('SCHWAB', 'SINGLE_ACCOUNT')[0].productionReady,
  true
);

console.log('Schwab brokerage statement PDF regressions passed.');
