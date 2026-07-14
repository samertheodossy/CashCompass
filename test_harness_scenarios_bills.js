/**
 * test_harness_scenarios_bills.js — Test Harness · Bills regression scenarios.
 *
 * This file holds TWO complementary levels of Bills regression coverage. Keep both:
 *
 *   1. PURE recurrence (REGRESSION-BILLS-MONTHLY)
 *      Validates only the recurrence engine math (dashboard_data.js:
 *      buildInputBillDueCandidates_ → buildRuleFromBillRow_ + generateOccurrences_).
 *      The engine is deterministic — it takes an explicit `todayOnly` anchor and does
 *      no `new Date()` internally — so it needs no clock seam (E0c). Fast, no sheets.
 *
 *   2. WORKBOOK INTEGRATION (REGRESSION-BILLS-MONTHLY-INTEGRATION)
 *      Validates *visible workbook behavior*: it seeds a real, inspectable
 *      `INPUT - Bills` sheet (canonical header + a realistic bill row) and a
 *      `LOG - Activity` bill_add row on the disposable workbook, then asserts the
 *      visible facts (payee / amount / due day / next occurrence / activity row).
 *      This is what you open and eyeball to confirm the workbook looks right.
 *
 * Why not just call the production add-bill function?  `addBillFromDashboard` and
 * `ensureOnboardingBillsSheetFromDashboard` resolve their own workbook via
 * `getUserSpreadsheet_()` (no `ss` seam), so calling them from the harness could write
 * to a REAL Central/bound workbook. (The Cash Flow sheet DOES now have an ss-scoped
 * seam — buildCashFlowYearSheet_(ss, year) — which the Cash Flow scenario reuses; the
 * getUserSpreadsheet_()-bound wrapper ensureCashFlowYearSheet_ stays off-limits.) The integration
 * scenario therefore mirrors the established donation-smoke pattern: provision the
 * canonical Bills sheet on `ctx.ss` and use only sheet-/ss-scoped helpers
 * (`ensureBillsSheetSchema_`, `applyBillsSheetStyling_`, `appendActivityLog_(ss, …)`).
 * The seeded row uses the SAME field mapping production uses in addBillFromDashboard.
 *
 * TEMPLATE for every future Bills scenario (Weekly / Weekly-on-Day / Biweekly /
 * Yearly / 31st-of-month / leap year / year rollover / overdue / paid / AutoPay):
 *   1. setup(ctx)  — provision a minimal valid workbook (runMinimalBootstrap_) so
 *      the harness gate (Provisioning must PASS) is satisfied. The workbook is just
 *      the disposable VEHICLE; the recurrence test itself is pure and needs no
 *      sheet data.
 *   2. expectedOutcome(ctx) — call the pure engine with EXPLICIT dates/params
 *      (normalizeFrequency_ first), then assert with ctx.assert.dateEquals /
 *      .equals. No dashboard, no Bills-Due, no wall clock.
 *
 * SAFETY: read/compare + minimal provisioning of the disposable workbook only.
 * No production behavior changes.
 */

/**
 * REGRESSION-BILLS-MONTHLY — the reference Bills recurrence scenario.
 *
 * Bill: Monthly, Due Day 15, Start Month 1. Anchored at Jan 10, 2026, the engine's
 * [-1, 0, +1] month window yields exactly three occurrences: Dec 15 2025, Jan 15
 * 2026, Feb 15 2026 (sorted ascending). We assert the count, the prior occurrence,
 * the next occurrence on/after "today" (the due date), and the one-month
 * advancement to the following occurrence.
 *
 * @returns {Object} scenario
 */
function getHarnessBillsMonthlyScenario_() {
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string') ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  return {
    id: 'REGRESSION-BILLS-MONTHLY',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    description: 'Validate the pure Bills recurrence engine for a Monthly bill (Due Day 15): occurrence count, prior/next occurrence, and one-month advancement.',
    // The workbook is only a disposable vehicle; this scenario provisions the same
    // minimal structure SMOKE does so Provisioning PASSes (scoped to these sheets).
    expectedSheets: [settingsName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision minimal workbook (runMinimalBootstrap_ → INPUT - Settings)');
    },
    // No sheet writes needed — the recurrence engine is pure. actions is a no-op so
    // the template's shape (setup → actions → expectedOutcome) stays explicit.
    actions: function(ctx) {
      ctx.actions.push('No seeding required — recurrence engine is pure (explicit dates)');
    },
    // Functional assertions (E0a) against the PURE recurrence engine — deterministic
    // via an explicit anchor date; no wall clock, no rendering.
    expectedOutcome: function(ctx) {
      // Fixed inputs — the whole point is determinism.
      var todayOnly = new Date(2026, 0, 10);          // Jan 10, 2026 (explicit anchor)
      var dueDay = 15;
      var startMonth = 1;
      var freq = (typeof normalizeFrequency_ === 'function')
        ? normalizeFrequency_('Monthly') : 'monthly'; // → 'monthly'

      if (typeof buildInputBillDueCandidates_ !== 'function') {
        throw new Error('Bills recurrence engine (buildInputBillDueCandidates_) not available.');
      }
      // (todayOnly, dueDay, frequency, startMonth, weekday, effectiveDate, anchorDate)
      var occs = buildInputBillDueCandidates_(todayOnly, dueDay, freq, startMonth, '', null, null);
      occs = (occs || []).slice().sort(function(a, b) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      });

      var mod = 'Bills';

      // Window completeness: prior / current / next month around the anchor.
      ctx.assert.equals('Monthly occurrence count (Dec/Jan/Feb window)', occs.length, 3, {
        module: mod
      });

      // Prior-month occurrence.
      ctx.assert.dateEquals('Prior monthly occurrence',
        occs[0] && occs[0].dueDate, new Date(2025, 11, 15), { module: mod });

      // Next occurrence on/after "today" — this is the expected NEXT due date.
      var next = null;
      for (var i = 0; i < occs.length; i++) {
        if (occs[i].dueDate.getTime() >= todayOnly.getTime()) { next = occs[i]; break; }
      }
      ctx.assert.dateEquals('Next monthly occurrence / due date (>= Jan 10 2026)',
        next && next.dueDate, new Date(2026, 0, 15), { module: mod });

      // Recurrence advancement: the occurrence after "next" is exactly one month later.
      ctx.assert.dateEquals('Monthly advancement (Jan 15 → Feb 15)',
        occs[2] && occs[2].dueDate, new Date(2026, 1, 15), { module: mod });
    }
  };
}

