# Monitoring Runbook

Stack: Prometheus + Alertmanager + Grafana + node-exporter + cAdvisor.
Runs on the VPS via `docker-compose.vps.yml` on the `monitoring` network.
Only Prometheus dual-homes on `backend` to scrape the API.

## Access

### Grafana (loopback only)

```bash
ssh -L 3000:127.0.0.1:3000 deploy@187.77.41.211
```

Then open `http://localhost:3000` in the browser.

- Admin user/pass: set via `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` in `/opt/bfin/.env` (first boot only — changing afterwards has no effect; wipe `app_grafana-data` volume to reset).

### Prometheus / Alertmanager

Not exposed. Reach via `docker exec` on the VPS:

```bash
sudo docker exec app-prometheus-1 wget -qO- 'http://localhost:9090/api/v1/targets?state=active'
sudo docker exec app-alertmanager-1 wget -qO- http://localhost:9093/api/v2/alerts
```

## Dashboards

Auto-provisioned from `monitoring/dashboards/`:

| File | Source | Covers |
|------|--------|--------|
| `bfin.json` | custom | API request rate / latency / 5xx |
| `node-exporter.json` | [grafana.com/d/1860](https://grafana.com/grafana/dashboards/1860) | Host CPU / mem / disk / network |
| `cadvisor.json` | [grafana.com/d/14282](https://grafana.com/grafana/dashboards/14282) | Per-container CPU / mem / I/O |

Edit dashboards: change the JSON in-repo and commit. Changes via Grafana UI are lost on container restart (provisioned dashboards are read-only).

## Alert Rules

Defined in `monitoring/alert_rules.yml`. Current rules:

| Alert | Expression | Severity |
|-------|------------|----------|
| `APIDown` | `up{job="api"} == 0` for 1m | critical |
| `HighErrorRate` | 5xx rate > 5% for 2m | warning |
| `HighLatency` | p95 > 2s for 3m | warning |
| `HostDiskFull` | `node_filesystem_avail_bytes` < 20% for 5m | warning |
| `HostMemoryHigh` | `MemAvailable` < 15% for 5m | warning |
| `ContainerCPUHigh` | per-container CPU > 80% for 5m | warning |
| `ContainerMemoryHigh` | container mem > 90% of limit for 5m | warning |

Tune thresholds after 1-2 weeks of real traffic. Thresholds are placeholders calibrated to avoid noise on a small workload — revisit once baseline p95 / error-rate are known.

### Applying rule changes

```bash
# after editing monitoring/alert_rules.yml
git push  # CI deploys
# on VPS:
sudo docker exec app-prometheus-1 kill -HUP 1  # hot-reload (preserves tsdb)
```

## Telegram Notifications

Channel: group `infra bfin` (chat_id `-5219148856`).
Bot: `@bfin_alerts_bot` (token in `/opt/bfin/.env`).

Route config in `monitoring/alertmanager.yml.template`:

- `group_wait: 30s` — first alert in a new group delayed 30s
- `group_interval: 5m` — follow-ups for same group
- `repeat_interval: 4h` — same alert re-sent every 4h while firing

### Test end-to-end

```bash
sudo docker exec app-alertmanager-1 wget -qO- \
  --post-data='[{"labels":{"alertname":"Test","severity":"info"},"annotations":{"summary":"ping","description":"runbook test"}}]' \
  --header='Content-Type: application/json' \
  http://localhost:9093/api/v2/alerts
```

Message appears in the group within ~30s.

## Common Operations

### Bootstrap on a fresh host

Requires these vars in `/opt/bfin/.env`:

```
METRICS_TOKEN=<hex token used by prometheus to scrape /metrics>
GRAFANA_ADMIN_USER=<username>
GRAFANA_ADMIN_PASSWORD=<password>
TELEGRAM_BOT_TOKEN=<from BotFather>
TELEGRAM_CHAT_ID=<negative number for groups, positive for DMs>
```

Bring the stack up:

```bash
cd /opt/bfin/app
sudo docker compose -f docker-compose.vps.yml --env-file /opt/bfin/.env up -d
```

### Reset Grafana admin

The Grafana admin user/password are only applied on first boot (they seed the sqlite DB). To re-seed:

```bash
sudo docker compose -f docker-compose.vps.yml --env-file /opt/bfin/.env down grafana
sudo docker volume rm app_grafana-data
sudo docker compose -f docker-compose.vps.yml --env-file /opt/bfin/.env up -d grafana
```

Dashboards and datasource survive (provisioned from repo).

### Reload Prometheus config without restart

```bash
sudo docker exec app-prometheus-1 kill -HUP 1
```

Use after editing `prometheus.yml.template` or `alert_rules.yml`.

### Silence an alert temporarily

Via Alertmanager API (no UI exposed):

```bash
sudo docker exec app-alertmanager-1 wget -qO- \
  --post-data='{"matchers":[{"name":"alertname","value":"HighLatency","isRegex":false}],"startsAt":"2026-04-20T10:00:00Z","endsAt":"2026-04-20T12:00:00Z","createdBy":"igor","comment":"maintenance"}' \
  --header='Content-Type: application/json' \
  http://localhost:9093/api/v2/silences
```

## Troubleshooting

### Alertmanager in crash loop

Usually `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` empty/malformed. The entrypoint substitutes them into `/tmp/alertmanager.yml`; a blank `bot_token` fails config validation.

```bash
sudo docker logs app-alertmanager-1 --tail 30
# check rendered config:
sudo docker exec app-alertmanager-1 cat /tmp/alertmanager.yml
```

### Prometheus target down

```bash
sudo docker exec app-prometheus-1 wget -qO- 'http://localhost:9090/api/v1/targets?state=active'
```

Target-specific:

- `api` — check `METRICS_TOKEN` matches between API and Prometheus env.
- `cadvisor` — if kernel doesn't allow running without `privileged`, add `cap_add: SYS_ADMIN` in compose.
- `node-exporter` — rare; check `/proc` and `/sys` mounts intact.

### Grafana login fails after changing password in .env

Env vars only seed on first boot. Either use the CLI:

```bash
sudo docker exec app-grafana-1 grafana-cli admin reset-admin-password <newpass>
```

or wipe the volume (see "Reset Grafana admin" above).
