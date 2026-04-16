import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const jsPath = join(root, 'dist/rolling-dashboard/rolling-debt-payoff-dashboard.iife.js');
const outPath = join(root, 'RollingDebtPayoffDashboardBundle.html');

const js = readFileSync(jsPath, 'utf8').trim();
// Apps Script server must never evaluate this; guard if file is mistakenly loaded as .js server script.
const wrapped =
  '(function(){\n' +
  "  if (typeof window === 'undefined' || typeof document === 'undefined') return;\n" +
  js +
  '\n})();';
// PlannerDashboardWeb.html already wraps this file in <script>...</script>. Nesting <script> here
// would inject a literal "<" into JS and break parsing ("expected expression, got '<'").
// Also escape any literal </script> in minified output so the HTML parser cannot close the host early.
const fragment =
  '// RollingDebtPayoffDashboardBundle: JS fragment (included inside <script> in PlannerDashboardWeb).\n' +
  wrapped.replace(/<\/script>/gi, '<\\/script>') +
  '\n';
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, fragment, 'utf8');
console.log('Wrote', outPath);
