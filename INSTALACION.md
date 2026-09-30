# Prospectos Pignus — interfaz inicial

Aplicación React sobre Vite y Mazer 2.3.1 (Bootstrap), conservando estilos, fuentes e iconos. Personalización en `src/shared/ui/estilos/personalizacion.css`; composición en `src/app` y páginas en `src/features`. Leer `docs/ARQUITECTURA.md` antes de modificarla.

## Ejecución

Requiere Node.js 22 y npm.

```sh
npm install
npm run dev
```

La terminal informa la dirección local. Para generar la distribución: `npm run build`. Para revisarla: `npm run preview`. Pruebas de compatibilidad de enlaces: `npm test`. No hay lint configurado.

## Alcance

Navegación en español, menú adaptable e interfaz comercial inicial. Login con Supabase Auth y roles administrador/vendedor; alta de usuarios reservada al administrador. Para activar la conexión, aplicar las migraciones y desplegar la función según `docs/AUTENTICACION.md`. Sin configuración el acceso permanece bloqueado. Registros iniciales incluye operaciones reales; los demás módulos comerciales continúan como pantallas informativas.

Hay formularios de login, creación de cuentas, cambio de contraseña propio y registros iniciales. React Router usa fragmentos de URL (`#/prospectos`) para permitir recarga y navegación atrás/adelante sin reglas SPA adicionales del servidor. Los enlaces anteriores (`#prospectos`) siguen funcionando. El proyecto Hobby `prospectospignus` en Vercel está conectado a `main`; cada push inicia un despliegue. Los cambios locales no se publican hasta confirmar commit y despliegue.

## Registros iniciales — primera entrega

Activación: aplicar `supabase/migrations/202609290003_registros_iniciales.sql` después de las dos migraciones de acceso. Aplicada y verificada en el proyecto `sjoounysrvxreazgbjkv` el 29/09/2026 (tres tablas con RLS, sin acceso anónimo ni escrituras directas para authenticated, y 11 orígenes). No repetirla en ese proyecto. En instalaciones nuevas no se aplica automáticamente al iniciar Vite. Si falta, la pantalla lo informa; no hay persistencia simulada. El lote de demostración autorizado se documenta por separado más abajo. En Windows puede iniciarse con `npm.cmd run dev -- --port 5174 --strictPort`.

- Carga manual con nombre/empresa y origen obligatorios; teléfono, correo, dirección/zona y observaciones opcionales. La ficha preliminar no constituye un Prospecto ni una captación validada para métricas.
- Vendedor activo: crea para sí y solo lee/edita su cartera. Administrador activo: consulta todas las fichas y asigna manualmente a perfiles activos o deja Sin asignar. No hay acceso anónimo ni escritura directa en tablas desde el navegador.
- Listado paginado de 20 filas, búsqueda por nombre, filtros por origen y (administrador) responsable; detalle enlazable mediante `#/registros?registro=UUID`. Las fechas se muestran en la zona de negocio de Argentina.
- Origen, creador y fecha originales no se editan. Reasignación con motivo obligatorio; historial inmutable accesible únicamente a quien tiene acceso actual al registro. Los nombres de perfiles ajenos no disponibles para un vendedor se muestran como Otro integrante, sin ampliar RLS de cuentas.
- RPC de guardado atómica: verifica perfil activo, asignación, versión y datos en servidor. Un UUID estable durante el formulario evita duplicar altas al reintentar; si se pierde la respuesta, reintentar sin cambiar datos ni recargar. Si se abandona el formulario tras un fallo de red, revisar el listado antes de crear otra ficha. Ediciones concurrentes requieren recargar y reconciliar los cambios, no se sobrescriben silenciosamente.
- El catálogo de orígenes reside en una tabla y puede ser configurado por el operador de base; no hay editor de catálogo todavía.

Fuera de esta primera entrega: calificación, descarte, advertencias de posibles duplicados, distribución automática por turnos, importaciones, exportaciones y métricas de registros válidos. No se han flexibilizado permisos para anticipar esas funciones.

Verificación: `npm test` ejecuta las migraciones reales en PostgreSQL embebido y cubre aislamiento, perfiles inactivos, reasignación y pérdida de acceso, auditoría, entradas inválidas, reintentos y versiones en conflicto. Después de activar en Supabase, probar con administrador y dos vendedores: crear ficha, editar, filtrar, paginar, abrir URL directa, reasignar con motivo, confirmar que el anterior responsable pierde acceso e intentar una edición simultánea en dos pestañas. Confirmar también móvil, refresh y errores de conexión. Las pruebas locales no sustituyen esta validación real.

