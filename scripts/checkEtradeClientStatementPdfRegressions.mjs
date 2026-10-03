import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (name) => read(`test/fixtures/etrade/${name}`);

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

function buildContext() {
  const context = {
    Utilities: utilities,
    Promise, Buffer, Uint8Array, ArrayBuffer, crypto,
    String, Number, Object, Array, Math, isFinite, Error, JSON, console,
    document: { createElement: () => ({ getContext: () => null, width: 0, height: 0 }) }
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
  vm.runInContext(read('investment_schwab_brokerage_statement_pdf.js'), context, {
    filename: 'investment_schwab_brokerage_statement_pdf.js'
  });
  vm.runInContext(read('investment_stash_brokerage_statement_pdf.js'), context, {
    filename: 'investment_stash_brokerage_statement_pdf.js'
  });
  vm.runInContext(read('investment_fidelity_401k_statement_pdf.js'), context, {
    filename: 'investment_fidelity_401k_statement_pdf.js'
  });
  vm.runInContext(read('investment_adapters.js'), context, { filename: 'investment_adapters.js' });
  vm.runInContext(read('bounded_holdings_preview_pdf_client.js'), context, {
    filename: 'bounded_holdings_preview_pdf_client.js'
  });
  return context;
}

const ctx = buildContext();
const mainFixture = fixture('synthetic_etrade_client_statement_main.txt');
const samerBrokerageFixture = fixture('synthetic_etrade_client_statement_samer_brokerage.txt');
const esppFixture = fixture('synthetic_etrade_client_statement_espp.txt');
const futureFixture = fixture('synthetic_etrade_client_statement_cisco_future_potential.txt');
const extractedPotentialSummaryFixture = fixture(
  'extracted_etrade_client_statement_cisco_potential_summary.txt');
const encodingFixture = fixture('synthetic_etrade_client_statement_encoding_failure.txt');
const reconciliationFailFixture = fixture('synthetic_etrade_client_statement_reconciliation_fail.txt');
const centRoundingFixture = fixture('synthetic_etrade_client_statement_reconciliation_cent_rounding.txt');
const twoDollarOneCentFixture = fixture('synthetic_etrade_client_statement_reconciliation_two_dollars_one_cent.txt');
const largeAccountFixture = fixture('synthetic_etrade_client_statement_reconciliation_large_account.txt');
const accruedInterestFixture = fixture('synthetic_etrade_client_statement_reconciliation_accrued_interest.txt');
const positionsFixture = fixture('synthetic_etrade_positions_minimal.txt');
const pdfClientSource = read('bounded_holdings_preview_pdf_client.js');

const baseIdentity = {
  stableAccountId: 'INV-ET-STATEMENT-1',
  accountName: 'Synthetic E*TRADE Main',
  registrationType: 'TAXABLE',
  explicitAccountMatch: true
};

assert.equal(ctx.investmentPortfolioNormalizeSource_('ETRADE_CLIENT_STATEMENT_PDF'),
  'ETRADE_CLIENT_STATEMENT_PDF');
assert.ok(ctx.listInvestmentAdapterSources_().includes('ETRADE_CLIENT_STATEMENT_PDF'));

// --- Encoding failure detection ---
const encodingQuality = ctx.investmentEtradeClientStatementAssessTextQuality_(encodingFixture);
assert.equal(encodingQuality.usable, false);
assert.equal(encodingQuality.quality, 'ENCODING_FAILURE');

const positionsQuality = ctx.investmentEtradeClientStatementAssessTextQuality_(positionsFixture);
assert.equal(positionsQuality.usable, false);

// --- Stable PDF-byte fingerprint survives extraction-method changes ---
const syntheticPdfBytes = Buffer.from('%PDF-1.4 synthetic-etrade-client-statement-fingerprint-fixture');
const byteFingerprint = crypto.createHash('sha256').update(syntheticPdfBytes).digest('hex');
const digestFromClient = await ctx.boundedHoldingsPreviewDigestArrayBuffer_(syntheticPdfBytes);
assert.equal(digestFromClient, byteFingerprint);
const pdfjsFingerprint = ctx.investmentEtradeClientStatementResolveDocumentFingerprint_({
  documentFingerprint: byteFingerprint,
  extractionMeta: { method: 'PDFJS', documentFingerprint: byteFingerprint },
  rawStatementText: mainFixture
});
const ocrFingerprint = ctx.investmentEtradeClientStatementResolveDocumentFingerprint_({
  documentFingerprint: byteFingerprint,
  extractionMeta: { method: 'OCR', documentFingerprint: byteFingerprint },
  rawStatementText: 'different ocr output that must not change replay fingerprint'
});
assert.equal(pdfjsFingerprint, ocrFingerprint);
assert.notEqual(
  ctx.investmentEtradeClientStatementResolveDocumentFingerprint_({ rawStatementText: mainFixture }),
  byteFingerprint
);

// --- Text fingerprint for pasted/text-file extracts ---
const textFingerprintA = ctx.investmentEtradeClientStatementBuildTextFingerprint_(mainFixture);
const textFingerprintB = ctx.investmentEtradeClientStatementBuildTextFingerprint_(mainFixture);
assert.equal(textFingerprintA, textFingerprintB);
assert.equal(
  ctx.investmentEtradeClientStatementResolveDocumentFingerprint_({ rawStatementText: mainFixture }),
  textFingerprintA
);

// --- Main brokerage parse ---
const mainParse = ctx.investmentEtradeClientStatementParseText_(mainFixture);
assert.equal(mainParse.ok, true);
assert.equal(mainParse.accountKind, 'BROKERAGE');
assert.equal(mainParse.holdings.length, 2);
const mainSymbols = mainParse.holdings.map((row) => row.symbol).sort();
assert.deepEqual([...mainSymbols], ['SYNA', 'SYNB']);
assert.equal(mainParse.reconciliation.ok, true);
assert.equal(mainParse.reconciliation.tolerance, 2);
assert.equal(mainParse.reconciliation.rule, 'ABSOLUTE_USD_2.00');
assert.equal(mainParse.preamble.cashBalance, 5000);
assert.equal(mainParse.preamble.cashDebit, 0);
assert.equal(mainParse.reconciliation.cashDebit, 0);
assert.ok(mainParse.excluded.some((row) => row.reason === 'PURCHASES_OR_REINVESTMENT_ROW'));
assert.equal(mainParse.holdings.find((row) => row.symbol === 'SYNA').quantity, 105);

const samerParse = ctx.investmentEtradeClientStatementParseText_(samerBrokerageFixture);
assert.equal(samerParse.ok, true);
assert.equal(samerParse.accountKind, 'BROKERAGE');
assert.match(String(samerParse.preamble.statementPeriodStart || ''), /8\/1\/26/);
assert.match(String(samerParse.preamble.statementPeriodEnd || ''), /8\/31\/26/);
assert.equal(samerParse.preamble.asOfDate, '2026-08-31');
assert.equal(samerParse.preamble.endingTotalValue, 7205);
assert.equal(samerParse.preamble.cashBalance, 5000);
assert.equal(samerParse.preamble.cashDebit, 0);
assert.equal(samerParse.preamble.accruedInterest, 5);
assert.equal(samerParse.holdings.length, 4);
assert.deepEqual([...samerParse.holdings.map((row) => row.symbol).sort()], ['SYNA', 'SYNB', 'VTI', 'ZERO']);
assert.equal(samerParse.holdings.find((row) => row.symbol === 'SYNA').quantity, 105);
assert.equal(samerParse.holdings.find((row) => row.symbol === 'SYNA').marketValue, 1000);
assert.equal(samerParse.holdings.find((row) => row.symbol === 'VTI').marketValue, 200);
assert.equal(samerParse.holdings.find((row) => row.symbol === 'ZERO').quantity, 10);
assert.equal(samerParse.holdings.find((row) => row.symbol === 'ZERO').marketValue, 0);
assert.equal(samerParse.holdings.find((row) => row.symbol === 'ZERO').sharePrice, 0);
assert.ok(!isFinite(ctx.investmentEtradeClientStatementSafeParseMoney_('')));
assert.equal(ctx.investmentEtradeClientStatementSafeParseMoney_('$0.00'), 0);
assert.equal(ctx.investmentEtradeClientStatementSafeParseMoney_('0'), 0);
assert.ok(samerParse.excluded.some((row) => row.reason === 'PURCHASES_OR_REINVESTMENT_ROW' && row.symbol === 'SYNA'));
assert.equal(samerParse.reconciliation.ok, true);
assert.equal(samerParse.reconciliation.endingTotalValue, 7205);
assert.equal(samerParse.potentialUnvestedStockPlan.value, null);
assert.doesNotMatch(samerBrokerageFixture, /273-530203-203/);
assert.doesNotMatch(samerBrokerageFixture, /Samer L Theodossy/i);

const samerValid = ctx.investmentEtradeValidateSamerBrokerageStatement_(samerParse);
assert.equal(samerValid.ok, true);
assert.equal(samerValid.accountName, 'Samer Etrade Account');
assert.equal(samerValid.asOf, '2026-08-31');
assert.equal(samerValid.ending, 7205);
assert.equal(samerValid.valueCategory, 'BROKERAGE_ACCOUNT_VALUE');

const missingPeriodParse = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(/^Statement period:.*$/m, 'Account number: XXXX-BROKERAGE-001'));
assert.equal(ctx.investmentEtradeValidateSamerBrokerageStatement_(missingPeriodParse).ok, false);
assert.match(String(ctx.investmentEtradeValidateSamerBrokerageStatement_(missingPeriodParse).error || ''),
  /Statement period is missing or invalid/);

