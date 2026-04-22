var RETIREMENT_SCENARIOS_ = ['Conservative', 'Base', 'Aggressive'];

function getRetirementUiData() {
  const sheet = getOrCreateRetirementSheet_();
  const data = getRetirementModelData_(sheet);
  // `data.analysis` is null when the selected scenario is incomplete
  // (see the skip logic in `getRetirementModelData_`). Skip the sheet
  // write in that case rather than crashing `writeRetirementOutputs_`,
  // which dereferences analysis fields with no null guards. The
  // previously-written "Selected Scenario Output" values remain in the
  // sheet untouched until a computable scenario is selected again.
  if (data.analysis) {
    writeRetirementOutputs_(sheet, data.analysis);
  }
  return data;
}

function saveRetirementInputs(payload) {
  const sheet = getOrCreateRetirementSheet_();

  const selectedScenario = normalizeRetirementScenario_(payload.selectedScenario || 'Base');
  const household = {
    yourCurrentAge: toNumber_(payload.yourCurrentAge),
    spouseCurrentAge: toNumber_(payload.spouseCurrentAge)
  };

  const scenarioInputs = {
    targetRetirementAge: toNumber_(payload.targetRetirementAge),
    householdRetirementSpendingPerYear: toNumber_(payload.householdRetirementSpendingPerYear),
    yourSocialSecurityPerYear: toNumber_(payload.yourSocialSecurityPerYear),
    spouseSocialSecurityPerYear: toNumber_(payload.spouseSocialSecurityPerYear),
    otherRetirementIncomePerYear: toNumber_(payload.otherRetirementIncomePerYear),
    annualContributions: toNumber_(payload.annualContributions),
    expectedAnnualReturnPct: toNumber_(payload.expectedAnnualReturnPct),
    inflationPct: toNumber_(payload.inflationPct),
    safeWithdrawalRatePct: toNumber_(payload.safeWithdrawalRatePct),
    oneTimeFutureCashNeeds: toNumber_(payload.oneTimeFutureCashNeeds)
  };

  validateRetirementHousehold_(household);
  validateRetirementScenarioInputs_(household, scenarioInputs);

  writeRetirementHouseholdInputs_(sheet, household);
  writeRetirementScenarioInputs_(sheet, selectedScenario, scenarioInputs);
  setSelectedRetirementScenario_(sheet, selectedScenario);

  const data = getRetirementModelData_(sheet);
  // In practice `data.analysis` is always non-null here because
  // `saveRetirementInputs` has just validated the selected scenario's
  // inputs above and written them to the sheet. Guarding defensively
  // so the save path is consistent with `getRetirementUiData` and
  // tolerant of any future selection-vs-selected-payload drift.
  if (data.analysis) {
    writeRetirementOutputs_(sheet, data.analysis);
  }
  touchDashboardSourceUpdated_('retirement');

  return {
    ok: true,
    message: 'Retirement assumptions updated.',
    data: data
  };
}

function getRetirementSummary_() {
  const sheet = getOrCreateRetirementSheet_();
  return getRetirementModelData_(sheet);
}

/**
 * Minimal UI-facing save for the "Retirement Basics" input section on
 * the Retirement tab. Writes ONLY the two household-identity cells
 * already used by the planner (`Your Current Age`, `Spouse Current
 * Age`) into the existing INPUT - Retirement sheet. Does NOT touch any
 * scenario row, does NOT add columns, does NOT validate scenario
 * inputs — those remain whatever the retirement sheet already holds
 * (seeded defaults or the user's last `saveRetirementInputs`).
 *
 * Partnered convention: when `payload.partnered` is not truthy, we
 * write `Spouse Current Age = 0`. This matches the documented
 * "spouseCurrentAge of 0 is legal for 'not partnered'" sentinel
 * already used by `getRetirementUiDataSafe` / `readRetirementHousehold
 * Safe_` so downstream scenario math treats the household as single.
 *
 * Returns the same structured envelope as `getRetirementUiDataSafe()`
 * so the client can re-render the tab in one round-trip.
 */
function saveRetirementBasics(payload) {
  const sheet = getOrCreateRetirementSheet_();

  const yourAge = toNumber_(payload && payload.yourCurrentAge);
  const partnered = !!(payload && payload.partnered === true);
  const spouseAgeRaw = toNumber_(payload && payload.spouseCurrentAge);
  const spouseAge = partnered ? spouseAgeRaw : 0;

  const household = {
    yourCurrentAge: yourAge,
    spouseCurrentAge: spouseAge
  };

  // Minimal validation for basics only. Scenario inputs are intentionally
  // NOT validated here — this entry point exists so users can enter just
  // enough to unblock the main retirement form, which still owns full
  // scenario validation via saveRetirementInputs / validateRetirement*_.
  if (!(household.yourCurrentAge > 0)) {
    throw new Error('Your age must be greater than 0.');
  }
  if (household.spouseCurrentAge < 0) {
    throw new Error('Spouse age cannot be negative.');
  }

  writeRetirementHouseholdInputs_(sheet, household);
  touchDashboardSourceUpdated_('retirement');

  return {
    ok: true,
    message: 'Retirement basics saved.',
    data: getRetirementUiDataSafe()
  };
}

