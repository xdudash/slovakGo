#!/usr/bin/env bash
# SQLite backup script — run manually or via cron: 0 3 * * * /path/to/backup.sh
# Keeps 7 daily backups in the same directory as the database file.
set -euo pipefail

DB="${1:-/var/www/html/data/slovak-life.sqlite}"
BACKUP_DIR="$(dirname "$DB")/backups"
DATE="$(date +%Y-%m-%d)"
DEST="$BACKUP_DIR/$DATE.sqlite"
KEEP=7

mkdir -p "$BACKUP_DIR"

# Flush WAL before copying so the backup is consistent.
sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);"

cp "$DB" "$DEST"

echo "Backup written: $DEST ($(du -sh "$DEST" | cut -f1))"

# Prune backups older than $KEEP days.
find "$BACKUP_DIR" -maxdepth 1 -name "*.sqlite" -mtime +$KEEP -delete
echo "Kept last $KEEP daily backups in $BACKUP_DIR"
