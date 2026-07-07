# Task 6 — Section E: Platform-Wide Appointment & Exception Oversight

## Files Created (6 total)

### API Routes (5 files, 5 endpoints)

1. **`src/app/api/staff/admin/appointments/route.ts`** — `GET /api/staff/admin/appointments`
   - Global appointment search across ALL clinics (E1)
   - Query params: `search`, `status`, `clinicId` (optional), `dateFrom`, `dateTo`, `page`, `limit`
   - Includes clinic name, provider name, service name via Prisma `include`
   - SYSTEM_MANAGER auth guard only — no clinic scope check

2. **`src/app/api/staff/admin/appointments/[id]/status/route.ts`** — `PATCH /api/staff/admin/appointments/[id]/status`
   - Manual status override (E4) — cancel, no-show, complete, check-in, archive
   - Takes: `status`, optional `cancellationReason`
   - Sets `cancelledBy: session.user.id`, `cancelledAt`
   - Releases slot back to AVAILABLE on cancel/no-show
   - Audit logging with appropriate action type
   - No clinic scope check — system manager override

3. **`src/app/api/staff/admin/appointments/[id]/refund/route.ts`** — `POST /api/staff/admin/appointments/[id]/refund`
   - Manual refund override (E4)
   - Takes: `amountCents` (number), `reason` (string, required)
   - Creates REFUND ledger entry with `refundStatus: "REFUNDED"`
   - Updates appointment `paymentStatus` to "REFUNDED"
   - Prevents double-refund (checks existing paymentStatus)
   - Audit logging

4. **`src/app/api/staff/admin/waitlist/route.ts`** — `GET /api/staff/admin/waitlist`
   - Aggregated waitlist across ALL clinics (E2)
   - Query params: `status` (comma-separated), `clinicId` (optional)
   - Includes clinic name, provider name, service name
   - Sorted by `createdAt desc`
   - SYSTEM_MANAGER auth guard

5. **`src/app/api/staff/admin/patient-matches/route.ts`** — `GET /api/staff/admin/patient-matches`
   - Ambiguous patient matches (E3)
   - Groups appointments by normalized email or phone
   - Returns only groups with 2+ appointments where:
     - Patient names differ (`hasNameMismatch: true`), OR
     - Appointments are for different clinics (`hasCrossClinic: true`)
   - Deduplicates appointments across email/phone groups
   - Sorted by `hasNameMismatch` priority, then by match value

### Frontend Page (1 file)

6. **`src/app/staff/dashboard/admin/appointments/page.tsx`** — 3-tab client page

#### Tab 1: Global Appointments (E1, E4)
- Search bar: patient name, email, phone, or booking token
- Filters: Status dropdown, Clinic dropdown (populated from `/api/staff/admin`), Date range inputs
- Table columns: Patient, Clinic, Provider, Service, Date/Time, Status (colored badge), Payment, Modality
- Expandable row details: Phone, DOB, Patient Type, Reason, Payment Method, Self-Pay, Cancel Reason, Appointment ID
- Row actions: Cancel (with reason dialog), Mark No-Show, Complete, Refund (amount+reason dialog)
- Pagination with page navigation

#### Tab 2: Waitlist Oversight (E2)
- Filters: Status (default: Active+Offered), Clinic
- Table: Patient, Clinic, Provider, Service, Date Range, Status (colored badge), Contact Count
- Refresh button

#### Tab 3: Patient Matches (E3)
- Accordion-style match groups
- Email icon (blue) or Phone icon (emerald) per group
- "Name Mismatch" amber badge, "Cross-Clinic" purple badge
- Merge button (marks as reviewed via toast — placeholder)
- Expandable detail table per group

## Patterns Used
- `getServerSession(authOptions)` + `STAFF_ROLE.SYSTEM_MANAGER` check
- `db` from `@/lib/db`
- `createAuditLog` from `@/lib/audit`
- Dynamic params: `{ params }: { params: Promise<{ id: string }> }` and `const { id } = await params;`
- shadcn/ui: Tabs, Card, Table, Dialog, Select, Badge, Button, Input, Textarea, Label, Skeleton
- Lucide icons throughout
- ESLint: 0 new errors