#!/usr/bin/env bash
# Run as root on 188.225.33.32 after reviewing the current Nginx configuration.
# Application origins and frontend API URLs must be configured separately.
set -euo pipefail
umask 077

[[ $(id -u) == 0 ]] || { echo 'Root privileges are required.' >&2; exit 1; }
command -v certbot >/dev/null
command -v python3 >/dev/null
nginx -t

for domain in saliystudio.com www.saliystudio.com admin.saliystudio.com; do
  getent ahostsv4 "$domain" | awk '{print $1}' | grep -qx '188.225.33.32' || {
    echo "DNS does not resolve $domain to this server." >&2; exit 1;
  }
done

backup="/root/saliystudio-domain-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup"
cp -a /etc/nginx "$backup/nginx"
printf '%s\n' "$backup" > /root/saliystudio-domain-last-backup

# Certbot installs temporary HTTP challenge rules and restores the configuration.
certbot certonly --nginx --non-interactive --agree-tos \
  --cert-name saliystudio.com \
  -d saliystudio.com -d www.saliystudio.com -d admin.saliystudio.com

python3 - <<'PY'
from pathlib import Path
import re

available = Path('/etc/nginx/sites-available')
enabled = Path('/etc/nginx/sites-enabled')
sources = [('saliyclothes', 'saliystudio'), ('admin.saliyclothes', 'admin.saliystudio')]
admin_api = '''
    location /api/ {
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
for old, new in sources:
    source = available / old
    target = available / new
    link = enabled / new
    if not source.is_file():
        raise SystemExit(f'Missing existing configuration: {source}')
    if target.exists() or link.exists() or link.is_symlink():
        raise SystemExit(f'New configuration already exists; inspect it manually: {target}')
    text = source.read_text()
    if re.search(r'^\s*(upstream|map|geo)\s', text, re.M):
        raise SystemExit('Shared top-level directives require manual configuration review.')
    text = text.replace('saliyclothes.com', 'saliystudio.com')
    text = text.replace(' ipv6only=on', '')
    text = re.sub(r'\s+default_server(?=\s*;)', '', text)
    text = re.sub(r'(ssl_certificate\s+)[^;]+;', r'\g<1>/etc/letsencrypt/live/saliystudio.com/fullchain.pem;', text)
    text = re.sub(r'(ssl_certificate_key\s+)[^;]+;', r'\g<1>/etc/letsencrypt/live/saliystudio.com/privkey.pem;', text)
    if old.startswith('admin.') and 'location /api/' not in text:
        text = text.replace('    location /assets/', admin_api + '\n    location /assets/', 1)
    prepared.append((target, link, text))
for target, link, text in prepared:
    target.write_text(text)
    target.chmod(0o644)
    link.symlink_to(target)
PY

if ! nginx -t; then
  # Remove only the two links created above; the running configuration is untouched.
  unlink /etc/nginx/sites-enabled/saliystudio
  unlink /etc/nginx/sites-enabled/admin.saliystudio
  echo "Nginx validation failed. Backup: $backup" >&2
  exit 1
fi
systemctl reload nginx
echo "Nginx and HTTPS configured. Backup: $backup"
echo 'Next: check application origins, login, API URLs, and payment callbacks.'