const mismatchedPeriod = Object.assign({}, samerParse, {
  preamble: Object.assign({}, samerParse.preamble, { statementPeriodEnd: '7/31/26' })
});
assert.equal(ctx.investmentEtradeValidateSamerBrokerageStatement_(mismatchedPeriod).ok, false);
assert.match(String(ctx.investmentEtradeValidateSamerBrokerageStatement_(mismatchedPeriod).error || ''),
  /do not match/);

const gluedSamerFixture = fixture('extracted_etrade_client_statement_samer_glued_pdfjs.txt');
assert.doesNotMatch(gluedSamerFixture, /Statement period:/i);
assert.match(gluedSamerFixture, /For the Period August 1-31, 2026/);
assert.match(gluedSamerFixture, /CASH, BANK DEPOSIT PROGRAM AND MONEY MARKET FUNDS \$5,000\.00/);
assert.doesNotMatch(gluedSamerFixture, /273-530203-203/);
assert.doesNotMatch(gluedSamerFixture, /Samer L Theodossy/i);

const gluedSamerParse = ctx.investmentEtradeClientStatementParseText_(gluedSamerFixture);
assert.equal(gluedSamerParse.ok, true, gluedSamerParse.error || 'glued Samer extract parse failed');
assert.equal(gluedSamerParse.accountKind, 'BROKERAGE');
assert.equal(
  ctx.investmentEtradeClientStatementNormalizeStatementDate_(gluedSamerParse.preamble.statementPeriodStart),
  '2026-08-01'
);
assert.equal(
  ctx.investmentEtradeClientStatementNormalizeStatementDate_(gluedSamerParse.preamble.statementPeriodEnd),
  '2026-08-31'
);
assert.equal(gluedSamerParse.preamble.asOfDate, '2026-08-31');
assert.equal(gluedSamerParse.preamble.endingTotalValue, 7205);
assert.equal(gluedSamerParse.preamble.cashBalance, 5000);
assert.equal(gluedSamerParse.preamble.cashDebit, 0);
assert.equal(gluedSamerParse.preamble.accruedInterest, 5);
assert.equal(gluedSamerParse.holdings.length, 4);
assert.deepEqual(
  [...gluedSamerParse.holdings.map((row) => row.symbol).sort()],
  ['SYNA', 'SYNB', 'VTI', 'ZERO']
);
assert.equal(gluedSamerParse.holdings.find((row) => row.symbol === 'SYNA').quantity, 105);
assert.equal(gluedSamerParse.holdings.find((row) => row.symbol === 'SYNA').marketValue, 1000);
assert.equal(gluedSamerParse.holdings.find((row) => row.symbol === 'VTI').marketValue, 200);
assert.equal(gluedSamerParse.holdings.find((row) => row.symbol === 'ZERO').quantity, 10);
assert.equal(gluedSamerParse.holdings.find((row) => row.symbol === 'ZERO').marketValue, 0);
assert.ok(gluedSamerParse.excluded.some((row) => row.reason === 'PURCHASES_OR_REINVESTMENT_ROW' && row.symbol === 'SYNA'));
assert.equal(
  gluedSamerParse.holdings.filter((row) => row.symbol === 'SYNA').length,
  1,
  'Purchases/Reinvestment continuation must not duplicate SYNA'
);
assert.equal(gluedSamerParse.reconciliation.ok, true, gluedSamerParse.reconciliation.blockingReason || 'glued recon failed');
assert.equal(gluedSamerParse.reconciliation.endingTotalValue, 7205);

const gluedSamerValid = ctx.investmentEtradeValidateSamerBrokerageStatement_(gluedSamerParse);
assert.equal(gluedSamerValid.ok, true, gluedSamerValid.error || 'glued Samer validator failed');
assert.equal(gluedSamerValid.accountName, 'Samer Etrade Account');
assert.equal(gluedSamerValid.asOf, '2026-08-31');
assert.equal(gluedSamerValid.ending, 7205);

const gluedSamerAttached = ctx.investmentEtradeAttachSamerBrokeragePreviewContract_(
  {
    ok: true,
    holdingsRows: gluedSamerParse.holdings.map((row) => ({
      symbol: row.symbol,
      quantity: row.quantity,
      marketValue: row.marketValue
    })),
    asOf: gluedSamerParse.preamble.asOfDate
  },
  gluedSamerParse,
  'Samer Etrade Account'
);
assert.equal(gluedSamerAttached.ok, true, gluedSamerAttached.error || 'glued Samer attach failed');
assert.equal(gluedSamerAttached.accountName, 'Samer Etrade Account');
assert.equal(gluedSamerAttached.proposedValue, 7205);
assert.equal(gluedSamerAttached.holdingsRows.length, 4);
assert.equal(gluedSamerAttached.holdingsRows.find((row) => row.symbol === 'ZERO').marketValue, 0);

const wrappedPeriodParse = ctx.investmentEtradeClientStatementParseText_(
  gluedSamerFixture.replace(/For the Period August 1-31, 2026/g, 'For the\nPeriod August 1-31, 2026')
);
assert.equal(
  ctx.investmentEtradeClientStatementNormalizeStatementDate_(wrappedPeriodParse.preamble.statementPeriodEnd),
  '2026-08-31'
);

const gluedDebitParse = ctx.investmentEtradeClientStatementParseText_(
  gluedSamerFixture
    .replace(/Ending Total Value \(as of 8\/31\/26\) \$7,205\.00/g, 'Ending Total Value (as of 8/31/26) $7,105.00')
    .replace(/FUNDS DEBIT \$0\.00/g, 'FUNDS DEBIT $100.00')
    .replace(/Total Account Value \$7,205\.00/g, 'Total Account Value $7,105.00')
);
assert.equal(gluedDebitParse.preamble.cashBalance, 5000);
assert.equal(gluedDebitParse.preamble.cashDebit, 100);
assert.equal(gluedDebitParse.preamble.endingTotalValue, 7105);
assert.equal(gluedDebitParse.reconciliation.ok, true, gluedDebitParse.reconciliation.blockingReason || 'debit recon failed');

const gluedMissingPeriodParse = ctx.investmentEtradeClientStatementParseText_(
  gluedSamerFixture.replace(/For the Period August 1-31, 2026/g, 'CLIENT STATEMENT')
);
assert.equal(String(gluedMissingPeriodParse.preamble.statementPeriodEnd || '').trim(), '');
assert.equal(ctx.investmentEtradeValidateSamerBrokerageStatement_(gluedMissingPeriodParse).ok, false);
assert.match(String(ctx.investmentEtradeValidateSamerBrokerageStatement_(gluedMissingPeriodParse).error || ''),
  /Statement period is missing or invalid/);
const gluedMissingAttached = ctx.investmentEtradeAttachSamerBrokeragePreviewContract_(
  { ok: true, holdingsRows: [{ symbol: 'SYNA' }] },
  gluedMissingPeriodParse,
  'Samer Etrade Account'
);
assert.equal(gluedMissingAttached.ok, false);
assert.equal(gluedMissingAttached.holdingsRows, undefined);

