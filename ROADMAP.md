# CampaignRepo Roadmap

CampaignRepo is past **1.0** and into the reliability wave. The platform
surface is broad - wiki, maps, sessions, quests, publishing, dashboards,
imports, AI tools, and local/GitHub storage - so the focus has shifted from
adding surfaces to making the existing app trustworthy at scale.

The guiding promise remains the same: every campaign remains a portable folder
of Markdown, YAML, JSON, and media files. CampaignRepo makes that folder feel
like a modern worldbuilding app, while Git acts as durable archive and sync
layer instead of the live database for every small UI action.

Effort key: **S** = days, **M** = about a week, **L** = multi-week.

> Looking for what comes *after* this roadmap? New, not-yet-scheduled feature
> directions live in [ROADMAP-IDEAS.md](ROADMAP-IDEAS.md).

## Reliability and Sync Roadmap

The next critical work is architectural reliability. CampaignRepo should keep
the "own your repo" promise, but GitHub should not be the live database for
every small app action.

Current risk: page state can be represented in several places at once:

- Markdown page files.
- SQLite page cache.
- `.campaignrepo/index.json`.
- `wiki/search/index.json`.
- Sidebar/list snapshots.
- Public-site snapshots.
- GitHub repository state.

That creates failure modes where page content is intact but the UI shows an
empty body, a stale sidebar, missing children, or public/GM views that disagree.
It also makes GitHub latency and merge conflicts visible during ordinary work
such as organizing pages or approving player-visible content.

Target model:

```text
User edit
  -> local DB working copy
  -> instant UI update
  -> queued rebuild/sync
  -> batched Git commit and push
```

Markdown/repo files remain portable. Generated files are disposable snapshots.
The app must always be able to rebuild generated state from the canonical page
source.

### R1. Repair, Health, and Guardrails - S-M - shipped

Shipped: `POST /api/campaigns/[id]/repair` rebuilds the SQLite page cache,
`wiki/search/index.json`, and `.campaignrepo/index.json` from canonical page
source with a per-step report (the cache rebuild re-parses every page rather
than trusting sha-matching rows, so poisoned rows cannot survive). "Repair
indexes" buttons live in the Health center and campaign Settings. Health now
reports generated-state drift: manifest/search/cache counts vs page files,
missing or invalid manifest and snapshot, cache refresh errors, and cached
pages that lost their body while source has content. Empty source pages are
reported, never silently filled. Page detail reads already recover from empty
cache rows. Regression tests cover manifest/snapshot recreation, poisoned
cache rows, empty source pages, and named-step failures.

Remaining for later waves: last-Git-sync status surfacing (R4 territory) and
the `campaignrepo repair` CLI form (R6).

The original R1 plan, for reference:

1. Read canonical pages.
2. Rebuild `.campaignrepo/index.json`.
3. Rebuild `wiki/search/index.json`.
4. Refresh the SQLite page cache.
5. Report counts and failures.

Health checks should show Markdown/page count, manifest count, search document
count, cache count, empty page bodies, invalid parents, public/GM visibility
mismatches, unsynced local changes, and last successful Git sync.

Fallbacks:

- If a cache row has an empty body but the page source has content, replace the
  cache row from source.
- If generated indexes disagree with page source, prefer the page source and
  mark indexes stale.
- If repair cannot complete, leave content untouched and report the exact
  failed step.

Tests:

- Corrupt cache page -> detail view recovers from source.
- Delete manifest -> repair recreates it.
- Delete search index -> repair recreates it.
- Parent in page source -> sidebar and public site nest correctly after repair.
- Empty real source page remains empty and is reported, not silently filled.

### R2. Stop Hand-Editing Generated Files - M

Bulk organize should update page frontmatter first, then rebuild generated
snapshots from those pages. Generated JSON should be output, not the main edit
target.

Flow:

```text
bulk edit selected pages
  -> update page source/frontmatter
  -> rebuild manifest/search from page source
  -> commit changed page files and snapshots together
```

Fallbacks:

- If page writes succeed but snapshot rebuild fails, keep the page writes, mark
  indexes stale, and show a repair action.
