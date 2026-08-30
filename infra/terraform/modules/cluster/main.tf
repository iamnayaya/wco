terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.30"
    }
  }
}

# =============================================================================
# WCO data plane module — RDS, ElastiCache, Amazon MQ (RabbitMQ)
# Self-contained: creates its own subnet groups + security groups given VPC
# context (all passed in from the root module, never hard-coded).
# =============================================================================

locals {
  prefix = "wco-${var.environment}"
}

# RDS + ElastiCache require dedicated subnet groups spanning >= 2 AZs.
resource "aws_db_subnet_group" "main" {
  name       = "${local.prefix}-db"
  subnet_ids = var.private_subnet_ids
  tags       = { Name = "${local.prefix}-db-subnets" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.prefix}-cache"
  subnet_ids = var.private_subnet_ids
  tags       = { Name = "${local.prefix}-cache-subnets" }
}

# ---- Security groups: database tier (private, egress stripped) ------------

resource "aws_security_group" "postgres" {
  name        = "${local.prefix}-postgres"
  description = "PostgreSQL access — nodes only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${local.prefix}-postgres-sg" }
}

resource "aws_security_group" "redis" {
  name        = "${local.prefix}-redis"
  description = "Redis access — nodes only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${local.prefix}-redis-sg" }
}

resource "aws_security_group" "rabbitmq" {
  name        = "${local.prefix}-rabbitmq"
  description = "RabbitMQ access — nodes + app containers only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${local.prefix}-rabbitmq-sg" }
}
