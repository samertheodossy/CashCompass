/**
 * Planner email debounce.
 *
 * Goal: stop sending a planner email after every save during heavy
 * update sessions (e.g. month-start, when the user might fire 20-50
 * saves in a few minutes). Instead, defer the email until the user
 * has been quiet for a fixed window (DEBOUNCE_QUIET_WINDOW_MS_), then
 * send a single email reflecting the latest state.
 *
 * How it works:
 *
 * - Each per-save background planner run is invoked with
 *   `runDebtPlanner({ emailMode: 'defer' })`. The planner still runs
 *   (so the snapshot stays fresh), but `sendPlannerEmailIfConfigured_`
 *   short-circuits: it bumps `LAST_SAVE_AT` in DocumentProperties,
 *   logs a `planner_email_deferred` row, and returns without sending.
 *
 * - A time-driven trigger (`debouncePlannerEmailRun`) fires every
 *   DEBOUNCE_TRIGGER_INTERVAL_MIN_ minutes. When it fires it checks
 *   the deferred queue; if the quiet window has elapsed since the
 *   last save AND no email has been sent since that last save, it
 *   runs `runDebtPlanner({ emailMode: 'send' })` once. Worst-case
 *   email latency after the last save is roughly the quiet window
 *   plus one trigger interval (e.g. 10 + 5 = 15 min).
 *
 * - The manual "Run Planner + Refresh Snapshot" button continues to
 *   send immediately because it goes through
 *   `runPlannerAndRefreshDashboard()` (default emailMode = 'send').
 *   Sending immediately also clears the deferred queue so the
 *   trigger doesn't double-send a few minutes later.
 *
 * State lives in `DocumentProperties` (per-spreadsheet), not
 * `ScriptProperties` (global). This is intentional so the same code
 * works correctly under the future Central App / multi-tenant model
 * where one script serves many user spreadsheets.
 *
 * No UI surface and no Settings field — knobs are constants below.
 */

// 10 minutes. Time of inactivity (no further saves) required before
// the deferred email is allowed to fire.
var DEBOUNCE_QUIET_WINDOW_MS_ = 10 * 60 * 1000;

// 5 minutes. How often the time trigger polls for a settled queue.
// Must be one of the values Apps Script accepts for
// timeBased().everyMinutes(...) (1, 5, 10, 15, 30).
var DEBOUNCE_TRIGGER_INTERVAL_MIN_ = 5;

// DocumentProperties keys.
var DEBOUNCE_LAST_SAVE_KEY_ = 'PLANNER_DEBOUNCE_LAST_SAVE_AT';
var DEBOUNCE_LAST_EMAIL_KEY_ = 'PLANNER_DEBOUNCE_LAST_EMAIL_AT';

// Trigger handler name. Must match the function name below exactly so
// `ScriptApp.newTrigger(...)` can find it on the project. Time triggers
// resolve handler names via global function lookup, so a trailing
// underscore is fine here, but we keep the name underscoreless to
// avoid any ambiguity with the `_`-private convention used elsewhere.
var DEBOUNCE_TRIGGER_HANDLER_NAME_ = 'debouncePlannerEmailRun';

/**
 * Marks "the user just saved something" so the debounce trigger knows
 * there is pending email work. Called from
 * `sendPlannerEmailIfConfigured_` when a per-save background run
 * arrives with `emailMode: 'defer'`.
 *
 * Defensive: never throws. If DocumentProperties is unavailable for
 * any reason the worst-case is the email simply never gets debounced
 * — it falls back to the legacy "send on every run" behavior, which
 * is the safer failure mode (no missed emails).
 */
function bumpDebouncePlannerLastSaveAt_() {
  try {
    PropertiesService.getDocumentProperties().setProperty(
      DEBOUNCE_LAST_SAVE_KEY_,
      String(Date.now())
    );
  } catch (_e) { /* defensive */ }
}

/**
 * Marks "we just settled the email queue" — called after any
 * `emailMode: 'send'` run finishes, regardless of whether an email
 * actually went out (e.g. the meaningfulness gate may have skipped
 * it, or no recipient was configured). Without this, case 9 from the
 * test plan would have the trigger keep polling every 5 min forever
 * because `LAST_SAVE_AT > LAST_PLANNER_EMAIL_AT` would never resolve.
 *
 * We bump `LAST_PLANNER_EMAIL_AT` to now AND clear `LAST_SAVE_AT` so
 * the trigger considers the queue empty until the next save bumps it
 * again.
 */
function markDebouncePlannerEmailSettled_() {
  try {
    var props = PropertiesService.getDocumentProperties();
    props.setProperty(DEBOUNCE_LAST_EMAIL_KEY_, String(Date.now()));
    props.deleteProperty(DEBOUNCE_LAST_SAVE_KEY_);
  } catch (_e) { /* defensive */ }
}

