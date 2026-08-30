output "uploads_bucket" {
  value = aws_s3_bucket.uploads.id
}

output "cdn_domain" {
  value = aws_cloudfront_distribution.cdn.domain_name
}

output "waf_acl_id" {
  value = aws_wafv2_web_acl.main.id
}

output "waf_acl_arn" {
  value = aws_wafv2_web_acl.main.arn
}

output "certificate_arn" {
  value = aws_acm_certificate.main.arn
}
