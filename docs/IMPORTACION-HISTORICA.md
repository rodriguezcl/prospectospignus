# Importación retrospectiva de septiembre

## Aclaración posterior sobre fechas

Administración confirmó que las fechas y horas asignadas son las fechas reales de carga. La migración 009 habilita su uso en los gráficos diarios mediante `fecha_carga_historica`, sin reemplazar `creado_en` ni la etiqueta original del archivo. La confirmación auditada prevalece para estadísticas de carga; no aporta fechas de cierre. No se reimportan registros ni cambian los 29 resultados ganados y 921 perdidos. Los apartados siguientes describen la importación inicial, previa a esta aclaración.

La migración 009 se aplicó el 30-09-2026 y la confirmación devolvió 950 filas actualizadas, con evento de auditoría individual. El nuevo frontend usa la proyección `listar_cargas_mensuales`; queda pendiente de commit, push y despliegue. Verificados 34 tests y build, incluyendo límites de mes en Córdoba, conservación de `creado_en` y procedencia, reintentos sin doble evento y aislamiento por cartera.

## Datos y controles

Archivo fuente: `Prospectos_septiembre_2026_sin_repetir_asignados.xlsx`, hoja Hoja1. 950 registros, 29 con Ganadas=SI y 921 vacíos clasificados como perdidos por indicación expresa de administración. No se modifica el original. Los datos personales y el SQL generado no se versionan.

El operador debe verificar los IDs de vendedores activos en la base y el administrador responsable de la importación. `scripts/preparar-importacion-historica.py` recibe Excel, configuración JSON y destino SQL externo al repositorio. La configuración contiene administrador, mes (primer día), lote, total, ganadas y mapa vendedores (nombre exacto → UUID).

El preparador valida estados, fechas estimadas, totales, correspondencia y duplicados de fila/teléfono/correo. El SQL valida nuevamente perfiles y totales y rechaza coincidencias con contactos ya existentes. El lote se guarda en una transacción única: cualquier error revierte todo. Repetir el mismo archivo no duplica ni sobrescribe; cambiar su huella requiere revisión, no actualización automática.

Aplicar 007 y 008 antes de ejecutar el SQL preparado. No autoriza push ni despliegue del frontend. La configuración y la ejecución deben corresponder al proyecto revisado, nunca a una base inferida.

## Semántica y verificación

- Creado en/por: instante real y administrador de la importación, no vendedor captador supuesto.
- Mes comercial: septiembre de 2026. Días/horarios: estimados, solo procedencia.
- Visita, captador, calificador, aceptación, condiciones y motivo individual: no informados; sin gestiones ficticias.
- Resumen histórico: evento inicial, vendedor al cierre, 29 ganadas / 950 cierres = 3,05 %. Separa estado actual.
- Reactivar: responsable activo o administración, motivo, próxima acción futura y nuevo ciclo. Preserva pérdida anterior y resumen histórico.
- La importación no genera 950 notificaciones ni reasigna a agentes los casos cerrados.

Pruebas: `supabase/tests/historico.test.js` cubre permisos, cartera, idempotencia, nulos, no reapertura de ganadas, próximo contacto, versión, historial y conservación del cierre original. Verificar después de ejecutar los conteos y la ausencia de DEMO. El frontend nuevo requiere su propio despliegue antes de mostrar el resumen y el botón Reactivar.

## Ejecución del 30-09-2026

Migraciones 007 y 008 aplicadas en el proyecto Supabase configurado. Importación confirmada por el editor SQL y consulta posterior: Gonzalo Rivadero 317 (10 ganadas, 307 perdidas), Martin Oliva 317 (11 ganadas, 306 perdidas), Franco Suarez 316 (8 ganadas, 308 perdidas). Total 950, 29 ganadas y 921 perdidas. No se crearon cuentas ni notificaciones de carga masiva. Huella SHA-256 del Excel: `44bd10a6b6d93d45ba6963d4a2177750724e39f3c0902434bbb58aa7fa4b73a7`.

La prueba local ejecutó dos veces el lote completo sin duplicarlo. Suite de 34 pruebas aprobada y build correcto (advertencia existente por bundle mayor a 500 kB). El frontend de este cambio permanece pendiente de commit, push y despliegue autorizados; la carga de base no depende de ese despliegue.
