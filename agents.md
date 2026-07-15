# DoctA — Clinic Directory & Appointment Booking Platform

> A full-stack medical clinic directory and appointment booking platform built with Next.js 16, React 19, Prisma (SQLite), NextAuth v4, Tailwind CSS 4, and shadcn/ui.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema (20 Models)](#database-schema)
5. [Authentication & Authorization](#authentication--authorization)
6. [Public Patient-Facing Features](#public-patient-facing-features)
7. [Staff Dashboard Features](#staff-dashboard-features)
8. [System Admin Features](#system-admin-features)
9. [API Routes Reference](#api-routes-reference)
10. [Key Libraries & Utilities](#key-libraries--utilities)
11. [Hooks](#hooks)
12. [Components](#components)
13. [Environment Variables](#environment-variables)
14. [Build & Deployment](#build--deployment)
15. [Booking Flow (Two-Phase Lock)](#booking-flow)
16. [Appointment State Machine](#appointment-state-machine)
17. [Caching Strategy](#caching-strategy)
18. [Known Limitations & Quirks](#known-limitations--quirks)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Caddy Reverse Proxy (port 81)                              │
│  └── Routes /api/*?XTransformPort=XXXX to mini-services     │
│  └── Default proxy to Next.js on port 3000                  │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Next.js 16 (App Router) — port 3000                        │
│  ├── Edge Middleware (JWT validation, role gating)           │
│  ├── Server Components (pages, API routes)                  │
│  ├── Client Components (providers, interactive UI)           │
│  └── Static Assets (Turbopack compiled)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Prisma ORM ──▶ SQLite (db/custom.db)                       │
│  ├── 20 models                                              │
│  ├── In-memory cache layer (Redis replacement)              │
│  └── Seed data (5 clinics, 20+ providers, 90 days of slots) │
└─────────────────────────────────────────────────────────────┘
```

**Multi-tenancy**: All clinic-scoped data is filtered by `clinicId` from the user's session. SYSTEM_MANAGER users can switch between clinics.

**No patient accounts**: Patient data is stored directly on the `Appointment` model. Access is via hashed, single-use tokens (MANAGE, INTAKE, REVIEW, CHECK_IN).

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js (App Router) | ^16.1.1 |
| UI Library | React | ^19.0.0 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Components | shadcn/ui (New York style) | 20+ Radix primitives |
| Icons | Lucide React | latest |
| Database | SQLite via Prisma ORM | ^6.11.1 |
| Auth | NextAuth v4 (JWT strategy) | ^4.24.11 |
| Password Hashing | bcryptjs | ^3.0.3 |
| Forms | React Hook Form + Zod | ^7.60.0 / ^4.0.2 |
| Server State | TanStack React Query | ^5.82.0 |
| Client State | Zustand | ^5.0.6 |
| Charts | Recharts | ^2.15.4 |
| Maps | Leaflet + React-Leaflet | ^1.9.4 / ^5.0.0 |
| Animations | Framer Motion | ^12.23.2 |
| Rich Text | MDXEditor | ^3.39.1 |
| Image Processing | Sharp | ^0.34.3 |
| QR Codes | qrcode | ^1.5.4 |
| Dark Mode | next-themes | ^0.4.6 |
| Drag & Drop | dnd-kit | ^6.3.1 |
| Runtime | Bun | latest |

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (ClientProviders wrapper)
│   ├── page.tsx                  # Home → SearchPage
│   ├── not-found.tsx             # Custom 404 page
│   ├── globals.css               # Global Tailwind styles + CSS variables
│   │
│   ├── api/                      # ~80+ API route files
│   │   ├── auth/[...nextauth]/   # NextAuth handler (custom Next.js 16 adapter)
│   │   ├── search/providers/     # Geo-aware provider search
│   │   ├── clinics/              # Public clinic listing
│   │   ├── taxonomies/           # Public taxonomy data
│   │   ├── geocode/              # ZIP → lat/lng (Nominatim)
│   │   ├── specialties/popular/  # Popular specialties by booking count
│   │   ├── slots/[id]/           # Slot details + two-phase lock
│   │   ├── appointments/         # Public booking (CONFIRM step)
│   │   ├── waitlist/             # Waitlist join
│   │   ├── intake/               # Pre-visit intake
│   │   ├── reviews/              # Token-based review submission
│   │   ├── manage/               # Patient self-service
│   │   ├── qr/[id]/              # QR code generation
│   │   ├── providers/[id]/       # Provider availability + reviews
│   │   ├── admin/                # Lock cleanup + slot generation
│   │   └── staff/                # 50+ staff/authenticated routes
│   │       ├── dashboard/        # Dashboard stats
│   │       ├── appointments/     # CRUD + state machine + notes + reschedule
│   │       ├── book/             # Staff manual booking
│   │       ├── slots/            # Slot inventory + block ranges
│   │       ├── providers/        # Provider CRUD + templates + services
│   │       ├── hours/            # Hours of operation
│   │       ├── services/         # Service assignment + pricing
│   │       ├── clinic-profile/   # Profile, media, experience, amenities
│   │       ├── financial/        # Deposit/cancellation config
│   │       ├── analytics/        # Clinic analytics
│   │       ├── notifications/    # Real-time notification feed
│   │       ├── waitlist/         # Waitlist management
│   │       ├── closures/         # Clinic closures/holidays
│   │       ├── invitations/      # Staff invitation system
│   │       ├── accept-invitation/# Accept invitation + create account
│   │       ├── payments/         # Refund + payment request
│   │       ├── audit-logs/       # Audit log viewer
│   │       ├── email-templates/  # Email template CRUD + reset
│   │       ├── communications/   # Email/communication settings
│   │       ├── service-insurances/# Service-insurance linking
│   │       ├── clinic-service/   # Clinic-service pricing overrides
│   │       ├── clinic-info/      # Lightweight clinic info for sidebar
│   │       └── admin/            # SYSTEM_MANAGER-only routes
│   │           ├── analytics/    # Cross-clinic analytics
│   │           ├── appointments/ # Global appointment search
│   │           ├── clinics/      # Clinic CRUD + edit
│   │           ├── providers/    # Global provider management
│   │           ├── users/        # User CRUD + invite + deactivate
│   │           ├── taxonomy/     # Services/specialties/insurances/amenities/languages
│   │           ├── config/       # System configuration singleton
│   │           ├── cron/         # Cron job monitoring + manual trigger
│   │           ├── financial/    # Global financial overview
│   │           ├── infrastructure/# Error logs, DB stats, integrations
│   │           ├── policy/       # System-wide policy config
│   │           ├── data/         # Seed, stats, purge
│   │           ├── audit-logs/   # Global audit log search
│   │           ├── error-logs/   # System error log management
│   │           ├── payments/     # Payment exception handling
│   │           ├── patient-matches/# Ambiguous patient detection
│   │           ├── conversion/   # Conversion funnel analytics
│   │           └── integrations/ # External integration status
│   │
│   ├── staff/
│   │   ├── login/                # Staff login page
│   │   ├── accept-invitation/    # Accept invitation page
│   │   └── dashboard/
│   │       ├── page.tsx          # Dashboard overview
│   │       ├── appointments/     # Appointment list management
│   │       ├── calendar/         # Weekly calendar view
│   │       ├── book/             # Staff manual booking
│   │       ├── slots/            # Slot inventory
│   │       ├── activity/         # Activity feed
│   │       ├── analytics/        # Clinic analytics
│   │       ├── settings/         # 7-tab settings panel
│   │       │   ├── profile/      # Clinic profile editing
│   │       │   ├── hours/        # Hours of operation
│   │       │   ├── services/     # Service management
│   │       │   ├── providers/    # Provider management
│   │       │   ├── financial/    # Financial settings
│   │       │   ├── communications/# Email templates
│   │       │   └── staff/        # Staff invitation/management
│   │       └── admin/            # 8 system admin pages
│   │
│   ├── book/                     # 4-step booking wizard (1718 lines)
│   ├── clinic/[slug]/            # Clinic detail page
│   ├── providers/[slug]/         # Provider detail page
│   ├── clinics/                  # Clinic directory
│   ├── about/                    # About DoctA
│   ├── insurance/                # Insurance info
│   ├── manage/[token]/           # Patient self-service
│   ├── intake/[token]/           # Pre-visit intake form
│   └── review/[token]/           # Post-visit review
│
├── components/
│   ├── ui/                       # 50+ shadcn/ui primitives
│   ├── search/
│   │   ├── search-page.tsx       # Main search (1324 lines)
│   │   └── provider-card.tsx     # Search result card
│   ├── clinic/
│   │   ├── clinic-provider-row.tsx
│   │   ├── clinic-location-map.tsx
│   │   └── about-text.tsx
│   ├── provider/
│   │   └── availability-calendar.tsx
│   ├── providers.tsx             # SessionProvider + ThemeProvider wrapper
│   ├── client-providers.tsx      # Dynamic SSR-safe provider wrapper
│   ├── docta-logo.tsx            # Brand logo component
│   ├── public-navbar.tsx         # Public site navigation
│   ├── public-footer.tsx         # Public site footer
│   ├── theme-toggle.tsx          # Light/Dark/System toggle
│   ├── clinic-selector-bar.tsx   # Admin clinic selector
│   ├── notification-bell.tsx     # Real-time notifications
│   ├── active-clinic-context.tsx # Clinic ID context
│   ├── settings-breadcrumb.tsx   # Settings navigation
│   ├── qr-code-display.tsx       # QR code for appointments
│   └── keyboard-shortcuts.tsx    # ⌘K shortcuts dialog
│
├── hooks/
│   ├── use-clinic-context.ts     # Effective clinicId management
│   ├── use-mobile.ts             # Responsive breakpoint hook
│   └── use-toast.ts              # Toast notification system
│
├── lib/
│   ├── auth.ts                   # NextAuth config (JWT, credentials, roles)
│   ├── db.ts                     # Prisma client singleton
│   ├── enums.ts                  # All enum constants + state machine
│   ├── constants.ts              # App-wide constants
│   ├── utils.ts                  # cn() class utility
│   ├── cache.ts                  # In-memory cache with TTL
│   ├── crypto.ts                 # Password/token hashing
│   ├── email.ts                  # Mock email service
│   ├── audit.ts                  # Fire-and-forget audit logger
│   ├── geo.ts                    # Haversine distance + geo utils
│   └── default-email-templates.ts # 7 default email templates
│
├── types/                        # TypeScript type augmentations
└── middleware.ts                  # Edge middleware (JWT + role checks)

prisma/
├── schema.prisma                 # 20-model database schema
└── seed.ts                       # Demo data seeder
```

---

## Database Schema

**Database**: SQLite via Prisma ORM. **20 models** total.

### System Configuration
- **SystemConfig** — Singleton config: deposit limits, lock TTL (600s), slot generation window (90 days), waitlist processing delay, review trigger hours, platform fee

### Taxonomy / Reference Data
- **Specialty** — `name`, `slug`, `description`, `icon`, `isActive`, `sortOrder` → has many Service, Appointment
- **Service** — `name`, `slug`, `specialtyId`, `durationMinutes` (30), `selfPayPriceCents`, `selfPayPaymentType`, `isBookable`, `isActive`
- **Insurance** — `name`, `slug`, `isActive`, `isDemo`, `sortOrder`
- **Amenity** — `name`, `slug`, `icon`, `sortOrder`
- **Language** — `name`, `code` (ISO 639-1), `sortOrder`

### Core Business
- **Clinic** — Full profile: slug, name, tagline, description, address (street/city/state/zip), lat/lng, phone, email, website, logo/cover URLs, about, hoursOfOperation (JSON), FAQ (JSON), gallery (JSON), status (DRAFT/PENDING/PUBLISHED/SUSPENDED/ARCHIVED), deposit amounts, cancellation/reschedule policies, parking/visit instructions, email settings, intake config, isFeatured
- **Provider** — `clinicId`, firstName, lastName, credentials, slug, bio, photoUrl, NPI, yearsExperience, rating, reviewCount, slotDurationMinutes (30), status (ACTIVE/INACTIVE/SUSPENDED), videoVisitLink

### Junction Tables
- **ClinicInsurance** — `clinicId` + `insuranceId` (unique pair)
- **ClinicAmenity** — `clinicId` + `amenityId` (unique pair)
- **ProviderLanguage** — `providerId` + `languageId` (unique pair)
- **ProviderService** — `providerId` + `serviceId` (unique pair)
- **ClinicService** — `clinicId` + `serviceId` (unique pair), `clinicPriceCents`, `isActive`
- **ServiceInsurance** — `serviceId` + `insuranceId` (unique pair), `copayCents`, `isActive`

### Slot Inventory
- **SlotTemplate** — `providerId`, `dayOfWeek` (0-6), `startTime`, `endTime`, `modality` (IN_PERSON/VIDEO), `isActive`
- **Slot** — `clinicId`, `providerId`, `startTime` (UTC), `endTime`, `modality`, `status` (AVAILABLE/LOCKED/BOOKED/BOOKED_EXTERNALLY/BLOCKED/CLOSED), `templateId?`

### Two-Phase Booking Lock
- **SlotLock** — `slotId` (unique — core of race condition protection), `lockKey`, `lockedAt`, `expiresAt`

### Appointments & Financials
- **Appointment** — `slotId` (unique), `clinicId`, `providerId`, `specialtyId`, `serviceId`, patient info (name, DOB, phone, email, type, guardian), `reasonForVisit`, `insuranceId?`, `modality`, `startTime`, `endTime`, `isDemoInsurance`, `depositCents`, `selfPayCents`, `paymentStatus` (PENDING/AUTHORIZED/CAPTURED/REFUNDED/FORFEITED), `paymentMethod` (STRIPE/CASH_AT_DESK/MANUAL_WAIVER), `status` (BOOKED/CHECKED_IN/COMPLETED/ARCHIVED/CANCELLED/NO_SHOW), `cancellationReason`, `conversionRanking`, `ipHash`, `intakeCompleted`, `insuranceVerified`
- **AppointmentLedger** — `appointmentId` (unique), `type` (DEPOSIT_AUTH/DEPOSIT_CAPTURE/REFUND/FULL_PAYMENT/BALANCE_PAYMENT), `amountCents`, Stripe IDs, `refundStatus`, `processedBy`

### Internal & Patient Tokens
- **InternalNote** — `appointmentId`, `authorId?`, `content`, `createdAt`
- **Token** — `tokenHash` (unique, SHA-256), `appointmentId`, `purpose` (INTAKE/REVIEW/MANAGE/CHECK_IN), `expiresAt`, `consumedAt?`

### Reviews & Waitlist
- **Review** — `appointmentId` (unique), `clinicId`, `providerId`, 4 rating dimensions (overall/waitTime/bedsideManner/staff, 1-5), `comment?`, `isVerified`
- **WaitlistEntry** — `appointmentId?`, `clinicId`, `providerId`, `serviceId`, patient info, date range, modality, status (ACTIVE/OFFERED/FULFILLED/EXPIRED/REMOVED), contact tracking, offer tracking

### Communication & Staff
- **EmailTemplate** — `clinicId`, `type` (7 types), `subject`, `bodyHtml`, `isActive`
- **StaffInvitation** — `clinicId`, `email`, `tokenHash`, `role`, `createdBy?`, `expiresAt`, `acceptedAt?`, `acceptedBy?`
- **ClinicClosure** — `clinicId`, `title`, `startDate`, `endDate`, `isRecurring`, `recurrenceRule?`

### Users & Audit
- **User** — `email` (unique), `name`, `passwordHash`, `role` (SYSTEM_MANAGER/CLINIC_ADMIN/CLINIC_RECEPTION), `clinicId?`, `isActive`, `lastLoginAt?`
- **AuditLog** — `userId?`, `action`, `targetType?`, `targetId?`, `appointmentId?`, `ipAddress?`

### System & Analytics
- **SystemErrorLog** — `level` (ERROR/WARN/INFO), `source`, `message`, `path?`, `stack?`, `resolved`, `resolvedBy?`, `resolvedAt?`
- **ConversionEvent** — `sessionId`, `eventType` (SEARCH/CLINIC_VIEW/BOOKING_START/BOOKING_COMPLETE), `clinicId?`, `providerId?`, `metadata?`, `ipHash?`

---

## Authentication & Authorization

### How Auth Works
- **NextAuth v4** with **JWT strategy** (no session DB table)
- Custom `toInternalRequest()` adapter in `/api/auth/[...nextauth]/route.ts` for Next.js 16 compatibility (bypasses broken `req instanceof Request` check)
- Credentials provider: email + bcrypt password verification
- JWT payload includes: `userId`, `email`, `name`, `role`, `clinicId`
- Session expiry: 30 days
- Token revocation: middleware checks `user.isActive` via DB on protected routes

### Role Hierarchy
```
SYSTEM_MANAGER > CLINIC_ADMIN > CLINIC_RECEPTION
```

### Middleware Enforcement
Edge middleware (`src/middleware.ts`) validates JWT and enforces:
- **Public routes**: `/`, `/book`, `/clinic/*`, `/providers/*`, `/clinics`, `/about`, `/insurance`, `/manage/*`, `/intake/*`, `/review/*`, `/api/search/*`, `/api/clinics`, `/api/taxonomies`, `/api/specialties/*`, `/api/slots/*`, `/api/appointments` (POST only), `/api/waitlist`, `/api/intake`, `/api/reviews`, `/api/providers/*/availability`, `/api/providers/*/reviews`, `/api/geocode`, `/api/auth/*`
- **Staff routes**: `/staff/dashboard/*`, `/staff/login`, `/staff/accept-invitation`
- **Admin-only routes**: `/staff/dashboard/admin/*`, `/api/staff/admin/*`
- Clinic status check: redirects to `/staff/login` if clinic is not PUBLISHED

### Known Auth Quirk
The `output: "standalone"` build requires `next-auth` and `cookie` in `serverExternalPackages` (next.config.ts). The root layout uses a `client-providers.tsx` wrapper with `next/dynamic({ ssr: false })` to bypass React 19 static generation issues.

---

## Public Patient-Facing Features

### Search & Discovery (`/`)
- Geo-aware provider search with **Haversine distance** calculation
- **Bounding-box pre-filter** optimization for large result sets
- Filters: specialty, insurance, modality (in-person/video), patient type (adult/pediatric), search radius (1-50 mi)
- ZIP code geocoding via Nominatim (free, no API key)
- "Use my location" button
- Conversion ranking: "Nearest" vs "Earliest" result ordering
- Popular specialty quick-search buttons
- Featured clinics section

### Clinic Directory (`/clinics`)
- Browse all published clinics
- Filter by specialty and city

### Clinic Detail (`/clinic/:slug`)
- Full clinic profile: name, tagline, description, address, contact
- Provider list with credentials, bios, specialties, next available slot
- Services offered with pricing
- Reviews section
- Location map (Leaflet)
- Amenities, languages, hours, FAQ, gallery

### Provider Detail (`/providers/:slug`)
- Provider bio, credentials, NPI, years of experience
- Interactive weekly availability calendar (navigate weeks, click to book)
- Reviews with 4-dimension ratings

### Booking Wizard (`/book`) — 4 Steps
1. **What brings you in?** — Reason for visit, patient type (adult/pediatric), guardian info (if pediatric), insurance selection, service selection, payment summary
2. **Your Information** — Full name, date of birth, phone, email
3. **Review & Confirm** — Full summary, cancellation policy agreement
4. **Confirmation** — Success page with manage link, "Book Another" CTA

### Patient Self-Service (`/manage/:token`)
- View appointment details
- Check-in button
- Cancel appointment
- QR code display

### Pre-Visit Intake (`/intake/:token`)
- Medical history, allergies, medications, reason for visit details

### Post-Visit Review (`/review/:token`)
- 4 rating dimensions: overall, wait time, bedside manner, staff
- Optional text comment

### Waitlist
- Join waitlist when no suitable slots available
- Notified when cancellations open up slots

### Dark Mode
- Full dark/light/system theme support via next-themes

---

## Staff Dashboard Features

### Dashboard Overview (`/staff/dashboard`)
- Today's stats: booked, checked-in, completed, no-shows, cancellations
- Upcoming appointments list
- Recent activity feed

### Appointment Management (`/staff/dashboard/appointments`)
- Full appointment list with status filters, date range, search
- **State machine transitions**: BOOKED→CHECKED_IN→COMPLETED→ARCHIVED, CANCELLED, NO_SHOW
- Internal notes (staff-only)
- Reschedule to new slot
- Send video visit link to patient
- Double-booking conflict detection
- QR code generation for check-in

### Calendar View (`/staff/dashboard/calendar`)
- Weekly calendar across all providers
- Color-coded by appointment status
- Click to view details

### Manual Booking (`/staff/dashboard/book`)
- Staff-initiated booking with same validation as public flow
- Select provider, date, available slot → patient details → confirm

### Slot Management (`/staff/dashboard/slots`)
- View slot inventory by provider and date range
- Block date ranges for providers
- Slot templates for recurring schedules

### Settings (7 Tabs)
1. **Profile** — Clinic name, tagline, description, address, contact, logo/cover upload (Sharp processing), about text (MDXEditor), gallery, FAQ
2. **Providers** — CRUD providers, assign services, set weekly schedule templates, manage languages
3. **Services** — Assign services from global taxonomy, set clinic-specific pricing, link insurances with copay amounts
4. **Hours** — 7-day hours of operation editor
5. **Financial** — In-person/video deposit amounts, cancellation lead time, reschedule policy
6. **Communications** — Email from name, custom email header, common instructions, intake reminder days, HTML email template editor for 7 communication types
7. **Staff** — Invite staff via email, manage invitations, view team

### Analytics (`/staff/dashboard/analytics`)
- Booking trends (area chart)
- Revenue breakdown
- Service popularity
- Provider performance
- Date-range filtered

### Notifications
- Real-time notification bell (polls audit logs)
- Booking, cancellation, check-in events

---

## System Admin Features

### Admin Dashboard (`/staff/dashboard/admin`)
- Global counts: clinics, users, providers, appointments, revenue
- Weekly trend sparklines
- Quick actions

### Clinic Management (`/staff/dashboard/admin/clinics`)
- List all clinics (any status)
- Create, edit status (publish/suspend/archive)
- Full profile editing

### User Management (`/staff/dashboard/admin/users`)
- List all staff users with role, clinic, last login
- Invite, edit role/clinic, deactivate

### Global Appointment Search (`/staff/dashboard/admin/appointments`)
- Search across all clinics
- Force status change (bypasses state machine)

### Global Analytics (`/staff/dashboard/admin/analytics`)
- Cross-clinic booking trends, revenue
- Top clinics, top services, modality split
- Conversion funnel analytics

### Taxonomy Management (`/staff/dashboard/admin/taxonomy`)
- CRUD for: Services, Specialties, Insurances, Amenities, Languages

### System Configuration (`/staff/dashboard/admin/config`)
- Singleton config: deposit limits, lock TTL, slot window, waitlist delay, review trigger hours, platform fee

### Infrastructure (`/staff/dashboard/admin/infrastructure`)
- Cron job monitoring (4 jobs): slot generation, lock sweep, waitlist processor, cache purge
- Manual trigger for any cron job
- Error logs with resolve capability
- Database stats (table counts, DB file size)
- Integration status (Stripe, JWT)
- Data management: re-seed demo data, purge resolved errors

### Payment Exceptions (`/staff/dashboard/admin/payments/exceptions`)
- Review and resolve refund failures

### Patient Match Detection (`/staff/dashboard/admin/patient-matches`)
- Find ambiguous patient matches (same email/phone across bookings)

---

## API Routes Reference

### Public Routes (No Auth)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api` | Health check |
| ALL | `/api/auth/[...nextauth]` | NextAuth handler |
| GET | `/api/search/providers` | Provider search (geo, filters, pagination, cached 3min) |
| GET | `/api/clinics` | List published clinics |
| GET | `/api/taxonomies` | Dropdown data (specialties, insurances, cached 1hr) |
| GET | `/api/geocode` | ZIP → lat/lng (Nominatim) |
| GET | `/api/specialties/popular` | Popular specialties by booking count |
| GET | `/api/slots/[slotId]` | Single slot with provider/clinic info |
| POST | `/api/slots/[slotId]/lock` | Acquire booking lock (race-condition protection) |
| POST | `/api/appointments` | Create appointment (CONFIRM step of two-phase lock) |
| POST | `/api/waitlist` | Join waitlist |
| GET/POST | `/api/intake` | View/submit intake form |
| POST | `/api/reviews` | Submit review (token-based) |
| GET | `/api/manage` | Patient self-service (validate token, details, check-in) |
| GET | `/api/providers/[id]/availability` | Weekly availability calendar |
| GET | `/api/providers/[id]/reviews` | Paginated reviews |

### Staff Routes (Auth Required, Clinic-Scoped)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/staff/dashboard` | Dashboard overview stats |
| GET | `/api/staff/dashboard-stats` | Slot/status counts |
| GET | `/api/staff/calendar` | Weekly calendar data |
| GET | `/api/staff/appointments` | List appointments (filters, pagination) |
| PATCH | `/api/staff/appointments/[id]` | State machine transition |
| POST | `/api/staff/appointments/[id]/reschedule` | Reschedule to new slot |
| GET/POST | `/api/staff/appointments/[id]/notes` | Internal notes |
| POST | `/api/staff/appointments/[id]/send-video-link` | Email video link |
| GET | `/api/staff/appointments/conflicts` | Double-booking detection |
| POST | `/api/staff/book` | Staff manual booking |
| GET/POST | `/api/staff/slots` | Slot inventory |
| POST | `/api/staff/slots/block-range` | Block date range |
| GET/POST | `/api/staff/providers` | Provider CRUD |
| PATCH | `/api/staff/providers/[id]` | Update provider |
| GET/POST/DELETE | `/api/staff/providers/[id]/templates` | Slot templates |
| GET/POST | `/api/staff/providers/[id]/services` | Provider-service assignment |
| GET/PATCH | `/api/staff/hours` | Hours of operation |
| GET | `/api/staff/services` | Available services |
| GET/PATCH | `/api/staff/clinic-profile` | Clinic profile |
| PATCH/DELETE | `/api/staff/clinic-profile/media` | Logo/cover upload/delete |
| GET/PATCH | `/api/staff/clinic-profile/experience` | About/FAQ content |
| PATCH | `/api/staff/clinic-profile/amenities` | Amenities junction |
| PATCH | `/api/staff/clinic-profile/languages` | Language associations |
| GET/PATCH | `/api/staff/financial` | Financial settings |
| GET | `/api/staff/analytics` | Clinic analytics |
| GET | `/api/staff/notifications` | Notification feed |
| GET/PATCH | `/api/staff/waitlist` | Waitlist management |
| GET/POST | `/api/staff/closures` | Clinic closures |
| GET/POST | `/api/staff/invitations` | Staff invitations |
| POST | `/api/staff/accept-invitation` | Accept invitation |
| POST | `/api/staff/payments/refund` | Manual refund |
| POST | `/api/staff/payments/request` | Generate payment link |
| GET | `/api/staff/audit-logs` | Audit log viewer |
| GET | `/api/staff/email-templates` | Email templates |
| PATCH | `/api/staff/email-templates/[id]` | Update template |
| GET/PATCH | `/api/staff/communications` | Communication settings |

### System Admin Routes (SYSTEM_MANAGER Only)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/staff/admin` | Admin overview |
| GET/POST | `/api/staff/admin/clinics` | List/create clinics |
| PATCH | `/api/staff/admin/clinics/[id]/edit` | Full clinic edit |
| GET | `/api/staff/admin/users` | All users |
| PATCH/DELETE | `/api/staff/admin/users/[id]` | Update/deactivate user |
| POST | `/api/staff/admin/users/invite` | Direct invite |
| GET | `/api/staff/admin/analytics` | Global analytics |
| GET | `/api/staff/admin/appointments` | Global appointment search |
| PATCH | `/api/staff/admin/appointments/[id]/status` | Force status change |
| POST | `/api/staff/admin/appointments/[id]/refund` | Admin refund |
| GET/PATCH | `/api/staff/admin/providers/[id]` | Global provider update |
| GET | `/api/staff/admin/taxonomy/*` | Taxonomy CRUD (5 resource types) |
| GET/PATCH | `/api/staff/admin/config` | System configuration |
| GET | `/api/staff/admin/cron` | Cron job status |
| POST | `/api/staff/admin/cron/trigger` | Trigger cron job |
| POST | `/api/staff/admin/data/seed` | Re-seed demo data |
| GET | `/api/staff/admin/data/stats` | DB stats |
| POST | `/api/staff/admin/data/purge-errors` | Purge error logs |
| GET | `/api/staff/admin/error-logs` | Error logs |
| GET | `/api/staff/admin/payments/exceptions` | Payment exceptions |
| GET | `/api/staff/admin/patient-matches` | Ambiguous patients |
| GET | `/api/staff/admin/conversion` | Conversion funnel |
| GET | `/api/staff/admin/integrations` | Integration status |
| POST | `/api/admin/locks/cleanup` | Sweep expired locks |
| POST | `/api/admin/slots/generate` | Generate 90-day slots |

---

## Key Libraries & Utilities

### `src/lib/auth.ts` — Authentication Configuration
- NextAuth v4 `authOptions`: JWT strategy, Credentials provider
- Role-based session enrichment: injects `role`, `clinicId` into JWT
- 30-day session max age
- `DoctASessionUser`, `DoctASession`, `DoctAJWT` type exports

### `src/lib/db.ts` — Database Client
- Singleton PrismaClient with HMR-safe global caching
- `export const db = new PrismaClient()`

### `src/lib/enums.ts` — Type-Safe Enums
- All status/type constants as const objects (SQLite String fields)
- `APPOINTMENT_STATUS`, `SLOT_STATUS`, `CLINIC_STATUS`, `PROVIDER_STATUS`, etc.
- `APPOINTMENT_TRANSITIONS`: valid state transitions
- `canTransitionTo(from, to)`: state machine validator
- `hasMinimumRole(userRole, requiredRole)`: role hierarchy check

### `src/lib/constants.ts` — Application Constants
- Slot defaults (30min duration, 90-day generation window)
- Lock TTL (600s = 10 min)
- Search config (page size 10, default radius 25mi, max 50mi)
- Token expiry (30 days after appointment)
- Waitlist offer TTL (60 min)
- Audit action types
- Booking wizard step definitions

### `src/lib/cache.ts` — In-Memory Cache
- Redis replacement with TTL support
- `get()`, `set()`, `delete()`, `deleteByPrefix()`, `deleteByTag()`, `getOrSet()`
- Centralized `CacheKeys` builders: `search:`, `clinic:`, `slots:`, `config:`
- Default TTLs: search 3min, clinic 5min, slots 2min, config 1hr
- Auto-starts cleanup interval (60s)

### `src/lib/crypto.ts` — Cryptographic Utilities
- `hashPassword()` / `verifyPassword()` — bcrypt
- `generateSecureToken()` — crypto.randomBytes(32), base64url
- `hashToken()` — SHA-256
- `verifyToken()` — timing-safe comparison
- `hashIpAddress()` — SHA-256 + salt
- `simpleHash()` — Quick non-crypto hash

### `src/lib/geo.ts` — Geolocation Utilities
- `haversineDistance()` — Great-circle distance in miles
- `isWithinRadius()` — Distance check
- `getBoundingBox()` — Pre-filter optimization (min/max lat/lng)
- `formatDistance()` — Human-readable distance
- `formatCents()` — Currency formatting

### `src/lib/audit.ts` — Audit Logging
- `createAuditLog()` — Fire-and-forget, never throws
- Action-level only (no before/after payloads)

### `src/lib/email.ts` — Email Service
- `sendStaffEmail()` — Mock implementation (console.log)
- Production: replace with SendGrid/SES/SMTP

### `src/lib/default-email-templates.ts` — Email Templates
- 7 default templates: BOOKING_CONFIRMED, CANCELLATION, RESCHEDULE_CONFIRMED, CHECK_IN_REMINDER, INTAKE_REMINDER, REVIEW_REQUEST, WAITLIST_OFFER
- Mustache-style placeholders: `{{patientName}}`, `{{clinicName}}`, etc.

### `src/lib/utils.ts` — UI Utilities
- `cn()` — clsx + tailwind-merge for combining CSS classes

---

## Hooks

### `useClinicContext()`
Manages the effective `clinicId` for API calls.
- **SYSTEM_MANAGER**: Fetches all clinics, persists selection to localStorage, auto-selects first published clinic.
- **CLINIC_ADMIN/RECEPTION**: Uses session-provided `clinicId`.
- Exports: `clinicId`, `clinics`, `setClinicId`, `isLoading`

### `useIsMobile()`
Responsive breakpoint detection (768px threshold). Returns boolean.

### `useToast()`
Global toast notification system (shadcn/ui pattern, max 1 visible). Exports `toast()` function.

---

## Components

### Layout & Navigation
| Component | Purpose |
|-----------|---------|
| `client-providers.tsx` | Dynamic SSR-safe wrapper for SessionProvider + ThemeProvider |
| `providers.tsx` | Actual client providers (SessionProvider, ThemeProvider, Toaster) |
| `public-navbar.tsx` | Public site navigation: logo, theme toggle, staff login |
| `public-footer.tsx` | Public footer: brand, links, social icons, copyright |
| `docta-logo.tsx` | Standardized logo (250×79px, height-prop-controlled) |
| `theme-toggle.tsx` | Light/Dark/System theme dropdown |
| `settings-breadcrumb.tsx` | Breadcrumb navigation for settings pages |

### Search & Discovery
| Component | Purpose |
|-----------|---------|
| `search/search-page.tsx` | Main search page (1324 lines): geo search, filters, results, map |
| `search/provider-card.tsx` | Provider result card: photo, rating, specialties, next slot |

### Clinic & Provider
| Component | Purpose |
|-----------|---------|
| `clinic/clinic-provider-row.tsx` | Provider row on clinic detail page |
| `clinic/clinic-location-map.tsx` | Leaflet map with clinic pin |
| `clinic/about-text.tsx` | Expandable text (200 char threshold) |
| `provider/availability-calendar.tsx` | Interactive weekly availability calendar |

### Dashboard Utilities
| Component | Purpose |
|-----------|---------|
| `clinic-selector-bar.tsx` | Admin clinic selector dropdown |
| `notification-bell.tsx` | Real-time notification bell (polls audit logs) |
| `active-clinic-context.tsx` | Clinic ID React context |
| `qr-code-display.tsx` | QR code for appointments |
| `keyboard-shortcuts.tsx` | ⌘K shortcuts dialog |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | Prisma connection string (e.g., `file:/home/z/my-project/db/custom.db`) |
| `NEXTAUTH_SECRET` | ✅ | — | JWT signing secret (any random string ≥ 32 chars) |
| `NEXTAUTH_URL` | Recommended | `http://localhost:3000` | Base URL for QR codes, invitation links |
| `IP_HASH_SALT` | Optional | `clinic-platform-default-salt-v1` | Salt for IP address hashing |
| `STRIPE_PUBLIC_KEY` | Optional | — | Stripe publishable key (integration status) |

---

## Build & Deployment

### Build Command
```bash
bun run build
```
This runs: `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`

### Start Command (Production)
```bash
NODE_ENV=production node .next/standalone/server.js
```

### Dev Command
```bash
bun run dev
```

### Key Configuration (`next.config.ts`)
```typescript
{
  output: "standalone",
  serverExternalPackages: ["bcryptjs", "@prisma/client", "next-auth", "cookie"],
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
}
```

### Important Build Notes
- **Standalone mode** is required for the Z.ai Publish button
- **`client-providers.tsx`** wraps providers in `next/dynamic({ ssr: false })` to bypass a React 19 + Next.js 16 bug where static generation fails with `useState` errors when client providers are in the root layout
- **`next-auth` and `cookie`** must be in `serverExternalPackages` for standalone builds
- **Lint**: `bun run lint` (ESLint)

---

## Booking Flow

### Two-Phase Lock Protocol

```
Patient clicks "Book" on a slot
         │
         ▼
  POST /api/slots/[slotId]/lock
  ┌──────────────────────────────┐
  │ 1. Check slot is AVAILABLE    │
  │ 2. Create SlotLock (unique)   │
  │    - lockKey: random token     │
  │    - expiresAt: now + TTL      │
  │ 3. Update slot → LOCKED       │
  │ 4. Return lockKey to client    │
  └──────────────────────────────┘
         │
         ▼
  Patient fills booking form (3 steps)
         │
         ▼
  POST /api/appointments
  ┌──────────────────────────────┐
  │ 1. Verify lockKey matches     │
  │ 2. Check lock not expired     │
  │ 3. Verify slot is LOCKED      │
  │ 4. Verify service→provider    │
  │ 5. Create Appointment         │
  │ 6. Create AppointmentLedger   │
  │ 7. Delete lock                │
  │ 8. Update slot → BOOKED       │
  │ 9. Generate 4 tokens:         │
  │    MANAGE, INTAKE, REVIEW,    │
  │    CHECK_IN (SHA-256 hashed)  │
  │ 10. Audit log                 │
  │ 11. Invalidate caches         │
  │ 12. Return appointment + token│
  └──────────────────────────────┘
```

### Race Condition Protection
- `SlotLock.slotId` has a **unique constraint** — only one lock per slot
- DB-level uniqueness prevents double-locking under concurrent requests
- Expired locks are swept by cron job (or manually via `/api/admin/locks/cleanup`)

---

## Appointment State Machine

```
        ┌──────────┐
        │  BOOKED  │
        └────┬─────┘
             │
    ┌────────┼────────┬──────────┐
    ▼        ▼        ▼          ▼
CHECKED_IN CANCELLED  NO_SHOW  (time passes)
    │        (end)    │
    ▼                 ▼
COMPLETED          ARCHIVED
    │
    ▼
 ARCHIVED
```

Valid transitions (enforced by `canTransitionTo()` in `enums.ts`):
- BOOKED → CHECKED_IN, CANCELLED, NO_SHOW
- CHECKED_IN → COMPLETED
- COMPLETED → ARCHIVED
- NO_SHOW → ARCHIVED

**Admin override**: `/api/staff/admin/appointments/[id]/status` bypasses the state machine.

---

## Caching Strategy

| Key Pattern | TTL | Invalidation |
|-------------|-----|--------------|
| `search:{paramsHash}` | 3 min | `deleteByPrefix("search:")` on booking |
| `clinic:{slug}` | 5 min | `deleteByPrefix("clinic:")` on profile update |
| `slots:provider:{id}:{date}` | 2 min | `deleteByPrefix("slots:")` on booking/template change |
| `config:system` | 1 hour | Manual cache purge |
| `popular:specialties` | 1 hour | Manual cache purge |

Cache is **in-memory** (single instance). No Redis required. Auto-cleanup runs every 60 seconds.

---

## Known Limitations & Quirks

1. **Email is mock**: `sendStaffEmail()` logs to console. Replace with real email service for production.

2. **No Stripe integration**: Payment fields exist in schema but no actual payment processing. `MANUAL_WAIVER` payment method is used for demo bookings.

3. **Dev server OOM**: In the Z.ai sandbox, `next dev` (Turbopack) occasionally runs out of memory. Production builds (`next build` + `node .next/standalone/server.js`) are more stable.

4. **React 19 + NextAuth v4**: The `/api/auth/[...nextauth]/route.ts` has a custom `toInternalRequest()` adapter because NextAuth v4's internal function checks `req instanceof Request`, which fails across module boundaries in Next.js 16 production builds (different `Request` constructors).

5. **Standalone build + static gen**: React 19's static generation fails when the root layout wraps pages with client-side providers (SessionProvider/ThemeProvider). Solved by `client-providers.tsx` using `next/dynamic({ ssr: false })`.

6. **SQLite limitations**: No native ENUM support (all enums are application-level string constants). No concurrent write support beyond SQLite's WAL mode defaults.

7. **Geocoding rate limits**: Nominatim (OSM) has a 1 request/second rate limit. The search page caches geocode results.

8. **Slot generation**: Slots are pre-generated from templates for 90 days. A cron job (`/api/admin/slots/generate`) creates slot instances. If templates change, regenerate is needed.

9. **`typescript.ignoreBuildErrors: true`**: The build skips TypeScript checking. Run `npx tsc --noEmit` separately for type checking.

10. **Middleware deprecation**: Next.js 16 shows a warning that `middleware.ts` should be migrated to the `proxy` convention. Not yet migrated.

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| System Manager | `sysadmin@clinicbook.com` | `sysadmin123` |
| Clinic Admin | `admin@downtownmedicalgroup.clinicbook.com` | `admin123` |
| Receptionist | `reception@downtownmedicalgroup.clinicbook.com` | `reception123` |

Primary demo clinic ID: `cmrdp0zbr0019r6bzihl5et61`