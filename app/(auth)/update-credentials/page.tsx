import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AuthFrame from '@/app/components/auth-frame';
import AuthForm from '@/app/components/auth-form';
import { ACTIVATION_COOKIE } from '@/lib/auth/policy';
import { tokenHash, validActivationToken } from '@/lib/auth/crypto';
import { adminClient } from '@/lib/supabase/admin';
import { authenticatedAccount } from '@/lib/auth/session';
async function Content() {
  const raw = (await cookies()).get(ACTIVATION_COOKIE)?.value;
  if (raw) {
    if (!validActivationToken(raw)) redirect('/activate?error=link');
    const { data, error } = await adminClient().rpc('auth_inspect_activation', { p_hash: tokenHash(raw) });
    if (error || !data) redirect('/activate?error=link');
    return <AuthFrame variant="credentials"><AuthForm mode="activation-credentials"/></AuthFrame>;
  }
  const account = await authenticatedAccount(true);
  if (!account) redirect('/login');
  return <AuthFrame variant="credentials"><AuthForm mode="credentials" initialUsername={account.profile.username}/></AuthFrame>;
}
export default function Page() { return <Suspense fallback={<AuthFrame variant="credentials"><p>Loading secure account setup…</p></AuthFrame>}><Content/></Suspense>; }
