import nodemailer from 'nodemailer';
import { env } from './env.js';

const transportOptions: any = {
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
};

if (env.SMTP_USER && env.SMTP_PASS) {
  transportOptions.auth = {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  };
}

export const transporter = nodemailer.createTransport(transportOptions);

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({
  to,
  subject,
  html,
}: SendMailInput): Promise<void> {
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
