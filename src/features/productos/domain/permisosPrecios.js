export const nivelesDePrecio = {
  catalogo: "Catálogo",
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
  telefonico: "Telefónico",
};
export const rolesDePrecio = { vendedor: "Vendedor", agente: "Agente" };

export function permisosPreciosIniciales() {
  return {
    vendedor: ["catalogo", "alto", "medio", "bajo"],
    agente: Object.keys(nivelesDePrecio),
  };
}

export function validarPermisosPrecios(permisos) {
  if (
    !permisos ||
    typeof permisos !== "object" ||
    Array.isArray(permisos) ||
    Object.keys(permisos).length !== 2 ||
    Object.keys(rolesDePrecio).some((rol) => {
      const niveles = permisos[rol];
      return (
        !Array.isArray(niveles) ||
        new Set(niveles).size !== niveles.length ||
        niveles.some((nivel) => !Object.hasOwn(nivelesDePrecio, nivel))
      );
    })
  )
    throw new Error("Revisá los niveles habilitados para vendedor y agente.");
  return Object.fromEntries(
    Object.keys(rolesDePrecio).map((rol) => [
      rol,
      Object.keys(nivelesDePrecio).filter((nivel) =>
        permisos[rol].includes(nivel),
      ),
    ]),
  );
}
