/**
 * WCO Motion — frame driver.
 *
 * A single rAF loop drives every animation in the app (CPU efficient: one
 * tick per frame regardless of how many tweens/springs are live). Under fake
 * timers (Vitest) `requestAnimationFrame`/`setTimeout` are faked so tests can
 * deterministically advance time. The driver also supports global pause,
 * resume and rate scaling so the motion provider can implement user-driven
 * reduced-motion and a "freeze everything" affordance.
 */

type FrameCallback = (time: number, delta: number) => void;

let queued = new Set<FrameCallback>();
let loopHandle: number | null = null;
let lastTime: number | null = null;
let manualFrames = false;

/* Rate is applied to *delta*, so it never desyncs wall clock. 0 freezes. */
let globalRate = 1;
let globalPaused = false;

function schedule(): void {
  if (manualFrames) return;
  if (loopHandle !== null || queued.size === 0) return;
  if (typeof globalThis.requestAnimationFrame === 'function') {
    loopHandle = globalThis.requestAnimationFrame(tick);
  } else {
    loopHandle = globalThis.setTimeout(() => tick(performance.now()), 16) as unknown as number;
  }
}

function tick(time: number): void {
  loopHandle = null;
  if (globalPaused) {
    lastTime = time;
    return;
  }
  const delta = lastTime === null ? (manualFrames ? 0 : 16) : Math.max(0, time - lastTime);
  lastTime = time;
  if (queued.size === 0) {
    lastTime = null;
    return;
  }
  const scaled = delta * globalRate;
  for (const cb of Array.from(queued)) {
    cb(time, scaled);
  }
  schedule();
}

/** Register a per-frame callback. Returns an unsubscribe function. */
export function subscribeFrame(cb: FrameCallback): () => void {
  queued.add(cb);
  schedule();
  return () => {
    queued.delete(cb);
  };
}

/* ----------------------------- driver control ---------------------------- */

export function pauseFrames(): void {
  globalPaused = true;
}

export function resumeFrames(): void {
  globalPaused = false;
  lastTime = null;
  schedule();
}

export function setFrameRate(rate: number): void {
  globalRate = Math.max(0, Math.min(4, rate));
}

export function getFrameRate(): number {
  return globalRate;
}

/**
 * Test hook: deterministically invoke all subscribers as if one frame at
 * absolute `time` had elapsed. Used with Vitest fake timers to step the loop.
 */
export function __tickFrame(time: number): void {
  tick(time);
}

/** Test hook: reset driver state so suites can run in isolation. */
export function __resetFrames(): void {
  if (loopHandle !== null) {
    if (typeof globalThis.cancelAnimationFrame === 'function') cancelAnimationFrame(loopHandle);
    else clearTimeout(loopHandle);
    loopHandle = null;
  }
  queued = new Set();
  lastTime = null;
  globalRate = 1;
  globalPaused = false;
}

/** Test hook: report how many callbacks are currently registered. */
export function __frameCount(): number {
  return queued.size;
}

/**
 * Manual-frame mode: suspends the auto rAF/timer loop so tests can drive
 * every tick deterministically through `__tickFrame`. Enabling it resets
 * driver state.
 */
export function __setManualFrames(mode: boolean): void {
  manualFrames = mode;
  if (mode) __resetFrames();
}