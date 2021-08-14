#!/bin/bash
set -e

[ -e /var/lib/ytmc/ ] &&
    echo already installed && exit 1

[ $(id -u) -ne 0 ] &&
    echo need root && exit 1

cd "$(dirname "${BASH_SOURCE[0]}")"
dn="$(basename "$PWD")"
cp -pvR ../"$dn"/ /var/lib/ytmc/

grep -E ^ytmc: /etc/passwd ||
    useradd -rs /sbin/nologin -d /var/lib/ytmc ytmc

cd /var/lib/ytmc
chown -R ytmc. .
sudo -u ytmc python -m pip install --user -U fastapi uvicorn[standard] databases[sqlite] jinja2
cp -pv ytmcd.service /etc/systemd/system
systemctl enable --now ytmcd
echo install ok