/**
 * Safe UI-facing retirement read for the Retirement tab.
 *
 * Never throws. Returns a structured envelope describing the current
 * state so the client can render calm guidance instead of a red error
 * banner when the workbook is brand-new, partially configured, or the
 * retirement sheet has been cleared.
 *
 * Shape (current runtime, preserved for compatibility):
 *   {
 *     state: 'ready' | 'needsHouseholdBasics' | 'needsScenarioAssumptions' | 'error',
 *     message: string,                 // user-facing copy for non-ready states
 *     missingFields: string[],         // which household fields are blank
 *     settings: {                      // INPUT - Settings probe (read-only)
 *       sheetExists: boolean,
 *       household: {
 *         yourAge: number | null,             // SUPERSEDED (see below)
 *         partnered: boolean | null,
 *         spouseAge: number | null,           // SUPERSEDED (see below)
 *         targetRetirementAge: number | null  // SUPERSEDED (see below)
 *       }
 *     },
 *     selectedScenario, household, scenarios, analyses, analysis
 *   }
 *
 * Architecture note (updated after A2; see SESSION_NOTES.md Phase C):
 *   INPUT - Settings is the home for people / household IDENTITY only.
 *   Ages are NOT stored in INPUT - Settings; they are derived from DOB
 *   when needed. TargetRetirementAge and every other retirement-scenario
 *   assumption stay in the retirement workflow / `INPUT - Retirement`
 *   sheet. Phase C will:
 *     - introduce additive identity keys in INPUT - Settings:
 *         `YourDOB`, `Partnered`, `SpouseName`, `SpouseDOB`
 *     - replace the three `*Age` scaffold fields above with
 *         `yourDOB: string | null`, `spouseName: string | null`,
 *         `spouseDOB: string | null` (plus a derived `yourAge` /
 *         `spouseAge` only at read time, computed from DOB).
 *     - drop `targetRetirementAge` from this payload entirely; the
 *       retirement tab already reads it from the scenario row of
 *       `INPUT - Retirement`.
 *   The current three `*Age` fields are kept as null placeholders only
 *   to preserve the A1 runtime contract until Phase C formally swings
 *   the shape; no code writes to them today.
 *
 * The compatibility-preserving `getRetirementUiData()` is unchanged and
 * still available for any other caller. This function wraps it and also
 * short-circuits to `needsHouseholdBasics` BEFORE invoking the throwing
 * compute path, so a missing age (the common first-run case once the
 * retirement sheet stops seeding hardcoded defaults in Phase D) renders
 * a friendly empty state instead of surfacing `Error: Your Current Age
 * must be greater than 0`.
 *
 * The `settings` block is populated from a pure-read probe of
 * `INPUT - Settings`. The probe:
 *   - never creates the sheet
 *   - never writes the sheet
 *   - does not require any forward-looking key to exist yet
 * See `probeRetirementSettingsHousehold_` below for exactly which keys
 * are recognized today and which are planned.
 */
function getRetirementUiDataSafe() {
  const result = {
    state: 'ready',
    message: '',
    missingFields: [],
    settings: {
      sheetExists: false,
      household: {
        yourAge: null,
        partnered: null,
        spouseAge: null,
        targetRetirementAge: null
      }
    },
    selectedScenario: 'Base',
    household: null,
    scenarios: null,
    analyses: null,
    analysis: null
  };

  try {
    result.settings = probeRetirementSettingsHousehold_();
  } catch (_settingsErr) {
    // Defensive: probe is already try/catch'd internally, but double-guard
    // so the UI never fails because of a transient Settings-read issue.
  }

  let sheet;
  try {
    sheet = getOrCreateRetirementSheet_();
  } catch (e) {
    result.state = 'error';
    result.message = 'Retirement data could not be loaded. Try again, or add your basics to continue.';
    return result;
  }

  const householdRead = readRetirementHouseholdSafe_(sheet);
  result.household = householdRead.values;

  // Decide state without triggering the throwing compute path.
  //
  // Today we only block on `yourCurrentAge` (read from the retirement
  // sheet). spouseCurrentAge of 0 is legal for "not partnered" and is
  // not treated as missing.
  //
  // Architecture note (see SESSION_NOTES.md Phase C): ages are being
  // moved out of INPUT - Settings entirely. Phase C will add DOB-based
  // identity keys (`YourDOB`, `Partnered`, `SpouseName`, `SpouseDOB`)
  // to INPUT - Settings and derive the numeric age at read time. This
  // function will then honor a blank age in the retirement sheet when
  // a DOB is present in INPUT - Settings. Until Phase C ships, the
  // retirement sheet remains the sole source of the age input.
  if (!householdRead.values || !(householdRead.values.yourCurrentAge > 0)) {
    result.state = 'needsHouseholdBasics';
    result.missingFields = householdRead.missing;
    result.message = 'Add your age to see your retirement plan. Spouse age and target retirement age are optional but recommended.';
    return result;
  }

  // Gate the compute path behind a "do we have enough scenario inputs
  // to produce a meaningful plan?" check.
  //
  // Without this gate, a brand-new workbook where the user has only
  // filled in Retirement Basics (age) will flip straight to the ready
  // branch and render `calculateRetirementPlan_` output for every
  // scenario using blank (=0) assumptions. The math dutifully returns
  // Goal $0 → Funded 100% → "Can retire now: Yes" → MC success 100%,
  // which reads as a confident "you're already set for retirement"
  // story *before the user has entered a single dollar of spending,
  // Social Security, or contributions*. That is the exact opposite of
  // what we want the first retirement experience to say.
  //
  // Smallest safe gate: at least one scenario must have retirement
  // spending > 0. Spending is the single most load-bearing scenario
  // input — every downstream number (goal, funded %, Monte Carlo,
  // summary string) flows from it. Blocking on spending alone avoids
  // the misleading "already funded" story while letting users save
  // partial scenario data (e.g. contributions + return assumptions
  // first) without getting stuck in the guidance state.
  //
  // This is intentionally read-only and additive:
  //   - reads scenarios via a tolerant helper that never throws
  //   - does NOT run `calculateRetirementPlan_`
  //   - does NOT change any retirement math
  //   - does NOT write to any sheet
  //   - populated workbooks (where every scenario already has spending
  //     > 0) skip this branch entirely and land in the ready branch
  //     below byte-identically to the prior contract.
  let scenariosForGate = null;
  let selectedForGate = 'Base';
  try {
    scenariosForGate = readRetirementScenariosSafe_(sheet);
    selectedForGate = getSelectedRetirementScenario_(sheet);
  } catch (_scenariosErr) {
    // Tolerate any transient read issue; fall through to the compute
    // path, which has its own try/catch envelope below.
  }

  if (scenariosForGate && !hasAnyMeaningfulRetirementScenarioAssumptions_(scenariosForGate)) {
    result.state = 'needsScenarioAssumptions';
    result.missingFields = [
      'householdRetirementSpendingPerYear',
      'targetRetirementAge'
    ];
    result.message =
      'Add your retirement spending, Social Security, and contributions to see your plan.';
    result.selectedScenario = selectedForGate;
    result.household = householdRead.values;
    result.scenarios = scenariosForGate;
    // analyses / analysis intentionally null — we do not want any
    // computed output to render in this state.
    return result;
  }

  try {
    const data = getRetirementUiData();
    result.selectedScenario = data.selectedScenario;
    result.household = data.household;
    result.scenarios = data.scenarios;
    result.analyses = data.analyses;
    result.analysis = data.analysis;
    result.state = 'ready';
    return result;
  } catch (e) {
    result.state = 'error';
    result.message = 'Retirement planner could not load. Try again, or review your inputs below.';
    return result;
  }
}

