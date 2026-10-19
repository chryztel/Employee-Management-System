'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Icon } from './ui';
import { passwordRules, validPassword, validUsername, normalizeUsername } from '@/lib/auth/policy';
type Mode = 'login' | 'activation-request' | 'first-login' | 'credentials' | 'forgot' | 'reset';
const copy: Record<Mode, { title: string; description: string; button: string; endpoint: string }> = {
  login: { title: 'Welcome back', description: 'Sign in to access your WorkSync workspace.', button: 'Log in', endpoint: 'login' },
  'activation-request': { title: 'Activate your account', description: 'Enter the employee ID and email registered by your administrator. We’ll email your temporary login.', button: 'Send login details', endpoint: 'request-activation' },
  'first-login': { title: 'Create your credentials', description: 'Replace the temporary username and password from your email to finish activation.', button: 'Activate account', endpoint: 'credentials' },
  credentials: { title: 'Update user credentials', description: 'Confirm your current password to securely update your account.', button: 'Update credentials', endpoint: 'credentials' },
  forgot: { title: 'Forgot your password?', description: 'Enter your registered email. We’ll send instructions if the account is eligible.', button: 'Send recovery link', endpoint: 'forgot-password' },
  reset: { title: 'Reset your password', description: 'Create a new password to secure your workspace.', button: 'Reset password', endpoint: 'reset-password' },
};
function PasswordInput({ label, value, onChange, autoComplete, required = true }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; required?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <label className="auth-field"><span>{label}</span><span className="auth-input"><Icon name="tasks" size={18}/><input aria-label={label} type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} maxLength={128} required={required} autoComplete={autoComplete} placeholder="Enter password"/><button type="button" onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}><Icon name="eye" size={18}/></button></span></label>;
}
export default function AuthForm({ mode, initialUsername = '', initialError = '', notice = '' }: { mode: Mode; initialUsername?: string; initialError?: string; notice?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername); const [email, setEmail] = useState(''); const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState(''); const [oldPassword, setOldPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(initialError); const [message, setMessage] = useState(notice); const [busy, setBusy] = useState(false);
  const setup = ['first-login', 'credentials', 'reset'].includes(mode); const rules = passwordRules(password);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setMessage('');
    if (['login', 'first-login', 'credentials'].includes(mode) && !validUsername(normalizeUsername(username))) { setError('Use a username with 3–32 letters, numbers, dots, underscores, or hyphens.'); return; }
    if (setup && (mode !== 'credentials' || password)) {
      if (!validPassword(password)) { setError('Please meet all password requirements.'); return; }
      if (password !== confirm) { setError('The passwords do not match.'); return; }
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${copy[mode].endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, employeeId, password, oldPassword, confirmPassword: confirm }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error || 'We couldn’t complete this request. Please retry.'); return; }
      const allowed = ['/employee', '/manager', '/update-credentials', '/credentials-updated', '/credentials-updated?mode=activation', '/credentials-updated?mode=recovery'];
      if (allowed.includes(result.redirect)) { router.replace(result.redirect); router.refresh(); return; }
      setMessage(result.message || 'Request completed.');
    } catch { setError('We couldn’t reach WorkSync. Check your connection and retry.'); }
    finally { setBusy(false); }
  }
  return <><div className="auth-heading"><span className="auth-eyebrow">{mode === 'login' ? 'YOUR WORKSPACE, CONNECTED' : 'SECURE ACCOUNT ACCESS'}</span><h1>{copy[mode].title}</h1><p>{copy[mode].description}</p></div>
    <form onSubmit={submit} className="auth-form" aria-busy={busy}>
      {['activation-request', 'forgot'].includes(mode) && <label className="auth-field"><span>{mode === 'activation-request' ? 'Registered email' : 'Email address'}</span><span className="auth-input"><Icon name="file" size={18}/><input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} autoComplete="email" placeholder="you@company.com"/></span></label>}
      {mode === 'activation-request' && <label className="auth-field"><span>Employee ID</span><span className="auth-input"><Icon name="user" size={18}/><input value={employeeId} onChange={e => setEmployeeId(e.target.value.toUpperCase())} maxLength={32} required placeholder="e.g. EMP-001" autoComplete="off"/></span></label>}
      {['login', 'first-login', 'credentials'].includes(mode) && <label className="auth-field"><span>Username</span><span className="auth-input"><Icon name="user" size={18}/><input value={username} onChange={e => setUsername(e.target.value)} maxLength={32} required autoComplete="username" placeholder="Enter your username"/></span>{mode !== 'login' && <small>3–32 characters: letters, numbers, dots, underscores, or hyphens.</small>}</label>}
      {mode === 'credentials' && <PasswordInput label="Current password" value={oldPassword} onChange={setOldPassword} autoComplete="current-password"/>}
      {mode !== 'activation-request' && mode !== 'forgot' && <PasswordInput label={mode === 'login' ? 'Password' : mode === 'credentials' ? 'New password (optional)' : 'New password'} value={password} onChange={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required={mode !== 'credentials'}/>}
      {setup && <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" required={mode !== 'credentials' || !!password}/>}
      {mode === 'login' && <div className="auth-forgot"><Link href="/forgot-password">Forgot password?</Link></div>}
      {setup && <div className="auth-password-rules" aria-label="Password requirements">{Object.entries(rules).map(([key, met]) => <span key={key} className={met ? 'met' : ''}><Icon name="check" size={13}/>{({ length: '12–128 characters', upper: 'At least one uppercase letter', lower: 'At least one lowercase letter', number: 'At least one number', symbol: 'At least one symbol' } as Record<string, string>)[key]}</span>)}</div>}
      {error && <div className="auth-alert error" role="alert">{error}</div>}{message && <div className="auth-alert success" role="status"><Icon name="check" size={18}/><span>{message}</span></div>}
      <button className="primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : copy[mode].button}<Icon name={mode === 'login' ? 'logout' : 'check'} size={17}/></button>
    </form>
    <div className="auth-links">{mode === 'login' ? <p>Account not activated? <Link href="/activate">Activate account</Link></p> : <Link href="/login">Back to login</Link>}</div><div className="auth-private"><Icon name="user" size={13}/>Access is provided by your administrator.</div>
  </>;
}
