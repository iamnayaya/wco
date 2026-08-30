# Git Workflow

## Strategy: trunk-based with short-lived branches

We use **trunk-based development** with feature flags — *not* long-lived GitFlow. This enables continuous deployment, smaller merge conflicts, and faster feedback loops. A `develop` branch exists only as a stabilization point for release trains when needed.

```mermaid
gitGraph
    commit id: "main"
    branch feat/JIRA-123-ai-responder
    commit id: "wip"
    commit id: "tests"
    commit id: "review fixes"
    checkout main
    merge feat/JIRA-123-ai-responder id: "squash merge" tag: "deployed behind flag"
    commit id: "..."
    branch hotfix/payment-webhook-timeout
    commit id: "fix"
    checkout main
    merge hotfix tag: "hotfix v1.2.1"
```

## Rules

| Rule | Value |
|---|---|
| Branch lifetime | ≤2 days ideal, hard limit 3 days |
| PR size | <400 lines changed (excluding generated/lockfiles) |
| Commits on branch | Any style; squash-merged to main |
| Merge method | Squash only; merge commits forbidden |
| Direct pushes to main | Forbidden (even admins, except revert bots) |
| Feature flags | Every incomplete feature ships dark via flags in `@wco/config/flags` |

## Branch naming

```
feat/JIRA-123-short-desc     → new features
fix/JIRA-456-short-desc      → bug fixes
chore/desc                   → maintenance (no ticket needed for trivial)
spike/desc                   → time-boxed experiments (never merged to prod paths)
release/vX.Y.Z               → release stabilization (rare)
```

## Recommended daily flow

```bash
# Start from an up-to-date main
git checkout main && git pull origin main
git checkout -b feat/JIRA-123-short-desc

# ... commit frequently (any style on the branch) ...
git add -A
git commit -m "feat(orders): add status filter to list endpoint"

# Keep branch in sync (rebase, not merge)
git fetch origin main && git rebase origin/main

# Push and open PR
git push -u origin feat/JIRA-123-short-desc
```

## Commit conventions (conventional commits)

Format:
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

| Type | Usage |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons |
| `refactor` | Code change, no feature/fix |
| `perf` | Performance improvement |
| `test` | Adding/fixing tests |
| `chore` | Maintenance, deps, build config |
| `ci` | CI/CD changes |
| `security` | Security improvements |

```bash
feat(auth): add JWT refresh token rotation
fix(payments): handle Flutterwave webhook timeout
feat(api)!: change order response structure              # breaking change
feat(analytics): add real-time dashboard                 # with body/context
```

Commit messages are validated by **Husky + commitlint** on commit. Breaking changes use `!` and must be documented in the changelog.

## Branch protection & approval

| Branch | Protection |
|---|---|
| `main` | 2 approvals, all CI checks, linear history |
| `develop` | 1 approval, all CI checks |
| `release/*` | 1 approval, all CI checks |

## Code review SLA summary

| Priority | First response | Completion |
|---|---|---|
| Hotfix to prod | 15 min | Same day |
| Blocking another team | 4h | 1 day |
| Normal | Next business day | 2 days |

Full process → [Code review process](./07-code-review-process.md).

Next: [Code review process](./07-code-review-process.md).
