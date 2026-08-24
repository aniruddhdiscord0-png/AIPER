const axios = require('axios');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Send a bug report notification email to the dev team.
 * @param {Object} report - The saved BugReport document.
 * @param {Object} reporter - The populated user who filed the report.
 */
async function sendBugReportEmail(report, reporter) {
  const severityColors = {
    CRITICAL: '#e74c3c',
    HIGH: '#e67e22',
    MEDIUM: '#f39c12',
    LOW: '#95a5a6'
  };

  const isBug = report.type === 'BUG';
  const sevColor = severityColors[report.severity] || '#95a5a6';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: ${isBug ? '#dc2626' : '#f59e0b'}; padding: 24px 32px;">
        <h1 style="margin: 0; color: white; font-size: 20px;">
          ${isBug ? 'New Bug Report' : 'Feature Request'}
        </h1>
      </div>
      <div style="padding: 32px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 140px;">Reporter</td>
            <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${reporter?.name || 'Unknown'} (${reporter?.role || 'N/A'})</td>
          </tr>
          ${reporter?.department ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Department</td>
            <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${reporter.department}</td>
          </tr>` : ''}
          ${isBug ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Severity</td>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; color: white; background: ${sevColor};">
                ${report.severity}
              </span>
            </td>
          </tr>` : ''}
          ${report.pageOrFeature ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Related Page</td>
            <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${report.pageOrFeature}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submitted</td>
            <td style="padding: 8px 0; font-size: 14px;">${new Date(report.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
          </tr>
        </table>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Description</h3>
          <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #1f2937; white-space: pre-wrap;">${report.description}</p>
        </div>

        <p style="font-size: 12px; color: #9ca3af; margin: 0; text-align: center;">
          Acropolis Food Testing Lab — Automated Report Notification
        </p>
      </div>
    </div>
  `;

  try {
    await axios.post(BREVO_API_URL, {
      sender: { name: 'AIPER Bug Tracker', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: 'support.urbancloud@gmail.com', name: 'Dev Team' }],
      subject: `[${report.type === 'BUG' ? 'BUG' : 'FEATURE'}] ${isBug ? `[${report.severity}]` : ''} ${report.description.substring(0, 60)}...`,
      htmlContent
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'accept': 'application/json'
      }
    });
    console.log('Bug report email sent successfully.');
  } catch (err) {
    console.error('Failed to send bug report email:', err.response?.data || err.message);
  }
}

/**
 * Send an OTP code to a user's email for login.
 * @param {string} recipientEmail
 * @param {string} recipientName
 * @param {string} otpCode - 6-digit OTP string.
 */
async function sendOtpEmail(recipientEmail, recipientName, otpCode) {
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px; text-align: center;">
        <h1 style="margin: 0; color: white; font-size: 22px;">Login Verification</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">Acropolis Food Testing Lab</p>
      </div>
      <div style="padding: 32px; text-align: center;">
        <p style="font-size: 15px; color: #374151; margin: 0 0 8px;">Hello <strong>${recipientName}</strong>,</p>
        <p style="font-size: 14px; color: #6b7280; margin: 0 0 28px;">Use this one-time password to log in:</p>

        <div style="display: inline-block; background: #f0f4ff; border: 2px dashed #2563eb; border-radius: 12px; padding: 16px 40px; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #1e40af; font-family: 'Courier New', monospace;">${otpCode}</span>
        </div>

        <p style="font-size: 13px; color: #ef4444; font-weight: 600; margin: 0 0 8px;">This code expires in 5 minutes.</p>
        <p style="font-size: 13px; color: #9ca3af; margin: 0;">If you did not request this, please ignore this email.</p>
      </div>
    </div>
  `;

  try {
    await axios.post(BREVO_API_URL, {
      sender: { name: 'AIPER Login', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: recipientEmail, name: recipientName }],
      subject: `${otpCode} — Your AIPER Login OTP`,
      htmlContent
    }, {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        'accept': 'application/json'
      }
    });
    console.log(`OTP email sent to ${recipientEmail}`);
  } catch (err) {
    console.error('Failed to send OTP email:', err.response?.data || err.message);
    throw new Error('Failed to send OTP email');
  }
}

module.exports = { sendBugReportEmail, sendOtpEmail };
