import { validarCuenta } from "../domain/cuenta.js";
import { validarGestionCuenta } from "../domain/gestionCuenta.js";

export function crearGestionUsuarios(repositorio) {
  return {
    listar: () => repositorio.listar(),
    crear: (datos) => repositorio.crear(validarCuenta(datos)),
    gestionar: (datos) => repositorio.gestionar(validarGestionCuenta(datos)),
  };
}
