# Plan de implementación comercial por módulos

Fecha: 01-10-2026. Estado: **plan pendiente de ejecución**. Autoridad de negocio: [documento rector V1.6, sección 24](../CRM-PIGNUS-DOCUMENTO-RECTOR-V1%20(1).md). Arquitectura: [ARQUITECTURA.md](ARQUITECTURA.md).

El plan se redactó como entrega documental. El 01-10-2026 el titular autorizó expresamente la ejecución continua de las seis etapas, commit, push y despliegue por etapa. El estado efectivo se registra en [AVANCE-COMERCIAL.md](AVANCE-COMERCIAL.md); los pendientes comerciales explícitos no se consideran resueltos por esa autorización.

## 1. Punto de partida y responsabilidades

| Área | Base existente inspeccionada | Trabajo previsto |
| --- | --- | --- |
| Productos | No hay feature | Nuevo módulo de administración para catálogo/kits/precios, sin inventario |
| Configuración | `features/configuracion/presentation/ConfiguracionPagina.jsx` | Condiciones comerciales versionadas y permisos por rol |
| Prospectos y recuperación | Feature interna `oportunidades`, dominio `circuito.js`, formulario, repositorio RPC; migraciones 006/007 | Propuesta estructurada, alternativas, recuperación y ciclos conservando rutas actuales |
| Ventas | Feature `ventas`; proyección/RPC en migración 010 | Versión aceptada, conceptos monetarios y activación; no segunda fuente de cierres |
| Agenda | Feature `agenda`; migración 012 | Vincular evidencia de visita realizada al ciclo; no inferir ejecución de una programación |
| Inicio | Feature `inicio`, dominio `tablero.js`, lecturas mensuales | Separar cierres del mes y cohortes visitadas; conservar históricos identificados |
| Informes | `features/informes/presentation/InformesPagina.jsx` | Comparativas gerenciales y detalle de cada indicador |
| Usuarios y avisos | Gestión de cuentas y campana actuales | Extender protección de historial/referencias y eventos necesarios sin nuevos roles |

No hay funcionalidades pendientes operativas por tener un placeholder. Agente no obtiene permisos generales sobre carteras ni Agenda. El vendedor conserva lectura por participación después de derivar; la venta atribuida al agente no aparece como cierre propio del vendedor.

## 2. Secuencia de entregas

### Etapa 0 — Contratos verificables y diseño de datos

- Traducir rector 24 a matriz de permisos, eventos, ejemplos de cálculo y diccionario de métricas. Mapear esquema/contratos existentes antes de elegir nombres físicos nuevos.
- Separar catálogo vigente de versión ofertada/aceptada. Propuesta con conceptos, cantidades incluidas/adicionales/bonificadas, niveles independientes, precios fuente, pago, descuento y abono/plazo. Cierre apunta a versión inmutable.
- Definir ciclo, origen comercial, canal, vendedor de primera visita, coordinador y responsable del cierre como dimensiones distintas. Decidir asociación de visitas de Agenda y correcciones administrativas sin retrocarga ficticia.
- Especificar código interno inequívoco, orden de alternativas y política de invalidación cuando cambia la selección/lista. No derivar permisos de un código.
- Resolver precisión monetaria, redondeo final y distribución reproducible de descuentos entre conceptos; unidades fraccionarias de metros y semántica de fin de congelamiento requieren especificación explícita.
- Si existen varios vendedores visitantes en el mismo ciclo, documentar la regla de atribución y elevar la elección comercial antes de implementarla; no alterar responsables históricos arbitrariamente.
- Diseñar límites de enumeración/paginación para no devolver opciones truncadas como completas. Los 100.000 casos del Excel no son una regla del producto.

Salida: contratos y pruebas esperadas revisables. No cargar tarifas estimadas ni usar XLSM como dependencia de ejecución.

### Etapa 1 — Productos y Configuración

- Crear la feature Productos solo con capas que tengan responsabilidad real. Catálogo administrable, kits/versiones, unidades/packs, compatibilidad y estados borrador/activo/inactivo.
- Ampliar Configuración para pago, descuento efectivo acumulable, crédito 1/3/6, plazos editables de congelamiento y permisos por rol.
- Lectura comercial restringida a lo necesario: vendedor no recibe precios Telefónicos mediante respuestas API, consultas o cálculos cliente; agente accede según circuito de recuperación. Validaciones definitivas del servidor.
- Migraciones aditivas para catálogo/precios/versiones y auditoría; no modificar migraciones ya aplicadas. Precisión decimal en persistencia, sin flotantes monetarios no controlados.
- Administración carga y valida datos. Borradores/incompletos bloquean nuevas propuestas; deshabilitar no destruye referencias previas. Proteger eliminación de cuentas con nuevas referencias.

