# Component Library — Advanced WCO UI

> Status: **live** · Package: `@wco/ui` · Extends the Prompt-31 primitives (24)
> with a production-grade advanced set (41 new exports across 10 categories).

## Scope

Alongside the existing primitives (`Button`, `Input`, `Card`, `Badge`, …) WCO now
ships an advanced library built for real commerce work: multi-step forms,
sandwich overlays, table sorting, toast/realtime feedback, conversations, and
AI-first surfaces. Everything is:

- **`react@18` only** — no runtime animation/motion/i18n dependencies.
- **Fully typed** — every component + hook exposes `Props`/result types.
- **Accessible (WCAG AAA aware)** — ARIA roles, keyboard/roving focus, focus
  traps, live regions, and sr-only text out of the box.
- **Themed** — inline styles using the `--wco-* → --fallback-* → hex` triple
  fallback chain via `sem()` (see `src/lib/styles.ts`), so components are
  light-adaptive and dark-ready without a CSS build.
- **Tested** — Vitest + Testing Library (`54` tests green, no CSS required).

## Architectural hooks & helpers

| Helper | File | Purpose |
| --- | --- | --- |
| `useId`, `useControllableState`, `useKey`, `useClickOutside` | `lib/hooks.ts` | Foundation for all interactive components |
| `useFocusTrap`, `useScrollLock` | `lib/hooks.ts` | Overlay correctness (Modal/Drawer/Sheet) |
| `usePopoverPosition` (+`Placement`) | `lib/hooks.ts` | Floating positioning for Tooltip/Popover |
| `useMediaQuery`, `useBreakpoint`, `useRovingTabIndex` | `lib/hooks.ts` | Responsive + list navigation |
| `useForm` + `validators` | `lib/form.ts` | Stateful form controller + rule helpers |
| `formatNumber/Currency/Phone/Relative` | `lib/format.ts` | Locale-aware formatting (50+ locales), EM-focused currencies |
| `box` (polymorphic) | `lib/polymorphic.ts` | `as=` element override for layout primitives |

> All helpers are re-exported from the package root (`@wco/ui`), so consumers
> can adopt the same hooks their components use under the hood.

## Categories & exports

### 1 · Form orchestration
`Form`, `FormContext`, `useFormContext`, `validators`, `required`, `FormField`,
`FormWizard` — declarative validation, dirty/touched tracking, and multi-step
wizard with per-step rules.

### 2 · Form inputs
`InputGroup` (prefix/suffix), `PasswordInput` (+ `estimatePasswordStrength`),
`SearchInput` (clearable), `NumberInput` (stepper/min/max), `CurrencyInput`
(EM currency symbols), `PhoneInput` (dial-code + formatting), `OTPInput`
(auto-advance/paste/complete), `RatingInput` (half-steps/description labels),
`TagInput` (chip list), `RangeSlider` (dual-handle).

### 3 · Layout
`Container` (page rails), `Grid`, `Flex` (polymorphic `as`), `Modal`/`Dialog`
(focus trap + scroll lock + Escape), `Drawer` (left/right/top/bottom), `Tooltip`,
`Popover`.

### 4 · Navigation
`Breadcrumb`, `Pagination` (ellipsis collapse), `Tabs` (arrow-key roving),
`Stepper` (multi-step progress), `SkipLink`.

### 5 · Data display
`DataTable` (sortable, sticky, enum-like API), `Timeline`, `List`
(ordered/unordered + completed checkmarks).

### 6 · Feedback
`ToastProvider` + `useToast` (imperative toasts), `ProgressCircle`
(determinate/indeterminate), `ErrorBoundary`, `SkeletonText`.

### 7 · Media
`Avatar` (deterministic color + initials + status), `AvatarGroup` (overflow),
`Image` (ratio + shimmer + fallback).

### 8 · AI
`AISuggestion` (labeled, confidence, dismissible), `AIInsight` (trend metric
callouts) — tagged `data-ai` for compliance styling.

### 9 · WhatsApp
`MessageInput` (auto-grow composer + busy dots), `MessageThread`
(bubbles/date separators/delivery status), `ChatList` (search + unread),
plus the `message-model` (`Message`, `Conversation`, `useConversationMessages`).

### 10 · Mobile
`BottomSheet` (snap points), `PullToRefresh`, `Swipeable` (axes/threshold),
`SafeArea` (notch/foldable insets).

## Quick start

```tsx
import { Form, FormField, validators, Button, ToastProvider, useToast } from '@wco/ui';

function MyComponent() {
  const toast = useToast();
  return (
    <Form initialValues={{ email: '' }} rules={{ email: [validators.required(), validators.email()] }}
      onSubmit={(v) => toast(`Signed up ${v.email}`)}>
      {({ form }) => (
        <>
          <FormField name="email" label="Email">
            {({ value, setValue, field, error }) => (
              <input {...field} type="email" value={String(value)} onChange={(e) => setValue(e.target.value)} aria-invalid={!!error} />
            )}
          </FormField>
          <Button variant="primary" onClick={() => form.handleSubmit()}>Submit</Button>
        </>
      )}
    </Form>
  );
}
```

## Theming & dark mode

Components never hard-code color; they emit the theme chain. To use the library
without the WCO theme stylesheet, set the `--fallback-*` custom properties on
`:root` (see `FALLBACK_VARS` in `src/components.tsx`) or simply rely on the
light-token hex fallback baked into each `sem()` call.

## Accessibility notes

- `Modal`/`Drawer`/`BottomSheet` trap focus, lock scroll, close on Escape, and
  label themselves via `aria-labelledby`.
- `Tabs`/`RatingInput`/`ChatList` follow ARIA authoring (roving tabindex,
  `radio`, `listbox`).
- `ToastProvider` uses a `role=region aria-live=polite` viewport; danger toast
  uses `role=alert`.
- `SkipLink` gives keyboard users a first-element escape hatch into the main
  content.

## Verification

```bash
# from repo root
npx tsc -p packages/ui/tsconfig.json --noEmit
npx vitest run --root packages/ui
```

## Roadmap (not yet shipped)

- Storybook catalogue (`packages/ui/stories` is empty) — wire a CSF story per
  category to enable visual regression + interactive docs.
- Full i18n message catalog + locale provider (the formatting layer already
  supports 50+ locales).
- Motion via Framer Motion (currently dependency-free CSS keyframes/SVG).

See also `docs/design-system/implementation.md` for how the primitives consume
tokens, and `docs/design-system/governance.md` for adding new components.