/**
 * REGRESSION-BILLS-WEEKLY — legacy Weekly recurrence (no weekday).
 *
 * Legacy weekly (frequency=Weekly, Due Day 10, no weekday) re-anchors **each calendar
 * month** at clamp(dueDay, 1..daysInMonth) and steps +7 within that month — it is NOT
 * a global 7-day chain. Anchored at Jan 10, 2026, the [-1,0,+1] month window yields:
 *   Dec 2025: 10, 17, 24, 31   Jan 2026: 10, 17, 24, 31   Feb 2026: 10, 17, 24
 * → 11 occurrences. We assert the count, the in-month 7-day cadence, prior/current/next
 * around "today", and the tell-tale per-month RE-ANCHOR (Dec 31 → Jan 10 = 10 days, not
 * 7). That last assertion pins the surprising-but-intended legacy behavior.
 *
 * @returns {Object} scenario
 */
function getHarnessBillsWeeklyScenario_() {
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string') ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  return {
    id: 'REGRESSION-BILLS-WEEKLY',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    description: 'Validate the pure Bills recurrence engine for a legacy Weekly bill (Due Day 10, no weekday): occurrence count, in-month 7-day cadence, prior/current/next occurrence, and per-month re-anchoring across the month boundary.',
    expectedSheets: [settingsName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision minimal workbook (runMinimalBootstrap_ → INPUT - Settings)');
    },
    actions: function(ctx) {
      ctx.actions.push('No seeding required — recurrence engine is pure (explicit dates)');
    },
    expectedOutcome: function(ctx) {
      var todayOnly = new Date(2026, 0, 10);          // Jan 10, 2026 (explicit anchor)
      var dueDay = 10;
      var startMonth = 1;
      var freq = (typeof normalizeFrequency_ === 'function')
        ? normalizeFrequency_('Weekly') : 'weekly';

      if (typeof buildInputBillDueCandidates_ !== 'function') {
        throw new Error('Bills recurrence engine (buildInputBillDueCandidates_) not available.');
      }
      var occs = (buildInputBillDueCandidates_(todayOnly, dueDay, freq, startMonth, '', null, null) || [])
        .slice().sort(function(a, b) { return a.dueDate.getTime() - b.dueDate.getTime(); });

      var mod = 'Bills';

      // Window completeness.
      ctx.assert.equals('Weekly occurrence count (Dec/Jan/Feb window)', occs.length, 11, { module: mod });

      // In-month 7-day cadence (first two occurrences).
      ctx.assert.dateEquals('First weekly occurrence (Dec 10 2025)',
        occs[0] && occs[0].dueDate, new Date(2025, 11, 10), { module: mod });
      ctx.assert.dateEquals('7-day advancement (Dec 10 → Dec 17)',
        occs[1] && occs[1].dueDate, new Date(2025, 11, 17), { module: mod });

      // Prior / current / next relative to "today" (Jan 10, 2026).
      var prev = null, curr = null, next = null;
      for (var i = 0; i < occs.length; i++) {
        var t = occs[i].dueDate.getTime();
        if (t < todayOnly.getTime()) prev = occs[i];
        else if (t === todayOnly.getTime()) curr = occs[i];
        else { next = occs[i]; break; }
      }
      ctx.assert.dateEquals('Previous weekly occurrence (< Jan 10 2026)',
        prev && prev.dueDate, new Date(2025, 11, 31), { module: mod });
      ctx.assert.dateEquals('Current weekly occurrence (== Jan 10 2026)',
        curr && curr.dueDate, new Date(2026, 0, 10), { module: mod });
      ctx.assert.dateEquals('Next weekly occurrence (> Jan 10 2026)',
        next && next.dueDate, new Date(2026, 0, 17), { module: mod });

      // Legacy re-anchor: the last Dec occurrence (Dec 31) to the first Jan occurrence
      // (Jan 10) is a 10-day gap, NOT 7 — legacy weekly restarts at Due Day each month.
      var gapAcrossMonth = Math.round(
        (new Date(2026, 0, 10).getTime() - new Date(2025, 11, 31).getTime()) / 86400000);
      ctx.assert.equals('Legacy weekly re-anchors per month (Dec 31 → Jan 10 = 10 days, not 7)',
        gapAcrossMonth, 10, { module: mod });
    }
  };
}

