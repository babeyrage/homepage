# Homepage Dashboard — CLAUDE.md

## Project Overview

This is a personal fork/instance of the [Homepage](https://gethomepage.dev/) self-hosted dashboard application. It is a **Next.js** statically generated app that serves as a unified dashboard for a homelab (HOMELAB tab) and work environment (WORK tab).

---

## Security

- **Never read, print, or suggest edits to the `.env` file.** It contains plain-text API keys, tokens, and credentials for all homelab services. It is already `.gitignore`d — keep it that way.
- All secrets are injected at runtime via `HOMEPAGE_VAR_*` environment variables sourced from `.env`. They appear in YAML config as `{{HOMEPAGE_VAR_NAME}}` placeholders — this is the correct pattern.
- The app proxies all service API calls server-side (Next.js API routes) so secrets are never exposed to the browser.

---

## Configuration Files (`/config/`)

All configuration is YAML-based. No database is used.

| File | Purpose |
|---|---|
| `services.yaml` | Service cards: icons, hrefs, widgets, Proxmox VM metadata |
| `bookmarks.yaml` | Simple link groups (no live widgets) |
| `widgets.yaml` | Top-bar info widgets (resources, weather, datetime) |
| `settings.yaml` | Global settings, layout order, tab assignments, providers |
| `docker.yaml` | Docker socket connections for auto-discovery |
| `kubernetes.yaml` | Kubernetes cluster connections for auto-discovery |

### Environment Variable Substitution

Anywhere in YAML config, use:
- `{{HOMEPAGE_VAR_NAME}}` — replaced from `HOMEPAGE_VAR_NAME` env var
- `{{HOMEPAGE_FILE_NAME}}` — replaced with the contents of the file path stored in `HOMEPAGE_FILE_NAME` env var

---

## Layout System

Tabs and layout order are defined in `settings.yaml` under `layout:`.

Current tabs:
- **HOMELAB** — servers, media, backups, home network, developer/entertainment bookmarks
- **WORK** — security info, news feed, work-specific bookmarks

Groups are assigned to tabs with `tab: TABNAME` inside their layout entry. Groups without a `tab:` assignment appear on all tabs.

Services can be **nested** into subgroups — e.g. `HOME NETWORK` contains `DOWNLOADS`, `NETWORK`, `MONITORING`, and `SECURITY` as column-style subgroups.

Layout options per group:
- `style: row | column` — direction of service cards
- `columns: N` — cards per row
- `header: false` — hide the group header
- `useEqualHeights: true` — force equal card heights
- `initiallyCollapsed: true` — collapse group by default

---

## Services Structure (`services.yaml`)

Each service entry supports:

```yaml
- Group Name:
    - Service Name:
        icon: service.svg              # icon from dashboard-icons or si-/sh- prefix
        href: http://host:port         # link URL
        proxmoxNode: "node-name"       # optional: show VM status badge
        proxmoxVMID: "100"
        proxmoxType: lxc | qemu
        widget:
            type: widget-type
            url: http://host:port
            key: "{{HOMEPAGE_VAR_API_KEY}}"
```

Subgroups are defined by nesting a list under a group name instead of service properties.

---

## Bookmarks Structure (`bookmarks.yaml`)

```yaml
- Group Name:
    - Bookmark Name:
        - icon: service.svg | si-brand-#COLOR | abbr: AB
          href: https://url
```

---

## Info Widgets (`widgets.yaml`)

Top-bar widgets. Right-aligned automatically: `weatherapi`, `openweathermap`, `weather`, `openmeteo`, `search`, `datetime`. All others are left-aligned.

Current widgets in use:
- `resources` — CPU/RAM usage
- `openmeteo` — weather (Perth, Australia)
- `datetime` — local time (Australia/Perth, 12hr)

---

## Source Code Structure (`/src/`)

| Path | Purpose |
|---|---|
| `pages/index.jsx` | Main page — static props, tab/group rendering logic |
| `pages/api/` | Server-side API routes for proxying widget requests |
| `utils/config/config.js` | YAML loading, env var substitution, settings parsing |
| `utils/config/api-response.js` | Merges services from YAML + Docker + Kubernetes |
| `utils/proxy/` | HTTP proxy layer (keeps API keys server-side) |
| `components/services/` | Service group and card components |
| `components/bookmarks/` | Bookmark group and card components |
| `components/widgets/` | Info widget components |
| `widgets/<name>/` | Per-widget: `widget.js` (API def) + `component.jsx` (render) |

---

## Pending Work

### Glances Server Monitoring

Install Glances (via pipx) on each host and expose port `61208` via Twingate. Then add widgets to the `SERVERS` group in `services.yaml`.

Add env vars to `.env` for each host IP:
- `HOMEPAGE_VAR_ZUES_GLANCES_URL`
- `HOMEPAGE_VAR_MARS_GLANCES_URL`
- `HOMEPAGE_VAR_VPS_GLANCES_URL`

**Per-server plan:**

- [ ] **Zues (Proxmox Node 1)** — Proxmox widget already covers CPU/RAM. Add `fs` widget for disk visibility.
- [ ] **Mars (Proxmox Node 2)** — Same as Zues.
- [ ] **VPS** — No existing monitoring. Add `cpu`, `memory`, and `fs` widgets.

**Notes:**
- Use `version: 4` (pipx installs Glances v4+)
- Use `chart: false` for compact cards; remove to show sparkline graphs
- `metric: fs` shows all mount points; use `metric: fs:/mnt/pool` to target a specific one
- Glances must be running as a systemd service on each host (`glances -w --disable-webui --bind 0.0.0.0 --port 61208`)

---

## Git Commit Conventions

Write commit messages that describe **what changed and why**, not just what files were touched. Use the following prefixes:

- `feat:` — new service, bookmark, widget, or layout addition
- `fix:` — correcting a broken config, wrong URL, missing field
- `chore:` — dependency updates, formatting, cleanup
- `refactor:` — restructuring config without functional change

**Examples:**
```
feat: added Dota 2 widget to INFO group with PandaScore API key
fix: corrected service_group reference for Sonarr/Radarr calendar integration
chore: updated bookmark icons to use si- prefix with brand colors
feat: added WORK tab with security info and news feed groups
```

---

## Running Locally

```bash
pnpm install
pnpm dev          # development server on :3000
pnpm build        # production build
pnpm start        # serve production build
```

Config directory defaults to `./config/`. Override with:
```bash
HOMEPAGE_CONFIG_DIR=/path/to/config pnpm dev
```

## Docker

```yaml
services:
  homepage:
    image: ghcr.io/gethomepage/homepage:latest
    volumes:
      - ./config:/app/config
      - /var/run/docker.sock:/var/run/docker.sock:ro
    env_file:
      - .env
    environment:
      HOMEPAGE_ALLOWED_HOSTS: yourdomain.com
```
