/**
 * Allow-list of Flow Source values for the `INPUT - Cash Flow YYYY` sheets.
 * Phase 2 keeps this deliberately tiny:
 *   CASH         — income, transfers, bank-funded payments, credit-card payoff rows.
 *   CREDIT_CARD  — expenses actually charged to a card (spending, not payoff).
 * Legacy rows created before the column existed are allowed to be blank.
 * Add per-card values here later; consumers read via `normalizeFlowSource_`.
 */
var FLOW_SOURCE_ALLOWED_VALUES_ = ['CASH', 'CREDIT_CARD'];

/**
 * Normalize a raw Flow Source value (from UI, payload, or sheet cell) to the
 * canonical uppercase form. Blank / null / undefined is allowed and returns ''.
 * Accepts common variants ("credit card", "credit-card", "Cash") and folds
 * whitespace/hyphens into underscores. Throws on any other value so typos
 * never silently poison the sheet.
 */
function normalizeFlowSource_(raw) {
  if (raw === null || raw === undefined) return '';
  const text = String(raw).trim();
  if (!text) return '';

  const canonical = text.toUpperCase().replace(/[\s-]+/g, '_');
  if (FLOW_SOURCE_ALLOWED_VALUES_.indexOf(canonical) !== -1) {
    return canonical;
  }

  throw new Error(
    'Unsupported Flow Source value: "' + raw + '". Allowed: ' +
    FLOW_SOURCE_ALLOWED_VALUES_.join(', ') + ', or blank.'
  );
}

function getQuickAddPaymentUiData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const year = getCurrentYear_();

  // Blank-workbook safety: on a fresh sheet INPUT - Cash Flow YYYY does not
  // exist yet and getCashFlowSheetForYear_() -> getCashFlowSheet_() would
  // throw "Missing cash flow sheet: …" and surface as a red banner on the
  // Quick Add page. Return the same neutral payload shape the function's
  // existing empty-sheet branch produces so the UI renders clean. The
  // populated path below is unchanged.
  if (!ss.getSheetByName(getCashFlowSheetName_(year))) {
    return {
      year: year,
      payees: [],
      types: ['Expense', 'Income'],
      flowSources: FLOW_SOURCE_ALLOWED_VALUES_.slice(),
      flowSourceColumnPresent: false
    };
  }

  const sheet = getCashFlowSheetForYear_(ss, year);

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return {
      year: year,
      payees: [],
      types: ['Expense', 'Income'],
      flowSources: FLOW_SOURCE_ALLOWED_VALUES_.slice(),
      flowSourceColumnPresent: false
    };
  }

  const headerMap = getCashFlowHeaderMap_(sheet);
  const hasFlowSource = headerMap.flowSourceColZero !== -1;

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const type = String(values[r][headerMap.typeColZero] || '').trim();
    const payee = String(values[r][headerMap.payeeColZero] || '').trim();

    if (!type || !payee) continue;
    if (type === 'Summary') continue;

    var existingFlowSource = '';
    if (hasFlowSource) {
      var rawExisting = values[r][headerMap.flowSourceColZero];
      try {
        existingFlowSource = normalizeFlowSource_(rawExisting);
      } catch (e) {
        // Leave legacy / typo values blank in the hint list rather than blowing
        // up the whole sidebar. The raw cell is untouched.
        existingFlowSource = '';
      }
    }

    rows.push({
      type: type,
      payee: payee,
      flowSource: existingFlowSource
    });
  }

  rows.sort(function(a, b) {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.payee.localeCompare(b.payee);
  });

  return {
    year: year,
    payees: rows,
    types: ['Expense', 'Income'],
    flowSources: FLOW_SOURCE_ALLOWED_VALUES_.slice(),
    flowSourceColumnPresent: hasFlowSource
  };
}

