variable "prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "alert_sns_arn" {
  type        = string
  description = "SNS topic ARN for alarm fan-out (created in the security module)"
}

variable "database_identifier" {
  type        = string
  default     = ""
  description = "RDS DB instance identifier for CW alarm dimensions"
}
