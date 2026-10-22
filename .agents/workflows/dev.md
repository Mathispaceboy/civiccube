---
description: Start local serverless development, run D1 migrations, and test endpoints
---
1. Run local Cloudflare Worker development:
   ```bash
   npx wrangler dev
   ```
2. Apply local D1 schema migrations:
   ```bash
   npx wrangler d1 execute civiccube-db --local --file=./schema.sql
   ```
3. Seed local pilot data:
   ```bash
   npx wrangler d1 execute civiccube-db --local --file=./seed.sql
   ```
