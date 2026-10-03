import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (name) => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');

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

const retirementSource = read('retirement.js');
const body = read('Dashboard_Body.html');
const help = read('Dashboard_Help.html');
const educationClient = read('Dashboard_Script_PlanningEducation.html');
const educationSource = read('education.js');

assert.match(retirementSource, /function isRetirementExcludedEducationAssetType_/);
assert.match(retirementSource, /normalized === 'EDUCATION' \|\| normalized === '529'/);
assert.doesNotMatch(
  extractFunction(retirementSource, 'getCurrentInvestableAssetsForRetirement_'),
  /Lutfi 529|Laith 529|accountName/
);
assert.match(body, /id="ret_info_assets"[\s\S]*?Education and 529 accounts are not included/);
assert.doesNotMatch(
  body.slice(body.indexOf('id="education"'), body.indexOf('id="debtPayoff"')),
  /Education and 529 accounts are not included|Current investable assets|Retirement still includes/
);
assert.doesNotMatch(educationClient, /Current investable assets|Education and 529 accounts are not included/);
assert.doesNotMatch(educationSource, /retirement529Review|Retirement still includes 529/);
assert.match(help, /Current investable assets exclude accounts typed Education or 529/);

function makeSheet(rows) {
  return {
    getName() { return 'SYS - Assets'; },
    getDataRange() {
      return {
        getValues() { return rows; },
        getDisplayValues() {
          return rows.map((row) => row.map((cell) => (cell == null ? '' : String(cell))));
        }
      };
    }
  };
}

function makeContext(rows) {
  const sheet = makeSheet(rows);
  const context = {
    String, Number, Object, Array, Math, isFinite, Error,
    getUserSpreadsheet_() { return {}; },
    getSheet_() { return sheet; },
    toNumber_(value) {
      if (typeof value === 'number') return value;
      const text = String(value || '').trim().replace(/[$,]/g, '');
      if (!text) return 0;
      const numeric = Number(text);
      return isFinite(numeric) ? numeric : 0;
    },
    round2_(value) { return Math.round(Number(value) * 100) / 100; }
  };
  vm.createContext(context);
  vm.runInContext(`
    ${extractFunction(retirementSource, 'isRetirementExcludedEducationAssetType_')}
    ${extractFunction(retirementSource, 'getCurrentInvestableAssetsForRetirement_')}
  `, context, { filename: 'retirement_investable_partial.js' });
  return context;
}

const populatedRows = [
  ['Account Name', 'Type', 'Current Balance', 'Active', 'Investment Id'],
  ['Lutfi 529', '529', 73028.59, 'Yes', 'INV-LUTFI-529'],
  ['Laith 529', 'Education', 41200, 'Yes', 'INV-LAITH-529'],
  ['Samer Robinhood', 'Brokerage', 5000, 'Yes', 'INV-SR'],
  ['401K Account', 'Retirement', 1918949.84, 'Yes', 'INV-401K'],
  ['Charles Schwab - Personal', 'Brokerage', 13000, 'Yes', 'INV-SCHWAB']
];
const populated = makeContext(populatedRows);
assert.equal(populated.getCurrentInvestableAssetsForRetirement_(), 1936949.84);
assert.equal(
  populated.getCurrentInvestableAssetsForRetirement_(),
  5000 + 1918949.84 + 13000
);

const nameOnly529 = makeContext([
  ['Account Name', 'Type', 'Current Balance', 'Active'],
  ['Lutfi 529', 'Brokerage', 73028.59, 'Yes'],
  ['Samer Robinhood', 'Brokerage', 5000, 'Yes']
]);
assert.equal(nameOnly529.getCurrentInvestableAssetsForRetirement_(), 78028.59,
  'A 529-named row with Type Brokerage must stay included; classification uses Type only');

const blankType = makeContext([
  ['Account Name', 'Type', 'Current Balance', 'Active'],
  ['Unknown Custodial', '', 1000, 'Yes'],
  ['Samer Robinhood', 'Brokerage', 5000, 'Yes']
]);
assert.equal(blankType.getCurrentInvestableAssetsForRetirement_(), 6000,
  'Blank Type cannot be classified as Education/529 and must remain included');

const missingTypeColumn = makeContext([
  ['Account Name', 'Current Balance', 'Active'],
  ['Lutfi 529', 73028.59, 'Yes'],
  ['Samer Robinhood', 5000, 'Yes']
]);
assert.equal(missingTypeColumn.getCurrentInvestableAssetsForRetirement_(), 78028.59,
  'Without a Type column, balances stay included rather than guessed from account names');

assert.equal(populated.isRetirementExcludedEducationAssetType_('Education'), true);
assert.equal(populated.isRetirementExcludedEducationAssetType_('529'), true);
assert.equal(populated.isRetirementExcludedEducationAssetType_('education'), true);
assert.equal(populated.isRetirementExcludedEducationAssetType_('Brokerage'), false);
assert.equal(populated.isRetirementExcludedEducationAssetType_('Retirement'), false);
assert.equal(populated.isRetirementExcludedEducationAssetType_(''), false);
assert.equal(populated.isRetirementExcludedEducationAssetType_('ScholarShare'), false);

console.log('checkRetirementInvestableAssetsRegressions: ok');
