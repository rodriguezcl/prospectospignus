# Constitución arquitectónica de Prospectos Pignus

## Dólar informativo en cabecera (05-10-2026)

La feature `dolar` consulta el endpoint público de DolarAPI `/v1/dolares/oficial`, sin credenciales ni datos comerciales. App conecta el adaptador HTTP con la presentación mediante el puerto `consultar`. Muestra venta en pesos y fecha/hora de la fuente en horario argentino. Consulta cada cinco minutos mientras la pestaña está visible, con tiempo límite de diez segundos y cancelación al desmontar. Si falla conserva el último dato identificado como no actualizado; sin datos muestra no disponible. El seguimiento guarda en localStorage la última cotización y los avisos sin leer, separados por usuario y navegador. La primera consulta establece referencia; solo una fecha posterior con venta mayor genera aviso. Bajas actualizan la referencia, respuestas repetidas o atrasadas no duplican avisos. Marcar leída elimina únicamente el aviso local. Con almacenamiento bloqueado se conserva en memoria durante la sesión. No monitorea con la plataforma cerrada ni sincroniza entre dispositivos. App agrega estos avisos a la campana existente, que pasa a rojo mientras haya pendientes. No modifica precios, propuestas o cálculos comerciales. No requiere migraciones ni claves de API.

## Actualización vigente: Prospectos / Cotizaciones (02-10-2026)

Rector 25.2 prevalece sobre los nombres históricos usados más abajo. `registros-iniciales` presenta Prospectos y `oportunidades` presenta Cotizaciones; se conservan las features, IDs, tablas y contratos anteriores. No se migran ni duplican contactos por cambiar el menú. Rutas `/registros` y enlaces antiguos `/prospectos?id=…` mantienen compatibilidad.

Migración 019: lectura paginada SECURITY INVOKER de contactos y casos bajo RLS; política de lectura de contactos asignados compatible con participación comercial, sin ampliar edición. `iniciar_cotizacion` crea una negociación en preparación sin inventar contacto efectivo ni visita. Registra ciclo/origen e idempotencia con bloqueo compartido. El catálogo y el motor de precios mantienen sus permisos y validaciones anteriores.

Las correcciones de nombre/teléfono/dirección en la ficha fuente actualizan la identidad interna heredada mediante trigger, sin alterar los snapshots de eventos. No se replica un formulario de datos personales en Cotizaciones.

`anular_cotizacion` conserva datos y eventos; vendedor solo antes de actividad posterior y si creó el caso propio, administrador con motivo/confirmación. Cancela visitas pendientes, conserva realizadas y excluye anuladas de proyecciones comerciales. Guardas de servidor impiden mutarlas o agregar propuestas/vínculos nuevos desde clientes antiguos. Las actividades manuales ya existentes conservan gestión propia. La presentación no sustituye estos permisos.

Aplicar 019 antes de publicar el frontend; sin ella se informa migración pendiente. No se aplican reglas contables pendientes ni se cambian precios. Verificación: pruebas PostgreSQL de aislamiento, preparación sin visita, duplicados, reintentos, anulación y métricas; pruebas de presentación, rutas y build.

## Alcance y principios

**Componentes compartidos (026, rector 26.5).** Esquema 5 conserva marcas y ofertas y añade marcas_compatibles a componentes de la marca administrativa COMPONENTES. Solo ellos pueden cruzar marcas, siempre dentro del mismo servicio; no se crean ofertas bajo COMPONENTES. Validación de catálogo y cálculo de propuestas verifican el vínculo en servidor. El cálculo proyecta temporalmente la familia del componente compatible para reutilizar el motor 025 sin cambiar IDs, precios ni datos persistidos. Guardado por RPC 026, versiones anteriores legibles y reintentos exactos conservados; tras publicar esquema 5 se rechazan escrituras de clientes antiguos. Aplicar 026 antes del frontend. La migración no unifica datos automáticamente.


**Vigente: precios por modalidad (025, rector 26.4).** Solo se ofrecen Alarmas y Cámaras. Productos administra componentes sin selector de clase; no hay mano de obra ni cerco en nuevas altas. Esquema 4 exige precios individuales de los componentes activos: Alto/Bajo/Telefónico para alarma, solo Telefónico para cámaras. Planes en comodato conservan cinco niveles; kits de venta de ambos servicios y sus adicionales usan exclusivamente Telefónico, accesible al vendedor para venta de equipos. El precio propio de la oferta es autoritativo, independiente de la suma de sus incluidos. Las restricciones del nivel Telefónico de planes y abonos, bolsas y pisos de planes se conservan. La venta de kits no genera bonificaciones ni se considera incluida en expensas.

La adaptación retira cerco/mano de obra del catálogo vigente y conserva sus versiones y propuestas históricas. No transforma automáticamente el antiguo precio Único en Telefónico: lo muestra como referencia administrativa y deja los registros incompletos y ofertas dependientes en borrador. El primer guardado publica esquema 4; cotizar con este frontend requiere ese esquema revisado. Aplicar 025 antes del frontend que usa `guardar_catalogo_025`. Se bloquean nuevas escrituras de formatos anteriores tras publicar esquema 4 y se conservan sus reintentos exactos. La lectura del catálogo expone Telefónico de kits/componentes para vender equipos; continúa ocultando Telefónico de planes y abonos a quien no tiene permiso. El servidor recalcula y valida modalidad, precio, cantidades y permisos; las cotizaciones y ventas guardadas nunca se recalculan por actualizar el catálogo.

**Vigente: catálogo sin plantillas (024, rector 26.3).** Las únicas secciones administrativas son Marcas, Productos y Planes y kits. Cada oferta define directamente marca, modalidad, componentes, cantidades y precios. Los adicionales se habilitan y retiran desde Productos. Cotizaciones selecciona marca y oferta sin clasificaciones intermedias. Esquema 3 elimina `tipos`, `plantillas_version` y `tipo_comercial_id` del catálogo nuevo; adaptar esquema 2 conserva IDs, estados, precios y composición de cada oferta. No copia componentes de las antiguas plantillas ni reescribe versiones, propuestas o ventas. La migración conserva lectores y reintentos históricos, rechaza escrituras de clientes anteriores después de publicar esquema 3 y mantiene validaciones y permisos comerciales. Aplicar 024 antes del frontend que usa `guardar_catalogo_024`; no se ejecuta al arrancar la aplicación. No hay carga automática del Word.

