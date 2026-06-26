# CampaignRepo Roadmap — toward LegendKeeper & World Anvil

Goal: grow CampaignRepo from "GitHub-backed RPG wiki" into a worldbuilding tool
that feels like **LegendKeeper** (sleek, map-first, fast) and **World Anvil**
(deep, structured, presentation-rich) — while keeping the core promise: *the
campaign repo of Markdown + media stays the source of truth.*

Everything below is designed to live in the repo as files: pages in
`/wiki/pages`, media in `/wiki/media`, and structured data as JSON/YAML sidecars
(e.g. `/wiki/maps/*.json`, `/wiki/timelines/*.yaml`). No per-page database.

Effort key: **S** = days · **M** = ~1 week · **L** = multi-week.

---

## Where we are (shipped)
Pages + frontmatter · `[[wiki-links]]` + backlinks · `:::gm` secrets + GM/player
visibility + approval queue · per-system template packs · media manager (renders
in pages) · timeline (event dates) · relationship graph · FTS search · player
portal · invites/admin · MCP/AI upload.

---

## Tier 1 — Signature features  ✅ ALL SHIPPED
*(Interactive maps, nested hierarchy, expanded types, transclusion, galleries/covers — all live on `main`.)*

### 1. Interactive maps with pins  ·  L  ·  *LegendKeeper's killer feature*
Upload a map image to `/wiki/media`; drop **pins** that link to pages; click a
pin to open the article. Store pins as `/wiki/maps/<slug>.json`
(`{ image, pins: [{x, y, pageSlug, label, icon }] }`). Later: nested maps
(a pin opens another map), layers, and a "Maps" category in the sidebar.
*This is the single biggest differentiator to chase first.*

### 2. Nested hierarchy / folders + breadcrumbs  ·  M
Today pages are flat under 5 categories. Add a `parent` frontmatter field (or
folder paths) to build a **tree** in the sidebar with collapse + breadcrumbs.
Gives World Anvil's category nesting and LK's folder feel without leaving files.

### 3. Expanded article types & template library  ·  M  ·  *World Anvil's breadth*
Go beyond character/npc/location/event/game. Add types: **organization/faction,
species/ancestry, item, spell/ability, religion, language, settlement, vehicle/
ship, condition/lore**. Each is a category + a rich template with the right
frontmatter fields and section scaffold. Mostly data — extends the pack system.

### 4. Transclusion / embeds  ·  S–M
`[[Page#Section]]` to link to a heading, and an include directive
(`![[Page]]` or `:::include Page:::`) to embed one page's content/section inside
another. Huge for reusable lore (a faction blurb shown on many pages).

### ~~5. Image galleries & cover images~~  ·  S  ✅ SHIPPED
A `cover` frontmatter image rendered as an article banner, and a `:::gallery`
block for image grids with lightbox. Makes pages feel like WA/LK articles.
*Shipped: `:::gallery` parses markdown image syntax into a CSS grid; cover renders
as a banner; clicking either opens a fullscreen lightbox overlay (Esc to close).
Both wired in the private page editor and the public site.*

---

## Tier 2 — Depth & presentation

### 6. Timeline 2.0  ·  M  ·  ✅ SHIPPED
Upgrade the current date-sorted list into **eras/ages**, multiple parallel
tracks (political / personal / cosmic), and a visual horizontal timeline.
Driven by `/wiki/timelines/*.yaml` + event frontmatter.