const gluedInvalidPeriodParse = ctx.investmentEtradeClientStatementParseText_(
  gluedSamerFixture.replace(/August 1-31, 2026/g, 'August 1-32, 2026')
);
assert.equal(ctx.investmentEtradeValidateSamerBrokerageStatement_(gluedInvalidPeriodParse).ok, false);
assert.match(String(ctx.investmentEtradeValidateSamerBrokerageStatement_(gluedInvalidPeriodParse).error || ''),
  /Statement period is missing or invalid/);

const noDollarPriceParse = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(
    'Total 105.000 $10.00 $950.00 $1,000.00 $50.00 $100.00 2.00%',
    'Total 105.000 9.5238 $950.00 $1,000.00 $50.00 $100.00 2.00%'
  )
);
assert.equal(noDollarPriceParse.holdings.find((row) => row.symbol === 'SYNA').sharePrice, 9.5238);
assert.equal(noDollarPriceParse.holdings.find((row) => row.symbol === 'SYNA').marketValue, 1000);
assert.equal(noDollarPriceParse.holdings.find((row) => row.symbol === 'SYNA').totalCost, 950);

const missingPriceParse = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(
    'Total 105.000 $10.00 $950.00 $1,000.00 $50.00 $100.00 2.00%',
    'Total 105.000 $950.00 $1,000.00 $50.00'
  )
);
assert.equal(missingPriceParse.holdings.find((row) => row.symbol === 'SYNA').marketValue, 1000);
assert.equal(missingPriceParse.holdings.find((row) => row.symbol === 'SYNA').totalCost, 950);
assert.equal(missingPriceParse.holdings.find((row) => row.symbol === 'SYNA').sharePrice, 9.5238);

const shiftedCostAsPriceParse = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(
    'Total 105.000 $10.00 $950.00 $1,000.00 $50.00 $100.00 2.00%',
    'Total 105.000 $950.00 9.5238 $1,000.00 $50.00'
  )
);
assert.equal(shiftedCostAsPriceParse.holdings.find((row) => row.symbol === 'SYNA'), undefined);
assert.ok(shiftedCostAsPriceParse.excluded.some((row) =>
  row.symbol === 'SYNA' && row.reason === 'MALFORMED_TOTAL_ROW'));

const ambiguousColumnsParse = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(
    'WORTHLESS CORP (ZERO) Total 10.000 $0.00 $100.00 $0.00 -$100.00',
    'WORTHLESS CORP (ZERO) Total 10.000 $0.00 $100.00 $0.00 -$100.00\nAMBIGUOUS CORP (SYNZ) Total 1.000 $5.00 $15.00 $10.00 -$5.00'
  )
);
assert.equal(ambiguousColumnsParse.holdings.find((row) => row.symbol === 'SYNZ'), undefined);
assert.ok(ambiguousColumnsParse.excluded.some((row) =>
  row.symbol === 'SYNZ' && row.reason === 'AMBIGUOUS_HOLDING_COLUMNS'));

const duplicateBetterSecond = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(
    'WORTHLESS CORP (ZERO) Total 10.000 $0.00 $100.00 $0.00 -$100.00',
    'WORTHLESS CORP (ZERO) Total 10.000 $0.00 $100.00 $0.00 -$100.00\nSYNA CORP (SYNA) Total 105.000 9.5238 $950.00 $1,000.00 $50.00'
  )
);
assert.equal(duplicateBetterSecond.holdings.filter((row) => row.symbol === 'SYNA').length, 1);
assert.equal(duplicateBetterSecond.holdings.find((row) => row.symbol === 'SYNA').marketValue, 1000);
assert.ok(duplicateBetterSecond.excluded.some((row) => row.reason === 'DUPLICATE_SYMBOL_TOTAL' && row.symbol === 'SYNA'));

const closingCashParse = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(
    'Total Cash, Bank Deposit Program, and Money Market Funds $5,000.00',
    'CASH, BANK DEPOSIT PROGRAM AND MONEY MARKET FUNDS ($12.34)\nCLOSING CASH, BDP, MMFs $5,000.00 $5,000.00'
  )
);
assert.equal(closingCashParse.preamble.cashBalance, 5000);

const accountDetailFixture = fixture('extracted_etrade_client_statement_samer_account_detail_pdfjs.txt');
assert.doesNotMatch(accountDetailFixture, /273-530203-203/);
assert.doesNotMatch(accountDetailFixture, /Samer L Theodossy/i);
assert.match(accountDetailFixture, /For the Period August 1-31, 2026/);
assert.match(accountDetailFixture, /ARISTA NETWORKS INC \(ANET\)/);
assert.match(accountDetailFixture, /TOTAL VALUE\s+100\.00%/);

const accountDetailParse = ctx.investmentEtradeClientStatementParseText_(accountDetailFixture);
assert.equal(accountDetailParse.ok, true, accountDetailParse.error || 'account-detail parse failed');
const accountDetailSymbols = [
  'AAPL', 'AGG', 'AMC', 'ANET', 'AVGO', 'BAC', 'C', 'CLEUF', 'COST', 'CSOC',
  'ISRG', 'LCID', 'LUMN', 'META', 'NFLX', 'NVDA', 'NXPI', 'PLAY', 'QQQI', 'RIVN',
  'SBUX', 'SOFI', 'SPCX', 'SPY', 'TGT', 'TSLA', 'TWLO', 'UAA', 'UNH', 'WMT',
  'WOOF', 'ZS'
];
assert.deepEqual(
  [...accountDetailParse.holdings.map((row) => row.symbol).sort()],
  accountDetailSymbols
);
assert.equal(
  accountDetailParse.holdings.filter((row) => row.symbol === 'ANET').length,
  1
);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'ANET').quantity, 650);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'ANET').sharePrice, 195.69);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'ANET').marketValue, 127198.50);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'ANET').totalCost, 3023.25);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'CLEUF').marketValue, 0);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'C').marketValue, 105.43);
assert.ok(accountDetailParse.holdings.find((row) => row.symbol === 'C').marketValue > 0);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'AAPL').marketValue, 47756.27);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'AAPL').totalCost, 4616.23);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'COST').marketValue, 38020.83);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'PLAY').marketValue, 365);
assert.ok(Math.abs(accountDetailParse.holdings.find((row) => row.symbol === 'PLAY').sharePrice - (365 / 40.691)) < 0.01);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'NVDA').marketValue, 12828.64);
assert.equal(accountDetailParse.holdings.find((row) => row.symbol === 'SPY').marketValue, 101.25);
const expectedMarkets = {
  AMC: 5.28, AAPL: 47756.27, ANET: 127198.50, BAC: 3799.83, AVGO: 27090.74,
  CSOC: 7.00, CLEUF: 0.00, C: 105.43, COST: 38020.83, PLAY: 365.00,
  ISRG: 1130.58, LCID: 24.25, LUMN: 124.21, META: 40196.01, NFLX: 32420.00,
  NVDA: 12828.64, NXPI: 7059.31, WOOF: 103.74, RIVN: 337.26, SOFI: 1788.00,
  SPCX: 2011.66, SBUX: 8727.06, TGT: 1729.14, TSLA: 25756.50, TWLO: 9425.20,
  UAA: 206.64, UNH: 4441.61, WMT: 7051.04, ZS: 2825.78, AGG: 5.07,
  QQQI: 1104.83, SPY: 101.25
};
accountDetailSymbols.forEach((symbol) => {
  const row = accountDetailParse.holdings.find((holding) => holding.symbol === symbol);
  assert.ok(row, `${symbol} must be parsed once`);
  assert.equal(row.marketValue, expectedMarkets[symbol], `${symbol} market`);
  assert.ok(row.marketValue >= 0, `${symbol} market must not be negative`);
});
assert.ok(accountDetailParse.excluded.some((row) => row.reason === 'SUMMARY_TOTAL_ROW'));
assert.ok(accountDetailParse.excluded.some((row) => row.reason === 'PURCHASES_OR_REINVESTMENT_ROW'));
assert.equal(accountDetailParse.holdings.filter((row) => row.symbol === 'MMF').length, 0);
assert.equal(accountDetailParse.holdings.filter((row) => row.symbol === 'DEBITS').length, 0);
assert.equal(accountDetailParse.holdings.filter((row) => row.symbol === 'CONTINUED').length, 0);
assert.equal(
  accountDetailParse.holdings.filter((row) =>
    accountDetailParse.holdings.filter((other) => other.symbol === row.symbol).length > 1
  ).length,
  0
);
assert.equal(accountDetailParse.preamble.endingTotalValue, 403855.85);
assert.equal(accountDetailParse.preamble.cashBalance, 109.19);
assert.equal(accountDetailParse.reconciliation.ok, true, accountDetailParse.reconciliation.blockingReason || 'account-detail recon failed');
assert.equal(accountDetailParse.reconciliation.unexplainedDifference, 0);

