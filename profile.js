/**
 * Profile (Contact Info) — onboarding step + lightweight key/value store
 * on INPUT - Settings.
 *
 * Design notes:
 *   - Storage is intentionally a simple Key/Value sheet so we can grow
 *     additional settings (preferences, notification flags, etc.) over
 *     time without reshaping the sheet.
 *   - Name + Email are required; Phone, Address, Date of Birth, and
 *     every spouse field are optional. The Settings sheet may hold
 *     other keys too; we only read/write the profile keys listed in
 *     PROFILE_KEYS_ from this module.
 *   - Read-only onboarding conventions still apply to the status probe
 *     and the detail read. Writes happen exclusively through
 *     saveOnboardingProfileFromDashboard, which is only invoked by the
 *     user clicking Save inside the Profile editor.
 *   - No authentication, no passwords, no accounts system. This module
 *     captures contact info for planner emails and personalization
 *     only.
 */

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

var PROFILE_SETTINGS_SHEET_NAME_ = 'INPUT - Settings';

// Keys written by this module. Using a constant map keeps the canonical
// spelling in one place and lets tests / future readers grep for them.
// Primary (Name / Email / Phone / Address) has been here since V1.
// DOB + Spouse fields were added in V1.1 as optional profile expansion;
// none of them are required and they do not change the Setup completion
// contract (which still only checks Name + Email).
var PROFILE_KEYS_ = {
  NAME: 'Name',
  EMAIL: 'Email',
  PHONE: 'Phone',
  ADDRESS: 'Address',
  DOB: 'Date of Birth',
  SPOUSE_NAME: 'Spouse Name',
  SPOUSE_EMAIL: 'Spouse Email',
  SPOUSE_PHONE: 'Spouse Phone',
  SPOUSE_ADDRESS: 'Spouse Address',
  SPOUSE_DOB: 'Spouse Date of Birth'
};

// Upper bound enforced on saves so pathological paste-in data cannot
// bloat the Settings sheet or an email envelope.
var PROFILE_MAX_LENGTH_ = 500;

// Very small RFC-5322-inspired validator. Errs on the side of accepting
// anything with a local part, @, and a domain-like tail. We only use
// this for obvious-typo rejection on the client; real delivery errors
// surface when MailApp.sendEmail runs.
var PROFILE_EMAIL_REGEX_ = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Date-of-birth values are canonically stored as YYYY-MM-DD text, which
// is what the HTML <input type="date"> picker emits. Google Sheets,
// however, auto-parses a cell like "1972-10-15" into a real Date, and
// google.script.run can deliver that Date straight into the server
// handler — so the save path must also accept Date objects and other
// date-like strings (e.g. "Sun Oct 15 1972 ..." locale output, or US
// "10/15/1972") that Sheets sometimes echoes back. This keeps Profile
// DOB handling in sync with retirement.js `computeAgeFromDob_`, which
// already accepts the same widened input surface.
//
// Blank is allowed — DOB is optional — and `null` is returned to signal
// "non-empty but invalid" so callers can produce the right error.
var PROFILE_DOB_REGEX_ = /^\d{4}-\d{2}-\d{2}$/;

function formatProfileDobCanonical_(year, month, day) {
  return String(year).padStart(4, '0') + '-' +
         String(month).padStart(2, '0') + '-' +
         String(day).padStart(2, '0');
}

/**
 * Normalize a raw DOB value into its canonical YYYY-MM-DD string.
 *
 * Returns:
 *   ''    → empty input (blank DOB is allowed — field is optional)
 *   null  → non-empty input that could not be coerced to a valid date
 *   'YYYY-MM-DD' → canonical form for a valid calendar date
 *
 * Accepted input shapes mirror retirement.js `computeAgeFromDob_`:
 *   1. Real Date instance (e.g. Sheets-parsed cell delivered as-is)
 *   2. Canonical YYYY-MM-DD string (HTML date picker output)
 *   3. Any other date-like string the platform can parse
 *
 * All accepted inputs run through the same calendar round-trip check,
 * so widening the input surface does not widen what "valid DOB" means.
 */
