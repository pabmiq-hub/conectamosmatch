## Diagnóstico

El fallo no está en la fecha de la agenda: `Día 1` sí se está asociando al `11/06/2026`, que coincide con la agenda del evento.

El problema principal está en la conversión horaria y en cómo se pinta el campo `datetime-local`:

- El Excel dice `Día 1`, `Hora 17:30 - 17:45`.
- En base de datos se guarda como `2026-06-11 15:30:00+00`, que es correcto si se interpreta como `17:30` en Madrid.
- Pero la pantalla usa `new Date(...).toISOString().slice(0,16)` para rellenar el input, y eso fuerza UTC, por eso aparece `15:30` en vez de `17:30`.
- Además, el importador depende de parsing parcial de la columna `Hora`; conviene hacerlo explícito y consistente para rangos como `17:30 - 17:45`.

## Plan de solución

1. **Crear helpers de fecha/hora Madrid**
   - Añadir funciones reutilizables para:
     - Convertir `YYYY-MM-DD + HH:mm` de Madrid a ISO UTC para guardar.
     - Convertir ISO guardado a valor `datetime-local` en hora Madrid.
     - Convertir valor editado desde `datetime-local` como hora Madrid a ISO UTC.
     - Formatear fecha y hora de exportación siempre en zona `Europe/Madrid`.

2. **Corregir el importador servidor**
   - Sustituir la función actual `madridIso`, que aún puede calcular mal el offset porque usa una fecha “probe” UTC que no representa realmente la hora local deseada.
   - Parsear la columna `Hora` tomando siempre la hora de inicio del rango (`17:30 - 17:45` → `17:30`).
   - Guardar `scheduled_time` como UTC correcto para la hora local Madrid.

3. **Corregir la tabla de administración**
   - Cambiar el valor del input `datetime-local` para que muestre la hora Madrid, no UTC.
   - Al editar manualmente una hora, convertirla desde hora Madrid a UTC antes de guardar.

4. **Corregir exportación Excel/PDF**
   - Cambiar `toLocaleDateString` y `toLocaleTimeString` para usar explícitamente `Europe/Madrid`.
   - Así la exportación mostrará `11/06/2026` y `17:30`, no el valor UTC.

5. **Validación posterior**
   - Verificar con el ejemplo `3INA × Vidext` que:
     - Excel: `Día 1`, `17:30 - 17:45`.
     - Plataforma: `11/06/2026 17:30`.
     - Exportación: `11/06/2026`, `17:30`.

## Archivos a tocar

- `src/lib/admin-meetings.functions.ts`
- `src/routes/_authenticated/admin/reuniones.tsx`

No haré cambios de diseño ni modificaré la lógica de matches; solo la conversión, visualización y exportación de fechas/horas.