const accountDetailAttached = ctx.investmentEtradeAttachSamerBrokeragePreviewContract_(
  {
    ok: true,
    holdingsRows: accountDetailParse.holdings.map((row) => ({
      symbol: row.symbol,
      quantity: row.quantity,
      price: row.sharePrice,
      marketValue: row.marketValue
    })),
    asOf: accountDetailParse.preamble.asOfDate
  },
  accountDetailParse,
  'Samer Etrade Account'
);
assert.equal(accountDetailAttached.ok, true, accountDetailAttached.error || 'account-detail attach failed');
assert.equal(accountDetailAttached.proposedValue, 403855.85);
assert.equal(accountDetailAttached.holdingsRows.find((row) => row.symbol === 'ANET').marketValue, 127198.50);
assert.ok(accountDetailAttached.holdingsRows.find((row) => row.symbol === 'C').marketValue > 0);

// --- ESPP parse ---
const esppParse = ctx.investmentEtradeClientStatementParseText_(esppFixture);
assert.equal(esppParse.ok, true);
assert.equal(esppParse.accountKind, 'STOCK_PLAN');
assert.equal(esppParse.holdings.length, 1);
assert.equal(esppParse.holdings[0].symbol, 'CSCO');
assert.equal(esppParse.potentialUnvestedStockPlan.value, 3500);
assert.equal(esppParse.potentialUnvestedStockPlan.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(mainParse.potentialUnvestedStockPlan.value, null);

const mapping = ctx.investmentEtradePotentialUnvestedStockPlanMapping_();
assert.equal(mapping.accountName, 'Etrade Cisco - Future');
assert.equal(mapping.source, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(mapping.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(mapping.valueLabel, 'Potential/unvested stock-plan value');
assert.equal(mapping.warning, 'This value is not vested and is not current brokerage holdings.');
assert.equal(ctx.investmentEtradeMatchesPotentialUnvestedStockPlanMapping_('Etrade Cisco - Future'), true);
assert.equal(ctx.investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
  'Etrade Cisco - Future', 'ETRADE_CLIENT_STATEMENT_PDF'), true);
assert.equal(ctx.investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
  'Etrade Cisco - RSU/ESPP', 'ETRADE_CLIENT_STATEMENT_PDF'), false);
assert.equal(ctx.investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
  'Lutfi Etrade Account', 'ETRADE_CLIENT_STATEMENT_PDF'), false);
assert.equal(ctx.investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
  'Samer Etrade Account', 'ETRADE_CLIENT_STATEMENT_PDF'), false);
assert.equal(ctx.investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
  'Future Etrade Cisco', 'ETRADE_CLIENT_STATEMENT_PDF'), false);
assert.equal(ctx.investmentEtradeMatchesPotentialUnvestedStockPlanMapping_(
  'Etrade Cisco - Future', 'ETRADE_POSITIONS_PDF'), false);

