output "database_identifier" {
  value = aws_db_instance.postgres.identifier
}

output "database_endpoint" {
  description = "RDS primary endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "database_name" {
  value = aws_db_instance.postgres.db_name
}

output "database_username" {
  value = aws_db_instance.postgres.username
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "rabbitmq_endpoint" {
  value = aws_mq_broker.rabbitmq.endpoint
}
