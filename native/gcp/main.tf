terraform {
  required_version = ">= 1.5, < 2.0"
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}

variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "europe-west1"
  validation {
    condition     = contains(["europe-west1", "us-central1"], var.region)
    error_message = "Select europe-west1 or us-central1."
  }
}
variable "installation_name" {
  type    = string
  default = "trulyyou-dashboard"
  validation {
    condition     = can(regex("^trulyyou-[a-z0-9-]{3,20}$", var.installation_name))
    error_message = "Use trulyyou- followed by 3–20 lowercase letters, digits or hyphens."
  }
}
variable "company_name" { type = string }
variable "owner_email" {
  type = string
  validation {
    condition     = can(regex("^[^ @]+@[^ @]+\\.[^ @]+$", var.owner_email))
    error_message = "Enter the email to verify at first sign-in."
  }
}
variable "dns_zone" { type = string }
variable "dashboard_host" {
  type        = string
  description = "A new, unused hostname within the public DNS zone."
}

provider "google" { project = var.project_id }
locals {
  name     = var.installation_name
  labels   = { trulyyou_application = "app_dashboard_${trimprefix(local.name, "trulyyou-")}" }
  services = toset(["compute.googleapis.com", "storage.googleapis.com", "iam.googleapis.com", "cloudresourcemanager.googleapis.com", "dns.googleapis.com", "cloudfunctions.googleapis.com", "run.googleapis.com", "cloudbuild.googleapis.com", "artifactregistry.googleapis.com", "firestore.googleapis.com"])
  roles    = toset(["roles/browser", "roles/cloudfunctions.admin", "roles/run.admin", "roles/iam.serviceAccountAdmin", "roles/iam.serviceAccountUser", "roles/resourcemanager.projectIamAdmin", "roles/storage.admin", "roles/artifactregistry.admin", "roles/cloudbuild.builds.editor", "roles/serviceusage.serviceUsageAdmin", "roles/datastore.owner", "roles/dns.admin", "roles/compute.loadBalancerAdmin"])
}
resource "google_project_service" "services" {
  for_each           = local.services
  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}
data "google_dns_managed_zone" "dashboard" {
  name       = var.dns_zone
  depends_on = [google_project_service.services]
}
resource "google_storage_bucket" "state" {
  name                        = "${local.name}-${var.project_id}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning { enabled = true }
  labels     = local.labels
  depends_on = [google_project_service.services]
}
resource "google_service_account" "dashboard" {
  account_id   = local.name
  display_name = "TrulyYou dashboard deployment"
  depends_on   = [google_project_service.services]
}
resource "google_project_iam_member" "dashboard" {
  for_each = local.roles
  project  = var.project_id
  role     = each.key
  member   = "serviceAccount:${google_service_account.dashboard.email}"
}
# DNS Admin excludes zone IAM changes needed to authorize the gateway identity.
resource "google_project_iam_custom_role" "provisioning" {
  role_id     = "${replace(local.name, "-", "_")}_provisioning"
  title       = "TrulyYou deployment support"
  permissions = ["dns.managedZones.setIamPolicy", "compute.regions.list"]
}
resource "google_project_iam_member" "provisioning" {
  project = var.project_id
  role    = google_project_iam_custom_role.provisioning.name
  member  = "serviceAccount:${google_service_account.dashboard.email}"
}
resource "google_compute_network" "dashboard" {
  name                    = local.name
  auto_create_subnetworks = false
  depends_on              = [google_project_service.services]
}
resource "google_compute_subnetwork" "dashboard" {
  name          = local.name
  region        = var.region
  network       = google_compute_network.dashboard.id
  ip_cidr_range = "10.85.0.0/24"
}
resource "google_compute_firewall" "https" {
  name          = "${local.name}-https"
  network       = google_compute_network.dashboard.id
  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.name]
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}
resource "google_compute_address" "dashboard" {
  name       = local.name
  region     = var.region
  labels     = local.labels
  depends_on = [google_project_service.services]
}
resource "google_compute_instance" "dashboard" {
  name                      = local.name
  zone                      = "${var.region}-b"
  machine_type              = "e2-standard-2"
  labels                    = local.labels
  tags                      = [local.name]
  allow_stopping_for_update = true
  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 40
      type  = "pd-balanced"
    }
  }
  network_interface {
    subnetwork = google_compute_subnetwork.dashboard.id
    access_config { nat_ip = google_compute_address.dashboard.address }
  }
  service_account {
    email  = google_service_account.dashboard.email
    scopes = ["cloud-platform"]
  }
  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }
  metadata = { block-project-ssh-keys = "true" }
  metadata_startup_script = templatefile("${path.module}/startup.sh.tftpl", { config = base64encode(jsonencode({
    provider = "gcp", target = var.project_id, region = var.region,
    zone     = var.dns_zone, domain = var.dashboard_host, company = var.company_name,
    owner    = var.owner_email, name = local.name, bucket = google_storage_bucket.state.name,
    image    = "ghcr.io/truly-you/trulyyou-dashboard@sha256:02db704f5ccc546bb8d220b5f80edb14930aa2943b9933cc2b11df55ce28a231"
  })) })
  lifecycle {
    precondition {
      condition     = data.google_dns_managed_zone.dashboard.visibility == "public" && endswith(var.dashboard_host, ".${trimsuffix(data.google_dns_managed_zone.dashboard.dns_name, ".")}")
      error_message = "Choose a new hostname inside the selected public DNS zone."
    }
  }
  depends_on = [google_project_iam_member.dashboard, google_project_iam_member.provisioning, google_compute_firewall.https]
}
resource "google_dns_record_set" "dashboard" {
  name         = "${var.dashboard_host}."
  type         = "A"
  ttl          = 60
  managed_zone = data.google_dns_managed_zone.dashboard.name
  rrdatas      = [google_compute_address.dashboard.address]
}
output "dashboard_url" { value = "https://${var.dashboard_host}" }
output "state_bucket" { value = google_storage_bucket.state.name }
