export function combinarAvisos(oportunidades, promociones) {
  return {
    async notificaciones() {
      const [comerciales, ofertas] = await Promise.all([
        oportunidades.notificaciones(),
        promociones.notificaciones(),
      ]);
      return [
        ...comerciales.map((n) => ({
          ...n,
          id: `caso:${n.id}`,
          destino: `/prospectos?id=${n.oportunidad_id}`,
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
      return tipo === "promo"
        ? promociones.leer(numero)
        : oportunidades.leer(numero);
    },
  };
}
