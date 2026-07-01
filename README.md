# CampaignRepo

CampaignRepo is a Git-backed campaign platform for tabletop RPG game masters. Every campaign lives in a normal repository — GitHub or a local folder — and a purpose-built web app turns that repository into a wiki, map viewer, session workspace, relationship graph, calendar, and more. The Markdown files stay portable; nothing requires CampaignRepo to read them.

GMs get version history, private notes, a review queue, and full control over what players see. Players get a clean portal that only exposes approved, player-safe lore — no GitHub account needed.

## Product Tour

### Campaign Dashboard

Search across every connected campaign, open a repo, or expand setup tools only when you need them. Once GitHub is connected, setup panels stay collapsed by default.

![Campaign dashboard](docs/screenshots/dashboard.png)

### Campaign Workspace

Each campaign has a workspace with a wiki, maps, relationship graph, timeline, calendar, session board, quest tracker, media manager, settings, and health center. Campaign themes reskin the workspace for any RPG system.

![Campaign workspace](docs/screenshots/workspace.png)

### Wiki Page Editor

Pages are Markdown with YAML frontmatter. The editor shows source and preview side by side, with a slash-command menu, format toolbar, paste-to-upload images, wiki-link insert, gallery blocks, transclusion, and GM-only blocks.

![Wiki page editor](docs/screenshots/editor.png)

### GM Review Queue

AI-created, imported, or otherwise unapproved content waits for GM review before it becomes player-visible.

![GM review queue](docs/screenshots/review-queue.png)

### Player Portal

Players see only pages that are both approved and marked player-visible. GM-only blocks, import metadata, and draft content are stripped.

![Player portal](docs/screenshots/player-portal.png)

## What CampaignRepo Does

- Stores everything in Git: pages, media, maps, sessions, quests, templates, calendar config, and campaign settings as Markdown and YAML.
- Renders wiki pages with `[[links]]`, aliases, backlinks, covers, galleries, transclusion, and `:::gm` secret blocks.
- Provides an interactive map viewer with pins that link to pages and open article panels.
- Shows a force-directed relationship graph with typed edges, category filters, and a detail panel.
- Tracks quests with objectives, faction clocks, participant links, and arc grouping.
- Runs a session workspace with agenda checklists, pinned pages, GM notes, handout queues, and session-to-event report generation.
- Manages a custom fantasy calendar with configurable months, weekdays, and eras — and a world timeline across sessions and events.
- Keeps a version history for every page with a diff viewer and one-click restore.
- Publishes a no-login public site for approved, player-visible lore — shareable and cloneable.
- Exposes an MCP JSON-RPC API for AI tools and external clients.

## Core Features

### Accounts and Permissions

- Local accounts with username/password login.
- Seeded admin account with forced first-login password change.
- Global admin dashboard for users, campaign memberships, roles, password resets, and disabled accounts.
- Per-campaign GM tools for members, invite links, and player access.
- Owner, GM, and player campaign roles.

### Storage Backends

- **Local folder** — no GitHub account required; works offline; compatible with Dropbox, Syncthing, Nextcloud, or OneDrive for optional sync.
- **GitHub** (recommended) — version history, free offsite backup, collaboration, multi-machine access via GitHub App or personal token.

### Wiki and Editor

- Markdown pages with YAML frontmatter and structured fields per article type.
- Categories: characters, NPCs, organizations, species, locations, items, events, lore, game notes, and more.
- `[[Page]]` and `[[Page|Label]]` wiki links, aliases, key links, and backlinks.
- Slash-command menu (`/`) for headings, tables, code blocks, dividers, GM blocks, transclusion, and task lists.
- Paste an image into the editor to upload and insert it in one step.
- `:::gm` GM-only blocks, `:::gallery` image grids with lightbox, and `:::include` transclusion.
- Cover images rendered as article banners.
- Save conflict detection when a file changes after it was opened.
- GM preview, player preview, and handout views.
- In-editor slash commands, format toolbar, and diff-based history restore.

