/**
 * WCO Motion — physics.
 *
 * Deterministic, dependency-free solvers. All integrals use a fixed-STEP
 * semi-implicit Euler (dt capped) so behaviour is identical across browsers,
 * jsdom and tests. The canvas here: springs (the workhorse), gravity/drag for
 * drops, friction + inertia for momentum flings, and velocity utilities.
 */

export interface SpringParams {
  stiffness?: number;
  damping?: number;
  mass?: number;
  initialVelocity?: number;
  /** Stop once velocity+position are this close to rest. */
  restSpeed?: number;
  restDelta?: number;
}

export interface StepResult {
  value: number;
  velocity: number;
  atRest: boolean;
}

const DEFAULT_STIFFNESS = 170;
const DEFAULT_DAMPING = 26;
const DEFAULT_MASS = 1;
const DEFAULT_REST_SPEED = 0.01;
const DEFAULT_REST_DELTA = 0.01;

/**
 * One simulation step of a damped harmonic oscillator.
 * `value` and `velocity` are current state; `target` is what it pulls toward.
 * dt is in milliseconds (converted to seconds internally).
 */
export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  params: SpringParams = {},
  dtMs: number,
): StepResult {
  const stiffness = params.stiffness ?? DEFAULT_STIFFNESS;
  const damping = params.damping ?? DEFAULT_DAMPING;
  const mass = params.mass ?? DEFAULT_MASS;
  const restSpeed = params.restSpeed ?? DEFAULT_REST_SPEED;
  const restDelta = params.restDelta ?? DEFAULT_REST_DELTA;

  const dt = Math.max(0, Math.min(dtMs, 32)) / 1000;
  if (dt === 0) return { value, velocity, atRest: false };

  // Standard oscillator: a = (−stiffness·x − damping·v) / mass
  // Critical damping ratio guides *feel*; mass scales the response.
  const x = value - target;
  const acceleration = (-stiffness * x - damping * velocity) / mass;
  const nextVelocity = velocity + acceleration * dt;
  const nextValue = value + nextVelocity * dt;

  const rest = Math.abs(nextValue - target) <= restDelta && Math.abs(nextVelocity) <= restSpeed;
  return { value: nextValue, velocity: nextVelocity, atRest: rest };
}

/**
 * Simulate an entire spring settle in fixed steps and return a frame list.
 * Useful for precomposed animation and for tests that must not depend on rAF.
 */
export function integrateSpring(
  from: number,
  target: number,
  params: SpringParams = {},
  overMs = 1500,
  stepMs = 16,
): Array<StepResult> {
  let value = from;
  let velocity = params.initialVelocity ?? 0;
  const frames: Array<StepResult> = [{ value, velocity, atRest: from === target && velocity === 0 }];
  const total = Math.ceil(overMs / stepMs);
  for (let i = 0; i < total; i += 1) {
    const r = stepSpring(value, velocity, target, params, stepMs);
    frames.push(r);
    value = r.value;
    velocity = r.velocity;
    if (r.atRest) break;
  }
  return frames;
}

/** Estimate how long a spring needs to settle (frames × step, capped). */
export function springDuration(from: number, target: number, params: SpringParams = {}): number {
  const frames = integrateSpring(from, target, params);
  return frames.length * 16;
}

/* ---------------------------- gravity & drag ---------------------------- */

export interface DropParams {
  gravity?: number;
  drag?: number;
  ground?: number;
}

const DEFAULT_GRAVITY = 0.6; // px / ms²
const DEFAULT_DRAG = 0.004; // per-ms velocity decay (~≈ air resistance)

export interface DropStep {
  value: number;
  velocity: number;
  grounded: boolean;
}

/** Integrate a falling/launched body: velocity builds with gravity, decayed by drag. */
export function stepDrop(
  value: number,
  velocity: number,
  params: DropParams = {},
  dtMs: number,
): DropStep {
  const gravity = params.gravity ?? DEFAULT_GRAVITY;
  const drag = params.drag ?? DEFAULT_DRAG;
  const ground = params.ground ?? Infinity;
  const dt = Math.max(0, Math.min(dtMs, 32));

  let v = velocity + gravity * dt;
  v *= Math.pow(1 - drag, dt);
  let y = value + v * dt;
  let grounded = false;
  if (y >= ground) {
    y = ground;
    v = 0;
    grounded = true;
  }
  return { value: y, velocity: v, grounded };
}

/* --------------------------- friction / fling --------------------------- */

export interface FrictionParams {
  power?: number;
  minVelocity?: number;
}

const DEFAULT_MIN_VELOCITY = 0.05;

/** Decay a velocity frame-by-frame; position integrates the decaying velocity. */
export function stepFriction(
  value: number,
  velocity: number,
  params: FrictionParams = {},
  dtMs: number,
): StepResult {
  const power = params.power ?? 0.001;
  const min = params.minVelocity ?? DEFAULT_MIN_VELOCITY;
  const dt = Math.max(0, Math.min(dtMs, 32));
  const v = velocity * Math.pow(1 - power, dt);
  return {
    value: value + v * dt,
    velocity: v,
    atRest: Math.abs(v) <= min,
  };
}

/** Total distance a fling travels before rest (≈ velocity / power). */
export function flingDistance(velocity: number, params: FrictionParams = {}): number {
  const power = params.power ?? 0.001;
  if (power <= 0) return Infinity;
  return velocity / power;
}

export function normalizeVelocity(v: number): number {
  return Number.isFinite(v) ? v : 0;
}