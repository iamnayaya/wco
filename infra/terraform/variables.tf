variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)."
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev, staging, prod."
  }
}

variable "region" {
  type        = string
  description = "AWS region (primary). Closest full-EKS region to Lagos."
  default     = "af-south-1"
}

variable "secondary_region" {
  type        = string
  description = "AWS region for DR / multi-region (read replica, cross-region backup)."
  default     = "eu-west-1"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
}

variable "cluster_name" {
  type        = string
  default     = "wco"
}

variable "db_password" {
  type      = string
  sensitive = true
  description = "Master DB password (from Secrets Manager in CI)."
}

variable "rabbitmq_password" {
  type      = string
  sensitive = true
}

variable "domain_name" {
  type        = string
  default     = "wco.africa"
  description = "Root domain; subdomains app., api., cdn. are created automatically."
}

variable "alarm_email" {
  type        = string
  default     = "platform-alerts@wco.africa"
  description = "SNS topic endpoint for infrastructure alarms (GuardDuty, budgets, RDS)."
}