const samerMapping = ctx.investmentEtradeSamerBrokerageAccountValueMapping_();
assert.equal(samerMapping.accountName, 'Samer Etrade Account');
assert.equal(samerMapping.source, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(samerMapping.valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
assert.equal(ctx.investmentEtradeMatchesSamerBrokerageAccountValueMapping_('Samer Etrade Account'), true);
assert.equal(ctx.investmentEtradeMatchesSamerBrokerageAccountValueMapping_(
  'Samer Etrade Account', 'ETRADE_CLIENT_STATEMENT_PDF'), true);
assert.equal(ctx.investmentEtradeMatchesSamerBrokerageAccountValueMapping_(
  'Etrade Cisco - Future', 'ETRADE_CLIENT_STATEMENT_PDF'), false);
assert.equal(ctx.investmentEtradeMatchesSamerBrokerageAccountValueMapping_(
  'Etrade Cisco - RSU/ESPP', 'ETRADE_CLIENT_STATEMENT_PDF'), false);
assert.equal(ctx.investmentEtradeMatchesSamerBrokerageAccountValueMapping_(
  'Lutfi Etrade Account', 'ETRADE_CLIENT_STATEMENT_PDF'), false);
assert.equal(ctx.investmentEtradeMatchesSamerBrokerageAccountValueMapping_(
  'Samer L Theodossy', 'ETRADE_CLIENT_STATEMENT_PDF'), false);
assert.equal(ctx.investmentEtradeMatchesSamerBrokerageAccountValueMapping_(
  'Samer Etrade Account', 'ETRADE_POSITIONS_PDF'), false);

const futureParse = ctx.investmentEtradeClientStatementParseText_(futureFixture);
assert.equal(futureParse.ok, true);
assert.equal(futureParse.preamble.endingTotalValue, 113042.10);
assert.match(String(futureParse.preamble.asOfDate || ''), /^2026-08-31/);
assert.equal(futureParse.potentialUnvestedStockPlan.value, 846353.40);
assert.equal(futureParse.potentialUnvestedStockPlan.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(futureParse.holdings.length, 1);
assert.equal(futureParse.holdings[0].symbol, 'CSCO');
assert.equal(futureParse.holdings[0].quantity, 1023.098);
assert.equal(futureParse.reconciliation.ok, true);
assert.notEqual(futureParse.potentialUnvestedStockPlan.value, futureParse.preamble.endingTotalValue);

const futureMonthly = ctx.investmentEtradeNormalizePotentialUnvestedMonthlyPreview_(futureParse);
assert.equal(futureMonthly.ok, true);
assert.equal(futureMonthly.potentialUnvestedStockPlanValue, 846353.40);
assert.equal(futureMonthly.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(futureMonthly.accountName, 'Etrade Cisco - Future');
assert.match(String(futureMonthly.asOf || futureMonthly.asOfDate || ''), /^2026-08-31/);
assert.ok(Array.isArray(futureMonthly.holdingsRows));
assert.equal(futureMonthly.holdingsRows.length, 0);
assert.equal(futureMonthly.cashBalance, null);
assert.equal(futureMonthly.capabilities.holdings, false);
assert.equal(futureMonthly.capabilities.taxLots, false);
assert.equal(futureMonthly.capabilities.activities, false);
assert.equal(futureMonthly.capabilities.dividendHistory, false);
assert.notEqual(futureMonthly.potentialUnvestedStockPlanValue, 113042.10);

const ciscoProfile = ctx.investmentEtradeCiscoStatementImportProfile_();
assert.equal(ciscoProfile.pickerKind, 'STATEMENT_IMPORT_PROFILE');
assert.equal(ciscoProfile.pickerValue, '__profile__:ETRADE_CISCO_STATEMENT');
assert.equal(ciscoProfile.pickerLabel, 'E*TRADE Cisco Statement — RSU/ESPP + Future');
assert.equal(ctx.investmentEtradeMatchesCiscoStatementImportProfile_(ciscoProfile.pickerValue), true);
assert.equal(ctx.investmentEtradeMatchesCiscoStatementImportProfile_('INV-ET-FUTURE-1'), false);
assert.equal(ctx.investmentEtradeCiscoBrokerageAccountValueMapping_().accountName, 'Etrade Cisco - RSU/ESPP');
assert.equal(ctx.investmentEtradeCiscoBrokerageAccountValueMapping_().valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
assert.equal(
  ciscoProfile.legs.map((leg) => `${leg.accountName}:${leg.valueCategory}`).join('|'),
  'Etrade Cisco - RSU/ESPP:BROKERAGE_ACCOUNT_VALUE|Etrade Cisco - Future:POTENTIAL_UNVESTED_STOCK_PLAN'
);

const ciscoPreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(futureParse);
assert.equal(ciscoPreview.ok, true);
assert.equal(ciscoPreview.importProfile, 'ETRADE_CISCO_STATEMENT');
assert.equal(ciscoPreview.endingTotalValue, 113042.10);
assert.equal(ciscoPreview.potentialUnvestedStockPlanValue, 846353.40);
assert.equal(ciscoPreview.monthlyLegs.length, 2);
assert.equal(ciscoPreview.monthlyLegs[0].accountName, 'Etrade Cisco - RSU/ESPP');
assert.equal(ciscoPreview.monthlyLegs[0].proposedValue, 113042.10);
assert.equal(ciscoPreview.monthlyLegs[0].valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
assert.equal(ciscoPreview.monthlyLegs[1].accountName, 'Etrade Cisco - Future');
assert.equal(ciscoPreview.monthlyLegs[1].proposedValue, 846353.40);
assert.equal(ciscoPreview.monthlyLegs[1].valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(ciscoPreview.holdingsRows.length, 0);
assert.equal(ciscoPreview.accountName, undefined);
assert.notEqual(ciscoPreview.pickerLabel, 'Etrade Cisco - RSU/ESPP + Future');

function withEndingAsOf_(source, asOfRaw) {
  return String(source).replace(
    /Ending Total Value \(as of [^)]+\)/i,
    'Ending Total Value (as of ' + asOfRaw + ')'
  );
}

function assertCombinedCiscoAsOf_(source, expectedIso, label) {
  const parsed = ctx.investmentEtradeClientStatementParseText_(source);
  assert.equal(parsed.ok, true, (parsed.error || label) + ' parse failed');
  assert.equal(parsed.preamble.asOfDate, expectedIso, label + ' as-of');
  assert.equal(parsed.preamble.endingTotalValue, 113042.10, label + ' ending total');
  const preview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(parsed);
  assert.equal(preview.ok, true, (preview.error || label) + ' combined preview failed');
  assert.equal(preview.asOf, expectedIso, label + ' preview as-of');
  assert.equal(preview.asOfDate, expectedIso, label + ' preview asOfDate');
  assert.equal(preview.monthlyLegs.length, 2, label + ' both proposals');
  assert.equal(preview.monthlyLegs[0].accountName, 'Etrade Cisco - RSU/ESPP');
  assert.equal(preview.monthlyLegs[0].proposedValue, 113042.10);
  assert.equal(preview.monthlyLegs[0].valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
  assert.equal(preview.monthlyLegs[1].accountName, 'Etrade Cisco - Future');
  assert.equal(preview.monthlyLegs[1].proposedValue, 846353.40);
  assert.equal(preview.monthlyLegs[1].valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
  assert.equal(preview.holdingsRows.length, 0, label + ' no holdings proposal');
}

assert.equal(ctx.investmentEtradeClientStatementNormalizeStatementDate_('8/31/26'), '2026-08-31');
assert.equal(ctx.investmentEtradeClientStatementNormalizeStatementDate_('08/31/26'), '2026-08-31');
assert.equal(ctx.investmentEtradeClientStatementNormalizeStatementDate_('8/31/2026'), '2026-08-31');
assert.equal(ctx.investmentEtradeClientStatementNormalizeStatementDate_('08/31/2026'), '2026-08-31');
assert.equal(ctx.investmentEtradeClientStatementNormalizeStatementDate_('2026-08-31'), '2026-08-31');
assert.equal(ctx.investmentEtradeClientStatementNormalizeStatementDate_('2/31/26'), '');
assert.equal(ctx.investmentEtradeClientStatementNormalizeStatementDate_(''), '');

const extractedTwoDigitAsOf = [
  'E*TRADE Client Statement',
  'Morgan Stanley',
  'Stock Plan Account',
  'Statement period: 8/1/26 to 8/31/26',
  'Beginning Total Value (as of 8/1/26) $110,000.00',
  'Ending Total Value (as of 8/31/26) $113,042.10',
  'Security Description Quantity Share Price Total Cost Market Value Unrealized Gain/Loss',
  'CSCO SYSTEMS INC (CSCO) Purchases 1023.098 $50.00 $40,000.00 $51,154.90 $11,154.90',
  'Total 1023.098 $50.00 $40,000.00 $51,154.90 $11,154.90',
  'Total Cash, Bank Deposit Program, and Money Market Funds $61,887.20',
  'Exercisable Value   Potential Value   Total Value   Percentage',
  'Restricted Stock    —                 $846,353.40  $846,353.40',
  'TOTAL VALUE         —                 $846,353.40  $846,353.40',
  'Potential Restricted Stock',
  'Grant Date 3/15/23 Vest Date 9/15/24 Potential Value $0.00',
  'Activity Summary',
  'CSCO Dividend $12.50'
].join('\n');
assertCombinedCiscoAsOf_(extractedTwoDigitAsOf, '2026-08-31', 'extracted 8/31/26');
assert.notEqual(
  ctx.investmentEtradeClientStatementParseText_(extractedTwoDigitAsOf).preamble.asOfDate,
  '2026-08-01',
  'must not use Beginning Total Value date'
);
assert.notEqual(
  ctx.investmentEtradeClientStatementParseText_(extractedTwoDigitAsOf).preamble.asOfDate,
  '2023-03-15',
  'must not use restricted-stock grant date'
);

['8/31/26', '08/31/26', '8/31/2026', '08/31/2026'].forEach((asOfRaw) => {
  assertCombinedCiscoAsOf_(withEndingAsOf_(futureFixture, asOfRaw), '2026-08-31', asOfRaw);
});

const missingEndingAsOf = futureFixture
  .replace(/Ending Total Value \(as of [^)]+\)/i, 'Ending Total Value') +
  '\nGrant Date 3/15/23 Vest Date 9/15/24\n';
const missingAsOfPreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  ctx.investmentEtradeClientStatementParseText_(missingEndingAsOf));
assert.equal(missingAsOfPreview.ok, false);
assert.match(String(missingAsOfPreview.error || ''), /as-of date is required/i);

const invalidEndingAsOf = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  ctx.investmentEtradeClientStatementParseText_(withEndingAsOf_(futureFixture, '2/31/26')));
assert.equal(invalidEndingAsOf.ok, false);
assert.match(String(invalidEndingAsOf.error || ''), /as-of date is required/i);

const ambiguousEndingAsOf = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  ctx.investmentEtradeClientStatementParseText_(
    futureFixture + '\nEnding Total Value (as of 7/31/26) $113,042.10\n'));
assert.equal(ambiguousEndingAsOf.ok, false);
assert.match(String(ambiguousEndingAsOf.error || ''), /as-of date is required/i);

function assertFutureProposal_(preview, expectedValue, label) {
  const futureLeg = ((preview && preview.monthlyLegs) || []).find((leg) =>
    leg && leg.accountName === 'Etrade Cisco - Future');
  if (expectedValue === null) {
    assert.equal(futureLeg, undefined, label + ' must not propose Future');
    assert.equal(
      ((preview && preview.monthlyLegs) || []).some((leg) =>
        leg && leg.accountName === 'Etrade Cisco - Future' && Number(leg.proposedValue) === 0),
      false,
      label + ' must not propose Future $0.00'
    );
    return;
  }
  assert.ok(futureLeg, label + ' Future proposal missing');
  assert.equal(futureLeg.proposedValue, expectedValue, label + ' Future value');
  assert.equal(futureLeg.valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
  assert.notEqual(futureLeg.proposedValue, 113042.10, label + ' must not reuse brokerage total');
}

const futurePotentialBlock =
  '\nExercisable Value   Potential Value   Total Value   Percentage\nRestricted Stock    —                 $846,353.40  $846,353.40\nTOTAL VALUE         —                 $846,353.40  $846,353.40\n';

const livePotentialParse = ctx.investmentEtradeClientStatementParseText_(
  extractedPotentialSummaryFixture);
assert.doesNotMatch(extractedPotentialSummaryFixture, /Potential Restricted Stock total/i);
assert.match(extractedPotentialSummaryFixture, /Exercisable\s+Value[\s\S]*Potential\s+Value[\s\S]*Total\s+Value/i);
assert.match(extractedPotentialSummaryFixture, /Restricted Stock/);
assert.match(extractedPotentialSummaryFixture, /TOTAL VALUE/);
assert.ok(
  extractedPotentialSummaryFixture.search(/Exercisable\s+Value/i) <
    extractedPotentialSummaryFixture.search(/Potential Restricted Stock/i),
  'summary table must appear before the Potential Restricted Stock grant heading'
);
assert.equal(livePotentialParse.ok, true, livePotentialParse.error || 'live potential parse failed');
assert.equal(livePotentialParse.potentialUnvestedStockPlan.value, 846353.40);
assert.notEqual(livePotentialParse.potentialUnvestedStockPlan.value, 0);
assert.notEqual(livePotentialParse.potentialUnvestedStockPlan.value, 113042.10);
assert.equal(livePotentialParse.preamble.endingTotalValue, 113042.10);
const livePotentialPreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  livePotentialParse);
assert.equal(livePotentialPreview.ok, true, livePotentialPreview.error || 'live potential preview failed');
assert.equal(livePotentialPreview.asOfDate, '2026-08-31');
assert.equal(livePotentialPreview.monthlyLegs.length, 2);
assert.equal(livePotentialPreview.monthlyLegs[0].accountName, 'Etrade Cisco - RSU/ESPP');
assert.equal(livePotentialPreview.monthlyLegs[0].proposedValue, 113042.10);
assert.equal(livePotentialPreview.monthlyLegs[0].valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
assertFutureProposal_(livePotentialPreview, 846353.40, 'extracted summary table');
assert.equal(livePotentialPreview.holdingsRows.length, 0);

const nbspLiveExtract = extractedPotentialSummaryFixture
  .replace(/Exercisable Value/g, 'Exercisable\u00A0Value')
  .replace(/Potential Value/g, 'Potential\u00A0Value')
  .replace(/Total Value/g, 'Total\u00A0Value')
  .replace(/—/g, '\u2014');
const nbspLivePreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  ctx.investmentEtradeClientStatementParseText_(nbspLiveExtract));
assert.equal(nbspLivePreview.ok, true, nbspLivePreview.error || 'nbsp extract preview failed');
assertFutureProposal_(nbspLivePreview, 846353.40, 'nbsp/dash extract');

const joinedPotentialExtract = extractedPotentialSummaryFixture.replace(/\n+/g, ' ');
const joinedPotentialPreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  ctx.investmentEtradeClientStatementParseText_(joinedPotentialExtract));
assert.equal(joinedPotentialPreview.ok, true, joinedPotentialPreview.error || 'joined extract preview failed');
assertFutureProposal_(joinedPotentialPreview, 846353.40, 'space-joined extract');

const missingPotentialText = futureFixture.replace(futurePotentialBlock, '\n');
const missingPotentialParse = ctx.investmentEtradeClientStatementParseText_(missingPotentialText);
assert.equal(missingPotentialParse.ok, true, missingPotentialParse.error || 'missing potential parse');
assert.equal(missingPotentialParse.potentialUnvestedStockPlan.value, null);
const missingPotentialPreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  missingPotentialParse);
assert.equal(missingPotentialPreview.ok, false);
assert.match(String(missingPotentialPreview.error || ''), /Potential\/unvested stock-plan value was not found/i);
assertFutureProposal_(missingPotentialPreview, null, 'missing potential');

const grantRowsOnlyText = futureFixture.replace(
  futurePotentialBlock,
  '\nPotential Restricted Stock\nGrant Date 1/1/2020 Unvested Shares 10 Potential Value $100.00\nGrant Date 2/1/2020 Unvested Shares 20 Potential Value $200.00\n');
const grantRowsOnlyPreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  ctx.investmentEtradeClientStatementParseText_(grantRowsOnlyText));
assert.equal(grantRowsOnlyPreview.ok, false);
assertFutureProposal_(grantRowsOnlyPreview, null, 'grant-row sum');

const explicitZeroText = futureFixture.replace(/\$846,353\.40/g, '$0.00');
const explicitZeroParse = ctx.investmentEtradeClientStatementParseText_(explicitZeroText);
assert.equal(explicitZeroParse.potentialUnvestedStockPlan.value, 0);
const explicitZeroPreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  explicitZeroParse);
assert.equal(explicitZeroPreview.ok, true, explicitZeroPreview.error || 'explicit $0 preview failed');
assertFutureProposal_(explicitZeroPreview, 0, 'explicit potential $0');
assert.notEqual(explicitZeroPreview.ok, missingPotentialPreview.ok);

