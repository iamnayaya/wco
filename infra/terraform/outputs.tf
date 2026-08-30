output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "database_endpoint" {
  description = "RDS primary endpoint (host:port)"
  value       = module.cluster.database_endpoint
}

output "redis_endpoint" {
  description = "ElastiCache primary endpoint"
  value       = module.cluster.redis_endpoint
}

output "rabbitmq_endpoint" {
  value = module.cluster.rabbitmq_endpoint
}

output "cdn_domain" {
  value = module.edge.cdn_domain
}

output "waf_acl_arn" {
  description = "ARN to attach to the ALB Ingress (see kubernetes/base/ingress.yaml)"
  value       = module.edge.waf_acl_arn
}
