# Task 13-b — Build Patient Review Submission System

## Summary
Built the complete patient review submission system for ClinicBook, including API endpoints, a dedicated review page with interactive star ratings, integration into the patient portal, and review token generation during booking.

## Files Created
1. **`/src/app/api/reviews/route.ts`** — POST endpoint for review submission (token validation, transaction with review creation + token consumption + provider rating update, audit log, cache invalidation)
2. **`/src/app/api/providers/[id]/reviews/route.ts`** — GET endpoint for public provider reviews (paginated, masked patient names)
3. **`/src/app/review/[token]/page.tsx`** — "use client" review submission page (star selectors, comment textarea, loading/error/success states, emerald theme)

## Files Modified
4. **`/src/lib/constants.ts`** — Added `REVIEW_SUBMITTED` audit action
5. **`/src/app/manage/[token]/page.tsx`** — Added "Leave a Review" button for completed appointments
6. **`/src/app/api/appointments/route.ts`** — Added REVIEW token generation (30-day expiry after appointment end)

## Lint Result
`bun run lint` — 0 errors