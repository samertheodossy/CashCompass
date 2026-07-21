# CashCompass Product Vision

*Guiding your money decisions.*

This is the highest-level product document in the repository. It defines **what CashCompass is becoming and why**. It is intentionally separate from the roadmap and the technical docs:

- **PRODUCT_VISION.md** (this doc) — *why* we are building CashCompass and where it is going.
- **`TODO.md → Product Maturity Stages`** — *how* and in *what order* we build it.
- **`BETA_10_OUT_OF_10_PLAN.md`** — the measurable quality, release, and monetization-readiness standard for earning a broad beta.
- **`TODO.md` (current work) + `ENHANCEMENTS.md`** — the current engineering backlog.
- **`PROJECT_CONTEXT.md`** — the current technical state.

When the vision and the roadmap disagree, the vision explains the destination and the roadmap is the source of truth for sequencing. This document deliberately avoids implementation detail, feature checklists, and dated status — those live in the roadmap and context docs.

---

## 1. Mission

**CashCompass exists to help people make confident financial decisions with money they actually understand and control.**

Most people do not lack financial data — they lack clarity. Their money is scattered across accounts, statements, and apps, and the numbers they see rarely add up to a decision they can trust. Traditional tools tell them *what happened* (they spent this, they have that) but stop short of the harder and more valuable question: *what should I do next, and why?*

CashCompass is built to close that gap. The problem we are solving is not "tracking transactions" — it is **decision confidence**: giving a person a single, trustworthy picture of their finances, an explainable view of where they are heading, and clear guidance on the choices in front of them, without asking them to surrender ownership of their data or trust a black box.

The outcome we care about is not a balanced budget for its own sake. It is a person who looks at their finances and thinks: *I understand this, I believe these numbers, and I know what to do.*

---

## 2. Vision

**CashCompass is not merely a budgeting application. It is intended to become a Personal Financial Operating System** — the single place a person goes to run their financial life.

An operating system does not just record; it coordinates. In that spirit, CashCompass aims to be the one place where people:

- **Understand their money** — a truthful, reconciled picture of cash, debt, assets, and net worth.
- **Plan their future** — projections, retirement, debt payoff, and long-term goals in the same place they see today's reality.
- **Make financial decisions** — with support that weighs trade-offs, not just dashboards that display them.
- **Receive guidance** — recommendations they can follow *and* interrogate, because every number is explainable.
- **Stay organized** — bills, income, accounts, and history in one durable, owned workspace.

The long-term ambition is that CashCompass becomes the layer between a person and their money: the place decisions are made, not just the place data is stored. Everything else in the product — the tracking, the imports, the eventual assistant — exists to serve that decision layer.

---

## 3. Positioning

CashCompass operates in a mature market with strong, well-designed products. The goal here is not to rank them but to be honest about where the category is strong, where it is thin, and where CashCompass is *intentionally* different. All of these tools are good at what they set out to do.

- **YNAB** — excellent at intentional, envelope-style budgeting and behavior change. Strongest for people who want a disciplined spending method. Less oriented toward long-horizon planning, integrated projections, and user-owned raw data.
- **Monarch / Copilot / Simplifi** — polished, modern aggregation-first experiences with strong automatic categorization and beautiful dashboards. Strongest at *observing* finances via connected accounts. The financial logic is largely internal to the product, and the underlying data lives in the vendor's system.
- **Quicken** — deep, long-established feature breadth across banking, investments, and reports. Strongest for comprehensive tracking. Carries the weight and complexity of a long product history.
- **Google Sheets / Excel** — total transparency, total ownership, and infinite flexibility. Strongest at trust — you can see and change every formula. Weakest at structure, guidance, and doing the work *for* you; every user rebuilds the same scaffolding by hand.

**Where CashCompass is intentionally different:** it sits deliberately between the "trust and ownership" of a spreadsheet and the "structure and polish" of a modern app. It is built *on* Google Sheets, so the user genuinely owns their data and can inspect the math — but it provides the structure, planning, integrity checks, and guidance that a raw spreadsheet never will. It leans toward **planning and decision support** rather than aggregation and observation. And it treats **explainability and ownership as features**, not afterthoughts. That combination — owned data, explainable logic, planning-first, decision-oriented — is the niche CashCompass is built to occupy.

---

## 4. Core Differentiators

These are the things CashCompass is choosing to be good at. Each is a deliberate bet.

