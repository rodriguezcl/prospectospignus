# Demostración de septiembre de 2026

Carga opcional solicitada por el usuario en la base compartida que se usará más adelante en producción. No se ejecuta al iniciar la aplicación ni al aplicar migraciones ordinarias. Ningún dato ficticio vive en el frontend: el tablero consulta Supabase bajo RLS.

## Alcance

- Lote `pignus-demo-septiembre-2026-v1`: 90 contactos, 3 por día del 1 al 30 de septiembre de 2026. Escenario sintético del mes completo, incluidos días futuros al momento de cargarlo.
- Matías Gómez · DEMO y Florencia Pérez · DEMO: vendedores inactivos, cuentas Auth bloqueadas hasta fin de 2099, sin contraseña ni identidades de login. Correos `example.invalid`; no se envían mensajes ni invitaciones. No se cambian cuentas existentes.
- 45 cargas atribuidas a cada creador ficticio; 9 registros sin asignar. Las restantes fichas pertenecen exclusivamente a los vendedores DEMO. Los vendedores reales no ven esas carteras.
- Nombres combinados ficticios. Teléfonos `351-000-NNNN (DEMO)`: datos de prueba; no se afirma que sean un rango oficialmente reservado. No llamar ni enviar WhatsApp.
- Direcciones de lugares públicos, no viviendas ni domicilios personales. Consultadas en [Google Maps](https://www.google.com/maps/search/museos+C%C3%B3rdoba+Capital+Argentina): Museo Emilio Caraffa, Av. Poeta Leopoldo Lugones 411; Museo Evita, Av. Hipólito Yrigoyen 511; Palacio Dionisi, Av. Hipólito Yrigoyen 622; Museo de las Mujeres, Rivera Indarte 55; Museo Juan de Tejeda, Independencia 122. Distribución reproducible; no implican relación comercial con esos lugares.
- La fecha comercial es simulada. El evento conserva la fecha real de carga y su motivo explícito. No se inventan gestiones ni ventas.

## Activación y limpieza

1. Aplicar una sola vez `supabase/migrations/202609300004_demostracion_y_resumen.sql`.
2. Ejecutar explícitamente `supabase/demostracion/cargar_septiembre_2026.sql` como operador PostgreSQL. Atómica e idempotente con manifiesto presente. No desactiva triggers ni RLS. Inserción directa en Auth exclusiva de identidades inhabilitadas; no es el mecanismo para cuentas reales.
3. Publicar el frontend para mostrar Inicio y las etiquetas DEMO.
4. Solo cuando el usuario solicite borrar, revisar y respaldar el lote si se desea conservarlo. Ejecutar `SET pignus.confirmar_limpieza = 'pignus-demo-septiembre-2026-v1';` y `supabase/demostracion/eliminar_septiembre_2026.sql` en la misma sesión. Es definitivo y requiere confirmación en ese momento. No ejecutar ahora.

La limpieza compara las fichas con el manifiesto original, verifica cuentas inactivas/bloqueadas y aborta si hay ediciones, auditoría adicional o vínculos ajenos. Solo borra los 90 registros, sus eventos y las dos cuentas/perfiles del lote. Una ficha reasignada o editada exige revisión manual. No hay botón de borrado indiscriminado en la app.

La migración 202609300004 y el lote se aplicaron en `sjoounysrvxreazgbjkv` el 29/09/2026 (hora Argentina). No repetir la migración. Las fichas DEMO se presentan como solo lectura para conservar el manifiesto; el servidor sigue exigiendo los permisos normales y la limpieza detecta cambios por otras vías. La limpieza no se ha ejecutado en ese proyecto.

## Estadísticas

Inicio selecciona septiembre de 2026 por defecto y permite elegir otro mes. Cuenta registros brutos visibles bajo RLS, separando DEMO/no demostración y sin asignar. Agrupa por día local, origen y creador original, no responsable actual. Cada cifra permite inspeccionar las filas y abrir su ficha. No calcula ventas, contactos efectivos ni captación válida.

RPC SECURITY INVOKER con límites del mes en PostgreSQL en `America/Argentina/Cordoba`. El vendedor solo ve su cartera actual; una reasignación cambia el alcance, no el creador histórico. Lectura paginada de 500 en 500, límite de seguridad de 10.000 que muestra un error y nunca totales parciales. Para grandes volúmenes se necesitará agregación y detalle paginado en servidor. No es tiempo real; actualizar vuelve a consultar. Cambios concurrentes durante la paginación pueden requerir recarga.
