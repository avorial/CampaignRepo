# CampaignRepo

CampaignRepo is a GitHub-backed RPG campaign wiki. One app manages many campaigns, and each campaign maps to one GitHub repo containing Markdown pages, media, templates, imports, search snapshots, and campaign configuration.

## Current MVP

- Username/password app accounts.
- Private dashboard for creating or connecting campaign repos.
- GitHub token connection for repo creation and file commits.
- Game template packs for Sword Chronicle, Dungeons & Dragons, World of Darkness, Traveller, and Custom.
- Wiki categories for Characters, NPCs, Locations, Events, and Games.
- Markdown pages with `[[Page]]` links, `[[Page|Label]]` aliases, key links, backlinks, tags, visibility, and approval status.
- GM-only Markdown blocks with `:::gm`.
- Foundry Actor JSON and generic JSON character import.
- SQLite full-text search plus portable repo snapshots at `/wiki/search/index.json`.
- Safe Markdown rendering (sanitized) with real `[[wiki-links]]` and GM create-page prompts for missing targets.
- MCP-style JSON-RPC endpoint at `/api/mcp` for AI search, reads, page creation, unapproved updates, templates, media, graph, review queue, and setup instructions.
- External MCP clients authenticate with a personal access token (`Authorization: Bearer`), minted from the dashboard; the in-app session also works.
- Dashboard review queue aggregating unapproved AI/import changes across every campaign you manage.

## Project Goals

CampaignRepo's goal is to become a practical, RPG-first, GitHub-backed campaign wiki rather than a general-purpose wiki clone. The current MVP is usable for early testing, but these are the remaining product goals in priority order.

### 1. GitHub Connection

- Replace pasted GitHub tokens with a real GitHub OAuth or GitHub App installation flow.
- Keep manual token support only as a local/dev fallback.
- Improve GitHub API error handling for repo access, branch conflicts, rate limits, and missing permissions.

### 2. Editing Experience

- Upgrade the Markdown textarea into a true rich Markdown editor while preserving frontmatter, `[[wiki-links]]`, media links, and `:::gm` blocks.
- Add insert controls for wiki links, media, GM blocks, and templates.
- Keep GM, Player, and Handout previews visible and trustworthy.

### 3. Character Import

- Add a generic JSON field-mapping UI before import.
- Improve Foundry Actor import rendering for stats, items, biography, images, and system-specific fields.
- Add a re-import flow that compares the new source JSON against the preserved source file before updating pages.

### 4. Player Experience

- Build a dedicated player portal instead of relying only on the filtered GM workspace.
- Add a handout library, player-safe timeline, player-safe search, and session-facing navigation.
- Keep the current rule firm: players only see approved, player-visible content with GM blocks stripped.

### 5. MCP And AI Workflow

- Harden `/api/mcp` into a more complete MCP-compatible surface with stronger tool schemas, better resource reads, and prompt templates.
- Add MCP prompts for NPCs, locations, factions, session summaries, rumors/news, handouts, and Traveller world metadata.
- Keep AI-created or AI-edited content routed through the unapproved review queue.

### 6. Admin And Permissions

- Add a global admin panel for users, password resets, account disabling, and invite management.
- Add owner transfer and safer owner demotion/removal flows.
- Add campaign invitations so players and GMs do not need to pre-create accounts manually.

### 7. Media Manager

- Add media delete/rename actions.
- Persist media captions, alt text, and tags.
- Add image/PDF/audio previews and include media metadata in search.

### 8. Search, Graph, And Timeline

- Improve search ranking, highlighting, filters, and reindex controls.
- Add a visual relationship graph with editable relationship labels/types.
- Expand timeline controls beyond event-page sorting.

### 9. Repo Operations

- Add a visible repo validation/repair report.
- Add better conflict handling when GitHub files change outside CampaignRepo.
- Add branch/workflow controls for testing, staging, and publishing.

### 10. Deployment And Operations

- Document production environment variables, HTTPS/session-cookie settings, and backup/restore for SQLite.
- Add deployment examples beyond Docker Compose.
- Add broader integration tests for repo initialization, player secrecy, MCP writes, imports, and review flows.

## Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

The local database seeds a first admin account:

- Username: `admin`
- Password: `admin`

CampaignRepo forces this password to be changed on first login before the dashboard or APIs can be used.

## Docker

Pull the repo and run it in a container (data persists in a named volume):

```bash
docker compose up -d --build
```

Open `http://127.0.0.1:3000`. The SQLite database (accounts, sessions, search
index) is stored in the `campaignrepo-data` volume at `/app/data`.

- Serving behind HTTPS? Set `SECURE_COOKIES=true` (in `docker-compose.yml` or the
  environment) so session cookies get the `Secure` flag.
- Without compose: `docker build -t campaignrepo . && docker run -p 3000:3000 -v campaignrepo-data:/app/data campaignrepo`.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## GitHub Repo Structure Created For Campaigns

```text
/wiki
  /pages
  /media
    media.json
  /templates/<game-type>
  /imports/characters
  /search/index.json
  campaign.yaml
README.md
```

Manual edits are allowed if YAML frontmatter and CampaignRepo conventions are preserved.