### 7. Relationship trees & genealogy views  ·  M-L  ·  🚧 CORE SHIPPED
Dedicated `/campaigns/[id]/graph` page with a force-directed SVG explorer:
all campaign pages as nodes colored by category; wiki links + typed semantic
relationships (#18) as edges (typed edges dashed + labeled on hover); click any
node to focus — dims unconnected nodes, shows a detail panel with outgoing and
incoming links including relationship-type labels; refocus by clicking adjacent
nodes; pan by drag, zoom by scroll; category filter checkboxes; typed-only edge
toggle. Graph API updated to include `relType` edges from page frontmatter.
"Graph" button added to campaign topbar nav.
Follow-ups: genealogy hierarchy layout preset for family trees; collapsed clusters
for dense subgraphs; edit-relationship from graph view; search/highlight by name.

### 8. Published public site / shareable links  ·  M  ·  ✅ SHIPPED
A read-only, no-login public presentation of player-visible, approved pages
(per campaign) at a shareable `/site/<slug>` URL — like World Anvil's public
worlds. GMs publish/unpublish/rotate the link from the campaign Settings tab;
GM blocks and unapproved pages are never exposed. Clean reader theme with
category nav, search, covers, galleries, and in-world wiki-link navigation.
Public media is served via `/public-media/<slug>/...` gated on the enabled site.

### 9. Per-campaign theming  ·  S  ·  ✅ SHIPPED
A campaign sets accent colors, a curated display font, and a banner image via a
`theme:` block in `campaign.yaml`, applied as CSS variables to the workspace,
player portal, and public site. Edited from the Settings tab; colors and font
are validated/sanitized server-side (no arbitrary CSS).

### 10. Editor upgrades (toward block editing)  ·  M–L  ·  🚧 CORE SHIPPED
Slash-command menu, drag-to-reorder, table support, inline image paste-upload,
and a cleaner WYSIWYG-ish surface over Markdown. Closes the gap with LK's
block editor without abandoning Markdown-on-disk.

Shipped: `/` at the start of a line opens a slash command menu (filtered by
typing, keyboard navigable with ↑↓/Tab/Enter, Escape to close) inserting
headings, quote, code block, table, divider, task list, GM block, and include.
Table button and Divider button added to the format toolbar. Paste an image into
the editor to upload it directly to media and insert the markdown reference
(fallback error if no personal token). Cmd+S saves. Follow-ups: drag-to-reorder
blocks, contenteditable WYSIWYG surface, frontmatter-aware tab completion.

---

## Tier 3 — Ambitious / architectural

### 11. Real-time collaboration  ·  L  ·  *tension with the Git model*
LK is real-time; we're commit-based. Options: presence + soft-locking (show who's
editing, warn on conflict — we already detect SHA conflicts), or a CRDT live
layer that periodically commits. Start with presence/locking (S–M) before true
real-time (L).

### 12. Visibility tiers / subscriber groups  ·  M
Beyond GM vs player: named groups (e.g. "the players who know about the cult")
with per-block reveals. Generalizes `:::gm` into `:::secret group="..."`.

### 13. Manuscripts / notebooks / long-form  ·  M
GM-only notebooks and a "manuscript" mode that stitches pages into chapters for
session prep or fiction — World Anvil's manuscripts.

### 14. Local & hosted AI generators  ·  M
Add in-app NPC, settlement, faction, rumor, quest, encounter, and relationship
generators that can use either a local OpenAI-compatible endpoint (for example
Ollama or LM Studio), a configured hosted model, or the existing MCP workflow.
Build a small context pack from explicitly selected campaign pages, templates,
relationships, and lexicons; never transmit campaign material to a hosted model
without making the destination and selected context clear. Show a structured
preview with provenance before writing, and create generated pages as unapproved.
Keep deterministic random-table and lexicon generators available as a fast,
offline, no-model fallback.

### 15. Character sheets / statblocks per system  ·  M  ·  🚧 TRAVELLER SHIPPED
System-aware structured sheets (Traveller UPP/UWP already partly there; D&D
statblocks; WoD sheets) rendered from frontmatter, plus Foundry sync hooks.

Shipped: a Traveller (Mongoose 2e) character sheet stored in page frontmatter
(`sheet`), matching the data model of the MG-traveller-character-generator
(characteristics, skills, identity, equipment, credits). It renders in the page
reader on Traveller campaigns — characteristic cards with computed DM, skills,
gear — and is edited inline in the page editor (character/npc pages). Follow-ups:
click-to-roll, themes/print, combat/gear tabs, importing the generator's JSON,
and D&D / WoD sheets.

---

## Tier 4 - Campaign operations & platform maturity

Tier 1 made CampaignRepo a real worldbuilding tool. This tier makes it a product
that a GM can rely on every week: fast to navigate, useful during a session,
safe to maintain, and comfortable with thousands of pages and media files.

### 16. Global command palette & unified finder  ·  S-M  ·  ✅ SHIPPED
Add `Ctrl/Cmd+K` from every authenticated screen. Search pages, media, maps,
templates, campaigns, and common actions in one keyboard-first surface. Results
show category, campaign, visibility, and parent path. Include quick actions such
as create page, upload media, open map, rebuild search, and invite player.

