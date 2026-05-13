
# CONECTAMOS MATCH — Build Plan

A B2B matchmaking SaaS with three role-based dashboards (Super Admin, Empresa, Sponsor), curated events, mutual-like matching, 1to1 meeting assignment, invitation codes, messaging, and a bulletin board.

This is a very large scope (3 dashboards, ~25 routes, 13 tables, RLS, realtime messaging). I'll deliver it in phases so you can review each layer before the next, instead of a single multi-hour generation that's hard to QA.

## Phase 0 — Foundation (this turn after approval)
- Enable Lovable Cloud (Supabase) for auth, DB, storage, realtime.
- Apply design system to `src/styles.css`: dark `#0A0A0A` bg, card `#111`, border `#1E1E1E`, accent `#F5C842`, success `#4ADE80`, danger `#EF4444`, Space Grotesk + Inter via Google Fonts, uppercase tracking utility, badge variants (PLATINUM/GOLD/SILVER/BRONZE).
- Public landing page `/` (dark hero, "Soy Empresa" / "Soy Sponsor" CTAs, how-it-works, features, footer).
- Auth: `/login`, `/registro` (role select → enriched form per role), email/password + Google. Session listener, role-based redirect to `/admin`, `/empresa/dashboard`, or `/sponsor/dashboard`.

## Phase 1 — Database schema + RLS + match trigger
All 13 tables exactly as specified (`profiles`, `empresa_profiles`, `sponsor_profiles`, `events`, `event_agenda`, `likes`, `matches`, `meetings_1to1`, `messages`, `bulletin_posts`, `invitation_codes`, `event_registrations`, `notifications`).
- Role enum + `user_roles` pattern via `profiles.role` checked through a `SECURITY DEFINER` `has_role()` helper to avoid recursive RLS.
- RLS policies per role exactly as you described (super_admin full, empresa/sponsor scoped reads, owner-only writes, matches/messages limited to participants).
- `check_and_create_match()` trigger on `likes` insert: if reverse like exists across empresa↔sponsor in same event, insert mutual match + notifications for both.
- Storage buckets: `logos`, `covers` (public read, owner write).
- Seed realistic placeholder data (8 empresas, 12 sponsors across PLATINUM/GOLD/SILVER/BRONZE, 2 events, agenda items, sample likes/matches, bulletin posts, codes, invitados) so every screen renders production-looking content from first paint.

## Phase 2 — Shared dashboard shell
- `_authenticated` layout route with role guard.
- Sidebar (160px, `#0D0D0D`, uppercase nav, golden left-border on active item, collapses to icon strip on tablet, bottom tab bar on mobile).
- Topbar: notifications bell w/ dropdown, avatar menu, logout.
- Reusable components: `SponsorCard`, `EmpresaCard`, `LevelBadge`, `AgendaTable`, `StatCard`, `ProfileModal` (slide-over with cover/logo/desc/integrations/actions), `LikeButton` (animated heart + toast + match toast), chat bubbles, `BulletinList`.

## Phase 3 — Super Admin (`/admin/*`)
Dashboard, usuarios (table + filters + multi-step create form with role-conditional step 2), eventos (cards + create/edit + agenda manager with drag-reorder + type icons), matches (table + filters + stats), reuniones (assign + bulk-generate), códigos, tablón.

## Phase 4 — Empresa (`/empresa/*`)
Dashboard with 3 stat cards + EXPLORAR SPONSORS CTA + compact agenda; mi-ficha (sectioned form, completion bar); ver-sponsors (4-col grid, VER/MSG/MATCH); ver-empresas (VER only); mis-matches (interesados list with like-back); reuniones-1to1; mensajes (thread list + chat); tablón; agenda.

## Phase 5 — Sponsor (`/sponsor/*`)
Dashboard; mi-ficha (with bidirectional native integrations search); ver-empresas (3-col, BRONZE shows amber lock banner + MATCH disabled); mis-matches; reuniones-1to1; mis-codigos (stats + table + copy shareable URL); mis-invitados (stats + filterable table); mensajes; tablón; agenda.

## Phase 6 — Realtime + polish
- Supabase realtime on `messages`, `matches`, `notifications` (live unread badges, match toasts).
- Public registration via invitation code: `/eventos/:slug/registro?code=...`.
- Profile completion auto-calc trigger.
- Responsive sweeps (mobile bottom tabs, tablet icon sidebar).
- Final QA pass on every route.

## Technical notes
- TanStack Start file-based routes, TanStack Query for data, server functions with `requireSupabaseAuth` for any sensitive reads, browser client for realtime + auth UI.
- All colors via semantic tokens in `styles.css` — no hardcoded hex in components.
- Match logic in DB trigger (not client) for integrity.
- Invitation code public registration uses a `/api/public/*` server route + admin client to insert profile and registration after verifying the code.

## One thing to confirm before I start
Scope is enormous. My recommendation: I execute Phase 0 + Phase 1 + Phase 2 in the first build pass (foundation + DB + shell + landing + auth), then deliver Phases 3–6 in follow-up turns. That keeps each pass reviewable. If you'd rather I attempt everything in one mega-pass, say so and I'll go wide — but expect rougher edges that we'll iterate on.

Approve to proceed with Phase 0–2 first.
