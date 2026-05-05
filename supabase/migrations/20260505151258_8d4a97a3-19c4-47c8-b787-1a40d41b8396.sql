
-- Make customer fields friendlier for guest bookings
ALTER TABLE public.bookings ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS house_photo_url text;

-- Allow anonymous/guest inserts on bookings
DROP POLICY IF EXISTS "bookings customer insert" ON public.bookings;
CREATE POLICY "bookings public insert"
ON public.bookings FOR INSERT
WITH CHECK (customer_id IS NULL OR auth.uid() = customer_id);

-- Allow any technician to claim & approve a pending booking; keep existing rights
DROP POLICY IF EXISTS "bookings update by participants" ON public.bookings;
CREATE POLICY "bookings update by participants"
ON public.bookings FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = technician_id
  OR (auth.uid() = customer_id AND status = 'pending'::booking_status)
  OR (has_role(auth.uid(), 'technician'::app_role) AND status = 'pending'::booking_status)
);

-- Allow technicians to view all pending bookings (for the approval queue)
DROP POLICY IF EXISTS "bookings customer select" ON public.bookings;
CREATE POLICY "bookings select"
ON public.bookings FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = customer_id
  OR auth.uid() = technician_id
  OR (has_role(auth.uid(), 'technician'::app_role) AND status = 'pending'::booking_status)
);

-- New services
INSERT INTO public.services (name, description, base_price, icon, sort_order, available)
VALUES
  ('Unknown Problem', 'Not sure what is wrong? We will diagnose it on-site.', 299, 'wrench', 100, true),
  ('Quick Service', 'Fast 15-minute fixes — small tweaks, settings, quick installs.', 199, 'cpu', 101, true)
ON CONFLICT DO NOTHING;

-- Storage bucket for optional house photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('house-photos', 'house-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can upload (guests included)
CREATE POLICY "house photos public upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'house-photos');

CREATE POLICY "house photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'house-photos');