/**
 * Prior calendar month cell for same Type + Payee on the Cash Flow tab for that calendar year.
 *
 * Each tab is one year: INPUT - Cash Flow YYYY has month columns Jan-YY … Dec-YY for that year only.
 * So for a January date, "last month" is December of the *previous* year → that month lives on
 * INPUT - Cash Flow (year−1), not on the current year’s tab. A payee row must exist on that tab
 * (same Type + Payee text) or there is nothing to read.
 */
function computeQuickAddPriorMonthPreview_(ss, entryType, payee, entryDate) {
  const prior = new Date(entryDate.getFullYear(), entryDate.getMonth() - 1, 15);
  const priorMonthLabel = Utilities.formatDate(prior, Session.getScriptTimeZone(), 'MMM-yy');
  const priorYear = prior.getFullYear();
  const priorTabName = getCashFlowSheetName_(priorYear);

  var priorSheet;
  try {
    priorSheet = getCashFlowSheet_(ss, priorYear);
  } catch (e) {
    return {
      priorMonthLabel: priorMonthLabel,
      priorMonthValue: null,
      priorMonthUnavailableMessage:
        'Missing tab "' +
        priorTabName +
        '" — last month (' +
        priorMonthLabel +
        ') is stored there, not on the current year’s cash flow sheet.'
    };
  }

  const rowPrior = findCashFlowRowByTypeAndPayee_(priorSheet, entryType, payee);
  if (!rowPrior) {
    return {
      priorMonthLabel: priorMonthLabel,
      priorMonthValue: null,
      priorMonthUnavailableMessage:
        'No row for this payee on "' +
        priorTabName +
        '" — last month’s amount is read from that tab (e.g. new payee this year or renamed payee).'
    };
  }

  try {
    const priorMonthCol = getMonthColumnByDate_(priorSheet, prior, 1);
    const priorMonthValue = round2_(toNumber_(priorSheet.getRange(rowPrior.row, priorMonthCol).getValue()));
    return {
      priorMonthLabel: priorMonthLabel,
      priorMonthValue: priorMonthValue,
      priorMonthUnavailableMessage: null
    };
  } catch (e) {
    return {
      priorMonthLabel: priorMonthLabel,
      priorMonthValue: null,
      priorMonthUnavailableMessage:
        'Could not find column ' + priorMonthLabel + ' on "' + priorSheet.getName() + '".'
    };
  }
}

function getQuickAddPreview(payload) {
  validateRequired_(payload, ['entryType', 'payee', 'entryDate']);

  const entryType = String(payload.entryType || '').trim();
  const payee = String(payload.payee || '').trim();
  const entryDate = parseIsoDateLocal_(payload.entryDate);

  if (!payee) throw new Error('Payee is required.');
  if (isNaN(entryDate.getTime())) throw new Error('Invalid date.');
  if (entryType !== 'Expense' && entryType !== 'Income') {
    throw new Error('Type must be Expense or Income.');
  }

  const year = entryDate.getFullYear();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getCashFlowSheetForYear_(ss, year);
  const monthCol = getMonthColumnByDate_(sheet, entryDate, 1);
  const headerMap = getCashFlowHeaderMap_(sheet);

  const rowInfo = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);

  let currentValue = '';
  let existingFlowSource = '';
  if (rowInfo) {
    currentValue = round2_(toNumber_(sheet.getRange(rowInfo.row, monthCol).getValue()));
    if (headerMap.flowSourceColZero !== -1) {
      try {
        existingFlowSource = normalizeFlowSource_(
          sheet.getRange(rowInfo.row, headerMap.flowSourceCol).getDisplayValue()
        );
      } catch (e) {
        existingFlowSource = '';
      }
    }
  }

  const priorPreview = computeQuickAddPriorMonthPreview_(ss, entryType, payee, entryDate);

  return {
    sheetName: sheet.getName(),
    month: Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy'),
    currentValue: currentValue,
    rowExists: !!rowInfo,
    flowSourceColumnPresent: headerMap.flowSourceColZero !== -1,
    existingFlowSource: existingFlowSource,
    priorMonthLabel: priorPreview.priorMonthLabel,
    priorMonthValue: priorPreview.priorMonthValue,
    priorMonthUnavailableMessage: priorPreview.priorMonthUnavailableMessage
  };
}

