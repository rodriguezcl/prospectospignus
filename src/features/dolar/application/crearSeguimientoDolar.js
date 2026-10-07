const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

export function crearSeguimientoDolar({ usuario, consultar, almacenamiento }) {
  const clave = `pignus:dolar:bna-respaldo-oficial:${usuario}`;
  let estado = { ultimo: null, avisos: [] };
  function recuperar() {
    try {
      const guardado = JSON.parse(almacenamiento.getItem(clave));
      if (
        guardado &&
        Array.isArray(guardado.avisos) &&
        (!guardado.ultimo ||
          (Number.isFinite(guardado.ultimo.venta) &&
            guardado.ultimo.venta > 0 &&
            Number.isFinite(Date.parse(guardado.ultimo.fechaActualizacion))))
      ) {
        estado = guardado;
      }
    } catch {
      /* Almacenamiento bloqueado: conservar la referencia de esta sesión. */
    }
  }
  function guardar() {
    try {
      almacenamiento.setItem(clave, JSON.stringify(estado));
    } catch {
      /* Respaldo en memoria. */
    }
  }
  return {
    async consultar(tipo, signal) {
      const nuevo = await consultar(tipo, signal);
      if (signal?.aborted || tipo !== "oficial") return nuevo;
      recuperar();
      const anterior = estado.ultimo;
      // Respuestas atrasadas o repetidas no retroceden la referencia ni duplican avisos.
      if (
        anterior &&
        anterior.proveedor === nuevo.proveedor &&
        Date.parse(nuevo.fechaActualizacion) <=
          Date.parse(anterior.fechaActualizacion)
      )
        return anterior;
      if (anterior && nuevo.venta > anterior.venta) {
        estado.avisos.unshift({
          id: `dolar:${Date.parse(nuevo.fechaActualizacion)}`,
          mensaje: `Subió el dólar oficial (venta): de ${pesos.format(anterior.venta)} a ${pesos.format(nuevo.venta)} (+${pesos.format(nuevo.venta - anterior.venta)}).`,
          creado_en: nuevo.fechaActualizacion,
        });
      }
      estado.ultimo = nuevo;
      guardar();
      return nuevo;
    },
    async notificaciones() {
      recuperar();
      return estado.avisos;
    },
    async leer(id) {
      recuperar();
      estado.avisos = estado.avisos.filter((aviso) => aviso.id !== id);
      guardar();
    },
  };
}
