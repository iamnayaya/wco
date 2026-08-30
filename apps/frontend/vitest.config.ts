import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * WCO Frontend — Vitest configuration.
 *
 * Unit + integration tests run in jsdom against the React tree. Network I/O is
 * intercepted by mocking `src/lib/api/client` (see tests/setup.ts and
 * tests/utils/api-mock.ts) so every suite is hermetic and fast.
 *
 * Coverage thresholds enforce the WCO "80% or it doesn't ship" policy. Coverage
 * is collected for source (not test/build/tailwind config), and the Next.js
 * app-router *layout* files (thin providers) plus route-level pages that are
 * covered by Playwright E2E are excluded from the unit threshold so the gate is
 * meaningful rather than punishing.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@wco/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    testTimeout: 15_000,
    restoreMocks: true,
    clearMocks: true,
    mockReset: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/app/layout.tsx',
        'src/app/providers.tsx',
        'src/app/page.tsx',
        'src/app/not-found.tsx',
        'src/app/error.tsx',
        // App-router page wrappers exercised by Playwright E2E.
        'src/app/(dashboard)/**/page.tsx',
        'src/components/landing/**',
        'src/lib/i18n.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
