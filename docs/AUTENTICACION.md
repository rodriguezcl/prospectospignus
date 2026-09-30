# Acceso y cuentas de usuario

## Alcance implementado

Supabase Auth con correo y contraseña, cierre de sesión local, cambio de contraseña propio y alta de cuentas por administrador. No hay autorregistro ni usuario predeterminado. Dos roles iniciales: administrador y vendedor. Estos sustituyen, para esta entrega, las funciones múltiples previstas a futuro por el documento rector.

Vendedor: Inicio, Registros iniciales, Prospectos, Oportunidades, Gestiones, Próximas acciones y Mi cuenta. Administrador: además Usuarios, Supervisión, Informes, Configuración y Auditoría. Los módulos comerciales siguen siendo placeholders; esto no implementa permisos sobre datos comerciales inexistentes. Al incorporarlos, deberán tener RLS por responsable y políticas explícitas.

El alta usa contraseña inicial elegida por el administrador y correo confirmado administrativamente; no envía invitaciones ni comprueba propiedad del correo mediante un mensaje. El administrador verifica el destinatario y entrega las credenciales por un canal privado. El usuario puede cambiar su contraseña desde Mi cuenta. Recuperación por correo, edición de roles y desactivación desde UI quedan fuera de esta entrega.

## Activación en un proyecto Supabase nuevo o dedicado

1. Crear o elegir el proyecto correcto. La migración agrega un trigger sobre auth.users que limita altas a Pignus; no aplicarlo en un proyecto compartido con otras aplicaciones sin revisar ese impacto. No se ejecutó ninguna migración remota desde esta tarea.
2. Aplicar las migraciones de `supabase/migrations` en orden. La `202609290001` crea perfiles, eventos de alta y políticas RLS; la `202609290002` corrige el momento de validación de las altas. En instalaciones existentes aplicar solo la segunda, sin repetir la creación de tablas.
3. En Auth, deshabilitar el registro público y fijar mínimo de contraseña en 10 caracteres. `supabase/config.toml` declara la configuración local, pero no garantiza que el Dashboard remoto adopte estos valores: verificarlos explícitamente. Al cambiar esta política también se debe publicar la función `crear-usuario` y el frontend; el cambio local no actualiza el entorno desplegado.
4. Desplegar la Edge Function `crear-usuario`. `verify_jwt = false` desactiva únicamente la comprobación heredada del gateway: el manejador verifica obligatoriamente el token con Auth `getUser(token)` y consulta el perfil actual antes de usar Admin API. No quitar esas validaciones.
5. Configurar el secreto `ORIGENES_PERMITIDOS` de la función con orígenes exactos separados por comas, por ejemplo `http://127.0.0.1:5174,http://localhost:5174`. Agregar el origen productivo al desplegar; evitar comodines. Las credenciales de servidor se leen del entorno Supabase, nunca del navegador.
6. Crear el primer administrador con el script privado descrito abajo.
7. Copiar `.env.example` a `.env.local` y completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_CLAVE_PUBLICA` (publishable o anon). Reiniciar Vite. No colocar ninguna clave service_role o secret en archivos VITE_*.
8. Ingresar como administrador, abrir Usuarios y crear las cuentas. Sin configuración el login queda bloqueado, sin modo demo ni bypass.

## Primer administrador

El script `scripts/crear-primer-administrador.mjs` debe ejecutarse en un entorno privado con estas variables temporales:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PIGNUS_ADMIN_NOMBRE`
- `PIGNUS_ADMIN_CORREO`
- `PIGNUS_ADMIN_CLAVE`

Ejecutar `node scripts/crear-primer-administrador.mjs`. Inyectar secretos mediante el entorno seguro del operador, no incluirlos en comandos compartidos ni repositorio. El script no imprime claves y rechaza un proyecto con perfiles existentes. Limpiar variables temporales al terminar. La creación de Auth, perfil y evento de alta es atómica gracias al trigger; un bloqueo transaccional evita dos inicializaciones simultáneas.

## Seguridad y límites

- Auth inserta el usuario antes de actualizar `app_metadata` dentro de la misma transacción. El trigger de alta es una restricción diferida hasta el COMMIT y consulta la fila final: no utiliza los metadatos iniciales de `NEW`. Si falta autorización, se revierte toda la transacción. El perfil y el evento se crean antes de confirmar, no mediante una tarea posterior. Referencia: `adminUserCreate` en https://github.com/supabase/auth/blob/master/internal/api/admin.go.

