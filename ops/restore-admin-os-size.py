#!/usr/bin/env python3
"""Restore OS in an artifact-only admin deployment without replacing other changes.

The source change is recorded in docs/patches/admin-os-size.patch. Apply it to
the frontend repository before its next build to keep OS in future releases.
"""
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import os
import re
import shutil
import subprocess

root = Path('/home/deploy/apps/saliy_admin/dist').resolve()
index = root / 'index.html'
original_html = index.read_bytes()
html = original_html.decode()
scripts = re.findall(r'<script\b[^>]*\bsrc="(/assets/[^"/]+\.js)"', html)
if len(scripts) != 1:
    raise SystemExit('Expected exactly one admin entry bundle; inspect manually.')
source = (root / scripts[0].lstrip('/')).resolve()
if source.parent != root / 'assets':
    raise SystemExit('Entry bundle must be inside dist/assets.')
original_js = source.read_bytes()
js = original_js.decode()
patterns = [
    ('[`XS`,`S`,`M`,`L`,`XL`]', '[`XS`,`S`,`M`,`L`,`XL`,`OS`]'),
    ('["XS","S","M","L","XL"]', '["XS","S","M","L","XL","OS"]'),
]
if sum(js.count(old) for old, _ in patterns) != 2:
    raise SystemExit('Expected exactly two legacy size lists; inspect manually.')
for old, new in patterns:
    js = js.replace(old, new)
updated_js = js.encode()
subprocess.run(['node', '--check', '--input-type=module'], input=updated_js, check=True)
stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = Path('/home/deploy/backups') / ('admin-os-restore-' + stamp)
backup.mkdir(mode=0o700)
shutil.copy2(index, backup / 'index.html')
shutil.copy2(source, backup / source.name)
name = 'index-os-' + sha256(updated_js).hexdigest()[:12] + '.js'
target = root / 'assets' / name
target.write_bytes(updated_js)
target.chmod(0o644)
updated_html = html.replace(scripts[0], '/assets/' + name)
if index.read_bytes() != original_html or source.read_bytes() != original_js:
    raise SystemExit('Deployment changed while preparing the fix; index not modified.')
temporary = root / ('.index-os-' + stamp + '.html')
temporary.write_text(updated_html)
temporary.chmod(0o644)
os.replace(temporary, index)
print('OS restored in both create and edit forms.')
print('Bundle: /assets/' + name)
print('Backup: ' + str(backup))
