import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './auth.css';
export function WorkSyncLogo() { return <Image src="/images/worksync-logo.png" alt="WorkSync — Employment Management System" width={372} height={154} priority className="auth-logo"/>; }
export default function AuthFrame({ variant = 'login', children }: { variant?: 'login' | 'activate' | 'credentials'; children: ReactNode }) {
  return <main id="main-content" className={`auth-page auth-${variant}`}>
    <Link href="/login" className="auth-corner-brand" aria-label="WorkSync login"><WorkSyncLogo/></Link>
    <div className="auth-workspace">
      {variant !== 'login' && <aside className="auth-photo"><Image src={variant === 'activate' ? '/images/worksync-activate.png' : '/images/worksync-update.png'} alt={variant === 'activate' ? 'Colleagues working together at a desk' : 'A bright modern office workspace'} fill sizes="(max-width: 700px) 100vw, 430px" style={{ objectFit: 'cover' }} priority/>{variant === 'credentials' && <div className="auth-photo-caption"><h2>Secure your workspace</h2><p>A secure account is the first step toward a productive workday.</p></div>}</aside>}
      <section className="auth-card"><WorkSyncLogo/>{children}</section>
    </div>
    <footer className="auth-footer">WorkSync · Employment Management System <span>Secure access for your team</span></footer>
  </main>;
}