/**
 * Read every scenario's raw inputs without throwing on a malformed or
 * partially-populated INPUT - Retirement sheet.
 *
 * Mirrors the tolerance contract of `readRetirementHouseholdSafe_`:
 * any per-scenario read error (missing row label, unexpected layout)
 * falls back to a zeroed scenario so the UI can still prefill input
 * fields without surfacing a red error. Never creates the sheet,
 * never writes.
 *
 * Returns `{ Conservative, Base, Aggressive }` — always the full set
 * of scenario keys, each an inputs object with numeric fields (0 when
 * blank).
 */
function readRetirementScenariosSafe_(sheet) {
  const out = {};
  RETIREMENT_SCENARIOS_.forEach(function(name) {
    try {
      out[name] = getRetirementScenarioInputs_(sheet, name);
    } catch (_scenarioErr) {
      out[name] = {
        targetRetirementAge: 0,
        householdRetirementSpendingPerYear: 0,
        yourSocialSecurityPerYear: 0,
        spouseSocialSecurityPerYear: 0,
        otherRetirementIncomePerYear: 0,
        annualContributions: 0,
        expectedAnnualReturnPct: 0,
        inflationPct: 0,
        safeWithdrawalRatePct: 0,
        oneTimeFutureCashNeeds: 0
      };
    }
  });
  return out;
}

/**
 * Per-scenario predicate: does this scenario have enough data to be
 * computed and rendered as a real retirement plan?
 *
 * Both fields must be jointly present on the same scenario:
 *   - householdRetirementSpendingPerYear > 0
 *     (otherwise `calculateRetirementPlan_` yields the misleading
 *     "$0 goal, 100% funded, can retire now" story)
 *   - targetRetirementAge > 0
 *     (otherwise `validateRetirementScenarioInputs_` throws
 *     "Target Retirement Age must be >= Your Current Age" once any
 *     household age is set, which would fail the whole compute path)
 *
 * Other inputs (Social Security, contributions, returns, inflation,
 * SWR, one-time needs) stay optional so users can enter values
 * incrementally. Incomplete scenarios are treated as inactive — we
 * skip calc + validation for them in `getRetirementModelData_`.
 */
function isRetirementScenarioComputable_(inputs) {
  return !!(
    inputs &&
    Number(inputs.householdRetirementSpendingPerYear) > 0 &&
    Number(inputs.targetRetirementAge) > 0
  );
}

/**
 * Readiness gate: is at least one scenario computable?
 *
 * This is the gate used by `getRetirementUiDataSafe` to decide between
 * `needsScenarioAssumptions` (show guidance, no computed output) and
 * `ready` (compute and render). Because incomplete scenarios are
 * skipped inside `getRetirementModelData_`, a single computable
 * scenario is sufficient for the ready path to run safely — users can
 * fill in Base first and still get a valid result while Conservative
 * and Aggressive remain blank.
 */
function hasAnyMeaningfulRetirementScenarioAssumptions_(scenarios) {
  if (!scenarios) return false;
  const names = RETIREMENT_SCENARIOS_;
  for (let i = 0; i < names.length; i++) {
    if (isRetirementScenarioComputable_(scenarios[names[i]])) {
      return true;
    }
  }
  return false;
}

/**
 * Read `Your Current Age` / `Spouse Current Age` from INPUT - Retirement
 * without triggering validation. `findLabelValueCell_` returns null for
 * missing labels, so a malformed sheet yields a zeroed `values` object
 * and a populated `missing` list rather than a throw.
 */
