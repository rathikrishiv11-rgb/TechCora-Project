# Data and secret handling

The supplied ERP export is confidential and must not be published.

- Keep the export outside Git or under an ignored `data/` directory.
- Reference it through the `ERP_EXPORT_PATH` environment variable.
- Never put database credentials in source files.
- Use `.env.local` locally and platform-managed secrets in deployment.
- Inspect `git status` before every commit.
- If confidential data is accidentally staged, stop before committing and remove it from the index.
