#!/usr/bin/env bash
set -Eeuo pipefail

release_dir=${1:?release directory is required}
release_root=/opt/anigeunde/releases
current_link=/opt/anigeunde/current
shared_venv=/opt/anigeunde/shared/venv

case "$release_dir" in
  "$release_root"/*) ;;
  *)
    echo "Refusing release outside $release_root" >&2
    exit 1
    ;;
esac

api_dir="$release_dir/apps/api"
if [[ ! -f "$api_dir/pyproject.toml" ]]; then
  echo "Missing API package in $api_dir" >&2
  exit 1
fi

if [[ ! -x "$shared_venv/bin/python" ]]; then
  python3 -m venv "$shared_venv"
fi

"$shared_venv/bin/python" -m pip install --disable-pip-version-check --upgrade pip
"$shared_venv/bin/python" -m pip install --disable-pip-version-check "$api_dir[postgres]"

previous_release=$(readlink -f "$current_link" 2>/dev/null || true)
next_link=/opt/anigeunde/current.next
ln -sfn "$release_dir" "$next_link"
mv -Tf "$next_link" "$current_link"

rollback() {
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -sfn "$previous_release" "$next_link"
    mv -Tf "$next_link" "$current_link"
    sudo systemctl restart anigeunde-api.service || true
  fi
}

if ! sudo systemctl restart anigeunde-api.service; then
  rollback
  exit 1
fi

if ! curl --fail --silent --show-error --retry 10 --retry-delay 2 \
  http://127.0.0.1:8000/health/ready >/dev/null; then
  rollback
  exit 1
fi

echo "Activated $release_dir"
