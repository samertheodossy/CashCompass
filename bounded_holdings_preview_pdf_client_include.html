var BOUNDED_HOLDINGS_PREVIEW_PDF_NO_TEXT_ERROR_ =
  'This PDF does not contain selectable text. Use a text-based PDF or paste a text extract.';

/**
 * Browser mirror of investment_etrade_client_statement_pdf.js quality/classification helpers.
 * HtmlService includes only .html files — keep this block synced with the server module.
 */
function investmentEtradeClientStatementCompactText_(text) {
  return String(text || '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function investmentEtradeClientStatementLooksEncodingCorrupt_(text) {
  text = String(text || '');
  if (!text.trim()) return false;
  var sample = text.slice(0, 12000);
  if (!sample) return false;
  var badChars = (sample.match(/[\uFFFD\uE000-\uF8FF]/g) || []).length;
  if (badChars / sample.length > 0.02) return true;
  var letters = (sample.match(/[A-Za-z]/g) || []).length;
  if (sample.length > 2000 && letters / sample.length < 0.08) return true;
  if (sample.length > 2000 &&
      !/Security\s+Description/i.test(sample) &&
      !/Ending\s+Total/i.test(sample) &&
      !/Client\s*Statement/i.test(sample) &&
      letters / sample.length < 0.15) {
    return true;
  }
  var weirdChars = (sample.match(/[ÃÙ¶˚™ƒ¤£›ÕÇÑÄäËëÏïÖöÜüÀÂÈÊÎÔÛµ§]/g) || []).length;
  if (sample.length > 1000 && weirdChars / sample.length > 0.04 &&
      !/Security\s+Description/i.test(sample)) {
    return true;
  }
  var latinExtended = (sample.match(/[\u00C0-\u00FF]/g) || []).length;
  if (sample.length > 5000 && latinExtended / sample.length > 0.10 &&
      !/Security\s+Description/i.test(sample) &&
      !/Symbol\s*\/\s*CUSIP/i.test(sample)) {
    return true;
  }
  var noiseChars = (sample.match(/[\/\\~^|#]/g) || []).length;
  if (sample.length > 5000 && noiseChars / sample.length > 0.05 &&
      !/Security\s+Description/i.test(sample) &&
      !/Symbol\s*\/\s*CUSIP/i.test(sample)) {
    return true;
  }
  return false;
}

function investmentEtradeClientStatementAssessTextQuality_(text) {
  text = String(text || '');
  if (!text.trim()) {
    return {
      quality: 'NO_TEXT',
      usable: false,
      reason: 'No E*TRADE client statement text supplied.'
    };
  }
  if (investmentEtradeClientStatementLooksEncodingCorrupt_(text)) {
    return {
      quality: 'ENCODING_FAILURE',
      usable: false,
      reason: 'Extracted text appears encoding-corrupt; OCR or pasted text is required.'
    };
  }
  var compact = investmentEtradeClientStatementCompactText_(text);
  if (/Symbol\s*\/\s*CUSIP/i.test(compact) && /Refresh:/i.test(compact)) {
    return {
      quality: 'WRONG_DOCUMENT_TYPE',
      usable: false,
      reason: 'File matches E*TRADE Expanded Positions export, not a monthly client statement.'
    };
  }
  var hasHeader = /Security\s+Description\s+Quantity\s+Share\s+Price/i.test(compact);
  var hasEnding = /Ending\s+Total\s+Value/i.test(compact);
  var hasStatementMarker = /E\*?TRADE|Client\s*Statement|ClientStatements|Morgan\s+Stanley/i.test(compact);
  if (!hasHeader) {
    return {
      quality: 'STRUCTURE_MISMATCH',
      usable: false,
      reason: 'Missing Security Description holdings table header.'
    };
  }
  if (!hasEnding) {
    return {
      quality: 'STRUCTURE_MISMATCH',
      usable: false,
      reason: 'Missing Ending Total Value reconciliation marker.'
    };
  }
  if (!hasStatementMarker) {
    return {
      quality: 'STRUCTURE_MISMATCH',
      usable: false,
      reason: 'Missing E*TRADE client statement confirmatory markers.'
    };
  }
  return { quality: 'USABLE', usable: true, reason: '' };
}

function investmentEtradeClientStatementLooksLikePositionsPdf_(text) {
  var compact = investmentEtradeClientStatementCompactText_(text);
  return /Symbol\s*\/\s*CUSIP/i.test(compact) && /Refresh:/i.test(compact);
}

function investmentEtradeClientStatementClassifyDocumentType_(text) {
  text = String(text || '');
  if (!text.trim()) {
    return {
      documentType: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'No PDF text extracted.'
    };
  }
  if (investmentEtradeClientStatementLooksLikePositionsPdf_(text)) {
    return {
      documentType: 'ETRADE_POSITIONS_PDF',
      confidence: 'HIGH',
      reason: 'Expanded Positions export markers detected.'
    };
  }
  var compact = investmentEtradeClientStatementCompactText_(text);
  if (/M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact) ||
      (/Statement period:/i.test(compact) &&
        (/Account breakdown/i.test(compact) ||
          /Symbol Quantity Price Market value/i.test(compact)))) {
    return {
      documentType: 'UNKNOWN',
      confidence: 'LOW',
      reason: 'Document appears to be an M1 brokerage statement.'
    };
  }
  var hasClientStatementMarkers =
    /E\*?TRADE|Client\s*Statement|ClientStatements|Morgan\s+Stanley|MSSB/i.test(compact) ||
    /Ending\s+Total\s+Value/i.test(compact) ||
    /Security\s+Description\s+Quantity\s+Share\s+Price/i.test(compact);
  if (hasClientStatementMarkers) {
    return {
      documentType: 'ETRADE_CLIENT_STATEMENT_PDF',
      confidence: 'HIGH',
      reason: 'E*TRADE monthly client statement markers detected.'
    };
  }
  if (investmentEtradeClientStatementLooksEncodingCorrupt_(text) && text.length > 1000) {
    return {
      documentType: 'ETRADE_CLIENT_STATEMENT_PDF',
      confidence: 'MEDIUM',
      reason: 'Encoding-corrupt PDF text consistent with E*TRADE monthly statement subset fonts.'
    };
  }
  if (text.length > 5000 &&
      !/M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact)) {
    var quality = investmentEtradeClientStatementAssessTextQuality_(text);
    if (!quality.usable && quality.quality !== 'WRONG_DOCUMENT_TYPE') {
      return {
        documentType: 'ETRADE_CLIENT_STATEMENT_PDF',
        confidence: 'MEDIUM',
        reason: 'Non-positions PDF extract failed E*TRADE client-statement quality gate.'
      };
    }
  }
  return {
    documentType: 'UNKNOWN',
    confidence: 'LOW',
    reason: 'Could not classify E*TRADE PDF document type.'
  };
}

function boundedHoldingsPreviewLooksLikeM1StatementPdf_(text) {
  var readable = boundedHoldingsPreviewReadableExtractText_(text);
  var sample = String((readable && readable.text) || text || '');
  var compact = investmentEtradeClientStatementCompactText_(sample);
  return /M1:|Finance Super App|Total account value \/ 1-month change/i.test(compact) ||
    (/Statement period:/i.test(compact) &&
      (/Account breakdown/i.test(compact) ||
        /Symbol Quantity Price Market value/i.test(compact)));
}

function boundedHoldingsPreviewShouldUseM1PdfLoadPath_(options, text) {
  if (options && options.groupedMode === true) return true;
  var provider = String((options || {}).accountProvider || '').trim().toUpperCase();
  if (provider === 'ETRADE') return false;
  if (provider === 'M1') return true;
  var source = String((options || {}).source || '').trim().toUpperCase();
  if (source !== 'M1_STATEMENT_PDF') return false;
  return boundedHoldingsPreviewLooksLikeM1StatementPdf_(text);
}

function boundedHoldingsPreviewBuildStandardPdfLoadResult_(finalized, options, documentFingerprint) {
  var showInEditor = true;
  var editorText = finalized.text;
  if (typeof investmentEtradeClientStatementLooksEncodingCorrupt_ === 'function' &&
      investmentEtradeClientStatementLooksEncodingCorrupt_(finalized.text)) {
    showInEditor = false;
    editorText = '';
  }
  return {
    kind: 'pdf',
    text: editorText,
    previewText: finalized.text,
    displayTextInEditor: showInEditor,
    rawExtractedTextLength: finalized.extractedTextLength,
    extractedTextLength: showInEditor ? finalized.extractedTextLength : 0,
    extractionStatus: finalized.extractionStatus,
    extractionMeta: null,
    documentFingerprint: documentFingerprint,
    detectedSource: '',
    effectiveSource: String((options || {}).source || '').trim(),
    classification: null,
    ocrRequired: false,
    statusMessage: ''
  };
}

function boundedHoldingsPreviewPdfFileKind_(fileName, mimeType) {
  var name = String(fileName || '').toLowerCase();
  var mime = String(mimeType || '').toLowerCase();
  if (mime.indexOf('pdf') >= 0 || /\.pdf$/i.test(name)) return 'pdf';
  if (mime.indexOf('text/plain') >= 0 || mime === 'text/plain' || /\.txt$/i.test(name)) return 'txt';
  return '';
}

function boundedHoldingsPreviewNormalizeExtractedPdfText_(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[\uE000-\uF8FF]/g, '/')
    .replace(/[\u00A0\u2000-\u200B]/g, ' ')
    .trim();
}

function boundedHoldingsPreviewHasCharacterSpacedLayout_(text) {
  var sample = String(text || '').slice(0, 5000).replace(/\s+/g, ' ').trim();
  if (!sample) return false;
  var tokens = sample.split(' ').filter(function(token) {
    return token.length > 0;
  });
  if (tokens.length < 20) return false;
  var singleCharCount = tokens.filter(function(token) {
    return token.length === 1;
  }).length;
  return singleCharCount / tokens.length >= 0.55;
}

function boundedHoldingsPreviewRepairCharacterSpacedGroup_(group) {
  var tokens = String(group || '').replace(/\s+/g, ' ').trim().split(' ').filter(function(token) {
    return token.length > 0;
  });
  if (!tokens.length) return '';
  if (tokens.length === 1) return tokens[0];
  var singleCharCount = tokens.filter(function(token) {
    return token.length === 1;
  }).length;
  if (singleCharCount / tokens.length >= 0.55) {
    return tokens.join('');
  }
  return tokens.join(' ');
}

function boundedHoldingsPreviewSplitGluedReadableTokens_(text) {
  return String(text || '')
    .replace(/([A-Za-z%-])(\$[\d,.()\-])/g, '$1 $2')
    .replace(/([A-Za-z])(Statement period:)/gi, '$1\n$2')
    .replace(/(\d{4})(Account number:)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Account breakdown)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Activity summary)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Statement for account\/)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Financial instrument information)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Total portfolio)/gi, '$1\n$2')
    .replace(/([A-Za-z0-9%)])(Symbol Quantity Price Market value)/gi, '$1\n$2');
}

