# Hetzner production deployment

## Server

Use Ubuntu LTS on a Hetzner CX33 (x86) or CAX21 (ARM), preferably in Nuremberg.
Allow inbound TCP 22, 80 and 443 and UDP 443 in the Hetzner firewall. Restrict SSH
to key authentication.

Install Docker Engine and the Docker Compose plugin. Clone the repository to the
server and create the production environment file:

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Set real domains, randomly-generated secrets, PostgreSQL credentials, SMTP
credentials, `INVOICE_SELLER_*` (seller identity printed on PDF invoices) and
`BANK_ACCOUNT_IBAN` (Czech IBAN used for SPD QR payments on bank-transfer orders).
Create DNS A/AAAA records for both domains before starting Caddy.

## Off-site backups

Create a Hetzner Storage Box and an SSH key dedicated to backups. On the server:

```bash
mkdir -p deploy/ssh
chmod 700 deploy/ssh
```

Place the private key at `deploy/ssh/id_ed25519` and pin the Storage Box host key
in `deploy/ssh/known_hosts`. Neither file is committed. Configure
`RESTIC_REPOSITORY` and `RESTIC_PASSWORD` in `.env.production`.

The stack creates a daily PostgreSQL custom-format dump, retains local dumps for
30 days, and copies database dumps and assets to the encrypted Restic repository.
Test a restore before launch and at regular intervals.

## Deploy

The storefront pre-renders catalog data and therefore its image build reads the
production Shop API. On the first deployment, start the backend and TLS proxy
before building the storefront:

```bash
docker compose --env-file .env.production -f compose.production.yml build server
docker compose --env-file .env.production -f compose.production.yml up -d postgres server worker caddy
docker compose --env-file .env.production -f compose.production.yml run --rm server npm run configure:shipping
docker compose --env-file .env.production -f compose.production.yml run --rm server npm run configure:catalog
docker compose --env-file .env.production -f compose.production.yml build storefront
docker compose --env-file .env.production -f compose.production.yml up -d
docker compose --env-file .env.production -f compose.production.yml ps
```

Vendure runs pending database migrations before the API starts. The worker starts
separately and shares PostgreSQL and the persistent asset volume.

For updates, pull the reviewed Git commit, set `IMAGE_TAG` to that commit SHA,
build, and start the stack again. Do not deploy directly from an uncommitted
working tree.

## Restore drill

Stop the API and worker before restoring a database. Restore a selected dump into
an empty PostgreSQL database with `pg_restore`, then start the API and worker and
verify checkout, payment methods, assets and scheduled jobs.