function readRetirementHouseholdSafe_(sheet) {
  const out = { values: null, missing: [] };
  let your = null;
  let spouse = null;

  try {
    const yourCell = findLabelValueCell_(sheet, 'Your Current Age');
    if (yourCell) your = toNumber_(yourCell.getValue());
  } catch (_yourErr) { /* tolerate */ }

  try {
    const spouseCell = findLabelValueCell_(sheet, 'Spouse Current Age');
    if (spouseCell) spouse = toNumber_(spouseCell.getValue());
  } catch (_spouseErr) { /* tolerate */ }

  if (!(Number(your) > 0)) out.missing.push('yourCurrentAge');
  // spouseCurrentAge missing-ness is informational only; not a blocker.
  if (spouse === null) out.missing.push('spouseCurrentAge');

  out.values = {
    yourCurrentAge: Number(your) > 0 ? Number(your) : 0,
    spouseCurrentAge: Number(spouse) > 0 ? Number(spouse) : 0
  };
  return out;
}

/**
 * Read-only probe of INPUT - Settings for household-identity keys.
 *
 * Tolerates the current 2-column Key/Value schema. Never creates the
 * sheet, never writes, never renames columns. If the sheet does not
 * exist, or any expected key is absent, the corresponding field stays
 * null so the UI can treat it as "not set" without falling back to a
 * guessed value.
 *
 * Architecture note (updated; see SESSION_NOTES.md Phase C):
 *   INPUT - Settings is the home for people / household IDENTITY only.
 *   Phase C will introduce additive identity keys:
 *     - YourDOB      → string | null   (ISO date, e.g. '1972-04-15')
 *     - Partnered    → true | false | null
 *     - SpouseName   → string | null
 *     - SpouseDOB    → string | null
 *   Ages will then be DERIVED from DOB at read time. TargetRetirementAge
 *   and every other retirement-scenario assumption remain in the
 *   retirement workflow / `INPUT - Retirement` sheet — they are never
 *   stored in INPUT - Settings.
 *
 * Keys currently recognized by this probe (legacy A1 scaffold, not
 * written by any code today, preserved only to keep the A1 RPC shape
 * stable until Phase C formally swings the implementation):
 *   - YourAge              → number | null     SUPERSEDED by YourDOB
 *   - Partnered            → true | false | null   (kept under Phase C)
 *   - SpouseAge            → number | null     SUPERSEDED by SpouseDOB
 *   - TargetRetirementAge  → number | null     REMOVED — moves fully
 *                            to the retirement sheet; do not write it
 *                            to INPUT - Settings.
 *
 * On a populated workbook today this probe returns all-null household
 * values because none of the above keys exist in the sheet. The switch
 * body below stays intact until Phase C replaces it; changing the
 * parse list now would be a runtime contract change.
 */
function probeRetirementSettingsHousehold_() {
  const out = {
    sheetExists: false,
    household: {
      yourAge: null,
      partnered: null,
      spouseAge: null,
      targetRetirementAge: null
    }
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('INPUT - Settings');
    if (!sheet) return out;
    out.sheetExists = true;

    const last = sheet.getLastRow();
    if (last < 2) return out;

    const values = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (let i = 0; i < values.length; i++) {
      const key = String(values[i][0] == null ? '' : values[i][0]).trim();
      if (!key) continue;
      const raw = values[i][1];

      switch (key) {
        case 'YourAge':
          out.household.yourAge = parseSettingsNumberOrNull_(raw);
          break;
        case 'Partnered':
          out.household.partnered = normalizePartneredSetting_(raw);
          break;
        case 'SpouseAge':
          out.household.spouseAge = parseSettingsNumberOrNull_(raw);
          break;
        case 'TargetRetirementAge':
          out.household.targetRetirementAge = parseSettingsNumberOrNull_(raw);
          break;
        default:
          // Unknown / existing keys (Name/Email/Phone/Address, etc.) are
          // ignored here. This preserves every row on the sheet as-is.
          break;
      }
    }
  } catch (_e) {
    // Never throw: a transient settings-read failure must not break the
    // retirement tab. We return whatever we had (all-null by default).
  }

  return out;
}

function parseSettingsNumberOrNull_(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return isFinite(raw) ? raw : null;
  }
  const stripped = String(raw).replace(/[^0-9.\-]/g, '');
  if (!stripped) return null;
  const n = Number(stripped);
  return isFinite(n) ? n : null;
}

function normalizePartneredSetting_(raw) {
  if (raw === true) return true;
  if (raw === false) return false;
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'yes' || s === 'y' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'n' || s === 'false' || s === '0') return false;
  return null;
}

function getRetirementSummarySafe_() {
  try {
    return getRetirementSummary_();
  } catch (e) {
    return {
      selectedScenario: 'Base',
      household: null,
      scenarios: null,
      analyses: null,
      analysis: null,
      error: e && e.message ? e.message : String(e)
    };
  }
}

