## Plan: Registro y gestión de usuarios

Basado en tus respuestas, configuro el sistema así:

### 1. Modelo de acceso
- **Sin auto-registro público.** El landing y `/registro` se reemplazan por una página informativa "Solicita acceso" (formulario de contacto) o se ocultan por completo. El acceso se realiza solo vía `/login`.
- Los usuarios entran únicamente cuando el super admin les da de alta con un email y contraseña inicial que tú envías por tu canal.
- Sponsors entran ya con su nivel asignado (PLATINUM/GOLD/SILVER/BRONZE) — alta inmediata, sin estado "pendiente".

### 2. Super admin inicial
- Crear cuenta con email `miquel@conectamos.club` y contraseña `Miquel123++`.
- Asignar `role = 'super_admin'` en `profiles`.
- Email auto-confirmado para que pueda entrar directo.

### 3. Pantalla "Nuevo usuario" (Super Admin → Usuarios)
Modal multi-step en `/admin/usuarios`:

**Paso 1 — Tipo de cuenta:** Empresa o Sponsor.

**Paso 2 — Datos de acceso:**
- Nombre completo, email, contraseña inicial, teléfono.

**Paso 3 — Datos de empresa/sponsor:**
- Empresa: nombre, sector, tamaño, web, ciudad, LinkedIn, tagline, descripción.
- Sponsor: nombre, sector, categoría de patrocinio, **nivel** (PLATINUM/GOLD/SILVER/BRONZE), web, LinkedIn, tagline, descripción.

**Paso 4 — Confirmación:** resumen + botón "Crear cuenta".

Al confirmar: server function (`createServerFn` con `supabaseAdmin`) que:
1. Crea el usuario en `auth.users` con `email_confirm: true` y la contraseña.
2. El trigger `handle_new_user` crea la fila en `profiles` con el rol pasado en `user_metadata`.
3. Inserta la fila en `empresa_profiles` o `sponsor_profiles` con todos los datos.
4. Devuelve éxito; el modal muestra las credenciales para que las copies y envíes manualmente.

### 4. Edición / Desactivación
- Botón "Editar" por fila → mismo formulario en modo edición (sin cambiar contraseña salvo "Resetear contraseña").
- Botón "Resetear contraseña" → genera nueva o pide una nueva, vía `supabaseAdmin.auth.admin.updateUserById`.
- Toggle activo/inactivo (`profiles.is_active`).
- Eliminar usuario (con confirmación) → `supabaseAdmin.auth.admin.deleteUser`.

### 5. Limpieza del registro público
- `/registro` queda como página privada/oculta o se elimina del menú público.
- En `/login` quito el enlace "¿No tienes cuenta? Regístrate" (lo sustituyo por "¿Necesitas acceso? Contáctanos").

### 6. Auth config
- `auto_confirm_email = true` (para que las altas creadas por el admin entren sin verificar email).
- `disable_signup = true` (impide que nadie cree cuenta vía API pública aunque conozca el endpoint).

---

### Archivos a crear/editar
- **Migración:** `auto_confirm_email` + `disable_signup` (vía `configure_auth`).
- **Seed SQL:** insertar super admin `miquel@conectamos.club`.
- **Nuevo:** `src/lib/admin-users.functions.ts` — `createUserAccount`, `updateUserAccount`, `deleteUserAccount`, `resetUserPassword`.
- **Nuevo:** `src/components/admin/NewUserModal.tsx` — wizard multi-step.
- **Editar:** `src/routes/_authenticated/admin/usuarios.tsx` — botón "Nuevo usuario" abre modal real, añadir editar/eliminar/reset.
- **Editar:** `src/routes/login.tsx` — quitar link a registro.
- **Eliminar o ocultar:** `src/routes/registro.tsx`.

### Notas técnicas
- Todas las operaciones admin usan `supabaseAdmin` dentro de `createServerFn` con middleware `requireSupabaseAuth` + check `has_role(userId, 'super_admin')` para que solo super admins puedan invocarlas.
- La contraseña inicial nunca se guarda ni se envía por email automático: se muestra en pantalla al super admin para que la transmita manualmente.

¿Procedo?