Los párrafos siguientes describen el esquema anterior (020/023) y sus garantías conservadas; las referencias a tipos o plantillas quedan sustituidas por 024.

El módulo administrativo antes llamado Productos se presenta como **Catálogo comercial**, conservando `/productos` y la feature. Migración 020 implementa el esquema 2 del rector 26: marcas y tipos independientes, productos reutilizables, planes/kits y habilitación de adicionales. Los grupos marca/servicio conservan internamente `familias` para reutilizar el motor, pero no son una entidad que administre el usuario. El servidor valida referencias, modalidades, estados y composición; no confía en las selecciones del navegador.

La adaptación del catálogo anterior se presenta para revisión: toma las marcas explícitas, conserva IDs de productos y deja los productos en borrador sin deducir modalidad/tipo de nombres libres. Se publica solo al guardar desde administración; no reescribe versiones anteriores. `guardar_catalogo_020` evita que un servidor sin migrar acepte silenciosamente el nuevo formato. Tras publicar esquema 2 se rechazan escrituras de clientes anteriores. Aplicar 020 antes del frontend; no cambia datos por sí sola.

ABM versionado: baja lógica reversible mediante edición; eliminación del vigente solo sin dependencias ni uso en propuestas. Se conservan todas las versiones y la autoría. Dependencias activas impiden deshabilitar marca, tipo o componente incluido; la interfaz explica los vínculos y el servidor los valida. Retirar la oferta como adicional no retira el componente incluido. Los componentes solo incluidos pueden activarse sin precio individual; habilitarlos como adicionales exige las tarifas completas. La cotización filtra modalidad/marca/tipo y congela la propiedad por cantidades en servidor (incluidos, adicionales pagados, bonificados y obsequios). Ventas muestra el mismo snapshot aceptado. No cambian mínimos, descuentos ni reglas pendientes de facturación.

Organizar por funcionalidades, con alta cohesión, bajo acoplamiento, composición y dependencias hacia las reglas comerciales. Aplicar Clean Code, SOLID y Clean Architecture de manera proporcional a necesidades reales. El documento rector conserva autoridad sobre las reglas comerciales. La visión futura de CRM no incorpora Clientes, Stock ni Operaciones al alcance actual.

### Ampliación comercial planificada (01-10-2026)

El rector V1.6, sección 24, aprueba catálogo/precios, propuestas versionadas, métricas por visitas/ciclos y registro administrativo de instalación efectiva/activación. **No están implementados por esta actualización documental.** El [plan por módulos](PLAN-COMERCIAL-V1.6.md) distingue las features operativas de las pantallas preparatorias y fija entregas verificables.

Productos será el único módulo visible nuevo. Configuración administra condiciones; Prospectos y Recuperación comparten la propuesta por composición de puertos, sin imports entre internals. Ventas conserva el cierre autoritativo y su versión aceptada, sin duplicar eventos para generar estadísticas. Inicio/Informes consumirán proyecciones autorizadas por cierre y por primera visita de cada ciclo, no confundirán la cohorte actual por creación con la nueva métrica.

Las reglas puras de precios no dependen del Excel ni de React/Supabase. El servidor valida reglas, rol, versión e idempotencia; el navegador no recibe precios Telefónicos restringidos al vendedor. La fecha de instalación se carga manualmente por administración con respaldo del sistema externo Agenda Pignus; no es una integración automática ni gestión técnica. Facturación e IPC automáticos continúan fuera de implementación mientras faltan sus definiciones. No se crean capas o entidades vacías anticipadamente.

## Estructura actual

- `src/principal.jsx`: entrada React y compatibilidad de enlaces.
- `src/app`: composición, router, configuración concreta del menú y layout global. Sin reglas comerciales.
- `src/features/<funcionalidad>/presentation`: páginas de cada módulo; API pública explícita en `index.js`.
- `src/shared/ui`: componentes visuales reutilizados, navegación y estilos Mazer.
- `public/mazer`: distribución del proveedor y licencia, separada de personalizaciones.

Las features `autenticacion`, `usuarios` y `registros-iniciales` incorporan dominio, aplicación e infraestructura porque ya existe una frontera real con Supabase. El cliente compartido vive en `src/infrastructure/supabase`; la composición explícita se realiza desde `app/configuracion/servicios.js` mediante entradas `composicion.js` de cada feature. Las demás features siguen siendo presentación. No crear carpetas vacías, repositorios ficticios ni datos comerciales simulados.

Registros iniciales recibe el perfil desde la composición de rutas, sin importar internals de autenticación. Lecturas bajo RLS y escrituras por RPC transaccional con validación de actor, versión e historial. Su catálogo y sus políticas son propios; no modifica los permisos de lectura de perfiles para mostrar nombres de terceros. La primera entrega y sus límites están documentados en `INSTALACION.md`.

## Dependencias e imports

`inicio` incorpora dominio, aplicación e infraestructura para el resumen mensual real bajo RLS. La carga sintética explícitamente autorizada se mantiene fuera del frontend y de las migraciones automáticas, en `supabase/demostracion`, con manifiesto y limpieza acotada (ver `docs/DEMOSTRACION.md`). No es un backend simulado.

