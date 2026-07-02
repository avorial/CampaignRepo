# CampaignRepo Roadmap

CampaignRepo has moved from "GitHub-backed RPG wiki" into a broad campaign
platform: wiki, maps, sessions, quests, public publishing, dashboards, imports,
AI tools, and local/GitHub storage are all on `main`.

The guiding promise remains the same: every campaign is still a portable folder
of Markdown, YAML, JSON, and media files. CampaignRepo can make that folder feel
like a modern worldbuilding app, but the repo stays the source of truth.

Effort key: **S** = days, **M** = about a week, **L** = multi-week.

## Current Product State

CampaignRepo currently ships:

- GitHub and local-folder campaign storage.
- Markdown wiki pages with YAML frontmatter, wiki links, aliases, backlinks, GM
  blocks, named secret groups, covers, galleries, and transclusion.
- Configurable campaign categories and per-game template packs.
- Media manager with metadata, captions, alt text, tags, and page rendering.
- Interactive maps with image pins linked to wiki pages.
- Nested page hierarchy through `parent` frontmatter and collapsible sidebars.
- Relationship graph with typed relationship frontmatter and inverse labels.
- Full-text search plus a global command palette.
- Player portal and public no-login sites for approved player-visible content.
- Public campaign gallery, custom public link names, clone-this-world flow, and
  public quest display.
- Sessions, quests, fantasy calendar, overview widgets, boards, manuscripts, and
  lexicon/naming tools.
- Traveller character sheets rendered from markdown/frontmatter, with rolling.
- Review queue, campaign health center, bulk page organization, notifications,
  assignments, mentions, page watches, and page history/diff/restore workflow.
- Importers for Foundry actors, generic character JSON, Obsidian, Notion, Google
  Docs, CSV, journal/world exports, and character re-import diffing.
- AI generation, AI campaign Q&A, and MCP JSON-RPC tools.
- Docker/GHCR deployment path.

## Done

### 1. Interactive maps with pins - shipped

Maps are stored as portable JSON under `wiki/maps`, use uploaded media images,
and support pins that open linked pages.

### 2. Nested hierarchy and breadcrumbs - shipped

Pages support `parent` frontmatter. Private and public sidebars render nested,
collapsible trees.

### 3. Expanded article types and template library - shipped

Template packs and editable categories cover characters, NPCs, locations,
organizations, species, items, events, lore, vehicles, and game-specific page
types. Every game has a character-sheet template.

### 4. Transclusion and heading links - shipped

Wiki links support heading anchors, and `:::include` embeds reusable page content.

### 5. Image galleries and cover images - shipped

`cover` frontmatter renders article banners, and `:::gallery` blocks render image
grids with lightbox support in private and public views.

### 6. Timeline and calendar foundations - shipped

Timeline/event views exist, and the fantasy calendar supports configurable
months, weekdays, eras, current in-world date, and date-linked sessions/quests.

### 7. Relationship graph - core shipped

Typed relationship frontmatter powers reader connection panels and a graph page
with typed edges, filters, focus, pan, and zoom.

### 8. Published public sites - shipped

Campaigns can publish stable `/site/<slug>` links. Public pages, media, and now
player-visible quests are available without login while GM blocks and drafts stay
hidden.

### 9. Per-campaign theming - shipped

Themes live in `campaign.yaml`, sanitize colors/fonts, and apply to workspace,
player portal, and public site.

### 10. Editor upgrades - core shipped

The editor has slash commands, toolbar actions, table/divider helpers, paste image
upload, GM/player/handout preview, conflict detection, history diff, and restore
to editor. A true block/WYSIWYG editor remains future work.

### 11. Visibility groups - shipped

Named groups in `campaign.yaml` can reveal `:::secret group="..."` blocks to
specific players. GMs see all secret blocks.

### 12. Manuscripts - shipped

Manuscripts are stored as `wiki/manuscripts/<slug>.yaml`, assemble pages into
ordered long-form documents, and support print/PDF workflows.

### 13. AI generators and Q&A - shipped

CampaignRepo includes deterministic generators, optional OpenAI-compatible
expansion, generated draft previews, and a campaign Q&A chat over the search
index with citations.

### 14. Global command palette - shipped

`Cmd/Ctrl+K` searches campaigns/pages and jumps to common campaign sections.

### 15. Session workspace - shipped

Sessions are Markdown/YAML files with agenda, pinned pages, date/status, GM
notes, handout queue, and report-page creation.

### 16. Version history, activity, diff, and restore - core shipped

Page history, GitHub diff links, inline diff view, restore-to-editor, and recent
activity widgets are live. Media history and richer filtering remain future work.

### 17. Campaign health center - shipped

Health checks cover broken links, invalid parents, parent/category mismatch,
missing media, duplicate aliases, empty names, unapproved pages, orphaned pages,
and oversized media, with repair links/actions.

### 18. Quests and campaign state - shipped

Quests live in `wiki/quests`, have status, arc, reward, visibility, objectives,
participants, locations, clocks, world dates, GM/player/public views, and overview
widgets.

### 19. Configurable campaign dashboards - shipped

