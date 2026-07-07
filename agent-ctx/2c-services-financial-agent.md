# Task 2c — Sections C & D: Services/Insurance + Financial/Policy

## Summary
Built complete Services & Insurance Configuration (Section C) and Financial & Policy Rules (Section D) settings pages with all backend API routes for the Clinic Admin Dashboard.

## Files Created

### API Routes (5 files, 8 endpoints)
1. **`src/app/api/staff/services/route.ts`** — GET: global services by specialty, clinic insurances, selfPayFlatRateCents, provider assignments (cached 60s)
2. **`src/app/api/staff/services/clinic/route.ts`** — PATCH: update clinic selfPayFlatRateCents
3. **`src/app/api/staff/services/assign/route.ts`** — POST: assign service to provider, DELETE: remove service from provider
4. **`src/app/api/staff/services/[serviceId]/payment-type/route.ts`** — PATCH: update Service.selfPayPaymentType
5. **`src/app/api/staff/financial/route.ts`** — GET: all financial/policy settings + system bounds, PATCH: update deposits/lead times/policy with validation

### Frontend Pages (2 files)
6. **`src/app/staff/dashboard/settings/services/page.tsx`** — Self-Pay Flat Rate card + Service Catalog (search, assign/remove providers, payment type dropdown)
7. **`src/app/staff/dashboard/settings/financial/page.tsx`** — Deposit Configuration, Cancellation Policies, Reschedule Policy, Self-Pay Payment Type, Save All button

## Key Design Decisions
- All deposits validated against SystemConfig min/max bounds
- Hours-to-minutes conversion for cancellation lead times
- Payment type changes in financial page are batched with the "Save All" request
- Provider assignment checks that provider belongs to the requesting clinic
- Duplicate assignment prevention via unique constraint
- Cache invalidation on all mutations (services + financial caches)

## Lint Result
`bun run lint` — 0 errors