const missingBrokerageEndingParse = ctx.investmentEtradeClientStatementParseText_(
  futureFixture.replace(
    'Ending Total Value (as of 8/31/2026) $113,042.10',
    'Ending Total Value (as of 8/31/2026)'
  )
);
assert.equal(missingBrokerageEndingParse.ok, true);
assert.equal(ctx.investmentEtradeCiscoStatementProfileResolveEndingTotal_(missingBrokerageEndingParse), null);
const missingBrokeragePreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  missingBrokerageEndingParse);
assert.equal(missingBrokeragePreview.ok, false);
assert.match(String(missingBrokeragePreview.error || ''), /Brokerage ending account value was not found/i);

const zeroBrokerageEndingParse = ctx.investmentEtradeClientStatementParseText_(
  futureFixture.replace(
    'Ending Total Value (as of 8/31/2026) $113,042.10',
    'Ending Total Value (as of 8/31/2026) $0.00'
  )
);
assert.equal(zeroBrokerageEndingParse.preamble.endingTotalValue, 0);
assert.equal(ctx.investmentEtradeCiscoStatementProfileResolveEndingTotal_(zeroBrokerageEndingParse), 0);
const zeroBrokeragePreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  zeroBrokerageEndingParse);
assert.equal(zeroBrokeragePreview.ok, true, zeroBrokeragePreview.error || 'Cisco $0 ending preview failed');
assert.equal(zeroBrokeragePreview.endingTotalValue, 0);
assert.equal(zeroBrokeragePreview.monthlyLegs[0].proposedValue, 0);
assert.equal(zeroBrokeragePreview.monthlyLegs[0].accountName, 'Etrade Cisco - RSU/ESPP');
assert.equal(zeroBrokeragePreview.potentialUnvestedStockPlanValue, 846353.40);

const missingSamerEndingParse = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(
    'Ending Total Value (as of 8/31/26) $7,205.00',
    'Ending Total Value (as of 8/31/26)'
  )
);
assert.equal(ctx.investmentEtradeCiscoStatementProfileResolveEndingTotal_(missingSamerEndingParse), null);
assert.equal(ctx.investmentEtradeValidateSamerBrokerageStatement_(missingSamerEndingParse).ok, false);
const zeroSamerEndingParse = ctx.investmentEtradeClientStatementParseText_(
  samerBrokerageFixture.replace(
    'Ending Total Value (as of 8/31/26) $7,205.00',
    'Ending Total Value (as of 8/31/26) $0.00'
  )
);
assert.equal(zeroSamerEndingParse.preamble.endingTotalValue, 0);
assert.equal(ctx.investmentEtradeCiscoStatementProfileResolveEndingTotal_(zeroSamerEndingParse), 0);

const ambiguousPotentialText = futureFixture.replace(
  'TOTAL VALUE         —                 $846,353.40  $846,353.40',
  'TOTAL VALUE         —                 $846,353.40  $846,353.40\nTOTAL VALUE         —                 $100.00  $100.00');
const ambiguousPotentialPreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(
  ctx.investmentEtradeClientStatementParseText_(ambiguousPotentialText));
assert.equal(ambiguousPotentialPreview.ok, false);
assertFutureProposal_(ambiguousPotentialPreview, null, 'ambiguous potential');

const esppMonthly = ctx.investmentEtradeNormalizePotentialUnvestedMonthlyPreview_(esppParse);
assert.equal(esppMonthly.ok, true);
assert.equal(esppMonthly.potentialUnvestedStockPlanValue, 3500);
assert.ok(Array.isArray(esppMonthly.holdingsRows));
assert.equal(esppMonthly.holdingsRows.length, 0);

const mainMonthly = ctx.investmentEtradeNormalizePotentialUnvestedMonthlyPreview_(mainParse);
assert.equal(mainMonthly.ok, false);

const futureHoldingsPreview = ctx.investmentEtradeClientStatementPreviewUnified_({
  source: 'ETRADE_CLIENT_STATEMENT_PDF',
  rawStatementText: futureFixture,
  accountMeta: {
    stableAccountId: 'INV-ET-FUTURE-1',
    accountName: 'Synthetic E*TRADE Main',
    registrationType: 'TAXABLE',
    explicitAccountMatch: true
  },
  explicitAccountMatch: true
});
assert.equal(futureHoldingsPreview.ok, true);
assert.equal(futureHoldingsPreview.normalized.holdings.some((row) => row.ticker === 'CSCO'), true);
assert.equal(futureHoldingsPreview.normalized.statementParseMeta.endingTotalValue, 113042.10);
assert.equal(
  (futureHoldingsPreview.normalized.holdings || []).some((row) =>
    Number(row.marketValue) === 846353.40),
  false,
  'potential/unvested value must not appear as a holdings row'
);
assert.equal((futureHoldingsPreview.normalized.taxLots || []).length, 0);
assert.equal((futureHoldingsPreview.normalized.activities || []).length, 0);
assert.equal((futureHoldingsPreview.normalized.distributions || []).length, 0);

