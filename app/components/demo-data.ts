export type Role = 'employee' | 'manager';
export type Task = {
    id: number;
    title: string;
    assignee: string;
    position: string;
    due: string;
    status: string;
    progress: number;
    priority: string;
};
export type Leave = {
    id: number;
    name: string;
    type: string;
    start: string;
    end: string;
    days: number;
    reason: string;
    status: string;
};
export type Announcement = {
    id: number;
    title: string;
    category: string;
    audience: string;
    author: string;
    date: string;
    status: string;
    priority: string;
    content: string;
    pinned: boolean;
};
export const initialTasks: Task[] = [
    { id: 1, title: 'Q4 Infrastructure Security & Compliance Audit', assignee: 'Marcus Vance', position: 'Sr. DevOps Lead', due: '2026-10-20', status: 'Pending approval', progress: 100, priority: 'High' },
    { id: 2, title: 'Design a packaging concept for EcoSip', assignee: 'John Doe', position: 'Product Designer', due: '2026-10-22', status: 'In progress', progress: 65, priority: 'Medium' },
    { id: 3, title: 'Q3 Performance Review', assignee: 'Elena Rostova', position: 'Cloud Architect', due: '2026-10-16', status: 'Completed', progress: 100, priority: 'High' },
    { id: 4, title: 'Implement service monitoring dashboards', assignee: 'Tariq Mansoor', position: 'IAM Engineer', due: '2026-10-23', status: 'In progress', progress: 75, priority: 'Medium' },
    { id: 5, title: 'Update incident response documentation', assignee: 'David Kim', position: 'Site Reliability Engineer', due: '2026-10-12', status: 'Overdue', progress: 40, priority: 'Urgent' },
    { id: 6, title: 'Review accessibility of employee portal', assignee: 'Priya Patel', position: 'Product Designer', due: '2026-10-28', status: 'Not started', progress: 0, priority: 'Low' },
    { id: 7, title: 'Refresh onboarding presentation', assignee: 'Chen Wei', position: 'Operations Specialist', due: '2026-10-25', status: 'Pending approval', progress: 100, priority: 'Medium' },
    { id: 8, title: 'Prepare monthly department report', assignee: 'John Doe', position: 'Product Designer', due: '2026-10-30', status: 'In progress', progress: 25, priority: 'Medium' },
];
export const initialLeaves: Leave[] = [
    { id: 1, name: 'Sarah Jenkins', type: 'Annual leave', start: '2026-10-19', end: '2026-10-21', days: 3, reason: 'Family trip to visit relatives out of town.', status: 'Requested' },
    { id: 2, name: 'Alex Lee', type: 'Annual leave', start: '2026-10-22', end: '2026-10-23', days: 2, reason: 'Family vacation out of town.', status: 'Approved' },
    { id: 3, name: 'John Doe', type: 'Sick leave', start: '2026-10-08', end: '2026-10-08', days: 1, reason: 'Medical appointment and recovery.', status: 'Approved' },
    { id: 4, name: 'Jane Doe', type: 'Personal leave', start: '2026-10-26', end: '2026-10-27', days: 2, reason: 'Personal family commitments.', status: 'Pending' },
    { id: 5, name: 'Adam Roy', type: 'Annual leave', start: '2026-10-05', end: '2026-10-07', days: 3, reason: 'Personal travel.', status: 'Declined' },
    { id: 6, name: 'Jasmin David', type: 'Sick leave', start: '2026-10-15', end: '2026-10-15', days: 1, reason: 'Scheduled medical consultation.', status: 'Requested' },
];
export const employees = [
    ['EMP-001', 'Jane Doe', 'jane.doe@worksync.demo', '2020-01-12', 'Active', 'Product Designer'],
    ['EMP-002', 'John Doe', 'john.doe@worksync.demo', '2021-02-28', 'Absent', 'UX Designer'],
    ['EMP-003', 'Jake Doe', 'jake.doe@worksync.demo', '2019-04-11', 'Active', 'Frontend Developer'],
    ['EMP-004', 'Jasmin David', 'jasmin.david@worksync.demo', '2022-06-18', 'On leave', 'QA Analyst'],
    ['EMP-005', 'Adam Roy', 'adam.roy@worksync.demo', '2023-03-06', 'On leave', 'UI Designer'],
    ['EMP-006', 'Marcus Vance', 'marcus.vance@worksync.demo', '2018-08-20', 'Active', 'DevOps Lead'],
    ['EMP-007', 'Sarah Jenkins', 'sarah.jenkins@worksync.demo', '2021-09-13', 'Active', 'Marketing Specialist'],
    ['EMP-008', 'Elena Rostova', 'elena.rostova@worksync.demo', '2020-11-02', 'Active', 'Cloud Architect'],
];
export const initialAnnouncements: Announcement[] = [
    { id: 1, title: 'Q3 Company Town Hall & Strategy Review', category: 'Event', audience: 'All employees', author: 'Jane Doe', date: '2026-10-20', status: 'Published', priority: 'Urgent', content: 'Join us for our company town hall as we reflect on our achievements, share key milestones, and discuss our strategic priorities for the next quarter.\n\nHear updates from our leadership team, explore upcoming initiatives, and bring your questions for the live Q&A session.', pinned: true },
    { id: 2, title: 'Networking Event', category: 'Event', audience: 'All employees', author: 'Mark Smith', date: '2026-10-24', status: 'Published', priority: 'Important', content: 'Open networking. Fresh ideas. New opportunities. Connect with colleagues across departments for an afternoon of conversations and collaboration.', pinned: true },
    { id: 3, title: 'Updated Remote Work Expense Guidelines', category: 'HR policy', audience: 'Full-time staff', author: 'Mark Smith', date: '2026-10-18', status: 'Published', priority: 'Normal', content: 'Our remote work expense guidelines have been updated. Please review the new reimbursement limits and submit supporting receipts with your next expense report.', pinned: false },
    { id: 4, title: 'Scheduled System Maintenance', category: 'Maintenance', audience: 'Engineering', author: 'Alex Lee', date: '2026-10-25', status: 'Scheduled', priority: 'Important', content: 'Planned infrastructure maintenance will take place this weekend from 10 PM to midnight. Please save your work before the maintenance window.', pinned: false },
    { id: 5, title: 'Annual Holiday Party Coordination', category: 'Event', audience: 'All employees', author: 'Sarah Connor', date: '2026-11-06', status: 'Draft', priority: 'Normal', content: 'Help us plan our annual celebration. Share your suggestions for activities and let the organizing team know if you would like to volunteer.', pinned: false },
];
export const attendance = Array.from({ length: 28 }, (_, i) => ({ date: `2026-10-${String(28 - i).padStart(2, '0')}`, time: i % 6 === 2 ? '—' : i % 5 === 1 ? '9:18 AM – 6:00 PM' : '8:55 AM – 5:50 PM', duration: i % 6 === 2 ? '—' : '8h 12m', status: i % 6 === 2 ? 'Absent' : i % 5 === 1 ? 'Late' : 'On time' }));
export function dateLabel(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
