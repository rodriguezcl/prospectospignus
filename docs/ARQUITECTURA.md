# Constitución arquitectónica de Prospectos Pignus

## Alcance y principios

Organizar por funcionalidades, con alta cohesión, bajo acoplamiento, composición y dependencias hacia las reglas comerciales. Aplicar Clean Code, SOLID y Clean Architecture de manera proporcional a necesidades reales. El documento rector conserva autoridad sobre las reglas comerciales. La visión futura de CRM no incorpora Clientes, Stock ni Operaciones al alcance actual.

## Estructura actual

- `src/principal.jsx`: entrada React y compatibilidad de enlaces.
- `src/app`: composición, router, configuración concreta del menú y layout global. Sin reglas comerciales.
- `src/features/<funcionalidad>/presentation`: páginas de cada módulo; API pública explícita en `index.js`.
- `src/shared/ui`: componentes visuales reutilizados, navegación y estilos Mazer.
- `public/mazer`: distribución del proveedor y licencia, separada de personalizaciones.

No existen todavía capas de dominio, aplicación ni infraestructura. No crear carpetas vacías, repositorios ficticios, proveedores globales preventivos ni datos comerciales simulados.

## Dependencias e imports

1. `app` compone las APIs públicas de features y los componentes compartidos. En el futuro conectará también las implementaciones de infraestructura.
2. `presentation` depende de su aplicación/dominio y de UI compartida; nunca de adaptadores Supabase.
3. `application` coordina casos de uso y define los puertos externos que estos necesitan; depende del dominio, no de SDK externos.
4. `domain` contiene reglas puras. No importa React, Mazer, Supabase, DOM, HTTP, hosting ni otras capas.
5. `infrastructure` implementa los puertos y depende de las capas internas; nunca al revés.
6. `shared` no importa features ni app. Los componentes reciben configuración y acciones como propiedades.
7. No hay dependencias entre features. Toda excepción futura se documenta y utiliza APIs públicas; prohibidos ciclos e imports cruzados a internals.
8. Imports relativos inicialmente. Reexportaciones explícitas solamente en límites de features, sin barrels globales.

Mazer se utiliza solo en presentación y UI compartida. React controla el DOM y las interacciones; no importar el JavaScript de demostración de Mazer ni duplicar Bootstrap/iconos.

## Criterios de crecimiento

Crear una feature cuando haya una responsabilidad funcional con dueño claro. Un placeholder solo necesita presentación. Extraer componentes compartidos cuando haya consumidores reales o responsabilidad global de UI, no por similitud hipotética.

Crear dominio al aparecer reglas comerciales independientes de la UI. Crear un caso de uso cuando se coordinen reglas y operaciones. Crear un contrato de repositorio cuando haya una frontera real de persistencia: métodos mínimos, funciones/JSDoc posibles, sin exigir clases. Implementar el adaptador específico dentro de la feature y conectarlo desde app.

Un futuro cliente Supabase compartido pertenecerá a `src/infrastructure`; un adaptador comercial a `features/<funcionalidad>/infrastructure`. Una única creación del cliente, sin consultas dispersas en JSX. No instalarlo ni crear variables de entorno antes de necesitarlo.

## Estado, errores y seguridad

Estado de UI local y composición. Context solo cuando sea global; evaluar el estado servidor cuando exista, sin incorporar Redux/Zustand preventivamente.

Distinguir errores de validación, dominio, autenticación/autorización, infraestructura e inesperados. Los adaptadores traducen fallos externos; presentación muestra mensajes comprensibles sin secretos ni detalles internos. Crear tipos o clases al existir consumidores reales.

Ocultar enlaces no autoriza operaciones. La futura integración aplicará RLS y validaciones servidor. Nunca exponer service_role ni secretos en VITE_*. No hay autenticación ni autorización implementadas actualmente.

## Routing y accesibilidad

HashRouter mantiene el hosting independiente de las features. `#prospectos` se normaliza a `#/prospectos` conservando consultas; destinos desconocidos muestran 404. El menú y los accesos de Inicio reciben destinos desde app.

Menú móvil con foco inicial, contención de Tab, Escape, fondo inerte y restauración de foco. Menú oculto inerte, indicador activo, salto al contenido y movimiento reducido. Los cambios de ruta actualizan título y foco.

## Verificación y evolución

Ejecutar `npm run build`, `npm test` y cualquier lint que exista. Verificar rutas, atrás/adelante, refresh, 404, consola y layout a diferentes anchos. No hay lint configurado todavía. Probar reglas sin React y casos de uso sin Supabase cuando aparezcan; evitar tests que solo reproduzcan código.

Antes de cada implementación: identificar dominio, capa, abstracción existente y dirección de dependencias. Documentar excepciones. Preservar cambios preexistentes; no desplegar ni modificar servicios remotos sin alcance autorizado.
