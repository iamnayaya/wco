variable "db_password" {
  type      = string
  sensitive = true
}

variable "rabbitmq_password" {
  type      = string
  sensitive = true
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "vpc_id" {
  type = string
}