// --- Conservative reconciliation regressions ---
const centRoundingParse = ctx.investmentEtradeClientStatementParseText_(centRoundingFixture);
assert.equal(centRoundingParse.reconciliation.ok, true);
assert.equal(centRoundingParse.reconciliation.grossDifference, 0.01);

const twoDollarOneCentParse = ctx.investmentEtradeClientStatementParseText_(twoDollarOneCentFixture);
assert.equal(twoDollarOneCentParse.reconciliation.ok, false);
assert.equal(twoDollarOneCentParse.reconciliation.blockingReason, 'UNMODELED_STATEMENT_BALANCE');
assert.ok(Math.abs(twoDollarOneCentParse.reconciliation.grossDifference - 2.01) < 0.001);

const largeAccountParse = ctx.investmentEtradeClientStatementParseText_(largeAccountFixture);
assert.equal(largeAccountParse.reconciliation.ok, false);
assert.equal(largeAccountParse.reconciliation.blockingReason, 'UNMODELED_STATEMENT_BALANCE');
assert.equal(largeAccountParse.reconciliation.grossDifference, 4000);
const oldPercentTolerance = Math.max(2, Math.abs(largeAccountParse.preamble.endingTotalValue) * 0.005);
assert.ok(largeAccountParse.reconciliation.grossDifference <= oldPercentTolerance,
  'large-account mismatch must expose old 0.5% permissiveness');
assert.ok(largeAccountParse.reconciliation.grossDifference > largeAccountParse.reconciliation.tolerance);

const accruedParse = ctx.investmentEtradeClientStatementParseText_(accruedInterestFixture);
assert.equal(accruedParse.reconciliation.ok, true);
assert.equal(accruedParse.reconciliation.accruedInterest, 25);
assert.equal(accruedParse.reconciliation.computedTotal, 7025);

const failParse = ctx.investmentEtradeClientStatementParseText_(reconciliationFailFixture);
assert.equal(failParse.reconciliation.ok, false);
const failPreview = ctx.investmentEtradeClientStatementPreviewUnified_({
  source: 'ETRADE_CLIENT_STATEMENT_PDF',
  rawStatementText: reconciliationFailFixture,
  accountMeta: baseIdentity,
  explicitAccountMatch: true
});
assert.equal(failPreview.normalized.recommendationReadiness.trustedForHoldingsVisibility, false);
assert.ok(failPreview.normalized.recommendationReadiness.blockingReasons.includes('RECONCILIATION_FAILED'));

// --- Unified preview (explicit match) ---
const mainPreview = ctx.investmentEtradeClientStatementPreviewUnified_({
  source: 'ETRADE_CLIENT_STATEMENT_PDF',
  rawStatementText: mainFixture,
  accountMeta: baseIdentity,
  explicitAccountMatch: true,
  documentFingerprint: byteFingerprint,
  extractionMeta: { method: 'TEXT_FILE', quality: 'USABLE', usable: true, documentFingerprint: byteFingerprint }
});
assert.equal(mainPreview.normalized.statementParseMeta.documentFingerprint, byteFingerprint);
assert.equal(mainPreview.normalized.recommendationReadiness.trustedForHoldingsVisibility, true);

// --- No auto-map without explicit match ---
const reviewPreview = ctx.investmentEtradeClientStatementPreviewUnified_({
  source: 'ETRADE_CLIENT_STATEMENT_PDF',
  rawStatementText: mainFixture,
  accountMeta: {
    stableAccountId: baseIdentity.stableAccountId,
    accountName: baseIdentity.accountName,
    registrationType: baseIdentity.registrationType,
    explicitAccountMatch: false
  },
  explicitAccountMatch: false
});
assert.equal(reviewPreview.reviewRequired, true);
assert.equal(reviewPreview.normalized.accounts[0].matchStatus, 'REVIEW_REQUIRED');

// --- No workbook writes / no raw OCR logging ---
assert.doesNotMatch(read('investment_etrade_client_statement_pdf.js'), /SpreadsheetApp/);
assert.doesNotMatch(pdfClientSource, /console\.(log|debug|info)\([^)]*ocr/i);

const pastedQuality = ctx.investmentEtradeClientStatementAssessTextQuality_(mainFixture);
assert.equal(pastedQuality.usable, true);
assert.equal(pastedQuality.quality, 'USABLE');

// --- Document classification and routing ---
const mainClass = ctx.investmentEtradeClientStatementClassifyDocumentType_(mainFixture);
assert.equal(mainClass.documentType, 'ETRADE_CLIENT_STATEMENT_PDF');

const positionsClass = ctx.investmentEtradeClientStatementClassifyDocumentType_(positionsFixture);
assert.equal(positionsClass.documentType, 'ETRADE_POSITIONS_PDF');

const encodingClass = ctx.investmentEtradeClientStatementClassifyDocumentType_(encodingFixture);
assert.equal(encodingClass.documentType, 'ETRADE_CLIENT_STATEMENT_PDF');

const mojibakeSample = ('Äì~nn-n/T#£ak/ÜakuI/ ¶a‘/#ì/ëö3ö^7|' + ' /\\~#'.repeat(4000)).slice(0, 12000);
assert.equal(ctx.investmentEtradeClientStatementLooksEncodingCorrupt_(mojibakeSample), true);
assert.equal(
  ctx.investmentEtradeClientStatementClassifyDocumentType_(mojibakeSample).documentType,
  'ETRADE_CLIENT_STATEMENT_PDF'
);

const corruptPositionsPreview = ctx.investmentAdapterPreviewEtradePositionsPdf_({
  source: 'ETRADE_POSITIONS_PDF',
  rawPositionsText: encodingFixture,
  accountMeta: baseIdentity,
  explicitAccountMatch: true
});
assert.equal(corruptPositionsPreview.ok, false);
assert.match(String(corruptPositionsPreview.error), /client statement|encoding-corrupt/i);

const blockedPositionsLab = (function() {
  const labCtx = buildContext();
  vm.runInContext(read('central_holdings_preview_lab.js'), labCtx, {
    filename: 'central_holdings_preview_lab.js'
  });
  return labCtx.holdingsPreviewLabBuildPreview_({
    source: 'ETRADE_POSITIONS_PDF',
    rawDocumentText: encodingFixture,
    stableAccountId: baseIdentity.stableAccountId,
    registrationType: baseIdentity.registrationType,
    accountName: baseIdentity.accountName,
    explicitAccountMatch: true
  });
})();
assert.equal(blockedPositionsLab.ok, false);
assert.match(String(blockedPositionsLab.error), /client statement|encoding-corrupt/i);

assert.equal(
  ctx.boundedHoldingsPreviewNeedsEtradeClientStatementOcr_(encodingFixture, 'ETRADE_POSITIONS_PDF'),
  true
);

const editorPresentation = ctx.boundedHoldingsPreviewBuildPdfEditorPresentation_(
  { text: encodingFixture, extractedTextLength: encodingFixture.length },
  encodingQuality,
  encodingClass
);
assert.equal(editorPresentation.displayTextInEditor, false);
assert.equal(editorPresentation.text, '');
assert.equal(editorPresentation.previewText, encodingFixture);

