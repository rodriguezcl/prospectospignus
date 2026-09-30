# Agentes, visitas y recuperación comercial

## Activación y despliegue

Orden de despliegue (requiere autorización expresa; el código local por sí solo no activa el circuito remoto):

1. Aplicar `supabase/migrations/202609300006_agentes_y_oportunidades.sql` después de 001–005, verificando respaldo y resultado transaccional.
2. Volver a desplegar la Edge Function existente `crear-usuario`, que ahora acepta `agente`. Conservar su verificación explícita de identidad/administrador y configuración de orígenes.
3. Publicar el frontend y verificar con sesiones reales autorizadas. No cambiar el rol de cuentas existentes automáticamente ni crear cuentas de prueba en producción sin permiso.
4. Administración crea la cuenta Agente en Usuarios, o cambia el rol de la persona indicada. El agente entra a Oportunidades y declara su disponibilidad. Por defecto todas las cuentas quedan no disponibles para recuperación.

La migración no inserta contactos ni cuentas ficticias y no cambia los roles actuales. Una reversión de frontend no debe borrar tablas con actividad comercial. Los cambios de catálogo de funciones anteriores conservan sus protecciones y se verifican con la cadena completa de migraciones en PostgreSQL embebido.

### Activación de servidor verificada el 30-09-2026

Con autorización de commit y despliegue, se aplicó la migración 006 al proyecto `sjoounysrvxreazgbjkv` y se volvió a desplegar `crear-usuario` con el nuevo catálogo de roles. Se verificaron las cuatro tablas nuevas con RLS y la admisión de Agente en alta y edición. Se conservaron las cinco cuentas existentes y los cero registros iniciales; no se crearon usuarios ni contactos de prueba. La verificación funcional con sesiones reales queda pendiente de ingreso autorizado a la plataforma. La publicación del frontend se sigue mediante el commit y su despliegue asociado en Vercel.

## Uso

- Agente o vendedor registra el contacto en Registros iniciales y completa teléfono/dirección.
- En Oportunidades, «Calificar y coordinar visita» confirma respuesta humana, necesidad real, resumen del contacto, vendedor y fecha/hora de Córdoba. El vendedor solo puede coordinar sus propias visitas. La calificación crea un Prospecto con vínculo único al registro; otra necesidad puede crear otra oportunidad sin duplicar Prospecto.
- El vendedor abre su visita y registra aceptación, seguimiento, reprogramación o derivación. Las condiciones finales y objeciones se registran una vez; no hay secuencia A/B/C.
- Derivar conserva oportunidad e historial; distribuye entre agentes activos y disponibles por menor cantidad de recuperaciones abiertas, con desempate aleatorio. El bloqueo transaccional evita competir por un mismo cupo. Un agente no disponible conserva sus casos actuales hasta cerrarlos o ser reasignados.
- Sin agentes disponibles, queda pendiente y administración recibe aviso. Agente/administración puede abrir el caso y ejecutar «Asignar equilibradamente» cuando haya disponibilidad; no elige apropiárselo. Administración puede reasignar con motivo.
- En recuperación, registrar propuesta final y aceptación o rechazo expreso. La falta de respuesta permanece en seguimiento; «no responde» no está habilitado como pérdida hasta definir sus umbrales. Antes de recuperación solo fuera de zona/no cumple requisitos permite pérdida directa justificada.
- La campana contiene hasta 50 avisos sin leer, renovados cada 30 segundos y al recuperar foco. «Marcar leída» no cambia el trabajo pendiente. Los avisos anteriores permanecen guardados; esta entrega muestra los no leídos, no un archivo de notificaciones.

## Permisos y consistencia

Administración supervisa todo. Agente ve sus oportunidades y la cola común de recuperación, sin acceso general a carteras de vendedores. La persona responsable escribe; participantes conservados en la ficha consultan después de derivar. La tabla de perfiles no amplía su RLS; un catálogo específico expone únicamente nombres, roles y disponibilidad de cuentas activas para asignación.

Cada RPC valida actor activo, versión, transición, evidencia y UUID de operación. El reintento idéntico devuelve el mismo resultado sin repetir eventos/avisos; una versión antigua se rechaza. El navegador conserva la clave durante reintentos de la misma edición. No reutilizar un formulario de alta desde otra pestaña como mecanismo de reintento: las claves son de cada formulario, no deduplicación comercial por teléfono.

Estados actuales: visita, seguimiento, recuperación, ganada, perdida. El responsable del cierre y la captación son independientes. Ganada no declara instalación. Las cuentas con oportunidades abiertas deben reasignarlas antes de desactivarse/cambiar rol; los vínculos históricos impiden eliminación destructiva.

## Límites explícitos de esta entrega

- Historial de hasta 100 eventos recientes en la ficha y próxima acción con marca de vencimiento. Las pantallas generales de Gestiones y Próximas acciones continúan preparatorias: el circuito se opera en Oportunidades.
- No hay reapertura/corrección de cierres ni edición retrospectiva de calificación; requiere un circuito auditable posterior.
- No se agregan todavía métricas de cierres/cohortes al Inicio: sus gráficos actuales siguen midiendo cargas de registros iniciales.
- No hay automatismo de integración WhatsApp, agenda externa, recordatorios por correo ni notificaciones del sistema operativo.
- Datos de contacto del Prospecto son la instantánea de calificación. Los cambios posteriores del registro inicial no los sobrescriben silenciosamente.

## Verificación

`npm test` ejecuta la migración completa en PostgreSQL embebido y prueba aislamiento, escritura directa denegada, calificación, distribución 2/2, reintentos sin duplicación, ausencia de agentes, lectura de aviso sin cierre, aceptación/rechazo, bloqueo de cuenta con trabajo pendiente y acceso anónimo denegado. No sustituye la prueba de Supabase Auth/PostgREST y Edge Function desplegados. Antes de publicar, verificar visualmente escritorio/móvil y completar un ciclo con cuentas autorizadas, sin alterar oportunidades reales solo para probar.
