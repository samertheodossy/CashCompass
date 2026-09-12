import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: node scripts/_extract401kPdfText.mjs <pdf-path>');
  process.exit(1);
}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
let text = '';
for (let i = 1; i <= doc.numPages; i += 1) {
  const page = await doc.getPage(i);
  const content = await page.getTextContent();
  text += content.items.map((it) => it.str).join(' ') + '\n';
}
console.log(JSON.stringify({ pages: doc.numPages, chars: text.length }));
console.log(text);