function normalizeProfileDobValue_(value) {
  if (value === null || value === undefined) return '';

  var y, m, d;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    y = value.getFullYear();
    m = value.getMonth() + 1;
    d = value.getDate();
  } else {
    var s = String(value).trim();
    if (!s) return '';

    var iso = s.match(PROFILE_DOB_REGEX_);
    if (iso) {
      y = Number(s.slice(0, 4));
      m = Number(s.slice(5, 7));
      d = Number(s.slice(8, 10));
    } else {
      var parsed = new Date(s);
      if (isNaN(parsed.getTime())) return null;
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    }
  }

  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;

  var probe = new Date(y, m - 1, d);
  if (
    probe.getFullYear() !== y ||
    probe.getMonth() !== m - 1 ||
    probe.getDate() !== d
  ) {
    return null;
  }

  return formatProfileDobCanonical_(y, m, d);
}

/**
 * Thin wrapper retained for symmetry with earlier callers. A value is
 * considered a "valid profile date" when it normalizes to a non-empty
 * canonical YYYY-MM-DD string.
 */
function isValidProfileDateString_(value) {
  var normalized = normalizeProfileDobValue_(value);
  return typeof normalized === 'string' && normalized !== '';
}

// Canonical empty profile — used as the fallback shape whenever a read
// fails or no keys are set yet. Keeping this in one place means every
// reader (including the error branch in getOnboardingProfileFromDashboard)
// returns the same shape the UI expects.
function emptyProfileShape_() {
  return {
    name: '', email: '', phone: '', address: '',
    dateOfBirth: '',
    spouseName: '', spouseEmail: '', spousePhone: '', spouseAddress: '',
    spouseDateOfBirth: ''
  };
}

/* -------------------------------------------------------------------------- */
/*  Settings sheet plumbing                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ensure INPUT - Settings exists with a Key / Value header row.
 * Creates the sheet on first call; subsequent calls are no-ops.
 * Returns the sheet.
 */
function ensureInputSettingsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROFILE_SETTINGS_SHEET_NAME_);
  if (sheet) {
    // Self-heal a legitimately empty sheet: if somebody manually cleared
    // row 1 we restore the header so reads don't blow up downstream.
    var topLeft = String(sheet.getRange(1, 1).getValue() || '').trim();
    if (!topLeft) {
      sheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
      try {
        sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
        sheet.setFrozenRows(1);
      } catch (_e) { /* cosmetic */ }
    }
    return sheet;
  }

  sheet = ss.insertSheet(PROFILE_SETTINGS_SHEET_NAME_);
  sheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
  try {
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 360);
  } catch (_e) { /* cosmetic */ }
  return sheet;
}

/**
 * Read every non-blank Key/Value row on INPUT - Settings into a plain
 * map. Values are trimmed strings. Duplicate keys keep the last value
 * written (matches spreadsheet-intuitive "last cell wins").
 */
function readAllSettingsMap_() {
  var sheet = ensureInputSettingsSheet_();
  var map = {};
  var last = sheet.getLastRow();
  if (last < 2) return map;
  var values = sheet.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    if (!key) continue;
    map[key] = String(values[i][1] == null ? '' : values[i][1]).trim();
  }
  return map;
}

/**
 * Upsert a single Key/Value row. Returns true if the sheet was
 * modified. Blank values are permitted and are written as empty
 * strings so downstream readers can distinguish "intentionally
 * cleared" from "never set".
 */
function writeSetting_(sheet, key, value) {
  var k = String(key || '').trim();
  if (!k) return false;
  var v = value == null ? '' : String(value);

  var last = sheet.getLastRow();
  if (last >= 2) {
    var existing = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < existing.length; i++) {
      var row = String(existing[i][0] || '').trim();
      if (row === k) {
        sheet.getRange(i + 2, 2).setValue(v);
        return true;
      }
    }
  }
  sheet.appendRow([k, v]);
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Profile read / write                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Raw (non-stringified) DOB reader for the two Profile DOB keys.
 *
 * `readAllSettingsMap_` coerces every value to a trimmed string, which
 * is fine for text fields but destroys type information for DOB cells
 * that Google Sheets auto-parsed into real Date objects (the common
 * case when a user types "1972-10-15" directly into INPUT - Settings).
 * The date-picker input in the Profile editor only accepts
 * `YYYY-MM-DD`, so a locale-formatted Date.toString() payload would
 * silently blank the field on edit.
 *
 * This helper scans the Settings sheet once and returns the two DOB
 * values with their original cell type intact (Date / string / blank).
 * Normalization to canonical `YYYY-MM-DD` happens in the caller via
 * `normalizeProfileDobValue_` so invalid or legacy values degrade to
 * `''` rather than leaking locale strings to the client.
 *
 * Never throws: any read failure returns both slots as `''`.
 */
