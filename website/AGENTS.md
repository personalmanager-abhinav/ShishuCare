# Maintaining this project

- Read README.md before changing architecture or workflows. Keep it accurate in the same change.
- Preserve the external-marketplace business model: no carts, payments, orders, mandatory customer accounts, or editing CMS.
- Product IDs and offer IDs are stable. Product JSON is public. Never add secrets, private inventory, or customer data to it.
- Maintain strict price/attribute constraints in both API search and browser fallback.
- Keep dashboard routes authenticated and private data outside dist/public.
- Consent is required before behavioral tracking. Marketplace navigation must work without telemetry.
- Keep sample content marked as demo and do not remove production guards to publish it.
- Run pnpm run check, pnpm run test, and pnpm run build for relevant code changes. Exercise API/browser/maintenance checks when changing those flows.
- Do not commit .dev.vars, .env, .wrangler, private datasets, or work files.
- Keep schema migrations backward-compatible. Add new migrations instead of editing an applied migration.