function getRetirementModelData_(sheet) {
  const selectedScenario = getSelectedRetirementScenario_(sheet);
  const household = getRetirementHouseholdInputs_(sheet);
  const scenarios = {};
  const analyses = {};

  // Treat incomplete scenarios as inactive rather than validating /
  // calculating them. A scenario is "computable" only when it has BOTH
  // targetRetirementAge > 0 and householdRetirementSpendingPerYear > 0
  // (see `isRetirementScenarioComputable_`). Skipping the calc for
  // incomplete scenarios prevents two failure modes without touching
  // any calculation logic:
  //
  //   1. `validateRetirementScenarioInputs_` throwing because a blank
  //      Target Retirement Age (= 0) is less than the household's
  //      current age — which would flip the whole tab to the error
  //      state even if another scenario was fully populated.
  //   2. Rendering a misleading "$0 goal, 100% funded, can retire now"
  //      story from a scenario that has no spending input.
  //
  // We still record the raw inputs in `scenarios[name]` so the UI can
  // prefill the scenario form for editing; only `analyses[name]` is
  // left null for incomplete scenarios. The client's render helpers
  // (`renderRetirementScenarioCards`, `renderRetirementPanelInfo`,
  // `onRetirementScenarioChange`) already null-guard on
  // `analyses[name]`, so this degrades cleanly — the incomplete
  // scenario's card and info panel simply don't paint.
  RETIREMENT_SCENARIOS_.forEach(function(name) {
    const inputs = getRetirementScenarioInputs_(sheet, name);
    scenarios[name] = inputs;
    analyses[name] = isRetirementScenarioComputable_(inputs)
      ? calculateRetirementPlan_(household, inputs, name)
      : null;
  });

  return {
    selectedScenario: selectedScenario,
    household: household,
    scenarios: scenarios,
    analyses: analyses,
    analysis: analyses[selectedScenario]
  };
}

function getOrCreateRetirementSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'INPUT - Retirement';
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  sheet = ss.insertSheet(sheetName);

  // Brand-new retirement sheets start with neutral data. Personal /
  // financial seeds (ages, spending, social security, contributions)
  // are left blank so nothing misleading is displayed before the user
  // enters their own values via the Retirement Basics form or the full
  // scenario form. Only true generic, non-personal defaults remain —
  // expected return, inflation, safe withdrawal rate — which the user
  // can still edit. Existing retirement sheets are NOT touched by this
  // function (the `if (sheet) return sheet;` guard above short-circuits
  // before we reach this seed array), so populated workbooks keep every
  // value they already have.
  const rows = [
    ['Setting', 'Value', '', ''],
    ['Selected Scenario', 'Base', '', ''],
    ['', '', '', ''],
    ['Household Input', 'Value', '', ''],
    ['Your Current Age', '', '', ''],
    ['Spouse Current Age', '', '', ''],
    ['', '', '', ''],
    ['Scenario Input', 'Conservative', 'Base', 'Aggressive'],
    ['Target Retirement Age', '', '', ''],
    ['Household Retirement Spending / Year', '', '', ''],
    ['Your Social Security / Year', '', '', ''],
    ['Spouse Social Security / Year', '', '', ''],
    ['Other Retirement Income / Year', 0, 0, 0],
    ['Annual Contributions', '', '', ''],
    ['Expected Annual Return %', 4, 6, 8.5],
    ['Inflation %', 2.5, 2.5, 2.25],
    ['Safe Withdrawal Rate %', 4, 4, 4.25],
    ['One-Time Future Cash Needs', 0, 0, 100000],
    ['', '', '', ''],
    ['Selected Scenario Output', 'Value', '', ''],
    ['Current Investable Assets', '', '', ''],
    ['Retirement Goal Amount', '', '', ''],
    ['Funded %', '', '', ''],
    ['Can Retire Now', '', '', ''],
    ['Estimated Retirement Age', '', '', ''],
    ['Years Until Retirement', '', '', ''],
    ['Projected Assets At Target Age', '', '', ''],
    ['Surplus At Target Age', '', '', ''],
    ['Shortfall At Target Age', '', '', ''],
    ['Max Annual Spend Today', '', '', ''],
    ['Household Retirement Income / Year', '', '', ''],
    ['Spouse Age At Retirement', '', '', ''],
    ['Real Return %', '', '', ''],
    ['Money Runs Out Age', '', '', ''],
    ['Monte Carlo Success %', '', '', ''],
    ['Scenario Summary', '', '', '']
  ];

  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.setColumnWidths(1, 4, 220);

  sheet.getRange('A1:D1').setFontWeight('bold');
  sheet.getRange('A4:B4').setFontWeight('bold');
  sheet.getRange('A8:D8').setFontWeight('bold');
  sheet.getRange('A20:B20').setFontWeight('bold');

  applyCurrencyFormat_(sheet.getRange('B10:D10'));
  applyCurrencyFormat_(sheet.getRange('B11:D11'));
  applyCurrencyFormat_(sheet.getRange('B12:D12'));
  applyCurrencyFormat_(sheet.getRange('B13:D13'));
  applyCurrencyFormat_(sheet.getRange('B14:D14'));
  sheet.getRange('B15:D15').setNumberFormat('0.00');
  sheet.getRange('B16:D16').setNumberFormat('0.00');
  sheet.getRange('B17:D17').setNumberFormat('0.00');
  applyCurrencyFormat_(sheet.getRange('B18:D18'));

  applyCurrencyFormat_(sheet.getRange('B21'));
  applyCurrencyFormat_(sheet.getRange('B22'));
  sheet.getRange('B23').setNumberFormat('0.00%');
  sheet.getRange('B24').setNumberFormat('@');
  sheet.getRange('B25').setNumberFormat('0');
  sheet.getRange('B26').setNumberFormat('0');
  applyCurrencyFormat_(sheet.getRange('B27'));
  applyCurrencyFormat_(sheet.getRange('B28'));
  applyCurrencyFormat_(sheet.getRange('B29'));
  applyCurrencyFormat_(sheet.getRange('B30'));
  applyCurrencyFormat_(sheet.getRange('B31'));
  sheet.getRange('B32').setNumberFormat('0');
  sheet.getRange('B33').setNumberFormat('0.00%');
  sheet.getRange('B34').setNumberFormat('@');
  sheet.getRange('B35').setNumberFormat('0.00%');

  return sheet;
}

