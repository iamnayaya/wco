# =============================================================================
# WCO security posture — threat detection + compliance baseline + cost guardrails.
# Companion to infra/security/* (Pod Security, Kyverno) which cover the cluster.
# =============================================================================

locals {
  account = data.aws_caller_identity.current.account_id
}

data "aws_caller_identity" "current" {}

# ---- Single SNS topic fans out to the alert channel -------------------------
resource "aws_sns_topic" "alerts" {
  name = "${var.prefix}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ---- GuardDuty: threat detection ---------------------------------------------
resource "aws_guardduty_detector" "main" {
  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"
}

# ---- Security Hub: consolidated compliance posture ---------------------------
resource "aws_securityhub_account" "main" {
  enable_default_standards = true
}

# ---- Inspector: vulnerability scanning on ECR + EC2 --------------------------
resource "aws_inspector2_enabler" "main" {
  resource_types = ["ECR", "EC2"]
}

# ---- Cost budgets (guardrails, not just tracking) ----------------------------
resource "aws_budgets_budget" "monthly" {
  count = var.environment == "prod" ? 1 : 0

  name         = "wco-monthly"
  budget_type  = "COST"
  limit_amount = "50000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator = "GREATER_THAN"
    threshold           = 80
    threshold_type      = "PERCENTAGE"
    notification_type   = "ACTUAL"
    subscriber_email_addresses = [var.alarm_email]
  }
  notification {
    comparison_operator = "GREATER_THAN"
    threshold           = 100
    threshold_type      = "PERCENTAGE"
    notification_type   = "ACTUAL"
    subscriber_email_addresses = [var.alarm_email]
  }
}

data "aws_region" "current" {}
