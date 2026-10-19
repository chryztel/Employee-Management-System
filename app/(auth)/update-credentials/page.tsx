import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import AuthFrame from '@/app/components/auth-frame';
import AuthForm from '@/app/components/auth-form';
import { authenticatedAccount } from '@/lib/auth/session';
async function Content() {
  const account = await authenticatedAccount(true);
  if (!account) redirect('/login');
  // Signed in with the emailed temporary credentials: replace them before any portal.
  if (account.mustChangeCredentials) return <AuthFrame variant="credentials"><AuthForm mode="first-login"/></AuthFrame>;
  return <AuthFrame variant="credentials"><AuthForm mode="credentials" initialUsername={account.profile.username}/></AuthFrame>;
}
export default function Page() { return <Suspense fallback={<AuthFrame variant="credentials"><p>Loading secure account setup…</p></AuthFrame>}><Content/></Suspense>; }