/**
 * REGRESSION-BILLS-WEEKLY-ON-DAY — Weekly recurrence pinned to a weekday.
 *
 * With a weekday set (Sunday), the engine IGNORES Due Day and generates every Sunday
 * with a CONTINUOUS +7 cadence across month/year boundaries (no gap, no dup). Anchored
 * at Jan 10, 2026, the [-1,0,+1] month window yields all Sundays in Dec 2025 (7,14,21,28),
 * Jan 2026 (4,11,18,25) and Feb 2026 (1,8,15,22) → 12 occurrences. We assert the count,
 * that EVERY occurrence lands on Sunday (weekday correctness), the +7 advancement,
 * continuous cross-month cadence, and the next Sunday on/after "today".
 *
 * @returns {Object} scenario
 */
function getHarnessBillsWeeklyOnDayScenario_() {
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string') ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  return {
    id: 'REGRESSION-BILLS-WEEKLY-ON-DAY',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    description: 'Validate the pure Bills recurrence engine for a Weekly-on-weekday bill (Sunday): weekday correctness for every occurrence, count, continuous +7 cadence across months, and the next Sunday on/after "today".',
    expectedSheets: [settingsName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision minimal workbook (runMinimalBootstrap_ → INPUT - Settings)');
    },
    actions: function(ctx) {
      ctx.actions.push('No seeding required — recurrence engine is pure (explicit dates)');
    },
    expectedOutcome: function(ctx) {
      var todayOnly = new Date(2026, 0, 10);          // Jan 10, 2026 (explicit anchor)
      var dueDay = 1;                                  // ignored in weekday mode
      var startMonth = 1;
      var weekday = 'Sunday';
      var freq = (typeof normalizeFrequency_ === 'function')
        ? normalizeFrequency_('Weekly') : 'weekly';

      if (typeof buildInputBillDueCandidates_ !== 'function') {
        throw new Error('Bills recurrence engine (buildInputBillDueCandidates_) not available.');
      }
      var occs = (buildInputBillDueCandidates_(todayOnly, dueDay, freq, startMonth, weekday, null, null) || [])
        .slice().sort(function(a, b) { return a.dueDate.getTime() - b.dueDate.getTime(); });

      var mod = 'Bills';

      // Window completeness.
      ctx.assert.equals('Weekly-on-Sunday occurrence count (Dec/Jan/Feb window)', occs.length, 12, { module: mod });

      // Weekday correctness for EVERY occurrence (Sunday === getDay() 0).
      var sundayCount = 0;
      for (var i = 0; i < occs.length; i++) {
        if (occs[i].dueDate.getDay() === 0) sundayCount++;
      }
      ctx.assert.equals('Every occurrence lands on Sunday (getDay()===0)', sundayCount, occs.length, { module: mod });

      // Continuous +7 cadence across month boundaries (every consecutive gap === 7).
      var all7 = true;
      for (var j = 1; j < occs.length; j++) {
        var gap = Math.round((occs[j].dueDate.getTime() - occs[j - 1].dueDate.getTime()) / 86400000);
        if (gap !== 7) { all7 = false; break; }
      }
      ctx.assert.equals('Continuous 7-day cadence across months (all gaps === 7)', all7, true, { module: mod });

      // First occurrence and +7 advancement.
      ctx.assert.dateEquals('First Sunday occurrence (Dec 7 2025)',
        occs[0] && occs[0].dueDate, new Date(2025, 11, 7), { module: mod });
      ctx.assert.dateEquals('Weekly advancement (Dec 7 → Dec 14)',
        occs[1] && occs[1].dueDate, new Date(2025, 11, 14), { module: mod });

      // Next Sunday on/after "today" (Jan 10, 2026) — Jan 11, 2026.
      var next = null;
      for (var k = 0; k < occs.length; k++) {
        if (occs[k].dueDate.getTime() >= todayOnly.getTime()) { next = occs[k]; break; }
      }
      ctx.assert.dateEquals('Next Sunday on/after Jan 10 2026 (Jan 11 2026)',
        next && next.dueDate, new Date(2026, 0, 11), { module: mod });
    }
  };
}

/**
 * REGRESSION-BILLS-BIWEEKLY — anchor-driven Biweekly recurrence (true 14-day cadence).
 *
 * Biweekly activates its continuous cadence only when a weekday AND an anchor date are
 * both valid and the anchor lands on that weekday. With anchor = Mon Dec 15, 2025 and
 * weekday = Monday, the engine steps +14 days from the anchor across the window
 * (Dec 1 2025 … Feb 28 2026 inclusive), yielding:
 *   Dec 15, Dec 29, Jan 12 (month + YEAR crossing), Jan 26, Feb 9, Feb 23 → 6 occurrences.
 * We assert the count, the anchor as the first occurrence, the 14-day cadence (all gaps),
 * the Dec→Jan month+year crossing, and the correct next occurrence on/after "today".
 *
 * @returns {Object} scenario
 */