function boundedHoldingsPreviewRepairSpacedMoneyInLine_(line) {
  line = String(line || '');
  line = line.replace(/\$[\d\s,().%-]+/g, function(segment) {
    var tokens = segment.replace(/\s+/g, ' ').trim().split(' ').filter(function(token) {
      return token.length > 0;
    });
    if (tokens.length < 2) return segment;
    var singleCharCount = tokens.filter(function(token) {
      return token.length === 1;
    }).length;
    if (singleCharCount / tokens.length >= 0.45) {
      return tokens.join('');
    }
    return segment;
  });
  line = line.replace(/\(\s*\$[\d\s,().%-]+\s*\)/g, function(segment) {
    var inner = segment.replace(/^\(\s*/, '').replace(/\s*\)$/, '');
    return '(' + boundedHoldingsPreviewRepairSpacedMoneyInLine_(inner) + ')';
  });
  line = line.replace(/\[\s*[\d\s.]+\s*%\s*\]/g, function(segment) {
    var tokens = segment.replace(/[\[\]%]/g, ' ').replace(/\s+/g, ' ').trim().split(' ')
      .filter(function(token) { return token.length > 0; });
    if (tokens.length < 2) return segment;
    var singleCharCount = tokens.filter(function(token) {
      return token.length === 1;
    }).length;
    if (singleCharCount / tokens.length >= 0.45) {
      return '[' + tokens.join('') + '%]';
    }
    return segment;
  });
  return line;
}

