import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (name) => read(`test/fixtures/stash/${name}`);

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

const statementFixture = fixture('synthetic_stash_brokerage_statement_minimal.txt');
const spaceJoinedFixture = fixture('synthetic_stash_brokerage_statement_pdfjs_space_joined.txt');
const reconFailFixture = fixture('synthetic_stash_brokerage_statement_reconciliation_fail.txt');
const missingCashFixture = fixture('synthetic_stash_brokerage_statement_missing_cash.txt');
const apexOnlyFixture = fixture('synthetic_apex_clearing_statement_not_stash.txt');
const m1Fixture = read('test/fixtures/m1/synthetic_m1_statement_minimal.txt');
const etradeFixture = read('test/fixtures/etrade/synthetic_etrade_client_statement_main.txt');
const schwabFixture = read('test/fixtures/schwab/synthetic_schwab_brokerage_statement_minimal.txt');
const drawerSource = read('investment_portfolio_drawer.js');
const drawerStashSource = read('Dashboard_Script_InvestmentPortfolioDrawerStash.html');
const dashboardBody = read('Dashboard_Body.html');
const dashboardInvestments = read('Dashboard_Script_AssetsBankInvestments.html');
const plannerWeb = read('PlannerDashboardWeb.html');
const parserSource = read('investment_stash_brokerage_statement_pdf.js');

const accountMeta = {
  stableAccountId: 'STABLE-STASH-SYNTH-1',
  registrationType: 'TAXABLE',
  accountName: 'Stash Brokerage',
  explicitAccountMatch: true,
  investmentId: 'INV-STASH-SYNTH-1'
};

const identity = {
  stableAccountId: accountMeta.stableAccountId,
  registrationType: 'TAXABLE',
  accountName: accountMeta.accountName,
  explicitAccountMatch: true
};

