
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('customer','technician','admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id=_user_id ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'technician' THEN 2 ELSE 3 END LIMIT 1 $$;

-- Auto profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Services
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC NOT NULL DEFAULT 0,
  icon TEXT,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  coming_soon BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Bookings
CREATE TYPE public.booking_status AS ENUM ('pending','accepted','on_the_way','arrived','completed','cancelled');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  problem TEXT,
  address TEXT,
  customer_lat DOUBLE PRECISION NOT NULL,
  customer_lng DOUBLE PRECISION NOT NULL,
  technician_lat DOUBLE PRECISION,
  technician_lng DOUBLE PRECISION,
  distance_km NUMERIC,
  eta_minutes INT,
  price NUMERIC,
  status public.booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.bookings(customer_id);
CREATE INDEX ON public.bookings(technician_id);
CREATE INDEX ON public.bookings(status);

-- Location updates (tracking pings)
CREATE TABLE public.location_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;
CREATE INDEX ON public.location_updates(booking_id, created_at DESC);

-- App settings (rewards, support)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Rewards
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  reason TEXT,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS POLICIES

-- profiles
CREATE POLICY "profiles self select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_roles
CREATE POLICY "roles self select" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- services
CREATE POLICY "services public read" ON public.services FOR SELECT USING (TRUE);
CREATE POLICY "services admin manage" ON public.services FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- bookings
CREATE POLICY "bookings customer select" ON public.bookings FOR SELECT
  USING (auth.uid() = customer_id OR auth.uid() = technician_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bookings customer insert" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "bookings update by participants" ON public.bookings FOR UPDATE
  USING (auth.uid() = technician_id OR public.has_role(auth.uid(),'admin') OR (auth.uid() = customer_id AND status = 'pending'));
CREATE POLICY "bookings admin delete" ON public.bookings FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- location_updates
CREATE POLICY "loc select participants" ON public.location_updates FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin')
    OR auth.uid() = technician_id
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.customer_id = auth.uid())
  );
CREATE POLICY "loc insert technician" ON public.location_updates FOR INSERT
  WITH CHECK (auth.uid() = technician_id);

-- app_settings
CREATE POLICY "settings public read" ON public.app_settings FOR SELECT USING (TRUE);
CREATE POLICY "settings admin write" ON public.app_settings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- rewards
CREATE POLICY "rewards self read" ON public.rewards FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "rewards admin write" ON public.rewards FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed services
INSERT INTO public.services (name, description, base_price, icon, sort_order, coming_soon) VALUES
('PC Repair','General PC diagnostics & repair',200,'wrench',1,false),
('Desktop Setup','New desktop assembly & setup',299,'monitor',2,false),
('Software Installation','Install any software you need',149,'download',3,false),
('OS Install','Windows/Linux fresh install',499,'disc',4,false),
('Virus Removal','Remove malware & secure system',249,'shield',5,false),
('Laptop Repair','Hardware repair for laptops',0,'laptop',6,true);

-- Seed default settings
INSERT INTO public.app_settings (key, value) VALUES
('rewards_enabled','true'::jsonb),
('support_type','"phone"'::jsonb),
('support_phone','"+91 9999999999"'::jsonb);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_updates;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.location_updates REPLICA IDENTITY FULL;
