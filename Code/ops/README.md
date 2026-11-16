# Host Trinity Showdown

## Ubuntu server

1. Install Node.js 24 and Caddy. Set up PostgreSQL and build the app using the [setup guide](../README.md). For managed PostgreSQL, use the provider's hostname and TLS settings in `DATABASE_URL`.
2. Set `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=3000`, `TRUST_PROXY_HOPS=1` and `TRINITY_ORIGIN=https://trinity.example.org` in `backend/.env`. Use your actual hostname and keep registration closed during setup.
3. Run the backend as a systemd service named `trinity`. Set `User` to the app account, `WorkingDirectory` to the absolute backend path and `ExecStart` to the absolute Node path followed by `--env-file=.env src/server.js`. Set `Restart=on-failure` and `WantedBy=multi-user.target`, then enable and start the service.
4. Point the domain's A record at the server and allow TCP ports 80 and 443. Add this to `/etc/caddy/Caddyfile`, then reload Caddy.

   ```caddyfile
   trinity.example.org {
       reverse_proxy 127.0.0.1:3000
   }
   ```

Check `/api/health` and `/organizer/` over HTTPS. Set up and test database backups before collecting registrations.

## GitHub Actions on Azure

The [workflow](../../.github/workflows/deploy.yml) checks pull requests. When `AZURE_DEPLOY_ENABLED=true`, pushes to `main` build and deploy the app. To set up a replacement VM:

1. Place the initial app in `/home/azureuser/trinity/Code` and its private `.env` in `Code/backend/`. Create `~/trinity/current` as a symlink to `Code` and set the service's `WorkingDirectory` to `/home/azureuser/trinity/current/backend`.
2. Copy [the release script](deploy-release.sh) to `~/trinity/deploy-release.sh`. Update its Node path and the workflow's SSH destination for the new VM. The app account needs permission to run `sudo -n systemctl restart trinity`.
3. Add a dedicated SSH public key to `~/.ssh/authorized_keys` with this prefix.

   ```text
   restrict,command="/usr/bin/bash /home/azureuser/trinity/deploy-release.sh"
   ```

4. In GitHub Actions settings, add the private key as `AZURE_DEPLOY_KEY` and the verified VM host key line as `AZURE_SSH_KNOWN_HOSTS`. Set the repository variable `AZURE_DEPLOY_ENABLED` to `true`.

Check **Deploy to Azure** in the Actions run. The release script restores the previous release if the health check fails. Apply new database migrations separately.

For an existing database, back it up and apply [migration 003](../database/migrations/003_team_players.sql) with the database owner as part of deploying the release that uses `trinity.team_players`. Schedule the migration and release together during maintenance so the previous backend stops serving requests before the table names change. Rolling back to a release that uses the previous database names also requires restoring a compatible database.
