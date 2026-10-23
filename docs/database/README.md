# Database script – HR Connect

The database is PostgreSQL. Its schema is managed by EF Core migrations in `HRConnect/HRConnect.Infrastructure/Migrations/` (61 migrations). The SQL files below are generated from those migrations. Do not edit the SQL files by hand.

| File | Purpose |
|---|---|
| `hrconnect-schema.sql` | Full script that applies every migration in order. Run it on an empty database to create the whole schema (71 tables) and the reference data inserted by migrations. |
| `hrconnect-migrations-idempotent.sql` | The same migrations, each wrapped in a check on `__EFMigrationsHistory`. Safe to run on a database that already has some migrations applied. |

## Match with the ERD

The ERDs in `docs/diagrams/erd/` are generated from the same EF Core model snapshot (`ApplicationDbContextModelSnapshot.cs`). On 23/10/2026 the table sets were compared: all 71 tables appear in both the ERD and the script, with no table missing on either side.

## Data in the script

The script contains only reference data written by migrations: roles, permissions and role-permission links, the default job posting package, and the backfill statements that some migrations need. It contains no user accounts, passwords or personal data. Demo accounts come from the application seed at start-up (`HRConnect.Infrastructure/Persistence/Seed`), not from this script.

## Regenerate after a new migration

Run from the `HRConnect` folder:

```bash
dotnet ef migrations script --project HRConnect.Infrastructure --startup-project HRConnect.Presentation --output ../docs/database/hrconnect-schema.sql
```

```bash
dotnet ef migrations script --idempotent --project HRConnect.Infrastructure --startup-project HRConnect.Presentation --output ../docs/database/hrconnect-migrations-idempotent.sql
```

After a schema change, regenerate the ERDs as well, so that the script and the diagrams stay in sync.
