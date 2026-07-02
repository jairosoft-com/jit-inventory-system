import nodemailer from 'nodemailer';
import { env } from './env.js';

// MailDev is a local dev SMTP catcher — no auth, no TLS.
// SMTP_HOST/SMTP_PORT route everything here in development so no real
// emails are ever sent outside of production.
export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
});

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: SendMailInput): Promise<void> {
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(
      `[Mailer] Failed to send email to ${to}:`,
      err instanceof Error ? err.message : err,
    );
  }
}