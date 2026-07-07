---
Task ID: 2d
Agent: Section E/F/G Builder
Task: Build Hours & Closures, Communications & Intake, Staff Onboarding pages + APIs

Work Log:
- Created 16 files total (10 API routes + 3 page components + 3 directories)
- **Section E — Hours & Closures API** (3 files, 6 endpoints):
  - `GET /api/staff/hours` — Returns parsed hoursOfOperation JSON + closures
  - `PATCH /api/staff/hours` — Validates day keys and range format, saves as JSON
  - `GET /api/staff/closures` — Lists closures ordered by startDate
  - `POST /api/staff/closures` — Creates closure with date validation, recurring support
  - `PATCH /api/staff/closures/[id]` — Updates closure fields
  - `DELETE /api/staff/closures/[id]` — Deletes closure with ownership check
- **Section F — Communications API** (4 files, 6 endpoints):
  - `GET /api/staff/communications` — Returns email settings, intake config, templates, available services
  - `PATCH /api/staff/communications` — Updates sender settings, commonInstructions, intake config
  - `GET /api/staff/email-templates` — Lists all templates for clinic
  - `GET/PUT /api/staff/email-templates/[id]` — Get/update template (subject, bodyHtml, isActive)
  - `POST /api/staff/email-templates/reset/[id]` — Resets template to built-in system defaults
- **Section G — Staff Onboarding API** (3 files, 4 endpoints):
  - `GET /api/staff/invitations` — Lists invitations with acceptedBy name enrichment
  - `POST /api/staff/invitations` — Generates secure token, hashes, sends via sendStaffEmail, returns link
  - `DELETE /api/staff/invitations/[id]` — Revokes invitation
  - `POST /api/staff/invitations/[id]/resend` — Regenerates token, resends email
- **Section E — Hours Page** (`hours/page.tsx`):
  - 7-day weekly hours with toggle per day, multiple time ranges (add/remove)
  - Save button with change detection
  - Closures list with color-coding (amber=upcoming, muted=past)
  - Add/Edit closure dialog with recurring toggle and YEARLY recurrence rule
  - Full loading states, validation, toast notifications
- **Section F — Communications Page** (`communications/page.tsx`):
  - Card 1: MDXEditor safe-mode WYSIWYG for commonInstructions (Bold/Italic/Underline/Lists toolbar)
  - Card 2: Email from name + custom header inputs
  - Card 3: Intake reminder cadence dropdown (5 options), service-to-formId mapping table
  - Card 4: Email template editor with type selector tabs, subject input, MDXEditor body, active toggle, reset to default
- **Section G — Staff Page** (`staff/page.tsx`):
  - Card 1: Current staff table (derived from accepted invitations)
  - Card 2: Invite form with email validation, success state showing copyable invitation link
  - Card 3: All invitations list with status badges (Pending/Accepted/Expired), resend/revoke actions
- All API routes use auth guard (getServerSession), clinic ownership check, audit logging, cache invalidation
- Lint passes with zero errors

Files Created:
- `/src/app/api/staff/hours/route.ts`
- `/src/app/api/staff/closures/route.ts`
- `/src/app/api/staff/closures/[id]/route.ts`
- `/src/app/api/staff/communications/route.ts`
- `/src/app/api/staff/email-templates/route.ts`
- `/src/app/api/staff/email-templates/[id]/route.ts`
- `/src/app/api/staff/email-templates/reset/[id]/route.ts`
- `/src/app/api/staff/invitations/route.ts`
- `/src/app/api/staff/invitations/[id]/route.ts`
- `/src/app/api/staff/invitations/[id]/resend/route.ts`
- `/src/app/staff/dashboard/settings/hours/page.tsx`
- `/src/app/staff/dashboard/settings/communications/page.tsx`
- `/src/app/staff/dashboard/settings/staff/page.tsx`

Stage Summary:
- All 3 sections (E, F, G) fully implemented with frontend pages and backend APIs
- 16 API endpoints, 3 full-featured client pages
- MDXEditor safe-mode integration for WYSIWYG editing (common instructions + email templates)
- Secure staff invitation system with crypto tokens and one-time-use links
- Zero lint errors