### Maps

- Upload a map image and place pins that link to wiki pages.
- Click a pin to open an article panel without leaving the map.
- Pins stored as portable JSON alongside the map image.

### Relationship Graph

- Force-directed SVG graph of all pages as nodes colored by category.
- 20 built-in typed relationships (member-of, located-in, allied-with, parent-of, appears-in-session, and more) with defined inverses.
- Typed edges dashed and labeled on hover; category filter checkboxes and typed-only toggle.
- Click a node to focus: dims unconnected nodes, shows detail panel with outgoing and incoming links.

### Sessions

- Sessions stored as `wiki/sessions/<slug>.md` with YAML frontmatter and Markdown notes.
- Agenda checklist, pinned pages, status, date, private GM notes, and handout queue with copy-link.
- "Make report page" converts checked agenda items and notes into a wiki event page.
- Next-session widget on the campaign overview dashboard.

### Quests

- Quests stored as `wiki/quests/<slug>.md` with status, arc, reward, visibility, objectives, and participant/location links.
- Faction clocks: SVG ring segments with click-to-fill and configurable segment count.
- Active quests widget on the campaign overview dashboard.

### Calendar and World Timeline

- Custom calendar per campaign: configurable months (name + length), weekdays, and era name.
- Tracks the current in-world date with weekday-correct formatting.
- Advance the date by day, week, or month from the calendar view.
- World timeline on the calendar page shows past and future sessions and events sorted by in-world date with a "Now" divider.
- Current date widget on the campaign overview dashboard.

### Version History and Activity

- History tab in the page reader: last 20 commits with date, author, message, SHA, and GitHub diff link.
- Diff viewer: click-to-compare any historical version against the current text, with colored add/remove/unchanged lines.
- Restore: load any historical version into the editor for review before saving.
- Campaign activity feed on the overview dashboard: last 30 repo commits with author, date, and message.

### Campaign Overview Dashboard

- Configurable widget layout stored in `campaign.yaml`.
- Widgets: page counts, active quests, next session, current calendar date, recent activity, review queue, and campaign health.
- GMs enable/disable and drag-to-reorder widgets; players get a spoiler-safe view (GM-only widgets are never rendered).

### Campaign Health Center

- Scans every page for broken wiki links, invalid parents, parent category mismatches, missing media, duplicate aliases, empty names, unapproved pages, orphaned pages (no incoming links and no parent), and oversized media files.
- Findings grouped by type with severity badges and links to affected pages.
- Inline bulk repair: approve all unapproved, clear invalid parents, and more.

### Bulk Organization

- Table view for pages with name and category filter, multi-select, and bulk change of category, visibility, and approval in one commit.

### Character Sheets

- **Traveller (Mongoose 2e)**: characteristics (STR/DEX/END/INT/EDU/SOC) with computed DMs, skills, weapons, armour, equipment, contacts, and credits. Click any characteristic or skill to roll 2D6 + that modifier with an animated result toast.
- Sheet stored in page frontmatter; rendered in the page reader for Traveller campaigns.

### Public Site and Discovery

- GMs publish a no-login public site for any campaign at a stable `/site/<slug>` URL.
- Public gallery at `/site` lists all published worlds, sorted by most-cloned, with name and system search.
- "Clone this world" copies a published campaign into the viewer's own GitHub repo as a new campaign.

### Command Palette

- `Cmd/Ctrl+K` from any authenticated screen: search pages, navigate to workspace sections, and find media.

### Imports and MCP

- Foundry Actor JSON and generic character JSON import with optional field mapping and source diffing for re-import.
- Media upload, rename, delete, captions, alt text, tags, and repo-persisted metadata.
- SQLite full-text search and portable `/wiki/search/index.json` snapshots.
- MCP JSON-RPC endpoint at `/api/mcp` with tools for search, page reads/creates/updates, templates, media, graph data, review queues, and setup instructions.