function quickAddPayment(payload) {
  validateRequired_(payload, ['entryType', 'payee', 'entryDate', 'amount']);

  const entryType = String(payload.entryType || '').trim();
  const payee = String(payload.payee || '').trim();
  const entryDate = parseIsoDateLocal_(payload.entryDate);
  const amount = Math.abs(toNumber_(payload.amount));
  const createIfMissing = !!payload.createIfMissing;
  // Validate up-front so a bad value can't land in the sheet. Blank is allowed
  // (legacy-compatible) and simply skips the Flow Source write below.
  let flowSource = normalizeFlowSource_(payload.flowSource);

  if (!payee) throw new Error('Payee is required.');
  if (isNaN(entryDate.getTime())) throw new Error('Invalid date.');
  if (amount <= 0) throw new Error('Amount must be greater than 0.');
  if (entryType !== 'Expense' && entryType !== 'Income') {
    throw new Error('Type must be Expense or Income.');
  }

  const signedAmount = entryType === 'Expense' ? -amount : amount;
  const year = entryDate.getFullYear();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getCashFlowSheetForYear_(ss, year);
  const monthCol = getMonthColumnByDate_(sheet, entryDate, 1);
  const headerMap = getCashFlowHeaderMap_(sheet);

  let rowInfo = findCashFlowRowByTypeAndPayee_(sheet, entryType, payee);
  let rowWasCreated = false;
  // Track whether flowSource came from the caller vs. a server-side lookup.
  // Only relevant when filling a blank Flow Source on an EXISTING row: we
  // must not retroactively stamp a derived value onto a row the user already
  // owns, so the fill-a-blank branch below stays gated on an explicit caller
  // value even when a fallback was resolved for the newly created row.
  const callerProvidedFlowSource = !!flowSource;

  if (!rowInfo) {
    if (!createIfMissing) {
      throw new Error('Payee row not found. Check "Create row if missing" to add it automatically.');
    }
    // Bills → Pay and similar flows can lose `flowSource` along the wire
    // (stale cached client bundle on the deployed web app, alternate pay
    // surfaces such as the sidebar, upcoming-expense auto-writes, etc.).
    // Rather than trust every UI path to carry the value, derive it from
    // INPUT - Bills (primary source of truth for the Payment Source field)
    // and INPUT - Debts (Credit Card ⇒ CREDIT_CARD, else CASH) on the
    // server whenever a brand-new Expense row is about to be created
    // without one. Income rows and any non-matching payees keep blank.
    if (!flowSource && entryType === 'Expense') {
      flowSource = resolveFlowSourceFromBillOrDebt_(ss, payee);
    }
    rowInfo = insertCashFlowRow_(sheet, entryType, payee, flowSource);
    rowWasCreated = true;
  }

  const targetCell = sheet.getRange(rowInfo.row, monthCol);
  const previousValue = round2_(toNumber_(targetCell.getValue()));

  addCurrencyToCellPreserveRowFormat_(sheet, rowInfo.row, monthCol, signedAmount, 3);

  const newValue = round2_(toNumber_(sheet.getRange(rowInfo.row, monthCol).getValue()));

  // Write Flow Source only when the column exists on this year's tab AND the
  // caller passed a value. For existing rows we only fill a blank cell — we
  // never overwrite a value the user (or a prior call) already set. New rows
  // created by `insertCashFlowRow_` above already got the Flow Source seeded
  // (either from the caller or from the INPUT - Bills/Debts fallback above).
  // Note: the INPUT - Bills/Debts fallback deliberately does NOT fire for
  // existing rows — derived values only seed brand-new rows so we never
  // silently stamp a fallback onto a row the user already owns.
  let flowSourceWritten = rowWasCreated && !!flowSource;
  if (
    flowSource &&
    callerProvidedFlowSource &&
    !rowWasCreated &&
    headerMap.flowSourceColZero !== -1
  ) {
    const flowCell = sheet.getRange(rowInfo.row, headerMap.flowSourceCol);
    const existingRaw = flowCell.getDisplayValue();
    if (!String(existingRaw || '').trim()) {
      flowCell.setValue(flowSource);
      flowSourceWritten = true;
    }
  }

  const debtBalanceNote = adjustDebtsBalanceAfterQuickPayment_(ss, payee, entryType, amount);

  touchDashboardSourceUpdated_('quick_payment');
  touchDashboardSourceUpdated_('cash_flow');

  const monthLabel = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'MMM-yy');
  const entryDateStr = Utilities.formatDate(entryDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var activitySnapshot = {
    entryType: entryType,
    payee: payee,
    entryDate: entryDateStr,
    amount: amount,
    previousValue: previousValue,
    newValue: newValue,
    signedAmount: signedAmount,
    createIfMissing: createIfMissing,
    debtBalanceNote: debtBalanceNote,
    cashFlowSheet: sheet.getName(),
    cashFlowMonth: monthLabel,
    flowSource: flowSource || '',
    flowSourceWritten: flowSourceWritten
  };

  if (!payload.suppressActivityLog) {
    appendActivityLog_(ss, {
      eventType: 'quick_pay',
      entryDate: entryDateStr,
      amount: amount,
      direction: entryType === 'Expense' ? 'expense' : 'income',
      payee: payee,
      category: '',
      accountSource: '',
      cashFlowSheet: sheet.getName(),
      cashFlowMonth: monthLabel,
      dedupeKey: '',
      details: JSON.stringify({
        previousValue: previousValue,
        newValue: newValue,
        signedAmount: signedAmount,
        createIfMissing: createIfMissing,
        debtBalanceNote: debtBalanceNote
      })
    });
  }

  const priorPreview = computeQuickAddPriorMonthPreview_(ss, entryType, payee, entryDate);

  // Keep the user-facing status line to a single short sentence. The detailed
  // fields the old multi-line dump surfaced (sheet name, month, before/after
  // values, flow source, debt balance delta) are still returned in
  // `preview` and `activitySnapshot` for any caller that needs them.
  const message = 'Saved to Cash Flow.';

  return {
    ok: true,
    preview: {
      sheetName: sheet.getName(),
      month: monthLabel,
      currentValue: newValue,
      rowExists: true,
      flowSourceColumnPresent: headerMap.flowSourceColZero !== -1,
      flowSourceWritten: flowSourceWritten,
      priorMonthLabel: priorPreview.priorMonthLabel,
      priorMonthValue: priorPreview.priorMonthValue,
      priorMonthUnavailableMessage: priorPreview.priorMonthUnavailableMessage
    },
    message: message,
    activitySnapshot: activitySnapshot
  };
}

