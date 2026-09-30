import { validarArchivo, validarPromocion } from "../domain/promocion.js";
export function crearGestionPromociones(repositorio) {
  return {
    listar: repositorio.listar,
    detalle: repositorio.detalle,
    notificaciones: repositorio.notificaciones,
    leer: repositorio.leer,
    descargar: repositorio.descargar,
    confirmar: repositorio.confirmar,
    guardar(entrada) {
      return repositorio.guardar({
        ...entrada,
        datos: ["crear", "editar"].includes(entrada.accion)
          ? validarPromocion(entrada.datos)
          : entrada.datos,
      });
    },
    async subir(promocion, archivo) {
      validarArchivo(
        archivo,
        new Uint8Array(await archivo.slice(0, 12).arrayBuffer()),
      );
      const id = crypto.randomUUID();
      await repositorio.guardar({
        id: promocion.id,
        version: promocion.version,
        operacion: crypto.randomUUID(),
        accion: "reservar_archivo",
        datos: {
          id,
          nombre: archivo.name,
          tipo: archivo.type,
          bytes: archivo.size,
        },
      });
      // Si falla Storage, queda pendiente y nunca se publica como disponible.
      await repositorio.subir(`${promocion.id}/${id}`, archivo);
      await repositorio.confirmar(id);
    },
  };
}
