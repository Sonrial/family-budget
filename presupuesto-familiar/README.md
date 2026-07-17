# Presupuesto Familiar

Aplicación familiar de contabilidad por partida doble construida con Next.js y Supabase. Esta versión prioriza la conservación del historial, la trazabilidad de correcciones y una lectura financiera más clara.

Producción: [family-budget-beta.vercel.app](https://family-budget-beta.vercel.app). La refactorización y sus cuatro migraciones están desplegadas; los nombres locales coinciden con el historial remoto de Supabase.

## Mejoras principales

- Los asientos se registran de forma atómica mediante funciones de PostgreSQL: o se guarda todo el movimiento o no se guarda nada.
- Las correcciones ya no eliminan historia: anulan el asiento original con una reversión y crean uno corregido.
- Las cuentas y obligaciones se archivan; no se borran registros contables.
- Los saldos se consultan en una vista única y se eliminan consultas repetitivas.
- Los reportes separan gasto real, abono a capital de deuda, ingreso y ahorro.
- La información familiar queda aislada por hogar mediante Row Level Security (RLS).
- La interfaz es adaptable a móvil, accesible y consistente.
- Hay pruebas automáticas para partida doble, fechas y reportes.
- Los asientos históricos incompletos se conservan sin inventar contrapartidas y quedan señalados para revisión.

## Requisitos

- Node.js 20.9 o superior.
- npm 10 o superior.
- Acceso autorizado al proyecto de Supabase.
- Para probar migraciones localmente: Supabase CLI y Docker Desktop.

## Instalación segura

```powershell
npm install
Copy-Item .env.example .env.local
npm run check
npm run dev
```

Complete `.env.local` únicamente con la URL y la clave pública (`anon` o publishable) del proyecto de respaldo. Nunca coloque una clave `service_role` en una variable `NEXT_PUBLIC_*`.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

Abra `http://localhost:3000`.

## Base de datos

Las migraciones versionadas están en `supabase/migrations/`. La primera crea una copia privada de las tablas financieras y la segunda aplica el cambio aditivo: conserva los movimientos existentes, añade hogares, auditoría, pagos de obligaciones y operaciones contables atómicas.

Antes de aplicarlas siga la guía [Respaldo y migración segura](docs/SUPABASE_BACKUP_AND_MIGRATION.md) y después ejecute `supabase/verification/after_migration_checks.sql`.

## Comandos

```powershell
npm run lint       # calidad y reglas de React/Next.js
npm run typecheck  # comprobación TypeScript
npm run test       # pruebas unitarias
npm run build      # compilación de producción
npm run check      # todas las verificaciones anteriores
```

## Estructura relevante

- `app/`: páginas y rutas Next.js.
- `components/`: interfaz reutilizable.
- `lib/finance.ts`: acceso seguro a operaciones financieras.
- `lib/ledger.ts`: reglas puras de partida doble.
- `lib/reporting.ts`: cálculo de indicadores mensuales.
- `supabase/migrations/`: cambios versionados de esquema y RLS.
- `supabase/verification/`: consultas de integridad posteriores a la migración.
- `tests/`: pruebas automatizadas.

## Reglas contables adoptadas

- Cada transacción debe tener débitos iguales a créditos.
- Pagar capital de una deuda reduce un pasivo; no se presenta como gasto nuevamente.
- Los intereses sí son gasto.
- Las transferencias entre cuentas propias no son ingreso ni gasto.
- Una corrección genera trazabilidad; nunca borra el comprobante original.

## Flujo recomendado de Git

Trabaje siempre en una rama y mantenga `main` como versión estable:

```powershell
git switch -c mejora/nombre-corto
npm run check
git add .
git commit -m "Descripción de la mejora"
git push -u origin mejora/nombre-corto
```

Revise el cambio mediante Pull Request antes de integrarlo.
