import nodemailer from 'nodemailer';
import { env } from '../config/env.config';

// Configure nodemailer transporter
const createTransporter = () => {
  if (env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: env.SMTP_PORT || 465,
      secure: (env.SMTP_PORT || 465) === 465,
      auth: {
        user: env.SMTP_USER || 'oseghaleleonard39@gmail.com',
        pass: env.SMTP_PASS,
      },
    });
  }

  // Graceful development transporter (logs message info without throwing if SMTP password is unset)
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows',
    buffer: true,
  });
};

const transporter = createTransporter();

/**
 * Sends a co-funder project invitation email
 */
export const sendCoFunderInviteEmail = async (
  toEmail: string,
  token: string,
  inviterName: string,
  projectName?: string
): Promise<void> => {
  const joinUrl = `${env.APP_URL}/join?token=${token}`;
  const subject = `${inviterName} invited you to co-fund a project on Bankole`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { font-size: 24px; font-weight: 700; color: #0284c7; margin-bottom: 24px; }
    .heading { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
    .body-text { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { background-color: #0284c7; color: #ffffff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; }
    .footer { font-size: 13px; color: #64748b; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Bankole</div>
    <div class="heading">You've been invited to co-fund a project</div>
    <p class="body-text">
      Hello,<br><br>
      <strong>${inviterName}</strong> has invited you to collaborate and co-fund ${projectName ? `<strong>${projectName}</strong>` : 'a construction project'} on Bankole.
    </p>
    <div class="btn-container">
      <a href="${joinUrl}" class="btn" target="_blank">Accept Invitation</a>
    </div>
    <p class="body-text">
      Bankole ensures your funds are protected in milestone-governed escrow until verified proof of work is approved.
    </p>
    <div class="footer">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${joinUrl}" style="color: #0284c7;">${joinUrl}</a>
    </div>
  </div>
</body>
</html>
  `;

  try {
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: toEmail,
      subject,
      html: htmlContent,
    });

    console.log(`[Email Service] Co-funding invite sent to ${toEmail}. Message ID: ${info.messageId || 'DEV_STREAM'}`);
  } catch (error) {
    console.error(`[Email Service] Failed to send email to ${toEmail}:`, error);
    // Don't throw to prevent breaking API request if mail server is temporarily down
  }
};
