import nodemailer, { type Transporter } from 'nodemailer';

import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Email service (SMTP — SendGrid/SES/Postmark all speak it).
 *
 * Called exclusively from the email BullMQ worker, never inline in request
 * paths: SMTP is slow and flaky, and a 5s send must not hold an HTTP socket.
 * Templates are tiny typed functions returning {subject, html} — no template
 * engine dependency; emails here are short transactional notices.
 */

export interface MailTemplate {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

export type TemplateName = 'welcome' | 'password-reset' | 'low-stock-alert' | 'order-receipt';

export function renderTemplate(name: string, data: Record<string, unknown>): MailTemplate {
  switch (name as TemplateName) {
    case 'password-reset':
      return {
        subject: 'Reset your WCO password',
        text: `Use this link to reset your password: ${appUrl()}/reset-password?token=${String(data.resetToken)}`,
        html: `<p>We received a request to reset your WCO password.</p>
               <p><a href="${appUrl()}/reset-password?token=${encodeURIComponent(String(data.resetToken))}">Choose a new password</a></p>
               <p>This link expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`,
      };
    case 'welcome':
      return {
        subject: 'Welcome to WCO 🎉',
        text: `Hi ${String(data.name ?? 'there')}, your WhatsApp commerce workspace is ready.`,
        html: `<h2>Welcome aboard, ${escapeHtml(String(data.name ?? 'there'))}!</h2>
               <p>Your workspace is ready. Add your first product to start selling on WhatsApp.</p>`,
      };
    case 'low-stock-alert':
      return {
        subject: `Low stock: ${String(data.productName)}`,
        text: `${String(data.productName)} is down to ${Number(data.stockQuantity)} units.`,
        html: `<p><strong>${escapeHtml(String(data.productName))}</strong> is down to ${Number(data.stockQuantity)} units.</p>
               <p>Restock soon so you don't miss sales.</p>`,
      };
    case 'order-receipt':
      return {
        subject: `Order ${String(data.orderNumber)} confirmed`,
        text: `Order ${String(data.orderNumber)} was paid. Total: ${String(data.amount)}.`,
        html: `<h3>Order confirmed</h3><p>${escapeHtml(String(data.orderNumber))} — total ${escapeHtml(String(data.amount))}.</p>`,
      };
    default:
      throw new Error(`Unknown email template: ${name}`);
  }
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } } : {}),
  });
  return transporter;
}

export async function sendEmail(to: string, templateName: string, data: Record<string, unknown>): Promise<void> {
  const mail = renderTemplate(templateName, data);
  await getTransporter().sendMail({
    from: `"WCO" <${env.SMTP_FROM}>`,
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  logger.info('email.sent', { to, template: templateName });
}

function appUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000';
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}
