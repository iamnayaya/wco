variable "region" {
  type    = string
  default = "eu-west-1" # closest region to Lagos with full EKS support
}

variable "environment" {
  type = string
}

variable "cluster_name" {
  type    = string
  default = "wco"
}
