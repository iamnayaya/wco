# WhatsApp Commerce OS — Documentation

> **The single source of truth for developers, users, API consumers, operations, support, compliance, and security teams.** Built to the standards of a billion-dollar company and designed to serve 1M+ users and 100+ developers.

[![Docs](https://img.shields.io/badge/docs-docusaurus-3D7DFF)](#) · [![Spec](https://img.shields.io/badge/spec-OpenAPI%203.1-success)](#) · [![License](https://img.shields.io/badge/license-Proprietary-blue)](../LICENSE)

---

## 📚 Documentation Map

WCO documentation is organized into **audience-first** sections so every team lands where they need to be. The canonical API and database references live alongside these guides.

| Section | Audience | Contents |
|---|---|---|
| [**Developer**](./developer/) | Engineers & contributors | Architecture, tech stack, setup, style guide, git workflow, code review, testing, deployment, monitoring, troubleshooting, contributing, changelog |
| [**User**](./user/) | Merchants & end users | Getting started, quick start, feature guides (dashboard, products, orders, customers, messages, payments, deliveries, analytics, settings), mobile app, FAQ, tips |
| [**API**](../docs/api/README.md) | API consumers & integrators | Auth, rate limits, errors, versioning, full endpoint reference, SDKs, Postman, OpenAPI, webhooks |
| [**Runbooks**](./runbooks/) | Operations / SRE | Deployment, monitoring, incident response, backup & recovery, scaling, maintenance, security, database, cache, queue |
| [**Playbooks**](./playbooks/) | Operations / SRE | Incident management, on-call, post-mortems, capacity planning, disaster recovery, security incidents, compliance |
| [**Troubleshooting**](./troubleshooting/) | Support & on-call | Common issues, diagnosis, resolution, escalation, known issues |
| [**Compliance**](./compliance/) | Compliance / Legal | GDPR, NDPR, PCI DSS, data residency, retention, audit trail, certifications |
| [**Security**](./security/) | Security teams | Architecture, authn/authz, encryption, network, vulnerability mgmt, monitoring, incident response, certifications |
| [**Onboarding**](./onboarding/) | New team members | Welcome, first week, environment setup, review, testing, deployment, team processes, resources |
| [**Knowledge Base**](./knowledge-base/) | Everyone | Architecture decisions (ADR), deep dives, best practices, lessons learned, how-tos, FAQs |
| [**Platform & Style**](./platform-style/) | Doc owners | Platform setup, style guide, maintenance, localization, versioning, analytics, feedback |

> **Canonical references (existing, authoritative):**
> - OpenAPI 3.1 specification: [`docs/api/openapi.yaml`](./api/openapi.yaml)
> - Architecture Decision Records: [`docs/adr/`](./adr/)
> - Database design & reference: [`docs/database/README.md`](../docs/database/README.md)

---

## 🧭 Where should I start?

- **I'm an engineer joining the team** → [Onboarding: Welcome & first week](./onboarding/README.md) then [Developer: Introduction](./developer/01-introduction.md)
- **I'm a merchant using WCO** → [User: Getting Started](./user/01-getting-started.md) then [Quick Start](./user/02-quick-start.md)
- **I'm integrating with the API** → [API: Introduction](../docs/api/README.md) and the [API quickstart](../docs/api/README.md#quickstart)
- **I'm on-call or responding to an incident** → [Playbooks: On-call](./playbooks/02-on-call-playbook.md) then [Incident Management](./playbooks/01-incident-management-playbook.md)
- **I'm investigating a known problem** → [Troubleshooting: Common issues](./troubleshooting/01-common-issues.md)

---

## 🚀 Quick navigation links

| Need | Go to |
|---|---|
| Run the whole stack locally | [Developer: Development setup](./developer/04-development-environment-setup.md) |
| Deploy to production | [Runbooks: Deployment](./runbooks/01-deployment-runbook.md) |
| Understand system architecture | [Developer: Architecture overview](./developer/02-architecture-overview.md) |
| Check API rate limits | [API: Rate limiting](../docs/api/design-guidelines.md#12-rate-limit-tiers) |
| Review compliance posture | [Compliance: Overview](./compliance/01-gdpr.md) |
| Report a security issue | [Security: Overview](./security/01-security-overview.md) and [`SECURITY.md`](../SECURITY.md) |

---

## ✍️ Contributing to documentation

Documentation is a first-class product at WCO. Before editing, read:

1. [Platform & Style: Style guide](./platform-style/02-style-guide.md) — tone, formatting, diagrams, links
2. [Platform & Style: Maintenance](./platform-style/03-maintenance.md) — review schedule, update/deprecation process
3. [Platform & Style: Localization](./platform-style/04-localization.md) — LangStack (EN/HA/YO/IG)

Every docs PR follows the normal [development workflow](../docs/guides/development-workflow.md). The docs build is linted, checked for broken internal links, and gated by CI.

---

## 🗂 Repository-level documentation

| Path | Purpose |
|---|---|
| [`../README.md`](../README.md) | Top-level product README (overview, quick start, tech stack) |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Contribution standards, PR process, code style |
| [`../SECURITY.md`](../SECURITY.md) | Security policy & vulnerability reporting |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Product changelog (generated from conventional commits) |
