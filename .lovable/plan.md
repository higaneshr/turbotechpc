## Goals

1. **Home UI clone** of the uploaded reference (TurboTech PC Quick Services).
2. **Fix post-booking redirect** so the customer lands on the booking detail page.
3. **My Bookings page** with an "Open" button → full details + invoice (added/edited by technician, price editable).
4. **Technician workflow**: "Process Started" button, location sharing toggle (start/stop), OTP-based arrival confirmation.
5. **Customer tracking**: visible status names (Approved / On the way / Arrived / In progress / Completed), not just ticks.

---

## 1. Home UI redesign (`src/routes/index.tsx`)

Match the reference closely:
- **Top header**: location pin + "Office / RP Road, Nanjangud" with chevron, search icon, avatar (mock).
- **Hero promo card** (dark navy bg, rounded-2xl):
  - Small "TurboTech – PC QUICK SERVICES" lockup top-left.
  - Big "GET A **FREE GIFT** ON FIRST BOOKING" headline (orange accent on FREE GIFT).
  - Promo code chip "USE CODE **FGT10**" with dashed border.
  - Orange "BOOK NOW →" pill button.
  - Illustrated character on the right (use `imagegen` to generate a friendly illustrated person holding a gift box, transparent PNG).
- **"Services offered near you"** section title with a black "↕ Popular" chip on the right.
- **Service card** (large image, rounded-3xl, soft orange shadow):
  - Hero image of the service.
  - Bottom-left blue chip "🎁 Free gift".
  - Bottom-right dark chip with bike icon + "25 mins".
  - Below image: service name (bold) + green rating chip "4.3 ★" right-aligned.
  - "Price Range ₹250–₹550".
  - Bookmark icon top-right of image.
- Use semantic tokens; add new tokens (promo bg, orange accent, soft shadow) to `src/styles.css`.

Generate one illustration asset for the hero (`src/assets/hero-gift.png`, transparent).

---

## 2. Fix booking redirect (`src/routes/book.$serviceId.tsx`)

After successful insert, the navigation `navigate({ to: "/track/$bookingId", ... })` is correct but `track.$bookingId.tsx` likely 404s for guest sessions (no auth). Make `/track/$bookingId` publicly accessible (no auth gate) and load by id. Also store the new booking id in localStorage under `ttagency_last_booking` so "My Bookings" can find guest bookings.

---

## 3. My Bookings page (`src/routes/bookings.tsx`)

- Remove the `redirect to /auth` guard (we use phone session, not Supabase auth).
- Query bookings by `customer_phone = session.phone` OR by ids stored in localStorage for unauthenticated guests.
- Each row shows service name, date, status badge, and **"Open" button** → navigates to `/track/$bookingId`.

---

## 4. Booking detail / Invoice (`src/routes/track.$bookingId.tsx`)

Add an **Invoice card** (visible to customer, editable by technician):
- Line items: service base, parts (technician adds), labor.
- **Final price** (technician can edit before "Process Started").
- New columns on `bookings`: `invoice_items jsonb`, `final_price numeric`, `arrived_at timestamptz`, `arrival_otp text`, `process_started_at timestamptz`.
- Technician view (`technician.tsx`) gets:
  - Edit invoice + price (input fields, save button).
  - "Process Started" button (sets `status='in_progress'`, `process_started_at=now()`).
  - "Request Arrival OTP" → reveals 4-digit OTP from `arrival_otp` (auto-generated server-side on assignment).
  - **Location sharing toggle** (Start / Stop) controlling the existing GPS interval.
- Customer view shows the OTP prominently when status is `accepted` and technician is en route. They read it out to the technician. Technician enters it → marks `status='arrived'`.

---

## 5. Visible status timeline (customer track page)

Replace tick-only stepper with a labeled vertical timeline:
```
● Pending callback
● Approved
● On the way
● Arrived
● Repair in progress
● Completed
```
Each step shows label + timestamp + colored dot (filled = done, ring = current, gray = upcoming).

---

## 6. Database migration

```sql
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS invoice_items jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_price numeric,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_otp text,
  ADD COLUMN IF NOT EXISTS process_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_sharing boolean DEFAULT true;

-- Generate arrival OTP when technician is assigned
CREATE OR REPLACE FUNCTION public.set_arrival_otp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.technician_phone IS NOT NULL AND OLD.arrival_otp IS NULL THEN
    NEW.arrival_otp := lpad((floor(random()*10000))::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER bookings_set_arrival_otp
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_arrival_otp();
```

Also relax / verify RLS so guest customers (filtered by `customer_phone`) and technicians (filtered by `technician_phone`) can read & update relevant columns.

---

## Files

**New asset**: `src/assets/hero-gift.png` (generated).

**Migration**: `supabase/migrations/<ts>_invoice_otp_flow.sql`.

**Edited**:
- `src/routes/index.tsx` — full UI clone.
- `src/styles.css` — promo tokens.
- `src/routes/book.$serviceId.tsx` — store last booking id.
- `src/routes/bookings.tsx` — remove auth guard, phone-based query, "Open" button.
- `src/routes/track.$bookingId.tsx` — labeled timeline + invoice card + arrival OTP display.
- `src/routes/technician.tsx` — invoice editor, price edit, Process Started, OTP entry, location toggle.

## Out of scope

- Real SMS for arrival OTP (shown in-app only).
- Payments / actual invoice PDF export.