- If GitHub commit fails, preserve the intended local changes for retry.

Tests:

- Move 10 locations under a parent and verify page frontmatter, manifest,
  search index, sidebar, and public site.
- Bulk approval updates player and public views consistently.
- GitHub file listings with missing file text never produce blank pages.
- Generated rebuilds do not drop page bodies, media docs, aliases, parent
  metadata, approval state, or visibility.

### R3. DB Working Copy for Live Editing - L

Introduce a page working-copy table that the app reads first:

- slug
- title
- category/type
- parent
- visibility
- approvalStatus
- content
- raw markdown
- frontmatter JSON
- updatedAt
- dirty flag
- lastSyncedSha
- lastSyncError

The UI should read from the DB working copy for page lists, detail pages,
organize, approval queues, public preview, and health checks. GitHub becomes a
sync backend, not the hot path.

Fallbacks:

- If a page is missing from DB, hydrate it from Git/local storage once.
- If DB and Git disagree and the DB row is dirty, keep the DB row and surface a
  sync warning.
- If DB is unavailable, existing local/Git-backed read paths still work in a
  degraded mode.

Tests:

- Edit page while GitHub is unreachable; UI keeps the edit and marks it dirty.
- Reload app; dirty edits survive.
- Organize parent changes are instant without GitHub requests.
- Public preview reads the same working copy as GM view, filtered by player
  safety rules.

### R4. Batched Git Sync Queue - L

Create a queue for durable sync work:

- page created/updated/deleted
- page parent/category/approval changed
- media metadata changed
- generated index rebuild needed
- campaign settings changed

Sync should batch changes into one commit after a debounce or explicit
**Sync Now** action.

Flow:

```text
collect dirty records
  -> serialize Markdown/YAML/JSON
  -> rebuild generated snapshots
  -> commit once
  -> push
  -> clear dirty flags
```

Fallbacks:

- If GitHub times out, leave dirty rows intact with retry.
- If push is rejected, fetch remote and enter conflict handling.
- If generated snapshot write fails, do not clear dirty flags.

Tests:

- 20 edits produce one commit.
- Timeout during sync leaves all edits in DB.
- Restart during sync resumes safely.
- Generated indexes match the synced page set.

### R5. Conflict Handling - M-L

GitHub remains valuable for collaboration, so conflicts need explicit UX.

Conflict policy:

- If remote changed a clean page, hydrate the new remote version.
- If local DB row is dirty and remote changed the same page, create a conflict
  record.
- Use three-way merge where possible: last synced version, local DB version,
  and remote Git version.
- Never silently overwrite page content.

Fallbacks:

- If merge is uncertain, preserve both versions.
- If generated files conflict, regenerate them from the resolved page set
  instead of asking the user to merge JSON.

Tests:

- Remote edit after local edit.
- Remote delete after local edit.
- Local rename while remote page changes.
- Generated index conflict after page conflict resolution.

### R6. Disposable Generated State Everywhere - M

Make this rule true across the app:

> Manifest, search index, sidebar snapshots, public-site snapshots, and DB cache
> are rebuildable outputs.

Add a CLI/admin command:

```text
campaignrepo repair --campaign <id>
```

Tests:

- Corrupt every generated file and repair from source.
- Large repo repair completes without GitHub directory walking in the common
  path.
- Repair reports exact skipped/failed pages.

## Hidden Risks To Track

- **Generated files overwriting good data.** A stale snapshot can make good page
  files look missing or empty.
- **GitHub latency and timeouts.** GitHub is excellent as durable storage but
  poor as the database for live editing.
- **Parent/title/slug mismatch.** Relationships should store stable page IDs or
  slugs, while the UI displays names.
- **Renames.** A rename touches filenames, slugs, links, backlinks, parents,
  public URLs, manifest IDs, search docs, and history.
- **Public and GM view drift.** Both should derive from the same working
  source, then apply visibility filters.
- **Media repo size.** Large media makes pulls, tree reads, and generated
  snapshots slower. Media may need object storage or stricter lazy loading.
