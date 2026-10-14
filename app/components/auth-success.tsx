'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Icon } from './ui';
export default function AuthSuccess({ activation = false, recovery = false }: { activation?: boolean; recovery?: boolean }) {
  const router = useRouter();
  useEffect(() => { const timer = setTimeout(() => { router.replace('/login?updated=1'); router.refresh(); }, 6000); return () => clearTimeout(timer); }, [router]);
  return <div className="auth-success"><span className="auth-success-icon"><Icon name="check" size={30}/></span><h1>{activation ? 'Account activated!' : recovery ? 'Password updated!' : 'Credentials updated!'}</h1><p>Your account is ready. Sign in with your username and password to continue.</p><Link className="primary auth-submit" href="/login?updated=1">Continue to login</Link><small>You’ll be redirected in a few seconds.</small></div>;
}
