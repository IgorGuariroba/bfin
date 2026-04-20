#!/bin/sh
set -e

sed -e "s|__TELEGRAM_BOT_TOKEN__|${TELEGRAM_BOT_TOKEN}|g" \
    -e "s|__TELEGRAM_CHAT_ID__|${TELEGRAM_CHAT_ID}|g" \
    /etc/alertmanager/alertmanager.yml.template > /tmp/alertmanager.yml

exec alertmanager \
  --config.file=/tmp/alertmanager.yml \
  --storage.path=/alertmanager
