# WorkSync portal demonstration

Entry points: `/employee` and `/manager`. `/` opens the Employee demo.
Navigation uses URL fragments, so views can be bookmarked and browser Back/Forward works. Mock changes remain in the current portal's React state and reset on reload or switching portals. Production access now uses Supabase authentication and server-side role guards; the demo role switch has been removed. See AUTH_SETUP.md.

## Reference inventory and implemented views

| Role | View | Fragment | Reference states / interactions |
| --- | --- | --- | --- |
| Employee | Dashboard | `#dashboard` | Attendance totals, leave totals, task previews, announcement cards, shortcuts |
| Both | Profile settings | `#profile` | Personal details, password visibility, contact information, local profile update |
| Employee | Attendance record | `#attendance` | Overview chart, working-time totals, all/on-time/absent/late filters, week navigation |
| Employee | Assigned tasks | `#tasks` | Status summary cards, all/currently working/completed/pending approval/overdue/not-started filters, pagination |
| Employee | Task details | `#tasks/2` (or another mock ID) | Currently working, completed, overdue, pending approval; comments, local file selection and submission |
| Employee | Leave history | `#leaves` | Allowance summary, all/approved/declined/requested/pending filters, pagination |
| Employee | Request leave | `#leaves/new` | Leave type dropdown, reason, date range validation, duration, supporting file input, submit/cancel |
| Employee | Announcements | `#announcements` | Priority filter, pinned indicators, cards, inline content expansion |
| Manager | Dashboard | `#dashboard` | Six summary cards, recent tasks, attendance overview, task progress, recent leave requests |
| Manager | My department | `#department` | Directory, active/absent/on-leave filter, search, pagination |
| Manager | Employee details | `#department/EMP-001` | Profile/contact details, attendance totals, filtered attendance table |
| Manager | Task management | `#tasks` | Summary cards, all submissions/completed/in-progress/overdue/not-started/pending approval tabs, assignee filter, reminder feedback |
| Manager | Task review / progress | `#tasks/1` | Submission review, progress, sample attachment preview, milestone checklist, feedback, approve/revision, approved state |
| Manager | Create task | `#tasks/create` | Title, description, editable subtasks, attachments, assignee, due date, priority, create/cancel |
| Manager | Leave requests | `#leaves` | Summary cards, request table, status filter, pagination |
| Manager | Leave review | `#leaves/1` | Request details, balance, comments, approve/reject, approved/declined states, reopen review |
| Manager | Announcement dashboard | `#announcements` | Summary cards, priority/status filters, list, pagination, edit/delete |
| Manager | Post announcement | `#announcements/new` | Title/content, attachments, category, audience, priority, publishing/scheduling, email/pin options, publish/draft/cancel |
| Manager | Edit announcement | `#announcements/edit/1` | Prefilled form, preview, save/update, draft |

The references do not show a distinct portal modal design. Small native dialogs provide demo logout feedback, sample document preview, announcement preview, and local deletion confirmation. They are not additional portal pages.

## Shared implementation

- `app/components/portal.tsx`: shared shell, hash navigation, session-local demo state.
- `app/components/ui.tsx`: icons, cards, status badges, tables helpers, filters, pagination, fields, upload selectors, native dialogs.
- `app/components/screens.tsx`: Employee views and shared dashboard/profile/attendance/announcement views.
- `app/components/manager-screens.tsx`: department, task review/create, leave review, announcement editor.
- `app/components/demo-data.ts`: typed mock records.
- `app/globals.css`: shared blue palette and responsive desktop/tablet/mobile layouts.

## Scope and reference gaps

- Business modules remain local demo UI. Authentication, real credential updates, session logout, and role authorization are implemented separately; see AUTH_SETUP.md.
- Files are selected locally and displayed by name; nothing is uploaded. Document previews are illustrative. Email, scheduling, and reminders are demo options without external effects.
- Uses the official `worksync-logo.png` with its 372:154 aspect ratio. Event cards temporarily reuse `worksync-activate.png`; the exact networking-event photo is missing.
- Manager screens were supplied as zoomed-out/cropped Figma canvas screenshots. Some small labels, employee details, and editor controls are unreadable; visible structure is retained with realistic mock text and native form controls.
- No dedicated mobile references were supplied. Responsive behavior is derived from the desktop layouts.
- Browser visual and interaction verification is pending: this session has no available browser surface. TypeScript, ESLint, production build, and HTTP route checks are the available validation.
