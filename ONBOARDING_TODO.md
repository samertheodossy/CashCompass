# Onboarding TODO (future work)

Planned for after hardening the current flow with testing. No implementation yet—reference only.

---

Here’s a **long-term onboarding plan** that fits how your planner already thinks (INPUT / SYS / HOUSES / Cash Flow years, planner run, web dashboard). No code—just structure and options.

---

### 1. **Decide the “source of truth” model**

- **One Google spreadsheet per household** (recommended): everything the script touches lives there; onboarding creates or prepares that file.
- **Alternative:** ship a **blank template spreadsheet** they **Make a copy** of, then your script only “binds” to that copy. Onboarding is lighter (rename, link web app, run checklist) but you must keep the template updated when you add tabs/columns.

Most teams do **template + first-run wizard** so column names and tab names stay correct.

---

### 2. **What onboarding must produce (behind the scenes)**

Group into **shell** vs **data**:

**Shell (tabs + structure, safe to auto-create)**  
- Core **INPUT** tabs you already depend on (e.g. House Values, Bank, Investments, Debts, Bills, Cash Flow for current + next year as needed).  
- **SYS** tabs the planner syncs into (Accounts, Assets, House Assets, etc.—whatever `code.js` / `dashboard_data` expect by name).  
- **HOUSES - {name}** only when they add a property (or one generic placeholder they rename).  
- **OUT - History** (or equivalent) if the planner writes runs there.  
- **HOME** or index tab if you use it for navigation.  

**Data (user-specific, wizard collects)**  
- Accounts / institutions, debt accounts, houses, bill payees, rough opening balances—enough to run planner once without errors.

**Rule of thumb:** onboarding **creates tabs and headers** from a **single schema definition** (your “contract” with the code). It does **not** guess their life story— it asks questions and writes rows.

---

### 3. **Suggested user journey (high level)**

**Phase A — Access**  
- They get: link to **deployed web app** + short doc (“Allow access to this spreadsheet”).  
- Optional: one-time **“Link this spreadsheet”** if the app isn’t always bound to `SpreadsheetApp.getActive()`.

**Phase B — Start**  
- Choice: **“Start from template”** (recommended) vs **“I already have a workbook”** (advanced—only if you later support import/mapping).

**Phase C — Household profile (5–10 minutes)**  
- Time zone / currency (if relevant).  
- **People** (optional): for retirement UI labels only, not required for v1.  

**Phase D — Entities (the meat)**  
Wizards in logical order (dependencies matter):

1. **Cash & banks** — name, type, optional starting balance month.  
2. **Investments** — same idea, fewer fields.  
3. **Debts** — each loan/card: name, balance, minimum, APR optional; mark “mortgage vs card vs other” if your logic branches.  
4. **Real estate** — each property: display name (must match how **Rent** payees and **HOUSES -** tabs will align), optional type (rental vs home), rough value, loan link if applicable.  
5. **Bills (recurring)** — optional in v1; can be “add later in INPUT - Bills.”  

Each step: **“Add another” / “Done”**; show **plain-language preview** (“We will create `HOUSES - Oakley` and a row on SYS - House Assets”).

**Phase E — First Cash Flow year**  
- “Which year should we start?” → create **INPUT - Cash Flow {year}** with correct month columns + empty Payee rows or a small set of starter rows.  
- Explain: **Quick add** (Cash Flow) and the dashboard fill **INPUT - Cash Flow** over time.

**Phase F — Validate**  
- **Checklist** before first **Run Planner**: required tabs exist, required headers present, at least one bank row, debts sheet parseable, etc.  
- Show **fix links** (“Missing SYS tab X—Create it” or “Column ‘Payee’ not found—Repair sheet”).

**Phase G — First run**  
- Button: **Run Planner + Refresh Snapshot** with tooltip “First run may take a minute.”  
- Success screen: link to **Overview** and **Help**.

---

### 4. **Where the UX lives**

| Surface | Pros | Cons |
|--------|------|------|
| **Web app wizard** (new “Setup” page) | Best for multi-step, progress, validation | Must be built and maintained |
| **Sidebar from sheet menu** | Always next to data | Cramped for long flows |
| **Template + PDF/checklist** | Zero code initially | Errors, wrong tab names, support burden |

**Recommendation:** long term, a **Setup** area in the **same web app** (like Help), with **server functions** that create tabs/ranges using your existing naming rules—one place to keep in sync with `house_values.js`, `debts.js`, etc.

---

### 5. **Versioning and safety**

- **Idempotent creation:** “Create missing tabs only”; never wipe user data without explicit **Reset** flow.  
- **Schema version** in Script Properties or a hidden **CONFIG** tab: when you ship breaking column changes, onboarding or a **“Repair workbook”** routine can add columns.  
- **Export/backup** nudge before destructive operations.

---

### 6. **Rollout order (practical)**

1. **Frozen template spreadsheet** + written **setup guide** (same day value).  
2. **Validation-only mode:** “Scan my workbook” reports what’s wrong (builds trust).  
3. **Guided creator** for banks + debts + one house + one Cash Flow year.  
4. **Bills / HOUSES** automation and **import from CSV** later.

---

### 7. **What you’d document for “someone else”**

- One-pager: **What this spreadsheet is**, **never rename these tabs**, **where to enter truth** (INPUT vs SYS).  
- Link to **Help** in the app for **Property performance**, **Bills Due**, **Rent payee naming**, etc.—onboarding sends them there after setup.

---

**Bottom line:** Treat onboarding as **“generate a valid workbook contract + minimal seed data”**, not as **“AI fills their whole financial life.”** Template + web **Setup** wizard + validation + first planner run is the scalable path; everything else can grow in phases.
