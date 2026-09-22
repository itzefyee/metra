# Catalog data import

Metra includes a small, committed catalog fixture set in
`scripts/migration-data/`. The import script uses the authenticated Convex CLI
to call internal write functions, so catalog write APIs are not exposed to
browsers.

## Development import

Start or sync the development deployment first:

```powershell
npx convex dev --once
npm run migrate:import-products
```

The importer upserts component taxonomy, material synonyms, products, product
specifications, and embeddings. It is safe to re-run for the committed seed
data.

## Production import

Deploy the intended Convex version before importing. Then explicitly select the
production target:

```powershell
$env:METRA_CONVEX_TARGET = "prod"
npm run migrate:import-products
Remove-Item Env:METRA_CONVEX_TARGET
```

Verify record counts in the Convex dashboard after the import. Do not point a
development environment at production by editing or committing `.env.local`.

## What this does not migrate

The catalog importer must not be used to move:

- user, profile, or session records;
- CAD generation history or downloaded files;
- Convex storage blobs; or
- application secrets and deployment metadata.

Those data types need an approved, purpose-built migration with access controls
and a privacy review. Local experiment exports are ignored at
`scripts/migration-data/convex-export/` and must remain out of the public
repository.
