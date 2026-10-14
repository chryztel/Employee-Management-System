'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { initialTasks, initialLeaves, initialAnnouncements, type Task, type Leave, type Announcement, type Role } from './demo-data';
import { Icon } from './ui';
import { Dashboard, Profile, Attendance, EmployeeTasks, LeaveRequests, LeaveForm, Announcements } from './screens';
import { Department, ManagerTasks, TaskCreate, ManagerLeaves, AnnouncementEditor } from './manager-screens';
export type DemoProfile = {
    email: string;
    phone: string;
    address: string;
    username: string;
};
type Demo = {
    profile: DemoProfile;
    setProfile: Dispatch<SetStateAction<DemoProfile>>;
    role: Role;
    screen: string;
    search: string;
    tasks: Task[];
    setTasks: Dispatch<SetStateAction<Task[]>>;
    leaves: Leave[];
    setLeaves: Dispatch<SetStateAction<Leave[]>>;
    announcements: Announcement[];
    setAnnouncements: Dispatch<SetStateAction<Announcement[]>>;
    go: (screen: string) => void;
    notify: (text: string) => void;
    name: string;
    setName: Dispatch<SetStateAction<string>>;
};
const DemoContext = createContext<Demo | null>(null);
export function useDemo() { const value = useContext(DemoContext); if (!value)
    throw new Error('Demo context missing'); return value; }
export default function Portal({ role, account }: {
    role: Role;
    account: { username: string; email: string; displayName: string; employeeId: string };
}) {
    const router = useRouter();
    const [profile, setProfile] = useState<DemoProfile>({ email: account.email, phone: '+63 912 345 6789', address: '24 Acacia Street, Makati City, Metro Manila', username: account.username });
    const [screen, setScreen] = useState('dashboard');
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const [tasks, setTasks] = useState(initialTasks);
    const [leaves, setLeaves] = useState(initialLeaves);
    const [announcements, setAnnouncements] = useState(initialAnnouncements);
    const [name, setName] = useState(account.displayName);
    const [message, setMessage] = useState('');
    const [signingOut, setSigningOut] = useState(false);
    async function signOut() {
        setSigningOut(true);
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const result = await response.json();
            if (!response.ok) { setMessage(result.error || 'Could not sign out. Please retry.'); return; }
            router.replace('/login'); router.refresh();
        } catch { setMessage('Could not reach WorkSync. Please retry signing out.'); }
        finally { setSigningOut(false); }
    }
    useEffect(() => { const update = () => { setScreen(window.location.hash.slice(1) || 'dashboard'); setSearch(''); setOpen(false); }; update(); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
    useEffect(() => { if (!message)
        return; const id = setTimeout(() => setMessage(''), 4500); return () => clearTimeout(id); }, [message]);
    const go = (next: string) => { window.location.hash = next; };
    const nav = [['dashboard', 'Dashboard'], ...(role === 'manager' ? [['department', 'My Department']] : []), ['tasks', role === 'manager' ? 'Tasks' : 'Assigned Tasks'], ...(role === 'employee' ? [['attendance', 'Attendance']] : []), ['leaves', 'Leave Requests'], ['announcements', 'Announcements']];
    const section = screen.split('/')[0];
    const view = section === 'dashboard' ? <Dashboard /> : section === 'profile' ? <Profile /> : section === 'attendance' && role === 'employee' ? <Attendance /> : section === 'department' && role === 'manager' ? <Department /> : section === 'tasks' ? role === 'manager' ? screen === 'tasks/create' ? <TaskCreate /> : <ManagerTasks /> : <EmployeeTasks /> : section === 'leaves' ? role === 'manager' ? <ManagerLeaves /> : screen === 'leaves/new' ? <LeaveForm /> : <LeaveRequests /> : section === 'announcements' ? role === 'manager' && (screen === 'announcements/new' || screen.startsWith('announcements/edit/')) ? <AnnouncementEditor /> : <Announcements /> : <Dashboard />;
    return <DemoContext.Provider value={{ profile, setProfile, role, screen, search, tasks, setTasks, leaves, setLeaves, announcements, setAnnouncements, go, notify: setMessage, name, setName }}>
    <div className="app-shell">
 <aside className={`sidebar ${open ? 'is-open' : ''}`}>
    <Link className="brand" href={`/${role}`} aria-label="WorkSync dashboard">
    <Image src="/images/worksync-logo.png" alt="WorkSync — Employment Management System" width={372} height={154} priority style={{ width: '100%', height: 'auto' }}/>
    </Link>
    <div className="workspace-label">WORKSPACE</div>
    <nav aria-label="Main navigation">{nav.map(([key, title]) => <a key={key} href={`#${key}`} className={section === key ? 'nav-link active' : 'nav-link'} aria-current={section === key ? 'page' : undefined}>
        <Icon name={key}/>
        <span>{title}</span>
        </a>)}</nav>
    <div className="sidebar-bottom">
    <div className="demo-switch">
    <span>Signed in to WorkSync</span>
    <strong>{account.employeeId}</strong>
    </div>
    <button className="logout-button" disabled={signingOut} onClick={signOut}>
    <Icon name="logout"/>{signingOut ? 'Signing out…' : 'Log out'}</button>
    </div>
    </aside>
 {open && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)}/>}
 <div className="main-area">
    <header className="topbar">
    <button className="icon-button mobile-menu" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
    <Icon name="menu"/>
    </button>
    <label className="search-input">
    <Icon name="search"/>
    <input aria-label="Search current screen" placeholder="Search this workspace…" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Clear search" onClick={() => setSearch('')}>
        <Icon name="close" size={15}/>
        </button>}</label>
    <div className="topbar-right">
    <span className="role-label">{role === 'manager' ? 'Department Manager' : 'Employee'} portal</span>
    <a className="profile-link" href="#profile">
    <span className="avatar">
    <Icon name="user" size={24}/>
    </span>
    <span>
    <strong>{name}</strong>
    <small>{profile.email}</small>
    <span className="profile-caption">Update personal information</span>
    </span>
    </a>
    </div>
    </header>
    <main id="main-content" className="page-content" key={screen}>
    <div className="page-eyebrow">WORKSYNC <span>/</span> {role === 'manager' ? 'DEPARTMENT MANAGER' : 'EMPLOYEE'}</div>{view}<footer className="page-footer">
    <span>WorkSync · Employment Management System</span>
    <span>Demo workspace · Changes stay in this session</span>
    </footer>
    </main>
    </div>
 {message && <div className="toast" role="status">
        <Icon name="check"/>{message}<button aria-label="Dismiss notification" onClick={() => setMessage('')}>
        <Icon name="close" size={16}/>
        </button>
        </div>}
 </div>
    </DemoContext.Provider>;
}
