# Reunión Cloud and Delivery–Adevinta y guardado de slots
- [ ] Fijar una sola reunión el 27/11 a las 11:20 con Jim Ballesta y Begoña Dominguez, Mesa 23; eliminar la otra entrada pendiente.
- [x] Unificar ambos selectores de slot y rechazar el envío de slots pendientes de comprobar o no disponibles.
- [ ] Validar pruebas y comprobar guardado; panel real requiere sesión de administrador no disponible en este Supabase externo.

# Quitar personas de Talks
- [x] Añadir retirada por persona y Talk con confirmación y guardado por evento.
- [x] Compartir la asistencia efectiva con disponibilidad y creación de reuniones.
- [x] Validar 15 pruebas de reglas, retirada/lectura, permisos y regresión; aplicación sin errores y acceso protegido.
- [ ] Verificar retirada y creación reales desde el panel: Supabase externo sin sesión de administrador disponible.

# Filtros de reuniones por cuenta
- [x] Incluir todas las cuentas del evento y resolver sus responsables para filtros, creación y disponibilidad.
- [x] Validar 23 pruebas de regresión; aplicación sin errores y acceso protegido comprobado.
- [ ] Verificar las tres vistas con sesión real de superadministrador: Supabase externo sin sesión disponible.
- Regla revisada: todas las cuentas inscritas deben aparecer, aunque tengan varios responsables o el vínculo antiguo vacío.
- Código revisado: filtros Empresa/Solución y selección combinada por cuenta; Crear reunión y responsables; Ver disponibilidad y su Excel comparten la lista corregida. Importación y generador ya filtran por cuentas del evento, no por el vínculo antiguo. Lectura de reuniones no excluye cuentas; Matches incluye cuentas sin actividad. No hay tareas automáticas ni funciones de base de datos que alimenten estos selectores; no se modifican registros, permisos ni ajustes.

# Excel de credenciales individuales
- [x] Descargar una sola fila con las mismas claves al enviar a un participante, también desde editar contraseña.
- [x] Validar 4 pruebas de credenciales y descarga aislada de Excel con una fila y contraseña exacta; aplicación sin errores.
- [ ] Verificar envío individual real: requiere sesión de administrador del Supabase externo, no disponible aquí.

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