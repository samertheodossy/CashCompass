/**
 * test_harness_read.js — Test Harness · read layer (E0a, Slice 2).
 *
 * The SINGLE read abstraction used by all functional assertions. Its job is to
 * ISOLATE workbook reads from assertion logic: a scenario reads an actual value
 * through `ctx.read.*`, then compares it with `ctx.assert.*` (test_harness_assert.js).
 * Keeping every read behind one API means (a) assertions stay pure/comparison-only,
 * and (b) future getter coupling (dashboard, bills, retirement, …) lives in exactly
 * one file.
 *
 * SCOPE (Slice 2, deliberately tiny): only raw sheet reads —
 *   ctx.read.sheetValue(sheetName, row, column)
 *   ctx.read.sheetRange(sheetName, row, column, numRows, numCols)
 * No dashboard / bills / house / retirement / investment / cash-flow / activity-log
 * readers, no JSON/cross-sheet readers yet. Those are later slices (§9/§17 of
 * FUNCTIONAL_ASSERTION_ARCHITECTURE.md) and will be ADDED to this same layer.
 *
 * SAFETY: read-only. The layer is bound to the disposable workbook (`ss`) the run
 * created; it never writes and never resolves a different workbook. Readers never
 * throw on missing sheets/cells — they return `undefined` so a future `exists`
 * assertion can catch absence rather than the run aborting.
 */

/**
 * Build the read layer for one scenario run, bound to the disposable spreadsheet.
 *
 * @param {Object} ss the disposable spreadsheet (from the run loop)
 * @returns {{ sheetValue: function, sheetRange: function }}
 */
function makeReadLayer_(ss) {
  /** Resolve a sheet by name; null (never throw) if absent. */
  function getSheetOrNull_(sheetName) {
    try {
      return ss ? ss.getSheetByName(sheetName) : null;
    } catch (_e) {
      return null;
    }
  }

  return {
    /**
     * One cell value (1-based row/column). `undefined` if the sheet or cell is
     * unavailable — never throws.
     * @param {string} sheetName
     * @param {number} row 1-based
     * @param {number} column 1-based
     * @returns {*}
     */
    sheetValue: function(sheetName, row, column) {
      var sh = getSheetOrNull_(sheetName);
      if (!sh) return undefined;
      try {
        return sh.getRange(row, column).getValue();
      } catch (_e) {
        return undefined;
      }
    },

    /**
     * A rectangular block of values (2-D array). `undefined` if unavailable —
     * never throws.
     * @param {string} sheetName
     * @param {number} row 1-based
     * @param {number} column 1-based
     * @param {number} numRows
     * @param {number} numCols
     * @returns {Array<Array<*>>|undefined}
     */
    sheetRange: function(sheetName, row, column, numRows, numCols) {
      var sh = getSheetOrNull_(sheetName);
      if (!sh) return undefined;
      try {
        return sh.getRange(row, column, numRows, numCols).getValues();
      } catch (_e) {
        return undefined;
      }
    }
  };
}
