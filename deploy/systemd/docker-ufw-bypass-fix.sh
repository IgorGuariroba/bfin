#!/usr/bin/env bash
#
# docker-ufw-bypass-fix.sh
#
# Injects rules into the iptables DOCKER-USER chain so that traffic reaching
# containers with published ports is filtered by UFW intent instead of being
# allowed by default. Docker bypasses UFW because it writes its own FORWARD
# rules; DOCKER-USER is the sanctioned hook for user rules that run first.
#
# Behavior:
#   - ESTABLISHED,RELATED -> RETURN  (answers to outbound flows stay open)
#   - accept inbound on ALLOWED_TCP_PORTS / ALLOWED_UDP_PORTS from anywhere
#   - on PUBLIC_IFACE, drop everything else (containers not publicly reachable
#     unless their port is in the allow list)
#   - intra-docker traffic (icc / inter-container) is untouched: PUBLIC_IFACE
#     filter only fires on packets arriving from the public NIC.
#
# Idempotent: flushes the chain before re-applying, so re-runs converge.
# Runs on boot and on every docker.service restart (see the .service unit).
#
# Config: sourced from /etc/default/docker-ufw-bypass-fix if present.
#   PUBLIC_IFACE=eth0
#   ALLOWED_TCP_PORTS="80 443"
#   ALLOWED_UDP_PORTS=""
#
# NOTE: IPv4 only. If the host serves IPv6 publicly, mirror this for
# ip6tables (DOCKER-USER exists on ip6tables too).

set -euo pipefail

CONFIG_FILE="/etc/default/docker-ufw-bypass-fix"
if [[ -r "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

PUBLIC_IFACE="${PUBLIC_IFACE:-$(ip -4 route show default | awk '/default/ {print $5; exit}')}"
ALLOWED_TCP_PORTS="${ALLOWED_TCP_PORTS:-80 443}"
ALLOWED_UDP_PORTS="${ALLOWED_UDP_PORTS:-}"

if [[ -z "$PUBLIC_IFACE" ]]; then
  echo "docker-ufw-bypass-fix: PUBLIC_IFACE not set and no default route found" >&2
  exit 1
fi

validate_ports() {
  for port in $1; do
    if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
      echo "docker-ufw-bypass-fix: invalid port '${port}'" >&2
      exit 1
    fi
  done
}
validate_ports "${ALLOWED_TCP_PORTS}"
validate_ports "${ALLOWED_UDP_PORTS}"

flush_chain() {
  # DOCKER-USER is created by Docker; if it doesn't exist, docker isn't up
  if ! iptables -w -n -L DOCKER-USER >/dev/null 2>&1; then
    echo "docker-ufw-bypass-fix: DOCKER-USER chain not present (docker not running?)" >&2
    exit 1
  fi
  iptables -w -F DOCKER-USER
}

apply_rules() {
  # Rules are appended in order; DOCKER-USER falls through to RETURN at the
  # end of its default policy, so we end with an explicit DROP on the public
  # iface to catch anything not matched above.
  iptables -w -A DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN

  for port in $ALLOWED_TCP_PORTS; do
    iptables -w -A DOCKER-USER -i "$PUBLIC_IFACE" -p tcp --dport "$port" -j RETURN
  done
  for port in $ALLOWED_UDP_PORTS; do
    iptables -w -A DOCKER-USER -i "$PUBLIC_IFACE" -p udp --dport "$port" -j RETURN
  done

  iptables -w -A DOCKER-USER -i "$PUBLIC_IFACE" -j DROP
  iptables -w -A DOCKER-USER -j RETURN
}

case "${1:-apply}" in
  apply)
    flush_chain
    apply_rules
    echo "docker-ufw-bypass-fix: rules applied on $PUBLIC_IFACE (tcp: ${ALLOWED_TCP_PORTS:-none}, udp: ${ALLOWED_UDP_PORTS:-none})"
    ;;
  flush)
    flush_chain
    iptables -w -A DOCKER-USER -j RETURN
    echo "docker-ufw-bypass-fix: chain flushed (docker default restored)"
    ;;
  *)
    echo "usage: $0 [apply|flush]" >&2
    exit 2
    ;;
esac
