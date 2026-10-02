# Contratos de la ampliación comercial

Entrega 0, 01-10-2026. Complementa el rector V1.6; no habilita por sí sola ninguna tarifa.

## Autorización y secuencia

El titular autorizó el 01-10-2026 implementar continuamente las seis entregas (0 a 5), con commit, push y despliegue verificado por entrega. No incluye inventar precios, alterar el histórico, contratar servicios ni implementar pendientes contables.

## Fronteras y persistencia

- Productos: familias/marcas y artículos con versiones inmutables. Cada kit conserva sus componentes y cantidades. Desactivar excluye nuevas selecciones, no elimina versiones.
- Configuración: versiones de condiciones, separadas del catálogo. Las propuestas referencian ambas versiones.
- Prospectos: cada propuesta pertenece a una oportunidad y ciclo. Su revisión es inmutable; la aceptación referencia exactamente esa revisión. Una operación repetida devuelve la misma revisión, una solicitud distinta con igual clave se rechaza.
- Precio ausente es `null`, nunca cero implícito. Cero es un valor explícito. El servidor reconstruye la propuesta desde identificadores, niveles y cantidades: no acepta totales declarados por el navegador.
- Código guardado: `PC-<UUID de revisión>`, único e inmutable. Cada concepto conserva nivel y distribución exacta de adicionales; el ordinal declarado de la simulación no acredita jerarquía ni aprobación. Las alternativas locales usan `SIM-<UUID de selección>-<ordinal>` y cambian al modificar la selección; no son propuestas persistidas ni códigos de autorización. No abren carteras ajenas.
- Los eventos existentes siguen siendo autoridad del cierre. Una proyección de ciclos sirve para consulta y debe conciliar con ellos; no crear una segunda acción de venta.

## Permisos mínimos

| Operación | Administrador | Vendedor | Agente |
| --- | --- | --- | --- |
| Modificar catálogo y condiciones | Sí | No | No |
| Consultar precios normales habilitados | Sí | Sí | Sí |
| Obtener precios Telefónicos | Sí | Nunca, tampoco por API | Solo para recuperación autorizada |
| Proponer / aceptar | Caso autorizado, atribuido a su responsable | Caso propio abierto fuera de recuperación | Recuperación asignada |
| Activar servicio | Sí, con respaldo | No | No |
| Métricas | Equipo autorizado | Propias | Propias |

RLS, RPC y validación activa de perfil son obligatorias. Referencias a perfiles conservan historial; no eliminar cuentas referenciadas. Escrituras serializan elegibilidad con el bloqueo 740127 y verifican versión de ficha, catálogo y configuración.

## Precisión

Representar precios fuente como cadenas decimales, hasta seis decimales, con cálculo entero escalado; PostgreSQL `numeric`, no float. Cantidades por unidad/pack enteras; metros hasta tres decimales. Rechazar valores negativos, no finitos o fuera de precisión, nunca redondear una tarifa silenciosamente al cargarla.

Sumar con precisión fuente (hasta nueve decimales al multiplicar metros) y redondear el total acordado a centavos, mitad hacia arriba para importes no negativos. No redondear cada precio unitario antes de multiplicar. Para conciliar pago mixto, la base asignada a efectivo se declara en centavos sobre ese total acordado: descuento = 10 % de esa base redondeado a centavos, efectivo a entregar = base efectivo − descuento. Saldo = total acordado − base efectivo. Crédito divide ese saldo en centavos y asigna el resto a la última cuota. No modifica el abono. Es una regla de precisión del cotizador, no redondeo de IPC/facturas.

**Aprobado durante implementación:** distribución proporcional del descuento global entre kit/instalación y adicionales, ajuste por mayores restos y desempate estable. Conservar importes brutos exactos y descuento global. Conciliar primero centavos brutos por componentes y luego centavos de descuento, sin duplicar ni perder importes.

## Ciclos, origen y visitas

Guardar ciclo explícito al registrar visita realizada; la visita programada no se convierte automáticamente en realizada. Reactivar no mueve visitas previas. Origen propio/asignado es distinto del canal; desconocidos permanecen sin identificar. Registrar actor de carga y responsable comercial por separado.

Si participaron varios vendedores visitantes, cada uno cuenta una vez el caso/ciclo en sus visitas; la venta pertenece únicamente a quien la cerró. Empresa deduplica el caso/ciclo una vez. La suma de revisitas nunca aumenta los casos únicos. No sumar denominadores individuales como total de empresa.

La cohorte mensual es la primera visita realizada del caso/ciclo, común a sus participantes aunque una revisita de otro vendedor ocurra más tarde. El detalle individual permite conciliar el denominador. Conversión propia = casos de esa cohorte cerrados por la misma persona / casos visitados por ella en esa cohorte. Recuperados por otro se informan separados; los resultados evolucionan con cierres posteriores. Ventas monetarias usan el mes de cierre, nunca ese denominador. Visitas sin caso/ciclo explícito no se imputan retrospectivamente.

Los tickets inicial, instalación y abono promedian solamente ventas con importe positivo conocido en su concepto; se muestran denominadores y ventas con/sin importe/desconocidas. Totales monetarios parciales se rotulan informados. Categorías de ventas combinadas son conteos superpuestos, no sumables. El abono es el aceptado originalmente, sin IPC. Detalles paginados y agregados consultan las mismas proyecciones autorizadas; al actualizar pueden reflejar eventos posteriores al corte previo.

## Calendario y límites

Mes comercial en Córdoba y fechas UTC. Sin activación no hay vencimiento definitivo de congelamiento. Confirmado: mismo día del mes destino como fin exclusivo cuando existe; si no existe, último día del mes destino INCLUSIVE. No sustituye IPC ni primera factura. Ver rector 24.14 para ajustes sujetos a aprobación administrativa y límites contables.

Enumeración de alternativas debe paginar e informar total exacto o rechazar explícitamente una selección demasiado grande, nunca truncar en silencio. Un límite de seguridad computacional no puede ocultarse como regla comercial. Orden descendente por importe; empate por composición estable. Cambio de selección invalida alternativas previas, no altera revisiones guardadas.

## Pruebas de referencia

Las pruebas de dinero verifican centavos y cuotas sin introducir tarifas productivas. Los ejemplos AXPRO de PLAN-COMERCIAL-V1.6 son fixtures exclusivamente. Las pruebas SQL usarán una base local descartable con identidades ficticias, no la base real ni el histórico de septiembre.