- **Financial Decision Support.** The product's center of gravity is helping people decide, not just see. A dashboard that only displays balances leaves the hardest work to the user; CashCompass aims to carry more of it. *Why it matters:* decisions, not data, change financial outcomes.
- **Financial Integrity.** Numbers are reconciled and audited so that the figure on the Dashboard, the Planner, and the underlying sheets agree. *Why it matters:* a tool that people plan their lives around must be trustworthy to the cent, or it is worse than nothing.
- **Planning before tracking.** CashCompass starts from where you want to go and works back, rather than starting from what you spent and hoping insight emerges. *Why it matters:* tracking without a plan produces guilt; planning produces direction.
- **Google Sheets ownership.** The user's financial data lives in their own Drive-owned workbook. *Why it matters:* trust follows ownership — people believe numbers they can open, read, and keep.
- **Transparency.** The math is inspectable and the logic is explainable. *Why it matters:* advice you cannot verify is advice you cannot fully trust.
- **No vendor lock-in.** Because the data is a real spreadsheet the user owns, leaving is always possible. *Why it matters:* a product that is safe to leave is a product that is safe to rely on.
- **Central + Workbook architecture.** A single maintained application serves each user their own isolated, owned workbook. *Why it matters:* it combines the maintainability of a hosted service with the ownership of a personal file — updates without version drift, isolation without lock-in.
- **Recovery.** The system can detect, reconnect, and repair a user's link to their workbook. *Why it matters:* real financial data is irreplaceable; the ability to recover it is a precondition for trust.
- **Diagnostics.** The product can inspect and validate its own state. *Why it matters:* a financial tool must be able to prove it is healthy, not just assert it.
- **Long-term planning & Money Plan.** Retirement, debt payoff, forecasting, and guided allocation as first-class capabilities. *Why it matters:* this is where CashCompass earns its place as an operating system rather than a ledger.
- **Future AI assistant.** A conversational layer that explains and guides on top of an already-trustworthy, already-explainable engine. *Why it matters:* an assistant is only as good as the integrity of the numbers beneath it — which is why it comes after, not before, financial integrity.

---

## 5. Product Principles

These principles guide how product decisions are made when there is a trade-off. They are ordered roughly by priority.

- **The user owns the data.** Financial data lives in the user's own workbook. We build *around* their ownership, never in place of it. This constrains architecture and is a feature, not a limitation.
- **Financial calculations must be explainable.** If we cannot explain how a number was produced, we do not show it as advice. Explainability is a hard requirement, not a nice-to-have.
- **Every recommendation should be reproducible.** The same inputs must produce the same guidance. Reproducibility is what separates a financial tool from a slot machine.
- **No hidden financial logic.** There are no secret adjustments. What the user sees can be traced to sheets and rules they can inspect.
- **Recovery before convenience.** When a feature would make things faster but risk a user's link to their data, recovery and safety win. Convenience is only valuable on top of durability.
- **Integrity over automation.** Automating something that could produce a wrong-but-confident number is worse than doing less. We automate only what we can validate.
- **Speed matters.** A tool people consult for decisions must respond quickly enough to stay in the flow of thought. Performance is a feature; slowness erodes trust as surely as wrong numbers.
- **Documentation matters.** The product's behavior, rationale, and state are written down. This is how a small team keeps integrity and vision aligned over time.
- **Consistency matters.** Wording, loading, empty states, and interactions should feel like one coherent product. Consistency is how a tool earns the feeling of being reliable.

---

## 6. Product Evolution

The product grows along the same arc as the delivery roadmap, but described here in terms of *what the product becomes*, not which tasks ship. The authoritative sequencing lives in `TODO.md → Product Maturity Stages` (Stage 1–6); this section explains the meaning of each step.

- **Version 1 — a trustworthy personal financial planner.** The era in which CashCompass becomes something a household can genuinely run its finances on: a reconciled picture of today, real planning for the future, an owned workbook, and the integrity, recovery, and validation that make it safe to depend on. Version 1 spans the Family Beta and External Beta stages.
  - **Family Beta** *(Stages 3–4)* — the product proves it is trustworthy with real, engaged users close to the team. The emphasis is integrity, recovery, validation as a release gate, and a finished-feeling experience — earning trust before scale.
  - **External Beta** *(Stage 5)* — the product proves it holds up beyond the family circle: deeper long-term planning (Money Plan Phase 2), fuller workflows, and the support and scalability needed for users the team does not personally know.