function readProfileDobRawValues_() {
  var out = { dob: '', spouseDob: '' };
  try {
    var sheet = ensureInputSettingsSheet_();
    var last = sheet.getLastRow();
    if (last < 2) return out;
    var values = sheet.getRange(2, 1, last - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) {
      var key = String(values[i][0] == null ? '' : values[i][0]).trim();
      if (!key) continue;
      // IMPORTANT: do NOT stringify here — we need the raw Date object
      // when Sheets auto-parsed the cell. The normalizer accepts Date,
      // canonical YYYY-MM-DD, and other date-like strings.
      var raw = values[i][1];
      if (key === PROFILE_KEYS_.DOB) {
        out.dob = raw == null ? '' : raw;
      } else if (key === PROFILE_KEYS_.SPOUSE_DOB) {
        out.spouseDob = raw == null ? '' : raw;
      }
    }
  } catch (_e) {
    // DOB hydration is best-effort. Any failure falls back to '' which
    // the UI renders as "not set", matching blank-workbook behavior.
  }
  return out;
}

/**
 * Return the current profile as a plain object. All profile fields
 * (Name / Email / Phone / Address / Date of Birth / five spouse
 * fields) are always present, defaulting to empty strings so the
 * client can bind directly without null-guards. Safe to call even if
 * INPUT - Settings doesn't exist (it will be created on first read).
 *
 * DOB fields are normalized to canonical `YYYY-MM-DD` (or `''`) before
 * leaving this function. This keeps the Profile edit form's
 * `<input type="date">` inputs in sync with whatever is actually in
 * INPUT - Settings — including cells that Google Sheets auto-parsed
 * into Date objects, which would otherwise round-trip through the
 * Settings map as unusable locale strings.
 */
function getProfileSettings() {
  var map = readAllSettingsMap_();
  var dobRaw = readProfileDobRawValues_();

  var normalizedDob = normalizeProfileDobValue_(dobRaw.dob);
  var normalizedSpouseDob = normalizeProfileDobValue_(dobRaw.spouseDob);

  return {
    name: map[PROFILE_KEYS_.NAME] || '',
    email: map[PROFILE_KEYS_.EMAIL] || '',
    phone: map[PROFILE_KEYS_.PHONE] || '',
    address: map[PROFILE_KEYS_.ADDRESS] || '',
    // Coerce `null` (non-empty-but-invalid, e.g. a corrupted legacy
    // value) back to '' so the UI sees "no DOB" instead of a raw
    // locale blob it can't render into a date input.
    dateOfBirth: normalizedDob || '',
    spouseName: map[PROFILE_KEYS_.SPOUSE_NAME] || '',
    spouseEmail: map[PROFILE_KEYS_.SPOUSE_EMAIL] || '',
    spousePhone: map[PROFILE_KEYS_.SPOUSE_PHONE] || '',
    spouseAddress: map[PROFILE_KEYS_.SPOUSE_ADDRESS] || '',
    spouseDateOfBirth: normalizedSpouseDob || ''
  };
}

/**
 * Validate + persist the profile. Returns
 *   { ok: true,  profile, message }
 *   { ok: false, errors: { field: message } }
 *
 * Only the profile keys managed by this module (Name / Email / Phone /
 * Address / Date of Birth + the five spouse counterparts) are touched;
 * any unrelated rows on INPUT - Settings are preserved.
 *
 * Contract:
 *   - Name + Email are required (unchanged from V1).
 *   - Phone, Address, Date of Birth, and every spouse field are
 *     optional; blank trimmed values save cleanly and clear any
 *     prior value.
 *   - DOB fields, when non-empty, must be a valid calendar date in
 *     YYYY-MM-DD form (matches the HTML <input type="date"> payload).
 */
