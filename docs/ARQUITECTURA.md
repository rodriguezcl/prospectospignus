# Constitución arquitectónica de Prospectos Pignus

## Alcance y principios

Organizar por funcionalidades, con alta cohesión, bajo acoplamiento, composición y dependencias hacia las reglas comerciales. Aplicar Clean Code, SOLID y Clean Architecture de manera proporcional a necesidades reales. El documento rector conserva autoridad sobre las reglas comerciales. La visión futura de CRM no incorpora Clientes, Stock ni Operaciones al alcance actual.

## Estructura actual

- `src/principal.jsx`: entrada React y compatibilidad de enlaces.
- `src/app`: composición, router, configuración concreta del menú y layout global. Sin reglas comerciales.
- `src/features/<funcionalidad>/presentation`: páginas de cada módulo; API pública explícita en `index.js`.
- `src/shared/ui`: componentes visuales reutilizados, navegación y estilos Mazer.
- `public/mazer`: distribución del proveedor y licencia, separada de personalizaciones.

Las features `autenticacion`, `usuarios` y `registros-iniciales` incorporan dominio, aplicación e infraestructura porque ya existe una frontera real con Supabase. El cliente compartido vive en `src/infrastructure/supabase`; la composición explícita se realiza desde `app/configuracion/servicios.js` mediante entradas `composicion.js` de cada feature. Las demás features siguen siendo presentación. No crear carpetas vacías, repositorios ficticios ni datos comerciales simulados.

Registros iniciales recibe el perfil desde la composición de rutas, sin importar internals de autenticación. Lecturas bajo RLS y escrituras por RPC transaccional con validación de actor, versión e historial. Su catálogo y sus políticas son propios; no modifica los permisos de lectura de perfiles para mostrar nombres de terceros. La primera entrega y sus límites están documentados en `INSTALACION.md`.

## Dependencias e imports

`inicio` incorpora dominio, aplicación e infraestructura para el resumen mensual real bajo RLS. La carga sintética explícitamente autorizada se mantiene fuera del frontend y de las migraciones automáticas, en `supabase/demostracion`, con manifiesto y limpieza acotada (ver `docs/DEMOSTRACION.md`). No es un backend simulado.

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

El cliente Supabase compartido pertenece a `src/infrastructure`; cada adaptador a `features/<funcionalidad>/infrastructure`. Una única creación del cliente, sin consultas dispersas en JSX. La entrada pública de composición es exclusiva para app; presentación no importa esa entrada. Las rutas protegidas y el menú consumen la API pública de autenticación; usuarios recibe su caso de uso como propiedad, sin importar otra feature.

## Estado, errores y seguridad

Estado de UI local y composición. Context solo cuando sea global; evaluar el estado servidor cuando exista, sin incorporar Redux/Zustand preventivamente.

Distinguir errores de validación, dominio, autenticación/autorización, infraestructura e inesperados. Los adaptadores traducen fallos externos; presentación muestra mensajes comprensibles sin secretos ni detalles internos. Crear tipos o clases al existir consumidores reales.

Ocultar enlaces no autoriza operaciones. La integración de acceso utiliza Supabase Auth, RLS para perfiles y una Edge Function que exige administrador activo para crear cuentas. Nunca exponer service_role ni secretos en VITE_*. La activación y las pruebas reales de servidor se describen en `docs/AUTENTICACION.md`; no confundir el código local con un despliegue completado.

La gestión posterior de cuentas utiliza la RPC transaccional `gestionar_cuenta`: valida administrador activo por `auth.uid()`, versión, motivo, último administrador y vínculos históricos. Editar afecta únicamente nombre/rol del perfil; desactivar afecta elegibilidad en Pignus, sin cambiar credenciales Auth. La eliminación limitada de una cuenta sin actividad comercial borra `auth.users` y su perfil por FK en una única transacción privilegiada, preservando eventos de cuenta. Esta integración puntual con el esquema Auth requiere verificación en Supabase al desplegar; no expone permisos directos de escritura al navegador. Cada nueva entidad comercial debe ampliar las comprobaciones de eliminación antes de habilitarse.

## Routing y accesibilidad

HashRouter mantiene el hosting independiente de las features. `#prospectos` se normaliza a `#/prospectos` conservando consultas; destinos desconocidos muestran 404. El menú y los accesos de Inicio reciben destinos desde app.

Menú móvil con foco inicial, contención de Tab, Escape, fondo inerte y restauración de foco. Menú oculto inerte, indicador activo, salto al contenido y movimiento reducido. Los cambios de ruta actualizan título y foco.

## Verificación y evolución

El circuito de calificación, visita y recuperación pertenece a `oportunidades`, con dominio puro, casos de uso y adaptador RPC. La página de consulta `prospectos` recibe el puerto de lectura desde `app`, sin importar internals de otra feature. La calificación crea un Prospecto independiente y una oportunidad por necesidad. Los eventos de oportunidad representan las gestiones de esta entrega; las pantallas generales de Gestiones y Próximas acciones no se reemplazan por un segundo almacenamiento. La próxima acción y el historial se consultan en Oportunidades.

La migración 006 extiende Agente en perfiles, altas y gestión de cuentas, conserva el bloqueo compartido de cambios de elegibilidad y agrega protección de cuentas con actividad. RLS restringe carteras y habilita la cola común de recuperación para agentes. Las escrituras transaccionales requieren versión y UUID de operación; no hay DML directo desde el navegador. La campana consulta avisos persistentes cada 30 segundos y al recuperar foco; no usa notificaciones push externas. Las lecturas paginadas y los errores de migración pendiente son explícitos.

Ejecutar `npm run build`, `npm test` y cualquier lint que exista. Verificar rutas, atrás/adelante, refresh, 404, consola y layout a diferentes anchos. No hay lint configurado todavía. Probar reglas sin React y casos de uso sin Supabase cuando aparezcan; evitar tests que solo reproduzcan código.

Antes de cada implementación: identificar dominio, capa, abstracción existente y dirección de dependencias. Documentar excepciones. Preservar cambios preexistentes; no desplegar ni modificar servicios remotos sin alcance autorizado.

Las migraciones 007/008 agregan reactivación por ciclos e importación histórica. Reactivar es una RPC con RLS en lectura, permisos de responsable/administrador, versión y operación idempotente, evento y aviso atómicos. La importación es una operación exclusiva del operador de base, no un endpoint del navegador. Su plantilla vive en `supabase/importacion`; el preparador local no accede a la red ni modifica el Excel. Configuración con IDs y SQL con datos personales quedan fuera del repositorio. Los campos históricos desconocidos son nulos; no se relajan las validaciones de alta normal de la RPC 006. Inicio consulta una proyección histórica bajo RLS y conserva resultado original y estado actual por separado. Los registros importados no se cuentan como captación del día de importación.
