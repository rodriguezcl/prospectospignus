# Contratos de la ampliación comercial

Entrega 0, 01-10-2026. Complementa el rector V1.6; no habilita por sí sola ninguna tarifa.

## Autorización y secuencia

El titular autorizó el 01-10-2026 implementar continuamente las seis entregas (0 a 5), con commit, push y despliegue verificado por entrega. No incluye inventar precios, alterar el histórico, contratar servicios ni implementar pendientes contables.

## Fronteras y persistencia

- Productos: familias/marcas y artículos con versiones inmutables. Cada kit conserva sus componentes y cantidades. Desactivar excluye nuevas selecciones, no elimina versiones.
- Configuración: versiones de condiciones, separadas del catálogo. Las propuestas referencian ambas versiones.
- Prospectos: cada propuesta pertenece a una oportunidad y ciclo. Su revisión es inmutable; la aceptación referencia exactamente esa revisión. Una operación repetida devuelve la misma revisión, una solicitud distinta con igual clave se rechaza.
- Precio ausente es `null`, nunca cero implícito. Cero es un valor explícito. El servidor reconstruye la propuesta desde identificadores, niveles y cantidades: no acepta totales declarados por el navegador.
- Código: `PC-<UUID de revisión>-<ordinal de alternativa>`. El ordinal solo identifica dentro de esa revisión, no indica aprobación ni jerarquía. No abre carteras ajenas.
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

Sumar con precisión fuente y redondear el total final a centavos, mitad hacia arriba para importes no negativos. No redondear cada precio unitario antes de multiplicar. Efectivo se aplica sobre el total bonificado antes de su redondeo final. Crédito divide el total en centavos y asigna el resto a la última cuota. No modifica el abono.

**Pendiente de aprobación específica en rector 24.9:** distribución de descuentos globales entre conceptos de ventas combinadas. Propuesta técnica: reparto proporcional y ajuste por mayores restos con desempate por identificador estable. Hasta aprobarla no atribuir arbitrariamente ese descuento a instalación o adicionales para calcular tickets por concepto.

## Ciclos, origen y visitas

Guardar ciclo explícito al registrar visita realizada; la visita programada no se convierte automáticamente en realizada. Reactivar no mueve visitas previas. Origen propio/asignado es distinto del canal; desconocidos permanecen sin identificar. Registrar actor de carga y responsable comercial por separado.

Si participaron varios vendedores visitantes, conservar la evidencia de cada uno sin asignar por heurística el denominador a un solo vendedor: la regla gerencial requiere definición antes de habilitar esa comparación. La suma de revisitas nunca aumenta los casos únicos.

## Calendario y límites

Mes comercial en Córdoba y fechas UTC. Sin activación no hay vencimiento definitivo de congelamiento. La semántica de aniversario ante fin de mes queda pendiente de confirmación: propuesta de mismo día del mes destino, limitado al último día disponible. No sustituye IPC ni primera factura.

Enumeración de alternativas debe paginar e informar total exacto o rechazar explícitamente una selección demasiado grande, nunca truncar en silencio. Un límite de seguridad computacional no puede ocultarse como regla comercial. Orden descendente por importe; empate por composición estable. Cambio de selección invalida alternativas previas, no altera revisiones guardadas.

## Pruebas de referencia

Las pruebas de dinero verifican centavos y cuotas sin introducir tarifas productivas. Los ejemplos AXPRO de PLAN-COMERCIAL-V1.6 son fixtures exclusivamente. Las pruebas SQL usarán una base local descartable con identidades ficticias, no la base real ni el histórico de septiembre.
