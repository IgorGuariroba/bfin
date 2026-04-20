#!/bin/sh
set -e

sed -e "s|__METRICS_TOKEN__|${METRICS_TOKEN}|g" \
    /etc/prometheus/prometheus.yml.template > /tmp/prometheus.yml

exec prometheus \
  --config.file=/tmp/prometheus.yml \
  --storage.tsdb.path=/prometheus