/**
 * For Expense quick payments whose payee matches INPUT - Debts (normalized name),
 * reduce Account Balance by the payment amount, floored at 0.
 * Skips Type Loan and HELOC (payment vs principal rules differ; revisit later).
 */
function adjustDebtsBalanceAfterQuickPayment_(ss, payee, entryType, paymentAmount) {
  if (entryType !== 'Expense') return null;

  const normPayee = normalizeBillName_(payee);

  // Blank-workbook safety: on a fresh sheet INPUT - Debts does not exist yet
  // and getSheet_() would throw "Missing sheet: INPUT - Debts" after a
  // successful Cash Flow write. Returning null matches this function's
  // existing "nothing to adjust" contract (no matching row / missing balance
  // column / non-Expense), so the caller's optional debtBalanceNote branch
  // is skipped cleanly. The populated path below is unchanged.
  if (!ss.getSheetByName(getSheetNames_().DEBTS)) return null;

  const debtSheet = getSheet_(ss, 'DEBTS');
  const headerMap = getDebtsHeaderMap_(debtSheet);
  if (headerMap.balanceCol === -1) return null;

  const display = debtSheet.getDataRange().getDisplayValues();
  const values = debtSheet.getDataRange().getValues();

  for (let r = 1; r < display.length; r++) {
    const name = String(display[r][headerMap.nameColZero] || '').trim();
    if (!name || isDebtSummaryRowName_(name)) continue;
    if (normalizeBillName_(name) !== normPayee) continue;

    // Skip debts that have been soft-deleted via Stop tracking. Using the
    // shared row-level rule keeps legacy workbooks (no Active column) behaving
    // like before via the balance/minimum-payment fallback.
    if (isDebtRowInactive_(display[r], values[r], headerMap)) continue;

    const dType = String(display[r][headerMap.typeColZero] || '').trim();
    if (isDebtTypeLoanOrHeloc_(dType)) return null;

    const curBal = round2_(toNumber_(values[r][headerMap.balanceColZero]));
    const newBal = Math.max(0, round2_(curBal - paymentAmount));
    const targetRow = r + 1;
    const targetCol = headerMap.balanceCol;

    setCurrencyCellPreserveRowFormat_(debtSheet, targetRow, targetCol, newBal, 1);

    recalcDebtPctAvailForRow_(debtSheet, targetRow, {
      creditLimitCol: headerMap.creditLimitColZero,
      creditLeftCol: headerMap.creditLeftColZero,
      balanceCol: headerMap.balanceColZero,
      pctAvailCol: headerMap.pctAvailColZero
    });

    touchDashboardSourceUpdated_('debts');

    return {
      previousBalance: curBal,
      newBalance: newBal
    };
  }

  return null;
}

