import Portal from '../components/portal';
import { Suspense } from 'react';
import { requireRole } from '@/lib/auth/session';
async function EmployeeWorkspace() {
  const account = await requireRole('employee');
  return <Portal role="employee" account={{ username: account.username, email: account.email, displayName: account.display_name, employeeId: account.employee_id }} />;
}
export default function EmployeePage() { return <Suspense fallback={<main className="page-content">Verifying your WorkSync session…</main>}><EmployeeWorkspace/></Suspense>; }
