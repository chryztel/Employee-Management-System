'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useDemo } from './portal';
import { attendance, dateLabel, type Announcement } from './demo-data';
import { pageItems, Badge, Empty, Field, Filter, Icon, Modal, Pagination, Panel, PasswordField, Stat, Upload, tone } from './ui';
export function Heading({ title, subtitle, action, back }: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    back?: string;
}) {
    const { go } = useDemo();
    return <div className="page-heading">
    <div>{back && <button className="back-link" onClick={() => go(back)}>
        <Icon name="arrow" size={16}/>Back to {back === 'department' ? 'My Department' : back}</button>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
export function AttendanceChart() {
    return <div className="attendance-chart">
    <div className="chart-title">Attendance overview <small>Last 6 months</small>
    </div>
    <div className="chart-columns">{[92, 86, 95, 80, 89, 94].map((n, i) => <div key={i}>
        <div className="stack-bar">
        <span style={{ height: `${100 - n}%` }}/>
        <span style={{ height: '18%' }}/>
        <span style={{ height: `${n - 18}%` }}/>
        </div>
        <small>{['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][i]}</small>
        </div>)}</div>
    <div className="chart-legend">
    <span>
    <i className="legend-dot present"/>Present</span>
    <span>
    <i className="legend-dot leave"/>On leave</span>
    <span>
    <i className="legend-dot absent"/>Absent</span>
    </div>
    </div>;
}
export function Dashboard() {
    const { role, name, tasks, leaves, announcements, go, search } = useDemo();
    const manager = role === 'manager';
    const visibleTasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()));
    return <>
    <Heading title={manager ? 'Good morning, Manager!' : `Welcome back, ${name}!`} subtitle={manager ? 'Here’s what’s happening in your department today.' : 'A fresh start. Here’s your workspace at a glance.'}/>
 {manager ? <div className="stats-grid manager-stats">{[['Total employees', '142', 'department'], ['Present today', '128', 'attendance'], ['Absent today', '14', 'user'], ['Pending leaves', leaves.filter(l => /pending|requested/i.test(l.status)).length, 'leaves'], ['Active tasks', tasks.filter(t => t.status === 'In progress').length, 'tasks'], ['Completed tasks', tasks.filter(t => t.status === 'Completed').length, 'check']].map(([label, value, icon]) => <Stat key={label} label={String(label)} value={value} icon={String(icon)} onClick={() => go(icon === 'leaves' ? 'leaves' : icon === 'tasks' || icon === 'check' ? 'tasks' : 'department')}/>)}</div> : <div className="dashboard-summaries">
        <Panel title="Attendance" action={<a href="#attendance">View record &#8599;</a>}>
        <div className="stats-grid two">
        <Stat label="Days present" value="10" icon="attendance" color="green"/>
        <Stat label="Days absent" value="0" icon="user" color="red"/>
        </div>
        </Panel>
        <Panel title="Leave overview" action={<a href="#leaves">Check status &#8599;</a>}>
        <div className="leave-overview">
        <div className="stats-grid four">{['Approved', 'Declined', 'Requested', 'Pending'].map(s => <Stat key={s} label={s} value={leaves.filter(l => l.status === s).length} icon="leaves" color={tone(s)} onClick={() => go('leaves')}/>)}</div>
        <button className="primary small" onClick={() => go('leaves/new')}>
        <Icon name="plus" size={16}/>File a leave</button>
        </div>
        </Panel>
        </div>}
 <div className={`dashboard-grid ${manager ? 'manager-dashboard' : ''}`}>
    <Panel title={manager ? 'Recent tasks' : 'Assigned tasks'} action={<a href="#tasks">View all &#8599;</a>}>
    <div className="task-preview-list">{visibleTasks.slice(0, manager ? 3 : 5).map(t => <button className="task-preview" key={t.id} onClick={() => go(`tasks/${t.id}`)}>
        <span>
        <strong>{t.title}</strong>
        <small>
        <Icon name="calendar" size={13}/>{dateLabel(t.due)}</small>
        </span>
        <Badge status={t.status}/>
        <span className="text-link">View details &#8594;</span>
        </button>)}{!visibleTasks.length && <Empty />}</div>
    </Panel>
 {manager ? <>
        <Panel title="Attendance overview">
        <div className="attendance-ring">
        <div>
        <strong>90%</strong>
        <span>Present today</span>
        </div>
        </div>
        <div className="chart-legend">
        <span>
        <i className="legend-dot present"/>Present</span>
        <span>
        <i className="legend-dot leave"/>On leave</span>
        <span>
        <i className="legend-dot absent"/>Absent</span>
        </div>
        </Panel>
        <Panel title="Task progress">
        <div className="progress-chart">{[['Not started', 25], ['In progress', 80], ['Completed', 55], ['Overdue', 16]].map(([label, size]) => <div key={label}>
            <div style={{ height: `${size}%` }}/>
            <small>{label}</small>
            </div>)}</div>
        </Panel>
        <Panel title="Recent leave requests" action={<a href="#leaves">View all &#8599;</a>}>
        <div className="table-scroll">
        <table>
        <thead>
        <tr>
        <th>Employee</th>
        <th>Type</th>
        <th>Status</th>
        </tr>
        </thead>
        <tbody>{leaves.slice(0, 5).map(l => <tr key={l.id} onClick={() => go(`leaves/${l.id}`)}>
            <td>
            <button className="table-link" onClick={() => go(`leaves/${l.id}`)}>{l.name}</button>
            </td>
            <td>{l.type}</td>
            <td>
            <Badge status={l.status}/>
            </td>
            </tr>)}</tbody>
        </table>
        </div>
        </Panel>
        </> : <Panel title="Latest announcements" action={<a href="#announcements">View all &#8599;</a>}>
        <div className="announcement-grid compact">{announcements.filter(a => a.status === 'Published' && a.title.toLowerCase().includes(search.toLowerCase())).slice(0, 4).map(a => <AnnouncementCard key={a.id} item={a}/>)}</div>
        </Panel>}
 </div>
    </>;
}
export function Profile() {
    const router = useRouter();
    const { name, setName, notify, role, profile, setProfile } = useDemo();
    const [editingName, setEditingName] = useState(name);
    const [saving, setSaving] = useState(false);
    async function save(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const username = String(data.get('username')).trim().toLowerCase();
        const password = String(data.get('password') || '');
        if (password || username !== profile.username) {
            setSaving(true);
            try {
                const response = await fetch('/api/auth/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, oldPassword: String(data.get('oldPassword') || ''), confirmPassword: String(data.get('confirmPassword') || '') }) });
                const result = await response.json();
                if (!response.ok) { notify(result.error || 'Credential update failed.'); return; }
                router.replace('/credentials-updated'); router.refresh();
            } catch { notify('Could not reach WorkSync. Please retry.'); }
            finally { setSaving(false); }
            return;
        }
        setName(editingName); setProfile({ email: profile.email, phone: String(data.get('phone')), address: String(data.get('address')), username: profile.username });
        notify('Contact details updated locally.');
    }
    return <>
    <Heading title="Profile settings" subtitle="Manage your personal information and contact details." action={<div className="profile-card">
        <span className="avatar large">
        <Icon name="user" size={36}/>
        </span>
        <div>
        <strong>{name}</strong>
        <small>{role === 'manager' ? 'DEPARTMENT MANAGER' : 'EMPLOYEE'}</small>
        </div>
        </div>}/>
    <form onSubmit={save} aria-busy={saving}>
    <Panel title="Personal details">
    <div className="form-grid">
    <Field label="Display name">
    <input required value={editingName} onChange={e => setEditingName(e.target.value)}/>
    </Field>
    <Field label="Username">
    <input name="username" defaultValue={profile.username} required/>
    </Field>
    <PasswordField label="New password" name="password"/>
    <PasswordField label="Current password" name="oldPassword"/>
    <PasswordField label="Confirm new password" name="confirmPassword"/>
    <div className="password-help">
    <strong>Password requirements</strong>
    <span>&#10003; 12–128 characters</span>
    <span>&#10003; Uppercase and lowercase letters</span>
    <span>&#10003; At least one number and special character</span>
    <small>Current password required for credential changes. Contact details remain local demo data.</small>
    <a href="/update-credentials">Open secure account settings →</a>
    </div>
    </div>
    </Panel>
    <Panel title="Contact information" className="section-gap">
    <div className="form-grid">
    <Field label="Email address">
    <input name="email" type="email" defaultValue={profile.email} readOnly aria-label="Registered email (managed by administrator)"/>
    </Field>
    <Field label="Phone number">
    <input name="phone" type="tel" defaultValue={profile.phone}/>
    </Field>
    <div className="full-width">
    <Field label="Home address">
    <input name="address" defaultValue={profile.address}/>
    </Field>
    </div>
    </div>
    <div className="form-actions">
    <button className="primary" disabled={saving}>{saving ? 'Updating…' : 'Update personal information'}</button>
    </div>
    </Panel>
    </form>
    </>;
}
export function Attendance({ employeeName }: {
    employeeName?: string;
}) {
    const { name, search } = useDemo();
    const [filter, setFilter] = useState('All statuses');
    const [week, setWeek] = useState(0);
    const data = attendance.slice(week * 7, week * 7 + 7).filter(a => (filter === 'All statuses' || a.status === filter) && `${a.date} ${a.status}`.toLowerCase().includes(search.toLowerCase()));
    return <>{!employeeName && <Heading title="Attendance record" subtitle="Your attendance history and working time, all in one place."/>}<Panel className="attendance-panel">{!employeeName && <div className="attendance-summary">
        <div className="attendance-person">
        <span className="avatar large">
        <Icon name="user" size={40}/>
        </span>
        <strong>{name}</strong>
        <small>EMPLOYEE</small>
        </div>
        <AttendanceChart />
        <div className="attendance-totals">
        <div>
        <strong>300<span>hrs</span>
        </strong>
        <small>Total working hours</small>
        </div>
        <div>
        <strong>41<span> days</span>
        </strong>
        <small>Total working days</small>
        </div>
        <div>
        <strong>1<span> day</span>
        </strong>
        <small>Total days absent</small>
        </div>
        </div>
        </div>}<div className="record-table">
    <div className="table-toolbar">
    <Filter value={filter} onChange={setFilter} options={['All statuses', 'On time', 'Absent', 'Late']}/>
    <div className="date-pager">
    <button aria-label="Earlier week" disabled={week === 3} onClick={() => setWeek(week + 1)}>‹</button>
    <strong>{dateLabel(attendance[week * 7 + 6].date)} – {dateLabel(attendance[week * 7].date)}</strong>
    <button aria-label="Later week" disabled={week === 0} onClick={() => setWeek(week - 1)}>›</button>
    </div>
    </div>
    <div className="table-scroll">
    <table>
    <thead>
    <tr>
    <th>Date</th>
    <th>Time in – out</th>
    <th>Duration</th>
    <th>Status</th>
    </tr>
    </thead>
    <tbody>{data.map(a => <tr key={a.date}>
        <td>{dateLabel(a.date)}</td>
        <td>{a.time}</td>
        <td>{a.duration}</td>
        <td>
        <Badge status={a.status}/>
        </td>
        </tr>)}</tbody>
    </table>{!data.length && <Empty />}</div>
    </div>
    </Panel>
    </>;
}
export function EmployeeTasks() {
    const { tasks, setTasks, screen, go, search, notify } = useDemo();
    const [filter, setFilter] = useState('All tasks');
    const [page, setPage] = useState(1);
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState<string[]>([]);
    const [file, setFile] = useState('');
    const selected = tasks.find(t => t.id === Number(screen.split('/')[1]));
    const filtered = tasks.filter(t => (filter === 'All tasks' || t.status === filter) && t.title.toLowerCase().includes(search.toLowerCase()));
    return <>
    <Heading title="Assigned tasks" subtitle="Stay focused on your priorities and track your progress." back={selected ? 'tasks' : undefined}/>{!selected && <div className="stats-grid four section-bottom">{['Overdue', 'In progress', 'Completed', 'Pending approval'].map(s => <Stat key={s} label={s === 'Pending approval' ? 'Pending approval of completion' : s === 'In progress' ? 'Currently working on' : s} value={tasks.filter(t => t.status === s).length} color={tone(s)} onClick={() => { setFilter(s); setPage(1); }} active={filter === s}/>)}</div>}<Panel>
    <div className="table-toolbar">
    <Filter label="Task status" value={selected?.status || filter} options={selected ? [selected.status] : ['All tasks', 'In progress', 'Completed', 'Pending approval', 'Overdue', 'Not started']} onChange={v => { setFilter(v); setPage(1); }}/>{selected && <small>Task #{String(selected.id).padStart(3, '0')}</small>}</div>{selected ? <div className="task-detail">
        <div className="detail-meta">
        <div>
        <small>Project name</small>
        <h2>{selected.title}</h2>
        </div>
        <div>
        <small>Due date</small>
        <strong>{dateLabel(selected.due)}</strong>
        </div>
        <div>
        <small>Working time</small>
        <strong>8h 12m</strong>
        </div>
        </div>
        <p className="description">{selected.id === 2 ? 'Design a modern packaging concept for EcoSip, a reusable smart water bottle. Use a clean, minimal design with blue, white, and green colors to represent hydration and sustainability. Include a product image, the tagline “Stay Hydrated. Stay Smart.”, and key features. Use recyclable cardboard with a matte finish to create a premium, eco-friendly look.' : 'Complete the assigned deliverables, document your approach, and share the final files for review. Coordinate with your department team and ensure all quality requirements are met before submission.'}</p>{selected.status !== 'Completed' && <>
            <div className="detail-columns">
            <div>
            <Field label="Add a comment or question">
            <textarea rows={4} value={comment} onChange={e => setComment(e.target.value)} placeholder="Share an update with your manager…"/>
            </Field>
            <button className="secondary small" disabled={!comment.trim()} onClick={() => { setComments([...comments, comment]); setComment(''); notify('Comment added to this demo.'); }}>Add comment</button>{comments.map((c, i) => <p className="comment" key={i}>{c}</p>)}</div>
            <div className="task-upload">
            <Icon name="upload" size={32}/>
            <h3>Upload task here</h3>
            <label className="primary small file-button">Choose file<input type="file" onChange={e => setFile(e.target.files?.[0]?.name || '')}/>
            </label>{file && <>
                <small>{file}</small>
                <button className="primary small" onClick={() => { setTasks(tasks.map(t => t.id === selected.id ? { ...t, status: 'Pending approval', progress: 100 } : t)); notify('Task submitted for review in this demo.'); }}>Submit task</button>
                </>}</div>
            </div>
            </>}{selected.status !== 'In progress' && <div className={`status-banner ${tone(selected.status)}`}>
            <Icon name={selected.status === 'Completed' ? 'check' : 'clock'}/>{selected.status === 'Pending approval' ? 'Pending approval of completion' : selected.status}</div>}</div> : <>
        <div className="table-scroll">
        <table className="task-table">
        <thead>
        <tr>
        <th>Project name</th>
        <th>Due date</th>
        <th>Working time</th>
        <th>Status</th>
        <th>
        <span className="sr-only">Actions</span>
        </th>
        </tr>
        </thead>
        <tbody>{pageItems(filtered, page, 6).map(t => <tr key={t.id}>
            <td className="strong-cell">{t.title}</td>
            <td>{dateLabel(t.due)}</td>
            <td>8h 12m</td>
            <td>
            <Badge status={t.status}/>
            </td>
            <td>
            <button className="primary small" onClick={() => go(`tasks/${t.id}`)}>View details</button>
            </td>
            </tr>)}</tbody>
        </table>{!filtered.length && <Empty />}</div>
        <Pagination page={page} total={Math.ceil(filtered.length / 6)} onChange={setPage} count={filtered.length}/>
        </>}</Panel>
    </>;
}
export function LeaveRequests() {
    const { leaves, search, go } = useDemo();
    const [filter, setFilter] = useState('All requests');
    const [page, setPage] = useState(1);
    const filtered = leaves.filter(l => (filter === 'All requests' || l.status === filter) && `${l.type} ${l.start} ${l.status}`.toLowerCase().includes(search.toLowerCase()));
    return <>
    <Heading title="Leave requests" subtitle="Plan your time away and keep track of your requests." action={<button className="primary" onClick={() => go('leaves/new')}>
        <Icon name="plus" size={18}/>Add leave</button>}/>
    <Panel className="leave-balance">
    <div>
    <small>Leave allowance</small>
    <strong>15 <span>days</span>
    </strong>
    </div>
    <div>
    <small>Remaining allowance</small>
    <strong>12 <span>days</span>
    </strong>
    </div>
    <div>
    <small>Leave used</small>
    <strong>3 <span>days</span>
    </strong>
    </div>
    </Panel>
    <div className="stats-grid four section-gap section-bottom">{['Approved', 'Declined', 'Requested', 'Pending'].map(s => <Stat key={s} label={s} value={leaves.filter(l => l.status === s).length} color={tone(s)} icon="leaves" active={filter === s} onClick={() => { setFilter(filter === s ? 'All requests' : s); setPage(1); }}/>)}</div>
    <Panel>
    <div className="table-toolbar">
    <Filter value={filter} onChange={v => { setFilter(v); setPage(1); }} options={['All requests', 'Approved', 'Declined', 'Requested', 'Pending']}/>
    </div>
    <div className="table-scroll">
    <table>
    <thead>
    <tr>
    <th>Leave type</th>
    <th>Start date</th>
    <th>End date</th>
    <th>Duration</th>
    <th>Status</th>
    </tr>
    </thead>
    <tbody>{pageItems(filtered, page, 6).map(l => <tr key={l.id}>
        <td>{l.type}</td>
        <td>{dateLabel(l.start)}</td>
        <td>{dateLabel(l.end)}</td>
        <td>{l.days} {l.days === 1 ? 'day' : 'days'}</td>
        <td>
        <Badge status={l.status}/>
        </td>
        </tr>)}</tbody>
    </table>{!filtered.length && <Empty />}</div>
    <Pagination page={page} total={Math.ceil(filtered.length / 6)} onChange={setPage} count={filtered.length}/>
    </Panel>
    </>;
}
export function LeaveForm() {
    const { setLeaves, name, go, notify } = useDemo();
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    const days = start && end ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1) : 0;
    function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const data = new FormData(e.currentTarget); setLeaves(previous => [{ id: Date.now(), name, type: String(data.get('type')), start, end, days, reason: String(data.get('reason')), status: 'Requested' }, ...previous]); notify('Leave request added to the demo.'); go('leaves'); }
    return <>
    <Heading title="Request leave" subtitle="Submit a new request for time off. Please review your details before submitting." back="leaves"/>
    <div className="form-with-aside">
    <Panel>
    <form onSubmit={submit}>
    <Field label="Leave type">
    <select name="type" required defaultValue="">
    <option value="" disabled>Select leave type…</option>{['Annual leave', 'Sick leave', 'Personal leave', 'Emergency leave'].map(t => <option key={t}>{t}</option>)}</select>
    </Field>
    <Field label="Reason for leave">
    <textarea name="reason" required rows={5} placeholder="Briefly describe the reason for your request…"/>
    </Field>
    <div className="form-grid">
    <Field label="Start date">
    <input type="date" required value={start} onChange={e => { setStart(e.target.value); if (end && e.target.value > end)
        setEnd(e.target.value); }}/>
    </Field>
    <Field label="End date">
    <input type="date" min={start} required value={end} onChange={e => setEnd(e.target.value)}/>
    </Field>
    </div>
    <Field label="Supporting documents (optional)">
    <Upload />
    </Field>
    <div className="form-actions">
    <button type="button" className="secondary" onClick={() => go('leaves')}>Cancel</button>
    <button className="primary">Submit request</button>
    </div>
    </form>
    </Panel>
    <Panel title="Leave balances">
    <div className="balance-detail">
    <span>Remaining allowance<strong>12 days</strong>
    </span>
    <progress value={12} max={15}/>
    <span>Leave used<strong>3 days</strong>
    </span>
    <progress value={3} max={15}/>{days > 0 && <p>Requested duration: <strong>{days} {days === 1 ? 'day' : 'days'}</strong>
        </p>}<small>Demo balances are illustrative. No actual leave allowance is deducted.</small>
    </div>
    </Panel>
    </div>
    </>;
}
function AnnouncementCard({ item }: {
    item: Announcement;
}) {
    const [expanded, setExpanded] = useState(false);
    return <button className={`announcement-card ${expanded ? "expanded" : ""}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
    <div className="announcement-image">
    <Image src="/images/worksync-activate.png" alt="Colleagues collaborating in the office" fill sizes="(max-width: 700px) 40vw, 180px" style={{ objectFit: 'cover', objectPosition: 'center 40%' }}/>
    </div>
    <div className="announcement-card-body">
    <span className="card-category">{item.category}</span>
    <h3>{item.title}</h3>
    <p>{item.content}</p>
    <small>
    <Icon name="clock" size={13}/>4:00 PM</small>
    <small>
    <Icon name="calendar" size={13}/>{dateLabel(item.date)}</small>
    <small>Manila, Philippines</small>
    </div>{item.pinned && <span className="pin">
        <Icon name="pin" size={17}/>
        </span>}</button>;
}
export function Announcements() {
    const { role, announcements, setAnnouncements, search, go, notify } = useDemo();
    const [filter, setFilter] = useState('All priorities');
    const [status, setStatus] = useState('All statuses');
    const [page, setPage] = useState(1);
    const [remove, setRemove] = useState<number | null>(null);
    const filtered = announcements.filter(a => (role === 'manager' || a.status === 'Published') && (filter === 'All priorities' || a.priority === filter) && (status === 'All statuses' || a.status === status) && `${a.title} ${a.content} ${a.author}`.toLowerCase().includes(search.toLowerCase()));
    return <>
    <Heading title={role === 'manager' ? 'Announcement dashboard' : 'Announcements'} subtitle={role === 'manager' ? 'Manage and share company and department-wide announcements.' : 'Stay connected with the latest news, events, and team updates.'} action={role === 'manager' ? <button className="primary" onClick={() => go('announcements/new')}>
        <Icon name="plus" size={18}/>Post new announcement</button> : undefined}/>{role === 'manager' && <div className="stats-grid three section-bottom">
        <Stat label="Published announcements" value={announcements.filter(a => a.status === 'Published').length} icon="announcements"/>
        <Stat label="Active drafts" value={announcements.filter(a => a.status === 'Draft').length} icon="file"/>
        <Stat label="Scheduled" value={announcements.filter(a => a.status === 'Scheduled').length} icon="calendar"/>
        </div>}<Panel>
    <div className="table-toolbar">
    <Filter value={filter} onChange={v => { setFilter(v); setPage(1); }} options={['All priorities', 'Normal', 'Important', 'Urgent']} label="Announcement priority"/>{role === 'manager' && <Filter value={status} onChange={v => { setStatus(v); setPage(1); }} options={['All statuses', 'Published', 'Draft', 'Scheduled']}/>}</div>{role === 'manager' ? <div className="table-scroll">
        <table>
        <thead>
        <tr>
        <th>Announcement title</th>
        <th>Category</th>
        <th>Target audience</th>
        <th>Author</th>
        <th>Status</th>
        <th>Publish date</th>
        <th>Actions</th>
        </tr>
        </thead>
        <tbody>{pageItems(filtered, page, 6).map(a => <tr key={a.id}>
            <td>
            <button className="table-link" onClick={() => go(`announcements/edit/${a.id}`)}>{a.pinned && <Icon name="pin" size={13}/>}{a.title}</button>
            </td>
            <td>{a.category}</td>
            <td>{a.audience}</td>
            <td>{a.author}</td>
            <td>
            <Badge status={a.status}/>
            </td>
            <td>{dateLabel(a.date)}</td>
            <td>
            <div className="row-actions">
            <button className="secondary small" onClick={() => go(`announcements/edit/${a.id}`)}>Edit</button>
            <button className="icon-button" aria-label={`Delete ${a.title}`} onClick={() => setRemove(a.id)}>
            <Icon name="close" size={16}/>
            </button>
            </div>
            </td>
            </tr>)}</tbody>
        </table>
        </div> : <div className="announcement-grid">{pageItems(filtered, page, 4).map(a => <AnnouncementCard key={a.id} item={a}/>)}</div>}{!filtered.length && <Empty />}<Pagination page={page} total={Math.ceil(filtered.length / (role === 'manager' ? 6 : 4))} onChange={setPage} count={filtered.length}/>
    </Panel>{remove !== null && <Modal title="Delete announcement?" onClose={() => setRemove(null)}>
        <p>This removes the announcement from the current demo session.</p>
        <div className="form-actions">
        <button className="secondary" onClick={() => setRemove(null)}>Cancel</button>
        <button className="danger" onClick={() => { setAnnouncements(announcements.filter(a => a.id !== remove)); setRemove(null); notify('Announcement removed from this demo.'); }}>Delete announcement</button>
        </div>
        </Modal>}</>;
}
