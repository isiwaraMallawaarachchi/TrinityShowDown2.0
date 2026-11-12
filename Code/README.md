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
- Copy [the edition example](backend/edition.example.json) to `backend/edition.local.json`. Enter the approved details and add each game's rulebook PDF, up to 10 MiB. Use `cod-mobile`, `pubg-mobile`, `mlbb` or `clash-of-clans` for game IDs. Include `+05:30` in Sri Lanka registration timestamps.
- In a separate terminal, set `DATABASE_URL` to the owner connection and run `npm --prefix backend run edition -- ./edition.local.json`. Clear that variable afterward. Express uses the runtime login in `backend/.env`.
- Configure `SMTP_URL` and `RECEIPT_FROM` and test a dummy entry and receipt on a staging database. To open registration on the live site, set `REGISTRATION_ENABLED=true` and restart Express.

## Data and API

Express serves both browser apps and the API on one origin. PostgreSQL stores registrations and their uploads. Run `npm --prefix frontend test` and `npm --prefix backend test` from `Code`.

See the [hosting guide](ops/README.md) to deploy the app.
