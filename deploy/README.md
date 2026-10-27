# VM deployment

This stack serves the Vite frontend, proxies Express and Socket.IO through Nginx,
and runs Coturn on the host network so its UDP relay ports work without Docker
port translation. DNS `chat.bookmytrim.in` must point to the VM before TLS setup.

## Ports

Allow TCP 22, 80, 443; UDP and TCP 3478; and UDP 49152-49252 in both the VM
firewall and the cloud firewall/security list.

## First deployment

Install Docker Engine and the Docker Compose plugin on Ubuntu. Clone/copy this
repository to the VM, then from its root:

```sh
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Set `TURN_CREDENTIAL` to a strong random alphanumeric value and set
`TURN_EXTERNAL_IP` to `PUBLIC_IP/PRIVATE_IP` (the current VM mapping is
`137.23.33.62/10.0.0.157`). Keep `deploy/.env` private.

Start the stack with HTTP so Let's Encrypt can validate the hostname:

```sh
sudo docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build
```

After DNS resolves to the VM, request the certificate:

```sh
sudo docker compose --env-file deploy/.env -f deploy/docker-compose.yml --profile tools run --rm certbot certonly --webroot -w /var/www/certbot -d chat.bookmytrim.in --email YOUR_EMAIL --agree-tos --no-eff-email
```

After issuance, enable TLS and reload Nginx:

```sh
cp deploy/nginx/tls.conf.example deploy/nginx/active.conf
sudo docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec nginx nginx -t
sudo docker compose --env-file deploy/.env -f deploy/docker-compose.yml exec nginx nginx -s reload
```

Check the app at `https://chat.bookmytrim.in` and the health endpoint at
`https://chat.bookmytrim.in/api/health`. The frontend uses same-origin API and
Socket.IO connections. `GET /api/ice-servers` should include the TURN URL.

Install the included systemd timer to renew the certificate automatically and
reload Nginx after renewal:

```sh
sudo install -m 0644 deploy/systemd/web-rtc-cert-renew.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/web-rtc-cert-renew.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now web-rtc-cert-renew.timer
systemctl list-timers web-rtc-cert-renew.timer
```

Coturn uses long-term credentials matching the API's static TURN username and
password. If the VM public IP changes, update `TURN_EXTERNAL_IP` and recreate
the Coturn container. If you change the TURN credentials, update both services
by restarting the compose stack.
