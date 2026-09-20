#!/bin/sh
set -eu

# Railway volumes are mounted after the image is built and may be owned by root.
# Prepare the persistent SQLite directory before dropping to the app user.
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

exec su -s /bin/sh nextjs -c "npx prisma migrate deploy && exec node server.js"
