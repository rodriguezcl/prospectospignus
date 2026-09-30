# Demostración de septiembre de 2026

**Estado: lote eliminado el 30/09/2026 por confirmación expresa.** Se retiraron 134 fichas, 224 eventos de registros, las dos cuentas/perfiles DEMO, sus eventos de alta y el manifiesto. Se conservaron las dos cuentas reales; no había registros reales cargados. Los scripts se conservan como referencia histórica y pruebas: no volver a ejecutarlos en producción sin nueva autorización. La descripción siguiente documenta el escenario retirado.

Carga opcional solicitada por el usuario en la base compartida que se usará más adelante en producción. No se ejecuta al iniciar la aplicación ni al aplicar migraciones ordinarias. Ningún dato ficticio vive en el frontend: el tablero consulta Supabase bajo RLS.

## Alcance

- Lote `pignus-demo-septiembre-2026-v1`, revisión `diversificada-134-v2`: 134 contactos de septiembre de 2026. Carga original de 90 ampliada en 44 y redistribuida con autorización el 30/09/2026. Cuatro domingos sin cargas, entre 1 y 11 cargas en los demás días, menor volumen los sábados y 134 horarios distintos de mañana/tarde. Escenario sintético del mes completo.
- Matías Gómez · DEMO y Florencia Pérez · DEMO: vendedores inactivos, cuentas Auth bloqueadas hasta fin de 2099, sin contraseña ni identidades de login. Correos `example.invalid`; no se envían mensajes ni invitaciones. No se cambian cuentas existentes.
- 76 cargas atribuidas a Matías y 58 a Florencia; 16 registros sin asignar y 11 orígenes con frecuencias diferentes. Las restantes fichas pertenecen exclusivamente a los vendedores DEMO. Los vendedores reales no ven esas carteras.
- Nombres combinados ficticios. Teléfonos `351-000-NNNN (DEMO)`: datos de prueba; no se afirma que sean un rango oficialmente reservado. No llamar ni enviar WhatsApp.
- Direcciones de lugares públicos, no viviendas ni domicilios personales. Consultadas en [Google Maps](https://www.google.com/maps/search/museos+C%C3%B3rdoba+Capital+Argentina): Museo Emilio Caraffa, Av. Poeta Leopoldo Lugones 411; Museo Evita, Av. Hipólito Yrigoyen 511; Palacio Dionisi, Av. Hipólito Yrigoyen 622; Museo de las Mujeres, Rivera Indarte 55; Museo Juan de Tejeda, Independencia 122. Distribución reproducible; no implican relación comercial con esos lugares.
- La fecha comercial es simulada. El evento conserva la fecha real de carga y su motivo explícito. No se inventan gestiones ni ventas.

## Activación y limpieza

1. Aplicar una sola vez `supabase/migrations/202609300004_demostracion_y_resumen.sql`.
2. Ejecutar explícitamente `supabase/demostracion/cargar_septiembre_2026.sql` como operador PostgreSQL. Atómica e idempotente con manifiesto presente. No desactiva triggers ni RLS. Inserción directa en Auth exclusiva de identidades inhabilitadas; no es el mecanismo para cuentas reales.
3. Ejecutar explícitamente `supabase/demostracion/ampliar_septiembre_2026.sql` para el escenario diversificado de 134 fichas. Comprueba el manifiesto y auditoría originales, conserva los 90 eventos de alta y agrega 90 eventos de redistribución más 44 altas. Guarda el manifiesto anterior y snapshots actuales de fichas/eventos; repetirlo no duplica datos. Solo esta intervención DEMO autorizada puede cambiar fechas/creadores/orígenes sintéticos; las reglas comerciales normales permanecen intactas. El frontend existente muestra los cambios al actualizar, sin despliegue nuevo.
4. Solo cuando el usuario solicite borrar, revisar y respaldar el lote si se desea conservarlo. Ejecutar `SET pignus.confirmar_limpieza = 'pignus-demo-septiembre-2026-v1';` y `supabase/demostracion/eliminar_septiembre_2026.sql` en la misma sesión. Es definitivo y requiere confirmación en ese momento. No ejecutar ahora.

La limpieza compara las fichas con el manifiesto vigente, verifica cuentas inactivas/bloqueadas y aborta si hay ediciones, auditoría adicional o vínculos ajenos. Admite el escenario original de 90 y el ampliado de 134 con sus 224 eventos contrastados contra snapshot. Solo borra las fichas, eventos y dos cuentas/perfiles del lote. Una ficha reasignada o editada exige revisión manual. No hay botón de borrado indiscriminado en la app.

La ampliación se aplicó y verificó en `sjoounysrvxreazgbjkv` el 30/09/2026: 134 fichas, 76/58 por creador, 16 sin asignar, cuatro días sin cargas, pico de 11, 11 orígenes y 134 horarios distintos. Las 44 nuevas fichas usan zonas genéricas de Córdoba o ubicación vacía, sin nuevas direcciones personales ni consultas a Maps. Los registros comerciales reales no se modifican.

La migración 202609300004 y el lote se aplicaron en `sjoounysrvxreazgbjkv` el 29/09/2026 (hora Argentina). No repetir la migración. El lote se amplió y luego se eliminó con autorización el 30/09/2026. La migración y las protecciones se conservan; la limpieza no elimina tablas ni funciones.

## Estadísticas

Inicio selecciona septiembre de 2026 por defecto y permite elegir otro mes. Cuenta registros brutos visibles bajo RLS, separando DEMO/no demostración y sin asignar. Agrupa por día local, origen y creador original, no responsable actual. Cada cifra permite inspeccionar las filas y abrir su ficha. No calcula ventas, contactos efectivos ni captación válida.

RPC SECURITY INVOKER con límites del mes en PostgreSQL en `America/Argentina/Cordoba`. El vendedor solo ve su cartera actual; una reasignación cambia el alcance, no el creador histórico. Lectura paginada de 500 en 500, límite de seguridad de 10.000 que muestra un error y nunca totales parciales. Para grandes volúmenes se necesitará agregación y detalle paginado en servidor. No es tiempo real; actualizar vuelve a consultar. Cambios concurrentes durante la paginación pueden requerir recarga.