- **Version 2 — the platform layer** *(Stage 6+)* — with a trustworthy core in place, CashCompass extends outward: a conversational assistant, operational tooling and metrics, analytics, account aggregation, and the foundations of a paid product. These deliberately follow Version 1 because they are only valuable on top of an engine that is already correct and explainable.
- **Version 3 and beyond — the financial operating system realized** — the long horizon in which planning, guidance, forecasting, and automation combine into the single place a person runs their financial life. This is the destination the earlier versions are quietly building toward.

The through-line is deliberate: **trust first, depth second, platform third.** Each version earns the right to the next.

---

## 7. Major Themes

The product is built from a set of recurring themes. They are not separate features so much as strands that reinforce one another.

- **Financial Integrity** is the foundation. It is what makes every other theme believable: planning, decision support, and an assistant are only as trustworthy as the reconciled numbers beneath them.
- **Decision Support** is the purpose. It is the reason integrity matters — correctness in service of better choices.
- **Money Plan, Planning, and Forecasting** are how decision support reaches into the future rather than only describing the present. Together they turn a record of the past into direction.
- **Workbook Ownership** is the trust substrate. It is why users believe the numbers (they can see them) and why they are safe to rely on the product (they can keep them).
- **Recovery and Diagnostics** protect that substrate. Ownership is only meaningful if the link to the data can be verified, reconnected, and repaired — and if the system can prove its own health.
- **Validation** is the discipline that lets integrity scale. It turns "we checked it" into an automated release gate, so correctness is enforced rather than hoped for.
- **Operations** is how the product stays healthy as it grows beyond a handful of users — the visibility and tooling that keep a trustworthy product trustworthy at scale.
- **Assistant** is the eventual human-facing layer over all of the above: it explains and guides, and it depends entirely on the integrity, explainability, and planning that come first.

The connection is a stack: **ownership** makes the data trustworthy, **integrity + validation** make the numbers trustworthy, **planning + decision support** make the numbers useful, **recovery + diagnostics + operations** keep the whole thing durable, and the **assistant** eventually makes it conversational.

---

## 8. Future Opportunities

These are directions CashCompass is positioned to pursue. They are opportunities, not promises or commitments, and they are not scheduled here — the roadmap decides what and when.

- **Chat Assistant** — a conversational interface over the existing engine.
- **Financial Coach** — proactive, ongoing guidance rather than on-demand answers.
- **Goal Engine** — structured goals with progress, trade-offs, and funding plans.
- **Scenario Planning** — "what if" modeling across income, spending, and life changes.
- **Investment Analysis** — deeper insight into holdings, allocation, and growth.
- **AI Explanations** — natural-language walkthroughs of how any number was produced.
- **House Planning** — buying, selling, refinancing, and equity decisions.
- **Retirement Forecasting** — richer long-horizon retirement modeling.
- **Family Planning** — shared financial planning across a household.
- **Business Mode** — support for people who blend personal and small-business finances.
- **Tax Planning** — surfacing tax-aware implications of financial decisions.
- **Account Aggregation** — connecting accounts to auto-discover balances and import transactions.
- **Operations Dashboard** — internal visibility into product and user health at scale.

Each of these is credible precisely because the Version 1 foundation — owned data, integrity, explainability — makes them safe to build.

---

## 9. Version 1 Definition

**Version 1 is the release at which a household can trust CashCompass to run its finances.** It is defined by trustworthiness and completeness of the core, not by breadth of features.

**What Version 1 must include:**

- **A single, reconciled financial picture** — cash, debt, assets, and net worth that agree across the Dashboard, Planner, and underlying sheets.
- **Real planning** — retirement, debt payoff, and the Money Plan (long-term/goal planning and guided allocation), so the product plans the future, not just records the past.
- **User-owned workbook architecture** — each user's data in their own Drive-owned workbook, served by the maintained Central App.
- **Financial Integrity** — auditing and convergence that make the numbers trustworthy to the cent.
- **Validation as a release gate** — automated checks that enforce correctness before changes ship.
- **Recovery** — the ability to detect, reconnect, and repair a user's link to their workbook, with the adoption and admin paths validated.
- **A finished-feeling experience** — visual parity for provisioned workbooks and consistent loading, wording, and empty states.
- **The full set of everyday modules** — accounts, bills, income, debts, properties, cash flow, activity history, and email.

