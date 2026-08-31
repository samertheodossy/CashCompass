/**
 * Multi-Broker Portfolio Foundation v1 — source adapter registry.
 *
 * Adapters parse broker files into canonical normalized previews only.
 * Persistence remains centralized in investment_activity.js (Robinhood) or future
 * generic import paths.
 */

function getInvestmentAdapter_(source) {
  var key = investmentPortfolioNormalizeSource_(source);
  if (!key) throw new Error('Unsupported investment import source: ' + source);
  var adapter = INVESTMENT_ADAPTER_REGISTRY_[key];
  if (!adapter) throw new Error('Investment adapter not implemented for source: ' + key);
  return adapter;
}

function listInvestmentAdapterSources_() {
  return Object.keys(INVESTMENT_ADAPTER_REGISTRY_).sort();
}

var INVESTMENT_ADAPTER_REGISTRY_ = {
  ROBINHOOD_CSV: {
    source: 'ROBINHOOD_CSV',
    parserVersion: 'robinhood-legacy-v1',
    capabilities: {
      activities: true,
      holdings: false,
      taxLots: false,
      accountSnapshot: false,
      dividendHistory: false,
      realizedGainLoss: false
    },
    detect: investmentAdapterDetectRobinhoodCsv_,
    preview: investmentAdapterPreviewRobinhoodCsv_,
    normalize: investmentAdapterNormalizeRobinhoodCsv_
  },
  ETRADE_PACKAGE: {
    source: 'ETRADE_PACKAGE',
    parserVersion: ETRADE_TXN_CSV_PARSER_VERSION_,
    capabilities: {
      activities: true,
      holdings: false,
      taxLots: false,
      accountSnapshot: false,
      dividendHistory: false,
      realizedGainLoss: false
    },
    detect: investmentEtradeDetectTxnCsv_,
    preview: investmentAdapterPreviewEtradePackage_,
    normalize: investmentAdapterNormalizeEtradePackage_
  },
  ETRADE_CSV: {
    source: 'ETRADE_CSV',
    parserVersion: ETRADE_TXN_CSV_PARSER_VERSION_,
    capabilities: {
      activities: true,
      holdings: false,
      taxLots: false,
      accountSnapshot: false,
      dividendHistory: false,
      realizedGainLoss: false
    },
    detect: investmentEtradeDetectTxnCsv_,
    preview: investmentAdapterPreviewEtradeCsv_,
    normalize: investmentAdapterNormalizeEtradeCsv_
  }
};

function investmentAdapterDetectRobinhoodCsv_(input) {
  input = input || {};
  var files = input.files || [];
  if (!files.length && input.rawCsv) {
    files = [{ role: 'ACTIVITY', content: input.rawCsv }];
  }
  if (!files.length) {
    return { ok: false, reason: 'No files supplied for Robinhood CSV import.' };
  }
  var activityFile = files.filter(function(file) {
    return !file.role || file.role === 'ACTIVITY';
  })[0];
  if (!activityFile || !String(activityFile.content || input.rawCsv || '').trim()) {
    return { ok: false, reason: 'Robinhood activity CSV is required.' };
  }
  var csv = String(activityFile.content || input.rawCsv || '');
  var header = csv.split(/\r?\n/)[0] || '';
  var looksRobinhood = /Activity Date/i.test(header) &&
    /Trans Code/i.test(header) &&
    /Instrument/i.test(header);
  return looksRobinhood
    ? { ok: true, source: 'ROBINHOOD_CSV', inferredRoles: ['ACTIVITY'] }
    : { ok: false, reason: 'File does not match Robinhood activity CSV headers.' };
}

function investmentAdapterPreviewRobinhoodCsv_(input, optionalSs) {
  var detection = investmentAdapterDetectRobinhoodCsv_(input);
  if (!detection.ok) {
    return {
      ok: false,
      reviewRequired: true,
      error: detection.reason,
      source: 'ROBINHOOD_CSV'
    };
  }
  var payload = input || {};
  var files = payload.files || [];
  var rawCsv = payload.rawCsv || (files[0] && files[0].content) || '';
  var accountMeta = payload.accountMeta || {};
  var investmentId = String(payload.investmentId || '').trim();
  if (!investmentId) {
    return {
      ok: false,
      reviewRequired: true,
      error: 'Investment Id is required for Robinhood CSV preview.',
      source: 'ROBINHOOD_CSV'
    };
  }
  var legacyPreview = previewInvestmentActivityImportFromDashboard({
    investmentId: investmentId,
    rawCsv: rawCsv,
    cutoffDate: payload.cutoffDate || '',
    tickerDecisions: payload.tickerDecisions || {}
  }, optionalSs);
  var normalized = investmentPortfolioNormalizeRobinhoodPreview_(legacyPreview, accountMeta);
  return {
    ok: true,
    reviewRequired: false,
    source: 'ROBINHOOD_CSV',
    parserVersion: INVESTMENT_ADAPTER_REGISTRY_.ROBINHOOD_CSV.parserVersion,
    schemaVersion: INVESTMENT_PORTFOLIO_SCHEMA_VERSION_,
    capabilities: INVESTMENT_ADAPTER_REGISTRY_.ROBINHOOD_CSV.capabilities,
    normalized: normalized,
    legacyPreview: legacyPreview
  };
}

function investmentAdapterNormalizeRobinhoodCsv_(input, optionalSs) {
  var preview = investmentAdapterPreviewRobinhoodCsv_(input, optionalSs);
  if (!preview.ok) return preview;
  return preview.normalized;
}

function investmentAdapterPreviewEtradePackage_(input, optionalSs) {
  var payload = input || {};
  payload.source = investmentPortfolioNormalizeSource_(payload.source) || 'ETRADE_PACKAGE';
  var detection = investmentEtradeDetectTxnCsv_(payload);
  if (!detection.ok) {
    return {
      ok: false,
      reviewRequired: true,
      error: detection.reason,
      source: payload.source
    };
  }
  return investmentEtradePreviewTxnCsv_(payload);
}

function investmentAdapterNormalizeEtradePackage_(input, optionalSs) {
  var preview = investmentAdapterPreviewEtradePackage_(input, optionalSs);
  if (!preview.ok) return preview;
  return preview.normalized;
}

function investmentAdapterPreviewEtradeCsv_(input, optionalSs) {
  var payload = input || {};
  payload.source = 'ETRADE_CSV';
  return investmentAdapterPreviewEtradePackage_(payload, optionalSs);
}

function investmentAdapterNormalizeEtradeCsv_(input, optionalSs) {
  var preview = investmentAdapterPreviewEtradeCsv_(input, optionalSs);
  if (!preview.ok) return preview;
  return preview.normalized;
}

function investmentAdapterBuildPackagePreview_(input, optionalSs) {
  input = input || {};
  var source = investmentPortfolioNormalizeSource_(input.source);
  if (!source) {
    return {
      ok: false,
      reviewRequired: true,
      error: 'Import package source is required.'
    };
  }
  var adapter;
  try {
    adapter = getInvestmentAdapter_(source);
  } catch (err) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: String(err && err.message ? err.message : err)
    };
  }
  var detection = adapter.detect(input);
  if (!detection.ok) {
    return {
      ok: false,
      reviewRequired: true,
      source: source,
      error: detection.reason
    };
  }
  return adapter.preview(input, optionalSs);
}
