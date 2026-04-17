#!/bin/bash
# setup.sh — one-time server prep for self-hosting xdc.art
# Run ONCE on a fresh Ubuntu 22.04/24.04 VPS as root (or via sudo).
#
# Does:
#   1. Update OS packages
#   2. Install Docker + Compose plugin
#   3. Raise file descriptor limits (ulimit) for high concurrency
#   4. Kernel tuning (sysctl) for many TCP connections
#   5. Firewall (UFW) — allow SSH + 80 + 443
#   6. Create 2GB swap file (helps on small VPSes)
#   7. Unattended-upgrades — auto-install security patches
#   8. Fail2ban — block brute force attacks on SSH
#
# After this runs: copy project files, then `docker compose up -d`

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "❌ Run as root or with sudo"
  exit 1
fi

echo "🔹 1/6 Updating system packages..."
apt update
apt upgrade -y

echo "🔹 2/6 Installing Docker + Compose plugin..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker --version
docker compose version

echo "🔹 3/6 Raising file descriptor limits..."
if ! grep -q "nofile 65535" /etc/security/limits.conf; then
  cat >> /etc/security/limits.conf <<'EOF'
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF
fi
# Ensure pam_limits is loaded
grep -q "pam_limits.so" /etc/pam.d/common-session || echo "session required pam_limits.so" >> /etc/pam.d/common-session

echo "🔹 4/6 Kernel tuning for high connection counts..."
if ! grep -q "somaxconn = 65535" /etc/sysctl.conf; then
  cat >> /etc/sysctl.conf <<'EOF'
# Tuning for high-traffic web server
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535
fs.file-max = 2097152
EOF
fi
sysctl -p

echo "🔹 5/6 Configuring firewall (UFW)..."
apt install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 443/udp comment 'HTTP/3'
ufw --force enable
ufw status verbose

echo "🔹 6/6 Creating 2GB swap file..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Reduce swap usage (prefer RAM)
  sysctl vm.swappiness=10
  grep -q "vm.swappiness" /etc/sysctl.conf || echo "vm.swappiness=10" >> /etc/sysctl.conf
else
  echo "    swap already exists, skipping"
fi
free -h

echo "🔹 7/8 Enabling unattended-upgrades (security patches only)..."
apt install -y unattended-upgrades apt-listchanges
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Package-Blacklist {
    "docker-ce";
    "docker-ce-cli";
    "containerd.io";
};
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable --now unattended-upgrades

echo "🔹 8/8 Installing fail2ban (block SSH brute force)..."
apt install -y fail2ban
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Log out and back in (for ulimit changes to take effect)"
echo "  2. Copy your project files to this server"
echo "  3. Place Cloudflare Origin Certificate in ./certs/"
echo "  4. Run: docker compose up -d"
