# =============================================================================
# WCO observability — CloudWatch alarms over the *managed* data plane.
# Kubernetes/application metrics are handled by Prometheus + Grafana (see
# infra/monitoring); this module covers services we can't scrape (RDS, Redis,
# MQ) and forwards everything to the shared SNS alert channel.
# =============================================================================

locals {
  prefix = var.prefix
}

# RDS: CPU + free storage + connections. Storage alarm is the noisy-but-vital one.
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.prefix}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_actions       = [var.alert_sns_arn]
  dimensions = { DBInstanceIdentifier = var.database_identifier }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${local.prefix}-rds-free-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "60"
  statistic           = "Average"
  threshold           = "10000000000" # 10 GB in bytes
  alarm_actions       = [var.alert_sns_arn]
  dimensions = { DBInstanceIdentifier = var.database_identifier }
}

# ElastiCache: CPU + memory swap alarm (evictions break the cache, not correctness).
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${local.prefix}-redis-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_actions       = [var.alert_sns_arn]
  dimensions = { CacheClusterId = "${local.prefix}-redis" }
}
