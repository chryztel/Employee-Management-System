import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookieOptions, required } from './lib/auth/config';

// Refresh only here; authorization is enforced again by the page/API guard.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  const client = createServerClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    cookieOptions: cookieOptions(60 * 60 * 24 * 30),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        response.headers.set('Cache-Control', 'private, no-store');
        response.headers.set('Referrer-Policy', 'no-referrer');
        for (const { name, value, options } of values) response.cookies.set(name, value, { ...options, httpOnly: true, secure: cookieOptions().secure, sameSite: 'lax' });
      },
    },
  });
  await client.auth.getClaims();
  return response;
}
export const config = { matcher: ['/employee/:path*', '/manager/:path*', '/login', '/activate', '/credentials-updated', '/forgot-password', '/update-credentials', '/reset-password', '/api/auth/:path*'] };
