
-- Enums
CREATE TYPE app_role AS ENUM ('super_admin','empresa','sponsor');
CREATE TYPE company_size_t AS ENUM ('1-10','11-50','51-200','201-500','500+');
CREATE TYPE sponsor_level_t AS ENUM ('PLATINUM','GOLD','SILVER','BRONZE');
CREATE TYPE event_status_t AS ENUM ('draft','published','ongoing','finished','cancelled');
CREATE TYPE agenda_type_t AS ENUM ('bienvenida','charla','networking','coffee_break','comida','reuniones_1to1','cierre','panel');
CREATE TYPE match_status_t AS ENUM ('mutual','pending');
CREATE TYPE meeting_status_t AS ENUM ('pending','confirmed','completed','cancelled');
CREATE TYPE registration_status_t AS ENUM ('registered','confirmed','attended','cancelled');
CREATE TYPE attendee_role_t AS ENUM ('empresa','sponsor');

-- profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'empresa',
  full_name text,
  email text UNIQUE,
  phone text,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- has_role security definer (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- empresa_profiles
CREATE TABLE public.empresa_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  tagline text,
  description text,
  sector text,
  website text,
  logo_url text,
  cover_image_url text,
  location_city text,
  location_country text DEFAULT 'España',
  company_size company_size_t,
  linkedin_url text,
  twitter_url text,
  instagram_url text,
  tags text[] DEFAULT '{}',
  looking_for text,
  is_verified boolean DEFAULT false,
  profile_completion integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- sponsor_profiles
CREATE TABLE public.sponsor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  tagline text,
  description text,
  sector text,
  sponsorship_category text,
  sponsorship_level sponsor_level_t DEFAULT 'BRONZE',
  website text,
  logo_url text,
  cover_image_url text,
  location_city text,
  linkedin_url text,
  twitter_url text,
  native_integrations text[] DEFAULT '{}',
  categories text[] DEFAULT '{}',
  budget_range text,
  target_audience text,
  is_verified boolean DEFAULT false,
  profile_completion integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- events
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text UNIQUE,
  description text,
  cover_image_url text,
  event_date timestamptz,
  end_date timestamptz,
  location_name text,
  location_address text,
  location_city text,
  is_virtual boolean DEFAULT false,
  virtual_url text,
  status event_status_t DEFAULT 'draft',
  max_empresas integer,
  max_sponsors integer,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.event_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  time_start time,
  time_end time,
  title text NOT NULL,
  description text,
  speaker_name text,
  speaker_role text,
  room text,
  agenda_type agenda_type_t,
  order_index integer DEFAULT 0,
  event_date date
);

CREATE TABLE public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user_id, to_user_id, event_id)
);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  sponsor_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  status match_status_t DEFAULT 'pending',
  matched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(empresa_user_id, sponsor_user_id, event_id)
);

CREATE TABLE public.meetings_1to1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  empresa_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  sponsor_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_time timestamptz,
  duration_minutes integer DEFAULT 30,
  room text,
  status meeting_status_t DEFAULT 'pending',
  notes text,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.bulletin_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.invitation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  description text DEFAULT 'Código de invitación',
  discount_percent integer DEFAULT 100,
  max_uses integer,
  times_used integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invitation_code_id uuid REFERENCES public.invitation_codes(id) ON DELETE SET NULL,
  role_at_event attendee_role_t,
  attendee_name text,
  attendee_email text,
  attendee_company text,
  attendee_role_title text,
  status registration_status_t DEFAULT 'registered',
  checked_in_at timestamptz,
  registered_at timestamptz DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text,
  title text,
  body text,
  link text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX ON public.likes(from_user_id);
CREATE INDEX ON public.likes(to_user_id, event_id);
CREATE INDEX ON public.matches(empresa_user_id);
CREATE INDEX ON public.matches(sponsor_user_id);
CREATE INDEX ON public.messages(to_user_id, is_read);
CREATE INDEX ON public.notifications(user_id, is_read);
CREATE INDEX ON public.event_agenda(event_id, order_index);

