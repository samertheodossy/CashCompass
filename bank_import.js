/**
 * Bank Import — Step 1 scaffold only.
 *
 * Creates the two new SYS sheets and the new SYS - Accounts column that
 * Step 2's ingestion pipeline (processBankImportBatch_, normalization,
 * matching, activity logging, dev harness) will need. This file is
 * intentionally inert in Step 1: nothing in the existing app calls
 * anything here, so merging it has zero effect on planner, overview,
 * retirement, cash flow, or the existing manual bank account UI.
 *
 * Scope discipline (Step 1):
 *   - No ingestion, normalization, matching, logging, or dedupe logic.
 *   - No dev/test harness.
 *   - No UI changes.
 *   - Does not modify any existing module (bank_accounts.js,
 *     dashboard_data.js, planner_core.js, cash_to_use.js, code.js,
 *     onboarding.js, sheet_bootstrap.js, activity_log.js,
 *     next_actions.js, Dashboard_*.html).
 *
 * Design contract (matches ensureSysAccountsSheet_ and
 * ensureAccountsActiveColumn_ in bank_accounts.js):
 *   - Never overwrites, clears, or reorders existing sheets/columns.
 *   - First-run safe on blank workbooks and a no-op on populated ones.
 *   - Race-safe around insertSheet(): if another caller inserts the
 *     sheet concurrently we treat the now-existing sheet as a no-op.
 *   - Cosmetic formatting (bold header, frozen row 1) is wrapped so it
 *     can never break a sheet create that otherwise succeeded.
 */

function ensureImportStagingBankAccountsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetNames_().IMPORT_STAGING_BANK;

  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  let sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    // Race: another caller may have inserted the sheet between our
    // getSheetByName() check and insertSheet(). Treat that as a no-op.
    const retry = ss.getSheetByName(sheetName);
    if (retry) return retry;
    throw e;
  }

  const headers = [
    'Staging Id',
    'First Seen',
    'Last Seen',
    'External Account Id',
    'External Institution',
    'Display Name',
    'Last 4',
    'Type',
    'Currency',
    'Latest Balance',
    'Latest Balance As Of',
    'Status',
    'Pending Reason'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  try {
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } catch (_fmt) {
    // Cosmetic only; the sheet + headers are already in place.
  }

  return sheet;
}

function ensureImportIgnoredBankAccountsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = getSheetNames_().IMPORT_IGNORED_BANK;

  const existing = ss.getSheetByName(sheetName);
  if (existing) return existing;

  let sheet;
  try {
    sheet = ss.insertSheet(sheetName);
  } catch (e) {
    const retry = ss.getSheetByName(sheetName);
    if (retry) return retry;
    throw e;
  }

  const headers = [
    'External Account Id',
    'Institution',
    'Display Name',
    'Last 4',
    'Ignored At',
    'Ignored By',
    'Scope'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  try {
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } catch (_fmt) {
    // Cosmetic only.
  }

  return sheet;
}

/**
 * Appends an "External Account Id" column to SYS - Accounts if missing.
 * Never reorders existing columns and never writes to data rows — only
 * the header cell of the newly-appended column is populated. No-op when
 * the header is already present anywhere in row 1.
 *
 * Mirrors the ensureAccountsActiveColumn_ pattern in bank_accounts.js:
 * when the sheet has a stray empty trailing column, we still append
 * flush to the right of the last non-empty header cell so the new
 * header does not drift.
 */
function ensureAccountsExternalIdColumn_(accountsSheet) {
  const targetHeader = 'External Account Id';
  const lastCol = Math.max(accountsSheet.getLastColumn(), 1);
  const headerRow = accountsSheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] || [];

  for (let c = 0; c < headerRow.length; c++) {
    if (String(headerRow[c] || '').trim() === targetHeader) return;
  }

  let targetCol = lastCol + 1;
  for (let c = headerRow.length; c >= 1; c--) {
    if (String(headerRow[c - 1] || '').trim() === '') {
      targetCol = c;
    } else {
      break;
    }
  }

  accountsSheet.getRange(1, targetCol).setValue(targetHeader);
}
