# Baby Product Venture

This is the main project folder. Keep future source code, documentation, assets, and generated files here.

## Folder structure

```text
Baby Product Venture/
├── README.md                  Start here
├── AGENTS.md                  Instructions for future coding sessions
├── docs/
│   ├── architecture-chat.md   Original architecture discussion (reference)
│   └── project-memory.md      Requirements and project decisions
└── website/
    ├── README.md             Full setup, components, flows, and usage guide
    ├── VERIFICATION.md       Checks performed and remaining limitations
    ├── src/                  Pages, components, styles, browser logic
    ├── workers/              APIs, authentication, analytics, scheduled jobs
    ├── data/                 Product JSON, categories, marketplace registry
    ├── public/               Public images and static assets
    ├── db/                   Database migrations
    ├── scripts/              Catalogue generation and development utilities
    ├── tests/                Automated checks
    └── work/                 Temporary files and local verification outputs
```

Generated dependencies, builds, and local database state stay inside `website/` and are ignored by source control. Credentials stay in ignored local configuration files; never add them to documentation or public data.

## Start the website

Open a terminal in this folder:

```powershell
cd website
pnpm run preview
```

Open http://127.0.0.1:8787/. For a fresh installation, builds, product edits, tests, semantic-search setup, and deployment, read [website/README.md](website/README.md).

The current website still uses explicitly labeled sample content. Moving the project does not enable live AI, publish it, or replace the sample products.

## Project location

Canonical folder: `C:\Users\Abhinav\Ventures\Baby Product Venture`.

Moved here on 17 September 2026. The previous Codex output ZIP is an old snapshot, not the working source. Future changes belong here.

The current Shishu care preview contains seven baby-product types, suggested colour swatches, and the powder-sky theme. See website/README.md for product setup, colour/image mapping, palette switching, and all customer flows.

Mannpasand saves favourites on this browser. Optional parent reviews have a private approval queue linked from the owner dashboard. Apply all database migrations, including the discovery/operations migration 0003, when setting up another environment; see website/README.md for the full flows.

The bargaining feature is now a persistent, explicitly non-redeemable local demo with Hindi, Hinglish and English conversations. Apply migrations through `0007_bargain_language.sql`; production configuration keeps it disabled until real marketplace promotions, pricing, coupon security and a commercially permitted AI provider are verified. The launch checklist is in `docs/BARGAINING-REMAINING-WORK.md`.

See [the bargaining remaining-work checklist](docs/BARGAINING-REMAINING-WORK.md) for owner inputs, marketplace validation, coupon security, AI-provider, privacy, operational and production acceptance gates.

## Current design

The remaining architecture implementation is documented in [architecture progress](docs/ARCHITECTURE-PROGRESS.md): related products, optional session preferences, private discovery/inventory reports, full recovery tools and separate production Worker entry points. Run the new database migration before previewing; operational commands are in the website README. Experiments remain disabled, and production still needs real content and cloud setup.

See [implementation status](docs/IMPLEMENTATION-STATUS.md) for the 19 September continuation: responsive photography, search caching/evaluation, India-time reporting, private operational health and recovery tools. Commands are in the website README. The newly proposed feature still needs its description.

The user’s local edits reviewed on 19 September 2026 are the accepted baseline. The homepage now starts with search/catalogue, with a blue doodle background and a revised branded entrance. Read [docs/CURRENT-DESIGN-BASELINE.md](docs/CURRENT-DESIGN-BASELINE.md) before future design work; it supersedes earlier conflicting design notes.
