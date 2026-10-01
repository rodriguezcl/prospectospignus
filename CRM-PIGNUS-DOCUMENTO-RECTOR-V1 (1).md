# Prospectos Pignus — Documento rector V1.5

**Fecha:** 30 de septiembre de 2026

**Estado:** especificación de producto autónomo para análisis y desarrollo.  
**Idioma del documento y del producto:** español en pantallas, estados, mensajes, ayuda, informes, especificaciones, nombres de dominio e identificadores nuevos de código y datos. Se permiten únicamente nombres propios, direcciones de fuentes y convenciones técnicas externas que no controla el proyecto (por ejemplo, el identificador oficial de zona horaria).  
**Propósito:** construir desde cero **Prospectos Pignus**, sistema de prospección y desarrollo de oportunidades de venta por vendedor, diseñado a partir de necesidades del equipo comercial y de patrones documentados de EspoCRM.

## 1. Principios del producto

1. **Prospectos Pignus es un proyecto propio y autónomo**, con identidad, datos, permisos, métricas y ciclo de vida definidos en este documento.
2. Su alcance es la captación de registros iniciales, calificación de Prospectos, desarrollo de Oportunidades y evaluación del desempeño comercial del equipo.
3. Los criterios de negocio son: aislamiento por cartera, atribución de creador y responsable, origen de los registros iniciales, deduplicación, responsable principal único, gestiones verificables, seguimiento, pérdidas justificadas e historial auditable.
4. EspoCRM es referencia funcional y técnica, no dependencia, plantilla de código ni autorización para copiar su implementación. Catálogos y umbrales propuestos son configurables.
5. El producto no implementa procesos posteriores al resultado de la prospección. La condición Ganada es un resultado comercial declarado, con significado y métricas propios.
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

**Fuera de alcance:** alta y administración de Clientes operativos; contratos, firmas y autorizaciones contractuales; coordinación y ejecución técnicas; relevamientos técnicos; reservas; inventario; cobranza; facturación; comisiones; motor de presupuestos/precios; envío automático de WhatsApp; geolocalización continua o vigilancia del personal. Se registra solamente una referencia comercial a la propuesta cuando exista. Ninguno de esos procesos es requisito para usar Prospectos Pignus o cerrar una Oportunidad.

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

**Autonomía de datos:** Prospectos Pignus crea y gobierna sus propios registros y eventos. Las referencias o adjuntos de propuestas comerciales tienen permisos propios y no sustituyen un sistema de presupuestación.

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

**Fin.**
