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

## Dota 2 Widget (`/src/widgets/dota2/`)

A custom esports dashboard widget displaying live and upcoming professional Dota 2 matches and tournaments. It is **not** part of the upstream Homepage project — it is a fully custom widget built for this fork.

### Layout

Two-column panel layout rendered inside the standard Homepage widget card:
- **Left panel** — Live matches + upcoming matches grouped by day (Today, Tomorrow, specific dates)
- **Right panel** — Ongoing tournaments + upcoming tournaments + a collapsible list of recently completed tournaments (8 preview, expandable via modal)

### APIs Used

| API | Base URL | Purpose |
|---|---|---|
| PandaScore | `https://api.pandascore.co/dota2/` | Live/upcoming matches and upcoming tournaments. Requires `HOMEPAGE_VAR_PANDASCORE_API_KEY`. Filters Tier S and A only. |
| DatDota | `https://api.datdota.com/api` | Current and recently completed tournament listing. PREMIUM (Tier 1) and PROFESSIONAL (Tier 2) only. |
| OpenDota | `https://api.opendota.com/api` | Detailed match data, player stats, hero picks/bans, team rosters, most-played heroes. No API key required. |

PandaScore data is fetched via the standard Homepage proxy layer (`widget.js` mappings). DatDota and OpenDota calls are handled in the custom backend route `pages/api/widgets/dota2.js`.

### File Structure

```
src/widgets/dota2/
├── component.jsx                        # Root widget component, two-panel layout
├── widget.js                            # Widget config, API endpoint mappings, data transforms
├── matches/
│   ├── MatchRow.jsx                     # Live/upcoming match row (team logos, time, stream link)
│   ├── SeriesRow.jsx                    # Tournament series row with expandable individual games
│   └── MatchDetailModal.jsx             # Full 5v5 match stats modal (desktop table + mobile tabs)
├── tournaments/
│   ├── TournamentRow.jsx                # DatDota tournament row (ongoing/past)
│   ├── TournamentModal.jsx              # Tournament detail: teams grid + series results
│   ├── UpcomingTournamentRow.jsx        # PandaScore upcoming tournament row
│   └── UpcomingTournamentModal.jsx      # Upcoming tournament: schedule + participants
├── modals/
│   ├── TeamModal.jsx                    # Team profile: roster, win rate, most-played heroes, recent matches
│   ├── CompletedTournamentsModal.jsx    # Scrollable list of all recently completed tournaments
│   └── UpcomingMatchesModal.jsx         # Full upcoming match list with day grouping
├── ui/
│   ├── primitives.jsx                   # Shared UI: SectionLabel, PulseRow, LogoBox, ItemSlot, LevelRing
│   └── utils.js                         # shortRelative() countdown formatter, fmtK() number formatter
pages/api/widgets/
└── dota2.js                             # Backend handler for DatDota and OpenDota proxied requests
```

### Key Architecture Decisions

- **Portal-based modals** — all modals use `ReactDOM.createPortal` to escape the widget container, ensuring correct z-index and overflow. Body scroll is locked when a modal is open.
- **Lazy match fetching** — individual game details inside a series are only fetched when the row is expanded, avoiding unnecessary OpenDota calls.
- **Series reconstruction** — the backend reconstructs BO series from individual match entries by `series_id`. `series_id === 0` is treated as standalone BO1 matches.
- **Differentiated cache TTLs** — current tournament data: 5 s; past tournaments: 30 s; hero/item static data: 24 h; match detail data: 60 min.
- **Stream URL priority** — official English stream → any official stream → main stream → first available.
- **Time display toggle** — main widget lets the user switch between relative countdown ("in 2h") and absolute time ("14:32") for upcoming matches.
- **Subgrid layout** — `SeriesRow` uses CSS Grid with `subgrid` for precise column alignment across header and game rows.
- **Responsive** — Tailwind CSS throughout; compact team tags on mobile, full names on desktop; match detail modal switches from a full table to a tabbed interface on small screens.

### Config Entry (YAML)

```yaml
- widget:
    type: dota2
    pandascoreApiKey: "{{HOMEPAGE_VAR_PANDASCORE_API_KEY}}"
```

### Stylistic Improvements Backlog

Identified improvements to the widget's visual design, in rough priority order:

- [ ] **Pulsing live dot** — Replace the static `● LIVE` text in `matches/MatchRow.jsx` with an `animate-ping` or `animate-pulse` dot for a proper live indicator.
- [ ] **Section label accent** — Add a left border accent to `SectionLabel` in `ui/primitives.jsx` (e.g. `border-l-2 border-theme-400 pl-1.5`) to give panel sections stronger visual hierarchy.
- [ ] **Tier badge consistency** — `tournaments/TournamentRow.jsx` only renders the badge for Premium; Professional rows show nothing. Show both badges consistently (amber = Premium, sky = Professional).
- [ ] **"Show more" button styling** — The `Show more ▾` overflow links in `component.jsx` are `text-[9px]` and easy to miss. Upgrade to a subtle full-width button with a faint background or border.
- [ ] **Modal color system alignment** — Modals use hardcoded `zinc-*` colors instead of `theme-*` CSS variables, so they don't respond to Homepage theme changes. Align modal backgrounds, borders, and text to use `theme-*` variables.
- [ ] **Shaped loading skeletons** — `PulseRow` in `ui/primitives.jsx` is a generic full-width bar. Replace with shaped skeletons that mirror the two-team / name+date layout of actual rows to reduce perceived layout shift.
- [ ] **FP badge legibility** — First Pick badge in `matches/MatchDetailModal.jsx` uses `text-[7px]`, which is below readable threshold. Bump to `text-[9px]` with adjusted padding.
- [ ] **Modal border radius on mobile** — Modals use `rounded-xl` but `mx-0` on mobile, clipping corners against the viewport edge. Apply `rounded-none sm:rounded-xl` (or add a small margin) to all modal panels.

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
