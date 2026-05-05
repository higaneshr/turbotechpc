
-- Add scheduled_at
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Allow guest (customer_id IS NULL) to update their own pending booking via direct link
DROP POLICY IF EXISTS "bookings update by participants" ON public.bookings;
CREATE POLICY "bookings update by participants" ON public.bookings
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin')
    OR auth.uid() = technician_id
    OR (auth.uid() = customer_id AND status = 'pending')
    OR (has_role(auth.uid(), 'technician') AND status = 'pending')
    OR (customer_id IS NULL AND status = 'pending')
  );

-- Replace guard trigger to permit status->cancelled and scheduled_at edits while pending
CREATE OR REPLACE FUNCTION public.guard_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := has_role(auth.uid(), 'admin');
  is_tech_owner boolean := (auth.uid() IS NOT NULL AND auth.uid() = OLD.technician_id);
  is_customer boolean := (auth.uid() IS NOT NULL AND auth.uid() = OLD.customer_id);
  is_guest_owner boolean := (OLD.customer_id IS NULL); -- guest path (gated by RLS to pending only)
BEGIN
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Block changes to identity / pricing fields for everyone except admin
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

  -- Customer / guest path: only allow cancellation or rescheduling while pending
  IF (is_customer OR is_guest_owner) AND NOT is_tech_owner THEN
    IF OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'Booking can no longer be modified';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Customers can only cancel a pending booking';
    END IF;
    IF NEW.technician_id IS DISTINCT FROM OLD.technician_id THEN
      RAISE EXCEPTION 'Customers cannot assign a technician';
    END IF;
    RETURN NEW;
  END IF;

  -- Technician self-claim path (only when transitioning from pending and unassigned)
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

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  for_role text NOT NULL CHECK (for_role IN ('admin','technician','all')),
  for_user_id uuid,
  type text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif admin all" ON public.notifications
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "notif technician read" ON public.notifications
  FOR SELECT USING (
    has_role(auth.uid(), 'technician') AND (
      for_role IN ('technician','all')
      OR for_user_id = auth.uid()
    )
  );
CREATE POLICY "notif admin write" ON public.notifications
  FOR ALL USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "notif owner update" ON public.notifications
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin')
    OR (has_role(auth.uid(), 'technician') AND (for_role IN ('technician','all') OR for_user_id = auth.uid()))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger that emits notifications on cancel / reschedule
CREATE OR REPLACE FUNCTION public.notify_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who text := COALESCE(OLD.customer_name, 'Customer');
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO public.notifications(booking_id, for_role, for_user_id, type, message)
    VALUES (NEW.id, 'admin', NULL, 'booking_cancelled',
            who || ' cancelled booking for ' || NEW.service_name);
    IF NEW.technician_id IS NOT NULL THEN
      INSERT INTO public.notifications(booking_id, for_role, for_user_id, type, message)
      VALUES (NEW.id, 'technician', NEW.technician_id, 'booking_cancelled',
              who || ' cancelled the booking');
    ELSE
      INSERT INTO public.notifications(booking_id, for_role, for_user_id, type, message)
      VALUES (NEW.id, 'technician', NULL, 'booking_cancelled',
              'A pending booking was cancelled');
    END IF;
  ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    INSERT INTO public.notifications(booking_id, for_role, for_user_id, type, message)
    VALUES (NEW.id, 'admin', NULL, 'booking_rescheduled',
            who || ' rescheduled to ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI'));
    INSERT INTO public.notifications(booking_id, for_role,
                                     for_user_id, type, message)
    VALUES (NEW.id, 'technician', NEW.technician_id, 'booking_rescheduled',
            who || ' rescheduled to ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_booking_change_trg ON public.bookings;
CREATE TRIGGER notify_booking_change_trg
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_booking_change();

REVOKE EXECUTE ON FUNCTION public.guard_booking_update() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_booking_change() FROM anon, authenticated, public;
