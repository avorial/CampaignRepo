# CampaignRepo Roadmap

CampaignRepo is now at **1.0**. It has moved from "GitHub-backed RPG wiki" into
a broad campaign platform: wiki, maps, sessions, quests, public publishing,
dashboards, imports, AI tools, and local/GitHub storage are all on `main`.

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
- Media manager with metadata, captions, alt text, tags, saved filters, nested
  media folders, bulk move/caption/tag cleanup, and page rendering.
- Interactive maps with image pins, player/GM layers, nested map links, routes,
  regions, measuring scale, and journeys.
- Nested page hierarchy through `parent` frontmatter and collapsible sidebars.
- Relationship graph with typed relationship frontmatter, inverse labels,
  hierarchy/family layout, dense-campaign clusters, graph editing, search, and
  health checks.
- Full-text search plus a global command palette.
- Player portal and public no-login sites for approved player-visible content.
- Public campaign gallery, custom public link names, ratings, recently-updated
  discovery signals, clone-this-world flow, contribution guidance, GitHub
  compare/PR handoff, and public quest display.
- Sessions, quests, fantasy calendar, overview widgets, boards, manuscripts, and
  lexicon/naming tools.
- Traveller, D&D 5e, and World of Darkness character-sheet renderers, with
  Traveller rolling and editor controls.
- Reusable category property schemas, custom typed fields, inventories,
  abilities, resources, and safe formula fields stored in campaign YAML/page
  frontmatter.
- Review queue, campaign health center, bulk page organization, notifications,
  assignments, mentions, page watches, and page history/diff/restore workflow.
- Importers for Foundry actors, generic character JSON, Obsidian, Notion,
  OneNote, Google Docs, CSV, journals, Roll20, LegendKeeper, World Anvil, full
  ZIP/JSON backup export, and character re-import diffing.
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

### 10. Editor upgrades - shipped

The editor has slash commands, toolbar actions, table/divider helpers, paste image
upload, GM/player/handout preview, conflict detection, history diff, and restore
to editor.

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

### 16. Version history, activity, diff, and restore - shipped

Page history, GitHub diff links, inline diff view, restore-to-editor, and recent
activity widgets are live.

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

### 23. Notifications, assignments, mentions, and watches - shipped

In-app notifications exist for review requests, assignments, mentions, and page
watch changes.

## 1.0 Complete

### 24. Character sheets across systems - core shipped

Traveller, D&D 5e, Pathfinder 2e, and World of Darkness markdown sheet blocks
render in the reader, and the editor can insert system-specific sheet scaffolds.
Traveller has the most complete experience, including inline editing support and
rolling. Foundry D&D actors can import into D&D sheet blocks. D&D 5e, Pathfinder
2e, and Mage: The Ascension have sheet renderers shaped around familiar
paper-sheet structures, with Pathfinder using rank-aware skills/saves and print
polish.

### 25. Relationship trees and genealogy views - shipped

The graph supports family/hierarchy layout, collapsed category clusters for dense
campaigns, direct relationship editing from the graph, node search/highlight,
and health checks for missing relationship targets, self-links, and unknown
relationship types.

### 26. Import/export and VTT bridges - shipped

The import hub now covers CSV, Foundry journals, Foundry actors, Obsidian,
Notion, OneNote, Google Docs, World Anvil, Roll20, LegendKeeper, generic character JSON,
and character diff previews. CampaignRepo exports full ZIP/JSON backups that
include campaign content, media, sessions, quests, maps, search data, templates,
and settings.

### 27. Bulk organization and media cleanup - shipped

Bulk page category, visibility, approval, parent, and tag editing are live.
Organize also includes a media table with name/type/tag/unused filters, sorting,
bulk tag add/remove, and bulk delete. The campaign media manager supports saved
media filters, nested media folders, recursive media listing, bulk move, bulk
caption editing, and bulk tag replace/append.

### 28. Real-time collaboration and soft locks - core shipped

Presence endpoints, conflict detection, and restore-to-editor workflows exist.
The app protects Git-backed editing without trying to become a true live
multiplayer document editor.

### 29. Reusable properties, inventories, and abilities - shipped

Campaigns can define reusable category property schemas in `campaign.yaml`.
Editors render text, textarea, number, choice/select, checkbox, date, counter,
link, and safe formula fields into page `customProps`. Pages also support
portable inventory, ability, and resource frontmatter.

### 30. Publishing ecosystem - shipped

Public sites, gallery, custom slugs, quests, clone flow, fork-proposal
workflow, token-based single-page and quest share links (with OpenGraph
preview metadata), gallery filters for system/sort/tags, ratings,
recently-updated signals, community library type, contribution guidance, and a
GitHub compare/PR handoff for public-world contributions are live.

### 31. Maps 2.0 persistence - shipped

Map pins, player/GM layers, discovered/undiscovered pins, nested map links, and
health-center validation for broken pins, nested-map links, missing pin images,
missing map backgrounds, and route integrity are in place. Routes, regions,
measuring scale, journeys, layers, pin images, and discovery state persist in
portable map JSON.

## Post-1.0 Backlog

These are not blockers for 1.0. They are candidate next-release improvements.

### A. Responsive, accessible, and fast at scale - M

Make mobile, keyboard navigation, screen readers, and large campaigns release
criteria. Add virtualized lists, paged media loading, cached repo reads,
incremental search updates, thumbnails, reduced-motion handling, and automated
accessibility checks.

Initial polish pass: connected repos can be reordered by keyboard-accessible
move controls as well as drag and drop, and dashboard copy reflects the current
sheet systems.

### B. Sheet editor and print polish - M

Add full field editors for D&D 5e, Pathfinder 2e, and World of Darkness sheets,
plus deeper print/theme polish and more system-specific sheet themes.

### C. Deeper VTT sync - L

Add re-import previews using source IDs and hashes across every importer, VTT
mapping for reusable properties/components, and optional Foundry module
push/pull with explicit previews and conflict handling.

### D. Collaboration polish - M-L

Add clearer in-editor "who is editing" surfaces, soft locks, stale-lock handling,
and richer conflict resolution for simultaneous edits.

### E. Offline workspace and installable PWA - L

Make recent campaigns readable offline, allow drafts while remotes are down,
queue writes locally, and show sync/conflict state clearly.

### F. Extension points and automation rules - L

Define versioned APIs for article types, templates, importers, validators,
renderers, MCP tools, and automation rules such as "notify GMs when an import is
approved" or "add new events to the active timeline."

### G. Zero-friction onboarding - S-M

Continue simplifying first-run setup:

- "Create campaign" as the primary path.
- GitHub setup hidden until requested.
- Sample campaign/template seeding.
- Clear local-folder to GitHub upgrade flow.

### H. Hosted / managed option - L

Self-hosted Docker remains the core path. A managed option may eventually help
non-technical groups, but should not compromise the own-your-data model.

## Recommended Next Release Sequence

### Release A - Polish and scale

1. Responsive/accessibility pass.
2. Performance budgets and large-campaign testing.
3. Thumbnail/paged media loading and media history.
4. First-run onboarding polish.

### Release B - Sheet depth

1. D&D and World of Darkness sheet field editors.
2. Print/theme polish for sheets.
3. Pathfinder sheet renderer/editor.
4. Better character import paths.

### Release C - Sync and extensions

1. Re-import previews across all importers.
2. Foundry module sync research/prototype.
3. VTT/export mappings for reusable properties/components.
4. Extension and automation rules.

### Release D - Offline and hosted options

1. Offline/PWA foundations.
2. Sync/conflict queueing for local drafts.
3. Managed hosting research.