function saveProfileSettings(profile) {
  var errors = {};
  var input = profile || {};

  var name = String(input.name || '').trim();
  var email = String(input.email || '').trim();
  var phone = String(input.phone || '').trim();
  var address = String(input.address || '').trim();

  var spouseName = String(input.spouseName || '').trim();
  var spouseEmail = String(input.spouseEmail || '').trim();
  var spousePhone = String(input.spousePhone || '').trim();
  var spouseAddress = String(input.spouseAddress || '').trim();

  // DOB inputs are passed to the normalizer unstringified so that a Date
  // object (from google.script.run / Sheets auto-parsing) reaches it
  // intact. The normalizer returns '' for blank, null for invalid, and
  // a canonical 'YYYY-MM-DD' string for any accepted shape.
  var normalizedDob = normalizeProfileDobValue_(input.dateOfBirth);
  var dateOfBirth = normalizedDob === null ? '' : normalizedDob;

  var normalizedSpouseDob = normalizeProfileDobValue_(input.spouseDateOfBirth);
  var spouseDateOfBirth = normalizedSpouseDob === null ? '' : normalizedSpouseDob;

  if (!name) errors.name = 'Name is required.';
  if (name.length > PROFILE_MAX_LENGTH_) errors.name = 'Name is too long.';

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!PROFILE_EMAIL_REGEX_.test(email)) {
    errors.email = 'Enter a valid email address.';
  } else if (email.length > PROFILE_MAX_LENGTH_) {
    errors.email = 'Email is too long.';
  }

  if (phone.length > PROFILE_MAX_LENGTH_) errors.phone = 'Phone is too long.';
  if (address.length > PROFILE_MAX_LENGTH_) errors.address = 'Address is too long.';

  // DOB + Spouse fields are all optional. We only surface a validation
  // error when the caller provided a non-empty value that the
  // normalizer could not resolve to a real calendar date. A fully-blank
  // spouse section always saves cleanly (including on a populated
  // workbook where only the primary user is present).
  if (normalizedDob === null) {
    errors.dateOfBirth = 'Enter a valid date.';
  }

  if (spouseName.length > PROFILE_MAX_LENGTH_) {
    errors.spouseName = 'Spouse name is too long.';
  }

  if (spouseEmail) {
    if (!PROFILE_EMAIL_REGEX_.test(spouseEmail)) {
      errors.spouseEmail = 'Enter a valid email address.';
    } else if (spouseEmail.length > PROFILE_MAX_LENGTH_) {
      errors.spouseEmail = 'Spouse email is too long.';
    }
  }

  if (spousePhone.length > PROFILE_MAX_LENGTH_) {
    errors.spousePhone = 'Spouse phone is too long.';
  }
  if (spouseAddress.length > PROFILE_MAX_LENGTH_) {
    errors.spouseAddress = 'Spouse address is too long.';
  }
  if (normalizedSpouseDob === null) {
    errors.spouseDateOfBirth = 'Enter a valid date.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors };
  }

  var sheet = ensureInputSettingsSheet_();
  writeSetting_(sheet, PROFILE_KEYS_.NAME, name);
  writeSetting_(sheet, PROFILE_KEYS_.EMAIL, email);
  writeSetting_(sheet, PROFILE_KEYS_.PHONE, phone);
  writeSetting_(sheet, PROFILE_KEYS_.ADDRESS, address);
  writeSetting_(sheet, PROFILE_KEYS_.DOB, dateOfBirth);
  writeSetting_(sheet, PROFILE_KEYS_.SPOUSE_NAME, spouseName);
  writeSetting_(sheet, PROFILE_KEYS_.SPOUSE_EMAIL, spouseEmail);
  writeSetting_(sheet, PROFILE_KEYS_.SPOUSE_PHONE, spousePhone);
  writeSetting_(sheet, PROFILE_KEYS_.SPOUSE_ADDRESS, spouseAddress);
  writeSetting_(sheet, PROFILE_KEYS_.SPOUSE_DOB, spouseDateOfBirth);

  return {
    ok: true,
    profile: {
      name: name,
      email: email,
      phone: phone,
      address: address,
      dateOfBirth: dateOfBirth,
      spouseName: spouseName,
      spouseEmail: spouseEmail,
      spousePhone: spousePhone,
      spouseAddress: spouseAddress,
      spouseDateOfBirth: spouseDateOfBirth
    },
    message: 'Profile saved.'
  };
}

/* -------------------------------------------------------------------------- */
/*  Onboarding integration                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Profile probe for the onboarding status grid.
 *   complete — both Name and Email are filled.
 *   missing  — otherwise (we don't expose a partial label to the user).
 *
 * Never throws: if INPUT - Settings cannot be read for any reason we
 * report 'missing' with a clear note, matching the other probes.
 */
