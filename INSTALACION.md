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

Navegación en español, menú adaptable e interfaz comercial inicial. Login con Supabase Auth y roles administrador/vendedor; alta de usuarios reservada al administrador. Para activar la conexión, aplicar la migración y desplegar la función según `docs/AUTENTICACION.md`. Sin configuración el acceso permanece bloqueado. Los módulos comerciales continúan como pantallas informativas.

Hay formularios de login, creación de cuentas y cambio de contraseña propio; todavía no hay formularios ni operaciones comerciales. React Router usa fragmentos de URL (`#/prospectos`) para permitir recarga y navegación atrás/adelante sin reglas SPA adicionales del servidor. Los enlaces anteriores (`#prospectos`) siguen funcionando. No se realizó despliegue ni configuración remota de Vercel.

## Plantilla

- Documentación: https://zuramai.github.io/mazer/docs/index.html
- Distribución: https://github.com/zuramai/mazer/releases/tag/v2.3.1
- Recursos necesarios distribuidos localmente en `public/mazer`.
- Licencia MIT de Mazer incluida junto a sus recursos. Las personalizaciones se mantienen separadas de los archivos del proveedor.
