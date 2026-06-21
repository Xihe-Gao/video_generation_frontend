# Setup Checklist — FrameForge Productization

## 1. Supabase
- [ ] Create project at supabase.com
- [ ] SQL Editor → run `gateway/migrations/001_init.sql`
- [ ] Settings → Database → copy Connection String (postgresql://...) → `DATABASE_URL`

## 2. Clerk
- [ ] Create application at clerk.com
- [ ] Enable Email + Google sign-in
- [ ] Dashboard → API Keys → copy:
  - `CLERK_FRONTEND_API` = Frontend API URL (https://xxx.clerk.accounts.dev)
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = pk_live_xxx (for frontend)
- [ ] Webhooks → Add Endpoint:
  - URL: `https://ltx-gateway.fly.dev/webhooks/clerk`
  - Events: `user.created`
  - Copy Signing Secret → `CLERK_WEBHOOK_SECRET`
- [ ] JWT Templates → keep default (sub = clerk user id, email in claims)

## 3. Stripe
- [ ] Create account at stripe.com
- [ ] Products → Add product:
  - Name: Starter | Price: $9.00/month recurring → copy `price_xxx` → `STRIPE_PRICE_STARTER`
  - Name: Pro     | Price: $39.00/month recurring → copy `price_xxx` → `STRIPE_PRICE_PRO`
- [ ] Developers → API Keys → copy Secret Key → `STRIPE_SECRET_KEY`
- [ ] Developers → Webhooks → Add Endpoint:
  - URL: `https://ltx-gateway.fly.dev/webhooks/stripe`
  - Events: `customer.subscription.created`, `customer.subscription.updated`,
            `customer.subscription.deleted`, `invoice.payment_succeeded`
  - Copy Signing Secret → `STRIPE_WEBHOOK_SECRET`
- [ ] Customer Portal → Enable (Billing Portal settings page)

## 4. Fly.io Gateway — Set Secrets
```bash
fly secrets set \
  API_KEYS="your-internal-key" \
  MODAL_ENDPOINT_URL="https://xxx.modal.run" \
  DATABASE_URL="postgresql://..." \
  CLERK_FRONTEND_API="https://xxx.clerk.accounts.dev" \
  CLERK_WEBHOOK_SECRET="whsec_..." \
  STRIPE_SECRET_KEY="sk_live_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  STRIPE_PRICE_STARTER="price_..." \
  STRIPE_PRICE_PRO="price_..." \
  FRONTEND_URL="https://frameforge.vercel.app" \
  -a ltx-gateway
fly deploy -a ltx-gateway
```

## 5. Vercel Frontend — Environment Variables
```
VITE_CLERK_PUBLISHABLE_KEY = pk_live_xxx
VITE_API_URL               = https://ltx-gateway.fly.dev
```

## 6. GitHub token (rotate!)
- [ ] Go to https://github.com/settings/tokens
- [ ] Revoke the GitHub token that was used during setup (already exposed — rotate it now)
- [ ] Create new token if needed for CI/CD
