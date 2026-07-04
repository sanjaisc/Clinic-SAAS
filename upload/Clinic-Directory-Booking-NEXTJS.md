# Clinic Directory & Booking Platform - Master Build Specifications (V1 MVP - Next.js Edition)

## 1. Project Overview & Architecture

You are building a highly transactional, full-stack Next.js application that replicates a Zocdoc-like medical marketplace. The system combines a public clinic/provider directory, real-time appointment search, an anonymous booking wizard, clinic staff operations, and platform administration.

**Mandatory Technical Stack:**
*   **Framework:** Next.js (App Router) utilizing React Server Components (RSC) for public SEO-critical pages, and Client Components for interactive dashboards.
*   **Backend/API:** Next.js Route Handlers (`app/api/.../route.ts`) and Server Actions for mutations.
*   **Database:** PostgreSQL (or MySQL) managed via Prisma ORM (strictly typed schemas, migrations, and relations).
*   **Background Jobs:** BullMQ + Redis for high-volume transactional processing (slot generation, lock sweeping, waitlist, emails).
*   **Authentication:** NextAuth.js (Auth.js) with a Custom JWT strategy. Standard session for Admins; long-lived JWTs issued to Clinic Staff to prevent session expiration during long shifts.
*   **Payments:** Stripe Integration (Stripe Node.js SDK) for deposits, captures, refunds, and webhook handling.
*   **Forms & Intake:** Custom React forms using React Hook Form + Zod. Client-side AES encryption (e.g., Web Crypto API) before transit, stored as encrypted blobs in the DB.
*   **Caching:** Redis for complex query caching + Next.js built-in `unstable_cache` / `revalidateTag` for public search/inventory APIs.
*   **Accessibility (V1):** Visual-first focus. Formal WCAG compliance and complex ARIA keyboard navigation are explicitly deferred to V2.

## 2. Core Data Entities & Schema Rules (Prisma Models)

*   **Clinics & Providers:** Standard Prisma models. Strict 1:1 relationship (Foreign Key on Provider). No polymorphic parent/child location relationships in V1.
*   **Slots:** Raw inventory records stored in UTC. Prisma model: `clinicId`, `providerId`, `startTime` (DateTime UTC), `endTime` (DateTime UTC), `modality` (Enum), `status` (Enum: AVAILABLE, LOCKED, BOOKED, BOOKED_EXTERNALLY, BLOCKED, CLOSED).
*   **Ledgers:** Payment records modeled separately from Appointment records (`AppointmentLedger` model).
*   **Tokens:** Cryptographically secure (Node.js `crypto.randomBytes`), stored as hashed strings (bcrypt/scrypt) in the DB, served and validated over HTTPS only.

## 3. Public Directory & Search Engine

*   **Search UI:** A Unified Smart Search text bar (matches Clinic, Provider, Location) + Mandatory searchable Specialty Dropdown + Mandatory Patient Type Toggle (Adult/Pediatric) + Optional Insurance Dropdown + Optional Modality Dropdown + Distance Radius Slider (Default: 5 miles, up to 50+).
*   **Hard Constraints:** Search button/form WILL NOT submit until Specialty and Patient Type are selected.
*   **Results Layout:** A flat list of Provider Cards. No grouping under clinic headers. Pagination is "Load More" (Client Component fetching 10 cards at a time via Next.js API route).
*   **Provider Card Content:** Provider Image (Next.js `Image` with 1:1 aspect ratio), Name/Credentials, Clinic Name, Clinic Address + Distance (calculated via PostGIS or application-level Haversine), Star Rating, 1 Positive Review Snippet, and the 3 Earliest Available Slots. Every slot MUST display a modality badge ("Video" or "In-Clinic").
*   **Cost Transparency:**
    *   If "Demo Insurance" is selected: Pull hardcoded price from the Service table and display as a badge (e.g., "$0", "$25 Copay").
    *   If "Uninsured" is selected: Pull the clinic's `selfPayFlatRate`.
    *   If any other insurance is selected: Display NO cost badges.
