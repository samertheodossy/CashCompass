import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

const webappSource = read('webapp.js');
const dashboardBody = read('Dashboard_Body.html');
const dashboardInvestments = read('Dashboard_Script_AssetsBankInvestments.html');
const boundedHtml = read('BoundedHoldingsPreviewUI.html');
const boundedSource = read('bounded_holdings_preview.js');
const investmentsSource = read('investments.js');
const labSource = read('central_holdings_preview_lab.js');
const plannerWeb = read('PlannerDashboardWeb.html');
const validationSource = read('validation_testing_server.js');

// --- Manage Investments uses server /exec URL + top-frame navigation ---
assert.match(dashboardBody, /onclick="openBoundedHoldingsPreview_\(\)"/);
assert.match(dashboardBody, /id="inv_holdings_preview_btn"/);
assert.doesNotMatch(dashboardBody, /href="\?view=portfolio-holdings-preview"/);
assert.doesNotMatch(dashboardBody, /holdings-preview-lab/);
assert.match(dashboardInvestments, /boundedHoldingsPreviewNavigateTop_/);
assert.match(dashboardInvestments, /getBoundedHoldingsPreviewLaunchUrlFromDashboard/);
assert.match(dashboardInvestments, /dataset\.launchUrl/);
assert.match(dashboardInvestments, /window\.top\.location\.href = url/);
assert.match(dashboardInvestments, /userCodeAppPanel/);
assert.match(
  dashboardInvestments,
  /\/\^https:\\\/\\\/script\\\.google\\\.com\\\/macros\\\/s\\\/.+\\\/exec\\\?view=portfolio-holdings-preview/
);
assert.doesNotMatch(dashboardInvestments, /split\('\?'\)\[0\]/);

// --- Server resolves deployed /exec URL via ScriptApp.getService().getUrl() ---
assert.match(boundedSource, /ScriptApp\.getService\(\)\.getUrl\(\)/);
assert.match(boundedSource, /boundedHoldingsPreviewLaunchUrl_/);
assert.match(boundedSource, /\?view=portfolio-holdings-preview/);
assert.match(boundedSource, /userCodeAppPanel/);
assert.match(boundedSource, /getBoundedHoldingsPreviewLaunchUrlFromDashboard/);
assert.match(investmentsSource, /boundedHoldingsPreviewUrl:/);
assert.match(validationSource, /ScriptApp\.getService\(\)\.getUrl\(\)/);

// --- webapp route renders bounded preview UI; Central lab route unchanged ---
assert.match(
  webappSource,
  /if \(view === 'portfolio-holdings-preview' && !isCentralModeEnabled_\(\)\) \{[\s\S]*?BoundedHoldingsPreviewUI/
);
assert.match(webappSource, /view === 'holdings-preview-lab' && isAdminUser_\(\)/);
assert.match(webappSource, /HoldingsPreviewLabUI/);
assert.doesNotMatch(
  webappSource,
  /view === 'portfolio-holdings-preview'[\s\S]*?isAdminUser_\(\)/
);

// --- Default /exec (no view) still serves the main dashboard ---
assert.match(webappSource, /var dashboardTemplate = HtmlService\.createTemplateFromFile\('PlannerDashboardWeb'\)/);
assert.match(webappSource, /return dashboardTemplate\.evaluate\(\)/);
assert.match(webappSource, /view === 'recovery-test'/);
assert.match(webappSource, /view === 'first-run-e2e'/);
assert.match(plannerWeb, /<base target="_top">/);

// --- Bounded preview page back link uses server dashboardUrl, not sandbox relative href ---
assert.match(boundedHtml, /boundedPreviewDashboardLink/);
assert.match(boundedHtml, /res\.dashboardUrl/);
assert.match(boundedHtml, /window\.top\.location\.href = dashboardUrl/);
assert.doesNotMatch(boundedHtml, /href="\?"/);
assert.match(boundedHtml, /boundedHoldingsPreviewRunFromDashboard/);
assert.match(boundedHtml, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.doesNotMatch(boundedHtml, /id="stableAccountId"/);
assert.doesNotMatch(boundedHtml, /Identity setup required/);
assert.doesNotMatch(boundedHtml, /Set up identity/);
assert.match(boundedHtml, /id="selectedAccount"/);
assert.match(boundedHtml, /id="registrationType"/);
assert.match(boundedHtml, /id="explicitAccountMatch"/);
assert.match(boundedHtml, /CashCompass saves internal identity automatically/);
assert.match(boundedHtml, /groupedSession/);
assert.match(boundedHtml, /accept="\.pdf,\.txt,application\/pdf,text\/plain"/);
assert.match(boundedHtml, /boundedHoldingsPreviewLoadDocumentTextFromFile_/);
assert.match(boundedSource, /boundedHoldingsPreviewIncludePdfClient_/);
assert.match(boundedSource, /includeHtml_/);
assert.match(boundedHtml, /bounded_holdings_preview_pdf_client_include\.html/);
assert.doesNotMatch(boundedHtml, /bounded_holdings_preview_pdf_client\.html/);
assert.match(boundedHtml, /Previewed accounts only/);
assert.match(boundedHtml, /groupedSession/);
assert.doesNotMatch(boundedHtml, /localStorage|sessionStorage|indexedDB/i);

// --- Bounded server gate: Central rejected; no persistence/writes in route layer ---
assert.match(boundedSource, /if \(isCentralModeEnabled_\(\)\)/);
assert.match(boundedSource, /if \(!isAllowlistedUser_\(\)\)/);
assert.doesNotMatch(boundedSource, /\bsetValues\b|\bappendRow\b/);
assert.match(labSource, /Central mode only/);

// --- Existing investment navigation preserved ---
assert.match(dashboardBody, /inv_portfolio_activity_btn/);
assert.match(dashboardBody, /openInvestmentPortfolioDrawer_/);
assert.match(dashboardInvestments, /boundedHoldingsPreviewAvailable/);
assert.match(dashboardInvestments, /populateInvestmentActivityImportAccounts_/);
assert.match(dashboardInvestments, /openInvestmentPortfolioDrawer_/);

console.log('Bounded holdings preview route/navigation regressions passed.');
