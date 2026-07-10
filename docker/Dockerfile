FROM grafana/xk6:latest AS builder

RUN xk6 build \
  --with github.com/XEmAX32/xk6-socket.io@latest \
  --output /k6

FROM alpine:latest

COPY --from=builder /k6 /usr/local/bin/k6

ENTRYPOINT ["k6"]