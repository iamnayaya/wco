# How to Resolve Issues

The structured resolution workflow for support tickets, from confirmation to closure. This is the "make it right" part after diagnosis.

## Resolution workflow

1. **Confirm the diagnosis** — reproduce or validate with the user.
2. **Choose the resolution type:**
   - **Guide** — walk the user through the fix in their account.
   - **Control fix** — update store config on their behalf (with permission).
   - **Bug report** — if it's a product defect, log it via [QA defect process](../qa/process.md).
   - **Escalate** — if it needs ops, security, or engineering ([Escalation](./04-escalation.md)).
3. **Apply & verify** the resolution with the user.
4. **Document** the resolution for reuse.
5. **Close** the ticket with a clear summary.

## Common resolution steps (step-by-step)

### Reset password
1. Guide: login screen → **Forgot password** → enter email/phone.
2. User follows the reset link/SMS within the expiry window.
3. Set a new password (min 8 chars, mix of cases/digits).
4. If the reset link expired, generate a new one.

### Re-enable WhatsApp / AI
1. **Settings → WhatsApp** → confirm the number is connected (re-scan QR if not).
2. **Settings → AI** → enable auto-reply + handoff.
3. Have the user send a test message to their own number to confirm the AI replies.

### Regenerate a payment link
1. Open the order → **Send payment link** (or in chat, 💰).
2. Verify the link is active and the amount is correct.
3. Share with the customer; confirm payment reflects (webhook).

### Fix a stale AI price
1. **Products** → open product → correct price/stock → **Save**.
2. Confirm the AI now answers with the corrected value (test message).

### Resolve delivery config
1. **Settings → Delivery** → confirm provider connected + rates/areas correct.
2. Test a quote on staging or a dummy order.

### Handle a duplicate/locked account
- Note: account "locked" after failed attempts self-resolves or via password reset.
- For suspected fraud/compromise → escalate (security), don't self-resolve.

## Verification checklist (before closing)

- [ ] User confirms the original problem is resolved.
- [ ] The exact scenario they reported now works.
- [ ] No data was lost or improperly modified.
- [ ] Resolution is documented (added to common issues / known issues if recurring).
- [ ] If a bug was found, a QA ticket exists with the `requestId`/reproduction.

## When NOT to self-resolve
- **Payment/refund disputes over money** → involve payments ops; never manually alter financial state.
- **Customer data requests (DSR)** → route to DPO/compliance ([Compliance playbook](../playbooks/07-compliance-playbook.md)).
- **Suspected security/fraud** → security immediately.
- **Data loss or corruption** → data owner + [Backup runbook](../runbooks/04-backup-recovery-runbook.md).

## Escalation handoff
When handing off, include: the resolution attempted, verification status, and what remains — see [Escalation](./04-escalation.md).
