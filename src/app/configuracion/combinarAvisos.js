export function combinarAvisos(oportunidades, promociones, agenda) {
  return {
    async notificaciones() {
      const [comerciales, ofertas, actividades] = await Promise.all([
        oportunidades.notificaciones(),
        promociones.notificaciones(),
        agenda ? agenda.notificaciones() : [],
      ]);
      return [
        ...actividades.map((n) => ({
          ...n,
          id: `agenda:${n.id}`,
          destino: `/agenda?id=${n.actividad_id}`,
        })),
        ...comerciales.map((n) => ({
          ...n,
          id: `caso:${n.id}`,
          destino: n.destino || `/cotizaciones?id=${n.oportunidad_id}`,
        })),
        ...ofertas.map((n) => ({
          ...n,
          id: `promo:${n.id}`,
          destino: `/promociones?id=${n.promocion_id}`,
        })),
      ]
        .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
        .slice(0, 50);
    },
    leer(id) {
      const [tipo, numero] = id.split(":");
      if (tipo === "agenda") return agenda.leer(numero);
      return tipo === "promo"
        ? promociones.leer(numero)
        : oportunidades.leer(numero);
    },
  };
}
