# Docs Platform — Localization

How WCO documentation is translated and localized for our markets (Nigeria, Ghana, Kenya, and beyond).

## 1. Why localization

Our merchants primarily use WhatsApp, and English is our product's initial language. But we operate across markets where **Swahili, Hausa, Yoruba, Igbo, Pidgin, and French** are common. We localize **user-facing documentation first**, then API/developer docs as the developer community grows.

## 2. Localization approach

### Content priority
1. **User docs** (`docs/user/**`): Getting started, quick start, feature guides, FAQ, troubleshooting.
2. **Marketing/support content**: tips-and-tricks, security/compliance summaries for merchants.
3. **Developer/API**: English-only initially (developer audience); localize later on demand.

### Language plan (phased)

| Phase | Languages | Scope |
|---|---|---|
| 1 (now) | English (base) | All docs |
| 2 | Swahili, Pidgin | User docs (getting started, quick start, core guides) |
| 3 | Hausa, Yoruba, Igbo, French | User docs as demand grows |
| 4 | Developer/API | On developer-community request |

## 3. Tooling & workflow

- **Docusaurus i18n** ([setup](./01-platform-setup.md)) drives the localized site at `/sw`, `/pid`, `/fr`, etc.
- **Translation memory + glossary (TMS):** managed glossary keeps product terms consistent across languages (e.g., "order", "delivery", "payment").
- **Workflow:** English is the source of truth → translate → review by a **native-speaking reviewer** → publish.
- **Never machine-translate without human review** for legal/compliance or security pages (GDPR/NDPR/PCI).

## 4. What localization includes (not just translation)

- **Currency & numbers:** ₦, ₵, KSh, dates, units localized (money handled per market).
- **Legal/compliance** per country (NDPR, GDPR, PCI).
- **Cultural & UX specifics** (WhatsApp idioms, payment methods popular locally).
- **Support/contact** localized.

## 5. Quality & maintenance

- Reviewers flag mistranslations; glossary is updated and versioned.
- Link rules apply per language — translated pages must have working internal links within that language.
- Localized pages inherit the same maintenance cadence as English ([Maintenance](./03-maintenance.md)).

## 6. Who does it

- **Docs lead** owns the roadmap and quality bar.
- **Squads** provide developer-accurate source text.
- **Localization vendor/community** + **native reviewers** do translation + QA.
- Contributors can submit translations via PR (`docs/user/**` → `i18n/<locale>/`).

## 7. Related
- [Platform setup](./01-platform-setup.md) · [Maintenance](./03-maintenance.md) · [Style guide](./02-style-guide.md)
