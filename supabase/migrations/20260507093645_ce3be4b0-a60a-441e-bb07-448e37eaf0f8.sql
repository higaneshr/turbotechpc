
-- Customer phone-only sessions
CREATE TABLE IF NOT EXISTS public.customers (
  phone text PRIMARY KEY,
  name text NOT NULL,
  coins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers public read" ON public.customers;
CREATE POLICY "customers public read" ON public.customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "customers public insert" ON public.customers;
CREATE POLICY "customers public insert" ON public.customers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "customers public update" ON public.customers;
CREATE POLICY "customers public update" ON public.customers FOR UPDATE USING (true) WITH CHECK (true);

-- Booking approval / rejection columns
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Redemption rejection reason
ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS rejection_reason text;

-- in_progress booking status (Repair started)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'booking_status' AND e.enumlabel = 'in_progress'
  ) THEN
    ALTER TYPE booking_status ADD VALUE 'in_progress' BEFORE 'completed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'booking_status' AND e.enumlabel = 'rejected'
  ) THEN
    ALTER TYPE booking_status ADD VALUE 'rejected';
  END IF;
END $$;

-- Maintenance settings (idempotent inserts)
INSERT INTO public.app_settings(key, value) VALUES ('maintenance_mode', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings(key, value) VALUES ('maintenance_message', '"We are upgrading our systems. Please check back soon."'::jsonb)
  ON CONFLICT (key) DO NOTHING;
