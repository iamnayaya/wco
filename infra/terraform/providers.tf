# Provider configuration. Credentials are resolved from environment / IRSA in
# CI (never committed). All resources are tagged with the standard WCO tag set
# so the cost-allocation dashboard can slice by project/environment/owner.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "wco"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "platform-engineering"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}
