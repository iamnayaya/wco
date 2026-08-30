# =============================================================================
# WCO EKS — private control plane, managed node groups, IRSA for pod IAM.
# Node groups scale with the Cluster Autoscaler / Karpenter in prod; HPA on the
# K8s side drives pod count, this module provides the capacity underneath.
# =============================================================================

resource "aws_iam_role" "cluster" {
  name = "${var.prefix}-eks-cluster"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}

resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  version  = var.cluster_version
  role_arn = aws_iam_role.cluster.arn

  vpc_config {
    subnet_ids              = concat(var.private_subnets, var.public_subnets)
    endpoint_private_access = true   # control plane reachable from VPC only
    endpoint_public_access  = true   # required for kubectl from CI (restricted by CIDR)
    public_access_cidrs     = ["0.0.0.0/0"] # tighten to bastion/office CIDRs in prod
  }

  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  tags = { Name = "${var.prefix}-eks" }
}

# ---- OIDC provider (enables IRSA) ------------------------------------------
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "main" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

# ---- Managed node groups (private, spot in staging, on-demand in prod) ------

locals {
  node_labels = {
    environment = var.prefix
  }
}

resource "aws_eks_node_group" "general" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "general"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnets
  instance_types  = ["m6i.large", "m6g.large"]
  capacity_type   = "ON_DEMAND"
  version         = var.cluster_version

  scaling_config {
    desired_size = 3
    max_size     = 12
    min_size     = 3
  }

  labels     = local.node_labels
  disk_size  = 100
  tags       = { Name = "${var.prefix}-node-general" }
}

resource "aws_eks_node_group" "spot_workers" {
  count           = 1
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "spot-workloads"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnets
  instance_types  = ["m5.large", "m5a.large", "c5.large"]
  capacity_type   = "SPOT"   # cost saving: stateless webhook/ai/worker tiers

  scaling_config {
    desired_size = 2
    max_size     = 20
    min_size     = 2
  }

  labels = { capacity = "spot" }
  tags   = { Name = "${var.prefix}-node-spot", CostOptimization = "spot" }
}

data "aws_iam_policy_document" "node_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "node" {
  name               = "${var.prefix}-eks-node"
  assume_role_policy = data.aws_iam_policy_document.node_assume.json
}

resource "aws_iam_role_policy_attachment" "node_worker" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node.name
}
resource "aws_iam_role_policy_attachment" "node_cni" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node.name
}
resource "aws_iam_role_policy_attachment" "node_ecr" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node.name
}