Overview widgets are stored in `campaign.yaml`, configurable for GMs, and
spoiler-safe for players.

### 20. Lexicon and naming tools - shipped

`wiki/lexicon.yaml` stores glossary entries and phoneme/pattern-based name
generation.

### 21. Local folder storage - shipped

The storage adapter supports both GitHub repositories and local folders, letting
new campaigns start without GitHub.

### 22. Public gallery and clone flow - shipped

`/site` lists published worlds, public sites can be cloned into a viewer's own
campaign/repo, and clone counts feed discovery.

### 23. Notifications, assignments, mentions, and watches - core shipped

In-app notifications exist for review requests, assignments, mentions, and page
watch changes. Email and category watches remain future work.

## In Progress / Partial

### 24. Character sheets across systems - M

Traveller is functional and polished enough to use. Still needed:

- D&D 5e / Pathfinder sheet renderers and editors.
- World of Darkness sheet renderers and editors.
- Print views and theme-specific sheet polish.
- Better import paths from external character generators/VTT exports.

### 25. Relationship trees and genealogy views - M-L

The graph is useful, but the relationship feature still needs:

- Family-tree / hierarchy layout mode.
- Collapsed clusters for dense campaigns.
- Relationship editing directly from the graph.
- Graph search/highlight and stronger health checks for broken relationship
  targets.

### 26. Import/export and VTT bridges - M-L

Many importers exist, but this should become a coherent migration/export system:

- Guided import UI for all connectors.
- Roll20, OneNote, LegendKeeper, and stronger World Anvil migration.
- Portable CampaignRepo export bundle.
- Re-import previews using source IDs and hashes across every importer.
- Optional Foundry module push/pull with explicit previews and conflict handling.

### 27. Bulk organization and media cleanup - M

Bulk page category/visibility/approval works. Still needed:

- Bulk parent and tag editing in the UI.
- Sorting and saved filters.
- Media table with bulk tags, captions, moves, unused-file cleanup, and large-file
  checks.

### 28. Real-time collaboration and soft locks - M-L

Presence endpoints exist. Still needed:

- Clear in-editor "who is editing" surfaces.
- Soft locks and stale lock handling.
- Better conflict resolution for simultaneous edits.
- True live collaboration only if it can coexist cleanly with Git commits.

### 29. Reusable properties, inventories, and abilities - M-L

Some page frontmatter can render inventory, abilities, and resources. The larger
feature still needs:

- A reusable property schema.
- Field types: text, number, choice, link, date, counters, and safe formulas.
- System-specific display templates.
- VTT/export mapping.

### 30. Publishing ecosystem - M-L

Public sites, gallery, custom slugs, quests, clone flow, fork/pull-request
workflow, token-based single-page and quest share links (with OpenGraph
preview metadata), and gallery filters for system, sort, and tags are live.
Still needed:

- Rating/recently-updated gallery signals.
- Community template/campaign library conventions.

## Still Open

### 31. Maps 2.0 - shipped

Layers, nested maps, regions, labels, routes, measuring, journey playback,
discovered/undiscovered locations (with a GM "player view" fog-of-war preview),
and health-center validation for broken pins, nested-map links, missing pin
images, missing map backgrounds, and out-of-bounds routes are all shipped.

### 32. Responsive, accessible, and fast at scale - M

Make mobile, keyboard navigation, screen readers, and large campaigns release
criteria. Add virtualized lists, paged media loading, cached repo reads,
incremental search updates, thumbnails, reduced-motion handling, and automated
accessibility checks.

### 33. Offline workspace and installable PWA - L

Make recent campaigns readable offline, allow drafts while remotes are down,
queue writes locally, and show sync/conflict state clearly.

### 34. Extension points and automation rules - L

Define versioned APIs for article types, templates, importers, validators,
renderers, MCP tools, and automation rules such as "notify GMs when an import is
approved" or "add new events to the active timeline."

### 35. Zero-friction onboarding - S-M

The dashboard is much closer, but first-run setup still needs polish:

- "Create campaign" as the primary path.
- GitHub setup hidden until requested.
- Sample campaign/template seeding.
- Clear local-folder to GitHub upgrade flow.

### 36. Hosted / managed option - L

Self-hosted Docker remains the core path. A managed option may eventually help
non-technical groups, but should not compromise the own-your-data model.

## Recommended Next Release Sequence

### Release A - Polish the table experience

1. D&D and World of Darkness character sheets.
2. Print/theme polish for sheets.
3. Better character import paths.

### Release B - Connect and migrate

1. Unified import UI.
2. Portable export bundle.
3. LegendKeeper/World Anvil/OneNote/Roll20 migration.
4. Re-import previews across all importers.

### Release C - Publish and share

1. Single-page and quest share links.
2. Better gallery discovery and tags.
3. Fork/pull-request workflow for public worlds.

### Release D - Scale and reliability

1. Responsive/accessibility pass.
2. Performance budgets and large-campaign testing.
3. Media bulk cleanup.
4. Offline/PWA foundations.

### Release E - Deeper world systems

1. Maps 2.0.
2. Reusable properties/components.
3. Relationship tree layouts.
4. Extension and automation rules.
