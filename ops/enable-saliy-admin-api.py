"""Enable same-origin /api on the existing and new admin domains (run as root)."""
from pathlib import Path
import shutil

backup = Path('/root/saliystudio-domain-last-backup').read_text().strip()
api = '''    location /api/ {
        limit_req zone=api_limit burst=60 nodelay;
        proxy_pass http://saliy_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

'''
prepared = []
for name in ['admin.saliyclothes', 'admin.saliystudio']:
    path = Path('/etc/nginx/sites-available') / name
    text = path.read_text()
    if 'location /api/' in text:
        continue
    marker = '    location /assets/'
    if marker not in text:
        raise SystemExit(f'Missing insertion point: {path}')
    prepared.append((path, text.replace(marker, api + marker, 1)))
for path, text in prepared:
    saved = Path(backup) / ('before-admin-api-' + path.name)
    if not saved.exists():
        shutil.copy2(path, saved)
    path.write_text(text)
    print('Updated', path)
