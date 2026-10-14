'use client';
import { useState, type FormEvent } from 'react';
import { useDemo } from './portal';
import { dateLabel, employees, type Announcement } from './demo-data';
import { Attendance, Heading } from './screens';
import { pageItems, Badge, Empty, Field, Filter, Icon, Modal, Pagination, Panel, Stat, Upload } from './ui';
export function Department() {
    const { screen, go, search } = useDemo();
    const [filter, setFilter] = useState('All employees');
    const [page, setPage] = useState(1);
    const person = employees.find(e => e[0] === screen.split('/')[1]);
    const filtered = employees.filter(e => (filter === 'All employees' || e[4] === filter) && e.join(' ').toLowerCase().includes(search.toLowerCase()));
    return <>
    <Heading title="My department" subtitle="View and manage employees assigned to your department." back={person ? 'department' : undefined}/>{person ? <>
        <Panel>
        <div className="employee-detail-header">
        <span className="avatar large">
        <Icon name="user" size={35}/>
        </span>
        <div>
        <h2>{person[1]} <span className="id-label">{person[0]}</span>
        </h2>
        <p>{person[5]} · Design & Technology</p>
        <div className="contact-chips">
        <span>{person[2]}</span>
        <span>+63 912 345 6789</span>
        <span>Makati City, Philippines</span>
        </div>
        </div>
        <Badge status={person[4]}/>
        </div>
        </Panel>
        <div className="stats-grid four section-gap section-bottom">
        <Stat label="Present days" value="142" icon="department" color="green"/>
        <Stat label="Absent days" value="8" icon="file" color="red"/>
        <Stat label="Late days" value="4" icon="clock" color="amber"/>
        <Stat label="Leave days" value="3" icon="leaves"/>
        </div>
        <Attendance employeeName={person[1]}/>
        </> : <Panel>
        <div className="table-toolbar">
        <span className="muted">Department directory</span>
        <Filter value={filter} options={['All employees', 'Active', 'Absent', 'On leave']} onChange={v => { setFilter(v); setPage(1); }}/>
        </div>
        <div className="table-scroll">
        <table>
        <thead>
        <tr>
        <th>Employee ID</th>
        <th>Name</th>
        <th>Contact</th>
        <th>Date of employment</th>
        <th>Status</th>
        <th>Actions</th>
        </tr>
        </thead>
        <tbody>{pageItems(filtered, page, 7).map(p => <tr key={p[0]}>
            <td className="strong-cell">{p[0]}</td>
            <td>
            <div className="person-cell">
            <span className="initials">{p[1].split(' ').map(n => n[0]).join('')}</span>
            <span>
            <strong>{p[1]}</strong>
            <small>{p[5]}</small>
            </span>
            </div>
            </td>
            <td>
            <a className="email-link" href={`mailto:${p[2]}`}>{p[2]}</a>
            </td>
            <td>{dateLabel(p[3])}</td>
            <td>
            <Badge status={p[4]}/>
            </td>
            <td>
            <button className="table-link" onClick={() => go(`department/${p[0]}`)}>View employee details &#8594;</button>
            </td>
            </tr>)}</tbody>
        </table>{!filtered.length && <Empty />}</div>
        <Pagination page={page} total={Math.ceil(filtered.length / 7)} onChange={setPage} count={filtered.length}/>
        </Panel>}</>;
}
export function ManagerTasks() {
    const { tasks, setTasks, screen, go, search, notify } = useDemo();
    const [tab, setTab] = useState('All submissions');
    const [assignee, setAssignee] = useState('');
    const [feedback, setFeedback] = useState('');
    const [preview, setPreview] = useState(false);
    const selected = tasks.find(t => t.id === Number(screen.split('/')[1]));
    const tabs = ['All submissions', 'Completed', 'In progress', 'Overdue', 'Not started', 'Pending approval'];
    const filtered = tasks.filter(t => (tab === 'All submissions' || t.status === tab) && `${t.title} ${t.assignee}`.toLowerCase().includes(search.toLowerCase()) && t.assignee.toLowerCase().includes(assignee.toLowerCase()));
    function decision(status: string) { if (!selected)
        return; setTasks(tasks.map(t => t.id === selected.id ? { ...t, status, progress: status === 'Completed' ? 100 : t.progress } : t)); notify(status === 'Completed' ? 'Submission approved in this demo.' : 'Revision requested in this demo.'); }
    return <>
    <Heading title="Task management" subtitle="Overview and management of department tasks." action={<button className="primary" onClick={() => go('tasks/create')}>
        <Icon name="plus" size={18}/>Create task</button>} back={selected ? 'tasks' : undefined}/>{selected ? <>
        <Panel>
        <div className="task-review-heading">
        <div>
        <div className="inline-heading">
        <h2>{selected.title}</h2>
        <Badge status={selected.status}/>
        </div>
        <p>Review project deliverables and verify completion against the assigned requirements.</p>
        </div>
        <div className="completion-box">
        <small>Completion rate</small>
        <strong>{selected.progress}%</strong>
        <small>Target deadline</small>
        <b>{dateLabel(selected.due)}</b>
        </div>
        </div>
        <div className="review-meta">
        <span>
        <Icon name="user" size={15}/>Assigned to <strong>{selected.assignee}</strong>
        </span>
        <span>
        <Icon name="calendar" size={15}/>{dateLabel(selected.due)}</span>
        <Badge status={selected.priority}/>
        <span>Department: Engineering & Design</span>
        </div>
        </Panel>
        <div className="review-columns section-gap">
        <Panel title="Milestone checklist">
        <div className="checklist">{['Core deliverables completed and reviewed', 'Quality checks and documentation verified', 'Supporting files attached for review'].map((text, i) => <label key={text}>
            <input type="checkbox" defaultChecked={i < (selected.progress === 100 ? 3 : 2)}/>{text}</label>)}</div>
        </Panel>
        <Panel title="Submission attachments">
        <div className="attachment">
        <Icon name="file" size={30}/>
        <div>
        <strong>Project deliverables.pdf</strong>
        <small>PDF document · 2.4 MB · Sample attachment</small>
        </div>
        </div>
        <button className="secondary small" onClick={() => setPreview(true)}>Preview sample</button>
        </Panel>
        <Panel title="Assignee submission notes">
        <p className="description">Completed the deliverables and incorporated the latest team feedback. Please review the attached summary and let me know if any revisions are needed.</p>
        </Panel>
        </div>
        <Panel title="Milestone compliance verification" className="section-gap">{selected.status === 'Completed' ? <div className="status-banner green">
            <Icon name="check"/>Approved</div> : <>
            <Field label="Manager sign-off & feedback">
            <textarea rows={4} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder={`Add feedback or revision instructions for ${selected.assignee.split(' ')[0]}…`}/>
            </Field>
            <div className="form-actions">
            <button className="secondary" onClick={() => decision('In progress')}>Request revision</button>
            <button className="primary" onClick={() => decision('Completed')}>
            <Icon name="check" size={17}/>Approve submission</button>
            </div>
            </>}</Panel>
        </> : <>
        <div className="stats-grid five section-bottom">
        <Stat label="Total tasks" value={tasks.length} icon="tasks"/>{['Not started', 'In progress', 'Completed', 'Overdue'].map(s => <Stat key={s} label={s} value={tasks.filter(t => t.status === s).length} color={s === 'Overdue' ? 'red' : s === 'Completed' ? 'green' : 'blue'} active={tab === s} onClick={() => setTab(s)}/>)}</div>
        <Panel>
        <div className="tabs" role="tablist" aria-label="Task status">{tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}<span>{t === 'All submissions' ? tasks.length : tasks.filter(x => x.status === t).length}</span>
            </button>)}</div>
        <div className="table-toolbar">
        <label className="inline-search">
        <Icon name="search" size={16}/>
        <input placeholder="Filter assignee…" aria-label="Filter assignee" value={assignee} onChange={e => setAssignee(e.target.value)}/>
        </label>
        <button className="secondary small" onClick={() => notify('Demo reminder prepared for incomplete tasks. No messages were sent.')}>Remind incomplete ({tasks.filter(t => t.status !== 'Completed').length})</button>
        </div>
        <div className="manager-task-list">{filtered.map(t => <div className="manager-task-row" key={t.id}>
            <div className="person-cell">
            <span className="initials">{t.assignee.split(' ').map(n => n[0]).join('')}</span>
            <span>
            <strong>{t.assignee}</strong>
            <small>{t.position}</small>
            </span>
            </div>
            <div>
            <h3>{t.title}</h3>
            <div className="task-row-meta">
            <Badge status={t.status}/>
            <small>Due {dateLabel(t.due)}</small>
            </div>
            <progress value={t.progress} max={100} aria-label={`${t.title}: ${t.progress}% complete`}/>
            </div>
            <button className={t.status === 'Pending approval' ? 'primary small' : 'secondary small'} onClick={() => go(`tasks/${t.id}`)}>{t.status === 'Pending approval' ? 'View submission' : t.status === 'In progress' ? 'Check progress' : 'View details'}</button>
            </div>)}{!filtered.length && <Empty />}</div>
        </Panel>
        </>}{preview && <Modal title="Sample submission preview" onClose={() => setPreview(false)}>
        <div className="document-preview">
        <Icon name="file" size={38}/>
        <h3>{selected?.title}</h3>
        <p>Deliverables summary</p>
        <ul>
        <li>Requirements and scope reviewed</li>
        <li>Implementation and supporting documentation complete</li>
        <li>Quality verification ready for manager sign-off</li>
        </ul>
        <small>This is illustrative content, not an uploaded document.</small>
        </div>
        </Modal>}</>;
}
export function TaskCreate() {
    const { setTasks, go, notify } = useDemo();
    const [subtasks, setSubtasks] = useState(['Draft initial report', 'Review with team lead']);
    const [priority, setPriority] = useState('Medium');
    function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const data = new FormData(e.currentTarget); setTasks(old => [{ id: Date.now(), title: String(data.get('title')), assignee: String(data.get('assignee')), position: 'Team member', due: String(data.get('due')), status: 'Not started', progress: 0, priority }, ...old]); notify('Task created in this demo.'); go('tasks'); }
    return <>
    <Heading title="Create new task" subtitle="Organize the work, set priorities, and help your team get started." back="tasks"/>
    <form onSubmit={submit}>
    <div className="form-with-aside">
    <div>
    <Panel>
    <Field label="Task title">
    <input name="title" required placeholder="e.g. Quarterly performance review"/>
    </Field>
    <Field label="Description">
    <textarea name="description" rows={6} required placeholder="Provide detailed instructions and expected deliverables…"/>
    </Field>
    </Panel>
    <Panel title="Subtasks" className="section-gap">
    <div className="subtask-list">{subtasks.map((s, i) => <div key={i}>
        <input aria-label={`Subtask ${i + 1}`} value={s} onChange={e => setSubtasks(subtasks.map((v, n) => n === i ? e.target.value : v))}/>
        <button type="button" className="icon-button" aria-label={`Remove subtask ${i + 1}`} onClick={() => setSubtasks(subtasks.filter((_, n) => n !== i))}>
        <Icon name="close" size={16}/>
        </button>
        </div>)}</div>
    <button type="button" className="table-link" onClick={() => setSubtasks([...subtasks, ''])}>+ Add subtask</button>
    </Panel>
    <Panel title="Attachments" className="section-gap">
    <Upload multiple/>
    </Panel>
    </div>
    <Panel>
    <Field label="Assignee">
    <select required name="assignee" defaultValue="">
    <option value="" disabled>Select a team member…</option>{employees.map(e => <option key={e[0]}>{e[1]}</option>)}</select>
    </Field>
    <Field label="Due date">
    <input required type="date" name="due"/>
    </Field>
    <Field label="Priority">
    <select value={priority} onChange={e => setPriority(e.target.value)}>{['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}</select>
    </Field>
    <p className="helper-text">This task will be added to the current demonstration session.</p>
    </Panel>
    </div>
    <div className="form-actions">
    <button type="button" className="secondary" onClick={() => go('tasks')}>Cancel</button>
    <button className="primary">Create task</button>
    </div>
    </form>
    </>;
}
export function ManagerLeaves() {
    const { leaves, setLeaves, search, screen, go, notify } = useDemo();
    const [filter, setFilter] = useState('All requests');
    const [page, setPage] = useState(1);
    const [comment, setComment] = useState('');
    const selected = leaves.find(l => l.id === Number(screen.split('/')[1]));
    const filtered = leaves.filter(l => (filter === 'All requests' || l.status === filter) && `${l.name} ${l.type} ${l.reason}`.toLowerCase().includes(search.toLowerCase()));
    function decide(status: string) { if (!selected)
        return; setLeaves(leaves.map(l => l.id === selected.id ? { ...l, status } : l)); notify(`Leave ${status.toLowerCase()} in this demo.`); }
    return <>
    <Heading title={selected ? 'Leave request review' : 'Leave requests'} subtitle={selected ? 'Review the request details and record your decision.' : 'Review and manage time-off requests for your department.'} back={selected ? 'leaves' : undefined}/>{selected ? <div className="form-with-aside">
        <div>
        <Panel>
        <div className="employee-detail-header">
        <span className="avatar">
        <Icon name="user"/>
        </span>
        <div>
        <h2>{selected.name}</h2>
        <small>EMP-042 · Marketing department</small>
        </div>
        <Badge status={selected.status}/>
        </div>
        <div className="detail-meta section-gap">
        <div>
        <small>Leave type</small>
        <strong>{selected.type}</strong>
        </div>
        <div>
        <small>Duration</small>
        <strong>{selected.days} days</strong>
        </div>
        </div>
        <div className="review-dates">
        <small>Requested dates</small>
        <strong>
        <Icon name="calendar" size={16}/>{dateLabel(selected.start)} &#8594; {dateLabel(selected.end)}</strong>
        </div>
        <div className="reason-box">
        <small>Reason provided</small>
        <p>“{selected.reason}”</p>
        </div>
        </Panel>
        <Panel title="Manager’s decision" className="section-gap">{selected.status === 'Approved' || selected.status === 'Declined' ? <div className="decision-result">
            <Badge status={selected.status}/>{comment && <p>{comment}</p>}<button className="table-link" onClick={() => decide('Pending')}>Reopen for review</button>
            </div> : <>
            <Field label="Comments (optional)">
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="Add any notes regarding this decision…"/>
            </Field>
            <div className="form-actions">
            <button className="danger-outline" onClick={() => decide('Declined')}>× Reject leave</button>
            <button className="primary" onClick={() => decide('Approved')}>
            <Icon name="check" size={16}/>Approve leave</button>
            </div>
            </>}</Panel>
        </div>
        <Panel title={`${selected.name.split(' ')[0]}’s balance`}>
        <div className="balance-detail">
        <span>Annual leave balance<strong>12 days remaining</strong>
        </span>
        <progress value={12} max={15}/>
        <p className="helper-text">Approving this request would leave {12 - selected.days} days in this illustrative balance. Review team coverage before making a decision.</p>
        </div>
        </Panel>
        </div> : <>
        <div className="stats-grid four section-bottom">{[['Pending requests', leaves.filter(l => /pending|requested/i.test(l.status)).length, 'clock'], ['Approved', leaves.filter(l => l.status === 'Approved').length, 'check'], ['Declined', leaves.filter(l => l.status === 'Declined').length, 'close'], ['Total requests', leaves.length, 'leaves']].map(([label, value, icon]) => <Stat key={label} label={String(label)} value={value} icon={String(icon)}/>)}</div>
        <Panel>
        <div className="table-toolbar">
        <Filter value={filter} onChange={v => { setFilter(v); setPage(1); }} options={['All requests', 'Requested', 'Pending', 'Approved', 'Declined']}/>
        </div>
        <div className="table-scroll">
        <table>
        <thead>
        <tr>
        <th>Employee</th>
        <th>Leave type</th>
        <th>Dates</th>
        <th>Duration</th>
        <th>Reason</th>
        <th>Status</th>
        <th>Actions</th>
        </tr>
        </thead>
        <tbody>{pageItems(filtered, page, 6).map(l => <tr key={l.id}>
            <td className="strong-cell">{l.name}</td>
            <td>{l.type}</td>
            <td>{dateLabel(l.start)}<br />
            <small>to {dateLabel(l.end)}</small>
            </td>
            <td>{l.days} days</td>
            <td className="reason-cell">{l.reason}</td>
            <td>
            <Badge status={l.status}/>
            </td>
            <td>
            <button className="table-link" onClick={() => { setComment(''); go(`leaves/${l.id}`); }}>Review &#8594;</button>
            </td>
            </tr>)}</tbody>
        </table>{!filtered.length && <Empty />}</div>
        <Pagination page={page} total={Math.ceil(filtered.length / 6)} onChange={setPage} count={filtered.length}/>
        </Panel>
        </>}</>;
}
export function AnnouncementEditor() { const { announcements, setAnnouncements, screen, go, name, notify } = useDemo(); const existing = announcements.find(a => a.id === Number(screen.split('/')[2])); return <AnnouncementEditorForm key={existing?.id || 'new'} existing={existing} save={(item) => { setAnnouncements(old => existing ? old.map(a => a.id === item.id ? item : a) : [item, ...old]); notify(`${item.status === 'Draft' ? 'Draft saved' : existing ? 'Announcement updated' : 'Announcement published'} in this demo.`); go('announcements'); }} author={name}/>; }
function AnnouncementEditorForm({ existing, save, author }: {
    existing?: Announcement;
    save: (a: Announcement) => void;
    author: string;
}) {
    const { go } = useDemo();
    const [category, setCategory] = useState(existing?.category || 'General');
    const [priority, setPriority] = useState(existing?.priority || 'Normal');
    const [publish, setPublish] = useState(existing?.status === 'Scheduled' ? 'Scheduled' : 'Published');
    const [draft, setDraft] = useState(false);
    const [preview, setPreview] = useState(false);
    const [title, setTitle] = useState(existing?.title || '');
    const [content, setContent] = useState(existing?.content || '');
    function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const data = new FormData(e.currentTarget); save({ id: existing?.id || Date.now(), title, content, category, priority, audience: String(data.get('audience')), author: existing?.author || author, date: String(data.get('date') || '2026-10-14'), status: draft ? 'Draft' : publish, pinned: data.get('pinned') === 'on' }); }
    return <>
    <Heading title={existing ? 'Edit posted announcement' : 'Post announcement'} subtitle="Broadcast important updates, policy changes, and company news." back="announcements" action={existing ? <button className="secondary" onClick={() => setPreview(true)}>Preview</button> : undefined}/>
    <form onSubmit={submit}>
    <div className="form-with-aside editor-layout">
    <Panel title="Announcement details">
    <Field label="Announcement title">
    <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q4 Town Hall Meeting & Performance Review"/>
    </Field>
    <Field label="Announcement content">
    <textarea required rows={existing ? 16 : 9} value={content} onChange={e => setContent(e.target.value)} placeholder="Write your announcement here. Share the details your team needs to know…"/>
    </Field>
    <Field label="Attachments">
    <Upload multiple/>
    </Field>
    <Field label="Category / tag">
    <select value={category} onChange={e => setCategory(e.target.value)}>{['General', 'HR policy', 'Urgent', 'Event', 'Maintenance'].map(c => <option key={c}>{c}</option>)}</select>
    </Field>
    <Field label="Target audience">
    <select name="audience" defaultValue={existing?.audience || 'All employees'}>{['All employees', 'Full-time staff', 'Marketing', 'Engineering', 'HR team', 'Sales'].map(a => <option key={a}>{a}</option>)}</select>
    </Field>
    <Field label="Priority level">
    <select value={priority} onChange={e => setPriority(e.target.value)}>{['Normal', 'Important', 'Urgent'].map(p => <option key={p}>{p}</option>)}</select>
    </Field>
    </Panel>
    <Panel title="Publishing options">
    <div className="publishing-options">
    <label>
    <input type="radio" name="publish" checked={publish === 'Published'} onChange={() => setPublish('Published')}/>Publish immediately</label>
    <label>
    <input type="radio" name="publish" checked={publish === 'Scheduled'} onChange={() => setPublish('Scheduled')}/>Schedule for later</label>{publish === 'Scheduled' && <Field label="Publish date">
        <input type="date" name="date" required defaultValue={existing?.date || ''}/>
        </Field>}<label>
    <input type="checkbox" defaultChecked/>Notify employees via email <small>Visual option only; no emails are sent.</small>
    </label>
    <label>
    <input type="checkbox" name="pinned" defaultChecked={existing?.pinned}/>Pin announcement to top of feed</label>
    </div>
    <div className="publishing-actions">
    <button className="primary" type="submit" onClick={() => setDraft(false)}>{existing ? 'Save & update' : publish === 'Scheduled' ? 'Schedule announcement' : 'Publish announcement'}</button>
    <button className="secondary" type="submit" onClick={() => setDraft(true)}>Save as draft</button>
    <button className="text-button" type="button" onClick={() => go('announcements')}>Cancel</button>
    </div>
    </Panel>
    </div>
    </form>{preview && <Modal title={title || 'Announcement preview'} onClose={() => setPreview(false)}>
        <div className="article-meta">
        <Badge status={priority}/>
        <span>{category}</span>
        </div>
        <div className="preview-content">{content}</div>
        </Modal>}</>;
}
