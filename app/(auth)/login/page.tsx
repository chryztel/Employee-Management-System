import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import AuthFrame from '@/app/components/auth-frame';
import AuthForm from '@/app/components/auth-form';
import { authenticatedAccount } from '@/lib/auth/session';
import { roleDestination } from '@/lib/auth/policy';
async function LoginContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await authenticatedAccount(true);
  if (account) redirect(roleDestination(account.profile.role));
  const params = await searchParams;
  return <AuthFrame><AuthForm mode="login" notice={params.updated ? 'Your credentials are ready. Please sign in.' : ''}/></AuthFrame>;
}
export default function LoginPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <Suspense fallback={<AuthFrame><p>Loading secure sign-in…</p></AuthFrame>}><LoginContent {...props}/></Suspense>; }
