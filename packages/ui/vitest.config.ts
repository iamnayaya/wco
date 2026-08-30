import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * WCO UI — Vitest configuration.
 *
 * Tests colocate with components as `*.test.tsx`, run in jsdom, and assert
 * against the DOM (roles, ARIA, keyboard). No CSS is processed: components are
 * styled via inline `--wco-*` custom-property references so theming is a
 * runtime concern (globals.css in the host app), never a test concern.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    testTimeout: 15_000,
    restoreMocks: true,
    clearMocks: true,
    mockReset: false,
  },
});