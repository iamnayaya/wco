# User Guide: Security

A plain-language summary of how WCO keeps your business and customer data safe. The full, technical [Security documentation](../security/README.md) is for security teams and partners.

## How we protect your data

- **Encryption at rest** — your data is encrypted on our servers (AES-256).
- **Encryption in transit** — all traffic is secured with TLS (the padlock 🔒 in your browser).
- **Secure sign-in** — passwords are stored as strong hashes; we recommend you enable **two-factor authentication (2FA)**.
- **Least privilege** — if you invite staff, they only get the access their role needs.
- **PCI-DSS-compliant payments** — card/payment processing is handled by trusted providers (Paystack, Flutterwave, OPay); WCO never stores your full card details.
- **Tenant isolation** — your store's data is isolated from every other store's data, enforced at the database level.

## What you can do to stay safe

1. **Turn on 2FA** (Settings → Account). → [Settings guide](./guides/settings-guide.md)
2. **Use a strong, unique password** and change it if you suspect it's compromised.
3. **Don't share your password** — invite staff with their own logins and the right role.
4. **Review what staff can do** — give everyone the least access needed.
5. **Be careful with links** — WCO will never ask for your password by message/email.

## Your responsibilities (as a data controller)

As a merchant, you're the "controller" of your customers' data. WCO (the "processor") provides the tools, but you decide how you use customer data:

- Only use customer data to serve customers and run your business.
- Don't share customer data or use it for unrelated purposes.
- Respect opt-out requests (e.g., reply "STOP" to marketing).
- Allow customers to request access or deletion of their data.

## Reporting a vulnerability or concern

- If you believe you've found a security issue, report it via our coordinated disclosure process (see [`SECURITY.md`](../../SECURITY.md)) — we don't penalize good-faith reports.
- For urgent account concerns: **support@wco.com**.

## Learn more

- [Compliance overview (GDPR/NDPR) for merchants](../compliance/README.md)
- [Technical security overview](../security/README.md)