1. `app` compone las APIs públicas de features y los componentes compartidos. En el futuro conectará también las implementaciones de infraestructura.
2. `presentation` depende de su aplicación/dominio y de UI compartida; nunca de adaptadores Supabase.
3. `application` coordina casos de uso y define los puertos externos que estos necesitan; depende del dominio, no de SDK externos.
4. `domain` contiene reglas puras. No importa React, Mazer, Supabase, DOM, HTTP, hosting ni otras capas.
5. `infrastructure` implementa los puertos y depende de las capas internas; nunca al revés.
6. `shared` no importa features ni app. Los componentes reciben configuración y acciones como propiedades.
7. No hay dependencias entre features en producción. Las pruebas de integración de navegación pueden componer APIs públicas de varias features y la configuración del menú para verificar su coherencia. Toda otra excepción futura se documenta y utiliza APIs públicas; prohibidos ciclos e imports cruzados a internals.
8. Imports relativos inicialmente. Reexportaciones explícitas solamente en límites de features, sin barrels globales.

Mazer se utiliza solo en presentación y UI compartida. React controla el DOM y las interacciones; no importar el JavaScript de demostración de Mazer ni duplicar Bootstrap/iconos.

## Criterios de crecimiento

Crear una feature cuando haya una responsabilidad funcional con dueño claro. Un placeholder solo necesita presentación. Extraer componentes compartidos cuando haya consumidores reales o responsabilidad global de UI, no por similitud hipotética.

Crear dominio al aparecer reglas comerciales independientes de la UI. Crear un caso de uso cuando se coordinen reglas y operaciones. Crear un contrato de repositorio cuando haya una frontera real de persistencia: métodos mínimos, funciones/JSDoc posibles, sin exigir clases. Implementar el adaptador específico dentro de la feature y conectarlo desde app.

El cliente Supabase compartido pertenece a `src/infrastructure`; cada adaptador a `features/<funcionalidad>/infrastructure`. Una única creación del cliente, sin consultas dispersas en JSX. La entrada pública de composición es exclusiva para app; presentación no importa esa entrada. Las rutas protegidas y el menú consumen la API pública de autenticación; usuarios recibe su caso de uso como propiedad, sin importar otra feature.

## Estado, errores y seguridad

Orden visual A–Z: catálogo y conjuntos completos en memoria se ordenan sobre copias; las consultas paginadas ordenan en servidor antes del límite, con ID de desempate. Migración 022 actualiza las lecturas de contactos de Cotizaciones y Ventas, conservando filtros, contratos y seguridad. Debe aplicarse antes de publicar el ajuste. Agenda, avisos, historiales y rankings mantienen su secuencia funcional.

Los importes en presentación usan formato argentino ($, punto para miles y coma decimal). `shared/ui/CampoImporte` adapta la entrada localizada a cadenas decimales canónicas sin operar con Number ni redondear precios fuente; admite vacío y cero distintos. Catálogo conserva hasta seis decimales y pago en efectivo dos. Totales, ventas e informes comparten `monedaArgentina`. La adaptación es de UI: no modifica contratos, reglas de cálculo ni valores históricos.

Inicio compone su lectura mensual existente con oportunidades paginadas bajo RLS y la RPC de ventas (010), sin imports entre features. El dominio calcula cohortes, atribuciones y pendientes actuales por separado; la presentación permite abrir el detalle de cada cifra. El histórico usa resultado/responsable originales, no sobrescribe septiembre con estados actuales. Lecturas con error o más de 10.000 filas fallan explícitamente, sin totales truncados. No hay migración ni escritura comercial en este rediseño. Rige el principio de simpleza con criterio del documento rector: resumen a primera vista y detalle accesible a demanda, adaptado al rol.

La apariencia personal se guarda en Supabase Auth (`user_metadata.pignus_tema`), exclusivamente para la cuenta autenticada, mediante el adaptador de autenticación. Es una preferencia visual, nunca una fuente de autorización. El selector del layout aplica `data-bs-theme` y vuelve a claro al desmontarse/cerrar sesión; no hay tema global compartido ni migración comercial. Un fallo de guardado conserva el tema anterior e informa el error. Los estilos propios de noche complementan Mazer sin modificar archivos del proveedor.

Estado de UI local y composición. Context solo cuando sea global; evaluar el estado servidor cuando exista, sin incorporar Redux/Zustand preventivamente.

Distinguir errores de validación, dominio, autenticación/autorización, infraestructura e inesperados. Los adaptadores traducen fallos externos; presentación muestra mensajes comprensibles sin secretos ni detalles internos. Crear tipos o clases al existir consumidores reales.

Ocultar enlaces no autoriza operaciones. La integración de acceso utiliza Supabase Auth, RLS para perfiles y una Edge Function que exige administrador activo para crear cuentas. Nunca exponer service_role ni secretos en VITE_*. La activación y las pruebas reales de servidor se describen en `docs/AUTENTICACION.md`; no confundir el código local con un despliegue completado.

La gestión posterior de cuentas utiliza la RPC transaccional `gestionar_cuenta`: valida administrador activo por `auth.uid()`, versión, motivo, último administrador y vínculos históricos. Editar afecta únicamente nombre/rol del perfil; desactivar afecta elegibilidad en Pignus, sin cambiar credenciales Auth. La eliminación limitada de una cuenta sin actividad comercial borra `auth.users` y su perfil por FK en una única transacción privilegiada, preservando eventos de cuenta. Esta integración puntual con el esquema Auth requiere verificación en Supabase al desplegar; no expone permisos directos de escritura al navegador. Cada nueva entidad comercial debe ampliar las comprobaciones de eliminación antes de habilitarse.

## Routing y accesibilidad

Alta guiada (018): la RPC valida servicios/modalidad y observaciones opcionales, genera la descripción legible y conserva el interés estructurado en Oportunidades; canal y nota original quedan en la solicitud auditada. Delega permisos, transacción, coordinación de agenda e idempotencia al circuito vigente, cuya entrada anterior queda privada. Clientes anteriores conservan contrato textual y no se reclasifica el histórico. El cotizador utiliza el interés como selección inicial, no como precio ni propuesta aceptada. Aplicar la migración antes de publicar el formulario nuevo.

