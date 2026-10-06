# Optional deployment

The TechCora submission brief asks for a repository and demo video; it does not require Vercel or any other hosted deployment. The instructions below are optional if a hosted preview is useful later.

## Vercel + Neon

1. Import `rathikrishiv11-rgb/TechCora-Project` into Vercel.
2. Keep the project root at the repository root; the application already occupies the `stockerp` repository checkout.
3. Add `DATABASE_URL` as an encrypted Production, Preview, and Development environment variable. Use the pooled Neon connection string.
4. Add `APP_ENV=production` for Production.
5. Do not add `ERP_EXPORT_PATH` to Vercel. The confidential export is migration input, not an application runtime dependency.
6. Deploy, then request `/api/health`; success must report `database: connected`.
7. Smoke-test `/`, `/invoices`, `/invoices/new`, and `/movements`.

The schema and masked dataset have already been migrated to Neon. Future empty environments should run `npm run db:migrate:runtime` and the explicit `data:import -- ... --write` command from a trusted workstation before traffic is switched.

## Required production follow-up

This internship prototype intentionally has no authentication or role model. Do not expose real operational data publicly until authentication, authorization, audit identity, rate limiting, and CSRF/origin policy have been selected for the organization.

## Rollback

Vercel retains earlier deployments for application rollback. Database writes are forward-compatible within the current migration set; do not roll back the database by deleting records. If a schema migration later needs reversal, ship a reviewed forward migration.
