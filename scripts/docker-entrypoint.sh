#!/bin/sh
set -eu
[ -n "${APP_SECRET:-}" ] || { echo "APP_SECRET is required" >&2; exit 1; }
exec node server.js
