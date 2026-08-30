# Docs Platform — Style Guide

The voice and formatting standards for all WCO documentation. If it doesn't match this guide, it needs editing before it's considered done.

## 1. Audience first

**Know who each doc is for.** Use the audience labels consistently:

| Audience | Files | Tone |
|---|---|---|
| **Users / merchants** | `docs/user/**` | Simple, encouraging, task-first, avoid jargon |
| **Developers** | `docs/developer/**`, `docs/api/**` | Precise, technical, code/data-first |
| **On-call / SRE** | `docs/runbooks/**` | Actionable, exact commands, no fluff |
| **Managers / owners** | `docs/playbooks/**`, `docs/compliance/**` | Judgment, ownership, escalation norms |
| **New hires** | `docs/onboarding/**` | Friendly, warm, sequential |
| **Everyone** | `docs/knowledge-base/**` | Concise, link-rich |

## 2. Voice & tone

- **Active voice:** "Run this command" not "this command should be run."
- **Present tense**, second person ("you").
- **Concise.** Say it in the fewest accurate words.
- **Direct, human.** Avoid marketingspeak, hype, and empty adjectives.
- **Positive and specific** over vague.

## 3. Formatting rules

- **Headings:** Sentence case ("How to reset your password", not "How To Reset"). Use `##` for top-level sections within a page (the title is the `#`).
- **Bold** for UI labels and key terms. *Italic* for emphasis (sparingly).
- **Code** for commands, filenames, endpoints, and inline code.
- **Tables** for comparisons, parameters, and structured info. Keep columns tight.
- **Lists:** use bullets for unordered, numbers for ordered steps (runbook steps must be numbered so operators follow the order).
- **Quotes/blockquotes** for caveats and safety notes.

### Notes and callouts
- `> ⚠️ Warning` — risk of data loss / outage / security. Use sparingly.
- `> ℹ️ Note` — helpful context, non-critical.
- `> ✅ Tip` — a shortcut that makes things easier.

## 4. Code & commands

- Show **copy-pasteable** command blocks. Include the working directory or workspace context if non-obvious (the docs are in a monorepo).
- **Don't** include `$` prompts in code blocks users must copy.
- Include outputs/examples when they help confirm success.
- Use Mermaid for diagrams; keep them legible and labeled ([platform setup](./01-platform-setup.md)).

## 5. Links & references

- **Prefer linking to canonical docs over duplicating** content. Docs-as-code means one source of truth.
- Use **relative links** (from the current file) so they work on GitHub and in the rendered site. Docusaurus resolves them automatically.
- When linking a section, point at the anchor where useful.
- **Never** link to internal secrets, private endpoints, or internal-only hosts in public docs.

## 6. Naming & casing of products

- The product is **WhatsApp Commerce OS**, commonly **WCO**. Use the full name on first mention, WCO after.
- Providers/APIs keep their own casing: Paystack, Flutterwave, OPay, WhatsApp, NestJS, Next.js, RabbitMQ, PostgreSQL (Postgres), Redis.

## 7. What NOT to include

- Secrets, keys, tokens, real customer data — **never**.
- Outdated code that contradicts the current architecture.
- Personal opinions or individual blame (documented learning only).
- Duplicated content that can be linked instead.

## 8. Structure of a good doc

1. **Title** (`#`) that says what the page is.
2. **Purpose line** — one sentence: what this doc does and for whom.
3. **Prerequisites / context** (if any).
4. **Body** — the actual content, focused.
5. **"Need help?" / related links** section.

## 9. Example — good vs not

**Good (§ for a runbook):**
```
## 3. Reroute traffic to failover
1. `helm upgrade wco --set failover=true`
2. Verify endpoints via `curl api.wco.africa/health`
3. Confirm mTLS + WAF still active
```

**Not good:**
```
Traffic rerouting:
You might want to reroute traffic to make use of the failover capacity that is available, which can be done by running the helm upgrade command with the failover.
```
(The good version is imperative, numbered, and copy-pasteable.)

## 10. Consistency tooling
- Run the link checker and lint before shipping docs ([Maintenance](./03-maintenance.md)).
- Use the common templates (runbook / playbook / README-index) so pages are familiar.

That's it — write like a human for a busy expert, stay accurate, and keep it short.
