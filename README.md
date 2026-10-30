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

Redesign workspace: `C:\Users\Abhinav\Ventures\Baby Product Venture Redesign`.

Moved here on 17 September 2026. The previous Codex output ZIP is an old snapshot, not the working source. Future changes belong here.

The current Shishu care preview contains seven baby-product types, suggested colour swatches, and the powder-sky theme. See website/README.md for product setup, colour/image mapping, palette switching, and all customer flows.

Mannpasand saves favourites on this browser. Optional parent reviews have a private approval queue linked from the owner dashboard. Apply all database migrations, including the discovery/operations migration 0003, when setting up another environment; see website/README.md for the full flows.

The bargaining feature is now a persistent, explicitly non-redeemable local demo with Hindi, Hinglish and English conversations, resumable sanitized history, bounded retry behavior, provisional demo retention and a private read-only operations page. Apply migrations through `0008_bargain_retention.sql`; production configuration keeps it disabled until real marketplace promotions, pricing, coupon security and a commercially permitted AI provider are verified. The launch checklist is in `docs/BARGAINING-REMAINING-WORK.md`.

See [the bargaining remaining-work checklist](docs/BARGAINING-REMAINING-WORK.md) for owner inputs, marketplace validation, coupon security, AI-provider, privacy, operational and production acceptance gates.

## Current design

Age-stage discovery is available at `/age-stages/` and the initial filter-based gift finder at
`/gift-finder/`. The implementation status of the requested feature expansion is tracked in
[feature rollout](docs/FEATURE-ROLLOUT.md).

The 28 October 2026 redesign is the active customer-facing direction in this workspace. It follows a
soft baby-boutique reference with a white navigation bar, sunny yellow product hero, cloud transitions,
pastel collection panels, circular category browsing, trust highlights and a pink family/footer area.
Store operations remain
external-marketplace handoffs; search, favourites, colour previews, consent, reviews and owner tools
continue to use the established application architecture. The implementation is primarily in
`website/src/styles/boutique.css`, `website/src/scripts/boutique.ts`, `website/src/pages/index.astro`, the shared layout, catalogue and
product-card components.

The remaining architecture implementation is documented in [architecture progress](docs/ARCHITECTURE-PROGRESS.md): related products, optional session preferences, private discovery/inventory reports, full recovery tools and separate production Worker entry points. Run the new database migration before previewing; operational commands are in the website README. Experiments remain disabled, and production still needs real content and cloud setup.

See [implementation status](docs/IMPLEMENTATION-STATUS.md) for the 19 September continuation: responsive photography, search caching/evaluation, India-time reporting, private operational health and recovery tools. Commands are in the website README. The newly proposed feature still needs its description.

The 19 September design record remains historical context. It is superseded by the 28 October 2026
redesign described above in this workspace.
