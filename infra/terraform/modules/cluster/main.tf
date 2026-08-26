terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.30"
    }
  }

  backend "s3" {
    bucket         = "wco-terraform-state"
    key            = "platform/terraform.tfstate"
    region         = "eu-west-1"
    dynamodb_table = "wco-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "wco"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
