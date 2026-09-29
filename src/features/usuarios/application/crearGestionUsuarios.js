import { validarCuenta } from "../domain/cuenta.js";

export function crearGestionUsuarios(repositorio) {
  return {
    listar: () => repositorio.listar(),
    crear: (datos) => repositorio.crear(validarCuenta(datos)),
  };
}
