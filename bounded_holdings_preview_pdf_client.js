var BOUNDED_HOLDINGS_PREVIEW_PDF_NO_TEXT_ERROR_ =
  'This PDF does not contain selectable text. Use a text-based PDF or paste a text extract.';

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

function boundedHoldingsPreviewLoadDocumentTextFromFile_(file, pdfjsLib) {
  if (!file) {
    return Promise.reject(new Error('No file selected.'));
  }
  var kind = boundedHoldingsPreviewPdfFileKind_(file.name, file.type);
  if (kind === 'txt') {
    return boundedHoldingsPreviewReadTxtFile_(file).then(function(text) {
      var finalized = boundedHoldingsPreviewFinalizeLoadedDocumentText_(text, 'txt');
      return {
        kind: 'txt',
        text: finalized.text,
        extractionStatus: finalized.extractionStatus,
        extractedTextLength: finalized.extractedTextLength
      };
    });
  }
  if (kind === 'pdf') {
    return file.arrayBuffer().then(function(buffer) {
      return boundedHoldingsPreviewExtractPdfTextFromArrayBuffer_(buffer, pdfjsLib).then(function(text) {
        buffer = null;
        var finalized = boundedHoldingsPreviewFinalizeLoadedDocumentText_(text, 'pdf');
        return {
          kind: 'pdf',
          text: finalized.text,
          extractionStatus: finalized.extractionStatus,
          extractedTextLength: finalized.extractedTextLength
        };
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
    if (isFinite(Number(state.extractedTextLength)) && Number(state.extractedTextLength) > 0) {
      meta += ' · extracted text length ' + Number(state.extractedTextLength);
    }
    return meta;
  }
  if (isFinite(Number(state.pastedTextLength)) && Number(state.pastedTextLength) > 0) {
    return 'Pasted text ready · length ' + Number(state.pastedTextLength);
  }
  return 'No file selected.';
}
