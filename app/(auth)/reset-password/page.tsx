import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import AuthFrame from '@/app/components/auth-frame';
import AuthForm from '@/app/components/auth-form';
import { RECOVERY_PROOF_COOKIE, RECOVERY_TOKEN_COOKIE } from '@/lib/auth/policy';
import { readRecoveryProof } from '@/lib/auth/crypto';
import { required } from '@/lib/auth/config';
import { authenticatedAccount } from '@/lib/auth/session';
async function Content() {
  await connection(); // Expiry must use request time, not a prerender clock.
  const jar = await cookies(); const token = jar.get(RECOVERY_TOKEN_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    const proof = readRecoveryProof(jar.get(RECOVERY_PROOF_COOKIE)?.value || '', required('SUPABASE_SECRET_KEY'));
    const account = proof ? await authenticatedAccount(true) : null;
    if (!proof || !account || proof.userId !== account.user.id || proof.sessionId !== account.sessionId) redirect('/forgot-password?error=link');
  }
  return <AuthFrame variant="credentials"><AuthForm mode="reset"/></AuthFrame>;
}
export default function Page() { return <Suspense fallback={<AuthFrame variant="credentials"><p>Loading secure password reset…</p></AuthFrame>}><Content/></Suspense>; }
