# Plan: Matches, chat y notificaciones

## Objetivo

Tras un like mutuo, empresa y sponsor quedan emparejados automáticamente, el chat queda desbloqueado y ambos reciben aviso en la campana de la topbar. El admin sigue gestionando la asignación de las reuniones 1to1, pero ahora cualquier cambio también notifica. Añadimos aviso anónimo de "te han dado like", de mensajes nuevos y de anuncios del tablón. Se aplica un tope de 20 likes por usuario/evento, configurable por el admin a nivel de evento.

## Cambios en base de datos

1. **`events.max_likes_per_user`** (int, default `20`) — el admin puede subir/bajar el tope desde el modal de evento.
2. **Triggers nuevos en `notifications`**:
   - `on_like_insert` → notifica al receptor con tipo `like_received`, sin revelar autor (`"Alguien se ha interesado por tu perfil"`).
   - `on_message_insert` → notifica al destinatario con tipo `new_message` (link a `/{role}/mensajes`).
   - `on_meeting_change` (insert + update de `scheduled_time`/`room`/`status`) → notifica a empresa y sponsor con tipo `meeting_assigned` o `meeting_updated`.
   - `on_bulletin_insert` → notifica a todos los usuarios autenticados (filtrando por scope/event_id).
3. **Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;` y `messages` (para que el chat también sea live).
4. **Tope de likes**: el trigger existente `check_and_create_match` no valida cantidad; añadimos validación en `before insert on likes` que cuente likes del `from_user_id` para ese `event_id` y rechace si supera `events.max_likes_per_user`.

## Server functions

- `src/lib/notifications.functions.ts`
  - `listNotifications({ unreadOnly })` — devuelve las del usuario con un join ligero.
  - `markNotificationRead({ id })` y `markAllRead()`.
  - `getUnreadCount()` para el badge inicial (luego se actualiza por realtime).
- `src/lib/admin-events.functions.ts` — añadir `max_likes_per_user` a la validación Zod y al payload del modal.

## UI

### Campana de notificaciones
Reemplazar el `<button>` estático del `Topbar` por un `NotificationsBell`:
- Badge con contador (rojo, esquina sup-der) que se actualiza vía suscripción realtime a `notifications` filtrada por `user_id`.
- Click abre un `<Popover>` con las últimas 10 notificaciones (icono según tipo, título, tiempo relativo, indicador "no leído").
- Click en una notificación → navega a `link` y marca como leída.
- Botón "Marcar todas como leídas" + link "Ver todas" (futuro, fuera de scope).

### Match → chat
- En `MensajesPanel`, las conversaciones se construyen a partir de `matches` mutuos (no solo de mensajes existentes), de modo que un match nuevo aparece inmediatamente como hilo vacío listo para escribir.
- Al recibir notificación de `new_match`, el link lleva directo a `/{role}/mensajes` con el partner preseleccionado (vía query param `?with=<user_id>`).

### Tope de likes
- En `ver-sponsors.tsx` y `ver-empresas.tsx` (vista sponsor): leer `events.max_likes_per_user` del evento activo, mostrar `{usados}/{tope} seleccionados` real, deshabilitar el `LikeButton` cuando `usados >= tope` con tooltip "Has alcanzado el límite del evento".
- En el modal de evento del admin (`EventModal`): añadir input numérico "Likes máximos por participante".

### Toast en match
Cuando llega notificación realtime de tipo `new_match`, además del badge, lanzar un `toast.success("¡Nuevo match con X! Ya puedes escribirle")` con acción "Abrir chat".

## Tipos de notificación y links

| type              | título                              | link destino                          |
|-------------------|-------------------------------------|---------------------------------------|
| `new_match`       | ¡Nuevo match con {nombre}!         | `/{role}/mensajes?with={user_id}`     |
| `like_received`   | Alguien se ha interesado por ti     | `/{role}/ver-{contraparte}`           |
| `new_message`     | Nuevo mensaje de {nombre}           | `/{role}/mensajes?with={user_id}`     |
| `meeting_assigned`| Reunión 1to1 programada             | `/{role}/reuniones-1to1`              |
| `meeting_updated` | Tu reunión 1to1 ha cambiado         | `/{role}/reuniones-1to1`              |
| `bulletin_new`    | Nuevo anuncio: {título}             | `/{role}/tablon`                      |

## Orden de implementación

1. Migración SQL (columna `max_likes_per_user`, triggers de notificación, validación de tope, realtime publication).
2. Server functions de notificaciones.
3. Componente `NotificationsBell` + integración en `Topbar` + suscripción realtime.
4. `MensajesPanel`: hilos derivados de matches + soporte `?with=`.
5. Vistas de directorio: contador real + bloqueo a partir del tope.
6. `EventModal` admin: campo `max_likes_per_user`.
7. QA manual: like mutuo entre dos cuentas → notificación instantánea + chat funcional + reunión pendiente visible.

## Fuera de scope (para más adelante)

- Página `/notificaciones` con histórico y filtros.
- Notificaciones por email.
- Confirmación bilateral de reuniones.