function getHarnessBillsBiweeklyScenario_() {
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string') ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  return {
    id: 'REGRESSION-BILLS-BIWEEKLY',
    category: 'REGRESSION',
    executionLevel: 'PURE',
    description: 'Validate the pure Bills recurrence engine for an anchor-driven Biweekly bill (anchor Mon Dec 15 2025): 14-day cadence, month + year crossing (Dec 29 → Jan 12), occurrence count, and the correct next occurrence on/after "today".',
    expectedSheets: [settingsName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision minimal workbook (runMinimalBootstrap_ → INPUT - Settings)');
    },
    actions: function(ctx) {
      ctx.actions.push('No seeding required — recurrence engine is pure (explicit dates)');
    },
    expectedOutcome: function(ctx) {
      var todayOnly = new Date(2026, 0, 10);          // Jan 10, 2026 (explicit anchor)
      var dueDay = 15;                                 // ignored in anchor mode
      var startMonth = 1;
      var weekday = 'Monday';
      var anchorDate = new Date(2025, 11, 15);        // Mon Dec 15, 2025 (lands on Monday)
      var freq = (typeof normalizeFrequency_ === 'function')
        ? normalizeFrequency_('Biweekly') : 'biweekly';

      if (typeof buildInputBillDueCandidates_ !== 'function') {
        throw new Error('Bills recurrence engine (buildInputBillDueCandidates_) not available.');
      }
      // (todayOnly, dueDay, frequency, startMonth, weekday, effectiveDate, anchorDate)
      var occs = (buildInputBillDueCandidates_(todayOnly, dueDay, freq, startMonth, weekday, null, anchorDate) || [])
        .slice().sort(function(a, b) { return a.dueDate.getTime() - b.dueDate.getTime(); });

      var mod = 'Bills';

      // Window completeness.
      ctx.assert.equals('Biweekly occurrence count (anchor Dec 15 window)', occs.length, 6, { module: mod });

      // Anchor is the first occurrence; +14 advancement.
      ctx.assert.dateEquals('Anchor occurrence (Dec 15 2025)',
        occs[0] && occs[0].dueDate, new Date(2025, 11, 15), { module: mod });
      ctx.assert.dateEquals('14-day advancement (Dec 15 → Dec 29)',
        occs[1] && occs[1].dueDate, new Date(2025, 11, 29), { module: mod });

      // Month + YEAR crossing: Dec 29 2025 → Jan 12 2026.
      ctx.assert.dateEquals('Biweekly month + year crossing (Dec 29 → Jan 12 2026)',
        occs[2] && occs[2].dueDate, new Date(2026, 0, 12), { module: mod });

      // True 14-day cadence for EVERY consecutive pair.
      var all14 = true;
      for (var j = 1; j < occs.length; j++) {
        var gap = Math.round((occs[j].dueDate.getTime() - occs[j - 1].dueDate.getTime()) / 86400000);
        if (gap !== 14) { all14 = false; break; }
      }
      ctx.assert.equals('14-day cadence (all consecutive gaps === 14)', all14, true, { module: mod });

      // Correct next occurrence on/after "today" (Jan 10, 2026) — Jan 12, 2026
      // (Dec 29 is before today; Jan 12 is the first on/after).
      var next = null;
      for (var k = 0; k < occs.length; k++) {
        if (occs[k].dueDate.getTime() >= todayOnly.getTime()) { next = occs[k]; break; }
      }
      ctx.assert.dateEquals('Next biweekly occurrence on/after Jan 10 2026 (Jan 12 2026)',
        next && next.dueDate, new Date(2026, 0, 12), { module: mod });
    }
  };
}

/**
 * REGRESSION-BILLS-MONTHLY-INTEGRATION — the first *inspectable* Bills scenario.
 *
 * Creates a disposable workbook that visibly contains a canonical `INPUT - Bills`
 * sheet with a realistic monthly bill (City Utilities · $125.00 · Monthly · Due Day
 * 15 · Manual pay) plus a matching `LOG - Activity` bill_add row, then asserts the
 * visible workbook facts. Open the disposable workbook (run with { trash:false }) to
 * eyeball the result.
 *
 * SCOPE (this first case):
 *   - Bills sheet + one bill row .......... created & asserted
 *   - Activity Log bill_add row ........... created & asserted UNCONDITIONALLY. A bill
 *                                           add ALWAYS logs a bill_add entry in
 *                                           production (dedupeKey empty → never deduped;
 *                                           the surrounding catch is resilience only), so
 *                                           a missing/incorrect row is a real defect.
 *   - Manual pay (Payment Source CASH) .... yes — AutoPay is a later dedicated scenario
 *   - Cash Flow linkage / Dashboard ....... DEFERRED to later scenarios. Cash Flow is
 *                                           CONDITIONAL in production (bill add seeds a
 *                                           Cash Flow row only if the year sheet already
 *                                           exists; otherwise it is a non-fatal skip),
 *                                           and faithful Cash Flow needs the canonical
 *                                           year-sheet builder, which is
 *                                           getUserSpreadsheet_()-bound today. Dashboard
 *                                           is a derived read view, not a persisted
 *                                           artifact written by add-bill.
 *
 * Provisioning is scoped to [INPUT - Settings, SYS - Meta] (the minimal canonical
 * structure this scenario guarantees). `INPUT - Bills` is not part of the canonical
 * Validator model, so it is validated by the FUNCTIONAL assertions below rather than
 * by the structural provisioning gate — which is exactly the integration point.
 *
 * @returns {Object} scenario
 */