### Theming

- Per-campaign accent colors, display font, and banner image stored in `campaign.yaml`.
- Flagship themes for specific RPG systems (Traveller, Dark Ages: Vampire, and others) with curated palettes and campaign title logos.
- Applied to the workspace, player portal, and public site.

## Quick Start

Install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

The local database seeds this first admin account:

```text
Email: admin@example.local
Password: admin
```

CampaignRepo forces the seeded admin password to be changed before the dashboard or APIs can be used.

## Common Commands

```bash
npm run dev        # Start local development server
npm run typecheck  # TypeScript check
npm test           # Run Vitest tests
npm run build      # Production build
npm start          # Start built Next.js app
```

## GitHub App Setup

The easiest setup path is from the CampaignRepo dashboard:

1. Sign in as a global admin.
2. Click **Connect GitHub**.
3. Let GitHub create the CampaignRepo GitHub App from the manifest.
4. Choose the campaign repositories the app can access.
5. Return to CampaignRepo and connect or repair a campaign repo.

CampaignRepo stores the GitHub App configuration in SQLite and uses short-lived installation tokens for repo access.

To create the GitHub App manually, create a new app at:

```text
https://github.com/settings/apps/new
```

Use these values:

- Homepage URL: your CampaignRepo URL.
- Callback URL: `https://YOUR-CAMPAIGNREPO-HOST/api/github/app/callback`.
- Setup URL: `https://YOUR-CAMPAIGNREPO-HOST/api/github/app/callback`.
- Repository permissions:
  - Contents: read/write.
  - Metadata: read-only.
- Installation access: only the repositories CampaignRepo should manage.

After adding the `GITHUB_APP_*` environment variables and restarting the app, use **Install or update GitHub App access** from the dashboard.

## Campaign Repo Layout

CampaignRepo creates and expects this structure inside each campaign repo:

```text
/wiki
  /pages
  /media
    media.json
  /templates/<game-type>
  /imports/characters
  /sessions
  /quests
  /maps
  /search
    index.json
  campaign.yaml
README.md
```

Manual edits are welcome. Preserve YAML frontmatter and CampaignRepo conventions for wiki links, visibility, approvals, and GM-only blocks.

## Visibility Rules

Player safety is based on page metadata and GM-only blocks:

- `visibility: players` makes a page eligible for player view.
- `approvalStatus: approved` is required before players can see it.
- `:::gm` blocks are removed from player reads.
- Source import metadata is hidden from player reads.
- Players can read campaign content without GitHub credentials.

## Docker

Run the prebuilt image from GitHub Container Registry:

```bash
docker compose -f docker-compose.image.yml up -d
```

The published image is:

```text
ghcr.io/avorial/campaignrepo:latest
```

For Portainer, create a stack from `docker-compose.image.yml` or use this image in your own compose file. The SQLite database is stored in the `campaignrepo-data` volume at `/app/data`.

After the first publish, make the GHCR package public in GitHub Packages if you want unauthenticated pulls.

To build locally instead:

```bash
docker compose up -d --build
```

Open:

```text
http://127.0.0.1:3000
```

Useful environment variables:

```bash
APP_URL=https://campaignrepo.example.com
SECURE_COOKIES=true
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-github-app-slug
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
```

Set `SECURE_COOKIES=true` when serving behind HTTPS so session cookies use the `Secure` flag.

Without Compose:

```bash
docker build -t campaignrepo .
docker run -p 3000:3000 -v campaignrepo-data:/app/data campaignrepo
```

## Portainer Updates

For a local Portainer install, GitOps polling is simpler than a webhook while testing.

Recommended stack settings:

- Repository: `https://github.com/avorial/CampaignRepo.git`
- Reference: `refs/heads/main`
- Compose path: `docker-compose.yml`
- Update method: polling
- Polling interval: 5 minutes

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full feature roadmap and build sequence.

## License

See [LICENSE](LICENSE).
