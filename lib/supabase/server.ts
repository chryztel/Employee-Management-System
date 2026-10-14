import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { cookieOptions, required } from '../auth/config';
export async function serverClient(readOnly = false) {
  const jar = await cookies();
  return createServerClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    cookieOptions: cookieOptions(60 * 60 * 24 * 30),
    cookies: { getAll: () => jar.getAll(), setAll: values => {
      if (readOnly) return; // Proxy refreshes cookies before Server Components render.
      for (const { name, value, options } of values) jar.set(name, value, { ...options, httpOnly: true, secure: cookieOptions().secure, sameSite: 'lax' });
    } },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: init?.signal || AbortSignal.timeout(15000) }) },
  });
}
