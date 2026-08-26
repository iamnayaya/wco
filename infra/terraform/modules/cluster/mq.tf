# Amazon MQ (RabbitMQ) — managed broker, single-instance in dev, cluster in prod.
resource "aws_mq_broker" "rabbitmq" {
  broker_name             = "wco-${var.environment}"
  engine_type             = "RABBITMQ"
  engine_version          = "3.12.13"
  host_instance_type      = var.environment == "prod" ? "mq.m5.xlarge" : "mq.t3.micro"
  deployment_mode         = var.environment == "prod" ? "CLUSTER_MULTI_AZ" : "SINGLE_INSTANCE"
  publicly_accessible     = false
  auto_minor_version_upgrade = true

  user {
    username = "wco"
    password = var.rabbitmq_password
  }

  security_groups = [aws_security_group.rabbitmq.id]
  subnet_ids      = var.environment == "prod" ? var.private_subnet_ids : [var.private_subnet_ids[0]]

  tags = { Name = "wco-rabbitmq-${var.environment}" }
}
