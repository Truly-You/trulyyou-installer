# Self-host your dashboard

The installer runs the dashboard, secure gateway and application backend in your own cloud account. Install one dashboard per company; each app you create in it gets its own backend and datastore.

## Before you start

You need an install code from TrulyYou. On [Deploy your dashboard](https://docs.truly.you/?guide=self-host), enter your company, your work email and what you plan to use TrulyYou for, then confirm the code we email you. Once we approve the request, we email you a one-time install code. It is valid for 14 days and installs one dashboard; that dashboard keeps using it for upgrades. Use the same email as the dashboard owner.

On every cloud, also have:

- **A dedicated account, subscription or project** with billing enabled. The installer creates resources and role assignments across it.
- **A public DNS zone hosted by that cloud** (Cloudflare, Route 53, Azure DNS or Cloud DNS) and a new, unused hostname in it for the dashboard, such as `dashboard.auth.example.com`. If your domain is hosted elsewhere, delegate a subdomain to that cloud and confirm it resolves **before** you deploy; see [Azure](#azure) or [Google Cloud](#google-cloud). Until the delegation is live, a wildcard record in the parent domain can answer for the dashboard hostname, and its HTTPS certificate request fails.
- **An owner email inbox you can read during setup.** The dashboard sends the first sign-in code there.
- **A phone with the TrulyYou authenticator.** The owner approves the first sign-in on it.

## Cloudflare

Install on Cloudflare with **Deploy to Cloudflare**, or [from a terminal](#install-from-a-terminal) if you prefer not to connect a Git account. Both produce the same installation.

### Before you start

- A Cloudflare account on the **Workers Paid** plan.
- An active DNS zone in that account, such as `example.com`, with two unused hostnames in it: one for the dashboard, such as `auth-dashboard.example.com`, and optionally one for your staff sign-in page, such as `signin.example.com`.
- A GitHub or GitLab account for the Deploy button. Cloudflare copies the installer into it and deploys from that copy.

### 1. Create a provisioning token

The running dashboard creates each app's Workers, databases, gateway and DNS records in your account, so it needs its own Cloudflare API token. In Cloudflare, open **My Profile → API Tokens → Create Token**, then **Create Custom Token → Get started**.

![Create API Token page with the custom token option](https://docs.truly.you/assets/guides/cloudflare/01-create-token.jpg)

Name the token, for example `TrulyYou dashboard provisioning`, and add these permissions:

| Scope | Permission | Access |
|---|---|---|
| Account | Containers | Edit |
| Account | D1 | Edit |
| Account | Workers Scripts | Edit |
| Account | Account Settings | Read |
| Zone | Zone | Read |
| Zone | Workers Routes | Edit |
| Zone | DNS | Edit |

![Token permissions](https://docs.truly.you/assets/guides/cloudflare/02-token-permissions.jpg)

Under **Account Resources**, include only your account. Under **Zone Resources**, choose **Specific zone** and your dashboard's zone.

![Token account and zone resources](https://docs.truly.you/assets/guides/cloudflare/03-token-resources.jpg)

Choose **Continue to summary**, check that it matches, then **Create Token**. Copy the token; Cloudflare shows it only once.

![Token summary](https://docs.truly.you/assets/guides/cloudflare/04-token-summary.jpg)

### 2. Open the deployment form

Choose **Deploy to Cloudflare** on this page and sign in to Cloudflare. It opens **Set up your application** in your account.

![Cloudflare Set up your application form](https://docs.truly.you/assets/guides/cloudflare/05-deploy-form.jpg)

### 3. Connect a Git account

Cloudflare copies the installer into a repository in your GitHub or GitLab account and deploys from it. Choose **New GitHub connection** (or GitLab) and the account for the copy.

GitHub asks you to grant the Cloudflare Workers and Pages app access to **all repositories** in that account, with write access to code. Use a GitHub account or organization that holds none of your source code, such as one created for deployments. If that is not possible, [install from a terminal](#install-from-a-terminal) instead.

![GitHub Install and Authorize Cloudflare Workers and Pages](https://docs.truly.you/assets/guides/cloudflare/06-github-authorize.jpg)

After you authorize the connection for the first time, Cloudflare opens a general repository list instead of the form. Choose **Deploy to Cloudflare** on this page again; the form now offers your connected account.

![Git account selection](https://docs.truly.you/assets/guides/cloudflare/07-git-account.jpg)

Select the account and tick **Create private Git repository**. The repository holds only the installer; your token is stored as an encrypted Cloudflare secret.

### 4. Fill in the form

![Git account, private repository and project name](https://docs.truly.you/assets/guides/cloudflare/08-form-top.jpg)

| Field | Value |
|---|---|
| Project name | The dashboard Worker's name, such as `trulyyou-dashboard`. |
| `INSTALL_CODE` | The install code from your approval email. |
| `PROVISIONING_TOKEN` | The token from step 1. |
| `OWNER_EMAIL` | The email you requested the install code with. You verify it at first sign-in. |
| `DASHBOARD_HOSTNAME` | The dashboard hostname from **Before you start**. Leave empty to use a `workers.dev` address. |
| `SIGNIN_HOSTNAME` | Optional. The sign-in hostname, in the same zone. Leave empty to use `signin.<your zone>`. |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID, shown on your Cloudflare account home and in the dashboard address. |
| `CLOUDFLARE_ZONE_ID` | The zone's ID, from the zone's **Overview** page. |

![Owner, hostname and sign-in fields](https://docs.truly.you/assets/guides/cloudflare/09-form-fields.jpg)

Leave the build settings as they are. If your browser offers to fill a saved password or email into these fields, dismiss it.

### 5. Deploy

Choose **Deploy**. Cloudflare creates your repository and starts a build that copies the dashboard images into your account and deploys the dashboard Worker. The build takes about two minutes.

![Build log](https://docs.truly.you/assets/guides/cloudflare/10-build-log.jpg)

### 6. Wait for setup

Open your dashboard hostname. It shows **Setting up your dashboard** while it creates its sign-in app, databases and secure gateway in your account, and shows sign-in when that is done, usually within five minutes. The page refreshes itself.

If it shows **Setup needs attention**, read the dashboard's log: open **Compute → Containers**, choose the container named after your project with `-dashboard` at the end, then **Logs**, and select only the **Containers** dataset. The most recent lines explain what stopped setup. After correcting the cause, [redeploy](#upgrade-a-cloudflare-installation); setup resumes where it stopped.

![Container logs](https://docs.truly.you/assets/guides/cloudflare/12-container-logs.jpg)

A new public hostname is found by automated scanners within minutes, so the request logs also show probes for files such as `.env`. They receive the setup page and can be ignored.

### 7. Sign in

Choose **Sign in with TrulyYou**, scan the code with your phone, enter the owner email and the code sent to it, and approve on your phone. The owner receives the Owner role.

![Dashboard sign-in](https://docs.truly.you/assets/guides/cloudflare/11-sign-in.jpg)

### Upgrade a Cloudflare installation

To move to a new release, copy every file from the [installer repository](https://github.com/Truly-You/trulyyou-installer) into your copy except `wrangler.jsonc` and `package.json`, then commit and push. Your form values live in those two files and the token is a secret, so they stay as they are. Cloudflare Builds redeploys automatically. To redeploy without changes, push an empty commit.

The deploy waits until the new dashboard image has rolled out, then restarts the dashboard on it. Allow up to ten minutes before signing in again.

### Install from a terminal

On Apple Silicon or Linux x64, download the [installation bundle](/assets/self-host.zip), extract it, run `npm install`, and fill in the same fields under `vars` in `wrangler.jsonc`. Then pass the token in the environment, for example `PROVISIONING_TOKEN=<token> npm run deploy`. `INSTALL_CODE` goes under `vars` with the other fields. The installer does not read `.dev.vars` or `.env` files. Keep the generated `.generated/` directory: rerunning from it resumes the same installation.

### Remove a Cloudflare installation

Delete the Workers and containers before the databases. Force-deleting a Worker also deletes its Durable Object data and its custom domains:

1. **Workers & Pages:** delete the dashboard Worker (your project name) and, for every app the dashboard created, `trulyyou-<id>`, `trulyyou-<id>-preview`, `trulyyou-<id>-gateway` and, if present, `trulyyou-<id>-links`. That includes the dashboard's own sign-in app.
2. **Containers:** delete the dashboard container and each `trulyyou-<id>-gateway-packetgateway` container if they remain.
3. **D1:** delete each app's `trulyyou-<id>-production-data` and `trulyyou-<id>-preview-data` databases.
4. **DNS:** in the zone, delete any remaining `route-<id>`, sign-in and custom-domain records.
5. Delete the installer repository in your Git account and revoke the provisioning token.

Container images copied into your Cloudflare registry remain until you delete them with `wrangler containers images delete`.

## AWS, Azure and Google Cloud

Use a dedicated account, subscription or project with billing enabled and an existing public DNS zone. Enter a new, unused dashboard hostname in that zone, your install code and the owner email you requested it with. Templates create HTTPS ingress, a dedicated dashboard VM, private versioned object storage and a deployment identity. The VM generates and checkpoints its installation credentials in that private storage, then downloads the pinned private dashboard image. The dashboard provisions the login backend and its datastore and gateway. Open the dashboard URL in the deployment outputs to follow setup; a completed infrastructure deployment alone does not mean login provisioning has finished.

Supported regions are AWS `eu-west-1` and `us-east-1`, Azure `westeurope`, `eastus` and `westus`, and Google Cloud `europe-west1` and `us-central1`.

When you remove an installation for good and delete the DNS zone you created for it, also delete the `NS` records that delegate that subdomain at your parent DNS provider. A delegation to a deleted zone lets anyone who creates a zone of the same name at that provider serve content on your subdomain.

The deployment identity remains inside your cloud. Google Cloud grants provisioning and IAM roles within your selected project. Azure grants Contributor and User Access Administrator within your selected subscription, plus access to its installation storage. AWS uses a deployment policy restricted to TrulyYou resource names and permission boundaries for runtime roles. The installer displays its scope before you create resources.

The image is copied into private storage in your cloud. Dashboard configuration is encrypted and written with concurrency checks to S3, Azure Blob Storage or Google Cloud Storage. Container replacement does not rely on its local filesystem. The VM runs the container builder as well as the dashboard and should not host unrelated workloads.

## AWS

### 1. Use a dedicated account

Deploy into an AWS account that holds nothing else named `trulyyou-`. The dashboard's role is scoped by name prefix, not by installation: it can manage every S3 bucket, Lambda function, ECR repository and runtime role named `trulyyou-*` in the account. If your company already uses AWS Organizations, create a member account for the dashboard. The template's instance (`t3.large`, 2 vCPUs) fits the default EC2 quota of a new account.

### 2. Prepare a Route 53 zone

The template writes the dashboard's DNS record into a **public Route 53 hosted zone in the same account**. If your domain's DNS is hosted elsewhere, create a zone for a subdomain and delegate it:

```sh
aws route53 create-hosted-zone --name auth.example.com --caller-reference trulyyou-$(date +%s) \
  --query "[HostedZone.Id,DelegationSet.NameServers]"
```

At your current DNS provider, add an `NS` record named `auth` for each of the four nameservers, then confirm the delegation with `dig SOA auth.example.com` before you deploy.

![The hosted zone's NS record with its four name servers](https://docs.truly.you/assets/guides/aws/02-hosted-zone.jpg)

### 3. Deploy

Choose **Deploy to AWS** and sign in. Select **Europe (Ireland)** `eu-west-1` or **US East (N. Virginia)** `us-east-1` in the console's region menu, then complete the form:

| Field | Value |
|---|---|
| Stack name | Any name, such as `trulyyou-dashboard`. Resource names derive from the stack ID, so a second stack does not collide. |
| InstallCode | The install code from your approval email. |
| OwnerEmail | The email you requested the install code with. |
| DnsZone | The hosted zone from step 2, chosen from the list. |
| DashboardHost | A new hostname inside that zone, such as `dashboard.auth.example.com`. |
| InstanceType | Keep `t3.large`. |
| UbuntuImage | Keep the default. |

![The completed stack parameters](https://docs.truly.you/assets/guides/aws/03-parameters.jpg)

Acknowledge that the template creates IAM resources, then choose **Create stack**. The same template from the terminal:

```sh
aws cloudformation create-stack --region eu-west-1 --stack-name trulyyou-dashboard \
  --template-url https://trulyyou-deploy-templates-956315803825.s3.eu-west-1.amazonaws.com/native/aws.json \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM --parameters \
  ParameterKey=InstallCode,ParameterValue=<install-code> ParameterKey=OwnerEmail,ParameterValue=owner@example.com \
  ParameterKey=DnsZone,ParameterValue=<hosted-zone-id> ParameterKey=DashboardHost,ParameterValue=dashboard.auth.example.com
```

The stack takes about three minutes. Its **Outputs** tab shows `DashboardUrl` and `StateBucket`.

![The stack's Outputs tab](https://docs.truly.you/assets/guides/aws/04-outputs.jpg)

### 4. Wait for first boot

Open the dashboard URL only after the stack is complete. Route 53 zones tell resolvers to remember a missing name for 15 minutes, so opening it before the record exists can leave your browser reporting that the site cannot be found for that long. The page responds about four minutes after the stack completes and shows **Setting up your dashboard** while it provisions its login backend (Lambda and DynamoDB) and secure gateway (ECS) in the account. Sign-in is typically available about seven minutes after the stack completes.

![The dashboard while it finishes setup](https://docs.truly.you/assets/guides/shared/setup-in-progress.jpg)

The template opens only ports 80 and 443. The instance's console output shows whether first boot completed (`Finished trulyyou.service`):

```sh
aws ec2 get-console-output --region eu-west-1 --latest --output text --instance-id <instance-id>
```

To read the dashboard's own log, run a command on the VM through Systems Manager; the template grants the VM Systems Manager access:

```sh
aws ssm send-command --region eu-west-1 --instance-ids <instance-id> --document-name AWS-RunShellScript \
  --parameters 'commands=["docker logs --tail 40 trulyyou-dashboard"]' --query Command.CommandId --output text
aws ssm get-command-invocation --region eu-west-1 --instance-id <instance-id> --command-id <command-id> \
  --query StandardOutputContent --output text
```

Restarting the VM recreates the dashboard container and discards its previous log, so read the log before you restart. If the dashboard loads but says **Dashboard sign-in has not been configured**, restart the VM; setup resumes from its saved state and enables sign-in when it completes.

### Remove or retry an installation

Deleting the stack alone does not remove everything, and it fails while the dashboard's runtime roles still exist. In a dedicated account, remove the resources the dashboard created first, in this order: the ECS gateway service, its load balancer and cluster, the Lambda functions, the DynamoDB tables (turn off their deletion protection first), and the `trulyyou-*-runtime` IAM roles. Then delete the stack. Afterwards, empty and delete the `trulyyou-` S3 buckets, including all object versions (the stack keeps its state bucket), and disable and then delete the CloudFront distribution. Remove the gateway's certificate, target group, container registry and VPC as well. If an app has a custom domain, also delete its CloudFront distribution and its certificate in `us-east-1`. Delete the Route 53 zone once only its `NS` and `SOA` records remain, or close the account. A retry can use a new stack in the same account; names derive from each stack's ID.

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

![The zone's overview in the Azure portal, with its four name servers](https://docs.truly.you/assets/guides/azure/02-dns-zone.jpg)

### 3. Deploy

Choose **Deploy to Azure** and sign in. Select your subscription and a deployment region, then complete the form:

| Field | Value |
|---|---|
| Installation Name | A name unique within the subscription, such as `trulyyou-production`. Use a new name for each dashboard. |
| Location | `westeurope`, `eastus` or `westus`. |
| Vm Size | Keep `Standard_D2s_v6`, or choose `Standard_D2s_v5` if step 1 showed Dsv5 quota. |
| Install Code | The install code from your approval email. |
| Owner Email | The email you requested the install code with. |
| Dns Zone Resource Id | The resource ID from step 2, beginning `/subscriptions/`. |
| Dashboard Host | A new hostname inside that zone, such as `dashboard.auth.example.com`. |

![The completed Azure deployment form](https://docs.truly.you/assets/guides/azure/03-deploy-form.jpg)

Choose **Review + create**, then **Create**. The same template from the terminal:

```sh
az deployment sub create --name trulyyou-dashboard --location westeurope \
  --template-uri https://raw.githubusercontent.com/Truly-You/trulyyou-installer/main/native/azure.json \
  --parameters installationName=trulyyou-production vmSize=Standard_D2s_v6 installCode=<install-code> \
  ownerEmail=owner@example.com dnsZoneResourceId=<zone-resource-id> dashboardHost=dashboard.auth.example.com
```

 The deployment takes a few minutes. Its **Outputs** tab, under **Subscriptions → your subscription → Deployments**, shows `dashboardUrl` and the installation resource group.

### 4. Wait for first boot

The VM then installs its runtime, checks your install code and downloads the dashboard image. The dashboard URL starts responding about five minutes after the deployment completes; until then the browser reports that it cannot connect. It first shows **Setting up your dashboard** while it provisions its login backend, datastore and secure gateway in your subscription, and shows sign-in when that finishes. On a new subscription this takes about 30 minutes; most of it is Azure creating the gateway's first Container Apps environment. The page refreshes itself.

![The dashboard while it finishes setup](https://docs.truly.you/assets/guides/shared/setup-in-progress.jpg)

If the page shows **Setup needs attention**, read the dashboard's log on the VM. Replace the group and VM names with the installation resource group from the deployment outputs; the VM has the same name:

```sh
az vm run-command invoke --resource-group trulyyou-abc123 --name trulyyou-abc123 \
  --command-id RunShellScript --scripts "docker logs --tail 40 trulyyou-dashboard"
```

### Remove or retry an installation

Deleting the installation resource group does not remove everything. Also delete the separate resource group the dashboard created for its sign-in app (a second `trulyyou-` group) and the two subscription-level role assignments the template granted. Deleting the groups deletes the identity but leaves those assignments in place:

```sh
az role assignment list --scope /subscriptions/<subscription-id> --query "[?principalName==''].{id:id,role:roleDefinitionName}" --output table
az role assignment delete --ids <id> <id>
```

Deleting the sign-in group takes about 20 minutes, mostly for its Container Apps environment. A retry with the same **Installation Name** fails while those assignments remain. To start again without removing them, use a new installation name. Keep your DNS zone for a retry; the next deployment replaces the dashboard's DNS record. To remove everything, also delete the DNS zone's resource group.

## Google Cloud

### 1. Prepare the project

Create a new project for the dashboard and link it to a billing account. You need the **Owner** role on it. Enable the APIs used before the template runs; the template enables the rest:

```sh
PROJECT=<project-id>
gcloud services enable config.googleapis.com dns.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com --project $PROJECT
```

### 2. Prepare a Cloud DNS zone

The template writes the dashboard's DNS record into a **public Cloud DNS zone in the same project**, identified by the zone's **name**. If your domain's DNS is hosted elsewhere, create a zone for a subdomain and delegate it:

```sh
gcloud dns managed-zones create trulyyou --dns-name=auth.example.com. --visibility=public \
  --description="TrulyYou dashboard" --project $PROJECT
gcloud dns managed-zones describe trulyyou --project $PROJECT --format="value(nameServers)"
```

At your current DNS provider, add an `NS` record named `auth` for each of the four nameservers, then confirm the delegation with `dig NS auth.example.com` before you deploy.

![The Cloud DNS zone and its four name servers](https://docs.truly.you/assets/guides/gcp/02-dns-zone.jpg)

### 3. Create the deployment service account

Infrastructure Manager runs Terraform as a service account in your project. It needs these roles; they are not granted to TrulyYou:

```sh
DEPLOYER=trulyyou-deployer@$PROJECT.iam.gserviceaccount.com
gcloud iam service-accounts create trulyyou-deployer --display-name="TrulyYou deployer" --project $PROJECT
for role in config.agent serviceusage.serviceUsageAdmin compute.admin storage.admin dns.admin \
  iam.serviceAccountAdmin iam.serviceAccountUser iam.roleAdmin resourcemanager.projectIamAdmin; do
  gcloud projects add-iam-policy-binding $PROJECT --member=serviceAccount:$DEPLOYER --role=roles/$role --condition=None --quiet
done
```

A new service account can take a few seconds to become usable; if the first binding reports that it does not exist, run the loop again.

### 4. Deploy

In [Infrastructure Manager](https://console.cloud.google.com/infra-manager), choose **Create deployment**, a deployment region and the service account from step 3. Choose **Git** as the source, with repository `https://github.com/Truly-You/trulyyou-installer`, directory `native/gcp` and reference `main`, then enter the inputs:

| Input | Value |
|---|---|
| `project_id` | The project ID from step 1. |
| `region` | `europe-west1` (default) or `us-central1`. |
| `installation_name` | `trulyyou-` followed by 3–20 lowercase letters, digits or hyphens, such as `trulyyou-production`. Default `trulyyou-dashboard`. The VM, network and bucket use this name. |
| `install_code` | The install code from your approval email. |
| `owner_email` | The email you requested the install code with. |
| `dns_zone` | The zone **name** from step 2, such as `trulyyou`, not its domain. |
| `dashboard_host` | A new hostname inside that zone, such as `dashboard.auth.example.com`. |

Or deploy the same source from the terminal, with the inputs in a `trulyyou.tfvars` file (`project_id = "..."`, one per line):

```sh
gcloud infra-manager deployments apply projects/$PROJECT/locations/europe-west1/deployments/trulyyou-dashboard \
  --service-account=projects/$PROJECT/serviceAccounts/$DEPLOYER \
  --git-source-repo=https://github.com/Truly-You/trulyyou-installer --git-source-directory=native/gcp \
  --git-source-ref=main --inputs-file=trulyyou.tfvars
```

The deployment takes about three minutes. Its outputs, on the deployment's **Outputs** tab, are `dashboard_url` and the `state_bucket` that holds the installation's durable state.

![The deployment's Outputs tab in Infrastructure Manager](https://docs.truly.you/assets/guides/gcp/04-outputs.jpg)

### 5. Wait for first boot

The VM installs its runtime, checks your install code and downloads the dashboard image; the dashboard URL responds about three minutes after the deployment completes. It first shows **Setting up your dashboard** while it provisions its login backend (Cloud Functions and Firestore) and secure gateway (Cloud Run) in the project, and shows sign-in when that finishes. On a new project this takes about 15 minutes, most of it building the functions and the gateway image and issuing the gateway's certificate. The page refreshes itself.

![The dashboard while it finishes setup](https://docs.truly.you/assets/guides/shared/setup-in-progress.jpg)

The template opens only ports 80 and 443. To read the dashboard's log when the page shows **Setup needs attention**, allow SSH through Identity-Aware Proxy for the installation's network, then connect through it. Replace `trulyyou-dashboard` with your `installation_name`, and use zone `b` of your region:

```sh
gcloud compute firewall-rules create trulyyou-dashboard-iap-ssh --project $PROJECT --network trulyyou-dashboard \
  --source-ranges 35.235.240.0/20 --target-tags trulyyou-dashboard --allow tcp:22
gcloud compute ssh trulyyou-dashboard --zone europe-west1-b --tunnel-through-iap --project $PROJECT \
  --command "sudo docker logs --tail 40 trulyyou-dashboard"
```

Delete the firewall rule when you are done. The gateway logs to Cloud Logging under its Cloud Run service, `trulyyou-<id>-gateway`.

### Remove or retry an installation

Deleting the Infrastructure Manager deployment does not remove everything: the state bucket is kept while it holds data, and the login backend, Firestore databases and Cloud Run gateway the dashboard created are protected against deletion. Because the project is dedicated to the dashboard, remove a test installation by shutting down the project:

```sh
gcloud projects delete $PROJECT
```

Shutting down the project stops billing immediately and deletes it after 30 days; it removes the DNS zone, custom-domain load balancers and every other resource in it. To retry in the same project, create a new deployment with a new `installation_name`. Google Cloud keeps the ID of a deleted custom role reserved, and the template's role is named after the installation. Keep your DNS zone; the next deployment writes its own dashboard record.

## Installation setup

The installer checks your install code with TrulyYou before it creates anything. The code activates one dashboard: at first start, the dashboard exchanges it for its own credential, and a second dashboard cannot use it. The same dashboard keeps using the code to download new releases. Keep it private; on Cloudflare it is stored in your private repository copy.

When the dashboard first starts, it provisions its own sign-in app in your account: the Dashboard application, login method and screens, production and preview backends, their datastores and the packet gateway. On Cloudflare these are Workers, D1 databases and a container; on Azure, Function Apps, Cosmos DB and a Container App in a separate resource group; on Google Cloud, Cloud Functions, Firestore databases and a Cloud Run gateway in the same project. It verifies gateway connectivity before enabling sign-in. The dashboard URL shows **Setting up your dashboard** until then. The sign-in app is served on `signin.<zone>`, for example `signin.auth.example.com` for the zone `auth.example.com`, so your staff never see a provider hostname; keep that name free in the zone. On Google Cloud, sign-in uses the provider hostname until Google issues the certificate for it, usually within an hour, then switches automatically.

Your designated owner receives the global Owner role. Being the first visitor or deleting all users does not grant ownership or reopen setup. First sign-in still requires email verification and approval on their TrulyYou device.

## Dashboard emails

Dashboard sign-in emails are delivered through TrulyYou's restricted email relay, for example `Your company <signin@your-company-1234abcd.truly.you>`. TrulyYou configures and verifies the sending subdomain; you do not need an email provider of your own.

During provisioning, the generated setup credential is exchanged for a restricted installation credential. This credential is saved in encrypted installation state and in the Dashboard backend's production secrets. It permits predefined dashboard sign-in emails, with sending limits; it cannot select arbitrary senders or email content.

Until the designated owner verifies their first sign-in, the relay can only send verification mail to that owner, and TrulyYou generates and checks that first code. After verification, staff sign-in and invitation emails are enabled. The relay receives only staff recipient addresses and sign-in codes; it never receives your cloud credentials, customer data or proofs. TrulyYou can revoke an installation's email credential without accessing its infrastructure.

## Restarts and recovery

Container or VM replacement retains applications, encrypted cloud connections and access configuration in your installation storage: Durable Objects on Cloudflare, or the private storage account, bucket or S3 bucket on the other clouds. Setup retries reuse the saved credential and provisioned resources. Once configured, setup cannot replace the owner or reopen access. Keep that storage when upgrading.

If initial provisioning fails, correct its configuration and restart the container, or on AWS, Azure and Google Cloud, restart the VM. If the setup credential expired before the installation activated, contact TrulyYou for a replacement for the same installation. Do not delete durable state to repair a login problem.

## Usage reporting

Every six hours the dashboard sends TrulyYou an aggregate usage report, signed with its installation credential. It contains only counts: the number of apps, active devices over the last day and 30 days, completed and total requests, the clouds your apps run on, how many deployments are ready or failed, and the dashboard version. Device, customer and subject identifiers, method inputs, proofs and datastore contents never leave your cloud. Your dashboard's own sign-in app is excluded.

TrulyYou uses these reports to support your installation and to measure usage.

## Deployment costs

The SDK overview shows deployment costs for the selected calendar month (UTC), cached for one hour. Owner and Administrator can read costs by default; custom roles can receive `cloud.cost.read` separately. The report is app-wide and includes production and preview resources. Currency totals and provider-reported costs remain separate from estimates.

- **Cloudflare:** usage-based list-price estimates for Workers, gateway/dashboard containers, D1 and Durable Objects. Shared plan fees, logging, image-registry charges, allowances and discounts are excluded. Daily peak database storage is an estimate. Analytics access and retention determine which periods are available.
- **AWS:** Cost Explorer charges grouped by service and filtered by the app’s `trulyyou:application` tag. Activate that tag in AWS Billing after resources appear; reporting can take 24–48 hours. The deployment role needs `ce:GetCostAndUsage`. Untagged services and shared costs are excluded. Face Liveness API charges are not individually resource-tagged and need separate attribution.
- **Azure:** actual charges for the app’s resource group and, for the Dashboard app, its installation resource group. The connected identity needs Cost Management query access.
- **Google Cloud:** connect a Cloud Billing BigQuery export in the cost panel. Grant the installation identity BigQuery Job User and read access to that dataset. Queries filter the project and `trulyyou_application` resource label, include credits and cap scans at 1 GB. Unlabeled services are excluded.

Missing permissions, delayed bills and unavailable components appear as unavailable, never as zero. Existing resources receive billing tags on their next explicit deployment. The connected cloud identity reads costs directly; customer cloud credentials and billing records are not sent to TrulyYou’s control service.