Continuidad comercial (02-10-2026): app inyecta la continuación de Oportunidades en el detalle de Registros iniciales mediante su API pública. La consulta por registro y sus casos usa RLS existente; no hay imports entre internals ni nuevas escrituras/migraciones. Ambos accesos convergen en un único selector y formulario de alta, con contacto preseleccionado y advertencia de casos existentes. Crear otra necesidad requiere confirmación explícita de UI; no es una nueva restricción de unicidad del servidor. Datos incompletos se corrigen en el registro, no se duplican en el alta. Cotizar, guardar una oferta y declarar aceptación siguen siendo acciones diferentes. Agenda no es requisito previo de captación ni acredita un cierre.

La simpleza transversal usa desplegables nativos de presentación para ayuda, historial y detalle comercial secundario, conservando validaciones y permisos. Los módulos sin implementación se agrupan en un menú plegable «En preparación», sin retirar rutas. El ciclo de foco del menú móvil incluye sus resúmenes y excluye enlaces ocultos en desplegables cerrados. No se crean consultas ni capas nuevas por este ajuste visual.

HashRouter mantiene el hosting independiente de las features. `#prospectos` se normaliza a `#/prospectos` conservando consultas; destinos desconocidos muestran 404. El menú y los accesos de Inicio reciben destinos desde app.

Menú móvil con foco inicial, contención de Tab, Escape, fondo inerte y restauración de foco. Menú oculto inerte, indicador activo, salto al contenido y movimiento reducido. Los cambios de ruta actualizan título y foco.

## Verificación y evolución

El circuito de calificación, visita y recuperación pertenece internamente a `oportunidades`, con dominio puro, casos de uso y adaptador RPC. Se presenta en una única pantalla «Prospectos»; `/oportunidades` redirige conservando la consulta. Recuperación comercial reutiliza esa pantalla con filtro de recuperación. La calificación crea un Prospecto independiente y una oportunidad por necesidad. Se elimina la página de consulta duplicada, no las tablas ni el historial. Los eventos representan las gestiones de esta entrega; las pantallas generales de Gestiones y Próximas acciones siguen pendientes.

`ventas` consulta una proyección de las oportunidades actualmente ganadas, sin tabla duplicada. Su composición inyecta el puerto `listar`; no incorpora capas de delegación vacías. La RPC 010 aplica permisos de administrador activo o responsable al cierre, independientemente del permiso más amplio de consulta por participación. Totales, filtros y catálogo mínimo de responsables se calculan sobre el mismo conjunto autorizado. El mes corresponde al cierre del servidor en Córdoba, o al mes histórico cuando falta fecha exacta; nunca a la fecha de captación. Un cierre posterior de un caso histórico prevalece sobre su mes de procedencia. La migración no modifica datos comerciales existentes.

La migración 006 extiende Agente en perfiles, altas y gestión de cuentas, conserva el bloqueo compartido de cambios de elegibilidad y agrega protección de cuentas con actividad. RLS restringe carteras y habilita la cola común de recuperación para agentes. Las escrituras transaccionales requieren versión y UUID de operación; no hay DML directo desde el navegador. La campana consulta avisos persistentes cada 30 segundos y al recuperar foco; no usa notificaciones push externas. Las lecturas paginadas y los errores de migración pendiente son explícitos.

Ejecutar `npm run build`, `npm test` y cualquier lint que exista. Verificar rutas, atrás/adelante, refresh, 404, consola y layout a diferentes anchos. No hay lint configurado todavía. Probar reglas sin React y casos de uso sin Supabase cuando aparezcan; evitar tests que solo reproduzcan código.

Antes de cada implementación: identificar dominio, capa, abstracción existente y dirección de dependencias. Documentar excepciones. Preservar cambios preexistentes; no desplegar ni modificar servicios remotos sin alcance autorizado.

Las migraciones 007/008 agregan reactivación por ciclos e importación histórica. Reactivar es una RPC con RLS en lectura, permisos de responsable/administrador, versión y operación idempotente, evento y aviso atómicos. La importación es una operación exclusiva del operador de base, no un endpoint del navegador. Su plantilla vive en `supabase/importacion`; el preparador local no accede a la red ni modifica el Excel. Configuración con IDs y SQL con datos personales quedan fuera del repositorio. Los campos históricos desconocidos son nulos; no se relajan las validaciones de alta normal de la RPC 006. Inicio consulta una proyección histórica bajo RLS y conserva resultado original y estado actual por separado. Los registros importados no se cuentan como captación del día de importación.

La migración 009 incorpora fecha de carga histórica confirmada, sin alterar la fecha de importación ni la evidencia original. Su confirmación por lote/huella es exclusiva del operador, idempotente y auditada por registro. Inicio usa `listar_cargas_mensuales`, SECURITY INVOKER bajo RLS, para combinar cargas en plataforma con fechas históricas confirmadas en Córdoba. Los registros históricos sin confirmación siguen fuera del gráfico diario. La API anterior permanece compatible; no se vuelve a importar el Excel.

## Productos y condiciones comerciales (entrega 1)

Migración 013: versiones completas e inmutables de catálogo y condiciones, con esquema JSON validado por RPC. Cada edición conserva IDs de familias/items y genera una versión nueva. Las tablas crudas son de lectura administrativa bajo RLS; no hay DML del navegador. `leer_catalogo` proyecta únicamente campos comerciales y elimina precios Telefónicos de vendedor; agente los obtiene solo al indicar una recuperación actualmente asignada. El catálogo inicial queda vacío: no se insertan tarifas de ejemplo. La baja es lógica y referencias a autor impiden borrar cuentas con historial.

La versión completa del catálogo es una unidad de publicación para evitar mezclas de kit/componentes/precios. La concurrencia es optimista y los reintentos idempotentes. Configuración permite editar plazos y permisos de congelamiento; las reglas de pago confirmadas permanecen explícitas (10 % efectivo y crédito 1/3/6), sin inventar otras. Estas lecturas no alteran ni aceptan propuestas: esa integración pertenece a la entrega 2.

