# Orden independiente de directorios
- [x] Añadir controles por evento en Participantes para empresas y soluciones.
- [x] Aplicar orden alfabético, interés único recibido o aleatorio, siempre con destacadas primero.
- [x] Validar 22 pruebas de orden y selecciones; migraciones aplicadas sin nuevos avisos de seguridad.
- [ ] Verificar cambios desde una sesión real de administrador y participantes: Supabase externo sin sesión disponible.

# Recordatorio de selecciones
- [x] Añadir comunicado editable con destinatarios, fecha y vista previa personalizada.
- [x] Implementar correos y avisos internos con resultados por destinatario y protección ante reintentos.
- [x] Validar 11 pruebas y vista previa/envío simulado en ordenador y móvil.
- [ ] Comprobar envío real: requiere sesión de administrador del Supabase externo, no disponible aquí.

# Selecciones en Participantes
- [x] Añadir recuentos por cuenta y detalle en dos columnas con nombres, logos, responsables y reciprocidad.
- [x] Validar 27 pruebas, vista aislada en ordenador y móvil y aplicación sin errores.
- [ ] Verificar datos reales desde Participantes: Supabase externo sin sesión de administrador disponible.

# Soluciones destacadas por evento
- [x] Guardar estrellas sólo para soluciones inscritas, con cambios exclusivos del superadministrador.
- [x] Añadir estrellas en Participantes y prioridad alfabética con marco amarillo sólo en Ver soluciones.
- [x] Validar 25 pruebas y aplicación sin errores; acceso protegido comprobado.
- [ ] Verificar la estrella con sesión de administrador y empresa: Supabase externo sin sesión disponible.

# Corrección de selecciones y matches (anteriores)
- [x] Corregir reciprocidad y avisos en Supabase; limpiar matches falsos conservando reuniones programadas.
- [x] Sincronizar contadores y nombres por cuenta en los dos dashboards.
- [x] Corregir responsables y acciones en selecciones y empresas que han seleccionado.
- [x] Verificar reglas con 16 pruebas y prueba transaccional de Supabase; pantalla de acceso sin errores.
- [ ] Verificar el flujo desde el usuario de Leeters: no hay sesión disponible en este Supabase externo.

# Cambio de administrador desde la corona
- [x] Añadir coronas y confirmación en los desplegables de Usuarios y Participantes.
- [x] Transferir la administración de forma indivisible y comprobar que queda un solo administrador por cuenta.
- [x] Validar 22 pruebas y transferencia reversible en Supabase; sin errores de compilación.
- [ ] Comprobar las coronas con sesión de superadministrador: no hay sesión disponible en este Supabase externo.