# Infrastructure

## Ubuntu API server bootstrap

`scripts/bootstrap-server.sh` prepares a fresh Ubuntu 24.04 API instance.

It performs the following operations:

- installs all available updates and the latest Oracle kernel;
- installs basic operational packages;
- creates the `deploy` deployment user and the non-login `anigeunde` runtime user;
- prepares `/opt/anigeunde`, `/etc/anigeunde`, and `/var/log/anigeunde`;
- disables SSH password login, root login, forwarding, and X11 forwarding;
- limits `deploy` sudo access to the `anigeunde-api.service` lifecycle and logs;
- enables UFW, fail2ban, unattended security updates, NTP, and journal retention;
- disables the unused `rpcbind` service.

Run it from an existing Ubuntu administrator session.

```bash
sudo bash bootstrap-server.sh
```

UFW exposes SSH, HTTP, and HTTPS publicly. SSH still accepts public-key
authentication only: password login and direct root login are disabled, and
fail2ban protects the SSH service. The OCI NSG or security list must separately
allow the same traffic.

After a kernel update, reboot the instance and verify both `ubuntu` and
`deploy` SSH access before ending the administrator session.

## CI/CD

The repository contains three GitHub Actions workflows.

- `.github/workflows/ci.yml`: runs web lint, type checking and production build, plus API Ruff and critical tests.
- `.github/workflows/deploy-web.yml`: deploys the verified `main` revision to Vercel.
- `.github/workflows/deploy-api.yml`: uploads the verified API revision to OCI, activates it and runs readiness checks.

Automatic deployment remains disabled until the following repository variables are set to `true`.

- `CD_WEB_ENABLED`
- `CD_API_ENABLED`

The web production environment requires these GitHub environment secrets.

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The API production environment requires these GitHub environment secrets.

- `OCI_HOST`
- `OCI_USER` (`deploy`)
- `OCI_SSH_PRIVATE_KEY`
- `OCI_KNOWN_HOSTS`

Set `API_HEALTH_URL` as a repository variable to run a public HTTPS readiness check after OCI deployment. The value should include `/health/ready`.

Before the first API deployment:

1. Replace `api.example.com` in `caddy/Caddyfile` with the production API domain.
2. Copy `systemd/api.env.example` to `/etc/anigeunde/api.env` and enter production values with mode `0640`, owner `root:anigeunde`.
3. Install `systemd/anigeunde-api.service` at `/etc/systemd/system/anigeunde-api.service`.
4. Install `caddy/Caddyfile` at `/etc/caddy/Caddyfile` and validate it with `caddy validate --config /etc/caddy/Caddyfile`.
5. Run `systemctl daemon-reload` and enable Caddy and the API service.

The deployment user needs only the `systemctl restart/status` permissions created by the bootstrap script. `activate-api-release.sh` rejects paths outside `/opt/anigeunde/releases`, switches the `current` symlink and restores the previous release if the service or readiness check fails.
