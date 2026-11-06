#!/bin/sh
set -e

# compose only starts the services; wait until each one the test calls answers /health
WAIT_FOR="${WAIT_FOR:-${GATEWAY_URL:-http://gateway:3000}}"
TRIES="${K6_WAIT_TRIES:-60}"
for url in $WAIT_FOR; do
  i=0
  until wget -q -O /dev/null "$url/health"; do
    i=$((i + 1))
    if [ "$i" -ge "$TRIES" ]; then
      echo "$url/health not answering after $TRIES tries, giving up"
      exit 1
    fi
    echo "waiting for $url ($i/$TRIES)"
    sleep 2
  done
  echo "$url is up"
done

# push k6 metrics to Prometheus too, so the run shows up in Grafana next to the service metrics
if [ -n "$K6_PROMETHEUS_RW_SERVER_URL" ]; then
  exec k6 run -o experimental-prometheus-rw "$@"
fi
exec k6 run "$@"