## Propuestas comerciales (entrega 2)

La composición de app inyecta lecturas de Productos y Condiciones en Oportunidades, sin imports cruzados entre features. El motor puro enumera alternativas de una selección con límite explícito, precisión de nueve decimales para precios por metros y cuotas conciliadas. La propuesta conjunta suma conceptos antes de redondear; el pago mixto conserva base de efectivo, descuento, importe entregado y saldo separados. El servidor distribuye proporcionalmente el descuento aprobado entre componentes, con mayores restos y desempate estable, conservando importes exactos y netos conciliados.

Migración 014: `guardar_propuesta` reconstruye precios, compatibilidad, cantidades, bolsa, mínimo, mensualidad y congelamiento con catálogo/configuración vigentes; bloquea ficha y verifica versión. Revisiones inmutables, operación UUID idempotente y RLS. Telefónico no es visible para vendedor ni para otro agente por pertenecer a la cola común. Guardar una oferta no cierra la venta; aceptación se integra en entrega 3. No se alteran las oportunidades históricas. La recuperación operativa conserva sus acciones anteriores hasta esa integración.

## Recuperación y ciclos (entrega 3)

La entrega 3 añade una proyección de ciclos mantenida por eventos comerciales nuevos. El evento de cierre sigue siendo autoridad; referencia una propuesta inmutable y conserva atribución al responsable al cierre. No reconstruye visitas ni orígenes anteriores. Las actividades nuevas guardan ciclo al crearse, no al consultar métricas. Las RPC previas se conservan como implementaciones sin permisos públicos y las entradas públicas agregan guardas transaccionales de propuesta vigente y confirmación de nueva negociación. Corrección de pérdida: administración, mismo ciclo, motivo e historial; no es reactivación.

Mientras no exista catálogo publicado, el cierre textual anterior sigue disponible con importes desconocidos. Desde la primera versión de catálogo, ganar/derivar exige propuesta estructurada vigente; no convertir texto en importes. La última propuesta y objeciones son visibles en el caso autorizado y el agente puede preparar una revisión nueva.

## Instalación administrativa (entrega 4)

La entrega 4 añade detalle de venta e instalación mediante RPC con el mismo alcance que Ventas (administración o responsable al cierre), no el permiso amplio de participación de Prospectos. Administración escribe activación con versión/UUID, fecha y respaldo; tabla de eventos conserva cada corrección. La fecha confirmada es instalación, activación e inicio de facturación; el sistema no emite facturas. Calcula congelamiento por cada concepto con abono de la propuesta aceptada, conforme al rector 24.14. Propuestas desconocidas no reciben un plazo supuesto. La vista carga el detalle a demanda para evitar consultas por cada fila.

## Rendimiento comercial (entrega 5)

Informes deja de ser preparatorio. Dos vistas privadas componen cierres/propuestas y visitas realizadas/ciclos; no son otra fuente de escritura comercial. RPC de resumen y detalle paginado filtran en servidor por administrador o identidad propia activa. No se descargan carteras ajenas para esconderlas en React. Inicio recibe el panel mediante composición de app, sin importar internals de Informes. El adaptador de lectura tiene responsabilidad concreta; no se añaden capas de delegación sin reglas.

La cohorte de visita corresponde a la primera visita efectiva del caso/ciclo, compartida por sus participantes: cada vendedor cuenta una vez, empresa deduplica. Cierres del mes y conversión de esa cohorte son conjuntos distintos. Tickets usan importes originales netos conciliados y denominadores positivos informados. Históricos sin propuesta/ciclo conservan cantidades de ventas, no importes ni visitas supuestas. Agregados y detalle usan las mismas vistas y filtros; el corte indica fecha de consulta, no un snapshot persistente.

Inicio mantiene cuatro indicadores y pendientes visibles; captación anterior y detalle monetario propio quedan desplegables. Administración compara seis gráficos en Informes por rol y origen, con registros fuente paginados. Los totales generales no cambian por el filtro visual de rol. No se alteran el histórico, el catálogo ni las reglas contables pendientes.

## Promociones (implementación vigente)

La feature `promociones` incorpora validación pura, coordinación de carga, adaptador Supabase y presentación. Migración 011: borradores/publicaciones/archivo, audiencia por rol, eventos, avisos y reservas de adjuntos. RPC versionada con UUID de operación; publicación y avisos atómicos. Cuenta con historial o avisos no se elimina; puede desactivarse. Las tablas no admiten DML del navegador.

`supabase/storage/promociones.sql` se aplica después de 011, separado porque depende del esquema administrado de Storage. Bucket privado con límite de MIME/tamaño y políticas permisivas más guardas restrictivas acotadas al bucket. No modifica otros buckets ni sus archivos. El flujo reserva → sube → confirma explicita que Storage y PostgreSQL no comparten una transacción: los fallos quedan pendientes, se pueden confirmar o retirar lógicamente y bloquean la publicación. La confirmación comprueba metadata del objeto con privilegios controlados; el cliente no puede declarar un adjunto disponible. No se sobrescriben ni eliminan físicamente archivos desde la aplicación.

Descarga autenticada como Blob, sin URLs públicas ni previsualización ejecutable de documentos. El navegador guarda la copia solicitada; revocar acceso no elimina copias previas. La aplicación comprueba firma/MIME/extensión y el servidor restringe MIME, tamaño y extensión; no ofrece escaneo antivirus. Es necesaria una prueba real del servicio Storage, además de las pruebas SQL sobre su contrato local.

La campana es UI compartida, sin dependencia de features. `app` combina los puertos públicos de avisos comerciales y promociones, normaliza IDs/destinos y limita a 50. No hay imports cruzados entre features. Se retiran las páginas informativas de Gestiones/Próximas acciones y se redirigen sus rutas a Prospectos; no se altera el historial existente.

## Agenda y timeline

