/**
 * WCO Motion — public barrel.
 *
 * The dependency-free animation + gesture engine. Every value, component,
 * hook and token is re-exported here; the root package entry re-exports this
 * module (`Skeleton` is surfaced as `SkeletonLoader` there because the
 * feedback `Skeleton` already owns that name).
 */

// Frame driver
export {
  subscribeFrame,
  pauseFrames,
  resumeFrames,
  setFrameRate,
  getFrameRate,
  __tickFrame,
  __resetFrames,
  __frameCount,
  __setManualFrames,
} from './raf';

// Math + motion value core
export {
  clamp,
  round2,
  mix,
  smoothstep,
  pingpong,
  resolveEasing,
  interpolate,
  interpolateKeyframes,
  resolveDuration,
  MotionValue,
  buildTransform,
  buildFilter,
  buildMotionStyle,
} from './core';
export type {
  EasingName,
  Easing,
  EasingFn,
  InterpolateOptions,
  MotionStyleValues,
} from './core';

// Spring / momentum physics
export {
  stepSpring,
  integrateSpring,
  springDuration,
  stepDrop,
  stepFriction,
  flingDistance,
  normalizeVelocity,
} from './physics';
export type {
  SpringParams,
  StepResult,
  DropParams,
  DropStep,
  FrictionParams,
} from './physics';

// Motion tokens: principles, durations, distances, easings, springs, presets
export {
  PRINCIPLES,
  DURATIONS,
  duration,
  DISTANCES,
  distance,
  EASINGS,
  SPRINGS,
  spring,
  springSpec,
  PRESETS,
  PRESET_GROUPS,
  resolvePreset,
  presetNames,
  isShakePreset,
  countsOf,
  loopOf,
} from './tokens';
export type {
  LoopMode,
  SpringSpec,
  PresetSpec,
  Principle,
  DurationToken,
  EasingToken,
  PresetName,
} from './tokens';

// Value + animation hooks and the motion provider
export {
  MotionProvider,
  useMotionPrefs,
  useReducedMotionPref,
  useMotionValue,
  useMotionValueRender,
  binderName,
  useMotionStyle,
  useTween,
  useSpring,
  useSpringFrom,
  useSpringObject,
  timelineValueAt,
  useTimeline,
  useSequence,
  useStagger,
  useInView,
  useCascade,
  useCount,
  useCycle,
} from './values';
export type {
  MotionPrefs,
  MotionProviderProps,
  TweenSpec,
  TweenController,
  SpringHookOptions,
  SpringObjectResult,
  TimelineKeyframe,
  TimelineSpec,
  TimelineController,
  SequenceStep,
  SequenceController,
  StaggerOptions,
} from './values';

// Pointer / gesture affordances
export {
  useTap,
  useHover,
  useFocus,
  useSwipe,
  usePinch,
  useDrag,
  useMove,
  useRotate,
  useScale,
  useResize,
} from './gestures';
export type {
  GestureAxis,
  BindHandlers,
  GestureBind,
  TapHandlers,
  TapResult,
  HoverResult,
  FocusResult,
  SwipeDirection,
  SwipeResult,
  PinchResult,
  DragHandlers,
  DragResult,
  MoveResult,
  RotateResult,
  ScaleResult,
  ResizeResult,
} from './gestures';

// Accessibility guardrails
export {
  REDUCED_MOTION_QUERY,
  getPrefersReducedMotion,
  usePrefersReducedMotion,
  shouldAnimate,
  motionSafeStyle,
  collapseMotion,
} from './a11y';

// Framer Motion bridge (pure config adapters — no framer dependency)
export {
  easingToFramer,
  springToFramer,
  loopToFramer,
  transitionToFramer,
  presetToFramer,
} from './framer';
export type {
  FramerSpringTransition,
  FramerEasing,
  FramerTransition,
  FramerVariants,
} from './framer';

// Scroll-driven primitives
export {
  useScroll,
  useParallax,
  useReveal,
  revealFrom,
  useSticky,
  useScrollSpy,
  useScrolledPast,
  useInfiniteScroll,
  scrollToTarget,
} from './scroll';
export type {
  ScrollInfo,
  ScrollOptions,
  ParallaxOptions,
  ParallaxResult,
  RevealDirection,
  RevealOptions,
  RevealResult,
  StickyResult,
  InfiniteScrollOptions,
  InfiniteScrollResult,
} from './scroll';

// Components
export {
  Animate,
  Fade,
  Slide,
  Zoom,
  Flip,
  Rotate,
  Reveal,
  Parallax,
  Spring,
  Tween,
  Timeline,
  Stagger,
  Cascade,
  CountUp,
  Skeleton as SkeletonLoader,
  Ripple,
  Pressable,
  Shake,
  ScrollToTop,
  ScrollProgressBar,
  Sticky,
} from './components';
export type {
  AnimateProps,
  EntryProps,
  SlideDirection,
  SlideProps,
  FlipProps,
  RevealProps,
  ParallaxProps,
  SpringProps,
  TweenProps,
  TimelineProps,
  StaggerProps,
  CascadeProps,
  CountUpProps,
  SkeletonProps as SkeletonLoaderProps,
  RippleProps,
  PressableProps,
  ShakeProps,
  ScrollToTopProps,
  ScrollProgressBarProps,
  StickyProps,
} from './components';