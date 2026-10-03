import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const fixture = (name) => read(`test/fixtures/fidelity/${name}`);

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

function buildContext() {
  const context = {
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
  `, context, { filename: 'activity-stubs.js' });
  vm.runInContext(read('investment_fidelity_401k_statement_pdf.js'), context, {
    filename: 'investment_fidelity_401k_statement_pdf.js'
  });
  return context;
}

const ctx = buildContext();
const mainFixture = fixture('synthetic_fidelity_401k_statement_main.txt');
const missingEndingFixture = fixture('synthetic_fidelity_401k_statement_missing_ending_balance.txt');
const wrongDocumentFixture = fixture('synthetic_fidelity_401k_statement_wrong_document.txt');

assert.equal(ctx.investmentPortfolioNormalizeSource_('FIDELITY_401K_STATEMENT_PDF'),
  'FIDELITY_401K_STATEMENT_PDF');

const detection = ctx.investmentFidelity401kStatementDetect_({ rawDocumentText: mainFixture });
assert.equal(detection.ok, true);
assert.equal(detection.source, 'FIDELITY_401K_STATEMENT_PDF');
assert.equal(detection.provider, 'FIDELITY');

const preview = ctx.investmentFidelity401kStatementPreviewFromText_(mainFixture);
assert.equal(preview.ok, true);
assert.equal(preview.source, 'FIDELITY_401K_STATEMENT_PDF');
assert.equal(preview.provider, 'FIDELITY');
assert.equal(preview.importPurpose, 'BALANCE_SNAPSHOT');
assert.equal(preview.accountType, 'RETIREMENT');
assert.equal(preview.preview.asOfDate, '2026-09-10');
assert.equal(preview.preview.statementPeriodEnd, '2026-09-10');
assert.equal(preview.preview.endingBalance, 1918949.84);
assert.equal(preview.preview.vestedBalance, 1918949.84);
assert.equal(preview.preview.summary.beginningBalance, 435876.7);
assert.equal(preview.preview.summary.employeeContributions, 211165.39);
assert.equal(preview.preview.summary.employerContributions, 136715.33);
assert.equal(preview.preview.summary.fees, -18552.71);
assert.equal(preview.preview.summary.changeInMarketValue, 1153745.13);
assert.equal(preview.preview.summary.dividendsAndInterest, 3770.45);
assert.equal(preview.preview.ocrRequired, false);
assert.ok(Array.isArray(preview.preview.fundHoldings));

const missingEnding = ctx.investmentFidelity401kStatementPreviewFromText_(missingEndingFixture);
assert.equal(missingEnding.ok, false);
assert.match(missingEnding.error, /Ending Balance/i);
assert.notEqual(missingEnding.preview && missingEnding.preview.endingBalance, 0);

const zeroEnding = ctx.investmentFidelity401kStatementPreviewFromText_(
  mainFixture.replace(
    'Ending Balance   $1,918,949.84  Additional Information',
    'Ending Balance   $0.00  Additional Information'
  )
);
assert.equal(zeroEnding.ok, true, zeroEnding.error || 'Fidelity $0 ending preview failed');
assert.equal(zeroEnding.preview.endingBalance, 0);
const zeroMonthly = ctx.investmentFidelity401kStatementNormalizeMonthlyPreview_(zeroEnding);
assert.equal(zeroMonthly.endingBalance, 0);
assert.notEqual(zeroMonthly.endingBalance, null);

const wrongDocument = ctx.investmentFidelity401kStatementDetect_({ rawDocumentText: wrongDocumentFixture });
assert.equal(wrongDocument.ok, false);

const emptyText = ctx.investmentFidelity401kStatementPreviewFromText_('');
assert.equal(emptyText.ok, false);

const classification = ctx.investmentFidelity401kStatementClassifyDocumentType_(mainFixture);
assert.equal(classification.documentType, 'FIDELITY_401K_STATEMENT_PDF');
assert.equal(classification.usable, true);

const sep2026Fixture = fixture('synthetic_fidelity_401k_statement_sep_2026.txt');
const sepPreview = ctx.investmentFidelity401kStatementPreviewFromText_(sep2026Fixture);
assert.equal(sepPreview.ok, true);
assert.equal(sepPreview.preview.asOfDate, '2026-09-30');
assert.equal(sepPreview.preview.endingBalance, 1919468.06);
assert.equal(sepPreview.preview.summary.beginningBalance, 1673531.03);
assert.notEqual(sepPreview.preview.endingBalance, sepPreview.preview.summary.beginningBalance);
assert.notEqual(sepPreview.preview.endingBalance, sepPreview.preview.summary.changeInMarketValue);

const monthlyPreview = ctx.investmentFidelity401kStatementNormalizeMonthlyPreview_(sepPreview);
assert.equal(monthlyPreview.ok, true);
assert.equal(monthlyPreview.source, 'FIDELITY_401K_STATEMENT_PDF');
assert.equal(monthlyPreview.asOf, '2026-09-30');
assert.equal(monthlyPreview.asOfDate, '2026-09-30');
assert.equal(monthlyPreview.endingBalance, 1919468.06);
assert.ok(Array.isArray(monthlyPreview.holdingsRows));
assert.equal(monthlyPreview.holdingsRows.length, 0);
assert.equal(monthlyPreview.cashBalance, null);
assert.equal(monthlyPreview.capabilities.holdings, false);
assert.equal(monthlyPreview.capabilities.accountSnapshot, true);
assert.equal(Object.prototype.hasOwnProperty.call(monthlyPreview, 'fundHoldings'), false);

console.log('checkFidelity401kStatementPdfRegressions: ok');