assert.ok(context.listInvestmentAdapterSources_().includes('STASH_BROKERAGE_STATEMENT_PDF'));
assert.equal(
  context.investmentPortfolioNormalizeSource_('stash_brokerage_statement_pdf'),
  'STASH_BROKERAGE_STATEMENT_PDF'
);
assert.equal(
  context.getInvestmentAdapter_('STASH_BROKERAGE_STATEMENT_PDF').source,
  'STASH_BROKERAGE_STATEMENT_PDF'
);
assert.doesNotMatch(parserSource, /\bsetValues\b|\bappendRow\b|\bgetUserSpreadsheet_\b/);
assert.doesNotMatch(drawerStashSource, /\bsetValues\b|\bappendRow\b/);
assert.doesNotMatch(drawerStashSource, /INPUT - Investments|SYS - Investment Holdings(?! Unified)/);
assert.match(drawerStashSource, /SYS - Investment Holdings Unified/);
assert.match(drawerStashSource, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(drawerStashSource, /boundedHoldingsPreviewBuildApplyDiffFromDashboard/);
assert.match(drawerStashSource, /boundedHoldingsPreviewApplyFromDashboard/);
assert.doesNotMatch(drawerStashSource, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.match(drawerStashSource, /Monthly investment value/);
assert.match(drawerStashSource, /monthlyInvestmentValueDecision/);
assert.match(drawerStashSource, /Ignore monthly value/);
assert.match(drawerStashSource, /Keep existing/);
assert.match(drawerStashSource, /Replace with statement value/);
assert.doesNotMatch(drawerStashSource, /explicitMonthlyValueReplace/);
assert.doesNotMatch(drawerStashSource, /This import does not update the monthly investment value/);
assert.match(plannerWeb, /Dashboard_Script_InvestmentPortfolioDrawerStash/);
assert.match(dashboardBody, /inv_portfolio_stash_import_view/);
assert.match(dashboardBody, /Import Stash statement PDF/);
assert.match(dashboardInvestments, /stashImportAvailable/);
assert.match(drawerSource, /stashImportAvailable/);
assert.match(drawerSource, /STASH_BROKERAGE_STATEMENT_PDF/);
assert.doesNotMatch(parserSource, /Positions\s\*\[-–\]\s\*Equities/);

const stashDetect = context.investmentStashDetectBrokerageStatementPdf_({
  rawStatementText: statementFixture
});
assert.equal(stashDetect.ok, true, stashDetect.reason || 'Stash detect failed');
assert.equal(stashDetect.source, 'STASH_BROKERAGE_STATEMENT_PDF');

const apexRejected = context.investmentStashDetectBrokerageStatementPdf_({
  rawStatementText: apexOnlyFixture
});
assert.equal(apexRejected.ok, false);
assert.match(apexRejected.reason, /Stash-branded|does not match a Stash/i);

const m1Rejected = context.investmentStashDetectBrokerageStatementPdf_({
  rawStatementText: m1Fixture
});
assert.equal(m1Rejected.ok, false);

const schwabRejectedByStash = context.investmentStashDetectBrokerageStatementPdf_({
  rawStatementText: schwabFixture
});
assert.equal(schwabRejectedByStash.ok, false);

const etradeRejectedByStash = context.investmentStashDetectBrokerageStatementPdf_({
  rawStatementText: etradeFixture
});
assert.equal(etradeRejectedByStash.ok, false);

const stashRejectedBySchwab = context.investmentSchwabDetectBrokerageStatementPdf_({
  rawStatementText: statementFixture
});
assert.equal(stashRejectedBySchwab.ok, false);
assert.match(stashRejectedBySchwab.reason, /Stash brokerage statement/i);

const stashRejectedByM1 = context.investmentM1DetectStatementPdf_({
  rawStatementText: statementFixture
});
assert.equal(stashRejectedByM1.ok, false);
assert.match(stashRejectedByM1.reason, /Stash brokerage statement/i);

const stashClassifiedEtrade = context.investmentEtradeClientStatementClassifyDocumentType_(statementFixture);
assert.notEqual(stashClassifiedEtrade.documentType, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.notEqual(stashClassifiedEtrade.documentType, 'ETRADE_POSITIONS_PDF');

assert.equal(context.boundedHoldingsPreviewLooksLikeM1StatementPdf_(statementFixture), false);
assert.equal(context.boundedHoldingsPreviewLooksLikeSchwabBrokerageStatementPdf_(statementFixture), false);
assert.equal(context.boundedHoldingsPreviewLooksLikeStashBrokerageStatementPdf_(statementFixture), true);
assert.equal(context.boundedHoldingsPreviewLooksLikeStashBrokerageStatementPdf_(apexOnlyFixture), false);
assert.equal(
  context.boundedHoldingsPreviewShouldUseStandardHoldingsPdfLoadPath_({
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    accountProvider: 'STASH'
  }),
  true
);
assert.equal(
  context.boundedHoldingsPreviewShouldUseM1PdfLoadPath_(
    { source: 'STASH_BROKERAGE_STATEMENT_PDF', accountProvider: 'STASH' },
    statementFixture
  ),
  false
);

function assertSevenEquities(parsed, label) {
  assert.equal(parsed.ok, true, parsed.error || `${label} parse failed`);
  assert.equal(parsed.preamble.statementPeriodEnd, '08/31/2026');
  assert.equal(parsed.preamble.accountValue, 7782.13);
  assert.equal(parsed.preamble.cashBalance, 67.86);
  assert.equal(parsed.holdings.length, 7, `${label} must parse seven equities`);
  const bySymbol = Object.fromEntries(parsed.holdings.map((row) => [row.symbol, row]));
  assert.equal(bySymbol.AIEQ.quantity, 2.6457);
  assert.equal(bySymbol.AIEQ.marketValue, 133.87);
  assert.equal(bySymbol.META.quantity, 0.00019);
  assert.equal(bySymbol.META.price, 572.34);
  assert.equal(bySymbol.META.marketValue, 0.11);
  assert.equal(bySymbol.AOR.quantity, 31.22602);
  assert.equal(bySymbol.AOR.marketValue, 2177.7);
  assert.equal(bySymbol.MSFT.quantity, 0.00029);
  assert.equal(bySymbol.MSFT.marketValue, 0.15);
  assert.equal(bySymbol.ROBO.quantity, 32.17025);
  assert.equal(bySymbol.ROBO.marketValue, 2587.77);
  assert.equal(bySymbol.SCHD.quantity, 76.73389);
  assert.equal(bySymbol.SCHD.marketValue, 2677.25);
  assert.equal(bySymbol.SPYD.quantity, 2.76938);
  assert.equal(bySymbol.SPYD.marketValue, 137.42);
  assert.equal(parsed.holdings.some((row) => row.symbol === 'ISPXZ'), false);
  assert.equal(parsed.holdings.every((row) => row.providerCostBasis === null), true);
  assert.equal(parsed.holdings.every((row) => row.unrealizedGainLoss === null), true);
  assert.equal(parsed.reconciliation.ok, true);
  assert.equal(parsed.reconciliation.endingTotalValue, 7782.13);
  assert.equal(parsed.reconciliation.computedTotal, 7782.13);
  assert.equal(parsed.reconciliation.holdingsMarketValueSum, 7714.27);
  assert.equal(parsed.holdings.some((row) => /Bought|Sold|DIVIDEND|INTEREST/i.test(row.description || '')), false);
}

const parsed = context.investmentStashParseBrokerageStatementPdfText_(statementFixture);
assertSevenEquities(parsed, 'minimal');
assert.equal(parsed.excluded.some((row) => row.symbol === 'ISPXZ' && row.reason === 'CASH_SWEEP'), true);

assert.equal(context.investmentStashLooksLikeBrokerageStatementPdf_(spaceJoinedFixture), true);
const spaceParsed = context.investmentStashParseBrokerageStatementPdfText_(spaceJoinedFixture);
assertSevenEquities(spaceParsed, 'space-joined');
assert.equal(spaceParsed.excluded.some((row) => row.symbol === 'ISPXZ'), true);

const missingCash = context.investmentStashParseBrokerageStatementPdfText_(missingCashFixture);
assert.equal(missingCash.ok, true, missingCash.error || 'missing-cash parse failed');
assert.equal(missingCash.preamble.cashBalance, null);
assert.notEqual(missingCash.preamble.cashBalance, 0);
assert.equal(missingCash.holdings.length, 7);
assert.equal(missingCash.reconciliation.ok, true);
assert.equal(missingCash.reconciliation.endingTotalValue, 7714.27);

const failed = context.investmentStashParseBrokerageStatementPdfText_(reconFailFixture);
assert.equal(failed.ok, true);
assert.equal(failed.reconciliation.ok, false);
assert.equal(failed.reconciliation.endingTotalValue, 9000);
assert.equal(failed.reconciliation.blockingReason, 'UNMODELED_STATEMENT_BALANCE');

const preview = context.investmentAdapterPreviewStashBrokerageStatementPdf_({
  source: 'STASH_BROKERAGE_STATEMENT_PDF',
  rawStatementText: statementFixture,
  explicitAccountMatch: true,
  accountMeta
});
assert.equal(preview.ok, true, preview.error || 'preview failed');
assert.equal(preview.source, 'STASH_BROKERAGE_STATEMENT_PDF');
assert.equal(preview.normalized.holdings.length, 7);
assert.equal(preview.normalized.activities.length, 0);
assert.equal(preview.normalized.taxLots.length, 0);
assert.equal(preview.normalized.realizedGainLoss.length, 0);
assert.equal(preview.normalized.accounts[0].institution, 'Stash');
assert.equal(preview.normalized.accounts[0].sourceAccountKey, 'STABLE-STASH-SYNTH-1');
assert.notEqual(preview.normalized.accounts[0].sourceAccountKey, 'XXXX0000');
assert.equal(preview.normalized.asOf, '2026-08-31T00:00:00.000Z');
assert.equal(preview.normalized.accountSnapshots[0].cashBalance, 67.86);
assert.equal(preview.normalized.accountSnapshots[0].marketValue, 7782.13);
assert.equal(preview.normalized.holdings.some((row) => row.ticker === 'ISPXZ'), false);
assert.equal(preview.normalized.recommendationReadiness.trustedForHoldingsVisibility, true);
assert.equal(
  context.investmentPortfolioValidateUnifiedHoldingsPreview_(preview.normalized).ok,
  true
);

const noMatch = context.investmentAdapterPreviewStashBrokerageStatementPdf_({
  source: 'STASH_BROKERAGE_STATEMENT_PDF',
  rawStatementText: statementFixture,
  explicitAccountMatch: false,
  accountMeta: Object.assign({}, accountMeta, { explicitAccountMatch: false })
});
assert.equal(noMatch.ok, false);
assert.match(noMatch.error, /explicitAccountMatch/);

const lab = context.holdingsPreviewLabBuildPreview_({
  source: 'STASH_BROKERAGE_STATEMENT_PDF',
  rawDocumentText: spaceJoinedFixture,
  ...identity
});
assert.equal(lab.ok, true, lab.error || 'lab preview failed');
assert.equal(lab.provider, 'STASH');
assert.equal(lab.holdingsRows.length, 7);
assert.equal(lab.cashBalance, 67.86);
assert.equal(lab.totalAccountValue, 7782.13);
assert.equal(lab.holdingsRows.some((row) => row.symbol === 'ISPXZ'), false);
assert.equal(lab.unsupportedRows.some((row) => row.symbol === 'ISPXZ'), true);
assert.equal(lab.readiness.trustedForHoldingsVisibility, true);
const labMeta = Object.fromEntries(lab.holdingsRows.map((row) => [row.symbol, row]));
assert.equal(labMeta.META.quantity, 0.00019);
assert.equal(labMeta.MSFT.quantity, 0.00029);
assert.equal(labMeta.ROBO.quantity, 32.17025);
assert.equal(labMeta.AIEQ.costBasis, null);
assert.equal(labMeta.AIEQ.unrealizedGainLoss, null);

const failedPreview = context.holdingsPreviewLabBuildPreview_({
  source: 'STASH_BROKERAGE_STATEMENT_PDF',
  rawDocumentText: reconFailFixture,
  ...identity
});
assert.equal(failedPreview.ok, true);
assert.equal(failedPreview.readiness.trustedForHoldingsVisibility, false);
assert.ok(failedPreview.readiness.blockingReasons.includes('RECONCILIATION_FAILED'));

const missingCashPreview = context.holdingsPreviewLabBuildPreview_({
  source: 'STASH_BROKERAGE_STATEMENT_PDF',
  rawDocumentText: missingCashFixture,
  ...identity
});
assert.equal(missingCashPreview.ok, true);
assert.equal(missingCashPreview.cashBalance, null);
assert.notEqual(missingCashPreview.cashBalance, 0);

const proposed = context.boundedHoldingsPreviewApplyBuildProposedRowsFromPreview_({
  source: 'STASH_BROKERAGE_STATEMENT_PDF',
  provider: 'STASH_BROKERAGE_STATEMENT_PDF',
  parentAccountName: 'Stash Brokerage',
  investmentId: 'INV-STASH-SYNTH-1',
  documentFingerprint: 'FP-STASH-1'
}, lab);
assert.equal(proposed.length, 8);
const cashRow = proposed.find((row) => row.sourceSecurityKey === '__CASH__');
assert.ok(cashRow);
assert.equal(cashRow.symbol, 'Cash');
assert.equal(cashRow.securityName, 'Cash balance');
assert.equal(cashRow.marketValue, 67.86);
assert.equal(cashRow.cashBalance, 67.86);
assert.equal(proposed.some((row) => row.symbol === 'ISPXZ'), false);
assert.equal(proposed.filter((row) => row.sourceSecurityKey !== '__CASH__').length, 7);

assert.equal(
  context.boundedHoldingsPreviewApplyIsMonthlyValueSource_('STASH_BROKERAGE_STATEMENT_PDF'),
  true
);
const trustedEnding = context.boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
  { reconciliation: { ok: true, endingTotalValue: 7782.13 } },
  'STASH_BROKERAGE_STATEMENT_PDF'
);
assert.equal(trustedEnding.value, 7782.13);
assert.equal(trustedEnding.origin, 'RECONCILIATION');
assert.equal(
  context.boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
    { reconciliation: { ok: false, endingTotalValue: 9000 }, totalAccountValue: 9000 },
    'STASH_BROKERAGE_STATEMENT_PDF'
  ).value,
  null,
  'failed Stash reconciliation must not propose a monthly value'
);
assert.equal(
  context.boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
    {
      totalAccountValue: 7782.13,
      cashBalance: 67.86,
      holdingsRows: [
        { marketValue: 1000 },
        { marketValue: 6714.27 }
      ]
    },
    'STASH_BROKERAGE_STATEMENT_PDF'
  ).value,
  null,
  'Stash must not calculate a monthly value from holdings'
);
assert.equal(
  context.boundedHoldingsPreviewApplyResolveProviderEndingTotal_(
    { reconciliation: { ok: true } },
    'STASH_BROKERAGE_STATEMENT_PDF'
  ).value,
  null,
  'missing Stash ending total must not propose a monthly value'
);
context.getCurrentYear_ = function() { return 2026; };
context.getInvestmentHistoryValueForMonth_ = function() { return ''; };
const monthlyBlank = context.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    explicitAccountMatch: true,
    accountName: 'Stash Account'
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Stash Account', investmentId: 'INV-STASH-SYNTH-1' },
  {
    asOf: '2026-08-31',
    reconciliation: { ok: true, endingTotalValue: 7782.13 },
    cashBalance: 67.86
  }
);
assert.equal(monthlyBlank.comparison, 'BLANK');
assert.equal(monthlyBlank.decision, 'IGNORE');
assert.equal(monthlyBlank.action, 'SKIP');
assert.equal(monthlyBlank.proposedValue, 7782.13);
assert.equal(monthlyBlank.willWrite, false);
assert.match(monthlyBlank.message, /August 2026/);
const monthlyAdd = context.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    explicitAccountMatch: true,
    accountName: 'Stash Account',
    monthlyInvestmentValueDecision: 'ADD'
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Stash Account', investmentId: 'INV-STASH-SYNTH-1' },
  { asOf: '2026-08-31', reconciliation: { ok: true, endingTotalValue: 7782.13 } }
);
assert.equal(monthlyAdd.action, 'ADD');
assert.equal(monthlyAdd.willWrite, true);
assert.match(monthlyAdd.message, /Add August 2026 value: \$7,782\.13/);
const monthlyMissingTotal = context.boundedHoldingsPreviewApplyBuildMonthlyInvestmentValueProposal_(
  {
    source: 'STASH_BROKERAGE_STATEMENT_PDF',
    explicitAccountMatch: true,
    accountName: 'Stash Account'
  },
  'SINGLE_ACCOUNT',
  { accountName: 'Stash Account', investmentId: 'INV-STASH-SYNTH-1' },
  { asOf: '2026-08-31', reconciliation: { ok: false, endingTotalValue: 9000 } }
);
assert.equal(monthlyMissingTotal.action, 'SKIP');
assert.equal(monthlyMissingTotal.reason, 'MISSING_ENDING_TOTAL');
assert.equal(monthlyMissingTotal.willWrite, false);