- **Silent partial success.** The app must say "content saved, Git sync failed"
  instead of making users guess whether data was lost.
- **Bad cache poisoning.** An empty or malformed cache row must never outrank a
  non-empty canonical page source.

## Current Product State

CampaignRepo currently ships:

- GitHub and local-folder campaign storage.
- Markdown wiki pages with YAML frontmatter, wiki links, aliases, backlinks, GM
  blocks, named secret groups, covers, galleries, and transclusion.
- Configurable campaign categories and per-game template packs.
- A pinned, auto-provisioned **Campaign home page** per campaign (concept, the
  table, how to connect, house rules) at the top of the workspace side-nav.
- **Demo data for every supported game system**: seedable, cross-linked example
  pages (location, faction, NPC, sample PC, threat, item, opening situation,
  GM primer & checklist), browsable from the dashboard Demo Library and
  seeded/removed per campaign with one click.
- Media manager with metadata, captions, alt text, tags, saved filters, nested
  media folders, bulk move/caption/tag cleanup, and page rendering.
- Interactive maps with image pins, player/GM layers, nested map links, routes,
  regions, measuring scale, and journeys.
- Nested page hierarchy through `parent` frontmatter and collapsible sidebars.
- Relationship graph with typed relationship frontmatter, inverse labels,
  hierarchy/family layout, dense-campaign clusters, graph editing, search, and
  health checks.
- Dedicated family tree view with an editable tree builder, imported-genealogy
  datasets rendered Family Echo-style, and fullscreen viewing.
- Full-text search plus a global command palette.
- Player portal and public no-login sites for approved player-visible content.
- Public campaign gallery, custom public link names, ratings, recently-updated
  discovery signals, clone-this-world flow, contribution guidance, GitHub
  compare/PR handoff, and public quest display.
- Sessions, quests, fantasy calendar, overview widgets, boards, manuscripts, and
  lexicon/naming tools.
- Traveller, D&D 5e, Pathfinder 2e, World of Darkness, and Sword Chronicle
  character-sheet renderers, with Traveller rolling, editor controls, and a
  print/PDF action on sheet-bearing pages.
- Reusable category property schemas, custom typed fields, inventories,
  abilities, resources, and safe formula fields stored in campaign YAML/page
  frontmatter.
- Review queue, campaign health center, bulk page organization (including
  one-commit bulk delete), manual repo refresh, snapshot-backed page lists,
  notifications, assignments, mentions, page watches, and page
  history/diff/restore workflow.
- Importers for Foundry actors, generic character JSON, Obsidian, Notion,
  OneNote, Google Docs, CSV, journals, Roll20, LegendKeeper, World Anvil, full
  ZIP/JSON backup export, and character re-import diffing — consolidated in one
  Import & Export hub (single-character JSON included; bulk goes straight to
  the git repo).
- Genre theme presets (fantasy, horror, sci-fi, generic, plus flagship themes)
  applied per campaign, and a **global preferred-theme picker** on every page
  that overrides the campaign default per browser.
- Phone-class mobile treatment: bottom tab bar, editor Write/Preview toggle,
  compact dashboard grid, and touch-sized controls.
- AI generation, AI campaign Q&A, and MCP JSON-RPC tools.
- Docker/GHCR deployment path.

## Shipped in the 1.1 Wave

### 32. Mobile app-like chrome - shipped

Phone widths get a fixed bottom tab bar (Repos / Wiki / Review / Portal), a
Write/Preview editor toggle, a 2-up connected-repos grid, stacked topbars with
full-width actions, and overlay repositioning. Tablet collapse and the side-nav
hamburger were already in place; this pass made phones feel deliberate.

### 33. Global theme picker - shipped

A bottom-left picker on every app page lets each user choose a preferred genre
theme. An explicit pick fully overrides the campaign default — including
per-campaign custom accents — and persists per browser; Auto restores the
campaign's own theme and accents.

### 34. Campaign home page - shipped

