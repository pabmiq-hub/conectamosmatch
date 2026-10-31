# Conectamos Match

Build a full B2B matchmaking SaaS platform called "CONECTAMOS MATCH" using React, TypeScript, Tailwind CSS, shadcn/ui and Supabase.




The platform connects COMPANIES (Empresas) and SPONSORS through curated networking events managed by a Super Admin. It has 3 completely separate role-based dashboards with different permissions and features.




---




## BRAND IDENTITY & VISUAL STYLE




Platform name: CONECTAMOS MATCH 

Sub-brand: by Conectamos.club 




Visual identity based on https://conectamos.club/:

- Dark background aesthetic: primary background #0A0A0A (near black)

- Card backgrounds: #111111 with subtle borders #1E1E1E

- Primary accent: #FFFFFF (white text, white icons on dark)

- Action/highlight color: #F5C842 (golden yellow — used for CTAs, badges, active states, like buttons)

- Secondary accent: #4ADE80 (green for confirmed/active states)

- Danger: #EF4444

- Font: "Space Grotesk" for headings (Google Fonts), "Inter" for body — clean, modern, tech-adjacent

- All uppercase for section titles and nav items (like competition)

- Logo: use the Conectamos.club isotipo (circular node/connection mark) + wordmark "CONECTAMOS MATCH" in white

- Cards: dark background, thin border, slight hover lift effect (transform translateY -2px)