function getSelectedRetirementScenario_(sheet) {
  const cell = findLabelValueCell_(sheet, 'Selected Scenario');
  const value = cell ? String(cell.getValue() || '').trim() : 'Base';
  return normalizeRetirementScenario_(value || 'Base');
}

function setSelectedRetirementScenario_(sheet, scenarioName) {
  const cell = findLabelValueCell_(sheet, 'Selected Scenario');
  if (!cell) throw new Error('Selected Scenario label not found.');
  cell.setValue(normalizeRetirementScenario_(scenarioName));
}

function normalizeRetirementScenario_(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'conservative') return 'Conservative';
  if (text === 'aggressive') return 'Aggressive';
  return 'Base';
}

function getRetirementHouseholdInputs_(sheet) {
  return {
    yourCurrentAge: toNumber_(findLabelValueCell_(sheet, 'Your Current Age').getValue()),
    spouseCurrentAge: toNumber_(findLabelValueCell_(sheet, 'Spouse Current Age').getValue())
  };
}

function writeRetirementHouseholdInputs_(sheet, household) {
  setRetirementLabelValue_(sheet, 'Your Current Age', round2_(household.yourCurrentAge));
  setRetirementLabelValue_(sheet, 'Spouse Current Age', round2_(household.spouseCurrentAge));
}

function getRetirementScenarioInputs_(sheet, scenarioName) {
  const col = getRetirementScenarioColumn_(scenarioName);
  return {
    targetRetirementAge: toNumber_(sheet.getRange(getRetirementScenarioRow_('Target Retirement Age'), col).getValue()),
    householdRetirementSpendingPerYear: toNumber_(sheet.getRange(getRetirementScenarioRow_('Household Retirement Spending / Year'), col).getValue()),
    yourSocialSecurityPerYear: toNumber_(sheet.getRange(getRetirementScenarioRow_('Your Social Security / Year'), col).getValue()),
    spouseSocialSecurityPerYear: toNumber_(sheet.getRange(getRetirementScenarioRow_('Spouse Social Security / Year'), col).getValue()),
    otherRetirementIncomePerYear: toNumber_(sheet.getRange(getRetirementScenarioRow_('Other Retirement Income / Year'), col).getValue()),
    annualContributions: toNumber_(sheet.getRange(getRetirementScenarioRow_('Annual Contributions'), col).getValue()),
    expectedAnnualReturnPct: toNumber_(sheet.getRange(getRetirementScenarioRow_('Expected Annual Return %'), col).getValue()),
    inflationPct: toNumber_(sheet.getRange(getRetirementScenarioRow_('Inflation %'), col).getValue()),
    safeWithdrawalRatePct: toNumber_(sheet.getRange(getRetirementScenarioRow_('Safe Withdrawal Rate %'), col).getValue()),
    oneTimeFutureCashNeeds: toNumber_(sheet.getRange(getRetirementScenarioRow_('One-Time Future Cash Needs'), col).getValue())
  };
}

function writeRetirementScenarioInputs_(sheet, scenarioName, inputs) {
  const col = getRetirementScenarioColumn_(scenarioName);
  sheet.getRange(getRetirementScenarioRow_('Target Retirement Age'), col).setValue(round2_(inputs.targetRetirementAge));
  sheet.getRange(getRetirementScenarioRow_('Household Retirement Spending / Year'), col).setValue(round2_(inputs.householdRetirementSpendingPerYear));
  sheet.getRange(getRetirementScenarioRow_('Your Social Security / Year'), col).setValue(round2_(inputs.yourSocialSecurityPerYear));
  sheet.getRange(getRetirementScenarioRow_('Spouse Social Security / Year'), col).setValue(round2_(inputs.spouseSocialSecurityPerYear));
  sheet.getRange(getRetirementScenarioRow_('Other Retirement Income / Year'), col).setValue(round2_(inputs.otherRetirementIncomePerYear));
  sheet.getRange(getRetirementScenarioRow_('Annual Contributions'), col).setValue(round2_(inputs.annualContributions));
  sheet.getRange(getRetirementScenarioRow_('Expected Annual Return %'), col).setValue(round2_(inputs.expectedAnnualReturnPct));
  sheet.getRange(getRetirementScenarioRow_('Inflation %'), col).setValue(round2_(inputs.inflationPct));
  sheet.getRange(getRetirementScenarioRow_('Safe Withdrawal Rate %'), col).setValue(round2_(inputs.safeWithdrawalRatePct));
  sheet.getRange(getRetirementScenarioRow_('One-Time Future Cash Needs'), col).setValue(round2_(inputs.oneTimeFutureCashNeeds));
}

function getRetirementScenarioColumn_(scenarioName) {
  const name = normalizeRetirementScenario_(scenarioName);
  if (name === 'Conservative') return 2;
  if (name === 'Base') return 3;
  return 4;
}

