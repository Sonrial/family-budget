# Respaldo y migración segura de Supabase

Esta guía protege el historial financiero existente. La regla principal es sencilla: **primero copia verificable, después pruebas y solamente al final producción**.

## 1. Identifique producción sin exponer secretos

En Supabase Dashboard copie el `Project ID` desde la URL del proyecto y confirme visualmente que es el proyecto productivo. No copie claves privadas en archivos del repositorio, capturas ni mensajes.

La aplicación web solo necesita:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o la clave pública publishable equivalente)

La clave `service_role` puede saltarse RLS y nunca debe llegar al navegador ni a Git.

## 2. Cree dos respaldos antes de migrar

### Respaldo administrado

Revise `Database > Backups` en Supabase Dashboard. Los proyectos Pro, Team y Enterprise tienen copias diarias; en el plan gratuito Supabase recomienda exportaciones lógicas periódicas. Confirme la fecha y hora de la última copia antes de seguir.

### Exportación lógica fuera de Supabase

Desde la raíz de la aplicación:

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref ID_DE_PRODUCCION
New-Item -ItemType Directory -Force -Path ..\backups\supabase | Out-Null
npx supabase@latest db dump --linked --file ..\backups\supabase\schema.sql
npx supabase@latest db dump --linked --data-only --use-copy --file ..\backups\supabase\data.sql
npx supabase@latest db dump --linked --role-only --file ..\backups\supabase\roles.sql
```

El CLI solicitará la contraseña de la base de datos cuando corresponda. Guarde esos archivos fuera del repositorio: contienen información financiera y pueden contener datos personales.

Compruebe que los tres archivos existen, que `data.sql` no está vacío y copie la carpeta a una ubicación adicional cifrada.

Ejecute también `supabase/verification/before_migration_snapshot.sql` en SQL Editor y guarde su resultado. Ese archivo deja una fotografía de conteos, saldos y posibles descuadres previos para compararla después.

> Las copias de base de datos no contienen los objetos binarios de Supabase Storage; únicamente incluyen sus metadatos. Si la aplicación llega a usar archivos, respáldelos por separado.

## 3. Cree un entorno de prueba

La opción más segura es crear un proyecto Supabase separado para desarrollo. Restaure allí una copia desensibilizada o, si necesita probar exactamente los siete meses, restrinja su acceso a las mismas personas autorizadas.

Desvincule producción y vincule explícitamente el proyecto de prueba:

```powershell
npx supabase@latest link --project-ref ID_DE_RESPALDO
npx supabase@latest projects list
```

Verifique dos veces que la marca de proyecto vinculado corresponde al respaldo. Cree `.env.local` con la URL y clave pública de ese proyecto; no reutilice valores productivos.

## 4. Capture el esquema existente

Este repositorio nació sin historial de migraciones de la base ya creada. Antes de desplegar la nueva migración, capture el esquema del proyecto de respaldo:

```powershell
npx supabase@latest db pull baseline_respaldo
npx supabase@latest migration list
```

Revise la migración generada. `db pull` usa Docker para comparar esquemas y puede incluir instrucciones inesperadas; no acepte eliminaciones sin revisarlas.

## 5. Pruebe la migración

Primero vea qué se aplicaría:

```powershell
npx supabase@latest db push --linked --dry-run
```

La salida debe mencionar la migración `202607160001_safe_finance_refactor.sql` y no debe contener comandos para borrar tablas ni datos. Después, solo sobre el respaldo:

```powershell
npx supabase@latest db push --linked
npx supabase@latest db lint --linked --level error
```

No use `supabase db reset --linked`: ese comando destruye y reconstruye el esquema remoto, por lo que borraría los datos del proyecto vinculado.

## 6. Compruebe integridad

Ejecute el contenido de `supabase/verification/after_migration_checks.sql` en SQL Editor del proyecto de respaldo.

El resultado esperado es:

- Cero transacciones desbalanceadas.
- Cero líneas contables huérfanas.
- Cero cuentas sin hogar.
- Cero transacciones de reversión incompletas.
- Los conteos de cuentas, movimientos y líneas coinciden con los conteos anotados antes de migrar.

Luego pruebe manualmente con un usuario de prueba:

1. Iniciar sesión y abrir el tablero.
2. Registrar ingreso, gasto y transferencia.
3. Crear una obligación y pagar una cuota con capital e interés.
4. Corregir y anular una transacción.
5. Archivar una cuenta vacía y una obligación.
6. Comparar saldos y reporte mensual con el libro mayor.
7. Confirmar en otra sesión que un usuario ajeno no ve el hogar.

## 7. Pase a producción únicamente después de aprobar

1. Detenga temporalmente el registro de movimientos.
2. Genere una nueva exportación lógica y confirme el backup administrado.
3. Vincule explícitamente producción y compruébelo con `projects list`.
4. Ejecute `db push --linked --dry-run`.
5. Aplique con `db push --linked` una sola vez y por una sola persona.
6. Ejecute las verificaciones SQL y una prueba de humo.
7. Reactive el registro de movimientos.

Si cualquier conteo o saldo no coincide, no intente corregirlo borrando filas: detenga el proceso, conserve los resultados y restaure la copia siguiendo el procedimiento de Supabase Dashboard.

## Lista de control

- [ ] Copia administrada disponible.
- [ ] `schema.sql`, `data.sql` y `roles.sql` guardados fuera de Git.
- [ ] Migración aprobada en un proyecto de respaldo.
- [ ] Verificaciones SQL sin hallazgos.
- [ ] Pruebas funcionales completadas.
- [ ] `.env.local` apunta al entorno correcto.
- [ ] Producción tiene una copia recién creada.
- [ ] Una sola persona despliega la migración.
