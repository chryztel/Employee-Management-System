import Portal from '../components/portal';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
async function ManagerWorkspace() {
  const account = await requireRole('manager');
  return <Portal role="manager" account={{ username: account.username, email: account.email, displayName: account.display_name, employeeId: account.employee_id }} />;
}
export default function ManagerPage() { return <Suspense fallback={<main className="page-content">Verifying your WorkSync session…</main>}><ManagerWorkspace/></Suspense>; }
