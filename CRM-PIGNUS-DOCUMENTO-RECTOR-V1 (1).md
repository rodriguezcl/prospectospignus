# Prospectos Pignus — Documento rector V1.6

**Fecha de consolidación:** 1 de octubre de 2026

**Control de alcance V1.6:** la sección 24 consolida los acuerdos comerciales aprobados para desarrollo futuro. No declara esas funciones implementadas ni autoriza migraciones, commit, push o despliegue. Ante diferencias sobre precios, conversión, ciclos y activación, prevalece la sección 24 sobre los criterios iniciales. Las secciones anteriores conservan contexto e historia de entregas. Plan asociado: [implementación por módulos](docs/PLAN-COMERCIAL-V1.6.md).

**Estado:** especificación de producto autónomo para análisis y desarrollo.  
**Idioma del documento y del producto:** español en pantallas, estados, mensajes, ayuda, informes, especificaciones, nombres de dominio e identificadores nuevos de código y datos. Se permiten únicamente nombres propios, direcciones de fuentes y convenciones técnicas externas que no controla el proyecto (por ejemplo, el identificador oficial de zona horaria).  
**Propósito:** construir desde cero **Prospectos Pignus**, sistema de prospección y desarrollo de oportunidades de venta por vendedor, diseñado a partir de necesidades del equipo comercial y de patrones documentados de EspoCRM.

## 1. Principios del producto

1. **Prospectos Pignus es un proyecto propio y autónomo**, con identidad, datos, permisos, métricas y ciclo de vida definidos en este documento.
2. Su alcance es la captación de registros iniciales, calificación de Prospectos, desarrollo de Oportunidades y evaluación del desempeño comercial del equipo.
3. Los criterios de negocio son: aislamiento por cartera, atribución de creador y responsable, origen de los registros iniciales, deduplicación, responsable principal único, gestiones verificables, seguimiento, pérdidas justificadas e historial auditable.
4. EspoCRM es referencia funcional y técnica, no dependencia, plantilla de código ni autorización para copiar su implementación. Catálogos y umbrales propuestos son configurables.
5. Ganada es un resultado comercial declarado, no prueba de cobro o instalación. La ampliación aprobada permite registrar administrativamente la instalación efectiva/activación y el inicio del congelamiento, sin gestionar ejecución técnica, cobranza ni facturación (sección 24).
6. **Simpleza con criterio:** cada pantalla debe ayudar a entender, decidir o actuar. Se eliminan textos decorativos, repeticiones y módulos redundantes, pero nunca información necesaria para trabajar, advertencias relevantes ni trazabilidad. La simpleza se evalúa por claridad y esfuerzo de uso, no solamente por cantidad de elementos. Vendedores y agentes deben poder encontrar sus tareas, cargar información y retomar gestiones con pocos pasos, especialmente desde el celular; una vista gerencial resumida no debe imponerles una experiencia incompleta. Detalles y explicaciones secundarias se despliegan a demanda, sin esconder acciones frecuentes, errores o permisos. Colores semánticos consistentes, cantidades y etiquetas legibles en ambos temas; el color nunca será la única forma de interpretar un estado.

## 2. Hallazgos útiles de EspoCRM y límites

| Patrón documentado | Aplicación en Pignus | Límite de la comparación |
| --- | --- | --- |
| En EspoCRM, un contacto potencial puede convertirse en cuenta, contacto u oportunidad y conserva sus vínculos | Conservar identidad e historial al calificar un registro inicial | Pignus distingue registro inicial, Prospecto y Oportunidad; no crear una entidad Cliente por esta conversión |
| Oportunidades con etapas configurables, tablero por columnas y cierres ganados o perdidos | Proceso comercial claro con fecha de transición y responsable | El cierre registra un resultado comercial declarado y validado por reglas del servidor |
| Llamadas, reuniones, tareas y panel de actividades | Gestiones y próxima acción visibles por vendedor | Registrar una nota no equivale a un contacto efectivo |
| Funciones con acceso a registros propios, del equipo o generales; permisos por campo | Aislar cartera desde el servidor y limitar datos sensibles | En EspoCRM, combinar roles puede ampliar permisos; diseñar pruebas específicas de aislamiento |
| Paneles básicos de ventas | Panel de supervisión sencillo | Los reportes configurables de EspoCRM pertenecen al paquete avanzado de EspoCRM; Pignus implementará sus propias métricas |
| Las reglas automáticas de EspoCRM permiten distribuir contactos potenciales | Asignación por turnos con auditoría y concurrencia | Esas herramientas figuran en el paquete avanzado de EspoCRM; nuestra regla es independiente |
| Administrador de entidades, campos, relaciones, interfaz de programación y control de cambios simultáneos | Modelo explícito, interfaz de programación estable y edición segura | No copiar componentes internos; adoptar patrones solo cuando resuelvan un requisito |