*   **Zero-Results Handling:** Display clean empty state with clickable Smart Suggestion breadcrumbs ("Expand radius?", "Remove insurance?") AND a "Show nearby alternatives" option (queries up to 3 out-of-network providers, renders red warning badges).
*   **Tie-Breaking (DB/Application Level):** Primary Preference (Time/Distance) -> Earliest Slot -> Highest Rating -> Alphabetical Name -> Randomized Shuffle for true ties.
*   **Unavailable Clinics:** `middleware.ts` intercepts direct URL hits for Suspended/Archived clinics, redirects to `/search` with a `?status=suspended` query param triggering a non-intrusive banner notification.

## 4. Clinic Detail Page Behavior

*   Route: `/clinic/[clinicSlug]`. Rendered as a React Server Component for instant loading.
*   Displays static clinic info (About, Map embed, Hours, FAQ, Gallery) in clean section blocks.
*   Bottom section lists ALL providers for this clinic, displaying their 3 earliest slots. (The mandatory specialty search rule is waived here).
*   Full Provider Bios and Reviews are hidden inside collapsed Client Component accordions to prevent reading fatigue.
*   Clicking a provider name or slot routes directly to Step 1 of the Booking Wizard (`/book?providerId=...&slotId=...`). No dedicated provider profile pages.

## 5. The Booking Wizard (4-Step Anonymous Flow)

*   Route: `/book` (Client Component handling step state).
*   **Step 1 (Reason & Type):** Pre-filled Specialty/Patient Type from search params. Free-text "Reason for Visit" field. If Pediatric, dynamically expand to require Guardian Details and Legal Authority Confirmation.
*   **Step 2 (Patient Details):** Name, DOB, Phone, Email. No account creation.
*   **Step 3 (Checkout):** Appointment summary. Stripe integration (`@stripe/stripe-js`).
    *   *Two-Phase Lock:* Server Action acquires temporary DB lock on the slot inside a Prisma `$transaction`, then processes Stripe auth.
    *   *Conflict Resolution:* Leverage Prisma/DB Unique Constraints on the lock record. If collision occurs, catch the `P2002` (Unique constraint) DB error and return a friendly "Slot just taken" message to the client.
    *   *$0 Deposits:* If calculated deposit is $0, behavior depends on System Manager toggle: Either skip Step 3 entirely OR require card on file for $0 auth (for no-show penalties).
    *   *Self-Pay Logic:* Check service's `selfPayPaymentType` flag. If "Full Upfront", charge the whole Self-Pay rate. If "Standard Deposit", charge the normal modality deposit.
*   **Step 4 (Confirmation):** Success screen. Generate secure token link. Trigger confirmation email via BullMQ.
*   **Cookie Tracking:** Drop a temporary cookie via Next.js `cookies().set()` on search to track conversion and ranking acceptance (Earliest vs. Nearest) upon Step 4 completion. Delete cookie immediately after.

## 6. Patient Self-Service & Post-Booking

*   **Token Validity:** Tokens last exactly 7 days after the scheduled appointment time (validated via Prisma query comparing `appointment.startTime + 7 days > now`).
*   **Capabilities:** Route: `/manage/[token]`. View details, complete encrypted intake forms, Cancel, Reschedule, Pay Balance Due, Request Data Deletion.
*   **Rescheduling:** Creates a NEW appointment record. Invalidates old token (delete or mark consumed). Generates new token. Sends new email via queue.
*   **Data Deletion:** Server Action instantly anonymizes PII (Name, DOB, Contact) but preserves financial/audit logs.
*   **Intake Forms:** Custom React form builder. Clinic Admins map form fields to services. Data is AES encrypted in the browser before being POSTed to the API and stored as a binary blob.
*   **Reviews:** Triggered when staff marks appointment "Completed". Email sends secure one-time token link to a standalone review form (`/review/[token]`). Sub-ratings: Wait Time, Bedside Manner, Staff Friendliness.
*   **QR Code Check-In:** Confirmation email contains QR code (generated via `qrcode` Node package). Clinics use a dedicated `/check-in-kiosk` URL (no login required) to scan the QR code (via browser camera) and instantly change status to "Checked-In" via Server Action.

## 7. Slot Inventory & Scheduling Logic