function isDebtTypeLoanOrHeloc_(typeStr) {
  const t = String(typeStr || '').trim().toLowerCase();
  return t === 'loan' || t === 'heloc';
}

/**
 * Server-side Flow Source fallback for freshly-created Cash Flow Expense rows.
 *
 * Mirrors the Payment Source inference used by the Bills dashboard readers
 * (`getInputBillsDueRows_` / `getDebtBillsDueRows_`) so a new row ends up with
 * the same Flow Source the user would see on the Bills page:
 *
 *   1. INPUT - Bills: look up the row by normalized payee name and use its
 *      `Payment Source` column if present and valid (CASH | CREDIT_CARD).
 *   2. INPUT - Debts: look up the row by normalized Account Name and infer
 *      CREDIT_CARD for `Type = Credit Card`, CASH otherwise.
 *   3. No match: return '' so legacy behavior (blank Flow Source) is kept.
 *
 * Silent try/catch on each sheet read — this is a best-effort enrichment
 * and must never block the primary Cash Flow write. A missing INPUT - Bills
 * / INPUT - Debts sheet just falls through to the next step.
 *
 * Only called for `entryType === 'Expense'` AND only when we're about to
 * create a brand-new Cash Flow row. Existing rows are never touched by this
 * helper — that keeps this behavior additive and audit-friendly.
 */
