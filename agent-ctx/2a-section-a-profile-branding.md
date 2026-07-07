---
Task ID: 2a
Agent: Section A — Clinic Profile & Branding
Task: Build Profile settings page + all backend API routes (A.1–A.4)

Work Log:
- Created `src/app/api/staff/clinic-profile/route.ts` — GET (full clinic profile with amenities, provider languages, parsed FAQ/gallery) + PATCH (core details: name, tagline, about, phone, email, website, address, city, state, zip, lat, long)
- Created `src/app/api/staff/clinic-profile/upload/route.ts` — POST image upload with FormData (file, type, crop JSON). Uses `sharp` for server-side resize/crop to WebP. Supports logo (1:1→400x400), cover (16:9→1200x675), gallery (16:9→1200x675), provider-photo (1:1→400x400). Validates MIME/size (5MB max). Saves to `public/uploads/clinic/`.
- Created `src/app/api/staff/clinic-profile/media/route.ts` — DELETE media URL from clinic (logo, cover, or gallery item). Removes file from disk (best effort).
- Created `src/app/api/staff/clinic-profile/experience/route.ts` — GET (parking, visit, faq + all available amenities/languages for selection) + PATCH (parkingInstructions, visitInstructions, faq JSON validation)
- Created `src/app/api/staff/clinic-profile/amenities/route.ts` — PATCH replaces all clinic amenities via atomic transaction (deleteMany + createMany)
- Created `src/app/api/staff/clinic-profile/languages/route.ts` — PATCH replaces provider languages via atomic transaction (validates provider belongs to clinic)
- Created `src/app/staff/dashboard/settings/profile/page.tsx` — Full `'use client'` page with 5 cards:
  - Card 1: Core Details (Name, Tagline, Phone, Email, Website) with save button
  - Card 2: About Content with MDXEditor (headings, lists, quote, thematic break, markdown shortcuts) and save button
  - Card 3: Location (Address, City, State, ZIP, Lat, Long) with static map placeholder and save button
  - Card 4: Media — Logo upload (1:1), Cover upload (16:9), Gallery management (add/remove, hover overlay). Uses canvas-based auto-crop to center with correct aspect ratio.
  - Card 5: Patient Experience — Parking WYSIWYG, Visit WYSIWYG, FAQ (dynamic add/remove Q&A pairs), Amenities (checkboxes from DB), Languages (read-only per-provider display)
- All API routes: auth via getServerSession, SYSTEM_MANAGER ?clinicId=xxx support, audit logging, cache invalidation (deleteByPrefix('clinic:'))
- All forms: loading skeletons, toast notifications, per-card save buttons with spinner states
- ESLint passes clean. No new TypeScript errors (all errors are pre-existing).

Stage Summary:
- Section A fully complete: 6 API route files + 1 page file
- 8 total endpoints: GET/PATCH clinic-profile, POST upload, DELETE media, GET/PATCH experience, PATCH amenities, PATCH languages
- Frontend: comprehensive 5-card layout, emerald color scheme, responsive, accessible