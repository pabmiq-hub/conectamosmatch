# Gestión de responsables vinculados a cuentas

Hoy los responsables aparecen como cuentas independientes en el panel del super admin, lo que oculta que dependen de una empresa o sponsor. Además, solo el super admin puede crearlos. Vamos a cambiar dos cosas:

## 1. Visualización en `/admin/usuarios`

La lista pasa a agruparse por **cuenta** (empresa o sponsor). Cada fila principal es la cuenta (owner), y debajo, indentados, aparecen sus responsables (managers) con un indicador visual claro de dependencia (línea/sangría + chip "Responsable de {nombre cuenta}").

- Owner: fila normal con badge `OWNER` y el badge de empresa/sponsor.
- Manager: fila anidada visualmente bajo su owner, con badge `RESPONSABLE` y referencia explícita al nombre de la cuenta a la que pertenece.
- Super admin: aparte, sin agrupar.
- Los filtros "Empresas / Sponsors" siguen funcionando y agrupan por tipo de cuenta.

## 2. Flujo de solicitud por la propia empresa/sponsor

Las empresas y sponsors pueden **proponer** responsables desde su panel "Mi Equipo":

- Botón "Solicitar nuevo responsable" → modal con nombre completo, email y teléfono (sin contraseña).
- Crea una solicitud en estado `pending` asociada a su `account_id`.
- En la lista del equipo aparecen tanto los responsables activos como las solicitudes pendientes (con badge "Pendiente de aprobación").
- Pueden cancelar una solicitud pendiente.

El super admin gestiona las solicitudes en una nueva sección **"Solicitudes de responsable"** dentro de `/admin/usuarios`:

- Lista de solicitudes pendientes con cuenta, nombre y email.
- Al aprobar: el super admin asigna una contraseña (campo con botón "Generar"), se crea el usuario auth, se vincula como `manager` de la cuenta, y la solicitud pasa a `approved`.
- Al rechazar: la solicitud pasa a `rejected` con motivo opcional.
- Notificación al owner de la cuenta cuando se aprueba/rechaza.

El botón "Invitar responsable" del super admin se mantiene como atajo directo (sin pasar por solicitud), por si necesita crear uno manualmente.

## Detalles técnicos

**Migración SQL**:
- Nueva tabla `public.responsable_requests`:
  - `id uuid PK`, `account_id uuid`, `account_type ('empresa'|'sponsor')`, `requested_by uuid` (user del owner), `full_name`, `email`, `phone`, `status ('pending'|'approved'|'rejected')`, `rejection_reason text`, `reviewed_by uuid`, `reviewed_at`, `created_at`.
  - Índice por `account_id` y por `status`.
  - GRANTs a `authenticated` y `service_role`.
  - RLS:
    - SELECT: miembros de la cuenta (`same_account` con `requested_by`) o super_admin.
    - INSERT: owner de la cuenta (`account_role='owner'` y `account_id` coincide).
    - UPDATE/DELETE: solo super_admin (vía service role en server functions).

**Server functions nuevas** (`src/lib/responsable-requests.functions.ts`):
- `requestResponsable({ full_name, email, phone })` — owner crea solicitud para su cuenta.
- `listMyAccountRequests()` — lista solicitudes de la cuenta del usuario.
- `cancelMyRequest({ id })` — owner cancela una pendiente suya.
- `listAllRequests()` — super admin lista todas (con filtro de status).
- `approveRequest({ id, password })` — super admin crea el auth user + perfil manager + marca approved.
- `rejectRequest({ id, reason })` — super admin rechaza.

**UI**:
- `EquipoPanel.tsx`: añadir sección "Solicitudes pendientes" y botón "Solicitar responsable" (solo visible para owners).
- Nuevo `RequestResponsableModal.tsx` (lado empresa/sponsor).
- Nuevo `ApproveRequestModal.tsx` (lado super admin, con password + generar).
- `admin/usuarios.tsx`: reorganizar la tabla en grupos por cuenta + nueva pestaña/sección "Solicitudes (N)".

## Lo que NO cambia
- El modelo de cuentas multi-responsable (account_id / account_role) ya implementado.
- El super admin sigue pudiendo crear owners y responsables directamente.
- Los responsables existentes mantienen su estado.

¿Apruebas el plan?
