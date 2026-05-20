/**
 * Central App resolver — Phase 1 (pass-through).
 *
 * getUserSpreadsheet_() is the single seam through which a calling module
 * acquires a Spreadsheet handle. In Phase 1 it is a deliberate one-line
 * pass-through to SpreadsheetApp.getActiveSpreadsheet(), so bound-workbook
 * behavior is byte-for-byte identical to the pre-seam codebase.
 *
 * The helper exists now so that future Central App phases (PropertiesService
 * lookup, openById, user-to-workbook mapping) can extend this one function
 * instead of touching every caller. See:
 *   - CENTRAL_APP_DESIGN.md
 *   - CENTRAL_APP_FIRST_RESOLVER_SEAM.md
 *   - CENTRAL_APP_IMPLEMENTATION_PLAN.md
 *
 * Do not extend this helper without an explicit migration prompt: Phase 1's
 * contract is that it returns the same object SpreadsheetApp.getActive-
 * Spreadsheet() returns, and nothing else.
 */
function getUserSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}
