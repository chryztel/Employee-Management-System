'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
const paths: Record<string, ReactNode> = {
    dashboard: <>
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    </>,
    tasks: <>
    <rect x="5" y="4" width="14" height="17" rx="2"/>
    <path d="M9 3h6v4H9zM9 12l1 1 2-2m2 1h2m-7 5 1 1 2-2m2 1h2"/>
    </>,
    attendance: <>
    <circle cx="6" cy="6" r="2"/>
    <path d="M3 13v-2h6v2M3 20v-2h6v2M13 5h8m-8 7h8m-8 7h8"/>
    </>,
    department: <>
    <circle cx="9" cy="7" r="3"/>
    <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>
    </>,
    leaves: <>
    <path d="M3 17V5h7l2 3h9v7M3 17h9m7-3-4 4 4 4m-4-4h7"/>
    </>,
    announcements: <>
    <path d="m4 10 15-6v13L4 14zM7 15l2 6h4l-2-5M22 8v4M2 10v4"/>
    </>,
    search: <>
    <circle cx="10" cy="10" r="7"/>
    <path d="m15 15 6 6"/>
    </>,
    user: <>
    <circle cx="12" cy="7" r="4"/>
    <path d="M4 21a8 8 0 0 1 16 0z"/>
    </>,
    logout: <>
    <path d="M10 3H4v18h6m5-14 5 5-5 5m-7-5h12"/>
    </>,
    arrow: <path d="m14 5-7 7 7 7m-7-7h14"/>,
    plus: <path d="M12 4v16M4 12h16"/>,
    check: <path d="m5 12 4 4L20 5"/>,
    clock: <>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v6l4 2"/>
    </>,
    calendar: <>
    <rect x="3" y="5" width="18" height="16" rx="2"/>
    <path d="M7 2v6m10-6v6M3 11h18"/>
    </>,
    upload: <>
    <path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>
    </>,
    pin: <>
    <path d="m14 3 7 7-4 1-4 6-6-6 6-4zM8 16l-5 5"/>
    </>,
    menu: <path d="M3 6h18M3 12h18M3 18h18"/>,
    eye: <>
    <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/>
    <circle cx="12" cy="12" r="3"/>
    </>,
    close: <path d="m5 5 14 14M5 19 19 5"/>,
    filter: <path d="M3 4h18l-7 8v7l-4 2v-9z"/>,
    file: <>
    <path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h6"/>
    </>,
};
export function Icon({ name, size = 20 }: {
    name: string;
    size?: number;
}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.tasks}</svg>; }
export function tone(status: string) { if (/approved|completed|active|on time|published/i.test(status))
    return 'green'; if (/declined|overdue|absent|urgent|rejected/i.test(status))
    return 'red'; if (/pending|late|leave|scheduled|high/i.test(status))
    return 'amber'; if (/progress|requested|important/i.test(status))
    return 'teal'; return 'neutral'; }
export function Badge({ status }: {
    status: string;
}) {
    return <span className={`badge ${tone(status)}`}>
    <span className="dot"/>{status}</span>;
}
export function Stat({ label, value, icon = 'tasks', color = 'blue', onClick, active }: {
    label: string;
    value: string | number;
    icon?: string;
    color?: string;
    onClick?: () => void;
    active?: boolean;
}) {
    const content = <>
    <span className={`stat-icon ${color}`}>
    <Icon name={icon} size={23}/>
    </span>
    <span>
    <strong>{value}</strong>
    <span className="stat-label">{label}</span>
    </span>
    </>;
    return onClick ? <button className={`stat ${active ? 'selected' : ''}`} onClick={onClick}>{content}</button> : <div className="stat">{content}</div>;
}
export function Panel({ title, action, children, className = '' }: {
    title?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return <section className={`panel ${className}`}>{title && <div className="panel-heading">
        <h2>{title}</h2>{action}</div>}{children}</section>;
}
export function Filter({ value, onChange, options, label = 'Filter by' }: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    label?: string;
}) {
    return <label className="filter">
    <Icon name="filter" size={16}/>
    <span className="sr-only">{label}</span>
    <select value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o}>{o}</option>)}</select>
    </label>;
}
export function pageItems<T>(items: T[], page: number, size: number): T[] {
    const current = Math.min(page, Math.max(1, Math.ceil(items.length / size)));
    return items.slice((current - 1) * size, current * size);
}
export function Pagination({ page: requestedPage, total, onChange, count }: {
    page: number;
    total: number;
    onChange: (n: number) => void;
    count?: number;
}) {
    const page = Math.min(requestedPage, Math.max(1, total));
    return <div className="pagination">
    <span>{count !== undefined ? `${count} results` : ''}</span>
    <div>
    <button aria-label="Previous page" disabled={page === 1} onClick={() => onChange(page - 1)}>‹</button>{Array.from({ length: Math.max(1, total) }, (_, i) => <button key={i} aria-label={`Page ${i + 1}`} aria-current={page === i + 1 ? 'page' : undefined} className={page === i + 1 ? 'current' : ''} onClick={() => onChange(i + 1)}>{i + 1}</button>)}<button aria-label="Next page" disabled={page >= total} onClick={() => onChange(page + 1)}>›</button>
    </div>
    </div>;
}
export function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) {
    return <label className="field">
    <span>{label}</span>{children}</label>;
}
export function PasswordField({ label, name }: {
    label: string;
    name?: string;
}) {
    const [visible, setVisible] = useState(false);
    return <Field label={label}>
    <span className="password-input">
    <input name={name} maxLength={128} type={visible ? 'text' : 'password'} autoComplete={name === 'oldPassword' ? 'current-password' : 'new-password'} placeholder="••••••••••••"/>
    <button type="button" onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}>
    <Icon name="eye" size={18}/>
    </button>
    </span>
    </Field>;
}
export function Upload({ label = 'Click to upload or drag and drop', multiple = false }: {
    label?: string;
    multiple?: boolean;
}) {
    const [files, setFiles] = useState<string[]>([]);
    return <span className="upload" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); setFiles(Array.from(e.dataTransfer.files).map(f => f.name)); }}>
    <Icon name="upload" size={25}/>
    <strong>{files.length ? files.join(', ') : label}</strong>
    <small>PDF, DOCX, PNG or JPG · local preview only</small>
    <input type="file" aria-label={label} multiple={multiple} onChange={e => setFiles(Array.from(e.target.files || []).map(f => f.name))}/>
    </span>;
}
export function Modal({ title, children, onClose }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const headingId = useId();
    useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
    return <dialog ref={dialog} aria-labelledby={headingId} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget)
        onClose(); }}>
    <div className="modal-heading">
    <h2 id={headingId}>{title}</h2>
    <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
    <Icon name="close"/>
    </button>
    </div>{children}</dialog>;
}
export function Empty() {
    return <div className="empty">
    <Icon name="search" size={28}/>
    <h3>No matching results</h3>
    <p>Try another search or filter.</p>
    </div>;
}
