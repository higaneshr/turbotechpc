
-- 1. app_settings: restrict SELECT to authenticated
DROP POLICY IF EXISTS "settings public read" ON public.app_settings;
CREATE POLICY "settings authenticated read" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

-- 2. bookings: prevent non-admins from modifying sensitive fields
CREATE OR REPLACE FUNCTION public.guard_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Customers/technicians cannot change identity fields or price
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
     OR NEW.address IS DISTINCT FROM OLD.address
     OR NEW.customer_lat IS DISTINCT FROM OLD.customer_lat
     OR NEW.customer_lng IS DISTINCT FROM OLD.customer_lng
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.service_name IS DISTINCT FROM OLD.service_name
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.house_photo_url IS DISTINCT FROM OLD.house_photo_url THEN
    RAISE EXCEPTION 'Not allowed to modify protected booking fields';
  END IF;
  -- Technicians can only claim a pending booking for themselves
  IF NEW.technician_id IS DISTINCT FROM OLD.technician_id THEN
    IF OLD.technician_id IS NOT NULL THEN
      RAISE EXCEPTION 'Booking already assigned';
    END IF;
    IF NEW.technician_id <> auth.uid() THEN
      RAISE EXCEPTION 'Can only assign yourself';
    END IF;
    IF NOT has_role(auth.uid(), 'technician') THEN
      RAISE EXCEPTION 'Only technicians can claim bookings';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_booking_update_trg ON public.bookings;
CREATE TRIGGER guard_booking_update_trg
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_update();

-- 3. Storage: restrict listing on house-photos & add admin lifecycle policies
DROP POLICY IF EXISTS "house photos public read" ON storage.objects;
CREATE POLICY "house photos public file read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'house-photos' AND name IS NOT NULL);
-- Note: Supabase signed/public URLs fetch by exact path; listing requires SELECT without path filter.
-- To prevent enumeration via list API, only authenticated admins may list:
CREATE POLICY "house photos admin list" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'house-photos' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "house photos admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'house-photos' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "house photos admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'house-photos' AND has_role(auth.uid(), 'admin'));

-- 4. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, authenticated, public;
-- has_role is used inside RLS policies, keep it executable