-- handle_new_user trigger: auto-create profile row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'empresa')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Match trigger
CREATE OR REPLACE FUNCTION public.check_and_create_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reverse_exists boolean;
  from_role app_role;
  to_role app_role;
  emp_id uuid;
  spo_id uuid;
  emp_name text;
  spo_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.likes
    WHERE from_user_id = NEW.to_user_id
      AND to_user_id = NEW.from_user_id
      AND event_id IS NOT DISTINCT FROM NEW.event_id
  ) INTO reverse_exists;

  IF NOT reverse_exists THEN RETURN NEW; END IF;

  SELECT role INTO from_role FROM public.profiles WHERE id = NEW.from_user_id;
  SELECT role INTO to_role FROM public.profiles WHERE id = NEW.to_user_id;

  IF from_role = 'empresa' AND to_role = 'sponsor' THEN
    emp_id := NEW.from_user_id; spo_id := NEW.to_user_id;
  ELSIF from_role = 'sponsor' AND to_role = 'empresa' THEN
    emp_id := NEW.to_user_id; spo_id := NEW.from_user_id;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.matches (empresa_user_id, sponsor_user_id, event_id, status, matched_at)
  VALUES (emp_id, spo_id, NEW.event_id, 'mutual', now())
  ON CONFLICT (empresa_user_id, sponsor_user_id, event_id) DO UPDATE
    SET status = 'mutual', matched_at = now();

  SELECT company_name INTO emp_name FROM public.empresa_profiles WHERE user_id = emp_id;
  SELECT company_name INTO spo_name FROM public.sponsor_profiles WHERE user_id = spo_id;

  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (emp_id, 'new_match', '¡Nuevo match!', '¡Tienes un nuevo match con ' || COALESCE(spo_name,'un sponsor') || '!', '/empresa/mis-matches'),
    (spo_id, 'new_match', '¡Nuevo match!', '¡Tienes un nuevo match con ' || COALESCE(emp_name,'una empresa') || '!', '/sponsor/mis-matches');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_like_created
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.check_and_create_match();

-- Enable RLS on all
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings_1to1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulletin_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "profiles authed read basic" ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles admin all" ON public.profiles FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- empresa_profiles
CREATE POLICY "empresa read all authed" ON public.empresa_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "empresa self write" ON public.empresa_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "empresa admin all" ON public.empresa_profiles FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- sponsor_profiles
CREATE POLICY "sponsor read all authed" ON public.sponsor_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sponsor self write" ON public.sponsor_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sponsor admin all" ON public.sponsor_profiles FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- events
CREATE POLICY "events read published" ON public.events FOR SELECT USING (status = 'published' OR status = 'ongoing' OR status = 'finished' OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "events admin all" ON public.events FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- event_agenda
CREATE POLICY "agenda read authed" ON public.event_agenda FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "agenda admin all" ON public.event_agenda FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- likes
CREATE POLICY "likes read own" ON public.likes FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "likes insert own" ON public.likes FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "likes delete own" ON public.likes FOR DELETE USING (auth.uid() = from_user_id);

-- matches
CREATE POLICY "matches participants" ON public.matches FOR SELECT USING (auth.uid() = empresa_user_id OR auth.uid() = sponsor_user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "matches admin all" ON public.matches FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- meetings
CREATE POLICY "meetings participants" ON public.meetings_1to1 FOR SELECT USING (auth.uid() = empresa_user_id OR auth.uid() = sponsor_user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "meetings admin all" ON public.meetings_1to1 FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- messages
CREATE POLICY "messages participants read" ON public.messages FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "messages send" ON public.messages FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "messages mark read" ON public.messages FOR UPDATE USING (auth.uid() = to_user_id) WITH CHECK (auth.uid() = to_user_id);

-- bulletin
CREATE POLICY "bulletin read authed" ON public.bulletin_posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bulletin admin all" ON public.bulletin_posts FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- invitation_codes
CREATE POLICY "codes own read" ON public.invitation_codes FOR SELECT USING (auth.uid() = sponsor_user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "codes own write" ON public.invitation_codes FOR ALL USING (auth.uid() = sponsor_user_id) WITH CHECK (auth.uid() = sponsor_user_id);
CREATE POLICY "codes admin all" ON public.invitation_codes FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- event_registrations
CREATE POLICY "regs sponsor own" ON public.event_registrations FOR SELECT USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.invitation_codes ic WHERE ic.id = invitation_code_id AND ic.sponsor_user_id = auth.uid())
);
CREATE POLICY "regs admin all" ON public.event_registrations FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- notifications
CREATE POLICY "notif own read" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif own update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif admin all" ON public.notifications FOR ALL USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
