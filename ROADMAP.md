# CampaignRepo Roadmap

CampaignRepo is past **1.0** and into the **1.1 polish wave**. The platform
surface is broad — wiki, maps, sessions, quests, publishing, dashboards,
imports, AI tools, and local/GitHub storage — so the focus has shifted from
adding surfaces to making every game system feel first-class on the surfaces
that exist.

The guiding promise remains the same: every campaign is a portable folder of
Markdown, YAML, JSON, and media files. CampaignRepo makes that folder feel like
a modern worldbuilding app, but the repo stays the source of truth.

Effort key: **S** = days, **M** = about a week, **L** = multi-week.

> Looking for what comes *after* this roadmap? New, not-yet-scheduled feature
> directions live in [ROADMAP-IDEAS.md](ROADMAP-IDEAS.md).

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

## The 1.2 Centerpiece: Per-Game Sheet & Template Pass - L

This is the main effort for the next release. The demo system exists precisely
to drive it: each game's GM Primer & Checklist page lists the field groups,
layout direction, and cleanup notes for that system. Working the checklist
means, per game:

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

- **Tier 1 — already `ready-for-polish`, verify and close:** Dungeons &
  Dragons, Traveller, Sword Chronicle (renderer + template shipped in 1.1),
  Vampire: The Masquerade, Werewolf: The Apocalypse, Mage: The Ascension, Call
  of Cthulhu, Delta Green, Blades in the Dark, Alien RPG, Cyberpunk RED,
  Mothership, Fate Core.
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
plus deeper print/theme polish. Feeds directly into the 1.2 centerpiece: each
Tier 1 system that gets a real sheet should also get editor + print treatment.
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

### Release 1.2 - Game system depth (the checklist pass)

1. Tier 1 systems: verify sheets, close checklists, fill demo sheets.
2. Tier 2 systems: reference work + sheet/template reformatting.
3. Sheet editor/print polish for each system as it lands (backlog B).
4. Demo status page or dashboard widget showing per-game progress.

### Release 1.3 - Scale and access

1. Keyboard/screen-reader accessibility pass.
2. Performance budgets, virtualized lists, thumbnails, large-campaign testing.
3. Onboarding path tightening (backlog G remainder).

### Release 1.4 - Sync and extensions

1. Re-import previews across all importers.
2. Foundry module sync research/prototype.
3. VTT/export mappings for reusable properties/components.
4. Extension and automation rules.

### Release 1.5 - Offline and hosted options

1. Offline/PWA foundations.
2. Sync/conflict queueing for local drafts.
3. Managed hosting research.