function probeProfileStatus_() {
  try {
    var p = getProfileSettings();
    var hasName = !!(p.name && p.name.trim());
    var hasEmail = !!(p.email && p.email.trim());
    if (hasName && hasEmail) {
      return {
        // count/partialCount are reported as 0 because Profile is a
        // singleton — the grid-card renderer would otherwise tack on a
        // confusing "1 tracked" line next to the actual identity note.
        status: 'complete',
        count: 0,
        partialCount: 0,
        sheetExists: true,
        sheetName: PROFILE_SETTINGS_SHEET_NAME_,
        note: p.name + ' · ' + p.email
      };
    }
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: true,
      sheetName: PROFILE_SETTINGS_SHEET_NAME_,
      note: hasName || hasEmail ? 'Name and email are both required.' : 'Not set up.'
    };
  } catch (e) {
    return {
      status: 'missing',
      count: 0,
      partialCount: 0,
      sheetExists: false,
      sheetName: PROFILE_SETTINGS_SHEET_NAME_,
      note: 'Could not read Settings sheet.'
    };
  }
}

/**
 * Client-facing profile detail read. Mirrors the shape of the other
 * getOnboarding*FromDashboard readers so the client can render it the
 * same way. TEST mode is not supported for Profile — the Settings
 * sheet is a singleton.
 */
function getOnboardingProfileFromDashboard(_mode) {
  var sheetExists;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    sheetExists = !!ss.getSheetByName(PROFILE_SETTINGS_SHEET_NAME_);
  } catch (e) {
    sheetExists = false;
  }

  var profile;
  try {
    profile = getProfileSettings();
  } catch (e) {
    return {
      mode: 'normal',
      sheetName: PROFILE_SETTINGS_SHEET_NAME_,
      sheetExists: sheetExists,
      profile: emptyProfileShape_(),
      status: 'missing',
      statusNote: 'Could not read Settings sheet.'
    };
  }

  var hasName = !!(profile.name && profile.name.trim());
  var hasEmail = !!(profile.email && profile.email.trim());
  var status = hasName && hasEmail ? 'complete' : 'missing';
  var statusNote = status === 'complete'
    ? profile.name + ' · ' + profile.email
    : 'Add your name and email to continue.';

  return {
    mode: 'normal',
    sheetName: PROFILE_SETTINGS_SHEET_NAME_,
    sheetExists: sheetExists,
    profile: profile,
    status: status,
    statusNote: statusNote
  };
}

/**
 * Client-facing save. Returns the same shape as
 * getOnboardingProfileFromDashboard on success so the client can
 * re-render immediately without a second round trip.
 */
function saveOnboardingProfileFromDashboard(profile) {
  var result = saveProfileSettings(profile);
  if (!result.ok) {
    return { ok: false, errors: result.errors };
  }
  var detail = getOnboardingProfileFromDashboard('normal');
  detail.ok = true;
  detail.message = result.message;
  return detail;
}

/**
 * Symmetry helper: matches ensureOnboardingBankAccountsSheetFromDash-
 * board et al. Only used if the client explicitly wants to create the
 * sheet ahead of opening the editor. Saving already ensures the sheet,
 * so this is currently optional.
 */
function ensureOnboardingSettingsSheetFromDashboard(_mode) {
  try {
    ensureInputSettingsSheet_();
    return {
      ok: true,
      created: true, // idempotent; we don't distinguish existing vs new
      sheetName: PROFILE_SETTINGS_SHEET_NAME_,
      mode: 'normal'
    };
  } catch (e) {
    return {
      ok: false,
      created: false,
      sheetName: PROFILE_SETTINGS_SHEET_NAME_,
      mode: 'normal',
      reason: 'Could not create Settings sheet: ' + (e && e.message ? e.message : e)
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Email recipient resolution (consumed by planner_output.js)                */
/* -------------------------------------------------------------------------- */

/**
 * Return the email address planner / notification senders should use.
 *
 * Resolution order:
 *   1. INPUT - Settings → Email (user-configured from the Profile step)
 *   2. Session.getActiveUser().getEmail() fallback
 *
 * Returns an empty string if neither is available. Callers must treat
 * an empty result as "no configured recipient" and skip sending.
 */
function getPlannerEmailRecipient_() {
  var configured = '';
  try {
    var map = readAllSettingsMap_();
    configured = String(map[PROFILE_KEYS_.EMAIL] || '').trim();
  } catch (_e) {
    configured = '';
  }
  if (configured && PROFILE_EMAIL_REGEX_.test(configured)) return configured;

  var fallback = '';
  try {
    fallback = String((Session.getActiveUser() && Session.getActiveUser().getEmail()) || '').trim();
  } catch (_e2) {
    fallback = '';
  }
  return fallback;
}
