# muj-eshop

A full-stack e-commerce application built with [Vendure](https://www.vendure.io/) and [Next.js](https://nextjs.org/docs).

## Project Structure

This is a monorepo using npm workspaces:

```
muj-eshop/
├── apps/
│   ├── server/       # Vendure backend (GraphQL API, Admin Dashboard)
│   └── storefront/   # Next.js frontend
└── package.json      # Root workspace configuration
```

## Getting Started

### Development

Start both the server and storefront in development mode:

```bash
npm run dev
```

Or run them individually:

```bash
# Start only the server
npm run dev:server

# Start only the storefront
npm run dev:storefront
```

### Access Points

- **Vendure Dashboard**: http://localhost:3000/dashboard
- **Shop GraphQL API**: http://localhost:3000/shop-api
- **Admin GraphQL API**: http://localhost:3000/admin-api
- **Storefront**: http://localhost:3001

### Admin Credentials

Use these credentials to log in to the Vendure Dashboard:

- **Username**: superadmin
- **Password**: superadmin

## Production Build

Build all packages:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

The production target is Docker on Hetzner with PostgreSQL, Caddy TLS,
persistent assets and encrypted off-site backups. See
[`deploy/README.md`](deploy/README.md). Do not deploy the development SQLite
database or any `.env` file from a workstation.

## Czech shipping and payment setup

The `CzechCommercePlugin` adds:

- product-variant field `shippingProfile`,
- shipping-method fields `deliveryType` and `allowedPaymentMethods`,
- pickup-point fields on orders,
- the `czech-shipping-profile` shipping eligibility checker,
- the `czech-payment-policy` payment eligibility checker.

After changing custom fields, generate and run a database migration:

```bash
cd apps/server
npx vendure migrate -g CzechCommerceFields --output-dir ./src/migrations
npx vendure migrate -r
```

Configure the Czech channel in the Dashboard with CZK, the Czech Republic shipping
zone and the required tax zone. Then create these shipping methods:

- `courier-home`: delivery type `HOME_DELIVERY`
- `packeta-pickup`: delivery type `PICKUP_POINT`
- `personal-pickup`: delivery type `PERSONAL_PICKUP`, normally with a zero price

Use the `czech-shipping-profile` checker on each method and select its matching
delivery type. Do not create a shipping method for every pickup point.

On each shipping method, select **Povolené platby**. Checkout then offers only
those payment methods after the customer picks that shipping. An empty selection
keeps every active payment method available. Add the `czech-payment-policy`
checker to every production payment method and set its payment type and an
optional maximum order total.

The server provides production manual handlers for:

- `bank-transfer-payment-handler`
- `cash-on-delivery-payment-handler`
- `pay-at-pickup-payment-handler`

These handlers authorize the payment at checkout. An administrator settles it
only after verifying the bank statement, carrier remittance or in-store receipt.
The old dummy payment handler is not registered.

The checkout currently accepts pickup-point data returned by a future carrier
widget or API. Production Comgate, Packeta and PPL adapters still need their
provider credentials and must be configured before those methods are enabled.

## Learn More

- [Vendure Documentation](https://docs.vendure.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [Vendure Discord Community](https://vendure.io/community)
