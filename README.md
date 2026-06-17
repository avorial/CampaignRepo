# CampaignRepo

CampaignRepo is a GitHub-backed RPG campaign wiki. One app manages many campaigns, and each campaign maps to one GitHub repo containing Markdown pages, media, templates, imports, search snapshots, and campaign configuration.

## Current MVP

- Username/password app accounts.
- Private dashboard for creating or connecting campaign repos.
- GitHub token connection for repo creation and file commits.
- Game template packs for Traveller, Fantasy, Modern, Horror, Sci-Fi, and Custom.
- Wiki categories for Characters, NPCs, Locations, Events, and Games.
- Markdown pages with `[[Page]]` links, `[[Page|Label]]` aliases, key links, backlinks, tags, visibility, and approval status.
- GM-only Markdown blocks with `:::gm`.
- Foundry Actor JSON and generic JSON character import.
- SQLite full-text search plus portable repo snapshots at `/wiki/search/index.json`.
- Safe Markdown rendering (sanitized) with real `[[wiki-links]]` and GM create-page prompts for missing targets.
- MCP-style JSON-RPC endpoint at `/api/mcp` for AI search, reads, page creation, unapproved updates, templates, media, graph, review queue, and setup instructions.
- External MCP clients authenticate with a personal access token (`Authorization: Bearer`), minted from the dashboard; the in-app session also works.
- Dashboard review queue aggregating unapproved AI/import changes across every campaign you manage.

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
  /templates/<game-type>
  /imports/characters
  /search/index.json
  campaign.yaml
README.md
```

Manual edits are allowed if YAML frontmatter and CampaignRepo conventions are preserved.