Every campaign gets a pinned, always-reachable "Campaign" wiki page seeded with
concept, system & tone, the table (players and characters), connection methods
(web, GitHub, MCP), house rules, and current state. It is a normal wiki page:
editable, versioned, searchable.

### 35. Demo data and the per-game checklist - shipped

Every supported game system has a demo kit: original, genre-appropriate sample
pages that cross-link so the wiki, graph, and portal light up immediately. GMs
opt in from a first-load prompt or the Create page panel; pages are tagged and
removable in one click. Each kit carries a **GM Primer & Checklist** page and a
character-sheet direction brief recording what that system still needs: exact
field names, sheet layout, visual notes, and cleanup items. Research status per
game (`first-pass` → `needs-reference` → `ready-for-polish`) tracks the
reformatting effort below.

### 36. Import hub consolidation - shipped

Single-character JSON import moved from the workspace into the Import & Export
hub alongside every other importer, with an explicit note that bulk loads
belong in the git repo directly. OneNote import joined the hub. The Create page
form was expanded and now remembers the last category/template/visibility per
campaign.

### 37. Family trees - shipped

A dedicated family tree view with an editable tree builder, Family Echo-style
rendering for imported genealogy datasets, and fullscreen viewing. Trees are
repo files like everything else, and the relationship graph's family layout
remains for quick looks.

### 38. Sword Chronicle character sheet - shipped

