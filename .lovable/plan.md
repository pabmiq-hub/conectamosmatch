## Estado actual

**Hecho:** esquema BD (events con campos de reuniones, bulletin scope, función `assign_meeting_slots`, trigger `check_and_create_match` con auto-meeting, eliminación de `invitation_codes`), server functions de usuarios, modal de alta de usuarios, limpieza de rutas/sidebar de códigos.

**Pendiente:** todo lo siguiente.

## Pasos

### 1. Limpieza de datos demo
Migración SQL que borra todo excepto la cuenta `miquel@conectamos.club`:
- Borrar `bulletin_posts`, `notifications`, `messages`, `meetings_1to1`, `matches`, `likes`, `event_registrations`, `event_agenda`, `events`
- Borrar `empresa_profiles` y `sponsor_profiles` huérfanos (sin auth.users)
- Borrar `auth.users` distintos del super_admin (cascada limpia profiles)

### 2. Server functions nuevas en `src/lib/`
Todas con `requireSupabaseAuth` + helper `assertSuperAdmin`:
- `admin-events.functions.ts` — list/create/update/delete evento, gestionar `rooms[]`, ventana de reuniones, `meetings_per_user`, cambiar status (draft/published/ongoing/finished/cancelled)
- `admin-agenda.functions.ts` — CRUD de `event_agenda` (items con orden, ponentes, sala)
- `admin-matches.functions.ts` — listar con filtros, romper match
- `admin-meetings.functions.ts` — listar por evento, invocar RPC `assign_meeting_slots`, reasignar hora/sala, cambiar estado, borrar
- `admin-bulletin.functions.ts` — CRUD anuncios (scope global o por evento)
- `admin-registrations.functions.ts` — listar inscritos por evento, marcar check-in, cambiar status
- `admin-users.functions.ts` — añadir `bulkImportUsers` (recibe array parseado del XLSX y crea cuentas en bucle con resumen ok/errores)

### 3. Páginas admin
- `eventos.tsx` — modal CRUD completo: datos básicos, fechas, ubicación, salas (chips editables), `meetings_start_at/end_at`, `slot_duration_minutes`, `meetings_per_user`, status; acciones publicar/despublicar/cancelar/eliminar
- `eventos.$id.tsx` (nueva) — layout con tabs: General · Agenda · Inscritos · Reuniones · Anuncios
- `eventos.$id.agenda.tsx` (nueva) — CRUD items de agenda con orden drag-friendly
- `eventos.$id.registros.tsx` (nueva) — tabla de inscritos con check-in y export CSV
- `matches.tsx` — añadir filtro por evento/estado y acción "Romper match"
- `reuniones.tsx` — selector de evento, botón "Auto-asignar slots" (RPC), edición inline de hora/sala/estado, ajuste rápido de `meetings_per_user`
- `tablon.tsx` — selector scope (global/por evento) en el form, filtro en el listado, editar/borrar
- `usuarios.tsx` — botón "Importar Excel" (parsea con `xlsx` en cliente y llama a `bulkImportUsers`); plantilla descargable

### 4. Verificación end-to-end
Crear evento → publicar → likes mutuos → match + meeting `pending` automático → auto-asignar slots → reunión con hora/sala → publicar anuncio global y por evento → check-in en inscrito → import XLSX con 2 filas (1 empresa, 1 sponsor).

## Detalles técnicos

- Patrón de modales: clonar `NewUserModal.tsx` (shadcn `Dialog`)
- XLSX en cliente: `bun add xlsx`; columnas obligatorias: `email,password,role,full_name,company_name`; opcional: `sector,website,linkedin_url,sponsorship_level`
- Cleanup data: ejecutar como migración (DELETE no es schema pero la migración es la vía limpia para varias tablas)
- RPC: `await supabase.rpc("assign_meeting_slots", { p_event_id })` desde el server fn admin con `supabaseAdmin`
- Sidebar y dashboard admin: añadir links a las nuevas vistas hijas de evento
