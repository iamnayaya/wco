# RDS PostgreSQL — Multi-AZ, encrypted at rest.
resource "aws_db_instance" "postgres" {
  identifier                   = "wco-${var.environment}"
  engine                       = "postgres"
  engine_version               = "15.5"
  instance_class               = var.environment == "prod" ? "db.r6g.xlarge" : "db.t4g.medium"
  allocated_storage            = var.environment == "prod" ? 200 : 50
  max_allocated_storage        = var.environment == "prod" ? 2000 : 200
  storage_encrypted            = true

  db_name  = "wco"
  username = "wco_app"
  password = var.db_password # from Secrets Manager via tfvars (gitignored)

  multi_az               = var.environment == "prod"
  backup_retention_period = var.environment == "prod" ? 30 : 7
  deletion_protection    = var.environment == "prod"
  skip_final_snapshot    = var.environment != "prod"

  vpc_security_group_ids = [aws_security_group.postgres.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name

  performance_insights_enabled = true

  tags = { Name = "wco-postgres-${var.environment}" }
}
