#!/usr/bin/env bash
#
# install.sh — deploy docker-ufw-bypass-fix to the host
#
# Copies the script + unit, enables the systemd service.
# Must run as root (or via sudo).

set -euo pipefail

SCRIPT_NAME="docker-ufw-bypass-fix.sh"
SERVICE_NAME="docker-ufw-bypass-fix.service"
CONFIG_NAME="docker-ufw-bypass-fix"
SCRIPT_SRC="$(cd "$(dirname "$0")" && pwd)/${SCRIPT_NAME}"
SERVICE_SRC="$(cd "$(dirname "$0")" && pwd)/${SERVICE_NAME}"

SCRIPT_DEST="/usr/local/bin/${SCRIPT_NAME}"
SERVICE_DEST="/etc/systemd/system/${SERVICE_NAME}"
CONFIG_DEST="/etc/default/${CONFIG_NAME}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root or with sudo." >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_SRC" ]]; then
  echo "Missing ${SCRIPT_SRC}" >&2
  exit 1
fi

# --- script ---
install -m 0755 "$SCRIPT_SRC" "$SCRIPT_DEST"
echo "Installed ${SCRIPT_DEST}"

# --- config (create if missing) ---
if [[ ! -f "$CONFIG_DEST" ]]; then
  DEFAULT_IFACE="$(ip -4 route show default | awk '/default/ {print $5; exit}')"
  cat > "$CONFIG_DEST" <<EOF
# /etc/default/docker-ufw-bypass-fix
PUBLIC_IFACE=${DEFAULT_IFACE}
ALLOWED_TCP_PORTS="80 443"
ALLOWED_UDP_PORTS=""
EOF
  echo "Created ${CONFIG_DEST} (iface=${DEFAULT_IFACE}, tcp=80 443)"
else
  echo "Config already exists at ${CONFIG_DEST} — not overwritten"
fi

# --- systemd unit ---
install -m 0644 "$SERVICE_SRC" "$SERVICE_DEST"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "Service enabled. Starting..."
systemctl start "$SERVICE_NAME"

echo "Done. Status:"
systemctl status --no-pager "$SERVICE_NAME"