function resolveFlowSourceFromBillOrDebt_(ss, payee) {
  const normalizedPayee = normalizeBillName_(payee);
  if (!normalizedPayee) return '';

  // Case-insensitive header match — some workbooks ship `INPUT - Bills` with
  // ALL-CAPS headers (e.g. "PAYMENT SOURCE") and a naive indexOf would miss
  // the column, leaving Flow Source blank on every created Cash Flow row.
  const findHeaderIdx = function (headers, label) {
    const want = String(label || '').trim().toLowerCase();
    for (let i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').trim().toLowerCase() === want) return i;
    }
    return -1;
  };

  try {
    const billsSheet = getSheet_(ss, 'BILLS');
    const display = billsSheet.getDataRange().getDisplayValues();
    if (display && display.length >= 2) {
      const headers = display[0] || [];
      const payeeCol = findHeaderIdx(headers, 'Payee');
      const sourceCol = findHeaderIdx(headers, 'Payment Source');
      const activeCol = findHeaderIdx(headers, 'Active');

      if (payeeCol !== -1 && sourceCol !== -1) {
        // Prefer the first active match so deactivated rows don't bleed into
        // a live payment; fall back to any match if no active row exists.
        let activeMatch = '';
        let anyMatch = '';

        for (let r = 1; r < display.length; r++) {
          const rowPayee = String(display[r][payeeCol] || '').trim();
          if (!rowPayee) continue;
          if (normalizeBillName_(rowPayee) !== normalizedPayee) continue;

          const rawSource = String(display[r][sourceCol] || '').trim();
          if (!rawSource) continue;

          let canonical;
          try {
            canonical = normalizeFlowSource_(rawSource);
          } catch (e) {
            // Typo in the sheet — skip it rather than poison the Cash Flow row.
            continue;
          }
          if (!canonical) continue;

          const active = activeCol === -1 ? 'yes' : normalizeYesNo_(display[r][activeCol]);
          if (active === 'yes' && !activeMatch) {
            activeMatch = canonical;
            break;
          }
          if (!anyMatch) anyMatch = canonical;
        }

        if (activeMatch) return activeMatch;
        if (anyMatch) return anyMatch;
      }
    }
  } catch (e) {
    Logger.log('resolveFlowSourceFromBillOrDebt_ bills lookup: ' + e);
  }

  try {
    const debtsSheet = getSheet_(ss, 'DEBTS');
    const display = debtsSheet.getDataRange().getDisplayValues();
    if (display && display.length >= 2) {
      const headers = display[0] || [];
      const nameCol = findHeaderIdx(headers, 'Account Name');
      const typeCol = findHeaderIdx(headers, 'Type');
      const activeColDebt = findHeaderIdx(headers, 'Active');

      if (nameCol !== -1) {
        for (let r = 1; r < display.length; r++) {
          const rowName = String(display[r][nameCol] || '').trim();
          if (!rowName) continue;
          if (rowName.toUpperCase() === 'TOTAL DEBT') continue;
          if (normalizeBillName_(rowName) !== normalizedPayee) continue;

          // Skip stop-tracked debts so inactive rows don't poison the
          // Flow Source inference for live payments. Blank / missing Active
          // still means active, matching the shared debt rule.
          if (activeColDebt !== -1) {
            const activeVal = String(display[r][activeColDebt] == null ? '' : display[r][activeColDebt])
              .trim()
              .toLowerCase();
            if (activeVal === 'no' || activeVal === 'n' || activeVal === 'false' || activeVal === 'inactive') {
              continue;
            }
          }

          const dType = typeCol === -1 ? '' : display[r][typeCol];
          return isDebtCreditCardType_(dType) ? 'CREDIT_CARD' : 'CASH';
        }
      }
    }
  } catch (e) {
    Logger.log('resolveFlowSourceFromBillOrDebt_ debts lookup: ' + e);
  }

  return '';
}

function findCashFlowRowByTypeAndPayee_(sheet, entryType, payee) {
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;

  const headerMap = getCashFlowHeaderMap_(sheet);

  for (let r = 1; r < values.length; r++) {
    const rowType = String(values[r][headerMap.typeColZero] || '').trim();
    const rowPayee = String(values[r][headerMap.payeeColZero] || '').trim();

    if (rowType === entryType && rowPayee === payee) {
      return { row: r + 1 };
    }
  }

  return null;
}

/**
 * Insert a new row into the cash-flow sheet for the given Type + Payee, seeded
 * with an optional Flow Source value. The row is placed immediately after the
 * last existing row of the same Type (or just before the Summary row if there
 * is no prior row of that Type), and inherits the formatting of the row above.
 *
 * `flowSource` is already validated/normalized by the caller (empty allowed).
 * When the column isn't present on legacy year tabs we silently skip it.
 */
