#!/usr/bin/env bash
set -euo pipefail

if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  revision=${BASH_REMATCH[1]}
else
  printf 'Expected a deployment request with a Git commit ID.\n' >&2
  exit 1
fi

root="$HOME/trinity"
current="$root/current"
settings="$root/Code/backend/.env"
export PATH="$HOME/.nvm/versions/node/v24.22.3/bin:$PATH"

mkdir -p "$root/releases"
exec 9> "$root/deploy.lock"
flock -n 9

if [[ ! -L $current || ! -r $settings ]]; then
  printf 'The release link or backend settings are missing.\n' >&2
  exit 1
fi
previous=$(readlink -f -- "$current")
test -d "$previous/backend"

release=$(mktemp -d "$root/releases/$revision.XXXXXXXX")
tar -xzf - -C "$release" --no-same-owner --no-same-permissions
test -f "$release/frontend/dist/index.html"
test -f "$release/backend/src/server.js"
test -f "$release/organizer-frontend/index.html"
ln -s -- "$settings" "$release/backend/.env"
npm --prefix "$release/backend" ci --omit=dev

switch_release() {
  ln -s -- "$1" "$release/current-link"
  mv -Tf -- "$release/current-link" "$current"
}

healthy() {
  curl -fsS --max-time 2 http://127.0.0.1:3000/api/health | grep -Fxq '{"status":"ok"}'
}

switch_release "$release"
if sudo -n systemctl restart trinity; then
  for attempt in {1..15}; do
    if healthy 2>/dev/null; then
      printf 'Deployed %s\n' "$revision"
      exit 0
    fi
    sleep 1
  done
fi

printf 'Release %s failed its health check. Restoring the previous release.\n' "$revision" >&2
switch_release "$previous"
sudo -n systemctl restart trinity
exit 1
