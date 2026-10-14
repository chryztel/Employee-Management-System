import { Suspense } from 'react';
import AuthFrame from '@/app/components/auth-frame';
import AuthForm from '@/app/components/auth-form';
async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const params = await searchParams; return <AuthForm mode="forgot" initialError={params.error ? 'This recovery link is invalid or expired. Request a new email.' : ''}/>; }
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <AuthFrame><Suspense fallback={<p>Loading password recovery…</p>}><Content {...props}/></Suspense></AuthFrame>; }
