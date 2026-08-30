# Visual regression

Checks that key authenticated routes render pixel-for-pixel the same between
releases. Powered by Playwright screenshots + `pixelmatch` (no Storybook
required).

## Structure

```
current/     screenshots captured on the last run (git-ignored)
baselines/   approved reference images (committed)
diffs/       pixel diff images for failing routes (git-ignored)
```

## Workflow

1. Add/replace a route in `scripts/visual-regression.mjs`.
2. Generate a baseline:
   ```sh
   npm run test:visual:update
   ```
3. Review the new baseline in `baselines/` and commit it with the change.
4. Every PR runs `npm run test:visual`; a route is considered failed when more
   than `MAX_DIFF_RATIO` (default 1%) of its pixels drift.

Intentional redesigns re-run `test:visual:update` and commit the refreshed
baseline together with the UI change — never in a separate commit.

## CI

See `.github/workflows/qa.yml` → `e2e` job (visual is bundled with the
Playwright browser step). Baselines must exist in git for the gate to pass; the
pipeline uploads failures as artifacts for triage.