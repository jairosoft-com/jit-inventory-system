import nodemailer from 'nodemailer';
import { env } from '../lib/env.js';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false, // false for 1025, true for 465, false for other ports
    tls: {
      rejectUnauthorized: false,
    },
  });

  /**
   * General purpose send mail helper
   */
  static async sendMail(options: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: recipients,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      console.log(`[EmailService] Email sent successfully to: ${recipients}`);
    } catch (error) {
      console.error(`[EmailService] Failed to send email to ${recipients}:`, error);
      // We don't want to throw error and block the caller process, just log it.
    }
  }

  /**
   * Specific helper to send maintenance reminder emails
   */
  static async sendMaintenanceReminder(options: {
    to: string[];
    equipmentName: string;
    assetId: string;
    description: string;
    scheduledDate: Date;
    technicianName: string;
  }): Promise<void> {
    const formattedDate = options.scheduledDate.toLocaleDateString(undefined, { timeZone: 'UTC' });
    const subject = `[Reminder] Scheduled Maintenance: ${options.equipmentName} (${options.assetId})`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #3182ce; margin-top: 0;">Maintenance Schedule Reminder</h2>
        <p>This is an automated reminder that a scheduled equipment maintenance is approaching.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-b: 1px solid #edf2f7; width: 40%;">Equipment Name:</td>
            <td style="padding: 8px 0; border-b: 1px solid #edf2f7;">${options.equipmentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-b: 1px solid #edf2f7;">Asset ID:</td>
            <td style="padding: 8px 0; border-b: 1px solid #edf2f7;"><code>${options.assetId}</code></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-b: 1px solid #edf2f7;">Maintenance Description:</td>
            <td style="padding: 8px 0; border-b: 1px solid #edf2f7;">${options.description}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-b: 1px solid #edf2f7;">Scheduled Date:</td>
            <td style="padding: 8px 0; border-b: 1px solid #edf2f7;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; border-b: 1px solid #edf2f7;">Assigned Technician:</td>
            <td style="padding: 8px 0; border-b: 1px solid #edf2f7;">${options.technicianName}</td>
          </tr>
        </table>
        
        <p style="margin-bottom: 0;">Please ensure that necessary preparations are made for the maintenance task.</p>
      </div>
    `;

    await this.sendMail({
      to: options.to,
      subject,
      html,
    });
  }
}
