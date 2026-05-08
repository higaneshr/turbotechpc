# Fix bugs + replace email/password with phone+OTP auth

## Part A — Fix the current errors

1. `**permission denied for function has_role` (blocks app_settings load on home, account, etc.)**
  - The `has_role` function is `SECURITY DEFINER` but `EXECUTE` was never granted to `anon`/`public`. RLS policies that mention `has_role` therefore fail for guests.
  - Migration: `GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role), public.get_user_role(uuid) TO anon, authenticated;`
  - Also relax `app_settings` SELECT policy to allow `anon` so the maintenance/support/rewards toggles can be read by guests.
2. **Customer can't book**
  - Root cause is the same `has_role` permission failure cascading through `bookings` RLS evaluation. The grant above fixes it.
  - Verify the insert payload still matches RLS (`customer_id IS NULL OR auth.uid() = customer_id`) — it does.
3. **Admin can't add technician / no technicians shown**
  - We are removing email-based staff accounts entirely (Part B). Replace the `admin-staff` edge function flow with a simple `technicians` table the admin manages directly (name + phone). Technicians sign in with their phone + the test OTP.
  - The Admin → Technicians tab lists rows from `technicians`, lets admin add/remove by phone, and assignment on bookings stores `technician_phone` (new column) instead of `technician_id` for new tech accounts. Existing `technician_id` (uuid) stays for backward-compat but the UI now drives off `technicians`.
4. **General sweep**
  - Drop the `support` tab from `BottomNav` (already planned but verify).
  - Fix `SupportSettings` toggle key bug (`v === true ? a : a` no-op).
  - Make `MaintenanceGate` ignore failures silently.

## Part B — New phone + OTP auth (replaces email/password everywhere)

### Concept

- One unified session stored in `localStorage` via `src/lib/session.ts` with shape `{ phone, name, role: "customer" | "technician" | "admin" }`.
- No Supabase Auth users are created for customers/technicians/admin anymore. RLS for staff actions will be loosened where needed; sensitive admin actions stay gated by an `is_staff_phone()` check passed as an explicit argument (not via auth.uid).
- For now the OTP is the fixed string `**2345**` for everyone (no SMS provider yet — we tell the user).

### Flow

1. User taps **Sign in** in `/account`.
2. Enter phone → tap **Get OTP** → navigate to `/account/otp` (or inline step).
3. Enter OTP. The OTP will be affected from an api select an api of your choice Only for admin the password will be 2345:
  - If phone is `123456789` → role = admin.
  - Else if phone exists in `technicians` table → role = technician.
  - Else → role = customer. If `customers` row exists, reuse stored name (skip name prompt). If not, prompt for name on this screen and upsert into `customers`.
4. After sign-in: customer sees normal account page, technician sees link to `/technician`, admin sees link to `/admin`.

### Routes/components

- Rewrite `src/routes/account.tsx`: 3 inline steps (phone → otp → optional name).
- Delete the old `/auth` page UI; redirect `/auth` to `/account`.
- New `src/lib/session.ts` (replaces `customer-session.ts` and `auth.tsx` consumption sites).
- Update `src/routes/admin.tsx` and `src/routes/technician.tsx` to gate on `session.role` instead of Supabase Auth.
- Update `BottomNav`, `book.$serviceId.tsx`, `quick-booking.tsx`, `rewards.tsx`, `support.tsx`, `track.$bookingId.tsx`, `__root.tsx` (remove `AuthProvider` dependency or leave it as a no-op).

### DB changes

- New `technicians` table: `phone text PK`, `full_name text`, `created_at`. RLS: public read (so admin client can list), public insert/delete (admin UI is the only consumer; we accept this for now since we removed Supabase Auth).
- `bookings.technician_phone text NULL` column for new assignment flow.
- Loosen RLS on `bookings` UPDATE to allow updates by anyone (since there's no auth.uid concept anymore for staff). We trade strong RLS for the simplified flow as the user requested. Keep the protected-fields trigger for safety.
- Same for `notifications`, `support_tickets`, `redemptions`, `app_settings`, `services`, `reward_items`: allow public read+write. (User explicitly chose to drop the auth model.)

## Out of scope

- Real SMS OTP delivery (fixed test code `2345` until an SMS provider is configured).
- Re-enabling email/password later.

## Files touched (high level)

- migration (Part A grants + new `technicians` table + `technician_phone` column + relaxed RLS)
- new: `src/lib/session.ts`
- modified: `src/routes/account.tsx`, `src/routes/admin.tsx`, `src/routes/technician.tsx`, `src/routes/book.$serviceId.tsx`, `src/routes/quick-booking.tsx`, `src/routes/rewards.tsx`, `src/routes/track.$bookingId.tsx`, `src/routes/support.tsx`, `src/routes/auth.tsx` (becomes redirect), `src/components/BottomNav.tsx`, `src/components/MaintenanceGate.tsx`
- deleted: `supabase/functions/admin-staff/index.ts` (no longer needed)