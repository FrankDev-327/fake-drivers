#!/bin/sh
set -e

# compose already waits for the healthchecks; this is a last check that the gateway answers
GATEWAY="${GATEWAY_URL:-http://gateway:3000}"
TRIES="${K6_WAIT_TRIES:-30}"
i=0
until wget -q -O /dev/null "$GATEWAY/health"; do
  i=$((i + 1))
  if [ "$i" -ge "$TRIES" ]; then
    echo "gateway not answering at $GATEWAY/health after $TRIES tries, giving up"
    exit 1
  fi
  echo "waiting for gateway ($i/$TRIES)"
  sleep 2
done

# push k6 metrics to Prometheus too, so the run shows up in Grafana next to the service metrics
if [ -n "$K6_PROMETHEUS_RW_SERVER_URL" ]; then
  exec k6 run -o experimental-prometheus-rw "$@"
fi
exec k6 run "$@"