*   **Duration:** ONE strict duration per provider (e.g., 15, 30 mins). No variable lengths per service in V1.
*   **Generation:** Staff create Weekly Recurring Templates. BullMQ repeatable job auto-generates raw slots for a rolling window (e.g., 90 days).
*   **DST Handling:** BullMQ job MUST calculate the correct UTC offset for each specific day it generates (using `date-fns-tz` or `luxon`) to prevent local time shifts during Daylight Saving Time.
*   **Template Updates:** If a template is updated, the system automatically deletes/regenerates future available slots, but strictly preserves booked, locked, or blocked slots (handled via a smart Prisma bulk delete query).
*   **Closures:** Creating a Clinic Closure/Holiday automatically suppresses all generated available slots in that timeframe.
*   **Temporary Locks (TTL):** System Manager configurable (e.g., 10 mins). BullMQ sweeps and releases expired locks.
*   **Performance:** Cache search/slot API responses in Redis (2-5 min TTL). Purge cache keys instantly via `revalidateTag('slots')` or direct Redis key deletion upon any booking, cancellation, block, or closure event.

## 8. Waitlist Engine

*   **Processing:** Asynchronous via BullMQ (1-5 min delay after a cancellation webhook/event occurs).
*   **Offers:** Email-based (via React Email + Resend) containing a short-lived temporary hold link.
*   **Expiration:** Entries auto-expire at the end of the date range the patient originally searched for.
*   **Cross-Booking Prevention:** If a patient successfully books an appointment for a service outside the waitlist (matched by email/phone), the system auto-removes them from the waitlist for that service.

## 9. Financials, Payments & State Machines

*   **Deposits:** Flat rates separated by Modality. System Manager sets global min/max boundaries; Clinic Admin sets exact amounts within bounds.
*   **Cancellation Rules:** Modality-specific lead times. Late cancellations auto-forfeit deposit.
*   **Reschedule Policies (Admin Configurable):** "Forfeit on Late Reschedule", "Transfer on Late Reschedule", or "Allow 1 Grace Transfer".
*   **Refund States:** Enum: `REFUND_PENDING`, `REFUNDED`, `REFUND_FAILED`, `FORFEITED`.
*   **Manual Overrides:** Staff have a "Refund Deposit" button to manually trigger Stripe refunds via API for goodwill or failed auto-refunds.
*   **Balance Due:** Staff click "Send Payment Request", enter amount, system emails a secure Stripe Payment Link.
*   **No-Show:** Staff click "Mark No-Show" -> Server Action calls Stripe API to capture the authorized deposit as penalty.

## 10. Clinic Staff Portal (Next.js Client Components + NextAuth JWT)

*   **Route Group:** `(staff)/dashboard/*`
*   **Authentication:** NextAuth.js configured with `session: { strategy: "jwt" }`. Custom JWT callback injects `role` and `clinicId`. No CSRF nonces to expire.
*   **Role Inheritance:** "Clinic Admin" inherits ALL capabilities of "Clinic Reception" (handled via custom middleware or layout components checking `user.role`).
*   **Weekly Calendar:** Read-only visual grid (e.g., using `@hello-pangea/dnd` for static display or a custom grid) showing committed appointments.
*   **Slot Management:** Click a slot on the grid to open a modal form to block ranges or mark as `BOOKED_EXTERNALLY` (no drag-and-drop in V1).
*   **Manual Bookings:** Staff can create full bookings over the phone, using "Paid at Desk/Cash" payment statuses.
*   **Patient Popup Modal:** Click patient name/booking -> Popup to edit contact details (no masking), add internal notes (with chronological log below), and tick "Insurance Info Received".
*   **Conflict Detection:** Background BullMQ job checks for identical email/phone with overlapping times. Flags conflicting appointments with color-coded names/IDs in the staff views for manual resolution.

## 11. Clinic Settings & Communications

*   **Email Templates:** Safe-Mode WYSIWYG (e.g., TipTap or Quill restricted to basic formatting, no HTML source view) for Clinic Admins to customize templates. "From Name" uses Clinic Name; Header uses Clinic Logo.
*   **Common Instructions:** Global WYSIWYG block (parking, arrival info) auto-appended to all clinic emails via a wrapper React Email component.
*   **Intake Reminders:** Clinic Admin configurable cadence (e.g., 3 days before, 1 day before, never).
*   **Media Uploads:** Next.js API Route + S3 (AWS/Cloudflare) upload. Frontend JS cropper (e.g., `react-image-crop`) forces 1:1 for Provider Photos, 16:9 for Clinic/Gallery. Strict max file size limits enforced via middleware and client-side validation.