Aceptación: solo administrador edita; usuario no autorizado no puede hacerlo por API; falta de precio no se transforma en cero; marca/kit incompatible rechazado; histórico conserva versión original; familias no dependen de listas codificadas en React.

### Etapa 2 — Motor de alternativas y propuesta en Prospectos

- Flujo servicio → marca → kit si corresponde → adicionales/cantidades → Confirmar. Cerco usa metros/componentes/mano de obra. Formulario móvil y escritorio, accesible y compatible con ambos temas.
- Motor puro de alarmas: bolsa kit seleccionado menos kit Bajo, unidades bonificadas a Bajo, resto Alto/Bajo; comparación global del mínimo antes de pago. Telefónico exclusivo de agente. No retirar equipos al bonificar.
- Abono independiente. Efectivo 10 % después de bonificaciones, autorizado aunque baje del piso; crédito 1/3/6 y última cuota conciliada. Abono no se suma al monto inicial ni recibe ese descuento.
- Código y detalle por alternativa, orden descendente por total, filtro de nivel predeterminado Catálogo. Guardar última propuesta realmente ofrecida sin exigir registrar el discurso completo.
- Una propuesta admite varios conceptos; no duplicar venta ni aplicar bolsa de una familia a otra sin autorización de regla. Conservar motivos y valores explícitos de bonificaciones.
- Versionar listas y calcular/validar en servidor al guardar. Ante cambio de condiciones o concurrencia, exigir revisión; nunca cambiar silenciosamente un precio aceptado.
- Cámaras/cerco pueden armar propuestas con precio único validado. Activar escalas experimentales y bonificaciones solo después de contar con valores y topes aprobados. No bloquear la entrega de alarmas por esos datos faltantes.

Aceptación: ejemplos del rector y casos sin adicionales; cantidades inválidas, pack vs unidad, datos faltantes, cuotas y efectivo. Dos confirmaciones con misma clave no duplican propuesta. Manipular totales/rol en el navegador no permite guardar una oferta no autorizada.

### Etapa 3 — Recuperación, cierre, origen y ciclos

- Completar derivación con última propuesta, resultado de visita, motivo, objeción y próximo contacto si acordado. Mantener asignación equilibrada, cola común y notificación transaccional existentes.
- Agente ve detalle autorizado y genera versión final con Telefónico. Aceptación cierra con composición e importes congelados; sin respuesta mantiene seguimiento.
- Mantener una sola venta atribuida al responsable que cierra y reconocimiento separado de visita/captación. Registrar origen propio/asignado, coordinador, canal y ciclo; datos desconocidos quedan identificados.
- Extender reactivación 007: nueva negociación crea ciclo; error administrativo corrige mismo ciclo; llamada sin respuesta no crea ciclo; nueva necesidad tras ganada crea oportunidad distinta.
- Conservar cierres previos de ciclos para métricas: la proyección de ganadas actuales no basta para reconstruir toda la historia. Extender consultas/eventos, sin duplicar fuentes autoritativas ni inventar fechas.

Aceptación: vendedor no accede a recuperación por URL/API; derivar no duplica oportunidad; visitas previas no pasan al nuevo ciclo; reactivar no transforma septiembre histórico; correcciones auditan actor/motivo; cierre concurrente/idempotente una vez.

### Etapa 4 — Ventas concretadas y activación administrativa

- Mostrar versión aceptada, conceptos/categorías, importes, condiciones, actor y responsable al cierre por separado.
- Administración registra instalación efectiva confirmada en Agenda Pignus externo; misma fecha para activación e inicio de facturación. Guardar referencia/observación de respaldo, autor y motivo de correcciones.
- Calcular fin de congelamiento con semántica de calendario aprobada en etapa 0; no inventar activación pendiente. Sin abono: no corresponde.
- No implementar emisión/cierre de facturas, cobranza, IPC ni integración automática con Agenda Pignus.

Aceptación: vendedor/agente no pueden modificar activación; cierre y activación en meses distintos no desplazan la venta; corrección no borra evidencia; vencimiento no se calcula sin activación; no se anuncian días gratis.

### Etapa 5 — Inicio e Informes

- Consultas agregadas y detalle sobre un mismo conjunto autorizado, con filtros y corte explícitos. Evitar descargar toda la cartera para calcular rankings en el navegador.
- Cierres e importes por mes de cierre; primera visita realizada por ciclo para conversión. Revisitas como actividad separada; cierres sin visita no entran en ese denominador.
- Separar conversión directa del vendedor y resultado final con recuperaciones; segmentar propios/asignados/Sin identificar. No sumar doble atribución vendedor/agente.
- Tickets inicial, instalación y abono con denominadores específicos, importes después de descuentos y cobertura de históricos conocidos. Venta combinada una vez; Docta/Nobu según rector 24.9.
- Inicio compacto, gráficos con color semántico y detalle a demanda; Informes para administración. Vendedores/agentes consultan lo propio sin ranking de terceros.
- Cohorte por creación existente conserva nombre/contexto histórico hasta transición, sin renombrarla como visitas. Diferenciar valores calculados con reglas nuevas de históricos no reconstruibles.