function getHarnessBillsMonthlyIntegrationScenario_() {
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string') ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  return {
    id: 'REGRESSION-BILLS-MONTHLY-INTEGRATION',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    description: 'Integration: seed a real INPUT - Bills sheet (City Utilities, $125, Monthly, Due Day 15, Manual) + LOG - Activity row on a disposable workbook and assert the visible facts (payee/amount/due day/next occurrence/activity).',
    // Provisioning gate is scoped to the minimal canonical structure the scenario
    // guarantees; Bills/Activity visible facts are carried by functional assertions.
    expectedSheets: [settingsName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision minimal workbook (runMinimalBootstrap_ → INPUT - Settings)');
    },
    actions: function(ctx) {
      harnessSeedOneBillRow_(ctx);
    },
    expectedOutcome: function(ctx) {
      var mod = 'Bills';
      var b = ctx.seededBill;
      if (!b) throw new Error('REGRESSION-BILLS-MONTHLY-INTEGRATION: seeded bill context missing.');

      var billsName = b.sheetName;
      var payeeCol = b.colOf.Payee + 1;
      var amountCol = b.colOf['Default Amount'] + 1;
      var dueDayCol = b.colOf['Due Day'] + 1;

      // Bills sheet exists (canonical header cell present).
      ctx.assert.exists('Bills sheet exists', ctx.read.sheetValue(billsName, 1, 1),
        { module: mod, location: billsName + '!R1C1' });

      // Bill row exists (Payee cell populated).
      ctx.assert.exists('Bill row exists (Payee cell)', ctx.read.sheetValue(billsName, b.row, payeeCol),
        { module: mod, location: billsName + '!R' + b.row + 'C' + payeeCol });

      // Visible field values.
      ctx.assert.equals('Bill payee', ctx.read.sheetValue(billsName, b.row, payeeCol), 'City Utilities',
        { module: mod, location: billsName + '!R' + b.row + 'C' + payeeCol });
      ctx.assert.equals('Bill amount', ctx.read.sheetValue(billsName, b.row, amountCol), 125,
        { module: mod, location: billsName + '!R' + b.row + 'C' + amountCol });
      ctx.assert.equals('Bill due day', ctx.read.sheetValue(billsName, b.row, dueDayCol), 15,
        { module: mod, location: billsName + '!R' + b.row + 'C' + dueDayCol });

      // Next occurrence / due date — derive from the SEEDED row's values through the
      // pure recurrence engine (same engine the pure scenario exercises), anchored at
      // a deterministic "today".
      var todayOnly = new Date(2026, 0, 10);            // Jan 10, 2026 (explicit anchor)
      var freq = (typeof normalizeFrequency_ === 'function')
        ? normalizeFrequency_(b.frequency) : 'monthly';
      if (typeof buildInputBillDueCandidates_ === 'function') {
        var occs = (buildInputBillDueCandidates_(todayOnly, b.dueDay, freq, 1, '', null, null) || [])
          .slice().sort(function(a, c) { return a.dueDate.getTime() - c.dueDate.getTime(); });
        var next = null;
        for (var i = 0; i < occs.length; i++) {
          if (occs[i].dueDate.getTime() >= todayOnly.getTime()) { next = occs[i]; break; }
        }
        ctx.assert.dateEquals('Next occurrence / due date (>= Jan 10 2026)',
          next && next.dueDate, new Date(2026, 0, 15), { module: mod });
      }

      // Activity Log row — MANDATORY. Adding a bill always writes a bill_add entry:
      // production addBillFromDashboard calls appendActivityLog_ on every successful
      // add, dedupeKey is empty (never deduped), and the surrounding catch is a
      // resilience net, not an intentional skip. So the regression asserts the entry
      // and its content UNCONDITIONALLY — a missing/incorrect row is a real defect.
      var actName = (typeof ACTIVITY_LOG_SHEET_NAME === 'string') ? ACTIVITY_LOG_SHEET_NAME : 'LOG - Activity';
      ctx.assert.equals('Activity Log write succeeded (bill_add)', b.activityWrote, true,
        { module: mod, location: actName });
      ctx.assert.exists('Activity Log bill_add row', ctx.read.sheetValue(actName, 2, 1),
        { module: mod, location: actName + '!R2C1' });
      ctx.assert.equals('Activity Log event type', ctx.read.sheetValue(actName, 2, 2), 'bill_add',
        { module: mod, location: actName + '!R2C2' });
      ctx.assert.equals('Activity Log payee', ctx.read.sheetValue(actName, 2, 6), 'City Utilities',
        { module: mod, location: actName + '!R2C6' });
      ctx.assert.equals('Activity Log amount', ctx.read.sheetValue(actName, 2, 4), 125,
        { module: mod, location: actName + '!R2C4' });
    }
  };
}

/**
 * Seed one realistic monthly bill onto the disposable workbook, mirroring the
 * production write path WITHOUT the getUserSpreadsheet_()-bound top-level function.
 *
 * Provisions `INPUT - Bills` with the canonical 14-column header (identical to
 * ensureOnboardingBillsSheetFromDashboard), builds the row with the SAME field
 * mapping addBillFromDashboard uses, then best-effort mirrors the bill_add
 * `LOG - Activity` entry via the ss-scoped appendActivityLog_ helper.
 *
 * Records { sheetName, row, colOf, payee, amount, dueDay, frequency, activityWritten }
 * on ctx.seededBill for expectedOutcome to assert against.
 *
 * @param {Object} ctx harness context (ctx.ss, ctx.actions, ctx.assertWritable).
 */