function boundedHoldingsPreviewRepairCharacterSpacedLine_(line) {
  line = boundedHoldingsPreviewRepairSpacedMoneyInLine_(String(line || ''));
  var repaired = line.split(/\s{2,}/).map(boundedHoldingsPreviewRepairCharacterSpacedGroup_).join(' ');
  return boundedHoldingsPreviewSplitGluedReadableTokens_(repaired);
}

function boundedHoldingsPreviewReflowReadableStatementText_(text) {
  text = String(text || '');
  if (!text) return text;
  var markers = [
    'Financial instrument information',
    'Symbol Quantity Price Market value Cost basis Unrealized P/L',
    'Symbol Quantity Price Market value',
    'Statement for account/',
    'Total account value / 1-month change',
    'Account breakdown',
    'Activity summary',
    'Statement period:',
    'Account number:',
    'Account type:',
    'Account title:',
    'Address:',
    'Account value',
    'Terms and conditions',
    'M1: The Finance Super App'
  ];
  markers.sort(function(a, b) {
    return b.length - a.length;
  });
  markers.forEach(function(marker) {
    var escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    var prefix = marker.toLowerCase() === 'account value' ? '(?<!Total )' : '';
    var re = new RegExp('(^|[^\\n])(' + prefix + escaped + ')', 'gi');
    text = text.replace(re, '$1\n$2');
  });
  text = text.replace(/(^|[^\n])(Account breakdown)(Cash(?:\s|\$|\.))/gi, '$1\n$2\n$3');
  text = text.replace(/Account breakdown\s+(Cash|Equities|Total portfolio)/gi, 'Account breakdown\n$1');
  text = text.replace(/Account breakdown(?=Cash|Equities|Total portfolio)/gi, 'Account breakdown\n');
  text = text.replace(/(\$[\d,.()\-]+)(Equities(?:\s|\$))/gi, '$1\n$2');
  text = text.replace(/(\$[\d,.()\-]+)(Total portfolio(?:\s|\$))/gi, '$1\n$2');
  text = text.replace(/(^|[^\n])(Cash\s+\$[\d,.()\-]+(?:\s+\$[\d,.()\-]+){1,2})(Equities\s)/gi, '$1\n$2\n$3');
  text = text.replace(/(^|[^\n])(Equities\s+\$[\d,.()\-]+(?:\s+\$[\d,.()\-]+){1,2})(Total portfolio\s)/gi,
    '$1\n$2\n$3');
  text = text.replace(/(^|[^\n])((?:Total portfolio))(\s+\$)/gi, '$1\n$2$3');
  text = text.replace(/(^|[^\n])((?:Unrealized P\/L))(\s*)([A-Z][A-Z0-9.\-]{0,5}\s)/gi, '$1\n$2\n$4');
  text = text.replace(/(^|[^\n])((?:Total portfolio))(\s*(?:Symbol|[A-Z][A-Z0-9.\-]{0,5}\s+[\d($]))/gi,
    '$1\n$2\n$3');
  text = text.replace(/(\$[\d,.()\-]+)(\s*)([A-Z][A-Z0-9.\-]{0,5}\s+[\d(.])/g, '$1\n$3');
  text = text.replace(/(^|[^\n])(Account:\s+(?!number\b))/gi, '$1\n$2');
  text = text.replace(/(^|[^\n])(Type:\s)/gi, '$1\n$2');
  text = text.replace(/\n{2,}/g, '\n');
  return text;
}

/**
 * Collapse PDF.js per-character spacing and restore statement line breaks for readability.
 * Some broker PDFs (including M1) extract as "S t a t e m e n t   p e r i o d" — not a user paste choice.
 */
function boundedHoldingsPreviewReadableExtractText_(text) {
  text = boundedHoldingsPreviewNormalizeExtractedPdfText_(text);
  if (!text || !boundedHoldingsPreviewHasCharacterSpacedLayout_(text)) {
    return { text: text, normalized: false };
  }
  text = text.split('\n').map(function(line) {
    if (!String(line || '').trim()) return line;
    return boundedHoldingsPreviewRepairCharacterSpacedLine_(line);
  }).join('\n');
  text = boundedHoldingsPreviewReflowReadableStatementText_(text);
  return { text: text, normalized: true };
}

function boundedHoldingsPreviewExtractPdfTextFromArrayBuffer_(arrayBuffer, pdfjsLib) {
  if (!pdfjsLib || typeof pdfjsLib.getDocument !== 'function') {
    return Promise.reject(new Error('PDF text extraction library is unavailable.'));
  }
  var loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise.then(function(pdf) {
    var parts = [];
    var chain = Promise.resolve();
    for (var pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
      (function(pageIndex) {
        chain = chain.then(function() {
          return pdf.getPage(pageIndex).then(function(page) {
            return page.getTextContent().then(function(textContent) {
              var pageText = (textContent.items || []).map(function(item) {
                return String(item.str || '');
              }).join(' ');
              if (String(pageText || '').trim()) {
                parts.push(String(pageText).trim());
              }
            });
          });
        });
      })(pageNum);
    }
    return chain.then(function() {
      var combined = boundedHoldingsPreviewNormalizeExtractedPdfText_(parts.join('\n'));
      if (!combined) {
        throw new Error(BOUNDED_HOLDINGS_PREVIEW_PDF_NO_TEXT_ERROR_);
      }
      return combined;
    });
  });
}

function boundedHoldingsPreviewReadTxtFile_(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(ev) {
      var text = boundedHoldingsPreviewNormalizeExtractedPdfText_(String(ev.target.result || ''));
      if (!text) {
        reject(new Error('Text extract is empty.'));
        return;
      }
      resolve(text);
    };
    reader.onerror = function() {
      reject(new Error('Could not read text file.'));
    };
    reader.readAsText(file);
  });
}

