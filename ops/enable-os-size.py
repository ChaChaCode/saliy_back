#!/usr/bin/env python3
"""Prepare or deploy the OS (One Size) option in the existing admin application."""
from pathlib import Path
import difflib
import os
import shutil
import sys

app = Path('/home/deploy/apps/saliy_admin')
release = Path('/home/deploy/releases/admin-os-size-20261108')
backup = Path('/home/deploy/backups/admin-os-size-20261108')
files = [f'src/components/elements/product/{name}.tsx' for name in ('ProductCreate', 'ProductDetails')]
old = "const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL']"
new = "const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'OS']"

if sys.argv[1] == 'prepare':
    originals = {relative: (app / relative).read_text() for relative in files}
    if any(text.count(old) != 1 for text in originals.values()):
        raise SystemExit('Unexpected size configuration; inspect before modifying.')
    release.mkdir(mode=0o700)
    backup.mkdir(mode=0o700)
    for source in app.iterdir():
        if source.name in ('src', 'public'):
            shutil.copytree(source, release / source.name)
        elif source.is_file():
            shutil.copy2(source, release / source.name)
    (release / 'node_modules').symlink_to(app / 'node_modules', target_is_directory=True)
    patch = []
    for relative, text in originals.items():
        saved = backup / relative
        saved.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(app / relative, saved)
        updated = text.replace(old, new)
        (release / relative).write_text(updated)
        patch.extend(difflib.unified_diff(text.splitlines(True), updated.splitlines(True), fromfile='a/' + relative, tofile='b/' + relative))
    (backup / 'admin-os-size.patch').write_text(''.join(patch))
    print('OS option prepared for create and edit; production unchanged.')
elif sys.argv[1] == 'deploy':
    if not (release / 'dist/index.html').is_file():
        raise SystemExit('Build missing.')
    for relative in files:
        if (app / relative).read_bytes() != (backup / relative).read_bytes():
            raise SystemExit('Application sources changed during build; aborting.')
    shutil.copytree(app / 'dist/assets', release / 'dist/assets', dirs_exist_ok=True)
    staged = app / '.dist-os-size-20261108'
    shutil.copytree(release / 'dist', staged)
    for relative in files:
        shutil.copy2(release / relative, app / relative)
    os.rename(app / 'dist', backup / 'dist')
    try:
        os.rename(staged, app / 'dist')
    except BaseException:
        os.rename(backup / 'dist', app / 'dist')
        for relative in files:
            shutil.copy2(backup / relative, app / relative)
        raise
    print(f'OS enabled. Backup: {backup}')
else:
    raise SystemExit('Expected prepare or deploy.')
