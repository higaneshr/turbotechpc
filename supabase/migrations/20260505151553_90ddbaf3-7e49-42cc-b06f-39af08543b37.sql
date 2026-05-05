
DROP POLICY IF EXISTS "bookings select" ON public.bookings;
CREATE POLICY "bookings select"
ON public.bookings FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR auth.uid() = customer_id
  OR auth.uid() = technician_id
  OR (has_role(auth.uid(), 'technician'::app_role) AND status = 'pending'::booking_status)
  OR customer_id IS NULL
);