## 12. Roles & Permissions (RBAC)

Handled via NextAuth JWT callbacks and checked in Server Actions/Middleware:
*   **Platform Admin:** Technical site maintenance, system configs, database backups.
*   **System Manager:** Cross-clinic operational control. Manages global taxonomies, deposit boundaries, platform-wide reports, audit logs, creates Clinic Admins.
*   **Clinic Admin:** Manages assigned clinic profile (verified via `user.clinicId`), providers, templates, settings, custom emails. Inherits all Clinic Reception duties.
*   **Clinic Reception:** Daily operations. List/Grid/Calendar views, manual booking, check-ins, blocking slots, notes, payment requests.
*   **Patient Profile:** OUT OF SCOPE FOR V1.

## 13. Status State Machines (Prisma Enums)

*   **Clinic Statuses:** `DRAFT`, `PENDING`, `PUBLISHED`, `SUSPENDED`, `ARCHIVED`.
    *   *Suspended:* Excluded from public Prisma queries, blocks future slot generation, but KEEPS existing booked appointments active for manual staff resolution.
*   **Provider Statuses:** `ACTIVE`, `INACTIVE`, `SUSPENDED`.
    *   *Suspended:* Excluded from public queries, blocks future slot generation, KEEPS existing booked appointments active.
*   **Appointment Statuses:** `BOOKED` -> `CHECKED_IN` (via QR or Staff) -> `COMPLETED` (triggers review email) -> `ARCHIVED`.
    *   `BOOKED` -> `CANCELLED` (triggers refund logic based on lead time).
    *   `BOOKED` -> `NO_SHOW` (triggers deposit capture).

## 14. Analytics & Reporting (Visual Dashboards)

*   **UI Framework:** Recharts or Chart.js embedded in Next.js Client Components.
*   **Date Filtering:** Combined Pre-set Toggles (Today, 7d, 30d, 90d) + Custom Date Range picker.
*   **Metrics (Scoped per Clinic for Admins, Global for Sys Managers):**
    *   Appointment Volume (Line Chart)
    *   Telehealth vs. In-Person Ratio (Pie Chart)
    *   No-Show Distribution (Chart)
    *   Deposit Capture Volume (Chart)
*   **Audit Logs:** `AuditLog` Prisma model. Action-level logging only (`userId`, `action`, `appointmentId`, `timestamp`). NO granular before/after text payloads to keep DB size manageable.

## 15. Initial Setup & Out-of-the-Box Experience

Upon first deployment, running the initial database seed script (`prisma db seed`) MUST automatically:

*   Populate base taxonomies (Specialties, Services, Insurances, Amenities, Languages).
*   Populate taxonomies with realistic Demo Data (e.g., 5 specialties, 10 services).
*   Create the "Demo Insurance Provider" and pre-populate the "Demo Insurance Price/Copay" on demo services.
*   Create 2 Dummy Clinics, assign Dummy Providers, generate Weekly Schedule Templates.
*   Trigger the BullMQ slot generation worker to auto-generate a rolling window of dummy available slots.
*   *(Note: Page creation is unnecessary in Next.js as routes are file-based, but the seed script should output a success message confirming the demo environment is ready).*

## 16. Strictly Out of Scope for V1

*   Multi-patient booking groups / contiguous slot block logic.
*   New vs. Existing patient slot duration logic.
*   Authenticated patient profiles, front-end patient portal, user account linking.
*   SMS notifications / SMS-based waitlist offers (Email only).
*   Native video visit integration (Manual 3rd party link insertion only).
*   Complex natural language symptom search (Specialty dropdown only).
*   Real-time insurance eligibility verification API.
*   Formal WCAG/ADA accessibility compliance and keyboard-only SPA navigation.
*   Multi-clinic provider assignments (Strict 1:1 only).
*   Drag-and-drop calendar blocking.
