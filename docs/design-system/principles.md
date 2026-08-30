# Design Principles

Ten radical rules that govern **every** decision in WCO. Each is *actionable* (what to do), *measurable* (how to know you succeeded), and *mapped to WCO* (the concrete payoff). The enforceable subset lives in [`animation.ts`](../../packages/ui/src/design-tokens/animation.ts)`principles` and [`accessibility.ts`](../../packages/ui/src/design-tokens/accessibility.ts)`checklist`.

---

## 1. Radical simplicity — "magic, not machinery"

**Action.** Every screen answers one question; cut anything that answers a different one. Strip chrome, merge steps, make the path obvious.

**Measure.** < 3 options per primary action; a core task completes in ≤ 3 taps / ≤ 15 seconds.

**WCO.** A trader rings up a sale in 2 taps — not a "point-of-sale flow".

---

## 2. Invisible intelligence — anticipate before they ask

**Action.** AI surfaces the *next* decision proactively: restock alert before a stockout, a reply draft before the customer replies, a payout forecast before payday.

**Measure.** ≥ 2 proactive suggestions delivered per session that users accept.

**WCO.** "10 of these sold this week — reorder?" appears before the trader wonders why the shelf is empty.

---

## 3. Emotional connection — design people fall in love with

**Action.** Celebrate wins (first sale, first payout, milestone) with crafted micro-moments. Speak warmly, never coldly.

**Measure.** Positive sentiment, rising NPS, users sharing screenshots unprompted.

**WCO.** A soft confetti pop on the first successful payout — then calm.

---

## 4. Cultural intelligence — speak the language of our markets

**Action.** Local color, idiom, payments, delivery, and consent defaults for NG / GH / KE / ZA. Never a one-size-fits-all Western default.

**Measure.** Regional task-completion parity across markets.

**WCO.** Sun/Ember/Clay palette; Paystack vs Flutterwave vs OPay surfaced by region; consent toggles default to the legally safest local posture.

---

## 5. Accessibility first — WCAG AAA, not AA

**Action.** Every text/surface pair hits AAA (≥ 7:1); every interaction is keyboard + screen-reader complete; touch targets ≥ 44px.

**Measure.** Automated + manual a11y gates green on every PR (see [`accessibility.md`](./accessibility.md)).

**WCO.** Merchants on shared 3G, in direct sunlight, with "Large" phone text, get the same experience as anyone else.

---

## 6. Performance obsession — instant is a feature

**Action.** 60fps motion, < 100ms tap response, < 1s page loads on 3G, first-paint CSS < 14KB.

**Measure.** Core Web Vitals + interaction-latency budgets in CI.

**WCO.** Low-end Android, shared hotspot, busy market — still fast.

---

## 7. Dark mode perfection — a redesign, not an inversion

**Action.** Dark surfaces are cool slate; primary lifts; shadows give way to surface-tone contrast; borders soften.

**Measure.** Every component passes contrast in both themes; no "glowing black".

**WCO.** The dashboard stays readable at a night stall under a phone light.

---

## 8. Micro-interactions — everything feels considered

**Action.** Hover, focus, press, success, error each have a crafted, fast motion (< 200ms). Nothing feels inert.

**Measure.** Motion budgets enshrined in [`animation.ts`](../../packages/ui/src/design-tokens/animation.ts); reduced-motion honored.

**WCO.** Every button press has affordance and feedback.

---

## 9. Voice-ready — "Hey WCO" works

**Action.** The flows a trader does most (post a product, check sales, reorder) are expressible by voice.

**Measure.** Voice path covers the top-5 flows (see voice patterns in [implementation](./implementation.md)).

**WCO.** Hands-free while packing orders or checking the till.

---

## 10. Future-proof geometry — AR/VR ready

**Action.** Spacing/type are fluid and independent of fixed pixel assumptions; content scales to any viewport class.

**Measure.** The same token set renders on a phone and a spatial display.

**WCO.** The catalogue you see in WhatsApp lifts into a 3D shelf on a spatial device later.

---

## Usage recipe

1. Start every screen with principles 1 ("one question") and 2 ("what's next?").
2. Compose with the tokens from layers 2–8 (never ad-hoc values).
3. Verify immutable gates: principles 5, 6, 7, 8 before you ship.
4. Add a micro-moment or voice path where principle 3 / 9 fit naturally.