function harnessSeedOneBillRow_(ctx) {
  var ss = ctx.ss;
  var billsName = (typeof getSheetNames_ === 'function' && getSheetNames_() && getSheetNames_().BILLS)
    ? getSheetNames_().BILLS : 'INPUT - Bills';

  // Canonical 14-column header — same order as ensureOnboardingBillsSheetFromDashboard.
  var header = [
    'Payee', 'Category', 'Due Day', 'Default Amount', 'Varies', 'Autopay', 'Active',
    'Payment Source', 'Frequency', 'Start Month', 'Notes',
    'Weekday', 'Anchor Date', 'Schedule Effective Date'
  ];

  var sheet = ss.getSheetByName(billsName);
  if (!sheet) {
    ctx.assertWritable();
    sheet = ss.insertSheet(billsName);
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    try {
      sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      var maxRows = sheet.getMaxRows();
      if (maxRows > 1) {
        sheet.getRange(2, 4, maxRows - 1, 1).setNumberFormat('$#,##0.00;-$#,##0.00');
      }
      if (typeof ensureBillsSheetSchema_ === 'function') ensureBillsSheetSchema_(sheet);
      if (typeof applyBillsSheetStyling_ === 'function') applyBillsSheetStyling_(sheet);
    } catch (styleErr) { /* cosmetic only — non-fatal */ }
    ctx.actions.push('Create ' + billsName + ' sheet (canonical 14-column header)');
  }

  // Build header→index map from the live header row (tolerant of casing / schema heal).
  var headerVals = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] || [];
  var colOf = {};
  for (var i = 0; i < headerVals.length; i++) {
    var label = String(headerVals[i] || '').trim();
    if (label) colOf[label] = i;
  }

  // Realistic fixture: manual-pay monthly bill.
  var payee = 'City Utilities';
  var category = 'Utilities';
  var dueDay = 15;
  var amount = 125;                 // 125.00
  var frequencyLabel = 'Monthly';
  var paymentSource = 'CASH';       // Manual pay (AutoPay is a later dedicated scenario)
  var startMonth = 1;
  var notes = 'Smoke integration test bill';

  var row = new Array(headerVals.length);
  for (var c = 0; c < row.length; c++) row[c] = '';
  function set_(labelName, value) {
    if (Object.prototype.hasOwnProperty.call(colOf, labelName)) row[colOf[labelName]] = value;
  }
  set_('Payee', payee);
  set_('Category', category);
  set_('Due Day', dueDay);
  set_('Default Amount', amount);
  set_('Varies', 'No');
  set_('Autopay', 'No');
  set_('Active', 'Yes');
  set_('Payment Source', paymentSource);
  set_('Frequency', frequencyLabel);
  set_('Start Month', startMonth);
  set_('Notes', notes);

  ctx.assertWritable();
  var row1 = sheet.getLastRow() + 1;
  sheet.getRange(row1, 1, 1, row.length).setValues([row]);
  try {
    sheet.getRange(row1, colOf['Default Amount'] + 1).setNumberFormat('$#,##0.00');
  } catch (fmtErr) { /* cosmetic only */ }
  ctx.actions.push('Seed one Monthly bill row (' + payee + ' $' + amount + ', Due Day ' + dueDay + ', Manual) at row ' + row1);

  // Mirror addBillFromDashboard's bill_add Activity entry via the ss-scoped helper.
  // This is a GUARANTEED part of the add-bill workflow, so we do NOT swallow a
  // failure: appendActivityLog_ has its own internal catch and returns false on any
  // failure (rather than throwing), so we capture that boolean and let expectedOutcome
  // assert it === true. dedupeKey is intentionally '' so the entry is never deduped.
  var activityWrote = false;
  if (typeof appendActivityLog_ === 'function') {
    var entryDate = (typeof Utilities !== 'undefined' && typeof Session !== 'undefined')
      ? Utilities.formatDate(new Date(2026, 0, 10), Session.getScriptTimeZone(), 'yyyy-MM-dd')
      : '2026-01-10';
    activityWrote = appendActivityLog_(ss, {
      eventType: 'bill_add',
      entryDate: entryDate,
      amount: amount,
      direction: 'expense',
      payee: payee,
      category: category,
      accountSource: paymentSource,
      cashFlowSheet: '',
      cashFlowMonth: '',
      dedupeKey: '',
      details: JSON.stringify({
        detailsVersion: 1,
        dueDay: dueDay,
        frequency: frequencyLabel,
        paymentSource: paymentSource,
        startMonth: startMonth,
        defaultAmount: amount,
        autopay: 'No',
        varies: 'No',
        active: 'Yes',
        notes: notes
      })
    }) === true;
    ctx.actions.push(activityWrote
      ? 'Append LOG - Activity bill_add row (appendActivityLog_ → true)'
      : 'appendActivityLog_ returned false — no LOG - Activity row written');
  } else {
    ctx.actions.push('appendActivityLog_ unavailable — no LOG - Activity row written');
  }

  ctx.seededBill = {
    sheetName: billsName,
    row: row1,
    colOf: colOf,
    payee: payee,
    amount: amount,
    dueDay: dueDay,
    frequency: frequencyLabel,
    activityWrote: activityWrote
  };
}

