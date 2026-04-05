# Security notes and plan

This project is a **Google Apps Script** app bound to a **spreadsheet**, with an **HtmlService** web dashboard. Use this doc as a **checklist** when changing deployment, sharing, or client/server code. It complements `GoingToProduction.md` and `TESTING_PLAN.md`.

---

## Current deployment posture (verify after each redeploy)

Configured in `appsscript.json` (may be overridden in the Apps Script UI when publishing — **confirm both match intent**):

| Setting | Current value | Meaning |
|--------|----------------|--------|
| **Web app → Execute as** | `USER_DEPLOYING` | Server runs as the account that published the web app. |
| **Web app → Who has access** | `MYSELF` | Intended for **only your** Google account to use the deployed URL as an app user. |

**Implication:** Anyone who can open the web app **as an authorized user** runs code that can read/write the **bound spreadsheet** as the deploying user. Keeping **MYSELF** is the main control for a personal finance tool.

**If you change access** to “Anyone” / “Anyone within domain” / “Anyone with Google account,” treat that as a **security and privacy decision**, not a convenience toggle: you may be exposing **full workbook access** to a wider audience.

---

## Threat model (who we worry about)

- **You and trusted editors** — normal use; mistakes and bugs still matter.
- **Broader web app audience** — if access is widened without redesign: effectively **same trust as spreadsheet editor**.
- **Malicious or compromised collaborators** on the sheet — can change data, triggers, or script if they have script access.
- **XSS / unsafe rendering** — if untrusted strings (from the sheet or URL) become executable HTML/JS in the browser, actions run **as the logged-in Google user** viewing the app.
- **Supply chain / laptop** — `clasp push` deploys whatever is in the repo; protect Google account (2FA), machine, and repo access.

---

## Risks and mitigations

### 1. Web app access too broad

- **Risk:** Strangers or unintended accounts reach endpoints that mutate financial data.
- **Mitigation:** Default **MYSELF**; document a formal review before any widening; if you ever need multi-user, design **explicit** identity and scoping (not “just open the link”).

### 2. Cross-site scripting (XSS)

- **Risk:** Payee names, notes, or other sheet fields rendered as HTML/JS could run in the user’s session.
- **Mitigation:** Prefer **text** APIs (`textContent`, escaped templates); avoid `innerHTML` with **untrusted** data; audit new UI that builds HTML from strings. Review any third-party chart/library for how it accepts labels.

### 3. Secrets in code or client

- **Risk:** API keys, tokens, or passwords in committed `.js` or in `Dashboard_*` files ship to the browser.
- **Mitigation:** No long-lived secrets in client code; use **Script Properties** / Google’s auth for server-side needs. Follow repo rule: **no hardcoded credentials**.

### 4. Spreadsheet sharing

- **Risk:** Edit access = ability to change truth and possibly script project visibility.
- **Mitigation:** Least-privilege sharing; separate “viewer” vs “editor”; be explicit who may run **Extensions → Apps Script**.

### 5. Server entry points (`google.script.run`)

- **Risk:** Handlers that trust client payloads without validation could allow odd values (wrong payees, extreme amounts) or future abuse if access widens.
- **Mitigation:** **Validate** payloads server-side (types, ranges, allow-lists where possible); fail closed. Re-read new handlers when adding features.

### 6. Logging (Stackdriver / `exceptionLogging`)

- **Risk:** Logs that include PII or full financial payloads complicate privacy and incident response.
- **Mitigation:** Structured logs with **redaction**; avoid logging raw sheet rows or account identifiers unless necessary; never log Script Property values or tokens.

### 7. Dependencies and CDN scripts

- **Risk:** If you add external JS from a CDN, integrity and supply-chain risk increases.
- **Mitigation:** Pin versions; prefer Subresource Integrity where used; minimal footprint (see long-term chart item in `TODO.md`).

---

## Client vs server boundary (mental model)

- **Browser:** Renders UI; may hold **non-secret** display state. Treat as **untrusted** for authorization decisions.
- **Apps Script server:** Enforces business rules, reads/writes sheets, runs planner. **All** authorization for “can this change data?” should assume **server-side** checks if you ever multi-user.

---

## Baseline checklist — personal production (v0.9)

Use before/after meaningful releases:

- [ ] Web app deployment: **Who has access** = **Only myself** (or documented exception).
- [ ] Web app: **Execute as** matches what you expect (usually deploying user).
- [ ] No new **secrets** in repo or client-visible scripts.
- [ ] New UI paths: no **unescaped** sheet/user strings into HTML sinks.
- [ ] New `google.script.run` handlers: **validate** inputs; no arbitrary sheet IDs or file paths from client without checks.
- [ ] Spreadsheet sharing still matches **trusted** people only.
- [ ] Google account: **2FA** on; `clasp` machine reasonably secured.

---

## If you ship to others (beyond household)

Add or tighten:

- [ ] Written **threat model** + “who can access what” in user-facing docs.
- [ ] **Privacy / data handling** note (data lives in **their** Google account / Sheet; you are not the data processor unless you operate a backend).
- [ ] **Security review pass** on every server-exposed function after widening access.
- [ ] **Terms / disclaimer** (“not financial advice”) if distributed broadly.
- [ ] Revisit **CSP / framing** (`XFrameOptionsMode` is already set in code — review if embedding changes).

---

## Phased security plan (do not forget)

**Phase 1 — Lock assumptions (once, then on deploy changes)**  
- Record actual web app settings in `SESSION_NOTES.md` or release notes when you change deployment.  
- Complete the **v0.9 baseline checklist** above for the current release.

**Phase 2 — Hardening pass (scheduled, e.g. quarterly or before “friend beta”)**  
- Grep for risky patterns: `innerHTML`, `eval`, `document.write`, dynamic `Function(`.  
- Audit **top 10** `google.script.run` targets for input validation.  
- Confirm **no PII** in log statements you added for debugging.

**Phase 3 — Before widening web app access**  
- **Stop:** require explicit design doc: auth model, per-user spreadsheet binding, or “one deploy per household” only.  
- Do not widen **MYSELF** without completing Phase 2 + threat model update.

**Phase 4 — Optional external dependencies**  
- Before adding chart/CDN libraries: SRI, version pin, license note; re-run XSS/data-flow check for label/tooltip inputs.

---

## Related docs

- `GoingToProduction.md` — product stages and onboarding gap.  
- `TESTING_PLAN.md` — tests should include **security-sensitive** pure paths where relevant (e.g. parsing), not replace access control.  
- `WORKING_RULES.md` / `PROJECT_CONTEXT.md` — technical constraints for contributors.

---

*This is operational guidance, not a penetration test or legal advice. Update this file when deployment or trust boundaries change.*
