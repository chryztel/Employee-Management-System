import { Suspense } from 'react';
import AuthFrame from '@/app/components/auth-frame';
import AuthForm from '@/app/components/auth-form';
async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <AuthFrame variant="activate"><AuthForm mode="activation-request" initialError={params.error ? 'This link is invalid, expired, or already used. Request a new activation email.' : ''}/></AuthFrame>;
}
export default function ActivatePage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <Suspense fallback={<AuthFrame variant="activate"><p>Loading activation…</p></AuthFrame>}><Content {...props}/></Suspense>; }
