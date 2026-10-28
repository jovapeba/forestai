#!/bin/sh
# VERDANT AI container entrypoint.
#
# nginx's `resolver` directive needs literal addresses, but container DNS
# differs per runtime (Docker embedded DNS 127.0.0.11 on user-defined
# networks, a runtime-provided resolver elsewhere). Inject the container's
# own resolver first, then public fallbacks, and hand off to nginx.
set -e

DNS_PRIMARY="$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf 2>/dev/null || true)"
if [ -z "$DNS_PRIMARY" ]; then
  DNS_PRIMARY="1.1.1.1"
fi

sed -i "s|__DNS_RESOLVERS__|${DNS_PRIMARY} 1.1.1.1 8.8.4.4|g" /etc/nginx/nginx.conf

exec "$@"