**What intentionally waits until Version 2:**

- The **Chat / Assistant** layer.
- **Operational tooling** — Operations Dashboard, operational metrics, monitoring, and analytics.
- **Account Aggregation & Transaction Import** at scale.
- **Paid Product** packaging and tiering.

The boundary is principled: Version 1 is everything required to make CashCompass *correct and trustworthy*; Version 2 is everything that extends it into a *platform*. This aligns with the Stage roadmap, where Version 1 spans the Beta stages and Version 2 is the Future Platform stage (`TODO.md → Product Maturity Stages`).

---

## 10. Success Definition

We will consider CashCompass successful when it has earned a place in how people actually make financial decisions — not merely when it has users.

- **Users trust it.** They believe the numbers because they can see and own the math behind them.
- **Users rely on it.** It becomes the place they go to check where they stand and decide what to do — a habit, not a novelty.
- **Users make better financial decisions.** The guidance measurably improves the choices they make, not just the reports they read.
- **Users remain in control.** They keep ownership of their data and understanding of their finances; the product amplifies their control rather than replacing it.

Success is ultimately a feeling as much as a metric: a person opening CashCompass and thinking *I understand my money, I trust these numbers, and I know what to do next.* Everything in this document exists to make that sentence true.

---

## 11. Version 1 Guiding Conclusions

Strategic conclusions from the Version 1 Readiness Review (2026-07-06). These are the principles that decide sequencing and trade-offs on the road to Version 1 — the *why* behind the current Stage 3 priority order. They are deliberately few and strategic; the detailed roadmap lives in `TODO.md → Product Maturity Stages → Stage 3`.

- **Trust before features.** Version 1 is defined by trustworthiness of the core, not breadth. Every interesting feature (chat, aggregation, monetization) waits until the core is provably trustworthy.
- **The numbers must reconcile.** The product's central promise is a single financial picture that agrees across Dashboard, Planner, and the underlying sheets to the cent. Financial Integrity convergence (Phase 3) is the item on which Version 1 credibility rests.
- **Converge the workbook before broadening Family Beta.** A beta user's first impression is the workbook itself; a freshly provisioned workbook should converge toward the Golden Workbook (the visual source of truth) before more families see it. This is why Golden Workbook Convergence leads Stage 3.
- **The Validation Agent protects trust.** Correctness must be *enforced*, not hoped for. The Validation Agent turns reconciliation and regression checks into an automated release gate — and reduces reliance on a single person's manual pass.
- **Recovery must not create silent duplicates.** Ownership is only meaningful if the link to the data is durable. The full P0 recovery adoption matrix is now validated; recovery flags remain OFF by default and any later recovery extension must preserve the confirmed-zero-only create invariant.
- **Product differentiation depends on Decision Support.** Ownership and transparency get CashCompass in the door; the lasting differentiation is helping people *decide* — which is why Money Plan (long-term planning and guided allocation) is a Version 1 objective, not a Version 2 nicety.
- **Version 1 is a horizon, not a single date.** Version 1 spans Family Beta and External Beta. "Family Beta Release Candidate" and "Version 1 complete" are different milestones; sequencing honors that distinction.

---

## 12. Quality-First Beta and Monetization

CashCompass will be **quality-gated, not date-gated**. A supervised validation cohort may help us learn while the product is still being hardened, but a broad Beta Release Candidate must earn its release through measurable financial integrity, safety, usability, performance, automated evidence, privacy, and operational readiness.

The target is a **10/10 beta standard**, defined in `BETA_10_OUT_OF_10_PLAN.md`: at least 95/100 on the weighted scorecard, no dimension below 9/10, no unresolved Severity 1 or Severity 2 defect, and every non-negotiable release gate passing on the exact candidate. “10/10” means the focused core is excellent and provable; it does not mean every future feature is present.

Monetization should be prepared before payment is enabled. Identity and entitlement seams, owned-data guarantees, packaging hypotheses, privacy, terms, support, cancellation/export behavior, cost metrics, and billing architecture should be deliberate during beta hardening. Actual charging follows demonstrated trust, repeated household value, and supportability.

The commercial principle is simple: **monetize decision value, guidance, automation, and premium capability—not access to a user's own workbook or financial history.** A user's Drive-owned data remains theirs regardless of plan state.
