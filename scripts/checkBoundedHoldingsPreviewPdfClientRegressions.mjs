import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const root = new URL('../', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');
const require = createRequire(import.meta.url);

const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

const clientJs = read('bounded_holdings_preview_pdf_client.js');
const clientIncludeHtml = read('bounded_holdings_preview_pdf_client_include.html');
const boundedHtml = read('BoundedHoldingsPreviewUI.html');
const boundedSource = read('bounded_holdings_preview.js');
const groupsSource = read('bounded_holdings_preview_groups.js');

assert.equal(clientIncludeHtml.trim(), clientJs.trim(), 'PDF client include must stay in sync with .js');
assert.doesNotMatch(boundedSource, /bounded_holdings_preview_pdf_client\.html/);
assert.doesNotMatch(boundedHtml, /bounded_holdings_preview_pdf_client\.html/);
assert.match(boundedSource, /bounded_holdings_preview_pdf_client_include\.html/);
assert.match(boundedHtml, /bounded_holdings_preview_pdf_client_include\.html/);
assert.match(boundedSource, /includeHtml_/);
assert.doesNotMatch(boundedSource, /createHtmlOutputFromFile\([\s\S]*bounded_holdings_preview_pdf_client_include/);
assert.notEqual(
  'bounded_holdings_preview_pdf_client',
  'bounded_holdings_preview_pdf_client_include',
  'include base name must differ from .js clasp base name'
);

const context = {
  Promise,
  String, Number, Object, Array, Math, isFinite, Error, JSON, console,
  FileReader: null
};
vm.createContext(context);
vm.runInContext(clientJs, context, { filename: 'bounded_holdings_preview_pdf_client.js' });

// --- File kind detection ---
assert.equal(context.boundedHoldingsPreviewPdfFileKind_('statement.pdf', 'application/pdf'), 'pdf');
assert.equal(context.boundedHoldingsPreviewPdfFileKind_('extract.txt', 'text/plain'), 'txt');
assert.equal(context.boundedHoldingsPreviewPdfFileKind_('notes.doc', 'application/msword'), '');

// --- Normalization ---
assert.equal(
  context.boundedHoldingsPreviewNormalizeExtractedPdfText_('  line1\r\nline2  '),
  'line1\nline2'
);

// --- Meta formatting ---
assert.doesNotMatch(
  context.boundedHoldingsPreviewFormatFileMeta_({
    fileName: 'statement.pdf',
    fileSizeLabel: '12 KB',
    extractionStatus: 'extracting…',
    extractedTextLength: 0
  }),
  /No file selected/
);
assert.match(
  context.boundedHoldingsPreviewFormatFileMeta_({
    fileName: 'statement.pdf',
    fileSizeLabel: '12 KB',
    extractionStatus: 'extracting…',
    extractedTextLength: 0
  }),
  /extracting…/
);
assert.match(
  context.boundedHoldingsPreviewFormatFileMeta_({
    fileName: 'child.pdf',
    fileSizeLabel: '12 KB',
    extractionStatus: 'extracted locally from PDF',
    extractedTextLength: 4567
  }),
  /child\.pdf/
);
assert.match(
  context.boundedHoldingsPreviewFormatFileMeta_({
    fileName: 'notes.txt',
    fileSizeLabel: '4 KB',
    extractionStatus: 'read from text file',
    extractedTextLength: 120
  }),
  /read from text file/
);
assert.match(
  context.boundedHoldingsPreviewFormatFileMeta_({
    fileName: 'child.pdf',
    extractionError: context.BOUNDED_HOLDINGS_PREVIEW_PDF_NO_TEXT_ERROR_
  }),
  /extraction failed/
);
assert.equal(
  context.boundedHoldingsPreviewFormatFileMeta_({}),
  'No file selected.'
);
assert.match(
  context.boundedHoldingsPreviewFormatFileMeta_({ pastedTextLength: 120 }),
  /Pasted text ready · length 120/
);
assert.doesNotMatch(
  context.boundedHoldingsPreviewFormatFileMeta_({
    fileName: 'first.pdf',
    fileSizeLabel: '10 KB',
    extractionStatus: 'extracted locally from PDF',
    extractedTextLength: 100
  }),
  /No file selected/
);
assert.match(
  context.boundedHoldingsPreviewFormatFileMeta_({
    fileName: 'second.pdf',
    fileSizeLabel: '20 KB',
    extractionStatus: 'extracted locally from PDF',
    extractedTextLength: 200
  }),
  /second\.pdf/
);

function buildMinimalTextPdf(text) {
  const escaped = String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${stream.length} >>stream
${stream}
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000270 00000 n 
0000000378 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
456
%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function buildEmptyPagePdf() {
  const stream = ' ';
  const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>endobj
4 0 obj<< /Length ${stream.length} >>stream
${stream}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000214 00000 n 
trailer<< /Size 5 /Root 1 0 R >>
startxref
292
%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

// --- PDF extraction success ---
const textPdf = buildMinimalTextPdf('Statement period: 08/01/2026 to 08/31/2026');
const extracted = await context.boundedHoldingsPreviewExtractPdfTextFromArrayBuffer_(
  textPdf.buffer.slice(textPdf.byteOffset, textPdf.byteOffset + textPdf.byteLength),
  pdfjsLib
);
assert.match(extracted, /Statement period:/);

// --- Character-spaced PDF.js extract is normalized for display ---
function charSpaceLine(line) {
  return String(line || '').trim().split(/\s+/).map(function(word) {
    return word.split('').join(' ');
  }).join('  ');
}
const charSpacedBlob = [
  'Statement period: 08/01/2026 to 08/31/2026',
  'Account number: XXXX5678',
  'Account value',
  'Total account value / 1-month change',
  '$18,377.36 / $2,858.57 [18.42%]',
  'Account breakdown',
  'Cash $6.92 $6.92 $0.00',
  'Equities $15,511.87 $18,370.44 $2,858.57',
  'Symbol Quantity Price Market value Cost basis Unrealized P/L',
  'SYNA 57.65199 $100.00 $5,765.20 $2,000.00 $3,765.20'
].map(charSpaceLine).join(' ');
const readable = context.boundedHoldingsPreviewReadableExtractText_(charSpacedBlob);
assert.equal(readable.normalized, true);
assert.match(readable.text, /Statement period: 08\/01\/2026 to 08\/31\/2026/);
assert.doesNotMatch(readable.text, /S t a t e m e n t/);
assert.match(readable.text, /Total account value \/ 1-month change/);
assert.match(readable.text, /\$18,377\.36/);
assert.match(readable.text, /Cash \$6\.92/);
assert.doesNotMatch(readable.text, /Total\s*\naccount value \/ 1-month change,377/);

// --- Empty/non-text PDF failure ---
const emptyPdf = buildEmptyPagePdf();
await assert.rejects(
  () => context.boundedHoldingsPreviewExtractPdfTextFromArrayBuffer_(
    emptyPdf.buffer.slice(emptyPdf.byteOffset, emptyPdf.byteOffset + emptyPdf.byteLength),
    pdfjsLib
  ),
  (err) => String(err.message).includes(context.BOUNDED_HOLDINGS_PREVIEW_PDF_NO_TEXT_ERROR_)
);

// --- UI wiring ---
assert.match(boundedHtml, /accept="\.pdf,\.txt,application\/pdf,text\/plain"/);
assert.match(boundedHtml, /id="documentFile"/);
assert.match(boundedHtml, /id="fileMeta"/);
assert.match(boundedHtml, /boundedHoldingsPreviewIncludePdfClient_/);
assert.match(boundedHtml, /boundedHoldingsPreviewLoadDocumentTextFromFile_/);
assert.match(boundedHtml, /boundedHoldingsPreviewFormatFileMeta_/);
assert.match(boundedHtml, /renderDocumentFileMeta_/);
assert.match(boundedHtml, /formatDocumentFileMetaLocal_/);
assert.match(boundedHtml, /setDocumentTextareaValue_/);
assert.match(boundedHtml, /suppressDocumentTextSync_/);
assert.match(boundedHtml, /beginDocumentFileSelection_/);
assert.match(boundedHtml, /clearDocumentFileState_/);
assert.match(boundedHtml, /applyDocumentFileLoadResult_/);
assert.match(boundedHtml, /applyDocumentFileLoadError_/);
assert.match(boundedHtml, /extracting…/);
assert.match(boundedHtml, /previewBtn\.disabled = !\(hasText && singleReady\(\) && !extracting\)/);
assert.match(boundedHtml, /groupedPreviewBtn\.disabled = !\(groupedReady\(\) && !extracting\)/);
assert.match(boundedHtml, /id="workflowSingle"/);
assert.match(boundedHtml, /id="workflowGrouped"/);
assert.match(boundedHtml, /Single account statement/);
assert.match(boundedHtml, /M1 grouped statements/);
assert.match(boundedHtml, /Preview M1 statement/);
assert.match(boundedHtml, /workflowSingleEl\.hidden = !state\.selectedAccount \|\| isGroupedMode\(\)/);
assert.match(boundedHtml, /workflowGroupedEl\.hidden = !isGroupedMode\(\)/);
assert.match(boundedHtml, /boundedHoldingsPreviewSuggestRegistrationFromDashboard/);
assert.match(boundedHtml, /confirmedRegistrationByPicker/);
assert.doesNotMatch(boundedHtml, /id="groupedCard"/);
assert.doesNotMatch(boundedHtml, /id="groupedRegistrationType"/);
assert.doesNotMatch(boundedHtml, /id="groupedExplicitMatch"/);
assert.doesNotMatch(boundedHtml, /id="documentFileGrouped"/);
assert.match(clientJs, /boundedHoldingsPreviewReadableExtractText_/);
assert.match(clientJs, /spacing normalized for readability/);
assert.match(boundedHtml, /normalizePastedDocumentText_/);
assert.match(boundedHtml, /boundedHoldingsPreviewReadableExtractText_/);
assert.match(clientJs, /extracted locally from PDF/);
assert.match(clientJs, /read from text file/);
assert.match(boundedHtml, /pdf\.min\.js/);
assert.match(boundedHtml, /Or paste PDF text extract/);
assert.match(boundedHtml, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.doesNotMatch(
  boundedHtml,
  /fileMetaEl\.textContent = boundedHoldingsPreviewFormatFileMeta_\([^)]*currentText\(\)\.length/
);

// --- No binary PDF upload / persistence / logging ---
assert.doesNotMatch(boundedHtml, /readAsDataURL|FormData|multipart\/form-data/i);
assert.doesNotMatch(boundedHtml, /console\.log\([^)]*rawText|console\.log\([^)]*result\.text/i);
assert.doesNotMatch(boundedSource, /rawDocumentBinary|uploadPdf|DriveApp|Firestore/);
assert.doesNotMatch(groupsSource, /rawDocumentBinary|uploadPdf/);
assert.doesNotMatch(boundedHtml, /localStorage|sessionStorage|indexedDB/i);

// --- Grouped flow unchanged ---
assert.match(groupsSource, /boundedHoldingsPreviewRunGroupedChildFromDashboard/);
assert.match(groupsSource, /DUPLICATE_NOOP/);
assert.match(boundedHtml, /groupedSession/);

// --- Server still receives text only ---
assert.match(boundedHtml, /rawDocumentText/);
assert.match(groupsSource, /rawDocumentText/);
assert.doesNotMatch(boundedSource, /rawDocumentPdf|pdfBytes|base64Pdf/i);

console.log('Bounded holdings preview PDF client regressions passed.');
