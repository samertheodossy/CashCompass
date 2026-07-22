/**
 * test_harness_assert.js — Test Harness · functional assertions (E0a, Slices 1/3/4).
 *
 * The Functional Assertion framework's comparator library
 * (FUNCTIONAL_ASSERTION_ARCHITECTURE.md). It proves the pipeline end-to-end:
 *
 *   scenario → expectedOutcome(ctx) → ctx.assert.<kind>(...) → collector
 *            → functional report section → Validation & Testing UI.
 *
 * SCOPE so far: `equals` (Slice 1), `exists` / `notExists` (Slice 3), and
 * `dateEquals` (Slice 4 / Temporal — the minimal comparator the Bills recurrence
 * engine needs). Still NOT here (later slices, §17): tolerance (`near`), the richer
 * temporal comparators (`advancesBy` / `landsOnWeekday` / `withinYear`),
 * `reconciles`, seed profiles, clock, module grouping, suite aggregation. The
 * result envelope is
 * a FORWARD-COMPATIBLE SUBSET of §5: fields the later comparators need (`category`,
 * `delta`, `tolerance`, `location`) are present now and simply stay null when a
 * given comparator doesn't use them, so no report/UI redesign is needed later.
 *
 * PURITY: comparators do no I/O. A scenario reads the actual value (via ctx.read,
 * the read layer) and passes it in; the comparator only compares. This keeps the
 * assertion library deterministic and unit-testable.
 *
 * SAFETY: read/compare only. This module never writes to any workbook and is used
 * only by the developer-only, disposable-workbook Test Harness.
 */

/**
 * Pure equality comparator. Handles primitives and Date (by timestamp). No
 * tolerance — that is a later slice (`near`).
 *
 * @param {*} actual
 * @param {*} expected
 * @returns {boolean}
 */
function assertEquals_(actual, expected) {
  if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  }
  return actual === expected;
}

/**
 * Pure calendar-date equality (Slice 4 / temporal). Compares two Dates by
 * **calendar day** only — year + month + day — ignoring time-of-day and timezone
 * offset within the day. This is the minimal temporal comparator the Bills
 * recurrence engine needs: occurrence `dueDate` values are date-only in intent, so
 * comparing full timestamps would be brittle. Non-Date or invalid inputs fail
 * (never throw).
 *
 * @param {*} actual
 * @param {*} expected
 * @returns {boolean}
 */
function assertDateEquals_(actual, expected) {
  if (!(actual instanceof Date) || !(expected instanceof Date)) return false;
  if (isNaN(actual.getTime()) || isNaN(expected.getTime())) return false;
  return actual.getFullYear() === expected.getFullYear() &&
    actual.getMonth() === expected.getMonth() &&
    actual.getDate() === expected.getDate();
}

/** Compact yyyy-mm-dd for temporal failure messages. Never throws. */
function harnessAssertDateDisplay_(v) {
  if (!(v instanceof Date) || isNaN(v.getTime())) return harnessAssertDisplay_(v);
  var m = v.getMonth() + 1, d = v.getDate();
  return v.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
}

/**
 * Pure presence predicate (Slice 3). A value is considered PRESENT unless it is
 * one of the "empty" sentinels the read layer / Sheets can yield:
 *   - `undefined`  → read layer's missing-sheet / missing-cell result
 *   - `null`
 *   - `''` or whitespace-only string → an empty cell (getValue() returns '')
 * Everything else — including `0`, `false`, and `NaN` — is PRESENT (they are real
 * values, just falsy). No I/O; never throws.
 *
 * @param {*} actual
 * @returns {boolean} true when a value is present
 */
function assertExists_(actual) {
  if (actual === undefined || actual === null) return false;
  if (typeof actual === 'string' && actual.trim() === '') return false;
  return true;
}

/**
 * Build a functional-assertion collector for one scenario run. Scenarios call
 * `ctx.assert.equals(...)`; results accumulate on `.results` for the report
 * builder (test_harness_report.js).
 *
 * @returns {{ results: Array<Object>, equals: function }}
 */
