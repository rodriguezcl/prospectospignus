import { instanteCordoba } from "../../../shared/domain/fechaCordoba.js";

export function prepararVisitaInicial(entrada) {
  const inicio = instanteCordoba(entrada.visita_inicio);
  const fin = instanteCordoba(entrada.visita_fin);
  if (!inicio) throw new Error("Elegí una fecha y hora para la visita.");
  // El servidor exige inicio futuro en el alta; un reintento de un alta ya
  // confirmada debe poder recuperar su resultado aunque esa hora haya pasado.
  if (fin && new Date(fin) <= new Date(inicio))
    throw new Error(
      "La finalización de la visita debe ser posterior al inicio.",
    );
  const nota = (entrada.visita_nota ?? "").trim();
  if (nota.length > 2000)
    throw new Error(
      "Las indicaciones de la visita admiten hasta 2000 caracteres.",
    );
  return { inicio_previsto: inicio, fin_previsto: fin, nota };
}
