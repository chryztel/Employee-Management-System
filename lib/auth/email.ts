import 'server-only';
import { required } from './config';
// Activation mail carries temporary credentials; the first login must replace them.
export type AuthEmail = { to: string; name: string; url: string; kind: 'activation' | 'recovery'; expires: string; username?: string; password?: string };
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
// The whole body is rendered here, so the EmailJS template only needs {{{html_body}}}
// and copy changes never require editing the dashboard template.
export function authEmailHtml(mail: AuthEmail) {
  const e = escapeHtml; const activation = mail.kind === 'activation';
  const p = (text: string, style = '') => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#1f2937;${style}">${text}</p>`;
  const credentials = activation ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 20px;border:1px solid #dbe4f0;border-radius:8px;background:#f5f8fc">
    <tr><td style="padding:14px 18px 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#64748b">Temporary username</td></tr>
    <tr><td style="padding:0 18px 12px;font:600 16px/1.4 Consolas,Menlo,monospace;color:#0f172a">${e(mail.username || '')}</td></tr>
    <tr><td style="padding:6px 18px 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;border-top:1px solid #dbe4f0">Temporary password</td></tr>
    <tr><td style="padding:0 18px 14px;font:600 16px/1.4 Consolas,Menlo,monospace;color:#0f172a">${e(mail.password || '')}</td></tr>
  </table>` : '';
  const intro = activation
    ? p('Welcome to WorkSync! Your account is ready. Log in with the temporary credentials below.') + credentials
      + p('After logging in, you will be asked to create your own username and password before you can use WorkSync.')
    : p('Use the button below to reset your WorkSync password. This link can be used only once.')
      + (mail.expires ? p(e(mail.expires), 'color:#64748b') : '');
  const label = activation ? 'Log in to WorkSync' : 'Reset password';
  return `<div style="background:#ffffff;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:480px;margin:0 auto">
    <div style="text-align:center;font-size:26px;font-weight:700;color:#1d5fb4">WorkSync</div>
    <div style="text-align:center;margin:8px 0 28px;font-size:12px;letter-spacing:.12em;color:#64748b">EMPLOYMENT MANAGEMENT SYSTEM</div>
    <h1 style="margin:0 0 18px;font-size:22px;color:#14305c">${activation ? 'Your Account Is Ready' : 'Reset Your Password'}</h1>
    ${p(`Hello ${e(mail.name)},`)}
    ${intro}
    <div style="text-align:center;margin:24px 0">
      <a href="${e(mail.url)}" style="display:inline-block;padding:13px 28px;border-radius:6px;background:#1d5fb4;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">${label}</a>
    </div>
    ${p('If the button doesn’t work, copy this link into your browser:')}
    ${p(`<a href="${e(mail.url)}" style="color:#1d5fb4;word-break:break-all">${e(mail.url)}</a>`, 'font-size:12px')}
    <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">
    ${p(activation ? 'Keep these credentials private. If you didn’t request this activation, contact your administrator.' : 'If you didn’t request a password reset, you can safely ignore this email.', 'font-size:12px;color:#64748b')}
    ${p('WorkSync Team', 'font-size:12px;color:#64748b')}
  </div>
</div>`;
}
export async function sendAuthEmail(mail: AuthEmail) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: required('EMAILJS_SERVICE_ID'), template_id: required('EMAILJS_TEMPLATE_ID'),
      user_id: required('EMAILJS_PUBLIC_KEY'), accessToken: required('EMAILJS_PRIVATE_KEY'),
      template_params: {
        to_email: mail.to, to_name: mail.name, app_name: 'WorkSync',
        email_subject: mail.kind === 'activation' ? 'Your WorkSync login details' : 'Reset your WorkSync password',
        html_body: authEmailHtml(mail),
        action_label: mail.kind === 'activation' ? 'Log in to WorkSync' : 'Reset password',
        action_url: mail.url, login_url: mail.kind === 'activation' ? mail.url : '',
        reset_link: mail.kind === 'recovery' ? mail.url : '', expires_at: mail.expires,
        username: mail.username || '', temp_password: mail.password || '',
        message: mail.kind === 'activation' ? 'Your WorkSync account is active. Log in with the temporary username and password below, then create your own credentials.' : 'Use this single-use link to reset your WorkSync password. If you did not request it, ignore this email.',
      },
    }),
  });
  // Vendor response bodies can contain identifiers. Never log them or tokens.
  if (!response.ok) throw new Error('Email provider rejected request');
}
