# Common Issues

The recurring issues support teams see and their quick resolutions. Each links to the relevant guide for detail.

## 1. Login / account issues

| Issue | Likely cause | Quick fix |
|---|---|---|
| "Wrong password" | Typo / forgotten | Use **Forgot password** (email/SMS reset) |
| Reset email not arriving | Spam / wrong email | Check spam; confirm email; retry after a couple of minutes |
| Account locked | Many failed attempts | Wait + reset via **Forgot password** |
| 2FA code rejected | Clock skew / wrong code / reused code | Regenerate; sync device clock; use recovery codes |
| Can't log in on mobile | Outdated app / connectivity | Update app; check internet |

## 2. WhatsApp / messaging issues

| Issue | Likely cause | Quick fix |
|---|---|---|
| AI not replying | WhatsApp not connected OR AI disabled | Check Settings → WhatsApp (connected?) + Settings → AI (enabled?) |
| Number won't connect | QR expired / Meta restrictions | Re-scan; ensure valid business number |
| No messages showing | Number not set as business number | Verify the WhatsApp connection in Settings |
| AI gives wrong price | Stale catalog | Update product in Products (AI uses current data) |
| Customer not getting replies | Handoff to human not completed | Take over conversation; confirm the thread is assigned |

## 3. Payment issues

| Issue | Likely cause | Quick fix |
|---|---|---|
| Customer payment not reflecting | Provider webhook delay / provider not connected | Check order status; verify provider in Settings → Payments; confirm with customer |
| Payment link "inactive" | Link expired or used | Generate a new link |
| Refund stuck | Provider processing time | Check provider dashboard; wait per provider SLA |
| Can't add payout account | Details invalid at provider | Verify bank details at provider |

> **Payment/data concerns → escalate** (see [Escalation](./04-escalation.md)) — never guess.

## 4. Delivery issues

| Issue | Likely cause | Quick fix |
|---|---|---|
| No delivery provider | None connected | Connect GIG/Kwik/Sendy in Settings → Delivery |
| Quote hanging | Provider latency | Retry or switch provider |
| Wrong delivery fee | Rate/zone misconfig | Review delivery rates in Settings |
| Tracking not updating | Provider delay | Check provider; share link; reassure customer |

## 5. Product / order issues

| Issue | Likely cause | Quick fix |
|---|---|---|
| Product not visible to customers | Inactive or 0 stock | Activate + set stock |
| Order stuck in Draft | Not confirmed | Confirm the order |
| Duplicate order | Double submit | Verify + cancel the duplicate (keeps audit trail) |
| Import failed | CSV format | Check required columns; fix and retry |

## 6. Billing / plan issues

| Issue | Likely cause | Quick fix |
|---|---|---|
| Charged unexpectedly | Upgrade/renewal | Check subscription history; guide to Settings → Billing |
| Downgrade not applied | Billing period | Wait for period end; confirm cancellation |
| Invoice needed | — | Provide invoice from Settings → Billing |

## 7. Performance / app issues

| Issue | Likely cause | Quick fix |
|---|---|---|
| Dashboard slow | Large store / network | Check status page; retry; clear cache |
| App crashes | Outdated build | Update app; reinstall; report version |
| Push notifications off | Device/permission settings | Enable notifications in OS + app settings |

## When it's NOT a single-user issue
If **multiple users** report the same problem at once → check the [status page](https://status.wco.com) and, if it's an outage, follow the [Incident response runbook](../runbooks/03-incident-response-runbook.md) rather than handling tickets one by one.
