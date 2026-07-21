# CashCompass Knowledge Map

This document is the navigation index for the CashCompass knowledge base.

AI agents should use this document to discover project knowledge before reading individual documentation files.

Do not read every Markdown document by default.

Instead, identify the work being performed and then load only the relevant documentation.

---

# Project Foundation

Purpose

- README.md

Project Context

- PROJECT_CONTEXT.md

Product Vision

- PRODUCT_VISION.md

Roadmap

- ROADMAP.md

10/10 Beta and Monetization-Ready Plan

- BETA_10_OUT_OF_10_PLAN.md

Working Rules

- WORKING_RULES.md

Engineering Standards

- ENGINEERING_STANDARDS.md

Session History

- SESSION_NOTES.md

---

# Architecture

Overall Architecture

- PROJECT_CONTEXT.md
- SystemArch.md

Functional Assertions

- FUNCTIONAL_ASSERTION_ARCHITECTURE.md

Central App

- CENTRAL_APP_*.md

---

# Feature Knowledge

Canonical Template

- agents/templates/feature-knowledge.md

Feature Knowledge Documents

| Feature | Document | Knowledge status |
| --- | --- | --- |
| Bills | agents/features/bills.md | `DRAFT` |

Feature experts must use the canonical template and cite authoritative repository evidence. Each feature document is canonical; this map mirrors only its knowledge status, which must be updated in the same change whenever that status changes. Keep verification dates, Git references, product status, and other volatile details in the feature document rather than duplicating them here.

---

# Initiative Knowledge

Canonical Template

- agents/templates/initiative-knowledge.md

Initiative Knowledge Documents

| Initiative | Priority | Initiative status | Knowledge status | Document |
| --- | --- | --- | --- | --- |
| Project Stabilization | P0 | `COMPLETE` | `VERIFIED` | agents/initiatives/project-stabilization.md |

Initiative documents connect authoritative roadmap priorities to designs, features, evidence, and next tasks. They are navigation artifacts, not replacement roadmaps, and must not invent completion percentages or duplicate volatile status details.

---

# Workbook Safety

Golden Workbook

- GOLDEN_WORKBOOK.md

Workbook Parity

- WORKBOOK_PARITY_CHECKLIST.md

Generated Formatting

- GENERATED_SHEET_FORMATTING_POLISH_PLAN.md

---

# Testing

Testing Strategy

- TESTING_PLAN.md

Performance Observability

- PERFORMANCE_OBSERVABILITY.md

Regression

- REGRESSION_SCENARIOS.md
- REGRESSION_SUITE_PLAN.md

Test Harness

- TEST_HARNESS_ARCHITECTURE.md

---

# Validation

Validator

- VALIDATOR_ARCHITECTURE.md

Validation Console

- VALIDATION_TESTING_CONSOLE.md

Release Validation

- RELEASE_READINESS.md

---

# Deployment

Commit Rules

- COMMIT_RULES.md

Release Readiness

- RELEASE_READINESS.md

Central Deployment

- CENTRAL_APP_DEPLOYMENT_*.md

---

# Planning

Beta Quality and Monetization Readiness

- BETA_10_OUT_OF_10_PLAN.md

Enhancements

- ENHANCEMENTS.md

Roadmap

- ROADMAP.md

TODO

- TODO.md

---

# Rule

Agents should discover documentation through this map rather than memorizing filenames.

When new project documentation is added, update this knowledge map so future agents can locate it.
