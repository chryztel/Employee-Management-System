import 'server-only';
export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
export function appOrigin() {
  const url = new URL(required('NEXT_PUBLIC_APP_URL'));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid app URL');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('HTTPS is required outside localhost');
  return url.origin;
}
export function cookieOptions(seconds = 1800) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: new URL(appOrigin()).protocol === 'https:', path: '/', maxAge: seconds };
}