/**
 * Time-driven trigger handler. Polls every
 * DEBOUNCE_TRIGGER_INTERVAL_MIN_ minutes and decides whether the
 * deferred queue has settled long enough to send.
 *
 * Errors are caught and logged but never re-thrown — Apps Script
 * surfaces uncaught trigger errors to the script owner via email,
 * which would itself become a noise channel. Anything we can't
 * recover from we'd rather see in `console.error` than in inbox spam.
 */
function debouncePlannerEmailRun() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var lastSaveAtStr = props.getProperty(DEBOUNCE_LAST_SAVE_KEY_);
    if (!lastSaveAtStr) return;

    var lastSaveAt = Number(lastSaveAtStr);
    if (!isFinite(lastSaveAt) || lastSaveAt <= 0) return;

    var now = Date.now();
    if ((now - lastSaveAt) < DEBOUNCE_QUIET_WINDOW_MS_) return;

    var lastEmailAtStr = props.getProperty(DEBOUNCE_LAST_EMAIL_KEY_);
    var lastEmailAt = Number(lastEmailAtStr || 0);
    if (lastEmailAt >= lastSaveAt) {
      // Already emailed since the last save — nothing pending. Defensive
      // clear so the queue doesn't get stuck if state ever drifted.
      props.deleteProperty(DEBOUNCE_LAST_SAVE_KEY_);
      return;
    }

    // Quiet window elapsed and no email has gone out since the last
    // save. Run the planner with the email mode that actually sends.
    // markDebouncePlannerEmailSettled_ is called from inside
    // sendPlannerEmailIfConfigured_ so we don't need to clear state
    // here.
    if (typeof runDebtPlanner === 'function') {
      runDebtPlanner({ emailMode: 'send' });
    }
  } catch (e) {
    try {
      console.error('[debouncePlannerEmailRun] ' + (e && e.stack ? e.stack : e));
    } catch (_e) { /* defensive */ }
  }
}

// CacheService key + TTL for the trigger-existence memo. Caching avoids
// running `ScriptApp.getProjectTriggers()` on every `refreshSnapshot()`
// call (which fires after every save). Once we've confirmed the trigger
// exists, we skip the round-trip for the next hour. Self-healing still
// works because the cache misses after expiry, the user navigates pages
// (load path), or the cache is flushed by Apps Script.
var DEBOUNCE_TRIGGER_CACHE_KEY_ = 'PLANNER_DEBOUNCE_TRIGGER_OK';
var DEBOUNCE_TRIGGER_CACHE_TTL_S_ = 60 * 60; // 1 hour

/**
 * Idempotently registers the debounce time trigger on first dashboard
 * load. Called from `getDashboardSnapshot()` so the trigger gets
 * created the first time any user opens the dashboard, without a
 * separate first-run install step. Safe to call repeatedly: if a
 * trigger for `DEBOUNCE_TRIGGER_HANDLER_NAME_` already exists we
 * return immediately.
 *
 * `getDashboardSnapshot()` is also called from `refreshSnapshot()`
 * after every save, so we memoize the "trigger is OK" verdict in
 * `CacheService` for an hour. Cache miss path falls back to the full
 * `ScriptApp.getProjectTriggers()` lookup. Cache failure is non-fatal
 * — we just do the lookup more often than necessary.
 *
 * Self-healing: if a user manually deletes the trigger from the Apps
 * Script Triggers UI, the cache will expire within an hour and the
 * next dashboard load recreates it.
 *
 * Defensive: any failure (permission, quota, transient) is swallowed
 * and logged. The dashboard itself must keep working even if trigger
 * creation fails.
 */
function ensureDebouncePlannerTrigger_() {
  try {
    // Fast path: cached "trigger present" verdict from a recent call.
    var cache = null;
    try {
      cache = CacheService.getDocumentCache();
    } catch (_cacheErr) {
      cache = null;
    }
    if (cache && cache.get(DEBOUNCE_TRIGGER_CACHE_KEY_) === '1') {
      return;
    }

    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === DEBOUNCE_TRIGGER_HANDLER_NAME_) {
        if (cache) cache.put(DEBOUNCE_TRIGGER_CACHE_KEY_, '1', DEBOUNCE_TRIGGER_CACHE_TTL_S_);
        return;
      }
    }

    ScriptApp.newTrigger(DEBOUNCE_TRIGGER_HANDLER_NAME_)
      .timeBased()
      .everyMinutes(DEBOUNCE_TRIGGER_INTERVAL_MIN_)
      .create();

    if (cache) cache.put(DEBOUNCE_TRIGGER_CACHE_KEY_, '1', DEBOUNCE_TRIGGER_CACHE_TTL_S_);
  } catch (e) {
    try {
      console.error('[ensureDebouncePlannerTrigger_] ' + (e && e.stack ? e.stack : e));
    } catch (_e) { /* defensive */ }
  }
}