Shipped: a global `Cmd/Ctrl+K` palette (mounted in the root layout, active only
when signed in) with keyboard nav. Searches pages full-text via `/api/search`,
lists campaigns, and offers context-aware navigation (workspace, organize, maps,
admin, player portal). Follow-ups: media/template results, parent path in the
hint, and one-shot mutating actions (rebuild search, upload media, invite).

### 17. Session workspace  ·  M  ·  ✅ SHIPPED
Create a focused GM session view with agenda, scenes, encounters, handouts,
initiative links, pinned pages, private notes, and a player-facing presentation
queue. Store sessions as Markdown plus YAML frontmatter so preparation and play
notes remain portable. After play, turn checked agenda items and notes into a
session report or timeline events.

Shipped: `/campaigns/[id]/sessions` (GM/owner) — create sessions, each stored as
`wiki/sessions/<slug>.md` (YAML frontmatter + Markdown notes). The editor has an
agenda checklist, pinned-page picker, status/date, private GM notes, and a "Make
report page" action that spins the notes + checked agenda into an `event` page.
Follow-ups: scenes/encounters/initiative blocks, handouts, player presentation
queue.

### 18. Structured relationships & semantic graph  ·  M-L  ·  🚧 CORE SHIPPED
Replace plain `keyLinks` with typed relationships such as member-of, located-in,
allied-with, enemy-of, owns, parent-of, and appears-in-session. Keep wiki links
as the simple default, but allow richer edges in frontmatter. Use the same data
for relationship panels, the interactive relationship trees in item 7, map
context, graph filters, genealogy layouts, campaign health checks, and MCP tools.
Define inverse relationships and direction rules centrally so "member-of" can
render as "has-member" from the opposite node without duplicating data.

Shipped: `relationships` frontmatter field (`[{ type, target, label?, notes? }]`)
on any page. 20 built-in typed relationships across faction, family, location,
ownership, political, and session categories, each with a defined inverse label
(e.g. "member-of" ↔ "has-member"). Page editor sidebar has an add/edit/remove
relationship UI with a type dropdown and page name datalist. Reader shows a
"Connections" panel with outgoing (gold label) and incoming (computed from all
pages, shown with inverse label) relationships. Stored as plain YAML in the page
file — no separate graph database. Follow-ups: graph view integration (typed
edge colors/filters), genealogy layout, campaign health check for broken targets,
MCP tool for relationship queries, notes/since/until fields in the UI.

### 19. Version history, activity feed & restore  ·  M  ·  🚧 CORE SHIPPED
Expose the Git history already protecting campaign content. Show who changed
what, compare revisions, restore an earlier page or media metadata file, and
surface recent activity by campaign. Add a compact dashboard feed for new pages,
approvals, imports, comments, invites, and publishing changes.

Shipped: "History" tab in the page reader toolbar fetches the last 20 commits for
that file (`/api/campaigns/[id]/pages/[slug]/history`) and shows date, author,
commit message, and SHA with a link to the GitHub diff. "Recent activity" widget
added to the overview dashboard (`/api/campaigns/[id]/activity`) showing the last
30 repo commits with author, date, message, and GitHub link. Both use existing
GitHub API auth. Follow-ups: diff/compare view, restore (commit with old content),
media file history, mention-based filtering.

### 20. Campaign health & repair center  ·  S-M  ·  ✅ SHIPPED
Expand repo validation into an actionable health dashboard: broken links,
orphaned pages, duplicate aliases, invalid parents, missing media, empty required
fields, stale imports, unapproved content, oversized files, and search-index
drift. Each finding should link to the affected item and offer safe bulk repair
where possible.

