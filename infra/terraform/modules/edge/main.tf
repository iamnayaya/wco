# =============================================================================
# WCO edge — object storage, CDN, DNS, TLS, WAF.
# Buckets are private; access flows through CloudFront (uploads) and presigned
# URLs (exports). Nothing here is world-readable unless it must be.
# =============================================================================

locals {
  env = var.environment
}

# ---- S3: uploads (private) ---------------------------------------------------
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.prefix}-uploads"
  tags   = { Name = "${var.prefix}-uploads" }
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
      kms_master_key_id = aws_kms_key.storage.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle: expire old export files, transition warm objects to IA.
resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "exports"
    status = "Enabled"
    filter { prefix = "exports/" }
    expiration { days = 30 }
  }
  rule {
    id     = "warm"
    status = "Enabled"
    filter { prefix = "images/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

# ---- CloudFront CDN (private uploads served via signed CNAME) ---------------
resource "aws_cloudfront_origin_access_control" "uploads" {
  name                              = "${var.prefix}-uploads-oac"
  description                       = "CloudFront → S3 via OAC"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # African + EU edge pop coverage, low cost

  origin {
    domain_name              = aws_s3_bucket.uploads.bucket_regional_domain_name
    origin_id                = "uploads"
    origin_access_control_id = aws_cloudfront_origin_access_control.uploads.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "uploads"
    viewer_protocol_policy = "redirect-to-https"
    compress = true

    forwarded_values {
      query_string = true
      cookies { forward = "none" }
    }
    min_ttl     = 0
    default_ttl = 300
    max_ttl     = 86400
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

# ---- KMS key for the module (referenced by S3) ------------------------------
resource "aws_kms_key" "storage" {
  description         = "WCO storage encryption key"
  enable_key_rotation = true
}

# ---- Route53 + ACM ----------------------------------------------------------
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

resource "aws_acm_certificate" "main" {
  domain_name               = "*.${var.domain_name}"
  validation_method         = "DNS"
  subject_alternative_names = [var.domain_name]
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name  = dvo.resource_record_name
      type  = dvo.resource_record_type
      value = dvo.resource_record_value
    }
  }
  allow_overwrite = true
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.value]
  ttl             = 60
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_route53_record" "cdn" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "cdn.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.cdn.domain_name]
}

# ---- WAFv2 (regional, attached to the ALB by the load balancer controller) --
resource "aws_wafv2_web_acl" "main" {
  name        = "${var.prefix}-waf"
  description = "WCO L7 protection"
  scope       = "REGIONAL"

  default_action { allow {} }

  # Managed rule groups — OWASP-level baseline
  rule {
    name     = "aws-managed-sql"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      sampled_requests_enabled   = true
      metric_name                = "wco-sqli"
    }
  }

  rule {
    name     = "aws-managed-xss"
    priority = 2
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesXSSRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      sampled_requests_enabled   = true
      metric_name                = "wco-xss"
    }
  }

  rule {
    name     = "aws-managed-bot"
    priority = 3
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesBotControlRuleSet"
        vendor_name = "AWS"
        managed_rule_group_configs {
          aws_managed_rules_bot_control_rule_set {
            inspection_level = "COMMON"
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      sampled_requests_enabled   = true
      metric_name                = "wco-bot"
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    sampled_requests_enabled   = true
    metric_name                = "wco-waf"
  }

  tags = { Name = "${var.prefix}-waf" }
}