function makeAssertionCollector_(onRecord) {
  var results = [];

  /**
   * Record one assertion result in the forward-compatible envelope (§5 subset).
   * @param {string} kind comparator name ('equals')
   * @param {string} label human text
   * @param {*} actual
   * @param {*} expected
   * @param {boolean} pass
   * @param {Object=} opts { module, category, location, id, reason }
   * @returns {boolean} pass (so callers can branch if they wish)
   */
  function record_(kind, label, actual, expected, pass, opts) {
    opts = opts || {};
    var result = {
      id: opts.id || harnessAssertSlug_(label),
      module: opts.module || null,
      category: opts.category || 'Numeric',
      kind: kind,
      label: String(label),
      pass: !!pass,
      expected: expected,
      actual: actual,
      delta: null,        // reserved (numeric/temporal comparators — later slices)
      tolerance: null,    // reserved (`near` — later slice)
      location: opts.location || null,
      reason: pass ? '' : (opts.reason ||
        ('expected ' + harnessAssertDisplay_(expected) + ', got ' + harnessAssertDisplay_(actual)))
    };
    results.push(result);
    if (typeof onRecord === 'function') {
      var passCount = 0;
      for (var i = 0; i < results.length; i++) {
        if (results[i] && results[i].pass) passCount++;
      }
      try {
        onRecord(result, {
          completed: results.length,
          pass: passCount,
          fail: results.length - passCount
        });
      } catch (_progressErr) {
        // Progress reporting is best-effort and can never change test results.
      }
    }
    return !!pass;
  }

  /**
   * Clone opts and, when the assertion fails, supply a presence-specific default
   * reason (record_ only uses opts.reason on failure). Keeps caller opts intact.
   */
  function existsOpts_(opts, actual, wantPresent) {
    var o = {};
    if (opts) { for (var k in opts) { if (opts.hasOwnProperty(k)) o[k] = opts[k]; } }
    if (!o.reason) {
      o.reason = wantPresent
        ? ('expected a value, got ' + harnessAssertDisplay_(actual))
        : ('expected empty/absent, got ' + harnessAssertDisplay_(actual));
    }
    return o;
  }

  return {
    results: results,
    /**
     * Exact-equality assertion (Slice 1).
     * @param {string} label
     * @param {*} actual
     * @param {*} expected
     * @param {Object=} opts { module, category, location }
     * @returns {boolean}
     */
    equals: function(label, actual, expected, opts) {
      return record_('equals', label, actual, expected, assertEquals_(actual, expected), opts);
    },
    /**
     * Presence assertion (Slice 3) — PASS when `actual` is present per
     * assertExists_ (not undefined/null/blank). Pairs naturally with ctx.read,
     * which yields `undefined` on a missing sheet/cell.
     * @param {string} label
     * @param {*} actual value from the read layer (or any scenario expression)
     * @param {Object=} opts { module, category, location }
     * @returns {boolean}
     */
    exists: function(label, actual, opts) {
      return record_('exists', label, actual, '(present)', assertExists_(actual),
        existsOpts_(opts, actual, true));
    },
    /**
     * Absence assertion (Slice 3) — PASS when `actual` is NOT present (the inverse
     * of exists). Useful for "no orphan row / cell should be blank" checks.
     * @param {string} label
     * @param {*} actual
     * @param {Object=} opts { module, category, location }
     * @returns {boolean}
     */
    notExists: function(label, actual, opts) {
      return record_('notExists', label, actual, '(absent)', !assertExists_(actual),
        existsOpts_(opts, actual, false));
    },
    /**
     * Calendar-date equality (Slice 4 / Temporal) — PASS when `actual` and
     * `expected` are the same year/month/day (time-of-day ignored). Tagged
     * category 'Temporal' (§16) so temporal results can be filtered later; the
     * failure reason renders both dates as yyyy-mm-dd. Pairs with the Bills
     * recurrence engine's date-only `dueDate` values.
     * @param {string} label
     * @param {Date} actual
     * @param {Date} expected
     * @param {Object=} opts { module, category, location }
     * @returns {boolean}
     */
    dateEquals: function(label, actual, expected, opts) {
      var o = {};
      if (opts) { for (var k in opts) { if (opts.hasOwnProperty(k)) o[k] = opts[k]; } }
      if (!o.category) o.category = 'Temporal';
      if (!o.reason) {
        o.reason = 'expected ' + harnessAssertDateDisplay_(expected) +
          ', got ' + harnessAssertDateDisplay_(actual);
      }
      return record_('dateEquals', label, actual, expected,
        assertDateEquals_(actual, expected), o);
    }
  };
}

/** Slugify a label into a stable-ish assertion id. Never throws. */
function harnessAssertSlug_(label) {
  return String(label || 'assertion')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'ASSERTION';
}

/** Compact display of a value for failure messages. Never throws. */
function harnessAssertDisplay_(v) {
  try {
    if (v instanceof Date) return v.toISOString();
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'string') return '"' + v + '"';
    return String(v);
  } catch (_e) {
    return '(unprintable)';
  }
}