A display-only `sword-chronicle-sheet` fenced block renders the printed Green
Ronin sheet: the full ability list (honoring a setting's variant list, e.g.
Kingdom Divided's Admiralty/Nautical/Warcraft), specialties with bonus dice,
derived Intrigue Defense / Combat Defense / Composure / Health computed by the
printed formulas, destiny and damage/injury/wound tracks, attacks, armor,
retainers, appearance, and history. The Sword Chronicle template pack seeds the
real sheet, and the sheet-mangling Markdown bug this surfaced was fixed for the
D&D and WoD sheets too.

## Deferred Feature Track: Per-Game Sheet & Template Pass - L

This remains important, but it should resume after the reliability and sync
work above. The demo system exists precisely to drive it: each game's GM Primer
& Checklist page lists the field groups, layout direction, and cleanup notes
for that system. Working the checklist means, per game:

1. **Confirm vocabulary** — replace generic stat names with the system's exact
   terms (careers vs. classes, dots vs. dice, hunger vs. stress).
2. **Build or adapt the sheet** — either a dedicated renderer (like Traveller,
   D&D, Pathfinder, WoD today) or a well-shaped template-pack sheet page.
3. **Reformat the template pack** — align starter bodies and category templates
   with the system's real play loop.
4. **Fill the demo sheet** — swap the design brief on the sample PC for a real
   filled-in sheet.
5. **Mark the game `ready-for-polish`** in the research status.

Suggested working order (status-driven):

- **Tier 1a — renderer + filled demo sheet, closed:** Dungeons & Dragons,
  Traveller, Sword Chronicle, Vampire: The Masquerade, Werewolf: The
  Apocalypse, Mage: The Ascension. Each ships a dedicated sheet renderer and a
  real, filled-in demo sample PC (Rilla Windmere, Renner, Lady Elyse Vaelor,
  Nico Alvarez, Ash Redhand, Jax) rather than a design brief.
- **Tier 1b — `ready-for-polish`, still need a sheet:** Call of Cthulhu, Delta
  Green, Blades in the Dark, Alien RPG, Cyberpunk RED, Mothership, Fate Core.
  Concept, template, and demo kit are ready; each needs either a dedicated
  renderer or a template-pack sheet page, then a filled demo sample PC.
- **Tier 2 — popular systems needing reference work:** Pathfinder, Warhammer
  Fantasy Roleplay, Warhammer 40,000 Roleplay, Starfinder, The One Ring,
  Dragonbane, Shadowdark RPG, Mörk Borg, Old-School Essentials, Savage Worlds.
- **Tier 3 — the long tail:** Dark Ages line, Pendragon, Reign, Burning Wheel,
  Fabula Ultima, Candela Obscura, Changeling, Demon, Hunter, Mummy, Wraith,
  The King in Yellow, Twilight: 2000, 2300AD, Coriolis.

Note on research: bulk automated research of all systems at once proved a poor
token/value trade. Work game-by-game against the in-app checklist instead,
consulting SRDs and official references per system as each is picked up.

## Post-1.1 Backlog

### A. Responsive, accessible, and fast at scale - M

Phone chrome shipped (item 32). Remaining: keyboard navigation and screen
reader passes as release criteria, virtualized lists, paged media loading,
cached repo reads, incremental search updates, thumbnails, reduced-motion
sweeps, and automated accessibility checks. Connected repos already support
keyboard-accessible reordering.

### B. Sheet editor and print polish - M

Full field editors for D&D 5e, Pathfinder 2e, and World of Darkness sheets,
plus deeper print/theme polish. Feeds directly into the deferred sheet pass:
each Tier 1 system that gets a real sheet should also get editor + print
treatment.
Print/PDF is already exposed in the editor toolbar for sheet-bearing pages.

### C. Deeper VTT sync - L

Re-import previews using source IDs and hashes across every importer, VTT
mapping for reusable properties/components, and optional Foundry module
push/pull with explicit previews and conflict handling. Single-character JSON
imports already store source path/ID/hash and report new/unchanged/changed.

### D. Collaboration polish - M-L

Clearer in-editor "who is editing" surfaces, soft locks, stale-lock handling,
and richer conflict resolution for simultaneous edits.

### E. Offline workspace and installable PWA - L

Recent campaigns readable offline, drafts while remotes are down, queued local
writes, and clear sync/conflict state.

### F. Extension points and automation rules - L

Versioned APIs for article types, templates, importers, validators, renderers,
MCP tools, and automation rules such as "notify GMs when an import is approved"
or "add new events to the active timeline."

### G. Zero-friction onboarding - S

Mostly landed: demo seeding, the Campaign home page, local-folder-first
creation, and the dashboard Demo Library cover the first-run story. Remaining:
tighten the create-campaign path ordering and the local-folder → GitHub upgrade
flow.

### H. Hosted / managed option - L

Self-hosted Docker remains the core path. A managed option may eventually help
non-technical groups, but should not compromise the own-your-data model.

## Recommended Next Release Sequence

### Release 1.2 - Reliability and repair

1. Ship the repair/rebuild action for manifest, search index, and page cache.
2. Expand health checks for empty bodies, stale generated state, invalid
   parents, mismatched counts, and last Git sync status.
3. Make page detail reads recover from empty cache when source content exists.
4. Make generated indexes explicitly disposable and rebuildable.
5. Add regression tests for blank cache, parent nesting, public/GM drift, and
   generated-index rebuilds.

### Release 1.3 - Bulk edit safety

1. Rework bulk organize to update page source first.
2. Rebuild generated snapshots from page source after bulk changes.
3. Commit page changes and generated snapshots together when Git sync succeeds.
4. Preserve local intent and mark indexes stale when Git sync or rebuild fails.
5. Add large-campaign tests for parent moves, approvals, category changes, and
   GitHub listings with missing file text.

### Release 1.4 - DB working copy and sync queue

1. Introduce the page working-copy table.
2. Move page list/detail/organize/review/public preview reads to the working
   copy.
3. Add dirty flags, last sync SHA, and last sync error.
4. Batch Git writes behind a sync queue and explicit Sync Now action.
5. Show "saved locally, Git sync failed" instead of making failed pushes look
   like lost edits.

### Release 1.5 - Conflict handling and offline foundations

1. Add three-way page conflict records for local dirty vs. remote changed pages.
2. Regenerate generated JSON after conflict resolution instead of manually
   merging snapshot files.
3. Make dirty local edits survive restart and network outage.
4. Lay the foundation for offline/PWA work.

### Release 1.6 - Game system depth and scale polish

1. Resume the per-game sheet/template checklist pass.
2. Keyboard/screen-reader accessibility pass.
3. Performance budgets, virtualized lists, thumbnails, and large-campaign
   testing.
4. Re-import previews, Foundry module sync research, and extension rules.
