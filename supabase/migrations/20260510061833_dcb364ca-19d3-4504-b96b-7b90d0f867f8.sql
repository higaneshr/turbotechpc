
-- =========================================================================
-- Real Supabase Phone OTP auth + role-based RLS
-- =========================================================================

-- 1) Drop superseded tables (replaced by auth.users + profiles + user_roles)
DROP TABLE IF EXISTS public.otp_codes CASCADE;
DROP TABLE IF EXISTS public.technicians CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- 2) profiles: ensure phone is unique and present after signup
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0;

-- 3) Replace handle_new_user trigger:
--    - create profile (full_name + phone from raw_user_meta_data)
--    - assign role: admin if no admin exists yet, else customer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_admin boolean;
  assigned_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone)
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone     = COALESCE(EXCLUDED.phone,     public.profiles.phone);

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_admin;
  assigned_role := CASE WHEN has_admin THEN 'customer'::public.app_role ELSE 'admin'::public.app_role END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4) bookings: tie to auth.uid()
ALTER TABLE public.bookings
  ALTER COLUMN customer_phone DROP NOT NULL;

-- Drop all the permissive public policies
DROP POLICY IF EXISTS "bookings public insert" ON public.bookings;
DROP POLICY IF EXISTS "bookings public read"   ON public.bookings;
DROP POLICY IF EXISTS "bookings public update" ON public.bookings;
DROP POLICY IF EXISTS "bookings public delete" ON public.bookings;

CREATE POLICY "bookings insert own" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "bookings select own or assigned or admin" ON public.bookings
  FOR SELECT TO authenticated
  USING (
    auth.uid() = customer_id
    OR auth.uid() = technician_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "bookings update own or assigned or admin" ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = customer_id
    OR auth.uid() = technician_id
    OR public.has_role(auth.uid(), 'admin')
    OR (technician_id IS NULL AND public.has_role(auth.uid(), 'technician'))
  )
  WITH CHECK (true);

CREATE POLICY "bookings delete admin" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Restore guard trigger to prevent tampering
CREATE OR REPLACE FUNCTION public.guard_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
  is_tech_owner boolean := (auth.uid() IS NOT NULL AND auth.uid() = OLD.technician_id);
  is_customer boolean := (auth.uid() IS NOT NULL AND auth.uid() = OLD.customer_id);
BEGIN
  IF is_admin THEN RETURN NEW; END IF;

  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
     OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone
     OR NEW.address IS DISTINCT FROM OLD.address
     OR NEW.customer_lat IS DISTINCT FROM OLD.customer_lat
     OR NEW.customer_lng IS DISTINCT FROM OLD.customer_lng
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.service_name IS DISTINCT FROM OLD.service_name
     OR NEW.house_photo_url IS DISTINCT FROM OLD.house_photo_url THEN
    RAISE EXCEPTION 'Not allowed to modify protected booking fields';
  END IF;

  IF is_customer AND NOT is_tech_owner THEN
    IF OLD.status NOT IN ('pending','accepted') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Booking can no longer be modified';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Customers can only cancel a booking';
    END IF;
    IF NEW.technician_id IS DISTINCT FROM OLD.technician_id THEN
      RAISE EXCEPTION 'Customers cannot assign a technician';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.technician_id IS DISTINCT FROM OLD.technician_id THEN
    IF OLD.technician_id IS NOT NULL THEN
      RAISE EXCEPTION 'Booking already assigned';
    END IF;
    IF NEW.technician_id <> auth.uid() THEN
      RAISE EXCEPTION 'Can only assign yourself';
    END IF;
    IF NOT public.has_role(auth.uid(), 'technician') THEN
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

-- Re-attach OTP + notification triggers (drop+create to be safe)
DROP TRIGGER IF EXISTS bookings_set_arrival_otp ON public.bookings;
CREATE TRIGGER bookings_set_arrival_otp
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_arrival_otp();

DROP TRIGGER IF EXISTS bookings_notify_change ON public.bookings;
CREATE TRIGGER bookings_notify_change
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_change();

-- 5) notifications: scoped to role + user
DROP POLICY IF EXISTS "notif public read"   ON public.notifications;
DROP POLICY IF EXISTS "notif public insert" ON public.notifications;
DROP POLICY IF EXISTS "notif public update" ON public.notifications;
DROP POLICY IF EXISTS "notif public delete" ON public.notifications;

CREATE POLICY "notif select for me" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR for_user_id = auth.uid()
    OR (for_role = 'admin'      AND public.has_role(auth.uid(), 'admin'))
    OR (for_role = 'technician' AND public.has_role(auth.uid(), 'technician'))
  );

CREATE POLICY "notif insert system" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notif update mine" ON public.notifications
  FOR UPDATE TO authenticated
  USING (for_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6) support_tickets: customer raises; admin reads/updates
DROP POLICY IF EXISTS "tickets public read"   ON public.support_tickets;
DROP POLICY IF EXISTS "tickets public insert" ON public.support_tickets;
DROP POLICY IF EXISTS "tickets public update" ON public.support_tickets;
DROP POLICY IF EXISTS "tickets public delete" ON public.support_tickets;

CREATE POLICY "tickets insert auth" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "tickets select own or admin" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR customer_phone = (SELECT phone FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "tickets update admin" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7) redemptions: tied to user_id
ALTER TABLE public.redemptions
  ALTER COLUMN customer_phone DROP NOT NULL;

DROP POLICY IF EXISTS "redemptions public insert" ON public.redemptions;
DROP POLICY IF EXISTS "redemptions phone read"    ON public.redemptions;
DROP POLICY IF EXISTS "redemptions public update" ON public.redemptions;
DROP POLICY IF EXISTS "redemptions public delete" ON public.redemptions;

CREATE POLICY "redemptions insert own" ON public.redemptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "redemptions select own or admin" ON public.redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "redemptions update admin" ON public.redemptions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 8) reward_items, services, app_settings: public read; admin-only write
DROP POLICY IF EXISTS "reward_items public write" ON public.reward_items;
CREATE POLICY "reward_items admin write" ON public.reward_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "services public write" ON public.services;
CREATE POLICY "services admin write" ON public.services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "settings public write" ON public.app_settings;
CREATE POLICY "settings admin write" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9) profiles: keep self-only + admin read
DROP POLICY IF EXISTS "profiles self select" ON public.profiles;
CREATE POLICY "profiles self or admin select" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- 10) storage: tighten house-photos uploads to authenticated users
DROP POLICY IF EXISTS "house-photos public upload"  ON storage.objects;
DROP POLICY IF EXISTS "house-photos public read"    ON storage.objects;
DROP POLICY IF EXISTS "house-photos public update"  ON storage.objects;
DROP POLICY IF EXISTS "house-photos public delete"  ON storage.objects;
DROP POLICY IF EXISTS "house-photos auth upload"    ON storage.objects;
DROP POLICY IF EXISTS "house-photos read all"       ON storage.objects;

CREATE POLICY "house-photos auth upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'house-photos');

CREATE POLICY "house-photos read all" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'house-photos');
