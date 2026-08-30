# @wco/ui

WCO design system: tokens + framework-agnostic React primitives. Everything is
imported from the package root — no deep imports needed.

```ts
import { Button, DatePicker, Kanban, I18nProvider, sem, cn } from '@wco/ui';
```

## Getting started

```tsx
import { I18nProvider, Button, sem } from '@wco/ui';

<I18nProvider locale="en">
  <Button variant="primary">Pay</Button>
</I18nProvider>
```

- React 18+, TypeScript-first props.
- No CSS files, no runtime styling library: components are styled with inline
  styles referencing `--wco-*` custom properties (with hard-coded fallbacks),
  so theming is entirely a runtime concern of the host app.

## Theming

Colors, radii, shadows and motion come from the token layer:

- `sem(key)` resolves `var(--wco-<key>, var(--fallback-<key>, color))` for
  theme-aware colors.
- `semDark(key)` and the raw `design-tokens/` tables are also exported.
- Control geometry lives in `controlSize` / `controlBorderRadius`
  (`sm | md | lg`), easing in `motion.fast | motion.base`.
- `focusRing` is a ready-made focus style object for custom components.

## Internationalization

`I18nProvider` (defaults to `en`) supplies locale-aware strings and formats to
every component that needs them (`ActionMenu`, `DatePicker`, `TimePicker`,
`FileUpload`, the WhatsApp suite, and so on). Strings come from
`lib/i18n.tsx` `CoreStrings`; individual components accept a `strings?: Partial<...>`
prop for overrides, merged via `mergeStrings`. Formats are usable directly
(`formatCurrency`, `formatNumber`, `formatDate`, `formatRelative`, …).

## Advanced library

The advanced layer (`src/components/advanced.tsx`, re-exported from the package
root) adds dense, real-world workflows on top of the primitives. All
interactive surfaces are real `<button>`/`<input>` elements with ARIA wiring and
keyboard support — no library-deprived abstractions.

### Action

| Component | Purpose |
| --- | --- |
| `useActionMenu` | Lightweight menu state engine (`aria-activedescendant`, arrows, Escape/Tab). |
| `ActionMenu` | Accessible overflow menu with `ActionMenuItem` + `MenuItems`. |
| `SplitButton` | Primary action fused with a disclosure menu; `loading` disables both halves. |
| `FloatingActionButton` | Speed-dial FAB with optional items (`aria-expanded`). |
| `ToggleGroup` | Single (radio) / multiple (aria-pressed) toggle groups. |
| `CommandPalette` | `Ctrl+K` style dialog with keyboard filtering. |

### Form

| Component | Purpose |
| --- | --- |
| `DatePicker` / `CalendarMonth` | Calendar popover, roving tabindex, `aria-pressed` selection, localized cells. |
| `TimePicker` / `TimeColumns` | 12/24h hour+minute columns with step-aware ticks. |
| `DateTimePicker` | Combined date+time popover with Done/Cancel. |
| `FileUpload` | `accept` + `maxSize` validation funneling errors to `onError`. |
| `FilePreview` | File card with formatted size and remove affordance. |
| `ColorPicker` | Preset swatches + custom hex (native picker fallback). |
| `FormSection` | `aria-labelledby` collapsible section. |

### Layout & navigation

`Panel`, `Spacer`, `Navbar` (floating variant), `Sidebar` (collapsible rail,
`aria-expanded` + `aria-current`), `TabBar`, `LinkList`.

### Data, media & feedback

`Kanban` (board columns, live count chips), `InfoCard`, `ProfileCard`,
`Carousel` (loop/dots/autoplay, `aria-roledescription="carousel"`),
`StatusIndicator` (labeled `role="status"`), `CompletionIndicator`
(assistive-tech live region named via `aria-label`), `Kbd`.

### AI

`AIPrediction` (confidence as a true `role="progressbar"`), `AIRecommendation`,
`AIChat` (suggestion chips, Enter-to-send, its own localized strings).

### WhatsApp-style