- Buttons primary: solid golden yellow (#F5C842) with black text, font-weight bold

- Buttons secondary: outlined white border, white text

- Badges: uppercase, small, pill shape — PLATINUM (gradient gold), GOLD (#F5C842 bg, black text), SILVER (#9CA3AF bg), BRONZE (#CD7F32 bg)

- Navigation sidebar: #0D0D0D background, icons + uppercase labels, active item has golden yellow left border accent

- Tables: dark rows with #161616 alternating, white text, no heavy borders




---




## SUPABASE DATABASE SCHEMA




Create all these tables with proper foreign keys, indexes and Row Level Security:




### auth.users (Supabase built-in)




### profiles

- id uuid PRIMARY KEY references auth.users

- role text CHECK (role IN ('super_admin', 'empresa', 'sponsor'))

- full_name text

- email text UNIQUE

- phone text

- avatar_url text

- is_active boolean DEFAULT true

- created_at timestamptz DEFAULT now()

- updated_at timestamptz DEFAULT now()




### empresa_profiles

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- user_id uuid REFERENCES profiles(id) UNIQUE

- company_name text NOT NULL

- tagline text (short phrase describing the company)

- description text (2-3 paragraphs)

- sector text (e.g. "Automotive", "Health & Wellness", "Technology")

- website text

- logo_url text

- cover_image_url text

- location_city text

- location_country text DEFAULT 'España'

- company_size text CHECK (company_size IN ('1-10','11-50','51-200','201-500','500+'))

- linkedin_url text

- twitter_url text

- instagram_url text

- tags text[] (array of interest keywords)

- looking_for text (what they seek from sponsors)

- is_verified boolean DEFAULT false

- profile_completion integer DEFAULT 0

- created_at timestamptz DEFAULT now()

- updated_at timestamptz DEFAULT now()




### sponsor_profiles

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- user_id uuid REFERENCES profiles(id) UNIQUE

- company_name text NOT NULL

- tagline text

- description text

- sector text

- sponsorship_category text (e.g. "Loyalty", "Chatbot", "CRM Marketing Automation", "Buscador", "Pagos")

- sponsorship_level text CHECK (sponsorship_level IN ('PLATINUM','GOLD','SILVER','BRONZE'))

- website text

- logo_url text

- cover_image_url text

- location_city text

- linkedin_url text

- twitter_url text

- native_integrations text[] (array of other sponsor company names they integrate with)

- categories text[] (array of product categories)

- budget_range text

- target_audience text

- is_verified boolean DEFAULT false

- profile_completion integer DEFAULT 0

- created_at timestamptz DEFAULT now()

- updated_at timestamptz DEFAULT now()




### events

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- created_by uuid REFERENCES profiles(id)

- title text NOT NULL

- slug text UNIQUE

- description text

- cover_image_url text

- event_date timestamptz

- end_date timestamptz

- location_name text

- location_address text

- location_city text

- is_virtual boolean DEFAULT false

- virtual_url text

- status text CHECK (status IN ('draft','published','ongoing','finished','cancelled')) DEFAULT 'draft'

- max_empresas integer

- max_sponsors integer

- is_active boolean DEFAULT true

- created_at timestamptz DEFAULT now()




### event_agenda

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- event_id uuid REFERENCES events(id) ON DELETE CASCADE

- time_start time

- time_end time

- title text NOT NULL

- description text

- speaker_name text

- speaker_role text

- room text (e.g. "Salón Claridge", "Salón Cibeles", "zona lounge")

- agenda_type text CHECK (agenda_type IN ('bienvenida','charla','networking','coffee_break','comida','reuniones_1to1','cierre','panel')) 

- order_index integer

- event_date date (for multi-day events)




### likes

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- from_user_id uuid REFERENCES profiles(id)

- to_user_id uuid REFERENCES profiles(id)

- event_id uuid REFERENCES events(id)

- created_at timestamptz DEFAULT now()

- UNIQUE(from_user_id, to_user_id, event_id)




### matches

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- empresa_user_id uuid REFERENCES profiles(id)

- sponsor_user_id uuid REFERENCES profiles(id)

- event_id uuid REFERENCES events(id)

- status text CHECK (status IN ('mutual','pending')) DEFAULT 'pending'

- matched_at timestamptz

- created_at timestamptz DEFAULT now()




### meetings_1to1

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- match_id uuid REFERENCES matches(id)

- event_id uuid REFERENCES events(id)

- empresa_user_id uuid REFERENCES profiles(id)

- sponsor_user_id uuid REFERENCES profiles(id)

- scheduled_time timestamptz

- duration_minutes integer DEFAULT 30

- room text

- status text CHECK (status IN ('pending','confirmed','completed','cancelled')) DEFAULT 'pending'

- notes text

- assigned_by uuid REFERENCES profiles(id) (super_admin who assigned it)

- created_at timestamptz DEFAULT now()




### messages

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- from_user_id uuid REFERENCES profiles(id)

- to_user_id uuid REFERENCES profiles(id)

- event_id uuid REFERENCES events(id)

- content text NOT NULL

- is_read boolean DEFAULT false

- read_at timestamptz

- created_at timestamptz DEFAULT now()




### bulletin_posts (Tablón)

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- author_id uuid REFERENCES profiles(id)

- event_id uuid REFERENCES events(id)

- content text NOT NULL

- created_at timestamptz DEFAULT now()




### invitation_codes (Mis Códigos — for sponsors)

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- sponsor_user_id uuid REFERENCES profiles(id)

- event_id uuid REFERENCES events(id)

- code text UNIQUE NOT NULL

- description text DEFAULT 'Código de invitación'

- discount_percent integer DEFAULT 100

- max_uses integer (null = unlimited)

- times_used integer DEFAULT 0

- is_active boolean DEFAULT true

- created_at timestamptz DEFAULT now()




### event_registrations (Mis Invitados — tracking who used a code)

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- event_id uuid REFERENCES events(id)

- user_id uuid REFERENCES profiles(id)

- invitation_code_id uuid REFERENCES invitation_codes(id)

- role_at_event text CHECK (role_at_event IN ('empresa','sponsor'))

- attendee_name text

- attendee_email text

- attendee_company text

- attendee_role_title text

- status text CHECK (status IN ('registered','confirmed','attended','cancelled')) DEFAULT 'registered'

- checked_in_at timestamptz

- registered_at timestamptz DEFAULT now()




### notifications

- id uuid PRIMARY KEY DEFAULT gen_random_uuid()

- user_id uuid REFERENCES profiles(id)

- type text (e.g. 'new_like', 'new_match', 'new_message', 'new_meeting', 'new_bulletin')

- title text

- body text

- link text

- is_read boolean DEFAULT false

- created_at timestamptz DEFAULT now()




---




## ROW LEVEL SECURITY




Enable RLS on all tables:




- super_admin: full access to everything (check profiles.role = 'super_admin')

- empresa users: 

  - Read/write own empresa_profile

  - Read sponsor_profiles (all fields)

  - Read other empresa_profiles (limited: name, sector, description, logo only)

  - Read published events and event_agenda

  - Manage own likes, see own matches

  - Read/write own messages

  - Read bulletin_posts for their events

  - Read own meetings_1to1

  - Read own notifications

- sponsor users:

  - Read/write own sponsor_profile  

  - Read empresa_profiles (all fields)

  - Read other sponsor_profiles (limited)

  - Read published events and event_agenda

  - Manage own likes, see own matches

  - Read/write own messages

  - Read bulletin_posts

  - Read own meetings_1to1

  - Manage own invitation_codes

  - Read own event_registrations (invitados who used their code)

  - Read own notifications

- matches: only visible to the two matched users + super_admin

- messages: only from_user or to_user can read




---




## MATCH LOGIC (Database Function)




Create a Supabase PostgreSQL function `check_and_create_match`:

- Triggered after INSERT on likes table

- Checks if the reverse like exists (to_user_id liked from_user_id in same event)

- If mutual like exists AND one user is 'empresa' and the other is 'sponsor':

  - Creates a record in matches table with status 'mutual' and matched_at = now()

  - Creates notifications for both users: "¡Tienes un nuevo match con [company_name]!"




---




## APP ROUTES STRUCTURE




Public routes:

- / → Landing page (dark, branded)

- /login → Login page

- /registro → Registration page with role selector




Protected routes (redirect to /login if not authenticated):




Super Admin (/admin/*):

- /admin → Dashboard overview

- /admin/usuarios → User management

- /admin/usuarios/nuevo → Create new user (enriched form)

- /admin/usuarios/:id → Edit user

- /admin/eventos → Events list

- /admin/eventos/nuevo → Create event

- /admin/eventos/:id → Edit event + manage agenda

- /admin/eventos/:id/agenda → Manage agenda items

- /admin/matches → View all matches

- /admin/reuniones → Manage 1to1 meetings (assign meetings between matched pairs)

- /admin/codigos → Manage invitation codes

- /admin/tablón → Post to bulletin board




Empresa dashboard (/empresa/*):

- /empresa/dashboard → Main dashboard

- /empresa/mi-ficha → Edit company profile

- /empresa/ver-sponsors → Browse all sponsors (with like/msg/view actions)

- /empresa/ver-empresas → Browse other companies

- /empresa/mis-matches → View mutual matches (sponsors who liked back)

- /empresa/reuniones-1to1 → View assigned 1to1 meetings

- /empresa/mensajes → Inbox + conversation view

- /empresa/tablon → Bulletin board (read)

- /empresa/agenda → Event agenda




Sponsor dashboard (/sponsor/*):

- /sponsor/dashboard → Main dashboard

- /sponsor/mi-ficha → Edit sponsor profile (with integrations + categories)

- /sponsor/ver-empresas → Browse all companies (with like/msg/view actions — locked if BRONZE level)

- /sponsor/mis-matches → View mutual matches

- /sponsor/reuniones-1to1 → View assigned meetings

- /sponsor/mis-codigos → Invitation codes management + stats

- /sponsor/mis-invitados → List of attendees who used their code

- /sponsor/mensajes → Inbox + conversation view

- /sponsor/tablon → Bulletin board

- /sponsor/agenda → Event agenda




---




## AUTHENTICATION




1. /login page: email + password form, dark themed, logo centered, "Olvidé mi contraseña" link

2. /registro page: 

   - Step 1: Select role card (Empresa / Sponsor) with icons and descriptions

   - Step 2: Fill enriched registration form based on role

   - Empresa form fields: full_name, email, password, company_name, sector (select), company_size (select), phone, website, description, tagline, location_city, linkedin_url

   - Sponsor form fields: full_name, email, password, company_name, sector, sponsorship_category, sponsorship_level (select), phone, website, description, tagline, linkedin_url

   - After submit: email verification → redirect to dashboard

3. After login: query profiles.role → redirect to /admin, /empresa/dashboard, or /sponsor/dashboard

4. Protected routes: HOC or layout component that checks session + role




---




## SUPER ADMIN PANEL — DETAILED SPECS




### Layout

- Top bar: logo left, "PANEL DE ADMINISTRACIÓN" title, notifications bell, admin avatar + name right

- Sidebar: collapsible, dark, icon + label navigation




### /admin Dashboard

Stats cards (4 in a row):

- Total Empresas registradas

- Total Sponsors registrados  

- Total Matches producidos

- Próximos eventos




Recent activity feed (last 10 matches, registrations, messages)

Quick links: "Crear Evento", "Añadir Usuario", "Ver Matches"




### /admin/usuarios

Table with columns: Avatar | Nombre | Email | Rol (badge) | Estado (Activo/Inactivo badge) | Fecha registro | Acciones (Ver, Editar, Activar/Desactivar)

Filter by role (Empresa/Sponsor/Todos), search by name/email

"+ Nuevo Usuario" button top right




### /admin/usuarios/nuevo (Enriched form)

Multi-step form:

Step 1 — Datos básicos: full_name, email, password (auto-generate button), phone, role selector (Empresa/Sponsor), is_active toggle

Step 2 — Perfil de empresa OR perfil de sponsor (dynamic based on role):

  Empresa: company_name, tagline, description, sector, company_size, website, logo upload, linkedin, twitter, instagram, tags (multi-select chips), looking_for

  Sponsor: company_name, tagline, description, sector, sponsorship_category, sponsorship_level (PLATINUM/GOLD/SILVER/BRONZE selector with visual badges), website, logo upload, linkedin, twitter, budget_range, target_audience, native_integrations (search + add other sponsors), categories (multi-select chips)

Step 3 — Review & confirm

After creation: show credentials and "Copy invite link" button




### /admin/eventos

Cards grid showing events: cover image, title, date, location, status badge, attendee count

Filter by status. "Nuevo Evento" CTA.




### /admin/eventos/nuevo and /admin/eventos/:id

Form fields:

- title, description (rich textarea), cover_image (upload)

- event_date (date + time picker), end_date

- location_name, location_address, location_city

- is_virtual toggle (shows virtual_url if true)

- max_empresas, max_sponsors

- status selector (draft/published)

- Tags multi-input




Agenda section (below main form):

- Table of agenda items with: time_start-time_end | title | type badge | room | speaker | actions

- "Añadir actividad" opens inline form: time_start, time_end, title, description, agenda_type (select with icons), room, speaker_name, speaker_role, order_index

- Drag to reorder agenda items

- Agenda types icons: 🎤 charla, 🤝 networking, ☕ coffee_break, 🍽️ comida, 📅 reuniones_1to1, 🏆 cierre, 👋 bienvenida




### /admin/matches

Table: Empresa (logo + name) | Sponsor (logo + name) | Evento | Fecha match | Estado

Filters: by event, by date range

Stats: total matches, matches this week, matches this month




### /admin/reuniones

Table of all 1to1 meetings: Empresa | Sponsor | Evento | Horario | Sala | Estado

"Asignar Reunión" button: select match → assign time + room

Bulk assignment feature: generate meeting schedule for all matches in an event




---




## EMPRESA DASHBOARD — DETAILED SPECS




### Layout

- Left sidebar (160px wide, dark #0D0D0D):

  - Top: Company logo (square, 60px) + company name (bold uppercase) + "EMPRESA" badge (yellow pill)

  - Nav items (uppercase, icon + label): DASHBOARD, MI FICHA, VER SPONSORS, VER EMPRESAS, MIS MATCHES, REUNIONES 1TO1, MENSAJES (with unread count badge), TABLÓN, AGENDA

  - Bottom: "CERRAR SESIÓN" button

- Main content area: dark background, generous padding




### /empresa/dashboard

Header: "BIENVENIDO, [COMPANY NAME]" (large, uppercase)

Subtitle: "EVENTO ACTUAL: [active event name]"




3 Stats cards (horizontal row):

1. [bookmark icon, yellow bg] "X / 20 máx." → "SPONSORS SELECCIONADOS" + "El límite es tu cuota de selecciones"

2. [heart icon, yellow bg] "X" → "MATCHES MUTUOS"  

3. [calendar icon, yellow bg] "X" → "1TO1 AGENDADAS"




CTA button: "🔍 EXPLORAR SPONSORS" (large, centered)




Agenda section below (same as full agenda page but compact):

- "📅 AGENDA DEL EVENTO" title

- Date header bar (e.g. "THURSDAY, 14 DE MAY")

- Table: HORARIO | ACTIVIDAD (with type badge) | SALA | PONENTE

- Each row: time range | activity title + type badge (CHARLA, NETWORKING, BIENVENIDA, etc.) | room name with colored dot | speaker name

- Activity type badges: small colored pills




### /empresa/mi-ficha

Title: "MI FICHA" with edit icon

Form sections with dark cards:




Section "INFORMACIÓN GENERAL":

- company_name (read-only, shown as header)

- tagline (text input)

- description (large textarea, "Descripción completa (2-3 párrafos)")

- sector (select)

- company_size (select)

- website (url input)

- logo upload (drag & drop area)




Section "REDES SOCIALES":

- LinkedIn URL input with LinkedIn icon

- Twitter/X URL input with X icon

- Instagram URL input




Section "CATEGORÍAS / ETIQUETAS":

- "Selecciona las categorías que mejor describen tu empresa"

- Search input + chips/tags selector




Section "INFORMACIÓN ADICIONAL":

- looking_for (textarea: what do you seek from sponsors?)

- location_city




Profile completion progress bar at top (0-100%)

"Guardar cambios" button (golden yellow)

Note: "Los cambios requieren aprobación del equipo antes de aplicarse"




### /empresa/ver-sponsors

Title: "SPONSORS DISPONIBLES"

Top right: "X / 20 SELECCIONADOS" counter badge




Grid 4 columns (responsive: 2 on tablet, 1 on mobile):

Each sponsor card:

- Logo image (white background square, centered)

- Company name (uppercase bold)

- Sponsorship level badge (PLATINUM/GOLD/SILVER/BRONZE — colored)

- Description truncated (2-3 lines with "...")

- 3 action buttons: [👁 VER] [📧 MSG] [💛 MATCH] 

  - MATCH button: golden yellow, heart icon, clicking adds a like

  - If already liked: button shows active state (filled heart, different style)

  - MSG: opens message modal/page to send direct message




### /empresa/ver-empresas  

Title: "EMPRESAS PARTICIPANTES"

Top right: "[N] EMPRESAS" count badge




Grid 4 columns:

Each company card:

- Logo image

- Company name (uppercase)

- Sector badge

- Employee count (icon + "X-Y empleados")

- Description truncated

- 1 action button: [👁 VER]

- Clicking VER opens company profile modal/page




### /empresa/mis-matches

Title: "💛 TUS MATCHES"

Subtitle: event name




Section "INTERESADOS EN TI (N)":

Info banner: "Estos sponsors te han dado like. Si tú también les das like, se creará un match y podréis programar una reunión."




List (not grid) of sponsors who liked empresa:

Each row: Logo | Company name + category + level badge + "TE DIO LIKE: DD/MM/YYYY" | [⭐ LIKE] [👁 VER] [💛 LIKE] buttons

- First button "LIKE": shows if empresa already liked back (star icon)

- Last button "LIKE": action button to like back (creates mutual match)




Empty state: broken heart icon + "AUN NO TIENES MATCHES" + explanation + "EXPLORAR SPONSORS" CTA




### /empresa/reuniones-1to1

Title: "📅 REUNIONES 1TO1"

Subtitle: event name




If no meetings assigned:

Empty state with calendar-x icon: "NO TIENES REUNIONES ASIGNADAS" + "Cuando el organizador asigne reuniones para este evento, aparecerán aquí."




If meetings exist: table with time, sponsor name+logo, room, status badge




### /empresa/mensajes

Title: "📧 MENSAJES"

List of conversation threads:

Each thread: sender logo | sender name (bold) | message preview (truncated) | timestamp right | "1 NUEVO" badge if unread (golden yellow)

Clicking opens conversation view with chat-style messages




### /empresa/tablon

Title: "TABLÓN"

Bulletin posts from super admin:

Each post: platform logo/avatar | "THE LAST OF SAAS" (or platform name) | date + time | message content

Clean list, no reply functionality




### /empresa/agenda

Title: "📅 AGENDA"

Full agenda table (same format as dashboard but full page):

Date header bar, then table: HORARIO | ACTIVIDAD + type badge | SALA (with colored dot) | PONENTE

Type badges with emoji prefix: 👋 BIENVENIDA, 🎤 CHARLA, 🤝 NETWORKING, ☕ COFFEE BREAK, 🍽️ COMIDA, 📅 REUNIONES_1TO1, 🏆 CIERRE




---




## SPONSOR DASHBOARD — DETAILED SPECS




### Layout

Same as Empresa but:

- Badge shows "SPONSOR" instead of "EMPRESA"

- Different nav items: DASHBOARD, MI FICHA, VER EMPRESAS, MIS MATCHES, REUNIONES 1TO1, MIS CÓDIGOS, MIS INVITADOS, MENSAJES, TABLÓN, AGENDA




### /sponsor/dashboard

Header: "BIENVENIDO, [SPONSOR NAME]"

Subtitle: event name




3 Stats cards:

1. [building icon] "X / 20 máx." → "EMPRESAS SELECCIONADAS" + "El límite es tu cuota de selecciones"

2. [heart icon] "X" → "MATCHES MUTUOS"

3. [calendar icon] "X" → "1TO1 AGENDADAS"




CTA: "🔍 EXPLORAR EMPRESAS"

Agenda section (same format)




### /sponsor/mi-ficha

Title: "MI FICHA"

Note: "Actualiza la información de tu SaaS. Los cambios requieren aprobación del equipo antes de aplicarse."




Form sections:




Section "INFORMACIÓN GENERAL":

- tagline (input: "Frase corta que describe tu SaaS")

- description (textarea: "Descripción completa (2-3 párrafos)")




Section "REDES SOCIALES":

- LinkedIn URL (with icon)

- Twitter/X URL (with icon)




Section "CATEGORÍAS":

- "Selecciona las categorías que mejor describen tu SaaS"

- Search + chips selector




Section "INTEGRACIONES NATIVAS":

- "SaaS con los que tienes integración nativa. Son bidireccionales: también aparecerán en la ficha del otro."

- "Sin integraciones añadidas" placeholder

- Search input: "Buscar SaaS para añadir integración..."

- Selected integrations shown as removable chips with logos




"Guardar cambios" button




### /sponsor/ver-empresas

Title: "EMPRESAS"

Top right: lock icon button "SIN REUNIONES 1TO1" if sponsor level doesn't include meetings




If BRONZE level (no meetings): amber warning banner:

"🔒 Las reuniones 1TO1 no están incluidas en tu nivel de patrocinio. Tu nivel: BRONZE. No contempla reuniones 1to1, por lo que la selección de empresas está desactivada. Puedes consultar los perfiles, enviar mensajes directos y ver las empresas que te han enviado un like."




Search bar + sector filter dropdown + "TODAS" filter dropdown




Grid 3 columns (wider cards than sponsor grid):

Each company card:

- Logo image (larger format)

- Company name (uppercase bold)

- Sector badge

- Description truncated (3 lines)

- Action buttons: [👁 VER] [📧 MSG] (MATCH button hidden/disabled for BRONZE)

- For GOLD+ levels: [👁 VER] [📧 MSG] [💛 MATCH]




### /sponsor/mis-matches

Same as empresa matches but showing companies who liked the sponsor back

Empty state: broken heart + "AUN NO TIENES MATCHES" + "Cuando una empresa que has seleccionado también te seleccione, aparecerá aquí como match mutuo." + "EXPLORAR EMPRESAS" CTA button (outlined white)




### /sponsor/mis-codigos

Title: "MIS CODIGOS"

Subtitle: "EVENTO: [event name]"




3 Stats cards:

1. [ticket icon] "1" → "CÓDIGOS DISPONIBLES"

2. [person+ icon, yellow] "8" → "VECES USADO"

3. [checkmark icon, yellow] "8" → "INVITADOS CONFIRMADOS"




Codes table: CÓDIGO | DESCRIPCIÓN | USO (X / ILIMITADO badge) | DESCUENTO | ESTADO (ACTIVO badge)

Each code shows:

- Code string in monospace badge style (e.g. "SPONSOR-MADRID-26")

- Shareable URL below (copy on click): https://[platform]/eventos/[slug]/registro?code=[CODE]




"VER MIS INVITADOS" button (outlined)




### /sponsor/mis-invitados

Title: "MIS INVITADOS"

Subtitle: "EVENTO: [event name]"




Stats row: [👥 X TOTAL] [✅ X CONFIRMADOS] [⏳ X PENDIENTES] [📲 X CHECK-IN]




Invitados table:

Columns: ASISTENTE (name + email) | EMPRESA (company + role title) | CÓDIGO USADO (badge) | ESTADO (CONFIRMADO badge green) | FECHA REGISTRO

Rows sortable by date, filterable by status




---




## ADDITIONAL UI COMPONENTS




### Profile/Company Modal (when clicking VER)

Full-screen modal or slide-over panel:

- Cover image banner at top

- Logo overlapping cover (absolute positioned)

- Company name (large, uppercase) + level badge

- Website link + social links row

- Description full text

- Tags/categories chips

- Stats: sector, size, location

- For sponsor profiles: native integrations section

- Action buttons: LIKE / MSG / Close




### Notification Bell

Top right in all dashboards

Dropdown showing last 5 notifications

Each: icon (based on type) | text | timestamp

"Ver todas" link at bottom

Unread count badge on bell icon




### Messages / Chat

Left panel: conversation list (sender avatar, name, preview, time, unread badge)

Right panel: chat view

Messages bubble style: sender right (yellow), receiver left (dark gray)

Input box at bottom with send button




### Like Button Animation

When clicking MATCH/LIKE button:

- Heart icon animates (scale up + bounce)

- Button changes to active state

- Toast notification: "💛 Le has dado like a [Company Name]"

- If this creates a match: toast "🎉 ¡Match! Ambos os habéis dado like. Ya podéis programar una reunión."




### Sponsorship Level Badges

- PLATINUM: gradient gold/silver border, bold text

- GOLD: #F5C842 background, black text

- SILVER: #9CA3AF background, white text  

- BRONZE: #CD7F32 background, white text




---




## PUBLIC LANDING PAGE (/)




Dark themed, full-screen hero:

- Navigation: logo left, "Iniciar sesión" + "Registrarse" buttons right

- Hero: "CONECTAMOS MATCH" large title, tagline "Conectamos el talento con la oportunidad", two CTA buttons: "Soy Empresa" / "Soy Sponsor"

- How it works section: 3 steps with icons

- Features section: matchmaking, events, 1to1 meetings

- Footer: dark, links, copyright




---




## EDGE CASES & IMPORTANT BEHAVIORS




1. Empresa can only see MATCH button when browsing sponsors (not other companies)

2. Sponsor BRONZE: selection disabled, no MATCH button in ver-empresas, warning banner shown

3. Match counter on dashboard only counts MUTUAL matches (both sides liked)

4. Invitation code URL is auto-generated as: /eventos/[event-slug]/registro?code=[CODE]

5. Message can be sent even without a match (direct message from profile)

6. Agenda shows current/active event by default (the published event with nearest date)

7. Super admin can see ALL matches across ALL events, filterable

8. Meeting assignment by super admin only (users cannot self-schedule)

9. Profile completion score calculated automatically based on filled fields

10. Native integrations are bidirectional: if SponsorA adds SponsorB as integration, SponsorB also shows SponsorA in their integrations




---




## RESPONSIVE DESIGN




- Mobile: sidebar collapses to bottom tab bar (5 main items)

- Tablet: sidebar visible but icon-only (collapsed labels)  

- Desktop: full sidebar with icons + labels

- All grids: 4col → 2col → 1col responsive

- Cards: maintain minimum 280px width


Start by creating the Supabase schema, then the authentication flow, then the Super Admin panel, then the Empresa dashboard, then the Sponsor dashboard. Use realistic placeholder data to populate the UI so it looks production-ready from the first render.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://conectamosmatch.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c2f6cc1c-ad12-439e-81d4-db78bd9918d6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