const stashAccount = { accountName: 'Stash Brokerage', statementProvider: 'STASH' };
assert.equal(context.boundedHoldingsPreviewInferIdentityProvider_('Stash Brokerage', null), 'STASH');
assert.equal(
  context.boundedHoldingsPreviewDefaultSourceForAccount_(stashAccount),
  'STASH_BROKERAGE_STATEMENT_PDF'
);
assert.equal(
  context.boundedHoldingsPreviewAllowedSourcesForAccount_(stashAccount).join(','),
  'STASH_BROKERAGE_STATEMENT_PDF'
);
const wrongSource = context.boundedHoldingsPreviewValidatePreviewSourceForAccount_(
  stashAccount,
  'M1_STATEMENT_PDF',
  statementFixture
);
assert.equal(wrongSource.ok, false);
assert.match(wrongSource.error, /STASH_BROKERAGE_STATEMENT_PDF/);
assert.equal(
  context.investmentPortfolioDrawerSupportedImportFormats_('STASH', 'SINGLE_ACCOUNT')[0].source,
  'STASH_BROKERAGE_STATEMENT_PDF'
);
assert.equal(
  context.investmentPortfolioDrawerSupportedImportFormats_('STASH', 'SINGLE_ACCOUNT')[0].productionReady,
  true
);

assert.equal(context.boundedHoldingsPreviewFindIdentityProvider_('STASH').institution, 'Stash');

console.log('Stash brokerage statement PDF regressions passed.');
