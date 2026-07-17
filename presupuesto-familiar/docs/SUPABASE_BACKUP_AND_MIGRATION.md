# Respaldo y mantenimiento seguro de Supabase

Esta guía describe el estado real del proyecto `iixvevckhrazsaiyhciu` y el procedimiento para cambios futuros. La regla principal es: **copia verificable, migración transaccional y comprobación posterior**.

## Estado desplegado el 16 de julio de 2026

Antes de la refactorización se creó el esquema privado `backup_20260716`. No contiene `auth.users`, contraseñas ni claves; conserva las tablas funcionales necesarias para reconstruir el historial:

| Tabla | Filas copiadas |
| --- | ---: |
| `profiles` | 4 |
| `accounts` | 86 |
| `transactions` | 451 |
| `transaction_lines` | 885 |
| `recurring_bills` | 3 |

La copia y las tablas activas tenían la misma suma global de líneas: `-7.299.268,00`. El acceso al esquema se revocó a `public`, `anon` y `authenticated`; únicamente los roles administrativos de la base pueden leerlo.

Las cuatro versiones locales coinciden con el historial remoto de Supabase:

1. `20260717014327_backup_before_safe_refactor_20260716.sql`
2. `20260717014418_safe_finance_refactor_20260716.sql`
3. `20260717014638_harden_rpc_permissions_and_indexes_20260716.sql`
4. `20260717015306_enforce_rpc_only_ledger_writes_20260716.sql`

No renombre estas migraciones ni las vuelva a ejecutar manualmente. Para un cambio nuevo, cree otra con `npx supabase@latest migration new nombre_descriptivo`.

## Integridad histórica

La auditoría encontró 13 movimientos anteriores incompletos: cuatro sin líneas y nueve con una sola línea. Se conservaron exactamente, se marcaron con `legacy_incomplete` y no participan en indicadores. No deben corregirse inventando una contrapartida; requieren identificar cuenta, soporte y naturaleza contable con la familia.

Después de la migración:

- continúan 451 movimientos y 885 líneas;
- no hay líneas huérfanas;
- no hay filas compartidas sin hogar;
- todos los asientos no heredados tienen al menos dos líneas y suman cero;
- `anon` no puede leer movimientos/saldos ni ejecutar las RPC financieras;
- los usuarios autenticados no pueden insertar cabeceras o líneas directamente;
- la escritura contable se realiza de forma atómica mediante `post_transaction` o `post_bill_payment`.

## Variables locales

La aplicación solo necesita la URL y la clave pública del proyecto:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://iixvevckhrazsaiyhciu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=CLAVE_PUBLICA_DEL_PROYECTO
```

Nunca coloque una clave `service_role`, una contraseña de base de datos o un token privado en una variable `NEXT_PUBLIC_*`, en Git o en mensajes.

## Procedimiento para una migración futura

1. Confirme el proyecto vinculado y el historial:

   ```powershell
   npx supabase@latest projects list
   npx supabase@latest migration list --linked
   ```

2. Cree una exportación lógica fuera del repositorio cuando tenga la contraseña de base de datos. En el plan gratuito, conserve además una copia privada fechada de las tablas afectadas.
3. Cree la migración con el CLI y revise que no contenga `drop table`, `truncate`, eliminación masiva ni cambios de tipo con pérdida de información.
4. Ejecute `npx supabase@latest db push --linked --dry-run`.
5. Aplique una sola vez y ejecute los asesores de seguridad/rendimiento.
6. Ejecute `supabase/verification/after_migration_checks.sql` y compare conteos, suma de líneas y saldos con la copia previa.
7. Publique la aplicación únicamente cuando CI y la vista previa de Vercel estén aprobados.

No use `supabase db reset --linked`: destruye y reconstruye el esquema remoto. Si una migración aplicada necesita corregirse, cree otra migración progresiva; no edite el historial remoto ni borre filas para “hacer coincidir” resultados.

## Recuperación

El esquema `backup_20260716` es una copia interna, no reemplaza un respaldo externo ni recuperación punto en el tiempo. Si aparece una discrepancia:

1. detenga nuevas escrituras;
2. capture conteos y resultados de verificación;
3. no vacíe ni sobrescriba las tablas activas;
4. prepare la restauración en una transacción y compárela primero en otro proyecto o entorno local;
5. confirme claves foráneas, saldos y RLS antes de hacer `commit`.

## Pendiente de configuración manual

El asesor de Supabase mantiene una advertencia: **Leaked Password Protection** está desactivado. Si el plan y la configuración de Auth lo permiten, actívelo en `Authentication > Settings > Password Security`. Las advertencias sobre RPC `SECURITY DEFINER` para `authenticated` son intencionales: esas funciones son la API de escritura y cada una valida sesión, propiedad y hogar.
