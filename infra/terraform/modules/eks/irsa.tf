# IRSA — IAM roles for Kubernetes service accounts. Pods assume these roles
# via projected OIDC tokens, eliminating static AWS keys in the cluster.
# Service account annotations live in infra/kubernetes/base/serviceaccount.yaml.

locals {
  oidc_url   = replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")
  account_id = data.aws_caller_identity.current.account_id
}

data "aws_caller_identity" "current" {}

# ---- Policy documents per service -------------------------------------------

# Backend: S3 (uploads), SES (email), SecretsManager (own secrets on boot).
data "aws_iam_policy_document" "backend" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = ["arn:aws:s3:::${var.prefix}-uploads", "arn:aws:s3:::${var.prefix}-uploads/*"]
  }
  statement {
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]
  }
}

# Webhook-handler: read webhook secrets only.
data "aws_iam_policy_document" "webhook_handler" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = ["arn:aws:secretsmanager:*:${local.account_id}:secret:${var.prefix}/webhook-handler*"]
  }
}

# AI Engine: LLM calls only need outbound network (NAT); grant S3 read for the
# prompt/cache store.
data "aws_iam_policy_document" "ai_engine" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["arn:aws:s3:::${var.prefix}-prompts/*"]
  }
}

# ---- Role builder using the OIDC trust --------------------------------------

locals {
  service_roles = {
    backend         = data.aws_iam_policy_document.backend.json
    webhook-handler = data.aws_iam_policy_document.webhook_handler.json
    ai-engine       = data.aws_iam_policy_document.ai_engine.json
  }
}

resource "aws_iam_role" "service" {
  for_each = local.service_roles
  name     = "${var.prefix}-${each.key}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.main.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_url}:aud" = "sts.amazonaws.com"
          "${local.oidc_url}:sub" = "system:serviceaccount:${var.prefix}:wco-${each.key}"
        }
      }
    }]
  })

  inline_policy {
    name   = each.key
    policy = each.value
  }

  tags = { Name = "wco-${var.prefix}-${each.key}" }
}