const ocrRequiredResult = ctx.boundedHoldingsPreviewBuildClientStatementOcrRequiredResult_(
  { text: encodingFixture, extractedTextLength: encodingFixture.length, extractionStatus: 'extracted locally from PDF' },
  encodingClass,
  encodingQuality,
  byteFingerprint,
  'ETRADE_CLIENT_STATEMENT_PDF'
);
assert.equal(ocrRequiredResult.detectedSource, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(ocrRequiredResult.effectiveSource, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(ocrRequiredResult.displayTextInEditor, false);
assert.equal(ocrRequiredResult.text, '');
assert.equal(ocrRequiredResult.ocrRequired, true);
assert.match(ocrRequiredResult.statusMessage, /not currently supported for direct import/i);

assert.match(pdfClientSource, /boundedHoldingsPreviewClassifyEtradePdfText_/);
assert.match(pdfClientSource, /boundedHoldingsPreviewResolveEtradePdfEffectiveSource_/);
assert.doesNotMatch(pdfClientSource, /BOUNDED_HOLDINGS_PREVIEW_TESSERACT_/);
assert.doesNotMatch(pdfClientSource, /boundedHoldingsPreviewDiagnoseOcrEnvironment_/);
assert.doesNotMatch(pdfClientSource, /boundedHoldingsPreviewCreateEtradeClientStatementOcrRunner_/);

const blockedResult = ctx.boundedHoldingsPreviewBuildClientStatementOcrRequiredResult_(
  { text: encodingFixture, extractedTextLength: encodingFixture.length, extractionStatus: 'x' },
  encodingClass,
  encodingQuality,
  byteFingerprint,
  'ETRADE_CLIENT_STATEMENT_PDF'
);
assert.equal(blockedResult.effectiveSource, 'ETRADE_CLIENT_STATEMENT_PDF');
assert.equal(blockedResult.ocrRequired, true);
assert.equal(blockedResult.displayTextInEditor, false);
assert.match(blockedResult.statusMessage, /not currently supported for direct import/i);

const mojibakeStandard = ctx.boundedHoldingsPreviewBuildStandardPdfLoadResult_(
  { text: encodingFixture, extractedTextLength: encodingFixture.length, extractionStatus: 'extracted locally from PDF' },
  { source: 'M1_STATEMENT_PDF' },
  byteFingerprint
);
assert.equal(mojibakeStandard.displayTextInEditor, false);
assert.equal(mojibakeStandard.text, '');

function buildMultipageTextPdf(pageTexts) {
  const pages = (pageTexts || []).map((text) => {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (next.length > 72 && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
    if (!lines.length) lines.push(' ');
    const ops = ['BT /F1 12 Tf 72 720 Td'];
    lines.forEach((line, i) => {
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      if (i > 0) ops.push('0 -16 Td');
      ops.push(`(${escaped}) Tj`);
    });
    ops.push('ET');
    return ops.join('\n');
  });
  const pageCount = pages.length;
  const fontId = 3 + pageCount * 2;
  const objects = [];
  objects[1] = '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj';
  const kids = pages.map((_, i) => `${3 + i} 0 R`).join(' ');
  objects[2] = `2 0 obj<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>endobj`;
  pages.forEach((stream, i) => {
    const pageId = 3 + i;
    const contentId = 3 + pageCount + i;
    objects[pageId] = `${pageId} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>endobj`;
    objects[contentId] = `${contentId} 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream\nendobj`;
  });
  objects[fontId] = `${fontId} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj`;
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id <= fontId; id += 1) {
    offsets[id] = Buffer.byteLength(body, 'latin1');
    body += objects[id].endsWith('\n') ? objects[id] : `${objects[id]}\n`;
  }
  const xrefStart = Buffer.byteLength(body, 'latin1');
  const size = fontId + 1;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id += 1) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  body += `${xref}trailer<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

function ciscoEightPageTexts() {
  return [
    'E*TRADE Client Statement Morgan Stanley Stock Plan Account ETRADE_PAGE_MARKER_1',
    'Statement period: 8/1/2026 to 8/31/2026 Account number: XXXX-FUTURE-001 Account title: Synthetic Cisco Stock Plan ETRADE_PAGE_MARKER_2',
    'Beginning Total Value (as of 8/1/2026) $110,000.00 Ending Total Value (as of 8/31/2026) $113,042.10 ETRADE_PAGE_MARKER_3',
    'Security Description Quantity Share Price Total Cost Market Value Unrealized Gain/Loss Unrealized Gain/Loss % Est Annual Income Current Yield % Est YTD Income ETRADE_PAGE_MARKER_4',
    'CSCO SYSTEMS INC (CSCO) Purchases 1023.098 $50.00 $40,000.00 $51,154.90 $11,154.90 Total 1023.098 $50.00 $40,000.00 $51,154.90 $11,154.90 ETRADE_PAGE_MARKER_5',
    'Total Cash, Bank Deposit Program, and Money Market Funds $61,887.20 Total Cash, Bank Deposit Program, and Money Market Funds Debit $0.00 ETRADE_PAGE_MARKER_6',
    'Exercisable Value Potential Value Total Value Percentage Restricted Stock - $846,353.40 $846,353.40 TOTAL VALUE - $846,353.40 $846,353.40 Potential Restricted Stock Grant Date 3/15/23 Potential Value $0.00 ETRADE_PAGE_MARKER_7',
    'Activity Summary CSCO Dividend $12.50 Realized Gain/(Loss) Summary Total Realized Gain/(Loss) $0.00 ETRADE_PAGE_MARKER_8'
  ];
}

function fakePdfFile(pdfBuffer, fileName) {
  const copy = Buffer.from(pdfBuffer);
  return {
    name: fileName || 'statement.pdf',
    type: 'application/pdf',
    arrayBuffer() {
      return Promise.resolve(copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength));
    }
  };
}

const eightPageCiscoPdf = buildMultipageTextPdf(ciscoEightPageTexts());
const eightPageBuffer = eightPageCiscoPdf.buffer.slice(
  eightPageCiscoPdf.byteOffset,
  eightPageCiscoPdf.byteOffset + eightPageCiscoPdf.byteLength
);
const eightPageExtracted = await ctx.boundedHoldingsPreviewExtractPdfTextFromArrayBuffer_(
  eightPageBuffer,
  pdfjsLib
);
assert.ok(String(eightPageExtracted || '').trim(), '8-page E*TRADE fixture must extract non-empty text');
assert.match(eightPageExtracted, /113,042\.10/);
assert.match(eightPageExtracted, /846,353\.40/);
assert.match(eightPageExtracted, /Ending Total Value/i);
assert.match(eightPageExtracted, /Potential Restricted Stock/i);
for (let page = 1; page <= 8; page += 1) {
  assert.match(eightPageExtracted, new RegExp(`ETRADE_PAGE_MARKER_${page}`));
}
assert.doesNotMatch(eightPageExtracted, /tesseract|OCR required/i);

const eightPageLoad = await ctx.boundedHoldingsPreviewLoadDocumentTextFromFile_(
  fakePdfFile(eightPageCiscoPdf, 'Etrade-Cisco-Client-Statement.pdf'),
  pdfjsLib,
  {
    source: 'ETRADE_CLIENT_STATEMENT_PDF',
    groupedMode: false,
    accountProvider: 'ETRADE'
  }
);
const eightPageEditorText = String(eightPageLoad.previewText || eightPageLoad.text || '');
assert.ok(eightPageEditorText.trim(), 'combined E*TRADE load must populate extracted text');
assert.match(eightPageEditorText, /113,042\.10/);
assert.match(eightPageEditorText, /846,353\.40/);
assert.equal(eightPageLoad.ocrRequired, false);
assert.equal(eightPageLoad.displayTextInEditor, true);
assert.ok(String(eightPageLoad.text || '').length > 0);
assert.doesNotMatch(String(eightPageLoad.extractionStatus || ''), /OCR/i);

const eightPageParse = ctx.investmentEtradeClientStatementParseText_(eightPageExtracted);
assert.equal(eightPageParse.ok, true, eightPageParse.error || '8-page extracted E*TRADE parse failed');
assert.equal(eightPageParse.preamble.endingTotalValue, 113042.10);
assert.equal(eightPageParse.potentialUnvestedStockPlan.value, 846353.40);

const eightPagePreview = ctx.investmentEtradeNormalizeCiscoStatementProfilePreview_(eightPageParse);
assert.equal(eightPagePreview.ok, true, eightPagePreview.error || '8-page combined preview failed');
assert.equal(eightPagePreview.monthlyLegs.length, 2);
assert.equal(eightPagePreview.monthlyLegs[0].accountName, 'Etrade Cisco - RSU/ESPP');
assert.equal(eightPagePreview.monthlyLegs[0].proposedValue, 113042.10);
assert.equal(eightPagePreview.monthlyLegs[0].valueCategory, 'BROKERAGE_ACCOUNT_VALUE');
assert.equal(eightPagePreview.monthlyLegs[1].accountName, 'Etrade Cisco - Future');
assert.equal(eightPagePreview.monthlyLegs[1].proposedValue, 846353.40);
assert.equal(eightPagePreview.monthlyLegs[1].valueCategory, 'POTENTIAL_UNVESTED_STOCK_PLAN');
assert.equal(eightPagePreview.holdingsRows.length, 0);
assert.equal(eightPagePreview.capabilities.holdings, false);
assert.doesNotMatch(JSON.stringify(eightPagePreview), /tesseract|ocrRequired/i);

console.log('checkEtradeClientStatementPdfRegressions: ok');
