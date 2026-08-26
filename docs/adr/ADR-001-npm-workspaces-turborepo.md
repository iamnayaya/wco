# ADR-001: npm workspaces + Turborepo over Nx and pnpm

- **Status:** Accepted
- **Date:** 2026-01
- **Deciders:** Platform team

## Context

We need a monorepo with 6 apps and 12+ packages, task caching, and CI fan-out. Candidates: npm/pnpm/yarn workspaces alone, Turborepo on top, Nx, Bazel.

## Decision

**npm workspaces + Turborepo.**

## Rationale

1. **Zero extra runtime deps for contributors.** pnpm's speed is real, but Windows-first contributors hit symlink/permission friction; npm ships with Node.
2. **Turborepo covers our actual need** — cached builds (`turbo build`), parallel dev, remote caching in CI — withoutNx's plugin ecosystem and generators we won't use.
3. **Escape hatch preserved:** workspace protocol means a later migration to pnpm is a lockfile change, not a code change.

## Consequences

+ Simplest possible contributor setup (`git clone && npm install && npm run dev`).
+ Remote cache cuts CI time ~70% as the repo grows.
− No content-addressable store dedup (pnpm) → larger node_modules; acceptable at our scale.
− Nx module boundaries/lint rules unavailable; enforce boundaries in review + eslint import rules instead.

## Alternatives considered

- **Nx**: powerful, but opinionated generators conflict with hand-rolled scaffolds; heavier learning curve for new hires.
- **Bazel**: correct answer at 100+ engineers; overkill now.
- **pnpm**: fastest installs; deferred due to Windows contributor base, revisit if CI install times hurt.
