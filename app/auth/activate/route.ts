import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { adminClient } from '@/lib/supabase/admin';
import { appOrigin, cookieOptions } from '@/lib/auth/config';
import { tokenHash, validActivationToken } from '@/lib/auth/crypto';
import { ACTIVATION_COOKIE } from '@/lib/auth/policy';
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('token') || '';
  const jar = await cookies();
  let valid = false;
  if (validActivationToken(raw)) {
    const { data, error } = await adminClient().rpc('auth_inspect_activation', { p_hash: tokenHash(raw) });
    if (!error && data) {
      const remaining = Math.max(1, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000));
      jar.set(ACTIVATION_COOKIE, raw, cookieOptions(Math.min(1800, remaining))); valid = true;
    }
  }
  if (!valid) jar.delete(ACTIVATION_COOKIE);
  const response = NextResponse.redirect(`${appOrigin()}${valid ? '/activation-confirmed' : '/activate?error=link'}`, 303);
  response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
