"""Backup only the isolated GameWeb database; keep 14 days locally."""
from datetime import datetime, timezone
import os
from pathlib import Path
import subprocess
import time

directory = Path('/var/backups/gameweb').resolve()
assert directory.is_dir()
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
target = directory / f'gameweb-{stamp}.dump'
temporary = directory / f'.gameweb-{stamp}.tmp'
os.umask(0o077)
try:
    with temporary.open('xb') as output:
        subprocess.run([
            '/usr/lib/postgresql/16/bin/pg_dump', '-h', '/run/gameweb-postgres',
            '-p', '15432', '-U', 'gameweb-db', '-d', 'gameweb', '-Fc',
        ], stdout=output, check=True)
        output.flush()
        os.fsync(output.fileno())
    temporary.replace(target)
finally:
    if temporary.exists():
        temporary.unlink()
for old in directory.glob('gameweb-*.dump'):
    if old.is_file() and not old.is_symlink() and old.resolve().parent == directory:
        if old.stat().st_mtime < time.time() - 14 * 86400:
            old.unlink()
print('GameWeb database backup completed.')
