# Self-host your dashboard

The Cloudflare installation runs the dashboard, secure gateway and application backend in your own account. Dashboard state lives in Cloudflare Durable Object storage; application records live in D1. No MongoDB service or persistent container disk is required.

[Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/rory-truly/trulyyou-cloudflare)

Use a Cloudflare account with the Workers paid plan, Containers and D1 enabled, plus an active DNS zone for the secure gateway. The deploy button copies the small installer into your GitHub account and runs it in Cloudflare Builds. The images remain private. Your setup token authorizes one download session and exchanges for short-lived, read-only registry credentials. The installer copies the pinned images into your own Cloudflare registry; no Docker daemon or external host is required.

In Cloudflare, choose your account and fill in `OWNER_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_ZONE_ID`. Add `SETUP_TOKEN` and `PROVISIONING_TOKEN` as secret build variables; the installer saves them as Worker secrets automatically. The build requires a Cloudflare API token with Workers, D1, Containers/registry, and zone DNS permissions. Use `npm run deploy` as the deploy command. Your `workers.dev` dashboard address and internal storage keys are generated automatically.

For a terminal installation, download the [installation bundle](/assets/self-host.zip), extract it, run `npm install`, configure the same fields in `wrangler.jsonc`, and provide `SETUP_TOKEN` and `PROVISIONING_TOKEN` through a private environment file, then run `npm run deploy`. Open the reported dashboard URL to start provisioning.

## Installation setup

TrulyYou issues a setup token tied to your company and designated owner email. The token expires after 24 hours and activates one installation. Store it in Cloudflare's deployment secrets as `SETUP_TOKEN`, never in a repository or container image.

Provide the owner email, control-service origin, your Cloudflare account and active DNS zone, and a provisioning token for your account. Provisioning creates the Dashboard application, login method and screens, production and preview Workers, D1 datastores, and packet gateway. It verifies gateway connectivity before enabling sign-in.

Your designated owner receives the global Owner role. Being the first visitor or deleting all users does not grant ownership or reopen setup. First sign-in still requires email verification and TrulyYou approval.

## Dashboard emails

Dashboard sign-in emails are delivered through TrulyYou's restricted email relay, for example `NairaBank <signin@nairabank.truly.you>`. TrulyYou configures and verifies the sending subdomain. You do not need a Resend account or API key.

During provisioning, the setup token is exchanged for a restricted installation credential. This credential is saved in encrypted installation state and in the Dashboard backend's production secrets. It permits predefined dashboard sign-in emails, with sending limits; it cannot select arbitrary senders or email content.

The relay receives staff recipient addresses and sign-in codes for delivery through Resend. It does not receive your cloud credentials, customer database or proofs. Email sign-in depends on availability of the relay. TrulyYou can revoke an installation's email credential without accessing its infrastructure.

## Restarts and recovery

Container replacement retains applications, encrypted cloud connections and access configuration in your Cloudflare storage. Setup retries reuse the saved credential and provisioned resources. Once configured, setup cannot replace the owner or reopen access. Keep the installation's Durable Objects and D1 databases when upgrading.

If initial provisioning fails, correct its configuration and restart the container. For an expired setup token, obtain a replacement for the same unactivated installation. Do not delete durable state to repair a login problem.

## Usage reporting

Installation activation currently supports dashboard email delivery. Active-customer billing reports and subscription enforcement are not yet implemented.