function getRetirementScenarioRow_(label) {
  const map = {
    'Target Retirement Age': 9,
    'Household Retirement Spending / Year': 10,
    'Your Social Security / Year': 11,
    'Spouse Social Security / Year': 12,
    'Other Retirement Income / Year': 13,
    'Annual Contributions': 14,
    'Expected Annual Return %': 15,
    'Inflation %': 16,
    'Safe Withdrawal Rate %': 17,
    'One-Time Future Cash Needs': 18
  };
  if (!Object.prototype.hasOwnProperty.call(map, label)) {
    throw new Error('Unknown retirement scenario row: ' + label);
  }
  return map[label];
}

function setRetirementLabelValue_(sheet, label, value) {
  const cell = findLabelValueCell_(sheet, label);
  if (!cell) throw new Error('Retirement sheet label not found: ' + label);
  cell.setValue(value);
}

function writeRetirementOutputs_(sheet, analysis) {
  setRetirementLabelValue_(sheet, 'Current Investable Assets', analysis.currentInvestableAssets);
  setRetirementLabelValue_(sheet, 'Retirement Goal Amount', analysis.retirementGoalAmount);
  setRetirementLabelValue_(sheet, 'Funded %', analysis.fundedPct / 100);
  setRetirementLabelValue_(sheet, 'Can Retire Now', analysis.canRetireNow ? 'Yes' : 'No');
  setRetirementLabelValue_(sheet, 'Estimated Retirement Age', analysis.estimatedRetirementAge === null ? '' : analysis.estimatedRetirementAge);
  setRetirementLabelValue_(sheet, 'Years Until Retirement', analysis.yearsUntilRetirement === null ? '' : analysis.yearsUntilRetirement);
  setRetirementLabelValue_(sheet, 'Projected Assets At Target Age', analysis.projectedAssetsAtTargetAge);
  setRetirementLabelValue_(sheet, 'Surplus At Target Age', analysis.surplusAtTargetAge);
  setRetirementLabelValue_(sheet, 'Shortfall At Target Age', analysis.shortfallAtTargetAge);
  setRetirementLabelValue_(sheet, 'Max Annual Spend Today', analysis.maxAnnualSpendToday);
  setRetirementLabelValue_(sheet, 'Household Retirement Income / Year', analysis.householdRetirementIncomePerYear);
  setRetirementLabelValue_(sheet, 'Spouse Age At Retirement', analysis.spouseAgeAtRetirement === null ? '' : analysis.spouseAgeAtRetirement);
  setRetirementLabelValue_(sheet, 'Real Return %', analysis.realReturnPct / 100);
  setRetirementLabelValue_(sheet, 'Money Runs Out Age', analysis.moneyRunsOutAge === null ? 'Never (under assumptions)' : analysis.moneyRunsOutAge);
  setRetirementLabelValue_(sheet, 'Monte Carlo Success %', analysis.monteCarloSuccessProbabilityPct / 100);
  setRetirementLabelValue_(sheet, 'Scenario Summary', analysis.summary);
}

function validateRetirementHousehold_(household) {
  if (household.yourCurrentAge <= 0) throw new Error('Your Current Age must be greater than 0.');
  if (household.spouseCurrentAge < 0) throw new Error('Spouse Current Age cannot be negative.');
}

function validateRetirementScenarioInputs_(household, inputs) {
  if (inputs.targetRetirementAge < household.yourCurrentAge) {
    throw new Error('Target Retirement Age must be greater than or equal to Your Current Age.');
  }
  if (inputs.householdRetirementSpendingPerYear < 0) throw new Error('Household Retirement Spending / Year cannot be negative.');
  if (inputs.yourSocialSecurityPerYear < 0) throw new Error('Your Social Security / Year cannot be negative.');
  if (inputs.spouseSocialSecurityPerYear < 0) throw new Error('Spouse Social Security / Year cannot be negative.');
  if (inputs.otherRetirementIncomePerYear < 0) throw new Error('Other Retirement Income / Year cannot be negative.');
  if (inputs.annualContributions < 0) throw new Error('Annual Contributions cannot be negative.');
  if (inputs.expectedAnnualReturnPct < -100) throw new Error('Expected Annual Return % is invalid.');
  if (inputs.inflationPct < -100) throw new Error('Inflation % is invalid.');
  if (inputs.safeWithdrawalRatePct <= 0) throw new Error('Safe Withdrawal Rate % must be greater than 0.');
  if (inputs.oneTimeFutureCashNeeds < 0) throw new Error('One-Time Future Cash Needs cannot be negative.');
}

