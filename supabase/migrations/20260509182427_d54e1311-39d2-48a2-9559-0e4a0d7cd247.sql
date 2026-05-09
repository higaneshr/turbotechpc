
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS invoice_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_price numeric,
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrival_otp text,
  ADD COLUMN IF NOT EXISTS process_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_sharing boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.set_arrival_otp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.technician_phone IS NOT NULL AND (OLD.arrival_otp IS NULL OR OLD.arrival_otp = '') THEN
    NEW.arrival_otp := lpad((floor(random()*10000))::int::text, 4, '0');
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS bookings_set_arrival_otp ON public.bookings;
CREATE TRIGGER bookings_set_arrival_otp
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_arrival_otp();
