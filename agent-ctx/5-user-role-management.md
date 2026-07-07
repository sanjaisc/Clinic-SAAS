# Task 5 — Section D: User & Role Management

## Files Created (7 files, 7 endpoints)

### API Routes
1. **`src/app/api/staff/admin/users/route.ts`**
   - `GET` — Lists ALL staff users with clinic name, invitation info, inviter name (from StaffInvitation.createdBy → User.name)
   - `POST` — Creates user directly with password hashing (bcrypt), role/clinic validation, duplicate email check

2. **`src/app/api/staff/admin/users/[id]/route.ts`**
   - `PATCH` — Edit user: change name, role, clinic binding, active status, reset password. Prevents self-deactivation.
   - `DELETE` — Soft-deactivate (sets isActive=false, never hard deletes)

3. **`src/app/api/staff/admin/users/invite/route.ts`**
   - `POST` — Sends invitation with role selection (CLINIC_ADMIN or CLINIC_RECEPTION). Validates clinic, checks duplicate users/invitations, generates secure token, sends email.

4. **`src/app/api/staff/admin/users/invitations/route.ts`**
   - `GET` — Lists ALL StaffInvitation records across all clinics, enriched with creator name, acceptor name, computed status (Pending/Accepted/Expired)

5. **`src/app/api/staff/admin/users/clinics/route.ts`**
   - `GET` — Lists all clinics for dropdown population

### Page
6. **`src/app/staff/dashboard/admin/users/page.tsx`** — `"use client"` page with 3 cards

### Modified
7. **`src/lib/constants.ts`** — Added `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `USER_PASSWORD_RESET` audit actions

## Key Patterns Used
- SYSTEM_MANAGER auth check: `session.user.role !== "SYSTEM_MANAGER"` → 403
- `getServerSession(authOptions)` from `@/lib/auth`
- `db` from `@/lib/db`
- `hashPassword` from `@/lib/crypto`
- Dynamic params: `{ params }: { params: Promise<{ id: string }> }` + `const { id } = await params;`
- `createAuditLog` from `@/lib/audit`
- All files pass ESLint (0 errors in new code)