`agenda` tiene reglas puras de calendario/franjas, aplicación que valida escrituras, adaptador Supabase y presentación diaria/semanal. Administración consulta el timeline por vendedor; no declara actividad en su nombre. Puede cancelar pendientes con motivo para resolver bajas. Agente coordina exclusivamente desde Prospectos y no consulta anotaciones generales. RLS también protege eventos y consultas paginadas; la visibilidad del menú no es el control de acceso.

La migración 012 incorpora actividades, eventos inmutables y confirmaciones de lectura de recordatorios. Escrituras por RPC con versión y UUID de operación, identidad del servidor y bloqueo compartido 740127 con cuentas/asignación. No hay DML directo del navegador. Cuentas vinculadas conservan historia y cuentas con agenda pendiente deben resolverla antes de desactivarse/cambiar rol.

La integración usa un trigger transaccional sobre eventos comerciales nuevos: crear/reprogramar/reasignar una visita cancela la programación anterior pendiente y genera otra para el vendedor correspondiente, preservando actividades realizadas. No importa internals de oportunidades en JavaScript ni transforma una venta en prueba de una visita realizada. Las fechas comerciales siguen teniendo su único punto de edición en Prospectos. No se reconstruye el histórico ni se retrocargan visitas previas a la activación.

Recordatorios calculados para programaciones propias desde 30 minutos antes hasta 24 horas después; confirmación de lectura por actividad/versión. `app` agrega este puerto a la campana. Consultas cada 30 segundos y al recuperar foco, sin push externo, cron ni seguimiento en segundo plano. Una reprogramación produce una versión o actividad nueva; leer no finaliza. Errores de migración pendiente son explícitos.

Días en Córdoba, rangos semanales de siete días, intervalos sin duplicación en medianoche. La franja 08:00–17:00 es referencial. Vista ordenada, no escala de duración; actividades entre días aparecen en cada día que abarcan y no se suman como actividades distintas en métricas comerciales. No se computan horas trabajadas a partir de duración declarada. La aplicación mantiene el formulario abierto sin sobrescribirlo durante el refresco; un cambio concurrente se rechaza por versión.


## Cuotas iguales (027, 03-10-2026)

Migración 027 conserva permisos, idempotencia y revisiones históricas. Nuevas propuestas truncan el saldo por cantidad de cuotas a centavos, bonifican el resto y guardan ajuste_redondeo y descuento_efectivo por separado; descuento_pago y componentes_netos incluyen ambos para conciliar ventas e informes. El navegador aplica la misma regla. Aplicar 027 antes del frontend. La presentación compara distribuciones de adicionales entre ofertas consecutivas, incluyendo límites de página.


## Continuidad del cotizador (03-10-2026)

La bandeja presenta las negociaciones como botones en Acción; el detalle abre el cotizador antes del seguimiento. La última propuesta accesible se muestra desde el snapshot de servidor, sin recalcularla. Reutilizarla prepara una revisión nueva. El borrador automático de presentación usa localStorage separado por usuario, negociación, ciclo y contexto de permisos: solo guarda selecciones y pago, nunca precios ni datos personales. Al volver se consulta acceso y catálogo vigentes antes de reconstruir las ofertas. Un cambio de versión del catálogo o condiciones exige volver a calcular y elegir; no se recuperan precios antiguos como vigentes. No sincroniza borradores entre navegadores; guardar como propuesta ofrecida sigue siendo una acción explícita en servidor.


## Oferta presentada y derivación visible (03-10-2026)

Registrar como ofrecida conserva el contrato de guardar_propuesta: revisión inmutable con actor y fecha. El formulario exige una confirmación humana explícita luego de revisar pago; cambiar selección o importes reinicia esa confirmación. El distintivo Ofrecida se obtiene de propuestas persistidas del ciclo y versiones actuales, con selección, abono y congelamiento coincidentes. No se confunde el borrador con una oferta presentada.

La derivación usa gestionar_oportunidad existente y requiere propuesta del ciclo, objeción y plazo. Contacto preferido e información de decisión viajan en datos del evento ya auditado, sin nueva fuente de escritura. El agente ve el contexto de la última derivación del ciclo antes del cotizador. Se sugiere fecha editable a 24 horas, sin imponer un SLA ni prometer una llamada automática; el horario acordado con el prospecto prevalece. Se conservan asignación equilibrada, avisos, permisos Telefónicos y validaciones de vigencia del servidor.

El cotizador sustituye la selección pendiente al elegir otra alternativa. Tras registrar un ofrecimiento conserva en el borrador solo los selectores, las opciones calculadas y el medio de pago, sin conceptos pendientes ni confirmación humana. La referencia y el distintivo Última ofrecida provienen únicamente de la última revisión persistida del ciclo. Las revisiones previas permanecen inmutables; no se suman como ventas o como conceptos de la nueva oferta. No cambia el contrato de servidor ni requiere migración.

## Códigos internos breves (028)

Migración 028 añade codigo_interno a propuestas_comerciales, con ocho caracteres aleatorios, formato P-XXXX-XXXX, índice único, asignación serializada y rechazo de cambios posteriores. Rellena únicamente la columna nueva del histórico; detalle.codigo y todos los snapshots siguen intactos. Las lecturas del repositorio incorporan la columna bajo la RLS existente. detalle_venta conserva sus permisos y añade el código del registro aceptado a su respuesta, sin reescribirlo. La UI prioriza codigo_interno y conserva fallback para registros de lectura anteriores. Aplicar 028 antes de desplegar el frontend; no se genera ni se trunca un UUID en el navegador para simular unicidad.

## Cotizador por tareas (05-10-2026)

La presentación separa armado, ofertas y registro. Al elegir una alternativa pliega el armado y oculta las otras opciones; Cambiar oferta las recupera sin registrar un ofrecimiento. Ajustar condiciones agrupa niveles y congelamiento, con abono visible. PagoOferta traduce medios simples o combinado al contrato existente de pago: efectivo completo usa la base completa, medios sin efectivo usan cero y el combinado permite parte en efectivo. El motor y servidor conservan descuentos, cuotas y validaciones. Cambiar la configuración invalida la selección pendiente y su confirmación. Registrar venta y Derivar abren formularios existentes según accionesPermitidas; nunca cierran ni derivan automáticamente.