`ChatHeader`, `MessageReactions` (`aria-pressed` pills), `MessageAttachment`
(file/voice cards, determinate progress), `MessagePreview` (composed accessible
row label).

### Mobile

`TopNavigationBar`, `BottomNavigationBar` (badges truncated to `99+`,
`aria-current`).

### Motion

A dependency-free animation, gesture and scroll system (`src/motion`). No
animation library is required; everything is driven by our own frame loop and
deterministic physics.

**Architecture** — `core.ts` (interpolation, easing, `MotionValue`,
`buildMotionStyle`) is pure and SSR-safe; `raf.ts` is the single frame driver
(with `setFrameRate`, `pauseFrames`/`resumeFrames` and test hooks); `physics.ts`
provides springs, drops, friction and flings; `tokens.ts` holds the 15 motion
principles, `SPRINGS`, `PRESETS`, durations, distances and easings.

**Components** — `Animate` (from/to motion values, `mode: 'tween'|'spring'`),
`Fade`, `Slide` (4 directions, `distance`), `Zoom`, `Flip`, `Rotate`
(`mode: 'spring'` by default), `Reveal` (in-view gate), `Parallax`,
`Spring`, `Tween`, `Timeline`, `Stagger`, `Cascade`, `CountUp`, `Skeleton`
(surfaces as `SkeletonLoader` on the root — feedback `Skeleton` owns the name),
`Ripple`, `Pressable` (`aria-pressed` toggle), `Shake`, `ScrollToTop`,
`ScrollProgressBar`, `Sticky`. Preset-first: pass a preset name
(documented list in JSDoc) or per-component props.

**Hooks** — `useMotionValue`, `useMotionStyle`, `useTween`, `useSpring`,
`useSpringObject`, `useTimeline`, `useSequence`, `useStagger`, `useInView`,
`useCascade`, `useCount`, `useCycle`; gestures `useTap`, `useHover`, `useFocus`,
`useSwipe`, `usePinch`, `useDrag`, `useMove`, `useRotate`, `useScale`,
`useResize`; scroll `useScroll`, `useParallax`, `useReveal`, `useSticky`,
`useScrollSpy`, `useScrolledPast`, `useInfiniteScroll`.

**Configuration** — `MotionProvider` (via `useMotionPrefs`,
`useReducedMotionPref`) carries `reduced` (OS or overridden via `forced`),
`rate` (playback rate, `0` freezes) and `frozen` (hard pause); loops honor
`counts` and `loop` semantics (`none`/`loop`/`mirror`/`once`).

**Accessibility** — `getPrefersReducedMotion`, `usePrefersReducedMotion`,
`shouldAnimate`, `motionSafeStyle` and `collapseMotion` implement the reduced-motion
contract: long slides collapse to a fade, loops complete one cycle, ambient motion
is skipped, and `animation`/`transition`/`willChange` are stripped under
`prefers-reduced-motion: reduce`.

**Framer Motion bridge** — invariant to loading a dependency: `springToFramer`,
`easingToFramer`, `loopToFramer`, `transitionToFramer` and `presetToFramer` emit
plain Framer-shaped `transition`/`variants` objects from WCO tokens. Import the
framer package yourself if you need a full weighted-spring renderer; these adapters
never import it.

**Name aliases** — root-level name collisions with design tokens are aliased:
motion's `duration` is `motionDuration`, its `EasingName` is `motionEasingName`,
and motion's `Skeleton` is `SkeletonLoader`.

## Testing

Tests are colocated in `src/**/*.test.tsx` and run under jsdom. Motion specs use
the deterministic frame harness: `__setManualFrames(true)` then advance time with
`__tickFrame(ms)` (the first tick after `__resetFrames()` warms up at `dt = 0`),
so animations never depend on `requestAnimationFrame` timing.

```sh
npm run test:unit     # vitest run
npm run typecheck     # tsc --noEmit
```

There is no Storybook setup in this repository; component documentation lives
in inline JSDoc on each component and in this file.