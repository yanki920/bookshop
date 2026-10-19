#!/bin/sh
set -eu
# Persistent disks start owned by root; the web process runs as the node user.
mkdir -p "$BOOKSHOP_DATA_DIR" "$BOOKSHOP_BACKUP_DIR"
chown -R node:node "$BOOKSHOP_DATA_DIR" "$BOOKSHOP_BACKUP_DIR"
chmod 700 "$BOOKSHOP_DATA_DIR" "$BOOKSHOP_BACKUP_DIR"
exec gosu node "$@"