Shipped: `/campaigns/[id]/health` scans every page for broken wiki links,
invalid parents, parent category mismatch (won't nest), missing media, duplicate
aliases, empty names, and unapproved content — grouped with severity badges,
each linking to the page (and to the review queue / Organize for repair).
Follow-ups: orphaned pages, oversized files, search-index drift, inline repair.

### 21. Bulk organization tools  ·  M  ·  🚧 PAGES SHIPPED
Add a table view for pages and media with filtering, sorting, multi-select, and
bulk actions. Support changing category, parent, visibility, approval, tags, and
archive state across many pages. For media, support bulk tags, captions, moves,
and unused-file cleanup. Every operation should summarize its planned commits
before writing.

Shipped: `/campaigns/[id]/organize` — a pages table with name/category filter,
multi-select, and one-commit bulk change of category / visibility / approval
(via `commitFiles`). Follow-ups: bulk parent + tags in the UI (backend already
takes `parent`), sorting, and the media table.

### 22. Import/export & VTT bridges  ·  M-L
Turn one-off JSON import into repeatable connectors. Add guided Foundry Actor and
Journal import, Roll20 campaign import, CSV/Markdown bulk import, and a portable
CampaignRepo export bundle. Track source IDs and hashes so re-import can update
existing content instead of duplicating it. Later, support push/pull sync with a
Foundry module using explicit previews and conflict handling.

### 23. Notifications, assignments & review workflow  ·  M
Let GMs assign a page or review to another GM, mention members, and watch pages
or categories. Add in-app notifications for review requests, conflicts, invites,
mentions, and changed watched pages. Email delivery remains optional; the repo
and app activity log stay authoritative.

### 24. Responsive, accessible & fast at scale  ·  M
Treat mobile, keyboard navigation, screen readers, and large campaigns as release
criteria. Add virtualized long lists, paged media loading, cached repo reads,
incremental search updates, image thumbnails, visible focus states, reduced-motion
support, and automated accessibility checks. Set performance budgets for campaign
load, search, editor startup, and public pages.

### 25. Extension points & automation rules  ·  L
Define a small, versioned extension API around article types, templates, importers,
validators, renderers, and MCP tools. Add campaign automation rules such as "when
an imported page is approved, notify GMs" or "when an Event is created, add it to
the active timeline." Extensions must preserve the Markdown/YAML source-of-truth
model and declare every repository write they perform.

### 26. Fantasy calendars & world time engine  ·  M-L  ·  🚧 CORE SHIPPED
Support multiple custom calendars with configurable months, weekdays, leap rules,
eras, seasons, moons, phases, and named holidays. Link events, sessions, births,
deaths, and quests to in-world dates while retaining optional real-world dates.
Provide date conversion, age calculation, recurring events, current-world-date
tracking, and calendar/timeline cross-navigation. Store calendar definitions as
portable YAML and avoid assuming Earth-like date arithmetic.

Shipped: `/campaigns/[id]/calendar` — a custom calendar in `campaign.yaml`
(`calendar`) with editable months (name + length), weekdays, and era. Tracks a
current in-world date with weekday-correct formatting and no Earth assumptions
(advance ±day / +week / +month). A player-safe "Current date" widget feeds the
Overview dashboard. Follow-ups: multiple calendars, leap rules, moons/seasons/
holidays, linking events/sessions/quests to in-world dates, age calc.

### 27. Infinite boards, diagrams & plot canvases  ·  L
Add a freeform visual workspace for conspiracy boards, plot flows, magic systems,
scene order, family trees, and campaign brainstorming. Place page cards, notes,
images, groups, connectors, and relationship edges on a zoomable canvas. A board
can promote a note into a wiki page or bind an existing card to one. Save board
documents as repo JSON with stable node IDs so diagrams remain exportable.

### 28. Quests, story arcs & campaign-state tracking  ·  M  ·  ✅ SHIPPED
Add structured quests and arcs with status, objectives, participants, locations,
rewards, prerequisites, secrets, clues, and completion outcomes. Let objectives
link to sessions and timeline events. Include GM and player views, reusable quest
templates, and a compact active-threads panel for play. Extend the same model to
rumors, mysteries, downtime projects, and faction clocks without building a VTT.

Shipped: `/campaigns/[id]/quests` (GM/owner) — quests stored as
`wiki/quests/<slug>.md` (YAML + Markdown). Each quest has status (hook/active/
completed/failed), arc, reward, visibility, an objectives checklist, and
participant/location links to pages; the list is grouped by status, and an
"Active quests" widget feeds the Overview dashboard. Follow-ups: objective→
session/timeline links, player quest view, templates, faction clocks.

### 29. Reusable properties, inventories & abilities  ·  M-L
Allow any page to attach reusable components: inventory items, abilities, traits,
resources, counters, and custom properties. Properties may be text, numbers,
choices, links, dates, or safe formulas such as `maxHP = level * endurance`.
Components should support system-specific display templates while remaining
plain YAML/JSON data that can render in pages, statblocks, and VTT exports.

### 30. Configurable campaign dashboards  ·  M  ·  ✅ SHIPPED
Let each campaign define role-aware dashboard layouts from widgets: recent pages,
active quests, next session, current date, pinned maps, review queue, timeline,
random tables, campaign health, and watched changes. GMs can arrange the shared
layout while players receive a spoiler-safe version. Store widget configuration
in `campaign.yaml` so the dashboard travels with the repository.

Shipped: `/campaigns/[id]/overview` renders widgets (page counts, timeline, quick
links, review queue, campaign health) from a layout stored in `campaign.yaml`
(`dashboard.widgets`). GMs enable/disable + reorder via an editor; players get the
spoiler-safe view (GM-only widgets — review, health — are never rendered for them).
Follow-ups: quests/next-session/calendar/pinned-maps/random-tables widgets as
those systems land; drag-reorder.

### 31. Maps 2.0: layers, routes & discovery  ·  M-L
Build on shipped map pins with nested maps, visibility-controlled pin layers,
image pins, regions, labels, travel routes, measuring, and journey playback.
Support discovered/undiscovered locations and GM-only layers without turning the
map into a combat canvas. Keep map definitions portable and provide validation
for missing pages, media, child maps, and malformed routes.

### 32. Offline workspace & installable web app  ·  L
Make recently opened campaigns readable offline and allow drafts while the GitHub
remote is unavailable. Queue writes locally, show sync state clearly, and require
explicit conflict resolution before committing divergent edits. Ship an
installable PWA first; consider native wrappers only after offline sync is proven.

### 33. Language, lexicon & naming tools  ·  S-M
Add a language workspace with dictionary entries, translations, pronunciation,
word classes, etymology, custom glyph images, and links from terms used in pages.
Include naming patterns and generators that draw from a campaign lexicon. Keep
full grammar design optional so campaigns can use a simple glossary without
adopting a complete conlang workflow. These generators are deterministic and
offline by default, but can feed culturally consistent names into the local or
hosted AI generators in item 14.

---

## Earlier build order
The Tier 1 items in this original sequence are shipped; the open Tier 3 items
remain candidates within the new release sequence below.
1. **Interactive maps** (1) — the headline feature.
2. **Nested hierarchy** (2) + **expanded types** (3) — organization that scales.
3. **Transclusion** (4) + **galleries/covers** (5) — article richness.
4. Then Tier 2 presentation (public site, theming, timeline 2.0).
5. Tier 3 as appetite allows.

## Recommended next release sequence

### Release A - Find and fix
1. **Global command palette** (16).
2. **Campaign health center** (20).
3. **Bulk organization tools** (21).
4. **Configurable dashboards** (30).

This makes existing campaigns easier to navigate and clean before adding another
large content system.

### Release B - Run the game
1. **Session workspace** (17).
2. **Quests, arcs, and campaign state** (28).
3. **Fantasy calendars and world time** (26).
4. **Structured relationships** (18) and relationship trees (7).
5. **Character sheets/statblocks** (15).

This moves CampaignRepo from preparation and reference into active table use.

### Release C - Trust and teamwork
1. **Version history/activity/restore** (19).
2. **Notifications and assignments** (23).
3. **Presence and soft-locking** as the first slice of real-time collaboration (11).

### Release D - Connect and scale
1. **Import/export and VTT bridges** (22).
2. **Maps 2.0** (31).
3. **Offline workspace/PWA** (32).
4. **Responsive/accessibility/performance** (24), measured throughout all releases.

### Release E - Build new world systems
1. **Reusable properties, inventories, and abilities** (29).
2. **Infinite boards and diagrams** (27).
3. **Local and hosted AI generators** (14).
4. **Language and lexicon tools** (33).
5. **Extension points and automation** (25) after core contracts stabilize.

Editor upgrades (10), visibility groups (12), and manuscripts (13) can slot into
these releases when they support the release theme rather than shipping as
isolated features.

> Pick any item and I'll turn it into a concrete implementation plan (data shape,
> files, routes, UI) and build it.

