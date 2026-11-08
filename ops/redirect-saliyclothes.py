#!/usr/bin/env python3
"""Redirect legacy storefront pages, preserving API, assets and TLS settings."""
from pathlib import Path
from datetime import datetime, timezone
import os
import re
import shutil
import subprocess


def run(*args):
    subprocess.run(args, check=True)


def prepare(text):
    pattern = r'(?m)^(    location / \{\n)(.*?)(^    \})'
    matches = list(re.finditer(pattern, text, re.S | re.M))
    if len(matches) != 1 or 'proxy_pass http://saliy_front;' not in matches[0][2]:
        raise SystemExit('Unexpected HTTPS location configuration; inspect manually.')
    text = re.sub(pattern, r'\g<1>        return 301 https://saliystudio.com$request_uri;\n\g<3>', text, count=1, flags=re.S | re.M)
    old = '    return 301 https://$host$request_uri;'
    if text.count(old) != 1:
        raise SystemExit('Unexpected HTTP redirect configuration; inspect manually.')
    return text.replace(old, '''    location /api/ {
        return 308 https://$host$request_uri;
    }
    location / {
        return 301 https://saliystudio.com$request_uri;
    }''', 1)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Validate transformation without writing')
    args = parser.parse_args()
    target = Path('/etc/nginx/sites-available/saliyclothes')
    current = target.read_text()
    updated = prepare(current)
    if args.check:
        print('Configuration transformation validated; no files changed.')
        raise SystemExit(0)
    if os.geteuid() != 0:
        raise SystemExit('Run with sudo python3.')
    run('nginx', '-t')
    backup = Path('/root') / ('saliyclothes-redirect-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    backup.mkdir(mode=0o700)
    shutil.copy2(target, backup / 'saliyclothes')
    try:
        target.write_text(updated)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
    except BaseException:
        shutil.copy2(backup / 'saliyclothes', target)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        raise
    print(f'Redirect enabled. Backup: {backup}')