function insertCashFlowRow_(sheet, entryType, payee, flowSource) {
  if (!sheet.getDataRange().getDisplayValues().length) {
    throw new Error('Cash Flow sheet is empty.');
  }

  const headerMap = getCashFlowHeaderMap_(sheet);

  // Seed the Summary row up-front so Income / Expense / Summary placement
  // is deterministic. Idempotent — no-op when the row already exists, so
  // this only does work on sheets that predate the Summary-row rollout.
  // We deliberately call this BEFORE scanning for insertion anchors so
  // the scan sees the freshly-seeded Summary row and Expense inserts land
  // just above it. Any failure is non-fatal: the row write below is the
  // contract and must succeed even if summary seeding does not.
  try {
    if (typeof ensureCashFlowSummaryRow_ === 'function') {
      ensureCashFlowSummaryRow_(sheet);
    }
  } catch (summaryErr) {
    Logger.log('insertCashFlowRow_ ensureCashFlowSummaryRow_ failed: ' + summaryErr);
  }

  // Re-read after the ensure call — the Summary row may have been added
  // and the blank separator placed above it, both of which affect the
  // scan below.
  const values = sheet.getDataRange().getDisplayValues();

  let lastSameTypeRow = -1;
  let summaryRow = -1;

  for (let r = 1; r < values.length; r++) {
    const rowType = String(values[r][headerMap.typeColZero] || '').trim();
    const rowPayee = String(values[r][headerMap.payeeColZero] || '').trim();

    if (rowType === 'Summary' && rowPayee === 'Cash Flow Per Month') {
      summaryRow = r + 1;
      break;
    }

    if (rowType === entryType) {
      lastSameTypeRow = r + 1;
    }
  }

  // Placement rules, matching the reference layout the user asked for
  // (Income block on top, Expense block directly above Summary):
  //   - Same-type rows exist: stack after the last one so adjacent rows
  //     of the same type stay contiguous (existing behavior).
  //   - Income with no existing Income rows: drop at the top (insert
  //     after the header row) so Income always precedes any Expense /
  //     Summary rows. Without this branch, first Income on a sheet that
  //     already has Expenses would be appended AT THE BOTTOM after the
  //     Expense block, interleaving the two types.
  //   - Anything else: insert just above Summary (or append to the end
  //     if no Summary row exists, e.g. legacy sheets pre-rollout).
  let insertAfterRow;
  if (lastSameTypeRow !== -1) {
    insertAfterRow = lastSameTypeRow;
  } else if (entryType === 'Income') {
    insertAfterRow = 1; // right after the header row
  } else if (summaryRow > 0) {
    insertAfterRow = summaryRow - 1;
  } else {
    insertAfterRow = sheet.getLastRow();
  }

  sheet.insertRowAfter(insertAfterRow);
  const newRow = insertAfterRow + 1;

  // Row-format propagation: copy the reference row's formatting onto
  // the new row UNLESS the reference is row 1 (the header). The header
  // is bold and carries frozen-row context; copying it would paint data
  // rows bold. In the insertAfterRow===1 branch we deliberately let the
  // new row inherit the default data-row formatting from Apps Script's
  // sheet-creation pass (currency format on month/total columns is
  // already seeded there) and then reset font weight to 'normal' as
  // belt-and-suspenders against Google Sheets' row-format inheritance.
  if (insertAfterRow !== 1) {
    sheet.getRange(insertAfterRow, 1, 1, sheet.getLastColumn())
      .copyTo(
        sheet.getRange(newRow, 1, 1, sheet.getLastColumn()),
        SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
        false
      );
    sheet.getRange(newRow, 1, 1, sheet.getLastColumn()).clearContent();
  } else {
    try {
      sheet.getRange(newRow, 1, 1, sheet.getLastColumn()).setFontWeight('normal');
    } catch (_) { /* cosmetic */ }
  }

  sheet.getRange(newRow, headerMap.typeCol).setValue(entryType);
  sheet.getRange(newRow, headerMap.payeeCol).setValue(payee);

  if (flowSource && headerMap.flowSourceColZero !== -1) {
    sheet.getRange(newRow, headerMap.flowSourceCol).setValue(flowSource);
  }

  // Seed Active=YES on freshly-created rows when the column exists so the
  // sheet is self-documenting. Blank would be treated as YES by every
  // consumer, but an explicit value avoids user confusion and keeps the
  // HELOC debug output ("active_column_present") meaningful even if the
  // user hasn't manually flagged anything as NO yet.
  if (headerMap.activeColZero !== -1) {
    sheet.getRange(newRow, headerMap.activeCol).setValue('YES');
  }

  // Re-write Summary-row formulas so their bounded range expands to
  // include the newly-inserted data row. writeCashFlowSummaryFormulas_
  // uses `$A$2:$A$<summaryRow-1>`-style bounded ranges (see the comment
  // on that function for why open-ended ranges were abandoned), which
  // means an insert ABOVE Summary shifts the formula cell down but the
  // range upper bound is still the pre-insert last-data-row and won't
  // cover the new row until we rewrite. Best-effort — any failure here
  // is non-fatal; the caller's primary contract is the row write above.
  try {
    const headerValuesNow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
    if (
      typeof detectCashFlowLayout_ === 'function' &&
      typeof findCashFlowSummaryRow_ === 'function' &&
      typeof writeCashFlowSummaryFormulas_ === 'function'
    ) {
      const layoutNow = detectCashFlowLayout_(headerValuesNow);
      const summaryRowNow = findCashFlowSummaryRow_(sheet, sheet.getLastRow(), layoutNow);
      if (summaryRowNow > 0) {
        writeCashFlowSummaryFormulas_(sheet, summaryRowNow, layoutNow);
      }
    }
  } catch (refreshErr) {
    Logger.log('insertCashFlowRow_ summary formula refresh failed: ' + refreshErr);
  }

  return { row: newRow };
}

