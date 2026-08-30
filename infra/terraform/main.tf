# =============================================================================
# WCO — Root Terraform composition
# Composes environment-agnostic modules into a full platform per workspace.
# Every module is reusable and environment-shaped by `var.environment`.
# =============================================================================

locals {
  # A unique-ish suffix for resources that must be globally or region-wide unique.
  name_prefix = "wco-${var.environment}"
}

# ---------------------------------------------------------------------------
# Networking — VPC + subnets + routing + NAT + per-tier security groups
# ---------------------------------------------------------------------------
module "networking" {
  source  = "./modules/networking"
  prefix  = local.name_prefix
  vpc_cidr = var.vpc_cidr
  region  = var.region
}

# ---------------------------------------------------------------------------
# EKS — managed control plane + managed node groups + Fargate profiles + IRSA
# ---------------------------------------------------------------------------
module "eks" {
  source          = "./modules/eks"
  prefix          = local.name_prefix
  cluster_name    = var.cluster_name
  vpc_id          = module.networking.vpc_id
  private_subnets = module.networking.private_subnets
  public_subnets  = module.networking.public_subnets
}

# ---------------------------------------------------------------------------
# Data plane — RDS, ElastiCache, RabbitMQ (reuses the existing cluster module)
# ---------------------------------------------------------------------------
module "cluster" {
  source             = "./modules/cluster"
  region             = var.region
  environment        = var.environment
  cluster_name       = var.cluster_name
  db_password        = var.db_password
  rabbitmq_password  = var.rabbitmq_password
  private_subnet_ids = module.networking.private_subnets
  vpc_id             = module.networking.vpc_id
}

# ---------------------------------------------------------------------------
# Edge — S3 + CloudFront CDN, Route53, ACM, WAF ACL
# ---------------------------------------------------------------------------
module "edge" {
  source           = "./modules/edge"
  prefix           = local.name_prefix
  environment      = var.environment
  domain_name      = var.domain_name
  vpc_id           = module.networking.vpc_id
}

# ---------------------------------------------------------------------------
# Security — GuardDuty, Security Hub, Inspector, Cost Budgets, KMS keys
# ---------------------------------------------------------------------------
module "security" {
  source      = "./modules/security"
  prefix      = local.name_prefix
  environment = var.environment
  alarm_email = var.alarm_email
}

module "observability" {
  source         = "./modules/observability"
  prefix         = local.name_prefix
  environment    = var.environment
  region         = var.region
  alert_sns_arn  = module.security.alerts_sns_arn
  database_identifier = module.cluster.database_identifier
}
