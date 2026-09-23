# Self-host your dashboard

The installer runs the dashboard, secure gateway and application backend in your own cloud account. Install one dashboard per company; each app you create in it gets its own backend and datastore.

## Choose your cloud

Open [Deploy your dashboard](https://docs.truly.you/?guide=self-host) and choose Cloudflare, AWS, Azure or Google Cloud. Each button opens that cloud's own deployment form. TrulyYou never receives access to your cloud account.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/rory-truly/trulyyou-cloudflare)

Before you start, on every cloud, have:

- **A dedicated account, subscription or project** with billing enabled. The installer creates resources and role assignments across it.
- **A public DNS zone hosted by that cloud** (Cloudflare, Route 53, Azure DNS or Cloud DNS) and a new, unused hostname in it for the dashboard, such as `dashboard.auth.example.com`. If your domain is hosted elsewhere, delegate a subdomain to that cloud first; see [Azure DNS zone](#azure) for an example.
- **An owner email inbox you can read during setup.** The dashboard sends the first sign-in code there.
- **A phone with the TrulyYou authenticator.** The owner approves the first sign-in on it.

Cloudflare has been tested through the CLI installer. AWS, Azure and Google Cloud installers are available for validation; full live-account tests are still in progress.

## Cloudflare configuration

Use a Cloudflare account with the Workers paid plan, Containers and D1 enabled, plus an active DNS zone for the secure gateway. The deploy button copies the small installer into your GitHub account and runs it in Cloudflare Builds. The images remain private. The automatically generated setup credential authorizes one download session and exchanges for short-lived, read-only registry credentials. The installer copies the pinned images into your own Cloudflare registry; no Docker daemon or external host is required.

You need one credential of your own: **`PROVISIONING_TOKEN`**, a Cloudflare API token the running dashboard uses to create each app's Workers, D1 databases, gateway container and DNS records. Create it in **My Profile → API Tokens → Create Token → Custom token** with edit access to Workers, D1 and Containers on your account, and DNS edit access on the gateway zone. Everything else is generated for you: Cloudflare Builds deploys with its own build credential, and the installer creates and stores its TrulyYou setup credential as a Worker secret.

In the Cloudflare deployment form, choose your account and fill in:

| Field | Value |
|---|---|
| `COMPANY_NAME` | Your company name, shown in dashboard emails. |
| `OWNER_EMAIL` | The designated owner's email. |
| `CLOUDFLARE_ACCOUNT_ID` | The 32-character account ID from your Cloudflare dashboard's account home. |
| `CLOUDFLARE_ZONE_ID` | The zone ID of the active DNS zone for the secure gateway, from the zone's Overview page. |
| `DASHBOARD_HOSTNAME` | Optional hostname in that account, such as `auth-dashboard.example.com`. The installer creates a custom-domain route for it. Leave empty to use `workers.dev`. |
| `PROVISIONING_TOKEN` | Enter in the **secret** field. Cloudflare stores it as a Worker secret. |

Keep `npm run deploy` as the deploy command. The installer copies the images, deploys the dashboard Worker and prints its URL.

For a terminal installation on Apple Silicon or Linux x64, download the [installation bundle](/assets/self-host.zip), extract it, run `npm install`, and fill in the same fields under `vars` in `wrangler.jsonc`. Then pass the token in the environment, for example `PROVISIONING_TOKEN=<token> npm run deploy`. The installer does not read `.dev.vars` or `.env` files. Keep the generated `.generated/` directory: rerunning from it resumes the same installation.

## AWS, Azure and Google Cloud

Each deploy button opens the provider's native deployment portal. AWS uses a CloudFormation quick-create template; Azure uses a subscription ARM template ([step-by-step below](#azure)). Google Cloud opens Infrastructure Manager: choose Create deployment and the public Git source `https://github.com/rory-truly/trulyyou-cloudflare`, directory `native/gcp`, reference `main`. Select a deployment service account with Infrastructure Manager Agent (`roles/config.agent`), Service Usage Admin, Compute Admin, Storage Admin, DNS Admin, Service Account Admin, Service Account User, Role Administrator and Project IAM Admin in the dedicated project. The person deploying needs Infrastructure Manager Admin and permission to use that service account. Enter the Terraform inputs in the portal.

Use a dedicated account, subscription or project with billing enabled and an existing public DNS zone. Enter a new, unused dashboard hostname in that zone, your company and the designated owner email. Templates create HTTPS ingress, a dedicated dashboard VM, private versioned object storage and a deployment identity. The VM generates and checkpoints its installation credentials in that private storage, then downloads the pinned private dashboard image. The dashboard provisions the login backend and its datastore and gateway. Open the dashboard URL in the deployment outputs to follow setup; a completed infrastructure deployment alone does not mean login provisioning has finished.

Supported regions are AWS `eu-west-1` and `us-east-1`, Azure `westeurope`, `eastus` and `westus`, and Google Cloud `europe-west1` and `us-central1`. These installers still need live-account validation. Their local storage and bootstrap tests pass; this does not establish that a fresh cloud deployment succeeds.

The deployment identity remains inside your cloud. Google Cloud grants provisioning and IAM roles within your selected project. Azure grants Contributor and User Access Administrator within your selected subscription, plus access to its installation storage. AWS uses a deployment policy restricted to TrulyYou resource names and permission boundaries for runtime roles. The installer displays its scope before you create resources.

The image is copied into private storage in your cloud. Dashboard configuration is encrypted and written with concurrency checks to S3, Azure Blob Storage or Google Cloud Storage. Container replacement does not rely on its local filesystem. The VM runs the container builder as well as the dashboard and should not host unrelated workloads.

## Azure

### 1. Check your subscription

You need the **Owner** role on the subscription, or Contributor plus User Access Administrator. The template creates role assignments at subscription scope.

Register the Compute provider, then check that the dashboard VM size has quota in your region. New subscriptions often have zero quota for the older Dsv5 family:

```sh
az provider register --namespace Microsoft.Compute --wait
az vm list-usage --location westeurope --output table | grep -i -E "Dsv5|Dsv6"
```

The dashboard needs 2 vCPUs of either family. Choose `Standard_D2s_v6` unless Dsv5 shows a limit of at least 2. Request more quota on the Azure **Quotas** page if neither has it. Azure registers the other resource providers the template and dashboard use automatically.

### 2. Prepare an Azure DNS zone

The template writes the dashboard's DNS record into an **Azure DNS** zone in the same subscription. The zone must be publicly delegated: the dashboard obtains its HTTPS certificate automatically, and that fails if the hostname does not resolve.

If your domain's DNS is hosted elsewhere, create a zone for a subdomain and delegate it:

```sh
az group create --name trulyyou-dns --location westeurope
az network dns zone create --resource-group trulyyou-dns --name auth.example.com
```

The second command prints four Azure nameservers. At your current DNS provider, add an `NS` record named `auth` for each of them, then confirm the delegation with `dig NS auth.example.com`. Copy the zone's **Resource ID** from its **Properties** page in the portal, or with `az network dns zone show --resource-group trulyyou-dns --name auth.example.com --query id --output tsv`.

### 3. Deploy

Choose **Deploy to Azure** and sign in. Select your subscription and a deployment region, then complete the form:

| Field | Value |
|---|---|
| Installation Name | A name unique within the subscription, such as `trulyyou-production`. Use a new name for each dashboard. |
| Location | `westeurope`, `eastus` or `westus`. |
| Vm Size | `Standard_D2s_v6`, unless you confirmed Dsv5 quota in step 1. |
| Company Name | Your company name, shown in dashboard emails. |
| Owner Email | The designated owner's email. |
| Dns Zone Resource Id | The resource ID from step 2, beginning `/subscriptions/`. |
| Dashboard Host | A new hostname inside that zone, such as `dashboard.auth.example.com`. |

Choose **Review + create**, then **Create**. The deployment takes a few minutes. Its **Outputs** tab, under **Subscriptions → your subscription → Deployments**, shows `dashboardUrl` and the installation resource group.

### 4. Wait for first boot

The VM then installs its runtime, registers the installation and downloads the dashboard image. The dashboard URL starts responding about five minutes after the deployment completes; until then the browser reports that it cannot connect. It first shows **Setting up your dashboard** while it provisions its login backend, datastore and secure gateway in your subscription, and shows sign-in when that finishes.

## Installation setup

The installer generates a random installation ID and secret locally, registers their hash with TrulyYou, and saves the credential privately. It expires after 24 hours and activates one installation. It is never placed in a deployment URL or committed to a repository.

When the dashboard first starts, it provisions its own sign-in app in your account: the Dashboard application, login method and screens, production and preview backends, their datastores and the packet gateway. On Cloudflare these are Workers, D1 databases and a container; on Azure, Function Apps, Cosmos DB and a Container App in a separate resource group. It verifies gateway connectivity before enabling sign-in. The dashboard URL shows **Setting up your dashboard** until then.

Your designated owner receives the global Owner role. Being the first visitor or deleting all users does not grant ownership or reopen setup. First sign-in still requires email verification and approval on their TrulyYou device.

## Dashboard emails

Dashboard sign-in emails are delivered through TrulyYou's restricted email relay, for example `Your company <signin@your-company-1234abcd.truly.you>`. TrulyYou configures and verifies the sending subdomain. You do not need a Resend account or API key.

During provisioning, the generated setup credential is exchanged for a restricted installation credential. This credential is saved in encrypted installation state and in the Dashboard backend's production secrets. It permits predefined dashboard sign-in emails, with sending limits; it cannot select arbitrary senders or email content.

Until the designated owner verifies their first sign-in, the relay can only send verification mail to that owner. TrulyYou generates and checks this first code; the installer cannot mark itself verified. After verification, the company sender is provisioned in the background and restricted staff sign-in and invitation delivery is enabled. The verified TrulyYou sender handles delivery until the company sender is ready, so sender-domain quotas or DNS delays do not block owner verification. The relay receives staff recipient addresses and sign-in codes for delivery through Resend. It does not receive your cloud credentials, customer database or proofs. Email sign-in depends on availability of the relay. TrulyYou can revoke an installation's email credential without accessing its infrastructure.

## Restarts and recovery

Container or VM replacement retains applications, encrypted cloud connections and access configuration in your installation storage: Durable Objects on Cloudflare, or the private storage account, bucket or S3 bucket on the other clouds. Setup retries reuse the saved credential and provisioned resources. Once configured, setup cannot replace the owner or reopen access. Keep that storage when upgrading.

If initial provisioning fails, correct its configuration and restart the container, or on AWS, Azure and Google Cloud, restart the VM. For an expired setup token, obtain a replacement for the same unactivated installation. Do not delete durable state to repair a login problem.

## Usage reporting

Installation activation currently supports dashboard email delivery. Active-customer billing reports and subscription enforcement are not yet implemented.

## Deployment costs

The SDK overview shows deployment costs for the selected calendar month (UTC), cached for one hour. Owner and Administrator can read costs by default; custom roles can receive `cloud.cost.read` separately. The report is app-wide and includes production and preview resources. Currency totals and provider-reported costs remain separate from estimates.

- **Cloudflare:** usage-based list-price estimates for Workers, gateway/dashboard containers, D1 and Durable Objects. Shared plan fees, logging, image-registry charges, allowances and discounts are excluded. Daily peak database storage is an estimate. Analytics access and retention determine which periods are available.
- **AWS:** Cost Explorer charges grouped by service and filtered by the app’s `trulyyou:application` tag. Activate that tag in AWS Billing after resources appear; reporting can take 24–48 hours. The deployment role needs `ce:GetCostAndUsage`. Untagged services and shared costs are excluded. Face Liveness API charges are not individually resource-tagged and need separate attribution.
- **Azure:** actual charges for the app’s resource group and, for the Dashboard app, its installation resource group. The connected identity needs Cost Management query access.
- **Google Cloud:** connect a Cloud Billing BigQuery export in the cost panel. Grant the installation identity BigQuery Job User and read access to that dataset. Queries filter the project and `trulyyou_application` resource label, include credits and cap scans at 1 GB. Unlabeled services are excluded.

Missing permissions, delayed bills and unavailable components appear as unavailable, never as zero. Existing resources receive billing tags on their next explicit deployment. The connected cloud identity reads costs directly; customer cloud credentials and billing records are not sent to TrulyYou’s control service.
