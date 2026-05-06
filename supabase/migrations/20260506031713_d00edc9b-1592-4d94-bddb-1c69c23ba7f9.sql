
-- Reward items catalog
CREATE TABLE IF NOT EXISTS public.reward_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  coins_required integer NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reward_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reward_items public read" ON public.reward_items FOR SELECT USING (true);
CREATE POLICY "reward_items admin write" ON public.reward_items FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Redemptions
CREATE TABLE IF NOT EXISTS public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  user_id uuid,
  reward_item_id uuid REFERENCES public.reward_items(id),
  reward_name text NOT NULL,
  coins_spent integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions admin all" ON public.redemptions FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "redemptions public insert" ON public.redemptions FOR INSERT WITH CHECK (true);
CREATE POLICY "redemptions phone read" ON public.redemptions FOR SELECT USING (true);

-- Support tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets admin all" ON public.support_tickets FOR ALL
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "tickets public insert" ON public.support_tickets FOR INSERT WITH CHECK (true);

-- Coins balance on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0;

-- Seed default reward items if none exist
INSERT INTO public.reward_items (name, coins_required, sort_order, image_url, description)
SELECT * FROM (VALUES
  ('Free Mouse', 15, 1, NULL, 'Wired optical mouse'),
  ('Keyboard', 20, 2, NULL, 'Standard wired keyboard'),
  ('Mouse Pad Combo', 50, 3, NULL, 'Premium mouse pad combo'),
  ('Pendrive 32GB', 100, 4, NULL, 'USB 3.0 pendrive'),
  ('Monitor', 200, 5, NULL, '21" LED monitor'),
  ('Premium Mechanical Keyboard', 500, 6, NULL, 'RGB mechanical keyboard')
) AS v(name, coins, ord, img, descr)
WHERE NOT EXISTS (SELECT 1 FROM public.reward_items);

-- Seed default support settings
INSERT INTO public.app_settings (key, value) VALUES
  ('support_phone_enabled', 'true'::jsonb),
  ('support_whatsapp_enabled', 'true'::jsonb),
  ('support_email_enabled', 'true'::jsonb),
  ('support_ticket_enabled', 'true'::jsonb),
  ('support_phone', '"+91 9944998946"'::jsonb),
  ('support_whatsapp', '"+91 9944998946"'::jsonb),
  ('support_email', '"support@turbotech.in"'::jsonb)
ON CONFLICT (key) DO NOTHING;
