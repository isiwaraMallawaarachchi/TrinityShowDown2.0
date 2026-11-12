# Automatic Azure deployment

GitHub Actions tests both Node projects and builds the public frontend. A push to `main` deploys the tested bundle once the repository variable `AZURE_DEPLOY_ENABLED` is set to `true`. Pull requests run the checks without deploying.

## One-time setup

1. From Windows, use your existing Azure SSH key to upload `Code/ops/deploy-release.sh` to `/home/azureuser/trinity/deploy-release.sh` on `20.87.216.99`.
2. In an existing SSH session to the VM, run the following. This first points the service at the code already on the VM. Its `.env` stays in `~/trinity/Code/backend/` and each new release uses that file.

   ```bash
   if [[ ! -L $HOME/trinity/current ]]; then
     ln -sT "$HOME/trinity/Code" "$HOME/trinity/current"
   fi
   sudo install -d /etc/systemd/system/trinity.service.d
   sudo tee /etc/systemd/system/trinity.service.d/release.conf >/dev/null <<'EOF'
   [Service]
   WorkingDirectory=/home/azureuser/trinity/current/backend
   EOF
   sudo systemctl daemon-reload && sudo systemctl restart trinity
   curl -fsS --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:3000/api/health
   ```

3. Create a dedicated Ed25519 SSH key pair with an empty passphrase for GitHub Actions. Add its **public** key to `/home/azureuser/.ssh/authorized_keys` as a single line beginning with the options below. Keep your personal SSH entry there.

   ```text
   restrict,command="/usr/bin/bash /home/azureuser/trinity/deploy-release.sh" ssh-ed25519 PUBLIC_KEY trinity-github-deploy
   ```

4. In **GitHub → Settings → Secrets and variables → Actions**, add `AZURE_DEPLOY_KEY` with the dedicated **private** key. Add `AZURE_SSH_KNOWN_HOSTS` with the verified Azure VM host-key line from the Windows `known_hosts` file. `ssh-keygen -F 20.87.216.99` finds the saved line. Copy the line with the key itself, excluding the `# Host` comment.
5. Add the Actions repository variable `AZURE_DEPLOY_ENABLED` with value `true`. Run **Actions → Check and deploy Trinity Showdown → Run workflow** on `main`, or push a new commit to `main`. Verify that the deploy step reports the commit ID and open the HTTPS site to check the update.

The VM installs production dependencies in a separate release directory before switching `~/trinity/current`. The deployment restarts the service, checks `/api/health`, and switches back if the new release fails. Old release directories remain under `~/trinity/releases/`. Use `~/trinity/current/backend` for maintenance commands that need the running version of the app. Apply new database migrations separately before deploying code that depends on them.
