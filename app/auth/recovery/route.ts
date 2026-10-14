import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { appOrigin, cookieOptions } from '@/lib/auth/config';
import { RECOVERY_TOKEN_COOKIE, RECOVERY_PROOF_COOKIE } from '@/lib/auth/policy';
export async function GET(request: Request) {
  const hash = new URL(request.url).searchParams.get('token_hash') || '';
  const jar = await cookies();
  const valid = /^[a-f0-9]{64}$/.test(hash);
  jar.delete(RECOVERY_PROOF_COOKIE);
  if (valid) jar.set(RECOVERY_TOKEN_COOKIE, hash, cookieOptions(1800)); else jar.delete(RECOVERY_TOKEN_COOKIE);
  // GET never consumes the Supabase OTP. Email scanners cannot burn recovery links.
  const response = NextResponse.redirect(`${appOrigin()}${valid ? '/reset-password' : '/forgot-password?error=link'}`, 303);
  response.headers.set('Cache-Control', 'private, no-store'); response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