function boundedHoldingsPreviewFinalizeLoadedDocumentText_(text, kind) {
  var readable = boundedHoldingsPreviewReadableExtractText_(text);
  var normalizedText = String(readable.text || text || '').trim();
  var extractionStatus = kind === 'txt'
    ? (readable.normalized ? 'read from text file · spacing normalized for readability' : 'read from text file')
    : (readable.normalized
      ? 'extracted locally from PDF · spacing normalized for readability'
      : 'extracted locally from PDF');
  return {
    text: normalizedText,
    extractionStatus: extractionStatus,
    extractedTextLength: normalizedText.length
  };
}

var BOUNDED_HOLDINGS_PREVIEW_CLIENT_STATEMENT_UNSUPPORTED_MESSAGE_ =
  'E*TRADE monthly client statement PDF is not currently supported for direct import.';

function boundedHoldingsPreviewBytesToHexDigest_(bytes) {
  bytes = bytes || [];
  return bytes.map(function(byte) {
    var normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function boundedHoldingsPreviewDigestArrayBuffer_(arrayBuffer) {
  if (!arrayBuffer) return Promise.resolve('');
  var bytes;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(arrayBuffer)) {
    bytes = new Uint8Array(arrayBuffer);
  } else if (arrayBuffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(arrayBuffer);
  } else if (arrayBuffer.buffer && typeof arrayBuffer.byteLength === 'number') {
    bytes = new Uint8Array(arrayBuffer.buffer, arrayBuffer.byteOffset || 0, arrayBuffer.byteLength);
  } else {
    return Promise.resolve('');
  }
  if (!bytes.length) return Promise.resolve('');
  if (typeof Utilities !== 'undefined' && Utilities.computeDigest) {
    var binary = '';
    for (var i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return Promise.resolve(boundedHoldingsPreviewBytesToHexDigest_(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, binary)));
  }
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    return crypto.subtle.digest('SHA-256', bytes).then(function(hashBuffer) {
      return boundedHoldingsPreviewBytesToHexDigest_(Array.from(new Uint8Array(hashBuffer)));
    });
  }
  return Promise.reject(new Error('SHA-256 digest is unavailable in this browser.'));
}

function boundedHoldingsPreviewBuildEtradeClientStatementTextFingerprint_(text) {
  if (typeof investmentEtradeClientStatementBuildTextFingerprint_ === 'function') {
    return investmentEtradeClientStatementBuildTextFingerprint_(text);
  }
  var normalized = boundedHoldingsPreviewNormalizeExtractedPdfText_(text);
  if (typeof investmentPortfolioDigest_ === 'function') {
    return investmentPortfolioDigest_(['ETRADE_CLIENT_STATEMENT_TEXT', normalized]);
  }
  return '';
}

function boundedHoldingsPreviewBuildEtradeClientStatementExtractionMeta_(text, method) {
  if (typeof investmentEtradeClientStatementAssessTextQuality_ !== 'function') return null;
  var quality = investmentEtradeClientStatementAssessTextQuality_(text);
  return {
    method: method || 'PDFJS',
    quality: quality.quality,
    usable: quality.usable,
    reason: quality.reason || ''
  };
}

function boundedHoldingsPreviewClassifyEtradePdfText_(text) {
  if (typeof investmentEtradeClientStatementClassifyDocumentType_ === 'function') {
    return investmentEtradeClientStatementClassifyDocumentType_(text);
  }
  return {
    documentType: 'UNKNOWN',
    confidence: 'LOW',
    reason: 'E*TRADE PDF classification helpers are unavailable.'
  };
}

function boundedHoldingsPreviewResolveEtradePdfEffectiveSource_(classification, requestedSource) {
  classification = classification || {};
  requestedSource = String(requestedSource || '').trim().toUpperCase();
  if (classification.documentType === 'ETRADE_CLIENT_STATEMENT_PDF') {
    return 'ETRADE_CLIENT_STATEMENT_PDF';
  }
  if (classification.documentType === 'ETRADE_POSITIONS_PDF') {
    return 'ETRADE_POSITIONS_PDF';
  }
  return requestedSource;
}

function boundedHoldingsPreviewBuildPdfEditorPresentation_(finalized, extractionMeta, classification) {
  classification = classification || {};
  var isPositions = classification.documentType === 'ETRADE_POSITIONS_PDF' ||
    (typeof investmentEtradeClientStatementLooksLikePositionsPdf_ === 'function' &&
      investmentEtradeClientStatementLooksLikePositionsPdf_(finalized.text));
  if (isPositions) {
    return {
      text: finalized.text,
      previewText: finalized.text,
      displayTextInEditor: true,
      rawExtractedTextLength: finalized.extractedTextLength,
      extractedTextLength: finalized.extractedTextLength
    };
  }
  var trusted = !!(extractionMeta && extractionMeta.usable === true);
  var encodingCorrupt = typeof investmentEtradeClientStatementLooksEncodingCorrupt_ === 'function' &&
    investmentEtradeClientStatementLooksEncodingCorrupt_(finalized.text);
  var showInEditor = trusted && !encodingCorrupt;
  return {
    text: showInEditor ? finalized.text : '',
    previewText: finalized.text,
    displayTextInEditor: showInEditor,
    rawExtractedTextLength: finalized.extractedTextLength,
    extractedTextLength: showInEditor ? finalized.extractedTextLength : 0
  };
}

function boundedHoldingsPreviewBuildClientStatementOcrRequiredResult_(
  finalized, classification, extractionMeta, documentFingerprint, effectiveSource
) {
  if (extractionMeta && documentFingerprint) {
    extractionMeta.documentFingerprint = documentFingerprint;
  }
  var presentation = boundedHoldingsPreviewBuildPdfEditorPresentation_(
    finalized, extractionMeta, classification);
  return {
    kind: 'pdf',
    text: presentation.text,
    previewText: presentation.previewText,
    displayTextInEditor: false,
    rawExtractedTextLength: presentation.rawExtractedTextLength,
    extractedTextLength: 0,
    extractionStatus: 'PDF text unreadable · direct import not supported',
    extractionMeta: extractionMeta,
    documentFingerprint: documentFingerprint,
    detectedSource: 'ETRADE_CLIENT_STATEMENT_PDF',
    effectiveSource: effectiveSource || 'ETRADE_CLIENT_STATEMENT_PDF',
    classification: classification,
    ocrRequired: true,
    statusMessage: BOUNDED_HOLDINGS_PREVIEW_CLIENT_STATEMENT_UNSUPPORTED_MESSAGE_
  };
}

function boundedHoldingsPreviewNeedsEtradeClientStatementOcr_(text, source, documentType) {
  documentType = String(documentType || '').trim().toUpperCase();
  if (!documentType &&
      typeof boundedHoldingsPreviewClassifyEtradePdfText_ === 'function') {
    documentType = boundedHoldingsPreviewClassifyEtradePdfText_(text).documentType;
  }
  var normalizedSource = String(source || '').trim().toUpperCase();
  var isClientStatement = documentType === 'ETRADE_CLIENT_STATEMENT_PDF' ||
    normalizedSource === 'ETRADE_CLIENT_STATEMENT_PDF';
  if (!isClientStatement) return false;
  if (typeof investmentEtradeClientStatementAssessTextQuality_ !== 'function') return false;
  var quality = investmentEtradeClientStatementAssessTextQuality_(text);
  return !quality.usable &&
    (quality.quality === 'ENCODING_FAILURE' || quality.quality === 'NO_TEXT');
}

function boundedHoldingsPreviewFinalizePdfLoadResult_(finalized, options, extractionMeta, documentFingerprint, extra) {
  options = options || {};
  extra = extra || {};
  extractionMeta = extractionMeta || null;
  documentFingerprint = String(documentFingerprint || '').trim();
  var effectiveSource = boundedHoldingsPreviewResolveEtradePdfEffectiveSource_(
    extra.classification || null, options.source);
  if (!extractionMeta &&
      effectiveSource === 'ETRADE_CLIENT_STATEMENT_PDF') {
    extractionMeta = boundedHoldingsPreviewBuildEtradeClientStatementExtractionMeta_(
      finalized.text, 'PDFJS');
  }
  if (extractionMeta && documentFingerprint) {
    extractionMeta.documentFingerprint = documentFingerprint;
  }
  var presentation = boundedHoldingsPreviewBuildPdfEditorPresentation_(
    finalized, extractionMeta, extra.classification || null);
  return {
    kind: 'pdf',
    text: presentation.text,
    previewText: presentation.previewText,
    displayTextInEditor: presentation.displayTextInEditor,
    rawExtractedTextLength: presentation.rawExtractedTextLength,
    extractedTextLength: presentation.extractedTextLength,
    extractionStatus: finalized.extractionStatus,
    extractionMeta: extractionMeta,
    documentFingerprint: documentFingerprint,
    detectedSource: String(extra.detectedSource || extra.classification &&
      extra.classification.documentType || '').trim(),
    effectiveSource: String(extra.effectiveSource || effectiveSource || '').trim(),
    classification: extra.classification || null,
    ocrRequired: !!extra.ocrRequired,
    statusMessage: String(extra.statusMessage || '').trim()
  };
}

function boundedHoldingsPreviewLoadDocumentTextFromFile_(file, pdfjsLib, options) {
  options = options || {};
  if (!file) {
    return Promise.reject(new Error('No file selected.'));
  }
  var kind = boundedHoldingsPreviewPdfFileKind_(file.name, file.type);
  if (kind === 'txt') {
    return boundedHoldingsPreviewReadTxtFile_(file).then(function(text) {
      var finalized = boundedHoldingsPreviewFinalizeLoadedDocumentText_(text, 'txt');
      var extractionMeta = null;
      var documentFingerprint = '';
      if (String(options.source || '').trim().toUpperCase() === 'ETRADE_CLIENT_STATEMENT_PDF') {
        extractionMeta = boundedHoldingsPreviewBuildEtradeClientStatementExtractionMeta_(
          finalized.text, 'TEXT_FILE');
        documentFingerprint = boundedHoldingsPreviewBuildEtradeClientStatementTextFingerprint_(finalized.text);
        if (extractionMeta && documentFingerprint) {
          extractionMeta.documentFingerprint = documentFingerprint;
        }
      }
      return {
        kind: 'txt',
        text: finalized.text,
        previewText: finalized.text,
        displayTextInEditor: true,
        extractionStatus: finalized.extractionStatus,
        extractedTextLength: finalized.extractedTextLength,
        extractionMeta: extractionMeta,
        documentFingerprint: documentFingerprint
      };
    });
  }
  if (kind === 'pdf') {
    return file.arrayBuffer().then(function(buffer) {
      return boundedHoldingsPreviewDigestArrayBuffer_(buffer).then(function(documentFingerprint) {
        return boundedHoldingsPreviewExtractPdfTextFromArrayBuffer_(buffer, pdfjsLib).then(function(text) {
          var finalized = boundedHoldingsPreviewFinalizeLoadedDocumentText_(text, 'pdf');
          var accountProvider = String((options || {}).accountProvider || '').trim().toUpperCase();
          var normalizedSource = String((options || {}).source || '').trim().toUpperCase();
          if (normalizedSource === 'FIDELITY_401K_STATEMENT_PDF') {
            return boundedHoldingsPreviewBuildStandardPdfLoadResult_(
              finalized, options, documentFingerprint);
          }
          if (accountProvider === 'M1' && options.groupedMode !== true) {
            return boundedHoldingsPreviewBuildStandardPdfLoadResult_(
              finalized,
              Object.assign({}, options, { source: 'M1_STATEMENT_PDF' }),
              documentFingerprint);
          }
          if (boundedHoldingsPreviewShouldUseM1PdfLoadPath_(options, text)) {
            return boundedHoldingsPreviewBuildStandardPdfLoadResult_(
              finalized, options, documentFingerprint);
          }
          var classification = boundedHoldingsPreviewClassifyEtradePdfText_(text);
          if (classification.documentType !== 'ETRADE_POSITIONS_PDF' &&
              typeof investmentEtradeClientStatementLooksLikePositionsPdf_ === 'function' &&
              !investmentEtradeClientStatementLooksLikePositionsPdf_(text) &&
              String(text || '').length > 3000 &&
              !/M1:|Finance Super App|Total account value \/ 1-month change/i.test(text)) {
            classification = {
              documentType: 'ETRADE_CLIENT_STATEMENT_PDF',
              confidence: 'MEDIUM',
              reason: 'PDF extract is not an Expanded Positions export.'
            };
          }
          var effectiveSource = boundedHoldingsPreviewResolveEtradePdfEffectiveSource_(
            classification, options.source);
          var clientOptions = Object.assign({}, options, { source: effectiveSource });
          if (effectiveSource === 'ETRADE_CLIENT_STATEMENT_PDF') {
            var pdfMeta = boundedHoldingsPreviewBuildEtradeClientStatementExtractionMeta_(
              finalized.text, 'PDFJS');
            if (!pdfMeta || !pdfMeta.usable) {
              return boundedHoldingsPreviewBuildClientStatementOcrRequiredResult_(
                finalized, classification, pdfMeta, documentFingerprint, effectiveSource);
            }
            if (pdfMeta) {
              pdfMeta.documentFingerprint = documentFingerprint;
            }
            return boundedHoldingsPreviewFinalizePdfLoadResult_(
              finalized, clientOptions, pdfMeta, documentFingerprint, {
                detectedSource: classification.documentType,
                effectiveSource: effectiveSource,
                classification: classification,
                ocrRequired: false,
                statusMessage: ''
              });
          }
          if (classification.documentType === 'ETRADE_CLIENT_STATEMENT_PDF') {
            var blockedMeta = boundedHoldingsPreviewBuildEtradeClientStatementExtractionMeta_(
              finalized.text, 'PDFJS');
            return boundedHoldingsPreviewBuildClientStatementOcrRequiredResult_(
              finalized, classification, blockedMeta, documentFingerprint, effectiveSource);
          }
          return boundedHoldingsPreviewFinalizePdfLoadResult_(
            finalized, options, null, documentFingerprint, {
              detectedSource: classification.documentType,
              effectiveSource: effectiveSource,
              classification: classification,
              ocrRequired: false,
              statusMessage: ''
            });
        });
      });
    });
  }
  return Promise.reject(new Error('Select a .pdf or .txt file.'));
}

function boundedHoldingsPreviewFormatFileMeta_(state) {
  state = state || {};
  if (state.extractionError) {
    return 'File: ' + String(state.fileName || 'unknown') + ' — extraction failed: ' +
      String(state.extractionError);
  }
  if (state.fileName) {
    var meta = 'File: ' + state.fileName + ' (' + String(state.fileSizeLabel || '') + ')';
    if (state.extractionStatus) {
      meta += ' · ' + state.extractionStatus;
    }
    if (state.statusMessage) {
      meta += ' · ' + String(state.statusMessage);
    }
    if (isFinite(Number(state.extractedTextLength)) && Number(state.extractedTextLength) > 0) {
      meta += ' · extracted text length ' + Number(state.extractedTextLength);
    } else if (isFinite(Number(state.rawExtractedTextLength)) &&
        Number(state.rawExtractedTextLength) > 0 &&
        Number(state.extractedTextLength) === 0) {
      meta += ' · raw extract withheld (' + Number(state.rawExtractedTextLength) + ' chars)';
    }
    return meta;
  }
  if (isFinite(Number(state.pastedTextLength)) && Number(state.pastedTextLength) > 0) {
    return 'Pasted text ready · length ' + Number(state.pastedTextLength);
  }
  return 'No file selected.';
}
