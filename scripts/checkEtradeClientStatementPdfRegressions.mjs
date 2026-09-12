import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

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
  vm.runInContext(read('investment_adapters.js'), context, { filename: 'investment_adapters.js' });
  vm.runInContext(read('bounded_holdings_preview_pdf_client.js'), context, {
    filename: 'bounded_holdings_preview_pdf_client.js'
  });
  return context;
}

const ctx = buildContext();
const mainFixture = fixture('synthetic_etrade_client_statement_main.txt');
const esppFixture = fixture('synthetic_etrade_client_statement_espp.txt');
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

// --- ESPP parse ---
const esppParse = ctx.investmentEtradeClientStatementParseText_(esppFixture);
assert.equal(esppParse.ok, true);
assert.equal(esppParse.accountKind, 'STOCK_PLAN');
assert.equal(esppParse.holdings.length, 1);
assert.equal(esppParse.holdings[0].symbol, 'CSCO');

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

console.log('checkEtradeClientStatementPdfRegressions: ok');
