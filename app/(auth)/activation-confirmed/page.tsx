import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AuthFrame from '@/app/components/auth-frame';
import { Icon } from '@/app/components/ui';
import { ACTIVATION_COOKIE } from '@/lib/auth/policy';
import { validActivationToken, tokenHash } from '@/lib/auth/crypto';
import { adminClient } from '@/lib/supabase/admin';
async function Confirmation() {
  const raw = (await cookies()).get(ACTIVATION_COOKIE)?.value || '';
  if (!validActivationToken(raw)) redirect('/activate?error=link');
  const { data, error } = await adminClient().rpc('auth_inspect_activation', { p_hash: tokenHash(raw) });
  if (error || !data) redirect('/activate?error=link');
  return <AuthFrame><div className="auth-success"><span className="auth-success-icon"><Icon name="check" size={30}/></span><h1>Email verified!</h1><p>Continue to choose your username and password. Your account will activate when setup is complete.</p><Link className="primary auth-submit" href="/update-credentials">Continue</Link></div></AuthFrame>;
}
export default function Page() { return <Suspense fallback={<AuthFrame><p>Verifying your activation link…</p></AuthFrame>}><Confirmation/></Suspense>; }
