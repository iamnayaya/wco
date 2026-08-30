import { vi } from 'vitest';

/**
 * WCO Frontend — minimal `next/navigation` `useRouter` stand-in for tests.
 *
 * Instantiate once, expose `.value` as the object injected by
 * `vi.mock('next/navigation')`, and spy on `push`/`replace`/`back`.
 */
export default class MockRouter {
  value: {
    push: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
    back: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };

  constructor() {
    this.value = this.reset();
  }

  reset() {
    this.value = {
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      refresh: vi.fn(),
    };
    return this.value;
  }
}
