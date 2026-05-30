

## Modelo de cuenta "empresa"

Una **cuenta de empresa** = 1 fila en `empresa_profiles` con varios `profiles` enlazados por `account_id` (ya existe).

Roles dentro de la cuenta (`profiles.account_role`):
- `admin` — gestiona ficha, invita/expulsa responsables, ve actividad de todos. Es también responsable activo (puede dar likes).
- `responsable` — puede dar likes, ver sus matches/reuniones, editar su propio perfil personal.

Solo puede haber **1 admin por cuenta**. El super admin puede transferir el rol o mover responsables entre cuentas.

## Importación desde Excel (mejorada)

Paso 1 — **Análisis previo**: el modal lee el Excel y agrupa filas por:
- `company_name` normalizado (lower + trim + sin tildes)
- dominio del email
- y similitud > 0.85 (Levenshtein)

Paso 2 — **Confirmación de agrupaciones**: pantalla con cada grupo propuesto:
```
┌─ Acme S.L. (3 personas) ─────────────┐
│ ○ Ana López (ana@acme.com)  [Admin]  │
│ ○ Luis Pérez (luis@acme.com)         │
│ ○ Marta Ruiz (marta@acme.com)        │
│ [✂ Separar en cuentas distintas]     │
└──────────────────────────────────────┘
```
El super admin puede:
- Cambiar el admin (radio button)
- Separar una persona a su propia cuenta
- Mover una persona a otro grupo
- Si 1 sola persona: es admin automáticamente

Paso 3 — **Crear**: genera 1 `empresa_profiles` por grupo + N `profiles` con `account_id` apuntando a la empresa, marcando `account_role = 'admin'` al elegido.

## Gestión por el super admin

En `/admin/usuarios`, en la ficha de empresa:
- Lista de responsables con su rol
- Botón "Hacer admin" en cada responsable (transfiere el rol)
- Botón "Mover a otra cuenta" → modal con buscador de empresas destino
- Botón "Eliminar de la cuenta"
- Botón "Añadir responsable" (crea profile + envía credenciales)

## Permisos del admin de cuenta (empresa)

Nueva sección `/empresa/equipo` (solo visible para `account_role = 'admin'`):
- Ver responsables actuales
- Solicitar nuevo responsable (ya existe `responsable_requests`) — se mantiene flujo
- Quitar un responsable de la cuenta (super admin recibe notificación)
- Editar ficha de empresa (ya disponible)

Los responsables normales solo ven `/empresa/mi-ficha` para su perfil personal y pueden navegar el directorio + dar likes.

## Likes — modelo híbrido

### Empresa → Solución
- El `like` sigue siendo individual (cada responsable da el suyo).
- **Match y reunión 1to1 se consolidan a nivel cuenta**: basta con que **un responsable** de la empresa haya dado like + la solución haya correspondido.
- Cambio en `check_and_create_match` trigger: la verificación cruzada agrupa por `account_id` del lado empresa.
- Migración: añadir índice y modificar el match para guardar `empresa_account_id` además de `empresa_user_id` (quién dio el like original).

### Solución → Empresa
- Botón principal **"Me interesa esta empresa"** → crea likes hacia **todos los responsables** activos de la cuenta de una sola vez (transacción).
- Botón secundario **"Elegir responsables…"** → modal con checkboxes para seleccionar 1 o varios.
- En la ficha de empresa visible para la solución: lista de responsables con quién es admin.

### Visualización
- En `/empresa/mis-matches` y `/empresa/reuniones-1to1`: se muestran los matches/reuniones de **toda la cuenta**, etiquetando qué responsable dio el like original.
- En `/sponsor/mis-matches`: la solución ve la empresa (no responsables individuales), con detalle de qué responsables le han correspondido.

## Cambios técnicos

### Migración SQL
- `matches`: añadir `empresa_account_id uuid` (= `empresa_profiles.id`), backfill desde `profiles.account_id`, índice único `(empresa_account_id, sponsor_user_id, event_id)`.
- `meetings_1to1`: añadir `empresa_account_id` (consolidación a nivel cuenta).
- Función `check_and_create_match`: reescribir para detectar match cuando **cualquier** responsable de la cuenta empresa tiene like recíproco con la solución; crear 1 match/reunión por cuenta, no por responsable.
- Función `remove_match_on_unlike`: solo eliminar match si **ningún** responsable de la cuenta mantiene el like.
- Nueva función `bulk_like_empresa_account(sponsor_id, empresa_account_id, event_id)` para likes masivos.
- Política RLS en `meetings_1to1` y `matches`: ya cubre con `same_account()`, validar.

### Server functions (TanStack)
- `admin-import.functions.ts`: `analyzeExcelGroups()` — devuelve agrupaciones propuestas sin escribir.
- `admin-import.functions.ts`: `confirmImport(groups, adminAssignments)` — crea cuentas según confirmación.
- `admin-users.functions.ts`: `transferAccountAdmin`, `moveResponsableToAccount`, `addResponsableToAccount`.
- `empresa-team.functions.ts`: `listMyTeam`, `removeResponsable` (admin de cuenta).
- `sponsor-likes.functions.ts`: `likeEmpresaAccount(empresaAccountId, mode: "all"|"selected", responsableIds?)`.

### UI nueva/modificada
- `ImportUsersModal.tsx`: rediseño en 3 pasos (Upload → Group review → Confirm).
- `admin/usuarios.tsx`: acciones de gestión de responsables en `AccountHeader` / drawer.
- `empresa/equipo.tsx` (nuevo): gestión del equipo por el admin de cuenta.
- `sponsor/ver-empresas.tsx`: botón principal "Me interesa esta empresa" + secundario "Elegir responsables".
- `PartnerDetailModal.tsx` (versión empresa): mostrar lista de responsables con admin destacado.

## Entregables por fases

1. **Migración SQL** (matches/meetings consolidados + funciones).
2. **Server functions** de importación, gestión de responsables y likes masivos.
3. **Rediseño del modal de importación** (3 pasos con agrupación).
4. **Sección "Equipo" para admin de cuenta empresa**.
5. **Gestión de responsables desde super admin**.
6. **Botón "Me interesa esta empresa" + selección granular en soluciones**.

Cada fase se entrega y verifica antes de pasar a la siguiente.
