export function agregarAvisosDolar(avisos, dolar) {
  return {
    async notificaciones() {
      const [existentes, aumentos] = await Promise.all([
        avisos.notificaciones(),
        dolar.notificaciones(),
      ]);
      return [...existentes, ...aumentos]
        .sort((a, b) => new Date(b.creado_en) - new Date(a.creado_en))
        .slice(0, 50);
    },
    leer(id) {
      return id.startsWith("dolar:") ? dolar.leer(id) : avisos.leer(id);
    },
  };
}
