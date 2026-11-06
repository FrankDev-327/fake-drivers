# custom k6 with Socket.io support: k6's built-in WebSocket client speaks raw WebSocket,
# not the Socket.io protocol (handshake, namespaces, events), so it can't talk to notification-service
FROM golang:1.25-alpine AS build
RUN apk add --no-cache git
ENV GOBIN=/usr/local/bin
RUN go install go.k6.io/xk6/cmd/xk6@latest
WORKDIR /build
RUN xk6 build --k6-version v1.8.1 \
  --with github.com/xemax32/xk6-socket.io@v0.1.0 \
  --output /build/k6

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=build /build/k6 /usr/local/bin/k6
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /reports
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