## Orden visual de ítems en cotizaciones (05-10-2026)

Los listados de incluidos y adicionales muestran primero los productos de la marca y después los de COMPONENTES, con orden alfabético español dentro de cada grupo. Se ordenan copias en presentación, sin modificar composición, cantidades, precios ni snapshots guardados. Para referencias históricas sin producto disponible se conserva el nombre guardado y se ordena alfabéticamente sin inventar una marca.

## Listas de adicionales ARS/USD (029)

Esquema 6 conserva precios en ARS y agrega precios_usd por componente y moneda_adicionales global. La adaptación conserva importes y deja USD vacío, sin inferir valores ni desactivar el catálogo ARS. Seleccionar USD exige los niveles completos y ordenados para todos los adicionales activos. Planes, kits y abonos permanecen en ARS. El servidor valida versiones, permisos y referencias previas; rechaza clientes de esquema anterior luego del primer guardado del esquema 6.

Aplicar 029 y desplegar la Edge Function cotizacion-dolar antes del frontend. La función verifica la sesión y perfil activo, consulta DolarAPI oficial venta con timeout de diez segundos y cache de cinco minutos. Solo service_role registra cotizaciones; el cliente nunca declara el factor autoritativo. App conecta leerParaCotizar a oportunidades. La conversión multiplica USD por la venta y redondea cada precio a seis decimales, usando BigInt en cliente y numeric en SQL; pago sigue en centavos. Cada selección envía un ID de cotización servidor, validado al guardar (consulta verificada en los últimos treinta minutos). El snapshot guarda fuente, factor y fecha; reintentos exactos e históricos no se recalculan. Calcular verifica nuevamente catálogo y dólar; una referencia distinta invalida la recuperación del borrador confirmado. Los aumentos informativos en la campana siguen siendo locales y no autorizan precios.

## Vigencia y redondeo comercial (030)

Cada propuesta ofrecida vence a las 120 horas desde creado_en. La guarda de cierre en gestionar_oportunidad_base_v17 rechaza ganar desde ese instante; durante el plazo conserva el snapshot aun si cambian versiones del catálogo o condiciones. Derivar conserva el contexto aunque esté vencido; reintentos idénticos de cierres ya registrados continúan idempotentes. El frontend muestra vencimiento y exige recalcular/registrar un ofrecimiento nuevo. El reloj del servidor es autoritativo.

Redondeo resta un importe explícito del total inicial después del descuento por efectivo y antes del ajuste automático de cuotas. El tope predeterminado es 1 % del neto después del descuento por pago y antes del ajuste automático de cuotas, sin abono. Administración lo modifica en Configuración entre 0 y 100 %, con hasta dos decimales; 0 deshabilita la rebaja manual. Se trunca el máximo a centavos y se valida también en servidor. En pago mixto rebaja primero efectivo neto y después saldo; cuotas iguales truncan centavos como antes. Se guarda redondeo_manual, separado del descuento efectivo y ajuste automático, y participa en reparto proporcional de netos. No modifica abonos ni snapshots previos. RPC guardar_propuesta_030 evita guardar desde el frontend nuevo en un backend que aún ignore la rebaja. Aplicar 030 antes del frontend.


## Packs de adicionales (031)

Esquema 7 agrega precios_pack_2 y precios_pack_2_usd opcionales por componente vendido por unidad. Son totales de dos unidades por nivel, independientes de los precios individuales. Vacío conserva tarifa individual en esa moneda; no se infieren promociones. El servidor exige decimales no negativos y no superiores a dos individuales, conservando la escala efectiva Alto/Bajo/Telefónico.

Cliente y servidor agrupan unidades pagadas por producto y nivel: floor(cantidad/2) packs más cantidad%2 individuales. Incluidos y bonificados no forman packs. El piso usa el precio Bajo por cantidad; el consumo de la bolsa de bonificación sigue a Bajo individual. USD convierte cada total de pack a ARS con seis decimales, limitado a dos individuales convertidos para evitar un encarecimiento microscópico por redondeo. La selección solo declara cantidades; el servidor recalcula y guarda packs, precios aplicados y ahorro en el snapshot. Las revisiones anteriores permanecen inmutables.

Aplicar 031 antes del frontend. guardar_catalogo_031 exige esquema 7; las escrituras antiguas se rechazan después de publicarlo, conservando reintentos idempotentes. La lectura por rol mantiene las restricciones de planes y abonos. No cambia la Edge Function ni publica precios automáticamente.


## Base compartida y primera oferta (032, 06-10-2026)

Prospectos es una base común para todos los usuarios activos: pueden consultar y editar sus datos, sin asignación de dueño. El servidor conserva creado_por y creado_en y registra actor, fecha, valores anteriores y nuevos de cada edición; la concurrencia se controla por versión. La columna responsable_id del contacto queda solo por compatibilidad histórica, no autoriza ni asigna seguimiento. Los nuevos contactos se crean sin responsable. La presentación muestra Cargado por y permite filtrar por autor; el directorio mínimo no expone correos ni modifica la RLS de perfiles.

La cotización en preparación nace compartida, sin vendedor ni responsable. Calcular o seleccionar alternativas no la asigna. Registrar la primera oferta como ofrecida asigna automáticamente el seguimiento al vendedor actor, dentro de la misma transacción que valida y guarda la propuesta. Administración puede registrar en nombre de un vendedor activo elegido expresamente; el agente conserva el ofrecimiento de Recuperación, no se autoasigna preparaciones. Un error de precios/pago revierte la asignación; el bloqueo, versión e idempotencia impiden apropiaciones simultáneas. Las siguientes ofertas conservan el responsable salvo reasignación administrativa del circuito vigente.

