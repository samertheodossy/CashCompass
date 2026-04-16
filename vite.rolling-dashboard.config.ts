import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  /** Browser / Apps Script hosts have no Node `process`; React still references it in some paths. */
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    global: 'globalThis'
  },
  plugins: [react()],
  build: {
    outDir: 'dist/rolling-dashboard',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'rollingDebtPayoffDashboardEntry.tsx'),
      name: 'RollingDebtPayoffDashboardIife',
      formats: ['iife'],
      fileName: () => 'rolling-debt-payoff-dashboard.iife.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'rolling-debt-payoff-dashboard.[ext]'
      }
    }
  }
});
