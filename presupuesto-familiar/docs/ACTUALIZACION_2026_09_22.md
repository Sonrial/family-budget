# Apariencia, nombres y conservación del historial

## Uso

- Los botones de sol, luna y monitor permiten elegir Claro, Oscuro o Sistema. La elección queda guardada en este navegador.
- En Cuentas, elige Personal o Familiar y la pestaña Cuentas, Gastos o Ingresos. Puedes buscar por nombre.
- El botón del lápiz cambia nombre y sigla. No cambia el ID, tipo, propietario, saldo ni movimientos. El nombre nuevo se muestra también al consultar movimientos anteriores; las descripciones escritas de las transacciones no se reescriben.
- Cualquier miembro del hogar puede editar los nombres compartidos; las cuentas personales solo las puede editar su propietario.
- Si dos personas editan simultáneamente, la segunda recibe un aviso para recargar. Los cambios quedan registrados en el esquema privado `finance_audit`.
- Archivar sigue siendo diferente de renombrar. No hace falta archivar ni crear una cuenta nueva para cambiar el nombre.

## Revisión y protección

La migración `20260922174621_safe_labels_and_finance_validation.sql` es aditiva. Se aplicó después de generar una copia privada de las ocho tablas de aplicación y de las funciones SQL en `backup_20260922`.

Se verificaron 87 cuentas, 589 movimientos y 1.161 líneas. Después de aplicar la migración y ejecutar pruebas con ROLLBACK, la comparación bidireccional contra la copia arrojó cero diferencias en cuentas, movimientos, líneas y pagos. Las 13 operaciones históricas incompletas siguen conservadas sin regularización automática.

También se exportó una copia JSON independiente del servidor, fuera del repositorio: `family-budget-main/backups/supabase-data-20260922.json`. Contiene información privada: no subirla a GitHub. SHA-256: `A43A6592BC726F2C2B5387BC7D8A485389F8D78AFF59CC08F2AEC94D1F9E92FB`.

Esta exportación permite conservar los datos de aplicación, pero NO es un respaldo completo de Supabase: no incluye contraseñas ni usuarios de Auth, archivos de Storage, configuración del proyecto ni recuperación punto en el tiempo. No se ha ensayado una restauración completa en otro proyecto. Para recuperar, primero preparar una base aislada compatible y validar relaciones y totales; nunca importar encima de producción sin revisar.

## Correcciones adicionales

- Actualización de Next.js y su configuración ESLint a 16.3.6, PostCSS a 8.5.28 y dependencias transitivas con parches de seguridad, siguiendo la [guía oficial de actualización](https://nextjs.org/docs/app/guides/upgrading/version-16).

- Conversión correcta de decimales de la API al formulario colombiano (por ejemplo 100.50 → 100,5).
- Validaciones de líneas vacías/nulas, cuentas repetidas, importes no finitos, fecha y permisos de transferencias.
- Serialización de pagos recurrentes para rechazar pagos simultáneos duplicados.
- Una corrección de un pago mantiene el vínculo con su obligación mensual.
- Reportes con paginación, suma de varias líneas y agrupación por ID, no solo por nombre.
- Orden estable del historial y preservación de cookies de sesión al redirigir.
- Menú móvil que se cierra al navegar, cierre de sesión accesible en móvil y contraste de etiquetas/gráficos adaptado al tema.

## Verificación

Ejecutar `npm run check` para lint, tipos, pruebas y compilación. `supabase/verification/safe_labels.sql` prueba permisos, edición, concurrencia y registro decimal dentro de una transacción que termina en ROLLBACK.

La apariencia se comprobó con navegador en escritorio y móvil, en claro y oscuro. El usuario inició sesión personalmente y se verificaron cuentas, búsqueda, pestañas y el editor: el nombre vacío desactiva Guardar y Cancelar conserva la cuenta. No se guardó ningún cambio de nombre real durante la prueba de interfaz. La operación de guardado y sus permisos se comprobaron en SQL con ROLLBACK.

## Advertencias que permanecen

- [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): intencional en el registro privado de cambios de nombre. Los clientes no tienen acceso directo; solo escribe la función autorizada.

- [Funciones SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): uso intencional para escrituras contables atómicas y renombrado limitado, con permisos explícitos y validaciones internas. No equivale a una garantía de auditoría de seguridad completa.
- [Protección contra contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection): Supabase la reporta desactivada; revisar disponibilidad del plan antes de habilitarla.
- [Tablas sin clave primaria](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key): el aviso corresponde a las copias privadas de respaldo, no a las tablas operativas. [Índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index): no se eliminaron índices de relaciones o auditoría por esta observación puntual.

## Trabajo local

La rama de trabajo es `codex/dark-mode-account-editing`. Ejecuta los comandos dentro de `_refactor/presupuesto-familiar`, no en la copia antigua del directorio superior. Una copia de código no aísla la base de datos: si `.env.local` apunta al proyecto de producción, cualquier registro desde localhost afecta los datos reales. Para experimentar con importaciones o cambios contables, usa otro proyecto de Supabase.

No se añadió Three.js: formularios, consultas y gráficos financieros no necesitan un motor 3D. Se aprovecharon los componentes existentes para mantener una navegación ligera y accesible.
