# Iconos de Prospectos Pignus

Diseño blanco sobre azul petróleo para distinguirlo de la aplicación institucional verde. No cambia el logo del menú ni los colores comerciales.

Maestro generado con la herramienta integrada de imágenes: `public/iconos/pignus-maestro.png`. Exportaciones con `scripts/exportar-iconos.ps1` (PowerShell y System.Drawing): favicon ICO 16/32/48, PNG 32/192/512, Apple Touch Icon 180 y Android maskable 512 con margen adicional. Todos derivan del mismo maestro. No se modifica el original del usuario.

Prompt utilizado:

> Use case: precise-object-edit. Edit target: attached institutional Pignus owl mark. Produce one production app icon, square 1024x1024. Preserve the distinctive white line-art owl silhouette, angular brow and beak, narrow upright head at left and long sweeping wing diagonally toward bottom right. Refine jagged low-resolution edges into smooth crisp balanced white strokes, slightly bold for small icon readability. Center optically on solid dark petroleum BLUE #123B50, not green, full bleed background, NO rounded corners (OS will mask). Keep entire owl within central 64% width and 64% height for maskable mobile icon safety. Flat two-color graphic, no text, no shadows, no gradient, no 3D, no extra elements. Faithfully preserve recognizable original mark, do not substitute a generic owl. Output only the icon.

Integración: `index.html` y `public/site.webmanifest`. El acceso inicia en `/#/inicio`; la autenticación vigente determina el acceso. No se agrega service worker, caché de datos comerciales, modo sin conexión ni notificaciones push. La instalación y el recorte final dependen del navegador/sistema; los accesos anteriores pueden requerir eliminarse y volver a añadirse después del despliegue. Validar en dispositivos iOS y Android reales.

Referencias: [Apple: iconos web](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) y [MDN: iconos y máscaras](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons).
