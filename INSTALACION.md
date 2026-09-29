# Prospectos Pignus — interfaz inicial

Aplicación React sobre Vite y Mazer 2.3.1 (Bootstrap), conservando estilos, fuentes e iconos. Personalización en `src/shared/ui/estilos/personalizacion.css`; composición en `src/app` y páginas en `src/features`. Leer `docs/ARQUITECTURA.md` antes de modificarla.

## Ejecución

Requiere Node.js 22 y npm.

```sh
npm install
npm run dev
```

La terminal informa la dirección local. Para generar la distribución: `npm run build`. Para revisarla: `npm run preview`. Pruebas de compatibilidad de enlaces: `npm test`. No hay lint configurado.

## Alcance

Navegación en español, menú adaptable a móvil y escritorio, inicio y pantallas informativas para los módulos del documento rector. No hay autenticación, base de datos, registros comerciales ni métricas simuladas. Los menús administrativos son una vista de desarrollo; los permisos reales deberán implementarse en servidor.

No se implementan todavía formularios, exportaciones, asignación ni cambios de estado. React Router usa fragmentos de URL (`#/prospectos`) para permitir recarga y navegación atrás/adelante sin reglas SPA adicionales del servidor. Los enlaces anteriores (`#prospectos`) siguen funcionando. No se realizó despliegue ni configuración remota de Vercel.

## Plantilla

- Documentación: https://zuramai.github.io/mazer/docs/index.html
- Distribución: https://github.com/zuramai/mazer/releases/tag/v2.3.1
- Recursos necesarios distribuidos localmente en `public/mazer`.
- Licencia MIT de Mazer incluida junto a sus recursos. Las personalizaciones se mantienen separadas de los archivos del proveedor.