/**
 * Header-index map for an `INPUT - Cash Flow YYYY` sheet. Flow Source is
 * optional for backward compatibility with legacy year tabs that predate the
 * column — callers MUST branch on `flowSourceColZero !== -1` before reading
 * or writing that column.
 *
 * Type and Payee remain required; if either is missing the sheet is
 * unusable and we fail loudly rather than silently mis-align columns.
 */
function getCashFlowHeaderMap_(sheet) {
  const headers = sheet.getDataRange().getDisplayValues()[0] || [];
  const typeColZero = headers.indexOf('Type');
  const payeeColZero = headers.indexOf('Payee');
  const flowSourceColZero = headers.indexOf('Flow Source');
  // `Active` is optional metadata — YES/NO/blank. Blank is treated as YES
  // by every consumer, so legacy tabs without the column stay valid.
  const activeColZero = headers.indexOf('Active');

  if (typeColZero === -1 || payeeColZero === -1) {
    throw new Error('Cash Flow sheet must contain Type and Payee headers.');
  }

  return {
    typeColZero: typeColZero,
    payeeColZero: payeeColZero,
    flowSourceColZero: flowSourceColZero,
    activeColZero: activeColZero,
    typeCol: typeColZero + 1,
    payeeCol: payeeColZero + 1,
    flowSourceCol: flowSourceColZero === -1 ? -1 : flowSourceColZero + 1,
    activeCol: activeColZero === -1 ? -1 : activeColZero + 1
  };
}

function parseIsoDateLocal_(isoText) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoText || '').trim());
  if (!m) {
    throw new Error('Invalid ISO date: ' + isoText);
  }

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  return new Date(year, month - 1, day);
}