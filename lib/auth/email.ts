import 'server-only';
import { required } from './config';
export type AuthEmail = { to: string; name: string; url: string; kind: 'activation' | 'recovery'; expires: string };
export async function sendAuthEmail(mail: AuthEmail) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: required('EMAILJS_SERVICE_ID'), template_id: required('EMAILJS_TEMPLATE_ID'),
      user_id: required('EMAILJS_PUBLIC_KEY'), accessToken: required('EMAILJS_PRIVATE_KEY'),
      template_params: {
        to_email: mail.to, to_name: mail.name, app_name: 'WorkSync',
        email_subject: mail.kind === 'activation' ? 'Activate your WorkSync account' : 'Reset your WorkSync password',
        action_label: mail.kind === 'activation' ? 'Activate account' : 'Reset password',
        action_url: mail.url, activation_link: mail.kind === 'activation' ? mail.url : '',
        reset_link: mail.kind === 'recovery' ? mail.url : '', expires_at: mail.expires,
        message: mail.kind === 'activation' ? 'Verify your email and choose your WorkSync credentials.' : 'Use this single-use link to reset your WorkSync password. If you did not request it, ignore this email.',
      },
    }),
  });
  // Vendor response bodies can contain identifiers. Never log them or tokens.
  if (!response.ok) throw new Error('Email provider rejected request');
}
