# Self-host your dashboard

The Cloudflare installation runs the dashboard, secure gateway and application backend in your own account. Dashboard state lives in Cloudflare Durable Object storage; application records live in D1. No MongoDB service or persistent container disk is required.

## Choose your cloud

Open the [self-host setup page](https://docs.truly.you/?guide=self-host) and choose your cloud. Enter your company and designated owner email during deployment. The installer generates and registers its credentials automatically. Verify your email when you first sign in to the resulting dashboard; there is no separate token to obtain or paste.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/rory-truly/trulyyou-cloudflare)

Cloudflare has been tested through the CLI installer. AWS, Azure and Google Cloud installers are available for validation; full live-account tests are still in progress.

## Cloudflare configuration

Use a Cloudflare account with the Workers paid plan, Containers and D1 enabled, plus an active DNS zone for the secure gateway. The deploy button copies the small installer into your GitHub account and runs it in Cloudflare Builds. The images remain private. The automatically generated setup credential authorizes one download session and exchanges for short-lived, read-only registry credentials. The installer copies the pinned images into your own Cloudflare registry; no Docker daemon or external host is required.

In Cloudflare, choose your account and fill in `COMPANY_NAME`, `OWNER_EMAIL`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_ZONE_ID`. Optionally set `DASHBOARD_HOSTNAME` to a hostname in that account, such as `auth-dashboard.example.com`; the installer creates its Cloudflare custom-domain route and uses it for dashboard sign-in. Leave it empty to use `workers.dev`. Add `PROVISIONING_TOKEN` as a secret build variable. The installer also generates and saves its own setup credential as a Worker secret automatically. The build requires a Cloudflare API token with Workers, D1, Containers/registry, and zone DNS permissions. Use `npm run deploy` as the deploy command. Your `workers.dev` dashboard address and internal storage keys are generated automatically.

For a terminal installation, download the [installation bundle](/assets/self-host.zip), extract it, run `npm install`, configure the same fields in `wrangler.jsonc`, and provide `PROVISIONING_TOKEN` through a private environment file, then run `npm run deploy`. Open the reported dashboard URL to start provisioning.

## AWS, Azure and Google Cloud

Choose your provider above to open its native deployment portal. AWS uses a CloudFormation quick-create template; Azure uses a subscription ARM template. Google Cloud opens Infrastructure Manager: choose Create deployment and the public Git source `https://github.com/rory-truly/trulyyou-cloudflare`, directory `native/gcp`, reference `main`. Select a deployment service account with Infrastructure Manager Agent (`roles/config.agent`), Service Usage Admin, Compute Admin, Storage Admin, DNS Admin, Service Account Admin, Service Account User, Role Administrator and Project IAM Admin in the dedicated project. The person deploying needs Infrastructure Manager Admin and permission to use that service account. Enter the Terraform inputs in the portal.

Use a dedicated account, subscription or project with billing enabled and an existing public DNS zone. Enter a new, unused dashboard hostname in that zone, your company and the designated owner email. Templates create HTTPS ingress, a dedicated dashboard VM, private versioned object storage and a deployment identity. The VM generates and checkpoints its installation credentials in that private storage, then downloads the pinned private dashboard image. The dashboard provisions the login backend and its datastore and gateway. Open the dashboard URL in the deployment outputs to follow setup; a completed infrastructure deployment alone does not mean login provisioning has finished.

Supported regions are AWS `eu-west-1` and `us-east-1`, Azure `westeurope`, `eastus` and `westus`, and Google Cloud `europe-west1` and `us-central1`. These installers still need live-account validation. Their local storage and bootstrap tests pass; this does not establish that a fresh cloud deployment succeeds.

The deployment identity remains inside your cloud. Google Cloud grants provisioning and IAM roles within your selected project. Azure grants Contributor and User Access Administrator within your selected subscription, plus access to its installation storage. AWS uses a deployment policy restricted to TrulyYou resource names and permission boundaries for runtime roles. The installer displays its scope before you create resources.

The image is copied into private storage in your cloud. Dashboard configuration is encrypted and written with concurrency checks to S3, Azure Blob Storage or Google Cloud Storage. Container replacement does not rely on its local filesystem. The VM runs the container builder as well as the dashboard and should not host unrelated workloads.

## Installation setup

The installer generates a random installation ID and secret locally, registers their hash with TrulyYou, and saves the credential privately. It expires after 24 hours and activates one installation. It is never placed in a deployment URL or committed to a repository.

Provide the owner email, control-service origin, your Cloudflare account and active DNS zone, and a provisioning token for your account. Provisioning creates the Dashboard application, login method and screens, production and preview Workers, D1 datastores, and packet gateway. It verifies gateway connectivity before enabling sign-in.

Your designated owner receives the global Owner role. Being the first visitor or deleting all users does not grant ownership or reopen setup. First sign-in still requires email verification and approval on their TrulyYou device.

## Dashboard emails

Dashboard sign-in emails are delivered through TrulyYou's restricted email relay, for example `NairaBank <signin@nairabank-1234abcd.truly.you>`. TrulyYou configures and verifies the sending subdomain. You do not need a Resend account or API key.

During provisioning, the generated setup credential is exchanged for a restricted installation credential. This credential is saved in encrypted installation state and in the Dashboard backend's production secrets. It permits predefined dashboard sign-in emails, with sending limits; it cannot select arbitrary senders or email content.

Until the designated owner verifies their first sign-in, the relay can only send verification mail to that owner. TrulyYou generates and checks this first code; the installer cannot mark itself verified. After verification, the company sender is provisioned in the background and restricted staff sign-in and invitation delivery is enabled. The verified TrulyYou sender handles delivery until the company sender is ready, so sender-domain quotas or DNS delays do not block owner verification. The relay receives staff recipient addresses and sign-in codes for delivery through Resend. It does not receive your cloud credentials, customer database or proofs. Email sign-in depends on availability of the relay. TrulyYou can revoke an installation's email credential without accessing its infrastructure.

## Restarts and recovery

Container replacement retains applications, encrypted cloud connections and access configuration in your Cloudflare storage. Setup retries reuse the saved credential and provisioned resources. Once configured, setup cannot replace the owner or reopen access. Keep the installation's Durable Objects and D1 databases when upgrading.

If initial provisioning fails, correct its configuration and restart the container. For an expired setup token, obtain a replacement for the same unactivated installation. Do not delete durable state to repair a login problem.

## Usage reporting

Installation activation currently supports dashboard email delivery. Active-customer billing reports and subscription enforcement are not yet implemented.

## Deployment costs

The SDK overview shows deployment costs for the selected calendar month (UTC), cached for one hour. Owner and Administrator can read costs by default; custom roles can receive `cloud.cost.read` separately. The report is app-wide and includes production and preview resources. Currency totals and provider-reported costs remain separate from estimates.

- **Cloudflare:** usage-based list-price estimates for Workers, gateway/dashboard containers, D1 and Durable Objects. Shared plan fees, logging, image-registry charges, allowances and discounts are excluded. Daily peak database storage is an estimate. Analytics access and retention determine which periods are available.
- **AWS:** Cost Explorer charges grouped by service and filtered by the app’s `trulyyou:application` tag. Activate that tag in AWS Billing after resources appear; reporting can take 24–48 hours. The deployment role needs `ce:GetCostAndUsage`. Untagged services and shared costs are excluded. Face Liveness API charges are not individually resource-tagged and need separate attribution.
- **Azure:** actual charges for the app’s resource group and, for the Dashboard app, its installation resource group. The connected identity needs Cost Management query access.
- **Google Cloud:** connect a Cloud Billing BigQuery export in the cost panel. Grant the installation identity BigQuery Job User and read access to that dataset. Queries filter the project and `trulyyou_application` resource label, include credits and cap scans at 1 GB. Unlabeled services are excluded.

Missing permissions, delayed bills and unavailable components appear as unavailable, never as zero. Existing resources receive billing tags on their next explicit deployment. The connected cloud identity reads costs directly; customer cloud credentials and billing records are not sent to TrulyYou’s control service.

For Azure, register Microsoft.Compute in your subscription before checking VM quota. The native installer lets you choose D2s v5 or D2s v6; choose a region and family available to your subscription. Azure’s Quotas page offers capacity recommendations when a family is unavailable.
