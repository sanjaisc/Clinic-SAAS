# ClinicBook — Agent Instructions

## Quick start

```bash
bun dev              # next dev -p 3000
bun run build        # standalone build + static copy
bun run lint         # ESLint — most rules disabled, near no-op
bun run db:push      # prisma db push (SQLite, no migration files)
bun run db:generate  # prisma generate
bunx tsx prisma/seed.ts  # seed demo data (6 clinics, 16 providers, staff accounts)
```

## Architecture

- **Framework**: Next.js 16 App Router. TS strict but `noImplicitAny: false`.
- **Package manager**: Bun (not npm/pnpm). Lockfile = `bun.lock`.
- **Database**: SQLite via Prisma ORM 6. No migration files — `db:push` is the default workflow. ENUMs don't exist at DB layer; validated at app layer via `src/lib/enums.ts` (`as const` objects + type extractors).
- **Auth**: NextAuth v4 (JWT, 30-day expiry, credentials provider). Staff-only — no patient accounts. Session user has `role` + `clinicId`. SYSTEM_MANAGER has `clinicId: null`.
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York, RSC enabled). CSS variables in `globals.css`.
- **State**: Zustand (client) + TanStack React Query 5 (server).
- **Charts**: Recharts 2.
- **Path alias**: `@/` maps to `src/`.
- **Build**: `output: "standalone"` + manual `.next/static` + `public` copy to `.next/standalone/`.
- **Type errors never block build** — `next.config.ts` has `typescript.ignoreBuildErrors: true`.

## Key structural facts

- **No testing infrastructure** — zero test files, zero test dependencies in package.json.
- **Middleware does NOT run.** The file `src/proxy.ts` exports `proxy()` function + `config` but no `middleware()`. No `middleware.ts` exists anywhere in the project. RBAC route protection is not actually enforced at the edge.
- **Patients are anonymous** — no accounts. Pages at `intake/[token]`, `manage/[token]`, `review/[token]` use single-purpose tokens. Booking flow: search → slot lock (ACQUIRE) → appointment create (BOOK) → lock release (RELEASE).
- **Cache is in-memory** — `src/lib/cache.ts` (TTL `MemoryCache`, not Redis). Drop-in replacement pattern.
- **Staff roles** (ascending): `CLINIC_RECEPTION` → `CLINIC_ADMIN` → `SYSTEM_MANAGER`. Defined in `src/lib/enums.ts` as `STAFF_ROLE`.
- **Enum constants** live in `src/lib/enums.ts` — always import from there, never hardcode status strings.

## API conventions

- **Public** (no auth): `api/clinics`, `api/search/providers`, `api/slots/[id]/lock`, `api/appointments`, `api/reviews`, `api/intake`, `api/manage`, `api/waitlist`.
- **Staff** (NextAuth required): all under `api/staff/`. Route handler pattern: `getServerSession(authOptions)` → cast user → check role → use `db` from `@/lib/db`.
- **SYSTEM_MANAGER-only**: `api/staff/admin/`, `api/staff/admin/clinics`.
- **Slot lock endpoint** is special: POST acquires, DELETE releases. Used by public booking wizard.

## Staff dashboard pages

- `/staff/dashboard` — per-clinic dashboard (stats, today's schedule, activity)
- `/staff/dashboard/analytics` — "Platform Analytics", supports `__all` aggregate mode for SYSTEM_MANAGER
- `/staff/dashboard/admin` — admin panel (SYSTEM_MANAGER only)
- `/staff/dashboard/book` — manual booking
- `/staff/dashboard/calendar` — calendar view
- `/staff/dashboard/appointments` — appointment management
- `/staff/dashboard/slots` — slot management
- `/staff/dashboard/settings/*` — clinic settings

## Seed accounts (from `prisma/seed.ts`)

| Role | Email | Password |
|------|-------|----------|
| SYSTEM_MANAGER | `sysadmin@clinicbook.com` | `sysadmin123` |
| CLINIC_ADMIN | `admin@{clinic}.clinicbook.com` | `admin123` |
| CLINIC_RECEPTION | `reception@{clinic}.clinicbook.com` | `reception123` |

Clinics in seed data: 6 NYC-located clinics (Midtown Dental, Uptown Cardiology, etc.).

## Operational gotchas

- `bun run build` succeeds even with TS errors. Use `bunx tsc --noEmit` for real type checking.
- `src/libs/` (with 's') is NOT the utils directory — all lib code is in `src/lib/` (no 's').
- The analytics API route (`api/staff/analytics`) uses `clinicFilter` spread (`...clinicFilter`) in all where clauses to support `__all` mode. Always add `...clinicFilter` when adding new queries.
- Revenue amounts are stored in **cents** throughout the codebase. Use `fmtCents()` helper (defined in analytics page and reusable patterns) to display.
- Staff dashboard components share a `useClinicContext()` hook that provides `clinicId`, `clinics[]`, `isSystemManager`, `setClinicId`.
- `next-intl` is installed but not configured in middleware (the middleware doesn't run anyway). Internationalization may be incomplete.
