# Real Supabase Phone OTP Auth — Implementation Plan

## What changes for users

- **Login** → "Enter phone → receive real SMS OTP from Twilio → enter OTP → signed in." No more universal `2345` code, no more hardcoded admin.
- **First account that ever signs up** → automatically becomes admin.
- **Admin panel** → new "Users" tab where admin can promote any signed-up phone to **technician** or **admin**, or demote back to **customer**.
- **Customer**, **technician**, **admin** routes are gated server-side by Supabase session + role. Non-admins hitting `/admin` get redirected before the page renders.

## What you (the user) must do once

1. **Approve the Twilio connection** in the prompt I'll show — that lets the app call Twilio for things outside auth (we keep it for future use).
2. **Paste Twilio credentials into Supabase Auth phone provider** (Cloud → Users → Auth Settings → Phone). Supabase sends the OTP itself; the connector cannot wire this for you. I'll show the exact fields to fill (Account SID, Auth Token, Message Service SID or From number).
3. **Sign up with your own phone first** so you become the admin, then promote your technicians from the admin panel.

## Database migration

Single migration that:

- **`user_roles`** — keep existing table & enum (`admin | technician | customer`).
- **New trigger `handle_new_user`** (replace existing): on `auth.users` insert, create `profiles` row + assign role: `admin` if `user_roles` is empty, else `customer`.
- **Restore role-based RLS** on every table — replace all `USING (true)` write policies with policies gated on `has_role(auth.uid(), 'admin')`, `auth.uid() = customer_id`, or `auth.uid() = technician_id` as appropriate. Read policies tightened the same way (customers read their own bookings; admins/assigned technician read everything they need).
- **Restore `guard_booking_update_trg`** trigger so price/address/customer fields can't be tampered with.
- **Drop public read on `otp_codes`, `customers`, `support_tickets`, `notifications`, `redemptions`** — replace with owner/admin-scoped policies.
- **Drop `customer_id IS NULL` guest-read clause** on bookings.
- **Storage**: tighten `house-photos` policies — uploads require `auth.uid()` (no more anonymous uploads). Reads stay public so technicians/admins can view photos.
- **Drop `technicians` and `customers` tables** — superseded by `auth.users` + `profiles` + `user_roles`. Bookings reference `customer_id` / `technician_id` (uuids) instead of phone strings.
- **Drop `otp_codes` table** — Supabase Auth manages OTP storage internally.

## Code changes

### Removed
- `src/lib/session.ts` (localStorage session, hardcoded admin OTP).
- All `useSession()` / `setSession()` / `clearSession()` call sites.

### New
- `src/lib/auth.tsx` — `AuthProvider` + `useAuth()` hook wrapping `supabase.auth.onAuthStateChange` + `getSession`. Exposes `user`, `role`, `profile`, `signOut`.
- `src/routes/_authenticated.tsx` — layout route. `beforeLoad` redirects to `/auth` if no session.
- `src/routes/_authenticated/_admin.tsx` — layout. `beforeLoad` checks role via `get_user_role(auth.uid())` RPC; redirects non-admins.
- `src/routes/_authenticated/_technician.tsx` — same pattern for technician.

### Rewritten
- `src/routes/auth.tsx` — real two-step UI: phone input → call `supabase.auth.signInWithOtp({ phone })`; OTP input → call `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`. New users get a name-collection step that updates `profiles`.
- `src/routes/account.tsx` — show signed-in user's profile from `profiles`/`user_roles`; sign-out button calls `supabase.auth.signOut()`.
- `src/routes/admin.tsx` → moved under `_authenticated/_admin/`. Uses `auth.uid()`-aware queries. New **Users** tab listing every `profiles` row with a role dropdown (writes to `user_roles` via admin-only policy).
- `src/routes/technician.tsx` → moved under `_authenticated/_technician/`. Uses `auth.uid()` not phone string. Restored RLS lets the assigned technician read/update only their own bookings.
- `src/routes/book.$serviceId.tsx`, `quick-booking.tsx` — require auth; insert booking with `customer_id = auth.uid()`. Guest tracking via localStorage UUID is removed — users sign in to track bookings.
- `src/routes/track.$bookingId.tsx`, `bookings.tsx` — query by `customer_id = auth.uid()` (RLS enforces).
- `src/routes/rewards.tsx` — auth required; redemptions tied to `user_id`.
- `src/components/AppHeader.tsx`, `BottomNav.tsx`, `MaintenanceGate.tsx` — replace `useSession` with `useAuth`.
- `src/routes/__root.tsx` — wrap children in `<AuthProvider>`.

## Out of scope
- Migrating existing `customers`/`technicians`/`bookings` rows (the demo data is recreated on signup; admin re-creates services/rewards in panel if missing).
- Transactional SMS for booking updates (the SMS provider is wired only for auth).
- Email auth fallback (phone-only as agreed).

## Risk note
Until you complete step 2 (paste Twilio creds into Supabase Auth → Phone), `signInWithOtp` will return an error. The UI will show that error verbatim so you know to finish setup. Once configured, real OTPs will arrive at the entered phone number.