**Fuentes oficiales revisadas:** [Gestión comercial](https://docs.espocrm.com/user-guide/sales-management/), [Actividades y calendario](https://docs.espocrm.com/user-guide/activities-and-calendar/), [Funciones y permisos](https://docs.espocrm.com/administration/roles-management/), [Tableros](https://docs.espocrm.com/administration/dashboards/), [Informes](https://docs.espocrm.com/user-guide/reports/), [Administrador de entidades](https://docs.espocrm.com/administration/entity-manager/), [Captación desde formularios](https://docs.espocrm.com/administration/web-to-lead/), [Control de cambios simultáneos](https://docs.espocrm.com/user-guide/optimistic-concurrency-control/), [Interfaz de programación](https://docs.espocrm.com/development/api/), [repositorio oficial](https://github.com/espocrm/espocrm). Consulta: 28-09-2026. Las inferencias y las reglas de Pignus de este documento son propuestas propias, no afirmaciones sobre EspoCRM.

## 3. Preguntas que el producto debe responder

- ¿Cuántos registros iniciales registró **cada vendedor** hoy, por semana y por mes? Distinguir quién los cargó de quien quedó como responsable.
- ¿Cuántos se calificaron como Prospectos, cuántos originaron Oportunidades y en qué etapa están?
- ¿Cuál fue el último contacto efectivo? ¿Qué acción quedó comprometida y cuándo vence?
- ¿Cuántos registros iniciales se descartaron y cuántas Oportunidades se perdieron, en qué etapa, por qué motivo y a quién estaban asignados al cerrarse?
- ¿Cuántas Oportunidades se ganaron comercialmente por vendedor y por período?
- ¿Qué proporción de la cohorte captada en un mes se ganó a los 30, 60 y 90 días y cuántos siguen abiertos?
- ¿Qué vendedores, orígenes, zonas y motivos requieren atención, sin incentivar la carga de registros vacíos o duplicados?

La gerencia debe poder abrir cada cifra y ver el conjunto de registros que la produjo, con permisos y filtros coherentes.

## 4. Alcance y límites

**Primera entrega funcional:** usuarios y funciones de acceso; registros iniciales creados manualmente o captados por canales identificados; creador y responsable; asignación; calificación a Prospecto; Oportunidades; gestiones y próxima acción; etapas; resultado Ganada y Perdida con motivo y trazabilidad; auditoría; tableros y exportación autorizada. Todas estas capacidades funcionan dentro de Prospectos Pignus.

**Evolución posible dentro del producto:** jornadas comerciales puerta a puerta, campañas, formularios de captación, referencia o adjunto de propuestas comerciales, objetivos y paneles avanzados. Una visita comercial puede registrarse como gestión; las actividades de campo incluidas en este documento son exclusivamente comerciales.

**Ampliación aprobada, pendiente de implementación:** catálogo comercial, kits, propuestas y motor de alternativas/precios; métricas por ciclos visitados; registro administrativo de activación. Alcance preciso en sección 24.

**Fuera de alcance:** alta y administración de Clientes operativos; contratos, firmas y autorizaciones contractuales; coordinación y ejecución técnicas; relevamientos técnicos operativos; reservas; inventario; cobranza; emisión de facturas; comisiones; envío automático de WhatsApp; geolocalización continua o vigilancia del personal. No se automatizan IPC ni primera factura mientras sus reglas permanezcan pendientes. Ninguno de esos procesos es requisito para cerrar una Oportunidad.

## 5. Lenguaje común y entidades

| Entidad | Significado y vínculo mínimo |
| --- | --- |
| Usuario | Identidad autenticada; puede tener funciones de acceso múltiples y estado de elegibilidad para recibir registros iniciales |
| Registro inicial | Ingreso no calificado; origen, fecha, creador y responsable asignado o Sin asignar |
| Prospecto | Registro inicial contactado y calificado con posibilidad comercial real; conserva `id_registro_inicial` e identidad propia |
| Identidad prospectada | Nombre de persona o empresa y datos de contacto necesarios para el seguimiento; no crea un Cliente operativo |
| Ubicación comercial | Dirección o zona de interés para la oportunidad, cuando se conoce; no crea un domicilio operativo |
| Oportunidad | Necesidad comercial concreta de un Prospecto; tiene responsable, etapa, posible ubicación e historial |
| Gestión | Interacción o intento registrado: llamada, WhatsApp, visita, reunión, correo electrónico, tarea, nota; resultado y fecha |
| Próxima acción | Compromiso de seguimiento con dueño, plazo, estado y relación a registro inicial/Prospecto/Oportunidad |
| Evento de etapa | Transición inmutable con estado previo/nuevo, fecha, actor, motivo y versión |
| Pérdida | Evento de cierre perdido con motivo normalizado, etapa al perder y observación opcional |
| Reasignación | Cambio autorizado de responsable; conserva responsable anterior y siguiente |
| Resultado comercial | Ganada, Perdida o reactivación; indica desenlace de prospección, no situación contractual u operativa |
| Auditoría | Rastro inmutable de cambios relevantes, diferente de la nota libre del vendedor |

**Relaciones esenciales:** registro inicial 0..1 Prospecto; Prospecto 0..N Oportunidades; Oportunidad 0..N Gestiones y eventos de etapa; cada Oportunidad abierta tiene exactamente un Responsable Comercial Principal. Una visita puerta a puerta puede no producir un registro inicial. Una Oportunidad perdida reactivada conserva su cierre anterior y genera un nuevo ciclo medible; una necesidad sustancialmente nueva exige otra Oportunidad.

Los nombres conceptuales no obligan a nombres físicos específicos; diseñar el modelo de datos del proyecto nuevo según estas invariantes.

## 6. Captación, calificación y asignación

1. Al crear un registro inicial registrar `creado_en` del servidor, `creado_por`, `origen`, identificador estable e identificador externo y clave para evitar duplicados por reintentos si proviene de importación. Si lo crea un vendedor para sí, `creado_por` y responsable inicial coinciden; en entradas centrales pueden diferir.
2. Datos mínimos para convertirlo a Prospecto: nombre o razón social, teléfono, dirección, primer contacto y evaluación de posibilidad real. Un registro inicial preliminar puede tener datos incompletos; el tablero de carga separa **brutos** y **válidos**, con reglas visibles. Evitar métricas que recompensen duplicados o fichas vacías.
3. Primer contacto significa interacción efectiva con respuesta humana; intento sin respuesta se registra como gestión, pero no califica automáticamente el registro inicial. Un registro inicial puede cerrarse como descartado sin volverse Prospecto, con motivo propio y sin contarse como Oportunidad Perdida.
4. Los registros iniciales de la bandeja común se distribuyen por turnos entre vendedores activos, disponibles y habilitados. Si no hay elegibles, quedan Sin asignar con alerta. Una asignación manual posterior prevalece. La selección y actualización son atómicas y auditadas.
5. Coincidencias por teléfono, nombre y ubicación advierten posible duplicado y se revisan sin bloquear automáticamente la prospección; una coincidencia de otra cartera no revela la ficha completa al vendedor.
6. Registrar origen con valores configurables: puerta a puerta, WhatsApp, llamada, sitio web, Instagram, Facebook, oficina, referido, campaña, cliente existente y otro. No sobrescribir el origen histórico al cambiar la atribución comercial.

## 7. Proceso comercial y resultados de prospección

Proceso comercial base de la **Oportunidad**: `Nuevo → Contactado → Necesidad identificada → Propuesta presentada → Seguimiento / Negociación → Ganada / Perdida`. Se permiten saltos justificados y cada transición crea evento. registro inicial, Prospecto y Oportunidad son conceptos distintos. Las etapas describen avance de la **gestión del vendedor**, no procesos contractuales, de coordinación o técnicos. La propuesta puede ser un documento generado fuera del sistema; aquí basta referencia y fecha de presentación.

- **Ganada:** el prospecto confirma al vendedor que acepta la propuesta o desea avanzar con la contratación. Registrar canal de confirmación (llamada, WhatsApp, correo electrónico, presencial u otro), fecha, resumen y actor; adjuntar referencia si existe. Es un **resultado de la oportunidad comercial**, declarado por el vendedor y sujeto a revisión gerencial, sin verificar firma ni cobro. Una propuesta solamente enviada no basta.
- **Perdida:** motivo obligatorio del catálogo configurable: precio; eligió competencia; no interesado; no responde; fuera de zona; no cumple requisitos; decisión postergada; otro. `Otro` exige explicación. `No responde` exige intentos documentados y plazo configurables. Conservar etapa previa, responsable y fecha del servidor.
- **Corrección:** si una declaración de Ganada/Perdida fue errónea, el supervisor puede corregirla con motivo y auditoría; el evento original permanece. La corrección se refleja en indicadores con fecha de corte clara.
- **Reactivación:** una necesidad sustancialmente idéntica puede iniciar otro ciclo de una Oportunidad Perdida, conservando `id_ciclo` y motivo originales. Una nueva necesidad o ubicación requiere otra Oportunidad. No duplicar una Ganada por reabrir la ficha.

El servidor valida estados, motivos y permisos. El tablero no presenta Ganada como venta contratada, facturada, instalada o activa.

## 8. Gestiones y disciplina comercial

Una Gestión registra tipo, resultado, fecha efectiva, fecha de registro, actor, responsable al momento y entidad vinculada. Tipos iniciales: llamada, WhatsApp, visita, reunión, correo electrónico, nota y tarea. Resultados: contacto efectivo, sin respuesta, cita acordada, información enviada, seguimiento pendiente y otro. Las notas internas y tareas administrativas no cuentan como contacto efectivo; una importación retrospectiva se etiqueta para distinguirla de actividad capturada en tiempo real.

Próxima acción: plazo, responsable y estado (`pendiente`, `realizada`, `cancelada`), con evento de finalización. Toda Oportunidad abierta deberá tener próxima acción o excepción justificada (configurable para primer ingreso). Alertas mínimas por seguimiento vencido desde que esta función exista. Mostrar lista diaria, últimos contactos y antigüedad sin gestión; no permitir que editar una descripción reinicie el reloj de actividad.

**Correcciones:** no borrar ni sobrescribir gestiones cerradas sin rastro. Una corrección registra autor, motivo, fecha y relación al evento anterior. Acciones retroactivas se identifican para no manipular indicadores.

## 9. Permisos y privacidad

| Capacidad | Vendedor | Supervisor comercial | Gerencia | Administrador del sistema |
| --- | --- | --- | --- | --- |
| Ver oportunidades | Propias y excepciones puntuales | Equipo autorizado | Global según política | Para soporte autorizado |
| Crear registro inicial y Gestión | Propios | Según alcance | Según alcance | Según alcance |
| Avanzar etapa y declarar resultado | Propias, con reglas | Corregir con auditoría | Consultar | Configurar reglas, sin atribuirse resultados |
| Reasignar cartera | Solicitar | Aprobar según política | Según política | Ejecutar cambios autorizados |
| Métricas | Propias | Equipo | Global | Solo si se autoriza |
| Exportar datos personales | No por defecto | Autorización explícita | Autorización explícita | Autorización explícita |

Aplicar controles en **cada punto de acceso, consulta y evento**, y seguridad por filas cuando corresponda. Varias funciones de acceso no deben ampliar accidentalmente cartera o acceso a campos. Las excepciones por Oportunidad no dan acceso a toda la cartera anterior. Consultas de duplicados, búsquedas, agregados y exportaciones deben respetar aislamiento. Registrar accesos/descargas sensibles cuando sea pertinente.

## 10. Modelo de eventos y consistencia

Cada cambio crítico añade evento con `id_evento`, `id_registro`, `id_ciclo` cuando aplique, tipo, `ocurrido_en` según el reloj del servidor, expresado en tiempo universal coordinado, `registrado_en`, actor, responsable antes/después, `anterior/nuevo`, motivo, `id_correlacion`, fuente y versión de esquema. Mantener estado actual como proyección para lectura; usar eventos para reconstruir cierres, atribuciones y métricas. No usar notas editables como fuente contable.

Transacciones atómicas para la asignación por turnos, el cambio de responsable y el cierre. Cada reintento de captura debe conservar la clave de operación para evitar duplicados. Control de versión en edición simultánea: ante conflicto, rechazar con estado actual y permitir resolverlo; jamás sobrescribir silenciosamente. Índices y restricciones para claves de reintento único y búsqueda de posibles duplicados. Reintentos de captura o guardado deben producir una sola consecuencia; los errores quedan visibles y recuperables para usuarios autorizados.

**Autonomía de datos:** Prospectos Pignus crea y gobierna sus propios registros y eventos. Los adjuntos conservan permisos propios; no sustituyen las propuestas estructuradas y versionadas previstas en sección 24.

## 11. Métricas: contrato semántico

**Zona horaria de negocio:** `America/Argentina/Cordoba`. Guardar fechas y horas en tiempo universal coordinado; filtrar días y meses por límites locales `[inicio, fin)`. Nunca agrupar por zona horaria del navegador. Los filtros básicos son rango, vendedor, equipo, origen, zona y estado; toda tarjeta abre su detalle y exporta solo con permiso.

| Indicador | Numerador / regla | Denominador / atribución |
| --- | --- | --- |
| Registros iniciales cargados por día | Registros iniciales creados en el día, incluso si se reasignan | Atribuir a `creado_por`; excluir duplicados anulados de la vista **válidos** sin borrar el bruto |
| Prospectos calificados | registros iniciales convertidos a Prospecto durante período | Atribuir responsable al momento del evento; mantener creador como dimensión independiente |
| Oportunidades creadas | Primer ciclo creado en período | Una por necesidad concreta; no contar visitas ni gestiones |
| Ganadas del período | Primer resultado Ganada declarado y vigente ocurrido en período | Atribuir responsable **al cierre**; una vez por ciclo de oportunidad |
| Perdidas del período | Eventos de cierre perdido del período, separados por ciclo | Atribuir responsable al cierre y etapa previa; no incluir registros iniciales descartados |
| Conversión de cohorte de Oportunidades | Cohorte de Oportunidades creada en período que alcanzó el cierre Ganada hasta fecha de corte | Todas las Oportunidades de la cohorte, incluidas abiertas; mostrar corte y maduración |
| Tasa de cierre ganado | Ganadas del período | Ganadas + Perdidas del período (solo cierres); nunca llamarla conversión de cohorte |
| Conversión de captación | Registros iniciales válidos captados en la cohorte que originaron alguna Oportunidad Ganada hasta corte | Registros iniciales válidos de la cohorte; deduplicar por registro inicial incluso si hay varias Oportunidades |
| Pérdidas por motivo | Cierres perdidos del período/ciclo con cada motivo | Todos los cierres perdidos del mismo conjunto; categoría desconocida solo para datos migrados |
| Sin primera gestión | Registros iniciales sin contacto efectivo | Registros iniciales creados y asignados, con tiempo desde asignación |
| Seguimientos vencidos | Acciones pendientes cuyo plazo es anterior a ahora | Contar acciones y registros distintos por separado |
| Inactividad | Oportunidades abiertas sin contacto efectivo durante `cantidad_de_dias` días | `cantidad_de_dias` configurable (inicial sugerido: 5 días); distinguir nunca contactadas |
| Tiempo a primera gestión | Instante de primer contacto efectivo menos asignación | Mediana y percentiles, excluyendo aún no contactados pero mostrando su cantidad |
| Tiempo hasta cierre | Hito de cierre menos creación de Oportunidad | Separar ganadas y perdidas; mediana además de promedio |
| Correcciones de resultado | Cierres corregidos durante el período | Mostrar resultado original y vigente; explicar el ajuste sin borrar historia |

**Reglas de reporte:** `Ganadas / registros iniciales captados en el mismo mes` no es una tasa de conversión válida cuando las cohortes difieren. Mostrar simultáneamente **actividad del mes**, **cierres del mes** y **conversión por cohorte con corte a los 30, 60 y 90 días**. Para cohorte reciente, indicar `en curso` y no comparar como definitiva con una cohorte madura. En vistas por vendedor distinguir atribución de captación (`creado_por`), dueño al momento de calificar y dueño al cierre; reasignaciones no reescriben resultados históricos. Filtros combinados se aplican con definiciones estables y constan en la exportación. Si denominador es cero, mostrar `—`, no 0%.

**Ejemplo inventado para verificar fórmulas, no dato real:** en septiembre se captan 100 registros iniciales válidos, nacen 60 Oportunidades, se cierran 12 ganadas y 18 perdidas (sin importar su mes de creación). Tasa de cierre ganado de septiembre = `12/(12+18)=40%`. La conversión de la cohorte de 60 Oportunidades de septiembre se calcula mirando **solo esas 60** a una fecha de corte; no se puede deducir del 40%.

## 12. Interfaces mínimas

**Vendedor, móvil:** crear registro inicial en pocos pasos, detectar coincidencia sin revelar otra cartera, ver cartera y acciones de hoy, registrar gestión con resultado y próxima acción, ver proceso comercial e historial, solicitar reasignación y corregir un resultado según permisos. Mostrar estado de sincronización y evitar doble envío.

**Supervisor y gerente, escritorio:** tablero con filtros y fecha de corte, carga diaria por creador, embudo por cohortes, evolución por vendedor, motivos de pérdida, cartera sin contacto y seguimientos vencidos; cada indicador abre lista verificable. Comparar equipos teniendo en cuenta volumen y antigüedad de cohortes. Permitir anotaciones de decisiones gerenciales fuera de los eventos de negocio.

**Supervisor:** bandeja Sin asignar, revisión de posibles duplicados, reasignaciones, correcciones justificadas e historial de auditoría. Las funciones visibles son orientativas; el servidor determina los permisos.

## 13. Criterios de aceptación prioritarios

1. **Carga diaria:** un registro inicial creado por A a las 23:55 de Córdoba aparece en el día local correcto; si luego se asigna a B, la carga de A no cambia.
2. **Brutos y válidos:** un registro inicial incompleto cuenta en bruto, no en captación válida; completarlo no altera su fecha original.
3. **Calificación:** un intento sin respuesta no crea Prospecto. Contacto efectivo, posibilidad real y datos mínimos sí permiten calificar conservando el registro inicial.
4. **Pérdida:** no se cierra una Oportunidad sin motivo; `Otro` exige detalle. Quedan etapa y responsable al cierre.
5. **Ganada:** propuesta enviada sin respuesta no gana. Confirmación del prospecto registrada con canal y resumen sí cierra la oportunidad una sola vez; no exige contrato.
6. **Autonomía:** crear, gestionar, ganar, perder y reportar funciona con datos y reglas propios del producto.
7. **Corrección:** un resultado corregido conserva el evento original, registra actor/motivo y ajusta la vista vigente sin reescribir historia.
8. **Cohorte:** cierres en octubre de Oportunidades creadas en septiembre actualizan la cohorte septiembre, no el denominador de octubre.
9. **Reasignación:** cambia la bandeja actual; creador, dueño histórico y dueño al cierre se conservan.
10. **Privacidad:** A no accede a ficha, teléfono, gestiones, adjuntos ni búsquedas de B; posible duplicado solo informa coincidencia y vía de revisión.
11. **Concurrencia:** dos altas con igual clave de reintento único producen una; asignadores simultáneos no dejan doble dueño; ediciones conflictivas no se pisan.
12. **Auditoría:** cierre, motivo, corrección y reasignación guardan actor, fecha y evidencia sin borrado ordinario.
13. **Tablero:** cada cifra coincide con su detalle según rango, zona, atribución y permisos; denominador cero muestra `—`.
14. **Independencia semántica:** Ganada informa aceptación comercial declarada; no declara contrato, cobro, instalación, activación, reserva técnica ni facturación.

## 14. Entrega incremental

**Paso 0 — diseño del proyecto nuevo:** esquema conceptual, modelo de eventos, contrato de métricas, autorización, experiencia de uso de vendedores y tablero gerencial. Usar este documento como especificación y EspoCRM como referencia de patrones.

**Paso 1 — núcleo comercial:** identidad y permisos, registro inicial, asignación, Prospecto, Oportunidad, gestiones, próxima acción, resultado ganado/perdido, auditoría. Verificar privacidad y concurrencia.

**Paso 2 — métricas gerenciales:** cohortes, atribuciones, motivos, alertas y detalle de cada número. Validar cierres cruzados entre meses con datos sintéticos.

**Paso 3 — evolución autónoma:** captación multicanal, campañas, jornadas comerciales, objetivos, adjuntos y reportes avanzados según necesidades reales.

**Puerta de salida del diseño:** entregar arquitectura propuesta de Prospectos Pignus, esquema, interfaz de programación, matriz de permisos, diccionario de métricas y plan verificable. Registrar decisiones abiertas sin bloquear las funcionalidades autónomas.

## 15. Instrucción reutilizable para Codex

> Diseñá Prospectos Pignus como proyecto nuevo. Usá exclusivamente este documento para sus reglas de negocio y la documentación oficial de EspoCRM como referencia de patrones. No reproduzcas código de EspoCRM. Entregá primero arquitectura propuesta, modelo de datos y eventos, flujo de experiencia de uso, permisos, fórmulas de métricas, decisiones pendientes y plan incremental con verificaciones de privacidad y concurrencia. Ganada es una confirmación comercial registrada por el vendedor y auditable por su supervisor; el producto no implementa contratos ni procesos posteriores de entrega o ejecución.

## 16. Decisiones pendientes de validación gerencial

- Campos mínimos para registrar la confirmación de Ganada y política de revisión de resultados declarados por vendedores.
- Definición de registro inicial válido y objetivos diarios, tratamiento de duplicados y cargas originadas por administración.
- Plazo e intentos mínimos para `No responde`, período de alerta y política de próxima acción.
- Alcance de Supervisor, Gerencia y administrador del sistema; permisos de exportación y retención de datos comerciales.
- Si se incorporan importaciones históricas, cómo representar fechas, responsables y motivos desconocidos sin fabricar datos.

## 17. Criterio confirmado: Agente, visita y recuperación (30-09-2026)

El rol Agente recibe contactos, califica registros y coordina visitas con vendedores activos. El vendedor también puede captar y calificar registros propios. La calificación exige respuesta humana, teléfono, dirección y posibilidad comercial concreta; conserva el registro original y crea un Prospecto con identidad propia.

Una oportunidad tiene un responsable actual y conserva captador, vendedor de visita y responsable del cierre. El vendedor registra el resultado de la visita, las condiciones finales ofrecidas y las objeciones: no se exige registrar ofertas A/B/C ni una cantidad de ofertas. Las bonificaciones y negociaciones presenciales son parte de su modalidad comercial.

Derivar a recuperación conserva la misma oportunidad abierta. Se asigna al agente activo y disponible con menos recuperaciones pendientes, con desempate aleatorio. La disponibilidad se declara explícitamente; no significa conexión al navegador. Si no hay agentes operativos, queda en la bandeja común pendiente de asignación, excepción controlada al responsable obligatorio. Agentes y administración ven esa bandeja y pueden solicitar distribución; no pueden apropiarse de casos asignados a otro agente. Administración puede reasignar con motivo.

El agente registra una propuesta final y el resultado: aceptación comercial (Ganada), rechazo final justificado (Perdida) o seguimiento con fecha. Una visita no realizada se reprograma; ausencia de respuesta no implica pérdida. No se habilita pérdida por «no responde» hasta definir sus umbrales. Las pérdidas irreversibles anteriores a recuperación requieren justificación. Ganada exige canal, fecha y resumen de aceptación; no significa instalación realizada ni incorpora gestión operativa.

Las notificaciones internas persistentes avisan de asignación de visita y recuperación. Marcar leída no resuelve la oportunidad. Estado, responsable, historial y notificación se guardan juntos con versión y clave de reintento. No se promete aviso externo ni con el navegador cerrado.

Agente no administra cuentas ni consulta indiscriminadamente carteras de vendedores. Accede a oportunidades propias y a la cola de recuperación; el vendedor participante conserva acceso de lectura a su oportunidad después de derivarla. Los indicadores de cierres cuentan una oportunidad una vez y distinguen captación, visita y cierre. Las cuentas con responsabilidad abierta no pueden cambiar de rol ni desactivarse hasta reasignar sus casos. El administrador actual cumple la supervisión comercial autorizada, sin crear roles adicionales en esta entrega.

## 18. Histórico de septiembre de 2026 y reactivación

La nómina corregida contiene 950 oportunidades comerciales reales, asignadas a Gonzalo Rivadero (317), Martin Oliva (317) y Franco Suarez (316). Las 29 ganadas están identificadas individualmente en el Excel (10, 11 y 8 respectivamente). Administración indicó clasificar las otras 921 como Perdidas para este mes. No es un lote de demostración ni se asignan resultados aleatorios. Esa clasificación no acredita un rechazo individual ni una propuesta final del agente; el motivo se conserva como no informado histórico.

El mes de actividad es septiembre; los días y horarios de la planilla están declarados como distribución estimada. Se conserva esa procedencia sin inventar visitas, fecha exacta de aceptación, captador, canal ni condiciones. La fecha de registro del servidor representa la importación. El resumen histórico mensual se separa de la captación diaria en vivo. La carga guarda huella del archivo, clave del lote/fila, responsable original y evento de resultado; los reintentos no duplican ni sobrescriben cambios posteriores.

**Aclaración posterior confirmada por administración:** las fechas y horas asignadas del Excel son las fechas reales de carga y deben alimentar los gráficos diarios. La etiqueta «Distribución estimada» del archivo se conserva como evidencia original, pero la confirmación posterior se registra con auditoría. `fecha_carga_historica` guarda el instante confirmado en Córdoba; `creado_en` sigue siendo el instante de importación. El tablero incluye ambas fuentes sin duplicar registros, distingue el importador del vendedor responsable y no utiliza la fecha de carga como fecha de cierre.

El responsable activo o administración pueden reactivar una Perdida con motivo y próxima acción futura. Inicia otro ciclo en la misma oportunidad, conserva el cierre original y no altera el resumen histórico de septiembre. No se permite reabrir una Ganada mediante esta acción. Las reglas de calificación, recuperación y cierre de nuevas gestiones siguen vigentes; la excepción de información faltante se limita a la migración histórica.

## 19. Navegación unificada y ventas concretadas

El acceso independiente «Recuperación comercial» se muestra solo a Agente y Administrador. Un vendedor que abre su ruta directamente vuelve a Prospectos, conservando la referencia a la ficha. El vendedor sigue pudiendo derivar casos y consultar estado e historial de aquellos en los que participó desde Prospectos; no gestiona la recuperación asignada al agente. Esto no amplía ni recorta los permisos de lectura por participación del servidor.

La interfaz unifica Prospectos y Oportunidades bajo «Prospectos»: una ficha por necesidad comercial, con visitas, seguimiento, recuperación e historial. Se conservan las entidades y relaciones internas para permitir varias necesidades por persona. «Recuperación comercial» es un acceso filtrado al mismo circuito, no otra copia ni una función del módulo general Gestiones.

«Ventas concretadas» muestra automáticamente los casos actualmente Ganados, una vez por caso. Administración ve todos; cada vendedor y agente ve los atribuidos a sí mismo como responsable al cierre. El actor que registra el resultado no recibe atribución por ese solo hecho. El vendedor de visita conserva consulta de la ficha si el agente cierra, pero no se duplica esa venta en su listado propio. Se muestran condiciones aceptadas, canal, responsable y vendedor de visita si constan, fecha de cierre e historial vinculado. Ganada no acredita contrato, instalación ni cobro.

El filtro mensual usa cierre del servidor en Córdoba; para importaciones sin fecha exacta usa el mes conocido, expresamente identificado. No se inventan fechas, condiciones o visitas. Un cierre nuevo de un caso histórico reactivado pertenece al nuevo mes de cierre, sin alterar el resultado original de septiembre. Gestiones y Próximas acciones generales continúan pendientes; el historial y la próxima acción existentes se mantienen en la ficha.

## 20. Promociones y simplificación del menú

Se retiran los accesos independientes Gestiones y Próximas acciones, sin borrar el historial ni los compromisos de las fichas de Prospectos. Los enlaces antiguos llevan a Prospectos.

Promociones comunica información oficial del administrador al equipo: título, descripción, condiciones/precios/bonificaciones, vigencia inclusiva por fechas de Córdoba y destinatarios (vendedores, agentes o ambos). Administración crea borradores, edita, publica y archiva; vendedores/agentes consultan y descargan únicamente publicaciones dirigidas a su rol. Al publicar se generan avisos internos persistentes para los destinatarios activos. Volver a borrador o archivar retira inmediatamente la consulta del equipo. Editar una publicación requiere pasarla a borrador y volver a publicarla; no se sobrescriben condiciones de ventas anteriores.

Adjuntos privados: PDF, JPG/JPEG, PNG y WebP, hasta 20 MB cada uno y diez adjuntos no retirados por promoción. No se aceptan SVG, HTML ni ejecutables. Los archivos pendientes de transferencia bloquean la publicación; confirmar una carga verifica su existencia, MIME y tamaño en Storage. La validación de firma en navegador ayuda a detectar errores, pero no constituye análisis antivirus. Los adjuntos no se sobrescriben: se retiran lógicamente y sus cambios conservan auditoría. Su eliminación física no forma parte de esta entrega.

La lista inicial muestra vigentes; próximas y vencidas tienen filtros y etiquetas explícitos. Las publicaciones vencidas siguen disponibles para consulta histórica de sus destinatarios; nunca se presentan como oferta vigente. Las descargas requieren sesión y permisos actuales, sin enlaces públicos. No puede revocarse una copia ya descargada por un usuario autorizado. No hay envíos a clientes, motor de precios ni cambios automáticos de estados comerciales.

## 21. Agenda compartida y timeline diario (criterio confirmado)

Agenda ayuda al vendedor a planificar y registrar su jornada; administración consulta esa misma información como timeline. Se comunica explícitamente que es una agenda laboral compartida, no privada. Son actividades declaradas, no prueba de presencia, geolocalización ni asistencia. Sin anotaciones significa «Sin actividad registrada», no inactividad laboral.

Cada vendedor consulta y gestiona solamente su agenda. Administración ve todas y puede cancelar pendientes con motivo, pero no iniciar ni dar por realizada una actividad en nombre del vendedor. Agente coordina visitas desde Prospectos; esa coordinación aparece automáticamente en la agenda del vendedor sin habilitar acceso a sus notas generales.

Actividades: visita comercial, llamada, puerta a puerta, reunión, traslado, tarea administrativa y otra. Título, nota/lugar, inicio y fin previsto opcional; vínculo comercial opcional que no crea un registro inicial. Se puede programar a futuro o cargar una actividad realizada con inicio, fin y resultado. Estados: Programada, En curso, Realizada y Cancelada. Iniciar registra el horario actual declarado; finalizar exige horarios no futuros y resultado. Una programación vencida muestra «Pendiente de actualizar», sin convertirse automáticamente en realizada o incumplida.

Reprogramaciones, cancelaciones y correcciones conservan motivo e historial; no se elimina la actividad. Se distingue horario previsto, horario declarado, instante de carga del servidor y última modificación. Las visitas coordinadas se reprograman desde Prospectos para no crear calendarios contradictorios. Su sustitución cancela la programación anterior pendiente y conserva el historial de vendedor/horario; no modifica una actividad ya realizada. Registrar o cancelar una actividad de Agenda no gana, pierde ni cambia por sí mismo el estado comercial del prospecto.

08:00–17:00 es solo referencia de gerencia, nunca un bloqueo. Se permiten todos los horarios, incluidos pedidos excepcionales de clientes, sin autorización especial. La vista diaria diferencia realizadas dentro, fuera o abarcando ambas franjas, sin duplicar una misma actividad en ese día. Programaciones no se contabilizan como ejecución; no se infieren horas efectivamente trabajadas. Actividades que cruzan medianoche se muestran en ambos días correspondientes, sin crear otra entidad.

Primera entrega: vista diaria/semanal del vendedor, selección de vendedor y timeline de administración, actualización cada 30 segundos con la plataforma abierta y recordatorios internos en campana. No promete recordatorios con el navegador cerrado. Las nuevas visitas coordinadas a partir de la activación se integran transaccionalmente; no se inventan actividades a partir del histórico de septiembre ni se reconstruyen visitas anteriores.

## 22. Inicio simple y orientado al rol

Inicio prioriza un resumen mensual y una sección independiente «Para atender ahora». Se retiran bienvenida decorativa, accesos duplicados del menú y listados expandidos por defecto. Administración dispone de filtro por responsable y comparación del equipo; vendedores y agentes ven su atribución propia, sin rankings de terceros. Las restricciones del servidor se mantienen.

Cuatro tarjetas del mismo conjunto: prospectos (necesidades comerciales) del período, ganadas de ese conjunto, su conversión y sus pendientes. El denominador cero se muestra como —. Para oportunidades nuevas el período corresponde a creación en Córdoba y el estado/responsable son los actuales a la fecha de lectura; no se presenta como una medición a 30/60/90 días ni como una atribución histórica de captación. El histórico confirmado mantiene resultado y responsable originales, separado del estado actual que se puede consultar en el detalle. No contar la importación como creación comercial.

Las ventas cerradas en el mes son otro indicador, atribuido al responsable al cierre y enlazado al mismo filtro en Ventas concretadas; no se divide ese total por las cargas del mes. Los gráficos muestran cargas diarias, distribución por estado y, para administración, resultados por responsable. Verde indica ganada, rojo perdida, ámbar seguimiento/pendientes, violeta recuperación y azul visitas/cargas; etiquetas y cifras complementan colores. Cada tarjeta o categoría abre el conjunto que la produjo.

Los pendientes se calculan sobre la cartera actual, independientemente del mes seleccionado: visitas próximas en siete días, visitas pendientes de actualizar y seguimientos vencidos. Recuperación y cola sin asignar se muestran solo a agentes y administración; la cola sin asignar es común y no se atribuye arbitrariamente a un agente. Una visita vencida no demuestra incumplimiento laboral. Los errores de lectura nunca se convierten en ceros; se informa fecha de actualización. El cambio es de consulta/presentación y no modifica resultados comerciales ni permisos.

## 23. Simpleza transversal por rol (01-10-2026)

El criterio de simpleza se aplica a todos los módulos, no solo a Inicio. La primera vista prioriza tareas frecuentes, estado actual, responsable, próxima acción y filtros útiles. Ayuda extensa, criterios de lectura, condiciones ampliadas e historiales se consultan mediante desplegables identificados y accesibles por teclado; no se eliminan datos ni eventos.

Vendedor: carga, seguimiento y agenda propia a mano. Agente: coordinación, disponibilidad y recuperación accesibles sin mezclar gestión de cuentas. Administración: filtros de equipo y gestión de usuarios; módulos todavía no implementados agrupados como «En preparación», sin presentarlos como funciones operativas. Las rutas y restricciones existentes se conservan.

Crear cuentas es una acción explícita, no un formulario que ocupa la vista inicial del equipo. Ventas muestra un listado compacto con condiciones y confirmación a demanda. Agenda conserva a la vista que es compartida y que no acredita presencia; detalles de franjas y recordatorios se expanden. Promociones mantiene vigencia, condiciones y descarga accesibles para sus destinatarios. Mi cuenta conserva un formulario directo sin pasos adicionales. No se ocultan errores, confirmaciones destructivas, avisos de datos históricos ni requisitos de validación.

## 24. Catálogo, propuestas, atribución y métricas comerciales (01-10-2026)

### 24.1 Estado, decisiones sustituidas y límites

Criterios confirmados para implementación incremental, no descripción de capacidades desplegadas. Se mantiene la simpleza con criterio. Se incorpora un solo módulo nuevo visible, **Productos**; las demás funciones se integran en módulos existentes. Configuración e Informes hoy contienen pantallas preparatorias: deben desarrollarse, no presentarse como operativos por existir una ruta.

Quedan sustituidas estas propuestas previas: un único nivel obligatorio para kit y abono; valorar bonificaciones del vendedor con Telefónico; excluir ventas sin importe; iniciar facturación en una fecha distinta de la instalación; impedir acumular efectivo con bonificaciones. El Excel de simulación es una referencia de validación, no un backend ni una fuente de permisos. Sus límites técnicos, ejemplos y advertencias anteriores no reemplazan estos acuerdos.

### 24.2 Servicios y composición

| Servicio / subcategoría | Instalación y abono | Armado |
| --- | --- | --- |
| Instalación de Alarma / Docta Urbanización | Incluidos en expensas según acuerdo y cliente al día; sin cobro adicional por esos conceptos | Kit y periféricos adicionales cobrables |
| Instalación de Alarma / Nobu Town | Igual criterio que Docta | Kit y periféricos adicionales cobrables |
| Instalación de Alarma / Residencial con monitoreo | Instalación y abono cobrados | Kit y adicionales |
| Instalación de Alarma / Residencial sin monitoreo | Instalación cobrada; abono no corresponde | Kit y adicionales |
| Instalación de Cámaras | Instalación incluida en kit; sin abono | Kit base y adicionales por unidad |
| Instalación de Cerco Eléctrico | Mano de obra como concepto separado; sin abono | Desde cero: metros, componentes y mano de obra |

Docta/Nobu cuentan como ventas aunque no haya adicionales cobrados. Mostrar **Incluido en expensas**, no descuento del vendedor. Distinguir ventas con importe inicial y sin importe adicional. Solo alarmas con monitoreo y cobro al cliente admiten abono monetario en estos indicadores.

Una venta puede contener varios conceptos/categorías (por ejemplo alarma y cámaras). Cuenta una vez como cierre y en el ticket inicial; distribuir importes por concepto sin duplicar el total. Los conteos por categoría se superponen y no son sumables como operaciones únicas.

### 24.3 Productos y validación técnica

Administración gestiona familias, marcas, productos, unidades comerciales, kits, cantidades incluidas, adicionales compatibles, precios y vigencia/disponibilidad. Un componente puede estar incluido y también ofrecerse como adicional; registrar cantidades incluidas, extras, cobradas y bonificadas por separado. Un pack no equivale a una unidad suelta ni implica automáticamente el doble de precio.

Catálogo inicial de referencia: Garnet híbrido cableado; Garnet híbrido inalámbrico con teclado RF; Garnet híbrido inalámbrico con control remoto; Innova Garnet inicial; Ajax inicial; Hikvision inicial. Se excluyen Titanium (también Innova Titanium) y Netio/DSC. No existen planes Esencial, Plus o Premium: solo kits base y adicionales. Nuevas familias/items se crean desde administración, sin codificar una lista cerrada en la UI.

Antes de habilitar: administración confirma composición, modelos, compatibilidad y unidades con el área técnica y completa precios requeridos. Borradores no son seleccionables por vendedor/agente. Faltante no equivale a cero. Productos usados se deshabilitan, sin eliminar historia. Cambios de kit/precio no alteran propuestas guardadas ni ventas aceptadas.

Fuentes de referencia: «Catalogo Alarmas Pignus» y «PRECIOS VENDEDORES.xlsx», recibidos el 01-10-2026. AXPRO es la referencia numérica del simulador; la planilla GARNET contiene descripción AXPRO y precios faltantes, por lo que requiere revisión. No importar automáticamente esos datos como catálogo definitivo ni inventar precios de otras familias.

### 24.4 Propuesta, niveles y código interno

Flujo: servicio/subcategoría → marca → variante de kit si corresponde → adicionales sí/no → items y cantidades → Confirmar → alternativas. Cerco utiliza metros/componentes/mano de obra en lugar de kit. El primer selector de alternativas es nivel de kit, **Catálogo por defecto**. Ordenar las alternativas de mayor a menor total y permitir comparar mejoras; bajar de nivel no garantiza menor total al cambiar bonificaciones.

Administración establece precios finales con IVA incluido. Alarmas: kit Catálogo, Alto, Medio, Bajo y Telefónico; adicionales Alto/Bajo para vendedor, Telefónico adicional reservado al agente en recuperación. Abono Alto/Medio/Bajo y Telefónico para agente. Instalación y abono son independientes (por ejemplo kit Medio y abono Bajo). No exigir nivel uniforme a kit y adicionales ni permitir importes libres no autorizados.

Cada alternativa debe tener un código interno inequívoco para el equipo autorizado. Distinguir identidad de la alternativa/versionado de la propuesta y posición por precio en la escalera. Un código guardado debe resolver la composición, condiciones y precios de esa versión, sin reinterpretarse con listas nuevas. No concede permisos ni habilita lectura de otra cartera. Una aprobación real identifica al usuario autorizado; una llamada informal no sustituye el control del servidor.

No se obliga a registrar todas las ofertas presenciales ni a pasar por todos los niveles. Guardar la última efectivamente ofrecida y la finalmente aceptada. Los niveles no son estados del prospecto. Propuestas estructuradas se preparan en Prospectos, no en Registros iniciales. La aceptación debe vincularse a una versión completa y congelada de la propuesta.

### 24.5 Bonificaciones de alarmas y control del mínimo

Para vendedor, valorar las unidades adicionales bonificadas a **Bajo**, nunca a Telefónico. Para un kit en nivel L:

- Bolsa disponible = precio del kit en L − precio del kit en Bajo.
- Consumo = suma de cantidades adicionales bonificadas × precio Bajo de cada adicional.
- Consumo no puede superar la bolsa. Los restantes adicionales pueden cobrarse en Alto o Bajo; bajar a Bajo usa su propia diferencia de precio, sin volver a descontarla de la bolsa del kit.
- Verificar además total antes de descuento por pago ≥ kit Bajo + todos los adicionales requeridos en Bajo. El margen de otros adicionales cobrados en Alto no amplía automáticamente la bolsa de bonificaciones del kit.
- Kit Bajo tiene bolsa cero. La cobertura/equipos instalados no disminuye al bonificar.

Agente: kit Telefónico y adicionales Alto/Bajo/Telefónico, sin nuevas bonificaciones automáticas en ese nivel. No habilitar Telefónico para adicionales del vendedor. Toda ampliación de esa política requiere decisión explícita.

Ejemplo de aceptación AXPRO, no tarifa obligatoria: kit Catálogo 449999, Alto 359999, Medio 259999, Bajo 149999, Telefónico 53000; PIR Bajo 92914,932 y Telefónico 86999; magnético Bajo 66214,932; sirena exterior Bajo 160198,932. Kit + 2 PIR adicionales: Catálogo con 2 bonificados = 449999; Alto con 2 bonificados = 359999; Medio con 1 bonificado y otro Bajo = 352913,93; Bajo sin bonificar = 335828,86; Telefónico con ambos Telefónico = 226998. Mantener precisión de la lista y definir explícitamente el redondeo de presentación/cierre para no perder centavos.

### 24.6 Cámaras y cerco: límites de la experimentación

Cámaras puede bonificar componentes incluidos, como caja estanca y microSD, conservándolos en el equipo entregado. Administración debe definir componentes elegibles, valor bonificable y límite; no restar automáticamente el precio individual de catálogo de un kit ni descontar dos veces la misma unidad.

Cerco puede contemplar bonificación sobre metros y componentes, distinguiendo instalado de cobrado (30 metros instalados y 5 bonificados no son 25 instalados). Mano de obra se cobra separadamente; no asumir que es bonificable sin regla aprobada.

Hoy no hay niveles definidos para cámaras/cerco. Se autoriza preparar su configuración experimental, no inventar precios ni mínimos. Mantener un precio vigente y la estrategia escalonada deshabilitada hasta aprobación/carga de gerencia. Las reglas de bonificación propias requieren valores y topes explícitos antes de habilitar el cálculo.

### 24.7 Pago, abonos y congelamiento

Débito y transferencia: total acordado. Crédito: **1, 3 o 6 cuotas sin interés**, mismo total que débito. Efectivo: **10 % adicional sobre el precio ya bonificado**, acumulable, incluso si queda por debajo del mínimo del rol. Validar el mínimo antes del descuento por efectivo; no bloquear después por esa única razón. Aplicación exclusiva a instalación y adicionales/conceptos iniciales, nunca al abono. Para cerco el total inicial incluye mano de obra. Guardar base, bonificaciones, descuento por pago e importe final sin doble descuento. Cuotas no multiplican ventas; ajustar centavos de la última para conciliar total. Medio acordado no acredita cobro.

Congelamiento independiente del nivel: inicialmente 4 o 6 meses, o sin congelamiento. Administración edita plazos y habilita/deshabilita el ofrecimiento por separado para vendedor y agente; inicialmente ambos. Se cobra el abono normalmente, no son meses gratis. No exigir registrar una oferta de 4 antes de 6. Condiciones aceptadas se conservan aunque se deshabiliten; propuestas pendientes afectadas se advierten y revisan, sin cambiarse silenciosamente.

### 24.8 Recuperación y atribución

Derivar conserva composición, cantidades, niveles, importes, pago y congelamiento de la última propuesta, junto con resultado de visita, motivo de no cierre y objeción concreta; próximo contacto si se acordó. No exigir llegar a Bajo antes de derivar. La notificación abre el caso autorizado; no crea copia. El agente conserva versiones al modificar la propuesta. Aceptación: Ganada; rechazo final: Perdida con motivo; sin respuesta o pedido de tiempo: seguimiento, no pérdida automática.

Conservar por separado captador/origen, vendedor de visita, agente coordinador/asignador y responsable que consiguió el cierre. El actor que carga el resultado no recibe automáticamente el mérito. Una recuperación ganada cuenta una venta de empresa y un cierre del agente; al vendedor se le reconoce la visita y el caso recuperado, no otra venta propia. Importes/tickets se atribuyen al responsable al cierre; vistas por origen no se suman a esa atribución. No define comisiones. Reasignar luego no reescribe historia.

Origen comercial: propio del vendedor o asignado por agente; distinto del canal (WhatsApp, redes, referido, puerta a puerta, etc.). Conservar ambos y el origen del ciclo/reactivación sin borrar procedencia original. Recuperación no transforma un propio en asignado por agente. Datos anteriores no comprobados: **Sin identificar**, no deducción del creador actual.

### 24.9 Meses, conversión y tickets

Ventas e importes: mes de cierre comercial en Córdoba. Conversión principal de vendedores: cohorte del mes de la **primera visita efectivamente realizada del ciclo**, deduplicada por caso/ciclo. Incluye propios y asignados por agente; visitas programadas no prueban ejecución. Revisitas cuentan como actividad por su fecha real, no aumentan el denominador ni cambian la cohorte. Cierre posterior actualiza la conversión de la cohorte visitada y cuenta como venta en su mes de cierre.

Por vendedor y origen mostrar: casos visitados, cierres directos, derivados, recuperados y conversión directa. Conversión directa = casos de esa cohorte cerrados por ese vendedor / casos efectivamente visitados de esa cohorte. Resultado final de la cohorte incluye recuperaciones, identificado por separado; no incrementa cierres directos del vendedor. Mostrar fecha de corte y pendientes. Denominador cero = —. Las cohortes por creación/captación de secciones 11/22 pueden conservarse como indicadores secundarios claramente rotulados, nunca bajo el mismo nombre de conversión de visitas.

| Indicador monetario | Regla confirmada |
| --- | --- |
| Volumen inicial vendido | Suma final de instalación y adicionales/conceptos iniciales, después de descuentos; no abonos ni cuotas multiplicadas |
| Ticket inicial total | Volumen inicial de operaciones completas con importe > 0 / cantidad de esas ventas; venta combinada una vez |
| Ticket instalación | Importe final de instalación/kit cobrado / ventas con instalación cobrada; excluir adicionales e instalación incluida en expensas |
| Abono mensual vendido | Suma del importe mensual original acordado, sin multiplicar por meses ni sumar al inicial |
| Ticket abono | Suma de abonos originales cobrables / ventas con abono cobrado al cliente |

Docta/Nobu sin extras: venta sin importe adicional, fuera de promedios monetarios. Con extras cobrados: entra en ticket inicial, no en instalación/abono. Diferenciar cero real, no corresponde y desconocido. Históricos incompletos no reciben importes/visitas inventados; mostrar cantidad/cobertura de datos completos de cada indicador, no un promedio con denominador mayor que el conjunto informado. Ajustes futuros de abono no cambian el ticket original. Para ventas combinadas se debe aprobar/documentar antes de implementar la distribución de descuentos globales entre conceptos y redondeos, preservando la suma y evitando elegir arbitrariamente categorías para alterar tickets.

### 24.10 Ciclos y correcciones

Seguimientos, revisitas, cambios de propuesta y derivación a recuperación continúan el mismo ciclo. Después de una pérdida definitiva, interés retomado o nueva propuesta que el cliente acepta evaluar inicia nuevo ciclo, con motivo obligatorio y evidencia de negociación real. Una llamada sin respuesta no inicia ciclo; se registra actividad. No hay umbral automático de 30/60/90 días.

Nueva necesidad, ampliación o instalación tras una venta: nueva oportunidad vinculada a la misma identidad, no reapertura de Ganada. Corrección de pérdida errónea: solo administración, mismo ciclo, motivo y auditoría conservando el evento original. Reactivación auténtica conserva pérdida, visitas y atribución del ciclo anterior. Venta por teléfono sin visita del nuevo ciclo cuenta como venta/cierre sin visita, pero no entra en conversión por visitas ni reutiliza la visita del ciclo perdido.

### 24.11 Instalación efectiva, activación y pendientes contables

Administración registra desde **Ventas concretadas** la instalación efectiva confirmada en **Agenda Pignus** (sistema técnico externo, no módulo Agenda de este CRM). Esa misma fecha representa activación e inicio de facturación y comienza el congelamiento. Por ahora carga manual respaldada, no integración automática. Vendedor/agente consultan según acceso, no modifican. Correcciones conservan actor/motivo e historia. Sin fecha: activación pendiente, sin vencimiento definitivo del congelamiento. Ganada sigue contando por mes de cierre, no por instalación.

Al vencer el congelamiento se acordó actualización trimestral por IPC, pero quedan pendientes serie, meses utilizados, desfase, calendario individual/general, primer ajuste y redondeo. Cierre de facturación supuesto del día 20, prorrateo, período de primera factura y posibles bonificaciones de días: **sin confirmar**. No prometer días gratis, no desplazar la fecha de activación/facturación, no calcular aumentos ni emitir facturas. Esos pendientes no bloquean catálogo, propuestas, métricas ni registro de activación; sí bloquean automatizaciones contables.

### 24.12 Ubicación funcional aprobada

| Función | Módulo / sección |
| --- | --- |
| Familias, marcas, productos, kits, compatibilidad, validación técnica y precios | Productos (nuevo; administración) |
| Medios de pago, plazos, permisos de congelamiento y políticas comerciales | Configuración / Condiciones comerciales (a desarrollar) |
| Armado, alternativas, código interno, última propuesta y derivación | Prospectos / Propuesta comercial |
| Negociación final, Telefónico y versiones | Recuperación comercial (mismo caso y propuesta) |
| Propuesta aceptada, importes y activación administrativa | Ventas concretadas |
| Resumen mensual propio o de equipo | Inicio, adaptado al rol |
| Comparativas por vendedor/agente, origen, categoría y cohorte | Informes (administración inicialmente) |

Registros iniciales mantiene captación; Agenda mantiene actividades y evidencia declarada de visitas; Promociones mantiene material descargable, sin convertirse en fuente de precios del motor; Usuarios conserva cuentas/roles. No agregar módulos Cotizador, Facturación, Stock, Clientes ni ejecución técnica por esta ampliación. No duplicar métricas en Supervisión mientras Informes cubra esa responsabilidad.

### 24.13 Pendientes acotados y aprobación de implementación

Pendientes de datos: catálogo definitivo validado y precios por familia, cámaras/cerco y sus topes bonificables. Pendientes técnicos a documentar antes de su etapa: precisión/redondeo/distribución de descuentos; formato y persistencia del código interno; vínculo inequívoco visita-ciclo y atribución ante cambios de vendedor; semántica de meses calendario al calcular fin de congelamiento (incluidos fin de mes y correcciones). No convertir sugerencias técnicas en tarifas o reglas gerenciales aprobadas.

Pendientes contables de 24.11 se mantienen fuera de implementación. Este acuerdo autoriza consolidar documentos y planificar; la ejecución del plan, migraciones remotas y publicación requieren autorización específica. El Excel previo queda como simulador histórico: su advertencia de efectivo pendiente y ausencia de crédito en una cuota no reflejan ya el criterio final y no deben trasladarse al producto.

### 24.14 Aclaraciones posteriores confirmadas

- Pago mixto permitido. Se informa la parte del precio acordado que se cancela en efectivo **antes** del descuento; sobre esa parte se aplica el 10 %. El resto se paga por débito, transferencia o crédito en 1/3/6 cuotas sin interés. Ejemplo: total 500000, base efectivo 200000, efectivo a entregar 180000, saldo crédito 300000, total final 480000. Nunca se descuenta el abono. No interpretar billetes entregados como base anterior al descuento.
- Cuando participan varios vendedores, la venta, importes y tickets corresponden a quien consiguió el cierre, no al primero que visitó. Cada participante cuenta una vez el caso/ciclo entre sus visitas; la empresa lo deduplica una vez. Revisitas no multiplican el denominador.
- Congelamiento por meses calendario desde instalación/activación. Si existe el mismo día en el mes destino, el precio queda congelado hasta el día anterior inclusive (15 de octubre + 4 meses: 14 de febrero). Si no existe, hasta el último día del mes destino inclusive (31 de octubre + 4 meses: último día de febrero). El vencimiento no aumenta automáticamente el abono.
- IPC: índice nacional general de INDEC, primer ajuste propuesto al terminar el congelamiento sobre los últimos tres meses publicados; no acumular todos los meses congelados. Posteriores ajustes cada tres meses sobre el abono vigente y los siguientes tres períodos, sin reutilizarlos. Administración revisa y aprueba cada ajuste; falta de índice mantiene pendiente, sin estimaciones. Integración de consulta no equivale a facturación automática.
- Siguen pendientes el cierre de facturación supuesto del día 20, primera factura/prorrateos y redondeo contable de IPC. No emitir facturas ni prometer días gratis. El reparto proporcional del descuento global entre instalación y adicionales quedó aprobado, con conciliación exacta de centavos y conservación de precios de origen.

Estas aclaraciones sustituyen los pendientes anteriores solo en los puntos expresamente resueltos. La autorización continua de las seis entregas incluye commit, push y despliegue por etapa terminada, no aprobación de reglas aún pendientes.

Confirmación adicional durante implementación: el descuento por efectivo se reparte proporcionalmente entre kit/instalación y adicionales. La asignación de centavos usa mayores restos con desempate estable, conserva la suma y permite calcular tickets netos. En casos visitados por varios vendedores, el caso/ciclo se cuenta una vez en las visitas de cada participante; solo quien cerró recibe la venta. La empresa deduplica el caso/ciclo una vez. Esta confirmación resuelve los dos pendientes de distribución y denominador compartido mencionados antes.

## 25. Continuidad del recorrido comercial (02-10-2026)

Agenda planifica y registra actividades; no es paso obligatorio antes de captar un contacto. Cuando surge un interesado se carga un Registro inicial. Desde ese registro se ofrece Crear prospecto, o Abrir prospecto si ya existe una necesidad accesible; desde Prospectos se puede iniciar el mismo recorrido buscando el registro existente. No pedir nuevamente sus datos personales. Una necesidad distinta se crea mediante acción y confirmación explícitas, no para repetir cotizaciones del mismo caso.

Se conservan los requisitos vigentes de calificación, responsable y coordinación de visita. Datos incompletos se completan en Registros iniciales. Las visitas coordinadas aparecen en Agenda y no se cargan por duplicado; finalizar su actividad no cambia el resultado comercial. En Prospectos se prepara y guarda la cotización, luego se registra la aceptación mediante Registrar venta concretada. Guardar una oferta no basta para ganar. Ventas concretadas se alimenta automáticamente del cierre; administración registra instalación/activación por separado. No se alteran permisos ni métricas por estos ajustes de presentación.

### 25.1 Alta guiada y observaciones útiles

Al crear un prospecto se seleccionan uno o varios servicios (Alarma, Cámaras, Cerco eléctrico), sin duplicados. Alarma admite Docta, Nobu, Residencial con/sin monitoreo o «A definir en la visita». No se exige marca, kit ni adicionales antes del relevamiento. El interés se conserva estructurado y orienta la cotización posterior; no restringe lo que finalmente se ofrece ni acredita una venta.

«Evidencia del contacto efectivo y calificación» se reemplaza por «Observaciones para la visita», opcionales, destinadas a indicaciones de acceso, preferencias y aclaraciones útiles. Se mantiene la confirmación explícita de respuesta humana y posibilidad comercial, junto con medio de contacto, responsable y visita. No se exige redactar una prueba. El sistema registra el evento de creación y un resumen operativo sin inventar notas del cliente. Otros cambios comerciales conservan sus motivos/resúmenes obligatorios. Los registros históricos no reciben servicios deducidos de texto.

### 25.2 Prospectos y Cotizaciones: criterio vigente (02-10-2026)

Este acuerdo sustituye la terminología y los requisitos de inicio de 25 y 25.1:

- **Prospectos** reemplaza a Registros iniciales: base de contactos potenciales, captados por los medios disponibles. Sus datos se cargan y corrigen allí.
- **Cotizaciones** reemplaza al módulo anteriormente llamado Prospectos. Lista automáticamente los contactos accesibles, incluso «Sin cotización». No hay conversión manual ni se vuelve a pedir la ficha personal. Los contactos asignados a un vendedor por un agente también son consultables; editar el contacto sigue reservado a su responsable o administración.
- «Cotizar» inicia una negociación por necesidad, con servicio(s) desplegable(s), vendedor responsable, origen y observaciones opcionales. No exige programar una visita ni declarar contacto efectivo ficticio. La preparación no acredita visita, venta ni calificación. Se puede coordinar la visita posteriormente desde la misma ficha.
- Distintas versiones de precio corresponden a la misma negociación. Otra necesidad requiere confirmación explícita y crea otro caso del mismo contacto. No duplicar personas para cotizar nuevamente.
- El vendedor prepara la propuesta y registra el seguimiento. Derivar conserva el caso, última propuesta y objeciones; Recuperación comercial mantiene los permisos de agente/administración y el acceso restringido a precios Telefónicos. Aceptación expresa alimenta Ventas concretadas; guardar una cotización no equivale a ganar ni a instalar.
- Agenda conserva actividades generales y puede asociarlas a una negociación. Las visitas coordinadas desde Cotizaciones aparecen en Agenda, sin doble carga. Ventas mantiene activación administrativa; no se implementan reglas contables pendientes.
- **Anulación por error**, no borrado: vendedor solo sobre una negociación propia que creó y sin propuestas ni actividad posterior; administración puede anular con actividad. Exige motivo y confirmación, conserva prospecto, eventos y propuestas, cancela visitas pendientes y notifica a responsables. No reabre ni registra una pérdida comercial. Actividades realizadas quedan en su historial; actividades manuales que no son visitas conservan su gestión.
- Las negociaciones anuladas quedan fuera de estadísticas comerciales y denominadores de visitas válidas. El contacto captado sigue contando como contacto. Cotizaciones permite consultar anuladas mediante filtro. No se reescriben hechos históricos para representar el error.
- Los nombres físicos de tablas y contratos anteriores se conservan por compatibilidad; las rutas antiguas a fichas redirigen al nuevo módulo. Inicio distingue prospectos captados de negociaciones iniciadas, y mantiene las métricas de cierre/conversión por visitas efectivas en el panel de rendimiento.

## 26. Catálogo comercial: planes, kits y productos (02-10-2026)

El módulo administrativo **Productos** pasa a llamarse **Catálogo comercial**. Se conserva su ruta y acceso exclusivo de administración. El cambio de nombre se publicó por separado de la reorganización estructural siguiente, implementada localmente mediante 020 (ver 26.1); no se deduce la clasificación de planes o kits a partir de nombres anteriores.

Administración debe poder crear, editar y deshabilitar marcas, tipos comerciales, productos/componentes y planes/kits con composición, cantidades incluidas, adicionales compatibles y precios. Configuración conserva políticas de pago y permisos/plazos de congelamiento. No crear un módulo independiente por cada catálogo auxiliar.

- **Plan:** equipos en comodato, exclusivo de alarmas. Ejemplo: Plan Hikvision Inicial.
- **Kit:** venta directa de equipos. Ejemplo: Kit Hikvision Inicial. Cámaras no admite comodato; cerco se compone de metros, componentes y mano de obra separada, sin exigir kit base.
- Selección comercial: servicio → Plan/Kit cuando corresponda → marca → tipo → adicionales y cantidades. Inicial es la referencia actual; administración podrá crear Esencial, Plus, Premium u otros tipos sin cambios de código. Esto sustituye la restricción de 24.3; no implica crear esos tipos ni inventar tarifas ahora.
- Un mismo producto puede integrar un plan/kit y ofrecerse como adicional. Mantener una identidad reutilizable, cantidades incluidas y extras separadas, y compatibilidades explícitas.
- En un Plan, los componentes incluidos y adicionales totalmente bonificados quedan en comodato. Los adicionales pagados, aun con descuento, son propiedad del cliente.
- En un Kit, los equipos son propiedad del cliente; un adicional totalmente bonificado se entrega como obsequio y también pasa a su propiedad.
- Si un producto tiene unidades pagadas y bonificadas en un Plan, se distingue la cantidad de cada condición; no se asigna una única propiedad a toda la línea sin distinguirlas.
- El abono se aplica con las mismas reglas de servicio/subcategoría para Plan y Kit. La propiedad del equipo no determina por sí sola si corresponde abono ni modifica las excepciones Docta/Nobu.

La implementación deberá conservar composición y condición de propiedad en la versión de propuesta aceptada. Deshabilitar o editar el catálogo no cambia ventas ni propuestas históricas. No se modifica por esta definición el cálculo de precios, los permisos de Telefónico ni las reglas contables pendientes.

### 26.1 ABM y conservación del historial

Las nuevas marcas, tipos, productos, planes, kits y adicionales tienen «activo» seleccionado por defecto. Administración puede elegir borrador o inactivo antes de guardar. Se mantienen las validaciones de composición, precios y confirmación técnica; no se activan automáticamente registros existentes ni los pendientes de revisión por adaptación del catálogo anterior.

Los selectores para nuevas asociaciones muestran solo registros activos (no inactivos ni borradores). Al editar se conservan los vínculos anteriores no activos con una advertencia, sin sustitución automática; pueden retirarse para reemplazarlos por activos. Los listados administrativos mantienen todos los estados para permitir edición y reactivación. Este filtro no altera propuestas ni ventas históricas.

Administración dispone de secciones Marcas, Tipos, Productos, Planes y kits y Adicionales. Cada registro admite alta, edición y baja. La baja lógica impide nuevas ofertas y se revierte desde Editar; no altera versiones históricas. La eliminación del catálogo vigente exige confirmación y ausencia de dependencias y uso comercial. Si existen vínculos se informa el impedimento; no se borran cotizaciones ni ventas para permitir una baja.

Adicionales es una vista de los mismos productos habilitados para ofrecer por separado, no un catálogo duplicado. Desmarcar «Ofrecer también como adicional» retira esa opción sin retirar componentes incluidos. Para dar de baja un componente incluido se deben revisar primero los planes/kits activos que lo necesitan; marcas y tipos con elementos activos tampoco se deshabilitan en cascada silenciosamente. Componentes solo incluidos no necesitan precio individual; los adicionales y conceptos cobrables requieren precios completos para activarse.

Implementación local: esquema versionado 2 y migración 020. Los registros anteriores se presentan para revisión, conservando identidades y precios; no se interpreta «comodato» en texto libre como una clasificación confirmada. Hasta revisión y activación permanecen en borrador tras publicar la adaptación. Ninguna modificación cambia propuestas históricas. La aplicación remota de la migración y el despliegue se verifican por separado.

### 26.2 Aclaración aprobada: plantillas comerciales (02-10-2026)

La denominación visible «Tipos» se sustituye por **Plantillas**. Una plantilla define productos concretos y cantidades por marca, servicio y variante del sistema (por ejemplo Garnet híbrido cableado o inalámbrico con teclado RF). Inicial, Esencial, Plus y Premium pueden repetirse entre marcas y variantes. Se selecciona una plantilla de la marca/servicio elegidos al crear un plan o kit; su composición se copia y puede ajustarse antes de confirmar la validación técnica. La plantilla no contiene precios ni determina la propiedad: Plan conserva comodato y Kit venta directa. Editar una plantilla no modifica ofertas, propuestas ni ventas guardadas. Los tipos históricos conservan IDs y asociaciones y se identifican como pendientes de completar; no se deducen componentes de sus nombres.

Referencia del Word «Catalogo Alarmas Pignus»: Inicial incluye 1 magnético y 1 PIR; Esencial 1 magnético y 2 PIR; Plus 2 magnéticos y 3 PIR; Premium suma sirena exterior a Plus, además de los equipos base de cada variante. **Corrección expresa del usuario: Innova tiene un solo control en todas sus plantillas, incluida Premium.** Esta corrección prevalece sobre el Word. La referencia no habilita tarifas ni importa automáticamente productos o plantillas; se conserva la exclusión vigente de Titanium y Netio/DSC.

### 26.3 Simplificación aprobada: Marcas, Productos y Planes y kits (02-10-2026)

Por decisión expresa del usuario, Plantillas es innecesario y queda retirado. Esta sección sustituye la estructura de tipos/plantillas de 26 y 26.2. El catálogo ofrece únicamente **Marcas**, **Productos** y **Planes y kits**. Cada plan o kit tiene su nombre comercial (incluida la variante necesaria), marca, servicio, modalidad, productos concretos, cantidades incluidas y precios. No exige una clasificación o plantilla previa para crearse, activarse o cotizarse. Inicial, Esencial, Plus o Premium pueden formar parte del nombre de la oferta.

Adicionales deja de ser una sección separada: es una condición del mismo producto, habilitable mediante «Ofrecer también como adicional» y retirable sin quitar su inclusión en ofertas. Cotización conserva adicionales, cantidades, compatibilidades, mínimos, descuentos y modalidades de propiedad. El recorrido selecciona servicio/modalidad, marca y plan o kit directamente.

El esquema 3 conserva las ofertas existentes con sus IDs, estados, precios y cantidades, sin copiar ni deducir composición desde las plantillas anteriores. Las plantillas y sus asociaciones permanecen solo en las versiones históricas ya guardadas; no se modifican propuestas ni ventas. La corrección de referencia de Innova sigue vigente: un control en todas sus variantes, incluido Premium. No se importa el Word automáticamente.

### 26.4 Servicios y precios por modalidad (02-10-2026)

Este criterio confirmado sustituye las reglas anteriores en estos puntos:

- La plataforma ofrece inicialmente Alarmas y Cámaras. Se retira Cerco eléctrico de altas, catálogo vigente y nuevas cotizaciones. Todos los productos son componentes; se elimina la carga de clase de producto y mano de obra.
- Los planes de alarma en comodato tienen precios propios Catálogo, Alto, Medio, Bajo y Telefónico. Sus componentes tienen Alto, Bajo y Telefónico para las unidades adicionales, bajo las reglas de negociación, permisos, bolsa y piso ya aprobadas para planes.
- Los kits de venta de equipos, tanto de alarma como de cámaras, tienen únicamente precio Telefónico. Sus adicionales, cuando existan y estén habilitados, se cobran únicamente al precio Telefónico del componente. No hay niveles negociables ni bonificaciones de componentes en venta de kits. Telefónico es aquí el precio ordinario de venta de equipos, utilizable por el vendedor; no habilita el nivel de recuperación Telefónico de los planes o abonos.
- Los componentes de cámaras tienen solo precio Telefónico. No se inventan adicionales de cámaras ni se habilitan automáticamente: solo se ofrecen los productos marcados expresamente como adicionales compatibles.
- El precio del plan o kit es independiente de la suma de los productos incluidos. La composición sirve como referencia técnica; el motor parte del precio de la oferta y agrega únicamente las unidades adicionales elegidas. Los incluidos no se cobran dos veces. Las excepciones ya aprobadas de planes Docta/Nobu incluidos en expensas y las condiciones de pago se mantienen; no convierten un kit de venta en gratuito.
- Las versiones, cotizaciones y ventas históricas se conservan. No se deduce un Telefónico a partir del antiguo precio Único de cámaras: queda como referencia para revisión. Los registros sin las tarifas requeridas y sus ofertas dependientes quedan en borrador hasta completarse y activarse.

### 26.5 Componentes compartidos entre marcas (02-10-2026)

La marca administrativa **COMPONENTES** agrupa productos reutilizables como SIM M2M, batería, transformador y cartel disuasivo. Cada producto selecciona explícitamente sus marcas compatibles mediante casillas. No equivale a compatibilidad universal ni convierte COMPONENTES en marca de planes o kits. Las ofertas conservan su marca comercial y admiten componentes propios o compartidos compatibles del mismo servicio. Las restricciones opcionales por plan/kit se mantienen para adicionales.

Cada componente compartido tiene una sola identidad y sus propios precios por modalidad según 26.4. Se valida la compatibilidad también en servidor, para incluidos y adicionales. Retirar una compatibilidad utilizada en una oferta exige corregir previamente esa composición. No se modifican cotizaciones ni ventas históricas. Los duplicados solo se consolidan tras comprobar precios y configuración; el control de uso histórico impide eliminar identidades utilizadas.

## 27. Nombres uniformes

Los nombres de personas/empresas, usuarios, marcas, tipos, productos, planes, kits y adicionales se guardan en mayúsculas, conservando tildes y Ñ y quitando espacios exteriores. No es una transformación general del texto: correos, contraseñas, códigos, archivos, direcciones y observaciones mantienen sus reglas anteriores.

La normalización se aplica a nuevas altas y ediciones, también en servidor mediante 021. Los nombres anteriores se normalizan al editar; guardar el catálogo publica una nueva versión normalizada. No se reescriben eventos, propuestas ni ventas históricas. La migración y publicación remotas requieren confirmación.

## 28. Orden de listados

Los listados de catálogo, personas, prospectos, cotizaciones y ventas se presentan de A a Z por nombre; promociones por título y negociaciones de un contacto por necesidad. Los selectores de nombres y catálogo siguen el mismo criterio. En consultas paginadas el orden se aplica en servidor antes del límite, con ID como desempate estable; no se ordena únicamente la página visible.

Agenda, notificaciones e historiales conservan su secuencia temporal. Los rankings y gráficos de rendimiento mantienen su criterio cuantitativo; niveles de precio, etapas, cuotas y plazos conservan su orden funcional. El cambio no modifica datos, permisos ni snapshots comerciales.

**Fin.**


### Cuotas iguales y comparación de ofertas (03-10-2026)

Por instrucción del titular, las nuevas propuestas en crédito de 3 o 6 cuotas dividen el saldo a centavos truncando hacia abajo y repiten ese importe en todas las cuotas. Se bonifica el resto (de 0 a 2 centavos en 3 cuotas y de 0 a 5 en 6), sin incrementar la última cuota. El total final y el saldo guardados se reducen por ese ajuste; se registra separado del descuento del 10 % por efectivo. El reparto proporcional de descuentos entre componentes incluye ambos ajustes para conciliar los netos. No cambia el precio fuente, el abono, los mínimos anteriores al descuento ni los snapshots históricos. Esta regla sustituye el reparto del resto a la última cuota indicado anteriormente. En pago mixto se aplica únicamente al saldo en crédito.

Cada alternativa se compara con la inmediatamente anterior, incluso entre páginas. Se explican todos los cambios de tarifa y bonificaciones por componente, sin presentar como mejora individual un cambio que aumenta su cargo; se muestra la diferencia neta del inicial antes de la forma de pago.


### Presentación: sin marco negro por foco automático (03-10-2026)

Al abrir o enfocar automáticamente una sección, formulario, cotizador, oferta o panel, no debe aparecer un encuadre negro alrededor del bloque completo. Se conserva el desplazamiento automático y el foco programático para orientar al usuario y mantener accesibilidad. La supresión del contorno se limita a los contenedores o títulos usados como destinos de navegación con tabindex="-1"; nunca se aplica globalmente. Botones, enlaces, desplegables, campos, resúmenes interactivos y demás controles conservan un indicador visible al navegar con teclado. Toda nueva acción que abra un panel debe respetar esta regla en los temas claro y oscuro.


### Comparación desde la oferta efectivamente presentada (03-10-2026)

Desde que se registra una propuesta como ofrecida, todas las alternativas comparables deben explicar sus cambios respecto de la última efectivamente ofrecida del ciclo actual, aunque el vendedor salte posiciones (por ejemplo, de la oferta 1 a la 4). Al registrar otra, esa nueva propuesta pasa a ser la referencia. Se utilizan los importes originales guardados antes del descuento por pago, sin recalcular el histórico. Antes del primer ofrecimiento se permite comparar opciones consecutivas. Si la última propuesta tiene otra composición o varios conceptos que impiden identificar una referencia única, debe indicarse que no hay comparación directa; no usar silenciosamente una oferta anterior no presentada. Esta regla sustituye la comparación consecutiva luego del ofrecimiento.

### Ofrecimientos sucesivos, sin acumulación (03-10-2026)

Elegir una alternativa sustituye la oferta preparada, nunca suma sus conceptos ni importes a otra alternativa. Registrar como ofrecida crea una revisión histórica inmutable: solo la última presentada del ciclo es la referencia vigente para negociar. Por ejemplo, al ofrecer 1 y luego 4 queda vigente únicamente 4; 5, 6 y las demás se comparan con 4. Las anteriores permanecen como historial, sin sumar sus importes y sin mantener el distintivo de última ofrecida. Elegir un borrador todavía no cambia la referencia: debe confirmarse y guardarse el ofrecimiento. Se conservan las opciones calculadas para seguir negociando y se reinicia la parte en efectivo al sustituir la selección para evitar trasladar un importe incompatible.

### Referencia interna breve de propuestas (03-10-2026)

Las propuestas guardadas usan una referencia interna permanente con formato P-7K3M-9R2X: ocho caracteres aleatorios en dos grupos, sin 0, 1, I ni O para reducir confusiones al dictar. No codifica cliente, vendedor, fecha, monto, nivel de negociación ni posición de la oferta. El servidor la asigna, impide duplicados y conserva el mismo código al reintentar o reabrir. Las propuestas anteriores reciben una referencia breve sin cambiar sus UUID, snapshots, importes o fechas. La misma referencia se muestra en cotización, comparaciones, historial, derivación, recuperación y venta aceptada. Es una referencia de trabajo, no una contraseña ni un permiso de consulta; siguen vigentes los controles de acceso. El número de oferta de la simulación es independiente de este código persistido.

### Listas de adicionales en pesos y dólares (05-10-2026)

Por decisión del titular, cada componente admite una lista ARS y una USD con los mismos niveles habilitados por modalidad. Catálogo comercial selecciona una única moneda de referencia para todos los adicionales. ARS usa el importe cargado; USD multiplica el importe por el dólar venta (Banco Nación de MonedAPI principal y Oficial de DolarAPI de respaldo). El resultado comercial siempre se presenta y guarda en pesos. Planes, kits y abonos conservan sus precios propios en pesos; incluidos no se cobran nuevamente.

No se deducen precios USD ni se completa un vacío con cero: se cargan expresamente. Para activar USD deben estar completas las tarifas de los adicionales activos. La cotización se verifica en servidor y su referencia se conserva en la propuesta. Una falla de verificación impide calcular en USD, sin sustitución silenciosa por ARS. Los ofrecimientos y ventas previos mantienen sus importes y tipo de cambio originales. Las reglas de negociación, compatibilidad, bonificaciones, cuotas y permisos anteriores permanecen vigentes.

### Vigencia de cinco días y redondeo comercial (05-10-2026)

Las propuestas registradas como ofrecidas tienen vigencia de cinco días corridos (120 horas), hasta la misma hora de registro. Dentro del plazo se conserva el importe ofrecido; pasado el plazo queda bloqueada la confirmación de venta y se requiere recalcular con listas y dólar vigentes y registrar una nueva propuesta. Las ventas ya confirmadas e historiales no se alteran.

El vendedor dispone de Redondeo para descontar un importe explícito del total final, por ejemplo 642.208,42 menos 2.208,42 resulta en 640.000,00. Se registra como rebaja comercial separada, posterior al descuento por medio de pago, sin afectar abono. No puede ser negativo ni superar el 1 % del total después del descuento por pago y antes del ajuste automático de cuotas, sin abono. Administración puede modificar el porcentaje en Configuración entre 0 y 100 %, con hasta dos decimales; 0 deshabilita la rebaja manual. El máximo se trunca a centavos y se valida también en servidor. Cambiarlo no modifica propuestas ya ofrecidas. En pago combinado se aplica primero al efectivo neto y luego al saldo. Los importes finales y cuotas deben conciliar con el neto guardado, conservando el ajuste automático de centavos a favor del cliente.


### Packs de dos adicionales (05-10-2026)

Cada adicional vendido por unidad puede tener un precio total especial para dos unidades, por nivel Alto/Bajo/Telefónico y por moneda ARS/USD, sin duplicar productos. En kits de venta rige Telefónico. Sin precio de pack en el nivel y moneda elegidos, se usa el individual. No se inventan descuentos ni se cargan los valores de la imagen como promociones.

Se aplican automáticamente packs completos y sobrantes: 3 = un pack + una unidad, 4 = dos packs, 5 = dos packs + una unidad. Se agrupan únicamente adicionales pagados del mismo producto y tarifa; incluidos y bonificados quedan excluidos. El piso Bajo incorpora el precio por cantidad y se conserva el consumo de bonificaciones a Bajo individual. Los precios especiales no pueden superar dos individuales y respetan la escala entre niveles.

La oferta muestra el beneficio por cantidad y su ahorro. El servidor valida la composición y conserva los precios de pack aplicados; cotizaciones y ventas históricas no se recalculan al editar el catálogo. Vigencia, descuento por medio de pago y redondeo comercial mantienen sus reglas.


## 29. Prospectos compartidos y asignación al primer ofrecimiento (06-10-2026)

Este acuerdo prevalece sobre las referencias anteriores a cartera o dueño del contacto y sobre la asignación al abrir una cotización de 25.2.

Prospectos es una base común para todos los usuarios activos: pueden consultar y editar sus datos, sin asignación de dueño. El servidor conserva creado_por y creado_en y registra actor, fecha, valores anteriores y nuevos de cada edición; la concurrencia se controla por versión. La columna responsable_id del contacto queda solo por compatibilidad histórica, no autoriza ni asigna seguimiento. Los nuevos contactos se crean sin responsable. La presentación muestra Cargado por y permite filtrar por autor; el directorio mínimo no expone correos ni modifica la RLS de perfiles.

La cotización en preparación nace compartida, sin vendedor ni responsable. Calcular o seleccionar alternativas no la asigna. Registrar la primera oferta como ofrecida asigna automáticamente el seguimiento al vendedor actor, dentro de la misma transacción que valida y guarda la propuesta. Administración puede registrar en nombre de un vendedor activo elegido expresamente; el agente conserva el ofrecimiento de Recuperación, no se autoasigna preparaciones. Un error de precios/pago revierte la asignación; el bloqueo, versión e idempotencia impiden apropiaciones simultáneas. Las siguientes ofertas conservan el responsable salvo reasignación administrativa del circuito vigente.

032 marca como compartidas las preparaciones anteriores sin propuestas, eventos posteriores al inicio, agenda ni procedencia histórica. Conserva las columnas previas como evidencia de compatibilidad y los eventos originales, sin atribuirles seguimiento mientras estén compartidas. Negociaciones con actividad u ofertas previas, recuperaciones y cierres conservan sus responsables y permisos. La primera oferta deja un evento primera_oferta_asignada con referencia a la propuesta. La coordinación posterior de visita utiliza al vendedor del ofrecimiento sin dar por realizada ninguna visita.

La bandeja comparte solo el contexto básico de otras negociaciones (necesidad, estado y responsable) para evitar duplicados; el acceso a propuestas, precios e historial comercial mantiene su RLS. Una negociación distinta sigue requiriendo confirmar otra necesidad. Todos conservan la edición del contacto aun después del ofrecimiento. Se bloquean gestiones y la creación directa antigua de visitas antes de la primera oferta, manteniendo reintentos históricos. La anulación de una preparación propia sin actividad sigue permitida. Captación se atribuye al autor de carga; las importaciones históricas conservan su atribución original.

Aplicar 032 antes del frontend. RPC de entrada versionadas evitan usar el nuevo flujo contra el servidor anterior. No modifica cotizaciones ofrecidas, importes, autoría ni cierres históricos.

## Eliminación administrativa de prospectos (033, 06-10-2026)

Solo administradores activos pueden eliminar prospectos, desde la papelera del listado o la ficha, con confirmación y motivo de 5 a 500 caracteres. Crear y editar sigue disponible para todos los usuarios activos. La eliminación es lógica: retira el contacto de Prospectos, búsquedas y Cotizaciones, conserva autoría y datos, y registra actor, fecha, motivo y snapshot anterior/nuevo en eventos. Administración conserva acceso de auditoría a esos eventos. No se elimina ningún prospecto automáticamente con la migración.

Se bloquea si existe identidad comercial vinculada (incluidas cotizaciones anuladas), importación histórica o demostración. No se borran negociaciones, propuestas, ventas ni agendas en cascada. La versión y el bloqueo compartido con iniciar_cotizacion evitan eliminar mientras otro usuario cotiza; un reintento idéntico no duplica el evento. La RLS restrictiva oculta las bajas aunque haya otras políticas de lectura, y el servidor impide editar o iniciar cotizaciones desde clientes antiguos. Las bajas sin uso dejan de contar en captación. Aplicar 033 antes del frontend. No incluye borrado físico ni restauración desde la interfaz.

### Eliminación con antecedentes (034, 06-10-2026)

Sustituye la restricción de 033: administración puede eliminar un prospecto aunque tenga cotizaciones, propuestas, seguimiento o importación histórica. Se mantiene la baja lógica con motivo, autoría e historial. La confirmación informa que se anulan todas las negociaciones abiertas (preparación, visita, seguimiento y recuperación) y se cancelan sus visitas y tareas pendientes. No cambia las ventas ganadas, pérdidas ni anulaciones anteriores; conserva propuestas, importes, eventos y actividades realizadas. Los registros de demostración mantienen su procedimiento de limpieza.

Toda la operación es transaccional: si alguna anulación o baja falla, no queda ningún cambio parcial. Reintentar no duplica anulaciones ni eventos. Se bloquean nuevas cotizaciones sobre el contacto eliminado y la gestión de casos anulados; permanecen accesibles bajo sus permisos los cierres y el historial. La entrada 034 exige desplegar su migración antes del frontend; 033 conserva el contrato anterior para evitar que una pestaña antigua anule casos sin explicar el alcance. No elimina automáticamente datos al aplicar la migración.

## Presentación temporal de una sola oferta (07-10-2026)

El cotizador muestra únicamente la Oferta 1 resultante de las condiciones elegidas por el vendedor. Se ocultan las demás alternativas y la paginación. Se conserva el motor de cálculo, el armado y ajuste de condiciones, el pago y registro del ofrecimiento, las comparaciones con la última ofrecida y el historial. Esta limitación es de presentación y no reescribe propuestas anteriores ni precios. No requiere migración propia.

### Textos del cotizador con propuesta única (07-10-2026)

El armado muestra el abono en el selector de nivel, sin repetirlo en un resumen previo. El botón se llama Calcular. La propuesta calculada se titula con el nombre del plan/kit, sin numeración Oferta 1; mantiene el abono mensual en el detalle comercial. Revisar pago y registrar ofrecimiento abre la revisión existente y no confirma una venta: el cierre sigue exigiendo aceptación del cliente y su acción correspondiente.


### Condiciones de adicionales desde el armado (07-10-2026)

Antes de Calcular, el vendedor distribuye la cantidad de cada adicional entre bonificados y precio Bajo; las unidades restantes se cobran a Alto. Por ejemplo, 2 PIR pueden ser 1 bonificado y 1 Bajo, y 2 magnéticos ambos Bajo. Telefónico sigue restringido al circuito y nivel habilitados; kits de venta conservan únicamente Telefónico. Se mantienen bolsa de bonificación, piso comercial, exclusiones de expensas y packs por tarifa. Si la distribución excede cantidades o márgenes, se exige corregirla; no se calcula otra propuesta automáticamente. La propuesta única refleja exactamente las condiciones elegidas y se conservan al recuperar el borrador o reutilizar un ofrecimiento.


### Selección por unidad de adicional (07-10-2026)

Sustituye la distribución por contadores: cada unidad seleccionada tiene una fila numerada y un desplegable con Bonificado, Alto y Bajo con importes unitarios en pesos; Telefónico conserva sus permisos. Al aumentar cantidad se agregan unidades a Alto; al reducir se retiran las últimas. Los borradores conservan el orden de selecciones y se agregan cantidades por tarifa para el contrato de cálculo y guardado existente. Las distribuciones antiguas inconsistentes exigen revisar cada unidad, sin mostrar remanentes negativos. Los packs se aplican al calcular por unidades de la misma tarifa; bolsa, piso y servidor mantienen sus validaciones.


### Disponibilidad dinámica por unidad (07-10-2026)

Cada opción de cada adicional se evalúa con toda la selección mediante el mismo motor de cálculo manual, incluyendo bolsa, piso, packs y permisos. Se deshabilitan las opciones incompatibles con la composición actual; liberar margen las habilita nuevamente. La posición de la unidad no determina prioridad. Cambios de cantidad, plan, nivel, condición o catálogo recalculan disponibilidad. Un borrador inválido muestra aviso y permite pasar unidades a Alto para repararlo progresivamente, sin modificar otras selecciones ni omitir la validación final del motor y del servidor. Se reutilizan resultados para unidades equivalentes del mismo producto y condición durante cada render. No requiere migración.


Las unidades nuevas y las agregadas al aumentar cantidad comienzan sin condición seleccionada. Se exige completar todas antes de calcular. Para evaluar disponibilidad durante el armado, las pendientes se consideran provisionalmente a Alto, sin guardar ni mostrar esa tarifa como elegida; se revalida toda la composición en cada selección. Las elecciones anteriores válidas se conservan al recuperar borradores. Esta regla sustituye el valor inicial Alto de la sección anterior.


## Disponibilidad por ubicación de la alarma (07-10-2026)

Se reemplaza Tipo de alarma por Ubicación de la alarma. Administración configura por separado en marcas y planes/kits las cuatro opciones: Docta Urbanización, Nobu Town, Residencial con monitoreo y Residencial sin monitoreo. Solo se puede cotizar cuando ambos permiten la ubicación; habilitar una marca no anula las restricciones particulares del plan/kit. Garnet inicia habilitada en las cuatro e Hikvision únicamente en las dos residenciales. Las ofertas existentes heredan inicialmente esas ubicaciones y luego pueden restringirse individualmente. La selección se filtra desde la preparación y se valida nuevamente al guardar. Las cámaras no se restringen por esta regla.


### Jerarquía de ubicaciones (036)

La marca es la autoridad sobre las ubicaciones. El editor deshabilita casillas no permitidas; al guardar una marca se retiran de todos sus planes/kits las ubicaciones excluidas, incluso ofertas inactivas. Volver a habilitar la ubicación en la marca no la reactiva automáticamente en ofertas que ya la habían retirado. El servidor normaliza la intersección al guardar el catálogo, también para clientes anteriores, sin modificar propuestas históricas. Aplicar 036 antes de publicar el frontend.


## Dólar oficial con respaldo automático (07-10-2026)

Criterio vigente autorizado: MonedAPI /api/v2/usd/bna (Banco Nación venta) es principal y DolarAPI /v1/dolares/oficial (Oficial venta) es respaldo. Pueden diferir; nunca se promedian. No hay carga manual. El adaptador HTTP compartido por cabecera y Edge Function limita cada intento a cuatro segundos; pasa al respaldo ante error, datos inválidos o confirmación de MonedAPI con más de veinte minutos. lastScrapedAt representa la última confirmación del valor por MonedAPI; updatedAt solo su último cambio. DolarAPI aporta fechaActualizacion. La pantalla muestra precio y fecha de fuente, sin proveedor ni hora de consulta. Si ambas fallan, muestra no disponible y no mantiene un precio anterior como actualizado. Consulta cada cinco minutos con plataforma visible. El servidor conserva caché de cinco minutos y referencias inmutables para propuestas; la validación de fechas atrasadas se aplica por proveedor para permitir el respaldo. No cambia importes históricos ni reglas ARS/USD.

Aplicar migración 037, desplegar cotizacion-dolar con su adaptador compartido y publicar frontend. La función anterior de registro se conserva durante la transición. Proveedor queda como metadato interno de auditoría.

Cambio de referencia BNA: desplegar nuevamente cotizacion-dolar y frontend; no requiere migración adicional. Se inicia una nueva referencia local de avisos para no comparar cotizaciones de distinto criterio. Los registros y propuestas históricos se conservan; la caché del servidor anterior caduca en cinco minutos.

### Precio unitario visible de adicionales
La oferta al cliente muestra por producto el importe promedio por unidad: total del adicional dividido entre sus unidades cobradas; las bonificadas se informan separadamente como unidades sin cargo adicional y no se muestra $0,00 cuando todas son bonificadas, respetando packs y conversión a pesos. No expone listas Alto/Bajo/Telefónico. Se redondea solo la visualización a dos decimales; no cambia totales ni descuentos por pago. Se conserva la indicación de unidades sin cargo.


### Referencia de precios por producto (038, 07-10-2026)

Sustituye la selección global ARS/USD: administración elige la lista de referencia de cada producto. Un mismo presupuesto puede combinar adicionales en pesos y en dólares. USD convierte individuales y packs con el dólar validado; ARS conserva su lista y no requiere completar USD. Solo los adicionales activos habilitados con referencia USD requieren esa lista completa. Se siguen validando las escalas y packs cargados. Planes, kits, abonos e incluidos mantienen su tratamiento actual. Los importes finales se presentan y guardan en pesos.

Al adaptar el catálogo, cada producto conserva la referencia global que estaba vigente; los nuevos comienzan en pesos. No se cambian automáticamente productos a USD por tener precios cargados. Las propuestas nuevas conservan la referencia de cada adicional y el cambio aplicado. Historiales, ofrecimientos y ventas anteriores permanecen inmutables.
