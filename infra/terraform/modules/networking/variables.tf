variable "prefix" {
  type = string
}

variable "region" {
  type    = string
  default = "af-south-1"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

# 3 AZs × 2 tiers (public/private) = 6 subnets; aligned with EKS + RDS requirements.
variable "azs" {
  type    = list(string)
  default = ["af-south-1a", "af-south-1b", "af-south-1c"]
}

variable "cidrs" {
  type = object({
    public  = list(string)
    private = list(string)
  })
  default = {
    public  = ["10.0.0.0/20", "10.0.16.0/20", "10.0.32.0/20"]
    private = ["10.0.128.0/18", "10.0.192.0/18", "10.0.64.0/18"]
  }
}