function calculateRetirementPlan_(household, inputs, scenarioName) {
  validateRetirementHousehold_(household);
  validateRetirementScenarioInputs_(household, inputs);

  const currentInvestableAssets = getCurrentInvestableAssetsForRetirement_();
  const householdRetirementIncomePerYear =
    inputs.yourSocialSecurityPerYear +
    inputs.spouseSocialSecurityPerYear +
    inputs.otherRetirementIncomePerYear;

  const spendingNeed = Math.max(0, inputs.householdRetirementSpendingPerYear - householdRetirementIncomePerYear);
  const retirementGoalAmount = round2_(
    spendingNeed / (inputs.safeWithdrawalRatePct / 100) + inputs.oneTimeFutureCashNeeds
  );

  const fundedPct = retirementGoalAmount > 0
    ? round2_((currentInvestableAssets / retirementGoalAmount) * 100)
    : 100;

  const canRetireNow = currentInvestableAssets >= retirementGoalAmount;
  const realReturn = ((1 + inputs.expectedAnnualReturnPct / 100) / (1 + inputs.inflationPct / 100)) - 1;

  let estimatedRetirementAge = null;
  let yearsUntilRetirement = null;
  let projectedAssetsAtTargetAge = currentInvestableAssets;

  for (let y = 0; y <= 70; y++) {
    const age = household.yourCurrentAge + y;
    const projected = projectRetirementAssets_(currentInvestableAssets, inputs.annualContributions, realReturn, y);

    if (age === inputs.targetRetirementAge) {
      projectedAssetsAtTargetAge = projected;
    }

    if (estimatedRetirementAge === null && projected >= retirementGoalAmount) {
      estimatedRetirementAge = age;
      yearsUntilRetirement = y;
    }
  }

  if (inputs.targetRetirementAge === household.yourCurrentAge) {
    projectedAssetsAtTargetAge = currentInvestableAssets;
  }

  const gapAtTargetAge = round2_(retirementGoalAmount - projectedAssetsAtTargetAge);
  const surplusAtTargetAge = gapAtTargetAge < 0 ? round2_(Math.abs(gapAtTargetAge)) : 0;
  const shortfallAtTargetAge = gapAtTargetAge > 0 ? round2_(gapAtTargetAge) : 0;

  const maxAnnualSpendToday = round2_(
    currentInvestableAssets * (inputs.safeWithdrawalRatePct / 100) + householdRetirementIncomePerYear
  );

  const spouseAgeAtRetirement = inputs.targetRetirementAge - household.yourCurrentAge + household.spouseCurrentAge;
  const moneyRunsOutAge = simulateMoneyRunsOutAge_(
    projectedAssetsAtTargetAge,
    spendingNeed,
    realReturn,
    inputs.targetRetirementAge
  );

  const monteCarloSuccessProbabilityPct = simulateMonteCarloSuccess_({
    currentAge: household.yourCurrentAge,
    retirementAge: inputs.targetRetirementAge,
    currentAssets: currentInvestableAssets,
    annualContribution: inputs.annualContributions,
    annualSpendingNeed: spendingNeed,
    meanRealReturn: realReturn,
    endAge: 95,
    simulations: 350
  });

  let summary = '';
  if (canRetireNow) {
    summary = scenarioName + ': household is already funded for retirement under current assumptions.';
  } else if (estimatedRetirementAge !== null) {
    summary = scenarioName + ': estimated retirement age is ' + estimatedRetirementAge + '.';
  } else {
    summary = scenarioName + ': retirement goal is not reached within the modeled horizon.';
  }

  return {
    scenarioName: scenarioName,
    yourCurrentAge: household.yourCurrentAge,
    spouseCurrentAge: household.spouseCurrentAge,
    targetRetirementAge: inputs.targetRetirementAge,
    spouseAgeAtRetirement: round2_(spouseAgeAtRetirement),
    currentInvestableAssets: round2_(currentInvestableAssets),
    householdRetirementIncomePerYear: round2_(householdRetirementIncomePerYear),
    retirementGoalAmount: round2_(retirementGoalAmount),
    fundedPct: round2_(fundedPct),
    canRetireNow: canRetireNow,
    estimatedRetirementAge: estimatedRetirementAge,
    yearsUntilRetirement: yearsUntilRetirement,
    projectedAssetsAtTargetAge: round2_(projectedAssetsAtTargetAge),
    surplusAtTargetAge: round2_(surplusAtTargetAge),
    shortfallAtTargetAge: round2_(shortfallAtTargetAge),
    maxAnnualSpendToday: round2_(maxAnnualSpendToday),
    realReturnPct: round2_(realReturn * 100),
    moneyRunsOutAge: moneyRunsOutAge,
    monteCarloSuccessProbabilityPct: round2_(monteCarloSuccessProbabilityPct),
    summary: summary
  };
}

function projectRetirementAssets_(startingAssets, annualContributions, realReturn, years) {
  let assets = Number(startingAssets || 0);
  for (let i = 0; i < years; i++) {
    assets = assets * (1 + realReturn) + annualContributions;
  }
  return round2_(assets);
}

function simulateMoneyRunsOutAge_(startingAssetsAtRetirement, annualSpendingNeed, realReturn, retirementAge) {
  let assets = Number(startingAssetsAtRetirement || 0);

  if (annualSpendingNeed <= 0) return null;

  for (let age = retirementAge; age <= 110; age++) {
    assets = assets * (1 + realReturn) - annualSpendingNeed;
    if (assets <= 0) return age;
  }
  return null;
}

function simulateMonteCarloSuccess_(cfg) {
  const simulations = cfg.simulations || 300;
  let successCount = 0;

  for (let i = 0; i < simulations; i++) {
    let assets = Number(cfg.currentAssets || 0);

    for (let age = cfg.currentAge; age < cfg.retirementAge; age++) {
      const yearlyReturn = randomNormal_(cfg.meanRealReturn, 0.12);
      assets = assets * (1 + yearlyReturn) + cfg.annualContribution;
      if (assets <= 0) break;
    }

    if (assets > 0) {
      for (let age2 = cfg.retirementAge; age2 <= cfg.endAge; age2++) {
        const yearlyReturn2 = randomNormal_(cfg.meanRealReturn, 0.10);
        assets = assets * (1 + yearlyReturn2) - cfg.annualSpendingNeed;
        if (assets <= 0) break;
      }
    }

    if (assets > 0) successCount++;
  }

  return round2_((successCount / simulations) * 100);
}

function randomNormal_(mean, stdDev) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

function getCurrentInvestableAssetsForRetirement_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet_(ss, 'ASSETS');
  return sumColumnByHeader_(sheet, 'Current Balance');
}