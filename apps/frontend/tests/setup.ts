import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * WCO Frontend — Vitest setup.
 * Loaded before every test file. Provides the browser API surface that
 * jsdom does not implement (ResizeObserver, matchMedia, IntersectionObserver,
 * scrollTo) and auto-cleans the RTL DOM between tests.
 */

afterEach(() => {
  cleanup();
  // Restore spies/fakes registered via vi.spyOn/vi.mock within a test.
  vi.restoreAllMocks();
});

/**
 * ResizeObserver — required by recharts responsive containers.
 */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

/**
 * matchMedia — required by next-themes (dark mode) hooks.
 */
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * IntersectionObserver — used by some lazy-rendered views and Next <Link>.
 * Stubbed unconditionally (jsdom may lack it and Next captures it at import).
 */
class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverStub,
});

// Element scroll into view (used by table/dialog autofocus).
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

// jsdom lacks `crypto.randomUUID` in some older environments; provide a fallback.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { ...globalThis.crypto, randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  });
}
