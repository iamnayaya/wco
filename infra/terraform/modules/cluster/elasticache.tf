# ElastiCache Redis — used for cache, throttling counters and refresh tokens.
# AOF off: this is ephemeral state; durability lives in Postgres.
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "wco-${var.environment}"
  description                = "WCO ${var.environment} Redis"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.environment == "prod" ? "cache.r6g.large" : "cache.t4g.small"
  num_cache_clusters         = var.environment == "prod" ? 3 : 1
  automatic_failover_enabled = var.environment == "prod"
  multi_az_enabled           = var.environment == "prod"
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  tags = { Name = "wco-redis-${var.environment}" }
}