032 marca como compartidas las preparaciones anteriores sin propuestas, eventos posteriores al inicio, agenda ni procedencia histórica. Conserva las columnas previas como evidencia de compatibilidad y los eventos originales, sin atribuirles seguimiento mientras estén compartidas. Negociaciones con actividad u ofertas previas, recuperaciones y cierres conservan sus responsables y permisos. La primera oferta deja un evento primera_oferta_asignada con referencia a la propuesta. La coordinación posterior de visita utiliza al vendedor del ofrecimiento sin dar por realizada ninguna visita.

La bandeja comparte solo el contexto básico de otras negociaciones (necesidad, estado y responsable) para evitar duplicados; el acceso a propuestas, precios e historial comercial mantiene su RLS. Una negociación distinta sigue requiriendo confirmar otra necesidad. Todos conservan la edición del contacto aun después del ofrecimiento. Se bloquean gestiones y la creación directa antigua de visitas antes de la primera oferta, manteniendo reintentos históricos. La anulación de una preparación propia sin actividad sigue permitida. Captación se atribuye al autor de carga; las importaciones históricas conservan su atribución original.

Aplicar 032 antes del frontend. RPC de entrada versionadas evitan usar el nuevo flujo contra el servidor anterior. No modifica cotizaciones ofrecidas, importes, autoría ni cierres históricos.

## Eliminación de prospectos (033)

registros-iniciales incorpora eliminar como puerto de aplicación/repositorio. La RPC eliminar_prospecto_033 exige administrador activo, versión y motivo, y realiza baja lógica auditada sin cascadas. Bloquea contactos con identidad comercial o procedencia histórica/demo; usa el mismo bloqueo comercial y bloqueo de fila que iniciar_cotizacion. Una política restrictiva excluye bajas de todas las lecturas de contactos y se conservan eventos consultables por administración. Trigger impide editar bajas; iniciar_cotizacion rechaza contactos eliminados incluso mediante RPC anteriores. Crear y editar conservan permisos compartidos. UI utiliza diálogo nativo, motivo, error visible y papelera accesible con tooltip en listado y detalle. Aplicar migración antes de publicar.

## Eliminación con antecedentes (034)

eliminar_prospecto_034 amplía el contrato de 033, manteniendo su autorización, versión, bloqueo e idempotencia. Permite vínculos comerciales e importaciones; llama anular_cotizacion para casos abiertos y cancela sus actividades manuales pendientes auditándolas. Reutiliza cancelación de visitas, eventos, notificaciones y guardas existentes. Todo ocurre en la transacción de baja del contacto; ventas/pérdidas/anulaciones anteriores y propuestas permanecen intactas. La UI explicita los efectos y usa exclusivamente 034. 033 conserva la restricción anterior para clientes que no muestran esa confirmación. Prueba integrada verifica rollback total, reintentos, agenda, conservación de propuestas/cierres y visibilidad de ventas. Aplicar 034 antes del frontend.

## Oferta inicial única, temporal (07-10-2026)

PropuestaComercial presenta solo alternativas.slice(0,1), sin paginación, también al recuperar borradores. El motor y contrato de guardado siguen intactos; conserva las propuestas ya elegidas o registradas y su historial. El botón indica Calcular oferta. No requiere migración de base de datos.

Textos de propuesta única (07-10-2026): se retira el resumen redundante de abono del armado, se usa Calcular y el título del plan/kit sin ordinal visible. La acción Revisar pago y registrar ofrecimiento conserva el flujo existente de pago y confirmación humana. No modifica cálculo, IDs, ofrecimientos ni cierre de venta.


## Distribución manual de adicionales (07-10-2026)

El armado permite cantidades a Bajo, bonificadas y, con permiso y nivel correspondiente, Telefónico. Alto es el remanente del total. generarAlternativas recibe distribucionManual y calcula una sola composición sin enumerar combinaciones. Valida cantidades, suma, permisos, bolsa y piso; no reemplaza silenciosamente una selección inválida. Conserva el motor enumerador para consumidores anteriores. Borradores y reutilización conservan distribución; kits de venta mantienen Telefónico. El servidor ya recalcula estas cantidades y valida restricciones con el contrato vigente; no requiere migración. Packs se aplican solo a unidades pagadas del mismo nivel.


### Selección por unidad de adicional (07-10-2026)

Sustituye la distribución por contadores: cada unidad seleccionada tiene una fila numerada y un desplegable con Bonificado, Alto y Bajo con importes unitarios en pesos; Telefónico conserva sus permisos. Al aumentar cantidad se agregan unidades a Alto; al reducir se retiran las últimas. Los borradores conservan el orden de selecciones y se agregan cantidades por tarifa para el contrato de cálculo y guardado existente. Las distribuciones antiguas inconsistentes exigen revisar cada unidad, sin mostrar remanentes negativos. Los packs se aplican al calcular por unidades de la misma tarifa; bolsa, piso y servidor mantienen sus validaciones.


### Disponibilidad dinámica por unidad (07-10-2026)

Cada opción de cada adicional se evalúa con toda la selección mediante el mismo motor de cálculo manual, incluyendo bolsa, piso, packs y permisos. Se deshabilitan las opciones incompatibles con la composición actual; liberar margen las habilita nuevamente. La posición de la unidad no determina prioridad. Cambios de cantidad, plan, nivel, condición o catálogo recalculan disponibilidad. Un borrador inválido muestra aviso y permite pasar unidades a Alto para repararlo progresivamente, sin modificar otras selecciones ni omitir la validación final del motor y del servidor. Se reutilizan resultados para unidades equivalentes del mismo producto y condición durante cada render. No requiere migración.


Las unidades nuevas y las agregadas al aumentar cantidad comienzan sin condición seleccionada. Se exige completar todas antes de calcular. Para evaluar disponibilidad durante el armado, las pendientes se consideran provisionalmente a Alto, sin guardar ni mostrar esa tarifa como elegida; se revalida toda la composición en cada selección. Las elecciones anteriores válidas se conservan al recuperar borradores. Esta regla sustituye el valor inicial Alto de la sección anterior.
