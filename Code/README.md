# Trinity Showdown

Trinity Showdown is a university esports tournament website. Captains browse the event, download game rulebooks and register a team without creating an account. Invited organizers sign into a separate workspace to review submissions and bank transfer evidence, approve or reject entries, and export records. Approved teams appear on the public site with their team names and logos.

[Architecture](#architecture) · [Run locally](#run-locally) · [Configure an edition](#configure-an-edition) · [Data and API](#data-and-api) · [Deploy directly on a VPS](#deploy-directly-on-a-vps) · [Deploy with Cloudflare Tunnel](#deploy-with-cloudflare-tunnel) · [Develop and troubleshoot](#develop-and-troubleshoot)

## Architecture

| Location | Responsibility |
| --- | --- |
| [`frontend/`](frontend/) | React and Vite public site, cinematic game scenes, event information and registration forms. `npm run build` creates `frontend/dist`. |
| [`organizer-frontend/`](organizer-frontend/) | Standalone HTML, CSS and JavaScript for organizer sign-in, invitations, review and exports. Express serves these files directly. |
| [`backend/`](backend/) | Node.js and Express HTTP server, registration validation, organizer authentication, media delivery and SMTP receipt processing. |
| [`database/`](database/) | PostgreSQL migrations, database constraints, review transactions and runtime grants. |

```mermaid
flowchart LR
    Captain[Public site and captain forms] -->|Same-origin public API| Express[Express server]
    Staff[Organizer workspace] -->|Same-origin authenticated API| Express
    Express -->|Registrations, sessions, decisions and media| Postgres[(PostgreSQL)]
    Postgres -->|Committed receipt jobs| Worker[Receipt worker in Node.js]
    Worker -->|Confirmation email| SMTP[SMTP relay]
```

Express serves the built public site at `/`, the organizer workspace at `/organizer/`, and both APIs at `/api/` on the same hostname. The two browser apps use the same database through Express. API POST requests must come from a configured origin. The organizer sign-in URL is shared privately with staff, and a valid organizer session is required to access submissions, private images and exports.

See the [software requirements specification](../docs/SRS.md) for the event requirements and outstanding content decisions.

## Run locally

Use **Node.js 24 with npm** and a running **PostgreSQL server**. PostgreSQL 18 is the recommended version for a fresh install. Put `psql` on your path. Run the shell commands below from `Code/`, except where indicated. The Windows commands that use masked prompts require PowerShell 7.2 or later.

### 1. Create the local database

Connect as the PostgreSQL administrator. Substitute your administrator login if it differs from `postgres`.

```sh
psql -h 127.0.0.1 -U postgres -d postgres
```

Run these commands inside `psql` and enter different passwords when prompted.

```sql
CREATE ROLE trinity_owner LOGIN;
\password trinity_owner
CREATE ROLE trinity_api LOGIN;
\password trinity_api
CREATE DATABASE trinity OWNER trinity_owner;
\q
```

Apply the migrations and grants as `trinity_owner` from `Code/`.

```sh
psql -h 127.0.0.1 -U trinity_owner -d trinity -X -v ON_ERROR_STOP=1 -f database/migrations/001_initial.sql
psql -h 127.0.0.1 -U trinity_owner -d trinity -X -v ON_ERROR_STOP=1 -f database/migrations/002_media.sql
psql -h 127.0.0.1 -U trinity_owner -d trinity -X -v ON_ERROR_STOP=1 -v runtime_role=trinity_api -f database/grant_runtime.sql
```

On an existing database, apply only migrations that have yet to run, in numerical order, then reapply the grants. The database owner runs migrations and configures editions. Express connects as `trinity_api`, which has no table ownership. On managed PostgreSQL, provision equivalent roles through the provider and use its connection and TLS settings.

### 2. Install, configure and start the app

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix backend ci
Copy-Item backend/.env.example backend/.env
```

On macOS or Linux, use `cp backend/.env.example backend/.env` for the last step. Skip the copy if you already have a `backend/.env`. Update the file with the `trinity_api` password you set above, percent-encoding any reserved URI characters in credentials.

```dotenv
DATABASE_URL=postgres://trinity_api:REPLACE_PASSWORD@127.0.0.1:5432/trinity
TRINITY_EDITION=trinity-showdown
TRINITY_ORIGIN=http://127.0.0.1:3000
REGISTRATION_ENABLED=false
```

```sh
npm --prefix backend start
```

| Local URL | What you should see |
| --- | --- |
| [http://127.0.0.1:3000/](http://127.0.0.1:3000/) | The public tournament site. The preview works before an edition is configured. |
| [http://127.0.0.1:3000/organizer/](http://127.0.0.1:3000/organizer/) | The organizer sign-in page. |
| [http://127.0.0.1:3000/api/health](http://127.0.0.1:3000/api/health) | `{"status":"ok"}` when the server can query PostgreSQL. |

For live React edits, leave Express running and open a second terminal in `Code/`.

```sh
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5174
```

Open [http://127.0.0.1:5174/](http://127.0.0.1:5174/) for the Vite site. Vite forwards `/api` to Express on port 3000. Use port 3000 for the organizer workspace. If you change the backend port, update the proxy target in [`frontend/vite.config.js`](frontend/vite.config.js). If you change the Vite URL, set `TRINITY_DEV_ORIGIN` to match it exactly. `localhost` and `127.0.0.1` are different origins.

### 3. Create the first organizer

Use a trusted terminal and the runtime database connection. Replace the example email and name. The password must be 12–128 characters.

```powershell
$env:TRINITY_BOOTSTRAP_PASSWORD = Read-Host 'First organizer password' -MaskInput
npm --prefix backend run organizers -- bootstrap admin@example.org "Organizer name"
Remove-Item Env:TRINITY_BOOTSTRAP_PASSWORD
```

On Linux or macOS, these commands work in Bash.

```bash
read -rs -p 'First organizer password: ' TRINITY_BOOTSTRAP_PASSWORD
printf '\n'
export TRINITY_BOOTSTRAP_PASSWORD
npm --prefix backend run organizers -- bootstrap admin@example.org "Organizer name"
unset TRINITY_BOOTSTRAP_PASSWORD
```

Bootstrap runs once on a fresh database. After sign-in, use **Invite an organizer** and share the generated link privately. Each link works once and expires after 48 hours. All active organizers share the same permissions across all four games. To revoke access, run `npm --prefix backend run organizers -- disable TARGET_EMAIL ACTIVE_ACTOR_EMAIL` with the email of a different active organizer as the audit actor. This records the action and revokes the target account’s sessions.

## Configure an edition

Create `backend/edition.local.json` and provide a real rulebook PDF for each configured game. The paths in `rulebookFile` are relative to the JSON file. Each PDF can be up to 10 MiB. This example keeps registration closed and uses illustrative competition details.

```json
{
  "slug": "trinity-showdown",
  "title": "Trinity Showdown",
  "registrationOpensAt": null,
  "registrationClosesAt": null,
  "publicLaunchAt": null,
  "eventStartsAt": null,
  "eventEndsAt": null,
  "venue": null,
  "institutions": ["Example University"],
  "privacy": { "version": "1", "body": "Replace with the approved privacy notice." },
  "games": [{
    "game": "cod-mobile",
    "formVersion": 1,
    "rulebookVersion": "1",
    "rulebookFile": "rulebooks/cod-mobile.pdf",
    "starters": 5,
    "substitutes": 1,
    "fee": "1000.00",
    "bankInstructions": "Replace with the approved bank transfer instructions."
  }]
}
```

The slug must match `TRINITY_EDITION`. The supported game slugs are `cod-mobile`, `pubg-mobile`, `mlbb` and `clash-of-clans`. Each game supports 2–5 starters, including the leader, and up to 2 optional substitutes. The fee is in LKR. Games omitted from a subsequent configuration retain their previous settings. When form requirements change, use a new `formVersion` and increment the rulebook or privacy version whenever the corresponding document changes. Existing entries retain their original versions.

Run the configuration command with the owner connection in a maintenance shell. The temporary `DATABASE_URL` takes precedence over `backend/.env`. npm runs this script in `backend/`, so `./edition.local.json` refers to the file there.

```powershell
$env:DATABASE_URL = Read-Host 'PostgreSQL owner connection URL' -MaskInput
npm --prefix backend run edition -- ./edition.local.json
Remove-Item Env:DATABASE_URL
```

In Bash, use `read -rs DATABASE_URL` and `export DATABASE_URL` before the npm command, then `unset DATABASE_URL`. Keep the runtime database connection in `backend/.env`.

To open registration, replace the example values with the approved institution names, privacy notice, fee, bank details and rulebooks. Set both opening and closing times as ISO 8601 timestamps with an explicit offset such as `2026-12-06T23:59:00+05:30` for Sri Lanka. Configure SMTP in production, then set `REGISTRATION_ENABLED=true` and restart Express. Each game accepts new submissions only during its configured window, from opening time up to closing time. Setting `REGISTRATION_ENABLED=false` closes submissions across all games after a restart.

### Backend environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection URI. Use the restricted runtime login for Express. |
| `TRINITY_EDITION` | Edition slug. Defaults to `trinity-showdown`. |
| `TRINITY_ORIGIN` | Public scheme, hostname and port, if nonstandard. Production requires HTTPS. |
| `TRINITY_DEV_ORIGIN` | Additional origin for development. Defaults to `http://127.0.0.1:5174` and is ignored in production. |
| `REGISTRATION_ENABLED` | Global submission switch. Only `true` enables submissions for configured, open games. |
| `HOST`, `PORT` | Express listen address and port. Defaults to `127.0.0.1` and `3000`. |
| `NODE_ENV` | Set to `production` on a live host to enforce production HTTPS and secure organizer cookies. |
| `TRUST_PROXY_HOPS` | Number of trusted reverse proxy hops. Defaults to `0`. The value affects per-client rate limiting. |
| `SMTP_URL`, `RECEIPT_FROM` | SMTP relay URL and approved sender address. Both are required to open registration in production. `smtps://` uses implicit TLS. `smtp://` requires STARTTLS in production. |

## Data and API

| PostgreSQL objects | What they store or enforce |
| --- | --- |
| `editions`, `games`, `edition_games` | Edition metadata, the four seeded games, registration windows and the active form for each game. |
| `registration_forms`, `privacy_notices`, `institutions` | Versioned rules and requirements, fee and bank details, roster limits and canonical university names. |
| `registrations`, `roster_members`, `active_roster_claims` | Original entries and player details. The unique claim key covers edition, university and normalized student number across all games, including substitutes. It preserves leading zeros and compares numbers after trimming spaces and folding case. |
| `media` | Rulebook PDFs, submitted files and sanitized display logos as PostgreSQL `bytea`. Back up this table along with the registration records. |
| `registration_decisions`, `organizer_audit` | Review decisions, internal rejection reasons, and staff actions such as invitations, account deactivation and exports. |
| `organizers`, `organizer_invites`, `organizer_sessions` | Password hashes and hashed invitation and session tokens. Sessions last eight hours and use HTTP-only, SameSite Strict cookies with the Secure flag in production. |
| `receipt_outbox`, `public_teams` | Confirmation email queue and the public view of currently approved teams. |

1. The captain submits one multipart form for one game. Express validates the form and roster, along with single-frame JPEG, PNG or WebP uploads of up to 5 MiB each and 4096 pixels per side. The largest roster can submit 17 images. The request also has a declared-size limit of 86 MiB.
2. PostgreSQL writes the registration, roster, eligibility claims and receipt job in the same transaction as the uploaded files. A successful retry with the same request UUID and identical payload returns the original reference. Duplicate active claims roll back the entry. Captains and organizers cannot edit submitted fields.
3. The Node receipt worker sends confirmation through SMTP after commit. It retries delivery failures and reuses a stable Message-ID. The registration is saved even if mail delivery is delayed.
4. An organizer verifies the transfer proof and approves or rejects the entry. The database checks the expected review status to prevent two reviewers overwriting each other. Approval immediately publishes the team’s name and sanitized logo in its game. Rejection removes it from public listings, releases its player claims and preserves the original submission and files.

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Checks database connectivity. |
| `GET /api/public/event` | Edition details, registration availability, institutions and approved teams. |
| `POST /api/public/registrations/:game` | Validates and stores a captain’s registration and returns its reference. |
| `GET /api/public/rulebooks/:id`, `GET /api/public/privacy/:id` | Versioned rulebook and privacy notice for a form. |
| `GET /api/public/teams/:id/logo` | Sanitized logo for a currently approved team. |
| `POST /api/organizer/login`, `POST /api/organizer/logout` | Sign in or out of the organizer workspace. |
| `POST /api/organizer/accept-invite`, `GET /api/organizer/me`, `POST /api/organizer/invites` | Accept an invitation, read the current session identity or create an invitation. |
| `GET /api/organizer/registrations`, `GET /api/organizer/registrations/:id` | List registrations or read a single submission. |
| `GET /api/organizer/registrations/:id/images/:slot`, `POST /api/organizer/registrations/:id/decision` | View a private upload or record a review decision. |
| `GET /api/organizer/registrations/export.csv` | Export submitted values, review status and authenticated links to uploaded images. |

## Deploy directly on a VPS

An Ubuntu VPS can run the public site, organizer workspace, Express API and PostgreSQL together. On Amazon Lightsail, create a Linux instance with Ubuntu and public IPv4, choose the Singapore region for an audience in Sri Lanka, and attach a static IPv4 address. A 4 GB instance is a starting point for running PostgreSQL and processing registration images on the same machine. [Create a Lightsail instance](https://docs.aws.amazon.com/lightsail/latest/userguide/getting-started-with-amazon-lightsail.html) · [Attach a static IP](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html) · [Lightsail pricing](https://aws.amazon.com/lightsail/pricing/)

1. Connect to the VPS over SSH. Copy all four project folders and follow [Prepare the Node host](#1-prepare-the-node-host) to install the app, initialize PostgreSQL, build the frontend and start Express as a `systemd` service. For PostgreSQL on this same VPS, use the runtime database URI at `127.0.0.1:5432`. Set `TRINITY_ORIGIN` to your actual public HTTPS URL. Keep Express on `127.0.0.1:3000` and set `TRUST_PROXY_HOPS=1` for a direct Caddy-to-Express connection. Keep `REGISTRATION_ENABLED=false` during setup.
2. In your existing DNS provider, point an `A` record for the website hostname to the static IPv4 address. Use a direct DNS record for this setup. At the VPS firewall, allow TCP ports 80 and 443 and keep PostgreSQL and Express ports private. [Lightsail firewall settings](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html) · [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
3. Install Caddy on Ubuntu, then add the following site to `/etc/caddy/Caddyfile`. Replace the example hostname with your own. Caddy obtains and renews the HTTPS certificate and passes requests for the whole site to Express. The bundled game clips are served by the same Express process in this setup. [Install Caddy on Ubuntu](https://caddyserver.com/docs/install#debian-ubuntu-raspbian) · [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)

```caddyfile
trinity.example.org {
    reverse_proxy 127.0.0.1:3000
}
```

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
curl -fsS https://trinity.example.org/api/health
```

The health endpoint should return `{"status":"ok"}`. Verify the home page, game clips and organizer sign-in over HTTPS. Set up PostgreSQL backups stored away from the VPS and verify the SMTP relay from the server before opening registration. See [Verify before opening registration](#3-verify-before-opening-registration).

## Deploy with Cloudflare Tunnel

This deployment runs Express and its background receipt worker on a Linux server or VPS. Cloudflare handles public HTTPS and tunnels requests to Express over a local connection. PostgreSQL runs on the same server or on a managed database reachable privately. A static Pages deploy of `frontend/dist` serves the public assets only. Use a persistent Node host for the full application, including organizer access, database writes and mail. [Cloudflare Tunnel setup](https://developers.cloudflare.com/tunnel/get-started/)

Cloudflare Free includes Tunnel for the public site, organizer workspace and API. You still need a domain and an always-on host for `cloudflared` and Express, plus PostgreSQL and SMTP for production registrations. [Cloudflare Tunnel availability](https://developers.cloudflare.com/tunnel/)

### 1. Prepare the Node host

Copy or check out all four folders inside `Code/` together. Keep the sibling paths shown in [Architecture](#architecture). Build on the target platform, using its own installed dependencies. Provision PostgreSQL and run the migrations and grants using the [database setup](#1-create-the-local-database).

```sh
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix backend ci --omit=dev
```

Create `backend/.env` on the server. Use your real hostname, a database URI supplied by your database provider, and your SMTP relay. Keep credentials and the tunnel token out of Git. Set the file to be readable only by the service account. The example assumes `cloudflared` connects directly to Express on the same host, with one trusted proxy hop. Keep ports 3000 and 5432 off the public internet and use a different hop count if you add another proxy.

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
TRINITY_ORIGIN=https://trinity.example.org
TRINITY_EDITION=trinity-showdown
TRUST_PROXY_HOPS=1
DATABASE_URL=postgres://trinity_api:REPLACE_PASSWORD@db.example.org:5432/trinity?sslmode=verify-full
SMTP_URL=smtps://smtp-user:REPLACE_PASSWORD@mail.example.org:465
RECEIPT_FROM=registration@example.org
REGISTRATION_ENABLED=false
```

Use the provider’s TLS connection parameters for a remote database. The example assumes the database certificate is trusted by the Node host and matches its hostname. For PostgreSQL on the same machine, use the applicable local database connection string. Cloudflare forwards the browser’s address through `X-Forwarded-For`. [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)

Start Express as a persistent service. This `systemd` example goes in `/etc/systemd/system/trinity.service`. Create or use a non-root service account named `trinity`, give it read access to the app and `.env`, and adjust the path to match your installation. Use the absolute Node executable path from `command -v node`.

```ini
[Unit]
Description=Trinity Showdown
Wants=network-online.target
After=network-online.target

[Service]
User=trinity
WorkingDirectory=/opt/trinity/Code/backend
ExecStart=/usr/bin/node --env-file=.env src/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now trinity
curl -fsS http://127.0.0.1:3000/api/health
```

### 2. Connect the public hostname

1. Add your domain to Cloudflare. In the Cloudflare dashboard, open **Networking → Tunnels** and create a named tunnel.
2. Install `cloudflared` on the Express host and run the service installation command shown in the dashboard. Store the tunnel token as a credential.
3. In the tunnel’s **Routes** tab, add a **Published application**. Set its hostname to match `TRINITY_ORIGIN` and its service to `http://127.0.0.1:3000`. Route the whole hostname so both browser apps and their API use the same HTTPS origin.
4. Check `https://trinity.example.org/api/health`, then open the public site and `/organizer/` on that hostname. Keep Express and `cloudflared` enabled after reboot. [Cloudflare Tunnel setup and routing](https://developers.cloudflare.com/tunnel/get-started/)

Respect `Cache-Control: no-store` for `/api/*` and `/organizer/*` in any Cloudflare cache rules. Public team logo requests check approval on each request, so cached responses could outlive a rejection. Cloudflare Free has a 100 MB upload limit, which fits the app’s 86 MiB declared request limit unless the zone setting has been lowered. [Cloudflare cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) · [Cloudflare upload limits](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/)

Cloudflare’s video delivery terms apply to public hostnames routed through Tunnel. For the public scene MP4s, use a Cloudflare R2 Standard bucket with a custom domain, or a separate HTTPS media host with byte-range support. R2 has its own usage allowance and billing setup. Upload only the public game clips and keep their object paths under `media/scenes/`, matching `frontend/public/media/scenes/`. Private registration uploads stay in PostgreSQL. [Cloudflare Tunnel FAQ](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/#large-file-and-streaming-traffic-through-tunnel) · [Cloudflare media delivery terms](https://blog.cloudflare.com/updated-tos/) · [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) · [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Set `VITE_SCENE_MEDIA_BASE_URL` to the root HTTPS URL of your media host when building the public app. The app appends the `media/scenes/` path. When the setting is omitted, local builds use the bundled clips. After publishing the media files, rebuild on the server and verify playback on the public site.

```sh
VITE_SCENE_MEDIA_BASE_URL=https://media.example.org npm --prefix frontend run build
curl -fsS -D - -o /dev/null -H 'Range: bytes=0-1023' https://media.example.org/media/scenes/cod-desktop.mp4
```

The range check should return HTTP `206` and `Content-Type: video/mp4`.

### 3. Verify before opening registration

- Rehearse on a staging database with synthetic rosters, ID images and payment proofs. Check one submission through its receipt email, staff review, approval, public listing, rejection and CSV export. Try a player already registered in another game and a submission outside the registration window.
- Confirm the public countdown and all four rulebook downloads against the approved event details. Verify mail delivery to a test inbox and use the relay’s verified sender configuration.
- Back up PostgreSQL, including `media`, and test a restore in an isolated environment. Restrict access to the database, backups and CSV exports because they contain private registration details. Schedule six months of website operation from public launch and arrange the archive handover. Closing registration or taking the website offline leaves the records in PostgreSQL.
- Start with one Node instance. If adding replicas, account for rate limits being per instance and use a shared limiter at the edge when needed. A conventional Node hosting provider also works with the same four folders and a persistent web process. Bind to `0.0.0.0` when the platform requires it and use its supplied `PORT` and proxy topology.

## Develop and troubleshoot

- Public event copy, prize amounts and co-chair contacts are in [`frontend/src/content/event.js`](frontend/src/content/event.js). The site uses a preview deadline until the backend supplies one. Official fees, availability, rulebooks, privacy notices and approved teams come from Express. Fictional team cards can appear when the API is unavailable during Vite development or if a build enables `VITE_SHOW_SAMPLE_TEAMS=true`. Leave that flag unset for production builds.
- [`frontend/src/features/`](frontend/src/features/) contains the game journey, tournament guide and registration form. Form previews are accessible at `#register-cod-mobile`, `#register-pubg-mobile`, `#register-mlbb` and `#register-clash-of-clans`. The captain can browse form tabs before completing the required fields. Closing the form or reloading clears the draft and uploads.
- The four game scenes play their short muted clips in order (COD Mobile, PUBG Mobile, Mobile Legends and Clash of Clans), then hold the last frame. Users can scroll onward while a clip plays. The site uses supplied artwork in [`frontend/public/art/`](frontend/public/art/) for the hero, game posters, organizer logos and reduced-motion fallback. It hosts Marcellus and Mulish locally. Artifex Hand CF can be enabled by importing a licensed stylesheet in [`frontend/src/app/App.jsx`](frontend/src/app/App.jsx).
- Run `npm --prefix frontend run media:prepare` to rebuild the optimized 24 fps H.264 MP4s from the workspace’s `Ref vIdeo` folder, or add `-- cod` to rebuild only Call of Duty. The script preserves the source videos and generates desktop, compact and portrait variants under [`frontend/public/media/scenes/`](frontend/public/media/scenes/), with front-loaded metadata for progressive playback. Bump the media URL version when replacing clips. See [`docs/previews`](../docs/previews/) for visual captures.
- Run `npm --prefix frontend test`, `npm --prefix frontend run build` and `npm --prefix backend test` from `Code/`. The backend suite uses isolated PGlite PostgreSQL and loopback HTTP and SMTP servers with synthetic data. It does not require your PostgreSQL credentials or send external email.

| Symptom | What to check |
| --- | --- |
| Public site returns 404 but `/api/health` works | Build the React app and check that `frontend/dist` is beside `backend/`. |
| Express exits at startup or `/api/health` returns 503 | Check PostgreSQL connectivity, `DATABASE_URL`, both migrations and the runtime grants. Use `journalctl -u trinity -n 50` on the server. |
| Cloudflare returns 502 | Check that `cloudflared` is running and can reach `http://127.0.0.1:3000` on the same host. |
| A browser POST returns 403 | Check that `TRINITY_ORIGIN` exactly matches the public browser origin, or set `TRINITY_DEV_ORIGIN` for Vite. |
| An image upload returns 413 | Check the per-image size and file count, then the overall request size and any proxy upload limit. |
| The form is visible but submissions are closed | Check the global switch, edition slug, registration dates, active form, rulebook and institution list. Restart Express after changing `.env`. |
| A submission succeeded but the receipt has not arrived | Check SMTP settings and relay logs, then check `receipt_outbox` for pending attempts. A successful submission is already stored. |
