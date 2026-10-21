# Current design baseline — 19 September 2026

The user asked to preserve their local edits and build on the current implementation. The files in `website/` are the accepted working baseline. This record supersedes older conflicting design notes, including the original entrance request and earlier handoff sections. No application source, assets, configuration or tests were changed during this review.

## Accepted current implementation

- **Powder-sky palette:** `website/data/site.json` selects `powder-sky`. `src/styles/palette.css` supplies powder-blue surfaces/buttons, slate text, blue brand accents and coral/red hearts. Do not revert to butter-yellow merely because older notes call it current.
- **Catalogue-first homepage:** `src/pages/index.astro` renders `Catalogue` immediately, followed by the existing marketplace buying strip. The former hero, English tagline, large discovery heading, supporting paragraph, discovery link and homepage hero particles are absent. Do not reinsert them without a new request. `refinement.css` sets catalogue padding to `34px 6% 65px`.
- **Site-wide doodle background:** `src/styles/doodle.css`, imported after the other styles in `Layout.astro`, tiles a local embedded SVG of blue baby-themed line drawings at 360px with a fixed background. Preserve this background and its import order.
- **Revised entrance:** `src/scripts/brand-entrance.ts` runs a roughly 2.88-second sequence. It adds 28–70 lightly visible, independently drifting SVG doodles, fades in the centred wordmark over 560ms, drops a shaped blue droplet starting at 380ms, adds five small splash droplets, uses a 2.5% logo pop, then travels to the measured header destination from 2020–2880ms. The white backdrop fades during travel. Preserve these intentional additions rather than restoring the earlier no-doodle/no-splash implementation.
- **Water-like blue dot:** `brand-entrance.css` uses `#2b8fd6` plus highlight/shadow treatments for the dot and small splash elements. `BrandName.astro` still separates the first i stem and blue dot. The real responsive header remains the destination.
- **Existing safeguards:** once-per-tab session state, reduced-motion skip, font readiness, input/resize/scroll/visibility cleanup and timeout protection remain in the entrance implementation. The runtime timeout is 3600ms; the head fallback is 4000ms.
- **Remaining particles:** shared ambient particle code remains; it is used in the Mannpasand intro and footer, not the removed homepage hero.

## Working-source boundaries

`website/src/scripts/brand-entrance.ts` and `website/tests/brand-entrance.mjs` are the application/test files. Similarly named files at the project root and material under `Claude outputs/` are separate files/reference outputs, not automatically imported application source. They were left intact. Do not copy them over live files or delete them without a relevant request. Other palette/hero screenshots are alternatives, not evidence that those alternatives should replace the actual current code.

## Verification status

This was a source review and documentation update, not a new functional change or release validation. No build or test suite was run during this review. There is no Git repository at the project root, so this record describes the observed current source and differences from the prior conversation rather than claiming a complete version-control diff.

Some earlier browser checks encode superseded behavior: `tests/ambient.mjs` expects homepage hero particles, `tests/design.mjs` expects discovery arrows, and entrance timing assertions may still target 2.4 seconds. On the next relevant implementation task, align checks with this accepted design instead of restoring removed UI to satisfy old tests. Prior verification records apply to their recorded versions, not automatically to the current edits.