/**
 * REGRESSION-BILLS-MONTHLY-CASHFLOW — inspectable Bills → Cash Flow integration.
 *
 * Builds a disposable workbook that visibly demonstrates the full production add-bill
 * workflow so the workbook ITSELF is evidence the flow worked:
 *   - INPUT - Bills ............. canonical sheet + one realistic monthly bill row
 *   - INPUT - Cash Flow 2026 .... canonical sheet (header + month columns + Summary)
 *                                 with the bill's Expense row linked by Type + Payee
 *   - LOG - Activity ............ the bill_add entry (mandatory)
 *   - INPUT - Settings / SYS - Meta from the minimal bootstrap
 *
 * FIDELITY: this mirrors addBillFromDashboard's real linkage — Flow Source comes from
 * the bill's Payment Source, and the Cash Flow row is seeded via the SAME sheet-scoped
 * production helpers production uses (insertCashFlowRow_ with the idempotent
 * findCashFlowRowByTypeAndPayee_ guard). The Cash Flow sheet itself is built by the
 * ss-scoped production builder buildCashFlowYearSheet_(ss, year) — the core extracted
 * from ensureCashFlowYearSheet_ — so there is NO harness-side duplication of Cash Flow
 * structure/formatting. Only the getUserSpreadsheet_()-bound wrapper
 * ensureCashFlowYearSheet_ remains off-limits to the harness.
 *
 * NOTE ON AMOUNTS: production's add-bill linkage writes only the STRUCTURAL Cash Flow
 * columns (Type / Payee / Flow Source / Active) — no month amount is posted at add
 * time (that happens at pay/autopay time). So this scenario asserts the linkage, not a
 * Cash Flow amount; a Cash Flow amount belongs to a future AutoPay/Manual-Pay scenario.
 *
 * @returns {Object} scenario
 */
function getHarnessBillsMonthlyCashflowScenario_() {
  var settingsName = (typeof PROFILE_SETTINGS_SHEET_NAME_ === 'string') ? PROFILE_SETTINGS_SHEET_NAME_ : 'INPUT - Settings';
  var sysMetaName = (typeof SYS_META_SHEET_NAME_ === 'string') ? SYS_META_SHEET_NAME_ : 'SYS - Meta';

  return {
    id: 'REGRESSION-BILLS-MONTHLY-CASHFLOW',
    category: 'REGRESSION',
    executionLevel: 'INTEGRATION',
    description: 'Integration: seed INPUT - Bills + a canonical INPUT - Cash Flow 2026 (with the bill\'s Expense row) + LOG - Activity on a disposable workbook, and assert the visible Bills ↔ Cash Flow linkage.',
    // Provisioning gate scoped to the guaranteed minimal structure; Bills/Cash Flow/
    // Activity visible facts are carried by the functional assertions.
    expectedSheets: [settingsName, sysMetaName],
    setup: function(ctx) {
      ctx.assertWritable();
      runMinimalBootstrap_(ctx.ss);
      ctx.actions.push('Provision minimal workbook (runMinimalBootstrap_ → INPUT - Settings)');
    },
    actions: function(ctx) {
      harnessSeedOneBillRow_(ctx);          // INPUT - Bills row + LOG - Activity bill_add
      harnessSeedCashFlowForBill_(ctx);     // INPUT - Cash Flow 2026 + linked Expense row
    },
    expectedOutcome: function(ctx) {
      var mod = 'Bills';
      var b = ctx.seededBill;
      var cf = ctx.seededCashFlow;
      if (!b) throw new Error('REGRESSION-BILLS-MONTHLY-CASHFLOW: seeded bill context missing.');
      if (!cf) throw new Error('REGRESSION-BILLS-MONTHLY-CASHFLOW: seeded cash flow context missing.');

      // --- Bills sheet + row (visible facts) ---
      var billsName = b.sheetName;
      var billPayeeCol = b.colOf.Payee + 1;
      var billAmountCol = b.colOf['Default Amount'] + 1;
      var billDueDayCol = b.colOf['Due Day'] + 1;

      ctx.assert.exists('Bills sheet exists', ctx.read.sheetValue(billsName, 1, 1),
        { module: mod, location: billsName + '!R1C1' });
      ctx.assert.exists('Bill row exists (Payee cell)', ctx.read.sheetValue(billsName, b.row, billPayeeCol),
        { module: mod, location: billsName + '!R' + b.row + 'C' + billPayeeCol });
      ctx.assert.equals('Bill payee', ctx.read.sheetValue(billsName, b.row, billPayeeCol), 'City Utilities',
        { module: mod });
      ctx.assert.equals('Bill amount', ctx.read.sheetValue(billsName, b.row, billAmountCol), 125,
        { module: mod });
      ctx.assert.equals('Bill due day', ctx.read.sheetValue(billsName, b.row, billDueDayCol), 15,
        { module: mod });

      // --- Cash Flow sheet + linked Expense row (visible facts) ---
      var cfName = cf.sheetName;
      ctx.assert.exists('Cash Flow sheet exists', ctx.read.sheetValue(cfName, 1, 1),
        { module: mod, location: cfName + '!R1C1' });
      ctx.assert.equals('Cash Flow row located for bill payee', cf.row > 1, true,
        { module: mod, location: cfName });
      ctx.assert.exists('Cash Flow expense row exists (Payee cell)', ctx.read.sheetValue(cfName, cf.row, cf.payeeCol),
        { module: mod, location: cfName + '!R' + cf.row + 'C' + cf.payeeCol });
      ctx.assert.equals('Cash Flow entry type', ctx.read.sheetValue(cfName, cf.row, cf.typeCol), 'Expense',
        { module: mod, location: cfName + '!R' + cf.row + 'C' + cf.typeCol });
      ctx.assert.equals('Cash Flow flow source (from Payment Source)', ctx.read.sheetValue(cfName, cf.row, cf.flowSourceCol), 'CASH',
        { module: mod, location: cfName + '!R' + cf.row + 'C' + cf.flowSourceCol });

      // --- Bills ↔ Cash Flow linkage: same payee on both sheets ---
      ctx.assert.equals('Bills ↔ Cash Flow payee linkage',
        ctx.read.sheetValue(cfName, cf.row, cf.payeeCol),
        ctx.read.sheetValue(billsName, b.row, billPayeeCol),
        { module: mod });

      // --- Activity Log (mandatory — a bill add always logs bill_add) ---
      var actName = (typeof ACTIVITY_LOG_SHEET_NAME === 'string') ? ACTIVITY_LOG_SHEET_NAME : 'LOG - Activity';
      ctx.assert.equals('Activity Log write succeeded (bill_add)', b.activityWrote, true,
        { module: mod, location: actName });
      ctx.assert.exists('Activity Log bill_add row', ctx.read.sheetValue(actName, 2, 1),
        { module: mod, location: actName + '!R2C1' });
      ctx.assert.equals('Activity Log event type', ctx.read.sheetValue(actName, 2, 2), 'bill_add',
        { module: mod, location: actName + '!R2C2' });
    }
  };
}