- El rol autorizado reside en `public.perfiles`. Solo servidor puede escribirlo. Nunca se toma de `user_metadata` ni de una elección del login.
- La función verifica sesión real, perfil activo y rol administrador; vuelve a validarse el responsable dentro del trigger. El actor procede del token, no del cuerpo.
- RLS permite a un vendedor leer solamente su perfil activo y a un administrador activo consultar perfiles. No hay permisos de escritura para authenticated/anon.
- El trigger ignora user_metadata y acepta únicamente app_metadata privilegiada. El bootstrap requiere que todavía no existan perfiles y que el primer rol sea administrador.
- Los secretos viven solo en servidor. El frontend usa una única instancia Supabase y el SDK administra la sesión.
- Al revocar acceso, RLS y las verificaciones servidor impiden operaciones. La interfaz vuelve a verificar perfil ante eventos Auth o al recuperar foco; no se promete cierre visual instantáneo entre dispositivos.
- Límites de intentos de login dependen de Auth; activar protecciones adicionales según el despliegue. El endpoint de cuentas es solo administrativo.

## Validación antes de habilitar usuarios reales

`npm test` cubre roles, falta de perfil, validación de cuentas y endpoint con dependencias controladas. También ejecuta la migración real en PostgreSQL embebido (PGlite), con una tabla Auth mínima de prueba: comprueba lectura por propietario, lectura administrativa, denegación de escritura/escalamiento, usuario inactivo, autorregistro rechazado y eventos de alta. No sustituye la integración con Supabase Auth real ni el despliegue de Edge Functions.

En el proyecto configurado comprobar: login correcto/incorrecto; persistencia al recargar; logout; creación de ambos roles; correo repetido; cambio de contraseña; acceso directo de vendedor a /usuarios; intento directo al endpoint con token vendedor/ausente; lectura de perfiles ajenos; intento de UPDATE del rol con clave pública; autorregistro directo rechazado; desactivación de perfil; fallo de red sin desbloquear contenido. Deben fallar las operaciones no autorizadas aunque se modifique el navegador.

## Gestión de cuentas existentes

Aplicar `202609300005_gestion_cuentas.sql` después de las migraciones anteriores y antes de publicar este frontend. La migración agrega versión al perfil, snapshots/motivo a auditoría y la RPC `gestionar_cuenta`; no modifica roles ni estados existentes. No requiere una Edge Function nueva. Código local y pruebas no implican migración remota aplicada.

- Administrador activo: editar nombre y rol, desactivar, reactivar y eliminar cuentas sin actividad comercial. Correo y contraseña quedan fuera de la edición.
- Todos los cambios requieren motivo y versión vigente; identidad procede del JWT, no del cuerpo. Los cambios de cuentas y altas comparten bloqueo transaccional. No se permite quitar acceso al último administrador ni cambiar el propio rol, desactivar o eliminar la propia cuenta.
- Desactivar conserva cartera y auditoría; no reasigna registros. RLS y operaciones del servidor consultan el perfil activo en cada solicitud. No equivale a banear la identidad en Supabase Auth ni a borrar el token del dispositivo; la interfaz puede conservar datos ya descargados hasta recuperar foco/recargar.
- Eliminar exige escribir el correo exacto, comprueba creador, responsable actual e histórico, actor de eventos, cuentas creadas y auditoría como actor de otras cuentas. Un nombre/rol editado o desactivación no impide eliminar una cuenta sin actividad comercial: sus eventos administrativos se conservan. Nunca elimina registros comerciales ni su historial.
- La eliminación directa y acotada de la fila `auth.users` conserva atomicidad con perfil y auditoría; las FK restantes pueden rechazarla. No utiliza soft-delete ni borra archivos de Storage. Supabase documenta la eliminación directa y advierte que tokens emitidos pueden seguir vigentes; Pignus impide su acceso por ausencia de perfil: [gestión de usuarios](https://supabase.com/docs/guides/auth/managing-user-data). Si se incorporan Storage u otras entidades, revisar vínculos y políticas antes de habilitarlos.
- Cuentas con `lote_demostracion` no admiten estas operaciones; su retiro sigue siendo la limpieza explícita del lote.

Pruebas: PostgreSQL embebido verifica permisos, último administrador, revocación por perfil, conflictos de versión, auditoría, historial de responsables y eliminación atómica de identidad/perfil. El esquema Auth mínimo de prueba no sustituye una prueba integrada en Supabase: al desplegar validar con una cuenta descartable expresamente autorizada (nunca borrar cuentas reales para probar).

## Arquitectura

`app/configuracion/servicios.js` compone repositorios Supabase y casos de uso a través de entradas `composicion.js` explícitas de las features. `autenticacion` posee sesión y reglas de acceso; `usuarios` valida y administra altas. Ambas features son independientes. `app` consume sus APIs y coordina rutas/menú. La barra compartida recibe la UI de cuenta como propiedad. No hay SDK en presentación ni dependencias de dominio hacia infraestructura.
