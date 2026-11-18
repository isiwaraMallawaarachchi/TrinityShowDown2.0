# Run Trinity Showdown

Use Node.js 24, npm and PostgreSQL 18. Run these commands from the `Code` folder.

| Folder | Purpose |
| --- | --- |
| `frontend/` | React public site |
| `backend/` | Express API and email receipts |
| `organizer-frontend/` | Organizer sign-in and registration review |
| `database/` | PostgreSQL migrations and app permissions |

## Run locally

Open `psql -h 127.0.0.1 -U postgres -d postgres` with your local administrator login, then create the database and logins.

```sql
CREATE ROLE trinity_owner LOGIN;
\password trinity_owner
CREATE ROLE trinity_api LOGIN;
\password trinity_api
CREATE DATABASE trinity OWNER trinity_owner;
\q
```

Run the migrations and grants with the owner login.

```sh
psql -h 127.0.0.1 -U trinity_owner -d trinity -X -v ON_ERROR_STOP=1 -f database/migrations/001_initial.sql
psql -h 127.0.0.1 -U trinity_owner -d trinity -X -v ON_ERROR_STOP=1 -f database/migrations/002_media.sql
psql -h 127.0.0.1 -U trinity_owner -d trinity -X -v ON_ERROR_STOP=1 -f database/migrations/003_team_players.sql
psql -h 127.0.0.1 -U trinity_owner -d trinity -X -v ON_ERROR_STOP=1 -v runtime_role=trinity_api -f database/grant_runtime.sql
```

Copy `backend/.env.example` to `backend/.env` and set the `trinity_api` password in `DATABASE_URL`. Percent-encode reserved characters in the password.

```sh
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix backend ci
npm --prefix backend start
```

Open [the site](http://127.0.0.1:3000/) or [the organizer page](http://127.0.0.1:3000/organizer/). For live React edits, leave Express running and use `npm --prefix frontend run dev -- --host 127.0.0.1 --port 5174` in a second terminal.

## Prepare registration

- Set `TRINITY_BOOTSTRAP_PASSWORD` in your terminal to a private password of 12–128 characters. Run `npm --prefix backend run organizers -- bootstrap admin@example.org "Organizer name"` once, then clear the environment variable.
- Copy [the edition example](backend/edition.example.json) to `backend/edition.local.json`. Use `cod-mobile`, `pubg-mobile`, `mlbb` or `clash-of-clans` for game IDs and include `+05:30` in Sri Lanka registration timestamps. Set `rulebookVersion` to select a bundled PDF for `trinity-showdown`. Use version `2` for Mobile Legends and `1` for the other games. For a custom PDF up to 10 MiB, set `rulebookFile` relative to the edition JSON. Set `bankInstructions` only to override the edition’s default bank details.
- In a separate terminal, set `DATABASE_URL` to the owner connection and run `npm --prefix backend run edition -- ./edition.local.json`. Clear that variable afterward. Express uses the runtime login in `backend/.env`.
- Use `REGISTRATION_ANY_UNIVERSITY=true` for both edition setup and Express to let teams enter any university. On an existing database, rerun the app grants with the owner login first.
- Configure `SMTP_URL` and `RECEIPT_FROM` and test a dummy entry and receipt on a staging database. Set `RECEIPT_EMAIL_ENABLED=false` to pause sending and keep receipts queued. To open registration on the live site, set `REGISTRATION_ENABLED=true` and restart Express.

## Data and API

Express serves both browser apps and the API on one origin. PostgreSQL stores registrations and their uploads. Run `npm --prefix frontend test` and `npm --prefix backend test` from `Code`.

The bundled PDFs live in `backend/rulebooks/`. To revise a published rulebook, add the PDF as a new version in `backend/src/rulebooks.js` and keep the previous PDF. Use a new `formVersion` when switching the edition’s registration form to the new `rulebookVersion`.

After deploying the Mobile Legends version 2 PDF, run [its publishing script](database/publish_mlbb_rulebook_v2.sql) with the database owner login to switch the active form.

See the [hosting guide](ops/README.md) to deploy the app.