## Demostración y resumen mensual

Inicio incorpora el resumen de registros brutos por mes, día, origen y creador, respetando RLS y la zona de Córdoba. Requiere `202609300004_demostracion_y_resumen.sql`, aplicada en el proyecto el 29/09/2026. Datos sintéticos, cuentas sin acceso y procedimiento de limpieza: `docs/DEMOSTRACION.md`. La aplicación sigue usando datos de Supabase; no hay cifras precargadas en la interfaz. Publicar los cambios del frontend es un paso separado de cargar el lote.

## Prospectos unificados y Ventas concretadas

La interfaz reúne calificación, visitas, seguimiento e historial en `#/prospectos`.
`#/oportunidades` conserva compatibilidad y redirige con sus parámetros.
`#/recuperacion` abre la misma bandeja filtrada, sin duplicar casos.

Antes de publicar esta entrega, aplicar una sola vez
`supabase/migrations/202609300010_ventas_concretadas.sql`, después de 001–009.
**010 aplicada y verificada en `sjoounysrvxreazgbjkv` el 30/09/2026. No repetirla en ese proyecto.**
La consulta real conserva los 950 casos y las 29 ventas de septiembre:
Gonzalo Rivadero 10, Martin Oliva 11 y Franco Suarez 8. Los administradores
ven las 29 y el agente sin cierres propios ve 0; ejecución anónima denegada.
No se aplica al iniciar Vite ni al desplegar en Vercel. No modifica filas comerciales:
agrega una consulta autorizada de cierres actuales, con filtros y paginación.
Si falta, Ventas concretadas muestra un error explícito, no datos simulados.

Verificación posterior: administración ve todos los cierres; agente/vendedor solo
los atribuidos a sí mismos. Una recuperación ganada por un agente no se duplica
en las ventas del vendedor de visita, aunque este conserva acceso a la ficha.
El histórico de septiembre debe mantener 29 ganadas mientras no cambien sus
resultados. Fecha exacta, visita, canal y condiciones desconocidas permanecen
sin informar. Probar filtros, paginación, enlace al historial y móvil con sesión
real. Las pruebas automatizadas utilizan exclusivamente una base local efímera.

## Promociones — activación

Antes de desplegar esta entrega, aplicar una sola vez y en este orden:

1. `supabase/migrations/202609300011_promociones.sql`.
2. `supabase/storage/promociones.sql` (requiere Storage de Supabase).

**Ambos scripts aplicados en `sjoounysrvxreazgbjkv` el 30/09/2026. No repetirlos en ese proyecto.** Verificados bucket privado, límite de 20 MB, cuatro MIME permitidos, siete políticas de Storage, RLS en las cuatro tablas y ausencia de ejecución anónima de la RPC. La carga/descarga completa con sesión de la aplicación sigue pendiente de prueba; no se publicaron promociones de prueba al equipo.
El segundo crea el bucket privado `promociones`; si ya existe, detenerse y revisar su origen en lugar de sobrescribirlo. No requiere nuevas claves ni permisos de administrador en el navegador. La app usa la sesión existente. La documentación oficial del modelo privado y descarga autenticada está en https://supabase.com/docs/guides/storage/buckets/fundamentals.

Prueba de aceptación real posterior: como administrador crear borrador, cargar un PDF y una imagen conocidos, publicar para agentes y comprobar aviso y descarga con agente; el vendedor no debe ver ficha, archivo ni aviso. Publicar para ambos y verificar vendedor. Archivar/revertir a borrador debe bloquear futuras descargas del equipo, incluso con la ruta conocida. Probar cuenta inactiva, anónimo, archivo mayor a 20 MB, tipos no permitidos, interrupción de carga y reintento. Comprobar también móvil, navegación y el historial de Prospectos después de retirar los dos accesos.

Los archivos incompletos o retirados permanecen asociados al historial; no se eliminan automáticamente ni se promete liberar almacenamiento al archivar. Cualquier purga física futura requiere alcance y autorización explícitos, usando la API de Storage, nunca borrando filas de `storage.objects` directamente. La cuenta o plan de Supabase puede imponer cuotas adicionales. Una copia descargada no se puede revocar.

## Plantilla

- Documentación: https://zuramai.github.io/mazer/docs/index.html
- Distribución: https://github.com/zuramai/mazer/releases/tag/v2.3.1
- Recursos necesarios distribuidos localmente en `public/mazer`.
- Licencia MIT de Mazer incluida junto a sus recursos. Las personalizaciones se mantienen separadas de los archivos del proveedor.
