import { Suspense } from 'react';
import AuthFrame from '@/app/components/auth-frame';
import AuthSuccess from '@/app/components/auth-success';
async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { const params = await searchParams; return <AuthSuccess activation={params.mode === 'activation'} recovery={params.mode === 'recovery'}/>; }
export default function Page(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <AuthFrame><Suspense fallback={<p>Loading confirmation…</p>}><Content {...props}/></Suspense></AuthFrame>; }