/**
 * Build a canonical `INPUT - Cash Flow 2026` on the disposable workbook and seed the
 * bill's Expense row, exactly as addBillFromDashboard's Cash Flow linkage does.
 *
 * The sheet is built by the EXACT production builder buildCashFlowYearSheet_(ss, year)
 * — the ss-scoped core extracted from ensureCashFlowYearSheet_ — so the disposable
 * sheet is 100% production-identical (header, month columns, currency, header styling,
 * canonical 14pt body font/row height, Income/Expense color rules, Summary row) with no
 * harness-side duplication. buildCashFlowYearSheet_ takes an explicit ss and never
 * resolves its own workbook, so only the disposable target is touched. The Expense row
 * is then seeded with the SAME idempotent guard + helper production uses:
 * findCashFlowRowByTypeAndPayee_ + insertCashFlowRow_ (which propagates the canonical
 * 14pt body format from the neighbor row the builder established).
 *
 * Records { sheetName, row, typeCol, payeeCol, flowSourceCol, flowSource, seeded } on
 * ctx.seededCashFlow for expectedOutcome to assert against.
 *
 * @param {Object} ctx harness context (ctx.ss, ctx.actions, ctx.assertWritable, ctx.seededBill).
 */
function harnessSeedCashFlowForBill_(ctx) {
  var ss = ctx.ss;
  var year = 2026;
  var cfName = (typeof getCashFlowSheetName_ === 'function') ? getCashFlowSheetName_(year) : ('INPUT - Cash Flow ' + year);

  var sheet = ss.getSheetByName(cfName);
  if (!sheet) {
    ctx.assertWritable();
    // Reuse the EXACT production builder — the ss-scoped core extracted from
    // ensureCashFlowYearSheet_ — so the disposable Cash Flow sheet is 100%
    // production-identical (header, month columns, currency, header styling, canonical
    // 14pt body font/row height, Income/Expense color rules, Summary row) with ZERO
    // harness-side duplication. buildCashFlowYearSheet_ takes an explicit ss and never
    // resolves its own workbook, so it only ever touches the disposable target.
    if (typeof buildCashFlowYearSheet_ !== 'function') {
      throw new Error('harnessSeedCashFlowForBill_: buildCashFlowYearSheet_ unavailable — cannot build a canonical Cash Flow sheet.');
    }
    sheet = buildCashFlowYearSheet_(ss, year);
    ctx.actions.push('Create ' + cfName + ' via production builder (buildCashFlowYearSheet_)');
  }

  // Seed the bill-linked Expense row EXACTLY as addBillFromDashboard does: idempotent
  // findCashFlowRowByTypeAndPayee_ guard, then insertCashFlowRow_ (Flow Source = the
  // bill's Payment Source). No month amount is written (matches production add time).
  var b = ctx.seededBill || {};
  var payee = b.payee || 'City Utilities';
  var flowSource = 'CASH';   // matches the manual bill's Payment Source (paymentSourceNorm)
  var seeded = false;
  if (typeof findCashFlowRowByTypeAndPayee_ === 'function' && typeof insertCashFlowRow_ === 'function') {
    var existing = findCashFlowRowByTypeAndPayee_(sheet, 'Expense', payee);
    if (!existing) {
      ctx.assertWritable();
      insertCashFlowRow_(sheet, 'Expense', payee, flowSource);
      seeded = true;
    }
    ctx.actions.push(seeded
      ? 'Seed Cash Flow Expense row linked to bill payee "' + payee + '" (insertCashFlowRow_)'
      : 'Cash Flow Expense row for "' + payee + '" already present — left untouched');
  } else {
    ctx.actions.push('Cash Flow row helpers unavailable — Expense row not seeded');
  }

  var loc = (typeof findCashFlowRowByTypeAndPayee_ === 'function')
    ? findCashFlowRowByTypeAndPayee_(sheet, 'Expense', payee) : null;
  var headerMap = (typeof getCashFlowHeaderMap_ === 'function') ? getCashFlowHeaderMap_(sheet) : null;

  ctx.seededCashFlow = {
    sheetName: cfName,
    row: loc ? loc.row : -1,
    typeCol: headerMap ? headerMap.typeCol : 1,
    flowSourceCol: headerMap ? headerMap.flowSourceCol : 2,
    payeeCol: headerMap ? headerMap.payeeCol : 3,
    flowSource: flowSource,
    seeded: seeded
  };
}