Aceptación: visita octubre/cierre noviembre actualiza cohorte octubre y venta noviembre; ciclo perdido octubre/reactivado diciembre no reutiliza visita; ejemplo rector de tres ventas con tickets correctos; filtros, totales y detalle concilian; sin datos no se muestra cero falso.

## 3. Arquitectura y despliegue futuro

Mantener dominio puro en español, sin React/Mazer/Supabase; aplicación define puertos y coordina; infraestructura implementa RPC/lecturas; app compone APIs públicas. No imports cruzados de internals entre Productos, Configuración, Oportunidades, Ventas, Agenda e Informes. Inyectar puertos de catálogo/reglas por composición; compartir persistencia mediante contratos explícitos y transacciones, no repositorios ficticios. La ubicación visual de un formulario no obliga a duplicar su lógica en cada módulo.

Toda escritura crítica valida identidad/rol activo, versión, compatibilidad, reglas vigentes y clave idempotente en servidor. Propuesta aceptada/cierre/eventos/notificaciones en transacción cuando corresponda. RLS para detalle, agregados, códigos y auditoría; no confiar en restricciones de dropdowns. Diseñar migraciones reversibles o recuperación compensatoria antes de aplicarlas.

Cada etapa: pruebas unitarias del dominio, casos de uso, SQL/RLS/concurrencia, build y pruebas de UI relevantes. Probar servidor real cuando se autorice; éxito local no acredita despliegue. Probar móvil, teclado, claro/oscuro y estado de errores. Publicación/migración solo con autorización; separar preparación, aplicación y verificación. No asumir que aprobar este documento autoriza ejecuciones remotas.

## 4. Datos y restricciones de esta entrega documental

- No tocar las 950 oportunidades históricas ni sus 29 ganadas. No fabricar precios, visitas, captador, activaciones ni origen. Backfill futuro solo con evidencia y autorización acotada.
- Preservar `output/` y artefactos ajenos sin incorporarlos al commit por defecto.
- No implementar pendientes contables: serie/calendario de IPC, primer aumento, cierre supuesto del día 20, prorrateos y primera factura. El inicio de facturación desde instalación efectiva sí está confirmado como dato, no como motor de facturación.
- La carga definitiva del catálogo corresponde a administración con validación técnica. Los ejemplos AXPRO prueban cálculos, no autorizan precios de producción.
- El simulador Excel no se actualiza por este plan. Su política de efectivo pendiente y sus cuotas 3/6 quedaron superadas por los acuerdos de acumulación y crédito 1/3/6.

## 5. Pruebas numéricas y de seguridad mínimas

| Caso | Resultado esperado |
| --- | --- |
| AXPRO sin extras | Vendedor Catálogo 449999, Alto 359999, Medio 259999, Bajo 149999; agente Telefónico 53000 |
| AXPRO + 2 PIR, kit Alto, 2 bonificados | Bolsa 210000; consumo 185829,864; total inicial 359999 |
| Caso anterior en efectivo | 323999,10; permitido aun inferior al piso 335828,86 de la composición en Bajo |
| AXPRO + 4 PIR + magnético + sirena, todo Alto con kit Catálogo | 1172391,26; no omitir el magnético |
| Kit Catálogo, bonificar 2 PIR y sirena valorados Bajo | Rechazado: 346028,796 supera bolsa 300000 |
| Cambio abono Alto a Bajo con misma instalación | Solo cambia mensualidad; no composición ni total inicial |
| Kit sin precio o deshabilitado | No generar/guardar nueva propuesta válida; conservar propuestas anteriores |
| Docta sin extras / Docta con extras cobrados | Ambas cuentan ventas; solo la segunda integra ticket inicial; ninguna integra ticket instalación/abono |
| Venta alarma + cámaras | Un cierre y un ticket inicial; dos conceptos, importes conciliados |
| RPC adulterada con Telefónico como vendedor | Rechazo en servidor; no revelar precio restringido por otra consulta |
| Reintento de aceptación y carrera de cierre | Una aceptación/cierre; conflicto explícito si versión cambió |
| Históricos sin importes o visitas | Sin imputación; conteo/cobertura informado y exclusión del indicador dependiente |

Importes de prueba basados en la planilla recibida y reglas confirmadas; no son datos para insertar en producción. El redondeo definitivo y la asignación de descuentos se verifican también con ventas multicategoría.
