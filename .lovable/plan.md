# Customer flow + Admin controls overhaul

## 1. Simplified "sign-in" (no OTP, no password)
- Remove Support tab from `BottomNav`. Keep Account tab.
- Rewrite `/account` so signed-out users only see two fields: **Name** and **Phone number**, plus a **Sign In** button.
  - On submit: upsert a row in a new lightweight `customers` table (`phone` PK, `name`, `coins`), store `{name, phone, customerId}` in `localStorage` as the "session".
  - No Supabase auth, no OTP, no password.
- Signed-in account view shows: name, phone, coins, list of bookings, redemptions, support contact links, and Sign Out.
- Update `/auth` route to redirect to `/account` (kept only for admin/technician staff login via a tiny "Staff login" link at the bottom of the account page).
- All booking / quick-booking / rewards / support flows read identity from this local session instead of asking name+phone again (still editable on the form).

## 2. Callback-approval for critical actions
Add a `requires_callback` + `approval_status` (`pending` / `approved` / `rejected` + `rejection_reason`) workflow to:
- **Bookings** (all PC-work bookings) — already pending, just surface "We will call you to confirm" messaging on success and on tracking page until admin approves.
- **Reward redemptions** — same pending → approved/rejected flow with reason.
Customer-side track and rewards pages display a yellow "Pending callback confirmation" banner; once rejected, show admin's reason in red.

## 3. Admin: reject with reason
- In Admin → Bookings and Admin → Tickets / Redemptions: add **Reject** button that opens a dialog asking for an explanation, stored in `rejection_reason`, sets status to `rejected` / `cancelled`, and creates a notification to the customer (visible on tracking page and account page).

## 4. Maintenance mode
- New `app_settings` key `maintenance_mode` (bool) + `maintenance_message` (text).
- Admin → new "Site" tab with toggle and message field.
- Root layout reads setting; when ON, every customer-facing route renders a full-screen "Under maintenance — no bookings are being taken right now" page (admin/technician routes remain accessible).

## 5. Admin: services CRUD
- New "Services" tab in Admin: list services, add (name, description, base price, icon, available, coming_soon), edit inline, delete. The home page `/` already reads from `services` table.

## 6. Admin: technicians CRUD + assign
- "Technicians" tab gets:
  - Add technician form (name + phone) → creates a Supabase auth user with a generated password shown once to the admin, inserts profile + `user_roles` technician row.
  - Remove technician (revoke role).
  - Assign / reassign technician to a booking (already exists, keep).

## 7. Technician: mark job completed
- On `/technician`, add a **Mark completed** button on the active job card that updates booking status to `completed` and stops location sharing.

## 8. Admin tracking: detailed status
- Add finer status values surfaced in admin: `pending → approved → on_the_way → arrived → in_progress (Repair started) → completed | rejected | cancelled`.
- Migration adds `in_progress` to the `booking_status` enum.
- Admin booking row shows current status with a friendly label and a **Mark "Repair started"** quick action when the technician has arrived.

## 9. Rewards page redesign (per uploaded reference)
Redesign `/rewards` to match the dark "Available Balance / Turbo Points" card:
- Top card: dark navy gradient, big "AVAILABLE BALANCE" label, large coin number, "Turbo Points" subtitle, blue circular star badge on the right.
- "HOW TO EARN POINTS" white rounded card with bullets: "10 pts for every ₹100 spent", "50 pts for referring a friend".
- "REWARDS CATALOG" section listing reward items as horizontal cards with name, coins required, and Redeem button.
- All using existing semantic tokens; add new `--reward-card` and `--reward-accent` tokens in `src/styles.css`.

## Technical details

### DB migration
- `ALTER TYPE booking_status ADD VALUE 'in_progress'`.
- `ALTER TABLE bookings ADD COLUMN approval_status text DEFAULT 'pending'`, `rejection_reason text`.
- `ALTER TABLE redemptions ADD COLUMN rejection_reason text`.
- `INSERT INTO app_settings (key,value) VALUES ('maintenance_mode','false'), ('maintenance_message','We are upgrading our systems. Please check back soon.')` (idempotent).
- New `customers` table: `phone text PK`, `name text`, `coins int default 0`, `created_at`. RLS: public select+upsert by phone (no PII beyond phone+name; same trust level as current guest bookings, which already accept name+phone publicly).
- Storage policy: tighten `house photos public upload` later — out of scope here.

### Files to add/modify
- modify: `src/components/BottomNav.tsx`, `src/routes/account.tsx`, `src/routes/index.tsx` (gate by maintenance), `src/routes/book.$serviceId.tsx`, `src/routes/quick-booking.tsx`, `src/routes/rewards.tsx`, `src/routes/track.$bookingId.tsx`, `src/routes/admin.tsx`, `src/routes/technician.tsx`, `src/styles.css`.
- add: `src/lib/customer-session.ts` (localStorage helpers), `src/components/MaintenanceGate.tsx`, `src/components/RejectDialog.tsx`.

### Out of scope (not in this change)
- Replacing Supabase auth for admin/technician (they keep email+password login).
- Fixing the open security findings on the storage bucket and guest booking enumeration — flagged separately.
