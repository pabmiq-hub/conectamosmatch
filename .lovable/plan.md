# Reto 2.700 — Auditoría (Prompt 1) y propuesta de arquitectura

No se cambia nada en este paso. Esto es el informe para aprobar antes del Prompt 2.

## 1. Lo que ya existe y se reutiliza

| Área | Estado actual | Uso en el Reto |
|---|---|---|
| Acceso | Email + contraseña; tres roles: super admin, empresa (DRH) y solución (sponsor) | Igual, sin cambios |
| Personas | Cada asistente es una persona con su ficha (nombre, email, cargo, foto) vinculada a una cuenta de empresa o solución (con nombre y logo) | Fichas del álbum: nombre, empresa, cargo, foto |
| Eventos | Tabla de eventos + inscripciones por evento + agenda por días | El Reto se cuelga de un evento concreto |
| Importación | Importador de usuarios en Excel en el panel admin | Se reutiliza para el listado definitivo |
| Buscador | Directorios «Ver soluciones / Ver empresas» con búsqueda y orden | Base para buscar en el álbum |
| Panel admin | Menú lateral con Usuarios, Eventos, Matches, Reuniones, Selecciones, Tablón | Nueva entrada «Reto 2.700» |
| Notificaciones | Campana interna | Opcional para pop-ups de misión (sin push ni email) |
| QR | No hay lector QR en el código actual | No se toca ni se crea |

No se modifican: likes, matches, reuniones 1to1, agenda, perfiles ni datos de junio.

## 2. Diseño de datos propuesto (todo nuevo, aislado por evento)

```text
reto_config        1 fila por evento: activo, objetivo (2700), hora de cierre, cerrado, emergencia
reto_participants  quién juega en ese evento (persona + tipo DRH/sponsor + empresa)
reto_marks         "he conectado con X": (evento, emisor, receptor) único, sin automarca
reto_missions      catálogo por evento: título, bonus, tipo, regla, horario, activa
reto_mission_awards  bonus concedidos (único por persona+misión; historial auditable)
reto_introductions «Te presento»: presentador, pareja, confirmaciones, estado
reto_mission_seen  pop-up visto por persona y misión
reto_icebreakers   las 27 preguntas editables
reto_snapshots     foto congelada de resultados al cerrar
```

Conexión válida = existen las dos marcas A→B y B→A. Se calcula en la base de datos (vistas/funciones), nunca en el navegador. Una pareja cuenta una sola vez.

## 3. Permisos

- Asistente: solo crea/borra sus propias marcas, dentro de su evento, hacia participantes de ese evento y si el juego está abierto.
- Asistente: lee fichas y rankings de su evento; no ve marcas ajenas en bruto.
- Puntos, misiones y cierre: solo los calcula la base de datos; nadie puede escribirlos a mano.
- Super admin: toda la configuración y exportaciones.
- Interruptor de emergencia: oculta el módulo sin afectar al resto.

## 4. Cambios mínimos en la app actual

- Una entrada nueva en el menú lateral (empresa, solución y admin), visible solo si el Reto está activo para su evento.
- Páginas nuevas: Mi álbum, Ranking, Misiones, Rompe el hielo y panel admin del Reto.
- Ningún cambio en las páginas existentes.

## 5. Estrategia de pruebas

- Un evento ficticio separado («TEST Reto 2.700») con 120 usuarios ficticios (p. ej. 80 DRH, 40 sponsors, 30 empresas) con emails `@test.conectamos.invalid`.
- Pruebas automáticas de reglas: reciprocidad, desmarcado, duplicados, empates, misiones, «Te presento» y cierre.
- Borrado total del evento de prueba al acabar.

## 6. Riesgos concretos

- No hay entorno de pruebas separado: la base de datos es la real. Se mitiga con el evento ficticio y el módulo apagado por defecto.
- Hoy los responsables comparten cuenta: hay que confirmar que el Reto cuenta por persona, no por empresa.
- «Empresa» para las misiones de empresas distintas: se usará la cuenta empresa/solución; quien no tenga cuenta no puntúa en esas misiones.
- El evento de noviembre aún no está creado en la base de datos (solo existe el de junio).
- Las fotos/logos no se migraron al nuevo almacenamiento: las fichas saldrán sin foto hasta que se resuban.

## 7. Preguntas para el equipo

1. ¿El Reto cuenta por persona (cada responsable juega individualmente)? Es lo que propone el documento.
2. ¿Pueden conectar DRH con DRH y sponsor con sponsor, o solo entre tipos opuestos?
3. ¿Creo ya el evento de noviembre o trabajo solo con el evento ficticio?

## Siguiente paso

Al aprobar, se ejecuta el Prompt 2 (álbum y conexión recíproca) sobre el evento ficticio.