---

## Adoption, positioning & community — feedback backlog

Captured from external feedback. The recurring theme: the technology is solid;
the real work is **adoption**. Lead with the identity below and lower the barrier
to entry before adding more content systems.

**Top priority: external links & public view (the publishing/clone ecosystem, #37).**
It's what turns CampaignRepo from "another wiki" into "GitHub for RPG campaigns,"
and it's the single strongest adoption lever.

**Positioning.** Reframe from "a wiki for GMs" to **"a Git-based campaign platform
for Game Masters"** — the *Foundry VTT of campaign management*: open, self-hosted,
your-data-is-yours. The wiki is one part; the story is ownership + version history
+ collaboration + public publishing + AI-friendly Markdown + easy deployment.
Strongest differentiator: **one repository per campaign** — every world is fully
isolated instead of one giant knowledge base that becomes an unmanageable mess.

### ~~34. Pluggable storage backends — Local Folder, then Gitea/Forgejo~~  ·  L  ✅ SHIPPED
Make GitHub the **recommended, not required** backend; this removes the single
biggest objection. Same on-disk shape everywhere (Markdown pages + images +
templates) — only the location differs:
- **Local Folder** — lowest barrier; no account, fully offline; works on a NAS or
  with Dropbox / Syncthing / Nextcloud / OneDrive for optional sync.
- **GitHub** (recommended) — version history, free offsite backup, collaboration,
  multi-machine access.
- **Gitea / Forgejo** (future) — for people running their own Git server.
Do **not** invent a DB format — point at a folder (e.g. `D:\Campaigns\Traveller\`
or `/mnt/nas/RPG/KingdomDivided/`). Support in-place upgrade with no data change:
Local Folder → init Git → push to GitHub. Audience hierarchy: Local (everyone) →
GitHub (power users) → Gitea/Forgejo (self-run).
**Shipped:** `StorageAdapter` interface + `LocalFolderAdapter` + `GitHubAdapter`; all
routes/libs migrated to go through `getStorageAdapter(campaign, token?)`; DB columns
`storageBackend`/`localPath` added via migration; dashboard "Local folder" mode.

### 35. Zero-friction onboarding  ·  S-M
"Click **New Campaign** — everything else happens automatically." Never surface
"create a GitHub repository" to non-technical GMs; hide Git entirely unless they
ask. The less people know GitHub is involved, the better the conversion.

### 36. Migration importers (adoption > features)  ·  M-L  ·  extends #22
People aren't switching software — they're migrating years of lore. Importers for
**Obsidian, Notion, OneNote, World Anvil, LegendKeeper, Foundry Journals, and
Google Docs**. Treat migration tooling as higher priority than net-new features.

### 37. Publishing ecosystem — public view, top-campaign list, clone & fork  ·  L  ·  ★ TOP PRIORITY  ·  🚧 GALLERY + CLONE SHIPPED  ·  builds on #8
External links and public view are the highest-priority adoption lever. Evolve
public sharing into "GitHub for RPG campaigns":
- **Share** a single page or a whole campaign via a public link (extends the
  shipped public site, #8).
- **Top-campaign list** — a public, browsable gallery of published campaigns.
  Anyone can open and read one; without edit approval it is **view-only**.
  *Shipped: `/site` — a no-login gallery of every published world, sorted by
  most-cloned, with a name/system search; links to each read-only public site
  (which already has per-world page search). Linked from the login page.*
- **Clone for your own game** — one click copies a published campaign into the
  viewer's own editable campaign/repo as a starting point.
  *Shipped: "Clone this world" on each public site creates a fresh repo +
  campaign owned by the viewer and copies the public pages + referenced media in
  one commit; bumps the source's clone count (drives most-cloned discovery).
  Needs GitHub connected; >1 MB media is skipped (follow-up: git blobs).*
- **Fork & pull requests** — fork another GM's world; submit fixes/templates back
  to the source. *(Follow-up: cross-repo PR machinery.)*
- **Discovery** — browse by system, most-cloned (✅ sort live), recently updated,
  highest rated; a community library of campaigns + templates (a Traveller
  sector, a Pendragon county, a Vampire city, a Blades district, an Alien colony).
  World Anvil's public-content volume is the bar — this is the path to it.

### 38. AI campaign Q&A over Markdown  ·  M  ·  extends #14
Because everything is Markdown, an LLM can read the entire campaign. Natural-
language query + generation: "Who actually knows the Duke is a vampire?", "Show
every NPC connected to House Silverridge", "Generate a session recap from the last
five journal entries." Markdown-as-storage is a genuine long-term advantage.

### 39. Hosted / managed option (business)  ·  L
Self-hosting (Docker) is the core audience but loses the "everyone else" segment
who just want "Click Sign In." Consider an optional managed/SaaS tier later —
without abandoning the self-host, own-your-data identity that defines the project.
