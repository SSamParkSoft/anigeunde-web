#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get -y dist-upgrade
apt-get install -y \
  ca-certificates \
  caddy \
  curl \
  fail2ban \
  git \
  jq \
  python3 \
  python3-pip \
  python3-venv \
  rsync \
  unattended-upgrades \
  ufw \
  unzip

getent group anigeunde >/dev/null || groupadd --system anigeunde

if ! id anigeunde >/dev/null 2>&1; then
  useradd \
    --system \
    --gid anigeunde \
    --home-dir /nonexistent \
    --shell /usr/sbin/nologin \
    anigeunde
fi

if ! id deploy >/dev/null 2>&1; then
  useradd \
    --create-home \
    --shell /bin/bash \
    --groups anigeunde \
    deploy
else
  usermod --append --groups anigeunde deploy
fi

install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
install -m 0600 -o deploy -g deploy \
  /home/ubuntu/.ssh/authorized_keys \
  /home/deploy/.ssh/authorized_keys

install -d -m 2750 -o deploy -g anigeunde /opt/anigeunde
install -d -m 2750 -o deploy -g anigeunde /opt/anigeunde/releases
install -d -m 2770 -o deploy -g anigeunde /opt/anigeunde/shared
install -d -m 0750 -o root -g anigeunde /etc/anigeunde
install -d -m 0750 -o anigeunde -g anigeunde /var/log/anigeunde

install -d -m 0755 /etc/ssh/sshd_config.d
install -d -m 0755 /run/sshd
cat >/etc/ssh/sshd_config.d/99-anigeunde-hardening.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
MaxAuthTries 3
LoginGraceTime 30
AllowUsers ubuntu deploy
EOF

sshd -t
systemctl reload ssh.service

cat >/etc/sudoers.d/anigeunde-deploy <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl start anigeunde-api.service
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl stop anigeunde-api.service
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart anigeunde-api.service
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl status anigeunde-api.service
deploy ALL=(root) NOPASSWD: /usr/bin/journalctl -u anigeunde-api.service *
EOF
chmod 0440 /etc/sudoers.d/anigeunde-deploy
visudo -cf /etc/sudoers.d/anigeunde-deploy

cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
systemctl enable --now fail2ban.service

cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

cat >/etc/apt/apt.conf.d/52anigeunde-unattended-upgrades <<'EOF'
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades.service

install -d -m 0755 /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/anigeunde.conf <<'EOF'
[Journal]
Compress=yes
SystemMaxUse=500M
MaxRetentionSec=14day
EOF
systemctl restart systemd-journald.service

systemctl disable --now rpcbind.service rpcbind.socket 2>/dev/null || true

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH key only'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

systemctl enable --now systemd-timesyncd.service

echo "Bootstrap complete."
